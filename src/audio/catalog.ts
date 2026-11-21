/** Music library: curated catalog of procedurally composed tracks (genre × mood × tempo × key). */
import { GENRE_MAP, energyShape, type MusicPlan } from './musicgen';

export interface Track {
  id: string; title: string; genre: string; moods: string[]; bpm: number; root: number; seed: number;
  shape: 'build' | 'steady' | 'wave' | 'calm' | 'drop' | 'arc';
}

const T = (title: string, genre: string, bpm: number, root: number, seed: number, shape: Track['shape'], moods: string[]): Track =>
  ({ id: `${genre}-${seed}`, title, genre, bpm, root, seed, shape, moods });

export const MUSIC_LIBRARY: Track[] = [
  T('Café da Manhã', 'lofi', 80, 50, 11, 'steady', ['calmo', 'estudo']),
  T('Chuva na Janela', 'lofi', 74, 45, 12, 'calm', ['nostálgico', 'calmo']),
  T('Madrugada Lo-fi', 'lofi', 84, 48, 13, 'wave', ['relaxante', 'noite']),
  T('Diamante Negro', 'trap', 140, 45, 21, 'drop', ['confiante', 'intenso']),
  T('Topo do Prédio', 'trap', 144, 47, 22, 'steady', ['luxo', 'urbano']),
  T('Sexta à Noite', 'house', 124, 48, 31, 'build', ['festa', 'dançante']),
  T('Pista Iluminada', 'house', 122, 45, 32, 'wave', ['dançante', 'verão']),
  T('Explosão de Luz', 'edm', 128, 52, 41, 'drop', ['eufórico', 'épico']),
  T('Horizonte', 'edm', 140, 50, 42, 'build', ['inspirador', 'energético']),
  T('A Jornada do Herói', 'cinematic', 90, 45, 51, 'build', ['épico', 'grandioso']),
  T('Antes da Batalha', 'cinematic', 96, 43, 52, 'arc', ['tenso', 'trailer']),
  T('Memórias', 'emotional', 72, 48, 61, 'arc', ['emocionante', 'saudade']),
  T('Primeiro Amor', 'emotional', 68, 53, 62, 'calm', ['romântico', 'delicado']),
  T('Nova Conquista', 'corporate', 112, 48, 71, 'build', ['inspirador', 'negócios']),
  T('Startup', 'corporate', 108, 50, 72, 'steady', ['positivo', 'tecnologia']),
  T('Estrada Aberta', 'acoustic', 100, 50, 81, 'steady', ['viagem', 'leve']),
  T('Domingo no Parque', 'acoustic', 96, 55, 82, 'wave', ['feliz', 'família']),
  T('Sol e Sorrisos', 'ukulele', 120, 48, 91, 'steady', ['feliz', 'divertido']),
  T('Pequenas Aventuras', 'ukulele', 116, 53, 92, 'build', ['infantil', 'alegre']),
  T('Céu Estrelado', 'ambient', 70, 48, 101, 'calm', ['contemplativo', 'natureza']),
  T('Meditação', 'ambient', 64, 45, 102, 'calm', ['calmo', 'bem-estar']),
  T('Drift Noturno', 'phonk', 140, 45, 111, 'steady', ['agressivo', 'carros']),
  T('Modo Treino', 'phonk', 136, 47, 112, 'drop', ['treino', 'motivação']),
  T('Baile da Quebrada', 'funk', 130, 45, 121, 'steady', ['baile', 'festa']),
  T('Tamborzão', 'funk', 150, 47, 122, 'drop', ['dançante', 'viral']),
  T('Neon 1985', 'synthwave', 104, 45, 131, 'build', ['retrô', 'noturno']),
  T('Avenida Infinita', 'synthwave', 108, 50, 132, 'wave', ['nostálgico', 'carros']),
  T('Rimas de Rua', 'boombap', 90, 48, 141, 'steady', ['urbano', 'storytelling']),
  T('Vinil Antigo', 'boombap', 88, 45, 142, 'calm', ['old school', 'relax']),
  T('Adrenalina', 'rock', 140, 52, 151, 'drop', ['esporte', 'energético']),
  T('Garagem', 'rock', 128, 45, 152, 'steady', ['rebelde', 'ação']),
  T('Verão Tropical', 'reggaeton', 95, 45, 161, 'steady', ['verão', 'praia']),
  T('Noite Caliente', 'reggaeton', 98, 48, 162, 'build', ['dançante', 'festa']),
  T('Corredor Escuro', 'horror', 70, 45, 171, 'build', ['medo', 'suspense']),
  T('O Segredo', 'horror', 64, 43, 172, 'calm', ['mistério', 'investigação']),
  T('Jantar Elegante', 'jazz', 100, 50, 181, 'steady', ['elegante', 'sofisticado']),
  T('Noite no Clube', 'jazz', 112, 45, 182, 'wave', ['lounge', 'calmo']),
];

export function planForTrack(tr: Track, duration: number): MusicPlan {
  const g = GENRE_MAP.get(tr.genre)!;
  const bars = Math.max(1, Math.ceil(duration / ((60 / tr.bpm) * 4)));
  void g;
  return { genre: tr.genre, bpm: tr.bpm, root: tr.root, seed: tr.seed, duration, energy: energyShape(tr.shape, bars), hits: [], volume: 0.9 };
}
