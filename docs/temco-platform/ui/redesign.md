# Docs center: the redesign

One consolidated design for the documentation center. It supersedes the layout sections of `app-flow.md`, `authoring-flow.md` and `extension-design.md`, which contradict each other. Nothing here is built yet.

## 1. The model

```
 Sources ─► Temco Platform (authoring) ─► Product package ─► Temco Learn (website)
 repos, pdf,   projects · AI · review       products/<id>/       search · downloads · versions
 word, chm                                  manifest.json
                                            docs/ api/ guides/ assets/ releases/
```

| System | Job | Where |
|---|---|---|
| **Temco Platform** | where people work: projects, sources, AI drafts, review, generate | this repository |
| **Product package** | the unit of exchange; a plug-in the portal discovers | `products/<id>/` |
| **Temco Learn** | the reader's MSDN-style portal | the `temco-learn` repository |
| **DocFX** | one pluggable build engine; CHM and PDF are other exporters | invoked by Build, never a surface |

**Vocabulary.** Project (a `documents` row) → Section (the registry's *area*) → Folder (its *chapter*, nestable) → Page. Versions come from the project's releases. A `products` table is added only if several versions must be open at once.

**Truth rule.** Markdown and `registry.json` in the repository are the content. `catalog.sqlite` is a register (projects, sources, builds, releases, drafts, caches) and never holds a second copy of page text, except a draft not yet accepted.

## 2. Journey

```
 A LAUNCH ─► B START PAGE ─► C CREATE PROJECT ─► D EMPTY PROJECT ─► E ADD PAGES
                                                                        │
   I RELEASE ◄─ H PUBLISH ◄─ G NEEDS YOU / AI LOOP ◄─ F EDIT / CAPTURE ◄┘
```

### A. First launch

```
┌────┬───────────────────────────┬──────────────────────────────────────────────────────────────┐
│ ▤◀ │ DOCS                      │  Welcome to Temco Docs                                       │
│    │  No project yet           │   ┌─ Start ─────────────────┐  ┌─ Bring in existing ───────┐ │
│    │  [ ＋ Create a project ]  │   │ ＋ New project          │  │ Word · RTF · CHM · HTML   │ │
│    │  [ ⇩ Import a doc set  ]  │   │ ▤ From a template       │  │ A folder of Markdown      │ │
│    │  [ ⎇ Open a repository ]  │   │ ⎇ From a repository     │  │ A git repository          │ │
│    │                           │   └─────────────────────────┘  └───────────────────────────┘ │
├────┴───────────────────────────┴──────────────────────────────────────────────────────────────┤
│ catalog.sqlite created · default organisation written                                         │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

### B. Start page (projects exist; shown in the editor, not a container)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Temco Docs                                                      ＋ New project │
│ RECENT PROJECTS                                                               │
│  ▤ T3000 Documentation   v13.0   3 sources   built 12:04 ✓   [ Open ] [ ⋯ ]   │
│  ▤ BACnet Tools          v1.2    1 source    never built     [ Open ] [ ⋯ ]   │
│ NEEDS YOU (all projects)                 RECENT ACTIVITY                      │
│  ⚑ 2 drafts waiting       T3000          12:04 build site ✓ T3000             │
│  📷 1 screenshot to place  T3000          11:40 capture placed → Scaling       │
└───────────────────────────────────────────────────────────────────────────────┘
```

### C. Create a project (4 steps)

```
 1 ORIGIN   ◉ Blank · ○ From a template · ○ From a repository · ○ Import a document set · ○ Open existing
 2 BASICS   Name [T3000 Documentation]  Version [13.0]  Owner [alice ▾]  Audience [developer ▾]
 3 SOURCES  ☑ ⎇ t3000webview [main ▾] [src/**]   ☑ ⎇ t3000-esp [main ▾]   ＋ GitHub org · folder · archive
 4 OUTPUTS  Engine [DocFX ▾]  ☑ Website ☑ PDF ☑ CHM ☑ Search index ☐ AI index  →  Review  →  [ Create ]
```

Create writes `documents`, `doc_sources`, `recipes` and the smallest valid `docs/help/registry.json`. The six default sections are seeded for a blank project: Overview, Guides, Architecture, API, Troubleshooting, Release Notes.

### D. First open (empty project)

```
┌────┬───────────────────────────┬──────────────────────────────────────────────────────────┐
│ ▤◀ │ DOCS                ＋ 🗀 ⟳│ T3000 Documentation 13.0                                 │
│    │ ▾ T3000 Docs · 13.0       │  Your project is ready. Next:                            │
│    │     (empty)               │   ① Add the first page            [ New Page ]           │
│    │ ▸ NEEDS YOU          (0)  │   ② Bring in existing material     [ Import ]            │
│    │ ▸ SOURCES            (2)  │   ③ Let the AI draft from sources  [ Draft sections ]    │
│    │ ▸ PUBLISH                 │                                                          │
└────┴───────────────────────────┴──────────────────────────────────────────────────────────┘
```

## 3. The window

```
┌────┬─────────────────────────────┬──────────────────────────────┬──────────────────────────┐
│ ▤◀ │ DOCS                  ＋ 🗀 ⟳│ first-project.md × │ Preview │ ASSIST                   │
│    │ ▾ T3000 Docs · 13.0  (pick) │                              │ [Draft][Properties]      │
│    │   ▾ Overview            3   │ markdown editor              │  title · owner · ship    │
│    │   ▾ Guides             14   │  Ctrl+Alt+S inserts image    │  keywords · help ids     │
│    │     ▾ Getting Started   4   │                              │  code · reviewed         │
│    │         First project  ●    │                              │                          │
│    │   ▸ API · Troubleshooting…  │                              │                          │
│    │ ▸ NEEDS YOU (7)  collapsed  │                              │                          │
│    │ ▸ SOURCES (3)    collapsed  │                              │                          │
│    │ ▸ PUBLISH        collapsed  │                              │                          │
├────┴─────────────────────────────┴──────────────────────────────┴──────────────────────────┤
│ T3000 13.0 · 318 pages · 14 stale · 0 problems         ⚑ 2 drafts        site ✓ · help ✗    │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

Constraints from the VS Code API that shape this layout:

- A tree view cannot hold dropdowns, so **the project is the tree's first row**. Clicking it opens a quick-pick; the view title shows it too.
- The three lower views are independent panes, collapsed by default. There is no accordion behaviour.
- A text editor has no tabs: Edit and Preview use the Markdown side-by-side preview, and **Properties is a tab in the right panel**.
- Dropping on the tree reports only the row dropped on, never the gap between rows.
- The tree is **path-based**. A page id is its path under `docs/`, so `guides/getting-started/install.md` is the page `install` in the folder `getting-started`, inside `guides`. Every folder level is derived from those paths: the registry does not have to name the middle folders, and folders nest to any depth.

## 4. E. The Pages tree

### Rows and hover icons

```
 PAGES                                            ＋  🗀  ⇩  ⟳  ⋯
┌────────────────────────────────────────────────────────────────────┐
│ ▾ Guides                                    14                     │
│   ▾ Getting Started                  [＋][🗀][⋯]     ← folder hover │
│       Install                                                      │
│       First project   ●              [📷][✦][⋯]      ← page hover   │
│       Licensing                                                    │
│ ▾ API                                                              │
│   ▾ Data Points API                                                │
│       Scaling         ⚠  📷                                         │
│         └ ⚠ code changed since last review                         │
│         └ 📷 no image on this page                                 │
└────────────────────────────────────────────────────────────────────┘
 Folder row: name and page count only. Leaf row: title only.
 State is a badge (● draft · ⚠ stale · 📷 no image) or a folded child, never an extra row.
 Hover icons: folder = ＋ New Page · 🗀 New Folder · ⋯ ;  page = 📷 Capture · ✦ Draft with AI · ⋯
 Tooltip: id · owner · audience · last change.
```

### New page and new folder: the selection is the location

```
 Selected row            New Page lands…            New Folder lands…
 ─────────────────────   ────────────────────────   ──────────────────────
 nothing / empty space   at the root of the section the root
 a folder                inside it                  inside it (a sub-folder)
 a page                  next to it                 next to it
```

```
 click ＋ (or Ctrl+N with the tree focused)
 ┌────────────────────────────────────────────────────────────────────────┐
 │ New page in  Guides / Getting Started                                  │
 │ [ First project________________________ ]                              │
 │   → getting-started/first-project.md                                   │
 │                              Enter = create    Esc = cancel            │
 └────────────────────────────────────────────────────────────────────────┘
          │ Enter ─► file written, registry entry added, row selected, page opens
```

| Act | You type | Automatic |
|---|---|---|
| New Page | title | file name from the slug, kind Article, last position, registry entry, empty template |
| New Page ▸ Task / Reference / Troubleshooting / Release Note | title | the same, with the kind set |
| New Folder | folder name | the folder and its first page, since an empty chapter does not exist in the registry |

The input box is a quick-input, the closest thing the extension API allows to Explorer's inline edit. Renaming in the row itself would need a change to the core of this fork and is deferred.

### Context menus

```
 on a FOLDER row             on a PAGE row                    on empty space
┌─────────────────────┐    ┌───────────────────────────┐    ┌─────────────────┐
│ New Page…           │    │ Open · Open to the Side   │    │ New Page…       │
│ New Folder…         │    │ ───────────────────────── │    │ New Folder…     │
│ Import Here…        │    │ New Page…  (sibling)      │    │ Import…         │
│ ─────────────────── │    │ New Page of a Kind  ▸     │    │ Refresh         │
│ Rename…       F2    │    │ ───────────────────────── │    └─────────────────┘
│ Move Up / Down      │    │ Rename File…       F2     │
│ ─────────────────── │    │ Rename Title…  Shift+F2   │
│ Reveal · Copy Path  │    │ Move Up / Down            │
│ Delete…             │    │ ───────────────────────── │
└─────────────────────┘    │ Capture…  Ctrl+Alt+S      │
                           │ Paste Image  Ctrl+Alt+V   │
                           │ Draft a Change with AI…   │
                           │ Mark Reviewed             │
                           │ ───────────────────────── │
                           │ Reveal · Copy Path        │
                           │ Delete…                   │
                           └───────────────────────────┘
```

### Keys

```
 F2 rename file (old id kept as an alias)    Shift+F2 rename title only    Delete  with confirmation
 Ctrl+C / Ctrl+X / Ctrl+V  copy or move rows between folders      Enter / click  open the page
```

F2 moves the file, the repository's own generator writes the new registry entry, and the old id is written into `aliases` first. A project with no generator is refused, because the rename would orphan inbound links.

### Drag and drop

```
 drag a page   onto a FOLDER row  → into that folder, last position
               onto a PAGE row    → into that page's folder, right after it
               onto empty space   → to the section root
 multi-select  Ctrl/Shift+click, then drag together          Ctrl+drag  copies
 every move    → file moves, `order` rewritten, old id kept as an alias
 refused       → into itself or its own child; across projects
 from the OS   → a .md, .png or .docx dropped on a folder is imported there
```

## 5. F. Editing a page

```
┌───────────────────────────────────────────────────────────────┬──────────────────┐
│ first-project.md        [ side-by-side Preview ]              │ ASSIST           │
│ # First project                                               │ [Draft][Ask][Props]
│ Points carry a scale factor.                                  │ Draft from…      │
│ ![Trend log](media/02-trend.png)  ◄─ Ctrl+Alt+S inserts this  │  ◉ source file   │
│                                                               │  ○ another page  │
│                                                               │ RESULT (diff)    │
│                                                               │ [Apply][Reject]  │
└───────────────────────────────────────────────────────────────┴──────────────────┘
 Capture: snip overlay → clipboard → media/NN-slug.png (warn < 1600 px, refuse > 2 MB).
 No page in front → .temco/captures/ and a row in NEEDS YOU until it is attached.
 Apply is one undoable edit. Drafts wait in SQLite until accepted.
```

The **Properties** tab is the form over the registry fields: title, section, order, owner, audience, ship, keywords, help ids, code, reviewed.

## 6. G. Needs You and the AI loop

```
 NEEDS YOU (7)
  📷 Screenshots to place (1)  row → "which page takes it?"
  ⚠ Retake these (4)          row → the page
  ○ Never reviewed (2)        row → the report
  ● Drafts waiting (2)        row → diff, Apply / Reject

 source changes ─► commit summarised once (model recorded) ─► mapped to pages (code-glob · path · terms)
   ─► page marked stale ─► NEEDS YOU ─► Draft a Change ─► draft row ─► diff ─► Apply
```

## 7. H. Publish

```
┌────────────────────────────────────────────────────────────────────┐
│ PUBLISH · T3000 Documentation 13.0                                 │
│  ① REVIEW ───► ② BUILD ───► ③ RELEASE                              │
│  2 waiting     site ✓ help ✗   not released                        │
│ ① drafts and changed pages: [Open diff] [Approve]                  │
│ ② Engine [DocFX ▾] ☑Website ☑PDF ☑CHM ☐ZIP   [▶ Build]             │
│    success is the artifact left behind, never the exit code        │
│ ③ Writes products/t3000/releases/13.0, latest → 13.0   [⬆ Release] │
└────────────────────────────────────────────────────────────────────┘
```

## 8. I. Result on disk, and Temco Learn

```
 products/t3000/
   manifest.json   {id, title, version}
   docs/ guides/ api/ assets/ toc.yml docfx.json
   releases/13.0 · 12.9 · 12.8      latest → 13.0
                    │
                    ▼
 Temco Learn discovers products/*  →  Home · Product page · Doc page · Downloads (Online · PDF · CHM · ZIP)
```

The Learn page's top navigation mirrors the project's sections, so what the writer sees in the tree is what the reader sees.

## 9. SQLite storage (catalog.sqlite)

```
 organisations ─┬─< repositories           cache of what GitHub listed
                │
 sources ───────┤  kind git|folder|archive · remote_url · path · branch · registry_path · last_commit
   │            └──< scans
   ├──< commits ──< commit_pages           sha · summary · summary_model · how: code-glob|path|terms
   │ n..n (doc_sources: branch, include_glob, role)
   ▼
 documents  (the PROJECT)  name · slug · version · audience · owner · origin · template
   ├── 1:1 ─ recipes          engine · config_path · script · outputs
   ├──< pages                 id · path · title · owner · reviewed_at · stale · counts   (cache of registry.json)
   ├──< builds ──< artifacts  status · revision · log_path  /  kind · path · bytes · sha256
   ├──< releases              version · destination · files · published_at · build_id
   └──< drafts                page_id · title · body · state draft|accepted|discarded
 events  at · kind · subject · detail · seen_at       meta  key/value schema version
```

## 10. What the extension does now

The rule this table records: **one list, one owner.** Every kind of list has exactly one surface, and a webview page never lists something a tree or a panel already lists. Everything a webview page *did* became a command on that surface.

| Then | Now |
|---|---|
| views Pages, Project, Pipeline, Working Set, plus the queue declared in `temco-workbench` | Pages, Needs You, Sources, Publish — all declared by `temco-docs` |
| 3-step New Page wizard | the selection is the location; one title box |
| 10 webview pages (projects, project, needs, repository, documents, page, source, review, builds, releases) | 2 left: **Project home** and **Release report**. The other eight commands still exist and now focus the surface that owns the list, so every button and menu item in the other modules still lands somewhere |
| the tree stopped at area → chapter → page | the tree is a path: folders inside folders, any depth, like Explorer |
| Working Set | removed (use Open Editors) |
| Properties as an editor panel | the right panel's **Properties** tab, beside **Draft** |
| publishing copied artifacts | publishing also writes `manifest.json` per product and regenerates the Learn portal |
| `home.ts`, `views.ts` named in `extension-design.md` | do not exist; that document now points here |

## 11. Where the work stands

Done:

1. The three older documents carry a pointer here instead of a competing layout.
2. The four views, the queue moved out of `temco-workbench`, `Sources`/`Publish` renamed.
3. The project is the tree's first row; a new project is seeded with the six sections.
4. New Page and New Folder take their location from the selection; hover icons; multi-select drag and drop.
5. Properties is a tab in the right panel.
6. `manifest.json` is written on publish, and the Learn portal is generated from every product's manifest.

Not done, and deliberately so:

- The `temco-learn` site itself. The portal is generated by this extension and served from local storage; a real reader site is a separate repository.
- Inline rename in the tree row. It needs a change to the fork's tree widget; an input box is the closest the extension API allows.
- Dropping *between* rows. The tree reports only the row dropped on, so a drop on a page means "after it".

## Open decisions

- Whether `products` becomes a table later (versions open side by side).
- Whether the six sections stay fixed, or are defined per project in `manifest.json`.
