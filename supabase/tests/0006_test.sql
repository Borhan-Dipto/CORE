-- Run after 0001/0002/0004/0005 tests on the same DB.
\set ON_ERROR_STOP 1
\set O '00000000-0000-0000-0000-00000000000a'
\set C '00000000-0000-0000-0000-00000000000d'
\set DOVEN '10000000-0000-0000-0000-000000000001'
\set OXY   '10000000-0000-0000-0000-000000000002'

select _expect((select count(*) from financial_transactions where doc_no is null) = 0, 'backfill numbered every ledger row');
select _expect((select count(*) = count(distinct (business_id, doc_kind(txn_type), doc_no)) from financial_transactions), 'document numbers unique per business+kind');

select set_config('request.jwt.claim.sub', :'O', false), set_config('request.jwt.claim.email','owner@core.test', false);
set role authenticated;
select id as bkash from business_accounts where business_id = :'DOVEN' and name = 'bKash' \gset
select coalesce(max(doc_no),0) as last_pv from financial_transactions where business_id = :'DOVEN' and txn_type = 'expense' \gset
select id as oth from expense_categories where business_id = :'DOVEN' and name = 'Other' \gset
select post_transaction(:'DOVEN', 'expense', '2026-11-05', 100, p_account => :'bkash', p_category => :'oth', p_title => 'Doc test') as e1 \gset
select post_transaction(:'DOVEN', 'expense', '2026-11-05', 50, p_account => :'bkash', p_category => :'oth') as e2 \gset
select _expect((select doc_no from financial_transactions where id = :'e1') = :'last_pv'::int + 1, 'new voucher continues the sequence');
select _expect((select doc_no from financial_transactions where id = :'e2') = :'last_pv'::int + 2, 'sequence increments');
select reverse_transaction(:'e2', 'typo') ;
select _expect((select doc_no from financial_transactions where id = :'e2') = :'last_pv'::int + 2, 'reversal keeps original number');
select _expect_fail(format($$update financial_transactions set doc_no = 1 where id = %L$$, :'e1'), 'document number is immutable');

insert into business_invoice_settings (business_id, payment_info, thank_you, logo_data)
  values (:'DOVEN', 'bKash: 01700000000', 'ধন্যবাদ!', 'data:image/png;base64,iVBORw0KGgo=');
update business_invoice_settings set policy_note = '7 days return' where business_id = :'DOVEN';
select _expect_fail(format($$update business_invoice_settings set logo_data = 'data:text/html;base64,PHNjcmlwdD4=' where business_id = %L$$, :'DOVEN'), 'non-image logo rejected');
select _expect_fail('select next_doc_no(gen_random_uuid(), ''PV'')', 'counter function not callable by users');
select _expect_fail('select * from document_counters', 'counters table not readable');
reset role;

-- partner reads settings, cannot change them; other business isolated
select set_config('request.jwt.claim.sub', :'C', false), set_config('request.jwt.claim.email','c@core.test', false);
set role authenticated;
select _expect((select payment_info from business_invoice_settings where business_id = :'DOVEN') = 'bKash: 01700000000', 'partner can read invoice settings');
update business_invoice_settings set thank_you = 'x' where business_id = :'DOVEN';
select _expect((select thank_you from business_invoice_settings where business_id = :'DOVEN') = 'ধন্যবাদ!', 'partner cannot edit invoice settings');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;
select _expect((select count(*) from business_invoice_settings) = 0, 'removed member sees no settings');
reset role;
\echo ALL_0006_TESTS_PASSED
