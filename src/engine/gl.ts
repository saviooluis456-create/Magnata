export type GL = WebGLRenderingContext | WebGL2RenderingContext;

export const VS_QUAD = `
attribute vec2 a_pos;
uniform mat3 u_matrix;
varying vec2 v_uv;
void main(){
  v_uv = a_pos;
  vec3 p = u_matrix * vec3(a_pos, 1.0);
  gl_Position = vec4(p.xy, 0.0, 1.0);
}`;

export const VS_FS = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main(){
  v_uv = a_pos;
  gl_Position = vec4(a_pos * 2.0 - 1.0, 0.0, 1.0);
}`;

export const GLSL_COMMON = `
precision highp float;
float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  float a = rand(i), b = rand(i + vec2(1.0, 0.0)), c = rand(i + vec2(0.0, 1.0)), d = rand(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 hsv2rgb(vec3 c){
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
vec3 rgb2hsv(vec3 c){
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
`;

export class Program {
  prog: WebGLProgram;
  private locs = new Map<string, WebGLUniformLocation | null>();
  constructor(public gl: GL, vs: string, fs: string, public name = '') {
    const p = gl.createProgram()!;
    const v = compile(gl, gl.VERTEX_SHADER, vs, name);
    const f = compile(gl, gl.FRAGMENT_SHADER, fs, name);
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.bindAttribLocation(p, 0, 'a_pos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) {
      throw new Error(`Link ${name}: ${gl.getProgramInfoLog(p)}`);
    }
    gl.deleteShader(v);
    gl.deleteShader(f);
    this.prog = p;
  }
  loc(n: string) {
    let l = this.locs.get(n);
    if (l === undefined) { l = this.gl.getUniformLocation(this.prog, n); this.locs.set(n, l); }
    return l;
  }
  use() { this.gl.useProgram(this.prog); return this; }
  f1(n: string, v: number) { const l = this.loc(n); if (l) this.gl.uniform1f(l, v); return this; }
  i1(n: string, v: number) { const l = this.loc(n); if (l) this.gl.uniform1i(l, v); return this; }
  f2(n: string, a: number, b: number) { const l = this.loc(n); if (l) this.gl.uniform2f(l, a, b); return this; }
  f3(n: string, a: number, b: number, c: number) { const l = this.loc(n); if (l) this.gl.uniform3f(l, a, b, c); return this; }
  f4(n: string, a: number, b: number, c: number, d: number) { const l = this.loc(n); if (l) this.gl.uniform4f(l, a, b, c, d); return this; }
  m3(n: string, m: Float32Array) { const l = this.loc(n); if (l) this.gl.uniformMatrix3fv(l, false, m); return this; }
  dispose() { this.gl.deleteProgram(this.prog); }
}

function compile(gl: GL, type: number, src: string, name: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(`Shader ${name}: ${log}`);
  }
  return s;
}

export class FBO {
  tex: WebGLTexture;
  fb: WebGLFramebuffer;
  constructor(public gl: GL, public w: number, public h: number) {
    this.tex = createTexture(gl);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    this.fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  bind() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
    gl.viewport(0, 0, this.w, this.h);
  }
  clear() {
    this.bind();
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }
  dispose() {
    this.gl.deleteTexture(this.tex);
    this.gl.deleteFramebuffer(this.fb);
  }
}

export function createTexture(gl: GL): WebGLTexture {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

/** Column-major 3x3 matrices */
export const mat3 = {
  identity: () => new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
  mul(a: Float32Array, b: Float32Array): Float32Array {
    const o = new Float32Array(9);
    for (let c = 0; c < 3; c++)
      for (let r = 0; r < 3; r++)
        o[c * 3 + r] = a[r] * b[c * 3] + a[3 + r] * b[c * 3 + 1] + a[6 + r] * b[c * 3 + 2];
    return o;
  },
  translate: (x: number, y: number) => new Float32Array([1, 0, 0, 0, 1, 0, x, y, 1]),
  scale: (x: number, y: number) => new Float32Array([x, 0, 0, 0, y, 0, 0, 0, 1]),
  rotate(rad: number) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return new Float32Array([c, s, 0, -s, c, 0, 0, 0, 1]);
  },
};

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.startsWith('rgb')) return [0, 0, 0];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (isNaN(n)) return [0, 0, 0];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
