import { Section, Row, Button, Text, Paragraph, h } from '../widgets/index.js';
import { startExport } from '../export/exporter.js';

/** Export button, progress, warnings and the finished video. */
export function ExportPanel({ getScene, getFps, getFileName, onBusy }) {
  const progress = h('progress', { max: 100, value: 0, hidden: true });
  const status = Text('');
  const warning = Paragraph('', { class: 'warning', hidden: true });
  const result = h('div');
  let job = null;

  const exportBtn = Button({ label: 'Export MP4', onPressed: () => run() });
  const cancelBtn = Button({ label: 'Cancel', disabled: true, onPressed: () => job?.cancel() });

  const setBusy = (busy) => {
    exportBtn.disabled = busy; cancelBtn.disabled = !busy; progress.hidden = !busy;
    onBusy(busy);
  };

  async function run() {
    const scene = getScene();
    if (!scene || scene.empty) { status.textContent = 'Load a history first.'; return; }
    if (!('VideoEncoder' in window) || !('OffscreenCanvas' in window)) {
      status.textContent = 'This browser cannot export video. Use a recent Chrome or Edge.'; return;
    }
    result.replaceChildren(); warning.hidden = true;
    status.textContent = 'Exporting… Keep this tab open until it finishes.';
    progress.value = 0;
    setBusy(true);
    const started = performance.now();
    job = startExport(scene, {
      fps: getFps(),
      onProgress: (pct) => { progress.value = pct; status.textContent = `Exporting… ${pct}%. Keep this tab open.`; },
      onHiddenReturn: () => {
        warning.textContent = 'You switched tabs during the export. It kept going, but keep this tab open until it finishes: closing or refreshing it will lose the export.';
        warning.hidden = false;
      },
    });
    try {
      const out = await job.promise;
      if (!out) { status.textContent = 'Export cancelled.'; return; }
      const url = URL.createObjectURL(out.blob);
      const name = `${getFileName()}.mp4`;
      const secs = ((performance.now() - started) / 1000).toFixed(1);
      status.textContent = `Done in ${secs}s: ${(out.blob.size / 1e6).toFixed(1)} MB (${out.codec}).`;
      const link = h('a', { href: url, download: name }, `Download ${name}`);
      result.replaceChildren(h('video', { src: url, controls: true, style: { maxWidth: '480px', display: 'block' } }), link);
      link.click();
    } catch (err) {
      status.textContent = `Export failed: ${err.message}`;
    } finally {
      job = null;
      setBusy(false);
    }
  }

  return Section('4. Export', [Row([exportBtn, cancelBtn, progress]), status, warning, result]);
}
