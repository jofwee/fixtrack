-- All mutations are transactional RPCs. Browser users receive SELECT access only,
-- subject to RLS. Tracking credentials and request counters are never browser-readable.
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 120),
  phone text not null check (phone ~ '^[+0-9() -]{7,24}$'),
  address text not null check (length(btrim(address)) between 1 and 300),
  created_at timestamptz not null default now()
);
create table public.memberships (
  shop_id uuid not null references public.shops(id),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'staff')),
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  active boolean not null default true,
  primary key (shop_id, user_id)
);
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id),
  name text not null check (length(btrim(name)) between 1 and 120),
  phone text not null check (phone ~ '^[+0-9() -]{7,24}$'),
  email text not null default '' check (length(email) <= 254),
  created_at timestamptz not null default now(),
  unique (shop_id, id)
);
create sequence private.repair_reference start 1001;
create table public.repairs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id),
  reference text not null unique default ('FX-' || nextval('private.repair_reference')),
  request_id uuid not null unique,
  customer_id uuid not null,
  device_type text not null check (device_type in ('Laptop', 'Phone', 'Tablet', 'Desktop', 'Other')),
  device text not null check (length(btrim(device)) between 1 and 160),
  issue text not null check (length(btrim(issue)) between 1 and 2000),
  public_summary text not null check (length(btrim(public_summary)) between 1 and 400),
  stage text not null default 'Received' check (stage in ('Received', 'Diagnosing', 'Repairing', 'Ready for Pickup', 'Claimed')),
  received_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  ready_at timestamptz, claimed_at timestamptz,
  original_due date, revised_due date,
  ever_delayed boolean not null default false,
  delay_reason text not null default '' check (length(delay_reason) <= 500),
  version integer not null default 1,
  foreign key (shop_id, customer_id) references public.customers(shop_id, id),
  unique (shop_id, id)
);
create table public.repair_events (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null, repair_id uuid not null,
  kind text not null, title text not null, detail text not null default '',
  actor_id uuid references auth.users(id), actor_name text not null,
  customer_visible boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (shop_id, repair_id) references public.repairs(shop_id, id)
);
create table private.tracking_credentials (
  repair_id uuid primary key references public.repairs(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz,
  rotated_at timestamptz not null default now()
);
create table private.request_limits (
  bucket text primary key,
  started_at timestamptz not null,
  attempts integer not null
);
create table private.invite_events (
  id uuid primary key default gen_random_uuid(), shop_id uuid not null references public.shops(id), actor_id uuid not null,
  target_id uuid, action text not null, created_at timestamptz not null default now()
);
create index repairs_shop_received on public.repairs(shop_id, received_at desc);
create index repairs_shop_stage on public.repairs(shop_id, stage);
create index events_repair_created on public.repair_events(repair_id, created_at);
create index customers_shop on public.customers(shop_id);

create function private.has_shop_access(p_shop uuid, p_owner boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.shop_id = p_shop and m.active
      and (not p_owner or m.role = 'owner')
      and (not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
        or (auth.jwt()->>'aal') = 'aal2')
  );
$$;
revoke all on function private.has_shop_access(uuid, boolean) from public;
grant execute on function private.has_shop_access(uuid, boolean) to authenticated, service_role;

alter table public.shops enable row level security;
alter table public.memberships enable row level security;
alter table public.customers enable row level security;
alter table public.repairs enable row level security;
alter table public.repair_events enable row level security;
alter table private.tracking_credentials enable row level security;
alter table private.request_limits enable row level security;
alter table private.invite_events enable row level security;
create policy shop_read on public.shops for select to authenticated using (private.has_shop_access(id));
create policy member_read on public.memberships for select to authenticated using (
  (user_id = auth.uid() and active) or private.has_shop_access(shop_id, true)
);
create policy customer_read on public.customers for select to authenticated using (private.has_shop_access(shop_id));
create policy repair_read on public.repairs for select to authenticated using (private.has_shop_access(shop_id));
create policy events_read on public.repair_events for select to authenticated using (private.has_shop_access(shop_id));
revoke all on public.shops, public.memberships, public.customers, public.repairs, public.repair_events from anon, authenticated;
grant select on public.shops, public.memberships, public.customers, public.repairs, public.repair_events to authenticated;
revoke all on all tables in schema private from public, anon, authenticated;

create view public.repair_workspace with (security_invoker = true) as
select r.*, c.name as customer_name, c.phone as customer_phone,
  coalesce((select jsonb_agg(jsonb_build_object(
    'id', e.id, 'kind', e.kind, 'title', e.title, 'detail', e.detail,
    'created_at', e.created_at, 'actor_name', e.actor_name, 'customer_visible', e.customer_visible
  ) order by e.created_at, e.id) from public.repair_events e where e.repair_id = r.id), '[]'::jsonb) as events
from public.repairs r join public.customers c on c.id = r.customer_id and c.shop_id = r.shop_id;
revoke all on public.repair_workspace from anon, authenticated;
grant select on public.repair_workspace to authenticated;

create function public.create_repair(p_shop_id uuid, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare customer_uuid uuid; repair public.repairs; code text; actor text; due date;
begin
  if not private.has_shop_access(p_shop_id) then raise exception 'Access denied.' using errcode = '42501'; end if;
  if jsonb_typeof(p_input) <> 'object' or octet_length(p_input::text) > 12000 then raise exception 'Invalid repair data.'; end if;
  due := nullif(p_input->>'original_due', '')::date;
  if due < (now() at time zone 'Asia/Manila')::date then raise exception 'The estimate cannot be in the past.'; end if;
  if exists (select 1 from public.repairs where request_id = (p_input->>'request_id')::uuid) then
    raise exception 'This intake was already saved. Open the repair queue; replace its tracking code if needed.';
  end if;
  customer_uuid := nullif(p_input->>'customer_id', '')::uuid;
  if customer_uuid is not null then
    if not exists (select 1 from public.customers where id = customer_uuid and shop_id = p_shop_id) then raise exception 'Customer not found.'; end if;
  else
    insert into public.customers(shop_id, name, phone, email) values
      (p_shop_id, btrim(p_input->>'customer_name'), btrim(p_input->>'customer_phone'), coalesce(btrim(p_input->>'customer_email'), '')) returning id into customer_uuid;
  end if;
  select display_name into actor from public.memberships where user_id = auth.uid() and shop_id = p_shop_id;
  insert into public.repairs(shop_id, request_id, customer_id, device_type, device, issue, public_summary, original_due)
  values(p_shop_id, (p_input->>'request_id')::uuid, customer_uuid, p_input->>'device_type', btrim(p_input->>'device'), btrim(p_input->>'issue'), btrim(p_input->>'public_summary'), due)
  returning * into repair;
  code := upper(encode(extensions.gen_random_bytes(12), 'hex'));
  insert into private.tracking_credentials(repair_id, code_hash) values(repair.id, encode(extensions.digest(code, 'sha256'), 'hex'));
  insert into public.repair_events(shop_id, repair_id, kind, title, detail, actor_id, actor_name, customer_visible)
    values(p_shop_id, repair.id, 'status', 'Received', 'Device checked in at the shop.', auth.uid(), actor, true);
  return jsonb_build_object('id', repair.id, 'reference', repair.reference, 'tracking_code', regexp_replace(code, '(.{4})(?=.)', '\1-', 'g'));
end;
$$;

create function public.change_repair(p_id uuid, p_version integer, p_action text, p_payload jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare repair public.repairs; actor text; title text; detail text := ''; visible boolean := true; next_stage text; due date; reason text; today date := (now() at time zone 'Asia/Manila')::date;
begin
  select * into repair from public.repairs where id = p_id for update;
  if not found or not private.has_shop_access(repair.shop_id) then raise exception 'Access denied.' using errcode = '42501'; end if;
  if p_version is distinct from repair.version then raise exception 'This repair has changed. Refresh and try again.' using errcode = '40001'; end if;
  if repair.stage = 'Claimed' then raise exception 'Collected repairs are read-only.'; end if;
  if jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 10000 then raise exception 'Invalid update.'; end if;
  select display_name into actor from public.memberships where user_id = auth.uid() and shop_id = repair.shop_id;
  if p_action = 'advance' then
    next_stage := case repair.stage when 'Received' then 'Diagnosing' when 'Diagnosing' then 'Repairing' when 'Repairing' then 'Ready for Pickup' when 'Ready for Pickup' then 'Claimed' end;
    if next_stage is null then raise exception 'Invalid status transition.'; end if;
    title := next_stage;
    update public.repairs set stage = next_stage,
      ready_at = case when next_stage = 'Ready for Pickup' then now() else ready_at end,
      claimed_at = case when next_stage = 'Claimed' then now() else claimed_at end,
      ever_delayed = ever_delayed or (next_stage = 'Ready for Pickup' and coalesce(revised_due, original_due) < today)
    where id = p_id;
    if next_stage = 'Claimed' then
      detail := 'Device collection confirmed by shop staff.';
      update private.tracking_credentials set expires_at = now() + interval '30 days' where repair_id = p_id;
    elsif next_stage = 'Ready for Pickup' then detail := 'Your device is ready. Contact the shop to arrange collection.';
    end if;
  elsif p_action in ('delay', 'estimate') then
    if repair.stage = 'Ready for Pickup' then raise exception 'This repair is already finished.'; end if;
    due := nullif(p_payload->>'date', '')::date;
    if due is null or due < today then raise exception 'Choose today or a later completion date.'; end if;
    if p_action = 'estimate' then
      if repair.original_due is not null then raise exception 'Use a revision to preserve the original estimate.'; end if;
      title := 'Completion estimate set'; detail := due::text;
      update public.repairs set original_due = due where id = p_id;
    else
      if repair.original_due is null then raise exception 'Set an original estimate first.'; end if;
      reason := btrim(p_payload->>'reason');
      if reason is null or length(reason) not between 5 and 500 then raise exception 'Explain the delay in 5 to 500 characters.'; end if;
      title := 'Completion estimate revised';
      detail := reason || ' Previous estimate: ' || coalesce(repair.revised_due, repair.original_due)::text || '. Revised date: ' || due::text || '.';
      update public.repairs set revised_due = due, delay_reason = reason, ever_delayed = true where id = p_id;
    end if;
  elsif p_action = 'note' then
    detail := btrim(p_payload->>'text');
    if detail is null or length(detail) not between 1 and 2000 then raise exception 'Write an update of 1 to 2000 characters.'; end if;
    visible := coalesce((p_payload->>'visible')::boolean, false);
    title := case when visible then 'Update from the shop' else 'Internal note' end;
  else raise exception 'Unknown action.';
  end if;
  update public.repairs set version = version + 1, updated_at = now() where id = p_id;
  insert into public.repair_events(shop_id, repair_id, kind, title, detail, actor_id, actor_name, customer_visible)
  values(repair.shop_id, p_id, p_action, title, detail, auth.uid(), actor, visible);
end;
$$;

create function public.update_shop(p_shop_id uuid, p_name text, p_phone text, p_address text)
returns void language plpgsql security definer set search_path = '' as $$
declare actor text;
begin
  if not private.has_shop_access(p_shop_id, true) then raise exception 'Owner access required.' using errcode = '42501'; end if;
  update public.shops set name = btrim(p_name), phone = btrim(p_phone), address = btrim(p_address) where id = p_shop_id;
  insert into private.invite_events(shop_id, actor_id, action) values(p_shop_id, auth.uid(), 'shop_profile_updated');
end;
$$;

create function public.rotate_tracking_code(p_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare repair public.repairs; code text; actor text;
begin
  select * into repair from public.repairs where id = p_id for update;
  if not found or not private.has_shop_access(repair.shop_id, true) then raise exception 'Owner access required.' using errcode = '42501'; end if;
  if repair.stage = 'Claimed' then raise exception 'Tracking codes for collected jobs cannot be renewed.'; end if;
  code := upper(encode(extensions.gen_random_bytes(12), 'hex'));
  update private.tracking_credentials set code_hash = encode(extensions.digest(code, 'sha256'), 'hex'), rotated_at = now(), expires_at = null where repair_id = p_id;
  select display_name into actor from public.memberships where user_id = auth.uid();
  insert into public.repair_events(shop_id, repair_id, kind, title, actor_id, actor_name, customer_visible) values(repair.shop_id, p_id, 'credential', 'Private tracking code replaced', auth.uid(), actor, false);
  return regexp_replace(code, '(.{4})(?=.)', '\1-', 'g');
end;
$$;

create function public.set_staff_active(p_shop_id uuid, p_user_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_shop_access(p_shop_id, true) then raise exception 'Owner access required.' using errcode = '42501'; end if;
  if p_active is null then raise exception 'Specify an access state.'; end if;
  update public.memberships set active = p_active where shop_id = p_shop_id and user_id = p_user_id and role = 'staff';
  if not found then raise exception 'Staff member not found.'; end if;
  insert into private.invite_events(shop_id, actor_id, target_id, action) values(p_shop_id, auth.uid(), p_user_id, case when p_active then 'staff_restored' else 'staff_deactivated' end);
end;
$$;

-- Only service-role Edge Functions may use these two entry points.
create function public.consume_request_limit(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare counter integer;
begin
  if length(p_bucket) > 200 or p_limit < 1 or p_window_seconds < 1 then return false; end if;
  insert into private.request_limits(bucket, started_at, attempts) values(p_bucket, clock_timestamp(), 1)
  on conflict (bucket) do update set
    attempts = case when private.request_limits.started_at < clock_timestamp() - make_interval(secs => p_window_seconds) then 1 else least(private.request_limits.attempts + 1, p_limit + 1) end,
    started_at = case when private.request_limits.started_at < clock_timestamp() - make_interval(secs => p_window_seconds) then clock_timestamp() else private.request_limits.started_at end
  returning attempts into counter;
  if random() < 0.01 then delete from private.request_limits where started_at < now() - interval '2 days'; end if;
  return counter <= p_limit;
end;
$$;
create function public.lookup_tracking(p_reference text, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'reference', r.reference, 'device', r.device, 'public_summary', r.public_summary,
    'stage', r.stage, 'original_due', r.original_due, 'revised_due', r.revised_due,
    'ever_delayed', r.ever_delayed, 'delay_reason', r.delay_reason,
    'ready_at', r.ready_at, 'claimed_at', r.claimed_at, 'updated_at', r.updated_at,
    'shop_name', s.name, 'shop_phone', s.phone,
    'events', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'detail', e.detail, 'created_at', e.created_at) order by e.created_at, e.id)
      from public.repair_events e where e.repair_id = r.id and e.customer_visible), '[]'::jsonb)
  ) into result
  from public.repairs r join private.tracking_credentials c on c.repair_id = r.id join public.shops s on s.id = r.shop_id
  where r.reference = upper(btrim(p_reference)) and c.code_hash = encode(extensions.digest(upper(regexp_replace(p_code, '[-\s]', '', 'g')), 'sha256'), 'hex')
    and (c.expires_at is null or c.expires_at > now());
  return result;
end;
$$;
revoke all on function public.create_repair(uuid,jsonb), public.change_repair(uuid,integer,text,jsonb), public.update_shop(uuid,text,text,text), public.rotate_tracking_code(uuid), public.set_staff_active(uuid,uuid,boolean), public.consume_request_limit(text,integer,integer), public.lookup_tracking(text,text) from public, anon, authenticated;
grant execute on function public.create_repair(uuid,jsonb), public.change_repair(uuid,integer,text,jsonb), public.update_shop(uuid,text,text,text), public.rotate_tracking_code(uuid), public.set_staff_active(uuid,uuid,boolean) to authenticated;
grant execute on function public.consume_request_limit(text,integer,integer), public.lookup_tracking(text,text) to service_role;

-- A setup-only RPC provisions an already-created owner. Not available to browsers.
create function public.provision_owner(p_user_id uuid, p_name text, p_shop_name text, p_phone text, p_address text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare shop_uuid uuid;
begin
  if exists (select 1 from public.memberships where user_id = p_user_id) then raise exception 'User already belongs to a shop.'; end if;
  insert into public.shops(name,phone,address) values(p_shop_name,p_phone,p_address) returning id into shop_uuid;
  insert into public.memberships(shop_id,user_id,role,display_name) values(shop_uuid,p_user_id,'owner',p_name);
  return shop_uuid;
end;
$$;
revoke all on function public.provision_owner(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.provision_owner(uuid,text,text,text,text) to service_role;

-- Membership creation is restricted to the server. Owner identity is rechecked in SQL.
create function public.record_staff_invite(p_actor uuid, p_shop_id uuid, p_user_id uuid, p_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.memberships where shop_id=p_shop_id and user_id=p_actor and role='owner' and active) then raise exception 'Owner access required.'; end if;
  insert into public.memberships(shop_id,user_id,role,display_name) values(p_shop_id,p_user_id,'staff',btrim(p_name));
  insert into private.invite_events(shop_id,actor_id,target_id,action) values(p_shop_id,p_actor,p_user_id,'staff_invited');
end;
$$;
revoke all on function public.record_staff_invite(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.record_staff_invite(uuid,uuid,uuid,text) to service_role;
