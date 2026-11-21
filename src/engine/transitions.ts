/** Transition library. GLSL body defines `vec4 transition(vec2 uv)`; helpers: getFrom, getTo, u_progress (p), u_res. */
export interface TransitionDef {
  id: string;
  name: string;
  cat: string;
  glsl: string;
  sound: string | null; // default paired sound effect
}

export const TRANSITION_CATEGORIES = [
  { id: 'basic', name: 'Básico' },
  { id: 'trend', name: 'Em alta' },
  { id: 'camera', name: 'Câmera' },
  { id: 'slide', name: 'Deslizar' },
  { id: 'wipe', name: 'Cortina' },
  { id: 'shape', name: 'Formas' },
  { id: 'fx', name: 'Efeitos' },
];

export const TRANSITIONS: TransitionDef[] = [
  { id: 'fade', name: 'Dissolver', cat: 'basic', sound: null, glsl: `
vec4 transition(vec2 uv){ return mix(getFrom(uv), getTo(uv), u_progress); }` },
  { id: 'fade-black', name: 'Preto', cat: 'basic', sound: null, glsl: `
vec4 transition(vec2 uv){ float p = u_progress; return p < 0.5 ? mix(getFrom(uv), vec4(0.0,0.0,0.0,1.0), p * 2.0) : mix(vec4(0.0,0.0,0.0,1.0), getTo(uv), (p - 0.5) * 2.0); }` },
  { id: 'fade-white', name: 'Branco', cat: 'basic', sound: 'shimmer', glsl: `
vec4 transition(vec2 uv){ float p = u_progress; return p < 0.5 ? mix(getFrom(uv), vec4(1.0), p * 2.0) : mix(vec4(1.0), getTo(uv), (p - 0.5) * 2.0); }` },
  { id: 'flash', name: 'Flash', cat: 'trend', sound: 'shutter', glsl: `
vec4 transition(vec2 uv){ float p = u_progress; float f = exp(-pow((p - 0.5) * 6.0, 2.0)); vec4 c = mix(getFrom(uv), getTo(uv), step(0.5, p)); return c + vec4(vec3(f), 0.0) * 1.5; }` },
  { id: 'dissolve-noise', name: 'Pó', cat: 'basic', sound: 'swish', glsl: `
vec4 transition(vec2 uv){ float n = noise(uv * u_res / 8.0); return mix(getFrom(uv), getTo(uv), smoothstep(n - 0.1, n + 0.1, u_progress * 1.2 - 0.1)); }` },
  { id: 'luma', name: 'Luminância', cat: 'basic', sound: null, glsl: `
vec4 transition(vec2 uv){ float l = luma(getTo(uv).rgb); return mix(getFrom(uv), getTo(uv), smoothstep(l - 0.15, l + 0.15, u_progress * 1.3 - 0.15)); }` },
  // camera moves
  { id: 'zoom-in', name: 'Zoom in', cat: 'camera', sound: 'whoosh', glsl: `
vec4 transition(vec2 uv){
  float p = u_progress;
  if (p < 0.5) { float s = 1.0 + p * 2.0 * 1.5; vec4 acc = vec4(0.0); for (int i = 0; i < 10; i++) { float k = s * (1.0 - float(i) * 0.015 * p * 4.0); acc += getFrom((uv - 0.5) / k + 0.5); } return acc / 10.0; }
  float s = 2.5 - (p - 0.5) * 2.0 * 1.5; vec4 acc = vec4(0.0); for (int i = 0; i < 10; i++) { float k = s * (1.0 + float(i) * 0.015 * (1.0 - p) * 4.0); acc += getTo((uv - 0.5) / k + 0.5); } return acc / 10.0;
}` },
  { id: 'zoom-out', name: 'Zoom out', cat: 'camera', sound: 'whoosh-low', glsl: `
vec4 transition(vec2 uv){
  float p = u_progress;
  if (p < 0.5) { float s = 1.0 - p * 2.0 * 0.6; return getFrom((uv - 0.5) / s + 0.5); }
  float s = 0.4 + (p - 0.5) * 2.0 * 0.6; return getTo((uv - 0.5) / max(s, 0.01) + 0.5);
}` },
  { id: 'cross-zoom', name: 'Zoom cruzado', cat: 'trend', sound: 'whoosh', glsl: `
vec4 transition(vec2 uv){
  float p = u_progress; float str = sin(p * 3.14159) * 0.4;
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 16; i++) { float k = float(i) / 16.0; vec2 q = mix(uv, vec2(0.5), k * str); acc += mix(getFrom(q), getTo(q), smoothstep(0.3, 0.7, p)); }
  return acc / 16.0;
}` },
  { id: 'spin', name: 'Giro', cat: 'camera', sound: 'swoosh', glsl: `
vec4 transition(vec2 uv){
  float p = u_progress; float a = (p < 0.5 ? p : p - 1.0) * 3.14159;
  float s = 1.0 + sin(p * 3.14159) * 0.8;
  vec2 r = uv - 0.5; r.x *= u_res.x / u_res.y;
  r = mat2(cos(a), -sin(a), sin(a), cos(a)) * r * s;
  r.x /= u_res.x / u_res.y; r += 0.5;
  r = 1.0 - abs(1.0 - mod(abs(r), 2.0));
  return p < 0.5 ? getFrom(r) : getTo(r);
}` },
  { id: 'whip-left', name: 'Chicote ←', cat: 'trend', sound: 'whoosh', glsl: `
vec4 transition(vec2 uv){
  float p = u_progress; float e = p * p * (3.0 - 2.0 * p);
  vec4 acc = vec4(0.0);
  float blur = sin(p * 3.14159) * 0.15;
  for (int i = 0; i < 14; i++) {
    float k = (float(i) / 13.0 - 0.5) * blur;
    vec2 q = uv + vec2(e + k, 0.0);
    acc += q.x < 1.0 ? getFrom(vec2(q.x, q.y)) : getTo(vec2(q.x - 1.0, q.y));
  }
  return acc / 14.0;
}` },
  { id: 'whip-up', name: 'Chicote ↑', cat: 'trend', sound: 'whoosh', glsl: `
vec4 transition(vec2 uv){
  float p = u_progress; float e = p * p * (3.0 - 2.0 * p);
  vec4 acc = vec4(0.0); float blur = sin(p * 3.14159) * 0.15;
  for (int i = 0; i < 14; i++) {
    float k = (float(i) / 13.0 - 0.5) * blur;
    vec2 q = uv - vec2(0.0, e + k);
    acc += q.y > 0.0 ? getFrom(q) : getTo(vec2(q.x, q.y + 1.0));
  }
  return acc / 14.0;
}` },
  { id: 'shake', name: 'Impacto', cat: 'trend', sound: 'impact', glsl: `
vec4 transition(vec2 uv){
  float p = u_progress; float s = sin(p * 3.14159);
  vec2 o = vec2(sin(p * 90.0), cos(p * 70.0)) * 0.03 * s;
  vec2 q = (uv - 0.5) / (1.0 + 0.1 * s) + 0.5 + o;
  return mix(getFrom(q), getTo(q), step(0.5, p)) + vec4(vec3(exp(-pow((p - 0.5) * 10.0, 2.0)) * 0.6), 0.0);
}` },
  { id: 'rotate-3d', name: 'Cubo', cat: 'camera', sound: 'swoosh', glsl: `
vec4 transition(vec2 uv){
  float p = u_progress;
  float persp = 0.7;
  if (uv.x < 1.0 - p) {
    float w = 1.0 - p; vec2 q = vec2(uv.x / w, (uv.y - 0.5) / (1.0 - p * persp * (uv.x / w) * 0.3) + 0.5);
    return getFrom(q) * (1.0 - p * 0.5);
  } else {
    float w = p; vec2 q = vec2((uv.x - (1.0 - p)) / w, (uv.y - 0.5) / (1.0 - (1.0 - p) * persp * (1.0 - (uv.x - 1.0 + p) / w) * 0.3) + 0.5);
    return getTo(q) * (0.5 + p * 0.5);
  }
}` },
  { id: 'flip', name: 'Virar', cat: 'camera', sound: 'flip', glsl: `
vec4 transition(vec2 uv){
  float p = u_progress; float a = p * 3.14159; float c = cos(a);
  float x = (uv.x - 0.5) / max(abs(c), 0.001) + 0.5;
  float persp = 1.0 + (uv.x - 0.5) * sin(a) * 0.4 * sign(c);
  vec2 q = vec2(x, (uv.y - 0.5) * persp + 0.5);
  if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) return vec4(0.0, 0.0, 0.0, 1.0);
  return c > 0.0 ? getFrom(q) : getTo(vec2(1.0 - q.x, q.y));
}` },
  // slides / push
  { id: 'slide-left', name: 'Deslizar ←', cat: 'slide', sound: 'swipe', glsl: `
vec4 transition(vec2 uv){ float e = u_progress * u_progress * (3.0 - 2.0 * u_progress); vec2 q = uv + vec2(1.0 - e, 0.0); return q.x < 1.0 ? getTo(q) : getFrom(uv); }` },
  { id: 'slide-right', name: 'Deslizar →', cat: 'slide', sound: 'swipe', glsl: `
vec4 transition(vec2 uv){ float e = u_progress * u_progress * (3.0 - 2.0 * u_progress); vec2 q = uv - vec2(1.0 - e, 0.0); return q.x > 0.0 ? getTo(q) : getFrom(uv); }` },
  { id: 'slide-up', name: 'Deslizar ↑', cat: 'slide', sound: 'swipe', glsl: `
vec4 transition(vec2 uv){ float e = u_progress * u_progress * (3.0 - 2.0 * u_progress); vec2 q = uv + vec2(0.0, 1.0 - e); return q.y < 1.0 ? getTo(q) : getFrom(uv); }` },
  { id: 'slide-down', name: 'Deslizar ↓', cat: 'slide', sound: 'swipe', glsl: `
vec4 transition(vec2 uv){ float e = u_progress * u_progress * (3.0 - 2.0 * u_progress); vec2 q = uv - vec2(0.0, 1.0 - e); return q.y > 0.0 ? getTo(q) : getFrom(uv); }` },
  { id: 'push-left', name: 'Empurrar ←', cat: 'slide', sound: 'swoosh', glsl: `
vec4 transition(vec2 uv){ float e = u_progress * u_progress * (3.0 - 2.0 * u_progress); vec2 q = uv + vec2(e, 0.0); return q.x < 1.0 ? getFrom(q) : getTo(q - vec2(1.0, 0.0)); }` },
  { id: 'push-right', name: 'Empurrar →', cat: 'slide', sound: 'swoosh', glsl: `
vec4 transition(vec2 uv){ float e = u_progress * u_progress * (3.0 - 2.0 * u_progress); vec2 q = uv - vec2(e, 0.0); return q.x > 0.0 ? getFrom(q) : getTo(q + vec2(1.0, 0.0)); }` },
  { id: 'push-up', name: 'Empurrar ↑', cat: 'slide', sound: 'swoosh', glsl: `
vec4 transition(vec2 uv){ float e = u_progress * u_progress * (3.0 - 2.0 * u_progress); vec2 q = uv - vec2(0.0, e); return q.y > 0.0 ? getFrom(q) : getTo(q + vec2(0.0, 1.0)); }` },
  { id: 'push-down', name: 'Empurrar ↓', cat: 'slide', sound: 'swoosh', glsl: `
vec4 transition(vec2 uv){ float e = u_progress * u_progress * (3.0 - 2.0 * u_progress); vec2 q = uv + vec2(0.0, e); return q.y < 1.0 ? getFrom(q) : getTo(q - vec2(0.0, 1.0)); }` },
  { id: 'squeeze', name: 'Espremer', cat: 'slide', sound: 'pop', glsl: `
vec4 transition(vec2 uv){ float p = u_progress; float w = 1.0 - p; if (uv.x < w) return getFrom(vec2(uv.x / max(w, 0.001), uv.y)); return getTo(vec2((uv.x - w) / max(p, 0.001), uv.y)); }` },
  // wipes
  { id: 'wipe-left', name: 'Cortina ←', cat: 'wipe', sound: 'swish', glsl: `
vec4 transition(vec2 uv){ return mix(getFrom(uv), getTo(uv), smoothstep(uv.x - 0.02, uv.x + 0.02, u_progress * 1.04 - 0.02)); }` },
  { id: 'wipe-right', name: 'Cortina →', cat: 'wipe', sound: 'swish', glsl: `
vec4 transition(vec2 uv){ float x = 1.0 - uv.x; return mix(getFrom(uv), getTo(uv), smoothstep(x - 0.02, x + 0.02, u_progress * 1.04 - 0.02)); }` },
  { id: 'wipe-up', name: 'Cortina ↑', cat: 'wipe', sound: 'swish', glsl: `
vec4 transition(vec2 uv){ return mix(getFrom(uv), getTo(uv), smoothstep(uv.y - 0.02, uv.y + 0.02, u_progress * 1.04 - 0.02)); }` },
  { id: 'wipe-diag', name: 'Diagonal', cat: 'wipe', sound: 'swish', glsl: `
vec4 transition(vec2 uv){ float d = (uv.x + uv.y) * 0.5; return mix(getFrom(uv), getTo(uv), smoothstep(d - 0.03, d + 0.03, u_progress * 1.06 - 0.03)); }` },
  { id: 'clock', name: 'Relógio', cat: 'wipe', sound: 'tick', glsl: `
vec4 transition(vec2 uv){ vec2 d = uv - 0.5; float a = (atan(d.x, d.y) + 3.14159) / 6.28318; return mix(getFrom(uv), getTo(uv), step(a, u_progress)); }` },
  { id: 'blinds', name: 'Persiana', cat: 'wipe', sound: 'swish', glsl: `
vec4 transition(vec2 uv){ float f = fract(uv.y * 10.0); return mix(getFrom(uv), getTo(uv), step(f, u_progress)); }` },
  { id: 'stripes', name: 'Listras', cat: 'wipe', sound: 'swipe', glsl: `
vec4 transition(vec2 uv){ float row = floor(uv.y * 8.0); float dir = mod(row, 2.0) * 2.0 - 1.0; float x = dir > 0.0 ? uv.x : 1.0 - uv.x; float p = clamp(u_progress * 1.6 - row / 8.0 * 0.6, 0.0, 1.0); return mix(getFrom(uv), getTo(uv), step(x, p)); }` },
  { id: 'split', name: 'Abrir portas', cat: 'wipe', sound: 'swoosh', glsl: `
vec4 transition(vec2 uv){ float d = abs(uv.x - 0.5) * 2.0; return mix(getFrom(uv), getTo(uv), step(d, u_progress)); }` },
  // shapes
  { id: 'circle-open', name: 'Círculo', cat: 'shape', sound: 'pop', glsl: `
vec4 transition(vec2 uv){ vec2 d = (uv - 0.5) * vec2(u_res.x / u_res.y, 1.0); float r = u_progress * length(vec2(u_res.x / u_res.y, 1.0)) * 0.55; return mix(getFrom(uv), getTo(uv), smoothstep(r + 0.01, r - 0.01, length(d))); }` },
  { id: 'circle-close', name: 'Íris', cat: 'shape', sound: 'pop', glsl: `
vec4 transition(vec2 uv){ vec2 d = (uv - 0.5) * vec2(u_res.x / u_res.y, 1.0); float m = length(vec2(u_res.x / u_res.y, 1.0)) * 0.55; float p = u_progress; if (p < 0.5) { float r = (1.0 - p * 2.0) * m; return getFrom(uv) * step(length(d), r); } float r = (p - 0.5) * 2.0 * m; return getTo(uv) * step(length(d), r); }` },
  { id: 'diamond', name: 'Diamante', cat: 'shape', sound: 'shimmer', glsl: `
vec4 transition(vec2 uv){ vec2 d = abs(uv - 0.5); return mix(getFrom(uv), getTo(uv), step(d.x + d.y, u_progress * 1.05)); }` },
  { id: 'heart', name: 'Coração', cat: 'shape', sound: 'pop', glsl: `
vec4 transition(vec2 uv){
  vec2 p = (uv - vec2(0.5, 0.45)) * vec2(u_res.x / u_res.y, 1.0) / max(u_progress * 1.6, 0.001);
  p.y = p.y - sqrt(abs(p.x)) * 0.5;
  float inside = step(length(p), 0.6);
  return mix(getFrom(uv), getTo(uv), inside);
}` },
  { id: 'squares', name: 'Quadrados', cat: 'shape', sound: 'glitch', glsl: `
vec4 transition(vec2 uv){ vec2 g = floor(uv * vec2(10.0, 10.0 * u_res.y / u_res.x)); float r = rand(g); return mix(getFrom(uv), getTo(uv), step(r, u_progress)); }` },
  { id: 'hexagons', name: 'Colmeia', cat: 'shape', sound: 'shimmer', glsl: `
vec4 transition(vec2 uv){ vec2 g = uv * vec2(12.0, 12.0 * u_res.y / u_res.x); g.x += mod(floor(g.y), 2.0) * 0.5; vec2 id = floor(g); float d = length(fract(g) - 0.5); float delay = length(id / vec2(12.0, 12.0 * u_res.y / u_res.x) - 0.5); float p = clamp(u_progress * 2.0 - delay, 0.0, 1.0); return mix(getFrom(uv), getTo(uv), step(d, p * 0.75)); }` },
  { id: 'star', name: 'Estrela', cat: 'shape', sound: 'shimmer', glsl: `
vec4 transition(vec2 uv){ vec2 d = (uv - 0.5) * vec2(u_res.x / u_res.y, 1.0); float a = atan(d.y, d.x); float r = length(d); float s = 0.5 + 0.25 * cos(a * 5.0); return mix(getFrom(uv), getTo(uv), step(r, s * u_progress * 1.7)); }` },
  // fx
  { id: 'glitch', name: 'Glitch', cat: 'fx', sound: 'glitch', glsl: `
vec4 transition(vec2 uv){
  float p = u_progress; float s = sin(p * 3.14159);
  float t = floor(p * 20.0);
  float band = floor(uv.y * 20.0);
  float shift = (rand(vec2(band, t)) - 0.5) * 0.3 * s * step(0.4, rand(vec2(t, band)));
  vec2 q = uv + vec2(shift, 0.0);
  vec4 a = mix(getFrom(q), getTo(q), step(0.5, p));
  a.r = mix(getFrom(q + vec2(0.02 * s, 0.0)), getTo(q + vec2(0.02 * s, 0.0)), step(0.5, p)).r;
  a.b = mix(getFrom(q - vec2(0.02 * s, 0.0)), getTo(q - vec2(0.02 * s, 0.0)), step(0.5, p)).b;
  return a;
}` },
  { id: 'rgb-split', name: 'RGB', cat: 'fx', sound: 'glitch', glsl: `
vec4 transition(vec2 uv){ float p = u_progress; float s = sin(p * 3.14159) * 0.06; vec4 a = mix(getFrom(uv), getTo(uv), smoothstep(0.35, 0.65, p)); a.r = mix(getFrom(uv + vec2(s, 0.0)), getTo(uv + vec2(s, 0.0)), smoothstep(0.35, 0.65, p)).r; a.b = mix(getFrom(uv - vec2(s, 0.0)), getTo(uv - vec2(s, 0.0)), smoothstep(0.35, 0.65, p)).b; return a; }` },
  { id: 'pixelize', name: 'Pixels', cat: 'fx', sound: 'digital', glsl: `
vec4 transition(vec2 uv){ float p = u_progress; float s = min(p, 1.0 - p) * 2.0; float cells = mix(400.0, 12.0, s); vec2 c = vec2(cells, cells * u_res.y / u_res.x); vec2 q = s > 0.01 ? (floor(uv * c) + 0.5) / c : uv; return mix(getFrom(q), getTo(q), step(0.5, p)); }` },
  { id: 'blur', name: 'Desfoque', cat: 'fx', sound: 'whoosh-soft', glsl: `
vec4 transition(vec2 uv){ float p = u_progress; float b = sin(p * 3.14159) * 0.03; vec4 acc = vec4(0.0); for (int i = 0; i < 16; i++) { float a = float(i) * 2.39996; float d = sqrt(float(i) / 16.0) * b; vec2 q = uv + vec2(cos(a), sin(a)) * d; acc += mix(getFrom(q), getTo(q), p); } return acc / 16.0; }` },
  { id: 'ripple', name: 'Água', cat: 'fx', sound: 'water', glsl: `
vec4 transition(vec2 uv){ float p = u_progress; vec2 d = uv - 0.5; float r = length(d); vec2 o = normalize(d + 1e-5) * sin(r * 50.0 - p * 30.0) * 0.03 * sin(p * 3.14159); return mix(getFrom(uv + o), getTo(uv + o), smoothstep(0.3, 0.7, p)); }` },
  { id: 'swirl', name: 'Espiral', cat: 'fx', sound: 'swoosh', glsl: `
vec4 transition(vec2 uv){ float p = u_progress; vec2 d = uv - 0.5; float r = length(d); float a = sin(p * 3.14159) * 8.0 * smoothstep(0.7, 0.0, r); d = mat2(cos(a), -sin(a), sin(a), cos(a)) * d; vec2 q = d + 0.5; return mix(getFrom(q), getTo(q), smoothstep(0.3, 0.7, p)); }` },
  { id: 'burn', name: 'Queimar', cat: 'fx', sound: 'fire', glsl: `
vec4 transition(vec2 uv){ float n = noise(uv * 6.0) * 0.7 + noise(uv * 18.0) * 0.3; float p = u_progress * 1.3 - 0.15; float e = smoothstep(p - 0.08, p, n) - smoothstep(p, p + 0.02, n); vec4 c = mix(getTo(uv), getFrom(uv), smoothstep(p - 0.02, p + 0.02, n)); return c + vec4(vec3(1.0, 0.5, 0.1) * e * 2.0, 0.0); }` },
  { id: 'light-leak', name: 'Luz', cat: 'trend', sound: 'shimmer', glsl: `
vec4 transition(vec2 uv){ float p = u_progress; float s = sin(p * 3.14159); vec3 leak = vec3(1.0, 0.55, 0.2) * exp(-distance(uv, vec2(p * 1.4 - 0.2, 0.6)) * 2.5) * s * 2.0; return mix(getFrom(uv), getTo(uv), smoothstep(0.3, 0.7, p)) + vec4(leak, 0.0); }` },
  { id: 'warp', name: 'Dobra', cat: 'fx', sound: 'riser', glsl: `
vec4 transition(vec2 uv){ float p = u_progress; vec2 d = uv - 0.5; float s = sin(p * 3.14159); vec2 q = 0.5 + d * (1.0 - s * 0.5 * length(d) * 2.0); return mix(getFrom(q), getTo(q), smoothstep(0.4, 0.6, p)); }` },
  { id: 'film-roll', name: 'Rolo de filme', cat: 'trend', sound: 'tape', glsl: `
vec4 transition(vec2 uv){ float p = u_progress; float e = p * p * (3.0 - 2.0 * p); float y = uv.y + e; float gap = 0.04; vec2 q = vec2(uv.x, fract(y)); float onTo = step(1.0, y); float band = step(fract(y), gap) + step(1.0 - gap, fract(y)); vec4 c = onTo > 0.5 ? getTo(q) : getFrom(q); float holes = step(0.5, fract(uv.y * 20.0 + e * 20.0)) * (step(uv.x, 0.04) + step(0.96, uv.x)) * sin(p * 3.14159); return mix(c, vec4(0.0, 0.0, 0.0, 1.0), clamp(band * sin(p * 3.14159) + holes, 0.0, 1.0)); }` },
  { id: 'tv-off', name: 'TV desligando', cat: 'fx', sound: 'tv', glsl: `
vec4 transition(vec2 uv){ float p = u_progress; if (p < 0.5) { float k = p * 2.0; float h = max(1.0 - k * 1.2, 0.005); float w = k < 0.8 ? 1.0 : max(1.0 - (k - 0.8) * 5.0, 0.0); vec2 q = vec2((uv.x - 0.5) / max(w, 0.001) + 0.5, (uv.y - 0.5) / h + 0.5); if (abs(uv.y - 0.5) > h * 0.5 || abs(uv.x - 0.5) > w * 0.5) return vec4(0.0, 0.0, 0.0, 1.0); return getFrom(q) + vec4(vec3(k), 0.0); } float k = (p - 0.5) * 2.0; return mix(vec4(0.0, 0.0, 0.0, 1.0), getTo(uv), k); }` },
];

export const TRANSITION_MAP = new Map(TRANSITIONS.map((t) => [t.id, t]));
export const TRENDING_TRANSITIONS = ['whip-left', 'cross-zoom', 'flash', 'shake', 'glitch', 'zoom-in', 'light-leak', 'whip-up', 'spin', 'film-roll'];
