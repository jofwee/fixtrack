-- Preserve the existing RPC contract while fixing jobs without an estimate and
-- enforcing explicit staff verification when a device is collected.
create or replace function public.change_repair(p_id uuid, p_version integer, p_action text, p_payload jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  repair public.repairs; actor text; title text; detail text := ''; visible boolean := true;
  next_stage text; due date; reason text; today date := (now() at time zone 'Asia/Manila')::date;
begin
  select * into repair from public.repairs where id = p_id for update;
  if not found or not private.has_shop_access(repair.shop_id) then raise exception 'Access denied.' using errcode = '42501'; end if;
  if p_version is distinct from repair.version then raise exception 'This repair has changed. Refresh and try again.' using errcode = '40001'; end if;
  if repair.stage = 'Claimed' then raise exception 'Collected repairs are read-only.'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 10000 then raise exception 'Invalid update.'; end if;
  select display_name into actor from public.memberships where user_id = auth.uid() and shop_id = repair.shop_id;
  if p_action = 'advance' then
    next_stage := case repair.stage when 'Received' then 'Diagnosing' when 'Diagnosing' then 'Repairing' when 'Repairing' then 'Ready for Pickup' when 'Ready for Pickup' then 'Claimed' end;
    if next_stage is null then raise exception 'Invalid status transition.'; end if;
    if next_stage = 'Claimed' and (p_payload->'collection_verified') is distinct from 'true'::jsonb then
      raise exception 'Confirm that the recipient was verified and the device was handed over.';
    end if;
    title := next_stage;
    update public.repairs set stage = next_stage,
      ready_at = case when next_stage = 'Ready for Pickup' then now() else ready_at end,
      claimed_at = case when next_stage = 'Claimed' then now() else claimed_at end,
      ever_delayed = ever_delayed or (next_stage = 'Ready for Pickup' and coalesce(coalesce(revised_due, original_due) < today, false))
    where id = p_id;
    if next_stage = 'Claimed' then
      detail := 'Device collection confirmed by shop staff after recipient verification.';
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
revoke all on function public.change_repair(uuid, integer, text, jsonb) from public, anon;
grant execute on function public.change_repair(uuid, integer, text, jsonb) to authenticated;
