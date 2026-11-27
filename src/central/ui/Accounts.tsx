import { useState } from 'react';
import { api, getConfig, setConfig, type StatusResponse } from '../api';
import { NETWORK_LABEL, NETWORKS, type Network } from '../core/types';
import type { Notify } from './Central';

const HELP: Record<Network, string> = {
  instagram: 'Conta profissional (Criador). Publica Reels, responde comentários e lê métricas.',
  tiktok: 'Publica vídeos e lê métricas. Até o TikTok aprovar o app, os vídeos chegam como privados. Comentários do TikTok: pelo Windsor.ai.',
  youtube: 'Entre e escolha a Conta de Marca "Luiz no Set". Publica Shorts e vídeos longos, responde comentários e lê métricas com retenção.',
};

export function Accounts({ status, notify, refresh }: { status: StatusResponse | null; notify: Notify; refresh: () => Promise<void> }) {
  const cfg = getConfig();
  const [apiUrl, setApiUrl] = useState(cfg?.apiUrl ?? '');
  const [token, setToken] = useState(cfg?.token ?? '');
  const [busy, setBusy] = useState(false);
  const [sig, setSig] = useState(status?.settings.signature ?? '');
  const [blocked, setBlocked] = useState((status?.settings.extraBlockedHashtags ?? []).join(' '));

  const save = async () => {
    setBusy(true);
    setConfig({ apiUrl: apiUrl.trim(), token: token.trim() });
    try { await api.status(); notify('Servidor conectado', 'ok'); await refresh(); }
    catch (e) { notify((e as Error).message, 'error'); }
    finally { setBusy(false); }
  };

  const connect = async (n: Network) => {
    try { const { url } = await api.connect(n); location.href = url; }
    catch (e) { notify((e as Error).message, 'error'); }
  };

  const disconnect = async (n: Network) => {
    if (!confirm(`Desconectar ${NETWORK_LABEL[n]}?`)) return;
    try { await api.disconnect(n); await refresh(); } catch (e) { notify((e as Error).message, 'error'); }
  };

  const saveSettings = async () => {
    if (!status) return;
    try {
      await api.saveSettings({ ...status.settings, signature: sig, extraBlockedHashtags: blocked.split(/[\s,]+/).map((t) => t.replace(/^#/, '')).filter(Boolean) });
      notify('Configurações salvas', 'ok');
      await refresh();
    } catch (e) { notify((e as Error).message, 'error'); }
  };

  return (
    <div className="central-stack">
      <div className="c-card">
        <h3>Servidor</h3>
        <p className="hint">Endereço do Worker (Cloudflare) e a senha de acesso (ADMIN_TOKEN). Veja <b>server/LEIA-ME.md</b> no repositório.</p>
        <label className="c-field"><span>Endereço da API</span>
          <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="https://central-do-set.seu-nome.workers.dev" inputMode="url" autoComplete="off" /></label>
        <label className="c-field"><span>Senha de acesso</span>
          <input value={token} onChange={(e) => setToken(e.target.value)} type="password" autoComplete="off" placeholder="ADMIN_TOKEN" /></label>
        <div className="row">
          <button className="btn primary" disabled={busy || !apiUrl || !token} onClick={save}>{busy ? 'Testando…' : 'Salvar e testar'}</button>
          {cfg && <button className="btn ghost" onClick={() => { setConfig(null); setApiUrl(''); setToken(''); refresh(); }}>Sair</button>}
        </div>
      </div>

      {status && NETWORKS.map((n) => {
        const a = status.accounts.find((x) => x.network === n);
        return (
          <div key={n} className={`c-card net-${n}`}>
            <div className="c-row">
              <h3>{NETWORK_LABEL[n]}</h3>
              <span className={`pill ${a?.connected ? 'ok' : ''}`}>{a?.connected ? 'Conectado' : 'Desconectado'}</span>
            </div>
            {a?.connected && <p><b>{a.name}</b> {a.handle && <span className="hint">@{a.handle.replace(/^@/, '')}</span>} {a.followers != null && <span className="hint"> · {a.followers.toLocaleString('pt-BR')} seguidores</span>}</p>}
            <p className="hint">{HELP[n]}</p>
            {!a?.publicPosting && <p className="warn">⚠️ Posts ainda saem como privados (app sem auditoria da plataforma).</p>}
            {!status.configured[n]
              ? <p className="warn">Falta configurar as credenciais do app do {NETWORK_LABEL[n]} no servidor.</p>
              : a?.connected
                ? <button className="btn ghost small" onClick={() => disconnect(n)}>Desconectar</button>
                : <button className="btn primary" onClick={() => connect(n)}>Conectar {NETWORK_LABEL[n]}</button>}
          </div>
        );
      })}

      {status && (
        <div className="c-card">
          <h3>Preferências</h3>
          <p className="hint">IA para comentários: {status.ai ? '✅ ativa' : '❌ falta a chave ANTHROPIC_API_KEY no servidor'}</p>
          <label className="c-field"><span>Assinatura nas legendas (opcional)</span>
            <input value={sig} onChange={(e) => setSig(e.target.value)} placeholder="E... corta! 🎬" /></label>
          <label className="c-field"><span>Hashtags proibidas (além das automáticas)</span>
            <input value={blocked} onChange={(e) => setBlocked(e.target.value)} placeholder="spoiler leak" /></label>
          <button className="btn" onClick={saveSettings}>Salvar preferências</button>
        </div>
      )}
    </div>
  );
}
