/**
 * Split each commit's change into steps so the viewer sees one change at a time.
 *
 * Between versions A → B we find line hunks. Hunks are grouped into steps
 * (nearby ones together; skipped ones ride along silently with the next step).
 * Step i is "A with every hunk up to the end of group i applied":
 *   B.lines[0 .. end.b1)  +  A.lines[end.a1 ..]
 *
 * Before each step we insert a "prefocus" slide: the old code, focused (scrolled
 * and folded) on where the change is about to happen. The animation from the
 * previous slide to the prefocus slide is a pure scroll/fold; the next one is the edit.
 */
import { diff } from './diff.js';

const range = (s, e) => Array.from({ length: Math.max(0, e - s) }, (_, i) => s + i);

/** Line-level hunks: [{ a0, a1, b0, b1 }] (half-open ranges in A and B). */
export function lineHunks(aLines, bLines) {
  const { pairs } = diff(aLines.map((text) => ({ text })), bLines.map((text) => ({ text })));
  const hunks = [];
  let pi = -1, pj = -1;
  for (const [i, j] of [...pairs, [aLines.length, bLines.length]]) {
    if (i > pi + 1 || j > pj + 1) hunks.push({ a0: pi + 1, a1: i, b0: pj + 1, b1: j });
    pi = i; pj = j;
  }
  return hunks;
}

/** Join hunks separated by at most `gap` unchanged lines (keeps the checkbox list short). */
function joinAdjacent(hunks, gap) {
  const out = [];
  for (const h of hunks) {
    const last = out[out.length - 1];
    if (last && h.b0 - last.b1 <= gap && h.a0 - last.a1 <= gap) { last.a1 = h.a1; last.b1 = h.b1; }
    else out.push({ ...h });
  }
  return out;
}

const size = (h) => Math.max(1, h.b1 - h.b0);

/** Can hunk h join the focus of the current group and still fit on screen? */
function fits(focus, h, { gap, maxRows, foldCtx }) {
  if (foldCtx !== null) {
    // with collapsing: each hunk costs its lines + context, plus one marker row between hunks
    const all = [...focus, h];
    return all.reduce((sum, x) => sum + size(x) + 2 * foldCtx, 0) + (all.length - 1) <= maxRows;
  }
  return h.b0 - focus[focus.length - 1].b1 <= gap && h.b1 - focus[0].b0 <= Math.floor(maxRows * 0.8);
}

function label(h, A, B) {
  const added = B.slice(h.b0, h.b1).find((l) => l.trim());
  const removed = A.slice(h.a0, h.a1).find((l) => l.trim());
  const where = h.b1 - h.b0 > 1 ? `L${h.b0 + 1}–${h.b1}` : `L${h.b0 + 1}`;
  const text = added !== undefined ? added.trim() : `− ${(removed ?? '').trim()}`;
  return { where, text: text.length > 48 ? `${text.slice(0, 47)}…` : text };
}

/** Group hunks into steps. Skipped hunks are applied with the next kept hunk (or the last step). */
function groupHunks(hunks, split, opts) {
  const kept = hunks.filter((h) => h.on);
  if (!split || !kept.length) return [{ hunks, focus: kept.length ? kept : hunks }];
  const groups = [];
  let pending = [];
  for (const h of hunks) {
    if (!h.on) { pending.push(h); continue; }
    const last = groups[groups.length - 1];
    if (last && fits(last.focus, h, opts)) { last.hunks.push(...pending, h); last.focus.push(h); }
    else groups.push({ hunks: [...pending, h], focus: [h] });
    pending = [];
  }
  if (pending.length) groups[groups.length - 1].hunks.push(...pending);
  return groups;
}

/**
 * versions: [{ lines, meta }] in commit order.
 * Returns { slides: [{ lines, meta, hold, focus, prefocus? }], hunksByCommit: [[{ key, on, where, text }]] }
 * focus = line indices (in the slide's own lines) the camera should centre on.
 */
export function expandSteps(versions, { split, gap, maxRows, foldCtx, hold, stepHold, skipped = new Set() }) {
  const slides = [];
  const hunksByCommit = versions.map(() => []);
  const opts = { gap, maxRows, foldCtx };

  versions.forEach((v, k) => {
    if (k === 0) { slides.push({ lines: v.lines, meta: { ...v.meta, step: 1, steps: 1 }, hold, focus: [] }); return; }
    const A = versions[k - 1].lines, B = v.lines;
    const hunks = joinAdjacent(lineHunks(A, B), 2);
    if (!hunks.length) { slides.push({ lines: B, meta: { ...v.meta, step: 1, steps: 1 }, hold, focus: [] }); return; }

    for (const h of hunks) {
      h.key = `${versions[k - 1].meta.short}>${v.meta.short}:${h.a0}-${h.a1}:${h.b0}-${h.b1}`;
      h.on = !skipped.has(h.key);
    }
    hunksByCommit[k] = hunks.map((h) => ({ key: h.key, on: h.on, ...label(h, A, B) }));

    const groups = groupHunks(hunks, split, opts);
    let before = A;
    let prevEnd = { a1: 0, b1: 0 };
    groups.forEach((g, i) => {
      const last = i === groups.length - 1;
      const end = g.hunks[g.hunks.length - 1];
      const lines = last ? B : B.slice(0, end.b1).concat(A.slice(end.a1));
      // where the change sits in the "before" lines (A coordinates shifted by what's already applied)
      const shift = prevEnd.b1 - prevEnd.a1;
      const focusBefore = g.focus.flatMap((h) =>
        h.a1 > h.a0 ? range(h.a0 + shift, h.a1 + shift) : [Math.max(0, Math.min(before.length - 1, h.a0 + shift))]);
      const focusAfter = g.focus.flatMap((h) =>
        h.b1 > h.b0 ? range(h.b0, h.b1) : [Math.max(0, Math.min(lines.length - 1, h.b0))]);

      slides.push({ lines: before, meta: slides[slides.length - 1].meta, hold: 0, focus: focusBefore, prefocus: true });
      slides.push({ lines, meta: { ...v.meta, step: i + 1, steps: groups.length }, hold: last ? hold : stepHold, focus: focusAfter });
      before = lines;
      prevEnd = end;
    });
  });
  return { slides, hunksByCommit };
}
