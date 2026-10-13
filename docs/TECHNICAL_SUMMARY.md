# ArchiMate Editor: Technical Summary

Browser-based editor for ArchiMate 3.2 models in The Open Group ArchiMate Model Exchange File
Format. See [ARCHIMATE_EDITOR_SPEC.md](../ARCHIMATE_EDITOR_SPEC.md) for requirements and
[DECISIONS.md](../DECISIONS.md) for design decisions and deviations.

## Architecture

- **Client-only single-page app.** No backend, API, database server or authentication.
  Everything runs in the browser; after the first load it works offline (spec §12).
- **Services at runtime: none.** The app makes no network calls. Production needs only a
  static web server, or a storage bucket behind a CDN.

### Internal modules

| Module | Responsibility |
|---|---|
| `src/core/model` | Notation-agnostic data model (elements, relationships, views, preserved unknown XML) |
| `src/core/commands` | Edit commands with undo/redo (Immer patches; 200-step history) |
| `src/core/store` | App state (Zustand): model, history, selection, open views |
| `src/core/layout` | Auto-layout with ELK, loaded only when first used |
| `src/core/persistence` | Autosave to browser storage; file open and save |
| `src/notation/archimate` | ArchiMate catalog, relationship rules, viewpoints, icons, Exchange Format import/export |
| `src/editor` | Canvas (React Flow), drawing components, panels, toolbar, dialogs, keyboard shortcuts |

## Storage

| What | Where | Notes |
|---|---|---|
| Model files | User's disk | Opened with the File System Access API, so **Save** writes back to the same file (Chrome/Edge). Other browsers fall back to a file picker and a download. |
| Autosave | IndexedDB, key `archimate-editor:autosave` | Saved 1 s after each change; the app offers to restore it on next load. Stays in that browser only. |
| Theme choice | localStorage, key `archimate-editor:theme` | Convenience only; the app works if storage is unavailable. |
| Server-side | None | Nothing ever leaves the browser. |

**File format:** The Open Group ArchiMate Model Exchange File Format, schema 3.1 (ArchiMate 3.2
semantics). Elements, attributes and vendor extensions the editor does not understand are
preserved and written back where they were.

## Tech stack

| Area | Choice (version) |
|---|---|
| Language / build | TypeScript 6.0 (strict), Vite 8.3 |
| UI | React 19.3, CSS modules, CSS variables for light/dark themes |
| Diagram canvas | @xyflow/react (React Flow) 12.12, custom nodes and edges drawn as SVG |
| State | Zustand 5, Immer 11 |
| Layout | elkjs 0.12 (layered algorithm) |
| Browser storage | idb-keyval 6.3 |
| XML | Built into the browser: `DOMParser` to read, `XMLSerializer` to write |
| Tests | Vitest 5 (185 unit tests); Playwright 1.64 (23 end-to-end tests, including gallery screenshots and a production-build performance test); xmllint-wasm 5.3 for schema checks |
| Code quality | ESLint 10, Prettier 3.9 |
| Third-party data | Relationship table and viewpoints derived from [Archi](https://github.com/archimatetool/archi) (MIT licence); Open Group schemas |

## Production build

`npm run build` produces a static `dist/` folder of about 2.1 MB:

| File | Size | Gzipped |
|---|---|---|
| `index.html` | 0.4 KB | — |
| CSS | 32 KB | 6 KB |
| Main JavaScript | 642 KB | 178 KB |
| `elk-*.js` (layout engine) | 1.4 MB | 443 KB |

- The layout engine only downloads the first time someone clicks **Layout**.
- No environment variables or runtime configuration.
- The dev-only test hook (`window.__editor`) is not included in production builds.

### Measured performance

Production build, generated 5.2 MB model with 5,000 elements and 200 views:

| Target (spec §12) | Measured |
|---|---|
| Import under 3 s | 1.3–2.0 s in the app |
| Export under 2 s | 0.3–0.5 s |
| Panning a 500-node view at 50 fps or more | 60 fps |

## Deployment to production

1. **Install and verify** (Node 22):

   ```sh
   npm ci
   npx playwright install --with-deps chromium
   npm run typecheck && npm run lint && npm test && npm run e2e
   ```

2. **Build:** `npm run build`. The output goes to `dist/`.

3. **Host the static files** on any static host: nginx/Apache, S3 + CloudFront, Azure Static
   Web Apps, Netlify or GitHub Pages.
   - **HTTPS is required.** The file-saving API and reliable browser storage only work on
     secure sites.
   - **Caching:** serve `assets/*` with `Cache-Control: public, max-age=31536000, immutable`
     (file names include content hashes), and `index.html` with `no-cache`.
   - **No routing rules needed.** The app has one page; the gallery and debug pages use
     `?page=`.
   - **Hosting under a sub-path** (e.g. `/archimate/`): set `base: '/archimate/'` in
     `vite.config.ts` before building.
   - **Content-Security-Policy:** no `eval` or `new Function` was found in the bundles, so
     `script-src 'self'` should work. Still, test the full policy on staging, especially
     clicking **Layout** and opening and saving files.

4. **Smoke test** the deployed site: open `samples/order-management.xml`, edit something,
   export, re-open the export, and run **Layout**.

5. **Rollback:** redeploy the previous `dist/`. There is nothing on the server to migrate.
   Users' autosaves live in their own browsers.

## Not set up yet

- **No continuous integration pipeline, Dockerfile or git remote.** The repository is local
  only. The steps above are ready to drop into a CI job (GitHub Actions or similar).
- **Only Chromium is tested.** Spec §12 also lists Firefox, Safari and Edge.
- **No error reporting or analytics.** Deliberate: spec §12 rules out network calls at runtime.
- **Build-size warning.** Vite warns about chunks over 500 KB. Expected for the layout engine,
  which already loads only when needed.
