-- Secure workforce clock slice.
-- All business timestamps are server-owned. Location is collected only per action.
create extension if not exists pgcrypto with schema extensions;

do $$ begin
  create type public.workforce_role as enum ('admin', 'worker');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.workforce_shift_state as enum ('working', 'on_break', 'complete');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.workforce_event_type as enum ('clock_in', 'start_break', 'end_break', 'clock_out');
exception when duplicate_object then null; end $$;

create table if not exists public.workforce_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  timezone text not null default 'UTC',
  created_at timestamptz not null default now()
);

create table if not exists public.workforce_memberships (
  organization_id uuid not null references public.workforce_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workforce_role not null,
  display_name text not null check (char_length(display_name) between 1 and 120),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.workforce_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.workforce_organizations(id) on delete cascade,
  token_hash text not null unique,
  role public.workforce_role not null default 'worker' check (role = 'worker'),
  expires_at timestamptz not null,
  claimed_at timestamptz,
  claimed_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.workforce_shifts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.workforce_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  state public.workforce_shift_state not null default 'working',
  clock_in_at timestamptz not null,
  break_started_at timestamptz,
  break_ended_at timestamptz,
  clock_out_at timestamptz,
  created_at timestamptz not null default now(),
  check (clock_out_at is null or clock_out_at >= clock_in_at),
  check (break_started_at is null or break_started_at >= clock_in_at),
  check (break_ended_at is null or break_started_at is not null and break_ended_at >= break_started_at),
  check (clock_out_at is null or break_ended_at is null or clock_out_at >= break_ended_at),
  check ((state = 'working' and clock_out_at is null and (break_started_at is null or break_ended_at is not null))
    or (state = 'on_break' and clock_out_at is null and break_started_at is not null and break_ended_at is null)
    or (state = 'complete' and clock_out_at is not null and (break_started_at is null or break_ended_at is not null)))
);

create unique index if not exists workforce_one_open_shift_per_worker
  on public.workforce_shifts (organization_id, user_id)
  where state <> 'complete';
create index if not exists workforce_shifts_org_created_idx
  on public.workforce_shifts (organization_id, created_at desc, id desc);
create index if not exists workforce_shifts_user_created_idx
  on public.workforce_shifts (user_id, created_at desc, id desc);

create table if not exists public.workforce_shift_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.workforce_organizations(id) on delete cascade,
  shift_id uuid not null references public.workforce_shifts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  event_type public.workforce_event_type not null,
  occurred_at timestamptz not null default now(),
  latitude numeric(10,7) not null check (latitude between -90 and 90),
  longitude numeric(10,7) not null check (longitude between -180 and 180),
  accuracy_m numeric(8,2) not null check (accuracy_m between 0 and 100000),
  idempotency_key uuid not null,
  unique (user_id, idempotency_key)
);
create index if not exists workforce_events_shift_time_idx
  on public.workforce_shift_events (shift_id, occurred_at asc);
create index if not exists workforce_events_org_time_idx
  on public.workforce_shift_events (organization_id, occurred_at desc, id desc);

create or replace function public.workforce_immutable_event()
returns trigger
language plpgsql security definer set search_path = pg_catalog
as $$
begin
  raise exception 'Workforce events are append-only';
end;
$$;
create trigger workforce_shift_events_append_only
  before update or delete on public.workforce_shift_events
  for each row execute function public.workforce_immutable_event();

create table if not exists public.workforce_audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.workforce_organizations(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (char_length(action) between 1 and 80),
  subject_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists workforce_audit_org_time_idx
  on public.workforce_audit_events (organization_id, created_at desc, id desc);

create trigger workforce_audit_events_append_only
  before update or delete on public.workforce_audit_events
  for each row execute function public.workforce_immutable_event();

alter table public.workforce_organizations enable row level security;
alter table public.workforce_memberships enable row level security;
alter table public.workforce_invitations enable row level security;
alter table public.workforce_shifts enable row level security;
alter table public.workforce_shift_events enable row level security;
alter table public.workforce_audit_events enable row level security;

create or replace function public.workforce_my_org()
returns uuid
language sql stable security definer set search_path = pg_catalog
as $$
  select organization_id from public.workforce_memberships
  where user_id = auth.uid()
  order by created_at asc limit 1
$$;

create or replace function public.get_my_role()
returns text
language sql stable security definer set search_path = pg_catalog
as $$
  select role::text from public.workforce_memberships where user_id = auth.uid() order by created_at asc limit 1
$$;

create or replace function public.create_staff_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = pg_catalog
as $$
declare
  org_id uuid;
  invitation_id uuid;
begin
  if auth.uid() is null or p_token is null or char_length(p_token) < 24 then
    raise exception 'Invalid invitation request';
  end if;
  select organization_id into org_id from public.workforce_memberships
    where user_id = auth.uid() and role = 'admin' limit 1;
  if org_id is null then raise exception 'Admin access required'; end if;
  insert into public.workforce_invitations (organization_id, token_hash, expires_at, created_by)
  values (org_id, encode(extensions.digest(p_token, 'sha256'), 'hex'), now() + interval '10 minutes', auth.uid())
  returning id into invitation_id;
  insert into public.workforce_audit_events (organization_id, actor_user_id, action, subject_id)
  values (org_id, auth.uid(), 'invitation_created', invitation_id);
  return invitation_id;
end;
$$;

create or replace function public.claim_staff_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = pg_catalog
as $$
declare
  invitation public.workforce_invitations;
  display_name text;
begin
  if auth.uid() is null or p_token is null or char_length(p_token) < 24 then raise exception 'Invalid invitation'; end if;
  select * into invitation from public.workforce_invitations
    where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
      and claimed_at is null and expires_at > now()
    for update;
  if not found then raise exception 'Invitation is invalid or expired'; end if;
  display_name := coalesce(nullif(split_part((select email from auth.users where id = auth.uid()), '@', 1), ''), 'Team member');
  insert into public.workforce_memberships (organization_id, user_id, role, display_name)
  values (invitation.organization_id, auth.uid(), 'worker', display_name)
  on conflict (organization_id, user_id) do nothing;
  update public.workforce_invitations set claimed_at = now(), claimed_by = auth.uid() where id = invitation.id;
  insert into public.workforce_audit_events (organization_id, actor_user_id, action, subject_id)
  values (invitation.organization_id, auth.uid(), 'invitation_claimed', invitation.id);
  return invitation.organization_id;
end;
$$;

create or replace function public.workforce_action(
  p_action public.workforce_event_type,
  p_latitude numeric,
  p_longitude numeric,
  p_accuracy numeric,
  p_idempotency_key uuid
)
returns uuid
language plpgsql security definer set search_path = pg_catalog
as $$
declare
  org_id uuid;
  current_shift public.workforce_shifts;
  next_state public.workforce_shift_state;
  shift_id uuid;
  now_at timestamptz := clock_timestamp();
begin
  if auth.uid() is null or p_idempotency_key is null or p_accuracy is null or p_accuracy < 0 then raise exception 'Invalid action evidence'; end if;
  select organization_id into org_id from public.workforce_memberships where user_id = auth.uid() and role = 'worker' limit 1;
  if org_id is null then raise exception 'Worker access required'; end if;
  select event.shift_id into shift_id from public.workforce_shift_events as event where event.user_id = auth.uid() and event.idempotency_key = p_idempotency_key limit 1;
  if shift_id is not null then return shift_id; end if;
  select * into current_shift from public.workforce_shifts where organization_id = org_id and user_id = auth.uid() and state <> 'complete' for update;
  if p_action = 'clock_in' then
    if found then raise exception 'A shift is already open'; end if;
    insert into public.workforce_shifts (organization_id, user_id, state, clock_in_at)
      values (org_id, auth.uid(), 'working', now_at) returning * into current_shift;
    next_state := 'working';
  else
    if not found then raise exception 'No open shift'; end if;
    next_state := case when current_shift.state = 'working' and p_action = 'start_break' then 'on_break'
      when current_shift.state = 'on_break' and p_action = 'end_break' then 'working'
      when current_shift.state = 'working' and p_action = 'clock_out' then 'complete'
      else null end;
    if next_state is null then raise exception 'Invalid shift transition'; end if;
    update public.workforce_shifts set state = next_state,
      break_started_at = case when p_action = 'start_break' then now_at else break_started_at end,
      break_ended_at = case when p_action = 'end_break' then now_at else break_ended_at end,
      clock_out_at = case when p_action = 'clock_out' then now_at else clock_out_at end
      where id = current_shift.id;
  end if;
  insert into public.workforce_shift_events (organization_id, shift_id, user_id, event_type, occurred_at, latitude, longitude, accuracy_m, idempotency_key)
    values (org_id, current_shift.id, auth.uid(), p_action, now_at, p_latitude, p_longitude, p_accuracy, p_idempotency_key);
  insert into public.workforce_audit_events (organization_id, actor_user_id, action, subject_id, metadata)
    values (org_id, auth.uid(), p_action::text, current_shift.id, jsonb_build_object('accuracy_m', p_accuracy));
  return current_shift.id;
end;
$$;

create or replace function public.clock_in(p_latitude numeric, p_longitude numeric, p_accuracy numeric, p_idempotency_key uuid) returns uuid language sql security definer set search_path = pg_catalog as $$ select public.workforce_action('clock_in', p_latitude, p_longitude, p_accuracy, p_idempotency_key) $$;
create or replace function public.start_break(p_latitude numeric, p_longitude numeric, p_accuracy numeric, p_idempotency_key uuid) returns uuid language sql security definer set search_path = pg_catalog as $$ select public.workforce_action('start_break', p_latitude, p_longitude, p_accuracy, p_idempotency_key) $$;
create or replace function public.end_break(p_latitude numeric, p_longitude numeric, p_accuracy numeric, p_idempotency_key uuid) returns uuid language sql security definer set search_path = pg_catalog as $$ select public.workforce_action('end_break', p_latitude, p_longitude, p_accuracy, p_idempotency_key) $$;
create or replace function public.clock_out(p_latitude numeric, p_longitude numeric, p_accuracy numeric, p_idempotency_key uuid) returns uuid language sql security definer set search_path = pg_catalog as $$ select public.workforce_action('clock_out', p_latitude, p_longitude, p_accuracy, p_idempotency_key) $$;

create or replace function public.workforce_admin_today()
returns table (user_id uuid, display_name text, role public.workforce_role, state public.workforce_shift_state, clock_in_at timestamptz, break_started_at timestamptz, break_ended_at timestamptz, clock_out_at timestamptz, shift_id uuid, events jsonb)
language sql stable security definer set search_path = pg_catalog
as $$
  select m.user_id, m.display_name, m.role, s.state, s.clock_in_at, s.break_started_at, s.break_ended_at, s.clock_out_at, s.id,
    coalesce((select jsonb_agg(jsonb_build_object(
      'id', e.id,
      'type', e.event_type,
      'at', e.occurred_at,
      'location', jsonb_build_object('latitude', e.latitude, 'longitude', e.longitude, 'accuracy', e.accuracy_m)
    ) order by e.occurred_at asc) from public.workforce_shift_events e where e.shift_id = s.id), '[]'::jsonb)
  from public.workforce_memberships m
  left join lateral (select * from public.workforce_shifts ws where ws.organization_id = m.organization_id and ws.user_id = m.user_id and ws.created_at::date = current_date order by ws.created_at desc limit 1) s on true
  where m.organization_id = public.workforce_my_org() and exists (select 1 from public.workforce_memberships am where am.organization_id = m.organization_id and am.user_id = auth.uid() and am.role = 'admin')
$$;


create or replace function public.workforce_worker_today()
returns jsonb
language sql stable security definer set search_path = pg_catalog
as $$
  select coalesce((
    select jsonb_build_object(
      'id', s.id,
      'state', s.state,
      'clockInAt', s.clock_in_at,
      'breakStartedAt', s.break_started_at,
      'breakEndedAt', s.break_ended_at,
      'clockOutAt', s.clock_out_at,
      'events', coalesce((select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'type', e.event_type,
        'at', e.occurred_at,
        'location', jsonb_build_object('latitude', e.latitude, 'longitude', e.longitude, 'accuracy', e.accuracy_m)
      ) order by e.occurred_at asc) from public.workforce_shift_events e where e.shift_id = s.id), '[]'::jsonb)
    )
    from public.workforce_shifts s
    where s.organization_id = public.workforce_my_org() and s.user_id = auth.uid() and s.created_at::date = current_date
    order by s.created_at desc limit 1
  ), jsonb_build_object('id', null, 'state', 'off_shift', 'clockInAt', null, 'breakStartedAt', null, 'breakEndedAt', null, 'clockOutAt', null, 'events', '[]'::jsonb))
$$;

-- No direct client writes: all lifecycle and invitation mutations go through RPCs.
revoke insert, update, delete on public.workforce_invitations, public.workforce_shifts, public.workforce_shift_events, public.workforce_audit_events, public.workforce_memberships from anon, authenticated;
grant select on public.workforce_organizations, public.workforce_memberships, public.workforce_shifts, public.workforce_shift_events to authenticated;

revoke all on function public.workforce_my_org() from public;
revoke all on function public.get_my_role() from public;
revoke all on function public.create_staff_invitation(text) from public;
revoke all on function public.claim_staff_invitation(text) from public;
revoke all on function public.workforce_action(public.workforce_event_type, numeric, numeric, numeric, uuid) from public;
revoke all on function public.clock_in(numeric,numeric,numeric,uuid) from public;
revoke all on function public.start_break(numeric,numeric,numeric,uuid) from public;
revoke all on function public.end_break(numeric,numeric,numeric,uuid) from public;
revoke all on function public.clock_out(numeric,numeric,numeric,uuid) from public;
revoke all on function public.workforce_admin_today() from public;
revoke all on function public.workforce_worker_today() from public;
grant execute on function public.workforce_my_org() to authenticated;

grant execute on function public.get_my_role(), public.create_staff_invitation(text), public.claim_staff_invitation(text), public.clock_in(numeric,numeric,numeric,uuid), public.start_break(numeric,numeric,numeric,uuid), public.end_break(numeric,numeric,numeric,uuid), public.clock_out(numeric,numeric,numeric,uuid), public.workforce_admin_today(), public.workforce_worker_today() to authenticated;

create policy workforce_org_member_read on public.workforce_organizations for select to authenticated using (id = public.workforce_my_org());
create policy workforce_member_self_read on public.workforce_memberships for select to authenticated using (user_id = auth.uid() or organization_id = public.workforce_my_org());
create policy workforce_shift_member_read on public.workforce_shifts for select to authenticated using (
  public.workforce_shifts.organization_id = public.workforce_my_org()
  and (public.workforce_shifts.user_id = auth.uid() or exists (
    select 1 from public.workforce_memberships am
    where am.organization_id = public.workforce_shifts.organization_id and am.user_id = auth.uid() and am.role = 'admin'
  ))
);
create policy workforce_event_member_read on public.workforce_shift_events for select to authenticated using (
  public.workforce_shift_events.organization_id = public.workforce_my_org()
  and (public.workforce_shift_events.user_id = auth.uid() or exists (
    select 1 from public.workforce_memberships am
    where am.organization_id = public.workforce_shift_events.organization_id and am.user_id = auth.uid() and am.role = 'admin'
  ))
);

-- Retire direct mutation paths from the older time-tracking tables if they exist.
do $$ begin
  execute 'revoke insert, update, delete on public.user_roles from anon, authenticated';
exception when undefined_table then null; end $$;
do $$ begin
  execute 'revoke insert, update, delete on public.time_tracking from anon, authenticated';
exception when undefined_table then null; end $$;
