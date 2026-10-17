# temco-workbench

The application's own surfaces — and the only module that is not a domain.

| | |
|---|---|
| Extension id | `temcocontrols.temco-workbench` |
| Namespace | `temcoWorkbench` |
| State | active |
| Views | **Library** (`temcoWorkbench.library`), in the `temco` activity bar beside the Workspace |
| Pages | the **dashboard** (`temcoWorkbench.home`), the **needs page** (`temcoWorkbench.needs`) |
| Requires | `temcocontrols.temco-store`, `temcocontrols.temco-ui`, `temcocontrols.temco-repositories`, `temcocontrols.temco-docs` |
| Settings | `temcoWorkbench.start.open` |

## What it owns

```
src/extension.ts   activation: the Library, the dashboard, the needs page, the startup, the sidebar sequence
src/views.ts       the Library — one row per thing every module has, and the needs row inside it
src/home.ts        the dashboard — what the application is, what exists now, how to start
src/needsPage.ts   what wants a person, said in full
src/surface.ts     the page view types
src/docs.ts        what it reads of the documentation module — the sets, the pages, the counts, the scripts
src/store.ts       what it reads of the store — the platform's memory
src/ui.ts          what it reads of the UI module — where a page opens, what a command argument names
src/repositories.ts  what it reads of the repositories module — the repository's own scripts
src/aiModule.ts    what it knows of the AI module — whether it is installed, and nothing more
```

## Why it exists

The Library is not about documentation. It lists what **every** module has — projects, sources, repositories, pages, and the AI — and each row's actions are that module's own commands. The dashboard is the application talking about itself, and the needs page is one list of everything that wants a person, gathered from every module. While those lived in the documentation module, that module was the application, and every other module had to be reached through it.

Two layout decisions came with them, and they belong here for the same reason: **which tab opens at startup** (`temcoWorkbench.start.open`: the project you are on, the page you last opened, the dashboard, or nothing) and **which sidebar section comes forward** when the project changes (choosing one brings the Workspace, clearing one brings the Library back).

## What it does not own

- **Nothing of any domain.** No registry, no catalog, no build, no source. Every fact it shows it asks for: the sets and the counts from the documentation module (`src/docs.ts`), the rows from the store, the scripts from the repositories module.
- **No writes.** The only write in this module is the one the store makes when the project is chosen — and that is the store's own command.
- **No page of a module.** The Workspace tree is the documentation module's view, the projects and repositories pages are theirs, and the AI panel is its own. The Library points at all of them.

## Commands

| Command | What it does |
|---|---|
| `temcoWorkbench.home` | opens the dashboard |
| `temcoWorkbench.openNeeds` | opens the needs page — what the Library's *Needs attention* row means in full |

## Checks

```
npm run check-commands      # no command id is registered twice
```
