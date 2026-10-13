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

## Phase 1

### External assets (fetched by Claude Code, not supplied by the user)

The user asked to continue without supplying assets, so they were fetched from their official
public sources:

- `schemas/archimate3_{Model,View,Diagram}.xsd`: https://www.opengroup.org/xsd/archimate/3.1/
  (Exchange Format 3.1; namespace URI is still `http://www.opengroup.org/xsd/archimate/3.0/`).
- `schemas/dc.xsd`: Open Group's Dublin Core schema (same folder), needed because the Open
  Group examples use `dc:*` inside `<metadata>` and the schema's wildcard is `strict`.
- `schemas/xml.xsd`: https://www.w3.org/2001/xml.xsd. Validation rewrites the remote
  `schemaLocation` to this local copy so tests run offline.
- `fixtures/opengroup/`: the five Open Group examples plus the ten "Interoperability testing
  snippets" from https://www.opengroup.org/xsd/archimate/3.1/examples/ (real files exported by
  different tools: nesting, bendpoints, styles, junctions, Dublin Core metadata).
- `fixtures/archi/`: `Sample1.xml`, `bendpoint.test.xml` from Archi's test data (MIT).
- `scripts/data/archi-relationships.xml`: Archi's relationship table (MIT, ArchiMate 3.2).
  Converted by `scripts/convert-relationships.mjs`; license kept in
  `src/notation/archimate/relationship-table.LICENSE.txt`.
- The Archisurance model in Exchange Format sits behind an Open Group login, so it is not
  included. The "large model" is generated (`src/test/large-model.ts`, 5,000 elements /
  200 views; `npm run fixtures:large` writes it to `test-data/`).

### Verified against the XSD (spec "verify" items)

- **Model child order** is `name, documentation, ##other, properties, metadata, elements,
relationships, organizations*, propertyDefinitions, views`. **Spec §7.5.1 lists metadata
  before properties; the XSD puts properties first.** The exporter follows the XSD.
- `organizations` may repeat; several blocks are kept apart (`organizationSections`).
- Influence attribute is `modifier` (`InfluenceModifierType`); Access `accessType` defaults to
  `Access`; Association `isDirected` defaults to `false`. Absent attributes stay absent.
- `style` children are an `xs:all`, so any order is valid. Imported order is kept (`Style.order`)
  because Model_View.xml writes `lineColor` before `fillColor`.
- Colour alpha `a` is 0-100, not 0-255. Node `x/y` are non-negative integers and `w/h` positive
  integers; the exporter rounds and clamps.
- `<view>` may omit `xsi:type` (Archi's `bendpoint.test.xml` does): the element is declared with
  type `Diagram`. Omission is remembered (`extra.xsiType = null`).
- Nested node coordinates are absolute (interop-snippet-03: child at 464,132 in parent at 456,84).

### Data-model deviations from the §6 sketch

- **All view nodes carry `label?` and `documentation?`** (the XSD allows `<label>` on every node;
  Label nodes use it as their text). The spec's `text` field on label nodes is `label` here.
- **Connections carry `label?`, `documentation?`, `sourceAttachment?`, `targetAttachment?`**
  (from the XSD; Archi writes attachments).
- **`OrgItem` is one type** with optional `identifier`, `ref`, `label`, `documentation`, `items`
  instead of a folder/ref union: the XSD allows all of them on any `<item>`.
- `PropertyDefinition` has `documentation?` and `extra?`; `Style` has `extra?`.
- **`metadata` is an opaque serialized string**, not `PreservedXml`.
- **`Model.primaryLang`** is stored (most common `xml:lang` on names).
- **`containerExtra`** holds unknown content of `<elements>`, `<views>`, ... (e.g. `<viewpoints>`),
  plus objects with duplicate or missing identifiers, so nothing is dropped.
- **Dangling view references are kept in `nodes`/`connections`**, not moved to `extra`; the
  canvas skips them. Same effect (hidden but exported), simpler commands.
- `PreservedXml.children[].after` holds the name of the known sibling the unknown element
  followed; the exporter walks XSD sequence slots and re-inserts at that anchor.
- Comments and whitespace inside the model are not preserved (not model data).

### Unknown types

Unknown element/relationship `xsi:type`s become `type: "Unknown:<original>"`, are allowed any
relationship by the validator (nothing to check against), and export unchanged.
