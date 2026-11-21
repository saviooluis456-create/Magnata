/// <reference lib="webworker" />
// Speech-to-text with word timestamps (Whisper via transformers.js, loaded on demand).
const TRANSFORMERS = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2';

interface Req { audio: Float32Array; model: string; language: string | null }
interface Chunk { text: string; timestamp: [number, number | null] }

let cached: { model: string; asr: (a: Float32Array, o: object) => Promise<{ text: string; chunks?: Chunk[] }> } | null = null;

self.onmessage = async (e: MessageEvent<Req>) => {
  const { audio, model, language } = e.data;
  const post = (m: object) => (self as unknown as Worker).postMessage(m);
  try {
    const tf = await import(/* @vite-ignore */ TRANSFORMERS);
    tf.env.allowLocalModels = false;
    if (!cached || cached.model !== model) {
      post({ type: 'status', msg: 'Baixando modelo de IA (apenas na primeira vez)…' });
      const asr = await tf.pipeline('automatic-speech-recognition', model, {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: (p: { status: string; progress?: number; file?: string }) => {
          if (p.status === 'progress' && typeof p.progress === 'number') post({ type: 'download', progress: p.progress / 100, file: p.file });
        },
      });
      cached = { model, asr };
    }
    post({ type: 'status', msg: 'Transcrevendo…' });
    const opts: Record<string, unknown> = { chunk_length_s: 30, stride_length_s: 5, return_timestamps: 'word' };
    if (language) { opts.language = language; opts.task = 'transcribe'; }
    let out: { text: string; chunks?: Chunk[] };
    let wordLevel = true;
    try {
      out = await cached.asr(audio, opts);
    } catch {
      wordLevel = false;
      out = await cached.asr(audio, { ...opts, return_timestamps: true });
    }
    post({ type: 'done', chunks: out.chunks ?? [], text: out.text, wordLevel });
  } catch (err) {
    post({ type: 'error', msg: (err as Error)?.message ?? String(err) });
  }
};
