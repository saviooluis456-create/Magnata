export type MediaKind = 'video' | 'image' | 'audio';

export interface MediaAsset {
  id: string;
  name: string;
  kind: MediaKind;
  mime: string;
  size: number;
  duration: number; // seconds (images: 0)
  width: number;
  height: number;
  hasAudio: boolean;
  thumb?: string; // data URL
  thumbs?: string[]; // filmstrip
  waveform?: number[]; // normalized peaks 0..1
}

export type Ease = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'back' | 'elastic' | 'bounce' | 'hold';

export interface Keyframe {
  t: number; // seconds relative to clip start (timeline time)
  v: number;
  ease: Ease;
}

export type AnimProp = 'x' | 'y' | 'scale' | 'rotation' | 'opacity' | 'volume' | 'blur';

export interface Transform {
  x: number; // offset in canvas widths from center (-1..1)
  y: number; // offset in canvas heights from center
  scale: number;
  rotation: number; // degrees
  opacity: number; // 0..1
  flipX: boolean;
  flipY: boolean;
  cropL: number; // 0..1 fractions
  cropR: number;
  cropT: number;
  cropB: number;
}

export interface Adjust {
  brightness: number; // all -100..100
  contrast: number;
  saturation: number;
  exposure: number;
  temperature: number;
  tint: number;
  highlights: number;
  shadows: number;
  vibrance: number;
  hue: number;
  fade: number;
  vignette: number;
  sharpen: number;
  grain: number;
}

export type Wheel4 = [number, number, number, number]; // r g b offsets (-1..1) + master
export interface Wheels { lift: Wheel4; gamma: Wheel4; gain: Wheel4; offset: Wheel4 }

export interface CameraInfo { make: string; model: string; log: string | null; hdr: boolean; profile: string | null }

export interface EffectInst {
  id: string;
  type: string;
  intensity: number; // 0..1
  speed: number; // 0.1..4
}

export interface TransitionInst {
  type: string;
  duration: number; // seconds
  sound: string | null; // sfx id or null
  soundVolume: number; // 0..1.5
}

export interface AnimSpec {
  type: string;
  duration: number;
}

export interface ClipAnims {
  in: AnimSpec | null;
  out: AnimSpec | null;
  loop: AnimSpec | null; // duration = cycle seconds
}

export type BlendMode =
  | 'normal' | 'multiply' | 'screen' | 'overlay' | 'add' | 'darken' | 'lighten'
  | 'softlight' | 'hardlight' | 'difference' | 'colordodge' | 'colorburn' | 'exclusion';

export interface ChromaKey {
  enabled: boolean;
  color: string;
  similarity: number; // 0..1
  smoothness: number; // 0..1
  spill: number; // 0..1
}

export type MaskType = 'none' | 'circle' | 'rect' | 'linear' | 'mirror' | 'heart' | 'star';

export interface Mask {
  type: MaskType;
  x: number; // center offset in layer space (-0.5..0.5)
  y: number;
  w: number; // size 0..1.5
  h: number;
  rotation: number;
  feather: number; // 0..1
  invert: boolean;
  radius: number; // rect roundness 0..1
}

export interface TextStyle {
  text: string;
  font: string;
  weight: number;
  italic: boolean;
  size: number; // px at 1080 base width
  color: string;
  gradient: string | null; // second color for vertical gradient
  align: 'left' | 'center' | 'right';
  letterSpacing: number;
  lineHeight: number;
  strokeColor: string;
  strokeWidth: number;
  shadowColor: string;
  shadowBlur: number;
  shadowX: number;
  shadowY: number;
  bgColor: string;
  bgOpacity: number;
  bgPadding: number;
  bgRadius: number;
  glowColor: string;
  glowSize: number;
  uppercase: boolean;
  preset?: string;
}

export type VoiceFx = 'none' | 'robot' | 'telephone' | 'radio' | 'echo' | 'reverb' | 'megaphone' | 'underwater' | 'stadium' | 'whisper' | 'monster';

export interface AudioOpts {
  volume: number; // 0..3
  muted: boolean;
  fadeIn: number;
  fadeOut: number;
  voiceFx: VoiceFx;
  enhance: boolean; // AI voice enhance
  denoise: boolean;
  eqLow: number; // dB -12..12
  eqMid: number;
  eqHigh: number;
}

export type ClipKind = 'video' | 'image' | 'audio' | 'text' | 'color' | 'motion';

export interface MotionData { template: string; texts: string[]; colors: string[]; font: string }

export interface Clip {
  id: string;
  trackId: string;
  kind: ClipKind;
  mediaId: string | null;
  name: string;
  start: number; // timeline seconds
  duration: number; // timeline seconds
  in: number; // source offset seconds
  speed: number;
  fit: 'contain' | 'cover' | 'fill';
  transform: Transform;
  keyframes: Partial<Record<AnimProp, Keyframe[]>>;
  blend: BlendMode;
  adjust: Adjust;
  filter: { id: string; intensity: number } | null;
  lut: { id: string; intensity: number } | null;
  wheels: Wheels;
  camera: CameraInfo | null;
  effects: EffectInst[];
  transition: TransitionInst | null; // transition INTO this clip (main track)
  anims: ClipAnims;
  audio: AudioOpts;
  chroma: ChromaKey;
  mask: Mask;
  bgRemove: boolean;
  text: TextStyle | null;
  motion?: MotionData | null;
  color: string; // for color clips
}

export type TrackKind = 'main' | 'video' | 'audio' | 'text';

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  muted: boolean;
  hidden: boolean;
  locked: boolean;
}

export interface CaptionWord {
  id: string;
  text: string;
  start: number;
  end: number;
  emoji?: string;
  highlight?: boolean;
  /** per-phrase style override (key into Captions.overrides) */
  styleId?: string;
}

export type CaptionAnim =
  | 'none' | 'pop' | 'bounce' | 'fade' | 'slide-up' | 'typewriter' | 'zoom' | 'shake'
  | 'blur-in' | 'glitch' | 'wave' | 'drop' | 'flip' | 'stretch' | 'rise'
  | 'spring' | 'slam' | 'swing' | 'scramble' | 'letters' | 'roll' | 'spotlight' | 'jelly';

export type CaptionHighlight = 'none' | 'color' | 'box' | 'underline' | 'scale' | 'karaoke' | 'glow' | 'outline' | 'font' | 'line' | 'fill';

export interface CaptionStyle {
  preset: string;
  /** emphasized words (keywords, starred words, or the active word when highlight = 'font') */
  emphFont: string | null;
  emphWeight: number;
  emphItalic: boolean;
  emphScale: number;
  /** pick the most important word of each phrase automatically when none is detected */
  emphAuto: boolean;
  /** emphasize the first word of each phrase */
  emphFirst: boolean;
  /** emphasized words also glow in their color */
  emphGlow: boolean;
  lowercase: boolean;
  /** scale each line to the same width (stacked poster look) */
  fitLines: boolean;
  /** start a new phrase after a pause longer than this (seconds) */
  pauseSplit: number;
  font: string;
  weight: number;
  italic: boolean;
  size: number; // px at 1080 width
  uppercase: boolean;
  letterSpacing: number;
  lineHeight: number;
  color: string;
  gradient: string | null;
  strokeColor: string;
  strokeWidth: number;
  shadowColor: string;
  shadowBlur: number;
  shadowX: number;
  shadowY: number;
  glowColor: string;
  glowSize: number;
  bgMode: 'none' | 'line' | 'block' | 'word';
  bgColor: string;
  bgOpacity: number;
  bgPadding: number;
  bgRadius: number;
  highlight: CaptionHighlight;
  activeColor: string;
  activeBg: string;
  activeScale: number;
  inactiveOpacity: number;
  showUpcoming: boolean; // false => words appear as spoken
  animation: CaptionAnim;
  animSpeed: number;
  wordsPerPage: number;
  maxCharsPerLine: number;
  x: number; // 0..1
  y: number; // 0..1
  rotation: number;
  align: 'left' | 'center' | 'right' | 'stagger';
  emoji: boolean;
  keywordColors: boolean;
  keywordColor: string;
  keywordColor2: string;
  removePunctuation: boolean;
}

export interface Captions {
  enabled: boolean;
  words: CaptionWord[];
  style: CaptionStyle;
  language: string;
  overrides: Record<string, CaptionStyle>;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  aspect: string; // e.g. '9:16'
  width: number;
  height: number;
  fps: number;
  background: { type: 'color' | 'blur'; color: string; blur: number };
  tracks: Track[];
  clips: Clip[];
  captions: Captions;
  markers: number[];
  media: MediaAsset[];
  customLuts: { id: string; name: string }[];
  thumb?: string;
}

export interface ExportSettings {
  resolution: number; // short side px
  fps: number;
  quality: 'low' | 'medium' | 'high' | 'very-high' | 'max';
  videoCodec: 'avc' | 'hevc' | 'vp9' | 'av1';
  container: 'mp4' | 'webm' | 'mov';
  audioBitrate: number;
  includeAudio: boolean;
  range: 'all' | 'selection';
  /** normalize the final mix to this integrated loudness (LUFS); null = keep the mix as is */
  loudness?: number | null;
}
