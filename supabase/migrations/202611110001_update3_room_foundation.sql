-- Update 3 room schema foundation. Plaintext and cryptographic keys are never stored here.
create table if not exists public.signal_rooms (
 id uuid primary key default gen_random_uuid(),
 created_by uuid not null references auth.users(id) on delete cascade,
 invite_hash text not null check (invite_hash ~ '^[0-9a-f]{64}$'),
 max_members smallint not null default 2 check (max_members between 2 and 8),
 expires_at timestamptz, created_at timestamptz not null default now(), closed_at timestamptz
);
create table if not exists public.signal_room_members (
 room_id uuid not null references public.signal_rooms(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 joined_at timestamptz not null default now(), primary key(room_id,user_id)
);
create table if not exists public.signal_room_messages (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references public.signal_rooms(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 algorithm text not null check (algorithm='ECDH-P256/HKDF-SHA256/AES-256-GCM'),
 nonce_b64 text not null check (length(nonce_b64) between 16 and 32),
 ciphertext_b64 text not null check (length(ciphertext_b64) between 24 and 30000),
 key_version smallint not null default 1 check (key_version>0),
 created_at timestamptz not null default now(), expires_at timestamptz
);
create index if not exists signal_room_messages_room_created_idx on public.signal_room_messages(room_id,created_at desc);
create index if not exists signal_rooms_expiry_idx on public.signal_rooms(expires_at) where expires_at is not null;
alter table public.signal_rooms enable row level security;
alter table public.signal_room_members enable row level security;
alter table public.signal_room_messages enable row level security;

create or replace function public.is_signal_room_member(p_room_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.signal_room_members m where m.room_id=p_room_id and m.user_id=auth.uid()); $$;
revoke all on function public.is_signal_room_member(uuid) from public;
grant execute on function public.is_signal_room_member(uuid) to authenticated;

create or replace function public.add_signal_room_creator()
returns trigger language plpgsql security definer set search_path=''
as $$ begin insert into public.signal_room_members(room_id,user_id) values(new.id,new.created_by) on conflict do nothing; return new; end; $$;
drop trigger if exists signal_room_creator_membership on public.signal_rooms;
create trigger signal_room_creator_membership after insert on public.signal_rooms for each row execute function public.add_signal_room_creator();

create or replace function public.join_signal_room(p_room_id uuid,p_invite_hash text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare r public.signal_rooms%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_invite_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid invite'; end if;
 select * into r from public.signal_rooms where id=p_room_id and invite_hash=p_invite_hash and closed_at is null and (expires_at is null or expires_at>now()) for update;
 if not found then return false; end if;
 if (select count(*) from public.signal_room_members where room_id=p_room_id)>=r.max_members
   and not exists(select 1 from public.signal_room_members where room_id=p_room_id and user_id=auth.uid()) then return false; end if;
 insert into public.signal_room_members(room_id,user_id) values(p_room_id,auth.uid()) on conflict do nothing;
 return true;
end; $$;
revoke all on function public.join_signal_room(uuid,text) from public;
grant execute on function public.join_signal_room(uuid,text) to authenticated;

create policy "room creators can create rooms" on public.signal_rooms for insert to authenticated with check(created_by=auth.uid());
create policy "members can read their room" on public.signal_rooms for select to authenticated using(public.is_signal_room_member(id));
create policy "members can read own membership" on public.signal_room_members for select to authenticated using(public.is_signal_room_member(room_id) and user_id=auth.uid());
create policy "members can read encrypted envelopes" on public.signal_room_messages for select to authenticated using(public.is_signal_room_member(room_id));
create policy "members can send encrypted envelopes" on public.signal_room_messages for insert to authenticated with check(
 sender_id=auth.uid() and public.is_signal_room_member(room_id)
 and exists(select 1 from public.signal_rooms r where r.id=room_id and r.closed_at is null and (r.expires_at is null or r.expires_at>now()))
);
-- No UPDATE or client DELETE policy. Cleanup must run through a trusted scheduled job.
-- Typing/online indicators must use transient Realtime Presence/Broadcast, not persistent tables.
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='signal_room_messages') then
  alter publication supabase_realtime add table public.signal_room_messages;
 end if;
end $$;
