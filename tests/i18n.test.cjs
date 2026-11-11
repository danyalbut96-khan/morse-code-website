'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('i18n.js','utf8');
const match=source.match(/const dictionaries=(\{[\s\S]*?\});\n const originalText/);
assert.ok(match,'offline translation dictionaries must be embedded as valid JSON');
const dictionaries=JSON.parse(match[1]);
test('all supported offline languages have dictionaries',()=>{
 for(const language of ['ur','hi','ar'])assert.ok(dictionaries[language]&&Object.keys(dictionaries[language]).length>50,language+' dictionary is missing or too small');
});
test('secure contact setup and safety instructions are translated',()=>{
 for(const language of ['ur','hi','ar']){
  const d=dictionaries[language];
  for(const phrase of ['Your trusted contacts.','Verification matters.','Encrypt message','Decrypt message','New to secure contacts? Follow these 4 steps','Share the public key only. Never send your private key or vault PIN. If the fingerprints do not match exactly, do not verify or send sensitive messages. Delete that contact and repeat the exchange using a trusted channel.']){
   assert.equal(typeof d[phrase],'string',language+' is missing '+phrase);
   assert.ok(d[phrase].length>0);
  }
 }
});
test('offline translation does not depend on a remote translation service',()=>{
 assert.doesNotMatch(source,/fetch\s*\(|XMLHttpRequest|https?:\/\//);
 assert.match(source,/rtl\.has\(lang\)/);
});
