// Hashtag filter: cleans, deduplicates, blocks spam/generic/sensitive tags and caps the count per network.
import type { Editoria, Network } from './types';

export interface RemovedTag { tag: string; reason: string }
export interface HashtagResult { kept: string[]; removed: RemovedTag[] }

/** Max hashtags per network. YouTube shows the first 3 above the title and ignores ALL tags past 15. */
export const MAX_TAGS: Record<Network, number> = { instagram: 5, tiktok: 5, youtube: 3 };
const MAX_LEN = 30;

/** Engagement bait: platforms treat these as spam signals. */
const SPAM = [
  'followforfollow', 'follow4follow', 'f4f', 'likeforlike', 'like4like', 'l4l', 'likeforfollow', 'tagsforlikes',
  'seguidores', 'sigodevolta', 'sdv', 'sigo', 'curtir', 'curtidas', 'ganharseguidores', 'seguemeque', 'segueeu',
  'comentem', 'likes', 'follow', 'followme', 'instalike', 'teamfollowback', 'spam4spam',
];
/** Too broad to rank anywhere; wastes one of the few slots. */
const GENERIC = [
  'fyp', 'foryou', 'foryoupage', 'fy', 'paravoce', 'pravoce', 'viral', 'viralizar', 'explore', 'explorar', 'reels',
  'reelsinstagram', 'instagood', 'instagram', 'tiktok', 'tiktokbrasil', 'trend', 'trending', 'shorts', 'youtube',
  'video', 'videos', 'brasil', 'love', 'amor',
];
/** Words that make crime content look graphic and can restrict distribution. Use them in the story, not as tags. */
const SENSITIVE = [
  'assassinato', 'assassino', 'morte', 'morto', 'morta', 'mortes', 'sangue', 'suicidio', 'estupro', 'cadaver',
  'corpo', 'tiro', 'tiroteio', 'esfaqueado', 'decapitado', 'tortura', 'massacre', 'chacina', 'gore', 'violencia',
  'abuso', 'pedofilia', 'drogas', 'arma', 'armas',
];

/** Base tags per editoria (see perfil-entretenimento/04-legendas-e-hashtags.md). */
export const BASE_TAGS: Record<Editoria, string[]> = {
  noticia: ['filmes', 'series', 'noticias', 'cinema', 'streaming'],
  estreia: ['estreia', 'lancamentos', 'filmes', 'series', 'oquever'],
  crime: ['truecrime', 'crimereal', 'casoreal', 'historiareal', 'documentario'],
  bastidores: ['bastidores', 'curiosidades', 'cinema', 'hollywood', 'filmes'],
  teoria: ['teoria', 'easteregg', 'finalexplicado', 'series', 'filmes'],
};

const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** "#Crime Real!" → "crimereal" (no accents, no spaces/punctuation, lowercase key for comparison). */
export function tagKey(raw: string): string {
  return stripAccents(raw).replace(/^#+/, '').toLowerCase().replace(/[^a-z0-9_]/g, '');
}

/** Display form: keeps the author's casing (e.g. #HarryPotterHBO) but removes accents and symbols. */
export function cleanTag(raw: string): string {
  return stripAccents(raw).replace(/^#+/, '').replace(/[^A-Za-z0-9_]/g, '');
}

/** Finds hashtags in free text, accented letters included. */
export function extractHashtags(text: string): string[] {
  return (text.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((t) => t.slice(1));
}

/** Removes hashtags from text (and the blank lines they leave behind). */
export function stripHashtags(text: string): string {
  return text.replace(/(^|\s)#[\p{L}\p{N}_]+/gu, '$1').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export interface FilterOptions {
  network: Network;
  /** Tags that must stay first if valid (e.g. the title of the film: #Duna). */
  priority?: string[];
  extraBlocked?: string[];
}

export function filterHashtags(input: string[], opts: FilterOptions): HashtagResult {
  const blocked = new Map<string, string>();
  for (const t of SPAM) blocked.set(t, 'isca de engajamento (sinal de spam)');
  for (const t of GENERIC) blocked.set(t, 'genérica demais, desperdiça espaço');
  for (const t of SENSITIVE) blocked.set(t, 'termo sensível, pode limitar o alcance');
  for (const t of opts.extraBlocked ?? []) blocked.set(tagKey(t), 'bloqueada nas configurações');

  const kept: string[] = [];
  const removed: RemovedTag[] = [];
  const seen = new Set<string>();
  const ordered = [...(opts.priority ?? []), ...input];
  for (const raw of ordered) {
    const tag = cleanTag(raw);
    const key = tagKey(raw);
    if (!key) { if (raw.trim()) removed.push({ tag: raw, reason: 'vazia depois da limpeza' }); continue; }
    if (seen.has(key)) continue; // silent dedupe
    seen.add(key);
    if (/^\d+$/.test(key)) { removed.push({ tag, reason: 'só números' }); continue; }
    if (key.length > MAX_LEN) { removed.push({ tag, reason: `mais de ${MAX_LEN} caracteres` }); continue; }
    const why = blocked.get(key);
    if (why) { removed.push({ tag, reason: why }); continue; }
    kept.push(tag);
  }
  const max = MAX_TAGS[opts.network];
  for (const tag of kept.splice(max)) removed.push({ tag, reason: `limite de ${max} no ${opts.network}` });
  return { kept, removed };
}

/** Suggests tags: the work's tag(s) first, then the editoria base. */
export function suggestHashtags(editoria: Editoria | undefined, workTags: string[] = []): string[] {
  return [...workTags.map(cleanTag), ...(editoria ? BASE_TAGS[editoria] : BASE_TAGS.noticia)];
}
