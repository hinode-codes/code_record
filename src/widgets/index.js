/**
 * Flutter-style widgets: small functions that take props and return a DOM element.
 * Compose them like a widget tree. They render plain, unstyled HTML elements.
 */
import { h } from './h.js';

export { h };

export const Text = (text, props = {}) => h('span', props, text);
export const Paragraph = (text, props = {}) => h('p', props, text);
export const Heading = (text, level = 2) => h(`h${level}`, {}, text);

export const Column = (children, { gap = 8, ...props } = {}) =>
  h('div', { ...props, style: { display: 'flex', flexDirection: 'column', gap: `${gap}px`, ...props.style } }, children);

export const Row = (children, { gap = 8, align = 'center', wrap = true, ...props } = {}) =>
  h('div', { ...props, style: { display: 'flex', gap: `${gap}px`, alignItems: align, flexWrap: wrap ? 'wrap' : 'nowrap', ...props.style } }, children);

export const Section = (title, children) => h('fieldset', {}, h('legend', {}, title), Column(children));

export const Button = ({ label, onPressed, disabled = false, type = 'button' }) =>
  h('button', { type, disabled, onclick: onPressed }, label);

export const Link = (href, text) => h('a', { href, 'data-link': true }, text);

const Field = (label, control) => h('label', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } }, label, control);

export const TextField = ({ label, value = '', placeholder = '', type = 'text', onChanged }) =>
  Field(label, h('input', { type, value, placeholder, oninput: (e) => onChanged?.(e.target.value) }));

export const NumberField = ({ label, value, min, max, step = 1, onChanged }) =>
  Field(label, h('input', { type: 'number', value, min, max, step, oninput: (e) => onChanged?.(Number(e.target.value)) }));

export const TextArea = ({ label, value = '', placeholder = '', rows = 5, onChanged }) =>
  Field(label, h('textarea', { rows, placeholder, oninput: (e) => onChanged?.(e.target.value) }, value));

/** options: [[value, label], ...] */
export const Dropdown = ({ label, value, options, onChanged }) =>
  Field(label, h('select', { onchange: (e) => onChanged?.(e.target.value) },
    options.map(([v, text]) => h('option', { value: v, selected: v === value }, text))));

export const Checkbox = ({ label, checked = false, onChanged }) =>
  h('label', {}, h('input', { type: 'checkbox', checked, onchange: (e) => onChanged?.(e.target.checked) }), ' ', label);

export const Grid = (children, { columns = 2, gap = 8 } = {}) =>
  h('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: `${gap}px` } }, children);

/** Show one child at a time: Switcher({ github: el1, local: el2 }, 'github') → { el, show(key) } */
export function Switcher(views, initial) {
  const el = h('div');
  const show = (key) => el.replaceChildren(views[key]);
  show(initial);
  return { el, show };
}
