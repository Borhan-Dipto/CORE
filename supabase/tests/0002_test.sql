-- Run after 0001_foundation_test.sql on the same DB.
\set ON_ERROR_STOP 1
\set O '00000000-0000-0000-0000-00000000000a'
\set C '00000000-0000-0000-0000-00000000000d'
select set_config('request.jwt.claim.sub', :'O', false), set_config('request.jwt.claim.email','owner@core.test', false);
set role authenticated;
select _expect((select count(*) from business_members where user_id = :'O' and status = 'active') = 2, 'owner auto-joined both businesses as partner');
select _expect_fail(format($$select set_profit_shares('10000000-0000-0000-0000-000000000001', current_date, '[{"user_id":"%s","percentage":70}]')$$, :'O'), 'split not totalling 100 rejected');
select set_profit_shares('10000000-0000-0000-0000-000000000001', '2026-12-01', format('[{"user_id":"%s","percentage":70},{"user_id":"%s","percentage":30}]', :'O', :'C')::jsonb);
select set_profit_shares('10000000-0000-0000-0000-000000000001', '2026-12-01', format('[{"user_id":"%s","percentage":60},{"user_id":"%s","percentage":40}]', :'O', :'C')::jsonb);
select _expect((select percentage from profit_shares_on('10000000-0000-0000-0000-000000000001','2026-12-05') where user_id = :'O') = 60, 'same-date re-save replaces that date''s split');
select _expect((select percentage from profit_shares_on('10000000-0000-0000-0000-000000000001','2026-06-15') where user_id = :'C') = 50, 'older split untouched');
select create_invitation('10000000-0000-0000-0000-000000000001','new@core.test') as tok \gset
reset role;
set role anon;
select _expect((select business_name from invitation_info(:'tok')) = 'Doven BD', 'invite page can preview business with token');
select _expect((select count(*) from invitation_info('wrong-token')) = 0, 'wrong token reveals nothing');
reset role;
select set_config('request.jwt.claim.sub', :'C', false), set_config('request.jwt.claim.email','c@core.test', false);
set role authenticated;
select _expect_fail(format($$select set_profit_shares('10000000-0000-0000-0000-000000000001', current_date, '[{"user_id":"%s","percentage":100}]')$$, :'C'), 'partner cannot set split');
reset role;
\echo ALL_0002_TESTS_PASSED
