/**
 * Load a file's history from GitHub's REST API, straight from the browser.
 * The token (optional) is sent only to api.github.com and never stored.
 */
export function parseGitHubInput(repoInput, pathInput = '', branchInput = '') {
  let path = pathInput.trim().replace(/^\/+/, '');
  let branch = branchInput.trim();
  const repo = repoInput.trim();
  const m = /github\.com\/([^/\s]+)\/([^/\s#?]+)(?:\/(?:blob|tree)\/([^/\s]+)\/([^\s#?]+))?/.exec(repo);
  let owner, name;
  if (m) {
    owner = m[1]; name = m[2].replace(/\.git$/, '');
    if (m[3] && !branch) branch = m[3];
    if (m[4] && !path) path = m[4];
  } else {
    [owner, name] = repo.split('/');
  }
  return { owner, name, path, branch };
}

async function ghError(res) {
  if ((res.status === 403 || res.status === 429) && res.headers.get('x-ratelimit-remaining') === '0')
    return 'GitHub rate limit reached. Add a token or wait an hour.';
  if (res.status === 404) return 'Not found. Check the repo, branch and path, or add a token if the repo is private.';
  if (res.status === 401) return 'The token was rejected.';
  let detail = '';
  try { detail = (await res.json()).message || ''; } catch { /* not JSON */ }
  return `GitHub error ${res.status}${detail ? `: ${detail}` : ''}`;
}

export async function loadGitHubHistory({ repo, path: pathIn, branch: branchIn, max = 20, token = '', onStatus = () => {} }) {
  const { owner, name, path, branch } = parseGitHubInput(repo, pathIn, branchIn);
  if (!owner || !name || !path) throw new Error('Enter owner/repo (or a GitHub file URL) and a file path.');

  const headers = (accept) => ({ Accept: accept, ...(token ? { Authorization: `Bearer ${token}` } : {}) });
  const api = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
  const limit = Math.max(2, Math.min(100, max));

  onStatus('Fetching commit list…');
  const query = `path=${encodeURIComponent(path)}&per_page=${limit}${branch ? `&sha=${encodeURIComponent(branch)}` : ''}`;
  const res = await fetch(`${api}/commits?${query}`, { headers: headers('application/vnd.github+json') });
  if (!res.ok) throw new Error(await ghError(res));
  const list = (await res.json()).slice(0, limit).reverse();
  if (!list.length) throw new Error('No commits touch that path. Paths are case-sensitive.');

  const encPath = path.split('/').map(encodeURIComponent).join('/');
  const commits = new Array(list.length);
  let done = 0;
  const fetchOne = async (i) => {
    const c = list[i];
    const r = await fetch(`${api}/contents/${encPath}?ref=${c.sha}`, { headers: headers('application/vnd.github.raw+json') });
    let code = '';
    if (r.ok) code = await r.text();
    else if (r.status !== 404) throw new Error(await ghError(r)); // 404 = file absent at that commit
    const author = c.commit?.author;
    commits[i] = {
      short: c.sha.slice(0, 7),
      author: author?.name || c.author?.login || '',
      date: (author?.date || '').slice(0, 10),
      msg: (c.commit?.message || '').split('\n')[0],
      code,
    };
    onStatus(`Fetching file versions… ${++done}/${list.length}`);
  };
  // 4 parallel lanes keeps it quick without hammering the API
  const lanes = [0, 1, 2, 3].map((lane) => (async () => {
    for (let i = lane; i < list.length; i += 4) await fetchOne(i);
  })());
  await Promise.all(lanes);
  return { path, commits };
}
