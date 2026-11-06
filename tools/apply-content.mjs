import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { parseContent, validateContent, MAX_CONTENT_BYTES } from '../lib/content.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const file = process.argv[2];
if (!file) { console.error('Укажите экспортированный файл: node tools/apply-content.mjs путь/полдень-content.json'); process.exit(1); }
try {
  const input = resolve(file);
  if ((await stat(input)).size > MAX_CONTENT_BYTES) throw new Error('Файл содержания больше 850 КБ.');
  const content = await validateContent(parseContent(await readFile(input, 'utf8')));
  const current = await readFile(join(root, 'content/site.json'));
  const previousHash = createHash('sha256').update(current).digest('hex');
  await mkdir(join(root, 'content/backups'), { recursive: true });
  await writeFile(join(root, 'content/backups', `${previousHash}.json`), current, { flag: 'wx' }).catch(e => { if (e.code !== 'EEXIST') throw e; });
  const next = JSON.stringify(content, null, 2) + '\n';
  await writeFile(join(root, 'content/.next.json'), next);
  await rename(join(root, 'content/.next.json'), join(root, 'content/site.json'));
  console.log(`Содержание применено локально. Резервная копия: content/backups/${previousHash}.json\nТеперь: node tools/build.mjs. Публикация не выполнялась.`);
} catch (error) { console.error(`Содержание не применено: ${error.message}`); process.exitCode = 1; }
