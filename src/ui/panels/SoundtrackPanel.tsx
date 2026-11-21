import { useState } from 'react';
import { analyzeVideo, planSoundtrack, renderSoundtrack, type SoundtrackPlan, type VideoInsight } from '../../ai/soundtrack';
import { MUSIC_LIBRARY, planForTrack } from '../../audio/catalog';
import { GENRES, GENRE_MAP, keyName, renderMusic } from '../../audio/musicgen';
import { audioCtx } from '../../engine/media';
import { projectDuration } from '../../model/timeline';
import { useEditor } from '../../store/editor';
import { addAudioBuffer } from '../actions';
import { Chips, Section, Slider, Toggle } from '../components/ui';

// ------------------------------------------------------------------ preview playback (one at a time)
let previewSrc: AudioBufferSourceNode | null = null;
export function stopPreview() { try { previewSrc?.stop(); } catch { /* */ } previewSrc = null; }
export function playPreview(buf: AudioBuffer, onEnd?: () => void) {
  stopPreview();
  const ctx = audioCtx();
  if (ctx.state === 'suspended') ctx.resume();
  const s = ctx.createBufferSource();
  s.buffer = buf; s.connect(ctx.destination); s.start();
  s.onended = () => { if (previewSrc === s) { previewSrc = null; onEnd?.(); } };
  previewSrc = s;
}

export function SoundtrackPanel() {
  const [ins, setIns] = useState<VideoInsight | null>(null);
  const [plan, setPlan] = useState<SoundtrackPlan | null>(null);
  const [genre, setGenre] = useState<string>('auto');
  const [opts, setOpts] = useState({ sfx: true, textPops: true, duck: true, energy: 0, volume: 0.8 });
  const [playing, setPlaying] = useState(false);
  const st = useEditor.getState;

  const analyze = async () => {
    const s = st();
    s.setPlaying(false);
    try {
      s.setBusy({ msg: 'Analisando o vídeo…', progress: 0 });
      const i = await analyzeVideo(s.project!, (msg, f) => s.setBusy({ msg, progress: f }));
      setIns(i);
      setPlan(planSoundtrack(i, { ...opts, genre: genre === 'auto' ? undefined : genre }));
    } catch (e) { s.notify((e as Error).message, 'error'); }
    finally { s.setBusy(null); }
  };

  const replan = (g = genre, o = opts, newSeed = false) => {
    if (!ins) return;
    setPlan(planSoundtrack(ins, { ...o, genre: g === 'auto' ? undefined : g, seed: newSeed ? undefined : plan?.music.seed }));
  };

  const preview = async () => {
    if (!plan) return;
    if (playing) { stopPreview(); setPlaying(false); return; }
    const s = st();
    s.setBusy({ msg: 'Compondo prévia…' });
    try {
      const buf = await renderMusic({ ...plan.music, duration: Math.min(16, plan.music.duration), energy: plan.music.energy.map((e) => Math.max(e, 0.75)) });
      setPlaying(true);
      playPreview(buf, () => setPlaying(false));
    } finally { s.setBusy(null); }
  };

  const create = async () => {
    if (!plan || !ins) return;
    const s = st();
    stopPreview(); setPlaying(false);
    s.setBusy({ msg: 'Compondo a trilha sonora…' });
    try {
      const r = await renderSoundtrack(plan, ins);
      const g = GENRE_MAP.get(plan.music.genre)!;
      await addAudioBuffer(r.music, `Trilha IA · ${g.name} ${plan.music.bpm} BPM`, 0, opts.volume);
      if (r.sfx) await addAudioBuffer(r.sfx, 'Efeitos IA', 0, 1);
      s.notify('Trilha sonora criada e sincronizada com o vídeo 🎵', 'ok');
      s.select(null);
    } catch (e) { s.notify('Falha ao criar trilha: ' + (e as Error).message, 'error'); }
    finally { s.setBusy(null); }
  };

  return (
    <>
      <p className="hint">A IA assiste ao vídeo (cortes, movimento, cores, falas e texto), escolhe gênero, andamento e tom, e compõe uma música original sincronizada com os cortes, com efeitos sonoros e volume que abaixa quando alguém fala.</p>
      <Section title="Estilo">
        <Chips options={[{ v: 'auto', label: '✨ Automático' }, ...GENRES.map((g) => ({ v: g.id, label: `${g.emoji} ${g.name}` }))]} value={genre} onChange={(v) => { setGenre(v); replan(v); }} scroll />
      </Section>
      {!plan ? (
        <button className="btn primary block" style={{ padding: 16 }} onClick={analyze} data-testid="soundtrack-analyze">🎵 Entender o vídeo e criar trilha</button>
      ) : (
        <>
          <div className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }} data-testid="soundtrack-plan">
            <b style={{ fontSize: 15 }}>{plan.mood}</b>
            {plan.reasons.map((r) => <div key={r} className="hint" style={{ margin: 0 }}>• {r}</div>)}
            <div className="hint" style={{ margin: 0 }}>• {plan.sfx.length} efeitos sonoros sincronizados</div>
          </div>
          <Toggle label="Efeitos sonoros nos cortes e picos" value={opts.sfx} onChange={(v) => { const o = { ...opts, sfx: v }; setOpts(o); replan(genre, o); }} />
          <Toggle label="Pop quando textos aparecem" value={opts.textPops} onChange={(v) => { const o = { ...opts, textPops: v }; setOpts(o); replan(genre, o); }} />
          <Toggle label="Abaixar a música quando houver fala" value={opts.duck} onChange={(v) => { const o = { ...opts, duck: v }; setOpts(o); replan(genre, o); }} />
          <Slider label="Energia" value={opts.energy} min={-1} max={1} step={0.05} center={0} format={(v) => (v > 0.2 ? 'Mais intensa' : v < -0.2 ? 'Mais suave' : 'Natural')} onChange={(v) => { const o = { ...opts, energy: v }; setOpts(o); replan(genre, o); }} />
          <Slider label="Volume da música" value={opts.volume} min={0.1} max={1.5} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setOpts({ ...opts, volume: v })} />
          <div className="row">
            <button className="btn" onClick={preview}>{playing ? '■ Parar' : '▶ Ouvir prévia'}</button>
            <button className="btn" onClick={() => replan(genre, opts, true)}>🎲 Outra versão</button>
          </div>
          <button className="btn primary block" style={{ marginTop: 10, padding: 14 }} onClick={create} data-testid="soundtrack-create">Adicionar trilha ao vídeo</button>
          <button className="btn small ghost block" style={{ marginTop: 6 }} onClick={analyze}>Analisar de novo</button>
        </>
      )}
    </>
  );
}

// ------------------------------------------------------------------ music library (used in Audio panel)
export function MusicLibrary() {
  const [genre, setGenre] = useState('all');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const st = useEditor.getState;
  const list = MUSIC_LIBRARY.filter((t) => genre === 'all' || t.genre === genre);
  const play = async (id: string) => {
    if (playingId === id) { stopPreview(); setPlayingId(null); return; }
    const tr = MUSIC_LIBRARY.find((t) => t.id === id)!;
    setPlayingId(id);
    const plan = planForTrack(tr, 14);
    plan.energy = plan.energy.map((e) => Math.max(e, 0.8));
    const buf = await renderMusic(plan);
    playPreview(buf, () => setPlayingId((p) => (p === id ? null : p)));
  };
  const use = async (id: string) => {
    const s = st();
    stopPreview(); setPlayingId(null);
    const tr = MUSIC_LIBRARY.find((t) => t.id === id)!;
    const pd = projectDuration(s.project!);
    const dur = pd > 0.5 ? pd : 30;
    s.setBusy({ msg: `Gerando “${tr.title}” (${Math.round(dur)}s)…` });
    try {
      const plan = planForTrack(tr, dur);
      plan.hits = s.project!.clips.filter((c) => c.trackId === 'main').map((c) => c.start).filter((t) => t > 0);
      const buf = await renderMusic(plan);
      await addAudioBuffer(buf, `${tr.title} · ${GENRE_MAP.get(tr.genre)!.name}`, 0, 0.8);
      s.notify(`“${tr.title}” adicionada`, 'ok');
    } catch (e) { s.notify((e as Error).message, 'error'); }
    finally { s.setBusy(null); }
  };
  return (
    <>
      <Chips options={[{ v: 'all', label: 'Todas' }, ...GENRES.map((g) => ({ v: g.id, label: `${g.emoji} ${g.name}` }))]} value={genre} onChange={setGenre} scroll />
      <div className="list" style={{ marginTop: 10 }}>
        {list.map((t) => {
          const g = GENRE_MAP.get(t.genre)!;
          return (
            <div key={t.id} className="list-item">
              <button className="icon-btn" style={{ background: 'var(--bg4)', flex: 'none' }} onClick={() => play(t.id)} aria-label={`Ouvir ${t.title}`}>{playingId === t.id ? '■' : '▶'}</button>
              <div className="grow">
                <b style={{ fontSize: 13 }}>{t.title}</b>
                <div className="hint" style={{ margin: 0 }}>{g.emoji} {g.name} · {t.bpm} BPM · {keyName(t.root, g.scale[0])} · {t.moods.join(', ')}</div>
              </div>
              <button className="btn small" onClick={() => use(t.id)} data-testid={`use-track-${t.id}`}>Usar</button>
            </div>
          );
        })}
      </div>
      <p className="hint">Músicas originais compostas no aparelho, sem direitos autorais de terceiros. A duração se adapta ao vídeo e as viradas caem nos cortes.</p>
    </>
  );
}
