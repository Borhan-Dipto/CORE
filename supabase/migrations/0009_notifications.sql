-- 0009: Partner notifications (in-app + email) and weekly summary
-- Events: expense/boosting, investment, withdrawal (incl. profit payouts), reversals of those,
--         period closed (profit distributed), settlement undone, weekly summary.
-- Everyone active in the business is notified except the person who made the change.
-- Email delivery: the app claims pending rows (claim_notification_emails) right after a change,
-- and a weekly cron calls weekly_digest() with a secret token. No service-role key is needed.

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  business_id  uuid references public.businesses (id) on delete cascade,
  kind         text not null,
  payload      jsonb not null default '{}'::jsonb,
  link         text,
  read_at      timestamptz,
  email_status text not null default 'pending' check (email_status in ('pending', 'sent', 'skipped', 'failed')),
  created_at   timestamptz not null default now()
);
create index if not exists notifications_user on public.notifications (user_id, created_at desc);
create index if not exists notifications_pending on public.notifications (business_id, created_at) where email_status = 'pending';

alter table public.notifications enable row level security;
drop policy if exists notif_read on public.notifications;
drop policy if exists notif_update on public.notifications;
create policy notif_read on public.notifications for select using (user_id = auth.uid());
create policy notif_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.notifications from anon, authenticated, public;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- internal key/value config (cron token hash). No access for API roles.
create table if not exists public.app_config (key text primary key, value text not null, updated_at timestamptz not null default now());
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated, public;

-- ---------- Fan-out ----------
create or replace function public.notify_members(p_business uuid, p_kind text, p_payload jsonb, p_link text) returns void
language sql security definer set search_path = public as $$
  insert into notifications (user_id, business_id, kind, payload, link)
  select m.user_id, p_business, p_kind,
         p_payload || jsonb_build_object('business', b.name, 'actor', coalesce(a.full_name, a.email)),
         p_link
    from business_members m
    join businesses b on b.id = p_business
    left join profiles a on a.id = auth.uid()
   where m.business_id = p_business and m.status = 'active'
     and m.user_id is distinct from auth.uid();
$$;
revoke all on function public.notify_members(uuid, text, jsonb, text) from public, anon, authenticated;

create or replace function public.notify_on_txn() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_kind text; v_partner text; v_orig financial_transactions;
begin
  if new.txn_type not in ('expense', 'investment', 'withdrawal') then return new; end if;
  -- entries created while closing a period are covered by the "settlement" notification
  if new.settlement_id is not null and exists (select 1 from profit_settlements s where s.id = new.settlement_id and s.created_at = new.created_at) then
    return new;
  end if;
  -- a partner-paid expense creates a linked capital row; notify once (for the expense)
  if new.txn_type = 'investment' and new.linked_txn_id is not null then return new; end if;
  if coalesce(current_setting('core.settlement', true), '') = 'on' then return new; end if;

  v_kind := case when new.status = 'reversal' then 'reversal'
                 when new.txn_type = 'withdrawal' and new.settlement_id is not null then 'payout'
                 else new.txn_type::text end;
  select coalesce(full_name, email) into v_partner from profiles where id = new.partner_id;
  perform public.notify_members(new.business_id, v_kind, jsonb_build_object(
    'txn_id', coalesce(new.reversal_of, new.id), 'txn_type', new.txn_type, 'amount', new.amount, 'date', new.txn_date,
    'title', coalesce(new.title, new.category_name), 'category', new.category_name, 'ad', new.is_advertising,
    'campaign', new.campaign_name, 'partner', v_partner, 'reason', new.reversal_reason),
    '/b/' || new.business_id || case when new.txn_type = 'expense' then '/expenses' else '/capital' end);
  return new;
end $$;
drop trigger if exists fin_txn_notify on public.financial_transactions;
create trigger fin_txn_notify after insert on public.financial_transactions
  for each row execute function public.notify_on_txn();

create or replace function public.notify_on_settlement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify_members(new.business_id, 'settlement', jsonb_build_object(
      'settlement_id', new.id, 'no', new.settlement_no, 'from', new.period_from, 'to', new.period_to,
      'net_profit', new.net_profit, 'amount', new.distributable, 'carry_out', new.carry_out),
      '/b/' || new.business_id || '/settlements');
  elsif old.status = 'final' and new.status = 'void' then
    perform public.notify_members(new.business_id, 'settlement_void', jsonb_build_object(
      'settlement_id', new.id, 'no', new.settlement_no, 'from', new.period_from, 'to', new.period_to,
      'amount', new.distributable, 'reason', new.void_reason),
      '/b/' || new.business_id || '/settlements');
  end if;
  return new;
end $$;
drop trigger if exists settlement_notify on public.profit_settlements;
create trigger settlement_notify after insert or update on public.profit_settlements
  for each row execute function public.notify_on_settlement();

-- Allocations are inserted after the settlement row; add each partner's own share to their notification.
create or replace function public.notify_add_share() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update notifications n set payload = n.payload || jsonb_build_object('my_share', new.share_amount, 'my_percentage', new.percentage)
   where n.kind = 'settlement' and n.user_id = new.partner_id and (n.payload->>'settlement_id')::uuid = new.settlement_id;
  return new;
end $$;
drop trigger if exists allocation_notify on public.profit_allocations;
create trigger allocation_notify after insert or update on public.profit_allocations
  for each row execute function public.notify_add_share();

-- ---------- Email claiming (called by the app right after a change, by the person who made it) ----------
create or replace function public.claim_notification_emails(p_business uuid)
returns table (id uuid, email text, name text, language text, kind text, payload jsonb, link text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_write_business(p_business) then raise exception 'not_authorized'; end if;
  -- people who switched email off
  update notifications n set email_status = 'skipped'
    from profiles p
   where n.business_id = p_business and n.email_status = 'pending' and p.id = n.user_id
     and (coalesce((p.notify_prefs->>'email')::boolean, true) = false or p.email is null);
  return query
  with c as (
    update notifications n set email_status = 'sent'
     where n.business_id = p_business and n.email_status = 'pending' and n.created_at > now() - interval '1 day'
       and n.kind <> 'weekly'
    returning n.id, n.user_id, n.kind, n.payload, n.link
  )
  select c.id, p.email, coalesce(p.full_name, p.email), p.language, c.kind, c.payload, c.link
    from c join profiles p on p.id = c.user_id;
end $$;

create or replace function public.mark_notification_email(p_ids uuid[], p_status text) returns void
language sql security definer set search_path = public as $$
  update notifications set email_status = p_status
   where id = any(p_ids) and p_status in ('failed', 'sent')
     and public.can_write_business(business_id);
$$;

-- ---------- Weekly summary (cron, token-protected) ----------
create or replace function public.weekly_digest(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hash text; v_to date := (now() at time zone 'Asia/Dhaka')::date - 1; v_from date := v_to - 6;
  b record; v_pl jsonb; v_orders int; v_out jsonb := '[]'::jsonb; v_payload jsonb;
begin
  select value into v_hash from app_config where key = 'cron_token_sha256';
  if v_hash is null or encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') <> v_hash then raise exception 'not_authorized'; end if;
  -- once per week
  if exists (select 1 from notifications where kind = 'weekly' and created_at > now() - interval '5 days') then return '[]'::jsonb; end if;

  for b in select id, name from businesses where status = 'active' loop
    v_pl := public.profit_and_loss(b.id, v_from, v_to);
    select count(*) into v_orders from orders where business_id = b.id and order_date between v_from and v_to;
    v_payload := jsonb_build_object('business', b.name, 'from', v_from, 'to', v_to, 'orders', v_orders,
      'revenue', v_pl->'revenue', 'ad_spend', v_pl->'ad_spend', 'operating_expenses', v_pl->'operating_expenses',
      'gross_profit', v_pl->'gross_profit', 'net_profit', v_pl->'net_profit', 'roas', v_pl->'roas',
      'cash', (select coalesce(sum(balance), 0) from public.account_balances(b.id)));
    insert into notifications (user_id, business_id, kind, payload, link, email_status)
    select m.user_id, b.id, 'weekly', v_payload, '/b/' || b.id,
           case when coalesce((p.notify_prefs->>'weekly')::boolean, true) and p.email is not null then 'sent' else 'skipped' end
      from business_members m join profiles p on p.id = m.user_id
     where m.business_id = b.id and m.status = 'active';
    v_out := v_out || coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'email', p.email, 'name', coalesce(p.full_name, p.email),
              'language', p.language, 'kind', 'weekly', 'payload', n.payload, 'link', n.link))
       from notifications n join profiles p on p.id = n.user_id
      where n.business_id = b.id and n.kind = 'weekly' and n.email_status = 'sent' and n.created_at = now()), '[]'::jsonb);
  end loop;
  return v_out;
end $$;

revoke all on function public.notify_on_txn(), public.notify_on_settlement(), public.notify_add_share() from public, anon, authenticated;
revoke all on function public.claim_notification_emails(uuid), public.mark_notification_email(uuid[], text) from public, anon;
grant execute on function public.claim_notification_emails(uuid), public.mark_notification_email(uuid[], text) to authenticated;
revoke all on function public.weekly_digest(text) from public, authenticated;
grant execute on function public.weekly_digest(text) to anon;
