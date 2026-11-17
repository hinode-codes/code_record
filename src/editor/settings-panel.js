import { Section, Dropdown, NumberField, Checkbox, Grid } from '../widgets/index.js';
import { THEMES } from '../core/themes.js';

/** Style and timing controls. Calls onChange(key, value). */
export function SettingsPanel({ settings, onChange }) {
  const set = (key) => (value) => onChange(key, value);
  return Section('3. Style & timing', [
    Grid([
      Dropdown({ label: 'Theme', value: settings.theme, options: Object.entries(THEMES).map(([k, t]) => [k, t.name]), onChanged: set('theme') }),
      Dropdown({ label: 'Format', value: settings.format, options: [['land', '16:9 (1920×1080)'], ['port', '9:16 Shorts (1080×1920)']], onChanged: set('format') }),
      Dropdown({ label: 'Language', value: settings.lang, onChanged: set('lang'), options: [
        ['auto', 'Auto'], ['js', 'JS / TS'], ['python', 'Python'], ['cpp', 'C / C++'], ['go', 'Go'], ['rust', 'Rust'], ['java', 'Java / C# / Kotlin']] }),
      Dropdown({ label: 'Export FPS', value: String(settings.fps), options: [['30', '30'], ['60', '60']], onChanged: (v) => onChange('fps', Number(v)) }),
      NumberField({ label: 'Visible lines (max)', value: settings.rows, min: 4, max: 60, onChanged: set('rows') }),
      NumberField({ label: 'Min font (px)', value: settings.minFs, min: 12, max: 60, onChanged: set('minFs') }),
      NumberField({ label: 'Max font (px)', value: settings.maxFs, min: 14, max: 80, onChanged: set('maxFs') }),
      NumberField({ label: 'Hold (s)', value: settings.hold, min: 0.3, max: 30, step: 0.1, onChanged: set('hold') }),
      NumberField({ label: 'Hold per step (s)', value: settings.stepHold, min: 0.3, max: 30, step: 0.1, onChanged: set('stepHold') }),
      NumberField({ label: 'Transition (s)', value: settings.trans, min: 0.2, max: 5, step: 0.1, onChanged: set('trans') }),
      NumberField({ label: 'Context lines', value: settings.foldCtx, min: 0, max: 10, onChanged: set('foldCtx') }),
      NumberField({ label: 'Wrap at (columns)', value: settings.wrapCols, min: 20, max: 110, onChanged: set('wrapCols') }),
    ]),
    Grid([
      Checkbox({ label: 'Commit captions', checked: settings.caption, onChanged: set('caption') }),
      Checkbox({ label: 'Hash · author · date', checked: settings.meta, onChanged: set('meta') }),
      Checkbox({ label: 'Progress dots', checked: settings.progress, onChanged: set('progress') }),
      Checkbox({ label: 'Line numbers', checked: settings.lineNums, onChanged: set('lineNums') }),
      Checkbox({ label: 'Highlight changes', checked: settings.hl, onChanged: set('hl') }),
      Checkbox({ label: 'Window chrome', checked: settings.chrome, onChanged: set('chrome') }),
      Checkbox({ label: 'Fade-in intro', checked: settings.intro, onChanged: set('intro') }),
      Checkbox({ label: 'One step per change', checked: settings.split, onChanged: set('split') }),
      Checkbox({ label: 'Collapse unchanged code', checked: settings.fold, onChanged: set('fold') }),
      Checkbox({ label: 'Wrap long lines', checked: settings.wrap, onChanged: set('wrap') }),
    ]),
  ]);
}
