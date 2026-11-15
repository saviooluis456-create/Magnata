// Calendários 2027: anual de parede (A3) por tema e planner mensal (A4, 12 páginas).
const k = require('./core.js');
const path = require('path');
const { C, OUT, burst, stripe, sparkle } = k;
const ANO = 2027, MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const FER = { '1-1': 'Confraternização Universal', '2-8': 'Carnaval', '2-9': 'Carnaval', '3-26': 'Sexta-feira Santa', '4-21': 'Tiradentes', '5-1': 'Dia do Trabalhador', '5-27': 'Corpus Christi', '6-24': 'São João', '6-29': 'São Pedro', '9-7': 'Independência do Brasil', '9-16': 'Emancipação de Alagoas', '10-12': 'N. Sra. Aparecida · Dia das Crianças', '10-15': 'Dia do Professor', '11-2': 'Finados', '11-15': 'Proclamação da República', '11-20': 'Consciência Negra', '12-25': 'Natal' };
const on = (c) => ([C.amarelo, C.ciano, '#fff'].includes(c) ? C.navy : '#fff');
const jobs = [];
function mini(m, t, cell = 34) {
  const first = new Date(ANO, m, 1).getDay(), n = new Date(ANO, m + 1, 0).getDate(); let g = '';
  ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].forEach((d, i) => (g += `<div style="font-weight:800;font-size:${cell * .36}px;color:${i === 0 ? C.vermelho : '#8A93AD'};text-align:center">${d}</div>`));
  for (let i = 0; i < first; i++) g += '<div></div>';
  for (let d = 1; d <= n; d++) { const dow = (first + d - 1) % 7, f = FER[`${m + 1}-${d}`];
    g += `<div style="height:${cell}px;display:flex;align-items:center;justify-content:center"><span style="width:${cell * .9}px;height:${cell * .9}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:${f ? 800 : 600};font-size:${cell * .44}px;${f ? `background:${C.vermelho};color:#fff` : `color:${dow === 0 ? C.vermelho : dow === 6 ? '#8A93AD' : C.navy}`}">${d}</span></div>`; }
  return `<div style="background:#fff;border-radius:22px;padding:14px 14px 10px;box-shadow:0 8px 18px rgba(10,14,60,.12)"><div class="an" style="font-size:${cell * .86}px;color:${on(t.p) === '#fff' ? t.p : C.navy};display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span>${MES[m]}</span><span style="width:${cell * .7}px;height:${cell * .22}px;border-radius:9px;background:${[C.vermelho, C.verde, C.amarelo, C.azul][m % 4]}"></span></div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px">${g}</div></div>`;
}
function anual(t, un) {
  const leg = (c, l, fill = true) => `<div style="display:flex;align-items:center;gap:10px"><span style="width:26px;height:26px;border-radius:50%;${fill ? `background:${c}` : `border:4px solid ${c}`}"></span><span style="font-weight:700;font-size:17px;color:#fff;white-space:nowrap">${l}</span></div>`;
  const lista = Object.entries(FER).map(([d, n]) => { const [m, dd] = d.split('-'); return `<div style="display:flex;gap:8px;font-size:13.5px;line-height:1.25;color:#fff"><b style="color:${t.a};width:44px;flex:none">${dd.padStart(2, '0')}/${m.padStart(2, '0')}</b><span style="font-weight:600">${n}</span></div>`; }).join('');
  return `<div class="fill" style="background:${C.gelo}"></div>
<div class="abs" style="left:0;top:0;bottom:0;width:380px;background:${t.p};overflow:hidden"><div class="fill" style="background-image:${k.pattern('rgba(255,255,255,.07)', 150)}"></div><div class="abs" style="left:-150px;top:-150px">${burst(380, 14, .72, t.p === C.navy ? C.azul : t.d)}</div><div class="abs" style="right:-120px;bottom:-130px">${burst(330, 14, .72, t.a)}</div>
<div class="abs" style="left:36px;right:30px;top:120px"><div style="background:#fff;border-radius:60px;padding:12px 26px 12px 16px;display:inline-block">${k.assinatura(un, 62)}</div>
<div style="font-weight:800;font-size:19px;letter-spacing:.22em;color:#fff;margin-top:34px">CALENDÁRIO</div><div class="an" style="font-size:150px;color:#fff;line-height:.9">${ANO}</div>
<div class="an" style="display:inline-block;font-size:34px;background:${t.a};color:${on(t.a)};padding:4px 16px 7px;border-radius:7px;transform:rotate(-3deg);margin-top:10px;box-shadow:5px 5px 0 ${t.d}">Educação que transforma</div>
<div style="display:flex;flex-direction:column;gap:9px;margin-top:38px">${leg(C.vermelho, 'Feriado / ponto facultativo')}${leg(t.a, 'Início e fim do semestre', false)}${leg('#fff', 'Sábado letivo', false)}${leg(C.verde, 'Recesso escolar', false)}</div>
<div style="display:flex;flex-direction:column;gap:3px;margin-top:26px">${lista}</div></div></div>
<div class="abs" style="left:410px;right:32px;top:30px;bottom:30px;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(3,1fr);gap:16px">${MES.map((_, m) => mini(m, t)).join('')}</div>`;
}
function mensal(m, t) {
  const first = new Date(ANO, m, 1).getDay(), n = new Date(ANO, m + 1, 0).getDate(), rows = Math.ceil((first + n) / 7); let g = '';
  ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].forEach((d, i) => (g += `<div style="font-weight:800;font-size:17px;letter-spacing:.12em;text-transform:uppercase;color:#fff;background:${i === 0 ? C.vermelho : t.p};border-radius:10px;text-align:center;padding:7px 0">${d}</div>`));
  for (let i = 0; i < rows * 7; i++) { const d = i - first + 1, ok = d >= 1 && d <= n, f = ok && FER[`${m + 1}-${d}`];
    g += `<div style="background:${ok ? '#fff' : 'transparent'};border-radius:14px;padding:8px 12px;${ok ? 'box-shadow:0 3px 8px rgba(10,14,60,.08);' : ''}${f ? `border-bottom:8px solid ${C.vermelho}` : ''}">${ok ? `<div class="an" style="font-size:40px;color:${f || i % 7 === 0 ? C.vermelho : C.navy}">${d}</div>${f ? `<div style="font-weight:700;font-size:13px;line-height:1.15;color:${C.vermelho};margin-top:2px">${f}</div>` : ''}` : ''}</div>`; }
  const cor = [C.azul, C.vermelho, C.verde, C.laranja, C.rosa, '#E8451E', C.turquesa, C.roxo, C.verde, C.laranja, C.navy, '#C8102E'][m];
  return `<div style="position:relative;width:1684px;height:1190px;overflow:hidden;background:${C.gelo}"><div class="abs" style="left:0;right:0;top:0;height:190px;background:${cor};overflow:hidden"><div class="fill" style="background-image:${k.pattern('rgba(255,255,255,.08)', 130)}"></div><div class="abs" style="right:-90px;top:-110px">${burst(360, 14, .72, C.amarelo)}</div><div class="abs" style="right:330px;top:40px">${sparkle(60, '#fff')}</div></div>
<div class="abs" style="left:50px;top:28px;display:flex;align-items:flex-end;gap:22px"><span class="an" style="font-size:132px;color:#fff;line-height:.95">${MES[m]}</span><span class="an" style="font-size:60px;background:${C.amarelo};color:${C.navy};padding:2px 16px 6px;border-radius:8px;transform:rotate(-3deg);margin-bottom:16px">${ANO}</span></div>
<div class="abs" style="left:40px;right:40px;top:214px;bottom:112px;display:grid;grid-template-columns:repeat(7,1fr);grid-template-rows:36px repeat(${rows},1fr);gap:10px">${g}</div>
<div class="abs" style="left:40px;right:40px;bottom:26px;height:66px;display:flex;align-items:center;justify-content:space-between">${k.assinatura(null, 62)}<div style="flex:1;margin:0 30px;height:4px;border-radius:2px;background:rgba(27,31,94,.12)"></div>${stripe(220, 10)}</div></div>`;
}
const dir = path.join(OUT, '08-impressos', 'calendarios');
for (const [cat, t] of Object.entries(k.TEMAS)) { const un = cat === 'bilingue' ? k.UNIDADES.find((x) => x.cat === 'bilingue') : null, html = anual(t, un);
  jobs.push({ html, w: 1684, h: 1190, out: path.join(dir, `calendario-anual-${ANO}-${cat}.png`), transparent: false, scale: 1.5 }, { html, w: 1684, h: 1190, out: path.join(dir, `calendario-anual-${ANO}-${cat}-A3.pdf`), pdf: { wcm: 42, hcm: 29.7 } }); }
jobs.push({ html: MES.map((_, m) => mensal(m, k.TEMAS.sede)).join(''), w: 1684, h: 1190, out: path.join(dir, `planner-mensal-${ANO}-A4-12-paginas.pdf`), pdf: { wcm: 29.7, hcm: 21, n: 12 } });
MES.forEach((_, m) => jobs.push({ html: mensal(m, k.TEMAS.sede), w: 1684, h: 1190, out: path.join(dir, 'planner-mensal-png', `${String(m + 1).padStart(2, '0')}-${MES[m].toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}.png`), transparent: false }));
if (require.main === module) k.renderAll(jobs, { label: 'calendarios' });
