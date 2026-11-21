import { useEffect, useRef, useState } from 'react';
import { audioBufferToWav } from '../../engine/audioMix';
import { audioCtx } from '../../engine/media';
import { SFX, SFX_CATEGORIES, sfxBuffer, sfxDuration } from '../../engine/sfx';
import { MusicLibrary } from './SoundtrackPanel';
import { ASPECTS, makeClip } from '../../model/defaults';
import { formatTime } from '../../model/timeline';
import { useEditor } from '../../store/editor';
import { importFiles, importGenerated, pickFiles } from '../actions';
import { Chips, Grid, Icon, PALETTE, Section, Slider, Swatches, Tabs, Tile } from '../components/ui';

export function MediaPanel() {
  const media = useEditor((s) => s.project!.media);
  const st = useEditor.getState;
  return (
    <>
      <Grid cols={3}>
        <Tile label="Vídeos e fotos" icon={<Icon name="media" size={28} />} onClick={async () => importFiles(await pickFiles('video/*,image/*'), 'main')} />
        <Tile label="Câmera" icon={<Icon name="record" size={28} />} onClick={async () => importFiles(await pickFiles('video/*;capture=camera', false), 'main')} />
        <Tile label="Cor sólida" icon={<div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--grad)' }} />} onClick={() => {
          st().edit((p) => { const c = makeClip('color', 'main', { start: 1e6, duration: 3, color: '#111827', name: 'Cor' }); p.clips.push(c); });
        }} />
      </Grid>
      {media.length > 0 && (
        <Section title="Biblioteca do projeto">
          <Grid cols={4}>
            {media.map((m) => (
              <Tile key={m.id} label={m.name} icon={m.thumb ? <img src={m.thumb} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <Icon name={m.kind === 'audio' ? 'audio' : 'media'} />}
                badge={m.kind === 'video' || m.kind === 'audio' ? formatTime(m.duration, false) : undefined}
                onClick={() => st().addMedia([m], m.kind === 'audio' ? 'audio' : 'main')} />
            ))}
          </Grid>
          <p className="hint">Toque para adicionar novamente à linha do tempo.</p>
        </Section>
      )}
    </>
  );
}

export function OverlayPanel() {
  const allMedia = useEditor((s) => s.project!.media);
  const media = allMedia.filter((m) => m.kind !== 'audio');
  const st = useEditor.getState;
  return (
    <>
      <p className="hint">Sobreposições ficam acima do vídeo principal (picture-in-picture, logos, B-roll, tela verde).</p>
      <Grid cols={3}>
        <Tile label="Adicionar sobreposição" icon={<Icon name="overlay" size={28} />} onClick={async () => importFiles(await pickFiles('video/*,image/*'), 'overlay')} />
      </Grid>
      {media.length > 0 && (
        <Section title="Da biblioteca">
          <Grid cols={4}>
            {media.map((m) => (
              <Tile key={m.id} label={m.name} icon={m.thumb ? <img src={m.thumb} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <Icon name="media" />} onClick={() => st().addMedia([m], 'overlay')} />
            ))}
          </Grid>
        </Section>
      )}
    </>
  );
}

export function AudioPanel() {
  const [tab, setTab] = useState<'library' | 'sfx' | 'mine'>('library');
  const [cat, setCat] = useState('transicao');
  const allMedia = useEditor((s) => s.project!.media);
  const media = allMedia.filter((m) => m.kind === 'audio');
  const st = useEditor.getState;
  const preview = (id: string) => {
    const ctx = audioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const src = ctx.createBufferSource();
    src.buffer = sfxBuffer(ctx, id, sfxDuration(id));
    src.connect(ctx.destination);
    src.start();
  };
  const addSfx = (id: string, name: string) => {
    const ctx = audioCtx();
    const wav = audioBufferToWav(sfxBuffer(ctx, id, sfxDuration(id)));
    importGenerated(wav, `${name}.wav`, 'audio');
  };
  return (
    <>
      <Tabs tabs={[{ id: 'library', label: 'Músicas' }, { id: 'sfx', label: 'Efeitos sonoros' }, { id: 'mine', label: 'Meus áudios' }]} value={tab} onChange={setTab} />
      {tab === 'library' && (
        <>
          <button className="btn primary block" style={{ marginBottom: 10 }} onClick={() => st().openPanel('soundtrack')}>✨ Criar trilha automática para este vídeo</button>
          <MusicLibrary />
        </>
      )}
      {tab === 'mine' && (
        <>
          <Grid cols={3}>
            <Tile label="Importar áudio" icon={<Icon name="audio" size={28} />} onClick={async () => importFiles(await pickFiles('audio/*,video/*'), 'audio')} />
            <Tile label="Narração" icon={<Icon name="voice" size={28} />} onClick={() => st().openPanel('record')} />
            <Tile label="Extrair de vídeo" icon={<Icon name="detach" size={28} />} onClick={async () => importFiles(await pickFiles('video/*'), 'audio')} />
          </Grid>
          {media.length > 0 && (
            <Section title="No projeto">
              <div className="list">
                {media.map((m) => (
                  <div key={m.id} className="list-item">
                    <Icon name="audio" />
                    <div className="grow"><b style={{ fontSize: 13 }}>{m.name}</b><div className="hint" style={{ margin: 0 }}>{formatTime(m.duration, false)}</div></div>
                    <button className="btn small" onClick={() => st().addMedia([m], 'audio')}>Usar</button>
                  </div>
                ))}
              </div>
            </Section>
          )}
          <p className="hint">Dica: use “Sincronizar batidas” em IA para cortar seus clipes no ritmo da música.</p>
        </>
      )}
      {tab === 'sfx' && (
        <>
          <Tabs tabs={SFX_CATEGORIES.map((c) => ({ id: c.id, label: c.name }))} value={cat} onChange={setCat} />
          <Grid cols={4}>
            {SFX.filter((s) => s.cat === cat).map((s) => (
              <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Tile label={s.name} icon={s.icon} onClick={() => preview(s.id)} />
                <button className="btn small" onClick={() => addSfx(s.id, s.name)} style={{ padding: '4px 6px' }}>+ Usar</button>
              </div>
            ))}
          </Grid>
          <p className="hint">Toque para ouvir. Os efeitos são sintetizados no aparelho e livres de direitos.</p>
        </>
      )}
    </>
  );
}

export function RecordPanel() {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [withVideo, setWithVideo] = useState(true);
  const startT = useRef(0);
  const chunks = useRef<Blob[]>([]);
  const st = useEditor.getState;
  useEffect(() => {
    if (!rec) return;
    const t0 = performance.now();
    const h = setInterval(() => setElapsed((performance.now() - t0) / 1000), 100);
    return () => clearInterval(h);
  }, [rec]);
  useEffect(() => () => { rec?.stream.getTracks().forEach((t) => t.stop()); }, [rec]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const types = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'];
      const mimeType = types.find((t) => MediaRecorder.isTypeSupported?.(t));
      const r = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: r.mimeType || 'audio/webm' });
        st().setPlaying(false);
        st().setTime(startT.current);
        const ext = (r.mimeType || '').includes('mp4') ? 'm4a' : 'webm';
        await importGenerated(blob, `narracao.${ext}`, 'audio');
        setRec(null);
      };
      startT.current = st().time;
      r.start(250);
      setRec(r);
      setElapsed(0);
      if (withVideo) {
        // mute timeline while recording to avoid echo, but keep video playing
        st().setPlaying(true);
      }
    } catch (e) {
      st().notify('Microfone indisponível: ' + (e as Error).message, 'error');
    }
  };
  return (
    <div style={{ textAlign: 'center', padding: '10px 0' }}>
      <div style={{ fontSize: 34, fontVariantNumeric: 'tabular-nums', margin: '8px 0' }}>{formatTime(elapsed)}</div>
      {!rec ? (
        <button className="btn primary" onClick={start} style={{ borderRadius: 40, padding: '16px 28px' }}><Icon name="record" /> Gravar narração</button>
      ) : (
        <button className="btn danger" onClick={() => rec.stop()} style={{ borderRadius: 40, padding: '16px 28px' }}>■ Parar e inserir</button>
      )}
      <label className="toggle" style={{ maxWidth: 360, margin: '14px auto 0' }}>
        <span>Reproduzir o vídeo enquanto grava<small>Use fones para evitar eco</small></span>
        <input type="checkbox" checked={withVideo} onChange={(e) => setWithVideo(e.target.checked)} /><i />
      </label>
      <p className="hint">A narração é inserida na posição em que a gravação começou. Depois, aplique “Melhorar voz” no painel Voz.</p>
    </div>
  );
}

const STICKERS: Record<string, string[]> = {
  'Populares': ['🔥', '😂', '❤️', '😍', '👀', '💯', '✨', '🎉', '👏', '🙌', '💪', '🚀', '⭐', '💥', '💰', '👑', '😱', '🤯', '🥳', '😎', '🤔', '😭', '🙏', '✅', '❌', '⚠️', '📌', '👉', '👇', '⬆️'],
  'Rostos': ['😀', '😃', '😄', '😁', '😆', '🥹', '😅', '🤣', '😊', '😇', '🙂', '😉', '😌', '😋', '😛', '😜', '🤪', '🤨', '🧐', '🤓', '🥸', '🤩', '😏', '😒', '😞', '😔', '😟', '😕', '😣', '😤', '😠', '😡', '🤬', '🥵', '🥶', '😳', '🫣', '🤫', '😴', '🤮'],
  'Gestos': ['👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘', '👌', '🤌', '🤏', '👈', '👆', '☝️', '✋', '🤚', '🖐', '🖖', '👋', '🤙', '💅', '🫶', '🤝'],
  'Objetos': ['📱', '💻', '🎬', '🎥', '📸', '🎧', '🎤', '🎵', '🎶', '📈', '📉', '💡', '🔔', '📣', '🎁', '🏆', '🥇', '⏰', '⌛', '💎', '🔑', '🧠', '💊', '🛒', '💳'],
  'Natureza': ['🌞', '🌙', '⭐', '🌈', '☁️', '⚡', '❄️', '🌊', '🌸', '🌹', '🌻', '🍀', '🌴', '🍁', '🐶', '🐱', '🦁', '🐻', '🐼', '🦄', '🦋', '🐝'],
  'Comida': ['🍕', '🍔', '🍟', '🌭', '🍿', '🍩', '🍪', '🎂', '🍫', '🍦', '☕', '🍺', '🍷', '🥤', '🍓', '🍉', '🥑', '🌮', '🍣', '🍜'],
};

export function StickersPanel() {
  const [cat, setCat] = useState('Populares');
  const st = useEditor.getState;
  const add = (e: string) => {
    st().addText(e, { name: 'Sticker' });
    const id = st().selectedId;
    if (!id) return;
    st().updateClip(id, (c) => {
      c.text = { ...c.text!, text: e, size: 220, strokeWidth: 0, shadowBlur: 18, shadowY: 8, font: 'Inter' };
      c.anims = { in: { type: 'pop', duration: 0.35 }, out: null, loop: { type: 'wiggle', duration: 1.2 } };
    }, 'sticker');
    useEditor.setState({ panel: 'stickers' });
  };
  return (
    <>
      <Tabs tabs={Object.keys(STICKERS).map((k) => ({ id: k, label: k }))} value={cat} onChange={setCat} />
      <Grid cols={6}>
        {STICKERS[cat].map((e) => (
          <button key={e} className="tile" onClick={() => add(e)} style={{ fontSize: 30, padding: 6 }} aria-label={e}>{e}</button>
        ))}
      </Grid>
    </>
  );
}

export function FormatPanel() {
  const aspect = useEditor((s) => s.project!.aspect);
  const fps = useEditor((s) => s.project!.fps);
  const st = useEditor.getState;
  return (
    <>
      <Section title="Proporção">
        <Grid cols={3}>
          {ASPECTS.map((a) => {
            const r = a.w / a.h;
            return (
              <Tile key={a.id} label={`${a.label} · ${a.hint}`} active={aspect === a.id} onClick={() => st().setAspect(a.id)}
                icon={<div style={{ border: '2px solid currentColor', borderRadius: 4, width: r >= 1 ? 40 : 40 * r, height: r >= 1 ? 40 / r : 40 }} />} />
            );
          })}
        </Grid>
      </Section>
      <Section title="Taxa de quadros do projeto">
        <Chips options={[24, 25, 30, 50, 60].map((v) => ({ v, label: `${v} fps` }))} value={fps} onChange={(v) => st().edit((p) => { p.fps = v; })} />
      </Section>
    </>
  );
}

export function BackgroundPanel() {
  const bg = useEditor((s) => s.project!.background);
  const st = useEditor.getState;
  const set = (fn: (b: typeof bg) => void) => st().edit((p) => fn(p.background), 'bg');
  return (
    <>
      <Chips options={[{ v: 'blur', label: 'Desfoque' }, { v: 'color', label: 'Cor' }]} value={bg.type} onChange={(v) => set((b) => { b.type = v as 'blur' | 'color'; })} />
      {bg.type === 'blur' && <Slider label="Intensidade do desfoque" value={bg.blur} min={0} max={1} step={0.05} onChange={(v) => set((b) => { b.blur = v; })} format={(v) => `${Math.round(v * 100)}%`} />}
      <Section title="Cor de fundo">
        <Swatches colors={PALETTE} value={bg.color} onChange={(c) => set((b) => { b.color = c; })} />
      </Section>
      <p className="hint">O fundo aparece quando o vídeo não preenche todo o quadro (ex.: vídeo horizontal em formato 9:16).</p>
    </>
  );
}
