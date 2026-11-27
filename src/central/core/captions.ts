// Builds the caption for each network from one base text, following perfil-entretenimento/04-legendas-e-hashtags.md.
import { extractHashtags, filterHashtags, stripHashtags, tagKey, type RemovedTag } from './hashtags';
import type { Editoria, Network, NetworkCaption, VideoFormat } from './types';

export const LIMITS = {
  instagram: 2200,
  tiktok: 2200,
  youtubeTitle: 100,
  youtubeDescription: 5000,
  youtubeTagsChars: 500,
};

export interface CaptionInput {
  /** Free text written by the user. May contain hashtags; they are pulled out and filtered. */
  text: string;
  /** Extra hashtags typed separately. */
  hashtags?: string[];
  /** Tags that should come first (title of the work). */
  priorityTags?: string[];
  /** YouTube title; defaults to the first line of the text. */
  title?: string;
  /** "Variety" → "FONTE: Variety" line. */
  source?: string;
  editoria?: Editoria;
  format: VideoFormat;
  extraBlocked?: string[];
  signature?: string;
}

export interface CaptionResult {
  captions: NetworkCaption;
  removed: Record<Network, RemovedTag[]>;
  warnings: string[];
}

const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…');
const hash = (tags: string[]) => tags.map((t) => '#' + t).join(' ');

export function buildCaptions(input: CaptionInput): CaptionResult {
  const warnings: string[] = [];
  const allTags = [...extractHashtags(input.text), ...(input.hashtags ?? [])];
  const body = stripHashtags(input.text);
  const firstLine = body.split('\n').find((l) => l.trim())?.trim() ?? '';
  const sourceLine = input.source ? `FONTE: ${input.source}` : '';
  const sign = input.signature?.trim() ?? '';

  const per = (network: Network) =>
    filterHashtags(allTags, { network, priority: input.priorityTags, extraBlocked: input.extraBlocked });
  const ig = per('instagram');
  const tt = per('tiktok');
  const yt = per('youtube');

  const join = (...parts: string[]) => parts.filter(Boolean).join('\n\n');

  // Instagram: hook line first (keyword early), body, source, tags at the end.
  let igCaption = join(body, sourceLine, sign, hash(ig.kept));
  if (igCaption.length > LIMITS.instagram) {
    warnings.push('Legenda do Instagram passou de 2.200 caracteres e foi cortada.');
    igCaption = join(clip(body, LIMITS.instagram - hash(ig.kept).length - sourceLine.length - 8), sourceLine, hash(ig.kept));
  }

  // TikTok: same structure; the sweet spot is 150–300 characters for short videos.
  let ttCaption = join(body, sourceLine, hash(tt.kept));
  if (ttCaption.length > LIMITS.tiktok) {
    warnings.push('Legenda do TikTok passou de 2.200 caracteres e foi cortada.');
    ttCaption = join(clip(body, LIMITS.tiktok - hash(tt.kept).length - 4), hash(tt.kept));
  }
  if (input.format === 'short' && body.length > 400) warnings.push('Para vídeo curto no TikTok, legendas de 150 a 300 caracteres funcionam melhor.');

  // YouTube: title with keyword up front, description with source and up to 3 tags (shown above the title).
  let title = (input.title?.trim() || firstLine).replace(/\s+/g, ' ');
  if (!title) { title = 'Luiz no Set'; warnings.push('Sem título: use a primeira linha da legenda como título do YouTube.'); }
  if (title.length > 60) warnings.push('Títulos do YouTube com até 60 caracteres aparecem inteiros na busca.');
  title = clip(title, LIMITS.youtubeTitle);
  const ytBody = input.title?.trim() ? body : body.split('\n').slice(1).join('\n').trim() || body;
  const description = clip(join(ytBody, sourceLine, sign, hash(yt.kept)), LIMITS.youtubeDescription);

  // YouTube "tags" field (search keywords): every valid tag split into words, deduped, within 500 chars.
  const keywordSet: string[] = [];
  for (const t of [...ig.kept, ...tt.kept, ...yt.kept]) {
    const k = t.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
    if (!keywordSet.some((x) => tagKey(x) === tagKey(k))) keywordSet.push(k);
  }
  const tags: string[] = [];
  let used = 0;
  for (const k of keywordSet) { if (used + k.length + 1 > LIMITS.youtubeTagsChars) break; tags.push(k); used += k.length + 1; }

  if (allTags.length === 0) warnings.push('Nenhuma hashtag: adicione a da obra (ex.: #Duna) e 2 a 4 do tema.');

  return {
    captions: {
      instagram: { caption: igCaption },
      tiktok: { caption: ttCaption },
      youtube: { title, description, tags },
    },
    removed: { instagram: ig.removed, tiktok: tt.removed, youtube: yt.removed },
    warnings,
  };
}
