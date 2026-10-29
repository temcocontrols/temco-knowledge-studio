# temco-docs

The documentation module of **Temco Platform**. It keeps a product's technical content — pages, registry, training — in step with the code that ships it, and it is what the AI module reads when it drafts an update.

The module is a built-in extension of the platform: it is compiled with all the other built-in extensions and ships inside the application. There is nothing to install and nothing to publish separately.

**This module holds no product content.** There is no page, no image and no registry here — it operates on the **project being worked on**, whose sources are product repositories, read wherever they live.

## Where it sits

| | |
|---|---|
| Repository | `temco-platform` |
| Folder | `extensions/temco-docs` |
| Extension id | `temcocontrols.temco-docs` |
| Command namespace | `temcoDocs.*` |
| Activity bar | **Temco** (`temco`) — the Documentation module's own five sections (*Projects*, *Sources*, *Documents*, *Pipeline*, *How-To*) + the Workspace tree (`temcoDocs.pages`) in *Documents* |
| Secondary side bar | **Forum** (`temcoForum`) — the threads panel (`temcoDocs.forum`), declared there rather than in the activity bar |
| Settings | none |
| Reads | [`temco-ai`](../temco-ai/README.md) for a draft or an analysis — optional, by command; and it needs nothing else |
| Read by | [`temco-workbench`](../temco-workbench/README.md) (the Library and the dashboard) and [`temco-ai`](../temco-ai/README.md) — this module publishes its model (`src/api.ts`) rather than lending it |

## What it does

Four surfaces:

- **Workspace** (activity bar) — the pages of the project being worked on, as areas → chapters → pages, with the metadata a maintainer needs (owner, audience, whether the page ships, whether it was ever reviewed) and, from the source's own generated files, each page's last change, its headings, and whether the code it claims moved on since the last review. A **Gaps** node gathers every structural fault, problems land in the file that has to be fixed, and the status bar carries the totals.
- **Documentation Owed** — the report of what needs attention, grouped by its owner.
- **Builds** — the open repository's own site and offline-help builds, invoked as tasks and judged by the artifact they leave behind, never by an exit code.
- **Forum** — the threads about this documentation set: the issues carrying the `docs-feedback` label in the repository the project cites, as a panel declared in the secondary side bar, and **Triage**, which opens one thread as a tab *beside* the conversation — the thread, the page it names, whether that page's code moved, and the two acts that follow (open the page, draft the fix, which opens the page and hands it to the AI panel). The list is read 50 at a time and **Load more** asks for the next page. Read only: nothing is labelled or commented from here.

The documentation dashboard is deliberately not one of them: it is a generated static page in the docs site, built by the product repository's own pipeline. This module is the hand-off target its rows deep-link into; it neither generates nor re-implements that page.

What it writes, and only when asked: the file for a registered page that has none, an empty registry in a folder you have open that has none, and a draft you apply — an uncommitted `git apply` in the clone that holds the page, asked for in a modal question and reversible with the Undo on the notification; when the page is in the tree this window has open, the editor's own edit, with one `Ctrl+Z`. It also downloads the runtime and models you ask for (your own folder, never a repository). Everything else is read, and nothing is published from here at all.

## Build

From the platform root:

```powershell
npm run compile                   # the whole platform, including this module
npm run gulp compile-extensions   # every built-in extension
npm run gulp compile-extension:temco-docs   # only this module
npm run build-fast                # development build (transpiles this module too)
```

The manifest is guarded against a duplicate command id:

```powershell
npm run check-temco          # the module guards, the dependency graph, and the menu ids
```

`npm run compile` runs it. The watch build does not, so run it by hand while iterating on commands.

## Rules this module keeps

- **No product content, no secrets.** A product's pages, images, registry and credentials stay in the product repositories. The module works on whatever folder you open.
- **The AI drafts, a human approves.** A draft arrives as a diff, and reaching the page takes a button and a question that says where the change lands — an uncommitted `git apply` in the clone with Undo, or the editor's edit and `Ctrl+Z` in this window's own tree; nothing is published from here at all.
- **Nothing native ships.** A compiled engine is per-OS, so the runtime and the models are downloaded on request into your own folder.
- **Nothing is fetched unasked.** Downloads are commands you ran; there is no telemetry and no background refresh, and a token lives in secret storage.
- **Building is not shipping.** Builds are invoked in the repository that owns them, and the form that deploys into a T3000 installation is never run.

## Where to read more

The platform's own documents live in the platform repository:

| Document | Covers |
|---|---|
| [`docs/architecture/temco-platform-architecture.md`](../../docs/architecture/temco-platform-architecture.md) | the repositories, the layout, the shell, the entry points, the rules |
| [`docs/architecture/naming.md`](../../docs/architecture/naming.md) | the ids this module uses, and why |
| [`docs/modules/README.md`](../../docs/modules/README.md) | the module register, this module's contract, and how to add one |
