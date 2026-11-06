// Identify a review slice. Default mode verifies without modifying files.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const manifestPath='docs/evidence/source-manifest.json';
const roots=['.node-version','README.md','package.json','src','content','lib','editor','tools','tests','dist','docs'];
const excludes=[manifestPath,'content/backups/','content/.next.json','docs/review-coordinator/','.DS_Store'];
const excluded=path=>excludes.some(x=>x.endsWith('/')?path.startsWith(x):path===x)||path.split('/').includes('.DS_Store');
const files=[];
async function walk(path) {
  if(excluded(path))return;
  for(const entry of await readdir(join(root,path),{withFileTypes:true})) {
    const child=path?`${path}/${entry.name}`:entry.name;
    if(excluded(child))continue;
    if(entry.isDirectory())await walk(child);
    else if(entry.isFile())await add(child);
    else throw new Error(`Неподдерживаемый тип файла: ${child}`);
  }
}
async function add(path) {
  const bytes=await readFile(join(root,path));
  files.push({path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
for(const path of roots) { if(path.includes('.')||path==='README.md')await add(path);else await walk(path); }
files.sort((a,b)=>a.path.localeCompare(b.path,'en'));
if(process.argv.includes('--write')) {
  await writeFile(join(root,manifestPath),JSON.stringify({slice:'d3-polden-r2',date:'2026-11-05',algorithm:'SHA-256',scope:roots,excludes,files},null,2)+'\n');
  console.log(`Записан R2: ${files.length} файлов.`);
} else {
  const expected=JSON.parse(await readFile(join(root,manifestPath),'utf8'));
  const baseline=new Map(expected.files.map(f=>[f.path,f]));
  const errors=[];
  for(const file of files){const old=baseline.get(file.path);if(!old||old.sha256!==file.sha256||old.bytes!==file.bytes)errors.push(file.path);baseline.delete(file.path);}
  errors.push(...baseline.keys());
  console.log(errors.length?`Manifest не совпал: ${errors.join(', ')}`:`Manifest ${expected.slice}: совпали все ${files.length} файлов.`);
  if(errors.length)process.exitCode=1;
}
