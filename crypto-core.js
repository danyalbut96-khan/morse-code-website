'use strict';
/* Browser-only cryptographic primitives. No network or persistence in this module. */
(function(root){
  const subtle=()=>{if(!root.crypto?.subtle)throw new Error('Web Crypto is unavailable. Use HTTPS or localhost.');return root.crypto.subtle};
  const enc=new TextEncoder(),dec=new TextDecoder();
  const b64=b=>{let s='';new Uint8Array(b).forEach(x=>s+=String.fromCharCode(x));return btoa(s)};
  const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  const jsonBytes=o=>enc.encode(JSON.stringify(o));
  async function derivePinKey(pin,salt,iterations=310000){
    if(typeof pin!=='string'||pin.length<6)throw new Error('Use a local PIN with at least 6 characters.');
    const material=await subtle().importKey('raw',enc.encode(pin),'PBKDF2',false,['deriveKey']);
    return subtle().deriveKey({name:'PBKDF2',salt,iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  async function sealVault(value,pin){
    const salt=root.crypto.getRandomValues(new Uint8Array(16)),iv=root.crypto.getRandomValues(new Uint8Array(12));
    const key=await derivePinKey(pin,salt);
    const data=await subtle().encrypt({name:'AES-GCM',iv,additionalData:enc.encode('morse-contact-vault-v1')},key,jsonBytes(value));
    return {v:1,kdf:'PBKDF2-SHA256',iterations:310000,salt:b64(salt),iv:b64(iv),data:b64(data)};
  }
  async function openVault(envelope,pin){
    if(!envelope||envelope.v!==1||envelope.kdf!=='PBKDF2-SHA256')throw new Error('Unsupported contact vault format.');
    const key=await derivePinKey(pin,unb64(envelope.salt),envelope.iterations);
    const plain=await subtle().decrypt({name:'AES-GCM',iv:unb64(envelope.iv),additionalData:enc.encode('morse-contact-vault-v1')},key,unb64(envelope.data));
    return JSON.parse(dec.decode(plain));
  }
  async function generateEcdhPair(){
    const pair=await subtle().generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
    return {publicKey:await subtle().exportKey('jwk',pair.publicKey),privateKey:b64(await subtle().exportKey('pkcs8',pair.privateKey))};
  }
  async function importPublic(jwk){return subtle().importKey('jwk',jwk,{name:'ECDH',namedCurve:'P-256'},true,[])}
  async function importPrivate(pkcs8){return subtle().importKey('pkcs8',unb64(pkcs8),{name:'ECDH',namedCurve:'P-256'},false,['deriveBits'])}
  async function deriveSharedSecret(privatePkcs8,peerJwk){
    const priv=await importPrivate(privatePkcs8),pub=await importPublic(peerJwk);
    return new Uint8Array(await subtle().deriveBits({name:'ECDH',public:pub},priv,256));
  }
  async function deriveMessageKey(secret,localJwk,peerJwk){
    const sorted=[JSON.stringify(localJwk),JSON.stringify(peerJwk)].sort().join('|');
    const salt=await subtle().digest('SHA-256',enc.encode(sorted));
    const material=await subtle().importKey('raw',secret,'HKDF',false,['deriveKey']);
    return subtle().deriveKey({name:'HKDF',hash:'SHA-256',salt,info:enc.encode('Morse Signal Studio ECDH P-256 message key v1')},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  async function safetyFingerprint(secret){
    const hash=new Uint8Array(await subtle().digest('SHA-256',secret));
    const digits=String((((hash[0]<<16)|(hash[1]<<8)|hash[2])>>>0)%1000000).padStart(6,'0');
    const symbols=['🦊','🌙','🦉','🐬','🪐','🌿','🦋','🧭','🐳','⭐','🍀','🦜','🌻','🛡️','🧩','🔥'];
    return {code:digits,emojis:Array.from(hash.slice(3,7),b=>symbols[b%symbols.length]).join(' ')};
  }
  const buckets=[256,512,1024,2048,4096,8192,16384];
  async function encryptMessage(key,text,options={}){
    const expiresAt=options.expiresAt==null?null:Number(options.expiresAt);
    if(expiresAt!==null&&(!Number.isFinite(expiresAt)||expiresAt<=Date.now()))throw new Error('Expiry must be a future timestamp.');
    const payload={v:1,text:String(text),expiresAt,viewOnce:!!options.viewOnce,createdAt:Date.now()};
    let raw=JSON.stringify(payload),bucket=buckets.find(n=>n>=enc.encode(raw).length+16)||Math.ceil((enc.encode(raw).length+16)/4096)*4096;
    payload.padding=' '.repeat(Math.max(0,bucket-enc.encode(raw).length));
    const iv=root.crypto.getRandomValues(new Uint8Array(12));
    const data=await subtle().encrypt({name:'AES-GCM',iv,additionalData:enc.encode('morse-secure-message-v1')},key,jsonBytes(payload));
    return {v:1,alg:'ECDH-P256/HKDF-SHA256/AES-256-GCM',iv:b64(iv),data:b64(data),bucket};
  }
  async function decryptMessage(key,envelope){
    if(!envelope||envelope.v!==1||envelope.alg!=='ECDH-P256/HKDF-SHA256/AES-256-GCM')throw new Error('Unsupported encrypted message.');
    const plain=await subtle().decrypt({name:'AES-GCM',iv:unb64(envelope.iv),additionalData:enc.encode('morse-secure-message-v1')},key,unb64(envelope.data));
    const payload=JSON.parse(dec.decode(plain));
    if(payload.expiresAt!==null&&payload.expiresAt<=Date.now())throw new Error('This message has expired.');
    return {text:payload.text,expiresAt:payload.expiresAt,viewOnce:payload.viewOnce,createdAt:payload.createdAt};
  }
  const api={derivePinKey,sealVault,openVault,generateEcdhPair,deriveSharedSecret,deriveMessageKey,safetyFingerprint,encryptMessage,decryptMessage,b64,unb64};
  root.MorseCrypto=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
