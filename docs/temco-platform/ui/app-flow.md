# The application flow

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

| View | The question | Data |
|---|---|---|
| **Projects** (`temcoProjects.projects`) | which project, and how healthy | the catalog |
| **Overview** (`temcoWorkbench.platformView`) | what the platform and this project hold | catalog + the registry read |
| **Needs You** (`temcoDocs.queue`) | what is waiting on a person | capture inbox · `stale` · never reviewed |
| **Recent activity** (`temcoWorkbench.activityView`) | what happened, and when | `catalog.events()` |

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
 │   Overview · Needs Review (count)                              │
 ├────────────────────────────────────────────────────────────────┤
 │ NEEDS YOU                                               (7)    │
 │   screenshots to place · retake these · never reviewed          │
 ├────────────────────────────────────────────────────────────────┤
 │ RECENT ACTIVITY                                                │
 │   Recent Activity                                              │
 └────────────────────────────────────────────────────────────────┘
```

`✎` = *Edit the Pages* (`temcoProjects.openProject`) → the project becomes the one being worked on and the Documentation panel shows it.
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
| a project row | the project, opened for work (its pages load) |
| Overview · Overview | the platform overview page |
| Overview · Needs Review | the needs page |
| Needs You · a capture | the page it should go on, capture at hand |
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

**A row's F2 renames the *title*, not the file.** The page id *is* the file path (`05-content-and-registry.md`, rule 1): every inbound link, the app's own routes and the MCP input are built on it. A file rename is therefore a named act that also writes an `aliases` entry so the old path keeps resolving — and that alias writer does not exist yet. Binding F2 to the rename that is safe (the label, which is the title) is what is built; the file rename waits for the alias work.

**Needs You replaced the workbench's Needs Work view.** They were the same question asked twice; the queue has real rows (captures with no page, stale pages, never reviewed) and the old view had one link.

## Still open

- Inline file rename with an `aliases` entry (above).
- `version-report.json` → the "retake these" rows get a source beyond `stale`.
- Annotation, which waits on the callout decision in `authoring-flow.md`.
