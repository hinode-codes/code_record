# CodeRecord

Turn a file's git history into an animated code video. Pure frontend: vanilla JS, no framework, no backend.

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # static files in dist/
```

Needs a Chromium-based browser for export (WebCodecs + OffscreenCanvas).

## Structure

```
src/
├─ main.js              boot the router
├─ router.js            History API router (lazy pages, :params, 404)
├─ routes.js
├─ widgets/             Flutter-style building blocks: Column, Row, Section, Button, TextField…
│  ├─ h.js              element factory
│  └─ index.js
├─ pages/               each exports mount(root, ctx) and optional unmount()
├─ editor/              editor page pieces: source, commits, settings, preview, export
├─ core/                no DOM: runs on the main thread and in the worker
│  ├─ tokenize.js       regex tokenizer (swap for tree-sitter later, same token shape)
│  ├─ diff.js           token matching (prefix/suffix trim + LCS; Myers is a TODO)
│  ├─ scene.js          commits + settings → serializable scene (layout, camera, timeline)
│  ├─ render.js         drawFrame(ctx, scene, t): pure function of time
│  └─ themes.js
├─ sources/             github.js, local.js (git command + parser), demo.js
├─ export/
│  ├─ export.worker.js  OffscreenCanvas + Mediabunny → MP4, frame by frame
│  └─ exporter.js       tab guards: title progress, hidden-tab warning, leave prompt
└─ player.js            preview playback (requestAnimationFrame)
```

## Deploying

Any static host works. Configure an SPA fallback so `/help` serves `index.html`
(Netlify `_redirects`: `/* /index.html 200`; Cloudflare Pages does this by default).
