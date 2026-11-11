'use strict';
const MORSE={A:'.-',B:'-...',C:'-.-.',D:'-..',E:'.',F:'..-.',G:'--.',H:'....',I:'..',J:'.---',K:'-.-',L:'.-..',M:'--',N:'-.',O:'---',P:'.--.',Q:'--.-',R:'.-.',S:'...',T:'-',U:'..-',V:'...-',W:'.--',X:'-..-',Y:'-.--',Z:'--..','0':'-----','1':'.----','2':'..---','3':'...--','4':'....-','5':'.....','6':'-....','7':'--...','8':'---..','9':'----.'};
const REVERSE=Object.fromEntries(Object.entries(MORSE).map(([k,v])=>[v,k]));
function encode(text){return [...String(text).toUpperCase()].map(c=>c===' '?' / ':(MORSE[c]||'')).filter(Boolean).join(' ').replace(/\s+\/\s+/g,' / ').trim()}
function decode(code){return String(code).trim().split(/\s*\/\s*/).map(w=>w.trim().split(/\s+/).filter(Boolean).map(c=>REVERSE[c]||'?').join('')).join(' ')}
module.exports={MORSE,encode,decode};
