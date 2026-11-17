/**
 * Token diff: which tokens of `a` match which tokens of `b`.
 * Strategy: strip common prefix/suffix, then LCS on the middle.
 * TODO: replace the middle step with Myers (O(ND)) for big files.
 *
 * Returns { pairs: [[ai, bj]...], removed: [ai...], added: [bj...] }
 */
const MAX_CELLS = 6_000_000; // above this, treat the middle as fully replaced

export function diff(a, b) {
  const n = a.length, m = b.length;
  let s = 0;
  while (s < n && s < m && a[s].text === b[s].text) s++;
  let e = 0;
  while (e < n - s && e < m - s && a[n - 1 - e].text === b[m - 1 - e].text) e++;

  const pairs = [];
  for (let i = 0; i < s; i++) pairs.push([i, i]);

  const A = a.slice(s, n - e), B = b.slice(s, m - e);
  const an = A.length, bn = B.length;
  if (an && bn && an * bn <= MAX_CELLS) {
    const W = bn + 1, dp = new Int32Array((an + 1) * W);
    for (let i = an - 1; i >= 0; i--)
      for (let j = bn - 1; j >= 0; j--)
        dp[i * W + j] = A[i].text === B[j].text
          ? dp[(i + 1) * W + j + 1] + 1
          : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1]);
    let i = 0, j = 0;
    while (i < an && j < bn) {
      if (A[i].text === B[j].text) { pairs.push([s + i, s + j]); i++; j++; }
      else if (dp[(i + 1) * W + j] >= dp[i * W + j + 1]) i++;
      else j++;
    }
  }
  for (let k = 0; k < e; k++) pairs.push([n - e + k, m - e + k]);

  const matchedA = new Set(pairs.map((p) => p[0]));
  const matchedB = new Set(pairs.map((p) => p[1]));
  return {
    pairs,
    removed: a.map((_, i) => i).filter((i) => !matchedA.has(i)),
    added: b.map((_, j) => j).filter((j) => !matchedB.has(j)),
  };
}
