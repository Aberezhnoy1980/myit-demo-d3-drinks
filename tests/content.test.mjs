import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, cp, rm, readdir } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { validateContent, validatePng, parseContent, renderContent } from '../lib/content.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const original = JSON.parse(await readFile(join(root,'content/original.json'),'utf8'));
const fresh = () => structuredClone(original);
const crc = bytes => { let x=0xffffffff; for(const b of bytes){x^=b;for(let i=0;i<8;i++)x=(x>>>1)^((x&1)?0xedb88320:0);}return(x^0xffffffff)>>>0; };
function chunk(type,data){const kind=Buffer.from(type);const body=Buffer.concat([kind,data]);const result=Buffer.alloc(data.length+12);result.writeUInt32BE(data.length);body.copy(result,4);result.writeUInt32BE(crc(body),data.length+8);return result;}
const header=Buffer.alloc(13);header.writeUInt32BE(320);header.writeUInt32BE(620,4);header[8]=8;header[9]=6;
const raw=Buffer.alloc(620*(320*4+1));
for(let y=0;y<620;y++)for(let x=0;x<320;x++){const at=y*1281+1+x*4;const inside=x>45&&x<275&&y>40&&y<585;const color=inside?(y>200&&y<400?[35,59,185,255]:[217,143,160,255]):[0,0,0,0];color.forEach((b,i)=>raw[at+i]=b);}
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
await mkdir(join(root,'tests/fixtures'),{recursive:true});
await writeFile(join(root,'tests/fixtures/test-label.png'),png);
await writeFile(join(root,'tests/fixtures/broken.png'),'this is not a PNG');
await writeFile(join(root,'tests/fixtures/missing-fields.json'),'{"version":1}');
const image='data:image/png;base64,'+png.toString('base64');

test('исходное содержание корректно',async()=>assert.equal(await validateContent(fresh()) instanceof Object,true));
for(const [name,mutate] of [
 ['пустой заголовок',c=>c.hero.first=' '], ['длинный заголовок',c=>c.hero.first='я'.repeat(13)],
 ['нет обязательного поля',c=>delete c.flavors.pear.alt], ['неизвестная версия',c=>c.version=2],
 ['лишнее поле',c=>c.admin=true], ['нет вкуса',c=>delete c.flavors.berry],
 ['HTML во вводе',c=>c.hero.first='<script>'], ['перевод строки',c=>c.hero.first='А\nБ'],
 ['длинное описание',c=>c.flavors.citrus.description='а'.repeat(241)],
 ['внешняя картинка',c=>c.flavors.citrus.image='https://example.com/a.png'],
 ['SVG во вводе',c=>c.flavors.citrus.image='data:image/svg+xml,<svg/>'],
 ['неверный встроенный рисунок',c=>c.flavors.citrus.image='builtin:pear'],
 ['слишком короткий alt',c=>c.flavors.pear.alt='a'],
 ['превышение веса картинки',c=>c.flavors.citrus.image='data:image/png;base64,'+'a'.repeat(300000)]
]) test(`отклоняется: ${name}`,async()=>{const c=fresh();mutate(c);await assert.rejects(()=>validateContent(c));});
test('повреждённый JSON отклоняется',()=>assert.throws(()=>parseContent('{')));
test('PNG проверен до пикселей',async()=>{const {width,height}=await validatePng(image);assert.deepEqual({width,height},{width:320,height:620});});
test('PNG с изменённой контрольной суммой отклоняется',async()=>{const b=Buffer.from(png);b[50]^=1;await assert.rejects(()=>validatePng('data:image/png;base64,'+b.toString('base64')));});
test('PNG с лишними данными отклоняется',async()=>{const b=Buffer.concat([png,Buffer.from('extra')]);await assert.rejects(()=>validatePng('data:image/png;base64,'+b.toString('base64')));});
test('PNG с повреждённым deflate отклоняется',async()=>{const b=Buffer.concat([png.subarray(0,33),chunk('IDAT',Buffer.from('broken')),chunk('IEND',Buffer.alloc(0))]);await assert.rejects(()=>validatePng('data:image/png;base64,'+b.toString('base64')));});
test('renderer экранирует текст и не оставляет маркеров',async()=>{
 const c=fresh();c.hero.first='Ты & я';
 const template=await readFile(join(root,'src/index.html'),'utf8');
 const html=renderContent(template,c,{citrus:'./assets/citrus.svg',pear:'./assets/pear.svg',berry:'./assets/berry.svg'});
 assert.ok(html.includes('Ты &amp; я'));assert.ok(!html.includes('{{'));assert.ok(html.includes('product-data'));
});
test('применение, сборка, неверный ввод, откат и чистота dist',async()=>{
 const sandbox=await mkdtemp(join(root,'.content-test-'));
 try {
  for(const name of ['src','lib'])await cp(join(root,name),join(sandbox,name),{recursive:true});
  await mkdir(join(sandbox,'tools'));await mkdir(join(sandbox,'content'));
  for(const name of ['build.mjs','apply-content.mjs'])await cp(join(root,'tools',name),join(sandbox,'tools',name));
  await writeFile(join(sandbox,'content/site.json'),JSON.stringify(original));
  const run=(script,...args)=>spawnSync(process.execPath,[join(sandbox,'tools',script),...args],{cwd:sandbox,encoding:'utf8'});
  assert.equal(run('build.mjs').status,0);
  const before=await readFile(join(sandbox,'docs/evidence/build-manifest.json'),'utf8');
  const edited=fresh();edited.hero.first='Пауза';edited.flavors.citrus.description='Контрольное описание вкуса.';edited.flavors.citrus.image=image;
  await writeFile(join(sandbox,'export.json'),JSON.stringify(edited));
  assert.equal(run('apply-content.mjs','export.json').status,0);
  assert.equal(run('build.mjs').status,0);
  const html=await readFile(join(sandbox,'dist/index.html'),'utf8');
  assert.ok(html.includes('Пауза'));assert.ok(html.includes('Контрольное описание вкуса.'));assert.ok(html.includes('assets/content-'));
  const good=await readFile(join(sandbox,'dist/index.html'));
  await writeFile(join(sandbox,'content/site.json'),'{"version":1}');
  assert.notEqual(run('build.mjs').status,0);
  assert.deepEqual(await readFile(join(sandbox,'dist/index.html')),good);
  assert.notEqual(run('apply-content.mjs','content/site.json').status,0);
  const backup=(await readdir(join(sandbox,'content/backups')))[0];
  assert.equal(run('apply-content.mjs',`content/backups/${backup}`).status,0);
  assert.equal(run('build.mjs').status,0);
  assert.equal(await readFile(join(sandbox,'docs/evidence/build-manifest.json'),'utf8'),before);
  assert.ok(!(await readdir(join(sandbox,'dist/assets'))).some(x=>x.startsWith('content-')));
  assert.deepEqual((await readdir(join(sandbox,'dist'))).sort(),['app.js','assets','index.html','style.css']);
 } finally { await rm(sandbox,{recursive:true,force:true}); }
});
