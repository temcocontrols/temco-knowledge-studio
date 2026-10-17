# temco-ui

The application's shared UI conventions. Two rules, each decided once for the whole platform:

- **Where a page of ours opens.** Our pages are tabs in one group — the group that already holds one of ours — never a split, never a second column. The AI page, the repositories page, a project and the documentation pages all share one strip.
- **What a command argument means.** The palette passes nothing, a view's title bar passes nothing, and a row's menu passes the row: a command that needs a slug reads its argument the same way everywhere.

| | |
|---|---|
| Extension id | `temcocontrols.temco-ui` |
| Namespace | `temcoUi` |
| State | active |
| Surface | none — no command, no view, no setting |
| Register | [`docs/temco-platform/modules/README.md`](../../docs/temco-platform/modules/README.md) |

## What it owns

```
src/extension.ts   activation, and the API below
src/columns.ts     pageColumn() and fileColumn(): the one group our pages open in
src/rows.ts        rowSlug(): the slug a command argument names
```

## Why it is a module and not a helper in one of the others

The rule was `surface.ts`'s in `temco-docs`, which was correct while every page lived in that module. When the pages spread across modules, the rule had to be owned by something *none* of them owns: a page opened from `temco-ai` and a page opened from `temco-repositories` must land in the same tab strip, and a copy of the rule in each module is a copy that will diverge.

The prefix it matches on is `temco`, so every module's view type counts as one of ours — `temcoWorkbench.home`, `temcoAi.page`, `temcoRepositories.page`.

## Consumers

Declare it in `extensionDependencies` and read it through a bridge of your own (`extensions/temco-repositories/src/ui.ts` is the copy to follow), because an extension cannot import another extension's sources.

## Checks

```
npm run check-commands      # no command id is registered twice
```
