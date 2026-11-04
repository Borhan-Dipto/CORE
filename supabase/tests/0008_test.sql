-- Run after 0001..0006 tests on the same DB.
\set ON_ERROR_STOP 1
\set O '00000000-0000-0000-0000-00000000000a'
\set C '00000000-0000-0000-0000-00000000000d'
\set DOVEN '10000000-0000-0000-0000-000000000001'

select set_config('request.jwt.claim.sub', :'O', false), set_config('request.jwt.claim.email','owner@core.test', false);
set role authenticated;
select id as bkash from business_accounts where business_id = :'DOVEN' and name = 'bKash' \gset
select id as oth from expense_categories where business_id = :'DOVEN' and name = 'Other' \gset

select _expect_fail(format($$select post_transaction(%L, 'profit_share', '2026-11-01', 100, p_partner => %L)$$, :'DOVEN', :'O'), 'profit_share cannot be posted directly');

-- Period 1: a loss month (Oct 2026) -> nothing distributed, loss carried
select post_transaction(:'DOVEN', 'expense', '2026-10-10', 1000, p_account => :'bkash', p_category => :'oth');
select (settlement_preview(:'DOVEN', '2026-10-01', '2026-10-31')) as p1 \gset
select _expect((:'p1'::jsonb->>'distributable')::numeric = 0, 'loss month distributes nothing');
select _expect((:'p1'::jsonb->>'carry_out')::numeric > 0, 'loss is carried forward');
select (:'p1'::jsonb->>'carry_out')::numeric as carry1 \gset
select settle_profit(:'DOVEN', '2026-10-01', '2026-10-31') as s1 \gset
select _expect((select count(*) from financial_transactions where settlement_id = :'s1') = 0, 'no ledger entries for a loss settlement');

select _expect_fail(format($$select settle_profit(%L, '2026-11-05', '2026-11-05')$$, :'DOVEN'), 'periods must be contiguous');
select _expect_fail(format($$select settle_profit(%L, '2026-11-01', '2099-01-01')$$, :'DOVEN'), 'cannot close a future period');

-- Period 2: Nov 1-4, add other income so the period is profitable; carried loss is recovered first
select post_transaction(:'DOVEN', 'income', '2026-11-03', 6000, p_account => :'bkash', p_title => 'Wholesale deal');
select settlement_preview(:'DOVEN', '2026-11-01', '2026-11-04') as p2 \gset
select _expect((:'p2'::jsonb->>'carry_in')::numeric = :'carry1'::numeric, 'carry brought into next period');
select _expect((:'p2'::jsonb->>'distributable')::numeric = greatest((:'p2'::jsonb->>'net_profit')::numeric - :'carry1'::numeric, 0), 'distributable = profit - carried loss');
select _expect_fail(format($$select settle_profit(%L, '2026-11-01', '2026-11-04')$$, :'DOVEN'), 'split that still includes a removed partner is rejected');
select set_profit_shares(:'DOVEN', '2026-11-01', format('[{"user_id":"%s","percentage":60},{"user_id":"%s","percentage":40}]', :'O', :'C')::jsonb);
select settlement_preview(:'DOVEN', '2026-11-01', '2026-11-04') as p2 \gset
select (:'p2'::jsonb->>'distributable')::numeric as dist2 \gset
select _expect(:'dist2'::numeric > 0, 'period 2 has profit to distribute');
select (:'p2'::jsonb->'allocations'->0->>'partner_id') as top_partner \gset
select (select balance from account_balances(:'DOVEN') where name = 'bKash') as bal_before \gset
select coalesce((select balance from partner_capital(:'DOVEN') where partner_id = :'top_partner'), -1) as cap_before \gset

select settle_profit(:'DOVEN', '2026-11-01', '2026-11-04',
  jsonb_build_array(jsonb_build_object('partner_id', :'top_partner', 'amount', 100, 'account_id', :'bkash')), 'Nov close') as s2 \gset
select _expect((select sum(share_amount) from profit_allocations where settlement_id = :'s2') = :'dist2'::numeric, 'allocations add up exactly');
select _expect((select sum(amount) from financial_transactions where settlement_id = :'s2' and txn_type = 'profit_share') = :'dist2'::numeric, 'profit credited to capital');
select _expect((select balance from account_balances(:'DOVEN') where name = 'bKash') = :'bal_before'::numeric - 100, 'payout reduces cash');
select _expect((select balance from partner_capital(:'DOVEN') where partner_id = :'top_partner') =
  :'cap_before'::numeric + (select share_amount from profit_allocations where settlement_id = :'s2' and partner_id = :'top_partner') - 100, 'unpaid share stays as capital');
select _expect((profit_and_loss(:'DOVEN', '2026-11-01', '2026-11-04')->>'net_profit')::numeric = (:'p2'::jsonb->>'net_profit')::numeric, 'settlement does not change P&L');
select _expect((select doc_kind(txn_type) from financial_transactions where settlement_id = :'s2' and txn_type = 'profit_share' limit 1) = 'PS', 'profit credit has PS numbers');

select _expect_fail(format($$select pay_profit(%L, %L, %L, 999999999)$$, :'s2', :'top_partner', :'bkash'), 'cannot pay more than the share');
select pay_profit(:'s2', :'top_partner', :'bkash', 50);
select _expect((select profit_paid from partner_capital(:'DOVEN') where partner_id = :'top_partner') = 150, 'later payout tracked');

select _expect_fail(format($$select reverse_transaction((select id from financial_transactions where settlement_id = %L and txn_type = 'profit_share' limit 1), 'x')$$, :'s2'), 'profit credit cannot be reversed alone');
select _expect_fail(format($$select void_settlement(%L, 'x')$$, :'s1'), 'only latest settlement can be voided');

select void_settlement(:'s2', 'wrong period');
select _expect((select count(*) from financial_transactions where settlement_id = :'s2' and status = 'posted' and reversal_of is null) = 0, 'void reverses all entries');
select _expect((select balance from account_balances(:'DOVEN') where name = 'bKash') = :'bal_before'::numeric, 'void restores cash');
select _expect((select balance from partner_capital(:'DOVEN') where partner_id = :'top_partner') = :'cap_before'::numeric, 'void restores capital');
select _expect((settlement_preview(:'DOVEN', '2026-11-01', '2026-11-04')->>'carry_in')::numeric = :'carry1'::numeric, 'after void the period can be closed again');
reset role;

-- partner: read-only
select set_config('request.jwt.claim.sub', :'C', false), set_config('request.jwt.claim.email','c@core.test', false);
set role authenticated;
select _expect((select count(*) from profit_settlements where business_id = :'DOVEN') = 2, 'partner sees settlements');
select _expect_fail(format($$select settle_profit(%L, '2026-11-01', '2026-11-04')$$, :'DOVEN'), 'partner cannot settle');
select _expect_fail(format($$select void_settlement(%L, 'x')$$, :'s1'), 'partner cannot void');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;
select _expect((select count(*) from profit_settlements) = 0, 'removed member sees no settlements');
select _expect_fail(format($$select settlement_preview(%L, '2026-11-01', '2026-11-04')$$, :'DOVEN'), 'outsider cannot preview');
reset role;
\echo ALL_0008_TESTS_PASSED
