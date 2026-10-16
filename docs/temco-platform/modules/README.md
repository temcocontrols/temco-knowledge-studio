# Modules

A module is a real VS Code extension inside the application. Namespaces follow the module ([../architecture/naming.md](../naming.md)).

## Register

| Module | Purpose | Namespace | State |
|---|---|---|---|
| `temco-docs` | the registry, pages, checks, editor surfaces, the catalog and the writes | `temcoDocs` | **active** |
| `temco-ai` | the local runtime and models, the prompts, the panel, drafts and answers | `temcoAi` | reserved |
| `temco-repositories` | the organisation, clones, pulls, history, the working area | `temcoRepositories` | reserved |
| `temco-projects` | projects, sources, outputs, builds | `temcoProjects` | reserved |
| `temco-sql` | registers, queries, export | `temcoSql` | reserved |
| `temco-nettools` | devices on the wire | `temcoNettools` | reserved |
| `temco-bacnet` | objects, points, trends | `temcoBacnet` | reserved |
| `temco-device-manager` | fleets, firmware, health | `temcoDevices` | reserved |

## States

| State | Contents | Build effect |
|---|---|---|
| **reserved** | `README.md` only | the build ignores the folder: nothing is compiled, nothing ships, no container appears |
| **active** | `package.json`, `tsconfig.json`, `src/` | compiled and shipped as a built-in extension |

A module becomes active on the day it has a first real feature. Reserving a module with a manifest would ship an extension with nothing in it, which is why a folder becomes a module only when it has something to do.

## Ownership

**`temco-docs`** — the content side: the registry of areas, chapters and pages, the structural checks, the Workspace and Library views, the pages, the Markdown surfaces, the **catalog** and the five writes. It owns the only write a page ever gets.

**`temco-ai`** — the local model: the runtime and models downloaded on request into the user's own folder, the prompts, the AI panel, drafts and their diffs, and the citations that open the page they name. It reads the catalog through `temco-docs` and never writes a page.

**`temco-repositories`** — the organisation and the local copies: the repository list, a source's files, cloning one branch with full history, `pull --ff-only`, removing the local copy, reading a file's text and history. It owns the working area (`temcoRepositories.workspaceFolder`, default `~/Temco`).

**`temco-projects`** — a project as a first-class thing: name, version, sources, outputs, and the builds that produce an output. It reads sources through `temco-repositories` and asks `temco-docs` for the pages it produces.

**`temco-sql`** — registers, queries and export against the databases the products use. It owns its own connections and storage.

**`temco-nettools`** — discovery, addressing, capture and inspection. The transport layer the device modules build on.

**`temco-bacnet`** — BACnet objects, points and trends, read through `temco-nettools` transports. It owns its object and point models and its storage.

**`temco-device-manager`** — fleets and health: inventory, firmware, status and the actions a person takes on a device. It reads devices through `temco-bacnet` and `temco-nettools`.

## Folder

```text
extensions/temco-<module>/
├── README.md              purpose, identifiers, what it owns — the only file a reserved module has
├── package.json           id, engine range, commands, views, settings, activation
├── tsconfig.json          extends ../tsconfig.base.json
├── src/
│   ├── extension.ts       the only activation entry: register, wire, dispose
│   └── <feature>/
├── media/                 icons, webview css and js
├── prompts/               model instructions as text, where a module needs them
└── scripts/               module-local gates
```

Its documentation is `docs/temco-platform/modules/temco-<module>/` **in this repository**, not a `docs` folder inside the module.
There is no `.vscodeignore`: the platform build packages a built-in module, `vsce` does not.

## Contract

1. Modules talk through commands, settings, files and events. No module imports another module's source.
2. The catalog belongs to `temco-docs`. Other modules read it through commands.
3. Each module owns its own storage under its own extension id — never inside a repository, never committed.
4. One module, one namespace. A command id is registered exactly once.
5. A module is a built-in extension. It uses the published `vscode` API only and never the shell's internals, so it still runs in an ordinary VS Code window.
6. A module never assumes the shell.

## Adding a module

1. Create the folder with the shape above.
2. Write `package.json` with its id, commands, views, settings and activation events.
3. `tsconfig.json` extends `../tsconfig.base.json`.
4. Store everything under its own id's storage.
5. Add its gate to the release list: `tsc`, plus its own behaviour check where it has one.
6. Write its page in `docs/temco-platform/modules/temco-<module>/`: commands, settings, storage, and what it must not own.
7. Compile it with the platform build (`npm run gulp compile-extension:temco-<module>`) and check it loads.

Nothing else is required: the build picks up any folder with a `package.json`, the root install brings in its dependencies, and web builds skip it automatically.
