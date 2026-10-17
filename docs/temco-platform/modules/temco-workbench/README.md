# `temco-workbench`

The application's own surfaces. It is the only module that is not a domain: it owns the **Library** (the index of what every module has), the **dashboard**, the **needs page**, and the two layout decisions that come with them — which tab opens at startup, and which sidebar section comes forward when the project changes.

| | |
|---|---|
| Folder | `extensions/temco-workbench` |
| Extension id | `temcocontrols.temco-workbench` |
| Namespace | `temcoWorkbench` |
| State | active |
| View | **Library** (`temcoWorkbench.library`), contributed into the `temco` activity-bar container that the documentation module declares |
| Pages | `temcoWorkbench.home` (the dashboard), `temcoWorkbench.needs` (what wants a person) |
| Setting | `temcoWorkbench.start.open` — `project` · `page` · `home` · `none` |
| Requires | `temco-store`, `temco-ui`, `temco-repositories`, `temco-docs` |
| Required by | `temco-docs` — nothing; the dependency runs one way, and the workbench reads the documentation module's model |

## Responsibilities, one file each

| Module | Owns |
|---|---|
| `src/extension.ts` | activation: builds the three surfaces, wires their signals, and decides the first tab |
| `src/views.ts` | the Library — one row per thing every module has (needs attention, projects, sources, repositories, the AI), each row's actions being that module's own commands |
| `src/home.ts` | the dashboard: identity, how the application works, what exists now, how to start, and every feature with its state |
| `src/needsPage.ts` | what wants a person, gathered from every module into one list with the reason and where the fix is |
| `src/surface.ts` | the page view types |
| `src/docs.ts` · `src/store.ts` · `src/ui.ts` · `src/repositories.ts` · `src/aiModule.ts` | what it reads of the documentation module, the store, the UI rules, the repository scripts and the AI — each in one file, because an extension cannot import another extension's sources |

## Commands

`temcoWorkbench.home` (the dashboard) · `temcoWorkbench.openNeeds` (the needs page). Everything the Library's rows and menus do is another module's command — the menus are here, the work is not.

## Boundary rules

- **The Library is an index, not a domain.** It shows what the store recorded and what the documentation module published; it owns no data of its own and keeps no copy.
- **A row's action belongs to the module that owns the thing.** *Read a source* is `temcoRepositories.readSource`, *Build the project* is `temcoProjects.buildProject`, a page's *Rename* is `temcoDocs.renamePage`. The Library names them; it never re-implements one.
- **Nothing here writes.** The only state it changes is the project being worked on, and that is the store's own command.
- **The AI is optional for it too.** The Library's AI row appears only when that module is installed — asked, never assumed.
- **The Workspace is not its view.** The tree of pages is the documentation module's own view; the workbench only *brings it forward* by id when the project changes.
