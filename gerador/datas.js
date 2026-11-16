// Kits de datas comemorativas: perfil sazonal, destaques, títulos, posts, stories, fundos e presets temáticos.
const k = require('./core.js');
const path = require('path');
const { C, OUT, icon } = k;
const K = require('./kit2.js');
const S1 = require('./stories.js');
const S2 = require('./social2.js');
const { DATAS } = require('./dados.js');
const { A, on } = K;
const jobs = [], fundos = Object.keys(K.FUNDOS), tits = Object.keys(K.TITULOS);
const HL = ['megaphone', 'calendar-check', 'camera', 'confetti', 'graduation-cap', 'baby', 'bowl-food', 'heart', 'star', 'map-pin', 'question', 'trophy'];
const HLN = ['avisos', 'programacao', 'fotos', 'eventos', 'escolas', 'creches', 'merenda', 'homenagens', 'destaques', 'onde', 'duvidas', 'resultados'];

function perfil(d, t, v) {
  const sp = v ? [[2, 3, 30, -10], [68, 2, 30, 10], [0, 68, 30, 8], [70, 68, 30, -8]] : [[4, 4, 26, -12], [70, 6, 26, 12], [6, 70, 26, 10], [70, 70, 26, -10]];
  return K.FILT + K.FUNDOS[v ? 'raios' : 'padrao'](t, 1080, 1080).replace(/<div class="abs" style="left:0;right:0;bottom:[^>]*><\/div>/g, '') + K.cena(d.il, t, 1080, 1080, { spots: sp })
    + A('left:0;right:0;top:250px;display:flex;flex-direction:column;align-items:center;gap:22px', `<div style="width:300px;height:300px;border-radius:28%;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 18px 36px rgba(10,14,60,.28)">${k.symbol(206)}</div><div class="an" style="font-size:150px;color:${on(t.p)};line-height:.9;margin-top:6px">${k.SIGLA}</div>${K.pill(d.l1 + ' ' + d.l2, t.a, 26, `box-shadow:5px 5px 0 ${t.d === t.p ? C.navy : t.d}`)}`);
}
const destaque = (d, t, ic, i) => { const col = [t.p, t.d === t.p ? C.navy : t.d, t.a, t.b || t.p][i % 4] === '#FFFFFF' ? t.p : [t.p, t.d === t.p ? C.navy : t.d, t.a, t.b || t.p][i % 4]; const ac = col === t.a ? (t.d === t.p ? C.navy : t.d) : t.a;
  return K.FILT + `<div class="fill" style="background:${col}"></div><div class="fill" style="background-image:${k.pattern(on(col) === '#fff' ? 'rgba(255,255,255,.06)' : 'rgba(27,31,94,.05)', 180)}"></div>${A('left:230px;top:650px', K.forma('flor-12', 620, ac === '#FFFFFF' ? '#fff' : ac))}${A('left:0;right:0;top:810px;display:flex;justify-content:center', icon(ic, on(ac), 300))}${A('left:640px;top:1090px;transform:rotate(10deg)', K.il(d.il[i % d.il.length], 230, K.pal(t, i), 'adesivo'))}`; };
function arte(d, t, i, H, comMsg) {
  const f = fundos[(i * 3 + d.slug.length) % fundos.length], ts = tits[(i * 7 + d.slug.length) % tits.length], ink = K.tinta(f, t), story = H > 1500;
  const sp = story ? [[4, 12, 26, -10], [70, 14, 26, 10], [2, 66, 26, 8], [72, 64, 26, -8]] : [[3, 3, 24, -10], [73, 4, 24, 10], [2, 62, 24, 8], [74, 60, 24, -8]];
  const il = d.il.slice(i % d.il.length).concat(d.il.slice(0, i % d.il.length));
  return K.FILT + K.FUNDOS[f](t, 1080, H) + K.cena(il, t, 1080, H, { spots: sp })
    + A(`left:0;right:0;top:${story ? (comMsg ? 620 : 700) : comMsg ? 330 : 420}px;display:flex;flex-direction:column;align-items:center;gap:34px;padding:0 110px;text-align:center`, `${K.pill(d.sub, t.d === t.p ? C.navy : t.d, 23)}${K.titulo(ts, d.l1, d.l2, t, 112, ink)}${comMsg ? `<div style="font-weight:600;font-size:${story ? 40 : 36}px;line-height:1.38;color:${ink};margin-top:26px;max-width:800px">${d.msg}</div>` : ''}`)
    + A(`left:0;right:0;bottom:${story ? 340 : 66}px;display:flex;justify-content:center`, K.assinaPill(null, 78));
}
const tituloPng = (d, t, est) => A('inset:0;display:flex;align-items:center;justify-content:center', K.titulo(est, d.l1, d.l2, t, 190, est === 'elegante' || est === 'manuscrito' || est === 'cordel' ? C.navy : '#fff'));
const PRE = [...S1.D.filter((x) => ['cabecalho-tag', 'titulo-faixas', 'painel-inferior', 'card-aviso', 'polaroid', 'legenda-pequena-esquerda', 'moldura-cantos', 'convite'].includes(x[0])), ...S2.D2.filter((x) => ['quatro-fotos-grade', 'tres-fotos-mosaico', 'convite-evento', 'programacao', 'moldura-estouros', 'moldura-organica'].includes(x[0]))];
for (const d of DATAS) {
  const t = { p: d.p, a: d.a, d: d.d, b: d.b, ic: d.ic[0] }, base = path.join(OUT, '14-datas-comemorativas', d.slug), big = ['sao-joao', 'natal'].includes(d.slug), N = big ? 10 : 6;
  [0, 1].forEach((v) => jobs.push({ html: perfil(d, t, v), w: 1080, h: 1080, scale: 2, out: path.join(base, 'perfil-da-secretaria', `perfil-semec-${d.slug}-${v + 1}.png`), transparent: false }));
  HL.forEach((ic, i) => jobs.push({ html: destaque(d, t, ic, i), w: 1080, h: 1920, out: path.join(base, 'destaques', `${String(i + 1).padStart(2, '0')}-${HLN[i]}.png`), transparent: false }));
  tits.forEach((est, i) => jobs.push({ html: tituloPng(d, t, est), w: 1500, h: 900, scale: 1.5, out: path.join(base, 'titulos-sem-fundo', `${String(i + 1).padStart(2, '0')}-${est}.png`) }));
  for (let i = 0; i < N; i++) for (const [fmt, H] of [['posts', 1350], ['stories', 1920]]) for (const m of [0, 1]) jobs.push({ html: arte(d, t, i + m * 4, H, m), w: 1080, h: H, scale: 1.25, out: path.join(base, fmt, `${m ? 'mensagem' : 'titulo'}-${String(i + 1).padStart(2, '0')}.jpg`), transparent: false });
  fundos.slice(0, big ? 10 : 6).forEach((fn, i) => { for (const [fmt, H] of [['story', 1920], ['feed', 1350]]) jobs.push({ html: K.FILT + K.FUNDOS[fn](t, 1080, H) + K.cena(d.il.slice(i % 3), t, 1080, H, { spots: H > 1500 ? [[70, 10, 24, 10], [3, 70, 24, -8]] : [[72, 3, 22, 10], [3, 66, 22, -8]] }), w: 1080, h: H, scale: 1.25, out: path.join(base, 'fundos', `${fmt}-${String(i + 1).padStart(2, '0')}-${fn}.jpg`), transparent: false }); });
  PRE.forEach((p, i) => jobs.push({ html: p[2](t, null), w: 1080, h: 1920, out: path.join(base, 'stories-sem-fundo', `${String(i + 1).padStart(2, '0')}-${p[0]}.png`) }));
}
if (require.main === module) { const only = process.argv[2]; console.log(jobs.length); k.renderAll(only ? jobs.filter((j) => j.out.includes(only)) : jobs, { label: 'datas', concurrency: 3 }); }
