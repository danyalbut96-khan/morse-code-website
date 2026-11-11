'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
if(!globalThis.crypto?.subtle)globalThis.crypto=require('node:crypto').webcrypto;
const C=require('../crypto-core.js');

test('two existing ECDH contacts derive the same room wrapping key',async()=>{
  const alice=await C.generateEcdhPair(),bob=await C.generateEcdhPair();
  const roomId=crypto.randomUUID();
  const a=await C.deriveSharedSecret(alice.privateKey,bob.publicKey);
  const b=await C.deriveSharedSecret(bob.privateKey,alice.publicKey);
  assert.deepEqual(a,b);
  const ka=await C.deriveRoomWrapKey(a,roomId),kb=await C.deriveRoomWrapKey(b,roomId);
  const roomKey=crypto.getRandomValues(new Uint8Array(32));
  const wrapped=await C.wrapRoomKey(ka,roomKey,roomId);
  assert.deepEqual(await C.unwrapRoomKey(kb,wrapped,roomId),roomKey);
});

test('room key envelope is bound to its room identifier',async()=>{
  const a=await C.generateEcdhPair(),b=await C.generateEcdhPair();
  const secret=await C.deriveSharedSecret(a.privateKey,b.publicKey);
  const key=await C.deriveRoomWrapKey(secret,crypto.randomUUID());
  const roomId=crypto.randomUUID(),roomKey=crypto.getRandomValues(new Uint8Array(32));
  const envelope=await C.wrapRoomKey(key,roomKey,roomId);
  await assert.rejects(()=>C.unwrapRoomKey(key,envelope,crypto.randomUUID()));
});

test('room messages round-trip and preserve disguise metadata',async()=>{
  const roomId=crypto.randomUUID(),key=crypto.getRandomValues(new Uint8Array(32));
  const envelope=await C.encryptRoomMessage(key,roomId,'Hello — سلام','emoji');
  const decoded=await C.decryptRoomMessage(key,roomId,envelope);
  assert.equal(decoded.text,'Hello — سلام');
  assert.equal(decoded.disguise,'emoji');
  assert.equal(typeof decoded.createdAt,'number');
  assert.equal(envelope.ciphertext.includes('Hello'),false);
});

test('room message authentication binds ciphertext to the room id',async()=>{
  const roomId=crypto.randomUUID(),key=crypto.getRandomValues(new Uint8Array(32));
  const envelope=await C.encryptRoomMessage(key,roomId,'private message');
  await assert.rejects(()=>C.decryptRoomMessage(key,crypto.randomUUID(),envelope));
});

test('tampered room ciphertext fails AES-GCM authentication',async()=>{
  const roomId=crypto.randomUUID(),key=crypto.getRandomValues(new Uint8Array(32));
  const envelope=await C.encryptRoomMessage(key,roomId,'do not alter');
  const data=C.unb64(envelope.ciphertext);data[0]^=1;envelope.ciphertext=C.b64(data);
  await assert.rejects(()=>C.decryptRoomMessage(key,roomId,envelope));
});
