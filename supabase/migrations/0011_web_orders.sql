-- 0011: Website order sync (WooCommerce / Shopify / any site that can POST JSON)
-- Each business gets a secret webhook token (only its sha256 is stored). The site posts orders to
-- /api/hooks/orders/<token>; the app verifies the platform signature with the same token and calls
-- ingest_web_order(), which creates the order once (deduplicated by external_ref) and moves its status forward.
-- create_order / set_order_status are split into a checked public wrapper + an internal body.

create or replace function public._create_order(p_business uuid, p_order jsonb, p_items jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_no text; v_status order_status; v_date date; it jsonb; p products; v_seq int;
  v_name text; v_price numeric; v_cost numeric;
begin
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


create or replace function public.create_order(p_business uuid, p_order jsonb, p_items jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_write_business(p_business) then raise exception 'not_authorized'; end if;
  return public._create_order(p_business, p_order, p_items);
end $$;

create or replace function public._set_order_status(p_order uuid, p_status public.order_status, p_note text default null, p_date date default null)
returns void language plpgsql security definer set search_path = public as $$
declare o orders; v_date date := coalesce(p_date, (now() at time zone 'Asia/Dhaka')::date);
begin
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'not_authorized'; end if;
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


create or replace function public.set_order_status(p_order uuid, p_status public.order_status, p_note text default null, p_date date default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_business uuid;
begin
  select business_id into v_business from orders where id = p_order;
  if v_business is null or not public.can_write_business(v_business) then raise exception 'not_authorized'; end if;
  perform public._set_order_status(p_order, p_status, p_note, p_date);
end $$;

revoke all on function public._create_order(uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public._set_order_status(uuid, public.order_status, text, date) from public, anon, authenticated;

-- ---------- Integrations ----------
create table if not exists public.business_integrations (
  business_id    uuid primary key references public.businesses (id) on delete cascade,
  token_hash     text not null unique,
  token_hint     text not null,                  -- last 4 characters, to recognise the token
  created_at     timestamptz not null default now(),
  last_event_at  timestamptz,
  events_count   integer not null default 0,
  orders_created integer not null default 0,
  last_error     text,
  last_error_at  timestamptz
);
alter table public.business_integrations enable row level security;
drop policy if exists integ_read on public.business_integrations;
create policy integ_read on public.business_integrations for select using (public.can_write_business(business_id));
revoke all on public.business_integrations from anon, authenticated, public;
grant select (business_id, token_hint, created_at, last_event_at, events_count, orders_created, last_error, last_error_at)
  on public.business_integrations to authenticated;

-- returns the plain token once; regenerating invalidates the old one
create or replace function public.rotate_integration_token(p_business uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_token text := encode(gen_random_bytes(24), 'hex');
begin
  if not public.can_write_business(p_business) then raise exception 'not_authorized'; end if;
  insert into business_integrations (business_id, token_hash, token_hint)
  values (p_business, encode(digest(v_token, 'sha256'), 'hex'), right(v_token, 4))
  on conflict (business_id) do update set token_hash = excluded.token_hash, token_hint = excluded.token_hint,
    created_at = now(), last_error = null, last_error_at = null;
  return v_token;
end $$;

create or replace function public.disable_integration(p_business uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_write_business(p_business) then raise exception 'not_authorized'; end if;
  delete from business_integrations where business_id = p_business;
end $$;

-- p_order: create_order fields + external_ref (required); p_status: mapped CORE status or null
create or replace function public.ingest_web_order(p_token text, p_order jsonb, p_items jsonb, p_status text default null)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  i business_integrations; o orders; v_ref text := nullif(trim(p_order->>'external_ref'), ''); v_id uuid;
  v_target order_status; v_today date := (now() at time zone 'Asia/Dhaka')::date;
begin
  select * into i from business_integrations where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if not found then raise exception 'not_authorized'; end if;
  if not exists (select 1 from businesses where id = i.business_id and status = 'active') then raise exception 'business_inactive'; end if;
  if v_ref is null then raise exception 'external_ref_required'; end if;
  update business_integrations set last_event_at = now(), events_count = events_count + 1 where business_id = i.business_id;
  begin
  v_target := nullif(p_status, '')::order_status;

  select * into o from orders where business_id = i.business_id and external_ref = v_ref for update;
  if not found then
    if v_target in ('cancelled', 'returned') then
      return jsonb_build_object('result', 'ignored', 'reason', 'cancelled before import');
    end if;
    v_id := public._create_order(i.business_id, (p_order - 'status' - 'order_no') || jsonb_build_object(
              'source', coalesce(nullif(p_order->>'source', ''), 'website'),
              'status', case when v_target in ('pending', 'confirmed') then v_target::text else 'pending' end), p_items);
    update business_integrations set orders_created = orders_created + 1 where business_id = i.business_id;
    if v_target in ('shipped', 'delivered') then
      perform public._set_order_status(v_id, v_target, 'website', v_today);
    end if;
    return jsonb_build_object('result', 'created', 'order_id', v_id);
  end if;

  -- existing order: only move forward along the normal path; never touch closed or collected orders
  if v_target is null or v_target = o.status or o.status in ('returned', 'cancelled') or o.collected then
    return jsonb_build_object('result', 'unchanged', 'order_id', o.id);
  end if;
  if (o.status = 'delivered' and v_target <> 'returned')
     or (v_target = 'pending')
     or (v_target = 'confirmed' and o.status <> 'pending')
     or (v_target = 'shipped' and o.status not in ('pending', 'confirmed')) then
    return jsonb_build_object('result', 'unchanged', 'order_id', o.id);
  end if;
  perform public._set_order_status(o.id, v_target, 'website', v_today);
  return jsonb_build_object('result', 'updated', 'order_id', o.id, 'status', v_target);
  exception when others then
    -- keep the event counted and the error visible in Settings; the order itself is not saved
    update business_integrations set last_error = left(sqlerrm, 300), last_error_at = now() where business_id = i.business_id;
    return jsonb_build_object('result', 'error', 'error', sqlerrm);
  end;
end $$;

revoke all on function public.rotate_integration_token(uuid), public.disable_integration(uuid) from public, anon;
grant execute on function public.rotate_integration_token(uuid), public.disable_integration(uuid) to authenticated;
revoke all on function public.ingest_web_order(text, jsonb, jsonb, text) from public, authenticated;
grant execute on function public.ingest_web_order(text, jsonb, jsonb, text) to anon;
