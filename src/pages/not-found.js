import { Heading, Paragraph, Link, h } from '../widgets/index.js';

export function mount(root) {
  root.append(h('div', {}, Heading('Page not found'), Paragraph(Link('/', 'Go to the editor'))));
}
