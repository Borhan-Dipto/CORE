-- =====================================================================
-- CORE · Phase 1 · Foundation
-- Identity, businesses, memberships, invitations, profit-share rules,
-- audit log, and Row Level Security (multi-tenant isolation).
-- Run once in Supabase → SQL Editor.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- Enums ----------
create type public.business_status   as enum ('active', 'archived');
create type public.member_role       as enum ('partner');            -- owner is global (platform_owners)
create type public.member_status     as enum ('active', 'removed');
create type public.invitation_status as enum ('pending', 'accepted', 'expired', 'revoked');

-- ---------- Tables ----------
create table public.platform_owners (
  user_id    uuid primary key references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  full_name    text,
  avatar_url   text,
  language     text not null default 'bn' check (language in ('bn', 'en')),
  notify_prefs jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.businesses (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null check (length(trim(name)) > 0),
  logo_url               text,
  description            text,
  category               text,
  email                  text,
  phone                  text,
  address                text,
  start_date             date,
  currency               text not null default 'BDT',
  timezone               text not null default 'Asia/Dhaka',
  fiscal_year_start_month smallint not null default 7 check (fiscal_year_start_month between 1 and 12),
  status                 public.business_status not null default 'active',
  created_by             uuid references auth.users (id) default auth.uid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table public.business_members (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses (id) on delete restrict,
  user_id       uuid not null references auth.users (id) on delete restrict,
  role          public.member_role   not null default 'partner',
  status        public.member_status not null default 'active',
  invitation_id uuid,
  joined_at     timestamptz not null default now(),
  removed_at    timestamptz,
  created_by    uuid default auth.uid()
);
create unique index business_members_one_active
  on public.business_members (business_id, user_id) where status = 'active';
create index business_members_user_idx on public.business_members (user_id) where status = 'active';

create table public.business_invitations (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  email       text not null check (email = lower(email)),
  token_hash  text not null unique,
  status      public.invitation_status not null default 'pending',
  invited_by  uuid default auth.uid(),
  expires_at  timestamptz not null default now() + interval '7 days',
  accepted_by uuid references auth.users (id),
  accepted_at timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);
create unique index business_invitations_one_pending
  on public.business_invitations (business_id, email) where status = 'pending';

-- Immutable, effective-dated rows. A change = a new row with a later effective_from.
create table public.profit_sharing_rules (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses (id) on delete restrict,
  user_id        uuid not null references auth.users (id) on delete restrict,
  percentage     numeric(5,2) not null check (percentage >= 0 and percentage <= 100),
  effective_from date not null,
  created_by     uuid default auth.uid(),
  created_at     timestamptz not null default now(),
  unique (business_id, user_id, effective_from)
);

create table public.audit_logs (
  id          bigint generated always as identity primary key,
  business_id uuid,
  user_id     uuid,
  action      text not null,
  module      text not null,
  record_id   text,
  old_value   jsonb,
  new_value   jsonb,
  created_at  timestamptz not null default now()
);
create index audit_logs_business_idx on public.audit_logs (business_id, created_at desc);

-- ---------- Authorization helpers ----------
create or replace function public.is_platform_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_owners where user_id = auth.uid());
$$;

create or replace function public.is_active_member(bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from business_members m
    where m.business_id = bid and m.user_id = auth.uid() and m.status = 'active');
$$;

create or replace function public.can_read_business(bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_platform_owner() or public.is_active_member(bid);
$$;

-- Writes: owner only, and only while the business is active (archived = read-only).
create or replace function public.can_write_business(bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_platform_owner()
     and exists (select 1 from businesses where id = bid and status = 'active');
$$;

-- ---------- Generic triggers ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) - 'token_hash' end;
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) - 'token_hash' end;
  v_row jsonb := coalesce(v_new, v_old);
begin
  insert into audit_logs (business_id, user_id, action, module, record_id, old_value, new_value)
  values (
    case when tg_table_name = 'businesses' then (v_row->>'id')::uuid
         else (v_row->>'business_id')::uuid end,
    auth.uid(), lower(tg_op), tg_table_name, v_row->>'id', v_old, v_new);
  return coalesce(new, old);
end $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, lower(new.email), new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end $$;

create or replace function public.check_profit_rule_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from business_members
                 where business_id = new.business_id and user_id = new.user_id and status = 'active') then
    raise exception 'profit rule user is not an active partner of this business';
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger profiles_updated_at   before update on public.profiles   for each row execute function public.set_updated_at();
create trigger businesses_updated_at before update on public.businesses for each row execute function public.set_updated_at();
create trigger profit_rule_member    before insert on public.profit_sharing_rules for each row execute function public.check_profit_rule_member();

create trigger audit_businesses  after insert or update on public.businesses           for each row execute function public.audit_row();
create trigger audit_members     after insert or update on public.business_members     for each row execute function public.audit_row();
create trigger audit_invitations after insert or update on public.business_invitations for each row execute function public.audit_row();
create trigger audit_profit      after insert           on public.profit_sharing_rules for each row execute function public.audit_row();

-- ---------- Invitation workflow ----------
-- Owner creates an invitation; the plain token is returned ONCE (only its hash is stored).
create or replace function public.create_invitation(p_business uuid, p_email text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_email text := lower(trim(p_email));
  v_token text;
begin
  if not public.can_write_business(p_business) then raise exception 'not_authorized'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if exists (select 1 from business_members m join profiles p on p.id = m.user_id
             where m.business_id = p_business and m.status = 'active' and p.email = v_email) then
    raise exception 'already_member';
  end if;
  update business_invitations set status = 'expired'
   where business_id = p_business and email = v_email and status = 'pending' and expires_at < now();
  v_token := encode(gen_random_bytes(32), 'hex');
  insert into business_invitations (business_id, email, token_hash)
  values (p_business, v_email, encode(digest(v_token, 'sha256'), 'hex'));
  return v_token;
end $$;

create or replace function public.revoke_invitation(p_invitation uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_owner() then raise exception 'not_authorized'; end if;
  update business_invitations set status = 'revoked', revoked_at = now()
   where id = p_invitation and status = 'pending';
  if not found then raise exception 'invitation_not_pending'; end if;
end $$;

-- Logged-in invitee accepts; email must match the invitation.
create or replace function public.accept_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_inv   business_invitations;
  v_email text := lower(auth.jwt()->>'email');
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into v_inv from business_invitations
   where token_hash = encode(digest(p_token, 'sha256'), 'hex') for update;
  if not found or v_inv.status <> 'pending' then raise exception 'invalid_invitation'; end if;
  if v_inv.expires_at < now() then raise exception 'invitation_expired'; end if;
  if v_inv.email <> v_email then raise exception 'email_mismatch'; end if;
  if not exists (select 1 from businesses where id = v_inv.business_id and status = 'active') then
    raise exception 'business_inactive';
  end if;
  insert into business_members (business_id, user_id, invitation_id, created_by)
  values (v_inv.business_id, auth.uid(), v_inv.id, v_inv.invited_by)
  on conflict (business_id, user_id) where status = 'active' do nothing;
  update business_invitations set status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
   where id = v_inv.id;
  return v_inv.business_id;
end $$;

-- Owner removes a partner (soft): access ends immediately, history stays.
create or replace function public.remove_member(p_member uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_owner() then raise exception 'not_authorized'; end if;
  update business_members set status = 'removed', removed_at = now()
   where id = p_member and status = 'active';
  if not found then raise exception 'member_not_active'; end if;
end $$;

-- Profit shares in force on a date (latest effective row per partner).
create or replace function public.profit_shares_on(p_business uuid, p_date date default current_date)
returns table (user_id uuid, percentage numeric, effective_from date)
language sql stable security definer set search_path = public as $$
  select distinct on (r.user_id) r.user_id, r.percentage, r.effective_from
    from profit_sharing_rules r
   where r.business_id = p_business and r.effective_from <= p_date
     and public.can_read_business(p_business)
   order by r.user_id, r.effective_from desc;
$$;

-- ---------- Row Level Security ----------
alter table public.platform_owners      enable row level security;
alter table public.profiles             enable row level security;
alter table public.businesses           enable row level security;
alter table public.business_members     enable row level security;
alter table public.business_invitations enable row level security;
alter table public.profit_sharing_rules enable row level security;
alter table public.audit_logs           enable row level security;

create policy po_self on public.platform_owners for select using (user_id = auth.uid());

create policy profiles_read on public.profiles for select using (
  id = auth.uid() or public.is_platform_owner() or exists (
    select 1 from business_members a join business_members b on b.business_id = a.business_id
     where a.user_id = auth.uid() and a.status = 'active' and b.user_id = profiles.id));
create policy profiles_update_self on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

create policy biz_read   on public.businesses for select using (public.can_read_business(id));
create policy biz_insert on public.businesses for insert with check (public.is_platform_owner());
create policy biz_update on public.businesses for update
  using (public.is_platform_owner()) with check (public.is_platform_owner());

create policy members_read on public.business_members for select using (public.can_read_business(business_id));

create policy inv_read on public.business_invitations for select using (public.is_platform_owner());

create policy profit_read   on public.profit_sharing_rules for select using (public.can_read_business(business_id));
create policy profit_insert on public.profit_sharing_rules for insert with check (public.can_write_business(business_id));

create policy audit_read on public.audit_logs for select using (
  public.is_platform_owner() or (business_id is not null and public.is_active_member(business_id)));

-- ---------- Grants (explicit, least privilege) ----------
-- Works whether or not "Automatically expose new tables" is enabled in Supabase.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;
grant usage on schema public to authenticated;

grant select on public.platform_owners, public.profiles, public.businesses, public.business_members,
                public.business_invitations, public.profit_sharing_rules, public.audit_logs to authenticated;
grant insert, update on public.businesses to authenticated;
grant insert on public.profit_sharing_rules to authenticated;
grant update (full_name, avatar_url, language, notify_prefs) on public.profiles to authenticated;

grant execute on function public.is_platform_owner(), public.is_active_member(uuid),
  public.can_read_business(uuid), public.can_write_business(uuid),
  public.create_invitation(uuid, text), public.revoke_invitation(uuid),
  public.accept_invitation(text), public.remove_member(uuid),
  public.profit_shares_on(uuid, date) to authenticated;

-- ---------- Owner bootstrap (run ONCE after creating your user in Auth) ----------
-- insert into public.platform_owners (user_id)
-- select id from auth.users where email = 'YOUR_EMAIL@example.com';
