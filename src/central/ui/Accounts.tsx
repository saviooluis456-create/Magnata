import { useEffect, useState, type ReactNode } from 'react';
import { api, detectSameOrigin, getConfig, loginCentral, publicStatus, setConfig, setupCentral, type ClaudeKey, type Scope, type StatusResponse } from '../api';
import { NETWORK_LABEL, NETWORKS, type Network } from '../core/types';
import type { Notify } from './Central';

type Apps = { quick: boolean; windsor: boolean } & Record<Network, { configured: boolean; redirectUri: string }>;

export function Accounts({ status, notify, refresh }: { status: StatusResponse | null; notify: Notify; refresh: () => Promise<void> }) {
  const [logged, setLogged] = useState(!!getConfig());
  useEffect(() => {
    const out = () => setLogged(false);
    window.addEventListener('central-logout', out);
    return () => window.removeEventListener('central-logout', out);
  }, []);

  if (!logged) return <SignIn notify={notify} onDone={async () => { setLogged(true); await refresh(); }} />;
  return <Connected status={status} notify={notify} refresh={refresh} onLogout={() => { setConfig(null); setLogged(false); refresh(); }} />;
}

// ---------- first access / login ----------
function SignIn({ notify, onDone }: { notify: Notify; onDone: () => Promise<void> }) {
  const [apiUrl, setApiUrl] = useState('');
  const [phase, setPhase] = useState<'detectando' | 'endereco' | 'setup' | 'login'>('detectando');
  const [code, setCode] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState(false);

  const check = async (url: string) => {
    try { const s = await publicStatus(url); setApiUrl(url); setPhase(s.needsSetup ? 'setup' : 'login'); }
    catch (e) { notify((e as Error).message, 'error'); setPhase('endereco'); }
  };
  useEffect(() => { detectSameOrigin().then((same) => (same ? check(location.origin) : setPhase('endereco'))); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const go = async () => {
    setBusy(true);
    try {
      if (phase === 'setup' && pass !== pass2) throw new Error('As senhas não são iguais.');
      const { token } = phase === 'setup' ? await setupCentral(apiUrl, code, pass) : await loginCentral(apiUrl, pass);
      setConfig({ apiUrl, token });
      notify(phase === 'setup' ? 'Central criada! Guarde a senha no Bitwarden.' : 'Bem-vindo de volta', 'ok');
      await onDone();
    } catch (e) { notify((e as Error).message, 'error'); } finally { setBusy(false); }
  };

  if (phase === 'detectando') return <div className="c-card"><div className="spinner" /></div>;
  return (
    <div className="c-card">
      {phase === 'endereco' && (
        <>
          <h3>Onde está a sua Central?</h3>
          <p className="hint">Cole o endereço que o Claude te passou depois de colocar a Central no ar (termina em .workers.dev).</p>
          <input className="c-input" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="https://central-do-set.xxxx.workers.dev" inputMode="url" />
          <button className="btn primary" disabled={!apiUrl} onClick={() => check(apiUrl.trim().replace(/\/+$/, ''))}>Continuar</button>
        </>
      )}
      {phase === 'setup' && (
        <>
          <h3>Primeiro acesso: crie a senha da Central</h3>
          <p className="hint">Use o código de instalação que o Claude te passou. Ele só funciona uma vez.</p>
          <label className="c-field"><span>Código de instalação</span><input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" /></label>
          <label className="c-field"><span>Nova senha (12+ caracteres; gere no Bitwarden)</span><input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" /></label>
          <label className="c-field"><span>Repita a senha</span><input type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} autoComplete="new-password" /></label>
          <button className="btn primary" disabled={busy || !code || pass.length < 12} onClick={go}>{busy ? 'Criando…' : 'Criar e entrar'}</button>
        </>
      )}
      {phase === 'login' && (
        <>
          <h3>Entrar na Central</h3>
          <label className="c-field"><span>Senha</span><input type="password" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} autoComplete="current-password" /></label>
          <button className="btn primary" disabled={busy || !pass} onClick={go}>{busy ? 'Entrando…' : 'Entrar'}</button>
          <button className="btn ghost small" onClick={() => setPhase('endereco')}>Outro endereço</button>
        </>
      )}
    </div>
  );
}

// ---------- logged in ----------
function Connected({ status, notify, refresh, onLogout }: { status: StatusResponse | null; notify: Notify; refresh: () => Promise<void>; onLogout: () => void }) {
  const [apps, setApps] = useState<Apps | null>(null);
  const loadApps = () => api.apps().then(setApps).catch((e) => notify(e.message, 'error'));
  useEffect(() => { loadApps(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const reload = async () => { await Promise.all([loadApps(), refresh()]); };

  return (
    <div className="central-stack">
      {apps && <QuickCard quick={apps.quick} notify={notify} reload={reload} />}
      {NETWORKS.map((n) => <NetworkCard key={n} n={n} status={status} app={apps?.[n]} quick={!!apps?.quick} notify={notify} reload={reload} />)}
      <ClaudeAccess notify={notify} />
      {status && <Prefs status={status} notify={notify} refresh={refresh} />}
      <Security notify={notify} onLogout={onLogout} />
    </div>
  );
}

const copy = async (text: string, notify: Notify, what = 'Copiado') => {
  try { await navigator.clipboard.writeText(text); notify(what, 'ok'); } catch { notify('Não deu para copiar: selecione e copie à mão.', 'error'); }
};

function CopyBox({ value, notify }: { value: string; notify: Notify }) {
  return (
    <div className="copybox">
      <code>{value}</code>
      <button className="btn small" onClick={() => copy(value, notify)}>Copiar</button>
    </div>
  );
}

const GUIDE: Record<Network, (redirect: ReactNode) => ReactNode> = {
  instagram: (redirect) => (
    <ol className="steps">
      <li>No app do Instagram (@luiznoset): <b>Configurações → Tipo de conta e ferramentas → Mudar para conta profissional → Criador</b>.</li>
      <li>No computador ou celular, abra <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">developers.facebook.com/apps</a>, entre com o seu Facebook e toque em <b>Criar app</b>. Caso de uso: <b>Gerenciar mensagens e conteúdo no Instagram</b> (se não aparecer: Outro → Empresa).</li>
      <li>No painel do app, abra <b>Instagram → Configuração da API com login do Instagram</b>.</li>
      <li>Em <b>Configurar o login comercial do Instagram</b>, no campo <b>URIs de redirecionamento OAuth válidos</b>, cole exatamente: {redirect}</li>
      <li>Em <b>Funções do app → Funções → Testadores do Instagram</b>, adicione <b>luiznoset</b>. No Instagram, aceite em <b>Configurações → Apps e sites → Convites de testador</b>. Assim o app funciona na sua conta sem revisão da Meta.</li>
      <li>Na página da API com login do Instagram, copie o <b>ID do app do Instagram</b> e a <b>chave secreta do app do Instagram</b> e cole abaixo. Atenção: não é o ID do app do Facebook (o do topo da página).</li>
    </ol>
  ),
  youtube: (redirect) => (
    <ol className="steps">
      <li>Abra <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer">console.cloud.google.com</a> com o Gmail da conta mestre e crie o projeto <b>Central do Set</b>.</li>
      <li>Em <b>APIs e serviços → Biblioteca</b>, ative <b>YouTube Data API v3</b> e <b>YouTube Analytics API</b>.</li>
      <li>Em <b>Tela de consentimento OAuth</b>: tipo Externo, nome "Central do Set", e adicione o seu Gmail como <b>usuário de teste</b>.</li>
      <li>Em <b>Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web</b>, em <b>URIs de redirecionamento autorizados</b>, cole: {redirect}</li>
      <li>Copie o <b>ID do cliente</b> e a <b>Chave secreta do cliente</b> e cole abaixo. Ao conectar, escolha a Conta de Marca <b>Luiz no Set</b>.</li>
    </ol>
  ),
  tiktok: (redirect) => (
    <ol className="steps">
      <li>Abra <a href="https://developers.tiktok.com/apps" target="_blank" rel="noreferrer">developers.tiktok.com</a>, entre e toque em <b>Connect an app / Create app</b>.</li>
      <li>Adicione os produtos <b>Login Kit</b> e <b>Content Posting API</b> (ative <b>Direct Post</b>). Escopos: user.info.basic, user.info.stats, video.publish, video.list.</li>
      <li>Em <b>Login Kit → Redirect URI</b>, cole: {redirect}</li>
      <li>Em <b>Sandbox</b>, adicione a conta <b>@luiznoset</b> como usuária de teste.</li>
      <li>Copie o <b>Client key</b> e o <b>Client secret</b> e cole abaixo. Até o TikTok aprovar o app, os vídeos chegam como privados.</li>
    </ol>
  ),
};

function QuickCard({ quick, notify, reload }: { quick: boolean; notify: Notify; reload: () => Promise<void> }) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await api.saveQuickKey(key); setKey(''); notify('Conexão rápida ativada! Agora é só tocar em Conectar.', 'ok'); await reload(); }
    catch (e) { notify((e as Error).message, 'error'); } finally { setBusy(false); }
  };
  if (quick) {
    return (
      <div className="c-card quick-card on">
        <div className="c-row"><h3>⚡ Conexão rápida ativa</h3><button className="btn small ghost" onClick={async () => { if (confirm('Desativar a conexão rápida? Contas conectadas por ela param de funcionar.')) { await api.removeQuickKey(); await reload(); } }}>Desativar</button></div>
        <p className="hint">Toque em <b>Conectar</b> em cada rede abaixo e autorize. Pronto.</p>
      </div>
    );
  }
  return (
    <div className="c-card quick-card">
      <h3>⚡ Conexão rápida (recomendado)</h3>
      <p className="hint">Conecte Instagram, TikTok e YouTube com um toque cada, sem criar app de desenvolvedor. Usa o Zernio, um serviço com apps já aprovados pelas redes (2 contas grátis; a 3ª custa cerca de US$ 6/mês). No TikTok, os vídeos saem públicos direto. Responder comentários pode exigir o complemento de caixa de entrada do Zernio.</p>
      <ol className="steps">
        <li>Crie uma conta grátis em <a href="https://zernio.com" target="_blank" rel="noreferrer">zernio.com</a>.</li>
        <li>No painel: <b>Settings → API Keys → Create</b>. Copie a chave (começa com <code>sk_</code>).</li>
        <li>Cole aqui e toque em Ativar. Fica guardada criptografada na sua Central.</li>
      </ol>
      <input className="c-input" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk_..." autoComplete="off" />
      <button className="btn primary" disabled={busy || !key.trim().startsWith('sk_')} onClick={save}>{busy ? 'Ativando…' : 'Ativar conexão rápida'}</button>
    </div>
  );
}

function WindsorConnect({ notify, reload }: { notify: Notify; reload: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { const r = await api.saveWindsorKey(key); setKey(''); notify(`Instagram conectado pelo Windsor: @${r.account.username}`, 'ok'); await reload(); }
    catch (e) { notify((e as Error).message, 'error'); } finally { setBusy(false); }
  };
  if (!open) return <button className="btn connect-big windsor-btn" onClick={() => setOpen(true)}>Conectar pelo Windsor.ai</button>;
  return (
    <div className="windsor-box">
      <ol className="steps">
        <li>No Windsor (<a href="https://onboard.windsor.ai" target="_blank" rel="noreferrer">onboard.windsor.ai</a>), confira se o <b>Instagram @luiznoset</b> está conectado (conector <b>Instagram</b>, não TikTok).</li>
        <li>Copie a sua <b>chave da API</b> do Windsor (menu da conta → API key).</li>
        <li>Cole aqui. A Central acha a conta sozinha e passa a puxar as métricas.</li>
      </ol>
      <input className="c-input" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="chave da API do Windsor" autoComplete="off" />
      <div className="row">
        <button className="btn primary" disabled={busy || key.trim().length < 16} onClick={save}>{busy ? 'Conectando…' : 'Conectar Instagram'}</button>
        <button className="btn ghost" onClick={() => setOpen(false)}>Cancelar</button>
      </div>
    </div>
  );
}

function NetworkCard({ n, status, app, quick, notify, reload }: { n: Network; status: StatusResponse | null; app?: Apps[Network]; quick: boolean; notify: Notify; reload: () => Promise<void> }) {
  const acc = status?.accounts.find((a) => a.network === n);
  const [advanced, setAdvanced] = useState(false);
  const [editing, setEditing] = useState(false);
  const [id, setId] = useState('');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const showForm = !!app && advanced && (!app.configured || editing);
  const quickConnect = async () => {
    try { const { url } = await api.quickConnect(n); location.href = url; } catch (e) { notify((e as Error).message, 'error'); }
  };

  const save = async () => {
    setBusy(true);
    try { await api.saveApp(n, id, secret); setId(''); setSecret(''); setEditing(false); notify('Chaves salvas (criptografadas). Agora toque em Conectar.', 'ok'); await reload(); }
    catch (e) { notify((e as Error).message, 'error'); } finally { setBusy(false); }
  };
  const connect = async () => {
    if (acc?.connected ? acc.via === 'rapida' : quick && !advanced) return quickConnect();
    try { const { url } = await api.connect(n); location.href = url; } catch (e) { notify((e as Error).message, 'error'); }
  };
  const disconnect = async () => {
    if (!confirm(`Desconectar ${NETWORK_LABEL[n]}?`)) return;
    try { await api.disconnect(n); await reload(); } catch (e) { notify((e as Error).message, 'error'); }
  };

  return (
    <div className={`c-card net-${n}`}>
      <div className="c-row"><h3>{NETWORK_LABEL[n]}</h3><span className={`pill ${acc?.connected ? 'ok' : ''}`}>{acc?.connected ? `Conectado${acc.via === 'rapida' ? ' ⚡' : acc.via === 'windsor' ? ' · Windsor' : ''}` : quick || app?.configured ? 'Pronto para conectar' : 'Desconectado'}</span></div>
      {acc?.connected && (
        <>
          <p><b>{acc.name}</b> {acc.handle && <span className="hint">@{acc.handle.replace(/^@/, '')}</span>}{acc.followers != null && <span className="hint"> · {acc.followers.toLocaleString('pt-BR')} seguidores</span>}</p>
          {!acc.publicPosting && <p className="warn">⚠️ Posts saem como privados até a plataforma aprovar o app.</p>}
          {acc.via === 'windsor' && <p className="hint">Pelo Windsor: as métricas chegam sozinhas. Para publicar e responder comentários, a Central deixa "aguardando o Claude" e você pede no chat: <b>publicar pendentes</b> / <b>responder comentários do Instagram</b>.</p>}
          <div className="row"><button className="btn small ghost" onClick={disconnect}>Desconectar</button><button className="btn small ghost" onClick={connect}>Reconectar</button></div>
        </>
      )}
      {n === 'instagram' && !acc?.connected && !advanced && <WindsorConnect notify={notify} reload={reload} />}
      {!acc?.connected && !advanced && (
        quick ? (
          <>
            <button className="btn primary connect-big" onClick={quickConnect}>Conectar {NETWORK_LABEL[n]}</button>
            <p className="hint">Abre a página oficial do {NETWORK_LABEL[n]}: entre com a conta do perfil e autorize. A Central nunca vê a sua senha.</p>
          </>
        ) : app?.configured ? null : <p className="hint">Ative a <b>conexão rápida</b> acima para conectar com um toque.</p>
      )}
      {!acc?.connected && app?.configured && !editing && (advanced || !quick) && (
        <>
          <button className="btn primary" onClick={connect}>Conectar {NETWORK_LABEL[n]}</button>
          <p className="hint">Você vai entrar na página oficial do {NETWORK_LABEL[n]} e autorizar. A Central nunca vê a sua senha.</p>
          <button className="btn small ghost" onClick={() => setEditing(true)}>Trocar as chaves do app</button>
        </>
      )}
      {showForm && app && (
        <>
          <p className="hint">Uma vez só: crie um app de desenvolvedor (grátis) e cole as chaves aqui. Os nomes dos menus podem variar um pouco.</p>
          {GUIDE[n](<CopyBox value={app.redirectUri} notify={notify} />)}
          <label className="c-field"><span>{n === 'instagram' ? 'ID do app do Instagram' : n === 'youtube' ? 'ID do cliente' : 'Client key'}</span><input value={id} onChange={(e) => setId(e.target.value)} autoComplete="off" /></label>
          <label className="c-field"><span>{n === 'instagram' ? 'Chave secreta do app do Instagram' : n === 'youtube' ? 'Chave secreta do cliente' : 'Client secret'}</span><input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="off" /></label>
          <div className="row">
            <button className="btn primary" disabled={busy || !id || !secret} onClick={save}>{busy ? 'Salvando…' : 'Salvar chaves'}</button>
            {editing && <button className="btn ghost" onClick={() => setEditing(false)}>Cancelar</button>}
          </div>
        </>
      )}
      {!acc?.connected && <button className="btn small ghost adv" onClick={() => setAdvanced(!advanced)}>{advanced ? 'Voltar para a conexão rápida' : 'Usar app próprio (avançado)'}</button>}
      {!app && <div className="spinner" />}
    </div>
  );
}

const SCOPE_INFO: { s: Scope; label: string; hint: string }[] = [
  { s: 'ler', label: 'Ler', hint: 'métricas, comentários, fila, inteligência (sempre ligado)' },
  { s: 'responder', label: 'Responder comentários', hint: 'o Claude sempre mostra antes de enviar' },
  { s: 'estrategia', label: 'Estratégia', hint: 'criar testes A/B, gerar análise, adicionar concorrentes' },
  { s: 'publicar', label: 'Publicar', hint: 'enviar e publicar vídeos (o Claude confirma antes)' },
];

function ClaudeAccess({ notify }: { notify: Notify }) {
  const [keys, setKeys] = useState<ClaudeKey[] | null>(null);
  const [scopes, setScopes] = useState<Scope[]>(['ler', 'responder', 'estrategia']);
  const [fresh, setFresh] = useState<string | null>(null);
  const load = () => api.claudeKeys().then(setKeys).catch(() => setKeys([]));
  useEffect(() => { load(); }, []);
  const create = async () => {
    try { const r = await api.createClaudeKey('Claude', scopes); setFresh(r.token); await load(); } catch (e) { notify((e as Error).message, 'error'); }
  };
  const revoke = async (k: ClaudeKey) => {
    if (!confirm('Revogar esta chave? O Claude perde o acesso na hora.')) return;
    try { await api.revokeClaudeKey(k.id); await load(); } catch (e) { notify((e as Error).message, 'error'); }
  };
  const address = getConfig()?.apiUrl ?? location.origin;
  return (
    <div className="c-card claude-card">
      <h3>🤖 Conectar o Claude</h3>
      <p className="hint">Com esta chave, o Claude lê métricas e comentários, analisa e trabalha nas suas contas direto pelo chat. Ela não dá acesso a senhas, contas ou configurações e pode ser revogada a qualquer momento.</p>
      {fresh ? (
        <>
          <p className="warn">Copie agora: a chave não aparece de novo.</p>
          <CopyBox value={fresh} notify={notify} />
          <ol className="steps">
            <li>No chat com o Claude, escreva: <b>conectar a Central</b> e o endereço <code>{address}</code>.</li>
            <li>Vai aparecer um <b>formulário seguro</b>. Cole a chave lá. <b>Nunca cole a chave no chat.</b></li>
          </ol>
          <button className="btn ghost small" onClick={() => setFresh(null)}>Pronto</button>
        </>
      ) : (
        <>
          {SCOPE_INFO.map((x) => (
            <label key={x.s} className="scope">
              <input type="checkbox" checked={scopes.includes(x.s)} disabled={x.s === 'ler'} onChange={(e) => setScopes((s) => (e.target.checked ? [...s, x.s] : s.filter((y) => y !== x.s)))} />
              <span><b>{x.label}</b><small>{x.hint}</small></span>
            </label>
          ))}
          <button className="btn primary" onClick={create}>Gerar chave do Claude</button>
        </>
      )}
      {keys && keys.length > 0 && (
        <>
          <h4>Chaves ativas</h4>
          {keys.map((k) => (
            <div key={k.id} className="c-row">
              <span><code>{k.prefix}…</code> <small className="hint">{k.scopes.join(', ')} · {k.lastUsed ? `usada ${new Date(k.lastUsed).toLocaleString('pt-BR')}` : 'nunca usada'}</small></span>
              <button className="btn small ghost" onClick={() => revoke(k)}>Revogar</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function Prefs({ status, notify, refresh }: { status: StatusResponse; notify: Notify; refresh: () => Promise<void> }) {
  const [sig, setSig] = useState(status.settings.signature);
  const [blocked, setBlocked] = useState(status.settings.extraBlockedHashtags.join(' '));
  const save = async () => {
    try {
      await api.saveSettings({ ...status.settings, signature: sig, extraBlockedHashtags: blocked.split(/[\s,]+/).map((t) => t.replace(/^#/, '')).filter(Boolean) });
      notify('Preferências salvas', 'ok'); await refresh();
    } catch (e) { notify((e as Error).message, 'error'); }
  };
  return (
    <div className="c-card">
      <h3>Preferências</h3>
      <p className="hint">IA nos comentários e no estrategista: {status.ai ? '✅ ativa' : '❌ falta a chave da API do Claude no servidor'}</p>
      <label className="c-field"><span>Assinatura nas legendas (opcional)</span><input value={sig} onChange={(e) => setSig(e.target.value)} placeholder="E... corta! 🎬" /></label>
      <label className="c-field"><span>Hashtags proibidas (além das automáticas)</span><input value={blocked} onChange={(e) => setBlocked(e.target.value)} placeholder="spoiler leak" /></label>
      <button className="btn" onClick={save}>Salvar preferências</button>
    </div>
  );
}

function Security({ notify, onLogout }: { notify: Notify; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const change = async () => {
    try { await api.changePassword(cur, next); notify('Senha trocada. Entre de novo em todos os aparelhos.', 'ok'); onLogout(); }
    catch (e) { notify((e as Error).message, 'error'); }
  };
  return (
    <div className="c-card">
      <h3>Segurança</h3>
      <div className="row">
        <button className="btn ghost" onClick={() => setOpen(!open)}>Trocar senha</button>
        <button className="btn ghost" onClick={onLogout}>Sair</button>
      </div>
      {open && (
        <>
          <label className="c-field"><span>Senha atual</span><input type="password" value={cur} onChange={(e) => setCur(e.target.value)} /></label>
          <label className="c-field"><span>Nova senha (12+)</span><input type="password" value={next} onChange={(e) => setNext(e.target.value)} /></label>
          <button className="btn primary" disabled={!cur || next.length < 12} onClick={change}>Trocar</button>
        </>
      )}
    </div>
  );
}
