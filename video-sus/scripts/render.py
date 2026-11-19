#!/usr/bin/env python3
"""Motion-graphics edit for the SUS podcast clip.
Usage: render.py <source.mov> <scratch_dir> <out_video_noaudio.mp4> [start_s end_s]
"""
import sys, math, subprocess, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

SRC, S, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
T0 = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0
T1 = float(sys.argv[5]) if len(sys.argv) > 5 else 36.57
W, H, FPS = 1080, 1920, 30
IMG = os.path.join(S, "img")

# ---------- palette & fonts ----------
NAVY = (8, 24, 58)
BLUE = (19, 81, 180)
YEL = (255, 205, 7)
WHITE = (255, 255, 255)
FD = "/usr/share/fonts/opentype/inter/"
def F(name, size): return ImageFont.truetype(FD + name, size)
F_BLACK = lambda s: F("InterDisplay-Black.otf", s)
F_BOLD = lambda s: F("InterDisplay-Bold.otf", s)
F_MED = lambda s: F("Inter-Medium.otf", s)
F_SEMI = lambda s: F("Inter-SemiBold.otf", s)

# ---------- easing ----------
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def prog(t, a, b): return clamp((t - a) / (b - a)) if b > a else 1.0
def ease_out(x): return 1 - (1 - x) ** 3
def ease_in_out(x): return 4 * x ** 3 if x < .5 else 1 - (-2 * x + 2) ** 3 / 2
def ease_back(x, s=1.7):
    x -= 1
    return 1 + (s + 1) * x ** 3 + s * x ** 2

# ---------- timeline ----------
# (start, end, kind, params)
SCENES = [
    (0.00, 2.15, "spk", dict(z0=1.32, z1=1.06, intro=True)),
    (2.15, 5.60, "pan", dict(img="000c.jpg", credit="Foto: Josscelio Ximenes · CC0 · Wikimedia Commons",
                            kicker="SISTEMA ÚNICO DE SAÚDE", sub="saúde pública e gratuita para todos")),
    (5.60, 7.95, "card", dict(img="085.jpg", bw=True, credit="Foto: Senado Federal · CC BY 2.0",
                             kicker="ASSEMBLEIA CONSTITUINTE", year="1988")),
    (7.95, 10.70, "card", dict(img="090.jpg", bw=True, credit="Foto: Arquivo/Agência Brasil · CC BY 3.0 BR",
                              quote=("“A saúde é direito de todos", "e dever do Estado.”"),
                              qsrc="CONSTITUIÇÃO FEDERAL · ART. 196")),
    (10.70, 14.55, "spk", dict(z0=1.04, z1=1.10, punch=12.06)),
    (14.55, 20.40, "stat", dict(img="051.jpg", credit="Foto: Mateus S. Figueiredo · CC BY-SA 4.0",
                               label="UBS Central · Viçosa (MG)", t_stat=17.90)),
    (20.40, 22.70, "full", dict(img="038.jpg", credit="Foto: Vinicius Loures/Câmara dos Deputados · CC BY 3.0",
                               focus=(0.5, 0.40), cross=False)),
    (22.70, 25.00, "spk", dict(z0=1.12, z1=1.05)),
    (25.00, 28.40, "card", dict(img="075.jpg", desat=0.55, credit="Foto: Cristine Rochol/PMPA",
                               kicker="FORÇA NACIONAL DO SUS", sub="hospital de campanha · Porto Alegre, 2024")),
    (28.40, 31.45, "card", dict(img="064.jpg", siren=True, credit="Foto: Vinícius de Melo/Agência Brasília · domínio público",
                               kicker="SAMU 192", sub="atendimento de urgência pelo SUS")),
    (31.45, 36.57, "spk", dict(z0=1.04, z1=1.08, punch=34.58, outro=35.45)),
]
CUTS = [s[0] for s in SCENES[1:]]

# ---------- assets ----------
_cache = {}
def load(name):
    if name not in _cache:
        _cache[name] = Image.open(os.path.join(IMG, name)).convert("RGB")
    return _cache[name]

def cover(im, w, h, focus=(0.5, 0.5), extra=1.0):
    sw, sh = im.size
    sc = max(w / sw, h / sh) * extra
    nw, nh = int(sw * sc + .5), int(sh * sc + .5)
    r = im.resize((nw, nh), Image.LANCZOS)
    x = int(clamp(focus[0] * nw - w / 2, 0, nw - w)); y = int(clamp(focus[1] * nh - h / 2, 0, nh - h))
    return r.crop((x, y, x + w, y + h))

def grade_photo(im, bw=False, desat=0.0):
    a = np.asarray(im).astype(np.float32) / 255
    if bw or desat:
        g = (a @ np.array([.299, .587, .114], np.float32))[..., None]
        k = 1.0 if bw else desat
        a = a * (1 - k) + g * k
        if bw:  # warm archival tint
            a = a * np.array([1.04, 1.0, 0.92], np.float32)
    a = np.clip((a - .5) * 1.08 + .5, 0, 1)
    return Image.fromarray((a * 255).astype(np.uint8))

_bg = {}
def blurred_bg(name, **gk):
    key = (name, tuple(sorted(gk.items())))
    if key not in _bg:
        b = cover(grade_photo(load(name), **gk), W // 4, H // 4, extra=1.15).filter(ImageFilter.GaussianBlur(10))
        b = Image.blend(b, Image.new("RGB", b.size, NAVY), 0.55)
        _bg[key] = b.resize((int(W * 1.12), int(H * 1.12)), Image.BILINEAR)
    return _bg[key]

_card = {}
def card_img(name, maxw=940, maxh=1000, **gk):
    key = (name, tuple(sorted(gk.items())))
    if key not in _card:
        im = grade_photo(load(name), **gk)
        sw, sh = im.size
        sc = min(maxw / sw, maxh / sh)
        im = im.resize((int(sw * sc), int(sh * sc)), Image.LANCZOS)
        # white frame + rounded corners + shadow, on transparent canvas
        pad, bd, rad = 60, 8, 26
        cw, ch = im.width + 2 * bd, im.height + 2 * bd
        frame = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        m = Image.new("L", (cw, ch), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, cw - 1, ch - 1], rad, fill=255)
        base = Image.new("RGBA", (cw, ch), WHITE + (255,))
        inner_m = Image.new("L", im.size, 0); ImageDraw.Draw(inner_m).rounded_rectangle([0, 0, im.width - 1, im.height - 1], rad - bd, fill=255)
        base.paste(im, (bd, bd), inner_m)
        frame.paste(base, (0, 0), m)
        canvas = Image.new("RGBA", (cw + 2 * pad, ch + 2 * pad), (0, 0, 0, 0))
        sh_m = Image.new("L", canvas.size, 0)
        ImageDraw.Draw(sh_m).rounded_rectangle([pad, pad + 18, pad + cw, pad + ch + 18], rad, fill=150)
        sh_m = sh_m.filter(ImageFilter.GaussianBlur(24))
        canvas.paste(Image.new("RGBA", canvas.size, (0, 0, 0, 255)), (0, 0), sh_m)
        canvas.alpha_composite(frame, (pad, pad))
        _card[key] = canvas
    return _card[key]

def affine_place(dst, src, cx, cy, scale=1.0, rot=0.0, alpha=1.0):
    """Composite RGBA src onto RGB/RGBA dst centred at (cx,cy) with scale/rotation."""
    s = src
    if abs(scale - 1) > 1e-3:
        s = s.resize((max(1, int(s.width * scale)), max(1, int(s.height * scale))), Image.BICUBIC)
    if abs(rot) > 0.01:
        s = s.rotate(rot, Image.BICUBIC, expand=True)
    if alpha < 0.999:
        a = s.getchannel("A").point(lambda v: int(v * alpha)); s = s.copy(); s.putalpha(a)
    dst.alpha_composite(s, (int(cx - s.width / 2), int(cy - s.height / 2)))

# ---------- speaker video ----------
def speaker_reader():
    cmd = ["ffmpeg", "-v", "error", "-ss", f"{T0:.3f}", "-i", SRC, "-t", f"{T1 - T0:.3f}",
           "-vf", f"fps={FPS},scale={W}:{H}", "-pix_fmt", "rgb24", "-f", "rawvideo", "-"]
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, bufsize=10 ** 8)
    last = None
    while True:
        buf = p.stdout.read(W * H * 3)
        if len(buf) < W * H * 3:
            while True: yield last
        last = Image.frombuffer("RGB", (W, H), buf, "raw", "RGB", 0, 1)
        yield last

FACE = (0.40, 0.30)  # where the speaker's face sits (normalised)
def zoom_frame(fr, z, cx=FACE[0], cy=FACE[1]):
    if z <= 1.0005: return fr.copy()
    cw, ch = W / z, H / z
    x0 = clamp(cx * W - cw / 2, 0, W - cw); y0 = clamp(cy * H - ch / 2, 0, H - ch)
    return fr.transform((W, H), Image.AFFINE, (cw / W, 0, x0, 0, ch / H, y0), Image.BILINEAR)

def grade_speaker(im):
    a = np.asarray(im).astype(np.float32) / 255
    a = np.clip((a - .5) * 1.10 + .5, 0, 1)
    lum = a @ np.array([.299, .587, .114], np.float32)
    sh = (1 - lum)[..., None] ** 2
    a = a + sh * np.array([-0.025, 0.0, 0.035], np.float32) + (lum[..., None] ** 2) * np.array([0.025, 0.01, -0.02], np.float32)
    g = lum[..., None]; a = g + (a - g) * 1.08
    return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))

# ---------- text helpers ----------
def text_w(d, s, f): return d.textlength(s, font=f)

def kicker_block(ov, t, t_in, kicker, sub=None, y=1370, x=70):
    d = ImageDraw.Draw(ov)
    p = ease_out(prog(t, t_in, t_in + .45))
    if p <= 0: return
    fk = F_BLACK(46)
    tw = text_w(d, kicker, fk)
    bw = int((tw + 56) * p)
    d.rounded_rectangle([x, y, x + max(bw, 8), y + 78], 12, fill=YEL + (255,))
    if p > .55:
        # text revealed by the bar (clip)
        layer = Image.new("RGBA", ov.size, (0, 0, 0, 0)); ld = ImageDraw.Draw(layer)
        ld.text((x + 28, y + 13), kicker, font=fk, fill=NAVY + (255,))
        m = Image.new("L", ov.size, 0); ImageDraw.Draw(m).rectangle([x, y, x + bw, y + 78], fill=255)
        ov.paste(layer, (0, 0), ImageChops.multiply(layer.getchannel("A"), m))
    if sub:
        ps = ease_out(prog(t, t_in + .3, t_in + .8))
        if ps > 0:
            fs = F_SEMI(42)
            a = int(255 * ps)
            d.text((x + 4, y + 102 + (1 - ps) * 24), sub, font=fs, fill=WHITE + (a,))

def credit(ov, t, t_in, txt, y=1745):
    a = int(170 * ease_out(prog(t, t_in + .3, t_in + .8)))
    if a: ImageDraw.Draw(ov).text((70, y), txt, font=F_MED(24), fill=WHITE + (a,))

def brackets(ov, t, t_in, col=WHITE, a=200, m=56, L=70, w=6):
    p = ease_out(prog(t, t_in, t_in + .4))
    if p <= 0: return
    d = ImageDraw.Draw(ov); l = int(L * p); c = col + (int(a * p),)
    for (x, y, sx, sy) in [(m, m + 120, 1, 1), (W - m, m + 120, -1, 1), (m, H - m - 260, 1, -1), (W - m, H - m - 260, -1, -1)]:
        d.line([(x, y), (x + sx * l, y)], fill=c, width=w); d.line([(x, y), (x, y + sy * l)], fill=c, width=w)

def ecg(ov, t, y=1640, amp=70, alpha=200):
    """Animated heartbeat line drawing across the screen."""
    period = 1.6
    ph = (t % period) / period
    pts = []
    for x in range(0, W + 1, 6):
        u = (x / W * 2.0) % 1.0
        v = 0.0
        if .40 < u < .45: v = (u - .40) / .05 * .25
        elif .45 < u < .48: v = .25 - (u - .45) / .03 * 1.25
        elif .48 < u < .52: v = -1.0 + (u - .48) / .04 * 2.2
        elif .52 < u < .56: v = 1.2 - (u - .52) / .04 * 1.5
        elif .56 < u < .60: v = -.3 + (u - .56) / .04 * .3
        elif .70 < u < .78: v = math.sin((u - .70) / .08 * math.pi) * .18
        pts.append((x, y - v * amp))
    head = int(ph * len(pts))
    layer = Image.new("RGBA", (W, 300), (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    tail = 70
    for i in range(max(1, head - tail), head):
        a = int(alpha * (i - (head - tail)) / tail)
        p0 = (pts[i - 1][0], pts[i - 1][1] - (y - 150)); p1 = (pts[i][0], pts[i][1] - (y - 150))
        d.line([p0, p1], fill=YEL + (a,), width=5)
    glow = layer.filter(ImageFilter.GaussianBlur(8))
    ov.alpha_composite(glow, (0, y - 150)); ov.alpha_composite(layer, (0, y - 150))
    if 0 < head < len(pts):
        hx, hy = pts[head - 1]
        ImageDraw.Draw(ov).ellipse([hx - 9, hy - 9, hx + 9, hy + 9], fill=WHITE + (alpha,))

def person_icon(d, x, y, s, col):
    d.ellipse([x - s * .22, y, x + s * .22, y + s * .44], fill=col)
    d.rounded_rectangle([x - s * .36, y + s * .52, x + s * .36, y + s * 1.2], int(s * .2), fill=col)

def sus_cross(ov, cx, cy, s, a=255, col=WHITE):
    d = ImageDraw.Draw(ov); t = s * .32
    d.rounded_rectangle([cx - t / 2, cy - s / 2, cx + t / 2, cy + s / 2], int(t * .25), fill=col + (a,))
    d.rounded_rectangle([cx - s / 2, cy - t / 2, cx + s / 2, cy + t / 2], int(t * .25), fill=col + (a,))

# ---------- scene renderers ----------
def scene_spk(fr, t, a, b, p):
    z = p["z0"] + (p["z1"] - p["z0"]) * ease_in_out(prog(t, a, b))
    if p.get("intro"):
        z = p["z1"] + (p["z0"] - p["z1"]) * (1 - ease_out(prog(t, 0, 1.4)))
    if "punch" in p and t >= p["punch"]:
        z *= 1 + 0.10 * ease_out(prog(t, p["punch"], p["punch"] + .18))
    img = grade_speaker(zoom_frame(fr, z)).convert("RGBA")
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # bottom gradient for readability of graphics
    grad = Image.linear_gradient("L").resize((W, 520)).point(lambda v: int(v * .55))
    ov.paste(Image.new("RGBA", (W, 520), NAVY + (255,)), (0, H - 520), grad)
    ecg(ov, t, alpha=int(210 * ease_out(prog(t, a + .2, a + .7))))
    brackets(ov, t, a + .1, a=150)
    if p.get("intro"):
        # navy diagonal wipe reveal
        pw = ease_in_out(prog(t, 0.0, 0.55))
        if pw < 1:
            d = ImageDraw.Draw(ov); off = int((W + H) * pw)
            d.polygon([(off - 400, 0), (W + H, 0), (W + H, H), (off - 400 - H * .35, H)], fill=NAVY + (255,))
            d.polygon([(off - 400 - 40, 0), (off - 400, 0), (off - 400 - H * .35, H), (off - 440 - H * .35, H)], fill=YEL + (255,))
    if p.get("outro") and t >= p["outro"]:
        q = ease_out(prog(t, p["outro"], p["outro"] + .5))
        d = ImageDraw.Draw(ov)
        y0 = int(H - 430 * q)
        d.rectangle([0, y0, W, H], fill=BLUE + (240,))
        d.rectangle([0, y0, W, y0 + 10], fill=YEL + (255,))
        sus_cross(ov, 150, y0 + 150, 120, a=int(255 * q))
        d.text((250, y0 + 85), "Saúde é direito", font=F_BLACK(64), fill=WHITE + (int(255 * q),))
        d.text((250, y0 + 160), "de todos.", font=F_BLACK(64), fill=YEL + (int(255 * q),))
    img.alpha_composite(ov)
    return img

def scene_pan(fr, t, a, b, p):
    im = load(p["img"]); u = ease_in_out(prog(t, a, b))
    base = cover(grade_photo(im), int(W * 1.18), int(H * 1.18), focus=(0.0 + 0.40 * u, 0.42))
    sc = 1.0 + 0.06 * u
    img = base.resize((int(base.width * sc), int(base.height * sc)), Image.BILINEAR)
    x = int((img.width - W) * u); y = (img.height - H) // 2
    img = img.crop((x, y, x + W, y + H)).convert("RGBA")
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    grad = Image.linear_gradient("L").resize((W, 800)).point(lambda v: int(v * .85))
    ov.paste(Image.new("RGBA", (W, 800), NAVY + (255,)), (0, H - 800), grad)
    kicker_block(ov, t, a + .25, p["kicker"], p.get("sub"))
    credit(ov, t, a, p["credit"])
    img.alpha_composite(ov)
    return img

def scene_card(fr, t, a, b, p):
    gk = {}
    if p.get("bw"): gk["bw"] = True
    if p.get("desat"): gk["desat"] = p["desat"]
    bg = blurred_bg(p["img"], **gk)
    u = prog(t, a, b)
    off = int(30 * u)
    img = bg.crop((40 + off, 60, 40 + off + W, 60 + H)).convert("RGBA")
    if p.get("siren"):
        ph = math.sin(t * 2 * math.pi * 2.2)
        col = (230, 30, 40) if ph > 0 else (30, 70, 230)
        fl = Image.new("RGBA", (W, H), col + (int(60 * abs(ph)),))
        img.alpha_composite(fl)
    c = card_img(p["img"], **gk)
    pin = ease_back(prog(t, a, a + .5)) if t < a + .5 else 1.0
    cy = 760 + (1 - pin) * 260
    affine_place(img, c, W / 2, cy, scale=0.96 + 0.06 * u, rot=(-1.6 + 2.2 * u), alpha=clamp(prog(t, a, a + .2)))
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    if p.get("year"):
        py = ease_out(prog(t, a + .25, a + .8))
        f = F_BLACK(230)
        d = ImageDraw.Draw(ov)
        yr = p["year"]
        # count-up year 1980 -> 1988
        val = int(1980 + 8 * py)
        d.text((70, 1300 + (1 - py) * 40), str(val), font=f, fill=YEL + (int(255 * py),))
        kicker_block(ov, t, a + .45, p["kicker"], None, y=1580)
    if p.get("quote"):
        d = ImageDraw.Draw(ov)
        fq = F_BLACK(64)
        full = p["quote"]
        total = sum(len(s) for s in full)
        n = int(total * prog(t, a + .25, a + 1.6))
        y = 1310
        d.rectangle([70, y, 80, y + 175], fill=YEL + (255,))
        for line in full:
            k = max(0, min(len(line), n)); n -= len(line)
            d.text((110, y), line[:k], font=fq, fill=WHITE + (255,))
            y += 84
        pa = int(255 * ease_out(prog(t, a + 1.5, a + 1.9)))
        d.text((110, y + 20), p["qsrc"], font=F_BOLD(34), fill=YEL + (pa,))
    if p.get("kicker") and not p.get("year"):
        kicker_block(ov, t, a + .3, p["kicker"], p.get("sub"), y=1400)
    credit(ov, t, a, p["credit"])
    img.alpha_composite(ov)
    return img

def scene_stat(fr, t, a, b, p):
    ts = p["t_stat"]
    bg = blurred_bg(p["img"])
    img = bg.crop((60, 60, 60 + W, 60 + H)).convert("RGBA")
    c = card_img(p["img"])
    k = ease_in_out(prog(t, ts - .1, ts + .45))
    pin = ease_back(prog(t, a, a + .5)) if t < a + .5 else 1.0
    cy = (820 + (1 - pin) * 260) * (1 - k) + 520 * k
    sc = (0.96 + 0.04 * prog(t, a, ts)) * (1 - k) + 0.62 * k
    affine_place(img, c, W / 2, cy, scale=sc, rot=-1.2 * (1 - k) + 1.0 * k, alpha=clamp(prog(t, a, a + .2)))
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    if t < ts:
        kicker_block(ov, t, a + .3, "ATENÇÃO BÁSICA", p["label"], y=1400)
    else:
        # darken bottom area
        dk = int(150 * k)
        ov.paste(Image.new("RGBA", (W, 1100), NAVY + (dk,)), (0, 820))
        pc = ease_out(prog(t, ts + .15, ts + 1.4))
        val = 71.5 * pc
        s = f"{val:.1f}".replace(".", ",") + "%"
        f = F_BLACK(250)
        tw = text_w(d, s, f)
        sc_pop = 1 + 0.06 * math.sin(clamp(prog(t, ts + 1.4, ts + 1.7)) * math.pi)
        lay = Image.new("RGBA", (int(tw) + 40, 320), (0, 0, 0, 0))
        ImageDraw.Draw(lay).text((20, 0), s, font=f, fill=YEL + (255,))
        affine_place(ov, lay, W / 2, 1050, scale=sc_pop, alpha=clamp(prog(t, ts + .1, ts + .3)))
        pl = ease_out(prog(t, ts + .5, ts + 1.0))
        fl = F_BLACK(54)
        for i, line in enumerate(["dos brasileiros não têm plano", "de saúde e dependem do SUS"]):
            lw = text_w(d, line, fl)
            d.text(((W - lw) / 2, 1215 + i * 68 + (1 - pl) * 30), line, font=fl, fill=WHITE + (int(255 * pl),))
        # 10 person icons, 7 fill one by one (7 em cada 10)
        sz, gap = 70, 88
        x0 = W / 2 - gap * 4.5
        for i in range(10):
            pi = ease_back(prog(t, ts + .9 + i * .09, ts + 1.2 + i * .09))
            if pi <= 0: continue
            filled = i < 7 and t > ts + 1.6 + i * .12
            col = (YEL + (255,)) if filled else (WHITE + (90,))
            lay = Image.new("RGBA", (sz + 20, int(sz * 1.3) + 20), (0, 0, 0, 0))
            person_icon(ImageDraw.Draw(lay), (sz + 20) / 2, 10, sz, col)
            affine_place(ov, lay, x0 + i * gap + gap / 2, 1440, scale=max(.05, pi))
        pa = int(220 * ease_out(prog(t, ts + 2.4, ts + 2.8)))
        src = "7 em cada 10  ·  Fonte: IBGE, Pesquisa Nacional de Saúde 2019"
        fsrc = F_SEMI(30); sw = text_w(d, src, fsrc)
        d.text(((W - sw) / 2, 1560), src, font=fsrc, fill=WHITE + (pa,))
    credit(ov, t, a, p["credit"])
    img.alpha_composite(ov)
    return img

def scene_full(fr, t, a, b, p):
    u = ease_in_out(prog(t, a, b))
    base = cover(grade_photo(load(p["img"])), int(W * 1.15), int(H * 1.15), focus=p.get("focus", (.5, .5)))
    sc = 1.0 + 0.08 * u
    img = base.resize((int(base.width * sc), int(base.height * sc)), Image.BILINEAR)
    x = (img.width - W) // 2; y = (img.height - H) // 2 - int(30 * u)
    img = img.crop((x, y, x + W, y + H)).convert("RGBA")
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    grad = Image.linear_gradient("L").resize((W, 700)).point(lambda v: int(v * .8))
    ov.paste(Image.new("RGBA", (W, 700), BLUE + (255,)), (0, H - 700), grad)
    if p.get("cross"):
        # pulsing rings + cross badge
        for r_i in range(3):
            ph = ((t - a) * 0.9 + r_i / 3) % 1.0
            rad = 60 + ph * 260; al = int(200 * (1 - ph))
            ImageDraw.Draw(ov).ellipse([W / 2 - rad, 1450 - rad, W / 2 + rad, 1450 + rad], outline=WHITE + (al,), width=6)
        pc = ease_back(prog(t, a + .2, a + .6))
        if pc > 0:
            lay = Image.new("RGBA", (260, 260), (0, 0, 0, 0))
            ImageDraw.Draw(lay).ellipse([0, 0, 259, 259], fill=BLUE + (255,))
            sus_cross(lay, 130, 130, 140)
            affine_place(ov, lay, W / 2, 1450, scale=max(.05, pc))
    credit(ov, t, a, p["credit"])
    img.alpha_composite(ov)
    return img

RENDER = dict(spk=scene_spk, pan=scene_pan, card=scene_card, stat=scene_stat, full=scene_full)

def transition_fx(img, t):
    """Zoom-through + flash + RGB split on each cut."""
    for c in CUTS:
        dt = t - c
        if 0 <= dt < .30:
            k = 1 - ease_out(dt / .30)
            z = 1 + .16 * k
            img = zoom_frame(img.convert("RGB"), z, .5, .5).convert("RGBA")
            if k > .3:
                r, g, bch, al = img.split(); sh = int(14 * k)
                r = ImageChops.offset(r, sh, 0); bch = ImageChops.offset(bch, -sh, 0)
                img = Image.merge("RGBA", (r, g, bch, al))
            fa = int(150 * max(0, 1 - dt / .12))
            if fa: img.alpha_composite(Image.new("RGBA", img.size, WHITE + (fa,)))
    return img

def main():
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                            "-r", str(FPS), "-i", "-",
                            "-vf", "vignette=PI/5,noise=alls=6:allf=t,format=yuv420p",
                            "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", OUT],
                           stdin=subprocess.PIPE)
    rd = speaker_reader()
    n = int(round((T1 - T0) * FPS))
    for i in range(n):
        t = T0 + i / FPS
        fr = next(rd)
        for (a, b, kind, p) in SCENES:
            if a <= t < b or (kind == SCENES[-1][2] and t >= b and (a, b) == SCENES[-1][:2]):
                img = RENDER[kind](fr, t, a, b, p); break
        img = transition_fx(img, t)
        enc.stdin.write(img.convert("RGB").tobytes())
        if i % 60 == 0: print(f"frame {i}/{n}", flush=True)
    enc.stdin.close(); enc.wait()

if __name__ == "__main__":
    main()
