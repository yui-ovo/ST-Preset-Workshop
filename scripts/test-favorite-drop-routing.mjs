import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const probe = process.argv.includes('--probe');
const clone = value => structuredClone(value);
function between(start, end, from = 0) {
  const a = source.indexOf(start, from);
  const b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Cannot extract ${start}`);
  return source.slice(a, b);
}

// Run the shipped handlers, favorite store and serialized global-variable writer.
// Only Vue's ref unwrapping and the Tavern storage boundary are supplied here.
async function fixture(data) {
  let persisted = { favorites: clone(data) };
  let saves = 0;
  const events = [], pending = [];
  const i = {
    ref: value => ({ isRef: true, value }),
    computed: get => ({ isRef: true, get value() { return get(); } }),
    toRaw: value => value,
  };
  const stores = new Map();
  const context = vm.createContext({
    i, t: clone, H: Promise.resolve(),
    h: { info() {}, error() {} }, toastr: { error() {} },
    getVariables: () => clone(persisted),
    replaceVariables: async next => {
      await new Promise(resolve => setTimeout(resolve, 2));
      persisted = clone(next); saves++;
    },
    Ce: () => clone(persisted.favorites),
    n: (id, setup) => () => {
      if (!stores.has(id)) {
        const value = setup();
        stores.set(id, new Proxy(value, {
          get: (target, key) => target[key]?.isRef ? target[key].value : target[key],
        }));
      }
      return stores.get(id);
    },
  });
  vm.runInContext(
    between('function ee(e,n,', 'function ne()') +
    "async function me(e){await ee('favorites',e)}" +
    between('function Ie(){', 'function Ne(') +
    between('function Te(e){', 'function rn()') +
    between("const pn=n('favorite',", ",Cn=n('diff'") + ';', context);
  const favoriteSetup = between('const t=pn(),A=', 'return(e,n)=>', source.indexOf("__name:'FavoritePanel'"));
  const handlers = vm.runInContext(`(function(n){${favoriteSetup}return {move:l,category:p,edge:m};})(()=>{})`, context);
  const store = stores.get('favorite');
  await store.enterFavoriteMode();
  context.r = { side: 'right', groupMode: true, sectionGroupMode: false,
    get prompts() { return store.flatPrompts; },
    get groupedData() { return store.organizedFavorites; } };
  context.E = { draggedIds: [], draggedPrompts: [], sourcePanel: 'right', draggedGroup: null, endDrag() { this.draggedIds = []; } };
  context.Ae = () => {};
  context.s = (name, ...args) => {
    events.push({ name, args: clone(args) });
    const handler = { move: handlers.move, 'move-to-category': handlers.category, 'move-item-relative-to-category': handlers.edge }[name];
    assert.ok(handler, `Unexpected event ${name}`);
    pending.push(handler(...args));
  };
  vm.runInContext(between('function ie(e,n,t){', 'const W=(0,i.computed)', source.indexOf("__name:'PromptPanel'")) + ';globalThis.dropItem=j;', context);
  for (const key of ['g','x','f','v','y','b','u']) context[key] = { value: null };
  context.L = () => {};
  const header = between('function(e,n){if(e.preventDefault(),g.value=null,x.value&&f.value', "}(e,A.category.id),['prevent','stop'])") + '}';
  vm.runInContext(`globalThis.dropHeader=(${header});`, context);
  return {
    store, events,
    get saves() { return saves; },
    get persisted() { return clone(persisted.favorites); },
    async drop(ids, targetId, position) {
      context.E.draggedIds = clone(ids);
      await context.dropItem(targetId, position);
      await Promise.all(pending.splice(0));
    },
    async category(ids, target) { await handlers.category(ids, target); },
    async edge(ids, target, position) { await handlers.edge(ids, target, position); },
    async header(ids, target, position) {
      context.E.draggedIds = clone(ids);
      context.y.value = position;
      await context.dropHeader({ preventDefault() {} }, target);
      await Promise.all(pending.splice(0));
    },
  };
}

const item = (id, categoryId, sortIndex) => ({ id, categoryId, sortIndex, name: id, content: `body ${id}`, enabled: false, role: 'system' });
const category = (id, sortIndex) => ({ id, sortIndex, name: id, collapsed: false });
const idsIn = (data, categoryId) => data.items.filter(p => p.categoryId === categoryId).sort((a,b) => a.sortIndex-b.sortIndex).map(p => p.id);
const scenarios = [
  ['adjacent across folders, before', {
    categories: [category('a',0),category('b',1)],
    items: [item('one','a',0),item('two','a',1),item('target','b',0)],
  }, ['two','one'], 'target', 'before', 'b', ['one','two','target']],
  ['adjacent across folders, after', {
    categories: [category('b',0),category('a',1)],
    items: [item('target','b',0),item('one','a',0),item('two','a',1)],
  }, ['two','one'], 'target', 'after', 'b', ['target','one','two']],
  ['root to folder, before', {
    categories: [category('b',3)],
    items: [item('one',undefined,0),item('two',undefined,1),item('left',undefined,2),item('target','b',0)],
  }, ['two','one'], 'target', 'before', 'b', ['one','two','target']],
  ['folder to root, after', {
    categories: [category('a',0),category('b',2)],
    items: [item('one','a',0),item('two','a',1),item('target',undefined,1)],
  }, ['two','one'], 'target', 'after', undefined, ['target','one','two']],
  ['non-contiguous same folder, before', {
    categories: [category('a',0)],
    items: [item('one','a',0),item('left','a',1),item('two','a',2),item('target','a',3)],
  }, ['two','one'], 'target', 'before', 'a', ['left','one','two','target']],
  ['non-contiguous same folder, after', {
    categories: [category('a',0)],
    items: [item('one','a',0),item('target','a',1),item('left','a',2),item('two','a',3)],
  }, ['two','one'], 'target', 'after', 'a', ['target','one','two','left']],
  ['single adjacent entry changes folder', {
    categories: [category('a',0),category('b',1)],
    items: [item('one','a',0),item('target','b',0)],
  }, ['one'], 'target', 'before', 'b', ['one','target']],
  ['selection follows mixed visible order', {
    categories: [category('a',1),category('b',3)],
    items: [item('one',undefined,0),item('two','a',0),item('left',undefined,2),item('target','b',0)],
  }, ['two','one'], 'target', 'after', 'b', ['target','one','two']],
];

let failures = 0;
for (const [name, data, ids, target, position, destination, expected] of scenarios) {
  const f = await fixture(data);
  await f.drop(ids, target, position);
  try {
    assert.deepEqual(idsIn(f.persisted, destination), expected);
    assert.equal(f.saves, 1, 'One gesture must save exactly once');
    assert.deepEqual(clone(f.store.favoriteData), f.persisted, 'UI state must refresh from saved data');
    for (const original of data.items) {
      const moved = f.persisted.items.find(p => p.id === original.id);
      for (const key of ['content','enabled','name','role']) assert.equal(moved[key], original[key]);
    }
    console.log(`PASS ${name}`);
  } catch (error) {
    failures++;
    console.log(`FAIL ${name}: ${JSON.stringify({events:f.events,saves:f.saves,actual:idsIn(f.persisted,destination),expected})}`);
    if (!probe) throw error;
  }
}
if (probe) console.log(`Reproduction: ${failures}/${scenarios.length} failures`);

if (!probe) {
  const data = {
    categories: [category('a',1),category('b',3)],
    items: [item('root-before',undefined,0),item('one','a',0),item('two','a',1),item('root-after',undefined,2),item('target','b',0)],
  };
  const rootIds = state => [
    ...state.categories.map(c => ({...c, id: `folder:${c.id}`})),
    ...state.items.filter(i => !i.categoryId),
  ].sort((a,b) => a.sortIndex-b.sortIndex).map(i => i.id);
  for (const [target, position, expected] of [
    ['root-before','after',['root-before','one','two','folder:a','root-after','folder:b']],
    ['root-after','before',['root-before','folder:a','one','two','root-after','folder:b']],
  ]) {
    const f = await fixture(data);
    await f.drop(['two','one'], target, position);
    assert.deepEqual(rootIds(f.persisted), expected, 'Root entries must preserve their positions relative to folder cards');
    assert.equal(f.saves, 1);
  }
  for (const [position, expected] of [
    ['before',['root-before','folder:a','root-after','one','two','folder:b']],
    ['after',['root-before','folder:a','root-after','folder:b','one','two']],
  ]) {
    const f = await fixture(data);
    await f.header(['two','one'], 'b', position);
    assert.deepEqual(rootIds(f.persisted), expected, 'Folder border must move every entry as one batch');
    assert.equal(f.saves, 1);
    assert.equal(f.events.length, 1);
  }
  const title = await fixture(data);
  await title.header(['one','two'], 'b', 'into');
  assert.deepEqual(idsIn(title.persisted, 'b'), ['target','one','two'], 'Title drops must continue to work');
  assert.equal(title.saves, 1);

  for (const [ids, target, position] of [
    [['one','two'],'one','before'], [['one','two'],'missing','after'],
    [['missing'],'target','before'], [['one'],'two','before'],
  ]) {
    const f = await fixture(data);
    await f.drop(ids, target, position);
    assert.deepEqual(f.persisted, data, 'Self, stale and unchanged drops must preserve data');
    assert.equal(f.saves, 0);
  }
  const stale = await fixture(data);
  await stale.drop(['missing','two','one'], 'target', 'after');
  assert.deepEqual(idsIn(stale.persisted, 'b'), ['target','one','two']);
  assert.equal(stale.saves, 1);
  console.log('PASS folder-title/border drops, root mixed order, stale selections, self-drops and unchanged drops');
}
