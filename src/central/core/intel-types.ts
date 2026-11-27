// Contract for the intelligence module (playbook, strategy reports, API payload).
import type { BenchInsight, Experiment, Lift, Perf } from './analytics';

export type RuleConfidence = 'forte' | 'media' | 'fraca' | 'hipotese';
export interface PlaybookRule {
  regra: string;
  evidencia: string;
  confianca: RuleConfidence;
  origem: 'dados' | 'experimento' | 'concorrentes' | 'pesquisa';
  status: 'ativa' | 'teste' | 'aposentada';
}
export interface Playbook { version: number; createdAt: number; rules: PlaybookRule[]; mix: { editoria: string; percentual: number; motivo: string }[] }

export interface StrategyReport {
  id: string;
  createdAt: number;
  basedOn: { videos: number; maduros: number; experimentos: number; concorrentes: number };
  resumo: string;
  diagnostico: { titulo: string; evidencia: string; impacto: 'alto' | 'medio' | 'baixo' }[];
  acoes: { acao: string; porque: string; como_medir: string }[];
  alertas: string[];
}

export interface IntelPayload {
  perfs: Perf[];
  lifts: Lift[];
  experiments: Experiment[];
  velocity: { postId: string; network: string; title: string; ratio: number; views: number }[];
  report: StrategyReport | null;
  playbook: Playbook | null;
  bench: BenchInsight[];
  benchChannels: { channelId: string; title: string; handle?: string }[];
}

/** Starting playbook: hypotheses from the initial research (perfil-entretenimento/01–04). Data replaces them over time. */
export const SEED_RULES: PlaybookRule[] = [
  { regra: 'Fala começa no primeiro frame; gancho de até 12 palavras que abre uma lacuna.', evidencia: 'Emplifi 2026: fala nos 3 primeiros segundos melhora retenção de 3s e 10s.', confianca: 'media', origem: 'pesquisa', status: 'ativa' },
  { regra: 'Vídeos curtos de 30 a 60s para explicados; 60 a 90s só para histórias (caso real, bastidor).', evidencia: 'Revid (~757 mil vídeos): 31–60s é o ponto ideal para conteúdo explicativo.', confianca: 'fraca', origem: 'pesquisa', status: 'teste' },
  { regra: 'Palavra-chave (nome da obra) na primeira linha da legenda e falada nos 3 primeiros segundos.', evidencia: 'Guias de SEO social 2025–26: busca usa legenda e fala transcrita.', confianca: 'media', origem: 'pesquisa', status: 'ativa' },
  { regra: '3 a 5 hashtags relevantes; nunca genéricas (#fyp, #viral).', evidencia: 'Guias de plataforma 2025–26.', confianca: 'fraca', origem: 'pesquisa', status: 'ativa' },
  { regra: 'Conteúdo ligado a estreia da semana sai até 48h antes da estreia.', evidencia: 'Hipótese do planejamento: busca sobe na semana do lançamento.', confianca: 'hipotese', origem: 'pesquisa', status: 'teste' },
  { regra: 'Postar à noite (18–22h) em dias úteis.', evidencia: 'Ponto de partida comum de mercado; sem dado próprio ainda.', confianca: 'hipotese', origem: 'pesquisa', status: 'teste' },
];
export const SEED_MIX = [
  { editoria: 'Notícia', percentual: 35, motivo: 'Alcance e atualidade' },
  { editoria: 'Estreia', percentual: 20, motivo: 'Utilidade e salvamentos' },
  { editoria: 'Caso real', percentual: 20, motivo: 'Retenção alta' },
  { editoria: 'Bastidores', percentual: 15, motivo: 'Compartilhamento' },
  { editoria: 'Teoria', percentual: 10, motivo: 'Comentários' },
];
