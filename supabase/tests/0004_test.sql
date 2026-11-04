-- Run after 0001/0002 tests on the same DB (uses their users & businesses).
\set ON_ERROR_STOP 1
\set O '00000000-0000-0000-0000-00000000000a'
\set C '00000000-0000-0000-0000-00000000000d'
\set DOVEN '10000000-0000-0000-0000-000000000001'
\set OXY   '10000000-0000-0000-0000-000000000002'

select set_config('request.jwt.claim.sub', :'O', false), set_config('request.jwt.claim.email','owner@core.test', false);
set role authenticated;
select _expect((select count(*) from expense_categories where business_id = :'DOVEN') = 7, 'existing business seeded with 7 categories');
select _expect((select count(*) from business_accounts where business_id = :'DOVEN') = 2, 'existing business seeded with Cash + bKash');
insert into businesses (id, name) values ('10000000-0000-0000-0000-000000000003', 'New Co');
select _expect((select count(*) from expense_categories where business_id = '10000000-0000-0000-0000-000000000003') = 7, 'new business auto-seeded');

select id as cash from business_accounts where business_id = :'DOVEN' and name = 'Cash' \gset
select id as bkash from business_accounts where business_id = :'DOVEN' and name = 'bKash' \gset
select id as ads from expense_categories where business_id = :'DOVEN' and is_advertising \gset
select id as pack from expense_categories where business_id = :'DOVEN' and name = 'Packaging' \gset
select id as oxy_cash from business_accounts where business_id = :'OXY' and name = 'Cash' \gset

-- investments
select post_transaction(:'DOVEN', 'investment', '2026-11-01', 10000, p_account => :'cash', p_partner => :'O');
select post_transaction(:'DOVEN', 'investment', '2026-11-01', 5000,  p_account => :'bkash', p_partner => :'C');
-- boosting paid from bKash
select post_transaction(:'DOVEN', 'expense', '2026-11-02', 1500, p_account => :'bkash', p_category => :'ads',
  p_ad_platform => 'facebook', p_campaign => 'MagSafe Nov', p_target_product => 'MagSafe case') as boost1 \gset
-- boosting paid personally by partner C → also a capital contribution by C
select post_transaction(:'DOVEN', 'expense', '2026-11-03', 800, p_category => :'ads', p_partner => :'C',
  p_ad_platform => 'instagram', p_title => 'IG boost') as boost2 \gset
select post_transaction(:'DOVEN', 'expense', '2026-11-03', 200, p_account => :'cash', p_category => :'pack');
select post_transaction(:'DOVEN', 'transfer', '2026-11-03', 3000, p_account => :'cash', p_to_account => :'bkash');
select post_transaction(:'DOVEN', 'withdrawal', '2026-11-04', 1000, p_account => :'cash', p_partner => :'O');

select finance_summary(:'DOVEN', '2026-11-01', '2026-11-30') as s \gset
select _expect((:'s'::jsonb->>'expenses')::numeric = 2500, 'expenses = 1500+800+200 (transfer/withdrawal/investment excluded)');
select _expect((:'s'::jsonb->>'ad_spend')::numeric = 2300, 'ad spend counted once (1500+800)');
select _expect((:'s'::jsonb->>'income')::numeric = 0, 'investments are not income');
select _expect((:'s'::jsonb->>'investments')::numeric = 15800, 'investments include partner-paid expense (10000+5000+800)');
select _expect((:'s'::jsonb->>'withdrawals')::numeric = 1000, 'withdrawal tracked separately');
-- cash: 10000 -200 -3000 -1000 = 5800 ; bkash: 5000 -1500 +3000 = 6500 ; total 12300
select _expect((:'s'::jsonb->>'cash_balance')::numeric = 12300, 'account balances reconcile (12,300)');
select _expect((select balance from account_balances(:'DOVEN') where name = 'bKash') = 6500, 'transfer moves money, bKash = 6,500');
select _expect((select balance from partner_capital(:'DOVEN') where partner_id = :'C') = 5800, 'C capital = 5000 + 800 paid personally');
select _expect((select balance from partner_capital(:'DOVEN') where partner_id = :'O') = 9000, 'owner capital = 10000 - 1000 withdrawal');
select _expect((select count(*) from jsonb_array_elements(:'s'::jsonb->'daily')) = 30, 'daily series covers range');

-- validation
select _expect_fail(format($$select post_transaction(%L,'expense','2026-11-02',100)$$, :'DOVEN'), 'expense needs a category');
select _expect_fail(format($$select post_transaction(%L,'expense','2026-11-02',100,p_category=>%L)$$, :'DOVEN', :'ads'), 'expense needs a payment source');
select _expect_fail(format($$select post_transaction(%L,'expense','2026-11-02',-5,p_account=>%L,p_category=>%L)$$, :'DOVEN', :'cash', :'ads'), 'negative amount rejected');
select _expect_fail(format($$select post_transaction(%L,'expense','2026-11-02',100,p_account=>%L,p_category=>%L)$$, :'DOVEN', :'oxy_cash', :'ads'), 'cannot use another business''s account');
select _expect_fail(format($$select post_transaction(%L,'transfer','2026-11-02',100,p_account=>%L,p_to_account=>%L)$$, :'DOVEN', :'cash', :'cash'), 'transfer to same account rejected');
select _expect_fail(format($$update financial_transactions set amount = 1 where id = %L$$, :'boost1'), 'ledger rows cannot be edited');
select _expect_fail(format($$delete from financial_transactions where id = %L$$, :'boost1'), 'ledger rows cannot be deleted');

-- reversal of partner-paid expense also reverses its capital contribution
select _expect_fail(format($$select reverse_transaction(%L, '')$$, :'boost2'), 'reversal needs a reason');
select reverse_transaction(:'boost2', 'Wrong amount');
select _expect_fail(format($$select reverse_transaction(%L, 'again')$$, :'boost2'), 'cannot reverse twice');
select finance_summary(:'DOVEN', '2026-11-01', '2026-11-30') as s2 \gset
select _expect((:'s2'::jsonb->>'ad_spend')::numeric = 1500, 'reversed expense removed from ad spend');
select _expect((select balance from partner_capital(:'DOVEN') where partner_id = :'C') = 5000, 'linked capital contribution reversed too');
select _expect((select count(*) from financial_transactions where reversal_of is not null) = 2, 'reversal rows kept for audit');

-- archive blocks posting
update businesses set status = 'archived' where id = :'OXY';
select _expect_fail(format($$select post_transaction(%L,'income','2026-11-02',100,p_account=>%L)$$, :'OXY', :'oxy_cash'), 'archived business cannot post');
update businesses set status = 'active' where id = :'OXY';
reset role;

-- partner: read-only, isolated
select set_config('request.jwt.claim.sub', :'C', false), set_config('request.jwt.claim.email','c@core.test', false);
set role authenticated;
select _expect((select count(*) from financial_transactions where business_id = :'DOVEN') > 0, 'partner can read own business ledger');
select _expect_fail(format($$select post_transaction(%L,'income','2026-11-02',100,p_account=>%L)$$, :'DOVEN', :'cash'), 'partner cannot post');
select _expect_fail(format($$select reverse_transaction(%L,'x')$$, :'boost1'), 'partner cannot reverse');
select _expect_fail(format($$insert into business_accounts (business_id,name) values (%L,'Hack')$$, :'DOVEN'), 'partner cannot add account');
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false), set_config('request.jwt.claim.email','a@core.test', false);
set role authenticated;
select _expect((select count(*) from financial_transactions) = 0, 'removed partner sees no ledger');
select _expect((select count(*) from global_summary('2026-01-01','2026-12-31')) = 0, 'removed partner sees no global summary');
reset role;
\echo ALL_0004_TESTS_PASSED
