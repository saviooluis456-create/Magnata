import { useEffect, useMemo, useState } from 'react';
import { api, type StatusResponse } from '../api';
import { EDITORIA_LABEL, NETWORK_LABEL, NETWORKS, type MetricRow, type Post } from '../core/types';
import type { Notify } from './Central';

const n = (x: number | undefined) => (x == null ? '–' : x >= 1e6 ? `${(x / 1e6).toFixed(1)}M` : x >= 1e3 ? `${(x / 1e3).toFixed(1)}k` : String(Math.round(x)));

export function Metrics({ status, notify }: { status: StatusResponse | null; notify: Notify }) {
  const [data, setData] = useState<{ rows: MetricRow[]; posts: Post[] } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const load = () => api.metrics().then(setData).catch((e) => notify(e.message, 'error'));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sync = async () => {
    setSyncing(true);
    try { await api.syncMetrics(); await load(); notify('Métricas atualizadas', 'ok'); } catch (e) { notify((e as Error).message, 'error'); } finally { setSyncing(false); }
  };

  const view = useMemo(() => {
    if (!data) return null;
    const byPost = new Map<string, MetricRow[]>();
    for (const r of data.rows) if (r.postId) byPost.set(r.postId, [...(byPost.get(r.postId) ?? []), r]);
    const total = (k: keyof MetricRow) => data.rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    const posts = data.posts
      .filter((p) => byPost.has(p.id))
      .map((p) => {
        const rows = byPost.get(p.id)!;
        const views = rows.reduce((s, r) => s + r.views, 0);
        const shares = rows.reduce((s, r) => s + r.shares + (r.saves ?? 0), 0);
        return { p, rows, views, shares };
      })
      .sort((a, b) => b.views - a.views);
    const group = (key: (p: Post) => string | undefined) => {
      const m = new Map<string, { views: number; count: number }>();
      for (const x of posts) { const k = key(x.p); if (!k) continue; const g = m.get(k) ?? { views: 0, count: 0 }; g.views += x.views; g.count++; m.set(k, g); }
      return [...m.entries()].map(([k, g]) => ({ k, avg: g.views / g.count, count: g.count })).sort((a, b) => b.avg - a.avg);
    };
    return {
      totals: { views: total('views'), likes: total('likes'), comments: total('comments'), shares: total('shares') + total('saves') },
      posts,
      byEditoria: group((p) => (p.editoria ? EDITORIA_LABEL[p.editoria] : undefined)),
      byHook: group((p) => p.hookType),
      byNetwork: NETWORKS.map((net) => {
        const rows = data.rows.filter((r) => r.network === net);
        const watch = rows.filter((r) => r.avgWatchSec != null);
        return { net, views: rows.reduce((s, r) => s + r.views, 0), count: rows.length, avgWatch: watch.length ? watch.reduce((s, r) => s + (r.avgWatchSec ?? 0), 0) / watch.length : undefined };
      }),
    };
  }, [data]);

  if (!view) return <div className="c-card"><div className="spinner" /></div>;
  const maxEd = Math.max(1, ...view.byEditoria.map((x) => x.avg));

  return (
    <div className="central-stack">
      <div className="c-row"><h3 style={{ margin: 0 }}>Desempenho</h3><button className="btn small" disabled={syncing} onClick={sync}>{syncing ? 'Atualizando…' : '↻ Atualizar'}</button></div>
      <div className="tiles">
        <div className="tile"><small>Visualizações</small><b>{n(view.totals.views)}</b></div>
        <div className="tile"><small>Curtidas</small><b>{n(view.totals.likes)}</b></div>
        <div className="tile"><small>Comentários</small><b>{n(view.totals.comments)}</b></div>
        <div className="tile"><small>Compart. + salvos</small><b>{n(view.totals.shares)}</b></div>
      </div>
      <div className="tiles">
        {view.byNetwork.map((x) => {
          const acc = status?.accounts.find((a) => a.network === x.net);
          return (
            <div key={x.net} className={`tile net-${x.net}`}>
              <small>{NETWORK_LABEL[x.net]}</small><b>{n(x.views)}</b>
              <small>{acc?.followers != null ? `${n(acc.followers)} seguidores` : 'seguidores –'}{x.avgWatch != null ? ` · ${x.avgWatch.toFixed(1)}s assistidos` : ''}</small>
            </div>
          );
        })}
      </div>

      {view.byEditoria.length > 0 && (
        <div className="c-card">
          <h3>Média de views por editoria</h3>
          {view.byEditoria.map((x) => (
            <div key={x.k} className="bar-row"><span>{x.k} <small className="hint">({x.count})</small></span><div className="bar"><i style={{ width: `${(x.avg / maxEd) * 100}%` }} /></div><b>{n(x.avg)}</b></div>
          ))}
        </div>
      )}
      {view.byHook.length > 0 && (
        <div className="c-card">
          <h3>Ganchos que mais funcionam</h3>
          {view.byHook.slice(0, 8).map((x) => <div key={x.k} className="c-row"><span>{x.k} <small className="hint">({x.count})</small></span><b>{n(x.avg)} views</b></div>)}
        </div>
      )}

      <div className="c-card">
        <h3>Vídeos</h3>
        {!view.posts.length && <p className="hint">Ainda sem dados. As métricas chegam algumas horas depois de publicar e atualizam a cada hora.</p>}
        <div className="m-table">
          {view.posts.map(({ p, rows, views, shares }) => (
            <div key={p.id} className="m-row">
              <div><b className="clip1">{p.captions.youtube.title}</b><small className="hint">{new Date(p.createdAt).toLocaleDateString('pt-BR')}{p.editoria ? ` · ${EDITORIA_LABEL[p.editoria]}` : ''}</small></div>
              <div className="m-nets">
                {rows.map((r) => (
                  <span key={r.network} className={`net-${r.network}`}>
                    {NETWORK_LABEL[r.network]}: <b>{n(r.views)}</b>
                    {r.avgViewPct != null && <> · {r.avgViewPct.toFixed(0)}% retido</>}
                    {r.avgWatchSec != null && <> · {r.avgWatchSec.toFixed(1)}s</>}
                    {r.followersGained ? <> · +{r.followersGained} inscritos</> : null}
                  </span>
                ))}
              </div>
              <div className="m-sum"><b>{n(views)}</b><small>{n(shares)} compart.</small></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
