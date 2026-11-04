-- =====================================================================
-- CORE · Phase 3 · 0005 · Products, orders, COD collection, profit & loss
-- Accounting policy (per business, default):
--   * Revenue & COGS are recognised when an order is DELIVERED (on its delivery date).
--   * COGS = qty × unit cost snapshotted on the order (catalog price changes never rewrite history).
--   * Product purchases (inventory categories) are cash out, NOT a P&L expense — no double count with COGS.
--   * Order-level costs (courier, packaging, COD fee, other) are direct costs; on returned/cancelled
--     orders only those incurred costs count, revenue does not.
--   * Collecting COD posts an income ledger row linked to the order → cash balance moves,
--     but P&L revenue comes from the order, never twice.
-- =====================================================================

create type public.order_status as enum ('pending', 'confirmed', 'shipped', 'delivered', 'returned', 'cancelled');
create type public.order_source as enum ('website', 'facebook', 'instagram', 'whatsapp', 'phone', 'other');

-- Inventory purchases are excluded from P&L expenses
alter table public.expense_categories add column if not exists is_inventory boolean not null default false;
update public.expense_categories set is_inventory = true where name = 'Product purchase';
grant insert (is_inventory) on public.expense_categories to authenticated;

create or replace function public.seed_business_finance(p_business uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into business_accounts (business_id, name, type) values
    (p_business, 'Cash', 'cash'), (p_business, 'bKash', 'bkash')
  on conflict do nothing;
  insert into expense_categories (business_id, name, is_advertising, is_inventory) values
    (p_business, 'Advertising / Boosting', true, false),
    (p_business, 'Product purchase', false, true),
    (p_business, 'Delivery', false, false),
    (p_business, 'Packaging', false, false),
    (p_business, 'Operational', false, false),
    (p_business, 'Software & subscriptions', false, false),
    (p_business, 'Other', false, false)
  on conflict do nothing;
end $$;

-- Ledger rows can point at an order (COD / payment collection)
alter table public.financial_transactions add column if not exists order_id uuid;

-- ---------- Tables ----------
create table public.products (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  name        text not null check (length(trim(name)) between 1 and 160),
  sku         text,
  category    text,
  cost_price  numeric(14,2) not null default 0 check (cost_price >= 0),
  sell_price  numeric(14,2) not null default 0 check (sell_price >= 0),
  is_active   boolean not null default true,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index products_business_name on public.products (business_id, lower(name));
create unique index products_business_sku on public.products (business_id, lower(sku)) where sku is not null;

create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id) on delete restrict,
  order_no         text not null,
  order_date       date not null,
  status           public.order_status not null default 'pending',
  source           public.order_source not null default 'website',
  customer_name    text,
  customer_phone   text,
  customer_address text,
  notes            text,
  campaign_name    text,              -- attribution to an ad campaign (matches expense campaign_name)
  ad_platform      public.ad_platform,
  courier          text,
  tracking_no      text,
  discount         numeric(14,2) not null default 0 check (discount >= 0),
  delivery_charge  numeric(14,2) not null default 0 check (delivery_charge >= 0),  -- charged to customer
  courier_cost     numeric(14,2) not null default 0 check (courier_cost >= 0),     -- what we pay the courier
  packaging_cost   numeric(14,2) not null default 0 check (packaging_cost >= 0),
  cod_fee          numeric(14,2) not null default 0 check (cod_fee >= 0),
  other_cost       numeric(14,2) not null default 0 check (other_cost >= 0),
  delivered_on     date,
  closed_on        date,              -- returned / cancelled date
  collected        boolean not null default false,
  collected_on     date,
  collected_amount numeric(14,2),
  collection_txn_id uuid references public.financial_transactions (id),
  external_ref     text,              -- e.g. website order id (import de-duplication)
  created_by       uuid default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (business_id, order_no)
);
create unique index orders_business_external on public.orders (business_id, external_ref) where external_ref is not null;
create index orders_business_date on public.orders (business_id, order_date desc);
create index orders_business_status on public.orders (business_id, status);
alter table public.financial_transactions
  add constraint fin_txn_order_fk foreign key (order_id) references public.orders (id);

create table public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  business_id  uuid not null references public.businesses (id) on delete restrict,
  product_id   uuid references public.products (id),
  product_name text not null,
  qty          integer not null check (qty > 0),
  unit_price   numeric(14,2) not null check (unit_price >= 0),
  unit_cost    numeric(14,2) not null default 0 check (unit_cost >= 0)
);
create index order_items_order on public.order_items (order_id);
create index order_items_product on public.order_items (business_id, product_id);

create table public.order_status_history (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders (id) on delete cascade,
  business_id uuid not null,
  from_status public.order_status,
  to_status   public.order_status not null,
  note        text,
  changed_by  uuid default auth.uid(),
  changed_at  timestamptz not null default now()
);
create index order_history_order on public.order_status_history (order_id, changed_at);

create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();

-- ---------- Order totals (one definition used everywhere) ----------
create or replace function public.order_totals(p_order uuid)
returns table (items_revenue numeric, cogs numeric, net_sales numeric, direct_costs numeric, profit numeric, receivable numeric, units bigint)
language sql stable set search_path = public as $$
  select x.items_revenue, x.cogs,
         x.items_revenue - o.discount + o.delivery_charge,
         o.courier_cost + o.packaging_cost + o.cod_fee + o.other_cost,
         (x.items_revenue - o.discount + o.delivery_charge) - x.cogs - (o.courier_cost + o.packaging_cost + o.cod_fee + o.other_cost),
         x.items_revenue - o.discount + o.delivery_charge,
         x.units
  from orders o
  cross join lateral (select coalesce(sum(qty * unit_price), 0) items_revenue, coalesce(sum(qty * unit_cost), 0) cogs, coalesce(sum(qty), 0) units
                      from order_items i where i.order_id = o.id) x
  where o.id = p_order;
$$;

-- ---------- Create ----------
-- p_order: {order_date, source, customer_name, customer_phone, customer_address, notes, campaign_name, ad_platform,
--           courier, tracking_no, discount, delivery_charge, courier_cost, packaging_cost, cod_fee, other_cost, status, external_ref, order_no}
-- p_items: [{product_id?, product_name?, qty, unit_price?, unit_cost?}]
create or replace function public.create_order(p_business uuid, p_order jsonb, p_items jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_no text; v_status order_status; v_date date; it jsonb; p products; v_seq int;
  v_name text; v_price numeric; v_cost numeric;
begin
  if not public.can_write_business(p_business) then raise exception 'not_authorized'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'items_required'; end if;
  v_date := coalesce((p_order->>'order_date')::date, (now() at time zone 'Asia/Dhaka')::date);
  if v_date > (now() at time zone 'Asia/Dhaka')::date + 1 then raise exception 'invalid_date'; end if;
  v_status := coalesce(nullif(p_order->>'status', '')::order_status, 'pending');

  v_no := nullif(trim(p_order->>'order_no'), '');
  if v_no is null then
    select coalesce(max(nullif(regexp_replace(order_no, '\D', '', 'g'), '')::int), 1000) + 1 into v_seq
      from orders where business_id = p_business and order_no ~ '^#?\d+$';
    v_no := '#' || v_seq;
  end if;

  insert into orders (business_id, order_no, order_date, status, source, customer_name, customer_phone, customer_address, notes,
    campaign_name, ad_platform, courier, tracking_no, discount, delivery_charge, courier_cost, packaging_cost, cod_fee, other_cost,
    external_ref, delivered_on, closed_on)
  values (p_business, v_no, v_date, v_status, coalesce(nullif(p_order->>'source', '')::order_source, 'website'),
    nullif(trim(p_order->>'customer_name'), ''), nullif(trim(p_order->>'customer_phone'), ''), nullif(trim(p_order->>'customer_address'), ''),
    nullif(trim(p_order->>'notes'), ''), nullif(trim(p_order->>'campaign_name'), ''), nullif(p_order->>'ad_platform', '')::ad_platform,
    nullif(trim(p_order->>'courier'), ''), nullif(trim(p_order->>'tracking_no'), ''),
    coalesce((p_order->>'discount')::numeric, 0), coalesce((p_order->>'delivery_charge')::numeric, 0),
    coalesce((p_order->>'courier_cost')::numeric, 0), coalesce((p_order->>'packaging_cost')::numeric, 0),
    coalesce((p_order->>'cod_fee')::numeric, 0), coalesce((p_order->>'other_cost')::numeric, 0),
    nullif(trim(p_order->>'external_ref'), ''),
    case when v_status = 'delivered' then v_date end,
    case when v_status in ('returned', 'cancelled') then v_date end)
  returning id into v_id;

  for it in select * from jsonb_array_elements(p_items) loop
    p := null;
    if nullif(it->>'product_id', '') is not null then
      select * into p from products where id = (it->>'product_id')::uuid and business_id = p_business;
      if not found then raise exception 'product_not_in_business'; end if;
    elsif nullif(trim(it->>'product_name'), '') is not null then
      select * into p from products where business_id = p_business and lower(name) = lower(trim(it->>'product_name')) limit 1;
    end if;
    v_name := coalesce(p.name, nullif(trim(it->>'product_name'), ''));
    if v_name is null then raise exception 'product_required'; end if;
    v_price := coalesce(nullif(it->>'unit_price', '')::numeric, p.sell_price);
    v_cost := coalesce(nullif(it->>'unit_cost', '')::numeric, p.cost_price, 0);
    if v_price is null or v_price < 0 or v_cost < 0 then raise exception 'invalid_amount'; end if;
    if coalesce((it->>'qty')::int, 0) <= 0 then raise exception 'invalid_qty'; end if;
    insert into order_items (order_id, business_id, product_id, product_name, qty, unit_price, unit_cost)
    values (v_id, p_business, p.id, v_name, (it->>'qty')::int, v_price, v_cost);
  end loop;

  insert into order_status_history (order_id, business_id, from_status, to_status, note) values (v_id, p_business, null, v_status, 'created');
  return v_id;
end $$;

-- ---------- Status changes ----------
create or replace function public.set_order_status(p_order uuid, p_status public.order_status, p_note text default null, p_date date default null)
returns void language plpgsql security definer set search_path = public as $$
declare o orders; v_date date := coalesce(p_date, (now() at time zone 'Asia/Dhaka')::date);
begin
  select * into o from orders where id = p_order for update;
  if not found or not public.can_write_business(o.business_id) then raise exception 'not_authorized'; end if;
  if o.status = p_status then return; end if;
  if o.status in ('returned', 'cancelled') then raise exception 'order_closed'; end if;
  if o.collected and p_status <> 'delivered' then raise exception 'order_collected'; end if;
  if o.status = 'delivered' and p_status not in ('returned') then raise exception 'invalid_status_change'; end if;
  update orders set status = p_status,
    delivered_on = case when p_status = 'delivered' then v_date else delivered_on end,
    closed_on = case when p_status in ('returned', 'cancelled') then v_date else closed_on end
  where id = p_order;
  insert into order_status_history (order_id, business_id, from_status, to_status, note) values (p_order, o.business_id, o.status, p_status, nullif(trim(p_note), ''));
end $$;

-- Shipping details & costs can be updated until the order's money is collected.
create or replace function public.update_order_info(p_order uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  select * into o from orders where id = p_order for update;
  if not found or not public.can_write_business(o.business_id) then raise exception 'not_authorized'; end if;
  if o.collected then raise exception 'order_collected'; end if;
  update orders set
    customer_name    = case when p ? 'customer_name' then nullif(trim(p->>'customer_name'), '') else customer_name end,
    customer_phone   = case when p ? 'customer_phone' then nullif(trim(p->>'customer_phone'), '') else customer_phone end,
    customer_address = case when p ? 'customer_address' then nullif(trim(p->>'customer_address'), '') else customer_address end,
    notes            = case when p ? 'notes' then nullif(trim(p->>'notes'), '') else notes end,
    courier          = case when p ? 'courier' then nullif(trim(p->>'courier'), '') else courier end,
    tracking_no      = case when p ? 'tracking_no' then nullif(trim(p->>'tracking_no'), '') else tracking_no end,
    campaign_name    = case when p ? 'campaign_name' then nullif(trim(p->>'campaign_name'), '') else campaign_name end,
    courier_cost     = case when p ? 'courier_cost' then coalesce((p->>'courier_cost')::numeric, 0) else courier_cost end,
    packaging_cost   = case when p ? 'packaging_cost' then coalesce((p->>'packaging_cost')::numeric, 0) else packaging_cost end,
    cod_fee          = case when p ? 'cod_fee' then coalesce((p->>'cod_fee')::numeric, 0) else cod_fee end,
    other_cost       = case when p ? 'other_cost' then coalesce((p->>'other_cost')::numeric, 0) else other_cost end,
    delivery_charge  = case when p ? 'delivery_charge' then coalesce((p->>'delivery_charge')::numeric, 0) else delivery_charge end,
    discount         = case when p ? 'discount' then coalesce((p->>'discount')::numeric, 0) else discount end
  where id = p_order;
end $$;

-- Money from the courier/customer lands in an account: one income row linked to the order.
create or replace function public.collect_order(p_order uuid, p_account uuid, p_amount numeric, p_date date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare o orders; v_txn uuid; v_date date := coalesce(p_date, (now() at time zone 'Asia/Dhaka')::date);
begin
  select * into o from orders where id = p_order for update;
  if not found or not public.can_write_business(o.business_id) then raise exception 'not_authorized'; end if;
  if o.status <> 'delivered' then raise exception 'order_not_delivered'; end if;
  if o.collected then raise exception 'already_collected'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount'; end if;
  insert into financial_transactions (business_id, txn_type, txn_date, amount, account_id, title, order_id, reference)
  values (o.business_id, 'income', v_date, round(p_amount, 2), p_account, 'Order ' || o.order_no, o.id, o.tracking_no)
  returning id into v_txn;
  update orders set collected = true, collected_on = v_date, collected_amount = round(p_amount, 2), collection_txn_id = v_txn where id = p_order;
  return v_txn;
end $$;

-- ---------- Reporting ----------
create or replace function public.order_summary(p_business uuid, p_from date, p_to date) returns jsonb
language sql stable set search_path = public as $$
  with o as (
    select o.*, x.items_revenue, x.cogs, x.units,
           x.items_revenue - o.discount + o.delivery_charge as net_sales,
           o.courier_cost + o.packaging_cost + o.cod_fee + o.other_cost as direct_costs
      from orders o
      cross join lateral (select coalesce(sum(qty * unit_price), 0) items_revenue, coalesce(sum(qty * unit_cost), 0) cogs, coalesce(sum(qty), 0) units
                          from order_items i where i.order_id = o.id) x
     where o.business_id = p_business
  ),
  placed as (select * from o where order_date between p_from and p_to),
  delivered as (select * from o where status = 'delivered' and delivered_on between p_from and p_to),
  closed as (select * from o where status in ('returned', 'cancelled') and closed_on between p_from and p_to)
  select jsonb_build_object(
    'orders_placed', (select count(*) from placed),
    'by_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from placed group by status) s), '{}'::jsonb),
    'delivered_count', (select count(*) from delivered),
    'returned_count', (select count(*) from closed where status = 'returned'),
    'revenue', coalesce((select sum(net_sales) from delivered), 0),
    'cogs', coalesce((select sum(cogs) from delivered), 0),
    'direct_costs', coalesce((select sum(direct_costs) from delivered), 0) + coalesce((select sum(direct_costs) from closed), 0),
    'return_costs', coalesce((select sum(direct_costs) from closed), 0),
    'units_sold', coalesce((select sum(units) from delivered), 0),
    'pipeline_value', coalesce((select sum(net_sales) from o where status in ('pending', 'confirmed', 'shipped')), 0),
    'pipeline_count', (select count(*) from o where status in ('pending', 'confirmed', 'shipped')),
    'uncollected', coalesce((select sum(net_sales) from o where status = 'delivered' and not collected), 0),
    'uncollected_count', (select count(*) from o where status = 'delivered' and not collected),
    'by_product', coalesce((select jsonb_agg(x order by x.profit desc) from (
        select coalesce(i.product_id::text, lower(i.product_name)) as key, max(i.product_name) as product,
               sum(i.qty) units, sum(i.qty * i.unit_price) revenue, sum(i.qty * i.unit_cost) cost,
               sum(i.qty * i.unit_price) - sum(i.qty * i.unit_cost) profit
          from order_items i join delivered d on d.id = i.order_id group by 1) x), '[]'::jsonb),
    'by_campaign', coalesce((select jsonb_agg(x order by x.revenue desc) from (
        select d.campaign_name as campaign, count(*) orders, sum(d.net_sales) revenue,
               sum(d.net_sales - d.cogs - d.direct_costs) gross_profit
          from delivered d where d.campaign_name is not null group by 1) x), '[]'::jsonb),
    'by_source', coalesce((select jsonb_agg(x order by x.orders desc) from (
        select source, count(*) orders, sum(net_sales) filter (where status = 'delivered') revenue from placed group by 1) x), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(x order by x.day) from (
        select d::date as day,
               coalesce((select sum(net_sales) from delivered where delivered_on = d::date), 0) as revenue,
               coalesce((select sum(net_sales - cogs - direct_costs) from delivered where delivered_on = d::date), 0) as gross_profit,
               (select count(*) from placed where order_date = d::date) as orders
          from generate_series(p_from, p_to, interval '1 day') d) x), '[]'::jsonb)
  );
$$;

-- Profit & loss for a period. Net profit = delivered-order gross profit − operating expenses + other income.
create or replace function public.profit_and_loss(p_business uuid, p_from date, p_to date) returns jsonb
language sql stable set search_path = public as $$
  with s as (select public.order_summary(p_business, p_from, p_to) j),
  t as (select * from financial_transactions where business_id = p_business and status = 'posted' and txn_date between p_from and p_to),
  opex as (
    select t.* from t left join expense_categories c on c.id = t.category_id
     where t.txn_type = 'expense' and not coalesce(c.is_inventory, false)
  ),
  v as (
    select (s.j->>'revenue')::numeric revenue, (s.j->>'cogs')::numeric cogs, (s.j->>'direct_costs')::numeric direct_costs,
           coalesce((select sum(amount) from opex), 0) opex,
           coalesce((select sum(amount) from opex where is_advertising), 0) ad_spend,
           coalesce((select sum(amount) from t where txn_type = 'income' and order_id is null), 0) other_income,
           coalesce((select sum(t.amount) from t join expense_categories c on c.id = t.category_id where t.txn_type = 'expense' and c.is_inventory), 0) inventory_purchases
      from s
  )
  select jsonb_build_object(
    'revenue', revenue, 'cogs', cogs, 'direct_costs', direct_costs,
    'gross_profit', revenue - cogs - direct_costs,
    'operating_expenses', opex, 'ad_spend', ad_spend, 'other_income', other_income,
    'net_profit', revenue - cogs - direct_costs - opex + other_income,
    'inventory_purchases', inventory_purchases,
    'roas', case when ad_spend > 0 then round(revenue / ad_spend, 2) end,
    'opex_by_category', coalesce((select jsonb_agg(x order by x.total desc) from (
        select category_name as name, sum(amount) total from opex group by 1) x), '[]'::jsonb),
    'allocations', coalesce((select jsonb_agg(jsonb_build_object('user_id', sh.user_id, 'percentage', sh.percentage,
        'amount', round((revenue - cogs - direct_costs - opex + other_income) * sh.percentage / 100, 2)))
        from public.profit_shares_on(p_business, p_to) sh), '[]'::jsonb)
  ) from v;
$$;

-- global_summary gains revenue & net profit (return type changes, so drop first).
drop function if exists public.global_summary(date, date);
create or replace function public.global_summary(p_from date, p_to date)
returns table (business_id uuid, name text, status public.business_status, expenses numeric, ad_spend numeric,
               income numeric, investments numeric, cash_balance numeric, partners bigint, revenue numeric, net_profit numeric)
language sql stable set search_path = public as $$
  select b.id, b.name, b.status,
         coalesce(sum(t.amount) filter (where t.txn_type = 'expense'), 0),
         coalesce(sum(t.amount) filter (where t.txn_type = 'expense' and t.is_advertising), 0),
         coalesce(sum(t.amount) filter (where t.txn_type = 'income'), 0),
         coalesce(sum(t.amount) filter (where t.txn_type = 'investment'), 0),
         coalesce((select sum(ab.balance) from public.account_balances(b.id, p_to) ab), 0),
         (select count(*) from business_members m where m.business_id = b.id and m.status = 'active'),
         coalesce((public.profit_and_loss(b.id, p_from, p_to)->>'revenue')::numeric, 0),
         coalesce((public.profit_and_loss(b.id, p_from, p_to)->>'net_profit')::numeric, 0)
  from businesses b
  left join financial_transactions t on t.business_id = b.id and t.status = 'posted' and t.txn_date between p_from and p_to
  group by b.id order by b.status, b.name;
$$;

-- Reversing a sales collection re-opens the order for collection.
create or replace function public.reopen_collection_on_reversal() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'reversed' and old.status = 'posted' and new.order_id is not null then
    update orders set collected = false, collected_on = null, collected_amount = null, collection_txn_id = null
     where id = new.order_id and collection_txn_id = new.id;
  end if;
  return new;
end $$;
create trigger fin_txn_reopen_collection after update on public.financial_transactions
  for each row execute function public.reopen_collection_on_reversal();

-- reverse_transaction must copy order_id onto the reversal row (so links stay traceable)
create or replace function public.reverse_transaction(p_txn uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare t financial_transactions;
begin
  select * into t from financial_transactions where id = p_txn for update;
  if not found or not public.can_write_business(t.business_id) then raise exception 'not_authorized'; end if;
  if t.status <> 'posted' then raise exception 'already_reversed'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  foreach t in array array(
    select f from financial_transactions f
     where f.status = 'posted' and (f.id = p_txn or f.id = t.linked_txn_id or f.linked_txn_id = p_txn))
  loop
    update financial_transactions set status = 'reversed', reversal_reason = trim(p_reason) where id = t.id;
    insert into financial_transactions (business_id, txn_type, status, txn_date, amount, account_id, to_account_id,
      category_id, category_name, is_advertising, partner_id, ad_platform, campaign_name, target_product, title,
      description, reversal_of, reversal_reason, order_id)
    values (t.business_id, t.txn_type, 'reversal', (now() at time zone 'Asia/Dhaka')::date, t.amount, t.account_id,
      t.to_account_id, t.category_id, t.category_name, t.is_advertising, t.partner_id, t.ad_platform, t.campaign_name,
      t.target_product, t.title, t.description, t.id, trim(p_reason), t.order_id);
  end loop;
end $$;

-- ---------- RLS ----------
alter table public.products             enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.order_status_history enable row level security;

create policy prod_read   on public.products for select using (public.can_read_business(business_id));
create policy prod_insert on public.products for insert with check (public.can_write_business(business_id));
create policy prod_update on public.products for update using (public.can_write_business(business_id)) with check (public.can_write_business(business_id));
create policy ord_read    on public.orders for select using (public.can_read_business(business_id));
create policy item_read   on public.order_items for select using (public.can_read_business(business_id));
create policy hist_read   on public.order_status_history for select using (public.can_read_business(business_id));

create trigger audit_products after insert or update on public.products for each row execute function public.audit_row();
create trigger audit_orders   after insert or update on public.orders   for each row execute function public.audit_row();

-- ---------- Grants ----------
revoke all on public.products, public.orders, public.order_items, public.order_status_history from public, anon, authenticated;
grant select on public.products, public.orders, public.order_items, public.order_status_history to authenticated;
grant insert (business_id, name, sku, category, cost_price, sell_price) on public.products to authenticated;
grant update (name, sku, category, cost_price, sell_price, is_active) on public.products to authenticated;

revoke all on function public.order_totals(uuid), public.create_order(uuid, jsonb, jsonb),
  public.set_order_status(uuid, public.order_status, text, date), public.update_order_info(uuid, jsonb),
  public.collect_order(uuid, uuid, numeric, date), public.order_summary(uuid, date, date),
  public.profit_and_loss(uuid, date, date), public.global_summary(date, date),
  public.reopen_collection_on_reversal(), public.reverse_transaction(uuid, text) from public, anon;
revoke all on function public.reopen_collection_on_reversal() from authenticated;
grant execute on function public.order_totals(uuid), public.create_order(uuid, jsonb, jsonb),
  public.set_order_status(uuid, public.order_status, text, date), public.update_order_info(uuid, jsonb),
  public.collect_order(uuid, uuid, numeric, date), public.order_summary(uuid, date, date),
  public.profit_and_loss(uuid, date, date), public.global_summary(date, date), public.reverse_transaction(uuid, text)
to authenticated;
