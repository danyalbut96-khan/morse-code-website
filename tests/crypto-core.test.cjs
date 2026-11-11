const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
globalThis.crypto = webcrypto;
globalThis.btoa = s => Buffer.from(s, 'binary').toString('base64');
globalThis.atob = s => Buffer.from(s, 'base64').toString('binary');
const C = require('../crypto-core.js');

async function pairKey(a,b){
  const aPair=await C.generateEcdhPair(), bPair=await C.generateEcdhPair();
  const aSecret=await C.deriveSharedSecret(aPair.privateKey,bPair.publicKey);
  const bSecret=await C.deriveSharedSecret(bPair.privateKey,aPair.publicKey);
  assert.deepEqual(aSecret,bSecret);
  return C.deriveMessageKey(aSecret,aPair.publicKey,bPair.publicKey);
}

test('ECDH peers derive identical AES-GCM keys and round-trip',async()=>{
  const key=await pairKey();
  const envelope=await C.encryptMessage(key,'hello from the signal studio');
  assert.equal((await C.decryptMessage(key,envelope)).text,'hello from the signal studio');
});

test('wrong ECDH key fails authentication',async()=>{
  const sender=await pairKey(), receiver=await pairKey();
  const envelope=await C.encryptMessage(sender,'classified');
  await assert.rejects(()=>C.decryptMessage(receiver,envelope));
});

test('expired messages are rejected after successful authentication',async()=>{
  const key=await pairKey();
  const envelope=await C.encryptMessage(key,'temporary',{expiresAt:Date.now()+5});
  await new Promise(resolve=>setTimeout(resolve,15));
  await assert.rejects(()=>C.decryptMessage(key,envelope),/expired/i);
});

test('view-once flag and fixed-size padding metadata survive encryption',async()=>{
  const key=await pairKey();
  const envelope=await C.encryptMessage(key,'one view',{viewOnce:true});
  const result=await C.decryptMessage(key,envelope);
  assert.equal(result.viewOnce,true);
  assert.ok(envelope.bucket>=256);
});

test('contact vault rejects an incorrect local PIN',async()=>{
  const vault=await C.sealVault({contacts:[],secret:'test'},'246810');
  assert.deepEqual(await C.openVault(vault,'246810'),{contacts:[],secret:'test'});
  await assert.rejects(()=>C.openVault(vault,'000000'));
});

test('contact vault rejects hostile KDF parameters before derivation',async()=>{
  const vault=await C.sealVault({contacts:[]},'long-test-passphrase');
  await assert.rejects(()=>C.openVault({...vault,iterations:999999999},'long-test-passphrase'),/KDF parameters/i);
  await assert.rejects(()=>C.openVault({...vault,salt:'AA=='},'long-test-passphrase'),/vault data/i);
});
test('contact vault rejects ciphertext tampering',async()=>{
  const vault=await C.sealVault({contacts:[],secret:'private'},'long-test-passphrase');
  const bytes=C.unb64(vault.data);bytes[0]^=1;
  await assert.rejects(()=>C.openVault({...vault,data:C.b64(bytes)},'long-test-passphrase'));
});
