# Temco Editor

The editor for a Markdown page. It is the **default** surface for `*.md`, and the only one: the two editors that used
to exist here — `temco-docs`' own `temcoDocs.page` and this module's prototype — were merged into this module and the
prototype was deleted.

## What it is

| | |
|---|---|
| Extension id | `temcocontrols.temco-editor` |
| View type | `temcoEditor.markdown` — **Temco Editor**, `priority: "default"` for `*.md` |
| Reached by | opening any `.md` file; *Open With… → Temco Editor*; **Open in Temco Editor** in the tab's context menu |
| Way back | **Open as Text** (`temcoEditor.openSource`), in the tab and in the editor's context menu |
| Engine | Tiptap 3.32, behind a private seam — no other folder in this module names a Tiptap package |
| Bundle | `out/webview/markdown/markdown.js` + `markdown.css`, ~1.4 MB, built by `scripts/build-webview.mts` |
| File contract | `marked` + `turndown` + GFM: opening and saving a page that was not edited must produce the same bytes |

## The seam

```text
temco-editor
├── src/                     the extension host: the file, the tab, the commands
└── webview/
    ├── shared/              find · outline rail · annotate · theme — a surface's furniture, no engine
    └── markdown/            the capability: this is what a `.md` file opens into
        ├── contract.ts      PageState · PageActions · Mark · ListKind — types only
        ├── main.tsx         the mount: the host protocol, the rail, the find bar, the status strip
        ├── ribbon.tsx       the bar: named operations in, a state snapshot out
        ├── reading.tsx      the page with no editor behind it
        ├── surface.css      the paper, the document, the selection menu, the block handle
        ├── chrome.css       the colour roles and the controls, shared with every Temco webview
        └── engine/tiptap/   ← the only place `@tiptap/*` is imported
            ├── index.ts     the whole of what the surface may ask an engine
            ├── document.tsx the schema, the operations, the caret snapshot, the heading index, the search
            ├── bubble.tsx   the selection menu (Tiptap's `BubbleMenu`, drawn with the bar's own buttons)
            ├── handle.tsx   the block handle (Tiptap's `DragHandle`)
            └── taskLists.mts Tiptap's task list, taught the shape `marked` writes
```

`main.tsx`, `ribbon.tsx` and `reading.tsx` know no engine: they import `./contract` for types and `./engine/tiptap` for
five functions (`usePageDocument`, `actionsFor`, `stateOf`, `headingsIn`, `matchesIn`). Replacing Tiptap means deleting
`engine/tiptap/` and writing another folder that returns the same `PageActions`; nothing above it changes.

## The file contract

A page is Markdown on disk and stays Markdown. The editor renders it, and saves it by writing the editor back through
`marked` + `turndown` + GFM. The rules are the point: **no re-wrapping**, one space after a bullet, 4-space nested
indentation, `| --- |` tables with unpadded cells, `<u>`/`<mark>` kept as the inline HTML Markdown already allows,
`~~strike~~`, exactly one trailing newline, and tight blocks inside `li`/`td`/`th`. Anything else is a `git diff` full of
changes nobody made.

`scripts/check-page.mts` is that contract, as 13 cases, run against the compiled module.

### The task-list defect this module carries the fix for

A task list used to be destroyed twice — on open and on save:

1. **On open.** `marked` writes `<ul><li><input type="checkbox">…</li></ul>`, which is not the shape Tiptap's
   `TaskList`/`TaskItem` parse rules accept (`ul[data-type="taskList"]`), so the page opened as a plain bullet list and
   the checkbox was gone before anything was saved.
2. **On save.** Even a real Tiptap task list puts the `<input>` inside a `<label>`, and `turndown-plugin-gfm`'s task rule
   wants it as the item's first child, so the file was written as `- done`.

`engine/tiptap/taskLists.mts` teaches the parser the shape `marked` writes, and the `taskCheckbox` rule in
`src/markdown.ts` reads the checkbox wherever it sits. `check-page.mts` proves the serialisation and
`check-task-lists.mts` drives a real editor over both shapes; `check-surface.mts` proves the pair through the built
surface a person actually uses.

## What the surface does

| | |
|---|---|
| writing | one flat bar — history · block style · lists · marks · blocks · insert — with `⋯` for what the width cannot hold; every control's effect is something Markdown can carry |
| marks | on the bar **and** in a selection bubble menu, from one list (`MARKS`) so they cannot drift apart |
| blocks | a drag handle beside the block under the pointer; headings, quotes, code blocks, three list kinds, rules |
| tables | insert, add/remove rows and columns, delete — with a header row |
| images | pick, paste or capture the screen; written beside the page with a caption and the version it shows |
| linking | to another page of the same set, as the relative path the build can resolve |
| finding | `Ctrl+F`, across blocks, with the matches highlighted |
| outline | a resizable, foldable rail built from the document itself; opens itself for a page with three or more headings |
| reading | *View ▸ Read the page* — the same page through a renderer that cannot edit |
| zoom | 70–160 %, on the status strip |

## What it asks of `temco-docs`

The editor writes pages but does not own them. It declares `temcocontrols.temco-docs` as an `extensionDependency` and
calls three of its functions through `src/docs.ts` (the copy of `temco-docs/src/api.ts`):

| | |
|---|---|
| `landImage(pageFsPath, bytes, extension, caption)` | writes the file into the page's `media/` folder, names it, records what it shows and the version it applies to |
| `setCaption(pageFsPath, name, caption)` | records the words for an image that landed without them |
| `pagesNear(pageFsPath)` | the pages of the set this file is in — which is what a relative link can reach |

The other direction is a command, which may be missing: **preview**, **diff** and **page properties** are the other
module's work, so this module asks for them by id (`temcoEditor.preview` → `temcoDocs.previewPage`) rather than reaching
into it.

## Files

```text
src/extension.ts               activate: the provider, the five commands
src/surfaces/markdown.ts       the view type; names the bundle to run
src/bridge.ts                  the seam with the file: one undoable edit, the file's own line endings, the echo guard
src/capture.ts                 a PNG of the screen, taken where the screen is
src/docs.ts                    what this module borrows from temco-docs, spelled out
src/markdown.ts                Markdown ⇄ HTML: the contract
src/outlineModel.ts            headings → a tree, and the caret → the current row (pure)
webview/shared/                annotate · find · menus · outline · theme · surface-controls.css
webview/markdown/              the capability (see *The seam* above)
scripts/build-webview.mts      the one bundler step (esbuild, iife — a webview has no module loader)
scripts/check-commands.mts     every declared command registered exactly once
scripts/check-page.mts         the round trip, on the compiled module
scripts/check-task-lists.mts   a real editor over both task-list shapes
scripts/check-outline.mts      the outline rules, with no browser
scripts/check-shortcuts.mts    every key the bar teaches is a key something binds
scripts/check-fluent.mts       Fluent is imported by the surfaces, and nothing else
scripts/check-surface.mts      the built bundle in jsdom: it starts, draws, writes an edit back, keeps its checkboxes,
                               and survives a round trip through Read mode
```

## Gates

```bash
npm install
npm run check-commands    # every declared command is registered exactly once
npm run check-fluent      # one Fluent owner
npm run check-types       # the extension host and the webview, separately
npm run compile           # tsc → out/
npm run check-page        # the Markdown round trip
npm run check-task-lists  # a real editor, both shapes
npm run check-outline     # the outline rules
npm run check-shortcuts   # the keys the bar teaches
npm run build-webview     # out/webview/markdown/
npm run check-surface     # the bundle, in jsdom
```

`npm run vscode:prepublish` runs all of them in that order.

Building an extension with `tsc` cleans `out/` first (`compile-extension:<name>`), which deletes the webview bundle —
always finish with `npm run compile-temco` from the repository root, which builds the extensions and then both bundles.
