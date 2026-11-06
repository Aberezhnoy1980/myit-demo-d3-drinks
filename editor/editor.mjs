import { IDS, META, parseContent, validateContent, validatePng, renderContent, MAX_CONTENT_BYTES, MAX_IMAGE_BYTES } from './content.mjs';
const $ = selector => document.querySelector(selector);
const form = $('#editor-form');
let draft, template, dirty = false, exportUrl, busy = false;
const currentId = () => $('#flavor').value;
const imageSource = id => draft.flavors[id].image.startsWith('builtin:') ? `${location.origin}/assets/${id}.svg` : draft.flavors[id].image;
const notice = text => { $('#notice').textContent = text; };
function error(message) { $('#error').hidden = false; $('#error').textContent = message; $('#error').focus(); }
function clearError() { $('#error').hidden = true; form.querySelectorAll('[aria-invalid]').forEach(e => e.removeAttribute('aria-invalid')); }
function markChanged() {
  dirty = true;
  $('#export-result').hidden = true;
  if (exportUrl) { URL.revokeObjectURL(exportUrl); exportUrl = null; }
  notice('Есть изменения. Обновите предпросмотр, затем подготовьте экспорт.');
}
function populateFlavor() {
  const f = draft.flavors[currentId()];
  for (const field of ['description','character','ingredients','alt']) form.elements[`flavor.${field}`].value = f[field];
  $('#image-preview').src = imageSource(currentId());
  $('#image-info').textContent = f.image.startsWith('builtin:') ? 'Авторская векторная упаковка' : `Подготовленный PNG, ${Math.round((f.image.length - 22) * .75 / 1024)} КБ`;
  $('#image-file').value = '';
}
function populate() {
  for (const [key,value] of Object.entries(draft.hero)) form.elements[`hero.${key}`].value = value;
  populateFlavor();
}
async function preview() {
  await validateContent(draft);
  const images = Object.fromEntries(IDS.map(id => [id,imageSource(id)]));
  const html = renderContent(template, draft, images)
    .replace('href="./style.css"', `href="${location.origin}/style.css"`)
    .replace('src="./app.js"', `src="${location.origin}/app.js"`)
    .replaceAll('"./assets/sun.svg"', `"${location.origin}/assets/sun.svg"`);
  // srcdoc stays isolated by sandbox. Handle local anchors inside this document:
  // otherwise their inherited base URL would open the editor in its own preview.
  $('#preview-frame').srcdoc = html.replace('</body>', `<script>
    document.addEventListener('click', event => {
      const link = event.target.closest('a[href^="#"]');
      if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const target = document.getElementById(link.getAttribute('href').slice(1)) || document.body;
      target.scrollIntoView({behavior:'instant'});
    });
  </script></body>`);
}
async function loadCurrent() {
  clearError();
  const response = await fetch('./site.json', {cache:'no-store'});
  if (!response.ok) throw new Error('Не удалось прочитать рабочее содержание. Проверьте, что локальный preview запущен.');
  draft = await validateContent(parseContent(await response.text()));
  dirty = false; $('#export-result').hidden = true;
  populate(); await preview(); notice('Рабочая версия загружена. Изменения не сохраняются автоматически.');
}
form.addEventListener('input', event => {
  if (!draft || !event.target.name) return;
  const [section,key] = event.target.name.split('.');
  if (section === 'hero') draft.hero[key] = event.target.value;
  if (section === 'flavor') draft.flavors[currentId()][key] = event.target.value;
  markChanged();
});
$('#flavor').addEventListener('change', () => { clearError(); populateFlavor(); });
function formErrors() {
  clearError();
  const invalid = [...form.querySelectorAll('[required]')].find(e => !e.value.trim() || (e.minLength > 0 && e.value.length < e.minLength) || (e.maxLength > 0 && e.value.length > e.maxLength));
  if (invalid) {
    invalid.setAttribute('aria-invalid','true'); invalid.focus();
    throw new Error(`Проверьте поле «${invalid.closest('label').childNodes[0].textContent.trim()}»: оно обязательно; длина указана рядом.`);
  }
}
form.addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return;
  try { formErrors(); await preview(); notice('Предпросмотр обновлён. Рабочие файлы сайта не изменены.'); }
  catch (e) { error(e.message); }
});
$('#export').addEventListener('click', async () => {
  if (busy) return;
  try {
    formErrors(); await validateContent(draft); await preview();
    const source = JSON.stringify(draft,null,2) + '\n';
    if (exportUrl) URL.revokeObjectURL(exportUrl);
    exportUrl = URL.createObjectURL(new Blob([source],{type:'application/json'}));
    $('#download').href = exportUrl; $('#export-json').value = source;
    $('#export-result').hidden = false; $('#export-result').focus();
    notice('Экспорт подготовлен. Скачайте файл; он ещё не применён к сайту.');
  } catch (e) { error(e.message); }
});
$('#download').addEventListener('click', () => { dirty = false; notice('Скачивание запрошено. Проверьте сохранённый файл перед закрытием редактора.'); });
$('#import').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  clearError();
  try {
    if (file.size > MAX_CONTENT_BYTES) throw new Error('Файл содержания больше 850 КБ.');
    const next = await validateContent(parseContent(await file.text()));
    draft = next; populate(); await preview(); markChanged(); notice('Файл открыт и проверен. Он не применён к рабочему сайту.');
  } catch (e) { error(`Импорт отменён: ${e.message} Предыдущие данные сохранены.`); }
  event.target.value = '';
});
$('#load-current').addEventListener('click', () => {
  if (dirty && !confirm('Заменить несохранённые правки рабочей версией?')) return;
  loadCurrent().catch(e => error(e.message));
});
$('#builtin').addEventListener('click', () => { draft.flavors[currentId()].image = `builtin:${currentId()}`; populateFlavor(); markChanged(); });
$('#image-file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  const targetId = currentId(); clearError(); busy = true;
  $('#export').disabled = true; $('#preview').disabled = true;
  try {
    if (!['image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('Выберите PNG, JPEG или WebP. SVG и другие типы не принимаются.');
    if (file.size > 4 * 1024 * 1024) throw new Error('Исходное изображение больше 4 МБ.');
    const bitmap = await createImageBitmap(file).catch(() => { throw new Error('Не удалось прочитать изображение: файл повреждён.'); });
    try {
      if (bitmap.width * bitmap.height > 20_000_000) throw new Error('Изображение больше 20 мегапикселей. Уменьшите его перед загрузкой.');
      let width = 320, source;
      do {
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = Math.round(width * 620 / 320);
        const scale = Math.min(canvas.width / bitmap.width, canvas.height / bitmap.height);
        const w = bitmap.width * scale, h = bitmap.height * scale;
        canvas.getContext('2d').drawImage(bitmap,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
        source = canvas.toDataURL('image/png');
        if ((source.length - 22) * .75 <= MAX_IMAGE_BYTES) break;
        width = Math.floor(width * .8);
      } while (width >= 128);
      await validatePng(source);
      draft.flavors[targetId].image = source;
      if (targetId === currentId()) populateFlavor();
      markChanged(); notice(`Иллюстрация «${META[targetId].name}» подготовлена. Уточните её описание и обновите предпросмотр.`);
    } finally { bitmap.close(); }
  } catch (e) { error(`${e.message} Прежняя иллюстрация сохранена.`); }
  finally { busy = false; $('#export').disabled = false; $('#preview').disabled = false; event.target.value = ''; }
});
$('#preview-size').addEventListener('change', event => { $('#preview-frame').width = event.target.value; });
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
try {
  const response = await fetch('./template.html', {cache:'no-store'});
  if (!response.ok) throw new Error('Шаблон страницы недоступен.');
  template = await response.text(); await loadCurrent();
} catch (e) { error(e.message); }
