# temco-repositories

The organisation and the local copies of it. It lists the repositories, reads a source into the platform's memory — from a folder on this machine or over the GitHub API — and keeps the working area where clones live.

| | |
|---|---|
| Extension id | `temcocontrols.temco-repositories` |
| Namespace | `temcoRepositories` |
| State | active |
| Page | The Repositories (`temcoRepositories.page`) — one tab in the group our pages share |
| Requires | `temcocontrols.temco-store`, `temcocontrols.temco-ui` |
| Settings | `temcoRepositories.organisation`, `temcoRepositories.workspaceFolder` |

## What it owns

```
src/extension.ts        activation, the page command, and the API other modules call
src/store.ts            what it reads of the store — the catalog and the selection, in one file
src/ui.ts               what it reads of the UI module — where a page opens, what a command argument names
src/surface.ts          the page's own view type
src/repository.ts       the organisation's list as an API read, and the code files of a source
src/read.ts             reading a source: the registry it declares, from a folder or over the API
src/workarea.ts         the working area: clone, pull, remove, and where a copy lives
src/repositoriesPage.ts the page that lists what is there and what has been read
```

## The one act that writes

Reading a source writes to the **store**, never to a source: the pages it found, the branch it read, the state it concluded. Nothing is ever written to a repository, nothing is ever pushed, and the working area is a folder of its own (`~/Temco` by default) — outside every repository on purpose.

A clone is **never automatic**. A first read says a local copy would help and offers one; from then on it is a command or a page button, and both name the folder they will write to first. One branch with full history, not `--depth 1`: the history is what a draft reads and what a staleness check needs, and a shallow clone would break both.

## Commands

| Command | What it does |
|---|---|
| `temcoRepositories.page` | opens the page listing the organisation |
| `temcoRepositories.readSource` | reads one source's registry into the catalog |
| `temcoRepositories.readAllSources` | reads every source of the project being worked on |
| `temcoRepositories.removeSource` | forgets a source — its rows go, the repository does not |
| `temcoRepositories.revealSource` | opens the source's page on GitHub, or the folder it is on |
| `temcoRepositories.setSourceBranch` | the branch a repository is read at |
| `temcoRepositories.openFile` | a file read over the API, opened read-only |
| `temcoRepositories.setToken` | the GitHub token, in secret storage — never in a file, never in a setting |
| `temcoRepositories.fetchSource` | clones a source into the working area |
| `temcoRepositories.pullSource` | `pull --ff-only` on a cloned source |
| `temcoRepositories.openClone` | opens the local copy in a new window |
| `temcoRepositories.removeClone` | removes the local copy, after naming it |
| `temcoRepositories.changeWorkspaceFolder` | where the working area is |
| `temcoRepositories.openWorkFolder` | opens the working area |

## What it offers other modules

`onDidChange` (the catalog changed in a way a surface shows), `codeFiles(source)` and `readMaterials(source, files)` — the material a new page is drafted from, which is what `temco-docs`' new-page form asks for. Declared in `extensionDependencies`, so the exports are ready before a consumer's `activate()` runs.

## What it deliberately does not own

- **What a registry means.** A read records what a source's `registry.json` declares; the registry's shape, its checks, its areas, chapters and pages are `temco-docs`'. This module needs nothing from that module.
- **The surfaces that show sources.** The Library's rows belong to the workbench; this module publishes facts and opens its own page.
- **Where a page opens.** That rule is `temco-ui`'s, read here through `src/ui.ts`.

## Checks

```
npm run check-commands      # no command id is registered twice
```
