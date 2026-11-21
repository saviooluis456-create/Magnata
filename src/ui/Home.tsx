import { useEffect, useState } from 'react';
import { ASPECTS, newProject, uid } from '../model/defaults';
import { formatTime, projectDuration } from '../model/timeline';
import type { Project } from '../model/types';
import { db } from '../store/db';
import { useEditor } from '../store/editor';
import { Icon } from './components/ui';

const FEATURES = [
  ['🎬', 'Timeline multicamadas', 'Vídeo, sobreposições, texto e áudio ilimitados'],
  ['💬', 'Legendas com IA', '30+ estilos animados, palavra por palavra'],
  ['✨', '80+ efeitos', 'Glitch, VHS, luz, partículas, distorções'],
  ['🔀', '50 transições com som', '28 efeitos sonoros sintetizados'],
  ['🎨', 'Color grading', 'Filtros cinematográficos + 14 ajustes'],
  ['🤖', 'Ferramentas de IA', 'Silêncios, cenas, batidas, fundo, voz'],
  ['🔑', 'Keyframes e máscaras', 'Chroma key, mesclagem, recorte'],
  ['🚀', 'Exportação até 4K 60fps', 'H.264, HEVC, VP9, AV1 · MP4/WebM/MOV'],
];

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [aspect, setAspect] = useState('9:16');
  const [menu, setMenu] = useState<Project | null>(null);
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const load = useEditor((s) => s.load);

  const refresh = () => db.listProjects().then(setProjects);
  useEffect(() => { refresh(); db.estimate().then(setUsage); db.persist(); }, []);

  const create = async () => {
    const p = newProject(`Projeto ${projects.length + 1}`, aspect);
    await db.saveProject(p);
    load(p);
  };

  const duplicate = async (p: Project) => {
    const copy: Project = { ...structuredClone(p), id: uid('p'), name: p.name + ' (cópia)', createdAt: Date.now(), updatedAt: Date.now() };
    await db.saveProject(copy);
    setMenu(null);
    refresh();
  };

  const remove = async (p: Project) => {
    if (!confirm(`Excluir "${p.name}"? Esta ação não pode ser desfeita.`)) return;
    await db.deleteProject(p.id);
    // delete media not referenced by other projects
    const others = (await db.listProjects()).filter((x) => x.id !== p.id);
    const used = new Set(others.flatMap((x) => x.media.map((m) => m.id)));
    for (const m of p.media) if (!used.has(m.id)) await db.deleteMedia(m.id).catch(() => {});
    setMenu(null);
    refresh();
  };

  const rename = async (p: Project) => {
    const name = prompt('Nome do projeto', p.name);
    if (!name) return;
    await db.saveProject({ ...p, name, updatedAt: Date.now() });
    setMenu(null);
    refresh();
  };

  return (
    <div className="home">
      <div className="home-head">
        <div className="logo"><div className="logo-mark">M</div>Magnata Studio</div>
      </div>
      <div className="hero">
        <h1>Crie vídeos incríveis</h1>
        <p>Editor profissional completo, direto no seu celular. Tudo roda no aparelho — rápido e privado.</p>
        <button className="btn primary new-btn" onClick={create} data-testid="new-project"><Icon name="plus" /> Novo projeto</button>
        <div className="aspect-row">
          {ASPECTS.slice(0, 7).map((a) => {
            const r = a.w / a.h;
            return (
              <button key={a.id} className={`aspect-chip ${aspect === a.id ? 'on' : ''}`} onClick={() => setAspect(a.id)}>
                <i style={{ width: r >= 1 ? 30 : 22 * r, height: r >= 1 ? 30 / r : 22 }} />
                <b>{a.label}</b>
                <small>{a.hint}</small>
              </button>
            );
          })}
        </div>
      </div>

      <div className="feature-strip">
        {FEATURES.map(([icon, t, d]) => (
          <div key={t} className="feature"><div style={{ fontSize: 20 }}>{icon}</div><b>{t}</b><span>{d}</span></div>
        ))}
      </div>

      <div className="projects-title"><h2>Seus projetos</h2><span className="hint">{projects.length}</span></div>
      {projects.length === 0 ? (
        <div className="empty">Nenhum projeto ainda. Toque em <b>Novo projeto</b> para começar.</div>
      ) : (
        <div className="projects">
          {projects.map((p) => (
            <div key={p.id} className="proj">
              <button style={{ display: 'block', width: '100%', textAlign: 'left' }} onClick={() => load(p)}>
                <div className="proj-thumb" style={{ backgroundImage: p.thumb ? `url(${p.thumb})` : undefined }}>{!p.thumb && <Icon name="media" size={32} />}</div>
                <div className="proj-info">
                  <b>{p.name}</b>
                  <small>{formatTime(projectDuration(p), false)} · {p.aspect} · {new Date(p.updatedAt).toLocaleDateString('pt-BR')}</small>
                </div>
              </button>
              <button className="proj-menu" onClick={() => setMenu(p)} aria-label="Opções">⋯</button>
            </div>
          ))}
        </div>
      )}
      {usage && usage.quota > 0 && (
        <div className="storage">Armazenamento: {(usage.usage / 1e9).toFixed(2)} GB de {(usage.quota / 1e9).toFixed(1)} GB disponíveis</div>
      )}

      {menu && (
        <div className="modal-back" onClick={() => setMenu(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px' }}>{menu.name}</h3>
            <button className="menu-item" onClick={() => load(menu)}><Icon name="media" /> Abrir</button>
            <button className="menu-item" onClick={() => rename(menu)}><Icon name="text" /> Renomear</button>
            <button className="menu-item" onClick={() => duplicate(menu)}><Icon name="copy" /> Duplicar</button>
            <button className="menu-item" style={{ color: '#fca5a5' }} onClick={() => remove(menu)}><Icon name="trash" /> Excluir</button>
          </div>
        </div>
      )}
    </div>
  );
}
