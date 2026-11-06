import { mkdir, readFile, writeFile, rename, rm, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { IDS, parseContent, validateContent, validatePng, renderContent } from '../lib/content.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
// Complete validation before touching the previous working build.
const content = await validateContent(parseContent(await readFile(join(root, 'content/site.json'), 'utf8')));
const files = ['style.css', 'app.js', 'assets/citrus.svg', 'assets/pear.svg', 'assets/berry.svg', 'assets/sun.svg'];
const output = new Map();
for (const file of files) output.set(file, await readFile(join(root, 'src', file)));
const images = {};
for (const id of IDS) {
  if (content.flavors[id].image === `builtin:${id}`) images[id] = `./assets/${id}.svg`;
  else {
    const { bytes } = await validatePng(content.flavors[id].image);
    const file = `assets/content-${createHash('sha256').update(bytes).digest('hex').slice(0,20)}.png`;
    output.set(file, Buffer.from(bytes));
    images[id] = `./${file}`;
  }
}
output.set('index.html', Buffer.from(renderContent(await readFile(join(root, 'src/index.html'), 'utf8'), content, images)));
const stage = join(root, '.build-stage');
const backup = join(root, '.build-previous');
await rm(stage, { recursive: true, force: true });
await mkdir(join(stage, 'assets'), { recursive: true });
const manifest = {};
for (const [file, data] of output) {
  await writeFile(join(stage, file), data);
  manifest[file] = { bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
}
await rm(backup, { recursive: true, force: true });
if (await stat(join(root, 'dist')).catch(() => null)) await rename(join(root, 'dist'), backup);
try { await rename(stage, join(root, 'dist')); }
catch (error) { await rename(backup, join(root, 'dist')); throw error; }
await mkdir(join(root, 'docs/evidence'), { recursive: true });
await writeFile(join(root, 'docs/evidence/build-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Built ${output.size} public files from validated content. No packages or network required.`);
