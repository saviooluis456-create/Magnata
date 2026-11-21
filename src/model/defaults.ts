import type {
  Wheels,
  Adjust, AudioOpts, Captions, CaptionStyle, ChromaKey, Clip, ClipKind, Mask, Project, TextStyle, Track, Transform,
} from './types';

export const uid = (p = ''): string =>
  p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export const ASPECTS: { id: string; label: string; w: number; h: number; hint: string }[] = [
  { id: '9:16', label: '9:16', w: 1080, h: 1920, hint: 'TikTok, Reels, Shorts' },
  { id: '16:9', label: '16:9', w: 1920, h: 1080, hint: 'YouTube' },
  { id: '1:1', label: '1:1', w: 1080, h: 1080, hint: 'Feed quadrado' },
  { id: '4:5', label: '4:5', w: 1080, h: 1350, hint: 'Instagram feed' },
  { id: '3:4', label: '3:4', w: 1080, h: 1440, hint: 'Retrato' },
  { id: '4:3', label: '4:3', w: 1440, h: 1080, hint: 'Clássico' },
  { id: '2:1', label: '2:1', w: 2160, h: 1080, hint: 'Cinema web' },
  { id: '21:9', label: '21:9', w: 2520, h: 1080, hint: 'Cinemascope' },
  { id: '2.35:1', label: '2.35:1', w: 2538, h: 1080, hint: 'Anamórfico' },
];

export const defaultTransform = (): Transform => ({
  x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, flipX: false, flipY: false, cropL: 0, cropR: 0, cropT: 0, cropB: 0,
});

export const defaultAdjust = (): Adjust => ({
  brightness: 0, contrast: 0, saturation: 0, exposure: 0, temperature: 0, tint: 0, highlights: 0, shadows: 0,
  vibrance: 0, hue: 0, fade: 0, vignette: 0, sharpen: 0, grain: 0,
});

export const defaultWheels = (): Wheels => ({ lift: [0, 0, 0, 0], gamma: [0, 0, 0, 0], gain: [0, 0, 0, 0], offset: [0, 0, 0, 0] });

export const defaultAudio = (): AudioOpts => ({
  volume: 1, muted: false, fadeIn: 0, fadeOut: 0, voiceFx: 'none', enhance: false, denoise: false, eqLow: 0, eqMid: 0, eqHigh: 0,
});

export const defaultChroma = (): ChromaKey => ({ enabled: false, color: '#00ff00', similarity: 0.4, smoothness: 0.1, spill: 0.3 });

export const defaultMask = (): Mask => ({
  type: 'none', x: 0, y: 0, w: 0.6, h: 0.6, rotation: 0, feather: 0.05, invert: false, radius: 0.1,
});

export const defaultTextStyle = (text = 'Seu texto'): TextStyle => ({
  text, font: 'Montserrat', weight: 800, italic: false, size: 96, color: '#ffffff', gradient: null, align: 'center',
  letterSpacing: 0, lineHeight: 1.15, strokeColor: '#000000', strokeWidth: 0, shadowColor: 'rgba(0,0,0,0.6)',
  shadowBlur: 12, shadowX: 0, shadowY: 4, bgColor: '#000000', bgOpacity: 0, bgPadding: 24, bgRadius: 16,
  glowColor: '#ffffff', glowSize: 0, uppercase: false,
});

export function makeClip(kind: ClipKind, trackId: string, partial: Partial<Clip> = {}): Clip {
  return {
    id: uid('c'),
    trackId,
    kind,
    mediaId: null,
    name: kind,
    start: 0,
    duration: 3,
    in: 0,
    speed: 1,
    fit: 'contain',
    transform: defaultTransform(),
    keyframes: {},
    blend: 'normal',
    adjust: defaultAdjust(),
    filter: null,
    lut: null,
    wheels: defaultWheels(),
    camera: null,
    effects: [],
    transition: null,
    anims: { in: null, out: null, loop: null },
    audio: defaultAudio(),
    chroma: defaultChroma(),
    mask: defaultMask(),
    bgRemove: false,
    text: kind === 'text' ? defaultTextStyle() : null,
    color: '#000000',
    ...partial,
  };
}

export const defaultCaptionStyle = (): CaptionStyle => ({
  preset: 'impacto',
  emphFont: null,
  emphWeight: 900,
  emphItalic: false,
  emphScale: 1,
  emphAuto: false,
  lowercase: false,
  fitLines: false,
  pauseSplit: 0.7,
  font: 'Montserrat',
  weight: 900,
  italic: false,
  size: 84,
  uppercase: true,
  letterSpacing: 0,
  lineHeight: 1.1,
  color: '#ffffff',
  gradient: null,
  strokeColor: '#000000',
  strokeWidth: 10,
  shadowColor: 'rgba(0,0,0,0.75)',
  shadowBlur: 10,
  shadowX: 0,
  shadowY: 6,
  glowColor: '#ffffff',
  glowSize: 0,
  bgMode: 'none',
  bgColor: '#000000',
  bgOpacity: 0.6,
  bgPadding: 18,
  bgRadius: 14,
  highlight: 'color',
  activeColor: '#ffe500',
  activeBg: '#7c3aed',
  activeScale: 1.12,
  inactiveOpacity: 1,
  showUpcoming: true,
  animation: 'pop',
  animSpeed: 1,
  wordsPerPage: 3,
  maxCharsPerLine: 18,
  x: 0.5,
  y: 0.7,
  rotation: 0,
  align: 'center',
  emoji: false,
  keywordColors: true,
  keywordColor: '#22c55e',
  keywordColor2: '#ef4444',
  removePunctuation: true,
});

export const defaultCaptions = (): Captions => ({ enabled: true, words: [], style: defaultCaptionStyle(), language: 'portuguese' });

export function defaultTracks(): Track[] {
  return [{ id: 'main', kind: 'main', name: 'Principal', muted: false, hidden: false, locked: false }];
}

export function newProject(name: string, aspect = '9:16'): Project {
  const a = ASPECTS.find((x) => x.id === aspect) ?? ASPECTS[0];
  const now = Date.now();
  return {
    id: uid('p'),
    name,
    createdAt: now,
    updatedAt: now,
    aspect: a.id,
    width: a.w,
    height: a.h,
    fps: 30,
    background: { type: 'blur', color: '#000000', blur: 0.6 },
    tracks: defaultTracks(),
    clips: [],
    captions: defaultCaptions(),
    markers: [],
    media: [],
    customLuts: [],
  };
}
