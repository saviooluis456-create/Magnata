// Impressos e campanhas: cartaz, banner roll-up, faixa, backdrop, placa de foto, post e selo — por evento, categoria e unidade.
const k = require('./core.js');
const path = require('path');
const { C, OUT, icon, burst, sparkle, stripe } = k;
const jobs = [];
const A = (style, inner = '') => `<div class="abs" style="${style}">${inner}</div>`;
const on = (c) => ([C.amarelo, C.ciano, '#fff', '#F2A900'].includes(c) ? C.navy : '#fff');
const E = (slug, l1, l2, sub, ic, p, a = C.amarelo, d = C.navy, motif = 'brilhos', b = C.ciano) => ({ slug, l1, l2, sub, ic, p, a, d, motif, b });
const EVENTOS = [
  E('jornada-pedagogica', 'Jornada', 'Pedagógica', 'Formação de professores', 'chalkboard-teacher', C.azul, C.amarelo, C.navy, 'lapis'),
  E('volta-as-aulas', 'Volta', 'às aulas', 'Ano letivo', 'backpack', C.turquesa, C.amarelo, C.navy, 'lapis'),
  E('matriculas', 'Matrículas', 'abertas', 'Rede municipal de ensino', 'clipboard-text', C.navy, C.amarelo, C.azul),
  E('busca-ativa', 'Fora da escola', 'não pode!', 'Busca Ativa Escolar', 'magnifying-glass', C.laranja, C.amarelo),
  E('festa-da-padroeira', 'Nossa Senhora', 'do Pilar', 'Festa da Padroeira', 'church', C.vermelho, C.amarelo, '#7A0E14'),
  E('carnaval', 'Carnaval', 'na escola', 'Folia com alegria e respeito', 'mask-happy', C.roxo, C.amarelo, C.navy, 'confete', C.rosa),
  E('aniversario-de-pilar', 'Viva', 'Pilar!', 'Aniversário da cidade', 'confetti', C.navy, C.amarelo, C.azul, 'confete'),
  E('pascoa', 'Feliz', 'Páscoa', 'Tempo de renovar', 'egg', C.rosa, C.amarelo, C.roxo),
  E('dia-das-maes', 'Feliz dia', 'das mães', 'Homenagem da Educação', 'heart', C.rosa, '#fff', '#B8125F'),
  E('maio-laranja', 'Maio', 'Laranja', 'Proteger é dever de todos', 'flower', C.laranja, '#fff', '#B84A00'),
  E('sao-joao', 'Arraiá da', 'Educação', 'São João na escola', 'campfire', '#E8451E', C.amarelo, '#3A1A6B', 'bandeirinhas', C.verde),
  E('dia-dos-pais', 'Feliz dia', 'dos pais', 'Homenagem da Educação', 'heart', C.azul, C.amarelo),
  E('dia-do-estudante', 'Dia do', 'Estudante', '11 de agosto', 'student', C.verde, C.amarelo, '#0A3F2A'),
  E('folclore', 'Semana do', 'Folclore', 'Nossa cultura, nossa raiz', 'guitar', '#B5651D', C.amarelo, '#4A2508', 'bandeirinhas', C.vermelho),
  E('desfile-civico', 'Desfile', 'Cívico', '7 de Setembro', 'flag-banner', C.verde, C.amarelo, C.navy),
  E('setembro-amarelo', 'Setembro', 'Amarelo', 'Falar é a melhor solução', 'hand-heart', '#F2B500', C.navy, C.navy),
  E('semana-da-crianca', 'Semana da', 'Criança', 'Brincar também é aprender', 'balloon', C.ciano, C.amarelo, C.navy, 'confete', C.rosa),
  E('dia-do-professor', 'Feliz dia do', 'Professor', '15 de outubro', 'apple-logo', C.vermelho, C.amarelo, C.navy, 'lapis'),
  E('consciencia-negra', 'Consciência', 'Negra', 'Pilar do Preto · 20 de novembro', 'hand-fist', '#2B1B12', C.amarelo, '#120A06', 'brilhos', C.vermelho),
  E('festival-de-cinema', 'Festival de', 'Cinema', 'Cine Pilarense', 'film-slate', C.navy, C.vermelho, C.navy2),
  E('natal', 'Feliz', 'Natal', 'Natal da Educação', 'tree-evergreen', '#C8102E', C.amarelo, '#0B5A32', 'estrelas', C.verde),
  E('formatura', 'Formatura', 'do ABC', 'Uma conquista de toda a família', 'graduation-cap', C.navy, C.amarelo, C.azul, 'confete'),
  E('feira-de-ciencias', 'Feira de', 'Ciências', 'Mostra do conhecimento', 'flask', C.roxo, C.ciano, C.navy),
  E('jogos-escolares', 'Jogos', 'Escolares', 'Esporte que educa', 'trophy', C.verde, C.amarelo, C.navy),
  E('semana-da-leitura', 'Semana da', 'Leitura', 'Ler é viajar sem sair do lugar', 'books', C.turquesa, C.amarelo, C.navy, 'lapis', C.laranja),
  E('familia-na-escola', 'Família', 'na escola', 'Juntos pela aprendizagem', 'users-three', C.azul, C.amarelo, C.navy, 'brilhos', C.rosa),
  E('semana-da-inclusao', 'Semana da', 'Inclusão', 'Cada um do seu jeito, todos juntos', 'puzzle-piece', C.roxo, C.amarelo),
  E('conferencia-de-educacao', 'Conferência', 'de Educação', 'Participação e compromisso', 'microphone-stage', C.navy, C.ciano, C.azul),
  E('meio-ambiente', 'Semana do', 'Meio Ambiente', 'Cuidar hoje para ter amanhã', 'leaf', C.verde, C.amarelo, '#0A3F2A'),
  E('avaliacoes', 'Hora de mostrar', 'o saber!', 'Avaliações externas', 'exam', C.azul, C.amarelo),
  E('reuniao-de-pais', 'Reunião de', 'pais e mestres', 'Sua presença faz a diferença', 'handshake', C.turquesa, C.amarelo),
  E('encerramento-do-ano', 'Encerramento', 'do ano letivo', 'Missão cumprida!', 'star', C.navy, C.amarelo, C.azul, 'estrelas'),
  E('consulta-publica', 'Educação', 'que transforma', 'Institucional', null, C.azul, C.amarelo),
];

// ---------- motivos decorativos ----------
function motif(e, W, H) {
  const u = Math.min(W, H) / 100; let o = '';
  const rnd = (i, m) => ((i * 9301 + 49297) % 233280) / 233280 * m;
  if (e.motif === 'bandeirinhas') {
    const cols = [C.amarelo, C.verde, e.b, '#fff', C.rosa, C.ciano]; const n = Math.round(W / (u * 9));
    for (let r = 0; r < 2; r++) { let fl = ''; for (let i = 0; i < n; i++) { const x = (i + (r ? .5 : 0)) * (W / n), y = (r ? 7 : 0) * u + Math.sin((i / n) * Math.PI) * u * 5; fl += `<path d="M${x} ${y}h${u * 6.4}l${-u * 3.2} ${u * 8}Z" fill="${cols[(i + r * 2) % cols.length]}"/>`; } o += A('left:0;top:0', `<svg width="${W}" height="${u * 24}">${fl}</svg>`); }
  } else if (e.motif === 'confete') {
    const cols = [C.amarelo, C.verde, C.vermelho, C.ciano, '#fff', C.rosa];
    for (let i = 0; i < 60; i++) o += A(`left:${rnd(i + 3, W)}px;top:${rnd(i * 7 + 1, H)}px;width:${u * (i % 3 ? 1.6 : 3)}px;height:${u * (i % 3 ? 1.6 : 1)}px;border-radius:${i % 3 === 1 ? '50%' : u * .3 + 'px'};background:${cols[i % 6]};transform:rotate(${rnd(i, 180)}deg);opacity:.9`);
  } else if (e.motif === 'estrelas') {
    for (let i = 0; i < 26; i++) o += A(`left:${rnd(i + 5, W)}px;top:${rnd(i * 11 + 2, H)}px;opacity:${i % 2 ? .9 : .5}`, sparkle(u * (2 + (i % 4) * 1.4), i % 3 ? '#fff' : e.a));
  } else if (e.motif === 'lapis') {
    o += A(`right:${-u * 6}px;top:${H * .1}px;transform:rotate(-52deg)`, k.pencil(u * 46, C.amarelo, u * 5)) + A(`left:${-u * 8}px;bottom:${H * .2}px;transform:rotate(34deg)`, k.pencil(u * 40, e.b === C.ciano ? C.vermelho : e.b, u * 4.4));
  }
  if (e.motif !== 'estrelas') for (let i = 0; i < 6; i++) o += A(`left:${rnd(i + 40, W * .9)}px;top:${rnd(i * 13 + 9, H * .9)}px;opacity:.85`, sparkle(u * (2.4 + (i % 3) * 1.6), i % 2 ? '#fff' : e.a));
  return o;
}
function bg(e, W, H, pat = true) {
  const u = Math.min(W, H) / 100;
  return `<div class="fill" style="background:${e.p}"></div>${pat ? `<div class="fill" style="background-image:${k.pattern(e.p === '#F2B500' ? 'rgba(27,31,94,.06)' : 'rgba(255,255,255,.07)', u * 16)}"></div>` : ''}
${A(`left:${-u * 22}px;top:${-u * 22}px;transform:rotate(10deg)`, burst(u * 62, 16, .74, e.d))}${A(`right:${-u * 24}px;bottom:${-u * 20}px`, burst(u * 64, 16, .74, e.b === C.ciano && e.p === C.azul ? C.verde : e.b))}${motif(e, W, H)}`;
}
// Título do evento. fs = corpo da linha principal
function lockup(e, fs, align = 'center', unit = null) {
  const ink = e.p === '#F2B500' ? C.navy : '#fff', al = align === 'center' ? 'center' : 'flex-start';
  const badge = e.ic ? `<div style="position:relative;width:${fs * 1.5}px;height:${fs * 1.5}px;margin-bottom:${-fs * .12}px"><div class="abs" style="inset:0;transform:rotate(8deg)">${burst(fs * 1.5, 14, .76, e.a)}</div><div class="fill" style="display:flex;align-items:center;justify-content:center">${icon(e.ic === 'apple-logo' ? 'chalkboard-teacher' : e.ic, on(e.a), fs * .78)}</div></div>` : `<div style="background:#fff;border-radius:28%;width:${fs * 1.3}px;height:${fs * 1.3}px;display:flex;align-items:center;justify-content:center;margin-bottom:${fs * .1}px">${k.symbol(fs * .9)}</div>`;
  const long = Math.max(e.l1.length, e.l2.length), f = long > 14 ? fs * .78 : long > 11 ? fs * .9 : fs;
  return `<div style="display:flex;flex-direction:column;align-items:${al};text-align:${align};gap:${fs * .1}px">${badge}
<div style="font-weight:800;font-size:${fs * .2}px;letter-spacing:.16em;text-transform:uppercase;color:${on(e.d)};background:${e.d};padding:${fs * .07}px ${fs * .22}px;border-radius:${fs}px;white-space:nowrap">${unit ? unit : e.sub}</div>
<div class="an" style="font-size:${f}px;color:${ink};white-space:nowrap;margin-top:${fs * .04}px">${e.l1}</div>
<div class="an" style="font-size:${f * 1.12}px;background:${e.a};color:${on(e.a)};padding:${f * .06}px ${f * .26}px ${f * .1}px;border-radius:${f * .1}px;transform:rotate(-3deg);white-space:nowrap;box-shadow:${f * .07}px ${f * .07}px 0 ${e.d}">${e.l2}</div></div>`;
}
function info(e, fs, dir = 'column') {
  const row = (ic, t) => `<div style="display:flex;align-items:center;gap:${fs * .5}px"><div style="width:${fs * 1.9}px;height:${fs * 1.9}px;border-radius:${fs * .5}px;background:${e.p === '#F2B500' ? C.navy : e.p};display:flex;align-items:center;justify-content:center;flex:none">${icon(ic, '#fff', fs * 1.1)}</div><span style="font-weight:700;font-size:${fs}px;color:${C.navy};white-space:nowrap">${t}</span></div>`;
  return `<div style="display:flex;flex-direction:${dir};gap:${fs * (dir === 'row' ? 1.4 : .6)}px">${row('calendar-blank', '00 de mês de 0000')}${row('clock', 'às 00h00')}${row('map-pin', 'Local do evento')}</div>`;
}
const foot = (W, h, unit) => A(`left:0;right:0;bottom:0;height:${h}px;background:#fff;display:flex;align-items:center;justify-content:${W < 900 ? 'center' : 'space-between'};padding:0 ${h * .5}px`, `${k.assinatura(unit, h * .56)}<div class="${W < 900 ? 'hid' : ''}" style="display:flex;flex-direction:column;align-items:flex-end;gap:${h * .1}px">${stripe(h * 1.5, h * .08)}<span style="font-weight:800;font-size:${h * .13}px;letter-spacing:.2em;color:${C.navy};white-space:nowrap">PREFEITURA DE PILAR</span></div>`) + A(`left:0;right:0;bottom:${h}px;height:${h * .09}px;display:flex`, [C.vermelho, C.verde, C.amarelo, C.azul].map((c) => `<i style="flex:1;background:${c}"></i>`).join(''));

const tileLogo = (un, size, neg) => { const t = un && un.cat !== 'sede' ? k.temaDe(un) : null; const nome = t ? un.nome : k.SIGLA; const fs = nome.length > 20 ? .1 : nome.length > 12 ? .125 : nome.length > 7 ? .16 : .3;
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:${size * .06}px;text-align:center;padding:0 ${size * .08}px;color:${neg ? '#fff' : C.navy}">${t ? k.selo(un, size * .38, neg ? { bg: 'rgba(255,255,255,.18)' } : {}) : k.symbol(size * .44, neg ? { r: C.ciano } : {})}<div class="an" style="font-size:${size * fs}px;line-height:1">${nome}</div></div>`; };
const PECAS = {
  cartaz: { w: 1190, h: 1684, cm: [29.7, 42], nome: 'cartaz-A3', sc: 1.25, fn: (e, W, H, un) => bg(e, W, H) + A(`left:0;right:0;top:${H * .1}px;display:flex;justify-content:center`, lockup(e, 150, 'center', un && un.tipoLabel)) + A(`left:${W * .1}px;right:${W * .1}px;top:${H * .6}px;background:#fff;border-radius:44px;padding:54px 60px;box-shadow:0 24px 50px rgba(0,0,0,.22)`, `${info(e, 38)}<div style="margin-top:38px;height:10px;border-radius:5px;background:${C.gelo}"></div><div style="margin-top:20px;height:10px;width:70%;border-radius:5px;background:${C.gelo}"></div>`) + foot(W, 190, un) },
  banner: { w: 800, h: 2000, cm: [80, 200], nome: 'banner-rollup-80x200cm', sc: 1, fn: (e, W, H, un) => bg(e, W, H) + A(`left:0;right:0;top:${H * .05}px;display:flex;justify-content:center`, `<div style="background:#fff;border-radius:80px;padding:20px 44px 20px 28px">${k.assinatura(un, 92)}</div>`) + A(`left:0;right:0;top:${H * .2}px;display:flex;justify-content:center`, lockup(e, 116, 'center', un && un.tipoLabel)) + A(`left:70px;right:70px;top:${H * .535}px;height:${H * .19}px;border-radius:40px;border:8px dashed rgba(255,255,255,.55);display:flex;align-items:center;justify-content:center`, `<span style="font-weight:700;font-size:26px;letter-spacing:.14em;color:${e.p === '#F2B500' ? C.navy : '#fff'};opacity:.8">ÁREA PARA FOTO OU TEXTO</span>`) + A(`left:70px;right:70px;top:${H * .752}px;background:#fff;border-radius:36px;padding:34px 40px`, info(e, 30)) + foot(W, 170, un) },
  faixa: { w: 1500, h: 500, cm: [300, 100], nome: 'faixa-300x100cm', sc: 1.4, fn: (e, W, H, un) => bg(e, W, H) + A(`left:90px;top:0;bottom:70px;display:flex;align-items:center`, `<div style="transform:scale(.9);transform-origin:left center">${lockup(e, 92, 'left', un && un.tipoLabel)}</div>`) + A(`right:70px;top:70px;background:#fff;border-radius:30px;padding:30px 36px;box-shadow:0 14px 30px rgba(0,0,0,.2)`, info(e, 27)) + foot(W, 84, un) },
  backdrop: { w: 1500, h: 1000, cm: [300, 200], nome: 'backdrop-300x200cm', sc: 1.4, fn: (e, W, H, un) => {
    let tiles = ''; const cols = 6, rows = 4, tw = W / cols, th = H / rows; const cs = [e.p, e.d, e.a, '#fff'];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const col = cs[(c + r * 2) % 4], ink = on(col) === '#fff' ? 'neg' : 'cor'; const kind = (c + r) % 3;
      const inner = kind === 0 ? tileLogo(un, th, col !== '#fff' && ink === 'neg') : kind === 1 ? `<div class="an" style="font-size:${th * .17}px;color:${col === '#fff' ? e.p === '#F2B500' ? C.navy : e.p : on(col)};text-align:center;line-height:1">${e.l1}<br>${e.l2}</div>` : (e.ic ? icon(e.ic === 'apple-logo' ? 'chalkboard-teacher' : e.ic, col === '#fff' ? (e.p === '#F2B500' ? C.navy : e.p) : on(col), th * .44) : k.symbol(th * .44, col === '#fff' ? {} : { mono: on(col) }));
      tiles += A(`left:${c * tw}px;top:${r * th}px;width:${tw}px;height:${th}px;background:${col};display:flex;align-items:center;justify-content:center`, inner); }
    return tiles;
  } },
  placa: { w: 900, h: 1200, cm: [60, 80], nome: 'placa-de-foto-60x80cm', sc: 1.3, fn: (e, W, H, un) => `<div class="fill" style="border:70px solid ${e.p};border-top-width:250px;border-bottom-width:230px;border-radius:40px"></div>` + A('left:0;right:0;top:36px;display:flex;flex-direction:column;align-items:center;gap:6px', `<div class="an" style="font-size:${Math.max(e.l1.length, e.l2.length) > 13 ? 62 : 78}px;color:${e.p === '#F2B500' ? C.navy : '#fff'};white-space:nowrap">${e.l1}</div><div class="an" style="font-size:${Math.max(e.l1.length, e.l2.length) > 13 ? 68 : 86}px;background:${e.a};color:${on(e.a)};padding:4px 22px 8px;border-radius:8px;transform:rotate(-3deg);white-space:nowrap;box-shadow:5px 5px 0 ${e.d}">${e.l2}</div>`) + A(`left:20px;top:190px;transform:rotate(-12deg)`, burst(150, 14, .74, e.a)) + A('left:63px;top:233px', e.ic ? icon(e.ic === 'apple-logo' ? 'chalkboard-teacher' : e.ic, on(e.a), 64) : k.symbol(62, { mono: on(e.a) })) + A('left:0;right:0;bottom:36px;display:flex;flex-direction:column;align-items:center;gap:14px', `<div style="display:flex;gap:22px">${['heart', 'chat-circle', 'paper-plane-tilt'].map((i) => icon(i, e.p === '#F2B500' ? C.navy : '#fff', 44)).join('')}</div><div style="background:#fff;border-radius:60px;padding:12px 30px 12px 18px">${k.assinatura(un, 64)}</div>`) + A(`right:40px;bottom:190px;transform:rotate(10deg)`, burst(130, 12, .66, e.a)) },
  post: { w: 1080, h: 1350, nome: 'post-1080x1350', sc: 1, fn: (e, W, H, un) => bg(e, W, H) + A(`left:0;right:0;top:${H * .14}px;display:flex;justify-content:center`, lockup(e, 150, 'center', un && un.tipoLabel)) + A('left:0;right:0;bottom:80px;display:flex;justify-content:center', `<div style="background:#fff;border-radius:80px;padding:18px 44px 18px 26px;box-shadow:0 14px 30px rgba(0,0,0,.2)">${k.assinatura(un, 96)}</div>`) },
  story: { w: 1080, h: 1920, nome: 'story-1080x1920', sc: 1, fn: (e, W, H, un) => bg(e, W, H) + A(`left:0;right:0;top:${H * .2}px;display:flex;justify-content:center`, lockup(e, 150, 'center', un && un.tipoLabel)) + A('left:0;right:0;bottom:330px;display:flex;justify-content:center', `<div style="background:#fff;border-radius:80px;padding:18px 44px 18px 26px;box-shadow:0 14px 30px rgba(0,0,0,.2)">${k.assinatura(un, 100)}</div>`) },
  selo: { w: 1400, h: 1000, nome: 'titulo-transparente', sc: 1, transparent: true, fn: (e, W, H) => A('inset:0;display:flex;align-items:center;justify-content:center', lockup(e, 190)) },
};
function add(e, dir, pecas, un) {
  for (const p of pecas) { const P = PECAS[p], html = P.fn(e, P.w, P.h, un);
    jobs.push({ html, w: P.w, h: P.h, out: path.join(dir, P.nome + '.png'), transparent: !!P.transparent || p === 'placa', scale: P.sc });
    if (P.cm) jobs.push({ html: p === 'placa' ? `<div class="fill" style="background:#fff"></div>` + html : html, w: P.w, h: P.h, out: path.join(dir, P.nome + '.pdf'), pdf: { wcm: P.cm[0], hcm: P.cm[1] } }); }
}
for (const e of EVENTOS) add(e, path.join(OUT, '08-impressos', 'eventos-e-campanhas', e.slug), Object.keys(PECAS));
// Institucional por categoria e por unidade/serviço
const inst = (t, l1, l2, sub, ic) => E('x', l1, l2, sub, ic, t.p, t.a, t.d, 'brilhos', t.b);
for (const [cat, t] of Object.entries(k.TEMAS)) add(inst(t, cat === 'bilingue' ? 'Welcome!' : 'Seja', cat === 'bilingue' ? 'Bem-vindos!' : 'bem-vindo!', t.nome, k.ICONE_CAT[cat]), path.join(OUT, '08-impressos', 'institucional', 'tema-' + cat), ['banner', 'faixa', 'backdrop', 'cartaz', 'placa'], cat === 'bilingue' ? k.UNIDADES.find((x) => x.cat === 'bilingue') : null);
for (const u of [...k.UNIDADES, ...k.SERVICOS]) { const t = k.temaDe(u); add({ ...inst(t, u.cat === 'servico' ? 'Estamos' : 'Seja', u.cat === 'servico' ? 'aqui por você' : 'bem-vindo!', u.cat === 'servico' ? u.nome : u.tipo.split(' · ')[0], u.icone || k.ICONE_CAT[u.cat]) }, path.join(OUT, '08-impressos', 'institucional', u.cat === 'servico' ? 'servicos' : 'unidades', u.slug), ['banner', 'backdrop'], u); }
module.exports = { EVENTOS, lockup, bg, A, on, PECAS };
if (require.main === module) { const only = process.argv[2]; k.renderAll(only ? jobs.filter((j) => j.out.includes(only)) : jobs, { label: 'print', concurrency: 6 }); }
