import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const dist = await readdir(new URL('dist/', root));
const read = path => readFile(new URL(path, root), 'utf8');
const manifest = JSON.parse(await read('manifest.json'));
const pkg = JSON.parse(await read('package.json'));
const entry = await read(manifest.js);
assert.equal(pkg.version, manifest.version);
assert.ok(entry.includes(`const EXTENSION_VERSION = '${manifest.version}'`));
assert.deepEqual(dist.filter(name => /^workshop-v.*\.js$/.test(name)), ['workshop-v3.02.js'], 'Only the active workshop bundle belongs in dist; historical versions remain in Git');
for (const name of dist.filter(name => name.endsWith('.js'))) {
  const source = await read('dist/' + name);
  for (const match of source.matchAll(/(?:from\s*|import\s*\()(['"])(\.\.?\/[^'"?]+\.js)(?:\?[^'"]*)?\1/g)) {
    await access(new URL(match[2], new URL('dist/' + name, root)));
  }
}
for (const command of Object.values(pkg.scripts)) {
  for (const match of command.matchAll(/node (scripts\/[^\s]+\.mjs)/g)) await access(new URL(match[1], root));
}
for (const name of (await readdir(new URL('scripts/', root))).filter(name => name.endsWith('.mjs'))) {
  const source = await read('scripts/' + name);
  for (const match of source.matchAll(/new URL\(['"](\.\.\/dist\/[^'"?]+)['"]/g)) await access(new URL(match[1], new URL('scripts/' + name, root)));
}
console.log('Distribution layout: one active bundle, valid module imports, versions and test paths passed');
