/**
 * Local repo: the user runs a shell loop that prints every version of a file,
 * then pastes or opens the output here. No token, nothing leaves the machine.
 */
export function buildHistoryCommand(path) {
  const f = (path.trim() || 'src/app.ts').replace(/"/g, '\\"');
  return `f="${f}"; for c in $(git rev-list --reverse HEAD -- "$f"); do echo "@@COMMIT $(git log -1 --date=short --format='%h|%an|%ad|%s' "$c")"; git show "$c:$f" 2>/dev/null; done > history.txt`;
}

export function parseHistory(text) {
  const commits = [];
  let cur = null;
  for (const line of text.replace(/\r/g, '').split('\n')) {
    if (line.startsWith('@@COMMIT ')) {
      if (cur) commits.push(cur);
      const parts = line.slice(9).split('|');
      const [short = '', author = '', date = ''] = parts.splice(0, 3);
      cur = { short, author, date, msg: parts.join('|'), lines: [] };
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  if (cur) commits.push(cur);
  if (!commits.length) throw new Error('No "@@COMMIT" markers found. Paste the full contents of history.txt.');
  return commits.map(({ lines, ...c }) => ({ ...c, code: lines.join('\n') }));
}
