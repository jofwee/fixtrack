-- Removed note content is retained in a private administrative audit table.
-- It is never readable through staff/customer APIs.
create table private.removed_notes (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id),
  repair_id uuid not null references public.repairs(id),
  event_id uuid not null unique,
  removed_by uuid not null references auth.users(id),
  removed_at timestamptz not null default now(),
  original_note jsonb not null
);
alter table private.removed_notes enable row level security;
revoke all on private.removed_notes from public, anon, authenticated;

create function public.remove_repair_note(p_repair_id uuid, p_event_id uuid, p_version integer)
returns void language plpgsql security definer set search_path = '' as $$
declare repair public.repairs; note public.repair_events;
begin
  select * into repair from public.repairs where id = p_repair_id for update;
  if not found or not private.has_shop_access(repair.shop_id, true) then
    raise exception 'Owner access required.' using errcode = '42501';
  end if;
  if p_version is distinct from repair.version then
    raise exception 'This repair has changed. Refresh and try again.' using errcode = '40001';
  end if;
  select * into note from public.repair_events
    where id = p_event_id and repair_id = p_repair_id and shop_id = repair.shop_id for update;
  if not found or note.kind <> 'note' then
    raise exception 'Only notes can be removed. Status and schedule history must be retained.';
  end if;
  insert into private.removed_notes(shop_id, repair_id, event_id, removed_by, original_note)
    values(repair.shop_id, repair.id, note.id, auth.uid(), to_jsonb(note));
  delete from public.repair_events where id = note.id;
  update public.repairs set version = version + 1, updated_at = now() where id = repair.id;
end;
$$;
revoke all on function public.remove_repair_note(uuid,uuid,integer) from public, anon;
grant execute on function public.remove_repair_note(uuid,uuid,integer) to authenticated;
