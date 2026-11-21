import assert from 'node:assert/strict';
import { compareCards, readBook, readCard, readCardFile } from '../dist/character-card-core.js';
import { buildHighlightedDiff } from '../dist/body-highlight.js';
import { changeCard, changeComparedBody, exportBlob, transferItems, openInstalled, saveInstalled } from '../dist/character-card-draft.js';

const raw = { name: '月', description: '你好。', personality: '慢热', first_mes: '甲', alternate_greetings: ['乙', '乙'] };
const old = readCard(raw);
const next = readCard({ data: { ...raw, description: '你好！', first_mes: '新', alternate_greetings: ['甲', '乙', '乙'] } });
const changes = compareCards(old, next, 'persona');
assert.deepEqual(changes.map(item => item.status), ['changed','new','same','same','same']);
assert.equal(changes[0].left.title, '人设');
assert.equal(changes[1].right.title, '开场白 1');
assert.equal(compareCards(next, old, 'persona').at(-1).status, 'old');
assert.equal(compareCards(old, readCard({ ...raw, personality: raw.personality + ' ' }), 'persona')[0].status, 'changed');

const book = (...entries) => readBook({ entries });
const a = { id: 0, name: '山', content: '甲' };
const b = { id: 1, name: '海', content: '乙' };
const oldBook = { book: book(a, b) };
const newBook = { book: book({ ...b, name: '海边', content: '乙。' }, { ...a, name: '山上' }) };
assert.deepEqual(compareCards(oldBook, newBook, 'book').map(row => row.status), ['changed','renamed']);
assert.deepEqual(compareCards(oldBook, { book: book({ ...b, keys: ['海'] }) }, 'book').map(row => row.status), ['changed','old']);
assert.equal(readCard({ ...raw, extensions: { world: '同名书' } }).book, null);
assert.throws(() => compareCards(oldBook, { book: null }, 'book'), /选择/);

function metadata(key, data) {
  const body = Buffer.from(key + '\0' + Buffer.from(JSON.stringify(data)).toString('base64'));
  const chunk = Buffer.alloc(12 + body.length);
  chunk.writeUInt32BE(body.length);
  chunk.write('tEXt', 4);
  body.copy(chunk, 8);
  return chunk;
}
const artwork = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jh1sAAAAASUVORK5CYII=', 'base64');
const png = new File([artwork.subarray(0,-12), metadata('chara', raw), metadata('ccv3', { data: { ...raw, character_version: '3' } }), artwork.subarray(-12)], '月.png');
assert.equal((await readCardFile(png)).version, '3');
await assert.rejects(readCardFile(new File(['image'], 'copy.png')), /PNG/);
await assert.rejects(readCardFile(new File(['{"something":1}'], 'wrong.json')), /角色卡/);
assert.ok(buildHighlightedDiff('<b>', '<i>').leftHtml.includes('&lt;'));
console.log('Character cards: exact text, greeting insertion, worldbook pairing, card formats and escaped highlighting passed.');

const edited = changeCard(next, { description: '星空🌌', first_mes: '新的开场白' });
const pngExport = await exportBlob(edited, png);
const exportedBytes = Buffer.from(await pngExport.arrayBuffer());
assert.deepEqual(exportedBytes.subarray(0,artwork.length-12),artwork.subarray(0,-12));
assert.deepEqual(exportedBytes.subarray(-12),artwork.subarray(-12));
assert.deepEqual((await readCardFile(new File([pngExport], '新卡.png'))).raw, edited.raw);
assert.deepEqual(JSON.parse(await (await exportBlob(edited,null)).text()), edited.raw);
const reorder = transferItems(old,old,false,[1,2],0,true);
assert.equal(reorder.raw.first_mes,'乙');
assert.deepEqual(reorder.raw.alternate_greetings,['乙','甲']);
const withBook = readCard({...raw,character_book:{entries:[{id:3,name:'一',content:'原文',extensions:{sample:true}}]}});
const sparseGreetings = readCard({...raw,first_mes:'',alternate_greetings:['','原文','相同','相同']});
assert.deepEqual(changeComparedBody(sparseGreetings,'persona',sparseGreetings.greetings[0].index,{正文:'编辑'})
  .raw.alternate_greetings,['','编辑','相同','相同']);
const objectBook = readCard({...raw,character_book:{entries:{slot:withBook.raw.character_book.entries[0]}}});
assert.deepEqual(changeComparedBody(objectBook,'book',objectBook.book[0].index,{正文:'编辑'}).raw.character_book.entries,
  {slot:{...objectBook.raw.character_book.entries.slot,content:'编辑'}});
const copied = transferItems(withBook,withBook,true,[0],1,false).raw.character_book.entries;
assert.equal(copied.length,2); assert.notEqual(copied[0].id,copied[1].id); assert.deepEqual(copied[1].extensions,{sample:true});
const record = {avatar:'月.png',data:{...raw,extensions:{sample:true}}};
const baseline = readCard(structuredClone(record));
let writes = 0;
const host = {fetch: async (url, options) => {
  if (url.endsWith('/get')) return {ok:true,json:async () => structuredClone(record)};
  const payload = JSON.parse(options.body); writes++;
  assert.deepEqual(payload,{avatar:'月.png',description:'修改',data:{description:'修改'}});
  return {ok:true};
}, document:{ getElementById:() => null }};
const ctx = { characters:[record], getRequestHeaders:()=>({}) };
await saveInstalled(host,ctx,record.avatar,baseline,changeCard(baseline,{description:'修改'}));
assert.equal(record.data.extensions.sample,true);
await assert.rejects(saveInstalled(host,ctx,record.avatar,baseline,changeCard(baseline,{description:'另一份草稿'})),/同一项/);
assert.equal(writes,1);
console.log('Card editing, lossless metadata round trip, independent transfers and guarded installed saves passed.');

const linked = { avatar:'绑定.png', data:{ ...raw, extensions:{world:'主世界书'}, character_book:{ name:'旧副本',
  entries:[{id:7,content:'旧副本里的正文',extensions:{custom:true}}] } } };
let world = { title:'保留', entries:{ 7:{uid:7,comment:'地点',content:'酒馆正在使用的正文',key:['地点'],
  disable:false,position:4,displayIndex:0,probability:70,custom:{keep:true}} } };
const calls = [];
world.entries[9] = {uid:9,comment:'旧地点',content:'保留这个条目',displayIndex:1,custom:true};
let failCard = false;
const liveContext = { characters:[linked], getRequestHeaders:()=>({}),
  loadWorldInfo:async name => { assert.equal(name,'主世界书'); return structuredClone(world); },
  saveWorldInfo:async (name,data,immediate) => { calls.push([name,immediate]); world = structuredClone(data); },
};
const personaField = {value:raw.description};
const liveHost = { document:{getElementById:id=>({avatar_url_pole:{value:linked.avatar},description_textarea:personaField})[id]},
  fetch:async (path,options) => {
    if (path === '/api/worldinfo/get') return {ok:true,json:async()=>structuredClone(world)};
    if (path.endsWith('/get')) return {ok:true,json:async()=>structuredClone(linked)};
    if (failCard) return {ok:false,status:503};
    assert.equal(JSON.parse(options.body).avatar,linked.avatar);
    return {ok:true};
  } };
const loaded = await openInstalled(liveContext,readCard(structuredClone(linked)));
assert.equal(loaded.card.book[0].fields.正文,'酒馆正在使用的正文');
const persona = changeCard(loaded.card,{description:'编辑人设'});
await saveInstalled(liveHost,liveContext,linked.avatar,loaded.card,persona,loaded.source);
assert.equal(personaField.value,'编辑人设');
assert.equal(linked.data.character_book.entries[0].content,'旧副本里的正文');
assert.deepEqual(calls,[]);
const bookEdit = changeComparedBody(persona,'book',0,{正文:'编辑世界书'});
world.entries[7].content = '别处更新';
world.entries[7].probability = 20;
world.entries[8] = { uid:8,content:'酒馆另加的条目' };
delete world.entries[9];
const externalBook = structuredClone(world);
linked.data.character_book.entries[0].content = '酒馆另存的卡内副本';
linked.json_data = JSON.stringify({ data:linked.data });
failCard = true;
await assert.rejects(saveInstalled(liveHost,liveContext,linked.avatar,persona,bookEdit,loaded.source),/已还原本次世界书修改/);
assert.deepEqual(world,externalBook);
failCard = false;
assert.equal(await saveInstalled(liveHost,liveContext,linked.avatar,persona,bookEdit,loaded.source),true);
assert.equal(linked.data.character_book.entries[0].content,'编辑世界书');
assert.equal(world.entries[8],undefined);
assert.equal(world.entries[9].custom,true);
assert.equal(world.entries[9].content,'保留这个条目');
assert.deepEqual(world.entries[7],{...world.entries[7],content:'编辑世界书',position:4,probability:70,custom:{keep:true}});
assert.deepEqual(calls,[['主世界书',true],['主世界书',true],['主世界书',true]]);
const missing = await openInstalled({...liveContext,loadWorldInfo:async()=>null},bookEdit);
await assert.rejects(saveInstalled(liveHost,liveContext,linked.avatar,missing.card,
  changeComparedBody(missing.card,'book',0,{正文:'保留草稿'}),missing.source),/无法同步绑定世界书/);
console.log('Installed card saves distinguish embedded copies and live bindings, refresh persona, detect conflicts and retry partial writes.');
