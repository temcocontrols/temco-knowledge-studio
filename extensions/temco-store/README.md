# temco-store

The platform's own memory. One SQLite file per window: what was read, what a project is made of, which pages a read found, what was built, and what happened — plus the one piece of state the whole application agrees on, and the naming rules the tables are keyed by.

| | |
|---|---|
| Extension id | `temcocontrols.temco-store` |
| Namespace | `temcoStore` |
| State | active |
| Container | none — it has one command and no view |
| Settings | none |
| Register | [`docs/temco-platform/modules/README.md`](../../docs/temco-platform/modules/README.md) |

## What it owns

```
src/extension.ts      activation, and the API the rest of the platform calls
src/api.ts            that API: the catalog, the selection, the slug rule
src/catalog/schema.ts the tables, and the version that says when they change
src/catalog/store.ts  node:sqlite, the open/close, and every statement the platform runs
src/selection.ts      which project the window is on, and the page it last opened from it
src/names.ts          the slug a name gets, as the tables key it
src/commands.ts       one command: what the store is, where it is, and what it holds
```

It is the base every other module stands on, and it calls back into nothing. `temco-docs`, `temco-ai` and (later) `temco-repositories`, `temco-projects` and the workbench all declare it in `extensionDependencies` and read it through an `src/store.ts` of their own — the copy of this module's shapes, because an extension cannot import another extension's sources.

## Why this is not `temco-sql`

`temco-sql` is about the databases a **product** uses: registers, queries, export. This is the platform's own file — the catalog — and the two have nothing in common but the word "database". The reserved module keeps its meaning; the catalog lives here.

## One window, one file, one owner

- The database is opened by **this** module, with its own storage: a caller passing its own `ExtensionContext` would open an empty database beside its own code. The callers' `Catalog.open(context)` argument is accepted and ignored, and that is deliberate.
- The selection is one instance per window, published here. Two modules that each made their own would read the same storage and never hear the other's change.
- Nothing is opened at activation: a window that never reads a source never holds a database.

## Command

| Command | What it does |
|---|---|
| `temcoStore.status` | prints where the file is, its schema version and its row counts, and offers the folder or the path |

## Checks

```
npm run check-commands      # no command id is registered twice
```
