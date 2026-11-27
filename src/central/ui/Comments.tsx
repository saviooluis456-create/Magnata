import { useEffect, useState } from 'react';
import { Chips } from '../../ui/components/ui';
import { api, type StatusResponse } from '../api';
import { NETWORK_LABEL, type CommentItem, type ReplyMode } from '../core/types';
import type { Notify } from './Central';

const FILTERS = [
  { v: 'revisar', label: 'Para você' }, { v: 'rascunho', label: 'Rascunhos da IA' }, { v: 'novo', label: 'Novos' },
  { v: 'respondido', label: 'Respondidos' }, { v: '', label: 'Todos' },
];
const KIND: Record<string, string> = {
  simples: 'elogio/reação', pergunta: 'pergunta', critica: 'crítica', ofensivo: 'ofensivo', sensivel: 'sensível', marca: 'marca/parceria', spam: 'spam',
};

export function Comments({ status, notify, onSettings }: { status: StatusResponse | null; notify: Notify; onSettings: () => void }) {
  const [filter, setFilter] = useState('rascunho');
  const [items, setItems] = useState<CommentItem[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [syncing, setSyncing] = useState(false);

  const load = (f = filter) => api.comments(f || undefined).then(setItems).catch((e) => notify(e.message, 'error'));
  useEffect(() => { load(filter); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const sync = async () => {
    setSyncing(true);
    try { const r = await api.syncComments(); notify(`${r.novos} novo(s) · ${r.respondidos} respondido(s) automaticamente`, 'ok'); await load(); }
    catch (e) { notify((e as Error).message, 'error'); } finally { setSyncing(false); }
  };

  const send = async (c: CommentItem) => {
    const text = drafts[c.id] ?? c.draft ?? '';
    try { await api.reply(c.id, text); notify('Resposta enviada', 'ok'); await load(); } catch (e) { notify((e as Error).message, 'error'); }
  };
  const ignore = async (c: CommentItem) => { try { await api.ignore(c.id); await load(); } catch (e) { notify((e as Error).message, 'error'); } };

  const setMode = async (mode: ReplyMode) => {
    if (!status) return;
    if (mode === 'automatico' && !confirm('No automático, a IA responde sozinha elogios, perguntas e contatos de marca. Comentários sensíveis, críticas e ofensas continuam vindo para você. Ativar?')) return;
    try { await api.saveSettings({ ...status.settings, replyMode: mode }); onSettings(); notify('Modo atualizado', 'ok'); } catch (e) { notify((e as Error).message, 'error'); }
  };

  return (
    <div className="central-stack">
      <div className="c-card">
        <h3>Respostas com IA</h3>
        <Chips options={[{ v: 'aprovacao', label: 'Aprovação', hint: 'IA escreve, você aprova' }, { v: 'automatico', label: 'Automático', hint: 'só o que é seguro' }, { v: 'desligado', label: 'Desligado' }]}
          value={status?.settings.replyMode ?? 'aprovacao'} onChange={(v) => setMode(v as ReplyMode)} />
        <p className="hint">O servidor busca comentários a cada 15 minutos. TikTok não tem API pública de comentários: peça ao Claude "responder comentários do TikTok" (via Windsor.ai).</p>
        <button className="btn small" disabled={syncing} onClick={sync}>{syncing ? 'Buscando…' : '↻ Buscar agora'}</button>
      </div>
      <Chips options={FILTERS} value={filter} onChange={setFilter} scroll />
      {!items ? <div className="spinner" /> : !items.length ? <div className="empty">Nenhum comentário aqui.</div> : items.map((c) => (
        <div key={c.id} className={`c-card comment net-${c.network}`}>
          <div className="c-row">
            <span><b>@{c.author}</b> <span className="hint">· {NETWORK_LABEL[c.network]} · {new Date(c.createdAt).toLocaleString('pt-BR')}</span></span>
            {c.kind && <span className={`pill kind-${c.kind}`}>{KIND[c.kind]}</span>}
          </div>
          <p className="comment-text">{c.text}</p>
          {c.status === 'respondido'
            ? <p className="reply">↳ {c.replyText}</p>
            : c.status !== 'ignorado' && (
              <>
                <textarea rows={2} value={drafts[c.id] ?? c.draft ?? ''} placeholder="Escreva a resposta…" onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))} />
                <div className="row">
                  <button className="btn small primary" disabled={!(drafts[c.id] ?? c.draft ?? '').trim()} onClick={() => send(c)}>Enviar</button>
                  <button className="btn small ghost" onClick={() => ignore(c)}>Ignorar</button>
                </div>
              </>
            )}
        </div>
      ))}
    </div>
  );
}
