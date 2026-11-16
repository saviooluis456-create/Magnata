// Pacotes de grafismos (PNG transparente): formas, ilustrações, ícones-adesivo, palavras, molduras e padrões.
// Renderiza folhas grandes e recorta cada elemento.
const k = require('./core.js');
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const { C, OUT } = k;
const { I, star } = require('./ilus.js');
const dados = require('./dados.js');
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const on = (c) => (['#FFCA01', '#27B8F5', '#FFFFFF', '#fff', '#F2B500', '#FFE08A', '#F3F6FB', '#E9D5FF', '#FFD1E6'].includes(c) ? C.navy : '#fff');
const rnd = (s) => { let x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------- Formas abstratas (viewBox 0 0 200 200) ----------
const poly = (pts, f) => `<polygon points="${pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="${f}"/>`;
const pol = (r, a) => [100 + r * Math.cos(a), 100 + r * Math.sin(a)];
function blob(seed, f, n = 8) { const pts = []; for (let i = 0; i < n; i++) pts.push(pol(62 + rnd(seed + i) * 30, (i / n) * Math.PI * 2)); let d = ''; for (let i = 0; i < n; i++) { const p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]; if (!i) d += `M${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`; d += `C${(p1[0] + (p2[0] - p0[0]) / 5).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 5).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 5).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 5).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`; } return `<path d="${d}Z" fill="${f}"/>`; }
const scallop = (n, f, r = 78, rr = 20) => Array.from({ length: n }, (_, i) => { const [x, y] = pol(r, (i / n) * Math.PI * 2); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr}" fill="${f}"/>`; }).join('') + `<circle cx="100" cy="100" r="${r}" fill="${f}"/>`;
const aster = (n, f, w = 26) => Array.from({ length: n }, (_, i) => `<rect x="${100 - w / 2}" y="8" width="${w}" height="184" rx="${w / 2}" fill="${f}" transform="rotate(${(i * 180) / n} 100 100)"/>`).join('');
const line = (d, c, sw = 14) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
const FORMAS = {};
[[8, .5], [10, .62], [12, .7], [16, .76], [20, .82], [24, .86], [6, .45], [14, .58]].forEach(([n, r], i) => (FORMAS[`estouro-${n}`] = (f) => star(100, 100, 96, 96 * r, n, f)));
[5, 6, 8, 10, 12].forEach((n) => (FORMAS[`flor-${n}`] = (f) => scallop(n, f, n < 7 ? 58 : 70, n < 7 ? 36 : 22)));
[3, 4, 5, 6].forEach((n) => (FORMAS[`asterisco-${n}`] = (f) => aster(n, f, 30 - n * 2)));
for (let s = 1; s <= 14; s++) FORMAS[`organica-${s}`] = (f) => blob(s * 7.3, f, 6 + (s % 4));
[4, 4.01, 5].forEach((n, i) => (FORMAS[`brilho-${i + 1}`] = (f) => (i === 1 ? `<path d="M100 4C104 60 140 96 196 100 140 104 104 140 100 196 96 140 60 104 4 100 60 96 96 60 100 4Z" fill="${f}"/>` : star(100, 100, 96, i ? 40 : 30, Math.round(n), f))));
Object.assign(FORMAS, {
  circulo: (f) => `<circle cx="100" cy="100" r="92" fill="${f}"/>`, anel: (f) => `<circle cx="100" cy="100" r="76" fill="none" stroke="${f}" stroke-width="30"/>`, 'anel-fino': (f) => `<circle cx="100" cy="100" r="86" fill="none" stroke="${f}" stroke-width="12"/>`,
  'meia-lua': (f) => `<path d="M8 104a92 92 0 0 1 184 0Z" fill="${f}"/>`, quarto: (f) => `<path d="M14 186V14c96 0 172 76 172 172Z" fill="${f}"/>`, pilula: (f) => `<rect x="6" y="62" width="188" height="76" rx="38" fill="${f}"/>`,
  quadrado: (f) => `<rect x="18" y="18" width="164" height="164" rx="34" fill="${f}"/>`, losango: (f) => `<rect x="34" y="34" width="132" height="132" rx="20" fill="${f}" transform="rotate(45 100 100)"/>`, triangulo: (f) => `<path d="M100 22a14 14 0 0 1 12 7l74 128a14 14 0 0 1-12 21H26a14 14 0 0 1-12-21L88 29a14 14 0 0 1 12-7Z" fill="${f}"/>`,
  hexagono: (f) => poly([0, 1, 2, 3, 4, 5].map((i) => pol(94, (i * Math.PI) / 3 + Math.PI / 6)), f), mais: (f) => `<path d="M72 10h56v62h62v56h-62v62H72v-62H10V72h62Z" fill="${f}"/>`, xis: (f) => `<path d="M72 10h56v62h62v56h-62v62H72v-62H10V72h62Z" fill="${f}" transform="rotate(45 100 100)"/>`,
  coracao: (f) => `<path d="M100 180C40 136 14 102 14 68c0-42 54-58 86-18 32-40 86-24 86 18 0 34-26 68-86 112Z" fill="${f}"/>`, estrela: (f) => star(100, 104, 96, 42, 5, f), raio: (f) => `<path d="M118 6L30 112h54L72 194l98-116h-56Z" fill="${f}"/>`, nuvem: (f) => `<path d="M52 156c-34 0-42-46-10-54 0-38 52-52 70-20 30-16 66 10 54 42 28 4 24 32-4 32Z" fill="${f}"/>`,
  arco: (f) => line('M20 150a80 80 0 0 1 160 0', f, 26), 'arco-duplo': (f) => line('M20 156a80 80 0 0 1 160 0', f, 16) + line('M56 156a44 44 0 0 1 88 0', f, 16), ondas: (f) => [60, 100, 140].map((y) => line(`M12 ${y}q22-30 44 0t44 0 44 0 44 0`, f, 12)).join(''), ziguezague: (f) => line('M10 120l30-40 30 40 30-40 30 40 30-40 30 40', f, 16),
  rabisco: (f) => line('M14 110c20-60 40-60 40 0s20 60 40 0 20-60 40 0 20 60 40 0', f, 12), espiral: (f) => line('M100 100c0-10 14-10 14 2s-22 20-30 2 10-44 36-34 30 54 0 68-72-10-72-50 40-74 88-64', f, 11), laco: (f) => line('M10 140c50 20 90-10 80-50s-60-20-40 20 80 50 140 10', f, 12),
  sublinhado: (f) => line('M10 96c60-14 120-14 180-4M24 126c50-10 100-10 150-2', f, 13), 'sublinhado-pincel': (f) => `<path d="M8 104c50-18 130-22 184-8 4 10-2 18-10 16-50-8-110-4-166 12-10 2-14-14-8-20Z" fill="${f}"/>`, destaque: (f) => `<path d="M100 30c58-4 92 22 90 64-2 46-44 76-98 76S4 144 12 96c6-40 38-62 88-66Zm-2 16c-40 2-66 20-70 52-4 36 26 56 66 56s76-24 76-58c0-32-28-52-72-50Z" fill="${f}"/>`,
  seta: (f) => `<path d="M10 82h108V40l72 60-72 60v-42H10Z" fill="${f}"/>`, 'seta-curva': (f) => line('M24 40c10 80 60 120 136 116', f, 16) + `<path d="M132 116l56 42-62 30Z" fill="${f}"/>`, 'seta-fina': (f) => line('M14 100h160M126 52l52 48-52 48', f, 16),
  aspas: (f) => `<path d="M20 110c0-44 20-70 60-78v30c-18 6-26 16-26 30h26v62H20ZM112 110c0-44 20-70 60-78v30c-18 6-26 16-26 30h26v62h-60Z" fill="${f}"/>`, check: (f) => line('M24 108l48 48L176 44', f, 30), balao: (f) => `<path d="M30 20h140a20 20 0 0 1 20 20v84a20 20 0 0 1-20 20H96l-46 42v-42H30a20 20 0 0 1-20-20V40a20 20 0 0 1 20-20Z" fill="${f}"/>`,
  'balao-redondo': (f) => `<path d="M100 14c50 0 90 32 90 74s-40 74-90 74c-10 0-20-2-30-4l-42 28 12-44c-18-14-30-32-30-54 0-42 40-74 90-74Z" fill="${f}"/>`, 'balao-grito': (f) => star(100, 96, 96, 70, 11, f) + `<path d="M60 150l-26 44 56-30Z" fill="${f}"/>`, pensamento: (f) => `<path d="M56 130c-34 0-42-46-10-54 0-38 52-52 70-20 30-16 66 10 54 42 28 4 24 32-4 32Z" fill="${f}"/><circle cx="52" cy="158" r="14" fill="${f}"/><circle cx="26" cy="184" r="8" fill="${f}"/>`,
  etiqueta: (f) => `<path d="M10 100l48-56h118a14 14 0 0 1 14 14v84a14 14 0 0 1-14 14H58Z" fill="${f}"/><circle cx="60" cy="100" r="12" fill="#fff"/>`, ingresso: (f) => `<path d="M10 52h180v32a16 16 0 0 0 0 32v32H10v-32a16 16 0 0 0 0-32Z" fill="${f}"/>`, fita: (f) => `<path d="M4 70h40v76H4l22-38ZM196 70h-40v76h40l-22-38Z" fill="${f}" opacity=".7"/><rect x="30" y="52" width="140" height="76" rx="6" fill="${f}"/>`,
  selo: (f) => scallop(16, f, 80, 14) + `<circle cx="100" cy="100" r="62" fill="none" stroke="#fff" stroke-width="5" stroke-dasharray="4 10" stroke-linecap="round"/>`, fita2: (f) => `<path d="M60 120l-24 72 44-24 20 26 20-26 44 24-24-72Z" fill="${f}" opacity=".8"/>` + scallop(14, f, 60, 12),
  cantoneira: (f) => line('M24 110V40a16 16 0 0 1 16-16h70', f, 24), colchete: (f) => line('M80 20H40v160h40M120 20h40v160h-40', f, 20), moldura: (f) => `<rect x="16" y="16" width="168" height="168" rx="22" fill="none" stroke="${f}" stroke-width="16"/>`, 'moldura-tracejada': (f) => `<rect x="16" y="16" width="168" height="168" rx="22" fill="none" stroke="${f}" stroke-width="10" stroke-dasharray="22 16" stroke-linecap="round"/>`,
  pontilhado: (f) => Array.from({ length: 25 }, (_, i) => `<circle cx="${28 + (i % 5) * 36}" cy="${28 + Math.floor(i / 5) * 36}" r="10" fill="${f}"/>`).join(''), 'grade': (f) => [40, 80, 120, 160].map((v) => line(`M${v} 10v180M10 ${v}h180`, f, 6)).join(''), listras: (f) => `<clipPath id="lc"><circle cx="100" cy="100" r="92"/></clipPath><g clip-path="url(#lc)">${[-60, -20, 20, 60, 100, 140, 180].map((x) => `<rect x="${x}" y="-40" width="20" height="300" fill="${f}" transform="rotate(35 100 100)"/>`).join('')}</g>`,
  xadrez: (f) => Array.from({ length: 16 }, (_, i) => ((i % 4) + Math.floor(i / 4)) % 2 ? '' : `<rect x="${12 + (i % 4) * 44}" y="${12 + Math.floor(i / 4) * 44}" width="44" height="44" fill="${f}"/>`).join(''), escada: (f) => `<path d="M10 190V150h44v-44h44V62h44V18h48v172Z" fill="${f}"/>`, raios: (f) => Array.from({ length: 9 }, (_, i) => `<rect x="94" y="6" width="12" height="70" rx="6" fill="${f}" transform="rotate(${-80 + i * 20} 100 180)"/>`).join('') + `<path d="M40 180a60 60 0 0 1 120 0Z" fill="${f}"/>`,
  leque: (f) => Array.from({ length: 5 }, (_, i) => `<path d="M100 180L${(100 + 170 * Math.cos(Math.PI + (i + .1) * Math.PI / 5)).toFixed(1)} ${(180 + 170 * Math.sin(Math.PI + (i + .1) * Math.PI / 5)).toFixed(1)}A170 170 0 0 1 ${(100 + 170 * Math.cos(Math.PI + (i + .9) * Math.PI / 5)).toFixed(1)} ${(180 + 170 * Math.sin(Math.PI + (i + .9) * Math.PI / 5)).toFixed(1)}Z" fill="${f}" opacity="${1 - (i % 2) * .35}"/>`).join(''), confete: (f) => Array.from({ length: 16 }, (_, i) => `<rect x="${20 + rnd(i + 1) * 150}" y="${20 + rnd(i + 31) * 150}" width="${i % 3 ? 14 : 26}" height="${i % 3 ? 14 : 10}" rx="${i % 3 === 1 ? 7 : 3}" fill="${f}" opacity="${i % 2 ? 1 : .6}" transform="rotate(${rnd(i + 77) * 180} ${30 + rnd(i + 1) * 150} ${26 + rnd(i + 31) * 150})"/>`).join(''),
  gotas: (f) => [[60, 60, 1], [130, 44, .7], [110, 130, 1.1], [40, 140, .6], [164, 120, .5]].map(([x, y, s]) => `<path d="M0-30c16 22 24 34 24 46a24 24 0 0 1-48 0c0-12 8-24 24-46Z" fill="${f}" transform="translate(${x} ${y}) scale(${s})"/>`).join(''),
});

FORMAS['fita-adesiva'] = (f) => `<path d="M10 70l8-6 8 6 8-6 8 6 8-6 8 6 8-6 8 6 8-6 8 6 8-6 8 6 8-6 8 6 8-6 8 6 8-6 8 6 8-6 8 6 8-6 8 6v66l-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6Z" fill="${f}" opacity=".85"/>`;
for (let n = 1; n <= 10; n++) FORMAS[`numero-${n}`] = (f) => `<circle cx="100" cy="100" r="92" fill="${f}"/><text x="100" y="140" text-anchor="middle" font-family="Anton" font-size="112" fill="${on(f)}">${n}</text>`;

// ---------- montagem de uma célula ----------
const FILT = `<svg width="0" height="0" style="position:absolute"><defs>
<filter id="adesivo" x="-20%" y="-20%" width="140%" height="140%"><feMorphology in="SourceAlpha" operator="dilate" radius="6" result="d"/><feFlood flood-color="#fff"/><feComposite in2="d" operator="in" result="o"/><feOffset in="d" dx="5" dy="6" result="s"/><feFlood flood-color="#1B1F5E" flood-opacity=".9"/><feComposite in2="s" operator="in" result="sh"/><feMerge><feMergeNode in="sh"/><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="sombra" x="-20%" y="-20%" width="140%" height="140%"><feOffset in="SourceAlpha" dx="7" dy="8" result="s"/><feFlood flood-color="#1B1F5E"/><feComposite in2="s" operator="in" result="sh"/><feMerge><feMergeNode in="sh"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="xilo" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="5"/></filter></defs></svg>`;
const svg = (inner, filt) => `<svg viewBox="-14 -14 228 228" width="100%" height="100%"><g ${filt ? `filter="url(#${filt})"` : ''}>${inner}</g></svg>`;
const icInner = (name, color, weight = 'fill', s = 1, cx = 100, cy = 100) => { const sz = 200 * s; return `<g transform="translate(${cx - sz / 2} ${cy - sz / 2}) scale(${sz / 256})" fill="${color}">${k.icon(name, color, 256, weight).replace(/<svg[^>]*>/, '').replace('</svg>', '')}</g>`; };
const CONT = { // recipientes para ícones
  solto: (n, c) => icInner(n, c, 'fill', .96), duotone: (n, c) => icInner(n, c, 'duotone', .96), tracado: (n, c) => icInner(n, c, 'bold', .96),
  circulo: (n, c) => FORMAS.circulo(c) + icInner(n, on(c), 'fill', .56), estouro: (n, c) => FORMAS['estouro-16'](c) + icInner(n, on(c), 'fill', .5), quadrado: (n, c) => FORMAS.quadrado(c) + icInner(n, on(c), 'fill', .56),
  organica: (n, c) => blob(n.length * 3.1, c, 7) + icInner(n, on(c), 'fill', .5), flor: (n, c) => FORMAS['flor-10'](c) + icInner(n, on(c), 'fill', .5), anel: (n, c) => FORMAS['anel-fino'](c) + icInner(n, c, 'fill', .58), selo: (n, c) => scallop(16, c, 80, 14) + icInner(n, on(c), 'fill', .52),
};
// Palavras-adesivo (HTML)
const PAL = [
  (t, a, b) => `<span class="an" style="font-size:54px;background:${a};color:${on(a)};padding:6px 26px 12px;border-radius:8px;transform:rotate(-4deg);box-shadow:7px 7px 0 ${b};white-space:nowrap">${t}</span>`,
  (t, a, b) => `<span class="li" style="font-size:58px;color:${a};-webkit-text-stroke:14px #fff;paint-order:stroke fill;filter:drop-shadow(5px 6px 0 ${b});white-space:nowrap;padding:14px">${t}</span>`,
  (t, a, b) => `<span style="font-family:Poppins;font-weight:800;font-size:38px;letter-spacing:.06em;text-transform:uppercase;color:${a};border:7px solid ${a};background:#fff;padding:10px 30px;border-radius:60px;white-space:nowrap">${t}</span>`,
  (t, a, b) => `<span class="cv" style="font-size:62px;color:${C.navy};background:${a === C.navy ? '#FFE08A' : a}cc;padding:6px 34px 10px;transform:rotate(-3deg);white-space:nowrap;clip-path:polygon(0 0,100% 6%,98% 100%,2% 94%)">${t}</span>`,
  (t, a, b) => `<span class="sl" style="font-size:44px;color:${a};border:6px solid ${a};outline:3px solid ${a};outline-offset:5px;padding:8px 26px 10px;border-radius:10px;transform:rotate(-6deg);white-space:nowrap;text-transform:uppercase;margin:14px">${t}</span>`,
  (t, a, b) => `<span style="position:relative;display:inline-block;padding:0 0 30px"><span class="ba" style="display:block;font-size:50px;background:${a};color:${on(a)};padding:12px 32px 10px;border-radius:30px;white-space:nowrap">${t}</span><i style="position:absolute;left:44px;bottom:6px;border:16px solid transparent;border-top:26px solid ${a};border-bottom:0;border-left-width:0"></i></span>`,
];
const MOLD = { // molduras/divisores largos (HTML, célula larga)
};

// ---------- geração por pacote ----------
function pacote(nome, { cores, ilus = [], icones = [], palavras = [], nForm = 999, contN = 10, cwN = 4, icCores = 3, filtro = null }) {
  const itens = []; const cw = (i) => { const c = cores; return { a: c[i % c.length], b: c[(i + 1) % c.length], c: c[(i + 2) % c.length], k: C.navy, w: '#fff' }; };
  Object.keys(FORMAS).slice(0, nForm).forEach((fn) => cores.forEach((c, i) => itens.push({ dir: 'formas', n: `${fn}-${i + 1}`, h: svg(FORMAS[fn](c), filtro) })));
  ilus.forEach((il) => { for (let i = 0; i < cwN; i++) for (const [st, f] of [['', filtro], ['adesivo', 'adesivo'], ['sombra', 'sombra']]) itens.push({ dir: 'ilustracoes', n: `${il}-${i + 1}${st ? '-' + st : ''}`, h: svg(I[il](cw(i)), f) }); });
  icones.forEach((ic) => Object.keys(CONT).slice(0, contN).forEach((ct) => { for (let i = 0; i < icCores; i++) itens.push({ dir: 'icones', n: `${ic}-${ct}-${i + 1}`, h: svg(CONT[ct](ic, cores[i % cores.length]), filtro) }); }));
  palavras.forEach((p, pi) => PAL.forEach((fn, si) => itens.push({ dir: 'palavras', n: `${slug(p)}-${si + 1}`, wide: 1, h: `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center">${fn(p, cores[(pi + si) % cores.length], cores[(pi + si + 1) % cores.length] === cores[(pi + si) % cores.length] ? C.navy : cores[(pi + si + 1) % cores.length])}</div>` })));
  return { nome, itens };
}
const CORES = { sede: [C.navy, C.azul, C.amarelo, C.vermelho, C.verde, C.ciano], escola: [C.azul, C.amarelo, C.verde, C.vermelho, C.navy, C.laranja], bilingue: [C.vermelho, C.navy, C.ciano, C.amarelo, C.azul, '#FFFFFF'], creche: [C.laranja, C.amarelo, C.ciano, C.rosa, C.verde, C.roxo], cria: [C.verde, C.amarelo, C.rosa, C.ciano, C.laranja, '#0A3F2A'] };
const ILF = { sede: 'livro pilha lampada medalha trofeu sino aviao coracao capelo estrelacadente bandeirapilar bagre canoa igreja coqueiro', escola: 'livro pilha caderno mochila regua tesoura lapis3 maca globo lampada aviao sino medalha capelo lousa trofeu tubo apontador', bilingue: 'hello ola aa br uk us abc mundo livro globo aviao lampada capelo medalha foguete', creche: 'blocos urso bola chocalho chupeta mamadeira pato pipa catavento mao nuvem arcoiris sol balao trem foguete flor borboleta joaninha peao balde coracao estrelinha casinha', cria: 'mao coracao flor borboleta sol arcoiris nuvem urso blocos chocalho mamadeira chupeta pato estrelinha casacoracao folha joaninha balao casinha regador' };
const ILS = { 'busca-ativa': 'mochila casinha coracao livro', comunicacao: 'aviao lampada hello', 'alimentacao-escolar': 'maca milho xicara copo', 'transporte-escolar': 'trem mochila sino', 'educacao-especial': 'coracao mao arcoiris borboleta', eja: 'livro capelo lampada pilha', 'educacao-infantil': 'blocos urso bola pipa', 'ensino-fundamental': 'livro lapis3 caderno regua', 'formacao-pedagogica': 'lousa lampada pilha medalha', 'matricula-censo': 'caderno mochila casinha lapis3', 'equipe-psicossocial': 'coracao casacoracao borboleta nuvem', 'educacao-bilingue': 'hello ola abc mundo', 'tempo-integral': 'sol bola paleta livro', 'tecnologia-educacional': 'foguete lampada tubo aviao', cultura: 'boi guerreiro mascaras paleta', 'casa-da-cultura': 'sobrado azulejo cordel boi', 'cine-pilarense': 'cine claquete rolo projetor', 'banda-fanfarra': 'trompete caixa estandarte pandeiro', biblioteca: 'livro pilha cordel lampada', 'esporte-escolar': 'bola trofeu medalha estrelacadente', conselhos: 'livro medalha coracao casinha', infraestrutura: 'casinha regua lampada sobrado' };

function todos() {
  const out = [];
  for (const f of Object.keys(CORES)) out.push(pacote(f === 'sede' ? 'sede-semec' : f === 'escola' ? 'escolas' : f === 'creche' ? 'creches' : f === 'cria' ? 'creches-cria' : 'escola-bilingue', { cores: CORES[f], ilus: ILF[f].split(' '), icones: dados.FRENTES[f].icones, palavras: dados.FRENTES[f].palavras, cwN: 4, icCores: 2 }));
  for (const s of k.SERVICOS) { const d = dados.SERV[s.slug], t = s.tema; out.push(pacote('servicos/' + s.slug, { cores: [t.p, t.a, C.navy, t.b, t.p === C.navy ? C.azul : '#FFFFFF', C.rosa === t.p ? C.roxo : C.rosa].filter((v, i, a) => a.indexOf(v) === i), ilus: ILS[s.slug].split(' '), icones: d.icones, palavras: d.palavras, nForm: 60, cwN: 3, icCores: 5 })); }
  for (const d of dados.DATAS) out.push(pacote('datas-comemorativas/' + d.slug, { cores: [d.p, d.a, d.d, d.b, C.amarelo, '#FFFFFF'].filter((v, i, a) => a.indexOf(v) === i), ilus: d.il, icones: d.ic, palavras: d.palavras, nForm: ['sao-joao', 'natal'].includes(d.slug) ? 999 : 50, cwN: ['sao-joao', 'natal'].includes(d.slug) ? 6 : 4, icCores: 3 }));
  return out;
}
const CELL = 512, COLS = 10;
async function render(pacotes, base) {
  let browser = await chromium.launch();
  for (const p of pacotes) {
    const dir = path.join(base, p.nome); let have = 0;
    if (fs.existsSync(dir)) for (const d of fs.readdirSync(dir)) have += fs.readdirSync(path.join(dir, d)).length;
    if (have >= p.itens.length) { console.log('ok (já existe)', p.nome); continue; }
    const tmp = path.join(require('os').tmpdir(), 'semec-graf-' + process.pid); fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
    const sheets = []; for (let i = 0; i < p.itens.length; i += COLS * COLS) sheets.push(p.itens.slice(i, i + COLS * COLS));
    let si = 0;
    await Promise.all(Array.from({ length: 2 }, async () => { while (si < sheets.length) { const my = si++, itens = sheets[my], rows = Math.ceil(itens.length / COLS);
      const html = FILT + `<div style="display:grid;grid-template-columns:repeat(${COLS},${CELL}px);grid-auto-rows:${CELL}px">${itens.map((it) => `<div style="width:${CELL}px;height:${CELL}px;padding:${it.wide ? 0 : 22}px;overflow:hidden">${it.h}</div>`).join('')}</div>`;
      const f = path.join(tmp, `s${my}.png`);
      for (let tent = 0; tent < 4; tent++) { let ctx; try { ctx = await browser.newContext({ deviceScaleFactor: 1 }); const pg = await ctx.newPage(); await pg.setViewportSize({ width: CELL * COLS, height: CELL * rows }); await pg.setContent(k.doc(html, CELL * COLS, CELL * rows), { waitUntil: 'load' }); await pg.evaluate(() => document.fonts.ready); await pg.screenshot({ path: f, omitBackground: true, timeout: 90000 }); await ctx.close(); break; } catch (e) { console.log('nova tentativa', p.nome, my, String(e.message).slice(0, 60)); try { await ctx.close(); } catch (_) {} if (tent === 3) throw e; if (!browser.isConnected()) browser = await chromium.launch(); } }
      fs.writeFileSync(f + '.json', JSON.stringify(itens.map((it) => path.join(dir, it.dir, it.n + '.png')))); } }));
    execFileSync('python3', [path.join(__dirname, 'recorta.py'), tmp, String(CELL), String(COLS)], { stdio: 'inherit', maxBuffer: 1e9 });
    fs.rmSync(tmp, { recursive: true, force: true }); console.log('pacote', p.nome, p.itens.length);
  }
  await browser.close();
}
module.exports = { FORMAS, CONT, PAL, FILT, svg, icInner, blob, scallop, pacote, render, on, slug, CORES };
if (require.main === module) { const ps = todos(); const only = process.argv[2]; const sel = only ? ps.filter((p) => p.nome.includes(only)) : ps; if (process.argv[3] === 'conta') console.log(sel.map((p) => `${p.nome}: ${p.itens.length}`).join('\n')); console.log('total', sel.reduce((a, p) => a + p.itens.length, 0)); if (process.argv[3] !== 'conta') render(sel, path.join(OUT, '09-grafismos')); }
