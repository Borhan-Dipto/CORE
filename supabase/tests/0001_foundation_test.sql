-- CORE · Phase 1 · security & access tests (run with psql against a Supabase-like DB)
\set ON_ERROR_STOP 1
\set O  '00000000-0000-0000-0000-00000000000a'
\set A  '00000000-0000-0000-0000-00000000000b'
\set B  '00000000-0000-0000-0000-00000000000c'
\set C  '00000000-0000-0000-0000-00000000000d'
\set X  '00000000-0000-0000-0000-00000000000e'

insert into auth.users (id, email) values
 (:'O','owner@core.test'),(:'A','a@core.test'),(:'B','b@core.test'),(:'C','c@core.test'),(:'X','x@core.test');
insert into public.platform_owners (user_id) values (:'O');

create or replace function public._expect_fail(sql text, label text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then raise notice 'PASS  %', label; return; end;
  raise exception 'FAIL  % (statement succeeded)', label;
end $$;
create or replace function public._expect(ok boolean, label text) returns void language plpgsql as $$
begin if ok then raise notice 'PASS  %', label; else raise exception 'FAIL  %', label; end if; end $$;
grant execute on function public._expect_fail(text,text), public._expect(boolean,text) to authenticated, anon;

-- ===== Owner =====
select set_config('request.jwt.claim.sub', :'O', false), set_config('request.jwt.claim.email','owner@core.test', false);
set role authenticated;
insert into businesses (id, name) values ('10000000-0000-0000-0000-000000000001','Doven BD'),('10000000-0000-0000-0000-000000000002','Oxygen');
select create_invitation('10000000-0000-0000-0000-000000000001','A@core.test') as tok_a \gset
select create_invitation('10000000-0000-0000-0000-000000000002','b@core.test') as tok_b \gset
select create_invitation('10000000-0000-0000-0000-000000000001','c@core.test') as tok_c1 \gset
select create_invitation('10000000-0000-0000-0000-000000000002','c@core.test') as tok_c2 \gset
select create_invitation('10000000-0000-0000-0000-000000000001','x@core.test') as tok_x \gset
select _expect((select count(*) from business_invitations where token_hash = :'tok_a') = 0, 'plain token is never stored');
select _expect_fail($$select create_invitation('10000000-0000-0000-0000-000000000001','not-an-email')$$, 'invalid email rejected');
select _expect_fail($$select create_invitation('10000000-0000-0000-0000-000000000001','a@core.test')$$, 'duplicate pending invite rejected');
reset role;

-- ===== Invitees accept =====
select set_config('request.jwt.claim.sub', :'B', false), set_config('request.jwt.claim.email','b@core.test', false);
set role authenticated;
select _expect_fail(format('select accept_invitation(%L)', :'tok_a'), 'email mismatch: B cannot use A''s invite');
select accept_invitation(:'tok_b');
reset role;

select set_config('request.jwt.claim.sub', :'A', false), set_config('request.jwt.claim.email','a@core.test', false);
set role authenticated;
select accept_invitation(:'tok_a');
select _expect_fail(format('select accept_invitation(%L)', :'tok_a'), 'accepted invite cannot be reused');
reset role;

select set_config('request.jwt.claim.sub', :'C', false), set_config('request.jwt.claim.email','c@core.test', false);
set role authenticated;
select accept_invitation(:'tok_c1'); select accept_invitation(:'tok_c2');
select _expect((select count(*) from businesses) = 2, 'C (partner in both) sees both businesses');
reset role;

-- ===== Isolation & read-only =====
select set_config('request.jwt.claim.sub', :'A', false), set_config('request.jwt.claim.email','a@core.test', false);
set role authenticated;
select _expect((select array_agg(name) from businesses) = array['Doven BD'], 'A sees only Doven');
select _expect((select count(*) from businesses where id = '10000000-0000-0000-0000-000000000002') = 0, 'A cannot fetch Oxygen by id (URL tampering)');
select _expect((select count(*) from business_members where business_id = '10000000-0000-0000-0000-000000000002') = 0, 'A cannot see Oxygen members');
select _expect((select count(*) from audit_logs where business_id = '10000000-0000-0000-0000-000000000002') = 0, 'A cannot see Oxygen audit log');
select _expect((select count(*) from audit_logs where business_id = '10000000-0000-0000-0000-000000000001') > 0, 'A can see Doven audit log');
select _expect((select count(*) from business_invitations) = 0, 'partner cannot read invitations/tokens');
select _expect((select count(*) from profiles where email = 'b@core.test') = 0, 'A cannot see B''s profile');
select _expect_fail($$insert into businesses (name) values ('hack')$$, 'partner cannot create business');
select _expect_fail($$select create_invitation('10000000-0000-0000-0000-000000000001','z@core.test')$$, 'partner cannot invite');
select _expect_fail($$insert into business_members (business_id, user_id) values ('10000000-0000-0000-0000-000000000002', auth.uid())$$, 'partner cannot self-add to another business');
select _expect_fail($$insert into profit_sharing_rules (business_id,user_id,percentage,effective_from) values ('10000000-0000-0000-0000-000000000001', auth.uid(), 100, current_date)$$, 'partner cannot set profit share');
select _expect_fail($$insert into platform_owners values (auth.uid())$$, 'partner cannot promote self to owner');
select _expect_fail($$delete from audit_logs$$, 'audit log cannot be deleted');
select _expect_fail($$update profiles set email = 'b@core.test' where id = auth.uid()$$, 'partner cannot change own email column directly');
update businesses set name = 'hacked';
select _expect((select name from businesses) = 'Doven BD', 'partner update on business has no effect');
reset role;

select set_config('request.jwt.claim.sub', :'B', false), set_config('request.jwt.claim.email','b@core.test', false);
set role authenticated;
select _expect((select array_agg(name) from businesses) = array['Oxygen'], 'B sees only Oxygen');
reset role;

set role anon;
select _expect_fail($$select * from businesses$$, 'anonymous user has no access');
reset role;

-- ===== Owner: profit shares, removal, revoke, expiry, archive =====
select set_config('request.jwt.claim.sub', :'O', false), set_config('request.jwt.claim.email','owner@core.test', false);
set role authenticated;
insert into profit_sharing_rules (business_id,user_id,percentage,effective_from) values
 ('10000000-0000-0000-0000-000000000001', :'A', 50, '2026-01-01'),
 ('10000000-0000-0000-0000-000000000001', :'C', 50, '2026-01-01'),
 ('10000000-0000-0000-0000-000000000001', :'A', 60, '2026-11-01'),
 ('10000000-0000-0000-0000-000000000001', :'C', 40, '2026-11-01');
select _expect((select percentage from profit_shares_on('10000000-0000-0000-0000-000000000001','2026-06-15') where user_id = :'A') = 50, 'historical share preserved (A=50% in June)');
select _expect((select percentage from profit_shares_on('10000000-0000-0000-0000-000000000001','2026-11-04') where user_id = :'A') = 60, 'new share applies from effective date (A=60% now)');
select _expect_fail(format('insert into profit_sharing_rules (business_id,user_id,percentage,effective_from) values (%L,%L,10,current_date)', '10000000-0000-0000-0000-000000000001', :'B'), 'profit share only for actual partners');
select _expect_fail($$update profit_sharing_rules set percentage = 99$$, 'profit rules are immutable');
select revoke_invitation((select id from business_invitations where email = 'x@core.test'));
select remove_member((select id from business_members where user_id = :'A'));
select _expect((select count(*) from profit_sharing_rules where user_id = :'A') = 2, 'removed partner history kept');
reset role;
update business_invitations set expires_at = now() - interval '1 day' where status = 'pending';

select set_config('request.jwt.claim.sub', :'X', false), set_config('request.jwt.claim.email','x@core.test', false);
set role authenticated;
select _expect_fail(format('select accept_invitation(%L)', :'tok_x'), 'revoked invite cannot be accepted');
reset role;

select set_config('request.jwt.claim.sub', :'A', false), set_config('request.jwt.claim.email','a@core.test', false);
set role authenticated;
select _expect((select count(*) from businesses) = 0, 'removed partner loses access immediately');
reset role;

select set_config('request.jwt.claim.sub', :'C', false), set_config('request.jwt.claim.email','c@core.test', false);
set role authenticated;
select _expect((select count(*) from businesses) = 2, 'C keeps other memberships');
reset role;

select set_config('request.jwt.claim.sub', :'O', false), set_config('request.jwt.claim.email','owner@core.test', false);
set role authenticated;
select create_invitation('10000000-0000-0000-0000-000000000002','y@core.test') as tok_y \gset
reset role;
update business_invitations set expires_at = now() - interval '1 minute' where email = 'y@core.test';
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000f','y@core.test');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000f', false), set_config('request.jwt.claim.email','y@core.test', false);
set role authenticated;
select _expect_fail(format('select accept_invitation(%L)', :'tok_y'), 'expired invite cannot be accepted');
reset role;

select set_config('request.jwt.claim.sub', :'O', false), set_config('request.jwt.claim.email','owner@core.test', false);
set role authenticated;
update businesses set status = 'archived' where name = 'Oxygen';
select _expect_fail($$select create_invitation('10000000-0000-0000-0000-000000000002','q@core.test')$$, 'archived business is read-only');
select _expect((select count(*) from businesses) = 2, 'owner still sees archived business');
update businesses set status = 'active' where name = 'Oxygen';
select _expect((select count(*) from audit_logs where module = 'businesses' and action = 'update') >= 2, 'archive/restore is audited');
reset role;

\echo ALL_TESTS_PASSED
