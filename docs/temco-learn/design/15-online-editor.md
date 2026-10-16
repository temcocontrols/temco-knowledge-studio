# 15 — The hosted editor

Editing a page today means editing a file and watching the preview at :8080. This document designs the editor that lives in the browser: what it is, which library backs it, the API it calls, the server-side git flow, and the rules that keep it safe.

---

## The editor core: Monaco

The requirement, stated plainly: the editor has to feel like **VS Code**, because that is where the people who will use it already work. The consequence is that the core is **Monaco**, the editor VS Code is built on — not a Markdown text area with a toolbar.

| Option | Verdict | Why |
|---|---|---|
| **Monaco Editor** (`monaco-editor`) | **chosen** | real VS Code behaviour — multi-cursor, find and replace, folding by heading, minimap, word-wrap control — plus a **built-in diff editor** and a **markers API** the gate findings can be fed into, so a broken link becomes a squiggle on the exact line |
| CodeMirror 6 | fallback | much smaller and still good, but no diff editor, no markers for free, and more chrome to build |
| EasyMDE | fallback for a constrained host | about thirty lines of glue, but not a VS Code-class editor |
| SimpleMDE | rejected | unmaintained |
| Toast UI, Vditor, Cherry Markdown | rejected | larger *and* weaker editing than Monaco, and their value is the rich mode this design does not want |
| ByteMD | rejected | releases have gone quiet |
| ProseMirror, Milkdown, TipTap, MDXEditor, any WYSIWYG | **rejected on principle** | a rich editor re-wraps paragraphs. These pages are **deliberately written with one paragraph per source line**, so a rich round-trip rewrites every line: a one-word change becomes a whole-file diff, unreviewable, with `git blame` destroyed. Source-first is a requirement, not a preference |
| `github.dev` and Codespaces | complementary | real VS Code on the real repository with no code of the project's own — ideal for engineers, but with no preview of this template, no registry fields and no gate results |

### Self-hosting the bundle

Monaco has to work with no network, so it is bundled and served from the site, never from a CDN.

| Concern | Decision |
|---|---|
| the bundle | a **custom build of what is needed** — `editor.api`, the Markdown basic language and the diff editor — not the all-languages default |
| the build step | `npm run docs:editor:build` (esbuild) → `docs/templates/t3000/public/editor/`. It is the only bundler step in the site pipeline and it emits static files, so the deployed runtime still needs nothing |
| loading | lazy: fetched only on the editor's own route, so article pages stay as light as they are today |
| workers | `self.MonacoEnvironment.getWorkerUrl` points at the local worker files |
| size budget | measured in CI. If the custom bundle exceeds about 2 MB gzipped, CodeMirror 6 is revisited — with the number recorded rather than a guess |
| degraded mode | when the bundle fails to load, the editor drops to a plain `<textarea>`: editing is never blocked by an asset |

### Authoring Markdown

Monaco writes and edits `.md` files exactly as VS Code does, and Markdown is one of its languages.

| Need | Built into Monaco | Added here |
|---|---|---|
| highlighting for headings, lists, tables, fences and links | yes — the Markdown language | — |
| folding by heading, bracket matching, auto-close | yes | — |
| list and blockquote continuation on Enter, indent and outdent | yes, from the language configuration | — |
| word wrap, essential for prose | available but **off by default** | `wordWrap: "on"` for `.md` models |
| find and replace, multi-cursor, column select, minimap | yes | — |
| link and image-path completion | no | a completion provider fed by `index.json` and the page's `media/` listing, so typing `](` suggests *real* pages and a broken link is hard to type |
| page metadata in the text | not applicable — pages carry **no front matter by design** | registry fields live in the toolbar and are written to the registry, never to the page |
| a rendered preview | no | the preview pane, an iframe onto `docfx build --serve`, so preview equals the site |
| gate findings on the exact line | through the markers API | `docs:blocking` and `registry --check` results as squiggles |
| spell check | no — VS Code's is an extension | **not in the first version**; the hook exists (a local dictionary library, offline) if prose errors justify it |
| table grids, rich formatting | no rich mode | Markdown snippets; a table stays text |
| reflowing the text, one paragraph per line | never — the file is plain text | this is exactly why Monaco is the right core |

Monaco authors the Markdown source; the preview pane, the markers and the completion provider are the three things added on top. Nothing about a page's line layout is ever rewritten.

### Editors that ship a Markdown toolbar

Several Markdown editors include the toolbar that would otherwise have to be built, and they all force the same trade: the toolbar is the cheap half of an editor, and what it costs is either the VS Code-class core or the line layout of these pages.

| Editor | Toolbar | Mode | Size | Maintenance | Verdict |
|---|---|---|---|---|---|
| **Monaco** | none — built here, about a day | source | 2–5 MB, less when custom | very active, the VS Code core | **chosen** |
| CodeMirror 6 | none | source | 250–400 KB | active | fallback if the bundle is too heavy |
| EasyMDE | yes | source and preview | ~200 KB | a maintained fork | fallback for a constrained host |
| Toast UI Editor | yes | rich and Markdown | 600 KB and up | upstream archived or slow | rejected — reflow risk, size, its own theme |
| Vditor | yes | several modes | ~1 MB | active | rejected for the same reasons |
| Cherry Markdown | yes | several modes | large | active, documentation mostly Chinese | rejected for the same reasons |
| ByteMD | yes | source, CodeMirror 6 inside | medium | releases quiet | rejected — staleness |
| MDXEditor, Milkdown, TipTap | yes | rich | needs a React runtime | active | rejected on principle |
| `github.dev`, Codespaces | VS Code's own UI | source | nothing of the project's | not applicable | complementary for engineers |

The pattern is consistent: a rich editor reflows the page, and a lightweight one is not VS Code. Nothing ships "Monaco plus this toolbar plus link completion plus gate markers" as a package, and those three integrations are the parts only this project can build.

If a batteries-included editor is ever adopted, one guard becomes mandatory with it — a **reflow check** in the publish gate that fails when a diff rewrites more than a small percentage of untouched lines, which means the editor reformatted the page. That check is cheap, and it is the only thing standing between a rich editor and an unreviewable history.

Everything outside the editor pane is plain DOM in the template layer; no framework runtime is added.

## The screen

```
┌ toolbar  [T3000 ▸ Features ▸ Trend Logs]  [B] [I] [H▾] [• list] [1. list] [❝] [table] [link] [image]  [Save draft] [Validate] [Diff] [Publish]
├───────────────────────────────────────────────┬───────────────────────────────────────────────────────
│  Monaco                                       │  Preview (iframe → docfx serve on the draft worktree:
│   • the Markdown source, the editor of record │  same template, same links, same search index)
│   • tabs: Source │ Diff, against main          │
│   • problems: gate findings as inline markers │
├───────────────────────────────────────────────┴───────────────────────────────────────────────────────
└ status bar  draft branch · last save · gate results · conflicts · cursor position and word count
```

The states are `read` (no draft yet), `drafting`, `validating`, `diff`, and `published`, which shows the pull-request link. A gate failure leaves the page in `validating` with the failing lines underlined and publish disabled.

### The toolbar belongs to the project

Monaco is only the **editor component**: the toolbar, the side panes and the command palette belong to VS Code's application shell, which Monaco does not include. Nothing in Monaco draws a bold/italic/link bar. The toolbar therefore lives in the template layer — plain HTML and CSS plus a dispatch table in `main.js` — and every button is also registered as a Monaco **command**, so keyboard users reach the same actions through the command palette and shortcuts and nothing is mouse-only.

| Group | Buttons | Backed by |
|---|---|---|
| inline | bold, italic, inline code | `executeEdits` over the selection |
| blocks | heading level, bullet list, numbered list, task list, blockquote, fenced code with a language, table snippet, horizontal rule, DocFX note, tip and warning callouts | snippets |
| insert | **link → page picker** from `index.json`, and **image → upload**, which writes the file into the page's `media/` and inserts the relative reference | the completion provider and `POST /api/docs/upload` |
| document | save draft, validate, diff, publish, preview toggle | the API below |
| navigation | the heading outline, and the page picker | `index.json` |

What Monaco does give for free, and what is not worth rebuilding:

| Free chrome | Notes |
|---|---|
| the breadcrumb bar | for Markdown it shows the heading path, so it doubles as a live outline |
| find and replace, folding controls, minimap, sticky scroll | plain editor options |
| the context menu and the command palette | which is how every toolbar action also becomes a searchable command with a shortcut |
| the suggest widget | what renders the link and page completion |
| hover and problem markers | where the gate findings surface, inline and in the gutter |

The cost of the toolbar is about a day, most of it in the two insert buttons that matter: the page picker and the image upload.

## The API

Served by the center tool, on its own origin.

| Method and path | Auth | Body → Response |
|---|---|---|
| `GET /api/docs/page?id=<page-id>` | editor | → `{ path, markdown, sha, registry, headings, media[] }` |
| `POST /api/docs/draft` | editor | `{ id, markdown, registry? }` → `{ branch, savedAt }`, creating or updating the draft branch |
| `POST /api/docs/upload` | editor | multipart image → `{ url }`, committed into the page's `media/` on the draft branch |
| `POST /api/docs/validate` | editor | `{ id }` → `{ ok, findings[] }`, running the gates on the draft. Each finding carries `line` and `column` so Monaco can mark it |
| `GET /api/docs/diff?id=<page-id>` | editor | → a unified diff, plus the registry diff |
| `POST /api/docs/publish` | editor | `{ id, comment? }` → `{ pr }` or `{ errors[] }` |
| `GET /api/docs/pages` | any | → the page list for the picker, served from the static `index.json` |

An `id` is always a **registry page id** (`t3000/features/trendlogs`); no path parameter exists anywhere. The server resolves an id to a file path through the registry, so a caller cannot address a file that is not a documented page.

The preview is not an API call: the server keeps `docfx build --serve` running on the draft worktree at an internal port and the iframe points at it.

### Uploads

| Kind | Types | Notes |
|---|---|---|
| screenshots, the common case | PNG, JPG, WebP, GIF, SVG | PNG for a user interface, JPG or WebP for a photograph |
| diagrams | SVG | **sanitized on upload** — `<script>`, `on*` handlers and external references stripped — then rendered through an `<img>` |
| attachments | PDF, ZIP, CSV | copied as engine resources and linked from the page; they are not pages |
| rejected | anything else, more than 10 MB per file, more than 2 MB for an image | the error names the limit and lists what the page already has |

A clipboard screenshot pasted with Ctrl+V, a drag-and-drop, or the toolbar button all reach `POST /api/docs/upload`; the file is written into **the page's own `media/` folder on the draft branch** and the relative reference is inserted at the cursor. Nothing reaches the published site until the draft is merged.

The uploader enforces the same rules the audit checks afterwards:

1. **the destination is derived, never supplied** — the page's `media/` folder inside the draft worktree, with a slugified filename such as `02-run-screen.png`. A client-provided path is never used;
2. **reading-order naming** (`NN-area-slug.png`) is proposed by the tool and adjustable before saving;
3. **at least 1600 px wide for a user-interface screenshot**, because a page stretches images to the content width and a smaller one blurs;
4. **no duplicate copies**: when identical bytes already exist in the repository, the editor reuses that file and says so;
5. missing, unused, oversized and duplicate media are reported weekly by the audit ([11](11-review-and-cicd.md)), so an upload cannot quietly rot.

A rejected upload never costs the draft: the reason appears in the status bar and no file is written.

## The server-side git flow

```
server (the internal host where the API runs)
  ├─ content clone        <data>/docs-repo        the repository, checked out on main
  ├─ draft worktrees      <data>/docs-work/<slug> one per open draft, via git worktree add
  ├─ preview              docfx build --serve on the draft worktree, on an internal port
  └─ credentials          a deploy token or SSH key with contents:write and pull_requests:write,
                          stored in the server configuration and scoped to this repository only

open a draft  → git worktree add -b docs/<slug> <path> main
save          → write the file, and registry.json when a field changed
validate      → run the gates inside the worktree
publish       → git commit -am …  →  git push -u origin docs/<slug>  →  open a pull request
merge         → ordinary review; CI builds and publishes; the draft worktree is pruned
```

| Rule | Why |
|---|---|
| a draft is a **worktree**, never the live tree | editing can never disturb the published site or a running build |
| a draft is a **branch**, never a database row | git is the history; there is nothing to back up or migrate |
| publishing requires the branch to be **up to date with `main`** | a stale branch is refused, and "sync" rebases and surfaces the conflicts |
| one open draft per page **per user** | two people on one page is a conflict rather than a merge, so the second editor is told who holds it |
| no network to GitHub, on an air-gapped host | publishing writes a `.patch` bundle for a person to apply, and says so |

## Safety rules

1. **Addressable targets are registry page ids only.** No user-supplied path, anywhere.
2. **Size limits**: a page at most 1 MB, an image at most 10 MB, and every image content-type sniffed.
3. **Publishing runs the gates first** — `docs:blocking`, `registry --check`, the link check and the media check. A failure blocks publishing and is never skipped with a flag; waivers live in the registry ([14](14-governance.md)).
4. **Restricted registry fields.** `title`, `order`, `owner`, `tags`, `keywords`, `reviewer` and `code` are editable by a page owner; `chapter`, `ship`, `area` and `category` are *structure* and are marked "needs the docs owner", with the editor requiring a pull-request comment for them. That is governance rather than tooling.
5. **Generated files are not editable** — `toc.yml`, `docfx.json`, the manifests and `index.json`. The editor refuses them; the fix is to edit the registry and regenerate.
6. **Internal host only.** The editor is served only where a git remote and a content clone exist. Field and customer machines have neither, so the editor's route is simply absent there and read-only by construction.
7. **Authentication uses the center tool's own accounts**, with `editor` and `reviewer` roles. Reading the site stays anonymous.
8. **The audit trail is the pull request** — a commit plus a pull request carrying the page id, the author, the diff and the gate results.

## The rest of the authoring surface

| Surface | Role |
|---|---|
| `/_admin/` | a read-only dashboard: coverage, stale pages by owner, docs owed, unowned and unreviewed pages, the health score |
| `/edit/<page-id>` | this document: the editor |
| dashboard to editor | a row deep-links into the editor for that page, which is the point of the dashboard |
| `:8080` | the developer's own preview, and the same mechanism the editor uses internally |
| `github.dev` and Codespaces | real VS Code on the real repository with no code of the project's own: the zero-cost option for engineers. No preview of this template, no registry fields and no gate markers, so it complements rather than replaces the editor |
| GitHub's "Edit this page" | still the secondary path, and the fallback when the editor host is down |

## Failure modes

| Failure | Behaviour |
|---|---|
| the draft worktree is missing on save | recreated from `main`, and the author is told the branch was rebased |
| the branch is behind `main` at publish | publishing is refused, "sync" is offered, and conflicts are listed per hunk |
| the preview server is down | the editor still saves; the preview pane says so and offers a rebuild |
| the Monaco bundle fails to load | the editor drops to a plain `<textarea>`, and save, validate and publish keep working |
| a push is rejected | the error and the remote's message are shown verbatim, and the draft is kept |
| a gate failure | findings are listed with file and line, and publishing is disabled |
| an unknown page id | 404 with the closest registry matches |
| two editors, one page | the second is read-only, with the holder's name and the draft's age |
| an image over 10 MB | rejected client-side and server-side |

## What is not built

| Not building | Because |
|---|---|
| rich or WYSIWYG editing | a rich round-trip rewrites the line layout of whole files |
| an embedded VS Code in an iframe | Monaco gives the editing experience; the integration — this preview, the registry fields, the gate markers, the publish flow — is the part actually needed |
| real-time co-editing | one draft per page per user is enough, and git already merges |
| in-browser image editing | a screenshot is captured properly or not at all |
| comment threads on a draft | pull-request review is the review tool, and it already records decisions |
| a CMS database | documents live in git; a database is a second source of truth waiting to disagree |

## Decisions and what is deferred

| Decision | Because |
|---|---|
| the core is **Monaco**, source-first | VS Code-class editing that never rewrites a page's line layout |
| the bundle is **self-hosted and custom** | the offline rule, and the all-languages default is waste |
| the **toolbar is the project's own** | no library ships this toolbar plus link completion plus gate markers |
| **the preview is `docfx build --serve`** on the draft worktree | preview equals the site by construction, with no second renderer to drift |
| **gate findings are markers** | a broken link becomes a squiggle rather than a log line to hunt for |
| **a draft is a git branch in a worktree, and publishing is a pull request** | git is the history, and there is no CMS database anywhere |
| **internal host only** | a field machine has no git remote, so there is nothing to edit against |
| no WYSIWYG, no spell check, no table grid and no co-editing in the first version | each is either a reflow risk or a cost not yet justified |

| Deferred | Reconsider when | Cost if adopted |
|---|---|---|
| spell check | prose errors keep reaching review | a locally shipped dictionary and a toggle |
| a table grid editor | authors ask for it more than once | a small dialog, not a rich editor |
| CodeMirror 6 | the custom bundle exceeds about 2 MB gzipped | a swap behind the same API, and the toolbar bindings redone |
| a `github.dev` shortcut in the toolbar | engineers want the full IDE on a page | one link |
| patch-based publishing | an air-gapped host has to publish without a remote | a `.patch` bundle and a documented hand-off |
| a rich mode | never, without the reflow check in the publish gate | a whole-file-diff discipline problem |

## What the build must satisfy

| # | Requirement |
|---|---|
| 1 | `npm run docs:editor:build` produces the custom Monaco bundle, self-hosted under `docs/templates/t3000/public/editor/`, and the editor loads with the network off |
| 2 | the editor page lives in the template layer with lazy loading, a `<textarea>` fallback, and a 404 when the editor is disabled |
| 3 | `GET /api/docs/page`, `POST /api/docs/draft` and `GET /api/docs/diff` work; a draft branch appears on save, and the diff tab matches `git diff` |
| 4 | gate findings reach Monaco as markers through `/api/docs/validate`: a broken link shows on its exact line |
| 5 | `POST /api/docs/upload` sniffs content types and applies the size limits, and the image lands in the page's `media/` on the draft branch |
| 6 | `POST /api/docs/publish` commits, pushes and opens a pull request, and refuses a stale branch |
| 7 | roles and authentication are wired for `editor` and `reviewer`, with a disabled mode: reading stays anonymous and a non-editor gets read-only |
| 8 | registry fields are editable, with structure fields requiring a pull-request comment |
| 9 | one draft per page is enforced, and dashboard rows deep-link into the editor |

On the internal host, a support engineer opens a stale page from the dashboard, edits a paragraph, uploads one screenshot, sees a preview identical to the site, validates and publishes — and the result is an ordinary pull request. On a field machine the same URL does not exist and the page is read-only. Nothing is stored outside git.
