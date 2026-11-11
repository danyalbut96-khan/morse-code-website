'use strict';
(function(root){
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ',NATO=['Alfa','Bravo','Charlie','Delta','Echo','Foxtrot','Golf','Hotel','India','Juliett','Kilo','Lima','Mike','November','Oscar','Papa','Quebec','Romeo','Sierra','Tango','Uniform','Victor','Whiskey','X-ray','Yankee','Zulu'];
 const BRAILLE=['⠁','⠃','⠉','⠙','⠑','⠋','⠛','⠓','⠊','⠚','⠅','⠇','⠍','⠝','⠕','⠏','⠟','⠗','⠎','⠞','⠥','⠧','⠺','⠭','⠽','⠵'],TAP='ABCDEFGHIKLMNOPQRSTUVWXYZ',arrows=['↖','↑','↗','→','↘','↓','↙','←'];
 const semaphore=Array.from({length:26},(_,i)=>arrows[Math.floor(i/8)]+arrows[i%8]);
 const pigpen=['┌','┬','┐','├','┼','┤','└','┴','┘','┌•','┬•','┐•','├•','┼•','┤•','└•','┴•','┘•','△','▽','◁','▷','△•','▽•','◁•','▷•'];
 const bacon=Object.fromEntries([...alphabet].map((c,i)=>[c,i.toString(2).padStart(5,'0').replace(/0/g,'A').replace(/1/g,'B')]));
 const railEncode=(s,n)=>{if(n<2||n>=s.length)return s;const rows=Array.from({length:n},()=>[]);let r=0,d=1;for(const c of s){rows[r].push(c);if(r===0)d=1;else if(r===n-1)d=-1;r+=d}return rows.map(x=>x.join('')).join('')};
 const railDecode=(s,n)=>{if(n<2||n>=s.length)return s;const marks=Array.from({length:n},()=>[]);let r=0,d=1;for(let i=0;i<s.length;i++){marks[r].push(i);if(r===0)d=1;else if(r===n-1)d=-1;r+=d}const out=Array(s.length);let k=0;for(const row of marks)for(const i of row)out[i]=s[k++];return out.join('')};
 const shift=(s,n)=>[...s].map(c=>{const u=c.toUpperCase(),i=alphabet.indexOf(u);if(i<0)return c;const v=alphabet[(i+n+26)%26];return c===u?v:v.toLowerCase()}).join('');
 const encodeBytes=(s,mode)=>{const bytes=new TextEncoder().encode(s);if(mode==='binary')return [...bytes].map(b=>b.toString(2).padStart(8,'0')).join(' ');if(mode==='hex')return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join(' ');let binary='';bytes.forEach(b=>binary+=String.fromCharCode(b));return btoa(binary)};
 const decodeBytes=(s,mode)=>{let bytes;if(mode==='binary'){const a=s.trim().split(/\s+/);if(!a.length||a.some(x=>!/^[01]{8}$/.test(x)))throw Error('Binary must contain 8-bit groups separated by spaces.');bytes=Uint8Array.from(a,x=>parseInt(x,2))}else if(mode==='hex'){const clean=s.replace(/\s+/g,'');if(clean.length%2||!/^[0-9a-f]*$/i.test(clean))throw Error('Hex input must contain complete byte pairs.');bytes=Uint8Array.from(clean.match(/.{2}/g)||[],x=>parseInt(x,16))}else{try{const raw=atob(s.replace(/\s/g,''));bytes=Uint8Array.from(raw,c=>c.charCodeAt(0))}catch{throw Error('Invalid Base64 input.')}}return new TextDecoder('utf-8',{fatal:true}).decode(bytes)};
 const tapEncode=s=>[...s.toUpperCase()].map(c=>{if(c===' ')return '/';const i=TAP.indexOf(c);return i<0?c:(Math.floor(i/5)+1)+'.'+(i%5+1)}).join(' ');
 const tapDecode=s=>s.trim().split(/\s+/).map(t=>{if(t==='/')return ' ';const m=t.match(/^([1-5])[.,]([1-5])$/);return m?(TAP[(+m[1]-1)*5+(+m[2]-1)]||'?'):t}).join('');
 const tokenMap=a=>Object.fromEntries(a.map((v,i)=>[alphabet[i],v])),reverseMap=a=>Object.fromEntries(a.map((v,i)=>[v,alphabet[i]]));
 const brailleMap=tokenMap(BRAILLE),pigpenMap=tokenMap(pigpen),semaphoreMap=tokenMap(semaphore),pigpenReverse=reverseMap(pigpen),brailleReverse=reverseMap(BRAILLE),semaphoreReverse=reverseMap(semaphore);
 const meta={
 caesar:{name:'Caesar',class:'classic / not secure',description:'A fixed alphabet shift. Every letter moves by the same number of positions.',history:'Named after Julius Caesar, who is reported to have used substitution shifts for military correspondence.',crack:'Try all 25 non-zero shifts (brute force), or use letter-frequency analysis.'},
 atbash:{name:'Atbash',class:'classic / not secure',description:'The alphabet is reversed: A becomes Z, B becomes Y, and so on.',history:'An ancient Hebrew substitution system that mirrors the alphabet.',crack:'There is no key to search. Apply Atbash again; it is its own inverse.'},
 vigenere:{name:'Vigenère',class:'classic / not secure',description:'A repeating keyword applies a different Caesar shift to each letter.',history:'Popularized in Europe in the 16th century; it was once called le chiffre indéchiffrable.',crack:'Estimate key length with repeated-pattern or index-of-coincidence analysis, then solve each column with frequency analysis.'},
 railfence:{name:'Rail Fence',class:'classic / not secure',description:'Letters are written diagonally across rails and read row by row.',history:'A transposition cipher associated with simple field and puzzle cryptography.',crack:'Try likely rail counts and inspect whether the result forms readable language.'},
 pigpen:{name:'Pigpen',class:'classic / not secure',description:'Letters are replaced by fragments of grid and X shapes; dots distinguish the second set.',history:'A substitution alphabet used in historical puzzle writing and by Freemasons.',crack:'Recognize grid fragments, then use word patterns and frequency analysis.'},
 tap:{name:'Tap Code',class:'classic / not secure',description:'Each letter is represented by a row and column in a 5×5 square; I and J share a cell.',history:'A practical tapping alphabet documented in prisoner communication and field use.',crack:'Look for row/column pairs from 1 to 5 and decode using the shared I/J square.'},
 braille:{name:'Braille',class:'classic / not secure',description:'Letters are represented by six-dot tactile cells, shown here with Unicode Braille patterns.',history:'Created by Louis Braille in the 19th century as a tactile reading and writing system.',crack:'Map each six-dot cell to the Braille alphabet. This is encoding, not encryption.'},
 nato:{name:'NATO phonetic',class:'classic / not secure',description:'Words such as Alfa, Bravo and Charlie make letters clearer over noisy radio links.',history:'The ICAO spelling alphabet was standardized for international aviation and adopted by NATO.',crack:'Split the words and map each code word back to its letter. It is a spelling alphabet, not a secret code.'},
 binary:{name:'Binary',class:'classic / not secure',description:'UTF-8 bytes are written as eight binary digits each.',history:'A base-2 representation used by digital computers and communication systems.',crack:'Group into eight bits, convert each byte to a number, then decode as UTF-8.'},
 hex:{name:'Hexadecimal',class:'classic / not secure',description:'UTF-8 bytes are written as pairs of base-16 digits.',history:'Base 16 is widely used to represent bytes, memory addresses and binary data compactly.',crack:'Split into byte pairs, convert each pair to a byte, then decode as UTF-8.'},
 base64:{name:'Base64',class:'classic / not secure',description:'Binary data is represented using 64 printable ASCII characters.',history:'Designed for transporting binary data through text-only systems, including email formats.',crack:'Decode the Base64 representation. It provides no secrecy or integrity.'},
 semaphore:{name:'Semaphore',class:'classic / not secure',description:'A visual flag alphabet uses two arm positions. This studio shows a compact directional glyph mnemonic for learning.',history:'Flag semaphore was used for long-distance visual signaling before radio communication.',crack:'Identify each pair of arm directions and consult a flag alphabet. These glyph pairs are a learning mnemonic, not an operational maritime chart.'},
 baconian:{name:'Baconian',class:'classic / not secure',description:'Each letter becomes a five-symbol A/B group, often hidden in two visual styles.',history:'Francis Bacon described this biliteral cipher in the early 17th century.',crack:'Normalize the two symbol classes to A and B, split into groups of five, and map each group to a letter.'}
 };
 function transform(name,input,options={}){
 const s=String(input??''),decode=!!options.decode,key=String(options.key||'').toUpperCase().replace(/[^A-Z]/g,'');
 switch(name){
 case 'caesar':{const n=((Number(options.shift)||0)%26+26)%26;return shift(s,decode?-n:n)}
 case 'atbash':return shift(s,25);
 case 'vigenere':{if(!key)throw Error('Enter an A–Z keyword for Vigenère.');let j=0;return [...s].map(c=>{const i=alphabet.indexOf(c.toUpperCase());if(i<0)return c;const n=key.charCodeAt(j++%key.length)-65;return shift(c,decode?-n:n)}).join('')}
 case 'railfence':{const n=Math.max(2,Math.min(20,Math.floor(Number(options.rails)||3)));return decode?railDecode(s,n):railEncode(s,n)}
 case 'pigpen':return decode?s.trim().split(/\s+/).map(t=>t==='/'?' ':pigpenReverse[t]||t).join(''):[...s.toUpperCase()].map(c=>c===' '?' / ':pigpenMap[c]||c).join(' ');
 case 'tap':return decode?tapDecode(s):tapEncode(s);
 case 'braille':return decode?[...s].map(c=>brailleReverse[c]||c).join(''):[...s.toUpperCase()].map(c=>c===' '?'　':brailleMap[c]||c).join('');
 case 'nato':return decode?s.trim().split(/\s+/).map(w=>{if(w==='/')return ' ';const i=NATO.findIndex(x=>x.toLowerCase()===w.toLowerCase());return i<0?w:alphabet[i]}).join(''):[...s.toUpperCase()].map(c=>c===' '?' / ':NATO[alphabet.indexOf(c)]||c).join(' ');
 case 'binary':case 'hex':case 'base64':return decode?decodeBytes(s,name):encodeBytes(s,name);
 case 'semaphore':return decode?s.trim().split(/\s+/).map(t=>t==='/'?' ':semaphoreReverse[t]||t).join(''):[...s.toUpperCase()].map(c=>c===' '?' / ':semaphoreMap[c]||c).join(' ');
 case 'baconian':return decode?s.toUpperCase().replace(/[^AB]/g,'').match(/.{1,5}/g)?.map(t=>alphabet[parseInt(t.replace(/A/g,'0').replace(/B/g,'1'),2)]||'?').join('')||'':[...s.toUpperCase()].map(c=>c===' '?' / ':bacon[c]||c).join(' ');
 default:throw Error('Unknown cipher: '+name);
 }}
 function detect(input){const s=String(input||'').trim();if(!s)return [];const hits=[],add=(id,confidence,reason)=>hits.push({id,name:meta[id].name,confidence,reason});
 if(/^[01\s]+$/.test(s)&&s.replace(/\s/g,'').length%8===0)add('binary',.94,'Only binary digits, grouped into complete bytes.');
 if(/^(?:[0-9a-f]{2}\s*)+$/i.test(s)&&/[a-f]/i.test(s))add('hex',.88,'Looks like hexadecimal byte pairs.');
 if(/^[A-Za-z0-9+/]+={0,2}$/.test(s)&&s.length%4===0&&/[+/=]/.test(s))add('base64',.86,'Matches the Base64 character set and padding.');
 if(/^(?:[1-5][.,][1-5]\s*)+$/i.test(s))add('tap',.98,'Contains row/column pairs from the Tap Code square.');
 if(/^[⠁-⣿\s　]+$/.test(s))add('braille',.99,'Contains Unicode Braille cells.');
 if(/^(?:[↖↑↗→↘↓↙←]{2}\s*)+$/u.test(s))add('semaphore',.98,'Contains directional semaphore-style pairs.');
 if(/^(?:[AB]{5}\s*)+$/i.test(s))add('baconian',.75,'Contains five-symbol A/B groups.');
 if(/^(?:[.-]{1,8}(?:\s|\/)+)+$/.test(s))hits.push({id:'morse',name:'Morse',confidence:.96,reason:'Dot/dash groups resemble Morse code.'});
 if(!hits.length&&/^[A-Za-z\s]+$/.test(s)){add('caesar',.25,'Plain alphabetic text could be a substitution cipher.');add('atbash',.2,'Atbash is possible, but text shape alone cannot confirm it.');add('vigenere',.15,'Vigenère cannot be confirmed without statistical analysis or a key.')}
 return hits.sort((a,b)=>b.confidence-a.confidence)}
 root.MorseCiphers={meta,transform,detect,NATO,BRAILLE,TAP};if(typeof module!=='undefined'&&module.exports)module.exports=root.MorseCiphers;
})(typeof globalThis!=='undefined'?globalThis:this);