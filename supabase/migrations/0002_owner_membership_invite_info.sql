-- =====================================================================
-- CORE · Phase 1 · 0002
-- 1) The owner is automatically a partner (for profit share / capital) in every business they create.
-- 2) invitation_info(token): lets an invitee see which business invited them (token = proof).
-- 3) set_profit_shares(): save a full split at once, validated to total 100%.
-- =====================================================================

-- 1) Owner auto-membership
create or replace function public.add_creator_membership() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null then
    insert into business_members (business_id, user_id, created_by)
    values (new.id, new.created_by, new.created_by)
    on conflict (business_id, user_id) where status = 'active' do nothing;
  end if;
  return new;
end $$;

create trigger businesses_add_creator after insert on public.businesses
  for each row execute function public.add_creator_membership();

-- Owner may re-add themselves as partner if they were removed.
create or replace function public.add_owner_membership(p_business uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_write_business(p_business) then raise exception 'not_authorized'; end if;
  insert into business_members (business_id, user_id, created_by)
  values (p_business, auth.uid(), auth.uid())
  on conflict (business_id, user_id) where status = 'active' do nothing;
end $$;

-- 2) Invitation preview for the invite page (works signed-out)
create or replace function public.invitation_info(p_token text)
returns table (business_name text, email text, status public.invitation_status, expired boolean)
language sql stable security definer set search_path = public, extensions as $$
  select b.name, i.email, i.status, i.expires_at < now()
    from business_invitations i join businesses b on b.id = i.business_id
   where i.token_hash = encode(digest(p_token, 'sha256'), 'hex');
$$;

-- 3) Set the whole profit split in one call.
-- p_shares: [{"user_id": "...", "percentage": 50}, ...] — must cover active partners and total 100.
-- Re-saving the same effective date replaces that date's split (history for other dates is untouched).
create or replace function public.set_profit_shares(p_business uuid, p_effective date, p_shares jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_total numeric;
begin
  if not public.can_write_business(p_business) then raise exception 'not_authorized'; end if;
  if p_effective is null then raise exception 'invalid_date'; end if;
  select coalesce(sum((s->>'percentage')::numeric), 0) into v_total from jsonb_array_elements(p_shares) s;
  if v_total <> 100 then raise exception 'shares_must_total_100'; end if;
  if exists (select 1 from jsonb_array_elements(p_shares) s where (s->>'percentage')::numeric < 0) then
    raise exception 'negative_share';
  end if;
  delete from profit_sharing_rules where business_id = p_business and effective_from = p_effective;
  insert into profit_sharing_rules (business_id, user_id, percentage, effective_from)
  select p_business, (s->>'user_id')::uuid, (s->>'percentage')::numeric, p_effective
    from jsonb_array_elements(p_shares) s;
end $$;

create trigger audit_profit_delete after delete on public.profit_sharing_rules
  for each row execute function public.audit_row();

revoke all on function public.add_creator_membership() from public, anon, authenticated;
revoke all on function public.add_owner_membership(uuid), public.invitation_info(text),
               public.set_profit_shares(uuid, date, jsonb) from public, anon, authenticated;
grant execute on function public.add_owner_membership(uuid), public.set_profit_shares(uuid, date, jsonb) to authenticated;
grant execute on function public.invitation_info(text) to anon, authenticated;
