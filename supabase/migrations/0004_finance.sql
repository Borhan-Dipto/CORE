-- =====================================================================
-- CORE · Phase 2 · 0004 · Financial foundation
-- Accounts (Cash/bKash/Bank…), expense categories, one immutable ledger for
-- expenses (incl. advertising/boosting), income, partner investments,
-- withdrawals and transfers. Corrections are reversals, never edits/deletes.
-- Accounting rules: investment ≠ revenue, withdrawal ≠ expense,
-- transfer = neither, advertising counted exactly once.
-- =====================================================================

create type public.txn_type    as enum ('expense', 'income', 'investment', 'withdrawal', 'transfer');
create type public.txn_status  as enum ('posted', 'reversed', 'reversal');
create type public.account_type as enum ('cash', 'bank', 'bkash', 'nagad', 'rocket', 'other_mfs', 'gateway', 'other');
create type public.ad_platform as enum ('facebook', 'instagram', 'google', 'tiktok', 'other');

-- Per-user theme preference
alter table public.profiles add column if not exists theme text not null default 'light'
  check (theme in ('light', 'dark', 'system'));

-- ---------- Tables ----------
create table public.business_accounts (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses (id) on delete restrict,
  name            text not null check (length(trim(name)) between 1 and 60),
  type            public.account_type not null default 'cash',
  opening_balance numeric(14,2) not null default 0,
  is_active       boolean not null default true,
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  unique (business_id, name)
);

create table public.expense_categories (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses (id) on delete restrict,
  name           text not null check (length(trim(name)) between 1 and 60),
  is_advertising boolean not null default false,
  is_active      boolean not null default true,
  created_by     uuid default auth.uid(),
  created_at     timestamptz not null default now(),
  unique (business_id, name)
);

create table public.financial_transactions (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses (id) on delete restrict,
  txn_type       public.txn_type not null,
  status         public.txn_status not null default 'posted',
  txn_date       date not null,
  amount         numeric(14,2) not null check (amount > 0),
  account_id     uuid references public.business_accounts (id),
  to_account_id  uuid references public.business_accounts (id),
  category_id    uuid references public.expense_categories (id),
  category_name  text,                       -- snapshot: history survives renames
  is_advertising boolean not null default false,
  partner_id     uuid references auth.users (id), -- investor / withdrawer / partner who paid an expense personally
  ad_platform    public.ad_platform,
  campaign_name  text,
  target_product text,
  title          text,
  description    text,
  reference      text,
  linked_txn_id  uuid references public.financial_transactions (id), -- partner-paid expense <-> its capital contribution
  reversal_of    uuid references public.financial_transactions (id),
  reversal_reason text,
  created_by     uuid default auth.uid(),
  created_at     timestamptz not null default now()
);
create index fin_txn_business_date on public.financial_transactions (business_id, txn_date desc);
create index fin_txn_business_type on public.financial_transactions (business_id, txn_type, status);
create index fin_txn_partner on public.financial_transactions (business_id, partner_id) where partner_id is not null;

-- ---------- Integrity: everything linked must belong to the same business ----------
create or replace function public.check_txn_integrity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.account_id is not null and not exists (select 1 from business_accounts where id = new.account_id and business_id = new.business_id) then
    raise exception 'account_not_in_business';
  end if;
  if new.to_account_id is not null and not exists (select 1 from business_accounts where id = new.to_account_id and business_id = new.business_id) then
    raise exception 'account_not_in_business';
  end if;
  if new.category_id is not null and not exists (select 1 from expense_categories where id = new.category_id and business_id = new.business_id) then
    raise exception 'category_not_in_business';
  end if;
  if new.partner_id is not null and not exists (select 1 from business_members where business_id = new.business_id and user_id = new.partner_id) then
    raise exception 'partner_not_in_business';
  end if;
  return new;
end $$;
create trigger fin_txn_integrity before insert on public.financial_transactions
  for each row execute function public.check_txn_integrity();

-- Posted rows are immutable. Allowed changes: link a partner-paid expense to its capital row once,
-- and posted -> reversed (+ reason) via reverse_transaction().
create or replace function public.guard_txn_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.status = 'posted' and new.status = 'posted'
     and old.linked_txn_id is null and new.linked_txn_id is not null
     and (to_jsonb(new) - 'linked_txn_id') = (to_jsonb(old) - 'linked_txn_id') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'posted' and new.status = 'reversed'
     and (to_jsonb(new) - 'status' - 'reversal_reason') = (to_jsonb(old) - 'status' - 'reversal_reason') then
    return new;
  end if;
  raise exception 'ledger_is_immutable';
end $$;

create trigger fin_txn_guard before update on public.financial_transactions
  for each row execute function public.guard_txn_update();
create trigger fin_txn_no_delete before delete on public.financial_transactions
  for each row execute function public.guard_txn_update();

-- ---------- Defaults for every business ----------
create or replace function public.seed_business_finance(p_business uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into business_accounts (business_id, name, type) values
    (p_business, 'Cash', 'cash'), (p_business, 'bKash', 'bkash')
  on conflict do nothing;
  insert into expense_categories (business_id, name, is_advertising) values
    (p_business, 'Advertising / Boosting', true),
    (p_business, 'Product purchase', false),
    (p_business, 'Delivery', false),
    (p_business, 'Packaging', false),
    (p_business, 'Operational', false),
    (p_business, 'Software & subscriptions', false),
    (p_business, 'Other', false)
  on conflict do nothing;
end $$;

create or replace function public.businesses_seed_finance() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform public.seed_business_finance(new.id); return new; end $$;
create trigger businesses_seed_finance after insert on public.businesses
  for each row execute function public.businesses_seed_finance();

do $$ declare r record; begin for r in select id from public.businesses loop perform public.seed_business_finance(r.id); end loop; end $$;

-- ---------- Posting ----------
create or replace function public.post_transaction(
  p_business uuid, p_type public.txn_type, p_date date, p_amount numeric,
  p_account uuid default null, p_to_account uuid default null, p_category uuid default null,
  p_partner uuid default null, p_title text default null, p_description text default null,
  p_reference text default null, p_ad_platform public.ad_platform default null,
  p_campaign text default null, p_target_product text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_cap uuid; v_cat expense_categories;
begin
  if not public.can_write_business(p_business) then raise exception 'not_authorized'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount'; end if;
  if p_date is null or p_date > (now() at time zone 'Asia/Dhaka')::date + 1 then raise exception 'invalid_date'; end if;

  if p_type = 'expense' then
    if p_category is null then raise exception 'category_required'; end if;
    select * into v_cat from expense_categories where id = p_category and business_id = p_business;
    if not found then raise exception 'category_not_in_business'; end if;
    if p_account is null and p_partner is null then raise exception 'payment_source_required'; end if;
    if p_account is not null and p_partner is not null then raise exception 'one_payment_source'; end if;
  elsif p_type = 'income' then
    if p_account is null then raise exception 'account_required'; end if;
  elsif p_type = 'investment' then
    if p_partner is null then raise exception 'partner_required'; end if;
  elsif p_type = 'withdrawal' then
    if p_partner is null then raise exception 'partner_required'; end if;
    if p_account is null then raise exception 'account_required'; end if;
  elsif p_type = 'transfer' then
    if p_account is null or p_to_account is null then raise exception 'account_required'; end if;
    if p_account = p_to_account then raise exception 'same_account'; end if;
  end if;

  insert into financial_transactions (
    business_id, txn_type, txn_date, amount, account_id, to_account_id, category_id, category_name,
    is_advertising, partner_id, ad_platform, campaign_name, target_product, title, description, reference)
  values (
    p_business, p_type, p_date, round(p_amount, 2), p_account,
    case when p_type = 'transfer' then p_to_account end,
    case when p_type = 'expense' then p_category end,
    case when p_type = 'expense' then v_cat.name end,
    coalesce(v_cat.is_advertising, false),
    p_partner,
    case when v_cat.is_advertising then p_ad_platform end,
    case when v_cat.is_advertising then nullif(trim(p_campaign), '') end,
    nullif(trim(p_target_product), ''),
    nullif(trim(p_title), ''), nullif(trim(p_description), ''), nullif(trim(p_reference), ''))
  returning id into v_id;

  -- A partner paying a business expense from their own pocket = a capital contribution.
  if p_type = 'expense' and p_partner is not null then
    insert into financial_transactions (business_id, txn_type, txn_date, amount, partner_id, title, linked_txn_id)
    values (p_business, 'investment', p_date, round(p_amount, 2), p_partner,
            'Paid expense: ' || coalesce(nullif(trim(p_title), ''), v_cat.name), v_id)
    returning id into v_cap;
    update financial_transactions set linked_txn_id = v_cap where id = v_id;
  end if;
  return v_id;
end $$;

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
      description, reversal_of, reversal_reason)
    values (t.business_id, t.txn_type, 'reversal', (now() at time zone 'Asia/Dhaka')::date, t.amount, t.account_id,
      t.to_account_id, t.category_id, t.category_name, t.is_advertising, t.partner_id, t.ad_platform, t.campaign_name,
      t.target_product, t.title, t.description, t.id, trim(p_reason));
  end loop;
end $$;

-- ---------- Reporting (security invoker: RLS applies) ----------
create or replace function public.account_balances(p_business uuid, p_as_of date default null)
returns table (id uuid, name text, type public.account_type, is_active boolean,
               opening_balance numeric, money_in numeric, money_out numeric, balance numeric)
language sql stable set search_path = public as $$
  select a.id, a.name, a.type, a.is_active, a.opening_balance,
         coalesce(sum(t.amount) filter (where (t.txn_type in ('income','investment') and t.account_id = a.id)
                                            or (t.txn_type = 'transfer' and t.to_account_id = a.id)), 0) as money_in,
         coalesce(sum(t.amount) filter (where t.txn_type in ('expense','withdrawal','transfer') and t.account_id = a.id), 0) as money_out,
         a.opening_balance
         + coalesce(sum(t.amount) filter (where (t.txn_type in ('income','investment') and t.account_id = a.id)
                                              or (t.txn_type = 'transfer' and t.to_account_id = a.id)), 0)
         - coalesce(sum(t.amount) filter (where t.txn_type in ('expense','withdrawal','transfer') and t.account_id = a.id), 0)
  from business_accounts a
  left join financial_transactions t
    on t.business_id = a.business_id and t.status = 'posted'
   and (t.account_id = a.id or t.to_account_id = a.id)
   and (p_as_of is null or t.txn_date <= p_as_of)
  where a.business_id = p_business
  group by a.id order by a.created_at;
$$;

create or replace function public.partner_capital(p_business uuid)
returns table (partner_id uuid, invested numeric, withdrawn numeric, balance numeric, paid_expenses numeric)
language sql stable set search_path = public as $$
  select m.user_id,
         coalesce(sum(t.amount) filter (where t.txn_type = 'investment'), 0),
         coalesce(sum(t.amount) filter (where t.txn_type = 'withdrawal'), 0),
         coalesce(sum(t.amount) filter (where t.txn_type = 'investment'), 0) - coalesce(sum(t.amount) filter (where t.txn_type = 'withdrawal'), 0),
         coalesce(sum(t.amount) filter (where t.txn_type = 'investment' and t.linked_txn_id is not null), 0)
  from business_members m
  left join financial_transactions t on t.business_id = m.business_id and t.partner_id = m.user_id and t.status = 'posted'
  where m.business_id = p_business
  group by m.user_id
  having bool_or(m.status = 'active') or count(t.id) > 0;
$$;

create or replace function public.finance_summary(p_business uuid, p_from date, p_to date) returns jsonb
language sql stable set search_path = public as $$
  with t as (
    select * from financial_transactions
     where business_id = p_business and status = 'posted' and txn_date between p_from and p_to
  )
  select jsonb_build_object(
    'expenses',     coalesce((select sum(amount) from t where txn_type = 'expense'), 0),
    'ad_spend',     coalesce((select sum(amount) from t where txn_type = 'expense' and is_advertising), 0),
    'income',       coalesce((select sum(amount) from t where txn_type = 'income'), 0),
    'investments',  coalesce((select sum(amount) from t where txn_type = 'investment'), 0),
    'withdrawals',  coalesce((select sum(amount) from t where txn_type = 'withdrawal'), 0),
    'expense_count', (select count(*) from t where txn_type = 'expense'),
    'cash_balance', coalesce((select sum(balance) from public.account_balances(p_business, p_to)), 0),
    'total_capital', coalesce((select sum(balance) from public.partner_capital(p_business)), 0),
    'by_category', coalesce((select jsonb_agg(x order by x.total desc) from (
        select category_name as name, is_advertising, sum(amount) as total from t where txn_type = 'expense'
        group by category_name, is_advertising) x), '[]'::jsonb),
    'by_platform', coalesce((select jsonb_agg(x order by x.total desc) from (
        select coalesce(ad_platform::text, 'other') as platform, sum(amount) as total from t
         where txn_type = 'expense' and is_advertising group by 1) x), '[]'::jsonb),
    'by_product', coalesce((select jsonb_agg(x order by x.total desc) from (
        select target_product as product, sum(amount) as total from t
         where txn_type = 'expense' and is_advertising and target_product is not null group by 1) x), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(x order by x.day) from (
        select d::date as day,
               coalesce(sum(t.amount) filter (where t.txn_type = 'expense'), 0) as expenses,
               coalesce(sum(t.amount) filter (where t.txn_type = 'expense' and t.is_advertising), 0) as ad_spend,
               coalesce(sum(t.amount) filter (where t.txn_type = 'income'), 0) as income
          from generate_series(p_from, p_to, interval '1 day') d
          left join t on t.txn_date = d::date
         group by d) x), '[]'::jsonb)
  );
$$;

create or replace function public.global_summary(p_from date, p_to date)
returns table (business_id uuid, name text, status public.business_status, expenses numeric, ad_spend numeric,
               income numeric, investments numeric, cash_balance numeric, partners bigint)
language sql stable set search_path = public as $$
  select b.id, b.name, b.status,
         coalesce(sum(t.amount) filter (where t.txn_type = 'expense'), 0),
         coalesce(sum(t.amount) filter (where t.txn_type = 'expense' and t.is_advertising), 0),
         coalesce(sum(t.amount) filter (where t.txn_type = 'income'), 0),
         coalesce(sum(t.amount) filter (where t.txn_type = 'investment'), 0),
         coalesce((select sum(ab.balance) from public.account_balances(b.id, p_to) ab), 0),
         (select count(*) from business_members m where m.business_id = b.id and m.status = 'active')
  from businesses b
  left join financial_transactions t on t.business_id = b.id and t.status = 'posted' and t.txn_date between p_from and p_to
  group by b.id order by b.status, b.name;
$$;

-- ---------- RLS ----------
alter table public.business_accounts      enable row level security;
alter table public.expense_categories     enable row level security;
alter table public.financial_transactions enable row level security;

create policy acc_read   on public.business_accounts for select using (public.can_read_business(business_id));
create policy acc_insert on public.business_accounts for insert with check (public.can_write_business(business_id));
create policy acc_update on public.business_accounts for update using (public.can_write_business(business_id)) with check (public.can_write_business(business_id));

create policy cat_read   on public.expense_categories for select using (public.can_read_business(business_id));
create policy cat_insert on public.expense_categories for insert with check (public.can_write_business(business_id));
create policy cat_update on public.expense_categories for update using (public.can_write_business(business_id)) with check (public.can_write_business(business_id));

create policy txn_read on public.financial_transactions for select using (public.can_read_business(business_id));

-- ---------- Audit ----------
create trigger audit_accounts   after insert or update on public.business_accounts      for each row execute function public.audit_row();
create trigger audit_categories after insert or update on public.expense_categories     for each row execute function public.audit_row();
create trigger audit_txns       after insert or update on public.financial_transactions for each row execute function public.audit_row();

-- ---------- Grants ----------
revoke all on public.business_accounts, public.expense_categories, public.financial_transactions from public, anon, authenticated;
grant select on public.business_accounts, public.expense_categories, public.financial_transactions to authenticated;
grant insert (business_id, name, type, opening_balance) on public.business_accounts to authenticated;
grant update (name, type, is_active) on public.business_accounts to authenticated;
grant insert (business_id, name, is_advertising) on public.expense_categories to authenticated;
grant update (name, is_active) on public.expense_categories to authenticated;
grant update (theme) on public.profiles to authenticated;

revoke all on function public.check_txn_integrity(), public.guard_txn_update(), public.seed_business_finance(uuid),
  public.businesses_seed_finance() from public, anon, authenticated;
revoke all on function
  public.post_transaction(uuid, public.txn_type, date, numeric, uuid, uuid, uuid, uuid, text, text, text, public.ad_platform, text, text),
  public.reverse_transaction(uuid, text), public.account_balances(uuid, date), public.partner_capital(uuid),
  public.finance_summary(uuid, date, date), public.global_summary(date, date)
from public, anon;
grant execute on function
  public.post_transaction(uuid, public.txn_type, date, numeric, uuid, uuid, uuid, uuid, text, text, text, public.ad_platform, text, text),
  public.reverse_transaction(uuid, text), public.account_balances(uuid, date), public.partner_capital(uuid),
  public.finance_summary(uuid, date, date), public.global_summary(date, date)
to authenticated;
