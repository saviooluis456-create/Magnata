#!/usr/bin/env python3
"""Synthesize SFX + soft music bed, timed to the edit. Writes 48k stereo wav."""
import sys, wave
import numpy as np
OUT = sys.argv[1]
SR, DUR = 48000, 36.57
N = int(SR * DUR)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)

def add(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR); j = min(N, i + len(sig))
    if i < 0: sig = sig[-i:]; i = 0
    s = sig[: j - i] * gain
    L[i:j] += s * (1 - max(0, pan)); R[i:j] += s * (1 + min(0, pan))

def lowpass(x, a):
    y = np.empty_like(x); acc = 0.0
    for k in range(len(x)): acc += a * (x[k] - acc); y[k] = acc
    return y

def whoosh(d=0.45):
    n = int(d * SR); t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    # sweeping one-pole filter: open then close
    a = 0.02 + 0.25 * np.sin(np.pi * t / d) ** 2
    y = np.empty(n); acc = 0.0
    for k in range(n): acc += a[k] * (noise[k] - acc); y[k] = acc
    env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.5
    return y * env / (np.abs(y).max() + 1e-9)

def boom(d=1.2, f0=55):
    t = np.arange(int(d * SR)) / SR
    f = f0 * (1 + 1.5 * np.exp(-t * 18))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 3.2)

def tick(f=2400, d=0.025):
    t = np.arange(int(d * SR)) / SR
    return np.sin(2 * np.pi * f * t) * np.exp(-t * 180)

def pop(f=900, d=0.09):
    t = np.arange(int(d * SR)) / SR
    return np.sin(2 * np.pi * f * (1 + 0.6 * np.exp(-t * 60)) * t) * np.exp(-t * 45)

CUTS = [2.15, 5.60, 7.95, 10.70, 14.55, 20.40, 22.70, 25.00, 28.40, 31.45]
add(boom(), 0.0, 0.55)
add(whoosh(0.6), 0.0, 0.18)
for i, c in enumerate(CUTS):
    add(whoosh(), c - 0.25, 0.16, pan=(0.35 if i % 2 else -0.35))
add(boom(0.8, 70), 17.90, 0.28)           # stat hit
for k in range(16):                        # counter ticks
    add(tick(2200 + 40 * k), 18.05 + k * 0.08, 0.05)
for i in range(7):                          # icons filling
    add(pop(700 + 60 * i), 19.50 + i * 0.12, 0.09)
add(boom(1.0, 60), 35.45, 0.25)           # outro bar
add(whoosh(0.5), 35.25, 0.12)

# soft pad bed: Am - F - C - G, slow, low level
t = np.arange(N) / SR
chords = [[220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [196.0, 261.63, 329.63], [196.0, 246.94, 293.66]]
bed = np.zeros(N); seg = 4.5
for ci in range(int(DUR / seg) + 1):
    a, b = int(ci * seg * SR), min(N, int((ci + 1) * seg * SR + 1.0 * SR))
    if a >= N: break
    tt = np.arange(b - a) / SR
    env = np.minimum(1, tt / 1.2) * np.minimum(1, np.maximum(0, (b - a) / SR - tt) / 1.0)
    for f in chords[ci % 4]:
        bed[a:b] += env * (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * f * 2.003 * tt)) / 3
bed[: int(SR * 1.5)] *= np.linspace(0, 1, int(SR * 1.5))
bed *= 0.5 + 0.5 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.25 * t))   # slow swell
add(bed, 0, 0.035)

mx = max(np.abs(L).max(), np.abs(R).max(), 1e-9)
st = np.stack([L, R], 1) / mx * 0.9
with wave.open(OUT, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st * 32767).astype(np.int16).tobytes())
print("ok", mx)
