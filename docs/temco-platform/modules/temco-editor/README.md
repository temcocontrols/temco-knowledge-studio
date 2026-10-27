# temco-editor

A **comparison surface**: the same Markdown page, edited by a second Tiptap editor so the two can be judged side by side.
It is the only module here that exists to be deleted.

## Identifiers

| | |
|---|---|
| Extension id | `temcocontrols.temco-editor` |
| View type | `temcoEditor.page` — **Temco Editor Prototype**, `priority: "option"` for `*.md` |
| Commands | `temcoEditor.open` · `temcoEditor.openSource` |
| Namespace | `temcoEditor` |
| Storage | none |

## Why it exists

`temco-docs` already ships **Temco Editor** (`temcoDocs.page`), a Tiptap 3.30.3 surface behind a two-tab ribbon. The open
question is not "is Tiptap right" — it is whether a *quieter* surface is better: marks at the selection instead of a
ribbon, a drag handle beside the block, a placeholder on an empty page. Those three are inline affordances a ribbon
cannot offer, and they are exactly what this module adds.

The rule that makes the comparison honest: **both editors write the same bytes**. `src/markdown.ts` reproduces
`temco-docs/src/pageMarkdown.ts` rule for rule, and `scripts/check-page.mts` is the same set of round-trip cases. If a
page opened here and saved unedited produced a different diff, the comparison would be measuring the wrong thing.

The **second serialiser is a reader, not a writer**: `@tiptap/markdown` is registered so `editor.getMarkdown()` exists,
and the status strip shows what it would produce beside the contract (`Compare serialisers`). Nothing it returns ever
reaches the file. On a real page the two always disagree — different table separators, no trailing newline, `++`/`==`
instead of `<u>`/`<mark>` — which is the finding, not a bug to paper over.

### Read mode, and what it proves

`Read the page` in the head swaps the editor for the markup it last produced — no caret, no bar, no drag handle, and
nothing to type into. Coming back re-mounts the same editor instance, so the document and the undo history are the ones
that were there. It is the same idea as `temco-docs`' View ▸ *Read the page*, reached from one control instead of a tab,
and it is the cheapest proof that the engine seam is real.

### Two defects this work found, and the fix that came with it

1. **A task list did not survive being opened**, in either editor. `marked` renders `- [x] done` as
   `<ul><li><input type="checkbox">…`, which is not the shape Tiptap's `TaskList`/`TaskItem` parse rules accept
   (`ul[data-type="taskList"]`), so the page opened as a plain bullet list.
2. **A checkbox did not survive being saved**, in either editor. `turndown-plugin-gfm`'s task rule expects the
   `<input>` to be an item's first child; Tiptap renders it inside a `<label>`, so the file came back as `- done`.

Found here, fixed where they belong: `temco-docs/webview/page/taskLists.mts` adds the shape `marked` writes to the
parser, and a `taskCheckbox` rule in `pageMarkdown.ts` reads the checkbox wherever it sits. `temco-docs` now carries
`scripts/check-task-lists.mts` — a real editor in jsdom, both shapes, open and save — and `check-page` grew the
serialised cases. This prototype carries the same two rules, so the two editors still write the same bytes.

## What it owns

- the view type, the provider, and the commands that reach it;
- its own bridge to the file (`src/bridge.ts`) — a reduced copy of `temco-docs/src/webviewText.ts`, because a module may
  not import another module's source: one `WorkspaceEdit` per save, the file's own line endings, the ordered-write guard
  that keeps a caret still;
- its bundle and the one bundler step that produces it;
- a **comparison** of the two Markdown serialisers, shown and never saved.

## What it must not own

- **the registry, the pages model, the checks, the writes** — `temco-docs`;
- **the capture pipeline, annotation, the outline, find, read mode** — `temco-docs`;
- **a second Markdown dialect.** Any change to the conversion must land in `temco-docs` first; this module follows.

## Gates

`npm run vscode:prepublish` — `check-commands` (declared = registered, once each), `check-types` (host and webview,
separately), `compile`, `check-page` (the round trip), `build-webview`, `check-surface` (the built bundle in jsdom: it
starts, draws a page, writes one edit back, shows both serialisers without writing, and survives a round trip through
Read mode).

## The decision it is waiting for

When the comparison is decided, one of two things happens:

1. **the prototype wins** — the *extensions* and the three affordances move into `temco-docs`, and this folder is deleted;
2. **the shipped editor wins** — this folder is deleted.

Either way the folder does not stay: a module that is a prototype is a module with no owner.
