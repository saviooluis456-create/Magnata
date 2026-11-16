// Conteúdo pronto: carrosséis informativos (1080x1350) e sequências de stories (1080x1920) por frente e por serviço.
const k = require('./core.js');
const path = require('path');
const { C, OUT, icon, stripe } = k;
const K = require('./kit2.js');
const dados = require('./dados.js');
const { A, on } = K;
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const SC = 1.25, jobs = [];
const fundos = Object.keys(K.FUNDOS), tits = Object.keys(K.TITULOS);
const duas = (s) => { const w = s.split(' '); if (w.length === 1) return ['', s]; let best = 1, d = 1e9; for (let i = 1; i < w.length; i++) { const a = w.slice(0, i).join(' ').length, b = w.slice(i).join(' ').length; if (Math.abs(a - b) < d) { d = Math.abs(a - b); best = i; } } return [w.slice(0, best).join(' '), w.slice(best).join(' ')]; };
const dots = (n, at, t, s = 16) => `<div style="display:flex;gap:${s * .5}px">${Array.from({ length: n }, (_, i) => `<i style="width:${i === at ? s * 3 : s}px;height:${s}px;border-radius:${s}px;background:${i === at ? t.p : 'rgba(27,31,94,.18)'}"></i>`).join('')}</div>`;
const arrasta = (t, s = 1) => `<div style="display:inline-flex;align-items:center;gap:${12 * s}px;background:#fff;border-radius:${50 * s}px;padding:${10 * s}px ${14 * s}px ${10 * s}px ${28 * s}px;box-shadow:0 10px 24px rgba(10,14,60,.22)"><span style="font-weight:800;font-size:${24 * s}px;letter-spacing:.14em;color:${C.navy}">ARRASTA</span><div style="width:${56 * s}px;height:${56 * s}px;border-radius:50%;background:${on(t.p) === '#fff' ? t.p : C.navy};display:flex;align-items:center;justify-content:center">${icon('arrow-right', '#fff', 30 * s, 'bold')}</div></div>`;

function capa(g, tema, ti, H) {
  const t = g.t, f = fundos[(ti + g.seed) % fundos.length], ts = tits[(ti * 3 + g.seed) % tits.length], ink = K.tinta(f, t), [l1, l2] = duas(tema.titulo), story = H > 1500;
  return K.FILT + K.FUNDOS[f](t, 1080, H) + K.cena(g.ilus, t, 1080, H, { spots: story ? [[70, 12, 24, 10], [64, 58, 28, -8]] : [[72, 4, 24, 10], [66, 52, 24, -8]] })
    + A(`left:80px;right:80px;top:${story ? 520 : 300}px;display:flex;flex-direction:column;align-items:flex-start;gap:30px`, `${K.pill(g.nome, t.d === t.p ? C.navy : t.d, 24)}${K.titulo(ts === 'azulejo' ? 'faixa' : ts, l1 || tema.titulo, l1 ? l2 : '', t, 104, ink, 'left').replace(/<div class="an" style="font-size:[\d.]+px;background[^>]*><\/div>/, '')}`)
    + A(`left:80px;bottom:${story ? 340 : 70}px`, K.assinaPill(g.u, 74)) + (story ? '' : A('right:70px;bottom:74px', arrasta(t)));
}
function ponto(g, tema, pi, H) {
  const t = g.t, p = tema.pts[pi], story = H > 1500, cor = on(t.p) === '#fff' ? t.p : C.navy, ic = g.icones[(pi + tema.titulo.length) % g.icones.length];
  return `<div class="fill" style="background:${K.mix(t.p, .9)}"></div>${A(`left:0;top:0;right:0;height:${story ? 420 : 250}px;background:${t.p};border-radius:0 0 70px 70px`)}${A(`left:0;top:0;right:0;height:${story ? 420 : 250}px;border-radius:0 0 70px 70px;background-image:${k.pattern(on(t.p) === '#fff' ? 'rgba(255,255,255,.08)' : 'rgba(27,31,94,.06)', 140)}`)}`
    + A(`left:80px;top:${story ? 250 : 74}px;right:80px;display:flex;align-items:center;justify-content:space-between`, `<span style="font-weight:800;font-size:26px;letter-spacing:.16em;text-transform:uppercase;color:${on(t.p)};max-width:720px">${tema.titulo}</span><span class="an" style="font-size:44px;color:${on(t.p)};opacity:.8">${pi + 2}/5</span>`)
    + A(`left:70px;right:70px;top:${story ? 520 : 190}px;bottom:${story ? 470 : 180}px;background:#fff;border-radius:56px;box-shadow:0 20px 44px rgba(10,14,60,.14);padding:${story ? 80 : 64}px 64px;display:flex;flex-direction:column;justify-content:center;gap:30px;overflow:hidden`, `<div style="display:flex;align-items:center;gap:26px"><div class="an" style="width:120px;height:120px;border-radius:34px;background:${t.a === '#FFFFFF' ? t.p : t.a};color:${on(t.a === '#FFFFFF' ? t.p : t.a)};font-size:76px;display:flex;align-items:center;justify-content:center;flex:none;transform:rotate(-4deg);box-shadow:8px 8px 0 ${t.d === t.p ? C.navy : t.d}">${pi + 1}</div>${stripe(200, 14)}</div><div class="an" style="font-size:${p.t.length > 22 ? 70 : 84}px;color:${cor};line-height:1.02">${p.t}</div><div style="font-weight:600;font-size:${story ? 46 : 42}px;line-height:1.36;color:${C.tinta}">${p.d}</div><div style="position:absolute;right:40px;bottom:36px">${icon(ic, K.mix(t.p, .78), story ? 240 : 200, 'duotone')}</div>`)
    + A(`left:80px;right:80px;bottom:${story ? 340 : 66}px;display:flex;align-items:center;justify-content:space-between`, k.assinatura(g.u, 70) + (story ? '' : dots(5, pi + 1, t)));
}
function fim(g, tema, H) {
  const t = g.t, story = H > 1500;
  return K.FILT + K.FUNDOS.padrao(t, 1080, H) + A(`left:0;right:0;top:${story ? 520 : 250}px;display:flex;flex-direction:column;align-items:center;gap:34px;text-align:center;padding:0 90px`, `${K.titulo('faixa', 'Ficou com', 'dúvida?', t, 100, on(t.p))}<div style="font-weight:600;font-size:40px;line-height:1.35;color:${on(t.p)};margin-top:14px">Procure a secretaria da sua escola<br>ou a sede da ${k.SIGLA}.</div><div style="display:flex;gap:22px;margin-top:16px">${['heart', 'chat-circle', 'paper-plane-tilt', 'bookmark-simple'].map((i) => `<div style="width:120px;height:120px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 22px rgba(10,14,60,.2)">${icon(i, on(t.p) === '#fff' ? t.p : C.navy, 66)}</div>`).join('')}</div><span style="font-weight:800;font-size:26px;letter-spacing:.14em;color:${on(t.p)}">CURTA · COMENTE · COMPARTILHE · SALVE</span>`)
    + A(`left:0;right:0;bottom:${story ? 340 : 80}px;display:flex;justify-content:center`, K.assinaPill(g.u, 84));
}
// Post único (aviso/frase) a partir das palavras-chave
function postPalavra(g, palavra, i, H) {
  const t = g.t, f = fundos[(i * 3 + g.seed + 2) % fundos.length], ts = ['adesivo', 'extrusao', 'blocos', 'faixa', 'fita', 'cordel', 'balao', 'manuscrito'][i % 8], ink = K.tinta(f, t), [l1, l2] = duas(palavra), story = H > 1500;
  return K.FILT + K.FUNDOS[f](t, 1080, H) + K.cena(g.ilus.slice().reverse(), t, 1080, H, { spots: story ? [[6, 14, 22, -8], [72, 64, 24, 8]] : [[4, 5, 22, -8], [74, 58, 22, 8]] })
    + A(`left:0;right:0;top:${story ? 600 : 340}px;display:flex;flex-direction:column;align-items:center;gap:36px`, `${K.titulo(ts, l1 || palavra, l1 ? l2 : '', t, 118, ink)}<div style="width:640px;height:150px;border-radius:30px;border:6px dashed ${ink}66;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:26px;letter-spacing:.1em;color:${ink};opacity:.75;margin-top:30px">SEU TEXTO AQUI</div>`)
    + A(`left:0;right:0;bottom:${story ? 340 : 70}px;display:flex;justify-content:center`, K.assinaPill(g.u, 78));
}
const G = [];
const nomes = { sede: 'SEMEC Pilar', escola: 'Escolas municipais', bilingue: 'Escola Bilíngue', creche: 'Creches e CMEIs', cria: 'Creches CRIA' };
const ilf = { sede: ['livro', 'lampada', 'medalha', 'aviao'], escola: ['mochila', 'lapis3', 'livro', 'maca'], bilingue: ['hello', 'abc', 'mundo', 'ola'], creche: ['urso', 'blocos', 'pipa', 'bola'], cria: ['mao', 'flor', 'borboleta', 'sol'] };
Object.keys(nomes).forEach((f, i) => G.push({ dir: 'frentes/' + (f === 'sede' ? 'sede-semec' : f === 'escola' ? 'escolas' : f === 'creche' ? 'creches' : f === 'cria' ? 'creches-cria' : 'escola-bilingue'), nome: nomes[f], t: k.TEMAS[f].p === C.navy ? { ...k.TEMAS[f], d: C.azul } : k.TEMAS[f], u: f === 'bilingue' ? k.UNIDADES.find((x) => x.cat === 'bilingue') : null, seed: i * 2, ilus: ilf[f], ...dados.FRENTES[f] }));
const GR = require('./grafismos.js');
k.SERVICOS.forEach((s, i) => G.push({ dir: 'servicos/' + s.slug, nome: s.nome, t: s.tema, u: s, seed: i + 3, ilus: ({ 'busca-ativa': ['mochila', 'casinha', 'coracao'], comunicacao: ['aviao', 'lampada', 'hello'], 'alimentacao-escolar': ['maca', 'milho', 'copo'], 'transporte-escolar': ['trem', 'mochila', 'sino'], 'educacao-especial': ['coracao', 'mao', 'arcoiris'], eja: ['livro', 'capelo', 'lampada'], 'educacao-infantil': ['blocos', 'urso', 'pipa'], 'ensino-fundamental': ['livro', 'lapis3', 'caderno'], 'formacao-pedagogica': ['lousa', 'lampada', 'pilha'], 'matricula-censo': ['caderno', 'mochila', 'lapis3'], 'equipe-psicossocial': ['coracao', 'borboleta', 'nuvem'], 'educacao-bilingue': ['hello', 'abc', 'mundo'], 'tempo-integral': ['sol', 'bola', 'paleta'], 'tecnologia-educacional': ['foguete', 'lampada', 'tubo'], cultura: ['boi', 'guerreiro', 'mascaras'], 'casa-da-cultura': ['sobrado', 'azulejo', 'cordel'], 'cine-pilarense': ['cine', 'claquete', 'rolo'], 'banda-fanfarra': ['trompete', 'caixa', 'estandarte'], biblioteca: ['livro', 'pilha', 'cordel'], 'esporte-escolar': ['bola', 'trofeu', 'medalha'], conselhos: ['livro', 'medalha', 'coracao'], infraestrutura: ['casinha', 'regua', 'sobrado'] })[s.slug], ...dados.SERV[s.slug] }));
for (const g of G) {
  g.temas.forEach((tema, ti) => { const d = `${String(ti + 1).padStart(2, '0')}-${slug(tema.titulo)}`;
    const mk = (H, base, ext) => { const out = (n) => path.join(OUT, base, g.dir, d, n + '.jpg'); const J = (html, n) => jobs.push({ html, w: 1080, h: H, scale: SC, out: out(n), transparent: false });
      J(capa(g, tema, ti, H), '1-capa'); tema.pts.forEach((_, pi) => J(ponto(g, tema, pi, H), `${pi + 2}-${slug(tema.pts[pi].t).slice(0, 40)}`)); J(fim(g, tema, H), '5-encerramento'); };
    mk(1350, '12-carrosseis-prontos'); mk(1920, '13-stories-prontos'); });
  g.palavras.slice(0, g.dir.startsWith('frentes') ? 16 : 10).forEach((p, i) => { jobs.push({ html: postPalavra(g, p, i, 1350), w: 1080, h: 1350, scale: SC, out: path.join(OUT, '10-feed', 'posts-prontos', g.dir, `${String(i + 1).padStart(2, '0')}-${slug(p)}.jpg`), transparent: false }); if (i < 8) jobs.push({ html: postPalavra(g, p, i + 1, 1920), w: 1080, h: 1920, scale: SC, out: path.join(OUT, '13-stories-prontos', g.dir, 'chamadas', `${String(i + 1).padStart(2, '0')}-${slug(p)}.jpg`), transparent: false }); });
}
module.exports = { duas, capa, ponto, fim, postPalavra, arrasta, dots };
if (require.main === module) { const only = process.argv[2]; console.log(jobs.length); k.renderAll(only ? jobs.filter((j) => j.out.includes(only)) : jobs, { label: 'conteudo', concurrency: 3 }); }
