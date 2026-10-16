# 01 — The platform

What Temco Learn publishes, the model it follows, and which document carries each part of the design.

---

## What it publishes

Temco Learn carries the documentation of the products: controllers, protocols, APIs, SDKs, architecture notes, troubleshooting, release notes and manuals. One corpus serves two readers — a person browsing the site, and a person reading F1 help inside the product with no network.

The corpus is Markdown in Git, in the product repository, in the folders it already occupies. Everything else — the content package, the site, the offline copy, the PDF, the help file and the index the AI reads — is generated from it.

| Output | Produced by | Detailed in |
|---|---|---|
| the content package | the engine, one per product and version | [03](03-site-project.md) |
| the site | Temco Learn, over the published packages | [`../README.md`](../README.md) |
| the search index | built per package, queried through the site | [06](06-search.md) |
| the offline copy | a zip of the rendered output, with relative URLs | [07](07-offline-pdf-chm.md) |
| the PDF manual | `docfx pdf` → `T3000-Learn.pdf` | [07](07-offline-pdf-chm.md) |
| the help file, opened by F1 | `npm run build:help` → `hhc.exe` | [07](07-offline-pdf-chm.md) |
| the AI's index | `docs/help/index.json`, read by the MCP document tools | [12](12-ai-features.md) |

No page is duplicated for any of these, and no output is edited by hand after it is built.

## The model

**Plain Markdown, structure in one place.** A page carries no front matter and stays where it is. `docs/help/registry.json` declares every structural fact — its chapter, its order, its owner, its audience, whether it ships, and the code globs it describes. Nothing moves to satisfy the build, so the application's page, the MCP tools and every existing link keep working.

**Documentation as code.** Provenance is derived, never typed into a page:

| Shown on the page | Source |
|---|---|
| author, last change, date | `git log -1` on the page's path |
| owner, reviewer, verified date | the registry |
| the version it ships in | the release the help file was built for |
| source and history links | the commit SHA |
| review state | the pull request, and the docs-owed check |

**AI maintains the corpus; a person approves what a customer reads.** The duties, in the order they pay off:

| Duty | Produces |
|---|---|
| analyse commits | a two-to-four line summary per commit, grouped by scope |
| detect stale content | the pages whose declared code changed after their verified date — deterministic, no model needed |
| detect impact | the pages whose `code` globs match a diff |
| propose updates | mechanical edits applied; prose offered as a diff |
| draft release notes | a draft page, editable before publication |
| answer questions | natural-language answers over the corpus, citing pages |

A prose change is always a diff a person accepts; a mechanical edit may be applied directly.

## The layers

| Layer | Owns | Detail |
|---|---|---|
| 1 — content | the Markdown, the images, and the registry that describes them | [05](05-content-and-registry.md) |
| 2 — engine | the build: the content package, the rendered copies, the PDF, the search data and the help file | [02](02-docfx-engine.md), [03](03-site-project.md), [04](04-template.md), [07](07-offline-pdf-chm.md) |
| 3 — the site | Temco Learn: the pages people read, search, downloads and the assistant | [`../README.md`](../README.md), [06](06-search.md), [09](09-feedback-subscriptions-notifications.md) |
| 4 — search | the index, the facets, and the signals that feed the review queue | [06](06-search.md) |
| 5 — collaboration | pull requests, review, the gates, and the docs-owed check | [08](08-editing-and-git.md), [11](11-review-and-cicd.md) |
| 6 — AI | commit analysis, impact analysis, drafting and assistance | [12](12-ai-features.md) |

## Why DocFX

The content package, the offline copy, the PDF and the search data are produced by **DocFX**, the open-source generator that grew out of Microsoft's documentation toolchain. It is a build tool behind the package contract, not the architecture: a product that needs another engine uses one, and the site never notices.

DocFX is community-maintained: its own README states that Microsoft Learn no longer uses it and does not intend to support it, and that it continues as a .NET Foundation project. Two consequences hold this design:

- the version is pinned and the template layer stays thin, so the rendered output never changes unexpectedly;
- nothing here mirrors Learn's current architecture. That is an internal platform of a different scale; this one is Git, Markdown, DocFX, a template and a handful of small services.

| What DocFX provides | Detail |
|---|---|
| a documentation layout without building one | left navigation, the article column, the "In this article" rail, breadcrumbs, previous and next, a table-of-contents filter, dark mode and a search box, from the built-in `default` and `modern` templates |
| Markdown stays where it is | `docfx.json` globs and `toc.yml` describe the corpus; pages keep their paths |
| navigation as its own file | `toc.yml` is generated from the registry, which is what keeps per-page metadata out of the pages |
| links that are checked | relative `.md` links are resolved and warned on, and `~/` gives root-relative links |
| the PDF as well | `docfx pdf` renders from the same table of contents, so the PDF cannot diverge from the site |
| the search index as a build artefact | every build writes the index and `xrefmap.yml` |
| a replaceable look | a `templates/t3000` layer shapes the rendered copies without touching content; the site's own look is Fluent UI |
| patchability | the engine can be cloned and patched when it must be: a template override first, then a post-processor, then a patch. The template names `default`, `default(zh-cn)`, `statictoc` and `common` are reserved by the engine |

| Not DocFX | Covered by |
|---|---|
| the help file | `scripts/build-t3000-help-chm.mjs` and `hhc.exe` — the artefact F1 opens |
| C++, Rust and TypeScript API pages | Markdown written from the OpenAPI and register definitions; `docfx metadata` is .NET-only |
| linting, broken links, offline-asset rules | `scripts/audit-docs.mjs` |
| context-sensitive help ids | `scripts/docs-map.mjs` |

**The site is not the engine.** The engine writes files; the site reads the packages they become and adds what a generator is bad at — one index across products and versions, downloads, feedback, the assistant — through its own application. It reads only the package contract, which is what makes the engine replaceable: the manifest, the navigation model, the pages, the assets, the downloads and the search index.

## The content model

Documentation is organised by what a reader needs, not by the source tree, and the categories live in the registry — so no file has to move:

| Category | Covers | Lives in |
|---|---|---|
| Products | devices, data points, features | `docs/t3000/**` |
| Protocols | BACnet, Modbus, MQTT | `docs/t3000/building-platform/**` |
| Development | architecture, the build system, the source tree | `docs/t3000/architecture/**`, `docs/legacy/development/**` |
| Reference | APIs, commands, registers | `docs/t3000/api-reference/**` |
| Troubleshooting | FAQs, known issues, field cases | `docs/t3000/guides/**` |
| Tutorials | getting started, examples, the studio manual | `docs/t3000/quick-start/**`, `t3-eez-studio/manual/**` |
| Release notes | releases, fixes, new features | `docs/t3000/releases/**` |

One entry per page, in the registry:

```json
"t3000/features/trendlogs": {
  "title": "Trend Logs",
  "category": "products",
  "product": "t3000",
  "audience": "user",
  "ship": true,
  "chapter": "features",
  "order": 40,
  "owner": "trendlog",
  "reviewer": "docs",
  "version": "v26.0930",
  "tags": ["trend", "history", "chart"],
  "keywords": ["trend log"],
  "help_ids": ["IDH_TOPIC_TREND_LOGS"],
  "code": ["src/t3-react/features/trendlog/**", "api/src/trendlog.rs"],
  "reviewed": { "sha": "a1b2c3d", "date": "2026-10-09", "by": "docs" }
}
```

| Field | Used for |
|---|---|
| `title` | navigation, the help file's contents, search |
| `product`, `category` | filtering, grouping, search facets |
| `version` | which release the page belongs to, and the version switcher |
| `owner`, `reviewer` | review routing and the approval record |
| `reviewed` | the staleness arithmetic |
| `tags`, `keywords` | search facets and the help file's index |
| `ship`, `chapter`, `order` | whether the page is built, and where it sits |
| `code` | which source the page describes, so a change there can mark it stale |

A page missing from the registry fails the build unless it is listed in `registry.exclude` with a reason, and a page that ships must carry `owner`, `chapter`, `order` and `code`.

## The surfaces

| Surface | Shows | Detailed in |
|---|---|---|
| the home page | the product catalogue: a tile per product with its description and version count, and a search box | [`../README.md`](../README.md) |
| an article | the left navigation, the article, a rail with its headings and when it last changed, and at the bottom the edit and history links | [04](04-template.md) |
| the application's help | the help file through F1, and a link to the site | [07](07-offline-pdf-chm.md) |
| search | one index for the site and the app, with facets taken from the registry | [06](06-search.md) |
| F1 help | the help file, built from the same pages | [07](07-offline-pdf-chm.md) |
| the admin dashboard | coverage, stale pages by owner, docs owed, unowned and unreviewed pages, broken links, one health number — generated, `noindex`, and excluded from every shipped artefact | [11](11-review-and-cicd.md) |

## Search and analytics

One index serves the site, built per package from the pages that package contains and queried through the site's own search route; facets come from the manifest — product, category, version and section — so no page changes to appear in a filter. A package may also carry a pre-built index, which is what makes an offline copy searchable without a server.

Analytics are first-party only: the offline rule forbids remote assets, and an internal host should not report its usage to a third party.

| Signal | Decides |
|---|---|
| most searched terms | what people actually want |
| searches with no result | what is missing — first in the review queue |
| most viewed pages | where polish pays off |
| most reported pages | where quality is doubted |
| documentation health | staleness, broken links, unreviewed pages and feedback in one number |

The dashboard shows the current health; the weekly report carries the trend.

## The technology

| Concern | Choice |
|---|---|
| storage | Markdown in git, in the product repository |
| publishing engine | DocFX, pinned — the [02](02-docfx-engine.md) document owns how |
| help file | the existing Node pipeline and `hhc.exe` |
| search | the site's own index over the published packages; a package may carry a pre-built one for the offline copy |
| media | images beside the page, delivered by the site and by the help file |
| database | none until feedback, subscriptions or analytics need one — then PostgreSQL |
| analytics | first-party beacons on the same origin |
| authentication | none for reading; an editor role only where editing is hosted |
| AI | model-agnostic: the repository's own agent and MCP tooling |

## Where it stands

| Capability | Exists | Added |
|---|---|---|
| one Markdown source in git | yes | the structure declared in one place |
| help file with F1 | yes | the F1 id map completed |
| full-text search | inside the help file | one index for the site and the app |
| documentation site | no | Temco Learn, at `/{product}/{version}/{page}` |
| offline reading | the help file | an offline site package and a PDF |
| the product's own help | yes, through F1 | the same pages, generated from the registry |
| provenance per page | git history | author, version and review state shown on the page |
| docs-as-code gates | link and formatting checks | the docs-owed check and ownership |
| AI-assisted maintenance | no | commit summaries, then impact analysis and drafting |
| analytics | no | first-party metrics that feed the review queue |
| hosted editing, feedback, subscriptions | no | the next layers, detailed in [09](09-feedback-subscriptions-notifications.md) and [15](15-online-editor.md) |
