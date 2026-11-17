/**
 * buildScene(): turns commits + settings into a plain, serializable scene object.
 * Everything the renderer needs is precomputed here, so the same scene can be
 * drawn on the preview canvas (main thread) and in the export worker.
 */
import { tokenize, detectLang } from './tokenize.js';
import { diff } from './diff.js';
import { expandSteps } from './steps.js';
import { THEMES } from './themes.js';

export const FONT = 'ui-monospace, "SF Mono", "JetBrains Mono", "Fira Code", Menlo, Consolas, "Liberation Mono", monospace';
export const UI_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const LINE_H = 1.5;
export const PAD = 40;
export const CHROME_H = 60;

export const DEFAULT_SETTINGS = {
  theme: 'midnight', format: 'land', lang: 'auto',
  rows: 18, minFs: 28, maxFs: 40,
  hold: 2.4, stepHold: 1.4, trans: 1.2, fps: 60,
  wrap: true, wrapCols: 80, split: true, fold: true, foldCtx: 3,
  caption: true, meta: true, progress: true, lineNums: true, hl: true, chrome: true, intro: true,
};

const MERGE_GAP = 8;  // without collapsing: hunks closer than this (in lines) share a step
const MIN_FOLD = 3;   // don't collapse stretches shorter than this

/** Width of one monospace character at 1px font size. */
export function monoRatio() {
  const ctx = new OffscreenCanvas(8, 8).getContext('2d');
  ctx.font = `100px ${FONT}`;
  return ctx.measureText('M'.repeat(10)).width / 1000;
}

/** Collapse empty versions and consecutive duplicates. */
export function normalizeCommits(commits) {
  const out = [];
  for (const c of commits) {
    if (!c.code.trim()) continue;
    if (out.length && out[out.length - 1].code === c.code) continue;
    out.push({ ...c, on: c.on ?? true, caption: c.caption ?? (c.msg || c.short) });
  }
  return out;
}

/** Unchanged stretches to collapse: everything further than `ctx` lines from a focus line. */
function computeFolds(focus, nLines, ctx, enabled, N) {
  if (!enabled || !focus.length || nLines <= N) return [];
  const visible = new Uint8Array(nLines);
  for (const f of focus) for (let i = Math.max(0, f - ctx); i <= Math.min(nLines - 1, f + ctx); i++) visible[i] = 1;
  const folds = [];
  for (let i = 0; i < nLines;) {
    if (visible[i]) { i++; continue; }
    let j = i; while (j < nLines && !visible[j]) j++;
    if (j - i >= MIN_FOLD) folds.push([i, j]);
    else for (let x = i; x < j; x++) visible[x] = 1;
    i = j;
  }
  return folds;
}

/** Break a too-long token (e.g. a long string or URL) into pieces of at most maxLen, preferring natural break points. */
function splitLongToken(t, maxLen) {
  if (t.text.length <= maxLen) return [t];
  const pieces = [];
  let start = 0;
  while (start < t.text.length) {
    let end = Math.min(t.text.length, start + maxLen);
    if (end < t.text.length) {
      const window = t.text.slice(start, end);
      const brk = Math.max(...[' ', '&', '/', '?', ',', '=', '.', '-'].map((c) => window.lastIndexOf(c)));
      if (brk > maxLen * 0.4) end = start + brk + 1;
    }
    pieces.push({ ...t, text: t.text.slice(start, end), col: t.col + start });
    start = end;
  }
  return pieces;
}

/**
 * Visual layout. Each token gets { row, vcol } and `hidden` if it's inside a fold.
 * - folded stretches become one marker row; their tokens sit on that row, hidden
 * - with wrap on, long visible lines continue on following rows, indented (+2)
 */
function layoutRows(toks, lines, wrap, wrapCols, folds) {
  const n = lines.length;
  const lineRow = new Array(n);
  const hiddenLine = new Uint8Array(n);
  const foldEnd = new Map(folds.map(([s, e]) => [s, e]));
  for (const [s, e] of folds) for (let i = s; i < e; i++) hiddenLine[i] = 1;

  const indents = lines.map((l) => Math.min(l.match(/^ */)[0].length, Math.floor(wrapCols / 2)));
  const byLine = Array.from({ length: n }, () => []);
  const out = [];
  for (const t of toks) {
    if (hiddenLine[t.line] || !wrap) { t.hidden = !!hiddenLine[t.line]; byLine[t.line]?.push(t); out.push(t); continue; }
    const room = Math.max(8, wrapCols - (indents[t.line] ?? 0) - 2);
    for (const piece of splitLongToken(t, room)) { piece.hidden = false; byLine[piece.line]?.push(piece); out.push(piece); }
  }

  const markers = [];
  let row = 0;
  for (let ln = 0; ln < n; ln++) {
    if (foldEnd.has(ln)) {
      const end = foldEnd.get(ln);
      markers.push({ row, start: ln, count: end - ln });
      for (let i = ln; i < end; i++) { lineRow[i] = row; for (const t of byLine[i]) { t.row = row; t.vcol = t.col; } }
      row++; ln = end - 1;
      continue;
    }
    lineRow[ln] = row;
    const cont = indents[ln] + 2;
    let rowStartCol = 0, offset = 0, firstOnRow = true;
    for (const t of byLine[ln]) {
      let vcol = t.col - rowStartCol + offset;
      if (wrap && !firstOnRow && vcol + t.text.length > wrapCols) { row++; rowStartCol = t.col; offset = cont; vcol = cont; }
      t.row = row; t.vcol = vcol; firstOnRow = false;
    }
    row++;
  }
  return { toks: out, lineRow, hiddenLine, markers, rows: row };
}

/** Camera top (in rows) that centres the focus rows, clamped to the content. */
function focusTop(focusRows, prevTop, N, totalRows) {
  let top = prevTop;
  if (focusRows.length) {
    const mn = Math.min(...focusRows), mx = Math.max(...focusRows);
    top = mx - mn + 1 <= N ? Math.round((mn + mx + 1) / 2 - N / 2) : mn - 1;
  }
  return Math.max(0, Math.min(Math.max(0, totalRows - N), top));
}

const sameMarkers = (a, b) => a.markers.length === b.markers.length
  && a.markers.every((m, i) => m.start === b.markers[i].start && m.count === b.markers[i].count);

export function buildScene(commits, path, settings, ratio = monoRatio(), skipped = new Set()) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const port = s.format === 'port';
  const o = { ...s, port, W: port ? 1080 : 1920, H: port ? 1920 : 1080, theme: THEMES[s.theme] ?? THEMES.midnight };
  const selected = commits.filter((c) => c.on);
  if (!selected.length) return { o, empty: true, total: 0, hunksByCommit: [] };

  // --- Geometry that doesn't depend on content
  const chromeH = o.chrome ? CHROME_H : 0;
  const capH = o.caption || o.meta || o.progress ? (port ? 300 : 170) : 0;
  const mx = port ? 30 : 90, my = port ? 100 : 40;
  const availW = o.W - 2 * mx - 2 * PAD;
  const availH = o.H - 2 * my - capH - chromeH - 2 * PAD;

  // Readability floor: never go below minFs; show fewer lines instead.
  const minFs = Math.max(12, Math.min(o.minFs, o.maxFs));
  const N = Math.max(4, Math.min(o.rows, Math.floor(availH / (minFs * LINE_H))));

  const versions = selected.map((c, idx) => ({
    lines: c.code.replace(/\r/g, '').replace(/\t/g, '  ').replace(/\s+$/, '').split('\n'),
    meta: { caption: c.caption, short: c.short, author: c.author, date: c.date, commit: idx },
  }));
  const maxLines = Math.max(...versions.map((v) => v.lines.length));
  const gutCols = o.lineNums ? String(maxLines).length + 2 : 0;
  const maxColsFit = Math.max(20, Math.floor(availW / (minFs * ratio)) - gutCols);
  const wrapCols = Math.max(20, Math.min(o.wrapCols, maxColsFit));
  const foldCtx = Math.max(0, Math.round(o.foldCtx));

  // --- Commits → steps (with prefocus slides before each change)
  const { slides, hunksByCommit } = expandSteps(versions, {
    split: o.split, gap: MERGE_GAP, maxRows: N, foldCtx: o.fold ? foldCtx : null,
    hold: o.hold, stepHold: o.stepHold, skipped,
  });

  const lang = o.lang === 'auto' ? detectLang(path) : o.lang;
  let raw = slides.map((sl) => {
    const folds = computeFolds(sl.focus, sl.lines.length, foldCtx, o.fold, N);
    const lay = layoutRows(tokenize(sl.lines.join('\n'), lang), sl.lines, o.wrap, wrapCols, folds);
    const focusRows = sl.focus.map((l) => lay.lineRow[l]).filter((r) => r !== undefined);
    return { ...sl, ...lay, focusRows, focusSet: new Set(sl.focus) };
  });

  // --- Camera follows the focus
  const computeTops = (list) => {
    const tops = [];
    list.forEach((r, k) => tops.push(k === 0 ? focusTop(r.focusRows, 0, N, r.rows) : focusTop(r.focusRows, tops[k - 1], N, r.rows)));
    return tops;
  };
  let tops = computeTops(raw);
  // drop prefocus slides that wouldn't scroll or fold anything
  const keep = raw.map((r, k) => !(r.prefocus && Math.abs(tops[k] - tops[k - 1]) <= 1 && sameMarkers(r, raw[k - 1])));
  raw = raw.filter((_, k) => keep[k]);
  tops = computeTops(raw);

  const trans = [];
  for (let k = 0; k < raw.length - 1; k++) trans.push(diff(raw[k].toks, raw[k + 1].toks));

  // rows to highlight after each edit: new tokens inside the focused change (not silently applied ones)
  const changed = raw.map((r, k) => {
    if (k === 0 || r.prefocus) return [];
    const rows = trans[k - 1].added.map((j) => r.toks[j]).filter((t) => !t.hidden && r.focusSet.has(t.line)).map((t) => t.row);
    return [...new Set(rows)];
  });

  // --- Size the window and font
  const R = Math.min(N, Math.max(...raw.map((r) => r.rows)));
  let cols = 20;
  raw.forEach((r, k) => {
    for (const t of r.toks) if (!t.hidden && t.row >= tops[k] && t.row < tops[k] + R) cols = Math.max(cols, t.vcol + t.text.length);
  });
  cols = Math.min(cols, o.wrap ? wrapCols : maxColsFit);
  const fs = Math.max(10, Math.floor(Math.min(o.maxFs, availW / ((cols + gutCols) * ratio), availH / (R * LINE_H))));
  const cw = fs * ratio, lh = fs * LINE_H;

  const cardW = Math.max((cols + gutCols) * cw + 2 * PAD, Math.min(o.W - 2 * mx, port ? 800 : 900));
  const cardH = R * lh + 2 * PAD + chromeH;
  const card = { x: (o.W - cardW) / 2, y: (o.H - cardH - capH) / 2, w: cardW, h: cardH };
  const code = { x: card.x + PAD, y: card.y + chromeH + PAD, w: cardW - 2 * PAD, h: R * lh };

  // --- Timeline: hold → refocus (scroll/fold, old code) → edit → hold …
  const segs = [];
  let t = 0;
  raw.forEach((r, k) => {
    if (r.hold > 0) segs.push({ type: 'hold', k, start: t, end: (t += r.hold), camFrom: tops[k], camTo: tops[k] });
    if (k === raw.length - 1) return;
    const next = raw[k + 1];
    const dur = next.prefocus ? Math.min(0.9, Math.max(0.5, 0.35 + Math.abs(tops[k + 1] - tops[k]) * 0.015)) : o.trans;
    segs.push({ type: 'trans', k, start: t, end: (t += dur), camFrom: tops[k], camTo: tops[k + 1] });
  });

  // strip helpers the renderer doesn't need (keeps the worker message small)
  raw = raw.map(({ focusSet, focus, ...r }) => r);

  return {
    o, raw, trans, tops, changed, R, fs, cw, lh, gutCols, card, code, chromeH, capH, segs,
    total: t, title: path.split('/').pop() || path, nCommits: selected.length, hunksByCommit,
  };
}
