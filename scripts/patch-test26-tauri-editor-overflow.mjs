import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundlePath = path.join(root, 'dist', 'workshop-v3.02.js');
const runtimePath = path.join(root, 'patches', 'test26-tauri-editor-overflow.js');
let source = fs.readFileSync(bundlePath, 'utf8');

if (source.includes('PMM_TAURI_EDITOR_OVERFLOW_TEST28')) {
  throw new Error('test.28 patch is already installed');
}

source += `\n\n${fs.readFileSync(runtimePath, 'utf8').trim()}\n`;
fs.writeFileSync(bundlePath, source, 'utf8');
console.log('Applied test.28 Tauri iOS editor overflow patch.');
