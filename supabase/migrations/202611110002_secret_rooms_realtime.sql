-- Secret Rooms: hardened authorization, ephemeral Realtime presence/broadcast, and server-side rate limiting.
-- Apply after 202611110001_update3_room_foundation.sql.
-- No plaintext or encryption key columns are created.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- Remove legacy public-schema SECURITY DEFINER helpers if an older foundation was applied.
drop trigger if exists signal_room_creator_membership on public.signal_rooms;
drop function if exists public.add_signal_room_creator() cascade;
drop policy if exists "members can read their room" on public.signal_rooms;
drop policy if exists "members can read membership rows" on public.signal_room_members;
drop policy if exists "members can read encrypted envelopes" on public.signal_room_messages;
drop policy if exists "members can send encrypted envelopes" on public.signal_room_messages;
drop function if exists public.is_signal_room_member(uuid);

create or replace function private.is_signal_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.signal_room_members m
    where m.room_id = p_room_id and m.user_id = (select auth.uid())
  );
$$;
revoke all on function private.is_signal_room_member(uuid) from public, anon;
grant execute on function private.is_signal_room_member(uuid) to authenticated;

create or replace function private.add_signal_room_creator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is null then raise exception 'Room creator is required'; end if;
  insert into public.signal_room_members(room_id,user_id)
  values (new.id,new.created_by) on conflict do nothing;
  return new;
end;
$$;
revoke all on function private.add_signal_room_creator() from public, anon, authenticated;
create trigger signal_room_creator_membership
after insert on public.signal_rooms
for each row execute function private.add_signal_room_creator();

create or replace function private.join_signal_room(p_room_id uuid,p_invite_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  room_row public.signal_rooms%rowtype;
  member_count integer;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_invite_hash is null or p_invite_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid invitation'; end if;
  select * into room_row
  from public.signal_rooms
  where id=p_room_id and invite_hash=p_invite_hash and closed_at is null
    and (expires_at is null or expires_at > pg_catalog.now())
  for update;
  if not found then return false; end if;
  if exists(select 1 from public.signal_room_members where room_id=p_room_id and user_id=(select auth.uid())) then
    return true;
  end if;
  select count(*) into member_count from public.signal_room_members where room_id=p_room_id;
  if member_count >= room_row.max_members then return false; end if;
  insert into public.signal_room_members(room_id,user_id)
  values(p_room_id,(select auth.uid())) on conflict do nothing;
  return true;
end;
$$;
revoke all on function private.join_signal_room(uuid,text) from public, anon;
grant execute on function private.join_signal_room(uuid,text) to authenticated;

-- Exposed RPC is an invoker-only wrapper. Privileged work stays in the non-exposed private schema.
create or replace function public.join_signal_room(p_room_id uuid,p_invite_hash text)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.join_signal_room(p_room_id,p_invite_hash);
$$;
revoke all on function public.join_signal_room(uuid,text) from public, anon;
grant execute on function public.join_signal_room(uuid,text) to authenticated;

-- Least-privilege Data API grants. Room invite digests are deliberately not selectable.
revoke all on public.signal_rooms from anon, authenticated;
revoke all on public.signal_room_members from anon, authenticated;
revoke all on public.signal_room_messages from anon, authenticated;
grant select (id,created_by,max_members,expires_at,created_at,closed_at)
  on public.signal_rooms to authenticated;
grant insert (created_by,invite_hash,max_members,expires_at)
  on public.signal_rooms to authenticated;
grant select on public.signal_room_members to authenticated;
grant select,insert on public.signal_room_messages to authenticated;

drop policy if exists "room creators can create rooms" on public.signal_rooms;
create policy "room creators can create rooms"
on public.signal_rooms for insert to authenticated
with check (
  created_by = (select auth.uid())
  and max_members between 2 and 8
  and (expires_at is null or expires_at > pg_catalog.now())
);

create policy "room members can read room metadata"
on public.signal_rooms for select to authenticated
using ((select private.is_signal_room_member(id)));

create policy "room members can read own membership"
on public.signal_room_members for select to authenticated
using (user_id = (select auth.uid()) and (select private.is_signal_room_member(room_id)));

create policy "room members can read ciphertext"
on public.signal_room_messages for select to authenticated
using ((select private.is_signal_room_member(room_id)));

create policy "room members can insert ciphertext"
on public.signal_room_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and (select private.is_signal_room_member(room_id))
  and exists (
    select 1 from public.signal_rooms r
    where r.id = room_id and r.closed_at is null
      and (r.expires_at is null or r.expires_at > pg_catalog.now())
  )
);

-- Per-sender/room burst protection. Only ciphertext rows are counted; no separate activity log is written.
create or replace function private.enforce_signal_room_rate_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare recent_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(new.room_id::text),
    pg_catalog.hashtext(new.sender_id::text)
  );
  select count(*) into recent_count
  from public.signal_room_messages m
  where m.room_id = new.room_id
    and m.sender_id = new.sender_id
    and m.created_at > pg_catalog.now() - interval '60 seconds';
  if recent_count >= 20 then raise exception 'Room message rate limit exceeded'; end if;
  return new;
end;
$$;
revoke all on function private.enforce_signal_room_rate_limit() from public, anon, authenticated;
drop trigger if exists signal_room_message_rate_limit on public.signal_room_messages;
create trigger signal_room_message_rate_limit
before insert on public.signal_room_messages
for each row execute function private.enforce_signal_room_rate_limit();

-- Private Realtime channel authorization for transient typing and presence.
-- Topic format is room:<uuid>; typing/online events are never stored in application tables.
drop policy if exists "signal room members can receive transient events" on realtime.messages;
drop policy if exists "signal room members can send transient events" on realtime.messages;
create policy "signal room members can receive transient events"
on realtime.messages for select to authenticated
using (
  extension in ('broadcast','presence')
  and case
    when realtime.topic() ~ '^room:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}

-- Expired room deletion is performed by a trusted scheduler. Cascades delete membership and ciphertext.
create or replace function private.cleanup_expired_signal_rooms()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare removed_count integer;
begin
  delete from public.signal_rooms
  where (expires_at is not null and expires_at <= pg_catalog.now())
     or (closed_at is not null and closed_at <= pg_catalog.now());
  get diagnostics removed_count = row_count;
  return removed_count;
end;
$$;
revoke all on function private.cleanup_expired_signal_rooms() from public, anon, authenticated;
grant execute on function private.cleanup_expired_signal_rooms() to service_role;

comment on table public.signal_room_messages is
  'Encrypted message envelopes only. Plaintext, room keys and invite tokens must never be stored here.';
comment on column public.signal_rooms.invite_hash is
  'SHA-256 digest of a high-entropy invite token. Raw invite token is only in the URL fragment.';

    then (select private.is_signal_room_member(substring(realtime.topic() from 6)::uuid))
    else false
  end
);
create policy "signal room members can send transient events"
on realtime.messages for insert to authenticated
with check (
  extension in ('broadcast','presence')
  and case
    when realtime.topic() ~ '^room:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}

-- Expired room deletion is performed by a trusted scheduler. Cascades delete membership and ciphertext.
create or replace function private.cleanup_expired_signal_rooms()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare removed_count integer;
begin
  delete from public.signal_rooms
  where (expires_at is not null and expires_at <= pg_catalog.now())
     or (closed_at is not null and closed_at <= pg_catalog.now());
  get diagnostics removed_count = row_count;
  return removed_count;
end;
$$;
revoke all on function private.cleanup_expired_signal_rooms() from public, anon, authenticated;
grant execute on function private.cleanup_expired_signal_rooms() to service_role;

comment on table public.signal_room_messages is
  'Encrypted message envelopes only. Plaintext, room keys and invite tokens must never be stored here.';
comment on column public.signal_rooms.invite_hash is
  'SHA-256 digest of a high-entropy invite token. Raw invite token is only in the URL fragment.';

    then (select private.is_signal_room_member(substring(realtime.topic() from 6)::uuid))
    else false
  end
);

-- Restrictive guards prevent an unrelated permissive realtime.messages policy from
-- accidentally exposing room topics. Non-room topics keep their existing policy behavior.
drop policy if exists "signal room topics require membership for receive" on realtime.messages;
drop policy if exists "signal room topics require membership for send" on realtime.messages;
create policy "signal room topics require membership for receive"
on realtime.messages as restrictive for select to authenticated
using (
  realtime.topic() not like 'room:%'
  or (
    extension in ('broadcast','presence')
    and case
      when realtime.topic() ~ '^room:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}

-- Expired room deletion is performed by a trusted scheduler. Cascades delete membership and ciphertext.
create or replace function private.cleanup_expired_signal_rooms()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare removed_count integer;
begin
  delete from public.signal_rooms
  where (expires_at is not null and expires_at <= pg_catalog.now())
     or (closed_at is not null and closed_at <= pg_catalog.now());
  get diagnostics removed_count = row_count;
  return removed_count;
end;
$$;
revoke all on function private.cleanup_expired_signal_rooms() from public, anon, authenticated;
grant execute on function private.cleanup_expired_signal_rooms() to service_role;

comment on table public.signal_room_messages is
  'Encrypted message envelopes only. Plaintext, room keys and invite tokens must never be stored here.';
comment on column public.signal_rooms.invite_hash is
  'SHA-256 digest of a high-entropy invite token. Raw invite token is only in the URL fragment.';

      then (select private.is_signal_room_member(substring(realtime.topic() from 6)::uuid))
      else false
    end
  )
);
create policy "signal room topics require membership for send"
on realtime.messages as restrictive for insert to authenticated
with check (
  realtime.topic() not like 'room:%'
  or (
    extension in ('broadcast','presence')
    and case
      when realtime.topic() ~ '^room:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}

-- Expired room deletion is performed by a trusted scheduler. Cascades delete membership and ciphertext.
create or replace function private.cleanup_expired_signal_rooms()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare removed_count integer;
begin
  delete from public.signal_rooms
  where (expires_at is not null and expires_at <= pg_catalog.now())
     or (closed_at is not null and closed_at <= pg_catalog.now());
  get diagnostics removed_count = row_count;
  return removed_count;
end;
$$;
revoke all on function private.cleanup_expired_signal_rooms() from public, anon, authenticated;
grant execute on function private.cleanup_expired_signal_rooms() to service_role;

comment on table public.signal_room_messages is
  'Encrypted message envelopes only. Plaintext, room keys and invite tokens must never be stored here.';
comment on column public.signal_rooms.invite_hash is
  'SHA-256 digest of a high-entropy invite token. Raw invite token is only in the URL fragment.';

      then (select private.is_signal_room_member(substring(realtime.topic() from 6)::uuid))
      else false
    end
  )
);

-- Expired room deletion is performed by a trusted scheduler. Cascades delete membership and ciphertext.
create or replace function private.cleanup_expired_signal_rooms()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare removed_count integer;
begin
  delete from public.signal_rooms
  where (expires_at is not null and expires_at <= pg_catalog.now())
     or (closed_at is not null and closed_at <= pg_catalog.now());
  get diagnostics removed_count = row_count;
  return removed_count;
end;
$$;
revoke all on function private.cleanup_expired_signal_rooms() from public, anon, authenticated;
grant execute on function private.cleanup_expired_signal_rooms() to service_role;

comment on table public.signal_room_messages is
  'Encrypted message envelopes only. Plaintext, room keys and invite tokens must never be stored here.';
comment on column public.signal_rooms.invite_hash is
  'SHA-256 digest of a high-entropy invite token. Raw invite token is only in the URL fragment.';
