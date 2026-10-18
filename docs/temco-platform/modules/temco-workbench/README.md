# `temco-workbench`

The application's own surfaces. It is the only module that is not a domain: it owns the **Library** (the index of what every module has), the **dashboard**, the **needs page**, and the two layout decisions that come with them — which tab opens at startup, and which sidebar section comes forward when the project changes.

| | |
|---|---|
| Folder | `extensions/temco-workbench` |
| Extension id | `temcocontrols.temco-workbench` |
| Namespace | `temcoWorkbench` |
| State | active |
| View | **Library** (`temcoWorkbench.library`), contributed into the `temco` activity-bar container that the documentation module declares |
| Pages | `temcoWorkbench.home` (the dashboard), `temcoWorkbench.workspaces` (All Workspaces), `temcoWorkbench.workspace` (one open folder), `temcoWorkbench.templates` (the shapes a project can start from), `temcoWorkbench.needs` (what wants a person), `temcoWorkbench.welcome` (the page a new window opens on) |
| Setting | `temcoWorkbench.start.open` — `welcome` · `project` · `page` · `home` · `none` (default `welcome`) |
| Requires | `temco-store`, `temco-ui`, `temco-repositories`, `temco-docs` |
| Required by | `temco-docs` — nothing; the dependency runs one way, and the workbench reads the documentation module's model |

## Responsibilities, one file each

| Module | Owns |
|---|---|
| `src/extension.ts` | activation: builds the three surfaces, wires their signals, and decides the first tab |
| `src/views.ts` | the Library — one row per thing every module has (needs attention, projects, sources, repositories, the AI), each row's actions being that module's own commands |
| `src/home.ts` | the dashboard: identity, how the application works, what exists now, how to start, and every feature with its state |
| `src/welcome.ts` | the welcome page: what the application is for, five ways in, three walkthroughs, and the one preference it carries (open at startup) |
| `src/settings.ts` | the settings page: the choices the application itself owns (`start.open`), and a filtered route into the settings editor for the ones the modules own |
| `src/help.ts` | the help page: the build's real identity, the module register read from the host, and where a report goes |
| `src/workspaces.ts` | the three Workspaces surfaces — All Workspaces, one page per workspace, Templates — rebuilt from the mock word for word, over the mock's own sample (`src/workspacesSample.ts`): the platform keeps no register of workspaces, so the list is the design's |
| `src/needsPage.ts` | what wants a person, gathered from every module into one list with the reason and where the fix is |
| `src/surface.ts` | the page view types |
| `src/docs.ts` · `src/store.ts` · `src/ui.ts` · `src/repositories.ts` · `src/aiModule.ts` | what it reads of the documentation module, the store, the UI rules, the repository scripts and the AI — each in one file, because an extension cannot import another extension's sources |

## Commands

`temcoWorkbench.home` (the dashboard) · `temcoWorkbench.openNeeds` (the needs page) · `temcoWorkbench.welcome` (the welcome page) · `temcoWorkbench.toggleWelcomeStartup` (the checkbox in its footer, which writes `temcoWorkbench.start.open`) · `temcoWorkbench.settings` (the settings page) · `temcoWorkbench.setStartOpen` (the one command a row on it runs) · `temcoWorkbench.help` (the help page) · `temcoWorkbench.workspaces` (the open folders). Everything the Library's rows and menus do is another module's command — the menus are here, the work is not.

## What the pages refuse to invent

The mock has surfaces whose content this product cannot honestly produce, and none of them were copied across:

| Mock page | Here |
|---|---|
| Help › Keyboard Shortcuts, Help › Logs | Not built. VS Code publishes neither list to an extension, and a page that guessed would be a page that lies. The Help page carries what is real instead: the build, the module register, the platform string, and the issue tracker. |
| Workspaces › Templates | Built as the mock draws it, over the mock's own sample in `src/workspacesSample.ts`. The platform does not write a template yet, and the page says so rather than presenting the sample as live. |
| Devices, I/O Studio, BACnet, Network, SQL Studio | Not built. Those modules are reserved — a page over a module that does not exist would be a mock inside the product. |

## The welcome page, and why it is the default

A window that opens on a page you did not ask for has to earn it, so the welcome page carries only what a person can act on: five ways in (each a button running another module's command), three walkthroughs that list their steps instead of claiming progress, and a footer whose single checkbox writes the setting that decides the first tab. There is no picture of the product on it.

It is a page and not the dashboard because the dashboard answers "what is in the project you are working on", and a window that has just started may have no project at all. `start.open` therefore begins at `welcome`, and `project`, `page` and `home` remain one setting away — the fall-through chain is unchanged, so a preference that cannot be honoured still lands on something rather than an empty editor.

## Boundary rules

- **The Library is an index, not a domain.** It shows what the store recorded and what the documentation module published; it owns no data of its own and keeps no copy.
- **A row's action belongs to the module that owns the thing.** *Read a source* is `temcoRepositories.readSource`, *Build the project* is `temcoProjects.buildProject`, a page's *Rename* is `temcoDocs.renamePage`. The Library names them; it never re-implements one.
- **Nothing here writes.** The only state it changes is the project being worked on, and that is the store's own command.
- **The AI is optional for it too.** The Library's AI row appears only when that module is installed — asked, never assumed.
- **The Workspace is not its view.** The tree of pages is the documentation module's own view; the workbench only *brings it forward* by id when the project changes.
