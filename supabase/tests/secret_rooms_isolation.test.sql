begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- Disposable identities and a room are created inside this transaction and rolled back.
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
values
 ('10000000-0000-4000-8000-000000000001','authenticated','authenticated','room-a@example.invalid','',now(),now(),now()),
 ('10000000-0000-4000-8000-000000000002','authenticated','authenticated','room-b@example.invalid','',now(),now(),now()),
 ('10000000-0000-4000-8000-000000000003','authenticated','authenticated','room-c@example.invalid','',now(),now(),now());

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

insert into public.signal_rooms(id,created_by,invite_hash,max_members)
values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',repeat('a',64),3);

select is((select count(*)::int from public.signal_rooms where id='20000000-0000-4000-8000-000000000001'),1,'creator can read the room');

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::int from public.signal_rooms where id='20000000-0000-4000-8000-000000000001'),0,'non-member cannot read room before joining');
select ok(public.join_signal_room('20000000-0000-4000-8000-000000000001',repeat('a',64)),'valid invitation admits a member');
select is((select count(*)::int from public.signal_rooms where id='20000000-0000-4000-8000-000000000001'),1,'joined member can read room');

insert into public.signal_room_messages(room_id,sender_id,algorithm,nonce_b64,ciphertext_b64,key_version)
values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
 'ECDH-P256/HKDF-SHA256/AES-256-GCM','AAAAAAAAAAAAAAAA','AAAAAAAAAAAAAAAAAAAAAAAA',1);

select is((select count(*)::int from public.signal_room_messages where room_id='20000000-0000-4000-8000-000000000001'),1,'room member can insert and read ciphertext');

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is((select count(*)::int from public.signal_rooms where id='20000000-0000-4000-8000-000000000001'),0,'uninvited identity cannot read room');
select is((select count(*)::int from public.signal_room_messages where room_id='20000000-0000-4000-8000-000000000001'),0,'uninvited identity cannot read ciphertext');
select throws_ok(
 $$insert into public.signal_room_messages(room_id,sender_id,algorithm,nonce_b64,ciphertext_b64,key_version)
   values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003',
   'ECDH-P256/HKDF-SHA256/AES-256-GCM','BBBBBBBBBBBBBBBB','BBBBBBBBBBBBBBBBBBBBBBBB',1)$$,
 '42501',null,'uninvited identity cannot insert ciphertext'
);

select * from finish();
rollback;
