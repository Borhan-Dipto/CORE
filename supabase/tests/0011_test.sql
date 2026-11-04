-- Run after 0001..0009 tests (before 0010, which deletes DOVEN).
\set ON_ERROR_STOP 1
\set O '00000000-0000-0000-0000-00000000000a'
\set C '00000000-0000-0000-0000-00000000000d'
\set DOVEN '10000000-0000-0000-0000-000000000001'

select set_config('request.jwt.claim.sub', :'C', false);
set role authenticated;
select _expect_fail(format($$select rotate_integration_token(%L)$$, :'DOVEN'), 'partner cannot create a webhook token');
reset role;
select set_config('request.jwt.claim.sub', :'O', false), set_config('request.jwt.claim.email','owner@core.test', false);
set role authenticated;
select rotate_integration_token(:'DOVEN') as tok \gset
select _expect(length(:'tok') = 48, 'token generated');
select _expect((select token_hint from business_integrations where business_id = :'DOVEN') = right(:'tok', 4), 'only a hint is readable');
select _expect_fail('select token_hash from business_integrations', 'token hash is not readable');
select _expect_fail($$select * from ingest_web_order('x', '{}', '[]')$$, 'authenticated users cannot call ingest directly');
reset role;

set role anon;
select _expect_fail($$select ingest_web_order('wrong-token', '{"external_ref":"W1"}', '[{"product_name":"A","qty":1,"unit_price":10}]')$$, 'wrong token rejected');
select ingest_web_order(:'tok', '{"external_ref":"woo-501","customer_name":"Karim","customer_phone":"01800000000","delivery_charge":60}',
  '[{"product_name":"MagSafe Case","qty":2,"unit_price":900}]', 'confirmed') as r1 \gset
select ingest_web_order(:'tok', '{"external_ref":"woo-501"}', '[{"product_name":"MagSafe Case","qty":2,"unit_price":900}]', 'confirmed') as r2 \gset
select ingest_web_order(:'tok', '{"external_ref":"woo-501"}', '[{"product_name":"MagSafe Case","qty":2,"unit_price":900}]', 'delivered') as r3 \gset
select ingest_web_order(:'tok', '{"external_ref":"woo-501"}', '[{"product_name":"MagSafe Case","qty":2,"unit_price":900}]', 'pending') as r4 \gset
select ingest_web_order(:'tok', '{"external_ref":"woo-502"}', '[{"product_name":"X","qty":1,"unit_price":5}]', 'cancelled') as r5 \gset
select ingest_web_order(:'tok', '{"external_ref":"woo-503"}', '[]', 'pending') as r6 \gset
reset role;
select _expect((:'r1'::jsonb->>'result') = 'created', 'new web order created');
select _expect((:'r2'::jsonb->>'result') = 'unchanged', 'duplicate delivery is ignored');
select _expect((:'r3'::jsonb->>'result') = 'updated', 'status moves forward');
select _expect((:'r4'::jsonb->>'result') = 'unchanged', 'status never moves backwards');
select _expect((:'r5'::jsonb->>'result') = 'ignored', 'orders cancelled before import are skipped');
select _expect((:'r6'::jsonb->>'result') = 'error', 'bad payload reported, not crashing');
select _expect((select count(*) from orders where business_id = :'DOVEN' and external_ref = 'woo-501') = 1, 'exactly one order per website order');
select _expect((select status from orders where external_ref = 'woo-501') = 'delivered', 'order delivered');
select _expect((select unit_cost from order_items i join orders o on o.id = i.order_id where o.external_ref = 'woo-501') > 0, 'cost taken from product catalogue');
select _expect((select source from orders where external_ref = 'woo-501') = 'website', 'source is website');
select _expect((select last_error is not null and events_count = 6 and orders_created = 1 from business_integrations where business_id = :'DOVEN'), 'integration stats & last error kept');

-- public wrappers still enforce permissions
select set_config('request.jwt.claim.sub', :'C', false);
set role authenticated;
select _expect_fail(format($$select create_order(%L, '{}', '[{"product_name":"X","qty":1,"unit_price":1}]')$$, :'DOVEN'), 'partner still cannot create orders');
select _expect_fail(format($$select set_order_status((select id from orders where external_ref = 'woo-501'), 'returned')$$), 'partner still cannot change status');
reset role;
select set_config('request.jwt.claim.sub', :'O', false);
set role authenticated;
select rotate_integration_token(:'DOVEN') as tok2 \gset
reset role;
set role anon;
select _expect_fail(format($$select ingest_web_order(%L, '{"external_ref":"W9"}', '[{"product_name":"A","qty":1,"unit_price":1}]')$$, :'tok'), 'old token stops working after regenerate');
reset role;
\echo ALL_0011_TESTS_PASSED
