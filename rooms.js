'use strict';
(function(){
  const encoder=new TextEncoder(),decoder=new TextDecoder();
  let root=null,client=null,user=null,channel=null,currentRoom=null,currentKey=null,typingTimer=null,typingActive=false;
  const $=s=>root?.querySelector(s);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const say=s=>{const n=$('#rooms-notice');if(n)n.textContent=s;};
  const bytesToUrl=b=>{let raw='';new Uint8Array(b).forEach(x=>raw+=String.fromCharCode(x));return btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
  const urlToBytes=s=>{const clean=String(s||'').replace(/-/g,'+').replace(/_/g,'/');const raw=atob(clean+'='.repeat((4-clean.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0))};
  async function shaHex(bytes){const h=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));return [...h].map(x=>x.toString(16).padStart(2,'0')).join('')}
  async function configure(){
    if(client){const {data,error}=await client.auth.getSession();if(error)throw error;if(!data.session){const x=await client.auth.signInAnonymously();if(x.error)throw x.error;user=x.data.user;}else user=data.session.user;return;}
    const response=await fetch('/api/supabase-config',{cache:'no-store'});
    if(!response.ok)throw new Error('Supabase is not configured. Add the room environment variables in Vercel first.');
    const cfg=await response.json();
    if(!window.supabase?.createClient)throw new Error('Supabase client library did not load. Check your connection and reload.');
    client=window.supabase.createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false},realtime:{params:{eventsPerSecond:10}}});
    const {data,error}=await client.auth.getSession();if(error)throw error;
    if(data.session)user=data.session.user;
    else{const x=await client.auth.signInAnonymously();if(x.error)throw x.error;user=x.data.user;}
  }
  function pageShell(){
    root.innerHTML='<section class="page-hero"><span class="eyebrow">PRIVATE, REAL-TIME MESSAGING</span><h1>Secret Rooms.</h1><p>Encrypted on your device. Supabase relays ciphertext and temporary presence—not message text or room keys.</p></section><section class="rooms-shell"><div id="rooms-config" class="notice" role="status" aria-live="polite">Connecting securely…</div><div id="rooms-unlock" class="panel" hidden><h2>Unlock your local contact vault</h2><p class="muted">Room invitations are wrapped to an existing verified ECDH contact. Unlock the vault that contains that contact.</p><label for="rooms-pin">Vault PIN</label><input id="rooms-pin" type="password" autocomplete="current-password" minlength="6"><button class="button button-primary" id="rooms-unlock-btn">Unlock vault</button><p class="helper-text" id="rooms-unlock-error"></p></div><div id="rooms-content"></div></section>';
  }
  function unlockPanel(){
    $('#rooms-unlock').hidden=false;
    $('#rooms-unlock-btn').onclick=async()=>{try{await window.MorseContacts.unlock($('#rooms-pin').value);$('#rooms-unlock').hidden=true;await continueAfterUnlock()}catch(e){$('#rooms-unlock-error').textContent=e.message}};
  }
  async function continueAfterUnlock(){
    const params=new URLSearchParams(location.hash.slice(1));
    if(params.get('room')&&params.get('i')&&params.get('w')&&params.get('c')){await acceptInvite(params);return;}
    renderHome();
  }
  function renderHome(){
    const contacts=window.MorseContacts.listForRooms();
    const saved=window.MorseContacts.listRooms();
    $('#rooms-content').innerHTML='<div class="panel rooms-create"><div class="panel-heading"><h2>Create an encrypted room</h2><span class="badge">ECDH + AES-256-GCM</span></div><p class="muted">Select one or more verified contacts. Each person receives a different ECDH-wrapped copy of the same room key. Share each invite privately.</p><div class="field"><label for="rooms-members">Verified contacts</label><select id="rooms-members" multiple size="4">'+contacts.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join('')+'</select><p class="helper-text">You need at least one verified contact. Add contacts first on the Contacts page.</p></div><div class="field"><label for="rooms-expiry">Room expiry</label><select id="rooms-expiry"><option value="0">No automatic expiry</option><option value="3600000">1 hour</option><option value="86400000" selected>24 hours</option><option value="604800000">7 days</option></select></div><button class="button button-primary" id="rooms-create-btn" '+(contacts.length?'':'disabled')+'>Create room and generate invites</button><div id="rooms-invites" class="rooms-invites"></div></div><div class="panel spaced-panel"><div class="panel-heading"><h2>Your rooms</h2><span class="tiny">Encrypted local vault</span></div><div class="history-list" id="rooms-list">'+(saved.length?saved.map(r=>'<div class="history-item"><div><b>'+esc(r.name||'Secret room')+'</b><div class="tiny">'+esc(r.id)+' · '+(r.expiresAt?'Expires '+new Date(r.expiresAt).toLocaleString():'No expiry')+'</div></div><button class="mini-button" data-open-room="'+esc(r.id)+'">Open</button><button class="mini-button button-danger" data-remove-room="'+esc(r.id)+'">Forget locally</button></div>').join(''):'<p class="muted">No rooms saved on this device yet.</p>')+'</div></div><p class="helper-text">No account is required. Anonymous Auth creates a device-scoped identity for room authorization; clearing browser data can permanently lose that identity and local room keys.</p>';
    $('#rooms-create-btn')?.addEventListener('click',createRoom);
    $('#rooms-list')?.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.openRoom){const r=window.MorseContacts.getRoom(b.dataset.openRoom);if(r)await openRoom(r.id,MorseCrypto.unb64(r.key));}if(b.dataset.removeRoom){if(confirm('Forget this room key from this device? This cannot delete other participants’ copies.')){await window.MorseContacts.removeRoom(b.dataset.removeRoom);renderHome();}}});
  }
  async function createRoom(){
    const btn=$('#rooms-create-btn');btn.disabled=true;say('Creating room…');
    try{
      const contacts=window.MorseContacts.listForRooms(),ids=[...$('#rooms-members').selectedOptions].map(o=>o.value),chosen=contacts.filter(c=>ids.includes(c.id));
      if(!chosen.length)throw new Error('Select at least one verified contact.');
      if(chosen.length>7)throw new Error('A room can contain at most 8 people, including you.');
      const token=crypto.getRandomValues(new Uint8Array(32)),roomKey=crypto.getRandomValues(new Uint8Array(32));
      const hours=Number($('#rooms-expiry').value),expiresAt=hours?new Date(Date.now()+hours).toISOString():null;
      const {data,error}=await client.from('signal_rooms').insert({created_by:user.id,invite_hash:await shaHex(token),max_members:chosen.length+1,expires_at:expiresAt}).select('id').single();
      if(error)throw error;
      const room={id:data.id,name:'Secret room',key:MorseCrypto.b64(roomKey),inviteToken:bytesToUrl(token),createdAt:Date.now(),expiresAt,maxMembers:chosen.length+1};
      await window.MorseContacts.saveRoom(room);
      const inviteLinks=[];
      for(const contact of chosen){
        const secret=await MorseCrypto.deriveSharedSecret(contact.localPrivate,contact.peerPublic);
        const wrapKey=await MorseCrypto.deriveRoomWrapKey(secret,data.id);
        const wrapped=await MorseCrypto.wrapRoomKey(wrapKey,roomKey,data.id);
        const invite=new URL('/rooms',location.origin);
        invite.hash=new URLSearchParams({room:data.id,i:bytesToUrl(token),c:contact.id,w:bytesToUrl(encoder.encode(JSON.stringify(wrapped)))}).toString();
        inviteLinks.push({name:contact.name,url:invite.href});
      }
      renderHome();
      await openRoom(data.id,roomKey);
      const invitePanel=document.createElement('div');invitePanel.className='panel rooms-invites';
      invitePanel.innerHTML='<h3>Private invitations</h3><p class="helper-text">Send each link only to its named contact. The wrapped room key and invite token are in the URL fragment and are not sent in the HTTP request.</p>'+inviteLinks.map((x,i)=>'<div class="field"><label>'+esc(x.name)+' · invite link</label><textarea class="text-area" readonly data-invite="'+i+'">'+esc(x.url)+'</textarea><button class="mini-button" data-copy-invite="'+i+'">Copy invite</button><button class="mini-button" data-qr-invite="'+i+'">Show QR</button><div id="invite-qr-'+i+'"></div></div>').join('');
      invitePanel.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.copyInvite!==undefined){const t=invitePanel.querySelector('[data-invite="'+b.dataset.copyInvite+'"]');try{if(!navigator.clipboard)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(t.value);say('Invite copied. Send it privately.');}catch{say('Clipboard unavailable; select and copy the link.');}}if(b.dataset.qrInvite!==undefined){const i=b.dataset.qrInvite,t=invitePanel.querySelector('[data-invite="'+i+'"]');const target=invitePanel.querySelector('#invite-qr-'+i);target.innerHTML='';try{new QRCode(target,{text:t.value,width:220,height:220,correctLevel:QRCode.CorrectLevel.L});}catch{target.textContent='This invite is too large for a QR code. Copy the link instead.';}}});
      $('#rooms-content').prepend(invitePanel);
    }catch(e){say(e.message||'Could not create the room.');}
    finally{if($('#rooms-create-btn'))$('#rooms-create-btn').disabled=false;}
  }
  async function acceptInvite(params){
    say('Checking invitation…');
    try{
      const roomId=params.get('room'),contactId=params.get('c');
      if(!/^[0-9a-f-]{36}$/i.test(roomId))throw new Error('Invalid room invitation.');
      const contact=window.MorseContacts.listForRooms().find(c=>c.id===contactId);
      if(!contact)throw new Error('This invitation is tied to a verified contact that is not in this local vault. Open Contacts and exchange/verify keys with the inviter first.');
      const token=urlToBytes(params.get('i')),wrapped=JSON.parse(decoder.decode(urlToBytes(params.get('w'))));
      if(token.length!==32)throw new Error('Invalid invite token.');
      const secret=await MorseCrypto.deriveSharedSecret(contact.localPrivate,contact.peerPublic);
      const wrapKey=await MorseCrypto.deriveRoomWrapKey(secret,roomId);
      const roomKey=await MorseCrypto.unwrapRoomKey(wrapKey,wrapped,roomId);
      const {data,error}=await client.rpc('join_signal_room',{p_room_id:roomId,p_invite_hash:await shaHex(token)});
      if(error)throw error;if(data!==true)throw new Error('Invitation expired, room closed, or room is full.');
      const {data:meta,error:metaError}=await client.from('signal_rooms').select('id,created_by,max_members,expires_at,created_at').eq('id',roomId).single();
      if(metaError)throw metaError;
      await window.MorseContacts.saveRoom({id:roomId,name:'Secret room',key:MorseCrypto.b64(roomKey),inviteToken:params.get('i'),createdAt:Date.now(),expiresAt:meta.expires_at,maxMembers:meta.max_members});
      history.replaceState(null,'',location.pathname+location.search);
      say('Joined securely. Only encrypted envelopes are stored on the server.');
      await openRoom(roomId,roomKey,meta);
    }catch(e){say(e.message||'Could not join this room.');}
  }

  async function generateAdditionalInvite(roomId,contactId){
    const room=window.MorseContacts.getRoom(roomId),contact=window.MorseContacts.listForRooms().find(c=>c.id===contactId);
    if(!room||!room.inviteToken)throw new Error('This local room does not have a saved invitation token. Rejoin using a current invite link.');
    if(!contact)throw new Error('Choose a verified contact.');
    const secret=await MorseCrypto.deriveSharedSecret(contact.localPrivate,contact.peerPublic);
    const wrapKey=await MorseCrypto.deriveRoomWrapKey(secret,roomId);
    const wrapped=await MorseCrypto.wrapRoomKey(wrapKey,MorseCrypto.unb64(room.key),roomId);
    const url=new URL('/rooms',location.origin);
    url.hash=new URLSearchParams({room:roomId,i:room.inviteToken,c:contact.id,w:bytesToUrl(encoder.encode(JSON.stringify(wrapped)))}).toString();
    return url.href;
  }

  const morseMap={A:'.-',B:'-...',C:'-.-.',D:'-..',E:'.',F:'..-.',G:'--.',H:'....',I:'..',J:'.---',K:'-.-',L:'.-..',M:'--',N:'-.',O:'---',P:'.--.',Q:'--.-',R:'.-.',S:'...',T:'-',U:'..-',V:'...-',W:'.--',X:'-..-',Y:'-.--',Z:'--..','0':'-----','1':'.----','2':'..---','3':'...--','4':'....-','5':'.....','6':'-....','7':'--...','8':'---..','9':'----.'};
  const emojiMap=['🐜','🐻','🐱','🐬','🥚','🦊','🦒','🏠','🍦','🪼','🪁','🦁','🌙','🥜','🐙','🐼','👑','🌈','⭐','🌴','☂️','🎻','🐺','❌','🛥️','🦓'];
  function disguiseText(text,mode){
    if(mode==='morse')return [...text.toUpperCase()].map(c=>c===' '?' / ':morseMap[c]||c).join(' ').replace(/\s+\/\s+/g,' / ');
    if(mode==='emoji')return [...text.toUpperCase()].map(c=>c===' '?'　':emojiMap[c.charCodeAt(0)-65]||c).join(' ');
    if(mode==='sentence')return MorseCiphers.transform('nato',text);
    return text;
  }
  function appendMessage(row){
    const list=$('#room-messages');if(!list||list.querySelector('[data-message-id="'+row.id+'"]'))return;
    const item=document.createElement('article');item.className='room-message';item.dataset.messageId=row.id;
    const head=document.createElement('div');head.className='room-message-head';
    const who=document.createElement('b');who.textContent=row.sender_id===user.id?'You':'Member';
    const when=document.createElement('time');when.textContent=new Date(row.created_at).toLocaleTimeString();
    head.append(who,when);
    const body=document.createElement('p');body.className='room-message-body';
    const reveal=document.createElement('button');reveal.type='button';reveal.className='mini-button room-reveal';reveal.textContent='Reveal';
    let plain='';
    MorseCrypto.decryptRoomMessage(currentKey,currentRoom.id,{nonce:row.nonce_b64,ciphertext:row.ciphertext_b64}).then(payload=>{
      plain=payload.text;body.textContent=disguiseText(payload.text,payload.disguise);
      reveal.onclick=()=>{body.textContent=body.dataset.revealed==='true'?disguiseText(plain,payload.disguise):plain;body.dataset.revealed=body.dataset.revealed==='true'?'false':'true';reveal.textContent=body.dataset.revealed==='true'?'Show disguise':'Reveal';};
    }).catch(()=>{body.textContent='Unable to authenticate this message. It may be corrupted or belong to another room key.';reveal.hidden=true;});
    item.append(head,body,reveal);list.append(item);list.scrollTop=list.scrollHeight;
  }
  async function openRoom(id,key,knownMeta){
    if(channel){await client.removeChannel(channel);channel=null;}if(currentKey instanceof Uint8Array)currentKey.fill(0);
    const {data:meta,error}=knownMeta?{data:knownMeta,error:null}:await client.from('signal_rooms').select('id,created_by,max_members,expires_at,created_at').eq('id',id).single();
    if(error)throw error;
    if(meta.expires_at&&new Date(meta.expires_at).getTime()<=Date.now())throw new Error('This room has expired.');
    currentRoom={id,expiresAt:meta.expires_at};currentKey=key;
    $('#rooms-content').innerHTML='<div class="panel room-live"><div class="panel-heading"><div><h2>Secret Room</h2><p class="tiny">'+esc(id)+'</p></div><div><span class="badge" id="room-online">Connecting…</span><button class="mini-button" id="room-back">Back</button></div></div><p class="helper-text">End-to-end encrypted · server stores ciphertext envelopes only. Online and typing indicators are temporary Realtime events.</p><div id="room-messages" class="room-messages" aria-live="polite"></div><div id="room-typing" class="room-typing" aria-live="polite"></div><div class="field"><label for="room-draft">Message</label><textarea id="room-draft" class="text-area" rows="3" maxlength="6000" placeholder="Write a private message…"></textarea></div><div class="rooms-compose"><label for="room-disguise">Display disguise</label><select id="room-disguise"><option value="normal">Normal text</option><option value="emoji">Emoji code</option><option value="sentence">NATO words / sentence</option><option value="morse">Morse code</option></select><button class="button button-primary" id="room-send">Send encrypted</button></div><p class="helper-text" id="room-status"></p></div>';
    $('#room-back').onclick=async()=>{await leaveRoom();renderHome();};
    const {data:historyRows,error:historyError}=await client.from('signal_room_messages').select('id,room_id,sender_id,nonce_b64,ciphertext_b64,created_at').eq('room_id',id).order('created_at',{ascending:true}).limit(100);
    if(historyError)throw historyError;(historyRows||[]).forEach(appendMessage);
    await client.realtime.setAuth();
    channel=client.channel('room:'+id,{config:{private:true,presence:{key:user.id}}})
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'signal_room_messages',filter:'room_id=eq.'+id},payload=>appendMessage(payload.new))
      .on('presence',{event:'sync'},()=>{const count=Object.keys(channel.presenceState()).length;$('#room-online').textContent=count+' online';})
      .on('broadcast',{event:'typing'},()=>{const el=$('#room-typing');if(el){el.textContent='Someone is typing…';clearTimeout(typingTimer);typingTimer=setTimeout(()=>{if(el)el.textContent='';},1300);}})
      .subscribe(async status=>{const el=$('#room-online');if(!el)return;if(status==='SUBSCRIBED'){el.textContent='Connected';await channel.track({online:true});}else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){el.textContent='Reconnecting…';}else if(status==='CLOSED'){el.textContent='Offline';}});
    $('#room-draft').addEventListener('input',()=>{if(!channel||typingActive)return;typingActive=true;channel.send({type:'broadcast',event:'typing',payload:{typing:true}}).catch(()=>{});setTimeout(()=>typingActive=false,900);});
    $('#room-send').onclick=sendMessage;
    $('#room-draft').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}});
    const verified=window.MorseContacts.listForRooms();
    const inviteTools=document.createElement('div');inviteTools.className='panel spaced-panel';
    inviteTools.innerHTML='<h3>Invite another member</h3><p class="helper-text">Each member needs a verified ECDH contact with you. The room has a maximum capacity of '+Number(meta.max_members||2)+' participants; the server enforces this limit.</p><div class="rooms-compose"><label for="room-add-contact">Verified contact</label><select id="room-add-contact">'+verified.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join('')+'</select><button class="mini-button" id="room-add-invite">Generate invite</button></div><div id="room-add-invite-result"></div>';
    $('#rooms-content').append(inviteTools);
    $('#room-add-invite')?.addEventListener('click',async()=>{const out=$('#room-add-invite-result');try{const url=await generateAdditionalInvite(id,$('#room-add-contact').value);out.innerHTML='<div class="field"><label>Private invite link</label><textarea class="text-area" readonly id="room-add-invite-url">'+esc(url)+'</textarea><button class="mini-button" id="room-add-copy">Copy invite</button><button class="mini-button" id="room-add-qr">Show QR</button><div id="room-add-qr-view"></div></div>';$('#room-add-copy').onclick=async()=>{try{if(!navigator.clipboard)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(url);say('Invite copied.');}catch{say('Clipboard unavailable; copy the link manually.');}};$('#room-add-qr').onclick=()=>{const target=$('#room-add-qr-view');target.innerHTML='';try{new QRCode(target,{text:url,width:220,height:220,correctLevel:QRCode.CorrectLevel.L});}catch{target.textContent='Invite too large for QR; copy the link.';}};}catch(e){say(e.message);}});
  }
  async function sendMessage(){
    const input=$('#room-draft'),button=$('#room-send'),status=$('#room-status'),text=input.value.trim();
    if(!text)return;if(encoder.encode(text).length>20000){status.textContent='Message is too large. Keep it under 20 KB of UTF-8 text.';return;}if(!navigator.onLine){status.textContent='You are offline. Room messages require an internet connection.';return;}
    button.disabled=true;status.textContent='Encrypting on this device…';
    try{
      const encrypted=await MorseCrypto.encryptRoomMessage(currentKey,currentRoom.id,text,$('#room-disguise').value);
      const {error}=await client.from('signal_room_messages').insert({room_id:currentRoom.id,sender_id:user.id,algorithm:'ECDH-P256/HKDF-SHA256/AES-256-GCM',nonce_b64:encrypted.nonce,ciphertext_b64:encrypted.ciphertext,key_version:1,expires_at:currentRoom.expiresAt});
      if(error)throw error;input.value='';status.textContent='Encrypted envelope sent.';typingActive=false;
    }catch(e){status.textContent=e.message||'Message could not be sent.';}
    finally{button.disabled=false;}
  }
  async function leaveRoom(){const active=channel;channel=null;if(currentKey instanceof Uint8Array)currentKey.fill(0);currentKey=null;currentRoom=null;typingActive=false;clearTimeout(typingTimer);if(active&&client){try{await client.removeChannel(active);}catch{}}}
  window.MorseRooms={leave:()=>{leaveRoom().catch(()=>{});}};
  window.addEventListener('pagehide',()=>{leaveRoom().catch(()=>{});});
  window.initMorseRooms=async function(el){
    root=el;pageShell();
    try{await configure();$('#rooms-config').textContent='Connected with an anonymous, device-scoped identity.';if(!window.MorseContacts?.isUnlocked()){unlockPanel();return;}await continueAfterUnlock();}
    catch(e){$('#rooms-config').textContent=e.message||'Could not initialize Secret Rooms.';}
  };
})();
