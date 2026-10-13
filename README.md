# ArchiMate Diagram Editor

Browser-based editor for **ArchiMate 3.2** models in **The Open Group ArchiMate Model Exchange
File Format** (XML): import, view and edit diagrams, start from scratch, and export valid
Exchange Format XML with lossless round-trip. Client-only; works offline.

The build specification is `ARCHIMATE_EDITOR_SPEC.md` (source of truth); decisions and
deviations are logged in [DECISIONS.md](DECISIONS.md).

## Getting started

```sh
npm install
npx playwright install chromium   # once, for the E2E tests
npm run dev                       # http://localhost:5173
```

Open an Exchange Format `.xml` file (toolbar **Open**, or drop it on the window), or click
**New model**. Example files are in `fixtures/`.

## Scripts

| Command                                                        | What it does                                                                                                            |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                                                  | Dev server                                                                                                              |
| `npm run build` / `npm run preview`                            | Production build / serve it                                                                                             |
| `npm test`                                                     | Unit tests (Vitest): import/export round-trip and XSD validation of every fixture, commands, validator, layout, figures |
| `npm run e2e`                                                  | Playwright: editing flows, acceptance checks, gallery screenshots, and performance on the production build              |
| `npm run lint` / `npm run typecheck` / `npm run format`        | ESLint / tsc / Prettier                                                                                                 |
| `npm run fixtures:large`                                       | Writes the generated ~5 MB model to `test-data/large-model.xml`                                                         |
| `npm run fixtures:count`                                       | Recomputes `fixtures/expected.json` (hand-check before committing)                                                      |
| `npm run relationships:convert` / `npm run viewpoints:convert` | Regenerate the relationship table / viewpoints from Archi's XML                                                         |

Extra pages: `/?page=gallery` (every figure, light and dark) and `/?page=debug` (raw import
listing).

## Layout

```
src/core/        notation-agnostic model, commands (undo/redo), store, layout, persistence
src/notation/    ArchiMate pack: catalog, relationships, validation, viewpoints, icons,
                 exchange/ (Exchange Format import/export)
src/editor/      canvas (React Flow), figures (pure SVG), panels, toolbar, dialogs, actions
schemas/         Open Group Exchange Format 3.1 XSDs (+ xml.xsd, Dublin Core)
fixtures/        Open Group examples and interop snippets, Archi test files, synthetic cases
```

## Keyboard

Delete/Backspace remove from view · Ctrl/Cmd+Delete delete from model · Ctrl/Cmd+Z / Shift+Z
undo/redo · Ctrl/Cmd+C / V / D copy, paste, duplicate · Ctrl/Cmd+A select all · F2 rename ·
arrows nudge (Shift = 10 px) · Ctrl/Cmd+S save · Ctrl/Cmd+0 fit.

## Third-party data

`src/notation/archimate/relationship-table.json` and `viewpoints.json` are derived from the
[Archi](https://github.com/archimatetool/archi) project's `relationships.xml` and
`viewpoints.xml` (MIT, see `relationship-table.LICENSE.txt`). The XSDs and example models are
published by The Open Group.
