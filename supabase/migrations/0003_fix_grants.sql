-- =====================================================================
-- CORE · 0003 · Re-apply least-privilege grants (idempotent).
-- Safe to run any number of times; makes the live DB match the intended permissions
-- regardless of which earlier version of 0001 was applied.
-- =====================================================================

-- Tables: start from nothing, then grant only what the app needs.
revoke all on all tables in schema public from anon, authenticated, public;
grant usage on schema public to authenticated;

grant select on public.platform_owners, public.profiles, public.businesses, public.business_members,
                public.business_invitations, public.profit_sharing_rules, public.audit_logs to authenticated;
grant insert, update on public.businesses to authenticated;
grant insert on public.profit_sharing_rules to authenticated;
grant update (full_name, avatar_url, language, notify_prefs) on public.profiles to authenticated;

-- Functions: nobody by default (Postgres grants EXECUTE to PUBLIC on creation).
revoke all on all functions in schema public from public, anon, authenticated;

-- Callable by signed-in users (each checks permissions internally; helpers are needed by RLS policies).
grant execute on function
  public.is_platform_owner(), public.is_active_member(uuid),
  public.can_read_business(uuid), public.can_write_business(uuid),
  public.create_invitation(uuid, text), public.revoke_invitation(uuid),
  public.accept_invitation(text), public.remove_member(uuid),
  public.profit_shares_on(uuid, date),
  public.add_owner_membership(uuid), public.set_profit_shares(uuid, date, jsonb),
  public.invitation_info(text)
to authenticated;

-- Callable signed-out: only the invite preview (requires the secret token).
grant execute on function public.invitation_info(text) to anon;

-- Future functions created in public are not executable by default.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- Pin search_path on the trigger helper (linter 0011).
alter function public.set_updated_at() set search_path = public;
