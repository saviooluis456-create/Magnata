import { mainAt, overlaysAt, trackById, mediaById } from '../model/timeline';
import type { BlendMode, Clip, Project } from '../model/types';
import { animatedState } from './animations';
import { EFFECT_MAP } from './effects';
import { LOOK_MAP } from './filters';
import { FBO, GLSL_COMMON, Program, VS_FS, VS_QUAD, createTexture, hexToRgb, mat3, type GL } from './gl';
import { drawCaptions, makeCanvas, renderText } from './textRender';
import { TRANSITION_MAP } from './transitions';

export interface FrameImage {
  img: TexImageSource;
  w: number;
  h: number;
  /** unique identity of the pixel content; when unchanged the texture is not re-uploaded */
  version: unknown;
}

export interface SourceProvider {
  frame(clip: Clip, t: number): FrameImage | null;
  mask?(clip: Clip, t: number): FrameImage | null;
}

const LAYER_FS = `${GLSL_COMMON}
uniform sampler2D u_tex;
uniform sampler2D u_seg;
uniform float u_hasSeg;
uniform vec4 u_crop;
uniform vec2 u_flip;
uniform float u_opacity;
uniform vec2 u_texel;
uniform vec4 u_adj1; // brightness contrast saturation exposure
uniform vec4 u_adj2; // temperature tint highlights shadows
uniform vec4 u_adj3; // vibrance hue fade vignette
uniform vec4 u_adj4; // sharpen grain time solid
uniform vec4 u_look1; // exposure contrast saturation temperature
uniform vec4 u_look2; // tint fade hue vibrance
uniform vec3 u_lookSh;
uniform vec3 u_lookHi;
uniform float u_lookMode;
uniform float u_lookAmt;
uniform vec4 u_chroma; // enabled similarity smoothness spill
uniform vec3 u_chromaKey;
uniform vec4 u_mask1; // type x y rot
uniform vec4 u_mask2; // w h feather invert
uniform vec4 u_mask3; // radius aspect
uniform vec3 u_solid;
varying vec2 v_uv;

vec3 hueShift(vec3 c, float h){
  float a = h * 3.14159;
  const vec3 k = vec3(0.57735);
  float ca = cos(a);
  return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
}

vec3 grade(vec3 c, float bri, float con, float sat, float expo, float temp, float tint, float hi, float sh, float vib, float hue, float fade){
  c *= pow(2.0, expo * 1.5);
  c += bri * 0.25;
  float l = luma(c);
  c += sh * 0.3 * (1.0 - smoothstep(0.0, 0.55, l));
  c += hi * 0.3 * smoothstep(0.45, 1.0, l);
  c = (c - 0.5) * (1.0 + con) + 0.5;
  c.r += temp * 0.12; c.b -= temp * 0.12; c.g += tint * 0.1; c.rb -= tint * 0.03;
  if (abs(hue) > 0.001) c = hueShift(c, hue);
  l = luma(c);
  c = mix(vec3(l), c, 1.0 + sat);
  float mx = max(c.r, max(c.g, c.b)); float mn = min(c.r, min(c.g, c.b));
  c = mix(vec3(l), c, 1.0 + vib * (1.0 - (mx - mn)));
  c = c * (1.0 - fade * 0.35) + fade * 0.12;
  return c;
}

float maskShape(vec2 uv){
  int type = int(u_mask1.x + 0.5);
  if (type == 0) return 1.0;
  vec2 p = uv - 0.5 - vec2(u_mask1.y, u_mask1.z);
  p.x *= u_mask3.y;
  float r = u_mask1.w;
  p = mat2(cos(r), sin(r), -sin(r), cos(r)) * p;
  float f = max(u_mask2.z, 0.001);
  float d;
  vec2 hs = vec2(u_mask2.x * u_mask3.y, u_mask2.y) * 0.5;
  if (type == 1) { d = length(p / max(hs, vec2(0.001))) - 1.0; d *= min(hs.x, hs.y); }
  else if (type == 2) { float rr = u_mask3.x * min(hs.x, hs.y); vec2 q = abs(p) - hs + rr; d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rr; }
  else if (type == 3) { d = p.y; }
  else if (type == 4) { d = abs(p.y) - hs.y; }
  else if (type == 5) { vec2 q = p / max(hs.x, 0.001); q.y = -q.y + 0.25; q *= 1.2; q.y -= sqrt(abs(q.x)) * 0.55; d = (length(q) - 0.8) * hs.x; }
  else { float a = atan(p.y, p.x); float s = 0.6 + 0.4 * cos(a * 5.0); d = length(p) - hs.x * s; }
  float m = smoothstep(f, -f, d);
  return u_mask2.w > 0.5 ? 1.0 - m : m;
}

void main(){
  vec2 uv = v_uv;
  if (u_flip.x > 0.5) uv.x = 1.0 - uv.x;
  if (u_flip.y > 0.5) uv.y = 1.0 - uv.y;
  vec2 suv = mix(u_crop.xy, vec2(1.0) - u_crop.zw, uv);
  vec4 s = u_adj4.w > 0.5 ? vec4(u_solid, 1.0) : texture2D(u_tex, suv);
  float a = s.a;
  vec3 c = a > 0.0 ? s.rgb / a : vec3(0.0);
  if (u_adj4.x != 0.0) {
    vec3 blur = (texture2D(u_tex, suv + vec2(u_texel.x, 0.0)).rgb + texture2D(u_tex, suv - vec2(u_texel.x, 0.0)).rgb + texture2D(u_tex, suv + vec2(0.0, u_texel.y)).rgb + texture2D(u_tex, suv - vec2(0.0, u_texel.y)).rgb) * 0.25;
    c = c + (c - blur) * u_adj4.x * 2.0;
  }
  if (u_chroma.x > 0.5) {
    vec2 kc = vec2(u_chromaKey.b - luma(u_chromaKey), u_chromaKey.r - luma(u_chromaKey));
    vec2 cc = vec2(c.b - luma(c), c.r - luma(c));
    float dist = distance(kc, cc);
    float k = smoothstep(u_chroma.y * 0.5, u_chroma.y * 0.5 + u_chroma.z * 0.5 + 0.001, dist);
    a *= k;
    float spillAmt = (1.0 - k) * 0.0 + u_chroma.w;
    float maxRB = max(c.r, c.b);
    if (u_chromaKey.g > u_chromaKey.r && u_chromaKey.g > u_chromaKey.b) c.g = mix(c.g, min(c.g, maxRB), spillAmt);
    else if (u_chromaKey.b > u_chromaKey.r) c.b = mix(c.b, min(c.b, max(c.r, c.g)), spillAmt);
  }
  if (u_hasSeg > 0.5) {
    float m = texture2D(u_seg, suv).r;
    a *= smoothstep(0.35, 0.65, m);
  }
  c = grade(c, u_adj1.x, u_adj1.y, u_adj1.z, u_adj1.w, u_adj2.x, u_adj2.y, u_adj2.z, u_adj2.w, u_adj3.x, u_adj3.y, u_adj3.z);
  if (u_lookAmt > 0.0) {
    vec3 g = c;
    if (u_lookMode > 0.5 && u_lookMode < 1.5) g = vec3(luma(g));
    else if (u_lookMode > 1.5 && u_lookMode < 2.5) { float l = luma(g); g = vec3(l * 1.07 + 0.05, l * 0.9 + 0.02, l * 0.7); }
    else if (u_lookMode > 2.5) { float l = luma(g); g = mix(g, vec3(l), 0.6); g = (g - 0.5) * 1.25 + 0.5; }
    g = grade(g, 0.0, u_look1.y, u_look1.z, u_look1.x, u_look1.w, u_look2.x, 0.0, 0.0, u_look2.w, u_look2.z, u_look2.y);
    float l = luma(g);
    g += u_lookSh * (1.0 - smoothstep(0.0, 0.6, l)) + u_lookHi * smoothstep(0.4, 1.0, l);
    c = mix(c, g, u_lookAmt);
  }
  if (u_adj3.w != 0.0) {
    vec2 v = uv - 0.5;
    float vig = smoothstep(0.25, 0.85, length(v) * 1.2);
    c = u_adj3.w > 0.0 ? c * (1.0 - vig * u_adj3.w) : mix(c, vec3(1.0), vig * -u_adj3.w);
  }
  if (u_adj4.y > 0.0) c += (rand(suv * 1000.0 + fract(u_adj4.z * 7.0)) - 0.5) * u_adj4.y * 0.25;
  c = clamp(c, 0.0, 1.0);
  a *= maskShape(uv) * u_opacity;
  gl_FragColor = vec4(c * a, a);
}`;

const COMPOSITE_FS = `${GLSL_COMMON}
uniform sampler2D u_base;
uniform sampler2D u_layer;
uniform float u_mode;
varying vec2 v_uv;
float sl(float b, float s){ return s < 0.5 ? b - (1.0 - 2.0 * s) * b * (1.0 - b) : b + (2.0 * s - 1.0) * ((b < 0.25 ? ((16.0 * b - 12.0) * b + 4.0) * b : sqrt(b)) - b); }
vec3 blend(vec3 b, vec3 s, int m){
  if (m == 1) return b * s;
  if (m == 2) return b + s - b * s;
  if (m == 3) return vec3(b.r < 0.5 ? 2.0 * b.r * s.r : 1.0 - 2.0 * (1.0 - b.r) * (1.0 - s.r), b.g < 0.5 ? 2.0 * b.g * s.g : 1.0 - 2.0 * (1.0 - b.g) * (1.0 - s.g), b.b < 0.5 ? 2.0 * b.b * s.b : 1.0 - 2.0 * (1.0 - b.b) * (1.0 - s.b));
  if (m == 4) return min(b + s, 1.0);
  if (m == 5) return min(b, s);
  if (m == 6) return max(b, s);
  if (m == 7) return vec3(sl(b.r, s.r), sl(b.g, s.g), sl(b.b, s.b));
  if (m == 8) return vec3(s.r < 0.5 ? 2.0 * b.r * s.r : 1.0 - 2.0 * (1.0 - b.r) * (1.0 - s.r), s.g < 0.5 ? 2.0 * b.g * s.g : 1.0 - 2.0 * (1.0 - b.g) * (1.0 - s.g), s.b < 0.5 ? 2.0 * b.b * s.b : 1.0 - 2.0 * (1.0 - b.b) * (1.0 - s.b));
  if (m == 9) return abs(b - s);
  if (m == 10) return min(b / max(1.0 - s, 0.001), 1.0);
  if (m == 11) return 1.0 - min((1.0 - b) / max(s, 0.001), 1.0);
  if (m == 12) return b + s - 2.0 * b * s;
  return s;
}
void main(){
  vec4 b = texture2D(u_base, v_uv);
  vec4 s = texture2D(u_layer, v_uv);
  int m = int(u_mode + 0.5);
  if (m == 0 || b.a <= 0.0) { gl_FragColor = s + b * (1.0 - s.a); return; }
  if (s.a <= 0.0) { gl_FragColor = b; return; }
  vec3 cb = b.rgb / b.a; vec3 cs = s.rgb / s.a;
  vec3 cm = mix(cs, clamp(blend(cb, cs, m), 0.0, 1.0), b.a);
  gl_FragColor = vec4(s.a * cm + (1.0 - s.a) * b.rgb, s.a + b.a * (1.0 - s.a));
}`;

const COPY_FS = `precision highp float;
uniform sampler2D u_tex; uniform float u_alpha; varying vec2 v_uv;
void main(){ gl_FragColor = texture2D(u_tex, v_uv) * u_alpha; }`;

const FILL_FS = `precision highp float;
uniform vec4 u_color; varying vec2 v_uv;
void main(){ gl_FragColor = u_color; }`;

const BLUR_FS = `precision highp float;
uniform sampler2D u_tex; uniform vec2 u_dir; varying vec2 v_uv;
void main(){
  vec4 c = texture2D(u_tex, v_uv) * 0.2270270270;
  c += texture2D(u_tex, v_uv + u_dir * 1.3846153846) * 0.3162162162;
  c += texture2D(u_tex, v_uv - u_dir * 1.3846153846) * 0.3162162162;
  c += texture2D(u_tex, v_uv + u_dir * 3.2307692308) * 0.0702702703;
  c += texture2D(u_tex, v_uv - u_dir * 3.2307692308) * 0.0702702703;
  gl_FragColor = c;
}`;

const EFFECT_HEAD = `${GLSL_COMMON}
uniform sampler2D u_tex; uniform vec2 u_res; uniform float u_time; uniform float u_amt; varying vec2 v_uv;
vec4 tex(vec2 uv){ if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0); return texture2D(u_tex, uv); }
`;

const TRANS_HEAD = `${GLSL_COMMON}
uniform sampler2D u_from; uniform sampler2D u_to; uniform float u_progress; uniform vec2 u_res; varying vec2 v_uv;
vec4 getFrom(vec2 uv){ if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0); return texture2D(u_from, uv); }
vec4 getTo(vec2 uv){ if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0); return texture2D(u_to, uv); }
`;

const BLEND_IDS: Record<BlendMode, number> = {
  normal: 0, multiply: 1, screen: 2, overlay: 3, add: 4, darken: 5, lighten: 6, softlight: 7, hardlight: 8,
  difference: 9, colordodge: 10, colorburn: 11, exclusion: 12,
};
const MASK_IDS = { none: 0, circle: 1, rect: 2, linear: 3, mirror: 4, heart: 5, star: 6 } as const;

interface TexEntry { tex: WebGLTexture; version: unknown; w: number; h: number; used: number }

export interface RenderOptions { /** time used for "now" based effects */ quality?: 'preview' | 'export' }

export class Compositor {
  gl!: GL;
  W = 2;
  H = 2;
  private quad!: WebGLBuffer;
  private layerProg!: Program;
  private compProg!: Program;
  private copyProg!: Program;
  private fillProg!: Program;
  private blurProg!: Program;
  private effectProgs = new Map<string, Program | null>();
  private transProgs = new Map<string, Program | null>();
  private fbos: Record<string, FBO> = {};
  private small: FBO[] = [];
  private textures = new Map<string, TexEntry>();
  private capCanvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  private frameNo = 0;
  private dummy!: WebGLTexture;
  lost = false;
  onLost?: () => void;
  onRestored?: () => void;

  constructor(public canvas: HTMLCanvasElement | OffscreenCanvas, private preserve = false) {
    this.init();
    if ('addEventListener' in canvas) {
      (canvas as HTMLCanvasElement).addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; this.onLost?.(); }, false);
      (canvas as HTMLCanvasElement).addEventListener('webglcontextrestored', () => { this.lost = false; this.resetResources(); this.init(); this.onRestored?.(); }, false);
    }
  }

  private init() {
    const opts: WebGLContextAttributes = { alpha: false, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: this.preserve, powerPreference: 'high-performance' };
    const gl = (this.canvas.getContext('webgl2', opts) || this.canvas.getContext('webgl', opts)) as GL | null;
    if (!gl) throw new Error('WebGL indisponível neste dispositivo');
    this.gl = gl;
    this.quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    // 1x1 texture bound to otherwise-unused sampler units, so no FBO texture stays bound (avoids feedback loops)
    this.dummy = createTexture(gl);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    this.layerProg = new Program(gl, VS_QUAD, LAYER_FS, 'layer');
    this.compProg = new Program(gl, VS_FS, COMPOSITE_FS, 'composite');
    this.copyProg = new Program(gl, VS_FS, COPY_FS, 'copy');
    this.fillProg = new Program(gl, VS_FS, FILL_FS, 'fill');
    this.blurProg = new Program(gl, VS_FS, BLUR_FS, 'blur');
    this.effectProgs.clear();
    this.transProgs.clear();
    this.allocFbos();
  }

  private resetResources() {
    this.fbos = {};
    this.small = [];
    this.textures.clear();
    this.effectProgs.clear();
    this.transProgs.clear();
  }

  resize(w: number, h: number) {
    w = Math.max(2, Math.round(w));
    h = Math.max(2, Math.round(h));
    if (w === this.W && h === this.H && this.fbos.accA) return;
    this.W = w;
    this.H = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.allocFbos();
  }

  private allocFbos() {
    const gl = this.gl;
    if (!gl || gl.isContextLost()) return;
    Object.values(this.fbos).forEach((f) => f.dispose());
    this.small.forEach((f) => f.dispose());
    const mk = () => new FBO(gl, this.W, this.H);
    this.fbos = { accA: mk(), accB: mk(), layA: mk(), layB: mk(), from: mk(), to: mk() };
    const sw = Math.max(2, Math.round(this.W / 6)), sh = Math.max(2, Math.round(this.H / 6));
    this.small = [new FBO(gl, sw, sh), new FBO(gl, sw, sh)];
  }

  private effectProg(id: string): Program | null {
    if (this.effectProgs.has(id)) return this.effectProgs.get(id)!;
    const def = EFFECT_MAP.get(id);
    let p: Program | null = null;
    if (def) {
      try { p = new Program(this.gl, VS_FS, EFFECT_HEAD + def.glsl + '\nvoid main(){ gl_FragColor = effect(v_uv); }', 'fx:' + id); }
      catch (e) { console.warn(e); p = null; }
    }
    this.effectProgs.set(id, p);
    return p;
  }

  private transProg(id: string): Program | null {
    if (this.transProgs.has(id)) return this.transProgs.get(id)!;
    const def = TRANSITION_MAP.get(id);
    let p: Program | null = null;
    if (def) {
      try { p = new Program(this.gl, VS_FS, TRANS_HEAD + def.glsl + '\nvoid main(){ gl_FragColor = transition(v_uv); }', 'tr:' + id); }
      catch (e) { console.warn(e); p = null; }
    }
    this.transProgs.set(id, p);
    return p;
  }

  /** Pre-compile shaders used by a project to avoid hitches during playback. */
  warmup(p: Project) {
    for (const c of p.clips) {
      c.effects.forEach((e) => this.effectProg(e.type));
      if (c.transition) this.transProg(c.transition.type);
    }
  }

  /** Compiles every effect and transition shader; returns ids that failed (diagnostics). */
  compileAll(): string[] {
    const failed: string[] = [];
    for (const id of EFFECT_MAP.keys()) if (!this.effectProg(id)) failed.push('fx:' + id);
    for (const id of TRANSITION_MAP.keys()) if (!this.transProg(id)) failed.push('tr:' + id);
    return failed;
  }

  private draw() { this.gl.drawArrays(this.gl.TRIANGLES, 0, 6); }

  private bindTex(unit: number, tex: WebGLTexture) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  }

  private upload(key: string, f: FrameImage): TexEntry | null {
    const gl = this.gl;
    let e = this.textures.get(key);
    if (!e) {
      e = { tex: createTexture(gl), version: Symbol('none'), w: f.w, h: f.h, used: this.frameNo };
      this.textures.set(key, e);
    }
    e.used = this.frameNo;
    gl.bindTexture(gl.TEXTURE_2D, e.tex);
    if (e.version !== f.version || f.version === undefined) {
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, f.img);
        e.version = f.version;
        e.w = f.w;
        e.h = f.h;
      } catch (err) {
        console.warn('upload failed', err);
        return null;
      }
    }
    return e;
  }

  /** Garbage-collect textures not used recently */
  private gcTextures() {
    if (this.frameNo % 120 !== 0) return;
    for (const [k, e] of this.textures) {
      if (this.frameNo - e.used > 240) { this.gl.deleteTexture(e.tex); this.textures.delete(k); }
    }
  }

  private fill(target: FBO, r: number, g: number, b: number, a: number) {
    target.bind();
    this.fillProg.use().f4('u_color', r * a, g * a, b * a, a);
    this.draw();
  }

  private copy(src: FBO, dst: FBO | null, alpha = 1) {
    const gl = this.gl;
    if (dst) dst.bind();
    else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.W, this.H); }
    this.copyProg.use().i1('u_tex', 0).f1('u_alpha', alpha);
    this.bindTex(0, src.tex);
    this.draw();
  }

  /** Builds the transform matrix for a layer in clip space. */
  private layerMatrix(project: Project, c: Clip, srcW: number, srcH: number, t: number, fitOverride?: 'cover' | 'contain' | 'fill' | 'none') {
    const st = animatedState(c, t);
    const PW = project.width, PH = project.height;
    const tf = c.transform;
    const cw = srcW * (1 - tf.cropL - tf.cropR);
    const ch = srcH * (1 - tf.cropT - tf.cropB);
    const fit = fitOverride ?? (c.kind === 'text' ? 'none' : c.fit);
    let w: number, h: number;
    if (fit === 'none') { w = cw; h = ch; }
    else if (fit === 'fill') { w = PW; h = PH; }
    else {
      const s = fit === 'cover' ? Math.max(PW / cw, PH / ch) : Math.min(PW / cw, PH / ch);
      w = cw * s; h = ch * s;
    }
    const sc = st.scale;
    w *= sc * st.scaleX;
    h *= sc * st.scaleY;
    // project px -> clip space
    const toClip = mat3.mul(mat3.translate(-1, 1), mat3.scale(2 / PW, -2 / PH));
    let m = mat3.mul(toClip, mat3.translate(PW / 2 + st.x * PW, PH / 2 + st.y * PH));
    m = mat3.mul(m, mat3.rotate((st.rotation * Math.PI) / 180));
    m = mat3.mul(m, mat3.scale(w, h));
    m = mat3.mul(m, mat3.translate(-0.5, -0.5));
    return { m, st, w, h };
  }

  private frameFor(provider: SourceProvider, project: Project, c: Clip, t: number): { entry: TexEntry; key: string; text?: boolean } | null {
    if (c.kind === 'color') return null;
    if (c.kind === 'text' && c.text) {
      const st = animatedState(c, t);
      const outScale = this.W / project.width;
      const ref = Math.min(project.width, project.height) / 1080;
      const r = renderText(c.text, outScale * ref, st.reveal);
      const e = this.upload('t:' + c.id, { img: r.canvas as TexImageSource, w: r.w / outScale, h: r.h / outScale, version: r });
      return e ? { entry: e, key: 't:' + c.id, text: true } : null;
    }
    const f = provider.frame(c, t);
    if (!f) return null;
    const key = (c.kind === 'image' ? 'i:' + c.mediaId : 'v:' + c.id);
    const e = this.upload(key, f);
    return e ? { entry: e, key } : null;
  }

  /** Renders a clip with color/effects into a layer FBO. Returns the FBO containing the result (or null). */
  private renderClip(project: Project, c: Clip, t: number, provider: SourceProvider, quality: 'preview' | 'export'): FBO | null {
    const gl = this.gl;
    const src = this.frameFor(provider, project, c, t);
    const isColor = c.kind === 'color';
    if (!src && !isColor) return null;
    const srcW = isColor ? project.width : src!.entry.w;
    const srcH = isColor ? project.height : src!.entry.h;
    const { m, st, w, h } = this.layerMatrix(project, c, srcW, srcH, t);
    if (st.opacity <= 0.001) return null;
    let cur = this.fbos.layA, alt = this.fbos.layB;
    cur.clear();
    const P = this.layerProg.use();
    P.m3('u_matrix', m).i1('u_tex', 0).i1('u_seg', 1);
    if (src) this.bindTex(0, src.entry.tex);
    const mask = provider.mask && c.bgRemove ? provider.mask(c, t) : null;
    let segOk = false;
    if (mask) { const me = this.upload('m:' + c.id, mask); if (me) { this.bindTex(1, me.tex); segOk = true; } }
    if (!segOk) this.bindTex(1, this.dummy);
    if (src) this.bindTex(0, src.entry.tex);
    P.f1('u_hasSeg', segOk ? 1 : 0);
    const tf = c.transform;
    P.f4('u_crop', tf.cropL, tf.cropT, tf.cropR, tf.cropB);
    P.f2('u_flip', tf.flipX ? 1 : 0, tf.flipY ? 1 : 0);
    P.f1('u_opacity', st.opacity);
    P.f2('u_texel', 1 / Math.max(1, srcW), 1 / Math.max(1, srcH));
    const a = c.adjust;
    P.f4('u_adj1', a.brightness / 100, a.contrast / 100, a.saturation / 100, a.exposure / 100);
    P.f4('u_adj2', a.temperature / 100, a.tint / 100, a.highlights / 100, a.shadows / 100);
    P.f4('u_adj3', a.vibrance / 100, a.hue / 100, a.fade / 100, a.vignette / 100);
    P.f4('u_adj4', a.sharpen / 100, a.grain / 100, t, isColor ? 1 : 0);
    if (isColor) { const [r, g, b] = hexToRgb(c.color); P.f3('u_solid', r, g, b); }
    const look = c.filter ? LOOK_MAP.get(c.filter.id) : undefined;
    if (look && c.filter) {
      P.f4('u_look1', look.exposure ?? 0, look.contrast ?? 0, look.saturation ?? 0, look.temperature ?? 0);
      P.f4('u_look2', look.tint ?? 0, look.fade ?? 0, look.hue ?? 0, look.vibrance ?? 0);
      const sh = look.shadows ?? [0, 0, 0], hi = look.highlights ?? [0, 0, 0];
      P.f3('u_lookSh', sh[0], sh[1], sh[2]).f3('u_lookHi', hi[0], hi[1], hi[2]);
      P.f1('u_lookMode', look.mode ?? 0).f1('u_lookAmt', c.filter.intensity);
    } else P.f1('u_lookAmt', 0);
    const ch = c.chroma;
    P.f4('u_chroma', ch.enabled ? 1 : 0, ch.similarity, ch.smoothness, ch.spill);
    const kc = hexToRgb(ch.color);
    P.f3('u_chromaKey', kc[0], kc[1], kc[2]);
    const mk = c.mask;
    P.f4('u_mask1', MASK_IDS[mk.type] ?? 0, mk.x, mk.y, (mk.rotation * Math.PI) / 180);
    P.f4('u_mask2', mk.w, mk.h, mk.feather * 0.5, mk.invert ? 1 : 0);
    P.f4('u_mask3', mk.radius, srcW / Math.max(1, srcH), 0, 0);
    cur.bind();
    this.draw();

    // effects
    const fxList = c.effects.slice();
    if (st.blur > 0.01) fxList.push({ id: '_animblur', type: 'blur', intensity: Math.min(1, st.blur), speed: 1 });
    const lt = Math.max(0, t - c.start);
    for (const fx of fxList) {
      const prog = this.effectProg(fx.type);
      if (!prog || fx.intensity <= 0) continue;
      alt.clear();
      prog.use().i1('u_tex', 0).f2('u_res', this.W, this.H).f1('u_time', lt * fx.speed).f1('u_amt', fx.intensity);
      this.bindTex(0, cur.tex);
      this.draw();
      [cur, alt] = [alt, cur];
    }
    void quality; void w; void h; void gl;
    return cur;
  }

  private composite(layer: FBO, mode: BlendMode, acc: { a: FBO; b: FBO }) {
    acc.b.bind();
    this.compProg.use().i1('u_base', 0).i1('u_layer', 1).f1('u_mode', BLEND_IDS[mode] ?? 0);
    this.bindTex(0, acc.a.tex);
    this.bindTex(1, layer.tex);
    this.draw();
    const tmp = acc.a; acc.a = acc.b; acc.b = tmp;
  }

  private renderBlurBackground(project: Project, c: Clip, t: number, provider: SourceProvider, acc: { a: FBO; b: FBO }) {
    const src = this.frameFor(provider, project, c, t);
    if (!src || src.text) return;
    const [s0, s1] = this.small;
    const PW = project.width, PH = project.height;
    const tf = c.transform;
    const cw = src.entry.w * (1 - tf.cropL - tf.cropR), ch = src.entry.h * (1 - tf.cropT - tf.cropB);
    const s = Math.max(PW / cw, PH / ch) * 1.1;
    const toClip = mat3.mul(mat3.translate(-1, 1), mat3.scale(2 / PW, -2 / PH));
    let m = mat3.mul(toClip, mat3.translate(PW / 2, PH / 2));
    m = mat3.mul(m, mat3.scale(cw * s, ch * s));
    m = mat3.mul(m, mat3.translate(-0.5, -0.5));
    s0.clear();
    const P = this.layerProg.use();
    P.m3('u_matrix', m).i1('u_tex', 0).i1('u_seg', 1).f1('u_hasSeg', 0);
    this.bindTex(1, this.dummy);
    this.bindTex(0, src.entry.tex);
    P.f4('u_crop', tf.cropL, tf.cropT, tf.cropR, tf.cropB).f2('u_flip', 0, 0).f1('u_opacity', 1).f2('u_texel', 0.001, 0.001);
    P.f4('u_adj1', -0.05, 0, 0, 0).f4('u_adj2', 0, 0, 0, 0).f4('u_adj3', 0, 0, 0, 0).f4('u_adj4', 0, 0, 0, 0);
    P.f1('u_lookAmt', 0).f4('u_chroma', 0, 0, 0, 0).f4('u_mask1', 0, 0, 0, 0);
    this.draw();
    const passes = 2 + Math.round(project.background.blur * 4);
    for (let i = 0; i < passes; i++) {
      const r = 1 + i;
      s1.bind(); this.blurProg.use().i1('u_tex', 0).f2('u_dir', r / s0.w, 0); this.bindTex(0, s0.tex); this.draw();
      s0.bind(); this.blurProg.use().i1('u_tex', 0).f2('u_dir', 0, r / s0.h); this.bindTex(0, s1.tex); this.draw();
    }
    acc.a.bind();
    this.copyProg.use().i1('u_tex', 0).f1('u_alpha', 1);
    this.bindTex(0, s0.tex);
    this.draw();
  }

  render(project: Project, t: number, provider: SourceProvider, opts: RenderOptions = {}) {
    const gl = this.gl;
    if (!gl || this.lost || gl.isContextLost() || !this.fbos.accA) return;
    this.frameNo++;
    const quality = opts.quality ?? 'preview';
    const acc = { a: this.fbos.accA, b: this.fbos.accB };
    const [br, bg, bb] = hexToRgb(project.background.color);
    this.fill(acc.a, br, bg, bb, 1);
    const mainTrack = trackById(project, 'main');
    const main = mainTrack && !mainTrack.hidden ? mainAt(project, t) : null;

    if (main && project.background.type === 'blur') {
      const bgClip = main.to && (main.progress ?? 0) > 0.5 ? main.to : main.clip;
      if (bgClip.kind === 'video' || bgClip.kind === 'image') this.renderBlurBackground(project, bgClip, t, provider, acc);
    }

    if (main) {
      if (main.to && main.to.transition) {
        const prog = this.transProg(main.to.transition.type);
        const a = this.renderClip(project, main.clip, t, provider, quality);
        if (a) this.copy(a, this.fbos.from); else this.fbos.from.clear();
        const b = this.renderClip(project, main.to, t, provider, quality);
        if (b) this.copy(b, this.fbos.to); else this.fbos.to.clear();
        const out = this.fbos.layA;
        out.clear();
        if (prog) {
          prog.use().i1('u_from', 0).i1('u_to', 1).f1('u_progress', main.progress ?? 0).f2('u_res', this.W, this.H);
          this.bindTex(0, this.fbos.from.tex);
          this.bindTex(1, this.fbos.to.tex);
          this.draw();
        } else {
          this.copy((main.progress ?? 0) < 0.5 ? this.fbos.from : this.fbos.to, out);
        }
        this.composite(out, 'normal', acc);
      } else {
        const r = this.renderClip(project, main.clip, t, provider, quality);
        if (r) this.composite(r, main.clip.blend, acc);
      }
    }

    for (const c of overlaysAt(project, t)) {
      const r = this.renderClip(project, c, t, provider, quality);
      if (r) this.composite(r, c.blend, acc);
    }

    // captions
    const cap = project.captions;
    if (cap.enabled && cap.words.length) {
      if (!this.capCanvas || this.capCanvas.width !== this.W || this.capCanvas.height !== this.H) this.capCanvas = makeCanvas(this.W, this.H);
      const ctx = this.capCanvas.getContext('2d') as CanvasRenderingContext2D;
      ctx.clearRect(0, 0, this.W, this.H);
      const scale = (this.W / project.width) * (Math.min(project.width, project.height) / 1080);
      drawCaptions(ctx, this.W, this.H, cap.words, cap.style, t, scale);
      const e = this.upload('captions', { img: this.capCanvas as TexImageSource, w: this.W, h: this.H, version: undefined });
      if (e) {
        const lay = this.fbos.layA;
        lay.bind();
        // flip Y: canvas uploads are top-left origin -> draw with quad matrix
        const P = this.layerProg.use();
        const m = mat3.mul(mat3.translate(-1, 1), mat3.scale(2, -2));
        P.m3('u_matrix', m).i1('u_tex', 0).f1('u_hasSeg', 0).f4('u_crop', 0, 0, 0, 0).f2('u_flip', 0, 0).f1('u_opacity', 1)
          .f2('u_texel', 0.001, 0.001).f4('u_adj1', 0, 0, 0, 0).f4('u_adj2', 0, 0, 0, 0).f4('u_adj3', 0, 0, 0, 0).f4('u_adj4', 0, 0, 0, 0)
          .f1('u_lookAmt', 0).f4('u_chroma', 0, 0, 0, 0).f4('u_mask1', 0, 0, 0, 0);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        P.i1('u_seg', 1);
        this.bindTex(1, this.dummy);
        this.bindTex(0, e.tex);
        this.draw();
        this.composite(lay, 'normal', acc);
      }
    }

    this.copy(acc.a, null);
    this.gcTextures();
  }

  /** Read current frame as a Blob (PNG/JPEG) */
  async snapshot(type = 'image/png', quality = 0.95): Promise<Blob> {
    const c = this.canvas;
    if ('convertToBlob' in c) return (c as OffscreenCanvas).convertToBlob({ type, quality });
    return new Promise((res, rej) => (c as HTMLCanvasElement).toBlob((b) => (b ? res(b) : rej(new Error('snapshot'))), type, quality));
  }

  /** @param releaseContext also destroy the WebGL context (only when the canvas is not reused) */
  dispose(releaseContext = false) {
    const gl = this.gl;
    if (!gl || gl.isContextLost()) return;
    Object.values(this.fbos).forEach((f) => f.dispose());
    this.small.forEach((f) => f.dispose());
    this.textures.forEach((e) => gl.deleteTexture(e.tex));
    this.textures.clear();
    this.effectProgs.forEach((p) => p?.dispose());
    this.transProgs.forEach((p) => p?.dispose());
    [this.layerProg, this.compProg, this.copyProg, this.fillProg, this.blurProg].forEach((p) => p?.dispose());
    gl.deleteTexture(this.dummy);
    gl.deleteBuffer(this.quad);
    if (releaseContext) gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

export const hasMedia = (p: Project, c: Clip) => !!mediaById(p, c.mediaId);
