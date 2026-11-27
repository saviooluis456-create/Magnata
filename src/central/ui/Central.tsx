import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../ui/components/ui';
import { api, getConfig, type StatusResponse } from '../api';
import { Accounts } from './Accounts';
import { Comments } from './Comments';
import { Metrics } from './Metrics';
import { Publish } from './Publish';
import { Queue } from './Queue';

export type Notify = (msg: string, kind?: 'info' | 'ok' | 'error') => void;
type Tab = 'publicar' | 'fila' | 'comentarios' | 'metricas' | 'contas';
const TABS: [Tab, string][] = [['publicar', 'Publicar'], ['fila', 'Fila'], ['comentarios', 'Comentários'], ['metricas', 'Métricas'], ['contas', 'Contas']];

export default function Central() {
  const [tab, setTab] = useState<Tab>(getConfig() ? 'publicar' : 'contas');
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: string } | null>(null);
  const notify: Notify = useCallback((msg, kind = 'info') => setToast({ msg, kind }), []);

  const refresh = useCallback(async () => {
    if (!getConfig()) { setStatus(null); return; }
    try { setStatus(await api.status()); } catch (e) { notify((e as Error).message, 'error'); }
  }, [notify]);

  useEffect(() => {
    // Return from a network login: #central?conectado=instagram or #central?erro=...
    const q = new URLSearchParams(location.hash.split('?')[1] ?? '');
    if (q.get('conectado')) { notify(`Conta conectada: ${q.get('conectado')}`, 'ok'); setTab('contas'); }
    if (q.get('erro')) { notify(`Não conectou: ${q.get('erro')}`, 'error'); setTab('contas'); }
    if (q.size) history.replaceState(null, '', '#central');
    refresh();
  }, [notify, refresh]);

  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(() => setToast(null), toast.kind === 'error' ? 6000 : 3000);
    return () => clearTimeout(h);
  }, [toast]);

  return (
    <div className="home central">
      <div className="home-head">
        <button className="btn ghost small" onClick={() => { location.hash = ''; }} aria-label="Voltar"><Icon name="back" size={18} /> Editor</button>
        <div className="logo central-logo">LUIZ <span>NO</span> SET</div>
      </div>
      <h1 className="central-title">Central do Set</h1>
      <div className="central-tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'publicar' && <Publish status={status} notify={notify} onDone={() => setTab('fila')} />}
      {tab === 'fila' && <Queue notify={notify} />}
      {tab === 'comentarios' && <Comments status={status} notify={notify} onSettings={refresh} />}
      {tab === 'metricas' && <Metrics status={status} notify={notify} />}
      {tab === 'contas' && <Accounts status={status} notify={notify} refresh={refresh} />}
      {toast && <div className={`toast ${toast.kind}`} role="status">{toast.msg}</div>}
    </div>
  );
}
