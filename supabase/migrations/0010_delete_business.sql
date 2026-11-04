-- 0010: Permanently delete a business and everything in it (platform owner only).
-- Safety: the caller must type the business name exactly; the ledger guard is bypassed
-- only inside this function (transaction-local flag). A single audit row (business_id null)
-- records who deleted what and when.

create or replace function public.guard_txn_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('core.purge', true), '') = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'UPDATE' and old.status = 'posted' and new.status = 'posted'
     and old.linked_txn_id is null and new.linked_txn_id is not null
     and (to_jsonb(new) - 'linked_txn_id') = (to_jsonb(old) - 'linked_txn_id') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'posted' and new.status = 'reversed'
     and (to_jsonb(new) - 'status' - 'reversal_reason') = (to_jsonb(old) - 'status' - 'reversal_reason') then
    return new;
  end if;
  raise exception 'ledger_is_immutable';
end $$;

create or replace function public.delete_business(p_business uuid, p_confirm_name text) returns void
language plpgsql security definer set search_path = public as $$
declare b businesses; v_counts jsonb;
begin
  if not public.is_platform_owner() then raise exception 'not_authorized'; end if;
  select * into b from businesses where id = p_business for update;
  if not found then raise exception 'not_authorized'; end if;
  if coalesce(trim(p_confirm_name), '') <> trim(b.name) then raise exception 'confirm_name_mismatch'; end if;

  v_counts := jsonb_build_object(
    'transactions', (select count(*) from financial_transactions where business_id = p_business),
    'orders', (select count(*) from orders where business_id = p_business),
    'products', (select count(*) from products where business_id = p_business),
    'partners', (select count(*) from business_members where business_id = p_business));

  perform set_config('core.purge', 'on', true);
  delete from notifications where business_id = p_business;
  update orders set collection_txn_id = null where business_id = p_business and collection_txn_id is not null;
  delete from financial_transactions where business_id = p_business;
  delete from profit_allocations where business_id = p_business;
  delete from profit_settlements where business_id = p_business;
  delete from order_items where business_id = p_business;
  delete from orders where business_id = p_business;            -- status history cascades
  delete from products where business_id = p_business;
  delete from profit_sharing_rules where business_id = p_business;
  delete from business_invitations where business_id = p_business;
  delete from business_members where business_id = p_business;
  delete from expense_categories where business_id = p_business;
  delete from business_accounts where business_id = p_business;
  delete from audit_logs where business_id = p_business;
  delete from businesses where id = p_business;                 -- invoice settings & counters cascade
  perform set_config('core.purge', 'off', true);

  insert into audit_logs (business_id, user_id, action, module, record_id, old_value, new_value)
  values (null, auth.uid(), 'delete', 'businesses', p_business::text,
          jsonb_build_object('name', b.name, 'category', b.category, 'created_at', b.created_at) || v_counts, null);
end $$;

revoke all on function public.delete_business(uuid, text) from public, anon;
grant execute on function public.delete_business(uuid, text) to authenticated;
