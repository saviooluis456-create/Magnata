# Trilha da vinheta SEMEC (5 s): síntese própria — swishes, marimba ascendente, acorde com sino e brilho final.
import sys, wave
import numpy as np
SR = 44100
def env(n, a=0.005, d=1.0):
    t = np.arange(n) / SR
    return np.minimum(t / a, 1) * np.exp(-t / d)
def note(f, dur, kind='marimba', vol=1.0):
    n = int(SR * dur); t = np.arange(n) / SR
    if kind == 'marimba':
        s = np.sin(2*np.pi*f*t) * env(n, .002, .28) + .35*np.sin(2*np.pi*f*4*t) * env(n, .001, .06) + .12*np.sin(2*np.pi*f*10*t) * env(n, .001, .02)
    elif kind == 'bell':
        mod = np.sin(2*np.pi*f*3.5*t) * 2.2 * np.exp(-t/.5)
        s = np.sin(2*np.pi*f*t + mod) * env(n, .003, .9)
    elif kind == 'pad':
        s = sum(np.sin(2*np.pi*f*m*t + p) / (i+1) for i, (m, p) in enumerate([(1,0),(2,.3),(3,.7),(1.005,1.1)]))
        e = np.minimum(t/.25, 1) * np.exp(-np.maximum(t-1.2, 0)/1.1); s = s * e * .5
    elif kind == 'kick':
        ph = 2*np.pi*np.cumsum(50 + 110*np.exp(-t/.035))/SR
        s = np.sin(ph) * env(n, .001, .16)
    elif kind == 'glint':
        s = np.sin(2*np.pi*f*t) * env(n, .001, .12) * .7
    return s * vol
def swish(dur, f0, f1, vol=.5, seed=0):
    n = int(SR*dur); rng = np.random.default_rng(seed); x = rng.standard_normal(n)
    out = np.zeros(n); lp = bp = 0.0; q = .25
    fr = np.linspace(f0, f1, n)
    for i in range(n):  # filtro passa-banda variável (state variable)
        fc = 2*np.sin(np.pi*fr[i]/SR); hp = x[i] - lp - q*bp; bp += fc*hp; lp += fc*bp; out[i] = bp
    e = np.sin(np.linspace(0, np.pi, n))**2
    return out * e * vol
def render(semis=0, playful=0.0):
    N = SR*5; L = np.zeros(N+SR); R = np.zeros(N+SR)
    k = 2 ** (semis/12)
    def put(s, at, pan=0.0):
        i = int(at*SR); g = (1-pan)/2, (1+pan)/2
        L[i:i+len(s)] += s*(.6+.8*g[0]); R[i:i+len(s)] += s*(.6+.8*g[1])
    C5, E5, G5, C6, D6, E6, G6 = [523.25*k*r for r in (1, 1.26, 1.4983, 2, 2.2449, 2.5198, 2.9966)]
    for i in range(4): put(swish(.42, 500+250*i, 3200+900*i, .2, i), .02+.08*i, -0.6+.4*i)
    for i in range(4): put(swish(.4, 4000-300*i, 700, .13, 9+i), .52+.06*i, 0.6-.4*i)
    put(note(0, .5, 'kick', .9), .82)
    for f, at, pan in [(C5, 1.02, -.3), (E5, 1.17, -.1), (G5, 1.30, .1), (C6, 1.47, .3)]: put(note(f, .9, 'marimba', .85), at, pan)
    if playful:
        for f, at in [(E6, 1.60), (G6, 1.70)]: put(note(f, .5, 'glint', .22*playful), at, .4)
    put(note(0, .5, 'kick', 1.0), 1.86); put(swish(.5, 600, 5000, .16, 33), 1.62)
    for f in (C5/2, G5/2, C5, E5, G5, D6/2*1.0): put(note(f, 3.2, 'pad', .2), 1.86)
    for f, v in ((C6, .5), (E6, .32), (G6, .22)): put(note(f, 2.6, 'bell', v), 1.87)
    put(note(G5, .6, 'marimba', .6), 2.24, -.2); put(note(C6, .8, 'marimba', .65), 2.38, .2)
    put(swish(.35, 900, 3600, .22, 51), 2.56)
    for j, f in enumerate((C6, E6, G6, C6*2, E6*2, G6*2)): put(note(f, .35, 'glint', .26), 2.66+.07*j, -.6+.24*j)
    put(note(C6*2, 2.0, 'bell', .12), 3.34); put(swish(.5, 2500, 9000, .12, 77), 3.3)
    # reverberação simples (atrasos realimentados)
    for buf in (L, R):
        wet = np.zeros_like(buf)
        for dly, g in ((.047, .32), (.071, .26), (.113, .2), (.167, .14)):
            d = int(dly*SR); w = buf.copy()
            for _ in range(4): w = np.concatenate([np.zeros(d), w[:-d]]) * g; wet += w
        buf += wet * .5
    L2, R2 = L[:N], R[:N]
    fade = np.ones(N); f = int(.5*SR); fade[-f:] = np.cos(np.linspace(0, np.pi/2, f))**2; fade[:200] = np.linspace(0, 1, 200)
    st = np.stack([L2*fade, R2*fade], 1); st = np.tanh(st * 1.15 / np.max(np.abs(st))) * .93
    return (st * 32767).astype(np.int16)
if __name__ == '__main__':
    out, semis, playful = sys.argv[1], int(sys.argv[2]), float(sys.argv[3])
    with wave.open(out, 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(render(semis, playful).tobytes())
