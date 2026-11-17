import { Section, Dropdown, TextField, NumberField, TextArea, Button, Row, Paragraph, Text, Grid, Switcher, h } from '../widgets/index.js';
import { loadGitHubHistory } from '../sources/github.js';
import { buildHistoryCommand, parseHistory } from '../sources/local.js';
import { DEMO } from '../sources/demo.js';

/** Source picker: GitHub, local repo (paste/open history.txt), or demo. */
export function SourcePanel({ onLoaded }) {
  const status = Text('');
  const setStatus = (msg, isError = false) => { status.textContent = msg; status.className = isError ? 'error' : ''; };

  const load = async (fn) => {
    try {
      const { path, commits } = await fn();
      onLoaded(path, commits);
      setStatus(`Loaded ${commits.length} versions of ${path}.`);
    } catch (err) {
      setStatus(err.message || String(err), true);
    }
  };

  // GitHub
  const gh = { repo: '', path: '', branch: '', max: 20, token: '' };
  const ghLoad = Button({
    label: 'Load history',
    onPressed: async () => {
      ghLoad.disabled = true;
      await load(() => loadGitHubHistory({ ...gh, onStatus: (m) => setStatus(m) }));
      ghLoad.disabled = false;
    },
  });
  const githubView = h('div', {}, Grid([
    TextField({ label: 'Repository or file URL', placeholder: 'owner/repo', onChanged: (v) => (gh.repo = v) }),
    TextField({ label: 'File path', placeholder: 'src/app.ts', onChanged: (v) => (gh.path = v) }),
    TextField({ label: 'Branch (optional)', placeholder: 'default', onChanged: (v) => (gh.branch = v) }),
    NumberField({ label: 'Max commits', value: 20, min: 2, max: 100, onChanged: (v) => (gh.max = v) }),
    TextField({ label: 'Token (private repos, not saved)', type: 'password', onChanged: (v) => (gh.token = v) }),
  ]), Row([ghLoad]));

  // Local
  let localPath = 'src/app.ts';
  let pasted = '';
  const cmd = h('pre', {}, buildHistoryCommand(localPath));
  const fileInput = h('input', {
    type: 'file', accept: '.txt,text/plain',
    onchange: async (e) => {
      const f = e.target.files[0];
      if (f) await load(async () => ({ path: localPath, commits: parseHistory(await f.text()) }));
      e.target.value = '';
    },
  });
  const localView = h('div', {},
    TextField({ label: 'File path in your repo', value: localPath, onChanged: (v) => { localPath = v; cmd.textContent = buildHistoryCommand(v); } }),
    Paragraph('Run this in your repo (macOS/Linux, or Git Bash on Windows):'),
    cmd,
    Row([
      Button({ label: 'Copy command', onPressed: () => navigator.clipboard?.writeText(cmd.textContent).then(() => setStatus('Command copied.')) }),
      fileInput,
    ]),
    TextArea({ label: '…or paste history.txt', rows: 4, onChanged: (v) => (pasted = v) }),
    Row([Button({ label: 'Load pasted history', onPressed: () => load(async () => ({ path: localPath, commits: parseHistory(pasted) })) })]),
  );

  // Demo
  const demoView = h('div', {},
    Paragraph('A built-in four-commit history of cart.ts.'),
    Button({ label: 'Load demo', onPressed: () => load(async () => DEMO) }),
  );

  const switcher = Switcher({ github: githubView, local: localView, demo: demoView }, 'github');

  return Section('1. Source', [
    Dropdown({
      label: 'Load from',
      value: 'github',
      options: [['github', 'GitHub'], ['local', 'Local repo'], ['demo', 'Demo']],
      onChanged: (v) => { switcher.show(v); setStatus(''); },
    }),
    switcher.el,
    status,
  ]);
}
