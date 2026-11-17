/**
 * drawFrame(ctx, scene, t): pure function of time. No DOM access, so it runs
 * on the preview canvas and on an OffscreenCanvas inside the export worker.
 */
import { FONT, UI_FONT } from './scene.js';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, p) => a + (b - a) * p;
export const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(text.slice(0, mid) + '…').width <= maxW) lo = mid; else hi = mid - 1;
  }
  return text.slice(0, lo) + '…';
}

function background(ctx, o) {
  const g = ctx.createLinearGradient(0, 0, o.W, o.H);
  g.addColorStop(0, o.theme.bg[0]); g.addColorStop(1, o.theme.bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, o.W, o.H);
}

function drawEmpty(ctx, o) {
  background(ctx, o);
  ctx.fillStyle = o.theme.dim;
  ctx.font = `500 34px ${UI_FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Load a file history to start', o.W / 2, o.H / 2);
}

function drawWindow(ctx, S) {
  const { o, card, chromeH } = S, th = o.theme;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 70; ctx.shadowOffsetY = 24;
  roundRect(ctx, card.x, card.y, card.w, card.h, 22);
  ctx.fillStyle = th.card; ctx.fill();
  ctx.restore();
  if (!o.chrome) return;
  ctx.save();
  roundRect(ctx, card.x, card.y, card.w, card.h, 22); ctx.clip();
  ctx.fillStyle = th.chrome; ctx.fillRect(card.x, card.y, card.w, chromeH);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
    ctx.beginPath(); ctx.arc(card.x + 34 + i * 28, card.y + chromeH / 2, 8.5, 0, Math.PI * 2);
    ctx.fillStyle = c; ctx.fill();
  });
  ctx.font = `500 23px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = th.title;
  ctx.fillText(fitText(ctx, S.title, card.w - 260), card.x + card.w / 2, card.y + chromeH / 2);
  ctx.restore();
}

function drawCode(ctx, S, time, seg, a, b, p, e, cam) {
  const { o, raw, trans, tops, R, cw, lh, card, code } = S, th = o.theme;
  const isT = seg.type === 'trans';
  const gutW = S.gutCols * cw;
  const rowY = (line) => code.y + (line - cam) * lh;
  const tx = (col) => code.x + gutW + col * cw;

  ctx.save();
  ctx.beginPath(); ctx.rect(card.x, code.y - 2, card.w, code.h); ctx.clip();
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';

  // highlight lines changed by the previous commit
  if (o.hl && seg.type === 'hold' && a > 0 && S.changed[a].length) {
    const alpha = clamp((time - seg.start) / 0.25) * clamp((seg.end - time) / 0.5);
    if (alpha > 0) {
      ctx.globalAlpha = alpha; ctx.fillStyle = th.hl;
      for (const ln of S.changed[a]) ctx.fillRect(card.x, rowY(ln) - lh * 0.05, card.w, lh);
      ctx.globalAlpha = 1;
    }
  }

  // fold markers: "⋯ 140 unchanged lines"
  const drawMarker = (m, alpha) => {
    if (alpha <= 0.001) return;
    const y = rowY(m.row);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = th.hl; ctx.fillRect(card.x, y + lh * 0.12, card.w, lh * 0.76);
    ctx.fillStyle = th.c.com; ctx.font = `italic ${Math.round(S.fs * 0.8)}px ${FONT}`;
    ctx.fillText(`⋯  ${m.count} unchanged lines`, code.x + gutW, y + lh * 0.22);
  };
  const markerKey = (m) => `${m.row}:${m.start}:${m.count}`;
  if (!isT) raw[a].markers.forEach((m) => drawMarker(m, 1));
  else {
    const keysA = new Set(raw[a].markers.map(markerKey)), keysB = new Set(raw[b].markers.map(markerKey));
    raw[a].markers.forEach((m) => drawMarker(m, keysB.has(markerKey(m)) ? 1 : 1 - e));
    raw[b].markers.forEach((m) => { if (!keysA.has(markerKey(m))) drawMarker(m, e); });
  }
  ctx.globalAlpha = 1;

  if (o.lineNums) {
    // number each visible line on its first visual row (wrapped rows and folded lines stay blank)
    const r = raw[e > 0.5 ? b : a];
    ctx.font = `${S.fs}px ${FONT}`; ctx.fillStyle = th.c.ln; ctx.textAlign = 'right';
    const lo = Math.floor(cam) - 1, hi = Math.ceil(cam) + R + 1;
    for (let ln = 0; ln < r.lineRow.length; ln++) {
      const row = r.lineRow[ln];
      if (row > hi) break;
      if (row >= lo && !r.hiddenLine[ln]) ctx.fillText(String(ln + 1), code.x + gutW - cw * 1.5, rowY(row));
    }
    ctx.textAlign = 'left';
  }

  const drawTok = (tk, x, y, alpha) => {
    if (alpha <= 0.001 || y < code.y - lh * 1.5 || y > code.y + code.h + lh * 0.5) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = th.c[tk.type] || th.c.id;
    ctx.font = `${tk.type === 'com' ? 'italic ' : ''}${S.fs}px ${FONT}`;
    ctx.fillText(tk.text, x, y);
  };

  if (!isT) {
    const intro = o.intro && a === 0 && seg.type === 'hold';
    const ip = clamp((time - seg.start) / 0.8);
    for (const tk of raw[a].toks) {
      if (tk.hidden) continue;
      const q = intro ? ease(clamp(ip * 1.6 - (tk.row - tops[0]) * 0.04)) : 1;
      drawTok(tk, tx(tk.vcol), rowY(tk.row) + (1 - q) * 14, q);
    }
  } else {
    const A = raw[a].toks, B = raw[b].toks, tr = trans[a];
    const out = 1 - ease(clamp(p / 0.35));
    for (const i of tr.removed) if (!A[i].hidden) drawTok(A[i], tx(A[i].vcol), rowY(A[i].row), out);
    for (const [i, j] of tr.pairs) {
      // tokens folding away fade out into the marker; tokens unfolding fade in out of it
      const va = A[i].hidden ? 0 : 1, vb = B[j].hidden ? 0 : 1;
      if (!va && !vb) continue;
      drawTok(B[j], lerp(tx(A[i].vcol), tx(B[j].vcol), e), rowY(lerp(A[i].row, B[j].row, e)), lerp(va, vb, e));
    }
    const inP = ease(clamp((p - 0.55) / 0.45));
    for (const j of tr.added) if (!B[j].hidden) drawTok(B[j], tx(B[j].vcol), rowY(B[j].row) + (1 - inP) * 10, inP);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawCaptions(ctx, S, seg, a, b, p, e) {
  const { o, raw, card } = S, th = o.theme;
  if (!S.capH) return;
  const isT = seg.type === 'trans';
  const cx = o.W / 2, maxW = Math.min(o.W - 120, card.w + 80);
  const capLine = o.port ? 66 : 56, metaLine = o.port ? 70 : 58;
  const y = card.y + card.h + (o.port ? 70 : 52);

  const metaText = (m) => [m.short, m.author, m.date, m.steps > 1 ? `step ${m.step}/${m.steps}` : null].filter(Boolean).join('  ·  ');
  const drawCaption = (m, alpha) => {
    if (!o.caption || alpha <= 0) return;
    ctx.globalAlpha = alpha; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = `600 ${o.port ? 46 : 40}px ${UI_FONT}`; ctx.fillStyle = th.caption;
    ctx.fillText(fitText(ctx, m.caption || '', maxW), cx, y);
  };
  const drawMeta = (m, alpha) => {
    if (!o.meta || alpha <= 0) return;
    ctx.globalAlpha = alpha; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = `500 ${o.port ? 30 : 25}px ${UI_FONT}`; ctx.fillStyle = th.dim;
    ctx.fillText(fitText(ctx, metaText(m), maxW), cx, y + (o.caption ? capLine : 0));
  };
  const ma = raw[a].meta, mb = raw[b].meta;
  const fadeOut = 1 - clamp(p / 0.45), fadeIn = clamp((p - 0.5) / 0.45);
  if (isT && ma.caption !== mb.caption) { drawCaption(ma, fadeOut); drawCaption(mb, fadeIn); }
  else drawCaption(ma, 1); // steps of one commit keep the same caption: don't blink it
  if (isT && metaText(ma) !== metaText(mb)) { drawMeta(ma, fadeOut); drawMeta(mb, fadeIn); }
  else drawMeta(ma, 1);
  ctx.globalAlpha = 1;

  // progress counts commits, not steps
  if (!o.progress || S.nCommits < 2) return;
  const py = y + (o.caption ? capLine : 0) + (o.meta ? metaLine : 10);
  const n = S.nCommits;
  const pos = ma.commit + (isT && mb.commit !== ma.commit ? e : 0);
  const span = Math.min(maxW * 0.8, (n - 1) * (o.port ? 80 : 70));
  const x0 = cx - span / 2, step = span / (n - 1);
  ctx.lineCap = 'round'; ctx.lineWidth = 4;
  ctx.strokeStyle = th.track; ctx.beginPath(); ctx.moveTo(x0, py); ctx.lineTo(x0 + span, py); ctx.stroke();
  ctx.strokeStyle = th.accent; ctx.beginPath(); ctx.moveTo(x0, py); ctx.lineTo(x0 + pos * step, py); ctx.stroke();
  if (n <= 40) for (let i = 0; i < n; i++) {
    ctx.beginPath(); ctx.arc(x0 + i * step, py, 7, 0, Math.PI * 2);
    ctx.fillStyle = i <= pos + 1e-6 ? th.accent : th.track; ctx.fill();
  }
  ctx.beginPath(); ctx.arc(x0 + pos * step, py, 12, 0, Math.PI * 2);
  ctx.strokeStyle = th.accent; ctx.lineWidth = 3; ctx.stroke();
}

export function drawFrame(ctx, S, time) {
  if (S.empty) return drawEmpty(ctx, S.o);
  const seg = S.segs.find((s) => time < s.end) || S.segs[S.segs.length - 1];
  const isT = seg.type === 'trans';
  const a = seg.k, b = isT ? seg.k + 1 : seg.k;
  const p = seg.type === 'hold' ? 0 : clamp((time - seg.start) / (seg.end - seg.start));
  const e = ease(p);
  const cam = lerp(seg.camFrom, seg.camTo, e);
  background(ctx, S.o);
  drawWindow(ctx, S);
  drawCode(ctx, S, time, seg, a, b, isT ? p : 0, isT ? e : 0, cam);
  drawCaptions(ctx, S, seg, a, b, p, e);
}
