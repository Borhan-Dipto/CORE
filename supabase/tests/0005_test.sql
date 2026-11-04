-- Run after 0001/0002/0004 tests on the same DB.
\set ON_ERROR_STOP 1
\set O '00000000-0000-0000-0000-00000000000a'
\set C '00000000-0000-0000-0000-00000000000d'
\set DOVEN '10000000-0000-0000-0000-000000000001'
\set OXY   '10000000-0000-0000-0000-000000000002'

select set_config('request.jwt.claim.sub', :'O', false), set_config('request.jwt.claim.email','owner@core.test', false);
set role authenticated;
select _expect((select is_inventory from expense_categories where business_id = :'DOVEN' and name = 'Product purchase'), 'existing Product purchase marked as inventory');

insert into products (business_id, name, cost_price, sell_price) values (:'DOVEN', 'MagSafe Case', 400, 900), (:'DOVEN', 'Glass Protector', 80, 250);
select _expect_fail(format($$insert into products (business_id, name) values (%L, 'magsafe case')$$, :'DOVEN'), 'duplicate product name (case-insensitive) rejected');
select id as magsafe from products where business_id = :'DOVEN' and name = 'MagSafe Case' \gset
select id as bkash from business_accounts where business_id = :'DOVEN' and name = 'bKash' \gset
select id as pp from expense_categories where business_id = :'DOVEN' and name = 'Product purchase' \gset

-- order 1: 2 × MagSafe (catalog price) + 1 glass by name, delivery charge 60, courier 70, packaging 20
select create_order(:'DOVEN', '{"order_date":"2026-11-02","customer_name":"Rahim","campaign_name":"MagSafe Nov","delivery_charge":60,"courier_cost":70,"packaging_cost":20}',
  format('[{"product_id":"%s","qty":2},{"product_name":"glass protector","qty":1}]', :'magsafe')::jsonb) as o1 \gset
select _expect((select order_no from orders where id = :'o1') = '#1001', 'auto order number starts at #1001');
select _expect((select count(*) from order_items where order_id = :'o1' and unit_cost > 0) = 2, 'item costs snapshotted from catalog');
-- order 2: will be returned
select create_order(:'DOVEN', '{"order_date":"2026-11-02","courier_cost":60}', format('[{"product_id":"%s","qty":1}]', :'magsafe')::jsonb) as o2 \gset
select _expect((select order_no from orders where id = :'o2') = '#1002', 'order numbers increment');
-- order 3: pending (pipeline)
select create_order(:'DOVEN', '{}', format('[{"product_id":"%s","qty":1,"unit_price":850}]', :'magsafe')::jsonb) as o3 \gset

-- catalog price change must not rewrite history
update products set cost_price = 999 where id = :'magsafe';
select _expect((select unit_cost from order_items where order_id = :'o1' and product_id = :'magsafe') = 400, 'price change does not rewrite past orders');

select _expect_fail(format($$select collect_order(%L, %L, 100)$$, :'o1', :'bkash'), 'cannot collect before delivery');
select set_order_status(:'o1', 'shipped');
select set_order_status(:'o1', 'delivered', null, '2026-11-04');
select set_order_status(:'o2', 'returned', 'customer refused', '2026-11-04');
select _expect_fail(format($$select set_order_status(%L, 'delivered')$$, :'o2'), 'returned order is closed');

-- inventory purchase (cash out, not P&L), ad spend 500 exists from earlier tests? use clean window 2026-11-04
select post_transaction(:'DOVEN', 'expense', '2026-11-04', 5000, p_account => :'bkash', p_category => :'pp');

select order_summary(:'DOVEN', '2026-11-04', '2026-11-04') as s \gset
-- o1: items 2*900 + 250 = 2050, net sales = 2050 + 60 = 2110; cogs = 800 + 80 = 880; direct = 90 ; o2 returned direct 60
select _expect((:'s'::jsonb->>'revenue')::numeric = 2110, 'revenue = delivered net sales only (2,110)');
select _expect((:'s'::jsonb->>'cogs')::numeric = 880, 'COGS from snapshotted costs (880)');
select _expect((:'s'::jsonb->>'direct_costs')::numeric = 150, 'direct costs include returned order courier cost (90+60)');
select _expect((:'s'::jsonb->>'returned_count')::int = 1, 'returned counted');
select _expect((:'s'::jsonb->>'uncollected')::numeric = 2110, 'delivered-not-collected tracked as receivable');
select _expect((:'s'::jsonb->'by_campaign'->0->>'revenue')::numeric = 2110, 'revenue attributed to campaign');

select profit_and_loss(:'DOVEN', '2026-11-04', '2026-11-04') as pl \gset
select _expect((:'pl'::jsonb->>'gross_profit')::numeric = 1080, 'gross profit = 2110 - 880 - 150');
select _expect((:'pl'::jsonb->>'inventory_purchases')::numeric = 5000, 'inventory purchase tracked separately');
select _expect((:'pl'::jsonb->>'operating_expenses')::numeric = 0, 'inventory purchase is NOT an operating expense');

-- collect COD: income row linked to order, cash moves, P&L revenue unchanged
select (select balance from account_balances(:'DOVEN') where name = 'bKash') as before_bal \gset
select collect_order(:'o1', :'bkash', 2040, '2026-11-04') as col \gset
select _expect((select balance from account_balances(:'DOVEN') where name = 'bKash') = :'before_bal'::numeric + 2040, 'collection increases account balance');
select _expect((profit_and_loss(:'DOVEN', '2026-11-04', '2026-11-04')->>'revenue')::numeric = 2110, 'collection does not double count revenue');
select _expect((profit_and_loss(:'DOVEN', '2026-11-04', '2026-11-04')->>'other_income')::numeric = 0, 'collection is not other income');
select _expect_fail(format($$select collect_order(%L, %L, 10)$$, :'o1', :'bkash'), 'cannot collect twice');
select _expect_fail(format($$select set_order_status(%L, 'returned')$$, :'o1'), 'collected order cannot be returned');
select _expect_fail(format($$select update_order_info(%L, '{"courier_cost":1}')$$, :'o1'), 'collected order details are locked');
-- reversing the collection re-opens it
select reverse_transaction(:'col', 'Courier paid wrong amount');
select _expect((select not collected from orders where id = :'o1'), 'reversing collection re-opens order');
select collect_order(:'o1', :'bkash', 2040, '2026-11-04');

select _expect(jsonb_array_length(profit_and_loss(:'DOVEN', '2026-11-04', '2026-11-04')->'allocations') >= 1, 'partner allocations computed from profit split');
select _expect_fail(format($$select create_order(%L, '{}', '[]')$$, :'DOVEN'), 'order needs items');
select _expect_fail(format($$select create_order(%L, '{}', '[{"product_id":"%s","qty":1}]')$$, :'OXY', :'magsafe'), 'cannot use another business''s product');
select _expect((select count(*) from order_status_history where order_id = :'o1') = 3, 'status history kept (created, shipped, delivered)');
reset role;

-- partner: read-only, isolated
select set_config('request.jwt.claim.sub', :'C', false), set_config('request.jwt.claim.email','c@core.test', false);
set role authenticated;
select _expect((select count(*) from orders where business_id = :'DOVEN') = 3, 'partner sees orders');
select _expect_fail(format($$select create_order(%L, '{}', '[{"product_name":"X","qty":1,"unit_price":1}]')$$, :'DOVEN'), 'partner cannot create orders');
select _expect_fail(format($$select set_order_status(%L, 'cancelled')$$, :'o3'), 'partner cannot change status');
select _expect_fail(format($$insert into products (business_id, name) values (%L, 'Hack')$$, :'DOVEN'), 'partner cannot add products');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false), set_config('request.jwt.claim.email','a@core.test', false);
set role authenticated;
select _expect((select count(*) from orders) = 0, 'removed partner sees no orders');
reset role;
\echo ALL_0005_TESTS_PASSED
