import { useState } from 'react';
import { VOICE_PRESETS, enhanceVoice, sliceBuffer, type VoiceSettings } from '../../audio/voice';
import { audioBufferToWav } from '../../engine/audioMix';
import { audioCtx, decodeAudio, importBlob } from '../../engine/media';
import { makeClip } from '../../model/defaults';
import { clipEnd, mediaById } from '../../model/timeline';
import type { Clip } from '../../model/types';
import { useEditor } from '../../store/editor';
import { Chips, Grid, Section, Slider, Tile } from '../components/ui';

let previewNode: AudioBufferSourceNode | null = null;
function play(buf: AudioBuffer) {
  try { previewNode?.stop(); } catch { /* */ }
  const ctx = audioCtx();
  if (ctx.state === 'suspended') ctx.resume();
  const s = ctx.createBufferSource();
  s.buffer = buf; s.connect(ctx.destination); s.start();
  previewNode = s;
}

/** AI voice studio for one clip: process its audio and place the result on the timeline. */
export function VoiceStudio({ c }: { c: Clip }) {
  const project = useEditor((s) => s.project!);
  const [preset, setPreset] = useState('podcast');
  const [s, setS] = useState<VoiceSettings>(VOICE_PRESETS[0].s);
  const [preview, setPreview] = useState<{ before: AudioBuffer; after: AudioBuffer } | null>(null);
  const m = mediaById(project, c.mediaId);
  if (!m?.hasAudio) return <p className="hint">Este clipe não tem áudio.</p>;
  const pick = (id: string) => { const p = VOICE_PRESETS.find((x) => x.id === id)!; setPreset(id); setS({ ...p.s }); setPreview(null); };
  const range = () => [c.in, c.in + c.duration * c.speed] as const;

  const run = async (previewOnly: boolean) => {
    const st = useEditor.getState();
    st.setPlaying(false);
    try {
      st.setBusy({ msg: 'Carregando áudio…', progress: 0 });
      const full = await decodeAudio(m.id);
      if (!full) throw new Error('Não foi possível ler o áudio deste clipe');
      let [a, b] = range();
      if (previewOnly) b = Math.min(b, a + 10);
      const seg = sliceBuffer(full, a, b);
      const out = await enhanceVoice(seg, s, (msg, f) => st.setBusy({ msg, progress: f }));
      if (previewOnly) { setPreview({ before: seg, after: out }); play(out); return; }
      st.setBusy({ msg: 'Salvando áudio aprimorado…', progress: 1 });
      const asset = await importBlob(audioBufferToWav(out), `${m.name.replace(/\.[^.]+$/, '')} (estúdio).wav`);
      asset.name = `🎙 ${m.name} · estúdio`;
      st.edit((d) => {
        if (!d.media.find((x) => x.id === asset.id)) d.media.push(asset);
        const orig = d.clips.find((x) => x.id === c.id);
        if (!orig) return;
        if (orig.kind === 'audio') {
          // replace the source in place
          orig.mediaId = asset.id; orig.in = 0; orig.name = asset.name;
          orig.audio = { ...orig.audio, enhance: false, denoise: false };
        } else {
          // video: mute the camera audio and add the studio audio aligned below
          orig.audio.muted = true;
          let track = d.tracks.find((t) => t.kind === 'audio' && !d.clips.some((x) => x.trackId === t.id && x.start < clipEnd(orig) && clipEnd(x) > orig.start));
          if (!track) { track = { id: 'tv' + Date.now().toString(36), kind: 'audio', name: 'Voz (estúdio)', muted: false, hidden: false, locked: false }; d.tracks.push(track); }
          d.clips.push(makeClip('audio', track.id, { mediaId: asset.id, name: asset.name, start: orig.start, duration: orig.duration, speed: orig.speed, in: 0 }));
        }
      });
      st.notify('Voz aprimorada com qualidade de estúdio 🎙', 'ok');
      setPreview(null);
    } catch (e) {
      st.notify('Estúdio de voz: ' + (e as Error).message, 'error');
    } finally {
      st.setBusy(null);
    }
  };

  return (
    <>
      <p className="hint">Limpa a voz como um estúdio: IA de remoção de ruído, remoção de eco, equalização, de-esser, compressão e volume padrão de podcast (LUFS). O áudio original fica guardado — dá para desfazer.</p>
      <Grid cols={3}>
        {VOICE_PRESETS.map((p) => <Tile key={p.id} label={p.name} icon={p.icon} active={preset === p.id} onClick={() => pick(p.id)} />)}
      </Grid>
      <p className="hint">{VOICE_PRESETS.find((p) => p.id === preset)?.hint}</p>
      <Slider label="Intensidade" value={s.strength} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setS({ ...s, strength: v })} />
      <Section title="Ajuste fino">
        <Slider label="Remover ruído (IA)" value={s.denoise} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setS({ ...s, denoise: v })} />
        <Slider label="Ruído residual" value={s.gate} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setS({ ...s, gate: v })} />
        <Slider label="Remover eco" value={s.dereverb} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setS({ ...s, dereverb: v })} />
        <Slider label="De-esser (chiado do S)" value={s.deess} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setS({ ...s, deess: v })} />
        <Slider label="Compressão" value={s.compress} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setS({ ...s, compress: v })} />
        <div className="hint">Timbre</div>
        <Chips options={[{ v: 'natural', label: 'Natural' }, { v: 'podcast', label: 'Podcast' }, { v: 'warm', label: 'Quente' }, { v: 'bright', label: 'Brilhante' }, { v: 'radio', label: 'Rádio' }]} value={s.eq} onChange={(v) => setS({ ...s, eq: v as VoiceSettings['eq'] })} />
        <div className="hint" style={{ marginTop: 8 }}>Volume final</div>
        <Chips options={[{ v: -14, label: '−14 LUFS', hint: 'Redes' }, { v: -16, label: '−16 LUFS', hint: 'Podcast' }, { v: -19, label: '−19 LUFS', hint: 'Suave' }, { v: -23, label: '−23 LUFS', hint: 'TV' }]} value={s.loudness} onChange={(v) => setS({ ...s, loudness: v })} />
      </Section>
      <div className="row">
        <button className="btn" onClick={() => run(true)} data-testid="voice-preview">▶ Ouvir prévia (10s)</button>
        {preview && <button className="btn" onClick={() => play(preview.before)}>Antes</button>}
        {preview && <button className="btn" onClick={() => play(preview.after)}>Depois</button>}
      </div>
      <button className="btn primary block" style={{ marginTop: 10, padding: 14 }} onClick={() => run(false)} data-testid="voice-apply">🎙 Aplicar estúdio de voz</button>
    </>
  );
}
