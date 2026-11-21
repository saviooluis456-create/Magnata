export interface FontDef { family: string; spec: string; cat: 'sans' | 'display' | 'serif' | 'script' | 'mono' | 'fun' }

export const FONTS: FontDef[] = [
  { family: 'Montserrat', spec: 'Montserrat:ital,wght@0,400;0,600;0,700;0,800;0,900;1,800;1,900', cat: 'sans' },
  { family: 'Poppins', spec: 'Poppins:ital,wght@0,400;0,600;0,700;0,800;0,900;1,800', cat: 'sans' },
  { family: 'Inter', spec: 'Inter:wght@400;600;700;800;900', cat: 'sans' },
  { family: 'Roboto', spec: 'Roboto:ital,wght@0,400;0,700;0,900;1,900', cat: 'sans' },
  { family: 'Rubik', spec: 'Rubik:wght@400;600;700;800;900', cat: 'sans' },
  { family: 'Nunito', spec: 'Nunito:wght@400;700;800;900', cat: 'sans' },
  { family: 'Raleway', spec: 'Raleway:wght@400;700;800;900', cat: 'sans' },
  { family: 'Kanit', spec: 'Kanit:ital,wght@0,400;0,700;0,800;0,900;1,900', cat: 'sans' },
  { family: 'Space Grotesk', spec: 'Space Grotesk:wght@400;700', cat: 'sans' },
  { family: 'Bebas Neue', spec: 'Bebas Neue', cat: 'display' },
  { family: 'Anton', spec: 'Anton', cat: 'display' },
  { family: 'Oswald', spec: 'Oswald:wght@400;600;700', cat: 'display' },
  { family: 'Archivo Black', spec: 'Archivo Black', cat: 'display' },
  { family: 'Barlow Condensed', spec: 'Barlow Condensed:ital,wght@0,600;0,800;0,900;1,900', cat: 'display' },
  { family: 'Teko', spec: 'Teko:wght@500;700', cat: 'display' },
  { family: 'Staatliches', spec: 'Staatliches', cat: 'display' },
  { family: 'Russo One', spec: 'Russo One', cat: 'display' },
  { family: 'Bungee', spec: 'Bungee', cat: 'display' },
  { family: 'Passion One', spec: 'Passion One:wght@400;700;900', cat: 'display' },
  { family: 'Titan One', spec: 'Titan One', cat: 'fun' },
  { family: 'Luckiest Guy', spec: 'Luckiest Guy', cat: 'fun' },
  { family: 'Bangers', spec: 'Bangers', cat: 'fun' },
  { family: 'Fredoka', spec: 'Fredoka:wght@400;600;700', cat: 'fun' },
  { family: 'Righteous', spec: 'Righteous', cat: 'fun' },
  { family: 'Permanent Marker', spec: 'Permanent Marker', cat: 'fun' },
  { family: 'Creepster', spec: 'Creepster', cat: 'fun' },
  { family: 'Black Ops One', spec: 'Black Ops One', cat: 'fun' },
  { family: 'Monoton', spec: 'Monoton', cat: 'fun' },
  { family: 'Orbitron', spec: 'Orbitron:wght@400;700;900', cat: 'mono' },
  { family: 'Audiowide', spec: 'Audiowide', cat: 'mono' },
  { family: 'Press Start 2P', spec: 'Press Start 2P', cat: 'mono' },
  { family: 'Playfair Display', spec: 'Playfair Display:ital,wght@0,400;0,700;0,900;1,700;1,900', cat: 'serif' },
  { family: 'Abril Fatface', spec: 'Abril Fatface', cat: 'serif' },
  { family: 'DM Serif Display', spec: 'DM Serif Display:ital@0;1', cat: 'serif' },
  { family: 'Cinzel', spec: 'Cinzel:wght@400;700;900', cat: 'serif' },
  { family: 'Lobster', spec: 'Lobster', cat: 'script' },
  { family: 'Pacifico', spec: 'Pacifico', cat: 'script' },
  { family: 'Dancing Script', spec: 'Dancing Script:wght@400;700', cat: 'script' },
  { family: 'Satisfy', spec: 'Satisfy', cat: 'script' },
  { family: 'Caveat', spec: 'Caveat:wght@400;700', cat: 'script' },
  { family: 'Shadows Into Light', spec: 'Shadows Into Light', cat: 'script' },
];

let injected = false;
const listeners = new Set<() => void>();

export function onFontsChanged(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function injectFonts() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  // split into chunks to keep URLs short
  const chunk = 10;
  for (let i = 0; i < FONTS.length; i += chunk) {
    const fams = FONTS.slice(i, i + chunk).map((f) => 'family=' + encodeURIComponent(f.spec).replace(/%20/g, '+')).join('&');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${fams}&display=swap`;
    document.head.appendChild(link);
  }
  document.fonts?.addEventListener?.('loadingdone', () => listeners.forEach((l) => l()));
}

export function fontString(family: string, weight: number, size: number, italic = false) {
  return `${italic ? 'italic ' : ''}${weight} ${Math.max(1, Math.round(size))}px "${family}", "Montserrat", system-ui, sans-serif`;
}

const requested = new Set<string>();
/** Ask the browser to load a font; returns true if it is already available. */
export function ensureFont(family: string, weight: number, italic = false): boolean {
  if (typeof document === 'undefined' || !document.fonts) return true;
  const key = `${family}|${weight}|${italic}`;
  const f = fontString(family, weight, 40, italic);
  let ok = false;
  try { ok = document.fonts.check(f); } catch { ok = true; }
  if (!ok && !requested.has(key)) {
    requested.add(key);
    document.fonts.load(f).then(() => listeners.forEach((l) => l())).catch(() => {});
  }
  return ok;
}

export async function preloadFonts(list: { family: string; weight: number; italic?: boolean }[], timeoutMs = 5000) {
  if (typeof document === 'undefined' || !document.fonts) return;
  const tasks = list.map((f) => document.fonts.load(fontString(f.family, f.weight, 40, f.italic)).catch(() => []));
  await Promise.race([Promise.all(tasks), new Promise((r) => setTimeout(r, timeoutMs))]);
}
