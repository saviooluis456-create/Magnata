/**
 * Video effects library. Each effect is a GLSL body defining `vec4 effect(vec2 uv)`.
 * Available: u_tex (premultiplied layer), u_res (px), u_time (s), u_amt (0..1), tex(uv) with transparent borders.
 */
export interface EffectDef {
  id: string;
  name: string;
  cat: string;
  glsl: string;
  /** animated effects get a moving thumbnail badge */
  animated?: boolean;
}

export const EFFECT_CATEGORIES = [
  { id: 'trend', name: 'Em alta' },
  { id: 'glitch', name: 'Glitch' },
  { id: 'retro', name: 'Retrô' },
  { id: 'light', name: 'Luz' },
  { id: 'motion', name: 'Movimento' },
  { id: 'distort', name: 'Distorção' },
  { id: 'blur', name: 'Desfoque' },
  { id: 'art', name: 'Artístico' },
  { id: 'color', name: 'Cor' },
  { id: 'nature', name: 'Partículas' },
  { id: 'frame', name: 'Molduras' },
];

export const EFFECTS: EffectDef[] = [
  // ---------- GLITCH ----------
  { id: 'rgb-split', name: 'RGB Split', cat: 'glitch', animated: true, glsl: `
vec4 effect(vec2 uv){
  float o = u_amt * 0.02 * (0.6 + 0.4 * sin(u_time * 6.0));
  vec4 r = tex(uv + vec2(o, 0.0)); vec4 g = tex(uv); vec4 b = tex(uv - vec2(o, 0.0));
  return vec4(r.r, g.g, b.b, max(max(r.a, g.a), b.a));
}` },
  { id: 'glitch', name: 'Glitch digital', cat: 'glitch', animated: true, glsl: `
vec4 effect(vec2 uv){
  float t = floor(u_time * 12.0);
  float band = floor(uv.y * 24.0);
  float r = rand(vec2(band, t));
  float shift = step(1.0 - 0.35 * u_amt, r) * (rand(vec2(t, band + 3.0)) - 0.5) * 0.25 * u_amt;
  vec2 p = uv + vec2(shift, 0.0);
  float ca = 0.012 * u_amt * step(0.5, rand(vec2(t, 9.0)));
  vec4 c = tex(p);
  c.r = tex(p + vec2(ca, 0.0)).r; c.b = tex(p - vec2(ca, 0.0)).b;
  float blk = step(0.97, rand(floor(uv * vec2(18.0, 30.0)) + t)) * u_amt;
  c.rgb = mix(c.rgb, vec3(rand(uv + t), rand(uv - t), rand(uv * t)) * c.a, blk * 0.8);
  return c;
}` },
  { id: 'chromatic', name: 'Aberração', cat: 'glitch', glsl: `
vec4 effect(vec2 uv){
  vec2 d = (uv - 0.5) * u_amt * 0.04;
  vec4 c = tex(uv);
  return vec4(tex(uv + d).r, c.g, tex(uv - d).b, c.a);
}` },
  { id: 'datamosh', name: 'Datamosh', cat: 'glitch', animated: true, glsl: `
vec4 effect(vec2 uv){
  float t = floor(u_time * 8.0);
  vec2 cell = floor(uv * 16.0);
  float r = rand(cell + t);
  vec2 off = (vec2(rand(cell + t + 1.0), rand(cell + t + 2.0)) - 0.5) * 0.08 * u_amt * step(0.75, r);
  vec2 q = mix(uv, (cell + 0.5) / 16.0, 0.6 * u_amt * step(0.9, r));
  return tex(q + off);
}` },
  { id: 'scan-glitch', name: 'Interferência', cat: 'glitch', animated: true, glsl: `
vec4 effect(vec2 uv){
  float y = uv.y + u_time * 0.4;
  float w = sin(y * 40.0) * sin(y * 7.0 + u_time * 3.0);
  vec2 p = uv + vec2(w * 0.01 * u_amt, 0.0);
  vec4 c = tex(p);
  float line = step(0.995 - 0.01 * u_amt, fract(sin(floor(uv.y * 200.0 + u_time * 30.0)) * 999.0));
  c.rgb += line * 0.4 * u_amt * c.a;
  return c;
}` },
  { id: 'pixel-sort', name: 'Pixel Sort', cat: 'glitch', glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  float l = luma(c.rgb);
  float th = 1.0 - u_amt * 0.8;
  float smear = smoothstep(th, 1.0, l) * 0.15 * u_amt;
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 8; i++) { acc += tex(uv + vec2(0.0, float(i) / 8.0 * smear)); }
  return mix(c, acc / 8.0, step(th, l));
}` },
  { id: 'shake', name: 'Tremor', cat: 'motion', animated: true, glsl: `
vec4 effect(vec2 uv){
  float t = u_time * 18.0;
  vec2 o = vec2(noise(vec2(t, 0.0)) - 0.5, noise(vec2(0.0, t)) - 0.5) * 0.06 * u_amt;
  vec2 p = (uv - 0.5) / (1.0 + 0.06 * u_amt) + 0.5 + o;
  return texture2D(u_tex, p);
}` },
  { id: 'earthquake', name: 'Terremoto', cat: 'motion', animated: true, glsl: `
vec4 effect(vec2 uv){
  float t = floor(u_time * 24.0);
  vec2 o = (vec2(rand(vec2(t, 1.0)), rand(vec2(t, 2.0))) - 0.5) * 0.08 * u_amt;
  float rot = (rand(vec2(t, 3.0)) - 0.5) * 0.08 * u_amt;
  vec2 p = uv - 0.5; p = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * p;
  p = p / (1.0 + 0.1 * u_amt) + 0.5 + o;
  return texture2D(u_tex, p);
}` },
  { id: 'zoom-pulse', name: 'Zoom batida', cat: 'trend', animated: true, glsl: `
vec4 effect(vec2 uv){
  float k = fract(u_time * 2.0);
  float s = 1.0 + 0.12 * u_amt * exp(-k * 6.0);
  return texture2D(u_tex, (uv - 0.5) / s + 0.5);
}` },
  { id: 'slow-zoom', name: 'Zoom lento', cat: 'motion', glsl: `
vec4 effect(vec2 uv){
  float s = 1.0 + 0.25 * u_amt * min(u_time / 6.0, 1.0);
  return texture2D(u_tex, (uv - 0.5) / s + 0.5);
}` },
  { id: 'spin', name: 'Rodopio', cat: 'motion', animated: true, glsl: `
vec4 effect(vec2 uv){
  float a = u_time * 1.5 * u_amt;
  vec2 p = uv - 0.5; p.x *= u_res.x / u_res.y;
  p = mat2(cos(a), -sin(a), sin(a), cos(a)) * p;
  p.x /= u_res.x / u_res.y;
  return tex(p / (1.0 + 0.3 * u_amt) + 0.5);
}` },
  { id: 'strobe', name: 'Estroboscópio', cat: 'trend', animated: true, glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  float on = step(0.5, fract(u_time * 8.0));
  c.rgb = mix(c.rgb, vec3(c.a), on * u_amt * 0.85);
  return c;
}` },
  { id: 'flash', name: 'Flash', cat: 'light', animated: true, glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  float k = fract(u_time * 1.0);
  float f = exp(-k * 8.0) * u_amt;
  c.rgb = c.rgb + f * c.a;
  return c;
}` },
  { id: 'heartbeat', name: 'Batimento', cat: 'trend', animated: true, glsl: `
vec4 effect(vec2 uv){
  float k = fract(u_time * 1.2);
  float b = exp(-pow((k - 0.1) * 18.0, 2.0)) + 0.7 * exp(-pow((k - 0.32) * 18.0, 2.0));
  float s = 1.0 + 0.08 * u_amt * b;
  vec4 c = texture2D(u_tex, (uv - 0.5) / s + 0.5);
  c.r += 0.15 * b * u_amt * c.a;
  return c;
}` },
  { id: 'jitter-zoom', name: 'Zoom tremido', cat: 'trend', animated: true, glsl: `
vec4 effect(vec2 uv){
  float t = floor(u_time * 10.0);
  float s = 1.0 + 0.15 * u_amt * step(0.5, rand(vec2(t, 4.0)));
  return texture2D(u_tex, (uv - 0.5) / s + 0.5);
}` },
  // ---------- RETRO ----------
  { id: 'vhs', name: 'VHS', cat: 'retro', animated: true, glsl: `
vec4 effect(vec2 uv){
  float t = u_time;
  float jitter = (noise(vec2(uv.y * 80.0, t * 10.0)) - 0.5) * 0.006 * u_amt;
  vec2 p = uv + vec2(jitter, 0.0);
  vec4 c = tex(p);
  c.r = tex(p + vec2(0.004 * u_amt, 0.0)).r;
  c.b = tex(p - vec2(0.004 * u_amt, 0.0)).b;
  float scan = sin(uv.y * u_res.y * 1.2) * 0.04 * u_amt;
  c.rgb -= scan * c.a;
  float tr = smoothstep(0.0, 0.02, abs(fract(uv.y - t * 0.15) - 0.5));
  c.rgb = mix(c.rgb + vec3(0.12) * c.a, c.rgb, mix(1.0, tr, u_amt));
  c.rgb += (rand(uv + t) - 0.5) * 0.08 * u_amt * c.a;
  c.rgb = mix(c.rgb, c.rgb * vec3(1.05, 0.97, 1.08), u_amt);
  return c;
}` },
  { id: 'old-film', name: 'Filme antigo', cat: 'retro', animated: true, glsl: `
vec4 effect(vec2 uv){
  float t = floor(u_time * 18.0);
  vec2 p = uv + vec2(0.0, (rand(vec2(t, 1.0)) - 0.5) * 0.004 * u_amt);
  vec4 c = tex(p);
  float g = luma(c.rgb / max(c.a, 0.001));
  vec3 sep = vec3(g * 1.07, g * 0.93, g * 0.72);
  vec3 col = mix(c.rgb / max(c.a, 0.001), sep, u_amt);
  col += (rand(uv * 3.0 + t) - 0.5) * 0.15 * u_amt;
  float scratch = step(0.998, rand(vec2(floor(uv.x * 300.0), t))) * u_amt;
  col = mix(col, vec3(0.9), scratch * 0.6);
  vec2 v = uv - 0.5; col *= 1.0 - dot(v, v) * 1.6 * u_amt;
  col *= 1.0 - 0.08 * u_amt * rand(vec2(t, 7.0));
  return vec4(col * c.a, c.a);
}` },
  { id: 'crt', name: 'TV CRT', cat: 'retro', glsl: `
vec4 effect(vec2 uv){
  vec2 p = uv * 2.0 - 1.0;
  p *= 1.0 + dot(p.yx, p.yx) * 0.08 * u_amt;
  p = p * 0.5 + 0.5;
  vec4 c = tex(p);
  float m = mod(gl_FragCoord.x, 3.0);
  vec3 mask = vec3(m < 1.0 ? 1.2 : 0.85, (m >= 1.0 && m < 2.0) ? 1.2 : 0.85, m >= 2.0 ? 1.2 : 0.85);
  c.rgb *= mix(vec3(1.0), mask, u_amt);
  c.rgb *= 1.0 - 0.25 * u_amt * (0.5 + 0.5 * sin(uv.y * u_res.y * 3.14159));
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) c = vec4(0.0, 0.0, 0.0, 1.0);
  return c;
}` },
  { id: 'bits', name: '8-bit', cat: 'retro', glsl: `
vec4 effect(vec2 uv){
  float px = mix(1.0, 160.0, 1.0 - u_amt * 0.9);
  vec2 cells = vec2(px, px * u_res.y / u_res.x);
  vec2 p = (floor(uv * cells) + 0.5) / cells;
  vec4 c = texture2D(u_tex, p);
  float lv = 6.0;
  c.rgb = floor(c.rgb * lv + 0.5) / lv;
  return c;
}` },
  { id: 'scanlines', name: 'Linhas', cat: 'retro', glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  c.rgb *= 1.0 - u_amt * 0.5 * step(0.5, fract(uv.y * u_res.y / 4.0));
  return c;
}` },
  { id: 'camcorder', name: 'Filmadora', cat: 'retro', animated: true, glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  vec3 col = c.rgb / max(c.a, 0.001);
  col = mix(col, col * vec3(1.08, 1.0, 0.86) + 0.04, u_amt);
  col += (rand(uv + fract(u_time)) - 0.5) * 0.06 * u_amt;
  vec2 v = uv - 0.5; col *= 1.0 - dot(v, v) * u_amt;
  float rec = step(length((uv - vec2(0.1, 0.92)) * vec2(u_res.x / u_res.y, 1.0)), 0.018) * step(0.5, fract(u_time));
  col = mix(col, vec3(1.0, 0.1, 0.1), rec * u_amt);
  return vec4(col * c.a, c.a);
}` },
  { id: 'polaroid', name: 'Polaroid', cat: 'retro', glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  vec3 col = c.rgb / max(c.a, 0.001);
  vec3 p = vec3(col.r * 1.05 + 0.04, col.g * 1.0 + 0.02, col.b * 0.85 + 0.08);
  p = mix(vec3(luma(p)), p, 0.8);
  col = mix(col, p, u_amt);
  return vec4(col * c.a, c.a);
}` },
  // ---------- LIGHT ----------
  { id: 'glow', name: 'Brilho suave', cat: 'light', glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  vec4 acc = vec4(0.0);
  vec2 px = 1.0 / u_res * 6.0;
  for (int x = -2; x <= 2; x++) for (int y = -2; y <= 2; y++) {
    vec4 s = tex(uv + vec2(float(x), float(y)) * px);
    acc += s * smoothstep(0.5, 1.0, luma(s.rgb));
  }
  return c + acc / 25.0 * 2.0 * u_amt;
}` },
  { id: 'bloom', name: 'Bloom', cat: 'light', glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 12; i++) {
    float a = float(i) * 0.5236;
    for (int r = 1; r <= 3; r++) {
      vec4 s = tex(uv + vec2(cos(a), sin(a)) * float(r) * 0.008);
      acc += s * smoothstep(0.6, 1.0, luma(s.rgb));
    }
  }
  return c + acc / 36.0 * 3.0 * u_amt;
}` },
  { id: 'light-leak', name: 'Vazamento de luz', cat: 'light', animated: true, glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  float t = u_time * 0.3;
  vec2 p1 = vec2(0.2 + 0.3 * sin(t), 0.8 + 0.2 * cos(t * 1.3));
  vec2 p2 = vec2(0.9 + 0.1 * cos(t * 0.7), 0.3 + 0.3 * sin(t * 0.9));
  float a = exp(-distance(uv, p1) * 3.0); float b = exp(-distance(uv, p2) * 4.0);
  vec3 leak = vec3(1.0, 0.45, 0.15) * a + vec3(1.0, 0.2, 0.5) * b;
  c.rgb = c.rgb + leak * u_amt * c.a * 0.9;
  return c;
}` },
  { id: 'film-burn', name: 'Queima de filme', cat: 'light', animated: true, glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  float n = noise(uv * 3.0 + u_time * 0.6) * noise(uv * 7.0 - u_time * 0.3);
  float e = smoothstep(0.15, 0.6, n + (uv.x - 0.5) * 0.4 * sin(u_time));
  vec3 burn = mix(vec3(1.0, 0.9, 0.6), vec3(1.0, 0.3, 0.0), e);
  c.rgb = c.rgb + burn * e * u_amt * c.a;
  return c;
}` },
  { id: 'lens-flare', name: 'Lens flare', cat: 'light', animated: true, glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  vec2 asp = vec2(u_res.x / u_res.y, 1.0);
  vec2 lp = vec2(0.25 + 0.1 * sin(u_time * 0.5), 0.8);
  vec2 d = (uv - lp) * asp;
  float f = 0.02 / (length(d) + 0.02);
  float streak = 0.002 / (abs(d.y) + 0.004) * smoothstep(0.6, 0.0, abs(d.x));
  vec3 fl = vec3(1.0, 0.85, 0.6) * (f + streak * 0.4);
  for (int i = 1; i < 4; i++) {
    vec2 gp = mix(lp, vec2(1.0) - lp, float(i) * 0.3);
    fl += vec3(0.4, 0.6, 1.0) * 0.08 / (length((uv - gp) * asp) * 10.0 + 0.3);
  }
  c.rgb += fl * u_amt * c.a;
  return c;
}` },
  { id: 'rainbow', name: 'Arco-íris', cat: 'light', animated: true, glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  vec3 rb = hsv2rgb(vec3(fract(uv.x * 0.6 + uv.y * 0.4 + u_time * 0.2), 0.7, 1.0));
  c.rgb = mix(c.rgb, c.rgb * 0.5 + rb * 0.5 * c.a, u_amt * 0.6);
  return c;
}` },
  { id: 'neon-edge', name: 'Neon', cat: 'light', animated: true, glsl: `
vec4 effect(vec2 uv){
  vec2 px = 1.0 / u_res * 1.5;
  float gx = luma(tex(uv + vec2(px.x, 0.0)).rgb) - luma(tex(uv - vec2(px.x, 0.0)).rgb);
  float gy = luma(tex(uv + vec2(0.0, px.y)).rgb) - luma(tex(uv - vec2(0.0, px.y)).rgb);
  float e = clamp(length(vec2(gx, gy)) * 4.0, 0.0, 1.0);
  vec3 col = hsv2rgb(vec3(fract(uv.y + u_time * 0.25), 1.0, 1.0)) * e;
  vec4 c = tex(uv);
  return vec4(mix(c.rgb, col * 1.5 + c.rgb * 0.15, u_amt), c.a);
}` },
  { id: 'sparkle', name: 'Brilhos', cat: 'nature', animated: true, glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  vec2 asp = vec2(u_res.x / u_res.y, 1.0);
  vec2 g = uv * asp * 14.0;
  vec2 id = floor(g); vec2 f = fract(g) - 0.5;
  float r = rand(id);
  float tw = 0.5 + 0.5 * sin(u_time * (3.0 + r * 5.0) + r * 20.0);
  vec2 o = (vec2(rand(id + 1.0), rand(id + 2.0)) - 0.5) * 0.6;
  float d = length(f - o);
  float star = (0.004 / (d * d + 0.004)) * step(0.82, r) * tw;
  float cross = (0.0015 / (abs((f - o).x * (f - o).y) + 0.002)) * step(0.82, r) * tw * smoothstep(0.3, 0.0, d);
  c.rgb += vec3(1.0, 0.95, 0.8) * (star + cross * 0.2) * u_amt;
  c.a = max(c.a, clamp((star) * u_amt, 0.0, 1.0));
  return c;
}` },
  // ---------- NATURE / PARTICLES ----------
  { id: 'snow', name: 'Neve', cat: 'nature', animated: true, glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  float s = 0.0;
  vec2 asp = vec2(u_res.x / u_res.y, 1.0);
  for (int l = 0; l < 3; l++) {
    float fl = float(l);
    float sc = 8.0 + fl * 6.0;
    vec2 p = uv * asp * sc + vec2(sin(u_time * 0.5 + fl) * 0.5, u_time * (1.0 + fl * 0.5));
    vec2 id = floor(p); vec2 f = fract(p) - 0.5;
    vec2 o = (vec2(rand(id), rand(id + 7.0)) - 0.5) * 0.7;
    s += smoothstep(0.08 - fl * 0.015, 0.0, length(f - o)) * step(0.4, rand(id + 3.0));
  }
  s = clamp(s * u_amt, 0.0, 1.0);
  return vec4(mix(c.rgb, vec3(1.0), s), max(c.a, s));
}` },
  { id: 'rain', name: 'Chuva', cat: 'nature', animated: true, glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  vec2 p = uv * vec2(80.0, 3.0) + vec2(uv.y * 6.0, u_time * 8.0);
  vec2 id = floor(p);
  float r = rand(vec2(id.x, 0.0));
  float y = fract(p.y + r * 10.0);
  float drop = smoothstep(0.0, 0.05, y) * smoothstep(0.35, 0.05, y) * step(0.6, r) * smoothstep(0.5, 0.0, abs(fract(p.x) - 0.5) * 2.0);
  vec3 col = c.rgb * (1.0 - 0.2 * u_amt) + vec3(0.7, 0.8, 0.9) * drop * 0.5 * u_amt;
  return vec4(col, max(c.a, drop * 0.5 * u_amt));
}` },
  { id: 'stars', name: 'Estrelas', cat: 'nature', animated: true, glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  vec2 asp = vec2(u_res.x / u_res.y, 1.0);
  vec2 g = uv * asp * 40.0;
  vec2 id = floor(g); vec2 f = fract(g) - 0.5;
  float r = rand(id);
  float s = smoothstep(0.12, 0.0, length(f)) * step(0.9, r) * (0.5 + 0.5 * sin(u_time * 4.0 + r * 30.0));
  return vec4(c.rgb + vec3(s) * u_amt, max(c.a, s * u_amt));
}` },
  { id: 'hearts', name: 'Corações', cat: 'nature', animated: true, glsl: `
float heart(vec2 p){ p.y = -p.y + 0.25; p *= 1.3; float a = atan(p.x, p.y) / 3.14159; float r = length(p);
  float h = abs(a); float d = (13.0 * h - 22.0 * h * h + 10.0 * h * h * h) / (6.0 - 5.0 * h); return smoothstep(0.02, -0.02, r - d * 0.35); }
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  vec2 asp = vec2(u_res.x / u_res.y, 1.0);
  vec2 p = uv * asp * 6.0 + vec2(0.0, -u_time * 0.6);
  vec2 id = floor(p); vec2 f = fract(p) - 0.5;
  float r = rand(id);
  float h = heart(f + vec2(sin(u_time + r * 6.0) * 0.15, 0.0)) * step(0.6, r);
  vec3 col = mix(c.rgb, vec3(1.0, 0.25, 0.45), h * u_amt);
  return vec4(col, max(c.a, h * u_amt));
}` },
  { id: 'confetti', name: 'Confete', cat: 'nature', animated: true, glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  vec2 asp = vec2(u_res.x / u_res.y, 1.0);
  vec2 p = uv * asp * 12.0 + vec2(sin(u_time) * 0.3, u_time * 1.4);
  vec2 id = floor(p); vec2 f = fract(p) - 0.5;
  float r = rand(id);
  float a = u_time * 3.0 + r * 10.0;
  vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * (f - (vec2(rand(id + 1.0), rand(id + 2.0)) - 0.5) * 0.5);
  float m = step(abs(q.x), 0.12) * step(abs(q.y), 0.05) * step(0.55, r);
  vec3 col = hsv2rgb(vec3(r * 7.0, 0.8, 1.0));
  return vec4(mix(c.rgb, col, m * u_amt), max(c.a, m * u_amt));
}` },
  { id: 'bokeh', name: 'Bokeh', cat: 'nature', animated: true, glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  vec2 asp = vec2(u_res.x / u_res.y, 1.0);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 14; i++) {
    float fi = float(i);
    vec2 pos = vec2(rand(vec2(fi, 1.0)), fract(rand(vec2(fi, 2.0)) + u_time * 0.03 * (1.0 + rand(vec2(fi, 3.0)))));
    float rad = 0.04 + 0.06 * rand(vec2(fi, 4.0));
    float d = length((uv - pos) * asp);
    acc += hsv2rgb(vec3(0.08 + 0.1 * rand(vec2(fi, 5.0)), 0.6, 1.0)) * smoothstep(rad, rad * 0.85, d) * 0.25;
  }
  return vec4(c.rgb + acc * u_amt, max(c.a, length(acc) * u_amt));
}` },
  { id: 'fire', name: 'Fogo', cat: 'nature', animated: true, glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  float n = noise(vec2(uv.x * 8.0, uv.y * 4.0 - u_time * 3.0)) * noise(vec2(uv.x * 16.0, uv.y * 8.0 - u_time * 5.0));
  float f = smoothstep(0.35, 0.0, uv.y) * n * 2.5;
  vec3 col = mix(vec3(1.0, 0.2, 0.0), vec3(1.0, 0.9, 0.3), f);
  f = clamp(f * u_amt, 0.0, 1.0);
  return vec4(c.rgb + col * f, max(c.a, f));
}` },
  { id: 'smoke', name: 'Fumaça', cat: 'nature', animated: true, glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  float n = noise(uv * 3.0 + vec2(u_time * 0.2, u_time * 0.1)) * 0.6 + noise(uv * 7.0 - u_time * 0.15) * 0.4;
  float s = smoothstep(0.4, 0.9, n) * u_amt * 0.8;
  return vec4(mix(c.rgb, vec3(0.85) * max(c.a, s), s), max(c.a, s));
}` },
  // ---------- DISTORT ----------
  { id: 'wave', name: 'Onda', cat: 'distort', animated: true, glsl: `
vec4 effect(vec2 uv){
  vec2 p = uv + vec2(sin(uv.y * 12.0 + u_time * 3.0), cos(uv.x * 10.0 + u_time * 2.0)) * 0.012 * u_amt;
  return tex(p);
}` },
  { id: 'ripple', name: 'Ondulação', cat: 'distort', animated: true, glsl: `
vec4 effect(vec2 uv){
  vec2 d = uv - 0.5; d.x *= u_res.x / u_res.y;
  float r = length(d);
  vec2 p = uv + normalize(d + 1e-5) * sin(r * 40.0 - u_time * 6.0) * 0.01 * u_amt;
  return tex(p);
}` },
  { id: 'swirl', name: 'Redemoinho', cat: 'distort', glsl: `
vec4 effect(vec2 uv){
  vec2 p = uv - 0.5; p.x *= u_res.x / u_res.y;
  float r = length(p);
  float a = u_amt * 4.0 * smoothstep(0.6, 0.0, r);
  p = mat2(cos(a), -sin(a), sin(a), cos(a)) * p;
  p.x /= u_res.x / u_res.y;
  return tex(p + 0.5);
}` },
  { id: 'fisheye', name: 'Olho de peixe', cat: 'distort', glsl: `
vec4 effect(vec2 uv){
  vec2 p = uv * 2.0 - 1.0;
  float r = length(p);
  float k = 1.0 + u_amt * 0.8;
  vec2 q = p * pow(r, k - 1.0) / pow(1.41, k - 1.0) * 1.0;
  q = mix(p, q, u_amt);
  return tex(q * 0.5 + 0.5);
}` },
  { id: 'bulge', name: 'Lupa', cat: 'distort', glsl: `
vec4 effect(vec2 uv){
  vec2 p = uv - 0.5; p.x *= u_res.x / u_res.y;
  float r = length(p);
  float f = smoothstep(0.0, 0.5, r);
  p *= mix(1.0 - u_amt * 0.6, 1.0, f);
  p.x /= u_res.x / u_res.y;
  return tex(p + 0.5);
}` },
  { id: 'kaleido', name: 'Caleidoscópio', cat: 'distort', animated: true, glsl: `
vec4 effect(vec2 uv){
  vec2 p = uv - 0.5; p.x *= u_res.x / u_res.y;
  float seg = floor(mix(3.0, 10.0, u_amt));
  float a = atan(p.y, p.x) + u_time * 0.2; float r = length(p);
  float sa = 6.28318 / seg;
  a = mod(a, sa); a = abs(a - sa * 0.5);
  vec2 q = vec2(cos(a), sin(a)) * r;
  q.x /= u_res.x / u_res.y;
  return texture2D(u_tex, abs(fract(q + 0.5)));
}` },
  { id: 'mirror-h', name: 'Espelho ↔', cat: 'distort', glsl: `
vec4 effect(vec2 uv){ vec2 p = uv; if (p.x > 0.5) p.x = 1.0 - p.x; return mix(tex(uv), tex(p), u_amt > 0.01 ? 1.0 : 0.0); }` },
  { id: 'mirror-v', name: 'Espelho ↕', cat: 'distort', glsl: `
vec4 effect(vec2 uv){ vec2 p = uv; if (p.y < 0.5) p.y = 1.0 - p.y; return mix(tex(uv), tex(p), u_amt > 0.01 ? 1.0 : 0.0); }` },
  { id: 'split4', name: 'Tela 4x', cat: 'trend', glsl: `
vec4 effect(vec2 uv){ return texture2D(u_tex, fract(uv * 2.0)); }` },
  { id: 'split9', name: 'Tela 9x', cat: 'distort', glsl: `
vec4 effect(vec2 uv){ return texture2D(u_tex, fract(uv * 3.0)); }` },
  { id: 'split3', name: 'Tela tripla', cat: 'trend', glsl: `
vec4 effect(vec2 uv){ vec2 p = vec2(uv.x, fract(uv.y * 3.0)); p.y = 0.33 + p.y * 0.34; return texture2D(u_tex, p); }` },
  { id: 'pinch', name: 'Pinça', cat: 'distort', glsl: `
vec4 effect(vec2 uv){
  vec2 p = uv - 0.5; float r = length(p);
  p *= mix(1.0, pow(r * 2.0, 0.5 * u_amt) , smoothstep(0.5, 0.0, r));
  return tex(p + 0.5);
}` },
  { id: 'liquid', name: 'Líquido', cat: 'distort', animated: true, glsl: `
vec4 effect(vec2 uv){
  vec2 o = vec2(noise(uv * 4.0 + u_time), noise(uv * 4.0 - u_time + 3.0)) - 0.5;
  return tex(uv + o * 0.05 * u_amt);
}` },
  { id: 'twist', name: 'Torção', cat: 'distort', animated: true, glsl: `
vec4 effect(vec2 uv){
  vec2 p = uv - 0.5;
  float a = sin(u_time * 2.0) * u_amt * 2.0 * (0.5 - length(p));
  p = mat2(cos(a), -sin(a), sin(a), cos(a)) * p;
  return tex(p + 0.5);
}` },
  // ---------- BLUR ----------
  { id: 'blur', name: 'Desfoque', cat: 'blur', glsl: `
vec4 effect(vec2 uv){
  vec4 acc = vec4(0.0); float w = 0.0;
  float r = u_amt * 0.02;
  for (int i = 0; i < 16; i++) {
    float a = float(i) * 2.39996; float d = sqrt(float(i) / 16.0) * r;
    acc += texture2D(u_tex, uv + vec2(cos(a), sin(a) * u_res.x / u_res.y) * d); w += 1.0;
  }
  return acc / w;
}` },
  { id: 'zoom-blur', name: 'Desfoque radial', cat: 'blur', glsl: `
vec4 effect(vec2 uv){
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 16; i++) { float s = 1.0 - float(i) / 16.0 * 0.15 * u_amt; acc += texture2D(u_tex, (uv - 0.5) * s + 0.5); }
  return acc / 16.0;
}` },
  { id: 'motion-blur', name: 'Desfoque de movimento', cat: 'blur', glsl: `
vec4 effect(vec2 uv){
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 16; i++) acc += texture2D(u_tex, uv + vec2((float(i) / 15.0 - 0.5) * 0.06 * u_amt, 0.0));
  return acc / 16.0;
}` },
  { id: 'tilt-shift', name: 'Miniatura', cat: 'blur', glsl: `
vec4 effect(vec2 uv){
  float f = smoothstep(0.08, 0.4, abs(uv.y - 0.5)) * u_amt;
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 12; i++) { float a = float(i) * 2.39996; float d = sqrt(float(i) / 12.0) * 0.012 * f; acc += texture2D(u_tex, uv + vec2(cos(a), sin(a)) * d); }
  vec4 c = acc / 12.0;
  vec3 col = mix(vec3(luma(c.rgb)), c.rgb, 1.0 + 0.4 * u_amt);
  return vec4(col, c.a);
}` },
  { id: 'dream', name: 'Sonho', cat: 'blur', glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 12; i++) { float a = float(i) * 0.5236; acc += tex(uv + vec2(cos(a), sin(a)) * 0.012); }
  acc /= 12.0;
  vec3 col = max(c.rgb, acc.rgb * 1.1);
  col = mix(c.rgb, col + 0.05, u_amt);
  return vec4(col, c.a);
}` },
  // ---------- ART ----------
  { id: 'pixelate', name: 'Pixelado', cat: 'art', glsl: `
vec4 effect(vec2 uv){
  float s = mix(400.0, 20.0, u_amt);
  vec2 cells = vec2(s, s * u_res.y / u_res.x);
  return texture2D(u_tex, (floor(uv * cells) + 0.5) / cells);
}` },
  { id: 'halftone', name: 'Retícula', cat: 'art', glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  float s = mix(180.0, 50.0, u_amt);
  vec2 g = uv * vec2(s, s * u_res.y / u_res.x);
  vec2 f = fract(g) - 0.5;
  float l = luma(c.rgb / max(c.a, 0.001));
  float dot_ = smoothstep(0.05, -0.05, length(f) - (1.0 - l) * 0.6);
  vec3 col = mix(vec3(1.0), vec3(0.05), dot_);
  return vec4(mix(c.rgb, col * c.a, u_amt), c.a);
}` },
  { id: 'sketch', name: 'Esboço', cat: 'art', glsl: `
vec4 effect(vec2 uv){
  vec2 px = 1.0 / u_res;
  float gx = luma(tex(uv + vec2(px.x, 0.0)).rgb) - luma(tex(uv - vec2(px.x, 0.0)).rgb);
  float gy = luma(tex(uv + vec2(0.0, px.y)).rgb) - luma(tex(uv - vec2(0.0, px.y)).rgb);
  float e = 1.0 - clamp(length(vec2(gx, gy)) * 5.0, 0.0, 1.0);
  vec4 c = tex(uv);
  return vec4(mix(c.rgb, vec3(e) * c.a, u_amt), c.a);
}` },
  { id: 'comic', name: 'Quadrinhos', cat: 'art', glsl: `
vec4 effect(vec2 uv){
  vec2 px = 1.0 / u_res * 1.5;
  float gx = luma(tex(uv + vec2(px.x, 0.0)).rgb) - luma(tex(uv - vec2(px.x, 0.0)).rgb);
  float gy = luma(tex(uv + vec2(0.0, px.y)).rgb) - luma(tex(uv - vec2(0.0, px.y)).rgb);
  float e = step(0.12, length(vec2(gx, gy)));
  vec4 c = tex(uv);
  vec3 col = floor(c.rgb * 4.0 + 0.5) / 4.0;
  col = mix(vec3(luma(col)), col, 1.4);
  col = mix(col, vec3(0.0), e);
  return vec4(mix(c.rgb, col * c.a, u_amt), c.a);
}` },
  { id: 'oil', name: 'Pintura a óleo', cat: 'art', glsl: `
vec4 effect(vec2 uv){
  vec2 px = 1.0 / u_res * (1.0 + 3.0 * u_amt);
  vec3 m0 = vec3(0.0), m1 = vec3(0.0); vec3 s0 = vec3(0.0), s1 = vec3(0.0);
  for (int x = -2; x <= 0; x++) for (int y = -2; y <= 2; y++) { vec3 c = tex(uv + vec2(float(x), float(y)) * px).rgb; m0 += c; s0 += c * c; }
  for (int x = 0; x <= 2; x++) for (int y = -2; y <= 2; y++) { vec3 c = tex(uv + vec2(float(x), float(y)) * px).rgb; m1 += c; s1 += c * c; }
  m0 /= 15.0; m1 /= 15.0; s0 = abs(s0 / 15.0 - m0 * m0); s1 = abs(s1 / 15.0 - m1 * m1);
  vec3 col = (s0.r + s0.g + s0.b) < (s1.r + s1.g + s1.b) ? m0 : m1;
  vec4 c = tex(uv);
  return vec4(mix(c.rgb, col, u_amt), c.a);
}` },
  { id: 'emboss', name: 'Relevo', cat: 'art', glsl: `
vec4 effect(vec2 uv){
  vec2 px = 1.0 / u_res * 1.5;
  vec4 c = tex(uv);
  float e = luma(tex(uv - px).rgb) - luma(tex(uv + px).rgb);
  vec3 col = vec3(0.5 + e * 2.0);
  return vec4(mix(c.rgb, col * c.a, u_amt), c.a);
}` },
  { id: 'posterize', name: 'Pôster', cat: 'art', glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  float lv = mix(12.0, 3.0, u_amt);
  return vec4(floor(c.rgb * lv + 0.5) / lv, c.a);
}` },
  { id: 'ascii', name: 'Matriz', cat: 'art', animated: true, glsl: `
vec4 effect(vec2 uv){
  float s = 90.0;
  vec2 cells = vec2(s, s * u_res.y / u_res.x);
  vec2 id = floor(uv * cells); vec2 f = fract(uv * cells);
  vec4 c = texture2D(u_tex, (id + 0.5) / cells);
  float l = luma(c.rgb);
  float ch = step(0.5, rand(id + floor(u_time * 6.0 + rand(id) * 10.0))) * step(0.15, f.x) * step(f.x, 0.85) * step(0.1, f.y) * step(f.y, 0.9);
  ch *= step(0.5, rand(floor(f * 4.0) + id));
  vec3 col = vec3(0.1, 1.0, 0.35) * ch * l * 1.6;
  vec4 o = tex(uv);
  return vec4(mix(o.rgb, col * o.a, u_amt), o.a);
}` },
  { id: 'cartoon', name: 'Desenho', cat: 'art', glsl: `
vec4 effect(vec2 uv){
  vec2 px = 1.0 / u_res;
  float gx = luma(tex(uv + vec2(px.x, 0.0)).rgb) - luma(tex(uv - vec2(px.x, 0.0)).rgb);
  float gy = luma(tex(uv + vec2(0.0, px.y)).rgb) - luma(tex(uv - vec2(0.0, px.y)).rgb);
  float e = smoothstep(0.08, 0.2, length(vec2(gx, gy)));
  vec4 c = tex(uv);
  vec3 hsv = rgb2hsv(c.rgb / max(c.a, 0.001));
  hsv.z = floor(hsv.z * 5.0 + 0.5) / 5.0; hsv.y = min(1.0, hsv.y * 1.3);
  vec3 col = hsv2rgb(hsv) * (1.0 - e);
  return vec4(mix(c.rgb, col * c.a, u_amt), c.a);
}` },
  // ---------- COLOR ----------
  { id: 'duotone', name: 'Duotone', cat: 'color', glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  float l = luma(c.rgb / max(c.a, 0.001));
  vec3 col = mix(vec3(0.15, 0.05, 0.45), vec3(1.0, 0.45, 0.35), l);
  return vec4(mix(c.rgb, col * c.a, u_amt), c.a);
}` },
  { id: 'thermal', name: 'Térmica', cat: 'color', glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  float l = luma(c.rgb / max(c.a, 0.001));
  vec3 col = l < 0.5 ? mix(vec3(0.0, 0.0, 0.6), vec3(0.0, 1.0, 0.2), l * 2.0) : mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 0.0, 0.0), (l - 0.5) * 2.0);
  return vec4(mix(c.rgb, col * c.a, u_amt), c.a);
}` },
  { id: 'night-vision', name: 'Visão noturna', cat: 'color', animated: true, glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  float l = luma(c.rgb / max(c.a, 0.001)) * 1.6;
  l += (rand(uv + fract(u_time)) - 0.5) * 0.2;
  vec2 v = uv - 0.5; l *= 1.0 - dot(v, v) * 2.0;
  vec3 col = vec3(0.1, 1.0, 0.2) * l;
  return vec4(mix(c.rgb, col * c.a, u_amt), c.a);
}` },
  { id: 'invert', name: 'Negativo', cat: 'color', glsl: `
vec4 effect(vec2 uv){ vec4 c = tex(uv); return vec4(mix(c.rgb, (1.0 - c.rgb / max(c.a, 0.001)) * c.a, u_amt), c.a); }` },
  { id: 'hue-cycle', name: 'Ciclo de cor', cat: 'color', animated: true, glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  vec3 hsv = rgb2hsv(c.rgb / max(c.a, 0.001)); hsv.x = fract(hsv.x + u_time * 0.25 * u_amt);
  return vec4(hsv2rgb(hsv) * c.a, c.a);
}` },
  { id: 'color-pop', name: 'Cor seletiva', cat: 'color', glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  vec3 col = c.rgb / max(c.a, 0.001);
  vec3 hsv = rgb2hsv(col);
  float keep = smoothstep(0.08, 0.02, min(abs(hsv.x), abs(1.0 - hsv.x))) * step(0.25, hsv.y);
  vec3 g = vec3(luma(col));
  return vec4(mix(col, mix(g, col, keep), u_amt) * c.a, c.a);
}` },
  { id: 'xray', name: 'Raio-X', cat: 'color', glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  float l = 1.0 - luma(c.rgb / max(c.a, 0.001));
  vec3 col = vec3(0.7, 0.9, 1.0) * pow(l, 1.5) * 1.2;
  return vec4(mix(c.rgb, col * c.a, u_amt), c.a);
}` },
  { id: 'cyber', name: 'Cyberpunk', cat: 'trend', glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  vec3 col = c.rgb / max(c.a, 0.001);
  float l = luma(col);
  vec3 g = mix(vec3(0.05, 0.0, 0.25), vec3(0.0, 0.9, 1.0), smoothstep(0.2, 0.8, l));
  g = mix(g, vec3(1.0, 0.1, 0.8), smoothstep(0.55, 1.0, col.r) * 0.6);
  return vec4(mix(col, g * (0.6 + l), u_amt * 0.8) * c.a, c.a);
}` },
  // ---------- FRAMES ----------
  { id: 'letterbox', name: 'Cinema', cat: 'frame', glsl: `
vec4 effect(vec2 uv){ vec4 c = texture2D(u_tex, uv); float b = 0.12 * u_amt; return (uv.y < b || uv.y > 1.0 - b) ? vec4(0.0, 0.0, 0.0, 1.0) : c; }` },
  { id: 'vignette-fx', name: 'Vinheta forte', cat: 'frame', glsl: `
vec4 effect(vec2 uv){ vec4 c = tex(uv); vec2 v = uv - 0.5; c.rgb *= 1.0 - smoothstep(0.2, 0.75, length(v)) * u_amt; return c; }` },
  { id: 'rounded', name: 'Cantos arredondados', cat: 'frame', glsl: `
vec4 effect(vec2 uv){
  vec2 asp = vec2(u_res.x / u_res.y, 1.0);
  vec2 p = abs(uv - 0.5) * asp; vec2 b = 0.5 * asp - 0.12 * u_amt;
  float d = length(max(p - b, 0.0)) - 0.12 * u_amt;
  return tex(uv) * smoothstep(0.003, -0.003, d);
}` },
  { id: 'border-glow', name: 'Borda neon', cat: 'frame', animated: true, glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  vec2 asp = vec2(u_res.x / u_res.y, 1.0);
  vec2 p = abs(uv - 0.5) * asp; vec2 b = 0.5 * asp - 0.03;
  float d = abs(max(p.x - b.x, p.y - b.y));
  float g = 0.004 / (d + 0.004) * u_amt;
  vec3 col = hsv2rgb(vec3(fract(atan(uv.y - 0.5, uv.x - 0.5) / 6.28318 + u_time * 0.3), 1.0, 1.0));
  return vec4(c.rgb + col * g, max(c.a, clamp(g, 0.0, 1.0)));
}` },
  { id: 'grain-heavy', name: 'Granulado', cat: 'retro', animated: true, glsl: `
vec4 effect(vec2 uv){ vec4 c = tex(uv); c.rgb += (rand(uv * u_res + fract(u_time) * 100.0) - 0.5) * 0.3 * u_amt * c.a; return c; }` },
  { id: 'dust', name: 'Poeira', cat: 'retro', animated: true, glsl: `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  float t = floor(u_time * 12.0);
  vec2 g = uv * vec2(u_res.x / u_res.y, 1.0) * 30.0;
  float d = step(0.995, rand(floor(g) + t)) * smoothstep(0.5, 0.0, length(fract(g) - 0.5));
  c.rgb = mix(c.rgb, vec3(0.05) * c.a, d * u_amt);
  return c;
}` },
  { id: 'prism', name: 'Prisma', cat: 'light', glsl: `
vec4 effect(vec2 uv){
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 6; i++) {
    float k = float(i) / 5.0;
    vec3 tint = hsv2rgb(vec3(k * 0.8, 1.0, 1.0));
    vec4 s = tex((uv - 0.5) * (1.0 - k * 0.04 * u_amt) + 0.5);
    acc += vec4(s.rgb * tint, s.a);
  }
  acc /= vec4(vec3(2.3), 6.0);
  vec4 c = tex(uv);
  return mix(c, acc, u_amt);
}` },
  { id: 'echo', name: 'Eco visual', cat: 'motion', animated: true, glsl: `
vec4 effect(vec2 uv){
  vec4 acc = tex(uv);
  for (int i = 1; i < 5; i++) {
    float k = float(i);
    vec2 o = vec2(sin(u_time * 2.0), cos(u_time * 1.7)) * 0.012 * k * u_amt;
    acc += tex(uv + o) * (0.5 / k);
  }
  return acc / 2.04;
}` },
];

export const EFFECT_MAP = new Map(EFFECTS.map((e) => [e.id, e]));

/** trending set is a curated cross-category selection */
export const TRENDING = ['zoom-pulse', 'rgb-split', 'glitch', 'shake', 'vhs', 'light-leak', 'split4', 'heartbeat', 'strobe', 'sparkle', 'cyber', 'split3', 'jitter-zoom', 'film-burn', 'neon-edge', 'flash'];

export function effectsInCategory(cat: string): EffectDef[] {
  if (cat === 'trend') return TRENDING.map((id) => EFFECT_MAP.get(id)!).filter(Boolean);
  return EFFECTS.filter((e) => e.cat === cat);
}
