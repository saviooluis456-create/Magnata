/**
 * AI background removal using MediaPipe selfie segmentation (loaded on demand from CDN).
 * Produces a grayscale confidence mask canvas aligned with the source frame.
 */
const TASKS_VERSION = '0.10.14';
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}/wasm`;
const MODULE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}/vision_bundle.mjs`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite';
const MODEL_FALLBACK = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

interface MPMask { width: number; height: number; getAsFloat32Array(): Float32Array; close(): void }
interface MPResult { confidenceMasks?: MPMask[]; close?: () => void }
interface MPSegmenter { segment(img: unknown): MPResult; close(): void }

export class Segmenter {
  ready = false;
  private seg: MPSegmenter | null = null;
  private multiclass = false;
  private canvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  private last: { canvas: HTMLCanvasElement | OffscreenCanvas; width: number; height: number } | null = null;
  private lastAt = -1e9;
  private initP: Promise<void> | null = null;

  init(): Promise<void> {
    if (this.initP) return this.initP;
    this.initP = (async () => {
      const mod = await import(/* @vite-ignore */ MODULE);
      const files = await mod.FilesetResolver.forVisionTasks(WASM);
      const make = (model: string, delegate: 'GPU' | 'CPU') => mod.ImageSegmenter.createFromOptions(files, {
        baseOptions: { modelAssetPath: model, delegate },
        runningMode: 'IMAGE',
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      });
      try { this.seg = await make(MODEL, 'GPU'); this.multiclass = true; }
      catch {
        try { this.seg = await make(MODEL_FALLBACK, 'GPU'); }
        catch { this.seg = await make(MODEL_FALLBACK, 'CPU'); }
      }
      this.ready = true;
    })();
    this.initP.catch(() => { this.initP = null; });
    return this.initP;
  }

  /** Returns a mask canvas (R channel = foreground probability). `throttleMs` limits work in preview. */
  segment(src: CanvasImageSource, now: number, throttleMs = 60) {
    if (!this.seg) return null;
    if (this.last && now - this.lastAt < throttleMs) return this.last;
    try {
      const res = this.seg.segment(src);
      const masks = res.confidenceMasks;
      if (!masks || !masks.length) return this.last;
      const w = masks[0].width, h = masks[0].height;
      // multiclass: index 0 = background; foreground = 1 - background
      const bg = masks[0].getAsFloat32Array();
      if (!this.canvas || this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
      }
      const ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
      const img = ctx.createImageData(w, h);
      for (let i = 0; i < bg.length; i++) {
        const fg = this.multiclass ? 1 - bg[i] : bg[i];
        const v = Math.max(0, Math.min(255, Math.round(fg * 255)));
        const o = i * 4;
        img.data[o] = v; img.data[o + 1] = v; img.data[o + 2] = v; img.data[o + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      masks.forEach((m) => m.close());
      res.close?.();
      this.last = { canvas: this.canvas, width: w, height: h };
      this.lastAt = now;
      return this.last;
    } catch (e) {
      console.warn('segment', e);
      return this.last;
    }
  }

  dispose() {
    try { this.seg?.close(); } catch { /* */ }
    this.seg = null;
    this.ready = false;
  }
}
