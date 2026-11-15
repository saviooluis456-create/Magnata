// Uniformes (mockups vetoriais frente/costas) e crachás (frente, verso, cordão).
const k = require('./core.js');
const path = require('path');
const { C, OUT, icon, burst, stripe } = k;
const jobs = [];
const onC = (c) => ([C.amarelo, C.ciano, '#fff', '#F2A900', '#FFFFFF'].includes(c) ? C.navy : '#fff');

// ---------- Camisa ----------
// o: { body, sleeve, trim, polo, back, vest }
function shirt(o, overlay = '') {
  const { body, sleeve, trim, polo, back, vest } = o;
  const neck = back ? 'M196 44C240 62 360 62 404 44' : 'M196 44C236 96 364 96 404 44';
  const sl = vest ? '' : `<path d="M196 44L84 84 12 206l92 50 34-58 20-96Z" fill="${sleeve}"/><path d="M404 44l112 40 72 122-92 50-34-58-20-96Z" fill="${sleeve}"/>
<path d="M12 206l92 50 8-20-90-48Z" fill="${trim}"/><path d="M588 206l-92 50-8-20 90-48Z" fill="${trim}"/>`;
  const bodyPath = vest ? `M210 40C240 ${back ? 70 : 150} 360 ${back ? 70 : 150} 390 40L452 62C440 130 452 190 474 232V612Q300 632 126 612V232C148 190 160 130 148 62Z` : `M196 44${neck.slice(7)}L462 108 462 612Q300 632 138 612L138 108Z`;
  const collar = polo && !back ? `<path d="M196 44L300 128 252 168 170 58Z" fill="${trim}"/><path d="M404 44L300 128 348 168 430 58Z" fill="${trim}"/><rect x="286" y="124" width="28" height="110" rx="4" fill="${trim}"/><circle cx="300" cy="158" r="5" fill="#fff"/><circle cx="300" cy="196" r="5" fill="#fff"/>`
    : polo ? `<path d="M196 44C240 62 360 62 404 44L420 62C360 84 240 84 180 62Z" fill="${trim}"/>`
      : vest ? '' : `<path d="${neck}" fill="none" stroke="${trim}" stroke-width="16" stroke-linecap="round"/>`;
  const refl = vest ? `<rect x="126" y="430" width="348" height="34" fill="#E9EDF5" opacity=".95"/><rect x="126" y="436" width="348" height="8" fill="${trim}"/>${back ? '' : `<rect x="292" y="${150}" width="16" height="470" fill="rgba(0,0,0,.18)"/>`}` : `<path d="M138 560Q300 580 462 560V612Q300 632 138 612Z" fill="${trim}" opacity="0"/>`;
  const side = vest ? '' : `<path d="M138 108l34 0 0 508-34-4Z" fill="${sleeve}"/><path d="M462 108l-34 0 0 508 34-4Z" fill="${sleeve}"/><rect x="172" y="108" width="8" height="508" fill="${trim}"/><rect x="420" y="108" width="8" height="508" fill="${trim}"/>`;
  return `<div style="position:relative;width:600px;height:650px;filter:drop-shadow(0 26px 30px rgba(15,20,70,.28))"><svg width="600" height="650" viewBox="0 0 600 650">
<defs><linearGradient id="sh" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".16"/><stop offset=".22" stop-color="#000" stop-opacity="0"/><stop offset=".78" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient><clipPath id="bd"><path d="${bodyPath}"/></clipPath></defs>
<path d="${bodyPath}" fill="${body}" stroke="rgba(27,31,94,.16)" stroke-width="3"/>${sl}<g clip-path="url(#bd)">${side}${refl}<rect x="100" y="0" width="400" height="650" fill="url(#sh)"/><path d="M190 300q40 50 20 130M410 320q-36 60-14 150" fill="none" stroke="#000" stroke-opacity=".06" stroke-width="10" stroke-linecap="round"/></g>${collar}</svg>${overlay}</div>`;
}
const emblema = (u, mode, size) => (u && u.cat !== 'sede' ? k.selo(u, size, mode === 'neg' ? { bg: 'rgba(255,255,255,.18)' } : {}) : `<div style="width:${size}px;height:${size}px;border-radius:28%;background:${mode === 'neg' ? 'rgba(255,255,255,.14)' : '#fff'};display:flex;align-items:center;justify-content:center">${k.symbol(size * .7, mode === 'neg' ? { r: C.ciano } : {})}</div>`);
const chest = (u, mode) => `<div class="abs" style="left:356px;top:172px">${emblema(u, mode, 74)}</div>`;
const chestBig = (u, mode) => {
  const nome = u && u.cat !== 'sede' ? u.nome : k.SIGLA, fs = nome.length > 22 ? 28 : nome.length > 14 ? 36 : nome.length > 9 ? 46 : 66;
  return `<div class="abs" style="left:185px;width:230px;top:190px;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;color:${mode === 'neg' ? '#fff' : C.navy}">${emblema(u, mode, 120)}<div class="an" style="font-size:${fs}px">${nome}</div>${stripe(110, 7)}</div>`;
};
function backPrint(u, t, ink, linha2) {
  const nome = u && u.cat !== 'sede' ? u.nome : k.SIGLA; const fs = nome.length > 24 ? 34 : nome.length > 16 ? 44 : nome.length > 10 ? 56 : 84;
  return `<div class="abs" style="left:190px;width:220px;top:170px;text-align:center;color:${ink}"><div style="display:flex;justify-content:center;margin-bottom:10px">${k.symbol(54, ink === '#fff' ? { head: t.a, l: '#fff', r: '#fff', base: t.a } : {})}</div><div class="an" style="font-size:${fs}px;line-height:.98">${nome}</div><div style="display:flex;justify-content:center;margin:12px 0 10px">${stripe(120, 7)}</div><div style="font-weight:800;font-size:13px;letter-spacing:.14em;text-transform:uppercase;line-height:1.35">${linha2}</div></div>`;
}
function sheet(title, sub, t, a, b, u) {
  return `<div class="fill" style="background:linear-gradient(160deg,#F5F7FC,#E3E8F3)"></div><div class="fill" style="background-image:${k.pattern('rgba(27,31,94,.035)', 190)}"></div>
<div class="abs" style="left:-120px;top:-130px">${burst(420, 14, .72, t.p)}</div><div class="abs" style="right:-130px;bottom:-140px">${burst(340, 14, .72, t.a)}</div>
<div class="abs" style="left:330px;top:60px;right:60px"><div style="font-weight:800;font-size:24px;letter-spacing:.2em;text-transform:uppercase;color:${t.p === C.amarelo ? C.navy : t.p}">${sub}</div><div class="an" style="font-size:78px;color:${C.navy};margin-top:4px">${title}</div></div>
<div class="abs" style="left:150px;top:250px;transform:scale(1.18);transform-origin:left top">${a}</div><div class="abs" style="left:980px;top:250px;transform:scale(1.18);transform-origin:left top">${b}</div>
<div class="abs" style="left:410px;top:1040px;font-weight:800;font-size:24px;letter-spacing:.24em;color:${C.navy};opacity:.6">FRENTE</div><div class="abs" style="left:1250px;top:1040px;font-weight:800;font-size:24px;letter-spacing:.24em;color:${C.navy};opacity:.6">COSTAS</div>
<div class="abs" style="right:70px;top:70px">${k.assinatura(u, 84)}</div><div class="abs" style="left:70px;bottom:62px">${stripe(260, 12)}</div>`;
}
function uniformes(u, dir) {
  const t = u.cat === 'sede' ? k.TEMAS.sede : k.temaDe(u), nome = u.cat === 'sede' ? 'Sede ' + k.SIGLA : u.nome;
  const add = (file, title, sub, a, b) => jobs.push({ html: sheet(title, sub, t, a, b, u.cat === 'sede' ? null : u), w: 1800, h: 1150, out: path.join(dir, file + '.jpg'), transparent: false, scale: 1.25 });
  const inkP = onC(t.p);
  if (['escola', 'bilingue', 'creche', 'cria'].includes(u.cat)) {
    const oA = { body: '#FFFFFF', sleeve: t.p, trim: t.a };
    add('fardamento-aluno', nome, 'Fardamento do aluno', shirt(oA, chest(u, 'cor')), shirt({ ...oA, back: true }, backPrint(u, t, C.navy, u.tipo.split(' · ')[0] + '<br>' + k.SIGLA + ' · Pilar')));
    const oE = { body: t.p, sleeve: t.p, trim: t.a };
    add('fardamento-educacao-fisica', nome, 'Educação física', shirt(oE, chestBig(u, 'neg')), shirt({ ...oE, back: true }, backPrint(u, t, inkP, 'Educação que<br>transforma')));
  }
  const oP = { body: t.p === C.navy ? C.navy : C.navy, sleeve: C.navy, trim: t.cat === 'x' ? t.a : (t.p === C.navy ? t.a : t.p), polo: true };
  add('polo-equipe', nome, 'Camisa polo · equipe', shirt(oP, chest(u.cat === 'sede' ? null : u, 'neg')), shirt({ ...oP, back: true }, backPrint(u, t, '#fff', u.cat === 'servico' ? k.SIGLA + ' · Pilar' : 'Equipe ' + k.SIGLA + '<br>Educação e Cultura')));
  if (u.cat === 'servico' || u.cat === 'sede') {
    const oT = { body: '#FFFFFF', sleeve: t.p, trim: t.a };
    add('camiseta-acao', nome, 'Camiseta de ação / evento', shirt(oT, chestBig(u.cat === 'sede' ? null : u, 'cor')), shirt({ ...oT, back: true }, backPrint(u, t, C.navy, 'Educação e Cultura<br>Prefeitura de Pilar')));
  }
  if (['busca-ativa', 'transporte-escolar', 'comunicacao', 'infraestrutura', 'alimentacao-escolar'].includes(u.slug)) {
    const oV = { body: t.p, trim: t.a, vest: true };
    add('colete', nome, 'Colete de identificação', shirt(oV, chest(u, 'neg')), shirt({ ...oV, back: true }, backPrint(u, t, inkP, k.SIGLA + ' · Pilar').replace('top:170px', 'top:150px')));
  }
}

// ---------- Crachá (54 x 86 mm → 540x860) ----------
function crachaFrente(u, t, cargo) {
  return `<div class="fill" style="background:#fff;border-radius:34px;overflow:hidden">
<div class="abs" style="left:0;right:0;top:0;height:400px;background:${t.p}"></div><div class="abs" style="left:0;right:0;top:0;height:400px;background-image:${k.pattern('rgba(255,255,255,.08)', 120)}"></div>
<div class="abs" style="left:0;top:300px"><svg width="540" height="130" viewBox="0 0 540 130"><path d="M0 60C120 0 260 110 400 50S520 30 540 40V130H0Z" fill="${t.a}"/><path d="M0 84C120 24 260 134 400 74S520 54 540 64V130H0Z" fill="#fff"/></svg></div>
<div class="abs" style="left:215px;top:26px;width:110px;height:26px;border-radius:13px;background:rgba(0,0,0,.28)"></div>
<div class="abs" style="left:0;right:0;top:74px;display:flex;justify-content:center">${k.assinatura(u, 74, 'neg')}</div>
<div class="abs" style="left:150px;top:180px;width:240px;height:290px;border-radius:30px;background:#E6EAF2;border:10px solid #fff;box-shadow:0 10px 24px rgba(10,14,60,.25);display:flex;align-items:flex-end;justify-content:center;overflow:hidden">${icon('user', '#B9C2D6', 250)}</div>
<div class="abs" style="left:40px;right:40px;top:496px;text-align:center"><div style="height:58px;border-bottom:4px solid ${C.gelo}"></div><div style="font-weight:800;font-size:17px;letter-spacing:.2em;color:#9AA3BA;margin-top:8px">NOME</div></div>
<div class="abs" style="left:0;right:0;top:612px;display:flex;justify-content:center"><span class="an" style="background:${t.p};color:${onC(t.p)};font-size:44px;padding:8px 26px 10px;border-radius:10px;transform:rotate(-2deg)">${cargo}</span></div>
<div class="abs" style="left:40px;right:40px;top:716px;display:flex;gap:16px"><div style="flex:1"><div style="height:40px;border-bottom:4px solid ${C.gelo}"></div><div style="font-weight:800;font-size:14px;letter-spacing:.16em;color:#9AA3BA;margin-top:6px">MATRÍCULA</div></div><div style="flex:1"><div style="height:40px;border-bottom:4px solid ${C.gelo}"></div><div style="font-weight:800;font-size:14px;letter-spacing:.16em;color:#9AA3BA;margin-top:6px">SETOR / TURMA</div></div></div>
<div class="abs" style="left:0;right:0;bottom:0;height:18px;display:flex"><i style="flex:1;background:${C.vermelho}"></i><i style="flex:1;background:${C.verde}"></i><i style="flex:1;background:${C.amarelo}"></i><i style="flex:1;background:${C.azul}"></i></div></div>`;
}
function crachaVerso(u, t) {
  const campo = (l, w = '100%') => `<div style="width:${w}"><div style="height:38px;border-bottom:3px solid rgba(255,255,255,.35)"></div><div style="font-weight:700;font-size:13px;letter-spacing:.14em;color:rgba(255,255,255,.75);margin-top:5px;text-transform:uppercase">${l}</div></div>`;
  return `<div class="fill" style="background:${t.d};border-radius:34px;overflow:hidden"><div class="fill" style="background-image:${k.pattern('rgba(255,255,255,.05)', 120)}"></div>
<div class="abs" style="left:215px;top:26px;width:110px;height:26px;border-radius:13px;background:rgba(0,0,0,.35)"></div>
<div class="abs" style="right:-90px;top:-90px">${burst(260, 14, .72, t.p)}</div>
<div class="abs" style="left:44px;top:90px">${k.logoSemec(120, 'neg')}</div>
<div class="abs" style="left:44px;right:44px;top:250px;display:flex;gap:22px;align-items:flex-start"><div style="width:170px;height:170px;border-radius:18px;background:#fff;display:flex;align-items:center;justify-content:center;flex:none">${icon('qr-code', C.navy, 140, 'regular')}</div><div style="flex:1;display:flex;flex-direction:column;gap:12px">${campo('Tipo sanguíneo')}${campo('Contato de emergência')}</div></div>
<div class="abs" style="left:44px;right:44px;top:462px;display:flex;flex-direction:column;gap:12px">${campo('Unidade / lotação')}<div style="display:flex;gap:18px">${campo('Emissão')}${campo('Validade')}</div></div>
<div class="abs" style="left:44px;right:44px;top:640px;color:#fff;font-weight:600;font-size:15.5px;line-height:1.45">Este crachá é pessoal e intransferível. Uso obrigatório nas dependências da rede municipal de ensino. Se encontrado, favor devolver à <b style="color:${t.a}">${k.ORGAO} de Pilar – AL</b>.</div>
<div class="abs" style="left:44px;right:44px;bottom:44px;display:flex;align-items:center;justify-content:space-between">${stripe(150, 10)}<span style="font-weight:800;font-size:15px;letter-spacing:.2em;color:#fff">PILAR · ALAGOAS</span></div></div>`;
}
function cordao(u, t, w = 2400, h = 80) {
  const unit = `<div style="display:flex;align-items:center;gap:26px;padding:0 30px;flex:none"><div style="transform:translateY(1px)">${k.symbol(50, { head: t.a, l: '#fff', r: '#fff', base: t.a })}</div><span class="an" style="font-size:44px;color:#fff;letter-spacing:.06em">${k.SIGLA}</span><span style="width:12px;height:12px;border-radius:50%;background:${t.a}"></span><span class="an" style="font-size:34px;color:${t.a === C.navy ? '#fff' : t.a};letter-spacing:.06em;white-space:nowrap">${u && u.cat !== 'sede' ? u.nome : 'Educação e Cultura'}</span><span style="width:12px;height:12px;border-radius:50%;background:#fff"></span><span class="an" style="font-size:34px;color:#fff;letter-spacing:.06em">Pilar</span></div>`;
  return `<div style="width:${w}px;height:${h}px;background:${t.p};display:flex;align-items:center;overflow:hidden;border-top:7px solid ${t.d};border-bottom:7px solid ${t.d}">${unit.repeat(8)}</div>`;
}
function crachaMock(u, t, cargo) {
  return `<div class="fill" style="background:linear-gradient(160deg,#F5F7FC,#DDE3F0)"></div><div class="fill" style="background-image:${k.pattern('rgba(27,31,94,.035)', 190)}"></div>
<div class="abs" style="left:356px;top:-40px;width:60px;height:330px;background:${t.p};transform:rotate(9deg);box-shadow:0 10px 20px rgba(10,14,60,.2);border-left:6px solid ${t.d};border-right:6px solid ${t.d}"></div><div class="abs" style="left:444px;top:-40px;width:60px;height:330px;background:${t.p};transform:rotate(-9deg);box-shadow:0 10px 20px rgba(10,14,60,.2);border-left:6px solid ${t.d};border-right:6px solid ${t.d}"></div>
<div class="abs" style="left:398px;top:262px;width:64px;height:70px;border-radius:14px;background:linear-gradient(#DADFEA,#9FA8BD);box-shadow:0 6px 10px rgba(0,0,0,.25)"></div>
<div class="abs" style="left:160px;top:310px;width:540px;height:860px;transform:rotate(-3deg);filter:drop-shadow(0 30px 34px rgba(15,20,70,.32))">${crachaFrente(u, t, cargo)}</div>
<div class="abs" style="left:800px;top:250px;width:540px;height:860px;transform:rotate(4deg);filter:drop-shadow(0 30px 34px rgba(15,20,70,.32))">${crachaVerso(u, t)}</div>
<div class="abs" style="left:0;top:1230px;transform:rotate(-2deg);transform-origin:left;box-shadow:0 12px 20px rgba(10,14,60,.2)">${cordao(u, t, 1600, 80)}</div>
<div class="abs" style="right:60px;top:60px;text-align:right"><div style="font-weight:800;font-size:22px;letter-spacing:.2em;color:${t.p === C.amarelo ? C.navy : t.p}">CRACHÁ + CORDÃO</div><div class="an" style="font-size:56px;color:${C.navy}">${u && u.cat !== 'sede' ? u.nome : 'Sede ' + k.SIGLA}</div></div>`;
}
const CARGOS = { sede: 'Servidor(a)', escola: 'Equipe escolar', bilingue: 'School staff', creche: 'Equipe da creche', cria: 'Equipe CRIA', servico: 'Equipe' };
function crachas(u, dir) {
  const t = u.cat === 'sede' ? k.TEMAS.sede : k.temaDe(u), uu = u.cat === 'sede' ? null : u, cargo = CARGOS[u.cat];
  jobs.push({ html: crachaFrente(uu, t, cargo), w: 540, h: 860, out: path.join(dir, 'cracha-frente.png'), scale: 2 });
  jobs.push({ html: crachaVerso(uu, t), w: 540, h: 860, out: path.join(dir, 'cracha-verso.png'), scale: 2 });
  jobs.push({ html: crachaFrente(uu, t, cargo) + `<div style="position:absolute;left:0;top:860px;width:540px;height:860px">${crachaVerso(uu, t)}</div>`, w: 540, h: 860, out: path.join(dir, 'cracha-impressao-54x86mm.pdf'), pdf: { wcm: 5.4, hcm: 8.6, n: 2 } });
  jobs.push({ html: cordao(uu, t), w: 2400, h: 80, out: path.join(dir, 'cordao-20mm.png'), transparent: false, scale: 2 });
  jobs.push({ html: crachaMock(uu, t, cargo), w: 1500, h: 1400, out: path.join(dir, 'cracha-mockup.jpg'), transparent: false });
}
const sub = (u) => (u.cat === 'sede' ? 'sede' : u.cat === 'servico' ? 'servicos/' + u.slug : 'unidades/' + u.slug);
for (const u of [{ cat: 'sede', slug: 'sede' }, ...k.UNIDADES, ...k.SERVICOS]) { uniformes(u, path.join(OUT, '05-uniformes', sub(u))); crachas(u, path.join(OUT, '06-crachas', sub(u))); }
// crachás extras da sede por função
for (const [slug, cargo] of [['professor', 'Professor(a)'], ['gestao', 'Gestão escolar'], ['visitante', 'Visitante'], ['estagiario', 'Estagiário(a)'], ['imprensa', 'Imprensa'], ['aluno', 'Estudante']]) jobs.push({ html: crachaFrente(null, slug === 'visitante' ? { ...k.TEMAS.sede, p: C.vermelho } : slug === 'aluno' ? k.TEMAS.escola : slug === 'imprensa' ? { ...k.TEMAS.sede, p: C.rosa } : k.TEMAS.sede, cargo), w: 540, h: 860, out: path.join(OUT, '06-crachas', 'funcoes', `cracha-${slug}.png`), scale: 2 });
if (require.main === module) { const only = process.argv[2]; k.renderAll(only ? jobs.filter((j) => j.out.includes(only)) : jobs, { label: 'mockups', concurrency: 6 }); }
