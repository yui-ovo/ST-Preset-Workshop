// Map the live world-info settings to their embedded character-book names.
const extensionFields = {
  position:'position', displayIndex:'display_index', excludeRecursion:'exclude_recursion', preventRecursion:'prevent_recursion',
  delayUntilRecursion:'delay_until_recursion', probability:'probability', useProbability:'useProbability', depth:'depth',
  selectiveLogic:'selectiveLogic', outletName:'outlet_name', group:'group', groupOverride:'group_override', groupWeight:'group_weight',
  scanDepth:'scan_depth', caseSensitive:'case_sensitive', matchWholeWords:'match_whole_words', useGroupScoring:'use_group_scoring',
  automationId:'automation_id', role:'role', vectorized:'vectorized', sticky:'sticky', cooldown:'cooldown', delay:'delay',
  matchPersonaDescription:'match_persona_description', matchCharacterDescription:'match_character_description',
  matchCharacterPersonality:'match_character_personality', matchCharacterDepthPrompt:'match_character_depth_prompt',
  matchScenario:'match_scenario', matchCreatorNotes:'match_creator_notes', triggers:'triggers', ignoreBudget:'ignore_budget',
};

export function embeddedBook(world, embedded, binding) {
  const template = { ...embedded, ...world.originalData };
  const byId = new Map(Object.values(template.entries || {}).map((e,i) => [String(e.id ?? e.uid ?? i), e]));
  const entries = Object.entries(world.entries).sort(([,a],[,b]) => (a.displayIndex ?? a.uid) - (b.displayIndex ?? b.uid))
    .map(([key, e]) => {
      const id = e.uid ?? e.id ?? key, original = byId.get(String(id));
      const extensions = { ...original?.extensions, ...e.extensions };
      for (const [field, ext] of Object.entries(extensionFields)) if (field in e) extensions[ext] = e[field];
      return { ...original, id, keys:e.key ?? [], secondary_keys:e.keysecondary ?? [], comment:e.comment ?? '',
        content:e.content ?? '', enabled:!e.disable, constant:e.constant ?? false, selective:e.selective ?? false,
        insertion_order:e.order ?? 100, position:e.position === 0 ? 'before_char' : 'after_char', extensions };
    });
  return { ...template, name:template.name || binding, extensions:template.extensions ?? {}, entries };
}

// The same worldbook controls edit both embedded character books and native world-info rows.
export function worldEntryView(e,index) {
  const row = { ...e, uid:e.id ?? e.uid ?? index, key:e.keys ?? e.key ?? [], comment:e.comment || e.name || '',
    disable:e.enabled === undefined ? !!e.disable : !e.enabled, order:e.insertion_order ?? e.order ?? 100 };
  for (const [field,ext] of Object.entries(extensionFields)) if (ext in (e.extensions || {})) row[field] = e.extensions[ext];
  row.position = e.extensions?.position ?? (typeof e.position === 'number' ? e.position : e.position === 'before_char' ? 0 : 1);
  return row;
}

export function editBookFields(entry, changes) {
  const edited = { ...entry };
  for (const [key,value] of Object.entries(changes)) {
    if (key === 'disable') edited.enabled = !value;
    else if (key === 'key') edited.keys = value;
    else if (key === 'order') edited.insertion_order = value;
    else if (key === 'comment') {
      edited.comment = value;
      if (!entry.comment && entry.name || entry.name === entry.comment) edited.name = value;
    } else if (key in extensionFields) {
      edited.extensions = { ...edited.extensions, [extensionFields[key]]:value };
      if (key === 'position') edited.position = value === 0 ? 'before_char' : 'after_char';
    } else edited[key] = value;
    if (key in entry && key !== 'position') edited[key] = value;
  }
  return edited;
}

export function updatedWorld(context, world, book) {
  const entries = Object.values(book.entries).map((entry,index) => ({
    ...entry, id:entry.id ?? entry.uid ?? index, comment:entry.comment ?? entry.name ?? '',
    enabled:entry.enabled ?? !entry.disable, extensions:{ ...entry.extensions, display_index:index },
  }));
  const existing = new Map(Object.entries(world.entries).map(([key,e]) => [String(e.uid ?? key), e]));
  const embedded = { ...book, entries };
  const native = entries.map((e,index) => {
    const id = String(e.id);
    let row = existing.get(id);
    if (!row) {
      if (!context.convertCharacterBook) throw Error('此酒馆版本缺少世界书条目转换功能，无法同步新增条目。');
      row = context.convertCharacterBook({ entries:[structuredClone(e)] }).entries[id];
    }
    const view = worldEntryView(e,index);
    const settings = { key:view.key, disable:view.disable, order:view.order, position:view.position };
    for (const key of ['constant','depth','role','outletName','vectorized']) if (key in view) settings[key] = view[key];
    return [id,{ ...row, ...settings, comment:view.comment, content:e.content, displayIndex:index,
      ...(row.extensions ? { extensions:{...row.extensions,...e.extensions} } : {}) }];
  });
  if (new Set(native.map(([id]) => id)).size !== native.length) throw Error('世界书中存在重复的条目编号，无法同步。');
  return { ...world, entries:Object.fromEntries(native), ...(world.originalData ? { originalData:embedded } : {}) };
}
