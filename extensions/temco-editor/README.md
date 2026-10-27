# Temco Editor Prototype

A **second editor for a Markdown page**, built to be compared with the shipped one in `temco-docs`. It is a surface, not
a product: it exists so a decision about the editor can be made by using both, then deleting one.

## What it is

| | |
|---|---|
| View type | `temcoEditor.page` — **Temco Editor Prototype**, `priority: "option"` for `*.md` |
| Reached by | `Open With…` on a Markdown file, or **Temco Editor: Open in the Temco Editor Prototype** |
| Tiptap | **3.32.0** (the shipped editor pins 3.30.3) |
| Bundle | `out/webview/page/page.js` + `page.css`, ~1.2 MB, built by `scripts/build-webview.mts` |
| File contract | **the same Markdown round trip** as `temco-docs` — same `marked`/`turndown` rules, same tests |

`priority: "option"` is deliberate: `temco-docs` keeps `default` for `*.md`, so nothing changes for anyone who does not
ask for the prototype. Both editors can be open on the same file at once — they write through the same text document, so
an edit in one appears in the other.

## What is different from the shipped editor

| | `temco-docs` "Temco Editor" | this prototype |
|---|---|---|
| chrome | a two-tab ribbon, ~20 controls, groups with tiers and an overflow menu | one slim bar |
| marks | on the bar | on the bar **and** in a selection bubble menu |
| block movement | cut and paste | a **drag handle** beside the block |
| empty page | nothing | a placeholder that says what the page is for |
| counting | words, on the bar's status strip | words **and characters**, from `CharacterCount` |
| reading | View ▸ *Read the page* | **Read the page** in the head, same idea, one control |
| serialisation | `marked` + `turndown`, and nothing else | the same contract, **plus** `@tiptap/markdown` shown beside it for comparison |
| outline, find, capture, annotate | built | **not built** — they are `temco-docs`' business |

The three additions at the top are the argument for a second surface: they are *inline affordances*, and a ribbon cannot
have them.

### What the serializer comparison found

`Compare serialisers` in the status strip shows the page written two ways: the contract (what is saved) and
`@tiptap/markdown`. On a page of headings, prose, lists, a quote, a fence and a table, the two disagree — Tiptap's own
dialect would rewrite it:

| | the contract (`marked` + `turndown`) | `@tiptap/markdown` 3.32 |
|---|---|---|
| trailing newline | exactly one | none |
| table | `\| --- \| --- \|`, cells unpadded | `\| ---- \| ---- \|`, cells padded to width |
| fenced code | closes immediately | gains a blank line before the closing fence |
| nested list | 4-space indent | 2-space indent |
| underline / highlight | `<u>`, `<mark>` | `++…++`, `==…==` |

So the panel is a *reading* tool, not a switch: anything the alternative produced would be a whole-file diff on a page
nobody edited. That is exactly why the save path stays `src/markdown.ts`.

Two defects the same work found, **in the shipped editor as much as here** (both share the load and save paths):

1. **A task list did not survive being opened.** `marked` turns `- [x] done` into `<ul><li><input type="checkbox">…`,
   which is not the shape Tiptap's `TaskList`/`TaskItem` parse rules accept (`ul[data-type="taskList"]`), so the page
   opened as a plain bullet list — the checkbox was gone before anything was saved.
2. **A checkbox did not survive being saved.** Even a real task list (`<li data-type="taskItem"><label><input>…`) was
   not recognised by `turndown-plugin-gfm`'s task rule, which expects the `<input>` to be an item's first child; the
   file was written as `- done`.

Both are now fixed in `temco-docs` (which owns the load and save paths): `webview/page/taskLists.mts` teaches the parser
the shape `marked` writes, and a `taskCheckbox` rule in `pageMarkdown.ts` reads the checkbox wherever it sits. This
prototype carries the same two rules, so the two editors still write the same bytes — and both modules gate it:
`check-page` on the serialised HTML, `check-surface`/`check-task-lists` on the pair through a real editor.


## Files

```text
src/extension.ts      activate: the provider and the two commands
src/pageEditor.ts     the view type, and the way back to the text editor
src/bridge.ts         the seam with the file: one undoable edit, the file's own line endings, the echo guard
src/markdown.ts       Markdown ⇄ HTML, identical in behaviour to temco-docs' pageMarkdown.ts
webview/page/main.tsx      host protocol, status strip, Read mode, the serializer comparison, the questions
webview/page/editor.tsx    the schema, the bar, the selection menu, the drag handle
webview/page/reading.tsx   the page with no editor behind it, for Read mode
webview/page/surface.css   the sheet and its typography, on the editor's own tokens
scripts/build-webview.mts  the one bundler step (esbuild, iife, no loader in a webview)
scripts/check-commands.mts every declared command registered exactly once
scripts/check-page.mts     the round trip, on the compiled module — the file must not change on save
scripts/check-surface.mts  the built bundle loaded into jsdom: it starts, draws the page, writes an edit back,
                           compares the serialisers without writing, and survives a round trip through Read mode
```

`bridge.ts` is a reduced copy of `temco-docs/src/webviewText.ts`: a module may not import another module's sources, so
the prototype carries the parts it needs and nothing else. The rules are the same ones — which is the point: the
comparison must not be explained by a difference in how the file is written.

## Gates

```bash
npm install
npm run check-commands   # every declared command is registered exactly once
npm run check-types      # the extension host and the webview, separately
npm run compile          # tsc → out/
npm run check-page       # the Markdown round trip
npm run build-webview    # out/webview/page/
npm run check-surface    # the bundle, in jsdom
```

`npm run vscode:prepublish` runs all six in that order.

## What it must not become

It must not grow the registry, the capture pipeline, the outline, or a write that `temco-docs` does not make. When the
comparison is decided, the losing surface is deleted — and if the prototype wins, the *extensions* move into
`temco-docs` rather than the other way round.
