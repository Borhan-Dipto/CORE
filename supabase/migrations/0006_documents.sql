-- 0006: Professional documents (invoices, vouchers, receipts, statements)
-- * Per-business invoice/branding settings (logo, payment info, policy, thank-you, signatory)
-- * Sequential, per-business, per-kind document numbers on every ledger entry (PV/MR/WV/TV)

-- ---------- Branding & invoice settings ----------
create table if not exists public.business_invoice_settings (
  business_id  uuid primary key references public.businesses (id) on delete cascade,
  logo_data    text check (logo_data is null or
                 (logo_data ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$' and length(logo_data) <= 400000)),
  tagline      text check (tagline is null or length(tagline) <= 120),
  website      text check (website is null or length(website) <= 120),
  payment_info text check (payment_info is null or length(payment_info) <= 600),
  policy_note  text check (policy_note is null or length(policy_note) <= 1200),
  thank_you    text check (thank_you is null or length(thank_you) <= 300),
  signatory    text check (signatory is null or length(signatory) <= 120),
  updated_at   timestamptz not null default now()
);

drop trigger if exists invoice_settings_updated_at on public.business_invoice_settings;
create trigger invoice_settings_updated_at before update on public.business_invoice_settings
  for each row execute function public.set_updated_at();

alter table public.business_invoice_settings enable row level security;
drop policy if exists inv_settings_read on public.business_invoice_settings;
drop policy if exists inv_settings_insert on public.business_invoice_settings;
drop policy if exists inv_settings_update on public.business_invoice_settings;
create policy inv_settings_read on public.business_invoice_settings for select
  using (public.can_read_business(business_id));
create policy inv_settings_insert on public.business_invoice_settings for insert
  with check (public.is_platform_owner());
create policy inv_settings_update on public.business_invoice_settings for update
  using (public.is_platform_owner()) with check (public.is_platform_owner());

revoke all on public.business_invoice_settings from anon, authenticated, public;
grant select, insert, update on public.business_invoice_settings to authenticated;

-- ---------- Document numbers ----------
create table if not exists public.document_counters (
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind        text not null,
  last_no     integer not null default 0,
  primary key (business_id, kind)
);
alter table public.document_counters enable row level security;  -- no policies: internal only
revoke all on public.document_counters from anon, authenticated, public;

alter table public.financial_transactions add column if not exists doc_no integer;

create or replace function public.doc_kind(p public.txn_type) returns text
language sql immutable set search_path = public as $$
  select case p when 'expense' then 'PV' when 'investment' then 'MR' when 'income' then 'MR'
                when 'withdrawal' then 'WV' when 'transfer' then 'TV' end;
$$;

create or replace function public.next_doc_no(p_business uuid, p_kind text) returns integer
language sql security definer set search_path = public as $$
  insert into document_counters as c (business_id, kind, last_no) values (p_business, p_kind, 1)
  on conflict (business_id, kind) do update set last_no = c.last_no + 1
  returning last_no;
$$;
revoke all on function public.next_doc_no(uuid, text) from public, anon, authenticated;

create or replace function public.assign_txn_doc_no() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.doc_no := public.next_doc_no(new.business_id, public.doc_kind(new.txn_type));
  return new;
end $$;

drop trigger if exists fin_txn_doc_no on public.financial_transactions;
create trigger fin_txn_doc_no before insert on public.financial_transactions
  for each row execute function public.assign_txn_doc_no();

-- Backfill existing ledger rows in chronological order (ledger guard paused for this one-off)
alter table public.financial_transactions disable trigger fin_txn_guard;
alter table public.financial_transactions disable trigger audit_txns;
alter table public.financial_transactions disable trigger fin_txn_reopen_collection;
with numbered as (
  select id, business_id, public.doc_kind(txn_type) as kind,
         row_number() over (partition by business_id, public.doc_kind(txn_type) order by created_at, id) as n
  from public.financial_transactions where doc_no is null
)
update public.financial_transactions t set doc_no = n.n from numbered n where t.id = n.id;
insert into public.document_counters (business_id, kind, last_no)
  select business_id, public.doc_kind(txn_type), max(doc_no) from public.financial_transactions group by 1, 2
on conflict (business_id, kind) do update set last_no = greatest(document_counters.last_no, excluded.last_no);
alter table public.financial_transactions enable trigger fin_txn_guard;
alter table public.financial_transactions enable trigger audit_txns;
alter table public.financial_transactions enable trigger fin_txn_reopen_collection;

create unique index if not exists fin_txn_doc_no_unique
  on public.financial_transactions (business_id, public.doc_kind(txn_type), doc_no);

revoke all on function public.doc_kind(public.txn_type) from public, anon;
grant execute on function public.doc_kind(public.txn_type) to authenticated;
revoke all on function public.assign_txn_doc_no() from public, anon, authenticated;
