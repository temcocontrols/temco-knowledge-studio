# Temco Learn — the published site

Temco Learn is the presentation layer: the website people read. It serves the content packages a product's build published — one per product and version — and it has no authoring, no drafts, no reviews, no sources and no writes.

## Stack

| Choice | Why |
|---|---|
| **Fluent UI v9** | the Microsoft design language, so the site sits in the family it belongs to |
| **Next.js (App Router) + TypeScript** | routing for `/{product}/{version}/{page}`, static export when required |
| **Markdown from the content package**, pre-rendered HTML when present | the site runs with or without a build engine |
| **A search index built by a script** | search stays fast and the site stays static at runtime |
| **Not MkDocs, not Starlight** | those produce a documentation site; the target is a site that looks and behaves like Microsoft Learn |

## Pages

| Page | Contents |
|---|---|
| Home | the product catalogue: a tile per product with its description and version count |
| Product | Overview · Guides · Architecture · API · Troubleshooting · Release notes · Downloads |
| Article | left a persistent navigation tree, centre the article, right an "On this page" list. A sticky header carries the product switcher, the version selector and search. Breadcrumbs above the title, "Was this helpful?" below |
| Downloads | per release: online, PDF, CHM and source package, each with size and date |
| Search | a results page with product, version and section filters |
| Ask AI | a panel on an article that answers about that page with citations that open what they name |

## Structure

```text
temco-learn/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                          home — the product catalogue
│   ├── [product]/
│   │   ├── page.tsx                      product landing
│   │   ├── versions/page.tsx
│   │   └── [version]/
│   │       ├── [...slug]/page.tsx        article
│   │       └── downloads/page.tsx
│   ├── search/page.tsx
│   └── api/
│       ├── search/route.ts
│       └── ask/route.ts                  loopback only
├── content/                              generated — never hand-edited
│   ├── products.json                     the product registry
│   ├── t3000/{latest,13.0,12.9}/
│   ├── t3001/{latest,2.1}/
│   └── t3002/{latest,1.0}/
├── components/                           NavTree · OnThisPage · VersionSwitcher · SearchBox
│                                         ProductCard · DownloadCard · AskAiPanel · Breadcrumbs
├── lib/
│   ├── content/                          manifest schema and loader
│   ├── nav/                              nav model into sidebar and breadcrumbs
│   ├── search/                           index building and querying
│   ├── xref/                             cross-references between products
│   └── versions/                         latest resolution and version ordering
├── scripts/
│   ├── sync-content.mjs                  pull content packages from the build output
│   ├── build-search-index.mjs
│   └── validate-content.mjs
├── config/site.json                      branding, navigation order, feature flags
├── public/                               brand assets
└── docs/                                 the content contract and the publishing runbook
```

## Products and versions are data

```text
content/
├── products.json            id · title · description · order · icon · default version
├── t3000/{latest,13.0,12.9}/
├── t3001/{latest,2.1}/
└── t3002/{latest,1.0}/
```

Supporting a product means publishing a folder and adding its line to `products.json`. No site code changes. `latest` is resolved from the manifest, never copied.

## How content arrives

1. A product repository holds the sources and its own build scripts.
2. Its build produces a content package ([content-package.md](./content-package.md)).
3. The package lands in `content/<product>/<version>/`, committed by the publishing pipeline.
4. `scripts/validate-content.mjs` refuses an invalid package; `scripts/build-search-index.mjs` rebuilds the index.

Committing packages to git is deliberate: reviewable, free to host, simple to roll back. The manifest exists so a later move to object storage is a change in `sync-content.mjs`, not a redesign.

## Ask AI

- Answers about the open page, citing the page, related pages, source repositories and release notes.
- The endpoint is loopback only; nothing about a customer's content leaves the machine.
- An answer without a citation is not shown as an answer.
- The panel can be disabled in `config/site.json`.

## Gates

1. `validate-content.mjs` — manifests parse, required fields exist, every link and cross-reference resolves, every product has a `latest`.
2. `build-search-index.mjs` — the index rebuilds and its size is sane.
3. The site builds.
4. A manual pass: home, one product, one article, the version switcher, search, one download, the AI panel with its citations.

## Not built here

- No authoring, drafts, review or editing.
- No second copy of the sources.
- No administration dashboard.
- No reference to any build engine in any route, component or script.
