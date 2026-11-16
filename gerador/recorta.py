# Recorta as folhas em elementos individuais (PNG com transparência, aparados e otimizados).
import sys, os, json, glob
from multiprocessing import Pool
from PIL import Image
tmp, CELL, COLS = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
def work(f):
    names = json.load(open(f + '.json')); sh = Image.open(f).convert('RGBA'); n = 0
    for i, out in enumerate(names):
        x, y = (i % COLS) * CELL, (i // COLS) * CELL
        im = sh.crop((x, y, x + CELL, y + CELL)); bb = im.getbbox()
        if not bb: continue
        im = im.crop((max(bb[0] - 6, 0), max(bb[1] - 6, 0), min(bb[2] + 6, CELL), min(bb[3] + 6, CELL)))
        os.makedirs(os.path.dirname(out), exist_ok=True)
        im.quantize(colors=96, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(out, optimize=True); n += 1
    return n
if __name__ == '__main__':
    fs = sorted(glob.glob(os.path.join(tmp, 's*.png')))
    with Pool(4) as p: print('grafismos recortados:', sum(p.map(work, fs)))
