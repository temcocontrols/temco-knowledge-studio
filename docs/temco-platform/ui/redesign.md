# Redesign: the documentation center layout

Supersedes the layout parts of `app-flow.md`, `authoring-flow.md` and `extension-design.md`, which contradict each other. Draft for review; nothing here is built yet.

## 1. The model (from the origin discussion)

```
 Sources ─► Temco Platform (authoring) ─► Product Package ─► Temco Learn (website) 
 repos, pdf,   projects · AI · review       products/<id>/         search · downloads · versions
 word, chm                                  manifest.json          DocFX = one build engine,
                                            docs/ api/ guides/     CHM/PDF/ZIP = other exporters
                                            assets/ releases/
```

| System | Job | Where |
|---|---|---|
| **Temco Platform** | where people work: projects, sources, AI drafts, review, generate | this repo (the VS Code fork) |
| **Product Package** | the unit of exchange; a plug-in the portal discovers | `products/<id>/` |
| **Temco Learn** | the reader's MSDN-style portal | `temco-learn` repo |
| **DocFX** | one pluggable build engine | called by Build, never a surface |

Vocabulary, one word per thing: **Product** (T3000) → **Version** (13.0) → **Section** (Overview, Guides, API, Troubleshooting, Release Notes) → **Page**. This replaces Area/Chapter/Project/Source overlap in the UI. The registry fields stay as they are; only the labels change.

## 2. The layout

One activity-bar icon for the whole center, named **Docs**. Dashboard, Learn and the docs container merge into it; Explorer, Search, Repositories, AI, SQL, Settings stay as they are.

```
┌─ ACTIVITY ─┬─ DOCS ─────────────────────┬─ EDITOR ──────────────────────────┬─ ASSIST ───────┐
│ Explorer   │ [T3000 ▾]  [13.0 ▾]   ＋ ⟳ │ Page tab · Preview · Properties   │ Draft (AI)     │
│ Search     │ ▾ Overview                 │                                   │  from a source │
│ ▤ Docs     │ ▾ Guides                   │ # Data Points API                 │  another page  │
│ Repos      │   ▾ Getting Started        │ …markdown…                        │ Ask this page  │
│ AI         │       Install              │ ![](media/01-…)                   │  with citations│
│ SQL        │       First project  ●     │                                   │ Result (diff)  │
│            │ ▸ Architecture             │                                   │ [Apply][Reject]│
│            │ ▸ API                      │                                   │                │
│            │ ▸ Troubleshooting          │                                   │                │
│            │ ▸ Release Notes            │                                   │                │
├────────────┤────────────────────────────┤                                   │                │
│            │ NEEDS YOU (7)              │                                   │                │
│            │ SOURCES (3)                │                                   │                │
│            │ PUBLISH                    │                                   │                │
└────────────┴────────────────────────────┴───────────────────────────────────┴────────────────┘
```

### Left panel: three zones, in this order

1. **Header: Product and Version pickers.** This is the whole "project" concept. Picking a product makes the rest of the panel about it. Replaces the Dashboard Projects list and the Project section.
2. **PAGES: the tree.** Same look as the original tree: folder rows with a page count, leaf rows showing only the title. The top level is the product's sections in the MSDN order (Overview, Guides, Architecture, API, Troubleshooting, Release Notes), mirroring the portal's own navigation, so the tree *is* what the reader will see. State is shown by a badge, never by extra rows: `●` draft waiting, `⚠` stale, `📷` missing image.
3. **Three collapsed views beneath, only one open at a time:**
   - **NEEDS YOU**: screenshots to place, stale pages, never reviewed, drafts awaiting review. Each row opens the page.
   - **SOURCES**: what the AI reads (repos, PDF, Word, CHM). `＋` imports.
   - **PUBLISH**: Review · Build · Release (below).

Removed: Working Set (use the editor's Open Editors), Pipeline as a separate section, Dashboard as a container.

### Tree actions

| Where | Action |
|---|---|
| view title | ＋ New Page · ⟳ Refresh · ⋯ New Section, Import, Capture, Paste |
| row inline | New below · Rename (F2 = file with alias, Shift+F2 = title) · Capture |
| row menu | Move up/down (drag later), Properties, Reveal, Copy path |
| drag | reorder (writes `order`) |

### Editor: the page, three tabs

**Edit** (Markdown) · **Preview** (as the portal renders it) · **Properties** (the form over `registryEdit`: title, owner, audience, ship, keywords, help_ids). Properties moves from a separate webview page into a tab of the page it belongs to. Captures (Ctrl+Alt+S, Ctrl+Alt+V) keep working unchanged.

### Right panel: Assist

Open only while a page is open. **Draft** (what may the model read; result as a diff, Apply is one undo) and **Ask this page** (citations checked as today). The AI also knows related pages, source repos and release notes, as in the origin.

## 3. The flow

```
 ① pick Product + Version        header
 ② ＋ Import sources              SOURCES   (repo, pdf, word, chm)
 ③ AI drafts the sections         ASSIST    Getting Started · Architecture · API · Troubleshooting · Release Notes
 ④ edit the page, capture         tree → editor
 ⑤ clear NEEDS YOU                stale, missing images, drafts
 ⑥ PUBLISH → Review → Approved → Build → Release
```

**PUBLISH** is one page with three stages, each showing its state:

| Stage | Does |
|---|---|
| Review | drafts and changed pages, Approve or Reject |
| Build | pick outputs: Website (DocFX engine) · PDF · CHM · ZIP. Engines are plug-ins; success is judged by the artifact, never the exit code |
| Release | writes `products/<id>/releases/<version>` and the `manifest.json`, and `latest` points at it; Learn discovers it with no portal change |

## 4. Disk contract with Temco Learn

```
products/t3000/
  manifest.json      { "id": "t3000", "title": "T3000", "version": "13.0" }
  docs/ guides/ api/ assets/
  toc.yml docfx.json
  releases/13.0 · 12.9 · 12.8      latest → 13.0
```

Platform writes it; Learn only reads it. Downloads (Online, PDF, CHM, ZIP) come from `releases/<version>`.

## 5. What this changes in the extension

| Today | After |
|---|---|
| containers `temco`, `temcoDashboard`, … | one `temcoDocs` container |
| views Pages / Project / Pipeline / Working Set + queue in workbench | Pages / Needs You / Sources / Publish, all declared by `temco-docs` |
| webview pages: project, needs, review, builds, documents, properties | Publish page, new-page flow, Properties tab; the rest folded into the tree |
| `home.ts`, `views.ts`, "Content" view in the docs | deleted from the docs (they do not exist) |
| "project" row list | Product + Version pickers |

## 6. Build order

1. Agree this doc; delete the contradicting layout sections in the three older docs.
2. Container and views in `package.json`; move the queue view from `temco-workbench`.
3. Product/Version pickers; section-ordered tree.
4. Properties as a tab; Publish page (Review · Build · Release).
5. `manifest.json` and release writer; then the `temco-learn` reader.

## Open decisions

- Does the Dashboard survive as a start page (recent products, activity)? Proposed: yes, as an editor page, not a container.
- Are product sections fixed to the six names, or per-product? Proposed: fixed defaults, extendable in `manifest.json`.
