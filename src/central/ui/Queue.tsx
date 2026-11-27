import { useEffect, useState } from 'react';
import { api } from '../api';
import { EDITORIA_LABEL, type Post } from '../core/types';
import type { Notify } from './Central';
import { TargetLine } from './Publish';

export function Queue({ notify }: { notify: Notify }) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => api.posts().then(setPosts).catch((e) => notify(e.message, 'error'));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const retry = async (p: Post) => {
    setBusy(p.id);
    try { await api.retry(p.id); await load(); } catch (e) { notify((e as Error).message, 'error'); } finally { setBusy(null); }
  };
  const remove = async (p: Post) => {
    if (!confirm('Remover da fila? (Não apaga o que já foi publicado nas redes.)')) return;
    try { await api.deletePost(p.id); await load(); } catch (e) { notify((e as Error).message, 'error'); }
  };

  if (!posts) return <div className="c-card"><div className="spinner" /></div>;
  if (!posts.length) return <div className="empty">Nada publicado ainda.</div>;
  return (
    <div className="central-stack">
      <button className="btn small ghost" onClick={load}>↻ Atualizar</button>
      {posts.map((p) => (
        <div key={p.id} className="c-card">
          <div className="c-row">
            <b className="clip1">{p.captions.youtube.title}</b>
            <span className="pill">{p.format === 'short' ? 'Curto' : 'Longo'}{p.editoria ? ` · ${EDITORIA_LABEL[p.editoria]}` : ''}</span>
          </div>
          <p className="hint">{p.scheduledAt ? `Agendado: ${new Date(p.scheduledAt).toLocaleString('pt-BR')}` : `Criado: ${new Date(p.createdAt).toLocaleString('pt-BR')}`}</p>
          {p.targets.map((t) => <TargetLine key={t.network} t={t} />)}
          <div className="row">
            {p.targets.some((t) => t.status === 'erro') && <button className="btn small" disabled={busy === p.id} onClick={() => retry(p)}>{busy === p.id ? 'Tentando…' : 'Tentar de novo'}</button>}
            <button className="btn small ghost" onClick={() => remove(p)}>Remover</button>
          </div>
        </div>
      ))}
    </div>
  );
}
