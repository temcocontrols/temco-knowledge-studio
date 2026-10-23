# Extension design

> **Layout superseded.** The views, the Pages tree behaviour and the flow are defined in [../../ui/redesign.md](../../ui/redesign.md). Files such as `home.ts` and `views.ts` mentioned below do not exist; the code is under `extensions/temco-docs/src/`.

## Responsibilities, one file each

| Module | Owns |
|---|---|
| `src/registry.ts` | reading `docs/help/registry.json` and the generated `index.json`/`page-meta.json`, the page id → file rule, the structural checks, the counts. No VS Code UI beyond `Uri`, `WorkspaceFolder` and the filesystem |
| `src/tree.ts` | the Content view: which nodes exist, what they show, what a click does |
| `src/diagnostics.ts` | which issues become Problems, and on which file |
| `src/extension.ts` | activation, the view and status bar, the commands, the file watcher, and the model it publishes to other modules (`src/api.ts`) |
| `src/store.ts` | what this module reads of `temco-store` — the catalog, the selection, the slug rule — in one file, and the only place that crosses modules |
| `src/ui.ts` | what it reads of `temco-ui` — where a page of ours opens, and what a command argument names |
| `src/projects.ts` | what it knows of `temco-projects` — one signal, so the Library's rows come back when a project changes |
| `src/repositories.ts` | what it reads of `temco-repositories` — a source's code files, the material for a draft, and the repository's own scripts |
| `src/api.ts` | what this module publishes: the documentation model `temco-ai` reads (the sets, the pages, the selection, the editor column, one change signal) |
| `src/aiModule.ts` | what this module knows of `temco-ai`: whether it is installed, its commands, and the two calls it makes when it is (a draft, an analysis) |
| `src/builds.ts` | the product repo's own builds, invoked as VS Code tasks and judged by the artifact they leave — never by an exit code, and never the form that deploys |
| `src/report.ts` | the staleness report: what needs attention, grouped by owner, as Markdown. Counts rather than lists for the pages that have merely never been reviewed |
| `src/scaffold.ts` | starting a registry in an open folder that has none: the smallest valid file, on a confirmation, with the seeding left to the repository's own generator |
| `src/home.ts` | the dashboard: the one page that is not about a folder — identity, how the application works, what exists now, how to start, and every feature with its state |
| `src/views.ts` | the other two sidebar sections: **Work** (what needs doing, and what changed) and **Library** (what it reads and produces) |
| `src/feedback.ts` | feedback rows routed to their page's owner, against a proposed file shape, with the aging called out |
| `src/previewPanel.ts` | the page as a reader sees it, in its own editor tab beside the source: one panel per document, redrawn as the page is typed. Rendering is the built-in Markdown pipeline, so the preview and the editor's own idea of the page cannot disagree; the DocFX `> [!NOTE]` markers are dressed as the alerts the site publishes |
| `src/diffPage.ts` | the page against its last commit, in `vscode.diff`. HEAD's text is read with `git show`, written under the extension's storage, and deleted when the tab closes. The right-hand side is the editor's buffer, so an unsaved change is part of the diff it shows |
| `src/outline.ts` | the **Page** pane: the page's headings as a nested jump list, and its word count in the status bar. Fenced blocks are skipped, because a `#` inside a code sample is a comment |
| `src/tiptapEditor.ts` | **Rich mode**: the page as a document, on the official Tiptap UI Components template. Opt-in by command, never an editor association |
| `webview/markdown.mts` | `tidy()`: what the official serializer produces, turned back into the file the author wrote — three narrow repairs, each covered by a fixture in `scripts/check-roundtrip.mts` |
| `scripts/check-roundtrip.mts` | the check that matters most: 16 page shapes through the real editor stack, every one **byte-identical** and idempotent. `npm run check-roundtrip` |
| `scripts/check-webview.mts` | the bundle loaded into a DOM and driven the way the extension drives it. Bundling is not rendering: a webview that throws on its first render is a blank tab, and `tsc` and `eslint` both pass. `npm run check-webview` |
| `scripts/check-learn.mts` | the Temco Learn portal: what a `manifest.json` means, and what the page it writes says. The first coverage of a file written on every publish and read by nobody. `npm run check-learn` |
| `scripts/check-editor.mts` | the editing operations, driven through real Chromium: typing lands at the caret, Backspace deletes beside it, and a selection survives a message round trip. The only place the caret actually exists — `check-webview` passes either way. `npm run check-editor` |
| `src/learnPage.ts` | the portal page and the manifest rules, as pure functions — no `vscode`, so the publish path has something to test |
| `src/webviewText.ts` | the bridge both Rich modes share: one `WorkspaceEdit` per save, line endings preserved, the echo guard, and the three bar actions (preview / diff / source). Nothing that could corrupt a file is decided twice |
| `src/csv.ts` | CSV as a grid can hold it and back again: RFC 4180 quoting, delimiter and end-of-line detected, and the *quoting style* preserved per cell so a one-cell edit is a one-line diff. No VS Code here at all |
| `src/gridEditor.ts` | **Grid mode**: a CSV edited as cells (Univer). Same bridge as `webviewText.ts`; the file stays line-per-row because `csv.ts` does the writing |
| `scripts/build-webview.mts` | the one bundler step: `webview/grid.ts` → `out/webview/grid/` and `webview/tiptap/main.tsx` → `out/webview/tiptap/`. `tsc` cannot do this — the surfaces are browser code with npm dependencies |

It no longer has a `src/catalog/` or a `src/selected.ts`: the database, the selection and the slug rule are `temco-store`'s, reached through `src/store.ts`.

`registry.ts` is deliberately free of presentation: it is the part that would survive replacing the view, and
the part any other module reuses to know what pages exist — `temco-ai` reads it through the exported model rather
than through this folder.

## The tree

```
Content                        (view container: Temco Docs)
├─ Gaps (12)                   only when something is wrong, across all open repos
├─ T3000Webview-EEZ-Studio     only when more than one folder is open
│  ├─ t3000                    title · audience · noindex
│  │  ├─ api-reference         chapter, with a page count
│  │  │  ├─ Data Points API     owner · ship · reviewed, plus its issues as children
│  │  │  └─ …
│  │  └─ …
│  └─ legacy
└─ …
```

- Counts live on the **parents**, because "which area needs attention" is the real question.
- A page with issues is collapsible and its children are the reasons.
- A page's tooltip carries what the generator knows and the registry does not: its last change, its headings,
  and — marked in the description and the icon — whether its `code` moved on since the last review. With
  `index.json`/`page-meta.json` absent, that block is simply missing and nothing else changes.
- Clicking a page opens the file; if the file does not exist, the click offers to create it.
- Areas and chapters are never empty: an area declared in `areas{}` with no pages still appears, which is
  itself information.

## The page in the editor

The editor of record is **VS Code's own**, deliberately. `15-online-editor.md` rejects a rich editor for these
files on a reason that survives checking: the pages are written one paragraph per source line (measured: 95
characters on average, 168 lines over 200), so an editor that re-wraps rewrites every paragraph it touches and a
one-word change becomes a whole-file diff. What was missing was never the engine — it was the chrome around it.

| Surface | What it is | Why not something new |
|---|---|---|
| the toolbar | `src/format.ts`, on `editor/title` and in the context menu | Monaco has no formatting bar; the buttons edit the buffer and undo like typing |
| **Preview** | `previewPanel.ts`, a tab beside the source (`preview: <page>.md`) | VS Code shows a page, the build shows an alert; the panel dresses the markers so the two agree |
| **Diff** | `diffPage.ts`, `vscode.diff` against `HEAD` | the editor's own diff, so the hunks seen are the hunks the pull request carries |
| the **Page** pane | `outline.ts`: headings as a nested jump list, plus a word count in the status bar | line, column, encoding and end-of-line are already the status bar's, so nothing repeats them |
| **Rich** | `tiptapEditor.ts` + `webview/tiptap/`: the page as a document, reached by *Open in Rich Mode* | the template's own bar, with this extension's preview / diff / source appended |
| **Grid** | `gridEditor.ts` + `webview/grid.ts`: a CSV as cells, reached by *Open in the Grid* | the file stays CSV, one row per line, so a one-cell edit stays a one-line diff |

The two optional surfaces are webviews, so they need a bundler — the only one in this extension:

```
webview/tiptap/main.tsx ─esbuild+sass─▶ out/webview/tiptap/tiptap.js 1.6 MB  official Tiptap template
webview/grid.ts    ──esbuild──▶  out/webview/grid/grid.js    11.9 MB   Univer (Apache-2.0)
```

The output goes to `out/webview/`, beside the extension host JavaScript and inside the directory this repository
already treats as build output, so it is ignored by git. It is deliberately **not** committed: the
`local/code-no-new-javascript-files` rule rejects a newly added `.js`, and only a CODEOWNERS edit can allowlist one.
`vscode:prepublish` runs the build for a packaged extension, so a source tree needs `npm run build-webview` once.

### The rich editor: the official Tiptap template

The Rich surface is the **Tiptap UI Components Simple template**, installed with the project's own CLI
(`npx @tiptap/cli add simple-editor`) and vendored verbatim at `webview/tiptap-template/` — 161 files of MIT React
components, node views and SCSS. Six files of ours sit beside it:

| File | What it does |
|---|---|
| `webview/tiptap/main.tsx` | mounts the template's `<SimpleEditor />`, and maps VS Code's dark/light classes onto the `.dark` class the template expects |
| `webview/tiptap/simple-editor.tsx` | the template's own entry component, adapted for a Markdown document (see below) |
| `webview/tiptap/document.ts` | the message bridge: `set` in, `change` out, plus the image picker |
| `webview/tiptap/document-actions.tsx` | preview / diff / source, as a trailing toolbar group |
| `webview/tiptap/highlight-toggle.tsx` | the template's colour popover, reduced to the one highlight Markdown can hold |
| `webview/tiptap/callout.ts` | decorates `> [!NOTE]` blockquotes so they look like the published alerts |
| `webview/tiptap/context-menu.tsx` | the editing menu for the page: cut, copy, paste, select all, insert image, remove link |
| `webview/tiptap/outline-panel.tsx` | the outline, its rail and the word count |

Four deviations from the template, each measured by `scripts/check-roundtrip.mts` before it was made:

| Extension | What it does on save | Decision |
|---|---|---|
| `TextAlign` | `<div align="center">centred</div>` — `centred` | removed |
| `Subscript` / `Superscript` | `H<sub>2</sub>` — `H2` | removed |
| `Typography` | rewrites what a person types (`--` → `—`) | removed |
| colour highlight | colour is dropped, `==text==` remains | popover replaced by a toggle |

Three things were **added** because this documentation needs them and the template does not ship them: `Table` (1,458
table lines in `docs/`), `Mathematics` (`$...$`, `$$...$$`), and the official `Markdown` extension with `tidy()`.

### Where the template's editing behaviour had to change

Four interaction defects were reproduced in a real browser against the built bundle, not guessed at. The first three
were one bug with four symptoms.

| Symptom | Cause | Fix |
|---|---|---|
| Clicking text near a link moved the caret somewhere else | `enableClickSelection` selected the whole link on click | turned off, so a click places the caret |
| A link popover opened on every click and took the focus | `LinkPopover` auto-opens whenever the caret is inside a link | `autoOpenOnLinkActive={false}`; the toolbar button still opens it |
| Ctrl+A, paste and typing then went to the URL field | a consequence of the focus being taken | gone with the two fixes above |
| A pasted screenshot did nothing | ProseMirror drops pasted files; only the template's picker was wired to the host | `handlePaste` sends the bytes to the extension, which writes them beside the page and replies with the page-relative address |
| Right-click offered only Cut / Copy / Paste | the host's webview menu stops there, and hides itself once the page handles `contextmenu` | the page owns the menu: cut, copy, paste, select all, insert image, remove link |

Two details of the menu are deliberate. The focus stays in the page rather than moving to the menu, so the selected text
keeps its highlight — the keyboard reaches the menu with the arrow keys. And a right-click inside a selection keeps that
selection instead of collapsing it, so Cut and Copy have something to act on; anywhere else it moves the caret, which is
what tells the menu whether it is on a link.

### The caret through a message round trip

The most damaging defect in this surface was not in the editor at all. The extension answers any change it does not
recognise as its own by sending the file back, and the bridge applied that with `setContent` — which replaces the
document and leaves the caret at the **end of the page**. Typing then looked like this: the selection you were dragging
stopped halfway, and the next keystroke went somewhere else entirely, because the caret had been moved to the bottom.

Two changes, each guarding one half:

| Change | Why |
|---|---|
| a `set` whose text the editor already holds is ignored outright | the common case is an echo after the editor's own write; nothing about the document needs to change |
| a `set` that does carry an outside change restores the caret to where it was, clamped to the new document | an external edit must not take the keyboard away from the person typing |

The host had a third part of the same bug: `applyEdit` is asynchronous, so two writes can land out of order while
somebody types, and a single `applied` string only names the newest. A late write from this editor was therefore
mistaken for an outside change and answered with a redraw. The editor now remembers every text it asked VS Code to
write, and a document change matching any of them is its own.

And the rule that settles it: **the template's editor owns its document.** It is built once with the file and then
edited; the bridge never replaces it while the editor has focus, and an outside change waits in a variable until the
person leaves the page. That is what the template does, and wrapping it in a document-sync loop was the mistake.

`scripts/check-editor.mts` reproduces the whole thing in Chromium and asserts the caret does not move across the round
trip, that a selection survives it, and that an outside change does not touch a focused editor at all. Removing the
guard makes it fail (`caret was 70, became 253`), which is the check earning its place: `check-webview` passes with the
defect present, because jsdom reconciles an identical document to identical nodes and never has a selection to lose.

### Importing Word documents

`src/docx.ts` + `src/docxConvert.ts`: `mammoth` reads the `.docx` into semantic HTML and `turndown` turns that into
Markdown, in a child process so the extension host never blocks. The result is a *starting point* — Word's fonts,
colours, spacing and text boxes have no Markdown equivalent and are dropped rather than faked — which is why it writes a
new page beside the document instead of replacing anything.

The converter is TypeScript, compiled to `out/docxConvert.js` and spawned from there. It is deliberately not a `.mjs`
beside the sources: the repository's pre-commit hook rejects a newly added JavaScript file, and `scripts/**` is excluded
from the packaged extension, so a script there would convert Word documents from a source tree and fail from an
installed one.

Tiptap's own DOCX extensions were considered and are not used: both need a paid subscription and a private registry, and
*import* runs on Tiptap's cloud with a JWT.

Both are `iife` and self-contained: a webview has no module loader and there is no CDN, so everything a surface needs
travels with it. `npm run build-webview` writes both (`esbuild` + Sass) into `out/webview/`, which is ignored by git —
so a source tree needs that one command before the Rich or Grid surface will open, and `vscode:prepublish` runs it for
a packaged extension. No network and no `npm install` are needed *after* that build.

What neither surface owns: the document. Both send the whole file text to the extension, which applies it as a single
`WorkspaceEdit` — so `Ctrl+Z`, the dirty dot, save, *Diff* and the git gutter keep working exactly as they do in the
source editor.

**Not built:** a grid for `.xlsx`. It is a binary file that git cannot diff and that needs an `.xlsx` parser of its own
(the maintained options are either deprecated on npm or drag in a pro tier), so a workbook keeps opening as what it
is — a binary — rather than behind a grid that pretends it can be reviewed.

The preview and the diff are **tabs of the editor group, not tabs inside one pane**. A custom editor that owned the
document would have to bundle its own Monaco, and every copy of Monaco is worse than the one this window is already
running: no git gutter, no search results landing on the right line, no other extension's decorations. The
`Source │ Preview │ Diff` strip in the design is therefore three sibling tabs, which is also what VS Code's own
Markdown preview does.

Which editor opens what:

| File | Opens in |
|---|---|
| `.md` | the text editor, with the toolbar, Preview and Diff — or Rich, on request |
| `.csv`, `.tsv` | the text editor — or the Grid, on request |
| `.xlsx` | whatever VS Code opens a binary with; there is no grid for it (see above) |
| everything else | untouched — the ordinary VS Code editor |

## The AI panel

```
Temco Docs                                     (panel: the AI, docked on the right)
├─ header        the page's title (· stale) and the model in use · offline
├─ transcript    your question, the answer as it streams, notes, errors
├─ Draft update  → opens a diff: the page on the left, the draft on the right
│                  Apply replaces the whole page — one Ctrl+Z takes it back
├─ Ask the area  → the question, with the id, title and headings of the pages around it
└─ Ask           → a question about the page on screen
```

- **It writes nothing by itself.** A draft lands in a diff and in the panel; putting it into the page is a
  button, and the change is an ordinary undoable edit.
- **What reaches the model is fixed.** The page's text and metadata, and for an area question the ids, titles
  and headings of its neighbours. No other file, no repository sweep, no credential.
- **Every draft names its prompt version**, so a draft can be traced to the instructions that produced it.
- **An answer's citations are checked.** A page it names becomes a chip that opens it and is dashed when the
  page is stale; a name that is not a page is reported rather than believed; and an area answer that named
  nothing is replaced by search results instead of a synthesis.
- **With nothing installed the panel still opens** and says what to download, so the extension never looks
  broken — the AI is optional the whole way down.

## The dashboard, and why this repository does not have one

`00-architecture.md` puts the dashboard on the **site**, not in the editor: a **generated static page** at
`/_admin/` — coverage · stale by owner · docs-owed · unowned · unreviewed · broken links · feedback ·
health score — noindex, out of the PDF, the CHM and the offline zip, built by the product repository's own
pipeline (`13-implementation-plan.md` step 1.19). Its rows deep-link **into** the editor, and that hand-off is
this extension's half of it.

An earlier phase built an organisation read here instead — a repository list over the GitHub API and a sidebar
view — which answered the dashboard's own question more weakly (repository-level facts, none of the page-level
health) and in a second place. Both are deleted, along with the token setting they needed. The rule is the same
one this document already carries for checks: **the extension never computes an answer the product repository
already owns.**

## Commands

| Command | Does |
|---|---|
| `temcoDocs.showStatus` | refreshes, writes the full report to the *Temco Docs* output channel, offers **Show Problems** |
| `temcoDocs.validate` | same, and is what the status-bar item and the view title button call |
| `temcoDocs.refresh` | re-reads the registries |
| `temcoDocs.openRegistry` | opens `registry.json` for the folder the node belongs to |
| `temcoDocs.openPage` | opens the page, or offers to create the missing file |
| `temcoDocs.reveal` | shows the page's file — or a chapter's, an area's or a source's folder — in the operating system's file manager (`revealFileInOS`, not the VS Code view of a similar name) |
| `temcoDocs.openTerminal` | opens an integrated terminal at the folder that row stands for |
| `temcoDocs.copyPath` · `copyRelativePath` | the row's path on the clipboard, absolute or relative to the open folder |
| `temcoDocs.newPage` · `newChapter` | a page (kind, title, file name) or a chapter — a folder with its first page, since an empty chapter does not exist |
| `temcoDocs.newPage.article` · `.task` · `.reference` · `.troubleshooting` · `.releaseNote` | the same as `newPage` with the kind already named, so the *New Page of a Kind* submenu is one click per kind |
| `temcoDocs.renamePage` | the title as a registry value, and the page's first `#` with it — never the file name |
| `temcoDocs.movePageUp` · `movePageDown` | a two-number swap of `order` in `registry.json` |
| `temcoDocs.retirePage` | `deprecated` and `superseded_by`; the file stays, so old links keep redirecting |
| `temcoDocs.buildSite` | invokes the repository's own `docs:site` as a task and reports the files it produced |
| `temcoDocs.buildHelp` | invokes the non-deploying help build (`build:help:dry`) and reports the CHM it produced |
| `temcoDocs.stalenessReport` | opens the report of what is owed as an untitled Markdown document — nothing is written |
| `temcoDocs.newPage` · `newChapter` · the five kind commands | open the **New page page** (`src/newPagePage.ts`) with the row's place and, for a kind, its kind already chosen. The page writes through `writePage()` — one write, one confirmation that names the file |
| `temcoDocs.feedback` | reads each repository's `docs/help/feedback.json`, routes the rows to their owners, and calls out the aging |

Where they surface: the **Workspace view's title bar** carries *New page*, *New chapter* and *Refresh* inline,
and its `…` holds the page acts (open · reveal · terminal · copy a path · rename the title · move up · move down ·
retire · the *New Page of a Kind* submenu · the registry) plus Home and Validate — the same list the row's own
right-click menu shows, which is the Library's shape and the Explorer's. A row's **left click** opens a page or
expands a folder; a **right click** (or the keyboard's menu key) opens the menu; the hover carries nothing.
Everything else is in the palette, where it costs no room — and `startRegistry` is a row in the view's empty
state, so the view and the button that fixes it are never apart. There is no organisation-wide surface here by
design: that question belongs to the site's generated dashboard, which this extension hands off to rather than
re-implements.

## What refreshes the view

- activation, and any workspace-folder change;
- a change to `**/docs/help/registry.json` (created, changed, deleted) — it changes the shape of the tree;
- a change to `**/docs/help/index.json` or `**/docs/help/page-meta.json` — they change the provenance the items
  display;
- an explicit refresh.

Everything else, including saving a page, does not refresh: the tree describes structure, not prose.

## Rules the code follows

- **Two writes, each asked for.** Reading is what the extension does; it writes in exactly two places, and only
  on a command that names what it will create: the empty file for a page the registry already declares, and an
  empty registry where a folder you have open has none. Both are files the registry's own generator already
  expects, and neither is ever an existing file. **Nothing under `_admin/` or `_edit/` is written at all** — the
  design's rule is that those are generated pages, not documentation. What it downloads — the runtime, a model,
  the manifest that records them — goes to its own storage folder, or to the folder a setting names, and never
  into a repository.
- **A diagnostic lands where the fix is** — the page for a page problem, `registry.json` for a missing file
  or an unreadable registry.
- **Counts are not problems.** `reviewed: null` and empty tag lists are normal in a 335-page registry; as
  warnings they would bury the faults that matter.
- **No module knows about the shell.** Nothing reaches into the application's own code, by design.
- **Nothing is fetched unasked.** The only network calls are the runtime and model downloads the user starts
  from *Models and Runtime*: no telemetry, no update check, no background refresh, no organisation scan. No
  credential is stored at all.
- **Nothing native ships.** A compiled engine is per-OS; a downloaded one is not, which is what keeps one
  `.vsix` valid on every platform — the application, plain VS Code, Windows or macOS.
- **Building is not shipping.** The build commands invoke the repository's own scripts and report what those
  scripts produced. The form that deploys into a T3000 installation is never run, and nothing is uploaded or
  committed.
- **A generated page is never overwritten.** Which now means: nothing under `_admin/` or `_edit/` is written at
  all. The dashboard is the product repository's generated page; this extension is the deep-link target it
  hands off to.
- **An empty state is actionable.** A view that only explains itself is a dead end, and the folder with no
  registry is exactly where a new product repository starts. The Content view's empty state is a row that runs
  *Start a Registry* rather than a sentence telling the reader to go and find one.
- **A process, only while it is wanted.** The local server starts when something asks the AI for an answer,
  never at activation; it listens on loopback only; and it is stopped when idle, when its model is removed,
  and when the window closes. The extension holds no model in its own process, so nothing to load or unload
  blockingly.

## Guardrails, in code

`12-ai-features.md`, *Guardrails*, lists them; this is where each one actually lives, so it can be checked rather than
trusted.

| Guardrail | Where it is enforced |
|---|---|
| No shipped page is edited by a model | A draft opens in a diff; the page changes only when **Apply draft** is pressed, and then as one undoable `WorkspaceEdit` |
| No secrets, no customer data | The only thing a prompt can take is a `PageContext` — page text, path, registry metadata — plus ids, titles and headings for an area question. No parameter exists that could carry another file, a token or a sweep of the repository |
| Traceable | `PROMPT_VERSION` is printed on every draft and in the panel's model line, and a draft also names its commit range (`temco-ai/src/ai/history.ts`) |
| Degradable | The panel opens with nothing installed and says what to download; the server never starts without a runtime and a model; a missing prompt file is a named error, not a stack trace; a page too large for one draft is refused rather than half-drafted |
| Deterministic first | Staleness is read from `index.json`, never recomputed; the low-confidence fallback is plain term overlap; citations are resolved against the registry |
| Cost bounded | 6 turns of history, 40 area candidates, 40 commits, 100k characters of page text, 1024 tokens per answer and 2048 per draft, `--ctx-size 8192` |
| Offline | The runtime is a local process on `127.0.0.1`; the only other network calls are the downloads the user starts |

## Roadmap

| Phase | Adds |
|---|---|
| 1 | **the Content view** — registry, checks, gaps, status bar |
| 2 | **the AI** — model download, runtime, draft page updates from a commit range, ask-the-area; a local model, offline, drafts only, a human accepts |
| 3 | **publishing** — invokes the product repo's site build and offline help build and hands over the artifacts; it orchestrates, it does not reimplement the pipeline |
| 4 | *(not a module of its own)* — the documentation health report is the platform's generated page at `/_admin/` |
| 5 | **feedback and health** — intake, and the report of what is owed; the report's cadence stays in the product repo's CI |

The module's design is what this document and [`registry-schema.md`](./registry-schema.md) hold; the platform-wide
design is [`design/temco-learn/`](../../../temco-learn/design/README.md).

The AI is the reason the module exists. Everything before it is what the AI needs in order to know what it is
talking about.
