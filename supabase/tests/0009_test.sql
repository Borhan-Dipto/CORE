-- Run after 0001..0008 tests on the same DB.
\set ON_ERROR_STOP 1
\set O '00000000-0000-0000-0000-00000000000a'
\set C '00000000-0000-0000-0000-00000000000d'
\set DOVEN '10000000-0000-0000-0000-000000000001'
delete from notifications;

select set_config('request.jwt.claim.sub', :'O', false), set_config('request.jwt.claim.email','owner@core.test', false);
set role authenticated;
select id as bkash from business_accounts where business_id = :'DOVEN' and name = 'bKash' \gset
select id as ads from expense_categories where business_id = :'DOVEN' and is_advertising limit 1 \gset
select post_transaction(:'DOVEN', 'expense', '2026-11-04', 700, p_account => :'bkash', p_category => :'ads', p_campaign => 'Boost A') as e1 \gset
select post_transaction(:'DOVEN', 'income', '2026-11-04', 50, p_account => :'bkash') ;
select post_transaction(:'DOVEN', 'investment', '2026-11-04', 1000, p_account => :'bkash', p_partner => :'C');
select post_transaction(:'DOVEN', 'expense', '2026-11-04', 300, p_partner => :'C', p_category => :'ads');
select reverse_transaction(:'e1', 'typo');
reset role;
select _expect((select count(*) from notifications where user_id = :'C' and kind = 'expense') = 2, 'partner notified of expenses (incl. partner-paid)');
select _expect((select count(*) from notifications where user_id = :'C' and kind = 'investment') = 1, 'partner notified of investment, not of the linked capital row');
select _expect((select count(*) from notifications where kind = 'income') = 0, 'income is not notified');
select _expect((select count(*) from notifications where user_id = :'O') = 0, 'actor is not notified of own changes');
select _expect((select count(*) from notifications where user_id = :'C' and kind = 'reversal') = 1, 'reversal notified');
select _expect((select count(*) from notifications where user_id = '00000000-0000-0000-0000-00000000000b') = 0, 'removed partner not notified');
select _expect((select payload->>'actor' from notifications where user_id = :'C' limit 1) is not null, 'payload names who made the change');

-- settlement: one notification with own share, no per-entry spam
select set_config('request.jwt.claim.sub', :'O', false);
set role authenticated;
select (select max(period_to) + 1 from profit_settlements where business_id = :'DOVEN' and status = 'final') as nf \gset
select settle_profit(:'DOVEN', :'nf', :'nf') as s3 \gset
reset role;
select _expect((select count(*) from notifications where user_id = :'C' and kind = 'settlement') = 1, 'settlement notified once');
select _expect((select count(*) from notifications where user_id = :'C' and kind in ('payout', 'withdrawal') and created_at = (select created_at from profit_settlements where id = :'s3')) = 0, 'no extra notifications for closing entries');

-- email claiming: owner only, one shot
select set_config('request.jwt.claim.sub', :'C', false);
set role authenticated;
select _expect_fail(format($$select * from claim_notification_emails(%L)$$, :'DOVEN'), 'partner cannot claim emails');
select _expect((select count(*) from notifications) >= 5, 'partner reads own notifications');
update notifications set read_at = now();
select _expect((select count(*) from notifications where read_at is null) = 0, 'partner can mark own as read');
select _expect_fail($$update notifications set kind = 'x'$$, 'partner cannot change other columns');
reset role;
select _expect((select count(*) from notifications where user_id <> :'C') = 0, 'only recipients rows exist');
select set_config('request.jwt.claim.sub', :'O', false);
set role authenticated;
select _expect((select count(*) from notifications) = 0, 'owner does not see partner notifications');
select _expect((select count(*) from claim_notification_emails(:'DOVEN')) >= 5, 'owner claims pending emails');
select _expect((select count(*) from claim_notification_emails(:'DOVEN')) = 0, 'emails are claimed only once');
reset role;

-- weekly digest: token protected
insert into app_config (key, value) values ('cron_token_sha256', encode(extensions.digest('secret-token', 'sha256'), 'hex'))
  on conflict (key) do update set value = excluded.value;
set role anon;
select _expect_fail($$select weekly_digest('wrong')$$, 'digest rejects wrong token');
select _expect(jsonb_array_length(weekly_digest('secret-token')) >= 1, 'digest returns recipients');
select _expect(jsonb_array_length(weekly_digest('secret-token')) = 0, 'digest runs once per week');
select _expect_fail('select * from notifications', 'anon cannot read notifications');
reset role;
select _expect((select count(*) from notifications where kind = 'weekly' and user_id = :'C' and business_id = :'DOVEN') = 1, 'partner gets weekly summary');
\echo ALL_0009_TESTS_PASSED
