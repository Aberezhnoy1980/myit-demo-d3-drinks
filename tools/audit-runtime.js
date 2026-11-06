// Local preview instrumentation only. Never copied to dist.
(() => {
  const report = { userAgent:navigator.userAgent, viewport:[innerWidth,innerHeight], reduced:matchMedia('(prefers-reduced-motion: reduce)').matches, lcpMs:0, cls:0, eventDurationMs:0, cycles:0, cycleTimes:[], samples:[], network:[], profile:location.pathname.startsWith('/__slow__/')?'server delay: 150 ms + encoded body / 163840 bytes per second, per response; no CPU throttling':'loopback, no throttling' };
  for (const [type,callback] of [
    ['largest-contentful-paint', entries => { report.lcpMs = entries.at(-1).startTime; }],
    ['layout-shift', entries => entries.forEach(e => { if (!e.hadRecentInput) report.cls += e.value; })],
    ['event', entries => { report.eventDurationMs = Math.max(report.eventDurationMs,...entries.map(e=>e.duration)); }]
  ]) {
    try { new PerformanceObserver(list => callback(list.getEntries())).observe({type,buffered:true,...(type==='event'?{durationThreshold:16}:{})}); } catch { report[type]='unsupported'; }
  }
  const panel = document.createElement('details');
  panel.id = 'audit-panel';
  panel.style.cssText='position:fixed;bottom:8px;left:8px;z-index:100;background:#fff;color:#172352;border:1px solid;padding:10px;max-width:calc(100vw - 16px);max-height:45vh;overflow:auto;font:12px/1.5 monospace';
  panel.innerHTML='<summary>Локальная авторская проверка</summary><button id="audit-cycles">Наблюдать два цикла ленты</button> <button id="audit-refresh">Обновить замер</button><pre id="audit-report" style="white-space:pre-wrap"></pre>';
  document.body.append(panel);
  function refresh() {
    report.viewport=[innerWidth,innerHeight];
    report.scrollWidth=document.documentElement.scrollWidth;
    report.network=[performance.getEntriesByType('navigation')[0],...performance.getEntriesByType('resource')].filter(e=>e&&!e.name.includes('/__audit__/')).map(e=>({url:e.name,status:e.responseStatus,transferSize:e.transferSize,encodedBodySize:e.encodedBodySize,duration:e.duration}));
    report.responseBytes=report.network.reduce((n,e)=>n+e.transferSize,0);
    document.querySelector('#audit-report').textContent=JSON.stringify(report,null,2);
  }
  document.querySelector('#audit-refresh').addEventListener('click', refresh);
  document.querySelector('#audit-cycles').addEventListener('click', () => {
    const track=document.querySelector('.ribbon-track');
    const animation=track.getAnimations()[0];
    if (!animation) { report.cycleError='Лента статична; анимация отсутствует.'; refresh(); return; }
    if (report.observing) return;
    report.cycles=0; report.samples=[]; report.cycleTimes=[]; report.observing=true;
    const started=performance.now(); animation.currentTime=0;
    const timer=setInterval(()=> {
      const matrix=new DOMMatrixReadOnly(getComputedStyle(track).transform);
      report.samples.push({ms:Math.round(performance.now()-started),x:matrix.m41,width:track.firstElementChild.getBoundingClientRect().width,state:animation.playState});
    },250);
    function iteration() {
      report.cycles++; report.cycleTimes.push(performance.now()-started);
      if (report.cycles===2) { clearInterval(timer); track.removeEventListener('animationiteration',iteration); report.observing=false; }
      refresh();
    }
    track.addEventListener('animationiteration',iteration);
    refresh();
  });
  setTimeout(refresh,1200);
})();
