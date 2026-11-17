import { h } from '../widgets/index.js';
import { SourcePanel } from '../editor/source-panel.js';
import { CommitList } from '../editor/commit-list.js';
import { SettingsPanel } from '../editor/settings-panel.js';
import { PreviewPanel } from '../editor/preview-panel.js';
import { ExportPanel } from '../editor/export-panel.js';
import { buildScene, normalizeCommits, monoRatio, DEFAULT_SETTINGS } from '../core/scene.js';
import { DEMO } from '../sources/demo.js';

const SETTINGS_KEY = 'coderecord:settings';

const loadSettings = () => {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
  catch { return { ...DEFAULT_SETTINGS }; }
};
const saveSettings = (s) => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } };

let cleanup = () => {};

export function mount(root) {
  const ratio = monoRatio();
  const state = { path: '', commits: [], settings: loadSettings(), scene: null, busy: false, skipped: new Set() };

  const preview = PreviewPanel();
  const commitList = CommitList({
    onChange: () => scheduleRebuild(),
    onToggleHunk: (key, on) => { if (on) state.skipped.delete(key); else state.skipped.add(key); rebuild(); },
  });

  let timer = 0;
  const rebuild = () => {
    state.scene = buildScene(state.commits, state.path, state.settings, ratio, state.skipped);
    preview.player.setScene(state.scene);
    const selected = state.commits.filter((c) => c.on);
    commitList.setHunks(new Map(selected.map((c, i) => [c, state.scene.hunksByCommit[i] ?? []])));
  };
  const scheduleRebuild = () => { clearTimeout(timer); timer = setTimeout(rebuild, 120); };

  const setHistory = (path, commits) => {
    state.path = path;
    state.commits = normalizeCommits(commits);
    state.skipped.clear();
    commitList.setCommits(state.commits);
    rebuild();
    preview.player.seek(Math.min(1, state.scene.total)); // show the first slide after its fade-in
  };

  const sidebar = h('div', { class: 'sidebar' },
    SourcePanel({ onLoaded: setHistory }),
    commitList.el,
    SettingsPanel({
      settings: state.settings,
      onChange: (key, value) => { state.settings[key] = value; saveSettings(state.settings); scheduleRebuild(); },
    }),
  );

  const exportPanel = ExportPanel({
    getScene: () => state.scene,
    getFps: () => state.settings.fps,
    getFileName: () => `${(state.path.split('/').pop() || 'history').replace(/[^\w.-]+/g, '_')}-history`,
    onBusy: (busy) => {
      state.busy = busy;
      sidebar.querySelectorAll('input, select, textarea, button').forEach((el) => { el.disabled = busy; });
    },
  });

  root.append(h('div', { class: 'editor' }, sidebar, h('div', { class: 'stage' }, preview.el, exportPanel)));

  const onKey = (e) => {
    if (e.code !== 'Space' || state.busy || /INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement?.tagName)) return;
    e.preventDefault();
    preview.player.toggle();
  };
  document.addEventListener('keydown', onKey);
  cleanup = () => { document.removeEventListener('keydown', onKey); preview.player.destroy(); clearTimeout(timer); };

  setHistory(DEMO.path, DEMO.commits);
}

export function unmount() { cleanup(); }
