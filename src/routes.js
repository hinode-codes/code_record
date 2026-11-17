export const routes = [
  { path: '/', title: 'Editor', load: () => import('./pages/editor.js') },
  { path: '/help', title: 'Help', load: () => import('./pages/help.js') },
  { path: '*', title: 'Not found', load: () => import('./pages/not-found.js') },
];
