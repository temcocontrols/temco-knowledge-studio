# The application flow

> **Superseded for the Docs center.** The window layout, the Pages tree, the journey and the Publish flow are defined in [redesign.md](./redesign.md). Where this page disagrees with it, `redesign.md` wins.

The information architecture as built: the left toolbar, the four panels, the page in the middle, and the one right-hand panel. This is the confirmed design — `authoring-flow.md` is the capture stage inside it.

## Left toolbar

```
 ┌─────┐
 │  ⧉  │  Explorer          VS Code's own
 │  ⌕  │  Search            VS Code's own
 │  ▦  │  Dashboard         projects · overview · needs you · recent activity
 │  ▤  │  Documentation     pages · project · pipeline · working set
 │  ⧉  │  Repositories      org → repository → code files
 │  ✦  │  AI                models · drafts waiting
 │  ◫  │  Learn             site · delivery
 │  ▥  │  SQL Studio        query & browse · schema & maintenance
 │  ⚙  │  Settings          profile · platform
 │  ?  │  Help              learn · support
 └─────┘
```

The shell's `ORDER` holds the eight module containers (`temcoDashboard · temco · temcoRepos · temcoAiHub · temcoLearn · temcoSql · temcoSettings · temcoHelp`); Explorer and Search are VS Code's and come first.

## Dashboard — four views

| View | What the panel shows | The page behind it |
|---|---|---|
| **Projects** (`temcoProjects.projects`) | a row per project: sources · built · current, with `✎` and `ⓘ` | clicking a row opens the **project page** (`temcoDocs.projectPage`): counts, sources, outputs, build buttons |
| **Overview** (`temcoWorkbench.platformView`) | **the facts as rows** — Pages · Reviewed · Stale · Issues · Sources · Outputs · Build | each row opens its page (the tree, the report, Problems, the project form, Build Center) |
| **Needs You** (`temcoDocs.queue`) | the queue's groups; a group opens its page | the **queue page** (`temcoDocs.needsPage`): screenshots to place, retake these, never reviewed — each with its act |
| **Recent activity** (`temcoWorkbench.activityView`) | the activity row | the **activity page** (`temcoWorkbench.activity`): every recorded event, newest first |

```
 DASHBOARD                                        ⟳
 ┌────────────────────────────────────────────────────────────────┐
 │ PROJECTS                                              ＋        │
 │   T3000 Documentation          3 sources · built 12:04 · current│
 │                                                [ ✎ ] [ ⓘ ]    │
 │   My First Docs                1 source · never built          │
 │   Legacy Import                1 source · built 09:12          │
 ├────────────────────────────────────────────────────────────────┤
 │ OVERVIEW                                                       │
 │   Pages      318       Reviewed  304                           │
 │   Stale       14       Issues    0 · 3                          │
 │   Sources      3       Outputs   Site · help                    │
 │   Build      Build Center                                       │
 ├────────────────────────────────────────────────────────────────┤
 │ NEEDS YOU                                               (7)    │
 │   ▸ Screenshots to place (1) · Retake these (4) · Never… (2)    │
 ├────────────────────────────────────────────────────────────────┤
 │ RECENT ACTIVITY                                                │
 │   Recent Activity                        20 events              │
 └────────────────────────────────────────────────────────────────┘
```

`✎` = *Edit the Pages* (`temcoProjects.openProject`) → the project becomes the one being worked on and the Documentation panel shows its tree.
`ⓘ` = *Show the Project* (`temcoProjects.showProject`) → the Documentation panel comes forward at its **Project** section.

## Documentation — four views, the tree first

```
 DOCUMENTATION · T3000 Documentation          ＋  🗀  ⇩  📷  ⎘  ⟳  ⋯
 ┌────────────────────────────────────────────────────────────────┐
 │ ▾ T3000Webview-EEZ-Studio            318 · folder              │
 │   ▾ t3000                            142                       │
 │     ▾ bacnet-api                       3                       │
 │         Screen JSON — Format Reference      stale · no 📷      │
 │         Point Types                         never reviewed     │
 │         Trend Logs                          ✓                  │
 │     ▾ data-points                      5                       │
 │     ▸ features                        10                       │
 │   ▾ legacy                            12                       │
 │ ▾ T3000 Docs Mirror                  128 · read from GitHub    │
 │ ▸ T3000 Legacy Archive                 — · no local copy [ ⇩ ] │
 ├────────────────────────────────────────────────────────────────┤
 │ PROJECT                                                        │
 │   Sources  3                                                   │
 │   Outputs  Site · Offline help                                 │
 ├────────────────────────────────────────────────────────────────┤
 │ PIPELINE                                                       │
 │   ⚑ Review Center      2 drafts waiting                  →     │
 │   ▶ Build Center       site ✓ 12:04 · help ✗             →     │
 │   ⬆ Releases           13.0 published                    →     │
 ├────────────────────────────────────────────────────────────────┤
 │ WORKING SET (6)                                                │
 │   data-points/scaling-and-engineering-units                    │
 └────────────────────────────────────────────────────────────────┘
```

Title bar: `＋` New Page · `🗀` New Chapter · `⇩` Add a Source · `📷` Capture · `⎘` Paste · `⟳` Refresh.

## The page and the right panel

```
 ┌ DOCUMENTATION ────┬ Data Points API.md ──────────────────┬ DRAFT ────────────────┐
 │ ▾ t3000           │ [ B  I  H2  •  ❝  </>  🔗  📷 ]      │  Draft from…          │
 │   ▾ bacnet-api    │                                      │   ◉ a source file     │
 │       Screen…     │ # Data Points API                    │   ○ another page      │
 │       Point…      │                                      │   ○ a commit range    │
 │ PROJECT           │ Points carry a scale factor.         │ ────────────────────  │
 │   Sources 3       │                                      │  Model · prompt v3    │
 │ PIPELINE          │ ![Trend log setup](media/02-…)       │  [ Draft the Page ]   │
 │   Review · Build  │ 1 Trend log list  2 Period  3 Filter │  Result (diff)        │
 │ WORKING SET (6)   │                                      │  [ Apply ][ Reject ]  │
 └───────────────────┴──────────────────────────────────────┴───────────────────────┘
```

**The rule:** the right panel holds what you consult while working in the page — **DRAFT** for a documentation page, **SCHEMA** for a SQL query. Everywhere else it is closed.

## What the page is, for every row

| Left panel row | Page in the middle |
|---|---|
| a project row | the **project page** — counts, sources, outputs, build buttons |
| Overview · a fact row | the page it counts: tree · report · Problems · project form · Build Center |
| Needs You · a group | the **queue page** |
| Needs You · a capture | the attach prompt: which page takes it |
| Needs You · retake / never reviewed | the page, with its image |
| Recent activity · a row | the activity page |
| a tree page | the page, in the editor, DRAFT on the right |
| Project · a source | that source's page |
| Project · Outputs | the project's edit form |
| Pipeline · Review / Build / Releases | Review Center · Build Center · Releases |
| a Working Set row | the page |
| a repository row | the repository page |
| a model or a waiting draft | the AI page |
| a SQL table row | SQL, with the statement filled in |

## The flow

```
 ①  DASHBOARD · PROJECTS  ＋  → name · source (folder) · output (site)
        └─ the row appears, selected
             ├─ [ ✎ ] → DOCUMENTATION · tree
             └─ [ ⓘ ] → DOCUMENTATION · project + pipeline
 ②  DOCUMENTATION · ＋ New Page → location · kind · title → one file
        ├─ the row lands in the tree; F2 renames it
        ├─ [ Run the generator ] → it becomes a page
        └─ the page opens; Ctrl+Alt+S / Ctrl+Alt+V put a screen in its media/
 ③  DASHBOARD · Recent activity shows the build, the capture, the review
 ④  DOCUMENTATION · PIPELINE → Review Center · Build Center · Releases
```

## Two decisions worth naming

**A row's F2 renames the *file*, and keeps the old id as an alias.** The page id *is* the path (`05-content-and-registry.md`, rule 1), so the rename is the named act that rule allows: the file moves, the repository's own `docs:registry` writes the new entry, and the old id is written into that entry's `aliases` before anything else happens. Shift+F2 renames the title instead, which is the registry value. A project with no generator is refused — without one there is no entry to carry the alias, so the rename would orphan every inbound link.

**The right-hand panel is `DRAFT`.** It lives in the auxiliary bar and is about the page in front: *Draft a Change* asks what the model may read (this page's history · a source file · another page), and the drafts waiting for that page are applied or rejected there — the same commands the Review Center runs.

**Needs You replaced the workbench's Needs Work view.** They were the same question asked twice; the queue has real rows (captures with no page, stale pages, never reviewed) and the old view had one link.

## Still open

- **Annotation**, which waits on the callout decision in `authoring-flow.md` (a webview's DOM, Windows UI Automation, or by hand).
- A **`version-report.json` writer** in the product repository's release workflow: this application reads the file, and shows its pages on the project page and in **Needs You**, but nothing writes it yet.
