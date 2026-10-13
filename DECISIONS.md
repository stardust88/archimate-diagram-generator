# Decisions and deviations

Running log of decisions not fully dictated by `ARCHIMATE_EDITOR_SPEC.md`, and any deviations from it.

## Phase 0

- **Toolchain versions:** latest stable at setup time (React 19, Vite 8, TypeScript 6, Vitest 5,
  ESLint 10 flat config, Playwright 1.64). Spec asks for React 18+; 19 satisfies that.
- **Styling:** CSS modules for components, global CSS variables in `src/styles/global.css`
  (spec §4 allows CSS modules or Tailwind).
- **TS strictness:** `strict` plus `noUncheckedIndexedAccess`, since the model is mostly
  `Record<Id, …>` lookups where missing ids are a real case (dangling references, §7.3).
- **Playwright:** Chromium only for now, dev server on fixed port 5179. Firefox/WebKit projects
  can be added before Phase 3 E2E sign-off (spec §12 browser support).
- **Line endings:** `.gitattributes` forces LF for source but marks `fixtures/` and `schemas/`
  as binary so the user-supplied files are stored byte-for-byte (round-trip comparisons).
