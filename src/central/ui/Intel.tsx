import { useEffect, useMemo, useState } from 'react';
import { Chips } from '../../ui/components/ui';
import { api } from '../api';
import { DIMENSIONS, pct, type Experiment, type Features } from '../core/analytics';
import type { IntelPayload, PlaybookRule } from '../core/intel-types';
import { NETWORK_LABEL, type Network } from '../core/types';
import type { Notify } from './Central';

const CONF_LABEL: Record<string, string> = { forte: 'forte', média: 'média', media: 'média', fraca: 'fraca', hipotese: 'hipótese' };

export function Intel({ notify }: { notify: Notify }) {
  const [d, setD] = useState<IntelPayload | null>(null);
  const [dim, setDim] = useState<keyof Features>('editoria');
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => api.intel().then(setD).catch((e) => notify(e.message, 'error'));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try { await fn(); if (ok) notify(ok, 'ok'); await load(); } catch (e) { notify((e as Error).message, 'error'); } finally { setBusy(null); }
  };

  const lifts = useMemo(() => (d ? d.lifts.filter((l) => l.dimension === dim) : []), [d, dim]);
  const mature = useMemo(() => (d ? d.perfs.filter((p) => p.ageHours >= 48) : []), [d]);
  const ranked = useMemo(() => [...mature].sort((a, b) => b.index - a.index), [mature]);

  if (!d) return <div className="c-card"><div className="spinner" /></div>;
  const maxLift = Math.max(0.2, ...lifts.map((l) => Math.abs(l.lift)));
  const strong = d.lifts.filter((l) => l.confidence !== 'fraca' && !l.confoundedWith).sort((a, b) => Math.abs(b.lift) - Math.abs(a.lift)).slice(0, 4);

  return (
    <div className="central-stack">
      {/* ---------- strategist ---------- */}
      <div className="c-card intel-hero">
        <div className="c-row"><h3>🧠 Estrategista</h3><span className="hint">{d.perfs.length} medições · {mature.length} maduras (48h+)</span></div>
        {d.report ? (
          <>
            <p className="hint">Última análise: {new Date(d.report.createdAt).toLocaleString('pt-BR')} · roda sozinha toda segunda às 9h</p>
            <p className="intel-summary">{d.report.resumo}</p>
            {d.report.alertas.map((a, i) => <p key={i} className="warn">⚠️ {a}</p>)}
            {d.report.diagnostico.map((x, i) => (
              <div key={i} className={`diag imp-${x.impacto}`}><b>{x.titulo}</b><small>{x.evidencia}</small></div>
            ))}
            <h4>Ações da semana</h4>
            <ol className="acts">{d.report.acoes.map((a, i) => <li key={i}><b>{a.acao}</b><small>Por quê: {a.porque} · Medir: {a.como_medir}</small></li>)}</ol>
          </>
        ) : <p className="hint">Nenhuma análise ainda. Ela roda toda segunda às 9h, ou agora pelo botão. Com poucos dados, ela usa concorrentes e a pesquisa inicial.</p>}
        <button className="btn primary" disabled={busy === 'rep'} onClick={() => run('rep', api.report, 'Análise pronta: playbook e experimentos atualizados')}>
          {busy === 'rep' ? 'Analisando tudo… (até 2 min)' : 'Gerar análise estratégica agora'}</button>
      </div>

      {d.velocity.length > 0 && (
        <div className="c-card">
          <h3>🚀 Decolando agora (primeiras 24h vs. seus vídeos)</h3>
          {d.velocity.slice(0, 5).map((v) => (
            <div key={v.postId + v.network} className="c-row"><span className="clip1">{v.title} <small className="hint">· {NETWORK_LABEL[v.network as Network]}</small></span>
              <b className={v.ratio >= 1.5 ? 'up' : v.ratio < 0.7 ? 'down' : ''}>{v.ratio.toFixed(1)}×</b></div>
          ))}
          <p className="hint">Acima de 1,5×: responda comentários agora, fixe um comentário e faça a continuação.</p>
        </div>
      )}

      {/* ---------- what works ---------- */}
      <div className="c-card">
        <h3>📊 O que funciona</h3>
        {strong.length > 0 && <div className="insights">{strong.map((l) => (
          <span key={l.dimension + l.value} className={`insight ${l.lift >= 0 ? 'pos' : 'neg'}`}>{DIMENSIONS.find((x) => x.key === l.dimension)?.label}: <b>{l.value}</b> {pct(l.lift)}</span>
        ))}</div>}
        <Chips options={DIMENSIONS.map((x) => ({ v: x.key, label: x.label }))} value={dim} onChange={setDim} scroll />
        {!lifts.length ? <p className="hint">Ainda sem dados suficientes nesta dimensão (precisa de vídeos com 48h+ e pelo menos 2 por grupo).</p> : lifts.map((l) => (
          <div key={l.value} className="lift-row">
            <span className="clip1">{l.value} <small className="hint">({l.n})</small></span>
            <div className="div-bar"><i className={l.lift >= 0 ? 'pos' : 'neg'} style={{ width: `${(Math.abs(l.lift) / maxLift) * 50}%`, [l.lift >= 0 ? 'left' : 'right']: '50%' }} /></div>
            <b className={l.lift >= 0 ? 'up' : 'down'}>{pct(l.lift)}</b>
            <span className={`pill conf-${l.confidence}`}>{CONF_LABEL[l.confidence]}</span>
            {l.confoundedWith && <small className="confound">⚠️ quase sempre junto com {DIMENSIONS.find((x) => x.key === l.confoundedWith!.dimension)?.label.toLowerCase()} "{l.confoundedWith.value}": pode ser efeito dele. Teste separando os dois.</small>}
          </div>
        ))}
        <p className="hint">Efeito sobre o Índice Set (100 = vídeo típico seu), já corrigido para amostras pequenas. "Fraca" = ainda pode ser sorte: vire um experimento.</p>
      </div>

      {ranked.length > 0 && (
        <div className="c-card">
          <h3>🏆 Índice Set</h3>
          {[...ranked.slice(0, 5), ...(ranked.length > 8 ? ranked.slice(-3) : [])].map((p, i) => (
            <div key={p.postId + p.network} className={`c-row ${i >= 5 ? 'low' : ''}`}>
              <span className="clip1">{p.title} <small className="hint">· {NETWORK_LABEL[p.network]} · {p.features.editoria ?? ''}</small></span>
              <b className={p.index >= 130 ? 'up' : p.index < 70 ? 'down' : ''}>{p.index}</b>
            </div>
          ))}
        </div>
      )}

      <Experiments d={d} busy={busy} run={run} />
      <PlaybookCard d={d} notify={notify} />
      <Bench d={d} busy={busy} run={run} />
    </div>
  );
}

function Experiments({ d, busy, run }: { d: IntelPayload; busy: string | null; run: (k: string, fn: () => Promise<unknown>, ok?: string) => Promise<void> }) {
  const [form, setForm] = useState<{ name: string; hypothesis: string; dimension: string; a: string; b: string } | null>(null);
  const order: Experiment['status'][] = ['proposto', 'ativo', 'concluido', 'descartado'];
  const exps = [...d.experiments].sort((x, y) => order.indexOf(x.status) - order.indexOf(y.status));
  return (
    <div className="c-card">
      <div className="c-row"><h3>🧪 Experimentos A/B</h3><button className="btn small" onClick={() => setForm(form ? null : { name: '', hypothesis: '', dimension: 'gancho', a: '', b: '' })}>{form ? 'Cancelar' : '+ Novo'}</button></div>
      <p className="hint">Um teste muda uma coisa só. Na hora de publicar, escolha o experimento e a Central diz qual variante usar. O resultado desconta a editoria de cada vídeo.</p>
      {form && (
        <div className="exp-form">
          <input placeholder="Nome (ex.: Gancho com número vs. pergunta)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Hipótese (ex.: número no gancho retém mais)" value={form.hypothesis} onChange={(e) => setForm({ ...form, hypothesis: e.target.value })} />
          <div className="c-grid2">
            <input placeholder="Variante A" value={form.a} onChange={(e) => setForm({ ...form, a: e.target.value })} />
            <input placeholder="Variante B" value={form.b} onChange={(e) => setForm({ ...form, b: e.target.value })} />
          </div>
          <button className="btn primary" disabled={!form.name || !form.a || !form.b} onClick={() => run('exp', async () => { await api.createExperiment({ name: form.name, hypothesis: form.hypothesis, dimension: form.dimension, variants: [form.a, form.b] }); setForm(null); }, 'Experimento ativo')}>Começar teste</button>
        </div>
      )}
      {!exps.length && <p className="hint">Nenhum experimento. A análise semanal propõe testes sozinha.</p>}
      {exps.map((e) => (
        <div key={e.id} className={`exp exp-${e.status}`}>
          <div className="c-row"><b>{e.name}</b><span className="pill">{e.status}{e.createdBy === 'ia' ? ' · IA' : ''}</span></div>
          {e.hypothesis && <small className="hint">{e.hypothesis}</small>}
          <small>{e.variants.join('  vs  ')}</small>
          {e.result && <small className={e.result.state === 'vencedor' ? 'up' : ''}>{e.result.state === 'vencedor' ? '🏆 ' : ''}{e.result.note}</small>}
          {e.result && <small className="hint">{e.result.perVariant.map((v) => `${v.variant}: índice ${v.avgIndex} (${v.n})`).join(' · ')}</small>}
          <div className="row">
            {e.status === 'proposto' && <button className="btn small primary" disabled={busy === e.id} onClick={() => run(e.id, () => api.setExperiment(e.id, 'ativo'), 'Experimento aprovado')}>Aprovar</button>}
            {(e.status === 'proposto' || e.status === 'ativo') && <button className="btn small ghost" disabled={busy === e.id} onClick={() => run(e.id, () => api.setExperiment(e.id, 'descartado'))}>Descartar</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

function PlaybookCard({ d, notify }: { d: IntelPayload; notify: Notify }) {
  const p = d.playbook;
  if (!p) return null;
  const group = (s: PlaybookRule['status']) => p.rules.filter((r) => r.status === s);
  const copy = async () => {
    try { await navigator.clipboard.writeText(await api.playbookMd()); notify('Playbook copiado. Cole no chat do Claude ao pedir roteiros.', 'ok'); }
    catch (e) { notify((e as Error).message, 'error'); }
  };
  return (
    <div className="c-card">
      <div className="c-row"><h3>📘 Playbook v{p.version}</h3><button className="btn small" onClick={copy}>Copiar para o Claude</button></div>
      <p className="hint">{p.version === 0 ? 'Versão inicial (pesquisa). A cada análise, a IA reescreve as regras com base nos seus dados.' : `Atualizado em ${new Date(p.createdAt).toLocaleDateString('pt-BR')}.`}</p>
      {(['ativa', 'teste', 'aposentada'] as const).map((s) => group(s).length > 0 && (
        <div key={s}>
          <h4>{s === 'ativa' ? 'Regras ativas' : s === 'teste' ? 'Em teste' : 'Aposentadas'}</h4>
          {group(s).map((r, i) => (
            <div key={i} className={`rule rule-${s}`}><b>{r.regra}</b><small><span className={`pill conf-${r.confianca}`}>{CONF_LABEL[r.confianca]}</span> {r.origem} · {r.evidencia}</small></div>
          ))}
        </div>
      ))}
      <h4>Mix de editorias da semana</h4>
      {p.mix.map((m) => <div key={m.editoria} className="bar-row"><span>{m.editoria}</span><div className="bar"><i style={{ width: `${m.percentual}%` }} /></div><b>{m.percentual}%</b></div>)}
    </div>
  );
}

function Bench({ d, busy, run }: { d: IntelPayload; busy: string | null; run: (k: string, fn: () => Promise<unknown>, ok?: string) => Promise<void> }) {
  const [handle, setHandle] = useState('');
  return (
    <div className="c-card">
      <div className="c-row"><h3>🔭 Concorrentes (YouTube)</h3>{d.benchChannels.length > 0 && <button className="btn small ghost" disabled={busy === 'bsync'} onClick={() => run('bsync', api.syncBench, 'Concorrentes atualizados')}>↻</button>}</div>
      <p className="hint">Dados públicos dos últimos 50 vídeos de cada canal: o que viraliza, duração, padrões de título. Atualiza todo dia. Precisa do YouTube conectado.</p>
      <div className="row">
        <input className="c-input" placeholder="@canal (ex.: @omelete)" value={handle} onChange={(e) => setHandle(e.target.value)} />
        <button className="btn" disabled={!handle || busy === 'badd'} onClick={() => run('badd', async () => { await api.addBench(handle); setHandle(''); }, 'Canal adicionado')}>Adicionar</button>
      </div>
      {d.bench.map((b) => {
        const ch = d.benchChannels.find((c) => c.title === b.channel);
        return (
          <div key={b.channel} className="bench">
            <div className="c-row"><b>{b.channel}</b>{ch && <button className="btn small ghost" onClick={() => run('brm', () => api.removeBench(ch.channelId))}>remover</button>}</div>
            <small className="hint">{b.videos} vídeos · mediana {b.medianViews.toLocaleString('pt-BR')} views · duração mediana {Math.round(b.medianDuration / 60)} min · título médio {b.avgTitleLen} caracteres</small>
            {b.titlePatterns.slice(0, 4).map((t) => <small key={t.pattern}>{t.pattern}: {Math.round(t.share * 100)}% dos títulos · <b className={t.liftVsChannel >= 0 ? 'up' : 'down'}>{pct(t.liftVsChannel)}</b> views</small>)}
            {b.outliers.length > 0 && <><small><b>Viralizaram (2×+ a mediana):</b></small>{b.outliers.slice(0, 3).map((o) => <small key={o.id} className="hint">· {o.title} ({o.views.toLocaleString('pt-BR')})</small>)}</>}
          </div>
        );
      })}
    </div>
  );
}
