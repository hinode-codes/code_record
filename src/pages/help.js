import { Heading, Paragraph, Link, h } from '../widgets/index.js';
import { buildHistoryCommand } from '../sources/local.js';

export function mount(root) {
  root.append(h('article', {},
    Heading('How it works'),
    Paragraph('CodeRecord turns the commit history of one file into an animated video. Each commit that changed the file becomes a slide; code that stays moves, removed code fades out, new code fades in.'),
    Heading('Sources', 3),
    h('ul', {},
      h('li', {}, h('strong', {}, 'GitHub: '), 'paste owner/repo or a file URL. Public repos work without a token (about 60 requests/hour). For private repos, use a fine-grained token with read-only Contents access. It is only sent to api.github.com and never stored.'),
      h('li', {}, h('strong', {}, 'Local repo: '), 'run the command below in your repo, then open or paste history.txt. Nothing leaves your machine.'),
    ),
    h('pre', {}, buildHistoryCommand('src/app.ts')),
    Heading('Export', 3),
    Paragraph('Export renders every frame in a background worker and encodes an MP4 in your browser. It is faster than real time and keeps going if you switch tabs, but closing or refreshing the tab cancels it.'),
    Paragraph(Link('/', '← Back to the editor')),
  ));
}
