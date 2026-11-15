// Vinhetas de 5 s (1080x1920, 30 fps) com som — uma por tema, unidade e serviço.
const k = require('./core.js');
const fs = require('fs'), path = require('path');
const { spawn, execFileSync } = require('child_process');
const { chromium } = require('playwright');
const { C, OUT, icon, burst, sparkle, stripe } = k;
const FPS = 30, DUR = 5, W = 1080, H = 1920;
const on = (c) => ([C.amarelo, C.ciano, '#fff', '#F2A900'].includes(c) ? C.navy : '#fff');

function page(u) {
  const sede = !u || u.cat === 'sede', t = sede ? k.TEMAS.sede : u.tema2 || k.temaDe(u);
  const nome = u && u.titulo ? u.titulo : sede ? k.SIGLA : u.nome, n = nome.length;
  const fsz = sede || n <= 6 ? 300 : n > 26 ? 96 : n > 19 ? 118 : n > 13 ? 140 : n > 9 ? 176 : 216;
  const fam = u && (u.cat === 'creche' || u.cat === 'cria') && !u.titulo ? 'ba' : 'an';
  const pill = u && u.pill ? u.pill : sede ? 'Prefeitura de Pilar' : u.cat === 'servico' ? k.SIGLA + ' · Pilar' : u.tipo.split(' · ')[0];
  const fx = u && u.faixa ? u.faixa : sede ? 'Educação e Cultura' : u.cat === 'bilingue' ? 'Education that transforms' : 'Educação que transforma';
  const d2 = t.p === C.navy ? C.azul : t.d;
  const tileInner = u && u.cat === 'servico' ? `<div id="ic">${icon(u.icone, t.p, 250)}</div><div id="bd" style="position:absolute;right:-34px;bottom:-34px;width:150px;height:150px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(0,0,0,.2)">${k.symbol(96)}</div>`
    : `<svg width="290" height="296" viewBox="8 12 184 192" style="overflow:visible"><g id="s3"><path d="M30 158c26-3 50 3 70 20 20-17 44-23 70-20a7 7 0 0 1 6.5 7v6.5a7 7 0 0 1-7.5 7c-26-2-50 5-69 21-19-16-43-23-69-21a7 7 0 0 1-7.5-7V165a7 7 0 0 1 6.5-7Z" fill="${C.vermelho}"/></g><g id="s1" style="transform-origin:100px 120px"><path d="M95 86C76 68 50 60 26 62a8 8 0 0 0-8 8v62a8 8 0 0 0 8.6 8C50 138 76 142 95 158Z" fill="${C.verde}"/></g><g id="s2" style="transform-origin:100px 120px"><path d="M105 86c19-18 45-26 69-24a8 8 0 0 1 8 8v62a8 8 0 0 1-8.6 8C150 138 124 142 105 158Z" fill="${C.azul}"/></g><g id="s0"><circle cx="100" cy="40" r="21" fill="${C.amarelo}"/></g></svg>`;
  const bands = [C.vermelho, C.verde, C.amarelo, C.azul].map((c, i) => `<div class="bd abs" style="left:-30%;width:160%;top:${i * 25 - 2}%;height:29%;background:${c};transform:translateX(-130%) skewY(-8deg)"></div>`).join('');
  const sp = [[120, 420, 90, '#fff'], [880, 520, 60, t.a], [170, 1180, 54, t.a], [900, 1240, 84, '#fff'], [520, 330, 44, '#fff'], [760, 1500, 50, t.a]].map(([x, y, s, c], i) => `<div class="sp abs" style="left:${x}px;top:${y}px;transform:scale(0)">${sparkle(s, c)}</div>`).join('');
  const body = `<div class="fill" style="background:#fff"></div>
<div id="stage" class="fill" style="opacity:0;transform-origin:50% 45%">
<div class="fill" style="background:${t.p}"></div><div id="pat" class="fill" style="background-image:${k.pattern('rgba(255,255,255,.075)', 190)};background-size:190px"></div>
<div id="b1" class="abs" style="left:-250px;top:-250px">${burst(760, 16, .74, d2)}</div><div id="b2" class="abs" style="right:-280px;bottom:-290px">${burst(820, 16, .74, t.a)}</div><div id="b3" class="abs" style="left:-150px;bottom:210px">${burst(340, 12, .66, t.b === t.a ? '#fff' : t.b)}</div>
${sp}
<div id="pen" class="abs" style="right:-40px;top:1290px">${k.pencil(520, C.amarelo, 58)}</div>
<div id="tile" class="abs" style="left:340px;top:420px;width:400px;height:400px;border-radius:${u && (u.cat === 'creche') ? '50%' : '28%'};background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 26px 50px rgba(10,14,60,.3)">${tileInner}</div>
<div class="abs" style="left:0;right:0;top:880px;display:flex;flex-direction:column;align-items:center;gap:20px;text-align:center;padding:0 70px">
<div id="pill" style="font-weight:800;font-size:38px;letter-spacing:.18em;text-transform:uppercase;color:${on(d2)};background:${d2};padding:13px 38px 12px;border-radius:60px;white-space:nowrap">${pill}</div>
<div id="nm" class="${fam}" style="font-size:${fsz * (fam === 'ba' ? .92 : 1)}px;color:#fff;position:relative;${fam === 'ba' ? 'line-height:.95;' : ''}text-shadow:0 8px 0 rgba(0,0,0,.12)">${nome}<div id="shine" class="abs" style="top:-10%;bottom:-10%;width:22%;left:-30%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.75),transparent);transform:skewX(-18deg);mix-blend-mode:overlay"></div></div>
<div id="fx" class="an" style="font-size:66px;background:${t.a};color:${on(t.a)};padding:8px 34px 12px;border-radius:10px;white-space:nowrap;box-shadow:8px 8px 0 ${t.d};transform-origin:left center">${fx}</div></div>
<div id="sig" class="abs" style="left:0;right:0;top:1500px;display:flex;justify-content:center"><div style="background:#fff;border-radius:90px;padding:20px 50px 20px 30px;box-shadow:0 16px 30px rgba(10,14,60,.28)">${sede ? `<div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:2px 10px">${stripe(300, 12)}<span style="font-weight:800;font-size:28px;letter-spacing:.08em;text-transform:uppercase;color:${C.navy};white-space:nowrap">Secretaria Municipal de Educação e Cultura</span></div>` : k.assinatura(null, 104)}</div></div>
</div>${bands}
<script>
const cl=(x)=>Math.max(0,Math.min(1,x)), seg=(t,a,b)=>cl((t-a)/(b-a));
const oc=(x)=>1-Math.pow(1-x,3), ob=(x)=>{const c=1.70158+1;return 1+c*Math.pow(x-1,3)+1.70158*Math.pow(x-1,2)};
const bounce=(x)=>{const n=7.5625,d=2.75;if(x<1/d)return n*x*x;if(x<2/d)return n*(x-=1.5/d)*x+.75;if(x<2.5/d)return n*(x-=2.25/d)*x+.9375;return n*(x-=2.625/d)*x+.984375};
const $=(i)=>document.getElementById(i);
window.setT=(t)=>{
  document.querySelectorAll('.bd').forEach((e,i)=>{const a=oc(seg(t,.02+i*.08,.42+i*.08)),b=Math.pow(seg(t,.52+i*.06,.98+i*.06),2);e.style.transform='translateX('+(-130+130*a+130*b)+'%) skewY(-8deg)'});
  $('stage').style.opacity=t>=.5?1:0; $('stage').style.transform='scale('+(1+.045*seg(t,2.8,5))+')';
  $('pat').style.backgroundPosition=(t*-14)+'px '+(t*-14)+'px';
  [['b1',.62,1.1,1],['b2',.72,1.2,-1],['b3',.9,1.35,1]].forEach(([id,a,b,dir])=>{const s=ob(seg(t,a,b));$(id).style.transform='scale('+Math.max(0,s)+') rotate('+(dir*t*7)+'deg)'});
  const ts=seg(t,.82,1.25); $('tile').style.transform='scale('+Math.max(0,ob(ts))+') rotate('+(-12*(1-oc(ts)))+'deg)';
  if($('s3')){ const a=oc(seg(t,1.0,1.28)); $('s3').style.transform='translateY('+(50*(1-a))+'px)'; $('s3').style.opacity=a;
    $('s1').style.transform='scaleX('+Math.max(0,ob(seg(t,1.15,1.5)))+')'; $('s2').style.transform='scaleX('+Math.max(0,ob(seg(t,1.28,1.63)))+')';
    const h=seg(t,1.45,1.95); $('s0').style.transform='translateY('+(-150*(1-bounce(h)))+'px)'; $('s0').style.opacity=h>0?1:0; }
  else { const a=seg(t,1.05,1.55); $('ic').style.transform='scale('+Math.max(0,ob(a))+') rotate('+(-30*(1-oc(a)))+'deg)'; $('bd').style.transform='scale('+Math.max(0,ob(seg(t,1.5,1.9)))+')'; }
  const p=oc(seg(t,1.68,1.98)); $('pill').style.transform='translateY('+(40*(1-p))+'px)'; $('pill').style.opacity=p;
  const n=oc(seg(t,1.84,2.3)); $('nm').style.clipPath='inset(-20% '+(100-100*n)+'% -20% 0)'; $('nm').style.transform='translateX('+(-40*(1-n))+'px)';
  const f=seg(t,2.2,2.6); $('fx').style.transform='rotate(-3deg) scaleX('+Math.max(0,ob(f))+')'; $('fx').style.opacity=f>0?1:0;
  const g=oc(seg(t,2.55,2.95)); $('sig').style.transform='translateY('+(120*(1-g))+'px)'; $('sig').style.opacity=g;
  const pe=seg(t,2.4,2.95); $('pen').style.transform='translate('+(500*(1-ob(pe)))+'px,'+(500*(1-ob(pe)))+'px) rotate('+(-48+Math.sin(t*2.2)*2)+'deg)'; $('pen').style.opacity=pe>0?1:0;
  document.querySelectorAll('.sp').forEach((e,i)=>{const s0=2.5+i*.09; const a=ob(seg(t,s0,s0+.3)); const tw=1+.25*Math.sin((t-s0)*5+i*1.7); e.style.transform='scale('+Math.max(0,a*tw)+') rotate('+(t*30+i*20)+'deg)'});
  const sh=seg(t,3.3,3.95); $('shine').style.left=(-30+170*sh)+'%'; $('shine').style.opacity=(sh>0&&sh<1)?1:0;
};
setT(0);
</script>`;
  return k.doc(body, W, H);
}

const KEY = { sede: [0, 0], escola: [2, .4], bilingue: [4, .3], creche: [5, 1], cria: [7, 1], servico: [-2, .3] };
const tmp = path.join(require('os').tmpdir(), 'semec-vinheta'); fs.mkdirSync(tmp, { recursive: true });
function wav(cat) { const f = path.join(tmp, cat + '.wav'); if (!fs.existsSync(f)) execFileSync('python3', [path.join(__dirname, 'audio.py'), f, String(KEY[cat][0]), String(KEY[cat][1])]); return f; }

async function one(browser, u, out) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 }); const pg = await ctx.newPage();
  await pg.setContent(page(u), { waitUntil: 'load' }); await pg.evaluate(() => document.fonts.ready);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-i', wav(u ? u.cat : 'sede'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(FPS), '-c:a', 'aac', '-b:a', '192k', '-t', String(DUR), '-movflags', '+faststart', out]);
  let err = ''; ff.stderr.on('data', (d) => (err += d));
  const done = new Promise((res, rej) => ff.on('close', (c) => (c ? rej(new Error(err)) : res())));
  for (let i = 0; i < FPS * DUR; i++) { await pg.evaluate((t) => window.setT(t), i / FPS); const buf = await pg.screenshot({ type: 'jpeg', quality: 95 }); if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r)); }
  ff.stdin.end(); await done; await ctx.close();
}
(async () => {
  const base = path.join(OUT, '07-vinhetas'); const list = [[null, path.join(base, 'vinheta-semec.mp4')]];
  for (const [cat, t] of Object.entries(k.TEMAS)) if (cat !== 'sede' && cat !== 'bilingue') list.push([{ cat, tema2: t, titulo: { escola: 'Escolas Municipais', creche: 'Creches e CMEIs', cria: 'Creches CRIA', servico: 'Educação e Cultura' }[cat], pill: k.SIGLA + ' · Pilar', icone: 'star', nome: '' , tipo: ''}, path.join(base, 'temas', `vinheta-${cat}.mp4`)]);
  for (const u of [...k.UNIDADES, ...k.SERVICOS]) list.push([u, path.join(base, u.cat === 'servico' ? 'servicos' : 'unidades', `vinheta-${u.slug}.mp4`)]);
  const only = process.argv[2]; const todo = only ? list.filter((x) => x[1].includes(only)) : list;
  const browser = await chromium.launch(); let i = 0, n = 0;
  await Promise.all(Array.from({ length: 4 }, async () => { while (i < todo.length) { const [u, out] = todo[i++]; await one(browser, u, out); if (++n % 5 === 0) console.log(`vinhetas ${n}/${todo.length}`); } }));
  await browser.close(); console.log('vinhetas ok:', todo.length);
})();
