// Original vector packaging for the fictional ПОЛДЕНЬ concept. No external artwork.
import { writeFile } from 'node:fs/promises';
const variants = [
  ['citrus', '#f5ab53', '#f8cb73', 'МАНДАРИН', 'И РОЗМАРИН', '01', '#e56b35'],
  ['pear', '#b4c986', '#d5e5a4', 'ГРУША', 'И ВЕРБЕНА', '02', '#76904d'],
  ['berry', '#db8f9f', '#f1b3bb', 'ВИШНЯ', 'И КАРДАМОН', '03', '#b55068']
];
for (const [id, base, light, name, second, n, deep] of variants) {
  const stripes = Array.from({length: 13}, (_,i)=>`<path d="M${15+i*25} 470q-35 35 0 70t0 70"/>`).join('');
  const droplets = [[83,109,3],[231,135,4],[252,229,2],[78,267,3],[228,353,4],[100,395,2],[244,440,3],[62,463,2],[183,126,2],[121,92,2],[219,530,3],[112,552,2]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r+1}" fill="#442a13" opacity=".13"/><circle cx="${x-.7}" cy="${y-.8}" r="${r}" fill="url(#drop)"/>`).join('');
  const fruit = id === 'citrus' ? `<circle cx="163" cy="412" r="48" fill="${deep}"/><circle cx="163" cy="412" r="40" fill="none" stroke="#f8dfaf" stroke-width="3"/>${Array.from({length:8},(_,i)=>`<path d="M163 412l${Math.round(Math.cos(i*Math.PI/4)*37)} ${Math.round(Math.sin(i*Math.PI/4)*37)}" stroke="#f8dfaf" stroke-width="2"/>`).join('')}<path d="M199 371q18-47 47-22-4 28-47 22" fill="#233bb9"/>` : id === 'pear' ? `<path d="M146 375c-8 12-7 20-21 33-34 37 4 60 38 59s67-24 33-59c-13-13-13-29-22-34-8-5-19-4-28 1" fill="${deep}"/><path d="M161 378q-5-28 16-40m-13 24q9-26 36-17-7 24-36 17" fill="#233bb9"/><path d="M136 420q-14 18 1 27" fill="none" stroke="#e8edc5" stroke-width="4" stroke-linecap="round"/>` : `<circle cx="139" cy="432" r="31" fill="${deep}"/><circle cx="189" cy="421" r="31" fill="#932d4d"/><path d="M139 409q-2-37 34-64 0 43 16 52" fill="none" stroke="#233bb9" stroke-width="5"/><path d="M172 354q18-25 40-6-17 21-40 6" fill="#233bb9"/><path d="M124 423q-7 7-4 16m53-25q-7 7-4 16" fill="none" stroke="#f6bdc5" stroke-width="3" stroke-linecap="round"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="620" viewBox="0 0 320 620" role="img" aria-label="Демонстрационная банка ПОЛДЕНЬ: ${name.toLowerCase()}, ${second.toLowerCase()}">
<defs>
<linearGradient id="metal"><stop stop-color="#7e817e"/><stop offset=".16" stop-color="#e8e9df"/><stop offset=".32" stop-color="#a1a8a1"/><stop offset=".51" stop-color="#f9faf0"/><stop offset=".76" stop-color="#a7afa7"/><stop offset=".88" stop-color="#e3e4d8"/><stop offset="1" stop-color="#777d78"/></linearGradient>
<linearGradient id="body"><stop stop-color="${deep}"/><stop offset=".12" stop-color="${base}"/><stop offset=".38" stop-color="${light}"/><stop offset=".64" stop-color="${base}"/><stop offset=".92" stop-color="${base}"/><stop offset="1" stop-color="${deep}"/></linearGradient>
<linearGradient id="shine"><stop stop-color="#fff" stop-opacity="0"/><stop offset=".25" stop-color="#fff" stop-opacity=".23"/><stop offset=".48" stop-color="#fff" stop-opacity="0"/><stop offset=".93" stop-color="#142317" stop-opacity=".08"/><stop offset="1" stop-color="#142317" stop-opacity=".3"/></linearGradient>
<radialGradient id="drop" cx=".3" cy=".2"><stop stop-color="#fff" stop-opacity=".9"/><stop offset=".6" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#55330b" stop-opacity=".18"/></radialGradient>
<clipPath id="can"><path d="M55 65Q48 78 44 98L40 552Q40 576 58 590Q160 615 262 590Q280 576 280 552L276 98Q272 78 265 65Z"/></clipPath>
</defs>
<path d="M60 562v27q0 19 100 20t100-20v-27" fill="url(#metal)" stroke="#9a9d93"/>
<path d="M55 65Q48 78 44 98L40 552Q40 576 58 590Q160 615 262 590Q280 576 280 552L276 98Q272 78 265 65Z" fill="url(#body)" stroke="${deep}" stroke-width="1"/>
<g clip-path="url(#can)">
<path d="M40 102q120 15 240 0M40 115q120 15 240 0" stroke="#233bb9" stroke-width="1" opacity=".5" fill="none"/>
<g fill="#233bb9" text-anchor="middle" font-family="Arial,Helvetica,sans-serif">
<text x="160" y="151" font-size="11" font-weight="700" letter-spacing="2.7">НАПИТОК С ХАРАКТЕРОМ</text>
<text x="156" y="223" font-size="69" font-weight="900" letter-spacing="-5">ПОЛ</text>
<text x="155" y="284" font-size="65" font-weight="900" letter-spacing="-5">ДЕНЬ</text>
<text x="160" y="319" font-size="15" font-weight="700" letter-spacing="2">${name}</text>
<text x="160" y="340" font-size="12" font-weight="700" letter-spacing="1.5">${second}</text>
<text x="67" y="397" font-size="10" transform="rotate(-90 67 397)" letter-spacing="1.3">БЕЗАЛКОГОЛЬНЫЙ</text>
<text x="253" y="393" font-size="10" transform="rotate(90 253 393)" letter-spacing="1.3">330 МЛ · ДЕМО</text>
</g>
${fruit}
<g fill="none" stroke="#233bb9" stroke-width="9">${stripes}</g>
<path d="M40 560h240v35H40z" fill="${base}"/><text x="160" y="580" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" fill="#233bb9" letter-spacing="2">КОЛЛЕКЦИЯ ВКУСОВ / ${n}</text>
<path d="M35 65h250v540H35z" fill="url(#shine)"/>
${droplets}
</g>
<ellipse cx="160" cy="65" rx="106" ry="31" fill="url(#metal)" stroke="#747d77" stroke-width="2"/>
<ellipse cx="160" cy="63" rx="97" ry="25" fill="#c7cfc5" stroke="#f0f2e6" stroke-width="2"/>
<ellipse cx="160" cy="63" rx="87" ry="20" fill="url(#metal)" stroke="#8e998f"/>
<path d="M147 48q18-5 31 4l8 18q-7 12-26 7l-18-13q-7-9 5-16Z" fill="#afb8ae" stroke="#79857e" stroke-width="2"/>
<ellipse cx="163" cy="57" rx="10" ry="5" fill="#758279"/><ellipse cx="172" cy="69" rx="8" ry="4" fill="#e4e7d9"/>
<path d="M60 69q102 40 200 0" stroke="#fafcf0" stroke-width="2" fill="none" opacity=".75"/>
</svg>`;
  await writeFile(new URL(`../src/assets/${id}.svg`, import.meta.url), svg);
}
console.log('Three original vector packages written.');
