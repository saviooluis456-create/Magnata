const k = require('./core.js');
const fs = require('fs'), path = require('path');
const { C, OUT } = k;
const jobs = [];
const center = (inner, bg = 'transparent') => `<div class="fill" style="display:flex;align-items:center;justify-content:center;background:${bg}">${inner}</div>`;

// Foto de perfil 1080x1080 (conteúdo dentro do círculo de corte do Instagram)
function perfil(u) {
  const t = u.cat === 'sede' ? k.TEMAS.sede : k.temaDe(u);
  const fam = u.cat === 'creche' || u.cat === 'cria' ? 'ba' : 'an';
  const n = u.nome.length, fsz = u.cat === 'sede' ? 190 : n > 28 ? 66 : n > 20 ? 80 : n > 13 ? 98 : 124;
  const selo = u.cat === 'sede'
    ? `<div style="width:330px;height:330px;border-radius:28%;background:#fff;display:flex;align-items:center;justify-content:center">${k.symbol(230)}</div>`
    : k.selo(u, 330, { bg: '#fff' }).replace(/fill="#fff"/g, `fill="${t.p}"`);
  return `<div class="fill" style="background:${t.p}"></div>
<div class="fill" style="background-image:${k.pattern('rgba(255,255,255,.07)', 170)}"></div>
<div class="abs" style="left:-170px;top:-170px;transform:rotate(12deg)">${k.burst(470, 14, .7, t.d === C.navy && t.p === C.navy ? C.azul : t.d)}</div>
<div class="abs" style="right:-190px;bottom:-200px">${k.burst(480, 16, .72, t.a)}</div>
<div class="abs" style="left:120px;bottom:150px">${k.sparkle(54, t.a)}</div><div class="abs" style="right:150px;top:170px">${k.sparkle(70, '#fff')}</div>
<div class="fill" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;padding:0 170px 30px;text-align:center">
${selo}
<div style="font-weight:800;font-size:27px;letter-spacing:.18em;text-transform:uppercase;color:#fff;background:${t.p === C.navy ? C.azul : t.d};padding:9px 26px 8px;border-radius:40px;margin-top:6px;white-space:nowrap">${u.cat === 'sede' ? 'Educação e Cultura' : u.tipo.split(' · ')[0]}</div>
<div class="${fam}" style="font-size:${fsz * (fam === 'ba' ? .95 : 1)}px;color:#fff;max-width:740px">${u.cat === 'sede' ? k.SIGLA : u.nome}</div>
<div style="display:flex;align-items:center;gap:14px;background:#fff;border-radius:40px;padding:10px 24px">${k.stripe(90, 10)}<span style="font-weight:800;font-size:22px;letter-spacing:.22em;color:${C.navy};text-transform:uppercase;white-space:nowrap">${u.cat === 'sede' ? 'Pilar · Alagoas' : k.SIGLA + ' · Pilar'}</span></div></div>`;
}

// SEMEC
const base = path.join(OUT, '01-logos');
for (const [lay, w, h] of [['h', 1500, 620], ['v', 1100, 1300]]) for (const [m, name] of [['cor', 'cor'], ['neg', 'negativo'], [C.navy, 'mono-azul'], ['#fff', 'mono-branco']]) {
  const html = center(k.logoSemec(lay === 'h' ? 440 : 720, m, lay));
  const f = path.join(base, 'semec', `semec-${lay === 'h' ? 'horizontal' : 'vertical'}-${name}`);
  jobs.push({ html, w, h, out: f + '.png', scale: 2 }, { html, w, h, out: f + '.pdf', pdf: { wcm: w / 100, hcm: h / 100 } });
}
fs.mkdirSync(path.join(base, 'semec'), { recursive: true });
for (const [n, o] of [['cor', {}], ['branco', { mono: '#fff' }], ['azul', { mono: C.navy }]]) fs.writeFileSync(path.join(base, 'semec', `simbolo-${n}.svg`), k.symbol(1000, o));
jobs.push({ html: perfil({ cat: 'sede', nome: k.SIGLA }), w: 1080, h: 1080, out: path.join(base, 'semec', 'perfil-semec.png'), transparent: false });
jobs.push({ html: center(k.symbol(620), '#fff'), w: 1080, h: 1080, out: path.join(base, 'semec', 'perfil-semec-simbolo.png'), transparent: false });

// Unidades e serviços
for (const u of [...k.UNIDADES, ...k.SERVICOS]) {
  const dir = path.join(base, u.cat === 'servico' ? 'servicos' : { escola: 'escolas', bilingue: 'escola-bilingue', creche: 'creches', cria: 'creches-cria' }[u.cat], u.slug);
  const w = 1700, h = 520;
  for (const m of ['cor', 'neg']) {
    const html = center(k.logoUnidade(u, 300, m));
    jobs.push({ html, w, h, out: path.join(dir, `logo-${m === 'cor' ? 'cor' : 'negativo'}.png`), scale: 2 });
    if (m === 'cor') jobs.push({ html, w, h, out: path.join(dir, 'logo-cor.pdf'), pdf: { wcm: 17, hcm: 5.2 } });
  }
  jobs.push({ html: center(k.selo(u, 800)), w: 1000, h: 1000, out: path.join(dir, 'selo.png') });
  jobs.push({ html: perfil(u), w: 1080, h: 1080, out: path.join(dir, 'perfil.png'), transparent: false });
}
module.exports = { perfil };
if (require.main === module) k.renderAll(jobs, { label: 'logos' });
