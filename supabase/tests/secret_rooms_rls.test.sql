begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

select has_table('public','signal_rooms','rooms table exists');
select has_table('public','signal_room_members','members table exists');
select has_table('public','signal_room_messages','encrypted messages table exists');
select ok((select relrowsecurity from pg_class where oid='public.signal_rooms'::regclass),'rooms RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.signal_room_members'::regclass),'members RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.signal_room_messages'::regclass),'messages RLS enabled');
select has_column('public','signal_room_messages','ciphertext_b64','ciphertext column exists');
select has_column('public','signal_room_messages','nonce_b64','nonce column exists');
select hasnt_column('public','signal_room_messages','plaintext','no plaintext column exists');
select hasnt_column('public','signal_rooms','room_key','no room key column exists');
select ok(exists(select 1 from pg_policies where schemaname='realtime' and tablename='messages' and policyname='signal room members can receive transient events'),'private Realtime receive policy exists');
select ok(exists(select 1 from pg_policies where schemaname='realtime' and tablename='messages' and policyname='signal room members can send transient events'),'private Realtime send policy exists');
select ok(exists(select 1 from pg_policies where schemaname='realtime' and tablename='messages' and policyname='signal room topics require membership for receive' and permissive='RESTRICTIVE'),'restrictive receive guard prevents permissive-policy bypass');
select ok(exists(select 1 from pg_policies where schemaname='realtime' and tablename='messages' and policyname='signal room topics require membership for send' and permissive='RESTRICTIVE'),'restrictive send guard prevents permissive-policy bypass');
select ok(not has_function_privilege('anon','private.cleanup_expired_signal_rooms()','execute'),'anon cannot execute cleanup');
select ok(not has_function_privilege('authenticated','private.cleanup_expired_signal_rooms()','execute'),'authenticated cannot execute cleanup');
select ok(not has_function_privilege('anon','public.join_signal_room(uuid,text)','execute'),'anon cannot call join RPC');
select ok(not has_column_privilege('authenticated','public.signal_rooms','invite_hash','SELECT'),'invite digest is not selectable');
select ok(not has_table_privilege('authenticated','public.signal_room_messages','DELETE'),'clients cannot delete message rows');
select ok(not exists(select 1 from pg_policies where schemaname='public' and tablename='signal_room_messages' and cmd in ('UPDATE','DELETE')),'messages have no update/delete policies');

select * from finish();
rollback;
