/**
 * Export worker: renders every frame on an OffscreenCanvas and encodes it with
 * WebCodecs through Mediabunny. Not tied to real time, so a hidden tab doesn't
 * drop frames (it may just run slower).
 *
 * in:  { type: 'start', scene, fps } | { type: 'cancel' }
 * out: { type: 'progress', done, total } | { type: 'done', buffer, codec } | { type: 'error', message } | { type: 'cancelled' }
 */
import {
  Output, Mp4OutputFormat, BufferTarget, CanvasSource, QUALITY_HIGH, getFirstEncodableVideoCodec,
} from 'mediabunny';
import { drawFrame } from '../core/render.js';

let cancelled = false;

self.onmessage = async ({ data }) => {
  if (data.type === 'cancel') { cancelled = true; return; }
  if (data.type !== 'start') return;
  cancelled = false;
  try {
    await exportScene(data.scene, data.fps);
  } catch (err) {
    self.postMessage({ type: 'error', message: err?.message || String(err) });
  }
};

async function exportScene(scene, fps) {
  const { W, H } = scene.o;
  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const codec = await getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width: W, height: H });
  if (!codec) throw new Error('This browser cannot encode video. Try a recent Chrome or Edge.');

  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  const source = new CanvasSource(canvas, { codec, quality: QUALITY_HIGH });
  output.addVideoTrack(source, { frameRate: fps });
  await output.start();

  const tail = 0.5; // hold the last frame briefly so the video doesn't end abruptly
  const totalFrames = Math.ceil((scene.total + tail) * fps);
  for (let i = 0; i < totalFrames; i++) {
    if (cancelled) {
      await output.cancel();
      self.postMessage({ type: 'cancelled' });
      return;
    }
    drawFrame(ctx, scene, Math.min(i / fps, scene.total));
    await source.add(i / fps, 1 / fps); // awaits encoder backpressure
    if (i % 10 === 0) self.postMessage({ type: 'progress', done: i, total: totalFrames });
  }

  await output.finalize();
  const buffer = output.target.buffer;
  self.postMessage({ type: 'done', buffer, codec }, [buffer]);
}
