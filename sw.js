'use strict';
/* Offline-first PWA shell. App data remains in browser storage; no message sync is performed. */
const CACHE='morse-studio-v7';
const REQUIRED=['/','/index.html','/style.css','/app.js','/extras.js','/qrcode.min.js','/crypto-core.js','/contacts.js','/rooms.js','/i18n.js','/guide.js','/cipher-library.js','/manifest.webmanifest'];
const PAGES=['/encoder','/decoder','/alphabet','/cipher','/practice','/about','/contacts','/rooms','/privacy','/how-it-works','/share','/guide','/ciphers','/embed/','/embed/index.html'];
const ASSETS=['/embed/widget.js','/embed.js','/favicon.svg','/favicon.ico','/apple-touch-icon.png','/icon-192.png','/icon-512.png','/logo.svg','/pwa-192.svg','/pwa-512.svg','/cloudexify.svg','/og-image.svg'];
const sameOrigin=url=>url.origin===self.location.origin;
async function cacheResponse(cache,path,response){if(response&&response.ok&&response.type!=='opaque')await cache.put(path,response.clone())}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 // Core assets are mandatory: fail installation rather than claim offline support without them.
 const core=await Promise.all(REQUIRED.map(async path=>{
  const response=await fetch(new Request(path,{cache:'reload'}));
  if(!response.ok)throw new Error('Could not precache required app asset: '+path);
  await cache.put(path,response.clone());
 }));
 // Optional route aliases/assets must not block installation on hosting-specific redirects.
 await Promise.allSettled([...PAGES,...ASSETS].map(async path=>{
  const response=await fetch(new Request(path,{cache:'reload'}));
  await cacheResponse(cache,path,response);
 }));
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const keys=await caches.keys();
 await Promise.all(keys.filter(key=>key.startsWith('morse-studio-')&&key!==CACHE).map(key=>caches.delete(key)));
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(!sameOrigin(url))return;
 if(request.method==='POST'&&url.pathname==='/share'){
  event.respondWith((async()=>{
   try{
    const form=await request.formData();
    const draft={title:String(form.get('title')||''),text:String(form.get('text')||''),url:String(form.get('url')||'')};
    const cache=await caches.open(CACHE);
    await cache.put(new Request(new URL('/_share-draft',self.location.origin).href),new Response(JSON.stringify(draft),{headers:{'Content-Type':'application/json'}}));
    return Response.redirect(new URL('/share',self.location.origin).href,303);
   }catch(error){return new Response('Unable to open shared content. Please reopen the app and try again.',{status:400,headers:{'Content-Type':'text/plain; charset=utf-8'}})}
  })());
  return;
 }
 if(request.method!=='GET')return;
 if(request.mode==='navigate'){
  event.respondWith((async()=>{
   try{
    const fresh=await fetch(request);
    if(fresh.ok){const cache=await caches.open(CACHE);await cache.put(request,fresh.clone());}
    return fresh;
   }catch(error){
    const cache=await caches.open(CACHE);
    return await cache.match(request,{ignoreSearch:true})||
      await cache.match(url.pathname,{ignoreSearch:true})||
      await cache.match('/index.html')||
      await cache.match('/');
   }
  })());
  return;
 }
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE),cached=await cache.match(request,{ignoreSearch:true});
  const update=fetch(request).then(async response=>{await cacheResponse(cache,request,response);return response});
  if(cached){event.waitUntil(update.catch(()=>{}));return cached;}
  try{return await update;}catch(error){return new Response('',{status:503,statusText:'Offline asset unavailable'});}
 })());
});
