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

## Phase 2

- **Figures are pure SVG components** (`editor/figures`: NodeFigure, EdgeFigure, Label, Markers)
  shared by the React Flow canvas and the gallery page, so screenshots test the real renderer.
- **Label column excludes the icon on every line** (not only the first): the label box is
  `w - 2*6 - 16 - 2` wide and centred. Narrowing just the first line produced orphaned first
  words and mid-word breaks on 120x55 boxes. Labels never overlap the icon (§8.2/§8.7).
  Line height 1.15em and 4px vertical padding give 3 lines in a default 55px box.
- **Access arrows** (spec "verify"): the relationship always runs from the behaviour/active
  element to the passive object; Read = arrowhead at the source end, Write = at the target,
  ReadWrite = both, Access = none (ArchiMate 3.2 §5.2.1 notation).
- **Nesting relationship set**: kept the spec's list (Composition, Aggregation, Assignment,
  Realization, Specialization) plus `NestingRelationship` connections. Not re-verified against
  the specification text, which is not available offline.
- **Connections to connections** attach to an invisible 1x1 "anchor" node at the target
  connection's midpoint (React Flow edges need node ends). The anchor is recomputed from the
  model on every change.
- **Edges render above nodes** (`zIndex` 1000), like Archi, so connections between nested
  nodes are never hidden behind their container's fill.
- **Stored attachments** (`sourceAttachment`/`targetAttachment`, written by Archi) are used as
  end points while they still lie on the node; once the node has moved away they are ignored
  for rendering (and kept in the model).
- **Viewpoints** come from Archi's `viewpoints.xml` (MIT) via `scripts/convert-viewpoints.mjs`.
  The XSD names three viewpoints Archi does not define (Application Platform, Goal
  Contribution, Principles); they, and custom names, allow all element types. Grouping and
  junctions are allowed in every viewpoint.
- **Theme**: system preference by default; `data-theme="light|dark"` on `<html>` overrides it
  (toolbar toggle in Phase 4). Dark fills keep each layer's hue but darken it.
- **Gallery** is `/?page=gallery`; snapshots live in `e2e/gallery.spec.ts-snapshots/` and are
  platform-specific (Playwright suffixes them with the OS).

## Phase 3

- **Commands use Immer patches**: `apply` records forward/inverse patches, so `invert` is
  exact for every command and redo replays the recorded patches (ids generated in a factory
  stay stable). `compound()` merges recipes into one undo step (e.g. move + re-nest + nesting
  relationship on one drop).
- **Selection lives in the store** (single source of truth). React Flow `select` changes from
  `onNodesChange`/`onEdgesChange` are written to the store and flow back as `selected` flags;
  `onSelectionChange` is not used (two paths raced and dropped selections).
- **Connecting**: dragging from a thin band along any node border; the target (node or
  connection) is found with `elementsFromPoint`, then a menu lists only the valid relationship
  types (§10). Ends that are notes/containers get a plain `Line` connection. Resizing uses the
  four corner handles only, so the borders stay free for connecting.
- **Nesting (§9.4)**: drop target = deepest node under the dropped node's centre (labels and
  junctions cannot be parents). One valid relationship: created silently with an Undo toast;
  several: picker with "Don't create relationship"; existing relationship: just nest; none:
  info toast. With several nodes dropped at once, nesting is visual only (no picker storm).
- **Delete from model** reparents nested child nodes of a removed node to the next ancestor
  instead of deleting them (they show other model elements).
- **Paste**: into a view that does not show the element, nodes reference the existing
  elements (same model objects, across views). Into a view that already shows them (or Ctrl+D),
  elements and the relationships between them are copied.
- **New elements and relationships** go into default folders (§7.5.5). A from-scratch model
  starts with a "Views" folder holding "Default View".
- **Moving nodes drops stored `sourceAttachment`/`targetAttachment`** of their connections
  (they no longer match); bendpoints move when both ends move together.
- **Export via download counts as a save** when there is no file handle (clears the dirty flag
  and the autosave); Save writes through the File System Access handle when available.
- **Fit view runs once when a view opens**; an empty view does not re-fit when its first node
  appears (the viewport would jump under the user's next drop).
- **Dev-only store hook** `window.__editor` (behind `import.meta.env.DEV`) lets E2E tests compare
  model snapshots; it is not in production builds.
- **Alignment/distribution** is scheduled for Phase 4 (listed there in §14).

## Phase 4

- **Icons**: one component per icon in `src/notation/archimate/icons/` (43 icons; Grouping and
  junctions use special renderers). Shapes follow the §8.4 table and were checked visually
  against the ArchiMate 3.2 notation (the specification PDF is not in the repo, so this was a
  check against the notation as published, via the gallery's 3x icon sheet). Stakeholder reuses
  the role cylinder and Deliverable the representation shape, as the spec table says.
- **Palette** shows each type as its box shape in the layer colour with the icon centred.
- **Theme**: toolbar button cycles System → Light → Dark; the choice is a per-browser
  convenience in localStorage (falls back to system when storage is unavailable).
- **Auto-layout** (`core/layout/elk.ts`): ELK layered, DOWN, partitioned by layer
  (strategy/motivation 0, business 1, application 2, technology 3, physical 4,
  implementation 5; Location/Grouping/junctions 1), INCLUDE_CHILDREN, container padding with
  room for the label. The laid-out bounding box is anchored at (20,20) for a whole view, or at
  the selection's previous top-left for "Layout selection". Bendpoints and attachments of the
  laid-out connections are cleared. One command = one undo step. elkjs is loaded lazily and
  pre-bundled for the dev server.
- **Align / distribute**: Arrange menu with left/centre/right/top/middle/bottom (reference = the
  first-selected node) and horizontal/vertical distribution (≥ 3 nodes, outer nodes fixed).
- **Model tree is virtualized** (fixed 22px rows, only the visible window rendered). Rendering
  all 10,000 rows of the 5,000-element model took ~5 s; now the tree costs ~50 ms.
- **Performance targets are measured on the production build** (`vite preview`, Playwright
  project `performance`) with a generated ~5.2 MB model (5,000 elements, 200 views, one view
  with 500 nodes). Typical results on this machine: import 1.5-2.0 s in app (file received →
  first canvas frame; ~2.5 s end-to-end including Playwright pushing the file through the file
  chooser), export 0.3-0.5 s, panning the 500-node view 60 fps. The dev server is slower
  (on-demand module compilation, React StrictMode double rendering) and is not used for these
  numbers. User Timing marks `am:file-picked`, `am:import-start`, `am:import-parsed`,
  `am:import-rendered` are left in for profiling.
