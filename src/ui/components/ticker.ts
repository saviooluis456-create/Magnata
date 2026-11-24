// One shared animation clock (≈30 fps) for every visible live preview (captions, motion graphics…)
const tickers = new Set<(now: number) => void>();
let rafId = 0, lastTick = 0;
function loop(now: number) {
  rafId = tickers.size ? requestAnimationFrame(loop) : 0;
  if (now - lastTick < 33) return;
  lastTick = now;
  tickers.forEach((f) => f(now));
}
export function subscribeTick(f: (now: number) => void) {
  tickers.add(f);
  if (!rafId) rafId = requestAnimationFrame(loop);
  return () => { tickers.delete(f); };
}
