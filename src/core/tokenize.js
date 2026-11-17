/**
 * Regex tokenizer → [{ text, type, line, col }].
 * type: kw | str | num | com | fn | type | op | punct | id
 * Swap this module for a tree-sitter adapter later; keep the same token shape.
 */
const kw = (s) => new Set(s.split(/\s+/));

export const LANGS = {
  js: { line: '//', block: ['/*', '*/'], quotes: '"\'`', multi: '`',
    kw: kw('const let var function return if else for while do switch case break continue new class extends super this import from export default async await try catch finally throw typeof instanceof in of void delete yield static get set interface type enum implements public private protected readonly as keyof declare namespace true false null undefined') },
  python: { line: '#', block: null, quotes: '"\'', multi: '',
    kw: kw('def return if elif else for while in not and or is import from as class pass break continue try except finally raise with lambda yield global nonlocal assert del async await True False None self match case') },
  cpp: { line: '//', block: ['/*', '*/'], quotes: '"\'', multi: '', pp: true,
    kw: kw('int float double char bool void long short unsigned signed auto const constexpr static inline return if else for while do switch case break continue new delete class struct union enum public private protected virtual override template typename namespace using this nullptr true false try catch throw sizeof operator friend explicit noexcept std') },
  go: { line: '//', block: ['/*', '*/'], quotes: '"\'`', multi: '`',
    kw: kw('package import func return if else for range switch case default break continue go defer chan select struct interface map type var const nil true false make new len cap append') },
  rust: { line: '//', block: ['/*', '*/'], quotes: '"', multi: '',
    kw: kw('fn let mut const static return if else match for while loop in break continue struct enum impl trait pub use mod crate self Self super as where move ref async await dyn unsafe type true false Some None Ok Err') },
  java: { line: '//', block: ['/*', '*/'], quotes: '"\'', multi: '',
    kw: kw('public private protected static final abstract class interface enum extends implements return if else for while do switch case break continue new this super try catch finally throw throws void int long double float boolean char byte short var val fun object package import using namespace null true false override') },
};

const EXT = { js: 'js', mjs: 'js', cjs: 'js', jsx: 'js', ts: 'js', tsx: 'js', vue: 'js', svelte: 'js',
  py: 'python', c: 'cpp', h: 'cpp', cc: 'cpp', cpp: 'cpp', cxx: 'cpp', hpp: 'cpp', hh: 'cpp', ino: 'cpp',
  go: 'go', rs: 'rust', java: 'java', cs: 'java', kt: 'java', kts: 'java', swift: 'java', dart: 'java', scala: 'java' };

export const detectLang = (path) => EXT[(path.split('.').pop() || '').toLowerCase()] || 'js';

const OPS = /(===|!==|\*\*=|>>>|<<=|>>=|\.\.\.|=>|==|!=|<=|>=|&&|\|\||::|->|\+\+|--|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|<<|>>|\?\?|\?\.|:=)/y;
const NUM = /(0x[\da-fA-F_]+|\d[\d_]*\.?\d*(?:e[+-]?\d+)?[a-zA-Z]*)/y;
const ID = /[@A-Za-z_$][\w$]*/y;
const PP = /#\s*\w+/y;

export function tokenize(src, langKey) {
  const L = LANGS[langKey] ?? LANGS.js;
  const out = [];
  let line = 0, col = 0, i = 0, atLineStart = true;
  const n = src.length;

  const emit = (text, type) => { out.push({ text, type, line, col }); col += text.length; };
  // Multi-line spans; comments are split into words so they morph nicely.
  const emitSpan = (text, type, splitWords) => {
    text.split('\n').forEach((part, idx) => {
      if (idx > 0) { line++; col = 0; }
      if (!part) return;
      if (!splitWords) return emit(part, type);
      for (const m of part.matchAll(/(\s+)|(\S+)/g)) { if (m[1]) col += m[1].length; else emit(m[2], type); }
    });
  };
  const sticky = (re) => { re.lastIndex = i; return re.exec(src); };

  while (i < n) {
    const ch = src[i];
    if (ch === '\n') { line++; col = 0; i++; atLineStart = true; continue; }
    if (ch === ' ') { col++; i++; continue; }
    const rest = (len) => src.substr(i, len);

    if (L.block && rest(2) === L.block[0]) {
      let end = src.indexOf(L.block[1], i + 2); end = end < 0 ? n : end + 2;
      emitSpan(src.slice(i, end), 'com', true); i = end; atLineStart = false; continue;
    }
    if (rest(L.line.length) === L.line && !(L.pp && atLineStart && ch === '#')) {
      let end = src.indexOf('\n', i); if (end < 0) end = n;
      emitSpan(src.slice(i, end), 'com', true); i = end; continue;
    }
    let m;
    if (L.pp && atLineStart && ch === '#' && (m = sticky(PP))) {
      emit(m[0], 'kw'); i += m[0].length; atLineStart = false; continue;
    }
    atLineStart = false;

    if (langKey === 'python' && (rest(3) === '"""' || rest(3) === "'''")) {
      const q = rest(3); let end = src.indexOf(q, i + 3); end = end < 0 ? n : end + 3;
      emitSpan(src.slice(i, end), 'str', false); i = end; continue;
    }
    if (L.quotes.includes(ch)) {
      let j = i + 1;
      while (j < n && src[j] !== ch) {
        if (src[j] === '\\') j++;
        else if (src[j] === '\n' && !L.multi.includes(ch)) break;
        j++;
      }
      const end = Math.min(n, src[j] === ch ? j + 1 : j);
      emitSpan(src.slice(i, end), 'str', false); i = end; continue;
    }
    if (/\d/.test(ch) && (m = sticky(NUM))) { emit(m[0], 'num'); i += m[0].length; continue; }
    if ((m = sticky(ID))) {
      const word = m[0];
      let k = i + word.length; while (src[k] === ' ') k++;
      let type = 'id';
      if (word[0] === '@' || L.kw.has(word)) type = 'kw';
      else if (src[k] === '(' || (src[k] === '!' && langKey === 'rust')) type = 'fn';
      else if (/^[A-Z]/.test(word)) type = 'type';
      emit(word, type); i += word.length; continue;
    }
    if ((m = sticky(OPS))) { emit(m[0], 'op'); i += m[0].length; continue; }
    emit(ch, /[{}()[\];,.]/.test(ch) ? 'punct' : 'op'); i++;
  }
  return out;
}
