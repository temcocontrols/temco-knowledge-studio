# 00 — High-level structure

One page for the whole system: what produces the documentation, what the site is, where each piece lives, and the rules that keep reading and authoring apart.

---

## What it is

**Temco Learn is the documentation site** — a Next.js application in Fluent UI that hosts the published documentation of every product and every version, with search, an "On this page" rail, downloads and an assistant.

**Temco Platform is the center tool** that manages the sources: the page registry, the checks, the drafting, the review and the publishing.

Between the two sits **a content package**, and behind the package sits **a build engine**. DocFX is the default engine; another one may be used for a product that needs it. The site reads packages and never names an engine, which is what makes the engine replaceable.

One source — Markdown plus the registry — becomes five deliveries:

| Delivery | Produced by | Where it goes |
|---|---|---|
| the content package | a build engine | published to the site, once per product and version |
| the site | the site's own build, from the published packages | `/{product}/{version}/{page}` |
| the offline copy | the engine, as a zip of the rendered output | a release artefact, also offered as a download |
| the PDF | the engine | a release artefact, also offered as a download |
| the help file | the existing Node pipeline and `hhc.exe` | beside the product executable — the F1 channel |

No page exists twice, and no delivery is edited by hand after it is built.

## The pieces and where they live

| Piece | Path in the product repository | Written by |
|---|---|---|
| the pages | `docs/t3000/**`, `docs/legacy/**`, `docs/temco-learn/design/**` | authors |
| the structure | `docs/help/registry.json` | authors; every check reads it |
| the engine's project | `docs/docfx.json`, `docs/toc.yml` | generated from the registry |
| the engine's template | `docs/templates/t3000/` | hand-written, and used only for the rendered copies |
| the generated metadata | `docs/help/index.json`, `page-meta.json`, `versions.json`, `help-ids.json` | the registry generator |
| the package | `dist/docs/<product>/<version>/` | the engine |
| the published package | `temco-learn/content/<product>/<version>/` | the publishing pipeline |
| the engine itself | `tools/docfx.pin`, plus an optional checkout outside the tree | — |

Pages are plain Markdown with no front matter, in the folders they already occupy. Nothing is moved, renamed or duplicated to satisfy a build; the registry is the only place where structure is declared.

## The content package

The package is the contract between a build engine and the site ([`content-package.md`](../content-package.md)):

```
<product>/<version>/
├─ manifest.json      what this is and what it was built from
├─ nav.json           the navigation model
├─ pages/             the articles, as Markdown, with pre-rendered HTML beside them when the engine produces it
├─ assets/            images and page assets
├─ downloads/         the published PDF, help file and source package
└─ search-index.json  the index for this package
```

Two consequences follow, and they shape everything else in this folder:

- **the site is not the engine's output.** The site owns its own chrome, routing, search interface and assistant; it renders the pages or serves the engine's pre-rendered HTML, and either way the package is what it reads.
- **the engine is a tool.** It is invoked by a product repository's own scripts, its configuration stays with the product it builds, and its version is pinned by that product and recorded in the manifest.

## The engine

| | Pinned release | Source checkout |
|---|---|---|
| what it is | an official release installed as a local .NET tool | a clone of `dotnet/docfx` built from source |
| recorded in | `tools/docfx.pin` and `.config/dotnet-tools.json` | `tools/docfx.pin` and the `DOCFX_REPO` environment variable |
| where it lives | with the tool manifest | outside the product tree, as a sibling folder |
| used when | a normal build | a patch, a change the packages cannot express, or full control |

Neither form is a submodule and neither is vendored, so a product's `git status` never shows engine files. Patches are declared in `tools/docfx.pin` and applied by `docs:engine` after the checkout; that list being empty is the goal ([02](02-docfx-engine.md)).

## The system in one picture

```
   authors
      │  edit Markdown (no page metadata) and the registry
      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ product repository (git)                                                     │
│                                                                              │
│   docs/t3000/**.md          the pages            ← never moved, never renamed │
│   docs/legacy/**.md         engineering notes                                │
│   docs/temco-learn/design/  the design, noindex                              │
│                                                                              │
│   docs/help/registry.json   the structure: chapters, order, owner, code globs │
│   docs/templates/t3000/     the look of the rendered copies                  │
└───────────────────────────────────────┬──────────────────────────────────────┘
                                        │  npm run docs:registry
        ┌───────────────────────────────┼────────────────────────────────┐
        ▼                               ▼                                ▼
 docs/docfx.json  +  docs/toc.yml   docs/help/*.json  (help-file defs)   index.json · page-meta.json
        │                               │                                versions.json · help-ids.json
        │ the engine                    │ hhc.exe                              │
        ▼                               ▼                                      ▼
 ┌────────────────────────┐   ┌────────────────────┐        ┌────────────────────────────┐
 │ the content package    │   │ T3000_Help.chm     │        │ the center tool            │
 │  manifest · nav        │   │  offline, F1       │        │  the registry, the gates,  │
 │  pages · assets        │   └─────────┬──────────┘        │  drafting, publishing      │
 │  downloads · index     │             │                   └────────────────────────────┘
 └───────────┬────────────┘             │ installer copies it next to T3000.exe
             │ published                ▼
             ▼                     F1 in the product
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │ TEMCO LEARN — the site                                                       │
 │   Next.js + Fluent UI   /{product}/{version}/{page}                          │
 │   navigation from nav.json · search from the package's index or its own      │
 │   downloads · assistant with citations · home from products.json             │
 └──────────────────────────────────────────────────────────────────────────────┘
```

## Where it runs

| Piece | Runs on | Serves |
|---|---|---|
| Temco Learn | the site's own host — a Node runtime, or a static export behind any static host | the documentation, at `/{product}/{version}/{page}` |
| the engine | the build host | nothing; it writes files |
| the center tool | the author's machine | nothing; it edits the sources and drives the builds |
| the help file | the field machine | F1 inside the product, with no network |

The runtime of the deployed product needs **no Node and no .NET**: the product ships its help file and opens documentation as a link to the site. The documentation site is a separate deployment, which is what allows it to cover every product and version at once.

Authoring and reading stay apart:

| Surface | Shows |
|---|---|
| Temco Learn | everything published — anonymous, indexable |
| the site's own `/search`, `/api/search`, `/api/ask` | search over the published packages, and answers that cite pages |
| a product's `downloads/` | the PDF, the help file and the source package for that version |
| the center tool | the sources: the registry, the checks, the drafts, the review, the publish action |
| the admin report | coverage, stale pages by owner, docs owed, broken links — `noindex`, and in no shipped artefact |

## How a change flows

```
edit docs/t3000/features/trendlogs.md
   │
   ├─ the center tool ────────────► the page, its registry fields, its checks
   ├─ npm run docs:blocking ──────► links, fences, one H1, no remote assets
   │
   └─ git commit ─► PR ─► CI: registry --check · docs:blocking · the engine build · docs-owed
                                │
                                ▼
                       merge to main
                                │
        ┌───────────────────────┼────────────────────────┬───────────────────────┐
        ▼                       ▼                        ▼                       ▼
  the package rebuilt     published to the site     the help file rebuilt   changelog entry
  and validated           content/<product>/<v>     and shipped             + RSS + subscriptions
```

## Many products, one site

A product is a folder of packages plus a line in the site's `products.json`. The site's routing, search and home page are data-driven, so supporting a product changes no site code.

| Question | Answer |
|---|---|
| where does a product's content live? | in that product's repository, beside its code |
| how does it reach the site? | its build produces a package, the pipeline publishes it under `content/<product>/<version>/` |
| how is another version added? | publish another package folder; `latest` is resolved from the list, never copied |
| can a product use a different engine? | yes: the engine sits behind the package contract, so it is a product-level decision |
| what would force a separate site? | nothing in this design: separate products and separate versions are the site's normal case |

## The build

```
 the product build (one pass — the documentation rides along)
   │
   ├─ 1  the application
   ├─ 2  docs:registry      → docs/docfx.json, docs/toc.yml, docs/help/*.json
   ├─ 3  the engine         → dist/docs/<product>/<version>/   the content package
   ├─ 4  build:help         → T3000_Help.chm                   (needs hhc.exe on the build host)
   └─ 5  publish            → the package into the site's content/, the help file beside the executable

 the site build (its own pipeline, its own repository)
   │
   ├─ 1  validate-content   → every package parses, every path resolves, every product has a latest
   ├─ 2  build-search-index → the index for the published packages
   └─ 3  next build         → the site
```

The two builds are deliberately separate: a documentation change publishes content without redeploying the site, and a change to the site's chrome does not rebuild any product.

## URLs, versions and rollback

| Shape | URL | Trade-off |
|---|---|---|
| the site, current version | `https://<host>/t3000/latest/features/trendlogs` | one site covers every product and version |
| the site, a fixed version | `https://<host>/t3000/13.0/features/trendlogs` | a customer on an older build reads their own build |
| a release's downloads | `/t3000/13.0/downloads` | the PDF, the help file and the source package |
| offline, in the product | `T3000_Help.chm` through F1 | no network, no browser |
| offline, on a laptop | the offline package from `downloads/` | the whole site for one version, extracted locally |

**Rollback is a folder.** A version is a package folder, and the site resolves `latest` from the manifest list, so restoring an earlier set of packages is a directory change plus a rebuild of the index — with no re-render and no redeploy of the site's code.

## Scope

**In the first release:** the registry and its generators, the engine pin and the package it produces, the published packages, the site with its navigation, article layout, search and downloads, the help file at parity with the site, the checks in CI, and the first version of the admin report.

**Later, in this order:** the changelog and impact analysis, docs owed and the weekly report, release-note drafts, RSS and the reviewer banner; then feedback and subscriptions, the hosted editor and the assistant; then the PDF and the offline package as first-class release artefacts; then embeddings and drafting on demand.

## Rules

1. **The package is the contract.** The site reads packages; an engine writes them. Neither names the other.
2. **The engine is a tool, and it is pinned.** DocFX is the default; a product may choose another engine without touching the site ([02](02-docfx-engine.md)).
3. **One source, no copies.** Markdown in the product repository, structure in the registry; the package is generated, never authored.
4. **No page moves and no page metadata.** The registry is the only place structure is declared ([05](05-content-and-registry.md)).
5. **The site is the reading surface; the center tool is the authoring surface.** Nothing that edits ever ships.
6. **The help file stays the F1 channel**, produced by the existing pipeline; the PDF and the offline package are release artefacts offered as downloads ([07](07-offline-pdf-chm.md)).
7. **Offline first.** Every published page renders with no remote asset ([11](11-review-and-cicd.md)).
8. **People approve prose.** A model may summarise, detect and draft; a named owner approves before publication ([12](12-ai-features.md)).
9. **A version is a package folder.** Publishing and rolling back are directory operations, not rebuilds ([10](10-changelog-releases-versioning.md)).
