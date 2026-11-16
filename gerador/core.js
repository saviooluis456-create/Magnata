// Núcleo da identidade SEMEC Pilar: paleta, fontes, símbolo, dados e renderizador.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const SIGLA = 'SEMEC'; // sigla principal — altere aqui se necessário
const ORGAO = 'Secretaria Municipal de Educação e Cultura';
const OUT = path.join(__dirname, '..', 'identidade-semec');

// ---------- Paleta (cores da bandeira de Pilar + azul institucional) ----------
const C = {
  navy: '#1B1F5E', navy2: '#12143F', azul: '#0A8FE6', ciano: '#27B8F5', verde: '#00A550',
  amarelo: '#FFCA01', vermelho: '#ED1B23', laranja: '#FF7A1A', rosa: '#F0438F', roxo: '#6B3FD4',
  turquesa: '#00B5A5', branco: '#FFFFFF', gelo: '#F3F6FB', tinta: '#151833',
};

// tema = { p: primária, d: escura, a: acento, b: acento 2, on: texto sobre primária }
const T = (p, d, a, b, on = '#fff') => ({ p, d, a, b, on });
const TEMAS = {
  sede: { ...T(C.navy, C.navy2, C.amarelo, C.ciano), nome: 'Sede SEMEC' },
  escola: { ...T(C.azul, C.navy, C.amarelo, C.verde), nome: 'Escolas' },
  bilingue: { ...T(C.vermelho, C.navy, C.ciano, C.amarelo), nome: 'Escola Bilíngue' },
  creche: { ...T(C.laranja, C.navy, C.amarelo, C.ciano), nome: 'Creches e CMEIs' },
  cria: { ...T(C.verde, '#0A3F2A', C.amarelo, C.rosa), nome: 'Creches CRIA' },
  servico: { ...T(C.turquesa, C.navy, C.amarelo, C.laranja), nome: 'Serviços' },
};

// ---------- Fontes embutidas ----------
const ff = (pkg, file) => fs.readFileSync(path.join(__dirname, 'node_modules/@fontsource', pkg, 'files', file)).toString('base64');
let _fontCss;
function fontCss() {
  if (_fontCss) return _fontCss;
  const face = (fam, w, pkg, file) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${ff(pkg, file)}) format('woff2');}`;
  const subsets = ['latin', 'latin-ext'];
  let css = '';
  for (const s of subsets) {
    css += face('Anton', 400, 'anton', `anton-${s}-400-normal.woff2`);
    for (const w of [500, 600, 700, 800, 900]) css += face('Poppins', w, 'poppins', `poppins-${s}-${w}-normal.woff2`);
    for (const w of [700, 800]) css += face('Baloo 2', w, 'baloo-2', `baloo-2-${s}-${w}-normal.woff2`);
    css += face('Lilita One', 400, 'lilita-one', `lilita-one-${s}-400-normal.woff2`) + face('Alfa Slab One', 400, 'alfa-slab-one', `alfa-slab-one-${s}-400-normal.woff2`) + face('Caveat Brush', 400, 'caveat-brush', `caveat-brush-${s}-400-normal.woff2`) + face('Great Vibes', 400, 'great-vibes', `great-vibes-${s}-400-normal.woff2`) + face('DM Serif Display', 400, 'dm-serif-display', `dm-serif-display-${s}-400-normal.woff2`);
    css += face('Playfair Display', 900, 'playfair-display', `playfair-display-${s}-900-normal.woff2`) + face('Playfair Display', 700, 'playfair-display', `playfair-display-${s}-700-normal.woff2`) + `@font-face{font-family:'Playfair Display';font-weight:800;font-style:italic;src:url(data:font/woff2;base64,${ff('playfair-display', `playfair-display-${s}-800-italic.woff2`)}) format('woff2');}`;
  }
  return (_fontCss = css);
}
const BASE_CSS = () => `${fontCss()}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:transparent}
body{font-family:'Poppins',sans-serif;font-weight:600;color:${C.tinta};position:relative;overflow:hidden;-webkit-font-smoothing:antialiased}
.an{font-family:'Anton',sans-serif;font-weight:400;text-transform:uppercase;line-height:.98;letter-spacing:.01em}
.ba{font-family:'Baloo 2',sans-serif;font-weight:800;line-height:1}.li{font-family:'Lilita One',sans-serif;line-height:1}.sl{font-family:'Alfa Slab One',serif;line-height:1.02}.cv{font-family:'Caveat Brush',cursive;line-height:1}.pf{font-family:'Playfair Display',serif;line-height:1.02}.gv{font-family:'Great Vibes',cursive;line-height:1}.dm{font-family:'DM Serif Display',serif;line-height:1.02}
.hid{display:none!important}.abs{position:absolute}.fill{position:absolute;inset:0}
svg{display:block}`;

// ---------- Ícones (Phosphor, MIT) ----------
const _ic = {};
function icon(name, color = '#fff', size = 64, weight = 'fill') {
  const k = name + weight;
  if (!_ic[k]) {
    const f = path.join(__dirname, 'node_modules/@phosphor-icons/core/assets', weight, weight === 'regular' ? `${name}.svg` : `${name}-${weight}.svg`);
    _ic[k] = fs.readFileSync(f, 'utf8').replace(/<svg[^>]*>/, '').replace('</svg>', '');
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256" fill="${color}">${_ic[k]}</svg>`;
}

// ---------- Símbolo: "Livro-Gente" ----------
// Um livro aberto cujas páginas são braços erguidos; o círculo é a cabeça/sol; a base é a lagoa Manguaba.
function symbolInner(o = {}) {
  const { head = C.amarelo, l = C.verde, r = C.azul, base = C.vermelho } = o;
  return `<circle cx="100" cy="40" r="21" fill="${head}"/>
<path d="M95 86C76 68 50 60 26 62a8 8 0 0 0-8 8v62a8 8 0 0 0 8.6 8C50 138 76 142 95 158Z" fill="${l}"/>
<path d="M105 86c19-18 45-26 69-24a8 8 0 0 1 8 8v62a8 8 0 0 1-8.6 8C150 138 124 142 105 158Z" fill="${r}"/>
<path d="M30 158c26-3 50 3 70 20 20-17 44-23 70-20a7 7 0 0 1 6.5 7v6.500a7 7 0 0 1-7.5 7c-26-2-50 5-69 21-19-16-43-23-69-21a7 7 0 0 1-7.5-7V165a7 7 0 0 1 6.5-7Z" fill="${base}"/>`;
}
function symbol(size = 200, o = {}) {
  if (o.mono) o = { head: o.mono, l: o.mono, r: o.mono, base: o.mono };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size * 1.02}" viewBox="8 12 184 192">${symbolInner(o)}</svg>`;
}
const stripe = (w, h, r = h / 2) => `<div style="display:flex;width:${w}px;height:${h}px;border-radius:${r}px;overflow:hidden"><i style="flex:1;background:${C.vermelho}"></i><i style="flex:1;background:${C.verde}"></i><i style="flex:1;background:${C.amarelo}"></i><i style="flex:1;background:${C.azul}"></i></div>`;

// Logo principal. mode: 'cor' | 'neg' (para fundos escuros) | 'mono'
function logoSemec(h = 200, mode = 'cor', layout = 'h') {
  const ink = mode === 'cor' ? C.navy : mode === 'neg' ? '#fff' : mode;
  const so = mode === 'cor' ? {} : mode === 'neg' ? { r: C.ciano } : { mono: mode };
  const s = h / 200;
  if (layout === 'v') {
    return `<div style="display:inline-flex;flex-direction:column;align-items:center;gap:${10 * s}px;color:${ink}">${symbol(150 * s, so)}
<div class="an" style="font-size:${112 * s}px;letter-spacing:.02em;line-height:.9">${SIGLA}</div>
${mode === 'cor' || mode === 'neg' ? stripe(250 * s, 8 * s) : ''}
<div style="font-weight:700;font-size:${17.5 * s}px;line-height:1.25;text-align:center;letter-spacing:.06em;text-transform:uppercase">Secretaria Municipal de<br>Educação e Cultura</div>
<div style="font-weight:600;font-size:${13 * s}px;letter-spacing:.34em;text-transform:uppercase;opacity:.8">Pilar · Alagoas</div></div>`;
  }
  return `<div style="display:inline-flex;align-items:center;gap:${22 * s}px;color:${ink}">${symbol(178 * s, so)}
<div style="display:flex;flex-direction:column;gap:${7 * s}px"><div class="an" style="font-size:${120 * s}px;letter-spacing:.02em;line-height:.88">${SIGLA}</div>
${mode === 'cor' || mode === 'neg' ? stripe(268 * s, 8 * s) : `<div style="height:${8 * s}px"></div>`}
<div style="font-weight:700;font-size:${17.8 * s}px;line-height:1.22;letter-spacing:.045em;text-transform:uppercase;white-space:nowrap">Secretaria Municipal de<br>Educação e Cultura</div>
<div style="font-weight:600;font-size:${12.5 * s}px;letter-spacing:.3em;text-transform:uppercase;opacity:.8;white-space:nowrap">Prefeitura de Pilar · AL</div></div></div>`;
}

// ---------- Unidades ----------
const U = (slug, cat, tipo, nome, completo, bairro, cor) => ({ slug, cat, tipo, nome, completo, bairro, cor });
const UNIDADES = [
  U('anisio-de-souza', 'escola', 'Escola Municipal', 'Anísio de Souza', 'EMEB Anísio de Souza', '', C.amarelo),
  U('antonio-eustaquio', 'escola', 'Escola Municipal', 'Antônio Eustáquio', 'EMEB Antônio Eustáquio de Melo', '', C.verde),
  U('oseas-cardoso', 'escola', 'Escola Municipal', 'Oséas Cardoso', 'EMEB Deputado Oséas Cardoso', '', C.laranja),
  U('manoel-ramos', 'escola', 'Escola Municipal', 'Dr. Manoel Ramos', 'EMEB Dr. Manoel Ramos', '', C.rosa),
  U('renato-de-mendonca', 'escola', 'Escola Municipal', 'Renato de Mendonça', 'EMEB Embaixador Renato de Mendonça', 'Chã do Pilar', C.vermelho),
  U('jarbas-passarinho', 'escola', 'Escola Municipal', 'Jarbas Passarinho', 'EMEB Ministro Jarbas Passarinho', '', C.amarelo),
  U('nossa-senhora-do-pilar', 'escola', 'Escola Municipal', 'Nossa Senhora do Pilar', 'EMEB Nossa Senhora do Pilar', 'Centro', C.rosa),
  U('emilio-medici', 'escola', 'Escola Municipal', 'Emílio G. Médici', 'EMEB Presidente Emílio G. Médici', '', C.verde),
  U('arthur-ramos', 'escola', 'Escola Municipal', 'Arthur Ramos', 'EMEB Professor Arthur Ramos', 'Chã do Pilar', C.laranja),
  U('jorge-barros', 'escola', 'Escola Municipal', 'Jorge Barros', 'EMEB Professor Jorge Barros', 'Centro', C.vermelho),
  U('jacy-ayres', 'escola', 'Escola Municipal', 'Jacy Ayres', 'EMEB Professora Jacy da Costa Ayres', 'Chã do Pilar', C.amarelo),
  U('lourinete-barbosa', 'escola', 'Escola Municipal', 'Lourinete Barbosa', 'EMEB Professora Lourinete Barbosa', '', C.verde),
  U('sueli-chagas', 'escola', 'Escola Municipal', 'Sueli Chagas', 'EMEB Professora Sueli Cristina Santos Chagas', '', C.rosa),
  U('washington-maia', 'escola', 'Escola Municipal', 'Washington Maia', 'EMEB Vereador José Washington Melo Maia', 'Chã do Pilar', C.laranja),
  U('maria-gorete', 'escola', 'Escola Municipal', 'Maria Gorete', 'Escola Municipal Maria Gorete da Silva', 'Chã do Pilar', C.vermelho),
  U('elisabeth-macena', 'escola', 'Escola Municipal', 'Elisabeth Macena', 'Escola Municipal Elisabeth Macena dos Santos', '', C.amarelo),
  U('iraci-ferreira', 'escola', 'Escola Municipal', 'Iraci Ferreira', 'Escola Municipal Professora Iraci Ferreira dos Santos', '', C.verde),
  U('escola-bilingue', 'bilingue', 'Escola Bilíngue · Bilingual School', 'Maria Euda Omena', 'Centro Integral de Ensino Fundamental Bilíngue de Pilar Professora Maria Euda de Melo Omena', '', C.ciano),
  U('rubens-cavalcante', 'creche', 'Centro de Educação Infantil', 'Rubens Cavalcante', 'CEI Rubens Cavalcante de Barros', 'Chã do Pilar', C.amarelo),
  U('rosilene-mota', 'creche', 'CMEI', 'Rosilene Mota', 'CMEI Professora Rosilene Mota de Lima', '', C.ciano),
  U('afonso-cavalcante', 'creche', 'CMEI', 'Afonso Cavalcante', 'CMEI Afonso Cavalcante da Silva', '', C.verde),
  U('enoch-cavalcanti', 'creche', 'Creche Municipal', 'Enoch Cavalcanti', 'Creche Enoch Cavalcanti de Barros', 'Chã do Pilar', C.rosa),
  U('padre-eduardo-tadeu', 'creche', 'Creche Municipal', 'Padre Eduardo Tadeu', 'Creche Padre Eduardo Tadeu Lopes da Silva', 'Chã do Pilar', C.amarelo),
  U('tia-mariinha', 'creche', 'Creche Municipal', 'Tia Mariinha', 'Creche Tia Mariinha', 'Chã do Pilar', C.ciano),
  U('cria-unidade-1', 'cria', 'Creche CRIA', 'Unidade I', 'Creche CRIA Pilar — Unidade I', '', C.amarelo),
  U('cria-unidade-2', 'cria', 'Creche CRIA', 'Unidade II', 'Creche CRIA Pilar — Unidade II', '', C.rosa),
];

const S = (slug, nome, icone, p, a = C.amarelo) => ({ slug, cat: 'servico', tipo: SIGLA + ' · Pilar', nome, icone, tema: { ...T(p, C.navy, a, C.ciano), nome } });
const SERVICOS = [
  S('busca-ativa', 'Busca Ativa Escolar', 'magnifying-glass', C.laranja),
  S('comunicacao', 'Comunicação', 'megaphone', C.rosa),
  S('alimentacao-escolar', 'Alimentação Escolar', 'bowl-food', C.verde),
  S('transporte-escolar', 'Transporte Escolar', 'bus', '#F2A900', C.navy),
  S('educacao-especial', 'Educação Especial e Inclusiva', 'puzzle-piece', C.roxo),
  S('eja', 'EJA · Vale Letra', 'book-open-text', C.turquesa),
  S('educacao-infantil', 'Educação Infantil', 'baby', C.laranja, C.ciano),
  S('ensino-fundamental', 'Ensino Fundamental', 'backpack', C.azul),
  S('formacao-pedagogica', 'Formação e Coordenação Pedagógica', 'chalkboard-teacher', C.navy),
  S('matricula-censo', 'Matrícula e Censo Escolar', 'clipboard-text', C.azul, C.verde),
  S('equipe-psicossocial', 'Equipe Psicossocial', 'hand-heart', C.rosa, C.ciano),
  S('educacao-bilingue', 'Educação Bilíngue', 'translate', C.vermelho, C.ciano),
  S('tempo-integral', 'Educação em Tempo Integral', 'sun-horizon', C.laranja),
  S('tecnologia-educacional', 'Tecnologia Educacional', 'laptop', C.roxo, C.ciano),
  S('cultura', 'Coordenação de Cultura', 'mask-happy', C.vermelho),
  S('casa-da-cultura', 'Casa da Cultura e Museu Arthur Ramos', 'bank', '#B5651D'),
  S('cine-pilarense', 'Cine Pilarense', 'film-slate', C.navy, C.vermelho),
  S('banda-fanfarra', 'Banda Fanfarra', 'music-notes', C.azul, C.vermelho),
  S('biblioteca', 'Biblioteca e Leitura', 'books', C.turquesa, C.laranja),
  S('esporte-escolar', 'Esporte Escolar', 'soccer-ball', C.verde),
  S('conselhos', 'Conselhos de Educação', 'users-three', C.navy, C.ciano),
  S('infraestrutura', 'Infraestrutura e Manutenção', 'wrench', '#5B6B8C'),
];
const temaDe = (u) => (u.tema ? u.tema : { ...TEMAS[u.cat], a: u.cor || TEMAS[u.cat].a });
const ICONE_CAT = { escola: 'graduation-cap', bilingue: 'translate', creche: 'baby', cria: 'flower-lotus', servico: 'star', sede: 'buildings' };

// Selo (emblema) de uma unidade: forma varia por categoria.
function selo(u, size = 200, o = {}) {
  const t = temaDe(u), bg = o.bg || t.p, s = size / 200;
  const radius = { escola: '26% 26% 50% 50% / 22% 22% 44% 44%', bilingue: '30% 30% 30% 6%', creche: '50%', cria: '42% 58% 46% 54% / 54% 44% 56% 46%', servico: '28%', sede: '28%' }[u.cat];
  const inner = u.cat === 'servico'
    ? `<div style="position:relative">${icon(u.icone, '#fff', 112 * s)}</div>`
    : symbol(118 * s, bg === '#fff' ? {} : { head: t.a, l: '#fff', r: '#fff', base: t.a });
  return `<div style="width:${size}px;height:${size}px;border-radius:${radius};background:${bg};display:flex;align-items:center;justify-content:center;position:relative;flex:none;box-shadow:inset 0 0 0 ${7 * s}px rgba(255,255,255,.16)">${inner}
${u.cat === 'servico' ? `<div style="position:absolute;right:${-10 * s}px;bottom:${-10 * s}px;width:${70 * s}px;height:${70 * s}px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 ${3 * s}px ${8 * s}px rgba(0,0,0,.18)">${symbol(44 * s)}</div>` : ''}</div>`;
}

// Assinatura horizontal de unidade. mode 'cor' | 'neg'
function logoUnidade(u, h = 200, mode = 'cor') {
  if (u.cat === 'sede') return logoSemec(h, mode);
  const t = temaDe(u), s = h / 200, ink = mode === 'cor' ? C.navy : '#fff';
  const nome = u.nome, big = nome.length > 26 ? 50 : nome.length > 18 ? 62 : 78;
  const fam = u.cat === 'creche' || u.cat === 'cria' ? 'ba' : 'an';
  const corNome = mode === 'cor' ? (u.cat === 'servico' || u.cat === 'creche' || u.cat === 'cria' ? t.p : C.navy) : '#fff';
  return `<div style="display:inline-flex;align-items:center;gap:${24 * s}px;color:${ink}">${selo(u, 190 * s, mode === 'neg' ? { bg: 'rgba(255,255,255,.14)' } : {})}
<div style="display:flex;flex-direction:column;gap:${8 * s}px;max-width:${nome.length > 18 ? 560 * s : 900 * s}px">
<div style="font-weight:800;font-size:${19 * s}px;letter-spacing:.2em;text-transform:uppercase;color:${mode === 'cor' ? t.p : t.a};white-space:nowrap">${u.tipo}</div>
<div class="${fam}" style="font-size:${big * (fam === 'ba' ? .92 : 1) * s}px;color:${corNome};${fam === 'ba' ? 'line-height:.95' : ''}">${nome}</div>
<div style="display:flex;align-items:center;gap:${10 * s}px;margin-top:${2 * s}px">${stripe(84 * s, 7 * s)}<span style="font-weight:700;font-size:${14 * s}px;letter-spacing:.2em;text-transform:uppercase;opacity:.85;white-space:nowrap">${u.cat === 'servico' ? 'Educação e Cultura' : SIGLA + ' · Pilar'}</span></div></div></div>`;
}


// Assinatura compacta (para tamanhos pequenos: stories, lower thirds, rodapés). Textos secundários maiores.
function assinatura(u, h = 100, mode = 'cor') {
  const ink = mode === 'cor' ? C.navy : '#fff';
  if (!u || u.cat === 'sede') {
    const so = mode === 'cor' ? {} : { r: C.ciano };
    return `<div style="display:inline-flex;align-items:center;gap:${h * .16}px;color:${ink}">${symbol(h * .92, so)}<div><div class="an" style="font-size:${h * .64}px;line-height:.9;letter-spacing:.02em">${SIGLA}</div><div style="font-weight:800;font-size:${h * .17}px;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap;margin-top:${h * .06}px">Educação e Cultura · Pilar</div></div></div>`;
  }
  const t = temaDe(u), n = u.nome.length, two = n > 20;
  const fam = u.cat === 'creche' || u.cat === 'cria' ? 'ba' : 'an';
  const fs = (two ? .31 : n > 14 ? .4 : .48) * (fam === 'ba' ? .95 : 1);
  return `<div style="display:inline-flex;align-items:center;gap:${h * .18}px;color:${ink}">${selo(u, h, mode === 'neg' ? { bg: 'rgba(255,255,255,.16)' } : {})}<div style="${two ? `max-width:${h * 4.4}px` : ''}"><div style="font-weight:800;font-size:${h * .17}px;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap;color:${mode === 'cor' ? t.p : t.a}">${u.cat === 'servico' ? SIGLA + ' · Pilar' : u.tipo.split(' · ')[0]}</div><div class="${fam}" style="font-size:${h * fs}px;line-height:${fam === 'ba' ? .95 : 1};margin-top:${h * .05}px;${two ? '' : 'white-space:nowrap'}">${u.nome}</div></div></div>`;
}

// ---------- Elementos gráficos ----------
function burst(size, n = 12, ratio = .62, fill = C.amarelo, rot = 0) {
  let p = '';
  for (let i = 0; i < n * 2; i++) { const a = (Math.PI * i) / n + rot, r = i % 2 ? 100 * ratio : 100; p += `${(100 + r * Math.cos(a)).toFixed(1)},${(100 + r * Math.sin(a)).toFixed(1)} `; }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 200 200"><polygon points="${p}" fill="${fill}"/></svg>`;
}
const sparkle = (size, fill = '#fff') => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100"><path d="M50 0C54 30 70 46 100 50 70 54 54 70 50 100 46 70 30 54 0 50 30 46 46 30 50 0Z" fill="${fill}"/></svg>`;
const zig = (w, color = '#fff', sw = 8, n = 6) => { const st = w / n; let d = `M0 ${st / 2}`; for (let i = 0; i < n; i++) d += ` l${st / 2} ${-st / 2} l${st / 2} ${st / 2}`; return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${st / 2 + sw * 2}" viewBox="0 ${-sw} ${w} ${st / 2 + sw * 2}"><path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/></svg>`; };
const dots = (cols, rows, gap, r, color) => { let c = ''; for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) c += `<circle cx="${x * gap + r}" cy="${y * gap + r}" r="${r}"/>`; return `<svg xmlns="http://www.w3.org/2000/svg" width="${(cols - 1) * gap + 2 * r}" height="${(rows - 1) * gap + 2 * r}" fill="${color}">${c}</svg>`; };
function pencil(len, color = C.amarelo, thick = 46) {
  const w = len, h = thick;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect x="0" y="0" width="${h * .7}" height="${h}" rx="${h * .22}" fill="#FF8FB0"/><rect x="${h * .6}" y="0" width="${h * .32}" height="${h}" fill="#C9D2E3"/><rect x="${h * .9}" y="0" width="${w - h * 2.3}" height="${h}" fill="${color}"/><rect x="${h * .9}" y="${h * .33}" width="${w - h * 2.3}" height="${h * .34}" fill="rgba(255,255,255,.28)"/><path d="M${w - h * 1.4} 0L${w} ${h / 2}L${w - h * 1.4} ${h}Z" fill="#F4D7A6"/><path d="M${w - h * .45} ${h * .34}L${w} ${h / 2}L${w - h * .45} ${h * .66}Z" fill="${C.navy}"/></svg>`;
}
// Padrão de fundo com o símbolo
function pattern(color = 'rgba(255,255,255,.08)', tile = 150) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tile}" height="${tile}" viewBox="0 0 300 300"><g transform="translate(20 14) scale(.62)">${symbolInner({ head: color, l: color, r: color, base: color })}</g><g transform="translate(170 164) scale(.62)">${symbolInner({ head: color, l: color, r: color, base: color })}</g></svg>`;
  return `url("data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}")`;
}
// Faixa inclinada com texto (marca registrada do estilo)
const faixa = (txt, bg, color, fs = 64, rot = -3, extra = '') => `<span class="an" style="display:inline-block;background:${bg};color:${color};font-size:${fs}px;padding:${fs * .1}px ${fs * .3}px ${fs * .12}px;transform:rotate(${rot}deg);border-radius:${fs * .1}px;${extra}">${txt}</span>`;

// ---------- Renderizador ----------
function doc(body, w, h, css = '') {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS()}body{width:${w}px;height:${h}px}${css}</style></head><body>${body}</body></html>`;
}
async function renderAll(jobs, { concurrency = 6, label = '' } = {}) {
  if (process.env.CONC) concurrency = +process.env.CONC;
  if (process.env.PULAR) jobs = jobs.filter((j) => !fs.existsSync(j.out));
  let browser = await chromium.launch(), relaunch = null;
  const vivo = async () => { if (browser.isConnected()) return; if (!relaunch) relaunch = chromium.launch().then((b) => { browser = b; relaunch = null; }); await relaunch; };
  let i = 0, done = 0, falhas = 0;
  const um = async (j, ctxs) => {
    const sc = j.scale || 1;
    const ctx = ctxs[sc] || (ctxs[sc] = await browser.newContext({ deviceScaleFactor: sc }));
    const page = await ctx.newPage();
    try {
      await page.setViewportSize({ width: Math.round(j.w), height: Math.round(j.h) });
      fs.mkdirSync(path.dirname(j.out), { recursive: true });
      if (j.pdf) {
        const k = (j.pdf.wcm * 37.795) / j.w, n = j.pdf.n || 1;
        await page.setContent(doc(`<div style="width:${j.w}px;height:${j.h * n}px;position:relative;overflow:hidden;zoom:${k}">${j.html}</div>`, j.w * k, j.h * k * n, (j.css || '') + '@page{margin:0}body{overflow:visible}'), { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);
        await page.pdf({ path: j.out, width: `${j.pdf.wcm}cm`, height: `${j.pdf.hcm}cm`, printBackground: true, pageRanges: n > 1 ? `1-${n}` : '1' });
      } else {
        await page.setContent(doc(j.html, j.w, j.h, j.css || ''), { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: j.out, omitBackground: j.transparent !== false, type: j.out.endsWith('.jpg') ? 'jpeg' : 'png', ...(j.out.endsWith('.jpg') ? { quality: j.q || 88 } : {}) });
      }
    } finally { await page.close().catch(() => {}); }
  };
  const worker = async () => {
    let ctxs = {};
    while (i < jobs.length) {
      const j = jobs[i++];
      for (let t = 0; t < 4; t++) {
        try { await um(j, ctxs); break; } catch (e) {
          for (const c of Object.values(ctxs)) await c.close().catch(() => {});
          ctxs = {}; await vivo();
          if (t === 3) { falhas++; console.log('FALHOU', j.out, String(e.message).slice(0, 80)); }
        }
      }
      if (++done % 50 === 0) console.log(`${label} ${done}/${jobs.length}`);
    }
    for (const c of Object.values(ctxs)) await c.close().catch(() => {});
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  await browser.close().catch(() => {});
  console.log(`${label} ok: ${jobs.length - falhas} arquivos${falhas ? ` (${falhas} falhas)` : ''}`);
}

module.exports = { assinatura, SIGLA, ORGAO, OUT, C, TEMAS, UNIDADES, SERVICOS, ICONE_CAT, temaDe, icon, symbol, symbolInner, stripe, logoSemec, logoUnidade, selo, burst, sparkle, zig, dots, pencil, pattern, faixa, doc, renderAll, BASE_CSS, fontCss };
