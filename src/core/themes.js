const DARK_UI = { caption: '#f3f5fb', dim: 'rgba(255,255,255,0.55)', track: 'rgba(255,255,255,0.22)' };

export const THEMES = {
  midnight: { name: 'Midnight', bg: ['#1b1d3a', '#3a1f5c'], card: '#0f111a', chrome: '#171a26', title: '#8b93ad',
    hl: 'rgba(130,170,255,0.13)', accent: '#82aaff', ...DARK_UI,
    c: { id: '#d6deeb', kw: '#c792ea', str: '#c3e88d', num: '#f78c6c', com: '#5f6b85', fn: '#82aaff', type: '#ffcb6b', op: '#89ddff', punct: '#a6accd', ln: '#3d4560' } },
  ember: { name: 'Ember', bg: ['#2a1410', '#4a2412'], card: '#1a1210', chrome: '#231915', title: '#a38b7d',
    hl: 'rgba(255,170,120,0.12)', accent: '#ff9e7a', ...DARK_UI,
    c: { id: '#f2e5d7', kw: '#ff8f6b', str: '#e8c96a', num: '#ffb38a', com: '#7a6458', fn: '#ffd28a', type: '#f6a5c0', op: '#ff9e7a', punct: '#c9b5a5', ln: '#55413a' } },
  ocean: { name: 'Ocean', bg: ['#0b2b3a', '#0e4a5c'], card: '#0a1820', chrome: '#10222c', title: '#7fa3b3',
    hl: 'rgba(90,209,230,0.12)', accent: '#5ad1e6', ...DARK_UI,
    c: { id: '#d8eef5', kw: '#5ad1e6', str: '#9be59b', num: '#f5b971', com: '#4f6e7a', fn: '#7ab8ff', type: '#f2d27a', op: '#8de0f0', punct: '#9fbac4', ln: '#2d4954' } },
  paper: { name: 'Paper', bg: ['#dfe7ff', '#fde4f1'], card: '#ffffff', chrome: '#f3f4f7', title: '#6b7280',
    hl: 'rgba(130,80,223,0.09)', accent: '#8250df', caption: '#1f2330', dim: 'rgba(20,24,40,0.55)', track: 'rgba(20,24,40,0.18)',
    c: { id: '#24292f', kw: '#cf222e', str: '#0a3069', num: '#0550ae', com: '#8c959f', fn: '#8250df', type: '#953800', op: '#cf222e', punct: '#57606a', ln: '#c4c9d2' } },
};
