// Toggle-only snapshots. Host APIs are injected so transitions can be tested without a browser.
export const copy = value => JSON.parse(JSON.stringify(value));
export function switches(data) {
  return Object.fromEntries(Object.values(data?.entries || {}).map(entry => [String(entry.uid), !!entry.disable]));
}
export function mergeSwitches(data, states) {
  const next = copy(data);
  let matched = 0;
  for (const entry of Object.values(next.entries || {})) {
    if (Object.hasOwn(states, String(entry.uid))) {
      entry.disable = !!states[String(entry.uid)];
      matched++;
    }
  }
  return { data: next, matched };
}
export function emptyStore() {
  return { version: 1, snapshots: [], groups: [], owned: [], session: null };
}

export function createWorldbookSnapshots(host) {
  let tail = Promise.resolve();
  let capturing = false;
  const queued = action => {
    const result = tail.then(action);
    tail = result.catch(() => {});
    return result;
  };
  const read = () => {
    const value = host.readStore();
    if (!value) return emptyStore();
    if (value.version !== 1 || !Array.isArray(value.snapshots) || !Array.isArray(value.groups)) {
      throw new Error('世界书快照数据无法识别，已停止写入');
    }
    const store = copy(value);
    store.defaults ||= [];
    return store;
  };
  const persist = store => host.writeStore(copy(store));
  const find = (store, id) => {
    const item = store.snapshots.find(item => item.id === id);
    if (!item) throw new Error('快照已不存在');
    return item;
  };
  const bookRow = (catalog, name) => catalog.find(book => book.name === name);
  function eligible(catalog, name, scope) {
    const book = bookRow(catalog, name);
    if (!book) throw new Error(`世界书“${name}”已不存在，请重新选择`);
    if (scope === 'character' ? !book.characters.length : book.characters.length || !book.global) {
      throw new Error(`“${name}”的绑定或全局挂载已变化，请重新选择`);
    }
    return book;
  }
  function assertDrafts(names) {
    if (host.hasUnsaved?.(names)) throw new Error('这本世界书还有未保存的编辑，请先保存或取消编辑');
  }
  async function writeSwitches(name, states, restoring = false) {
    assertDrafts([name]);
    const source = await host.load(name);
    if (!source?.entries) throw new Error(`无法读取世界书“${name}”`);
    const result = mergeSwitches(source, states);
    if (!restoring && !result.matched && Object.keys(states).length) throw new Error(`“${name}”的原条目已不存在，未应用快照`);
    if (JSON.stringify(switches(source)) !== JSON.stringify(switches(result.data))) {
      await host.save(name, result.data);
      try { await host.changed?.(name, result.data); }
      catch (error) { host.notice?.(`“${name}”已保存，但编辑器刷新失败：${error.message}`); }
    }
    return result.matched;
  }
  // Restore one book at a time; persist progress so an interrupted restore is retryable.
  async function restore(store, keep = new Set()) {
    if (!store.session) return;
    const names = Object.keys(store.session.before).filter(name => !keep.has(name));
    assertDrafts(names);
    for (const name of names) {
      if (!host.exists || await host.exists(name)) await writeSwitches(name, store.session.before[name], true);
      else host.notice?.(`“${name}”已被删除，已跳过它的开关恢复`);
      delete store.session.before[name];
      delete store.session.applied[name];
      persist(store);
    }
    if (!Object.keys(store.session.before).length) {
      store.session = null;
      persist(store);
    }
  }
  async function applyBound(store, item, character) {
    if (!store.session) store.session = { key: character.key, before: {}, applied: {} };
    if (!Object.hasOwn(store.session.before, item.book)) {
      assertDrafts([item.book]);
      const data = await host.load(item.book);
      if (!data?.entries) throw new Error(`无法读取世界书“${item.book}”`);
      Object.defineProperty(store.session.before, item.book, { value: switches(data), enumerable: true, configurable: true, writable: true });
      persist(store); // Journal before touching the shared worldbook.
    }
    await writeSwitches(item.book, item.states);
    Object.defineProperty(store.session.applied, item.book, { value: item.id, enumerable: true, configurable: true, writable: true });
    persist(store);
  }
  async function transition() {
    if (capturing) return { deferred: true };
    const store = read();
    const character = host.character();
    const bundleKey = contextKey();
    if (store.session?.bundle && store.session.key !== bundleKey) await restore(store);
    const bound = character && store.snapshots.find(item => item.bundle && item.scope === 'character'
      && item.owner === character.key && item.chat === host.chat?.());
    if (bound) {
      if (store.session?.bundle && store.session.key === bundleKey && store.session.chosen) return {};
      await validateBundle(bound);
      const applied = await applyCharacter(store, bound);
      return { autoBound: bound, changed: applied?.changed ?? 0 };
    }
    if (store.session?.bundle) return {};
    if (store.session && store.session.key !== character?.key) await restore(store);
    if (!character) return { restored: true };
    const migrated = store.snapshots.some(item=>item.bundle && item.scope==='character' && item.owner===character.key);
    const targets = migrated ? [] : store.snapshots.filter(item => !item.bundle && item.scope === 'character' && item.characters.includes(character.key));
    if (!targets.length) { await restore(store); return {}; }
    const catalog = await host.catalog();
    const valid = targets.filter(item => bookRow(catalog, item.book)?.characters.some(row => row.key === character.key));
    await restore(store, new Set(valid.map(item => item.book)));
    for (const item of valid) {
      if (host.character()?.key !== character.key) return transition();
      if (store.session?.applied[item.book] === item.id) continue;
      await applyBound(store, item, character);
    }
    if (host.character()?.key !== character.key) return transition();
    return {};
  }
  const contextKey = () => JSON.stringify([host.character()?.key || '', host.chat?.() || '']);
  async function target(scope, owner) {
    const catalog = await host.catalog();
    if (scope === 'character') {
      const c = host.character();
      if (!c || !host.chat?.() || c.key !== owner) throw new Error('请进入当前角色聊天后使用');
      const names = catalog.filter(row => row.characters.some(c => c.key === owner)).map(row => row.name);
      if (!names.length) throw new Error('当前角色没有绑定世界书');
      return names;
    }
    const group = read().groups.find(g => g.id === owner);
    if (!group) throw new Error('请先选择世界书分组');
    if (group.books.some(name => !bookRow(catalog, name) || bookRow(catalog, name).characters.length)) throw new Error('分组成员已删除或绑定角色，请先编辑分组');
    return group.books;
  }
  async function validateBundle(item) {
    const key=contextKey();
    const names = await target(item.scope, item.owner);
    if (key!==contextKey()) throw new Error('聊天已切换，请重试');
    if (JSON.stringify([...names].sort()) !== JSON.stringify(Object.keys(item.books).sort())) throw new Error('世界书成员已变化，请重新创建快照或更新默认');
    assertDrafts(names);
  }
  async function loadBundle(names) {
    assertDrafts(names);
    return Object.fromEntries(await Promise.all(names.map(async name => {
      const data = await host.load(name);
      if (!data?.entries) throw new Error(`无法读取世界书“${name}”`);
      return [name, data];
    })));
  }
  const statesOf = data => Object.fromEntries(Object.entries(data).map(([name, data]) => [name, switches(data)]));
  async function batch(states, commit) {
    const before = statesOf(await loadBundle(Object.keys(states))), written = [];
    try {
      for (const [name, value] of Object.entries(states)) { written.push(name); await writeSwitches(name, value); }
      await commit();
    } catch (error) {
      const failures = [];
      for (const name of written.reverse()) try { await writeSwitches(name, before[name], true); } catch (_) { failures.push(name); }
      if (failures.length) throw new Error(`${error.message}；未能恢复：${failures.join('、')}，请勿继续切换`);
      throw error;
    }
  }
  async function applyCharacter(store, item) {
    const key = contextKey();
    await validateBundle(item);
    if (contextKey()!==key) throw new Error('聊天已切换，请重试');
    if (store.session && (!store.session.bundle || store.session.key !== key)) await restore(store);
    const previousSession = copy(store.session);
    if (!store.session) store.session = { bundle:true, key, before:{}, applied:{} };
    const before = statesOf(await loadBundle(Object.keys(item.books)));
    for (const [name, states] of Object.entries(before)) if (!Object.hasOwn(store.session.before,name)) {
      Object.defineProperty(store.session.before,name,{ value:states, enumerable:true, configurable:true, writable:true });
    }
    let changed = 0;
    for (const [name, targetStates] of Object.entries(item.books)) {
      const current = before[name] || {};
      for (const [uid, val] of Object.entries(targetStates || {})) {
        if (Object.hasOwn(current, uid) && !!current[uid] !== !!val) changed++;
      }
    }
    try {
      persist(store);
      if (contextKey() !== key) throw new Error('聊天已切换，请重试');
      await batch(item.books, () => { store.session.chosen = item.id || 'default'; persist(store); });
    } catch (error) {
      store.session = previousSession;
      persist(store);
      throw error;
    }
    if (contextKey() !== key) await restore(store);
    return { changed };
  }
  const groupPlan = (store, group) => group.snapshot
    ? store.snapshots.find(s => s.bundle && s.scope === 'group' && s.owner === group.id && s.id === group.snapshot)
    : store.defaults?.find(s => s.scope === 'group' && s.owner === group.id);
  function checkConflict(store, group, plan, force) {
    if (!plan) return;
    const conflicts = store.groups.filter(g => g.enabled && g.id !== group.id).filter(g => {
      const other = groupPlan(store,g);
      return other && Object.keys(plan.books).some(name => other.books[name] && Object.entries(plan.books[name]).some(([uid,v]) => Object.hasOwn(other.books[name],uid) && other.books[name][uid] !== v));
    });
    if (conflicts.length && !force) {
      const error = new Error(`与开启分组「${conflicts.map(g=>g.name).join('、')}」的共享世界书开关冲突。使用当前方案会覆盖共享条目的开关。`);
      error.code = 'GROUP_CONFLICT'; throw error;
    }
  }
  async function ensureDefault(store, scope, owner, data) {
    store.defaults ||= [];
    let item = store.defaults.find(s => s.scope === scope && s.owner === owner);
    if (!item) { item = { bundle:true, scope, owner, books:statesOf(data), name:'默认' }; store.defaults.push(item); persist(store); }
    return item;
  }
  return {
    read,
    idle: () => tail,
    setCapturing(value) { capturing = !!value; },
    reconcileBooks: names => queued(() => {
      const valid = new Set((names || []).map(String));
      const store = read();
      let changed = false, removedFromGroups = 0, removedFromPlans = 0;
      for (const group of store.groups) {
        const before = Array.isArray(group.books) ? group.books : [];
        const next = before.filter(name => valid.has(String(name)));
        removedFromGroups += before.length - next.length;
        if (next.length !== before.length) {
          group.books = next;
          if (!next.length && group.enabled) group.enabled = false;
          changed = true;
        }
      }
      for (const item of [...(store.defaults || []), ...store.snapshots]) {
        if (item.scope !== 'group' || !item.books || typeof item.books !== 'object') continue;
        for (const name of Object.keys(item.books)) {
          if (valid.has(name)) continue;
          delete item.books[name];
          removedFromPlans++;
          changed = true;
        }
      }
      const owned = (store.owned || []).filter(name => valid.has(String(name)));
      if (owned.length !== (store.owned || []).length) { store.owned = owned; changed = true; }
      if (store.session) {
        for (const key of ['before','applied']) for (const name of Object.keys(store.session[key] || {})) {
          if (valid.has(name)) continue;
          delete store.session[key][name];
          changed = true;
        }
        if (!Object.keys(store.session.before || {}).length) { store.session = null; changed = true; }
      }
      if (changed) persist(store);
      return { changed, removedFromGroups, removedFromPlans };
    }),
    transition: () => queued(transition),
    captureBundle: (scope, owner) => queued(async () => {
      const key = contextKey(), data = await loadBundle(await target(scope,owner));
      if (key !== contextKey()) throw new Error('聊天已切换，请重试');
      await ensureDefault(read(),scope,owner,data);
      return { data, contextKey:key };
    }),
    editBundle: id => queued(async () => {
      const key=contextKey(), item=find(read(),id);
      await validateBundle(item);
      const data=await loadBundle(Object.keys(item.books));
      for(const name of Object.keys(data)) data[name]=mergeSwitches(data[name],item.books[name]).data;
      if(key!==contextKey())throw new Error('聊天已切换，请重试');
      return {data,contextKey:key,scope:item.scope,owner:item.owner,name:item.name,id:item.id};
    }),
    updateBundle: ({id,name,data,contextKey:key},sync=false,force=false) => queued(async () => {
      if(key!==contextKey())throw new Error('聊天已切换，请取消草稿后重建');
      if(!name.trim())throw new Error('请填写快照名称');
      const store=read(),item=find(store,id);
      item.name=name.trim();item.books=statesOf(data);
      await validateBundle(item);
      const activeGroup=store.groups.find(g=>g.enabled && g.snapshot===id);
      const activeCharacter=item.scope==='character' && store.session?.bundle && store.session.key===contextKey() && store.session.chosen===id;
      if((sync && activeGroup) || activeCharacter) {
        if(activeGroup) checkConflict(store,activeGroup,item,force);
        await batch(item.books,()=>persist(store));
      } else persist(store);
    }),
    createBundle: ({scope,owner,name,data,contextKey:key}) => queued(async () => {
      if (key !== contextKey()) throw new Error('聊天已切换，请取消草稿后重建');
      if (!name.trim()) throw new Error('请填写快照名称');
      const item = { bundle:true,id:host.id(),scope,owner,name:name.trim(),books:statesOf(data),created:Date.now(),chat:null };
      await validateBundle(item);
      const store = read(); store.snapshots.push(item); persist(store);
      // Creating a snapshot only records its switches. Applying and chat binding stay explicit actions.
      return copy(item);
    }),
    applyBundle: (id, scope, owner) => queued(async () => {
      const store=read(), item=id ? find(store,id) : store.defaults?.find(s=>s.scope===scope && s.owner===owner);
      if (!item) throw new Error('尚未保存默认');
      await validateBundle(item);
      if (item.scope !== 'character') throw new Error('请在世界书分组中选择方案');
      await applyCharacter(store,item);
    }),
    updateDefault: (scope,owner) => queued(async () => {
      const data=await loadBundle(await target(scope,owner)),store=read(); store.defaults ||= [];
      store.defaults=store.defaults.filter(s=>s.scope!==scope || s.owner!==owner);
      store.defaults.push({bundle:true,scope,owner,name:'默认',books:statesOf(data)}); persist(store);
    }),
    removeDefault: (scope,owner) => queued(() => {
      const store=read();
      if(scope==='group') {
        const group=store.groups.find(group=>group.id===owner);
        if(!group)throw new Error('分组已不存在');
        if(group.enabled)throw new Error('请先关闭分组再删除默认方案');
      }
      store.defaults=store.defaults.filter(item=>item.scope!==scope || item.owner!==owner);
      persist(store);
    }),
    resetBundle: (scope,owner) => queued(async () => {
      const store=read(),baseline=store.defaults?.find(s=>s.scope===scope && s.owner===owner);
      if(!baseline)throw new Error('尚未保存默认');
      await validateBundle(baseline);
      const count=store.snapshots.filter(s=>s.bundle && s.scope===scope && s.owner===owner).length;
      await batch(baseline.books,()=>{
        store.snapshots=store.snapshots.filter(s=>!s.bundle || s.scope!==scope || s.owner!==owner);
        store.defaults=store.defaults.filter(s=>s.scope!==scope || s.owner!==owner);
        if(scope==='character' && store.session?.bundle && store.session.key===contextKey())store.session=null;
        persist(store);
      });
      return count;
    }),
    bindChat: id => queued(async () => {
      const store=read(), item=find(store,id), previous=copy(store.snapshots); await validateBundle(item);
      if (item.scope!=='character') throw new Error('只能绑定角色快照');
      const chat=host.chat?.(); if (!chat) throw new Error('请先进入角色聊天');
      const unbind=item.chat===chat;
      for (const s of store.snapshots) if (s.bundle && s.scope==='character' && s.owner===item.owner && s.chat===chat) s.chat=null;
      if (!unbind) item.chat=chat;
      persist(store);
      if (!unbind) try { await applyCharacter(store,item); }
      catch(error) { store.snapshots=previous; persist(store); throw error; }
      return !unbind;
    }),
    selectGroupPlan: (id, snapshot='', force=false) => queued(async () => {
      const store=read(),group=store.groups.find(g=>g.id===id);
      if (!group) throw new Error('分组已不存在');
      group.snapshot=snapshot;
      let plan=groupPlan(store,group);
      if(!plan && !snapshot) {
        if(!group.enabled) { persist(store); return; }
        plan=await ensureDefault(store,'group',id,await loadBundle(await target('group',id)));
      }
      if (!plan) throw new Error('方案已不存在，请先创建快照保存默认');
      await validateBundle(plan);
      if (group.enabled) { checkConflict(store,group,plan,force); await batch(plan.books,()=>persist(store)); }
      else persist(store);
    }),
    capture: (book, scope) => queued(async () => {
      eligible(await host.catalog(), book, scope);
      assertDrafts([book]);
      const data = await host.load(book);
      if (!data?.entries) throw new Error('无法读取世界书条目');
      return copy(data);
    }),
    create: ({ book, scope, name, states, contextKey }) => queued(async () => {
      if ((host.character()?.key || '') !== contextKey) throw new Error('角色已切换，请取消草稿后在当前角色重新创建');
      eligible(await host.catalog(), book, scope);
      if (!name.trim()) throw new Error('请填写快照名称');
      // Check storage first, then apply; roll switches back if persistence fails.
      const store = read();
      const before = switches(await host.load(book));
      const item = { id: host.id(), name: name.trim(), book, scope, states: copy(states), characters: [], created: Date.now() };
      await writeSwitches(book, states);
      try { store.snapshots.push(item); persist(store); }
      catch (error) { await writeSwitches(book, before); throw error; }
      return copy(item);
    }),
    apply: id => queued(async () => {
      if (capturing) throw new Error('请先保存或取消正在编辑的快照');
      const store = read(), item = find(store, id);
      eligible(await host.catalog(), item.book, item.scope);
      await writeSwitches(item.book, item.states);
    }),
    rename: (id, name) => queued(() => {
      if (!name.trim()) throw new Error('请填写名称');
      const store = read(); find(store, id).name = name.trim(); persist(store);
    }),
    remove: id => queued(async () => {
      const store = read(); find(store, id);
      if (store.groups.some(g=>g.snapshot===id)) throw new Error('请先将使用此快照的分组切换到默认');
      store.snapshots = store.snapshots.filter(item => item.id !== id); persist(store);
      await transition();
    }),
    bind: id => queued(async () => {
      if (capturing) throw new Error('请先保存或取消正在编辑的快照');
      const character = host.character();
      if (!character) throw new Error('请先进入一个角色聊天');
      const store = read(), item = find(store, id);
      const book = eligible(await host.catalog(), item.book, 'character');
      if (!book.characters.some(row => row.key === character.key)) throw new Error('这本世界书没有绑定当前角色');
      const unbind = item.characters.includes(character.key);
      for (const other of store.snapshots.filter(other => other.book === item.book)) {
        other.characters = other.characters.filter(key => key !== character.key);
      }
      if (!unbind) item.characters.push(character.key);
      persist(store);
      await transition();
      return !unbind;
    }),
    saveGroup: ({ id, name, books }) => queued(async () => {
      if (!name.trim() || !books.length) throw new Error('请填写组名并至少选择一本世界书');
      const store = read(), catalog = await host.catalog();
      if (books.some(name => !bookRow(catalog, name) || bookRow(catalog, name).characters.length)) {
        throw new Error('分组只能选择没有绑定角色的世界书');
      }
      let group = store.groups.find(group => group.id === id);
      if (group?.enabled) throw new Error('请先关闭分组再编辑成员');
      if (!group) { group = { id: host.id(), enabled: false }; store.groups.push(group); }
      if (group.books && JSON.stringify([...group.books].sort()) !== JSON.stringify([...new Set(books)].sort())) {
        group.snapshot='';
        const baseline=store.defaults?.find(s=>s.scope==='group' && s.owner===group.id);
        if (baseline) {
          const current=statesOf(await loadBundle(books));
          baseline.books=Object.fromEntries(books.map(name=>[name,baseline.books[name] || current[name]]));
        }
      }
      Object.assign(group, { name: name.trim(), books: [...new Set(books)] });
      persist(store);
    }),
    toggleGroup: (id, force=false) => queued(async () => {
      const store = read(), group = store.groups.find(group => group.id === id);
      if (!group) throw new Error('分组已不存在');
      const catalog = await host.catalog();
      if (!group.enabled && group.books.some(name => !bookRow(catalog, name) || bookRow(catalog, name).characters.length)) {
        throw new Error('分组中有世界书被删除或绑定了角色，请先编辑分组');
      }
      const current = await host.globals();
      let plan;
      if (!group.enabled) {
        await ensureDefault(store,'group',id,await loadBundle(group.books));
        plan=groupPlan(store,group);
        if (!plan) throw new Error('分组方案已不存在，请重新选择');
        await validateBundle(plan);
        checkConflict(store,group,plan,force);
      }
      const owned = new Set((store.owned || []).filter(name => current.includes(name)));
      let next;
      if (!group.enabled) {
        for (const name of group.books) if (!current.includes(name)) owned.add(name);
        next = [...new Set([...current, ...group.books])];
      } else {
        const needed = new Set(store.groups.filter(other => other.id !== id && other.enabled).flatMap(other => other.books));
        const remove = new Set(group.books.filter(name => owned.has(name) && !needed.has(name)
          && bookRow(catalog, name) && !bookRow(catalog, name).characters.length));
        next = current.filter(name => !remove.has(name));
        for (const name of remove) owned.delete(name);
      }
      group.enabled = !group.enabled; store.owned = [...owned];
      try {
        await host.setGlobals(next);
        if (plan) await batch(plan.books,()=>persist(store));
        else persist(store);
      }
      catch (error) { await host.setGlobals(current); throw error; }
    }),
    removeGroup: id => queued(() => {
      const store = read(), group = store.groups.find(group => group.id === id);
      if (group?.enabled) throw new Error('请先关闭分组再删除');
      store.groups = store.groups.filter(group => group.id !== id);
      store.defaults = store.defaults.filter(item => item.scope !== 'group' || item.owner !== id);
      store.snapshots = store.snapshots.filter(item => item.scope !== 'group' || item.owner !== id);
      persist(store);
    }),
  };
}
