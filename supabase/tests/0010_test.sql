-- Run after 0001..0009 tests on the same DB.
\set ON_ERROR_STOP 1
\set O '00000000-0000-0000-0000-00000000000a'
\set C '00000000-0000-0000-0000-00000000000d'
\set DOVEN '10000000-0000-0000-0000-000000000001'
\set OXY   '10000000-0000-0000-0000-000000000002'
select _expect((select count(*) from financial_transactions where business_id = :'DOVEN') > 0, 'DOVEN has ledger data before delete');
select _expect_fail(format($$delete from financial_transactions where business_id = %L$$, :'DOVEN'), 'ledger still immutable outside delete_business');

select set_config('request.jwt.claim.sub', :'C', false), set_config('request.jwt.claim.email','c@core.test', false);
set role authenticated;
select _expect_fail(format($$select delete_business(%L, 'Doven BD')$$, :'DOVEN'), 'partner cannot delete a business');
reset role;

select set_config('request.jwt.claim.sub', :'O', false), set_config('request.jwt.claim.email','owner@core.test', false);
set role authenticated;
select name as dname from businesses where id = :'DOVEN' \gset
select _expect_fail(format($$select delete_business(%L, 'wrong name')$$, :'DOVEN'), 'wrong confirmation name rejected');
select (select count(*) from financial_transactions where business_id = :'OXY') as oxy_txns \gset
select delete_business(:'DOVEN', :'dname');
select _expect((select count(*) from businesses where id = :'DOVEN') = 0, 'business deleted');
select _expect((select count(*) from financial_transactions where business_id = :'DOVEN') = 0, 'ledger deleted');
select _expect((select count(*) from orders where business_id = :'DOVEN') = 0, 'orders deleted');
select _expect((select count(*) from financial_transactions where business_id = :'OXY') = :'oxy_txns'::int, 'other business untouched');
reset role;
select _expect((select count(*) from business_members where business_id = :'DOVEN') = 0, 'memberships deleted');
select _expect((select count(*) from audit_logs where module = 'businesses' and action = 'delete' and record_id = :'DOVEN') = 1, 'deletion recorded in audit log');
select _expect(coalesce(current_setting('core.purge', true), '') <> 'on', 'purge flag is off after delete');
\echo ALL_0010_TESTS_PASSED
