import { Section, Paragraph, h } from '../widgets/index.js';

/**
 * Checkbox + editable caption per commit, and an expandable list of its changes
 * (hunks) with a checkbox each. Returns { el, setCommits, setHunks }.
 */
export function CommitList({ onChange, onToggleHunk }) {
  const list = h('div', { class: 'commit-list' });
  const hunkBoxes = new Map(); // commit → { details, summary, body }

  const HunkRow = (hk) => h('label', { class: 'hunk' },
    h('input', { type: 'checkbox', checked: hk.on, onchange: (e) => onToggleHunk(hk.key, e.target.checked) }),
    h('small', {}, hk.where), ' ',
    h('code', {}, hk.text || '(blank)'),
  );

  const CommitRow = (c) => {
    const summary = h('summary');
    const body = h('div');
    const details = h('details', { hidden: true }, summary, body);
    hunkBoxes.set(c, { details, summary, body });
    return h('div', {},
      h('label', {},
        h('input', { type: 'checkbox', checked: c.on, onchange: (e) => { c.on = e.target.checked; onChange(); } }),
        h('code', { title: [c.author, c.date].filter(Boolean).join(' · ') }, c.short),
        h('input', { type: 'text', value: c.caption, oninput: (e) => { c.caption = e.target.value; onChange(); } }),
      ),
      details,
    );
  };

  const setCommits = (commits) => {
    hunkBoxes.clear();
    list.replaceChildren(...(commits.length ? commits.map(CommitRow) : [Paragraph('No commits loaded.')]));
  };

  /** hunks: Map(commit → [{ key, on, where, text }]). Only commits with 2+ changes get a list. */
  const setHunks = (hunks) => {
    for (const [c, box] of hunkBoxes) {
      const items = hunks.get(c) ?? [];
      box.details.hidden = items.length < 2;
      if (items.length < 2) continue;
      const on = items.filter((x) => x.on).length;
      box.summary.textContent = `${items.length} changes${on < items.length ? ` (${items.length - on} skipped)` : ''}`;
      box.body.replaceChildren(...items.map(HunkRow));
    }
  };

  setCommits([]);
  const el = Section('2. Commits', [
    list,
    Paragraph('Untick commits to skip them. Expand a commit to choose which changes get their own step; unticked changes are still applied, just without focus.'),
  ]);
  return { el, setCommits, setHunks };
}
