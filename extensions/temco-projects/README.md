# temco-projects

A documentation project as a thing: its name, its version, the sources it is made of, the outputs it produces, and what building one left behind.

| | |
|---|---|
| Extension id | `temcocontrols.temco-projects` |
| Namespace | `temcoProjects` |
| State | active |
| Pages | the **hub** (`temcoProjects.hub`), the **edit form** (`temcoProjects.project`) — tabs in the group our pages share |
| Requires | `temcocontrols.temco-store`, `temcocontrols.temco-ui`, `temcocontrols.temco-repositories` |
| Settings | none |

## What it owns

```
src/extension.ts      activation, the change signal, and the one thing it offers others
src/store.ts          what it reads of the store — the catalog, the selection, the slug rule
src/ui.ts             what it reads of the UI module — where a page opens, what a command argument names
src/repositories.ts   what it reads of the repositories module — the repository's own scripts
src/aiModule.ts       what it knows of the AI module — the facts its hub shows, and that it may be absent
src/surface.ts        the two view types
src/projectHub.ts     one project in depth: Overview · Pages · Sources · AI · Builds
src/projectPage.ts    the form that names a project and its sources
src/project.ts        the commands that act on a project: create, edit, remove, work on one, add a source
src/projectBuild.ts   building a project's outputs, in the source repository that owns the script
```

## The unit, and what it is not

A **project** is the thing a person manages. Its row is the store's `documents` table — the name is a migration for a word nobody sees, and the table keeps it.

- **The pages a project has** are read from the platform's memory, where a read recorded them — this module does not parse a registry and does not need `temco-docs` to.
- **Its sources** are rows in the store; reading, cloning and running a source's own scripts belong to `temco-repositories`.
- **Its outputs** are the recipes recorded against it (site, offline help, PDF), and a build is invoked in the source's own folder and judged by the files it left behind — never by an exit code, and never the deploying form of the help build.
- **The AI** is optional and is not a dependency: the hub asks the AI module for its facts when it is installed, and says it is not installed when it is not.

## Commands

| Command | What it does |
|---|---|
| `temcoProjects.newProject` | the form: name, version, audience, owner |
| `temcoProjects.openProject` | opens a project's hub |
| `temcoProjects.editProject` | opens the form on an existing project |
| `temcoProjects.removeProject` | removes the project's rows — the repositories are untouched |
| `temcoProjects.selectProject` | makes one the project the window is working on |
| `temcoProjects.clearProject` | stops working on a project, without forgetting it |
| `temcoProjects.addSource` | adds a repository, a folder or an archive to a project |
| `temcoProjects.buildProject` | builds one output, in the source's own folder |

## What it offers other modules

`onDidChange` — the one signal a surface that lists projects needs, so the Library's rows come back when a project is created, edited or removed.

## Checks

```
npm run check-commands      # no command id is registered twice
```
