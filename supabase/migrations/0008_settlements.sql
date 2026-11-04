-- 0008: Profit settlement (period close & distribution)
-- Accounting model (partnership capital accounts):
--   * Closing a period credits each partner's share of distributable profit to their capital ("profit_share", non-cash).
--   * Paying it out is an ordinary withdrawal (cash leaves an account), tagged with the settlement.
--   * Whatever is not paid out simply stays in the business as that partner's capital.
--   * Losses are carried forward and recovered from later profits before anything is distributed.
--   * Periods are closed in order, back to back; only the latest settlement can be voided (all its entries are reversed).

create table if not exists public.profit_settlements (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses (id) on delete restrict,
  settlement_no  integer not null,
  period_from    date not null,
  period_to      date not null check (period_to >= period_from),
  net_profit     numeric(14,2) not null,       -- snapshot of P&L net profit for the period
  carry_in       numeric(14,2) not null default 0 check (carry_in >= 0),  -- unrecovered loss brought forward
  distributable  numeric(14,2) not null check (distributable >= 0),
  carry_out      numeric(14,2) not null default 0 check (carry_out >= 0),
  pnl            jsonb not null default '{}'::jsonb,
  note           text,
  status         text not null default 'final' check (status in ('final', 'void')),
  void_reason    text,
  voided_at      timestamptz,
  created_by     uuid default auth.uid(),
  created_at     timestamptz not null default now(),
  unique (business_id, settlement_no)
);
create index if not exists settlements_business on public.profit_settlements (business_id, period_to desc);

create table if not exists public.profit_allocations (
  id             uuid primary key default gen_random_uuid(),
  settlement_id  uuid not null references public.profit_settlements (id) on delete cascade,
  business_id    uuid not null references public.businesses (id) on delete restrict,
  partner_id     uuid not null references auth.users (id),
  percentage     numeric(6,3) not null,
  share_amount   numeric(14,2) not null check (share_amount >= 0),
  unique (settlement_id, partner_id)
);

alter table public.financial_transactions add column if not exists settlement_id uuid references public.profit_settlements (id);
create index if not exists fin_txn_settlement on public.financial_transactions (settlement_id) where settlement_id is not null;

-- Fix: a split is a complete set. A partner left out of a newer split has 0%, so only the
-- latest split on or before the date counts (previously older rows of dropped partners leaked through).
create or replace function public.profit_shares_on(p_business uuid, p_date date default current_date)
returns table (user_id uuid, percentage numeric, effective_from date)
language sql stable security definer set search_path = public as $$
  select r.user_id, r.percentage, r.effective_from
    from profit_sharing_rules r
   where r.business_id = p_business
     and public.can_read_business(p_business)
     and r.effective_from = (select max(x.effective_from) from profit_sharing_rules x
                              where x.business_id = p_business and x.effective_from <= p_date);
$$;

-- doc numbers: profit credit notes get their own series
create or replace function public.doc_kind(p public.txn_type) returns text
language sql immutable set search_path = public as $$
  select case p when 'expense' then 'PV' when 'investment' then 'MR' when 'income' then 'MR'
                when 'withdrawal' then 'WV' when 'transfer' then 'TV' when 'profit_share' then 'PS' end;
$$;

-- profit_share rows can only be written by the settlement functions
create or replace function public.guard_profit_share() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.txn_type = 'profit_share' and coalesce(current_setting('core.settlement', true), '') <> 'on' then
    raise exception 'use_settlement';
  end if;
  return new;
end $$;
drop trigger if exists fin_txn_profit_guard on public.financial_transactions;
create trigger fin_txn_profit_guard before insert on public.financial_transactions
  for each row execute function public.guard_profit_share();

-- reversal rows keep their settlement link
create or replace function public.reverse_transaction(p_txn uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare t financial_transactions;
begin
  select * into t from financial_transactions where id = p_txn for update;
  if not found or not public.can_write_business(t.business_id) then raise exception 'not_authorized'; end if;
  if t.status <> 'posted' then raise exception 'already_reversed'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  foreach t in array array(
    select f from financial_transactions f
     where f.status = 'posted' and (f.id = p_txn or f.id = t.linked_txn_id or f.linked_txn_id = p_txn))
  loop
    update financial_transactions set status = 'reversed', reversal_reason = trim(p_reason) where id = t.id;
    insert into financial_transactions (business_id, txn_type, status, txn_date, amount, account_id, to_account_id,
      category_id, category_name, is_advertising, partner_id, ad_platform, campaign_name, target_product, title,
      description, reversal_of, reversal_reason, order_id, settlement_id)
    values (t.business_id, t.txn_type, 'reversal', (now() at time zone 'Asia/Dhaka')::date, t.amount, t.account_id,
      t.to_account_id, t.category_id, t.category_name, t.is_advertising, t.partner_id, t.ad_platform, t.campaign_name,
      t.target_product, t.title, t.description, t.id, trim(p_reason), t.order_id, t.settlement_id);
  end loop;
end $$;

-- capital now includes profit credited
drop function if exists public.partner_capital(uuid);
create function public.partner_capital(p_business uuid)
returns table (partner_id uuid, invested numeric, withdrawn numeric, balance numeric, paid_expenses numeric, profit_credited numeric, profit_paid numeric)
language sql stable set search_path = public as $$
  select m.user_id,
         coalesce(sum(t.amount) filter (where t.txn_type = 'investment'), 0),
         coalesce(sum(t.amount) filter (where t.txn_type = 'withdrawal'), 0),
         coalesce(sum(t.amount) filter (where t.txn_type in ('investment', 'profit_share')), 0)
           - coalesce(sum(t.amount) filter (where t.txn_type = 'withdrawal'), 0),
         coalesce(sum(t.amount) filter (where t.txn_type = 'investment' and t.linked_txn_id is not null), 0),
         coalesce(sum(t.amount) filter (where t.txn_type = 'profit_share'), 0),
         coalesce(sum(t.amount) filter (where t.txn_type = 'withdrawal' and t.settlement_id is not null), 0)
  from business_members m
  left join financial_transactions t on t.business_id = m.business_id and t.partner_id = m.user_id and t.status = 'posted'
  where m.business_id = p_business
  group by m.user_id
  having bool_or(m.status = 'active') or count(t.id) > 0;
$$;

-- What closing a period would do (no side effects) — used for the preview screen and by settle_profit.
create or replace function public.settlement_preview(p_business uuid, p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  last profit_settlements; v_pl jsonb; v_net numeric; v_carry numeric; v_avail numeric; v_dist numeric; v_alloc jsonb;
  v_total numeric; v_next date;
begin
  if not public.can_read_business(p_business) then raise exception 'not_authorized'; end if;
  select * into last from profit_settlements where business_id = p_business and status = 'final' order by period_to desc limit 1;
  v_next := case when last.id is null then null else last.period_to + 1 end;
  if p_from is null or p_to is null or p_to < p_from then raise exception 'invalid_period'; end if;
  if v_next is not null and p_from <> v_next then raise exception 'period_must_follow_last'; end if;
  if p_to > (now() at time zone 'Asia/Dhaka')::date then raise exception 'period_in_future'; end if;

  v_pl := public.profit_and_loss(p_business, p_from, p_to);
  v_net := round(coalesce((v_pl->>'net_profit')::numeric, 0), 2);
  v_carry := coalesce(last.carry_out, 0);
  v_avail := v_net - v_carry;
  v_dist := greatest(v_avail, 0);

  select coalesce(sum(percentage), 0) into v_total from public.profit_shares_on(p_business, p_to);
  select coalesce(jsonb_agg(jsonb_build_object(
           'partner_id', s.user_id, 'name', coalesce(p.full_name, p.email), 'percentage', s.percentage,
           'share', round(v_dist * s.percentage / 100, 2),
           'active', exists (select 1 from business_members m where m.business_id = p_business and m.user_id = s.user_id and m.status = 'active'))
           order by s.percentage desc, s.user_id), '[]'::jsonb)
    into v_alloc
    from public.profit_shares_on(p_business, p_to) s left join profiles p on p.id = s.user_id
   where s.percentage > 0;

  return jsonb_build_object(
    'period_from', p_from, 'period_to', p_to, 'next_from', v_next, 'net_profit', v_net, 'carry_in', v_carry,
    'distributable', v_dist, 'carry_out', greatest(-v_avail, 0), 'shares_total', v_total,
    'allocations', v_alloc, 'pnl', v_pl);
end $$;

create or replace function public.settle_profit(p_business uuid, p_from date, p_to date, p_payouts jsonb default '[]', p_note text default null, p_paid_on date default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  pv jsonb; v_id uuid; v_no integer; a jsonb; v_share numeric; v_sum numeric := 0; v_top uuid; p jsonb;
  v_amt numeric; v_label text; v_paid date := coalesce(p_paid_on, (now() at time zone 'Asia/Dhaka')::date);
begin
  if not public.can_write_business(p_business) then raise exception 'not_authorized'; end if;
  perform pg_advisory_xact_lock(hashtext('settle:' || p_business::text));
  pv := public.settlement_preview(p_business, p_from, p_to);
  if (pv->>'distributable')::numeric > 0 and (pv->>'shares_total')::numeric <> 100 then raise exception 'shares_must_total_100'; end if;
  if (pv->>'distributable')::numeric > 0 and exists (select 1 from jsonb_array_elements(pv->'allocations') x where not (x->>'active')::boolean) then
    raise exception 'share_partner_inactive';
  end if;

  select coalesce(max(settlement_no), 0) + 1 into v_no from profit_settlements where business_id = p_business;
  insert into profit_settlements (business_id, settlement_no, period_from, period_to, net_profit, carry_in, distributable, carry_out, pnl, note)
  values (p_business, v_no, p_from, p_to, (pv->>'net_profit')::numeric, (pv->>'carry_in')::numeric, (pv->>'distributable')::numeric,
          (pv->>'carry_out')::numeric, pv->'pnl', nullif(trim(p_note), ''))
  returning id into v_id;

  -- allocations; rounding difference goes to the largest share so totals match exactly
  for a in select * from jsonb_array_elements(pv->'allocations') loop
    insert into profit_allocations (settlement_id, business_id, partner_id, percentage, share_amount)
    values (v_id, p_business, (a->>'partner_id')::uuid, (a->>'percentage')::numeric, (a->>'share')::numeric);
    v_sum := v_sum + (a->>'share')::numeric;
    if v_top is null then v_top := (a->>'partner_id')::uuid; end if;
  end loop;
  if v_top is not null and v_sum <> (pv->>'distributable')::numeric then
    update profit_allocations set share_amount = share_amount + ((pv->>'distributable')::numeric - v_sum)
     where settlement_id = v_id and partner_id = v_top;
  end if;

  v_label := 'Profit share ' || to_char(p_from, 'DD Mon YYYY') || ' – ' || to_char(p_to, 'DD Mon YYYY');
  perform set_config('core.settlement', 'on', true);
  insert into financial_transactions (business_id, txn_type, txn_date, amount, partner_id, title, settlement_id)
    select p_business, 'profit_share', p_to, share_amount, partner_id, v_label, v_id
      from profit_allocations where settlement_id = v_id and share_amount > 0;
  perform set_config('core.settlement', 'off', true);

  -- optional cash payouts now (each ≤ that partner's share for this period)
  for p in select * from jsonb_array_elements(coalesce(p_payouts, '[]'::jsonb)) loop
    v_amt := round(coalesce((p->>'amount')::numeric, 0), 2);
    continue when v_amt <= 0;
    select share_amount into v_share from profit_allocations where settlement_id = v_id and partner_id = (p->>'partner_id')::uuid;
    if v_share is null or v_amt > v_share then raise exception 'payout_exceeds_share'; end if;
    if (p->>'account_id') is null then raise exception 'account_required'; end if;
    insert into financial_transactions (business_id, txn_type, txn_date, amount, account_id, partner_id, title, settlement_id)
    values (p_business, 'withdrawal', v_paid, v_amt, (p->>'account_id')::uuid, (p->>'partner_id')::uuid, 'Profit payout — ' || v_label, v_id);
  end loop;
  return v_id;
end $$;

-- Pay (part of) a settled share later
create or replace function public.pay_profit(p_settlement uuid, p_partner uuid, p_account uuid, p_amount numeric, p_date date default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare s profit_settlements; v_share numeric; v_paid numeric; v_id uuid;
begin
  select * into s from profit_settlements where id = p_settlement;
  if not found or not public.can_write_business(s.business_id) then raise exception 'not_authorized'; end if;
  if s.status <> 'final' then raise exception 'settlement_void'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount'; end if;
  if p_account is null then raise exception 'account_required'; end if;
  select share_amount into v_share from profit_allocations where settlement_id = p_settlement and partner_id = p_partner;
  select coalesce(sum(amount), 0) into v_paid from financial_transactions
   where settlement_id = p_settlement and partner_id = p_partner and txn_type = 'withdrawal' and status = 'posted';
  if v_share is null or round(p_amount, 2) > v_share - v_paid then raise exception 'payout_exceeds_share'; end if;
  insert into financial_transactions (business_id, txn_type, txn_date, amount, account_id, partner_id, title, settlement_id)
  values (s.business_id, 'withdrawal', coalesce(p_date, (now() at time zone 'Asia/Dhaka')::date), round(p_amount, 2), p_account, p_partner,
          'Profit payout — ' || to_char(s.period_from, 'DD Mon YYYY') || ' – ' || to_char(s.period_to, 'DD Mon YYYY'), p_settlement)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.void_settlement(p_settlement uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare s profit_settlements; r record;
begin
  select * into s from profit_settlements where id = p_settlement for update;
  if not found or not public.can_write_business(s.business_id) then raise exception 'not_authorized'; end if;
  if s.status <> 'final' then raise exception 'settlement_void'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  if exists (select 1 from profit_settlements where business_id = s.business_id and status = 'final' and period_to > s.period_to) then
    raise exception 'void_latest_first';
  end if;
  perform set_config('core.settlement', 'on', true);
  for r in select id from financial_transactions where settlement_id = p_settlement and status = 'posted' and reversal_of is null loop
    perform public.reverse_transaction(r.id, 'Settlement voided: ' || trim(p_reason));
  end loop;
  perform set_config('core.settlement', 'off', true);
  update profit_settlements set status = 'void', void_reason = trim(p_reason), voided_at = now() where id = p_settlement;
end $$;

-- ---------- Audit, RLS, grants ----------
drop trigger if exists audit_settlements on public.profit_settlements;
create trigger audit_settlements after insert or update on public.profit_settlements for each row execute function public.audit_row();

alter table public.profit_settlements enable row level security;
alter table public.profit_allocations enable row level security;
drop policy if exists settlements_read on public.profit_settlements;
drop policy if exists allocations_read on public.profit_allocations;
create policy settlements_read on public.profit_settlements for select using (public.can_read_business(business_id));
create policy allocations_read on public.profit_allocations for select using (public.can_read_business(business_id));

revoke all on public.profit_settlements, public.profit_allocations from anon, authenticated, public;
grant select on public.profit_settlements, public.profit_allocations to authenticated;

revoke all on function public.settlement_preview(uuid, date, date) from public, anon;
revoke all on function public.settle_profit(uuid, date, date, jsonb, text, date) from public, anon;
revoke all on function public.pay_profit(uuid, uuid, uuid, numeric, date) from public, anon;
revoke all on function public.void_settlement(uuid, text) from public, anon;
revoke all on function public.partner_capital(uuid) from public, anon;
revoke all on function public.guard_profit_share() from public, anon, authenticated;
grant execute on function public.settlement_preview(uuid, date, date), public.settle_profit(uuid, date, date, jsonb, text, date),
  public.pay_profit(uuid, uuid, uuid, numeric, date), public.void_settlement(uuid, text), public.partner_capital(uuid) to authenticated;
