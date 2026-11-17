/**
 * Preview playback on a visible canvas. Only for previewing; export does not
 * use this (export renders frame by frame in a worker).
 */
import { drawFrame } from './core/render.js';

export function createPlayer(canvas, { onTick = () => {}, onPlayingChange = () => {} } = {}) {
  const ctx = canvas.getContext('2d');
  let scene = null, t = 0, playing = false, startedAt = 0, startT = 0, raf = 0;
  let loop = false;

  const total = () => scene?.total ?? 0;

  function draw() {
    if (!scene) return;
    drawFrame(ctx, scene, t);
    onTick(t, total());
  }

  function frame(now) {
    if (!playing) return;
    t = startT + (now - startedAt) / 1000;
    if (t >= total()) {
      if (loop) { startT = 0; startedAt = now; t = 0; }
      else { t = total(); draw(); pause(); return; }
    }
    draw();
    raf = requestAnimationFrame(frame);
  }

  function play() {
    if (!scene || scene.empty) return;
    if (t >= total()) t = 0;
    playing = true; startT = t; startedAt = performance.now();
    onPlayingChange(true);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }

  function pause() {
    playing = false;
    cancelAnimationFrame(raf);
    onPlayingChange(false);
  }

  return {
    setScene(next) {
      scene = next;
      canvas.width = next.o.W; canvas.height = next.o.H;
      t = Math.min(t, total());
      draw();
    },
    play, pause,
    toggle: () => (playing ? pause() : play()),
    seek(time) { pause(); t = Math.max(0, Math.min(total(), time)); draw(); },
    setLoop(v) { loop = v; },
    get playing() { return playing; },
    destroy() { pause(); },
  };
}
