import assert from 'node:assert/strict';
import { compareCards, readBook, readCard, readCardFile } from '../dist/character-card-core.js';
import { buildHighlightedDiff } from '../dist/body-highlight.js';

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
const png = new File([Buffer.from([137,80,78,71,13,10,26,10]), metadata('chara', raw), metadata('ccv3', { data: { ...raw, character_version: '3' } })], '月.png');
assert.equal((await readCardFile(png)).version, '3');
await assert.rejects(readCardFile(new File(['image'], 'copy.png')), /PNG/);
await assert.rejects(readCardFile(new File(['{"something":1}'], 'wrong.json')), /角色卡/);
assert.ok(buildHighlightedDiff('<b>', '<i>').leftHtml.includes('&lt;'));
console.log('Character cards: exact text, greeting insertion, worldbook pairing, card formats and escaped highlighting passed.');
