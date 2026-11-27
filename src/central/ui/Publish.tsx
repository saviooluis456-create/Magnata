import { useEffect, useMemo, useRef, useState } from 'react';
import { Chips } from '../../ui/components/ui';
import { api, getConfig, type StatusResponse } from '../api';
import { nextVariant, type Experiment, type Perf } from '../core/analytics';
import { buildCaptions } from '../core/captions';
import { cleanTag, suggestHashtags } from '../core/hashtags';
import { checkVideo, detectFormat, formatBytes, recommendedExport } from '../core/quality';
import { EDITORIA_LABEL, NETWORK_LABEL, NETWORKS, type Editoria, type Network, type NetworkCaption, type Post, type VideoMeta } from '../core/types';
import { handoff, readVideoMeta } from '../videoMeta';
import type { Notify } from './Central';

const EDITORIAS = Object.entries(EDITORIA_LABEL) as [Editoria, string][];

export function Publish({ status, notify, onDone }: { status: StatusResponse | null; notify: Notify; onDone: () => void }) {
  const [file, setFile] = useState<{ blob: Blob; name: string } | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [nets, setNets] = useState<Network[]>([]);
  const [editoria, setEditoria] = useState<Editoria>('noticia');
  const [text, setText] = useState('');
  const [workTag, setWorkTag] = useState('');
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('');
  const [hookType, setHookType] = useState('');
  const [when, setWhen] = useState<'agora' | 'agendar'>('agora');
  const [at, setAt] = useState('');
  const [cover, setCover] = useState<number | undefined>();
  const [overrides, setOverrides] = useState<Partial<{ instagram: string; tiktok: string; ytTitle: string; ytDesc: string }>>({});
  const [progress, setProgress] = useState<{ phase: string; p?: number } | null>(null);
  const [result, setResult] = useState<Post | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [exps, setExps] = useState<{ list: Experiment[]; perfs: Perf[] }>({ list: [], perfs: [] });
  const [exp, setExp] = useState<{ id: string; variant: string } | null>(null);
  useEffect(() => {
    if (!getConfig()) return;
    api.intel().then((d) => setExps({ list: d.experiments.filter((e) => e.status === 'ativo'), perfs: d.perfs })).catch(() => {});
  }, []);

  useEffect(() => { if (handoff.video) { pick(handoff.video.blob, handoff.video.name); handoff.video = null; } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const pick = async (blob: Blob, name: string) => {
    setResult(null); setMeta(null); setOverrides({}); setCover(undefined);
    setFile({ blob, name });
    setUrl(URL.createObjectURL(blob));
    try {
      const m = await readVideoMeta(blob);
      setMeta(m);
      setNets(detectFormat(m) === 'short' ? [...NETWORKS] : ['youtube']);
    } catch (e) { notify('Não consegui ler o vídeo: ' + (e as Error).message, 'error'); }
  };

  const format = meta ? detectFormat(meta) : 'short';
  const checks = useMemo(() => (meta ? checkVideo(meta, nets, format) : []), [meta, nets, format]);
  const blocking = checks.some((c) => c.level === 'erro');
  const rec = recommendedExport(format, meta ? Math.min(meta.width, meta.height) : 1080);

  const built = useMemo(() => buildCaptions({
    text, title, source, editoria, format,
    priorityTags: workTag ? [cleanTag(workTag)] : [],
    extraBlocked: status?.settings.extraBlockedHashtags,
    signature: status?.settings.signature,
  }), [text, title, source, editoria, format, workTag, status]);

  const captions: NetworkCaption = {
    instagram: { caption: overrides.instagram ?? built.captions.instagram.caption },
    tiktok: { caption: overrides.tiktok ?? built.captions.tiktok.caption },
    youtube: { title: overrides.ytTitle ?? built.captions.youtube.title, description: overrides.ytDesc ?? built.captions.youtube.description, tags: built.captions.youtube.tags },
  };

  const suggest = () => {
    const have = new Set((text.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((t) => cleanTag(t).toLowerCase()));
    const add = suggestHashtags(editoria, workTag ? [workTag] : []).filter((t) => !have.has(t.toLowerCase()));
    setText((t) => (t.trimEnd() + '\n\n' + add.map((x) => '#' + x).join(' ')).trim());
  };

  const toggle = (n: Network) => setNets((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));

  const submit = async () => {
    if (!file || !meta) return;
    if (!getConfig()) { notify('Configure o servidor na aba Contas.', 'error'); return; }
    const scheduledAt = when === 'agendar' && at ? new Date(at).getTime() : undefined;
    if (when === 'agendar' && (!scheduledAt || scheduledAt < Date.now() + 5 * 60_000)) { notify('Escolha um horário pelo menos 5 minutos à frente.', 'error'); return; }
    try {
      setProgress({ phase: 'Enviando o vídeo original (sem perder qualidade)…', p: 0 });
      const objectKey = await api.upload(file.blob, file.name, (p) => setProgress({ phase: 'Enviando o vídeo original (sem perder qualidade)…', p }));
      setProgress({ phase: scheduledAt ? 'Agendando…' : 'Publicando nas redes… (o Instagram leva alguns minutos para processar)' });
      const post = await api.createPost({ objectKey, meta, networks: nets, captions, scheduledAt, editoria, hookType: hookType || undefined, coverOffsetMs: cover != null ? cover * 1000 : undefined, experiment: exp ?? undefined });
      setResult(post);
      const ok = post.targets.filter((t) => t.status === 'publicado' || t.status === 'privado' || t.status === 'agendado').length;
      notify(scheduledAt ? 'Agendado!' : `${ok} de ${post.targets.length} redes concluídas`, ok === post.targets.length ? 'ok' : 'error');
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally { setProgress(null); }
  };

  if (progress) {
    return (
      <div className="c-card" style={{ textAlign: 'center' }}>
        <div className="spinner" />
        <b>{progress.phase}</b>
        {progress.p != null && <div className="progress" style={{ margin: '14px 0' }}><i style={{ width: `${Math.round(progress.p * 100)}%` }} /></div>}
        <p className="hint">Mantenha esta tela aberta até terminar.</p>
      </div>
    );
  }

  if (result) {
    return (
      <div className="central-stack">
        <div className="c-card">
          <h3>{result.scheduledAt ? `Agendado para ${new Date(result.scheduledAt).toLocaleString('pt-BR')}` : 'Resultado'}</h3>
          {result.targets.map((t) => <TargetLine key={t.network} t={t} />)}
        </div>
        <div className="row">
          <button className="btn primary" onClick={() => { setResult(null); setFile(null); setMeta(null); setText(''); setTitle(''); setOverrides({}); }}>Novo post</button>
          <button className="btn" onClick={onDone}>Ver fila</button>
        </div>
      </div>
    );
  }

  return (
    <div className="central-stack">
      <div className="c-card">
        <h3>1. Vídeo</h3>
        <label className="btn primary block file-btn">
          {file ? 'Trocar vídeo' : 'Escolher vídeo'}
          <input type="file" accept="video/mp4,video/quicktime,video/webm" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f, f.name); e.target.value = ''; }} />
        </label>
        <p className="hint">Dica: no editor, exporte e toque em <b>Publicar na Central</b>. O arquivo vai original, sem recompressão.</p>
        {url && <video ref={videoRef} className="result-video" src={url} controls playsInline />}
        {meta && (
          <>
            <p><span className="pill">{format === 'short' ? 'Curto (Reels · TikTok · Shorts)' : 'Vídeo longo (YouTube)'}</span>{' '}
              <span className="hint">{meta.width}x{meta.height} · {meta.duration.toFixed(1)}s · {formatBytes(meta.sizeBytes)}{meta.fps ? ` · ${Math.round(meta.fps)} fps` : ''}{meta.videoBitrate ? ` · ${(meta.videoBitrate / 1e6).toFixed(1)} Mbps` : ''}</span></p>
            <ul className="checks">{checks.map((c, i) => <li key={i} className={c.level}>{c.level === 'ok' ? '✅' : c.level === 'aviso' ? '⚠️' : '⛔'} {c.network !== 'geral' && <b>{NETWORK_LABEL[c.network]}: </b>}{c.message}</li>)}</ul>
            <details><summary className="hint">Exportação ideal para este formato</summary>
              <p className="hint">{rec.width}x{rec.height} · {rec.fps} fps · {rec.codec} · {rec.videoMbps} Mbps · {rec.audio}. {rec.note}</p></details>
            <button className="btn small ghost" onClick={() => { const t = videoRef.current?.currentTime; if (t != null) { setCover(t); notify(`Capa: quadro em ${t.toFixed(1)}s`, 'ok'); } }}>
              🖼️ Usar quadro atual como capa{cover != null ? ` (${cover.toFixed(1)}s)` : ''}</button>
          </>
        )}
      </div>

      <div className="c-card">
        <h3>2. Onde publicar</h3>
        <div className="net-toggles">
          {NETWORKS.map((n) => {
            const acc = status?.accounts.find((a) => a.network === n);
            const label = n === 'youtube' ? (format === 'short' ? 'YouTube Shorts' : 'YouTube (longo)') : n === 'instagram' ? 'Instagram Reels' : 'TikTok';
            return (
              <button key={n} className={`net-toggle net-${n} ${nets.includes(n) ? 'on' : ''}`} onClick={() => toggle(n)}>
                <b>{label}</b><small>{acc?.connected ? `@${(acc.handle ?? '').replace(/^@/, '')}` : 'não conectado'}</small>
              </button>
            );
          })}
        </div>
        <p className="hint">Editoria (para as métricas e as hashtags sugeridas)</p>
        <Chips options={EDITORIAS.map(([v, label]) => ({ v, label }))} value={editoria} onChange={setEditoria} scroll />
      </div>

      <div className="c-card">
        <h3>3. Legenda</h3>
        <label className="c-field"><span>Texto (a primeira linha é o gancho e vira o título do YouTube)</span>
          <textarea rows={6} value={text} onChange={(e) => { setText(e.target.value); setOverrides({}); }} placeholder={'Duna 3: o que você precisa lembrar antes de ver\nTrês detalhes que você esqueceu.\nVocê vai no cinema ou espera as críticas?\n#Duna #filmes'} /></label>
        <div className="c-grid2">
          <label className="c-field"><span>Hashtag da obra</span><input value={workTag} onChange={(e) => setWorkTag(e.target.value)} placeholder="Duna" /></label>
          <label className="c-field"><span>Fonte</span><input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Variety" /></label>
          <label className="c-field"><span>Título do YouTube (opcional)</span><input value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className="c-field"><span>Tipo de gancho (opcional)</span><input value={hookType} onChange={(e) => setHookType(e.target.value)} placeholder="ex.: 'caso real inspirou'" /></label>
        </div>
        <button className="btn small" onClick={suggest}># Sugerir hashtags</button>
        {exps.list.length > 0 && (
          <div className="exp-pick">
            <span className="hint">🧪 Este vídeo faz parte de um teste A/B?</span>
            <Chips options={[{ v: '', label: 'Não' }, ...exps.list.map((e) => ({ v: e.id, label: e.name }))]} value={exp?.id ?? ''} scroll
              onChange={(id) => { const e = exps.list.find((x) => x.id === id); setExp(e ? { id: e.id, variant: nextVariant(e, exps.perfs) } : null); }} />
            {exp && (() => { const e = exps.list.find((x) => x.id === exp.id)!; return (
              <>
                <p className="warn">Use a variante <b>{exp.variant}</b> neste vídeo (mantém os grupos equilibrados).</p>
                <Chips options={e.variants.map((v) => ({ v, label: v }))} value={exp.variant} onChange={(v) => setExp({ id: e.id, variant: v })} />
              </>
            ); })()}
          </div>
        )}
        {built.warnings.map((w, i) => <p key={i} className="warn">⚠️ {w}</p>)}
        {NETWORKS.filter((n) => nets.includes(n)).map((n) => {
          const removed = built.removed[n];
          return (
            <div key={n} className={`preview net-${n}`}>
              <div className="c-row"><b>{NETWORK_LABEL[n]}</b>{removed.length > 0 && <span className="hint">{removed.length} hashtag(s) filtrada(s)</span>}</div>
              {n === 'youtube' ? (
                <>
                  <input value={captions.youtube.title} maxLength={100} onChange={(e) => setOverrides((o) => ({ ...o, ytTitle: e.target.value }))} />
                  <textarea rows={4} value={captions.youtube.description} onChange={(e) => setOverrides((o) => ({ ...o, ytDesc: e.target.value }))} />
                </>
              ) : (
                <textarea rows={5} value={captions[n].caption} onChange={(e) => setOverrides((o) => ({ ...o, [n]: e.target.value }))} />
              )}
              {removed.length > 0 && <ul className="removed">{removed.map((r) => <li key={r.tag}>#{r.tag}: {r.reason}</li>)}</ul>}
            </div>
          );
        })}
      </div>

      <div className="c-card">
        <h3>4. Quando</h3>
        <Chips options={[{ v: 'agora', label: 'Publicar agora' }, { v: 'agendar', label: 'Agendar' }]} value={when} onChange={(v) => setWhen(v as 'agora' | 'agendar')} />
        {when === 'agendar' && <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className="c-input" />}
        <button className="btn primary block publish-btn" disabled={!meta || !nets.length || blocking || !text.trim()} onClick={submit}>
          {when === 'agendar' ? 'Agendar' : 'Publicar'} em {nets.length} rede(s)
        </button>
        {blocking && <p className="warn">Corrija os itens marcados com ⛔ antes de publicar.</p>}
      </div>
    </div>
  );
}

export function TargetLine({ t }: { t: Post['targets'][number] }) {
  const icon = { publicado: '✅', privado: '🔒', agendado: '🕒', pendente: '⏳', enviando: '⏳', erro: '⛔' }[t.status];
  return (
    <div className="target">
      <span>{icon} <b>{NETWORK_LABEL[t.network]}</b> · {t.status}</span>
      {t.url && <a href={t.url} target="_blank" rel="noreferrer">abrir</a>}
      {t.error && <small className={t.status === 'erro' ? 'err' : 'hint'}>{t.error}</small>}
    </div>
  );
}
