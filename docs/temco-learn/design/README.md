# Temco Learn — the design

The engineering design of Temco Learn: the documentation site, the pipeline that feeds it, and the rules that keep the two apart. T3000 is the first product it covers.

Three things make up the system, and every document in this folder belongs to one of them:

| Part | What it is | Where its design lives |
|---|---|---|
| **the sources** | Markdown plus the registry, in each product's repository | this folder — [05](05-content-and-registry.md) |
| **the pipeline** | the center tool, the build engines, and the content package between them | this folder — [02](02-docfx-engine.md), [03](03-site-project.md) |
| **the site** | Temco Learn, the Next.js application people read | [`../README.md`](../README.md), [`../content-package.md`](../content-package.md) |

The site is not the engine's output. A build engine turns sources into a **content package**, and the site reads packages: its own chrome, routing, search and assistant, over content it never had to render. DocFX is the default engine; another one may be used for a product that needs it, without a line of change in the site.

## Where to start

- [00 — High-level structure](00-architecture.md) is the picture: what produces the documentation, what the site is, where each piece runs, and how a change flows.
- [01 — The platform](01-platform.md) is the design proper: what is published, the model, the layers and the surfaces.
- [16 — The platform in one document](16-overview.md) is the same thing for a reader who is not going to build it.
- [`../README.md`](../README.md) is the site itself, and [`../content-package.md`](../content-package.md) is the contract its pipeline has to satisfy.

Every other document is the buildable detail for one part of the design — schemas, file paths, commands, code sketches and the conditions the build has to satisfy.

## The documents

| # | Document | Covers |
|---|---|---|
| 00 | [High-level structure](00-architecture.md) | the system, the pieces and their paths, where each runs, how a change flows, scope |
| 01 | [The platform](01-platform.md) | what is published, the model, the layers, the surfaces, search and analytics, the technology |
| 02 | [The DocFX engine](02-docfx-engine.md) | how the default engine is obtained, pinned, invoked, upgraded, rolled back and — last — patched |
| 03 | [The engine's project](03-site-project.md) | `docfx.json`, the `toc.yml` files, and how the output becomes a content package |
| 04 | [The template](04-template.md) | the engine's HTML layer: what the rendered copies look like, and what the site takes from them |
| 05 | [Content and the registry](05-content-and-registry.md) | `registry.json`, its validation rules, and every generated artefact |
| 06 | [Search](06-search.md) | the site's index, its facets, and the query signals that feed the content queue |
| 07 | [Offline outputs](07-offline-pdf-chm.md) | the offline copy, the PDF and the help file, and where they are published |
| 08 | [Editing and git](08-editing-and-git.md) | the editing workflow, the hosted editor, and what a page shows about itself |
| 09 | [Feedback, subscriptions, notifications](09-feedback-subscriptions-notifications.md) | the endpoints, the tables, RSS, routing and the aging report |
| 10 | [What's New, release notes and versions](10-changelog-releases-versioning.md) | changelog generation, release drafts, and how a version becomes a package |
| 11 | [Ownership, gates and delivery](11-review-and-cicd.md) | roles, staleness rules, the gates, the workflows, publishing and rollback |
| 12 | [AI features](12-ai-features.md) | commit analysis, impact analysis, the assistant, and the guardrails |
| 13 | [The implementation plan](13-implementation-plan.md) | the work as pull-request-sized tasks with acceptance tests |
| 14 | [Governance](14-governance.md) | roles, when review is required, publish authority, emergencies, waivers, retirement |
| 15 | [The hosted editor](15-online-editor.md) | Monaco, the self-hosted bundle, the API, the server-side git flow, the safety rules |
| 16 | [The platform in one document](16-overview.md) | the reader's and the author's view, the system, the roles, the risks, the decisions |

Related, outside this folder:

- [`../README.md`](../README.md) — the site: its stack, its pages, its structure, its content model.
- [`../content-package.md`](../content-package.md) — the contract between an engine and the site.
- `docs/help/DESIGN.md` — the help-file pipeline and the `docs/help/*.json` manifest format.
- `scripts/audit-docs.mjs`, `scripts/build-t3000-help-chm.mjs` — the existing documentation tooling.

## The rules these documents assume

1. **One source.** Markdown in the product repository's `docs/**`, structure in `docs/help/registry.json`. No second content store and no page copies.
2. **The content package is the contract.** `manifest.json`, `nav.json`, `pages/`, `assets/`, `downloads/` and a search index. The site reads packages, an engine writes them, and neither names the other ([`../content-package.md`](../content-package.md)).
3. **The engine is a tool, and it is pinned.** DocFX is the default, resolved through `tools/docfx.pin`; a product may choose another engine without touching the site. Never a submodule, never vendored ([02](02-docfx-engine.md)).
4. **The help file stays the Node pipeline** — `npm run build:help` through `hhc.exe`. An engine cannot produce a CHM, and F1 help stays a shipping artefact.
5. **No file moves, and no page metadata.** Pages stay where they are, with no front matter; everything else lives in the registry ([05](05-content-and-registry.md)).
6. **The site is a Next.js and Fluent UI application.** Routes are `/{product}/{version}/{page}`; packages are published under `content/<product>/<version>/`; `products.json` is the product registry ([`../README.md`](../README.md)).
7. **Offline first.** Every published page renders with no remote font, image, script or style, and the gates check the sources and the built output ([11](11-review-and-cicd.md)).
8. **A version is a package folder.** `latest` is resolved from the manifest list and never copied, and a rollback is a folder swap plus a rebuild of the index ([10](10-changelog-releases-versioning.md)).
9. **People approve prose.** A model may summarise, detect and draft; a named owner approves before publication ([12](12-ai-features.md)).
10. **No third-party product names** in a shipped page.
11. **Two surfaces.** The site reads; the center tool edits. Nothing that edits ever ships.
12. **Search belongs to the site:** an index built per package, served through the site's own search route, with facets taken from the package's manifest ([06](06-search.md)).
13. **Analytics are first-party**: page views, search terms, zero-result queries and the feedback ratio, feeding one health number. No third-party script.
14. **Media is governed** rather than left to whoever adds a screenshot: a per-page `media/` folder, `NN-area-slug.png`, at least 1600 px wide, with missing, unused, duplicate and oversized files reported by the audit.
15. **Retention.** The site carries the current version and the last three by default; older packages remain as release artefacts.
16. **The changelog comes first.** Commit summaries need no site application, no endpoint and no authentication, and they are the ask that started this project.
17. **One site, many products.** Supporting a product is a folder of packages plus a line in `products.json`; no site code changes ([03](03-site-project.md)).
18. **The rendered copies are artefacts, not the site.** The offline copy, the PDF and the help file are produced by the engine and published as a version's downloads; the help file also ships beside the product executable.
19. **Two builds, deliberately separate.** A product's build publishes content; the site's build publishes the application. A documentation change never redeploys the site's code ([00](00-architecture.md)).
20. **The editor is Monaco**, source-first, with a self-hosted bundle, a preview that is the real pipeline, gate findings as inline markers, and no WYSIWYG: a rich editor would rewrite the line layout of every page it touched ([15](15-online-editor.md)).

## Prerequisites

| Tool | Version | Needed for | Notes |
|---|---|---|---|
| .NET SDK | 8.x, 9.x or 10.x | running the engine, and building it from source | the engine targets these |
| Node.js | 24.x | the site, the engine's templates when built from source, and this repository's own scripts | the site runs on it, or exports statically |
| Git | any | provenance, a source checkout, the diff guards | — |
| HTML Help Workshop | at `C:\Program Files (x86)\HTML Help Workshop` | the help file only | `hhc.exe`; judge a build by its output file, because its exit code is unreliable |
| Visual Studio 2022 | optional | contributors to the engine's CLI | not needed for a command-line build |
| `git-lfs` | optional | the engine's own snapshot tests | `git lfs checkout` |

## The engine's vocabulary

| Term | Meaning here |
|---|---|
| `docfx.json` | the engine's project file; every relative path is resolved against its directory |
| content, resource | globs for files that become pages (`.md`, `.yml`) and for files copied as they are (images) |
| file mapping | the short form `["**/*.md"]`, or the expanded `{files, exclude, src, dest}` |
| TOC | a `toc.yml` file; the one beside `docfx.json` becomes the top of the navigation model |
| nested, reference TOC | nested is one table of contents inside another; a reference is `href: folder/`, linking to that folder's own |
| template | the HTML rendering layer: `default`, then `modern`, then the project's own in `templates/t3000` |
| theme | a CSS layer on top of a template; the site uses Fluent UI instead |
| metadata | page metadata: `globalMetadata` for every page, `fileMetadata` for a glob |
| `_layout` | the `landing` and `chromeless` layouts the `modern` template provides |
| xref, xrefmap | cross-referencing by `uid`; the engine writes `xrefmap.yml` into its output |
| affix | the right-hand rail, "In this article" |
