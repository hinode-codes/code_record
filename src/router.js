/**
 * Minimal History API router.
 * routes: [{ path: '/projects/:id', title, load: () => import('./pages/x.js') }, { path: '*', ... }]
 * Each page module exports mount(outlet, ctx) and optionally unmount().
 */
export function createRouter(routes, outlet, { appName = '' } = {}) {
  let current = null;
  let renderId = 0;

  const compiled = routes.map((route) => {
    const keys = [];
    const pattern = route.path === '*' ? null
      : new RegExp(`^${route.path.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)'))}/?$`);
    return { route, keys, pattern };
  });

  function match(pathname) {
    for (const { route, keys, pattern } of compiled) {
      const m = pattern && pathname.match(pattern);
      if (m) return { route, params: Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
    }
    return { route: routes.find((r) => r.path === '*'), params: {} };
  }

  async function render() {
    const id = ++renderId;
    const { route, params } = match(location.pathname);
    const page = await route.load();
    if (id !== renderId) return; // a newer navigation started while loading
    current?.unmount?.();
    outlet.replaceChildren();
    current = page;
    document.title = route.title ? `${route.title} · ${appName}` : appName;
    await page.mount(outlet, { params, query: new URLSearchParams(location.search), navigate });
  }

  function navigate(to, { replace = false } = {}) {
    if (to === location.pathname + location.search) return;
    history[replace ? 'replaceState' : 'pushState'](null, '', to);
    render();
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-link]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    navigate(a.getAttribute('href'));
  });
  addEventListener('popstate', render);

  return { start: render, navigate };
}
