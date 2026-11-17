import { Row, Button, Text, Checkbox, h } from '../widgets/index.js';
import { createPlayer } from '../player.js';

/** Canvas + play/pause/scrub. Returns { el, player }. */
export function PreviewPanel() {
  const canvas = h('canvas', { class: 'preview', width: 1920, height: 1080 });
  const time = Text('0.0 / 0.0 s');
  const playBtn = Button({ label: 'Play', onPressed: () => player.toggle() });
  let scrubbing = false;
  const scrub = h('input', {
    type: 'range', min: 0, max: 1000, value: 0,
    oninput: (e) => { scrubbing = true; player.seek((e.target.value / 1000) * total); scrubbing = false; },
  });
  let total = 0;

  const player = createPlayer(canvas, {
    onTick: (t, tot) => {
      total = tot;
      time.textContent = `${t.toFixed(1)} / ${tot.toFixed(1)} s`;
      if (!scrubbing) scrub.value = tot ? Math.round((t / tot) * 1000) : 0;
    },
    onPlayingChange: (playing) => { playBtn.textContent = playing ? 'Pause' : 'Play'; },
  });

  const el = h('div', {},
    canvas,
    Row([playBtn, scrub, time, Checkbox({ label: 'Loop', onChanged: (v) => player.setLoop(v) })], { wrap: false }),
  );
  return { el, player };
}
