// Capas de destaques do Instagram + lower thirds transparentes (sem texto).
const k = require('./core.js');
const path = require('path');
const { C, OUT, icon, burst, sparkle, stripe } = k;
const { A, SH, onA } = require('./stories.js');
const jobs = [];

// ---------- Destaques ----------
const HL = [['avisos', 'megaphone'], ['matriculas', 'clipboard-text'], ['escolas', 'graduation-cap'], ['creches', 'baby'], ['bilingue', 'translate'], ['merenda', 'bowl-food'], ['transporte', 'bus'], ['eventos', 'confetti'], ['jornada-pedagogica', 'chalkboard-teacher'], ['busca-ativa', 'magnifying-glass'], ['formacao', 'certificate'], ['inclusao', 'puzzle-piece'], ['eja', 'book-open-text'], ['cultura', 'mask-happy'], ['esporte', 'soccer-ball'], ['projetos', 'lightbulb'], ['calendario', 'calendar-blank'], ['editais', 'file-text'], ['obras', 'hard-hat'], ['resultados', 'trophy'], ['familias', 'users-three'], ['professores', 'apple-logo'], ['alunos', 'student'], ['contato', 'phone'], ['localizacao', 'map-pin'], ['duvidas', 'question'], ['na-midia', 'newspaper'], ['bastidores', 'camera'], ['datas-comemorativas', 'cake'], ['fardamento', 't-shirt'], ['leitura', 'books'], ['tecnologia', 'laptop'], ['cinema', 'film-slate'], ['musica', 'music-notes'], ['saude-na-escola', 'heartbeat'], ['sao-joao', 'campfire'], ['natal', 'tree-evergreen'], ['semec', null]];
const HLC = [C.azul, C.vermelho, C.verde, C.laranja, C.navy, C.turquesa, C.rosa, C.roxo];
HL.forEach(([slug, ic], i) => {
  if (ic === 'apple-logo') ic = 'chalkboard';
  const col = HLC[i % HLC.length], acc = [C.navy].includes(col) ? C.amarelo : col === C.vermelho || col === C.roxo || col === C.rosa ? C.amarelo : C.amarelo;
  const glyph = (c, s) => (ic ? icon(ic, c, s) : k.symbol(s, c === '#fff' ? { head: C.amarelo, l: '#fff', r: '#fff', base: C.amarelo } : {}));
  const styles = {
    'A-colorido': `<div class="fill" style="background:${col}"></div><div class="fill" style="background-image:${k.pattern('rgba(255,255,255,.06)', 180)}"></div>${A('left:190px;top:610px;transform:rotate(10deg)', burst(700, 18, .8, 'rgba(255,255,255,.16)'))}${A('left:290px;top:710px;width:500px;height:500px;border-radius:50%;background:rgba(255,255,255,.14);border:12px solid #fff;display:flex;align-items:center;justify-content:center', glyph('#fff', 270))}${A('left:700px;top:700px', sparkle(90, acc))}`,
    'B-azul-marinho': `<div class="fill" style="background:${C.navy}"></div>${A('left:265px;top:685px;width:550px;height:550px;border-radius:50%;border:14px solid ' + C.amarelo)}${A('left:315px;top:735px;width:450px;height:450px;border-radius:50%;background:${C.azul};display:flex;align-items:center;justify-content:center'.replace('${C.azul}', C.azul), glyph('#fff', 250))}`,
    'C-claro': `<div class="fill" style="background:#fff"></div>${A('left:240px;top:660px', burst(600, 16, .8, col))}${A('left:0;right:0;top:820px;display:flex;justify-content:center', glyph('#fff', 280))}`,
  };
  for (const [st, html] of Object.entries(styles)) jobs.push({ html, w: 1080, h: 1920, out: path.join(OUT, '03-destaques', st, `${String(i + 1).padStart(2, '0')}-${slug}.png`), transparent: false });
});

// ---------- Lower thirds ----------
// Cada design desenha num bloco de 1000x260 (origem no canto inferior esquerdo da zona segura).
const bar = (w, h, bg, extra = '') => `<div style="width:${w}px;height:${h}px;background:${bg};${extra}"></div>`;
const LT = [
  ['classico', (t, u) => `<div style="display:flex;align-items:flex-end;${SH}"><div style="width:190px;height:190px;border-radius:40px;background:${t.a};display:flex;align-items:center;justify-content:center;z-index:2">${k.symbol(120, { mono: onA(t) })}</div><div style="margin-left:-26px">${bar(720, 112, t.p, 'border-radius:0 24px 0 0')}${bar(590, 70, '#fff', 'border-radius:0 0 24px 0')}</div></div>`],
  ['faixas-inclinadas', (t) => `<div style="${SH}">${bar(760, 116, t.p, 'border-radius:14px;transform:rotate(-2.5deg)')}${bar(560, 80, t.a, 'border-radius:12px;transform:rotate(-2.5deg);margin:6px 0 0 34px')}</div>`],
  ['pilula', (t) => `<div style="display:flex;align-items:center;${SH}"><div style="width:150px;height:150px;border-radius:50%;background:${t.p};border:10px solid #fff;display:flex;align-items:center;justify-content:center;z-index:2">${k.symbol(86, { head: t.a, l: '#fff', r: '#fff', base: t.a })}</div><div style="width:760px;height:118px;background:#fff;border-radius:0 59px 59px 0;margin-left:-60px;border-bottom:12px solid ${t.a}"></div></div>`],
  ['linha-degrade', (t) => `<div><div style="width:160px;height:14px;border-radius:7px;background:${t.a};margin-bottom:14px"></div>${bar(900, 120, `linear-gradient(90deg,${t.p} 55%,${t.p}00)`, 'border-left:16px solid ' + t.a)}${bar(640, 66, `linear-gradient(90deg,${t.d} 55%,${t.d}00)`, 'border-left:16px solid ' + t.a)}</div>`],
  ['bloco-assinatura', (t, u) => `<div style="${SH}"><div style="display:inline-block;background:#fff;border-radius:22px 22px 0 0;padding:14px 30px 12px 20px">${k.assinatura(u, 70)}</div>${bar(800, 110, t.p, 'border-radius:0 22px 22px 22px')}<div style="width:800px;margin-top:8px">${stripe(360, 12)}</div></div>`],
  ['etiqueta-canto', (t) => `<div style="display:flex;${SH}"><div style="width:26px;height:200px;background:${t.a};border-radius:13px 0 0 13px"></div><div>${bar(700, 120, t.p, 'border-radius:0 22px 0 0')}${bar(520, 80, t.d, 'border-radius:0 0 22px 0')}</div></div>`],
  ['balao', (t) => `<div style="position:relative;${SH}"><div style="width:780px;height:150px;background:${t.p};border-radius:44px"></div><div style="position:absolute;left:80px;top:-44px;border:36px solid transparent;border-bottom:46px solid ${t.p};border-top:0;border-right-width:0"></div><div style="position:absolute;right:-50px;top:-60px;transform:rotate(12deg)">${burst(140, 12, .64, t.a)}</div></div>`],
  ['estouro', (t) => `<div style="display:flex;align-items:center;${SH}"><div style="position:relative;width:220px;height:220px;z-index:2"><div class="abs" style="inset:0;transform:rotate(8deg)">${burst(220, 14, .76, t.a)}</div><div class="fill" style="display:flex;align-items:center;justify-content:center">${k.symbol(104, { mono: onA(t) })}</div></div><div style="margin-left:-56px">${bar(700, 104, '#fff', 'border-radius:0 18px 18px 0')}${bar(540, 66, t.p, 'border-radius:0 0 18px 0;margin-top:6px')}</div></div>`],
  ['minimal', (t) => `<div>${bar(700, 104, '#fff', 'border-radius:20px;' + SH)}<div style="display:flex;align-items:center;gap:16px;margin-top:12px">${bar(420, 62, t.p, 'border-radius:14px;' + SH)}${stripe(170, 14)}</div></div>`],
  ['contorno', (t) => `<div style="${SH}"><div style="width:760px;height:120px;border:10px solid #fff;border-radius:24px;background:${t.p}"></div><div style="width:480px;height:74px;border:8px solid #fff;border-radius:18px;background:${t.a};margin:-16px 0 0 44px"></div></div>`],
];
const FULL = [ // barras de largura total (rodapé de notícia / plantão)
  ['rodape-noticia', (t, u, W) => `<div style="width:${W}px;${SH}"><div style="display:flex;align-items:stretch"><div style="background:${t.a};color:${onA(t)};padding:0 34px;display:flex;align-items:center" class="an"><span style="font-size:56px">Educação</span></div><div style="flex:1;height:130px;background:${t.p}"></div></div><div style="height:16px;display:flex"><i style="flex:1;background:${C.vermelho}"></i><i style="flex:1;background:${C.verde}"></i><i style="flex:1;background:${C.amarelo}"></i><i style="flex:1;background:${C.azul}"></i></div></div>`],
  ['rodape-assinatura', (t, u, W) => `<div style="width:${W}px;height:170px;background:linear-gradient(90deg,${t.d},${t.p});display:flex;align-items:center;justify-content:space-between;padding:0 60px;border-top:14px solid ${t.a}"><div style="width:${W * .46}px;height:80px;border-radius:16px;background:rgba(255,255,255,.14)"></div>${k.assinatura(u, 88, 'neg')}</div>`],
];
function lt(d, t, u, fmt, full) {
  const [W, H] = fmt === 'h' ? [1920, 1080] : [1080, 1920];
  if (full) return A(`left:0;bottom:${fmt === 'h' ? 70 : 380}px`, d[1](t, u, W));
  const s = fmt === 'h' ? 1 : .98;
  return A(`left:${fmt === 'h' ? 110 : 56}px;bottom:${fmt === 'h' ? 110 : 420}px;transform-origin:left bottom;transform:scale(${s})`, d[1](t, u));
}
const cats = { sede: null, escola: null, bilingue: k.UNIDADES.find((x) => x.cat === 'bilingue'), creche: null, cria: null, servico: null };
for (const [cat, u] of Object.entries(cats)) for (const fmt of ['h', 'v']) {
  const t = k.TEMAS[cat]; const [W, H] = fmt === 'h' ? [1920, 1080] : [1080, 1920];
  [...LT.map((d) => [d, false]), ...FULL.map((d) => [d, true])].forEach(([d, full], i) => jobs.push({ html: lt(d, t, u, fmt, full), w: W, h: H, out: path.join(OUT, '04-lower-thirds', `tema-${cat}`, fmt === 'h' ? 'horizontal-1920x1080' : 'vertical-1080x1920', `${String(i + 1).padStart(2, '0')}-${d[0]}.png`) }));
}
for (const u of [...k.UNIDADES.filter((x) => x.cat !== 'bilingue'), ...k.SERVICOS]) {
  const t = k.temaDe(u);
  [[LT[4], false], [FULL[1], true], [LT[0], false]].forEach(([d, full], i) => jobs.push({ html: lt(d, t, u, 'v', full), w: 1080, h: 1920, out: path.join(OUT, '04-lower-thirds', u.cat === 'servico' ? 'servicos' : 'unidades', u.slug, `${String(i + 1).padStart(2, '0')}-${d[0]}.png`) }));
}
if (require.main === module) { const only = process.argv[2]; k.renderAll(only ? jobs.filter((j) => j.out.includes(only)) : jobs, { label: 'social', concurrency: 6 }); }
