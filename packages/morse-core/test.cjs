const test=require('node:test');const assert=require('node:assert/strict');const core=require('./index.cjs');
test('encode basic message',()=>assert.equal(core.encode('SOS 123'),'... --- ... / .---- ..--- ...--'));
test('decode basic message',()=>assert.equal(core.decode('.... . .-.. .-.. --- / .-- --- .-. .-.. -..'),'HELLO WORLD'));
test('unknown symbols become empty on encode and question mark on decode',()=>assert.equal(core.decode('..--..'),'?'));
