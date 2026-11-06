export const IDS = ['citrus', 'pear', 'berry'];
export const META = {
  citrus: { name: 'Мандарин и розмарин', color: '#edb153', number: '01' },
  pear: { name: 'Груша и вербена', color: '#c4d09b', number: '02' },
  berry: { name: 'Вишня и кардамон', color: '#dfa3ac', number: '03' }
};
export const MAX_IMAGE_BYTES = 200 * 1024;
export const MAX_CONTENT_BYTES = 850 * 1024;
const fail = message => { throw new Error(message); };
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
function keys(object, expected, label) {
  if (!plain(object) || Object.keys(object).sort().join('|') !== [...expected].sort().join('|')) fail(`${label}: неверный набор полей.`);
}
function text(value, min, max, label) {
  if (typeof value !== 'string' || value.trim().length < min || [...value].length > max) fail(`${label}: от ${min} до ${max} символов, поле не может быть пустым.`);
  if (/[<>\u0000-\u001f\u007f]/.test(value)) fail(`${label}: HTML, переводы строк и управляющие символы не допускаются.`);
}
const u32 = (bytes, offset) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset);
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export async function validatePng(dataUrl) {
  if (typeof dataUrl !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(dataUrl)) fail('Изображение: нужен PNG, подготовленный редактором.');
  const encoded = dataUrl.slice(22);
  if (encoded.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4) fail('Изображение: больше 200 КБ.');
  let bytes;
  try { bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0)); } catch { fail('Изображение: повреждён base64.'); }
  if (bytes.length > MAX_IMAGE_BYTES || bytes.length < 57 || [137,80,78,71,13,10,26,10].some((b,i) => bytes[i] !== b)) fail('Изображение: повреждён PNG.');
  let offset = 8, width, height, channels, ended = false;
  const chunks = [];
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) fail('Изображение: оборван PNG.');
    const size = u32(bytes, offset);
    if (offset + size + 12 > bytes.length) fail('Изображение: неверный размер блока PNG.');
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    if (u32(bytes, offset + 8 + size) !== crc32(bytes.slice(offset + 4, offset + 8 + size))) fail('Изображение: контрольная сумма PNG не совпала.');
    if (type === 'IHDR') {
      if (offset !== 8 || size !== 13) fail('Изображение: неверный заголовок PNG.');
      width = u32(bytes, offset + 8); height = u32(bytes, offset + 12);
      channels = bytes[offset + 17] === 6 ? 4 : bytes[offset + 17] === 2 ? 3 : 0;
      if (!width || width > 320 || !height || height > 620 || !channels || bytes[offset + 16] !== 8 || bytes[offset + 18] || bytes[offset + 19] || bytes[offset + 20]) fail('Изображение: PNG должен быть RGB/RGBA 8 бит, до 320×620, без чересстрочности. Подготовьте его в редакторе.');
    } else if (!width) fail('Изображение: отсутствует заголовок PNG.');
    if (type === 'IDAT') chunks.push(bytes.slice(offset + 8, offset + 8 + size));
    if (type === 'IEND') {
      if (size !== 0 || offset + 12 !== bytes.length) fail('Изображение: лишние данные после PNG.');
      ended = true;
    }
    offset += size + 12;
  }
  if (!ended || !chunks.length) fail('Изображение: PNG не завершён.');
  const compressed = new Blob(chunks).stream();
  let raw;
  try {
    const reader = compressed.pipeThrough(new DecompressionStream('deflate')).getReader();
    const parts = []; let count = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      count += value.length;
      if (count > height * (1 + width * channels)) { await reader.cancel(); fail('Изображение: слишком много распакованных данных.'); }
      parts.push(value);
    }
    raw = new Uint8Array(count); let at = 0;
    for (const part of parts) { raw.set(part, at); at += part.length; }
  } catch { fail('Изображение: повреждены пиксели PNG.'); }
  const stride = 1 + width * channels;
  if (raw.length !== height * stride) fail('Изображение: неверное число пикселей PNG.');
  for (let y = 0; y < height; y++) if (raw[y * stride] > 4) fail('Изображение: неверный фильтр PNG.');
  return { bytes, width, height };
}
export async function validateContent(content) {
  keys(content, ['version', 'hero', 'flavors'], 'Файл');
  if (content.version !== 1) fail('Неизвестная версия файла содержания.');
  keys(content.hero, ['first', 'prefix', 'accent', 'description1', 'description2'], 'Первый экран');
  text(content.hero.first, 1, 12, 'Первая строка заголовка');
  text(content.hero.prefix, 1, 8, 'Начало второй строки');
  text(content.hero.accent, 1, 14, 'Курсивная часть заголовка');
  text(content.hero.description1, 1, 58, 'Описание, строка 1');
  text(content.hero.description2, 1, 58, 'Описание, строка 2');
  keys(content.flavors, IDS, 'Коллекция');
  for (const id of IDS) {
    const f = content.flavors[id];
    keys(f, ['description', 'character', 'ingredients', 'image', 'alt'], META[id].name);
    text(f.description, 1, 240, `${META[id].name}: описание`);
    text(f.character, 1, 60, `${META[id].name}: характер`);
    text(f.ingredients, 1, 300, `${META[id].name}: состав`);
    text(f.alt, 8, 180, `${META[id].name}: описание изображения`);
    if (f.image !== `builtin:${id}`) await validatePng(f.image);
  }
  if (new TextEncoder().encode(JSON.stringify(content)).length > MAX_CONTENT_BYTES) fail('Файл содержания больше 850 КБ.');
  return content;
}
export function parseContent(source) {
  if (new TextEncoder().encode(source).length > MAX_CONTENT_BYTES) fail('Файл содержания больше 850 КБ.');
  try { return JSON.parse(source); } catch { fail('Файл не является корректным JSON. Экспортируйте его из редактора.'); }
}
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderContent(template, content, images) {
  const fields = {
    HERO_FIRST: content.hero.first, HERO_PREFIX: content.hero.prefix, HERO_ACCENT: content.hero.accent,
    HERO_DESCRIPTION1: content.hero.description1, HERO_DESCRIPTION2: content.hero.description2,
    HERO_IMAGE: images.citrus, HERO_ALT: content.flavors.citrus.alt
  };
  for (const id of IDS) for (const name of ['description', 'character', 'ingredients']) fields[`${id}_${name}`] = content.flavors[id][name];
  let html = template.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (match,key) => Object.hasOwn(fields,key) ? escapeHtml(fields[key]) : match);
  const products = Object.fromEntries(IDS.map(id => [id, { ...META[id], alt: content.flavors[id].alt, image: images[id] }]));
  html = html.replace('{{PRODUCT_DATA}}', JSON.stringify(products).replace(/</g, '\\u003c'));
  if (/\{\{[A-Za-z0-9_]+\}\}/.test(html)) fail('Шаблон содержит неизвестное поле.');
  return html;
}
