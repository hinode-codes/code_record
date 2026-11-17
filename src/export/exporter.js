/**
 * Runs an export in the worker and guards the tab while it runs:
 * - progress in the tab title
 * - a louder title while the tab is hidden, plus a notice when the user comes back
 * - a "leave site?" prompt on close/refresh
 */
export function startExport(scene, { fps = 60, onProgress = () => {}, onHiddenReturn = () => {} } = {}) {
  const worker = new Worker(new URL('./export.worker.js', import.meta.url), { type: 'module' });
  const originalTitle = document.title;
  let pct = 0;
  let wentHidden = false;

  const setTitle = () => {
    document.title = document.hidden
      ? `⚠ ${pct}% Exporting — keep this tab open`
      : `(${pct}%) Exporting · ${originalTitle}`;
  };
  const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
  const onVisibility = () => {
    if (document.hidden) wentHidden = true;
    else if (wentHidden) { wentHidden = false; onHiddenReturn(); }
    setTitle();
  };

  addEventListener('beforeunload', onBeforeUnload);
  document.addEventListener('visibilitychange', onVisibility);
  setTitle();

  const cleanup = () => {
    removeEventListener('beforeunload', onBeforeUnload);
    document.removeEventListener('visibilitychange', onVisibility);
    document.title = originalTitle;
    worker.terminate();
  };

  const promise = new Promise((resolve, reject) => {
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') {
        pct = Math.floor((data.done / data.total) * 100);
        setTitle();
        onProgress(pct);
      } else if (data.type === 'done') {
        cleanup();
        resolve({ blob: new Blob([data.buffer], { type: 'video/mp4' }), codec: data.codec });
      } else if (data.type === 'cancelled') {
        cleanup();
        resolve(null);
      } else if (data.type === 'error') {
        cleanup();
        reject(new Error(data.message));
      }
    };
    worker.onerror = (e) => { cleanup(); reject(new Error(e.message || 'Export worker crashed.')); };
  });

  worker.postMessage({ type: 'start', scene, fps });
  return { promise, cancel: () => worker.postMessage({ type: 'cancel' }) };
}
