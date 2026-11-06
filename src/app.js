(() => {
  'use strict';
  const flavors = JSON.parse(document.querySelector('#product-data').textContent);
  const stage = document.querySelector('.product-stage');
  const can = document.querySelector('#product-image');
  const fallback = document.querySelector('.media-fallback');
  const replay = document.querySelector('#replay');
  const links = [...document.querySelectorAll('[data-flavor]')];
  const stories = [...document.querySelectorAll('.taste-story')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const ribbon = document.querySelector('.ribbon');
  const ribbonControl = document.querySelector('.ribbon-control');
  let ribbonPaused = false;
  function updateRibbon() {
    ribbon.classList.toggle('is-running', !reduced.matches);
    ribbon.classList.toggle('is-paused', ribbonPaused || document.hidden);
    ribbonControl.hidden = reduced.matches;
    ribbonControl.setAttribute('aria-pressed', String(ribbonPaused));
    ribbonControl.querySelector('.ribbon-control-label').textContent = ribbonPaused ? 'Продолжить' : 'Пауза';
    ribbonControl.querySelector('.ribbon-control-icon').textContent = ribbonPaused ? '▷' : 'Ⅱ';
    ribbonControl.setAttribute('aria-label', ribbonPaused ? 'Продолжить движение ленты' : 'Остановить движение ленты');
  }
  ribbonControl.addEventListener('click', () => { ribbonPaused = !ribbonPaused; updateRibbon(); });
  document.addEventListener('visibilitychange', updateRibbon);
  reduced.addEventListener('change', updateRibbon);
  updateRibbon();
  // Geometry changes only on resize; the animation itself runs in CSS.
  const ribbonGroup = ribbon.querySelector('.ribbon-group');
  const sizeRibbon = () => ribbon.style.setProperty('--ribbon-duration', `${ribbonGroup.getBoundingClientRect().width / 28}s`);
  new ResizeObserver(sizeRibbon).observe(ribbonGroup);
  sizeRibbon();
  let selected = 'citrus';
  let timer;
  let frame = 0;
  function animate(kind) {
    clearTimeout(timer);
    stage.classList.remove('pop', 'switching');
    if (reduced.matches) return;
    // Start from the known resting position for repeat actions.
    void stage.offsetWidth;
    stage.classList.add(kind);
    timer = setTimeout(() => stage.classList.remove(kind), kind === 'pop' ? 870 : 520);
  }
  function select(id, announce = true) {
    const flavor = flavors[id];
    if (!flavor) return;
    selected = id;
    links.forEach(link => {
      const active = link.dataset.flavor === id;
      link.classList.toggle('selected', active);
      if (active) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
    stories.forEach(story => { story.hidden = story.id !== id; });
    can.alt = flavor.alt;
    // Only the selected image is requested; hidden variants aren't prefetched.
    if (can.getAttribute('src') !== flavor.image) {
      can.hidden = false;
      fallback.hidden = true;
      can.src = flavor.image;
      animate('switching');
    }
    stage.style.setProperty('--sun', flavor.color);
    document.querySelector('#scene-number').textContent = flavor.number;
    document.querySelector('#chosen-flavor').textContent = `Выбран вкус: ${flavor.name}`;
    if (announce) document.querySelector('#selection-status').textContent = `Выбран вкус: ${flavor.name}. Описание обновлено в разделе «Вкус в деталях».`;
  }
  can.addEventListener('error', () => { can.hidden = true; fallback.hidden = false; });
  can.addEventListener('load', () => { can.hidden = false; fallback.hidden = true; });
  if (can.complete && !can.naturalWidth) { can.hidden = true; fallback.hidden = false; }
  links.forEach(link => link.addEventListener('click', event => {
    // Preserve normal modified-click navigation.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    select(link.dataset.flavor);
  }));
  document.querySelectorAll('[data-buy]').forEach(link => link.addEventListener('click', () => select(link.dataset.buy, false)));
  function syncHash() {
    const id = location.hash.slice(1);
    if (flavors[id]) select(id);
  }
  window.addEventListener('hashchange', syncHash);
  replay.hidden = false;
  replay.addEventListener('click', () => {
    animate('pop');
    document.querySelector('#selection-status').textContent = reduced.matches ? 'Уменьшенное движение включено. Показана статичная упаковка.' : `Предметная анимация: ${flavors[selected].name}.`;
  });
  stage.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || reduced.matches || frame) return;
    const rect = stage.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - .5;
    const y = (event.clientY - rect.top) / rect.height - .5;
    frame = requestAnimationFrame(() => {
      stage.style.setProperty('--mx', `${x * 12}px`);
      stage.style.setProperty('--my', `${y * 8}px`);
      frame = 0;
    });
  });
  stage.addEventListener('pointerleave', () => {
    cancelAnimationFrame(frame); frame = 0;
    stage.style.setProperty('--mx', '0px'); stage.style.setProperty('--my', '0px');
  });
  reduced.addEventListener('change', () => stage.classList.remove('pop', 'switching'));
  select(flavors[location.hash.slice(1)] ? location.hash.slice(1) : 'citrus', false);
})();
