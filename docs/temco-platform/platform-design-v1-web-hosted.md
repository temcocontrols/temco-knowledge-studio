# TEMCO Platform — Product & Technical Design

**Version:** 2.0
**Status:** Authoritative. Supersedes the file-explorer-shaped design.
**Audience:** an AI code generator, and the humans who will review its output.

---

## 0. How to use this document

This document is written to be handed to a code-generating AI. Read it in this order and do not skip ahead:

1. **§1–§5** are the *domain*. Get these wrong and everything above them is wrong.
2. **§6–§7** are the *skeleton*: stack, folders, boundaries.
3. **§8–§10** are the *shell and design system*: every pixel is a Fluent UI token.
4. **§11** is the *screen inventory*. Each screen has an ASCII layout, its components, its states and its acceptance criteria.
5. **§12–§15** are *plumbing*: state, API, flows.
6. **§16–§20** are *quality*: keyboard, performance, testing, roadmap, definition of done.

### Rules for the generator

- **Do not invent a domain concept.** If a screen seems to need something not in §5, stop and report it.
- **Do not use raw pixel values.** Every size, colour, radius and font comes from a Fluent token (§9).
- **Do not put business logic in a component.** Components render; services decide (§7).
- **Build vertically.** One screen, complete and tested, before the next. §19 fixes the order.
- **Every screen in §11 has acceptance criteria.** A screen without passing criteria is not done.

---

## 1. Vision

TEMCO Platform is an **engineering operating system** for TEMCO Controls' products.

It is **not** a documentation tool, **not** a knowledge base, and **not** a VS Code fork. Documentation is one of the
things it manages, and the editor is one of the tools it hosts.

It manages, for every product:

| Group | What it holds |
|---|---|
| **Documentation** | guides, tutorials, architecture, APIs, release notes, troubleshooting, standards, references |
| **Hardware** | controllers, inputs, outputs, variables, programs, schedules, trends, alarms, graphics |
| **Software** | firmware, libraries, repositories, templates |
| **Delivery** | releases, builds, publications, downloads |
| **Knowledge** | the search index, the graph, the AI corpus |

All of it is reachable from one window, in one mental model, with one search box.

### 1.1 The ten-year test

An architecture is right if it still makes sense when the tools underneath it are replaced. That means:

- **No editor knows about a file extension.** Editors declare what they can open (§5.3).
- **No screen knows about a folder.** Screens show *products* and *assets*.
- **No feature knows about a format.** Publishing takes assets and produces outputs.
- **Nothing is identified by a path.** Everything has a stable id (§5.2).

If ONLYOFFICE is replaced by LibreOffice, one file changes. If DocFX is replaced by a static generator, one file changes.
If VS Code is replaced by a web shell, one adapter changes.

### 1.2 Non-goals

Explicitly out of scope, so the generator does not build them:

- Multi-tenant hosting, accounts, billing.
- Real-time collaborative editing.
- Mobile-native apps (responsive web is enough).
- Being a general-purpose IDE.

---

## 2. Principles

| # | Principle | Consequence in code |
|---|---|---|
| P1 | **Products, not folders** | Navigation is driven by `Product`, never by a directory listing |
| P2 | **Everything is an Asset** | One `Asset` union; one registry; one search index |
| P3 | **Editors are plugins** | `EditorContribution` registry; no `switch` on file type in UI code |
| P4 | **Publishing is a pipeline** | `Publication` is a state machine, not a button |
| P5 | **Knowledge is derived** | Search graph and AI index are built from assets, never authored |
| P6 | **Fluent UI only** | Tokens for every value; no bespoke visual language |
| P7 | **Local-first** | All data on disk; network is optional |
| P8 | **Keyboard-complete** | Every action reachable without a mouse (§16) |

---

## 3. System architecture

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              TEMCO PLATFORM (shell)                                  │
│                                                                                      │
│   React 19 + TypeScript + Fluent UI v9 + Vite                                        │
│                                                                                      │
│   ┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────────┐   │
│   │  Products    │ Documentation│   Hardware   │   Delivery   │    Knowledge     │   │
│   │  workspace   │  workspace   │  workspace   │  workspace   │    workspace     │   │
│   └──────┬───────┴──────┬───────┴──────┬───────┴──────┬───────┴────────┬─────────┘   │
│          │              │              │              │                │             │
│   ┌──────▼──────────────▼──────────────▼──────────────▼────────────────▼─────────┐   │
│   │                         Application services (TS)                            │   │
│   │  ProductService  AssetService  EditorHost  PublishService  SearchService      │   │
│   │  KnowledgeService  ReleaseService  DeviceService                              │   │
│   └──────┬──────────────┬──────────────┬──────────────┬────────────────┬──────────┘   │
│          │              │              │              │                │              │
│   ┌──────▼───────┐ ┌────▼─────────┐ ┌──▼──────────┐ ┌─▼────────────┐ ┌─▼───────────┐  │
│   │  Store       │ │ Editor host  │ │ Build runner│ │ Search index │ │ AI gateway  │  │
│   │  (SQLite)    │ │ (iframes)    │ │ (child proc)│ │ (SQLite FTS) │ │ (local LLM) │  │
│   └──────────────┘ └──────────────┘ └─────────────┘ └──────────────┘ └─────────────┘  │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
            │                    │                      │                    │
            ▼                    ▼                      ▼                    ▼
   ┌────────────────┐   ┌─────────────────┐   ┌──────────────────┐  ┌──────────────────┐
   │ TEMCO Learn    │   │ TEMCO Build     │   │ Git repositories │  │ Device profiles  │
   │ public site    │   │ docfx/pdf/chm   │   │ (sources)        │  │ (T3000, BACnet)  │
   └────────────────┘   └─────────────────┘   └──────────────────┘  └──────────────────┘
```

### 3.1 Process boundaries

| Process | Owns | Why separate |
|---|---|---|
| **Renderer** | UI, editor iframes | Cannot touch disk; crashes are cheap |
| **Main / Node** | Store, files, git, child processes | Needs Node; must survive a renderer reload |
| **Editor iframes** | Third-party editors (ONLYOFFICE, Draw.io, Monaco) | Untrusted; isolated `sandbox`; talk over `postMessage` |
| **Build runner** | docfx, PDF, CHM | Blocking, long-running, may be missing |

The renderer never reads a file directly. It calls a service; the service calls the main process over IPC.

---

## 4. The five core concepts

Everything in the platform is one of five things. If a feature does not fit one of them, it is not a feature — it is a
detail of one of them.

```text
   ┌───────────┐       owns        ┌───────────┐      opens with      ┌──────────────┐
   │  PRODUCT  │──────────────────▶│   ASSET   │────────────────────▶│ EDITOR HOST  │
   └─────┬─────┘                   └─────┬─────┘                     └──────────────┘
         │                               │
         │ produces                      │ indexed into
         ▼                               ▼
   ┌───────────┐                   ┌───────────┐
   │PUBLICATION│◀──────────────────│ KNOWLEDGE │
   └───────────┘   built from      └───────────┘
```

| Concept | One sentence | Where it lives |
|---|---|---|
| **Product** | The thing the customer buys: T3000, T3-ESP, CM5 | `store.products` |
| **Asset** | Any unit of work that has identity, content and a history | `store.assets` |
| **Editor Host** | The thing that renders an asset for editing or reading | `editors/` registry |
| **Publication** | A frozen, built, reviewable version of a set of assets | `store.publications` |
| **Knowledge** | Search + graph + AI index derived from assets | derived, rebuildable |

---

## 5. Domain model

### 5.1 Product

```ts
export interface Product {
  readonly id: ProductId;              // 't3000'
  readonly name: string;               // 'T3000'
  readonly tagline: string;            // one line, shown under the name
  readonly status: 'active' | 'maintenance' | 'eol' | 'concept';
  readonly latestVersion?: string;     // '13.0'
  readonly ltsVersion?: string;        // '12.8'
  readonly assets: AssetId[];          // every asset belonging to it
  readonly sources: SourceId[];        // git repos, folders, feeds
  readonly createdAt: Iso;
  readonly updatedAt: Iso;
}
```

### 5.2 Asset — the union

Every asset has the same envelope and a discriminated payload.

```ts
export type AssetKind =
  | 'document' | 'spreadsheet' | 'presentation' | 'diagram'
  | 'firmware' | 'library' | 'repository' | 'template'
  | 'release' | 'download'
  | 'controller' | 'io-point' | 'variable' | 'program' | 'schedule' | 'graphic';

export interface AssetBase {
  readonly id: AssetId;                // stable, opaque: 'ast_7f3c…'
  readonly productId: ProductId;
  readonly kind: AssetKind;
  readonly name: string;               // 'Point Scaling'
  readonly slug: string;               // 'point-scaling'
  readonly area: AreaId;               // 'documentation/guides' — a taxonomy id, not a path
  readonly order: number;              // 10, 20, 30 …
  readonly status: 'draft' | 'in-review' | 'approved' | 'published' | 'retired';
  readonly owner?: string;
  readonly tags: string[];
  readonly createdAt: Iso;
  readonly updatedAt: Iso;
  readonly revision: number;           // monotonically increasing
  readonly checksum: string;           // sha256 of content, for the index
}

export interface DocumentAsset extends AssetBase {
  readonly kind: 'document';
  readonly format: 'md' | 'mdx';
  readonly content: string;            // Markdown source of truth
}

export interface BinaryAsset extends AssetBase {
  readonly kind: 'firmware' | 'library' | 'download' | 'presentation' | 'spreadsheet' | 'diagram';
  readonly fileName: string;
  readonly byteSize: number;
  readonly mimeType: string;
  readonly storage: BlobRef;           // not the bytes
}

export interface HardwareAsset extends AssetBase {
  readonly kind: 'controller' | 'io-point' | 'variable' | 'program' | 'schedule' | 'graphic';
  readonly definition: Record<string, unknown>;  // per-kind schema, §5.2.1
}

export type Asset = DocumentAsset | BinaryAsset | HardwareAsset;
```

**Why `order: 10, 20, 30`:** it leaves room to insert a page between two others without renumbering the set, which is
the single most common editorial operation.

#### 5.2.1 Hardware definition schemas (Phase 4)

Kept deliberately thin now so the shape exists:

```ts
export interface IoPointDefinition {
  readonly number: number;             // 1..n
  readonly type: 'ai' | 'ao' | 'bi' | 'bo' | 'universal';
  readonly units?: string;             // 'V', 'mA', '°C'
  readonly range?: { min: number; max: number };
  readonly description: string;        // links to a DocumentAsset by id
}

export interface VariableDefinition {
  readonly name: string;               // 'SETPOINT_1'
  readonly dataType: 'number' | 'string' | 'boolean' | 'enum';
  readonly writable: boolean;
  readonly descriptionAssetId?: AssetId;
}
```

### 5.3 Editor Host — the contract

This is the concept that keeps the platform ten-year-proof. The UI never asks "what extension is this?".

```ts
export interface EditorContribution {
  readonly id: string;                       // 'editor.markdown'
  readonly title: string;                    // 'Document'  — shown to the user, never the library name
  /** Ordered: first match wins. Pure, cheap, no I/O. */
  matches(asset: Asset): number;             // 0 = no, higher = better
  /** Can this editor create a new asset of this kind? */
  readonly creates?: AssetKind[];
  readonly capabilities: EditorCapabilities;
  readonly Component: React.ComponentType<EditorProps>;
}

export interface EditorCapabilities {
  readonly editing: boolean;
  readonly preview: boolean;                 // can show a read-only rendered view
  readonly outline: boolean;                 // can report headings / structure
  readonly export: readonly ('md' | 'html' | 'pdf' | 'docx')[];
  readonly needs: readonly ('network' | 'office' | 'plugin')[];
}

export interface EditorProps {
  readonly asset: Asset;
  readonly mode: 'edit' | 'read';
  readonly onChange(content: string | Uint8Array): void;
  readonly onOutline(outline: OutlineEntry[]): void;
  readonly onSelection?(selection: EditorSelection): void;
  readonly theme: ThemeName;
}
```

**Resolution order** (implemented once, in `EditorHost.resolve`):

1. An explicit `asset.editorId` override, if set and still installed.
2. Highest `matches()` score.
3. The fallback: a read-only **Preview** editor — the asset is still readable, never a dead end.

Editors shipping in Phase 1–2, and what each is *called in the UI*:

| UI name | Implementation | Matches | Notes |
|---|---|---|---|
| **Document** | Tiptap (Markdown in, Markdown out) | `kind === 'document'` | Byte-identical round trip is a hard requirement |
| **Source** | Monaco | any `document` | Plain text, no round trip |
| **Spreadsheet** | ONLYOFFICE (embedded) | `spreadsheet` | Phase 2 |
| **Diagram** | Draw.io (embedded) | `diagram` | Phase 2 |
| **PDF** | PDF.js | `.pdf` download | Phase 2 |
| **Preview** | own renderer | everything | Always available |
| **Download** | none | `firmware`, `library` | Not an editor: an asset you fetch |

### 5.4 Documentation model

Documentation is **not** a folder tree on disk. It is a taxonomy of areas, defined per product:

```ts
export interface Area {
  readonly id: AreaId;                 // 'guides'
  readonly title: string;              // 'Guides'
  readonly parent?: AreaId;
  readonly order: number;
  readonly description?: string;
}
```

The default taxonomy, used by every product until it says otherwise:

```text
Documentation
├── Overview
├── Guides
├── Tutorials
├── Architecture
├── APIs
├── Release Notes
├── Troubleshooting
├── Standards
└── References
```

A page is a `DocumentAsset` whose `area` points at one of these. Files on disk are an **implementation detail of the
store**: the generator may keep them as Markdown under `products/<product>/<area>/<slug>.md`, and that is fine — but no
UI component may ever construct or parse such a path.

### 5.5 Publication and Release

```ts
export interface Publication {
  readonly id: PublicationId;
  readonly productId: ProductId;
  readonly version: string;              // '13.0'
  readonly channel: 'stable' | 'lts' | 'beta';
  readonly state: PublicationState;
  readonly assetIds: AssetId[];          // frozen at `built`
  readonly outputs: OutputArtifact[];
  readonly review: ReviewRecord;
  readonly createdAt: Iso;
  readonly builtAt?: Iso;
  readonly publishedAt?: Iso;
}

export type PublicationState =
  | 'draft'        // collecting assets
  | 'in-review'    // waiting for approval
  | 'approved'     // frozen, ready to build
  | 'building'     // runner working
  | 'built'        // outputs exist, not public
  | 'published'    // live on Learn
  | 'failed';      // see outputs[].error

export interface OutputArtifact {
  readonly kind: 'website' | 'pdf' | 'chm' | 'docx' | 'zip' | 'search-index';
  readonly path: string;
  readonly byteSize: number;
  readonly checksum: string;
  readonly error?: string;               // present when this target failed
}
```

**Invariants** — the generator must enforce these in the service layer, not the UI:

1. A publication is immutable once `built`. A correction is a new publication.
2. `published` requires every required output to exist and have a checksum.
3. A failed target does not abort the others; it marks the state `failed` only if a **required** target failed.

### 5.6 Knowledge

Derived, never authored, and always rebuildable from assets.

```ts
export interface KnowledgeChunk {
  readonly id: string;
  readonly assetId: AssetId;
  readonly productId: ProductId;
  readonly area: AreaId;
  readonly heading: string;            // nearest heading above the chunk
  readonly text: string;               // 200–500 tokens
  readonly tokens: number;
  readonly vector?: Float32Array;      // Phase 5
}

export interface KnowledgeEdge {
  readonly from: AssetId;
  readonly to: AssetId;
  readonly kind: 'mentions' | 'references' | 'implements' | 'part-of' | 'supersedes';
  readonly weight: number;
}
```

---

## 6. Technology decisions

### 6.1 The host — decide once

| Option | Verdict | Reason |
|---|---|---|
| **React + Fluent UI v9 web app, packaged later** | **Recommended** | Fluent UI is a web library; the shell stays testable in a browser; Electron/Tauri can wrap it unchanged |
| Fork a VS Code workbench | Rejected for this rewrite | Every visual decision fights the workbench's own; Fluent UI cannot be the design language |
| VS Code extension (current) | Keep as an adapter only | Useful for people already in VS Code; not the product |
| Electron + custom chrome from day one | Deferred | Only needed when native menus/window controls are required |

**Decision:** a **web application** (`Vite` + React 19 + TypeScript strictable), with a thin desktop wrapper added in
Phase 3. The current VS Code extension becomes an optional adapter that mounts the same React screens into a webview;
it is not the reference implementation.

### 6.2 Stack

| Concern | Choice | Version policy |
|---|---|---|
| UI kit | `@fluentui/react-components` + `@fluentui/react-icons` | latest 9.x, pinned exactly |
| Framework | React 19, TypeScript 5.x, `strict: true` | |
| Build | Vite | |
| State | Zustand for session/view state; TanStack Query for server state | |
| Routing | React Router (data router) | |
| Editor: Markdown | Tiptap 3 + `@tiptap/markdown` | pinned |
| Editor: code | Monaco | |
| Editor: office/diagram/pdf | ONLYOFFICE / Draw.io / PDF.js, embedded | Phase 2 |
| Icons | Fluent icons only | |
| Charts | `@fluentui/react-charts` | |
| Local store | SQLite (better-sqlite3) in the main process | |
| Search | SQLite FTS5 | |
| Tests | Vitest + Playwright | |

### 6.3 What is *not* installed

No CSS framework, no component library other than Fluent, no icon set other than Fluent. A second visual language is how
the current design lost coherence.

---

## 7. Repository shape

```text
temco-platform/
├── apps/
│   ├── shell/                     the Fluent UI application (the product)
│   │   ├── src/
│   │   │   ├── app/               bootstrap, router, providers
│   │   │   ├── shell/             title bar, nav, panels, status bar
│   │   │   ├── screens/           one folder per screen in §11
│   │   │   ├── components/        shared, presentational only
│   │   │   ├── editors/           EditorContribution implementations
│   │   │   ├── services/          typed IPC clients — no React
│   │   │   └── styles/            the token layer (§9)
│   │   └── vite.config.ts
│   └── desktop/                   Electron or Tauri wrapper (Phase 3)
├── packages/
│   ├── domain/                    §5 types, invariants, pure functions. No I/O.
│   ├── store/                     SQLite schema, migrations, repositories
│   ├── build/                     docfx / pdf / chm / zip runners
│   ├── search/                    index + query
│   └── ai/                        chunking, embeddings, retrieval
├── products/                      data, not code
│   └── t3000/
│       ├── product.json
│       ├── documentation/
│       │   ├── overview/point-scaling.md
│       │   └── guides/…
│       └── assets/
└── docs/                          this design
```

**Boundary rules**, enforced by lint dependency constraints:

- `screens/**` may import `components/**`, `services/**`, `domain`.
- `components/**` may import `domain` types and Fluent only. Never `services`.
- `services/**` may import `domain`. Never React.
- `domain/**` imports nothing but TypeScript and small pure helpers.

---

## 8. Application shell

### 8.1 Regions

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  TEMCO Platform   File  Edit  View  Go  Tools  Help        [ Search or run a command   ⌘K ]   │ 40
├────┬───────────────────────────┬──────────────────────────────────────────┬──────────────────┤
│    │                           │  tab  tab  tab                           │                  │
│ 48 │  SIDE BAR   300           ├──────────────────────────────────────────┤  RIGHT PANEL 340 │
│    │                           │  breadcrumb                              │                  │
│    │  the workspace's tree     ├──────────────────────────────────────────┤  Properties      │
│    │  for the active area      │                                          │  Outline         │
│    │                           │            EDITOR AREA                   │  AI              │
│    │                           │            (the asset)                   │  Review          │
│    │                           │                                          │                  │
│    │                           ├──────────────────────────────────────────┤                  │
│    │                           │  PANEL  Problems Output Build Preview     │                  │
├────┴───────────────────────────┴──────────────────────────────────────────┴──────────────────┤
│  t3000   13.0   ● 2   ▲ 1              Ln 1, Col 1   Markdown   1.0.0                        │ 24
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

| Region | Height/Width | Owner | Collapsible |
|---|---|---|---|
| Title bar | 40 | shell | no |
| Activity bar | 48 | shell | no |
| Side bar | 300 (240–480, remembered) | the active workspace | yes |
| Editor area | flexible | the active asset | no |
| Right panel | 340 (280–520) | shell, hosts tabs | yes |
| Panel | `clamp(132px, 26vh, 240px)` | the active asset | yes |
| Status bar | 24 | shell | no |

### 8.2 Activity bar

```text
🏠  Home
📦  Products
📚  Documentation
🔌  Hardware          (Phase 4 — hidden until then)
💻  Repositories
📦  Releases
⬇️  Downloads
🔍  Search
🤖  AI
⚙️  Administration
```

Each item is a **workspace**, each workspace owns one side bar tree and a default screen. The badge on an item is that
workspace's own open work (e.g. Documentation shows the number of assets in review).

### 8.3 Rules

- **One editor column.** Splitting is a Phase 3 feature; until then the layout never has two editor columns.
- **The side bar belongs to the workspace, not the user.** Switching workspace switches the tree.
- **The right panel is per-asset.** Properties, Outline, AI and Review are tabs of that panel; the panel remembers the
  chosen tab per asset kind.
- **The panel is per-editor.** Problems for the build editor, Output for a running build, Preview for a publication.

---

## 9. Design system — Fluent UI only

### 9.1 The token rule

Every value comes from a Fluent token. There are no exceptions, and the lint rule `no-raw-design-values` enforces it.

```ts
// ✅
const styles = makeStyles({
  root: {
    padding: tokens.spacingVerticalL,
    gap: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    font: tokens.fontSizeBase300,
  },
});

// ❌ rejected by lint
const styles = makeStyles({
  root: { padding: '16px', borderRadius: '4px', backgroundColor: '#1b1b1b' },
});
```

### 9.2 The palette of meaning

The platform uses **role colours**, never brand colours, so a theme change is free.

| Meaning | Token | Used for |
|---|---|---|
| Surface, page | `colorNeutralBackground1` | the editor canvas |
| Surface, raised | `colorNeutralBackground3` | cards, the side bar |
| Surface, overlay | `colorNeutralBackground1` + `shadow16` | menus, dialogs |
| Text, primary | `colorNeutralForeground1` | body |
| Text, secondary | `colorNeutralForeground3` | metadata, captions |
| Border, subtle | `colorNeutralStroke2` | dividers |
| Border, strong | `colorNeutralStroke1` | focused input |
| Accent | `colorBrandBackground` | primary buttons only, one per screen |
| Success | `colorStatusSuccessForeground1` | published, done |
| Warning | `colorStatusWarningForeground1` | needs attention |
| Danger | `colorStatusDangerForeground1` | failed, destructive |
| Info | `colorStatusInfoForeground1` | in progress |

**One accent button per screen.** A screen with two primary buttons has no primary action.

### 9.3 Type scale

| Role | Token | Where |
|---|---|---|
| Page title | `fontSizeHero700` | the one `<h1>` of a screen |
| Section | `fontSizeBase500` semibold | card and section headings |
| Body | `fontSizeBase300` | prose, table cells |
| Metadata | `fontSizeBase200` `colorNeutralForeground3` | timestamps, counts |
| Code | `fontFamilyMonospace` `fontSizeBase200` | inline code, ids |

### 9.4 Spacing, radius, elevation

| Use | Token |
|---|---|
| Inside a control | `spacingVerticalXS` / `spacingHorizontalXS` |
| Between related items | `spacingVerticalS` / `spacingHorizontalS` |
| Inside a card, above a table | `spacingVerticalL` |
| Between sections | `spacingVerticalXXL` |
| Page gutter | `spacingHorizontalXXL` |
| Card radius | `borderRadiusLarge` |
| Control radius | `borderRadiusMedium` |
| Dialog / menu | `shadow64` |
| Card on hover | `shadow4` |

### 9.5 Density and themes

- Ship **comfortable** and **compact** density; compact is a user setting and applies to trees and tables only.
- Light, dark and high-contrast come from Fluent's `ThemeProvider` — no component may test for a theme.

### 9.6 Rules of restraint

1. **No border where spacing would do.** A card is a surface and a gap, not a box with a line around it.
2. **No icon without a label** in a toolbar the user can see; icon-only buttons are allowed once the same action appears
   in a menu with its label.
3. **No colour without meaning** (see §9.2). Tint is a status, never decoration.
4. **No motion** except: dialog open, menu open, panel expand. Durations come from Fluent's motion tokens.

---

## 10. Information architecture and routes

Every screen has a URL. Deep links must work, because a link to a page is how people share work.

| # | Route | Screen | Workspace | Phase |
|---|---|---|---|---|
| 1 | `/` | Home | Home | 1 |
| 2 | `/products` | Products | Products | 1 |
| 3 | `/products/:productId` | Product overview | Products | 1 |
| 4 | `/products/:productId/documentation` | Documentation | Documentation | 1 |
| 5 | `/products/:productId/documentation/:assetId` | Document editor | Documentation | 1 |
| 6 | `/products/:productId/docs/:area/:slug` | Document editor (by slug) | Documentation | 1 |
| 7 | `/products/:productId/review` | Review centre | Documentation | 2 |
| 8 | `/products/:productId/publishing` | Publishing | Releases | 2 |
| 9 | `/products/:productId/releases` | Releases | Releases | 2 |
| 10 | `/products/:productId/downloads` | Downloads | Downloads | 3 |
| 11 | `/products/:productId/hardware` | Hardware | Hardware | 4 |
| 12 | `/search?q=` | Search results | Search | 1 |
| 13 | `/ai` | AI workspace | AI | 5 |
| 14 | `/settings` | Administration | Administration | 1 |

Side bar trees are **per workspace**, derived from data, never hand-maintained:

| Workspace | Tree root | Children |
|---|---|---|
| Products | products | product → overview, documentation, releases, downloads |
| Documentation | the active product | area → asset (ordered by `order`) |
| Releases | the active product | publication by version, newest first |
| Downloads | the active product | asset kind = `download` |
| Hardware | the active product | controller → inputs/outputs/variables/programs/schedules |

---

## 11. Screens

Each screen below is complete: layout, Fluent components, states, and the acceptance criteria that make it done.

### 11.1 Home

**Purpose:** say what the platform is for, and offer only things a person can act on today.
**Route:** `/`

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  TEMCO Platform                        [ Search products, pages, firmware…        ⌘K ]        │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│   TEMCO Platform                                                       ┌───────────────┐     │
│   Products, documentation, firmware and releases in one window.        │  3 products   │     │
│                                                                        │  1,254 pages  │     │
│   [ Open a product ]      [ New product ]                              │  17 in review │     │
│                                                                        └───────────────┘     │
│                                                                                              │
│   CONTINUE                                                                                   │
│   ┌────────────────────────────┬────────────────────────────┬────────────────────────────┐   │
│   │ 📄 Point Scaling           │ 📄 BACnet Objects          │ 📦 T3000 13.0 build        │   │
│   │ T3000 · Guides             │ T3000 · APIs               │ 612 of 1,254 topics        │   │
│   │ 2 hours ago                │ yesterday                  │ running now                │   │
│   └────────────────────────────┴────────────────────────────┴────────────────────────────┘   │
│                                                                                              │
│   NEEDS YOU                                                        [ Review all → ]         │
│   ┌────────────────────────────────────────────────────────────────────────────────────────┐ │
│   │ ● 17 pages waiting for review          Documentation · oldest 3 days                    │ │
│   │ ▲ 2 errors keep 13.0 from publishing   Publishing · duplicate page order                │ │
│   └────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                              │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

| Region | Fluent components |
|---|---|
| Header | `Text` (`fontSizeHero700`), `Button` appearance=`primary` (Open a product) |
| Stat card | `Card`, `Text` ×2 |
| Continue | `Card` interactive, `CardHeader`, `Text` |
| Needs you | `MessageBar` (intent=`warning` / `error`), `Link` |

**States:** empty (no products → one `MessageBar` + the primary "New product"); loading (`Skeleton` rows); error
(`MessageBar` intent=error with retry).

**Acceptance criteria**

- [ ] With zero products, the only actions are *New product* and *Search*.
- [ ] *Continue* shows at most three items and only ones touched in the last 14 days.
- [ ] *Needs you* shows nothing at all when nothing needs the person — no "0 items" placeholder.
- [ ] Every row is reachable by keyboard; `Enter` opens it.
- [ ] No hardcoded counts: all four numbers come from the store.

### 11.2 Products

**Route:** `/products`

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  Products                                                              [ New product ]       │
│  Every product the platform publishes.                                                       │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  [ Search products…        ]    Status: [ All ▾ ]    Sort: [ Name ▾ ]                        │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐    │
│  │ 📦 T3000                                                      active · 13.0 · LTS 12.8 │    │
│  │    Stand-alone programmable controllers                                              │    │
│  │    1,254 pages · 4 sources · 3 releases · 2 downloads            [ Open → ]           │    │
│  └──────────────────────────────────────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐    │
│  │ 📦 T3-ESP                                                     active · 2.4          │    │
│  │    ESP32 controller with Wi-Fi                                                       │    │
│  │    186 pages · 1 source · 1 release                              [ Open → ]           │    │
│  └──────────────────────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

| Region | Fluent components |
|---|---|
| Toolbar | `Input` (search, `contentBefore` search icon), `Dropdown`, `Dropdown` |
| Rows | `Card` interactive, `Badge` (status), `Tag` (LTS), `Text` |

**States:** empty, loading, no-search-results (`MessageBar` info with the term quoted).

**Acceptance criteria**

- [ ] Filtering is instant and client-side for < 500 products; debounced server-side beyond that.
- [ ] A product card shows no more than five facts; anything else belongs on its overview.
- [ ] Status is a `Badge` with both colour **and** a word (§9.6 rule 3).
- [ ] Opening a card navigates to `/products/:id`; `Ctrl+Enter` opens it in the same tab (default) — new tab is Phase 3.

### 11.3 Product overview

**Route:** `/products/:productId`

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  📦 T3000                                                            [ Publish ]  [ ⋯ ]      │
│  Stand-alone programmable controllers · active · latest 13.0 · LTS 12.8                      │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐                               │
│  │ 1,254        │ 17           │ 3            │ 4            │                               │
│  │ Pages        │ In review    │ Releases     │ Sources      │                               │
│  └──────────────┴──────────────┴──────────────┴──────────────┘                               │
│                                                                                              │
│  ┌─ Documentation ────────────────────────────────────────────────────────────────────────┐   │
│  │  Overview        12 pages      Guides          86 pages      Tutorials      41 pages   │   │
│  │  Architecture    23 pages      APIs           212 pages      Release notes  38 pages   │   │
│  │  Troubleshooting 64 pages      Standards       9 pages       References    769 pages   │   │
│  │                                                              [ Open documentation → ]   │   │
│  └────────────────────────────────────────────────────────────────────────────────────────┘   │
│  ┌─ Delivery ────────────────────────────────────────────┐ ┌─ Sources ────────────────────┐  │
│  │ 13.0  built    3 of 3 outputs   [ Publish ]            │ │ github  t3000-docs  ● clean  │  │
│  │ 12.9  published               [ Open ]                 │ │ local   C:\docs\t3000        │  │
│  │ 12.8  published  LTS          [ Open ]                 │ │ [ Read all ]                 │  │
│  └───────────────────────────────────────────────────────┘ └──────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

| Region | Fluent components |
|---|---|
| Header | `Text`, `Badge`, `Button` primary (Publish), `Menu` (`⋯`) |
| Metrics | `Card` ×4 with `Text` |
| Documentation | `Card`, `Table` (2 columns of area + count), `Link` |
| Delivery | `Card`, `Table` (`DataGrid` when sortable), `Badge`, `Button` |
| Sources | `Card`, `Table`, `Badge` |

**Acceptance criteria**

- [ ] Every area shows a real count from `AssetService.countByArea`.
- [ ] *Publish* is disabled with a `Tooltip` explaining why when anything blocks it.
- [ ] The `⋯` menu holds product settings, rename, archive — never the primary action.
- [ ] Nothing on this screen is editable inline; editing a product is a dialog.

### 11.4 Documentation — the workspace

**Route:** `/products/:productId/documentation`

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  T3000 › Documentation                          [ New page ]  [ Import ]  [ Assets ▾ ]        │
├───────────────────────────┬──────────────────────────────────────────────────────────────────┤
│  SIDE BAR                 │  Welcome to T3000                              [ Edit ]  [ ⋯ ]   │
│  ┌─────────────────────┐  │  ═══════════════════════════════════════════════════════════     │
│  │ 🔍 Filter pages     │  │                                                                  │
│  ├─────────────────────┤  │  T3000 is a stand-alone programmable controller…                 │
│  │ ▾ Overview      (12)│  │                                                                  │
│  │    What T3000 Is    │  │  ┌─ On this page ─────────────────────────────┐                  │
│  │    Point Scaling    │  │  │  • What it covers                          │                  │
│  │ ▸ Guides        (86)│  │  │  • Reading a point                         │                  │
│  │ ▸ Tutorials     (41)│  │  │  • Next steps                              │                  │
│  │ ▸ Architecture  (23)│  │  └────────────────────────────────────────────┘                  │
│  │ ▸ APIs         (212)│  │                                                                  │
│  └─────────────────────┘  │                                                                  │
├───────────────────────────┴──────────────────────────────────────────────────────────────────┤
│  Side bar: area → page, ordered by `order`.  Editor: the asset, in whichever editor matches.  │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**The tree is not a file tree.** It is `Area → Asset`, both ordered, both with counts. There are no folders.

| Region | Fluent components |
|---|---|
| Header | `Button` primary (New page), `Button` (Import), `MenuButton` (Assets) |
| Tree | `Tree`, `TreeItem`, `TreeItemLayout`, `Input` filter above |
| Editor | the resolved `EditorContribution.Component` |
| On this page | `Card` + `Link` list, or the right panel's Outline tab (§11.5) |

**States:** no page selected (empty state with the product's areas), area with no pages, filtering with no match.

**Acceptance criteria**

- [ ] The tree renders 1,000+ items without virtualization warnings and scrolls at 60 fps.
- [ ] Filtering collapses the tree to matches and their ancestors, and clears back to the tree when emptied.
- [ ] Dragging a page inside an area changes `order` only — it never changes the area unless dropped on an area node.
- [ ] `Alt+↑/↓` moves the current page up/down in `order` (keyboard parity with the drag).
- [ ] The selected page survives a reload (deep link, §10).

### 11.5 The Document editor (the daily surface)

**Route:** `/products/:productId/documentation/:assetId`

This is the screen people live in. It is specified in more detail than the others for that reason.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  tab ×  Point Scaling ×                                     [ Edit ][ Read ]      [ ⋯ ]      │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  T3000 › Documentation › Guides › Point Scaling                     Review: draft · Derek     │
├══════════════════════════════════════════════════════════════════════════════════════════════┤
│  Undo Redo │ ¶ ▾ │ • ▾ │ ❝ │ </> │ B  I  S  `  U  ≋ │ 🔗 │ 🖼 Add │ ⊞ ▣ 1 2 Σ │ ⌕ │ ☰   │    │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                    │  Properties │ Outline │ AI │ Review    │
│  ┌──────────────────────────────────────────────┐  ├──────────────────────────────────────┤  │
│  │  Point Scaling                               │  │  Area        Guides                  │  │
│  │                                              │  │  Order       20                      │  │
│  │  Rated for 24 V only.                        │  │  State       Draft                   │  │
│  │                                              │  │  Owner       Derek                   │  │
│  │  ┌ ℹ NOTE ─────────────────────────────────┐  │  │  Tags        scaling, 24V            │  │
│  │  │ Rated for 24 V only.                    │  │  ├──────────────────────────────────────┤  │
│  │  └─────────────────────────────────────────┘  │  │  OUTLINE                             │  │
│  │                                              │  │  ● Point Scaling                     │  │
│  │  ## Steps                                    │  │    • Steps                           │  │
│  │   1. Open the panel                          │  │    • Fields                          │  │
│  │   2. Set the range                           │  │                                      │  │
│  │                                              │  │  54 words · 1 min                    │  │
│  │  ```mermaid                                  │  │                                      │  │
│  │  graph LR; A-->B                             │  │                                      │  │
│  │  ```                                         │  │                                      │  │
│  └──────────────────────────────────────────────┘  │                                      │  │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  Markdown · saved 2s ago · 54 words · Ln 12, Col 4                    [ Preview ] [ Diff ] │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Layout rules** — these are what make it feel like a document tool rather than a web page:

| Rule | Value |
|---|---|
| Text column | `min(52rem, 100% - 2 × gutter)`; never wider, so prose stays readable |
| Canvas | the page sits on `colorNeutralBackground3`; the sheet is `colorNeutralBackground1` with `borderRadiusLarge` |
| Toolbar | one row, `44px`, sticky; groups separated by `Divider` |
| Bottom padding inside the sheet | `30vh`, so the last line can be scrolled to the middle |
| Right panel | `340px`, tabs; collapses to a `28px` rail with icon buttons |

| Region | Fluent components |
|---|---|
| Editor tab strip | `TabList` + `Tab` |
| Toolbar | `Toolbar`, `ToolbarGroup`, `ToolbarDivider`, `ToolbarButton`, `ToolbarToggleButton`, `MenuButton` (¶, •), `SplitButton` (Add image) |
| Editor | the `Document` editor contribution (Tiptap) |
| Right panel | `TabList` (`size="small"`), `Field`, `Input`, `Dropdown`, `Textarea`, `Tag` |
| Status bar | `Text` (`fontSizeBase200`) |

**States:** saving (a discrete "saving…" in the status bar, never a spinner over the text), saved, conflict (a
`MessageBar` intent=warning with *Keep mine* / *Take theirs*), read-only (toolbar hidden, right panel Properties only).

**Acceptance criteria — the ones that matter**

- [ ] Opening a page changes nothing: no dirty indicator, no save, no diff. (The editor must not rewrite a file it just
      read.)
- [ ] Typing, Backspace, Delete, arrow keys, Home/End, word-select by double-click and Shift+click all behave exactly as
      in any text editor — the caret never moves on its own, and never jumps to the end of the page.
- [ ] A drag with the mouse selects exactly what was dragged over, across paragraph boundaries.
- [ ] Undo/redo across a save boundary works (one save = one undo step).
- [ ] Saving is debounced (300 ms idle) and writes one edit, so the diff of a one-word change is one line.
- [ ] The round trip is byte-identical for the stored fixtures (§18.2); a page that would be rewritten on open is a bug.
- [ ] Right panel remembers its tab per asset kind, and collapses from the keyboard (`Ctrl+Alt+P`).

### 11.6 Review centre

**Route:** `/products/:productId/review`

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  Review                                                    [ Approve all ]      [ Filters ]   │
│  17 changes are waiting. The oldest is 3 days old.                                           │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────┬───────────────────────────────────────────────────────────┐│
│  │ ● Point Scaling              │  Point Scaling                    draft → in-review        ││
│  │   Derek · 2h · 1 file        │  ───────────────────────────────────────────────────────   ││
│  │ ● BACnet Objects             │  - Rated for 24 V only.                                    ││
│  │   Ana · 5h · 1 file          │  + Rated for 24 V only. Do not exceed 30 V.                ││
│  │ ○ Duplicate page order       │  ───────────────────────────────────────────────────────   ││
│  │   CI · 1d · check failed     │  [ Approve ]  [ Request changes ]  [ Open the page ]       ││
│  └──────────────────────────────┴───────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

| Region | Fluent components |
|---|---|
| Header | `Text`, `Button` primary (Approve all), `MenuButton` (Filters) |
| Queue | list of `Card` interactive, `Badge` for kind (change / check) |
| Detail | `Text`, monospace diff via `<code>` lines with status colours, `Button` ×2 |

**Acceptance criteria**

- [ ] Approving removes the row without a page reload and decrements the badge everywhere.
- [ ] A failed check cannot be approved — its primary button is absent, not disabled.
- [ ] The diff shows word-level changes, and the row whose diff is open is marked on the list.
- [ ] Approve all is disabled when the queue contains a failed check, with the reason in a `Tooltip`.

### 11.7 Publishing

**Route:** `/products/:productId/publishing`

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  Publishing · 13.0                                        [ Build all ]      [ Publish ]      │
│  Two errors keep 13.0 from publishing.                                                       │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Target        State        Progress                          Time      Size            │  │
│  │ Website       ✔ Built      ████████████████████████ 100%      12s       412 files       │  │
│  │ Search index  ✔ Built      ████████████████████████ 100%       4s       1.2 MB          │  │
│  │ PDF           ◐ Building   ██████████████░░░░░░░░░░  62%      1m 04s    —               │  │
│  │ CHM           ✖ Failed     —                                  —         —               │  │
│  │                 error: hhc.exe not found on PATH                                        │  │
│  └────────────────────────────────────────────────────────────────────────────────────────┘  │
│  ┌─ Errors ────────────────────────────────────────────────────────────────────────────────┐ │
│  │ ● api-reference/data-points.md   Order 20 is used by more than one page in this area.   │ │
│  │ ● protocols/modbus.md            Link target /help/register-map does not exist.         │ │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

| Region | Fluent components |
|---|---|
| Header | `Button` primary (Build all), `Button` (Publish), `MessageBar` |
| Targets | `DataGrid` (sortable), `ProgressBar`, `Badge` per state |
| Errors | `MessageBar` per error, `Link` opens the asset at the offending line |

**Acceptance criteria**

- [ ] Every target can be run alone; running one never touches another's output.
- [ ] Progress is real (from the runner), not a timer.
- [ ] A missing tool (hhc.exe, docfx) is reported as a *precondition* failure before the build starts, with the install
      command.
- [ ] *Publish* is enabled only in state `built` with every required output present.
- [ ] The build log streams into the bottom panel and is downloadable.

### 11.8 Releases, 11.9 Downloads, 11.10 Search, 11.11 AI, 11.12 Administration

These five follow the same pattern. Their layouts:

```text
RELEASES                                  DOWNLOADS
┌────────────────────────────────┐        ┌────────────────────────────────┐
│ 13.0   ● built      3 outputs  │        │ T3000 13.0 · Firmware          │
│ 12.9   ✔ published            │        │  t3-firmware-13.0.bin  2.4 MB  │
│ 12.8   ✔ published  LTS       │        │  ── SHA256 4f3c…    [ Copy ]   │
│ channel · date · size · notes  │        │  t3-tool 13.0.zip     18 MB    │
└────────────────────────────────┘        └────────────────────────────────┘

SEARCH                                    AI
┌────────────────────────────────┐        ┌────────────────────────────────┐
│ [ point scaling            ]   │        │  Ask about T3000               │
│ 312 results · 0.08s            │        │  ┌──────────────────────────┐  │
│ ┌ Point Scaling                │        │  │ How does output 5 work?  │  │
│ │ Guides · T3000 · 13.0        │        │  └──────────────────────────┘  │
│ │ …rated for 24 V only…        │        │  Answer, with citations:       │
│ └──────────────────────────────│        │  • Point Scaling · Guides      │
│ ┌ T3-Firmware-13.0.bin         │        │  • Outputs · Hardware          │
│ │ Download · T3000 · 2.4 MB    │        │  [ Open source ] [ Copy ]      │
└────────────────────────────────┘        └────────────────────────────────┘
```

**Search acceptance criteria**

- [ ] One box searches documents, assets, releases and downloads — never a second search field on the page.
- [ ] Results are grouped by kind, and the group order is stable.
- [ ] A query returns in < 100 ms for 10,000 chunks on the local index.
- [ ] Opening a result navigates to the asset and highlights the match.

**AI acceptance criteria**

- [ ] Every answer cites at least one asset, and every citation opens that asset at the matching heading.
- [ ] With no model installed, the screen explains how to install one — it does not appear broken.
- [ ] The answer never renders agent-authored markdown without sanitising it.

---

## 12. Component library — Fluent UI mapping

Use these and only these. If a widget is missing, compose it from these primitives.

| App need | Fluent v9 component | Package |
|---|---|---|
| Buttons | `Button`, `ToggleButton`, `SplitButton`, `MenuButton` | `react-components` |
| Toolbar | `Toolbar`, `ToolbarGroup`, `ToolbarDivider`, `ToolbarButton`, `ToolbarToggleButton` | `react-components` |
| Tree | `Tree`, `TreeItem`, `TreeItemLayout`, `FlatTree` | `react-components` |
| Data table | `DataGrid`, `DataGridHeader`, `DataGridRow`, `DataGridCell` | `react-components` |
| Tabs | `TabList`, `Tab` | `react-components` |
| Menus | `Menu`, `MenuTrigger`, `MenuPopover`, `MenuList`, `MenuItem` | `react-components` |
| Dialogs | `Dialog`, `DialogSurface`, `DialogTitle`, `DialogBody`, `DialogActions` | `react-components` |
| Drawer / side panel | `Drawer`, `DrawerBody`, `DrawerHeader` (or a `Card` rail for the collapsed state) | `react-components` |
| Inputs | `Input`, `Textarea`, `Dropdown`, `Combobox`, `Searchbox` (or `Input` + icon), `SpinButton`, `Slider`, `Switch`, `Checkbox`, `RadioGroup` | `react-components` |
| Form rows | `Field`, `Label`, `InfoLabel` | `react-components` |
| Status | `Badge`, `Tag`, `MessageBar`, `Toast`/`Toaster`, `ProgressBar`, `Spinner` | `react-components` |
| Surfaces | `Card`, `CardHeader`, `Divider`, `Skeleton` | `react-components` |
| Identity | `Avatar`, `Persona` | `react-components` |
| Navigation | `Breadcrumb`, `BreadcrumbItem`, `BreadcrumbButton` | `react-components` |
| Help | `Tooltip`, `Popover`, `Infobutton` | `react-components` |
| Icons | `@fluentui/react-icons` only | `react-icons` |
| Charts | `@fluentui/react-charts` | `react-charts` |

**Composition rules**

- A **page** is `Text` + `Card`s + `DataGrid`s. Do not invent layout wrappers with bespoke CSS.
- A **list of items that navigate** is `Card interactive`, not a styled `<div>`.
- A **status** is `Badge` with a word and a colour (§9.6).
- A **destructive action** is `Button appearance="secondary"` inside a `Dialog`, never red.

---

## 13. State and data

### 13.1 Three kinds of state

| Kind | Tool | Example | Never |
|---|---|---|---|
| Server state | TanStack Query | products, assets, publications | copied into Zustand |
| Session state | Zustand | active product, panel sizes, right-panel tab | persisted without a version |
| Editor state | inside the editor | caret, selection, undo stack | read by the shell |

### 13.2 Query keys

```ts
const keys = {
  products: ['products'] as const,
  product: (id: ProductId) => ['product', id] as const,
  assets: (id: ProductId, area?: AreaId) => ['assets', id, area ?? 'all'] as const,
  asset: (id: AssetId) => ['asset', id] as const,
  publication: (id: PublicationId) => ['publication', id] as const,
  search: (q: string) => ['search', q] as const,
};
```

### 13.3 Mutations and optimism

- **Edits to an asset** are debounced, then sent as one `updateAsset` with the asset's `revision` as the precondition.
  A `409` means someone changed it first → surface the conflict state of §11.5.
- **Reordering** is optimistic (the tree moves immediately) and rolls back on error.
- **Publishing** is never optimistic. It is a state machine with server truth.

### 13.4 Offline

The renderer must keep working with the main process alive and no network. Every service call has a local
implementation; the network is only for git remotes and model downloads.

---

## 14. Service contracts

The renderer talks to the main process over a typed IPC bridge. Every method below is the **only** way a screen may
obtain or change data.

```ts
export interface ProductService {
  list(): Promise<Product[]>;
  get(id: ProductId): Promise<Product | undefined>;
  create(input: { name: string; tagline: string }): Promise<Product>;
  update(id: ProductId, patch: Partial<Product>): Promise<Product>;
  archive(id: ProductId): Promise<void>;
}

export interface AssetService {
  byProduct(productId: ProductId, area?: AreaId): Promise<Asset[]>;
  tree(productId: ProductId): Promise<AreaNode[]>;          // areas → assets, ordered
  get(id: AssetId): Promise<Asset | undefined>;
  create(input: { productId: ProductId; kind: AssetKind; area: AreaId; name: string }): Promise<Asset>;
  /** `revision` is a precondition: a mismatch rejects with ConflictError. */
  update(id: AssetId, patch: { content?: string; name?: string; area?: AreaId; order?: number; tags?: string[] }, revision: number): Promise<Asset>;
  move(id: AssetId, area: AreaId, order: number): Promise<void>;
  remove(id: AssetId): Promise<void>;
  history(id: AssetId): Promise<Revision[]>;
}

export interface EditorHostService {
  resolve(asset: Asset): Promise<{ editorId: string; capabilities: EditorCapabilities }>;
  list(): Promise<Omit<EditorContribution, 'Component'>[]>;
}

export interface PublishService {
  plan(productId: ProductId, version: string, channel: Channel): Promise<Publication>;
  build(publicationId: PublicationId): AsyncIterable<BuildEvent>;   // streams
  publish(publicationId: PublicationId): Promise<Publication>;
  preconditions(productId: ProductId): Promise<PreconditionResult[]>;  // is docfx/hhc installed?
}

export interface SearchService {
  query(text: string, filter?: { productId?: ProductId; kinds?: AssetKind[] }): Promise<SearchHit[]>;
  reindex(productId?: ProductId): Promise<{ chunks: number; ms: number }>;
}

export interface KnowledgeService {
  ask(question: string, productId?: ProductId): Promise<Answer>;
  rebuild(productId?: ProductId): Promise<void>;
}
```

### 14.1 Errors

```ts
export type ServiceError =
  | { kind: 'not-found'; what: string }
  | { kind: 'conflict'; currentRevision: number; currentContent: string }
  | { kind: 'precondition'; missing: string; installHint: string }
  | { kind: 'invalid'; field: string; reason: string }
  | { kind: 'io'; message: string };
```

A screen never sees an exception; it sees one of these and renders the matching `MessageBar`. `conflict` is the only one
with its own UI state (§11.5).

---

## 15. Flows

Every flow is written as: trigger → steps → what the user sees → what can go wrong.

### F1 · Create a product

```text
[New product] ─▶ Dialog: name, tagline, template
                        │
                        ▼
              create product + taxonomy + first page
                        │
                        ▼
              navigate to /products/:id  (overview)
```

Fails when: the name collides with an existing slug → inline `Field` validation, no request sent.

### F2 · Add a documentation page

```text
[New page] ─▶ Dialog: area (default: current), title, template (blank | task | reference | troubleshooting | note)
                   │
                   ▼
        AssetService.create({kind:'document', format:'md', order: area.max+10})
                   │
                   ▼
        open it in the Document editor at /…/:assetId, title pre-selected, ready to type
```

**Rule:** a new page opens in the editor with its title selected — one keystroke replaces it, as in a file manager.

### F3 · Edit and save

```text
keypress ─▶ editor state ─▶ (300 ms idle) ─▶ markdown ─▶ updateAsset(revision)
                                                              │
                                    ┌─────────────────────────┼──────────────────────┐
                                    ▼                         ▼                      ▼
                                  200 OK                  409 conflict          io error
                             status: "saved 2s ago"   MessageBar: keep/take   MessageBar + retry
```

**The round-trip law** — the single most important rule in this document:

> Reading a page and writing it back with no edit must produce a byte-identical file.

If the serializer cannot guarantee that, it must not be used to save. A page that gains a diff merely by being opened is
a defect of the same severity as data loss.

### F4 · Import

```text
[Import] ─▶ choose: Word document (.docx) │ document set (folder / CHM)
                 │                                    │
                 ▼                                    ▼
        convert to Markdown                    pandoc + unpack
                 │                                    │
   ┌─────────────┴──────────┐              ┌──────────┴────────────┐
   ▼                        ▼              ▼                       ▼
 writes ONE new page    reports what   derives area/chapter    refuses if the
 beside the source      was dropped    from the folder names   destination already
                                        order 10,20,30…         has a registry
```

**Rules:** never overwrite; place derived from origin; everything that could not be converted is listed, never silently
dropped.

### F5 · Review

```text
author submits ─▶ asset.status = in-review ─▶ Review centre queue
                                                    │
                              ┌─────────────────────┼────────────────────┐
                              ▼                     ▼                    ▼
                          Approve            Request changes          (check failed)
                     status = approved      status = draft          cannot approve
                              │                     │
                              ▼                     ▼
                    badge counts update      author gets the note
```

### F6 · Build and publish

```text
[Build all]
    │  preconditions: docfx? hhc? → missing ⇒ stop with install hint
    ▼
for each target (parallel, independent): website | index | pdf | chm
    │        each writes to  .build/<version>/<target>/  and emits events
    ▼
state = built  (all required outputs exist + checksums)
    │
[Publish] ──▶ copy to published/<product>/<version>/ ; write manifest.json ; write portal index.html
    ▼
state = published ; Learn shows it ; downloads appear
```

**Never** does one target's failure delete another's output. A target that fails is reported; the publication is only
`failed` when a required one does.

### F7 · Download

```text
[Downloads] ─▶ row ─▶ [Download] ─▶ save dialog ─▶ copy from store
                        │
                        └▶ shows SHA256 to copy, and the size, before saving
```

### F8 · Search and open

```text
⌘K ─▶ query ─▶ grouped results (Documents · Assets · Releases · Downloads)
                        │
                        └▶ Enter ─▶ navigate to the asset, scroll to the matched heading,
                                    highlight the match for 2 s
```

### F9 · Ask the AI

```text
question ─▶ retrieve top-k chunks (per product) ─▶ model ─▶ answer
                                                              │
                                              ┌───────────────┴───────────────┐
                                              ▼                               ▼
                                    citations (asset + heading)        "no model installed"
                                    each one opens the source           → install dialog
```

### F10 · Recover from a failed build

```text
Failed target ─▶ error row ─▶ click ─▶ the offending asset opens at the offending line
                                             │
                                             ▼
                                       fix and save
                                             │
                                             ▼
                                    [ Build all ] again — only failed targets re-run by default
```

### F11 · Restore an earlier revision

```text
[⋯] ─▶ History ─▶ list of revisions (who, when, +n/−n)
                        │
                        ▼
              side-by-side diff ─▶ [ Restore ] ─▶ creates a NEW revision
```

History is append-only; restore never rewrites the past.

### F12 · Open an asset in a different editor

```text
[⋯] ─▶ Open with… ─▶ list of editors that match the asset (from EditorHost.list)
                        │
                        ▼
              the choice is stored per asset (asset.editorId) and remembered
```

This is Fluent's `Menu` + `MenuList`, not a system dialog.

---

## 16. Keyboard and accessibility

### 16.1 Shortcuts

| Keys | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Command palette (search + run) |
| `⌘P` / `Ctrl+P` | Go to asset |
| `⌘S` / `Ctrl+S` | Save now (saving is automatic; this forces it) |
| `⌘⇧F` / `Ctrl+Shift+F` | Search all assets |
| `⌘B` / `Ctrl+B` | Toggle side bar |
| `⌘⌥P` / `Ctrl+Alt+P` | Toggle right panel |
| `⌥↑/↓` | Move the current asset within its area |
| `⌘⏎` / `Ctrl+Enter` | Primary action of the screen (Publish / Approve / Build) |
| `F2` | Rename the selected asset |
| `Delete` | Delete the selected asset (with confirmation) |
| `Esc` | Close menu / dialog / cancel an inline edit |

### 16.2 Accessibility requirements

- Every interactive element is reachable by keyboard **and** has a visible focus ring (`colorStrokeFocus2`).
- Trees and grids expose `role="tree"` / `role="grid"` with row and column counts (Fluent does this; do not override).
- Status colours are always accompanied by a word (§9.6 rule 3).
- The editor surface announces document changes through an `aria-live="polite"` region ("saved", "12 words added").
- Contrast: rely on Fluent's `colorNeutralForeground*` tokens; never introduce a text colour by hand.
- Every icon-only button has an `aria-label` equal to its tooltip text.

---

## 17. Performance budgets

| Interaction | Budget | Measured how |
|---|---|---|
| Cold start to interactive | < 1.5 s | Playwright, `performance.now()` |
| Switch product | < 200 ms | start of fetch → first paint of the tree |
| Open a 1,000-page tree | < 300 ms | tree mount |
| Keystroke to paint in the editor | < 16 ms | input event → rAF |
| Save round trip | < 250 ms | keyup → "saved" |
| Search over 10,000 chunks | < 100 ms | query |
| Build page for 1,254 topics | < 60 s | runner |

A regression in any of these blocks a release. The budgets are asserted in §18.3.

---

## 18. Testing

### 18.1 The pyramid

| Level | Tool | What it proves |
|---|---|---|
| Unit | Vitest | `domain` invariants, ordering, slug rules, differences |
| Contract | Vitest | services against a temp SQLite database |
| Round-trip | Vitest | **read → write → byte-identical** for every stored fixture (§18.2) |
| Interaction | Playwright | the real editor in a real browser: click, drag-select, type, delete, undo |
| Screen | Playwright | each §11 acceptance criterion, one test per checkbox |
| Visual | Playwright screenshots | the shell at 1280 and 1920, light and dark |

### 18.2 The round-trip corpus

A directory of Markdown files that must survive an open/save cycle unchanged. It must include, at minimum:

1. A plain page.
2. A page with a GFM table.
3. A page with `> [!NOTE]` callouts.
4. A page with inline and block maths.
5. A page with a fenced code block containing backticks.
6. A page with a relative image and a relative link.
7. A page with a numbered list and a nested bullet list.
8. A page with a trailing-space hard break.
9. A page with CRLF line endings.
10. A page with no trailing newline.

> **If any fixture changes by one byte, the editor is not allowed to save.**

### 18.3 What "tested" means for the editor

A change to the editor is not done until these pass **in a browser**, not in a DOM emulator (a DOM emulator cannot see
the caret, and a caret bug will pass every other test):

- click places the caret where the pointer is, in the block that was clicked;
- type → the characters appear at the caret;
- Backspace/Delete remove the characters beside the caret;
- Shift+arrow and drag both select exactly the intended range;
- an incoming document update does not move the caret, collapse a selection, or change the scroll position;
- undo returns to the previous state across a save.

---

## 19. Roadmap

| Phase | Scope | Done when |
|---|---|---|
| **1 — Skeleton** | shell, Fluent tokens, router, Documentation workspace, the Document editor, Search over documents, Home, Products, Product overview | a person can create a product, write pages, search them, and reopen the app to the same state |
| **2 — Publishing** | Review centre, Publishing, Releases, the build runner (website + index first), the round-trip corpus green | a version is built and published, and Learn serves it |
| **3 — Editors and delivery** | ONLYOFFICE, Monaco, Draw.io, PDF.js, Downloads, desktop wrapper | a spreadsheet and a diagram can be opened and saved in place |
| **4 — Hardware** | controllers, I/O points, variables, programs, schedules as assets | the Hardware workspace browses T3000 like documentation |
| **5 — Knowledge** | chunking, embeddings, graph, AI workspace with citations | "how does output 5 work" answers with sources |

**Order is not negotiable.** Phase 2 depends on the round-trip law from Phase 1; Phase 5 depends on clean assets from
Phases 1–4.

---

## 20. Definition of done

A screen or feature is done when **all** of these are true:

- [ ] It has a route (§10) and deep links work after a reload.
- [ ] Every value in it comes from a Fluent token (§9).
- [ ] It has empty, loading, error and no-permission states, each designed rather than defaulted.
- [ ] Its acceptance criteria in §11 are automated tests that fail before the work and pass after.
- [ ] Keyboard: everything reachable, `Esc` always cancels, focus is never lost.
- [ ] It works with 1 item and with 10,000 items.
- [ ] Nothing in it changes a file the user did not change (the round-trip law).
- [ ] No `any`, no `as unknown as`, no eslint suppression without a comment naming the reason.

---

## 21. Appendix

### 21.1 Glossary

| Term | Meaning |
|---|---|
| **Asset** | any unit with identity, content and history |
| **Area** | a taxonomy node inside documentation (`guides`, `apis`), not a folder |
| **Publication** | a frozen set of assets, built and released as a version |
| **Channel** | `stable`, `lts` or `beta` |
| **Editor contribution** | a plugin declaring which assets it can open |
| **Round-trip law** | read + write with no edit = byte-identical |

### 21.2 Naming

- Products: `t3000`, `t3-esp`, `cm5`, `bacnet-router`.
- Slugs: lowercase, hyphenated, ASCII, no leading digit.
- Asset ids: opaque `ast_` + ULID. Never derived from a name, because names change.
- Publication versions: SemVer without the leading `v`.

### 21.3 Open questions, decided by the reviewer not the generator

1. Do assets live in git (reviewable, mergeable) or only in the store (fast, no merge)? **Recommendation:** store is
   truth; git export is a feature.
2. Does a product share pages with another product (common manuals)? **Recommendation:** no sharing in Phase 1; a
   `part-of` edge in Phase 5 models it.
3. Is ONLYOFFICE required, or is a spreadsheet editor optional? **Recommendation:** required for Phase 3, because Excel
   files are already in the corpus.

### 21.4 The one-paragraph brief, if the generator reads nothing else

> Build a Fluent UI React application whose navigation is a list of **products**, not files. Every piece of work is an
> **asset** with a stable id, opened by an **editor** chosen from a plugin registry rather than by a file extension.
> Editing a page must never rewrite it: read followed by write is byte-identical. Publishing is a **state machine** that
> freezes assets into a version and runs independent build targets. Search and AI are **derived** from assets and
> always cite them. Use Fluent tokens for every value, and build one screen at a time against the acceptance criteria in
> §11.


