// End-to-end test: drives the real app in a mobile-emulated Chromium, exercising the main editing flows and export.
// Usage: npm run dev (port 5173) in another terminal, then `npm test`. Requires ffmpeg for fixtures.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const fx = path.join(here, 'fixtures');
const out = path.join(here, 'out');
fs.mkdirSync(fx, { recursive: true });
fs.mkdirSync(out, { recursive: true });
const URL = process.env.APP_URL ?? 'http://localhost:5173/';

function ff(args) { execSync(`ffmpeg -y -loglevel error ${args}`, { stdio: 'inherit' }); }
function fixtures() {
  const f = (n) => path.join(fx, n);
  if (!fs.existsSync(f('clipA.mp4'))) ff(`-f lavfi -i "testsrc2=size=720x1280:rate=30:duration=6" -f lavfi -i "sine=frequency=440:duration=6" -filter_complex "[1:a]volume='if(between(t,2,3.2),0,1)':eval=frame[a]" -map 0:v -map "[a]" -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest ${f('clipA.mp4')}`);
  if (!fs.existsSync(f('clipB.mp4'))) ff(`-f lavfi -i "smptebars=size=1280x720:rate=30:duration=4" -f lavfi -i "sine=frequency=660:duration=4" -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest ${f('clipB.mp4')}`);
  if (!fs.existsSync(f('music.mp3'))) ff(`-f lavfi -i "aevalsrc='0.8*sin(2*PI*60*t)*exp(-12*mod(t,0.5))':d=8:s=44100" -c:a libmp3lame ${f('music.mp3')}`);
  if (!fs.existsSync(f('photo.jpg'))) ff(`-f lavfi -i "mandelbrot=size=1080x1080" -frames:v 1 ${f('photo.jpg')}`);
  return f;
}

const results = [];
const step = async (name, fn) => {
  const t0 = Date.now();
  try { await fn(); results.push({ name, ok: true, ms: Date.now() - t0 }); console.log(`✔ ${name} (${Date.now() - t0}ms)`); }
  catch (e) { results.push({ name, ok: false, err: e.message }); console.log(`✘ ${name}: ${e.message}`); }
};

const f = fixtures();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ ...devices['Pixel 7'], acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|Failed to load resource|net::ERR/.test(m.text())) errors.push('console: ' + m.text()); });

const shot = (n) => page.screenshot({ path: path.join(out, `${n}.png`) });
const pick = async (trigger, files) => {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 10000 }), trigger()]);
  await chooser.setFiles(files);
};
const tool = (id) => page.getByTestId(`tool-${id}`).click();
const closePanel = () => page.getByTestId('close-panel').click();
const state = () => page.evaluate(() => window.__editor?.getState());

await step('home loads', async () => {
  await page.goto(URL);
  await page.getByTestId('new-project').waitFor();
  await shot('01-home');
});

await step('create project', async () => {
  await page.getByTestId('new-project').click();
  await page.getByTestId('preview').waitFor();
});

await step('import two videos to main track', async () => {
  await pick(() => page.getByTestId('add-media-empty').click(), [f('clipA.mp4'), f('clipB.mp4')]);
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="clip-video"]').length === 2, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  await shot('02-imported');
});

await step('preview renders non-black pixels', async () => {
  await page.evaluate(() => window.__editor.getState().setTime(1));
  await page.waitForTimeout(600);
  const lum = await page.evaluate(() => window.__session.player.luma());
  if (lum < 5) throw new Error('preview looks black: ' + lum);
});

await step('playback advances time', async () => {
  await page.getByTestId('play').click();
  await page.waitForTimeout(1500);
  await page.getByTestId('play').click();
  const t = await page.evaluate(() => window.__editor.getState().time);
  if (!(t > 0.5)) throw new Error('time did not advance: ' + t);
});

await step('add transition with sound', async () => {
  await page.getByTestId('transition-btn').first().click();
  await page.getByTestId('panel-transition').waitFor();
  await page.getByRole('button', { name: 'Zoom cruzado' }).click();
  const tr = await page.evaluate(() => window.__editor.getState().project.clips.find((c) => c.transition)?.transition);
  if (!tr || tr.type !== 'cross-zoom' || !tr.sound) throw new Error('transition missing ' + JSON.stringify(tr));
  await shot('03-transition');
  await closePanel();
});

await step('select clip, add effect + filter + adjust', async () => {
  await page.evaluate(() => { const s = window.__editor.getState(); s.select(s.project.clips.find((c) => c.trackId === 'main').id); s.setTime(1); });
  await tool('effects');
  await page.getByRole('button', { name: 'RGB Split' }).click();
  await closePanel();
  await tool('filters');
  await page.getByRole('tab', { name: 'Cinema' }).click();
  await page.getByRole('button', { name: 'Teal & Orange' }).click();
  await closePanel();
  await tool('adjust');
  await page.getByLabel('Contraste').fill('40');
  await closePanel();
  const c = await page.evaluate(() => window.__editor.getState().project.clips.find((c) => c.trackId === 'main'));
  if (!c.effects.length || !c.filter || c.adjust.contrast !== 40) throw new Error('look not applied ' + JSON.stringify({ e: c.effects, f: c.filter, a: c.adjust.contrast }));
  await shot('04-look');
});

await step('speed, animation, mask, chroma panels work', async () => {
  await tool('speed');
  await page.getByRole('button', { name: '2x', exact: true }).click();
  await closePanel();
  await tool('animation');
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await closePanel();
  await tool('mask');
  await page.getByRole('button', { name: 'Círculo' }).click();
  await closePanel();
  const c = await page.evaluate(() => window.__editor.getState().project.clips.find((c) => c.id === window.__editor.getState().selectedId));
  if (c.speed !== 2 || c.anims.in?.type !== 'zoom-in' || c.mask.type !== 'circle') throw new Error('clip ops failed');
  await page.evaluate(() => window.__editor.getState().updateClip(window.__editor.getState().selectedId, (c) => { c.mask.type = 'none'; c.speed = 1; c.duration = 6; }));
});

await step('split + undo + redo', async () => {
  const before = await page.evaluate(() => window.__editor.getState().project.clips.length);
  await page.evaluate(() => window.__editor.getState().setTime(2.5));
  await tool('split');
  const after = await page.evaluate(() => window.__editor.getState().project.clips.length);
  if (after !== before + 1) throw new Error(`split failed ${before}->${after}`);
  await page.getByTestId('undo').click();
  if ((await page.evaluate(() => window.__editor.getState().project.clips.length)) !== before) throw new Error('undo failed');
  await page.getByTestId('redo').click();
  if ((await page.evaluate(() => window.__editor.getState().project.clips.length)) !== before + 1) throw new Error('redo failed');
  await page.getByTestId('undo').click();
});

await step('add text and edit it', async () => {
  await page.evaluate(() => window.__editor.getState().select(null));
  await tool('text');
  await page.getByTestId('add-text').click();
  await page.getByTestId('text-input').fill('MAGNATA\nSTUDIO');
  await page.getByRole('tab', { name: 'Estilo' }).click();
  await closePanel();
  const t = await page.evaluate(() => window.__editor.getState().project.clips.find((c) => c.kind === 'text')?.text?.text);
  if (t !== 'MAGNATA\nSTUDIO') throw new Error('text not set: ' + t);
  await shot('05-text');
});

await step('captions from script + preset', async () => {
  await page.evaluate(() => window.__editor.getState().select(null));
  await tool('captions');
  await page.getByPlaceholder('Cole aqui o texto falado no vídeo…').fill('Este editor de vídeo é incrível e faz tudo no celular com muito dinheiro e sucesso agora mesmo');
  await page.getByRole('button', { name: 'Sincronizar com a fala' }).click();
  await page.waitForFunction(() => window.__editor.getState().project.captions.words.length > 5, null, { timeout: 20000 });
  await page.getByTestId('cap-preset-caixa').click();
  await page.evaluate(() => window.__editor.getState().setTime(1.0));
  await page.waitForTimeout(400);
  await shot('06-captions');
  await page.getByRole('tab', { name: 'Personalizar' }).click();
  await page.getByRole('button', { name: 'Animação' }).click();
  await page.getByRole('button', { name: 'Quicar' }).click();
  await closePanel();
});

await step('import music to audio track', async () => {
  await tool('audio');
  await pick(() => page.getByRole('button', { name: 'Importar áudio' }).click(), [f('music.mp3')]);
  await page.waitForFunction(() => window.__editor.getState().project.clips.some((c) => c.kind === 'audio'), null, { timeout: 20000 });
  await closePanel();
});

await step('beat detection marks beats', async () => {
  await page.evaluate(() => window.__editor.getState().select(null));
  await tool('ai');
  await page.getByRole('button', { name: 'Sincronizar batidas' }).click();
  await page.getByRole('button', { name: 'Só marcar' }).click();
  await page.waitForFunction(() => window.__editor.getState().project.markers.length > 4, null, { timeout: 20000 });
  await closePanel().catch(() => {});
});

await step('import photo as overlay and drag in preview', async () => {
  await page.evaluate(() => { window.__editor.getState().select(null); window.__editor.getState().setTime(0.5); });
  await tool('overlay');
  await pick(() => page.getByRole('button', { name: 'Adicionar sobreposição' }).click(), [f('photo.jpg')]);
  await page.waitForFunction(() => window.__editor.getState().project.clips.some((c) => c.kind === 'image'), null, { timeout: 20000 });
  await closePanel().catch(() => {});
  const box = await page.getByTestId('gesture').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 40, cy - 60, { steps: 6 }); await page.mouse.up();
  const tf = await page.evaluate(() => window.__editor.getState().project.clips.find((c) => c.kind === 'image').transform);
  if (Math.abs(tf.x) < 0.02) throw new Error('drag did not move overlay ' + JSON.stringify(tf));
  await shot('07-overlay');
});

await step('project persists after reload', async () => {
  await page.waitForTimeout(1200);
  const id = await page.evaluate(() => window.__editor.getState().project.id);
  await page.reload();
  await page.getByTestId('new-project').waitFor();
  await page.locator('.proj').first().locator('button').first().click();
  await page.getByTestId('preview').waitFor();
  const st = await page.evaluate(() => ({ id: window.__editor.getState().project.id, n: window.__editor.getState().project.clips.length, w: window.__editor.getState().project.captions.words.length }));
  if (st.id !== id || st.n < 4 || st.w < 5) throw new Error('not persisted ' + JSON.stringify(st));
  await page.waitForTimeout(1000);
  await shot('08-reloaded');
});

let exported = null;
await step('export 720p MP4', async () => {
  await page.getByTestId('open-export').click();
  await page.getByRole('button', { name: /720p/ }).click();
  await page.getByTestId('start-export').click();
  await page.getByTestId('export-done').waitFor({ timeout: 240000 });
  await shot('09-exported');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download').click()]);
  exported = path.join(out, dl.suggestedFilename());
  await dl.saveAs(exported);
  const probe = JSON.parse(execSync(`ffprobe -v error -show_streams -show_format -of json "${exported}"`).toString());
  const v = probe.streams.find((s) => s.codec_type === 'video');
  const a = probe.streams.find((s) => s.codec_type === 'audio');
  if (!v || v.width !== 720) throw new Error('bad video stream ' + JSON.stringify(v));
  if (!a) throw new Error('no audio stream');
  const dur = parseFloat(probe.format.duration);
  if (dur < 9 || dur > 11.5) throw new Error('unexpected duration ' + dur);
  // decode fully to ensure no corruption
  execSync(`ffmpeg -v error -i "${exported}" -f null -`);
  // grab frames for visual inspection
  execSync(`ffmpeg -y -v error -i "${exported}" -vf "fps=1,scale=180:-1,tile=6x2" -frames:v 1 "${path.join(out, '10-export-contact.png')}"`);
  console.log(`  exported ${path.basename(exported)}: ${v.codec_name} ${v.width}x${v.height} + ${a.codec_name}, ${dur.toFixed(2)}s`);
});

console.log('\nErrors captured:', errors.length ? '\n' + errors.join('\n') : 'none');
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} steps passed`);
if (failed.length || errors.length) process.exitCode = 1;
