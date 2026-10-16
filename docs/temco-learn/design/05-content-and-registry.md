# 05 — Content, the registry and the generated metadata

Everything a page needs that is *not* its text lives in one file: `docs/help/registry.json`. Pages stay plain Markdown with no front matter, in the folders they already occupy. The engine's project, the help-file manifests, the package's manifest and navigation model, the search facets and the staleness reports are all projections of that one file.

```
docs/help/registry.json  ──►  docfx.json · toc.yml (×4) · help-file manifests (×3)
                         ──►  index.json · page-meta.json · docs-meta.json · versions.json
                         ──►  the package's navigation · the CHM .hhc and .hhk · the F1 id map
```

---

## The layout

```
docs/
├─ t3000/                 product documentation      (user audience, ships in the help file and the site)
├─ legacy/                engineering notes          (developer audience, site only)
├─ temco-learn/design/    the design package         (contributing audience, site, noindex)
├─ help/                  build definitions and the registry — not content
│  ├─ registry.json       the single source of the structure
│  ├─ manual.json         → T3000_Help.chm           (generated)
│  ├─ reference.json      → T3Web_Ref.chm            (generated, on demand)
│  ├─ engineering.json    → T3Web_Dev.chm            (generated, on demand)
│  ├─ index.json          the full page index with provenance   (generated)
│  ├─ page-meta.json      the runtime metadata the site needs   (generated)
│  └─ versions.json       version → site URL                    (generated)
└─ todo/                  a working file, excluded from every output
```

1. **no page is moved or renamed** — the application, the MCP tools and inbound links depend on these paths;
2. **no front matter is added to a shipped page**;
3. a structure change is a registry edit, not a file move: reorganising means a different `chapter` or `order`, that is, a different table of contents, and the files never move;
4. the design package and `docs/help/*.md` are published as the *Contributing* area and are `_noindex`ed.

## `registry.json`, schema v1

`docs/help/registry.schema.json` is the JSON Schema; `scripts/docs-registry.mjs` validates against it.

```jsonc
{
  "$schema": "./registry.schema.json",
  "version": 1,
  "generated": "2026-10-10",
  "products": {
    "t3000":  { "title": "T3000", "url": "/t3000/latest/" },
    "studio": { "title": "Design Studio", "url": "/t3000/latest/t3-eez-studio/" },
    "legacy": { "title": "Engineering notes", "url": "/t3000/latest/legacy/" }
  },
  "categories": {
    "products":        { "title": "Products",        "order": 10 },
    "protocols":       { "title": "Protocols",       "order": 20 },
    "reference":       { "title": "Reference",       "order": 30 },
    "tutorials":       { "title": "Tutorials",       "order": 40 },
    "troubleshooting": { "title": "Troubleshooting", "order": 50 },
    "development":     { "title": "Development",     "order": 60 },
    "releases":        { "title": "Release notes",   "order": 70 }
  },
  "areas": {                       // what becomes a toc.yml and a docfx content entry
    "t3000":  { "title": "T3000", "path": "t3000",  "site": true, "chm": ["manual", "reference"], "noindex": false },
    "legacy": { "title": "Legacy / Engineering", "path": "legacy", "site": true, "chm": ["engineering"], "noindex": false },
    "design": { "title": "Contributing", "path": "temco-learn/design", "site": true, "chm": [], "noindex": true }
  },
  "pages": {
    "t3000/features/trendlogs": {
      "title": "Trend Logs",
      "category": "products",
      "product": "t3000",
      "audience": "user",              // user | developer | contributing
      "area": "t3000",
      "chapter": "features",           // the table-of-contents parent
      "order": 40,                     // position inside the chapter
      "ship": true,                    // appears in the help file and on the site
      "keywords": ["trend log", "history"],
      "tags": ["trend", "history", "chart"],
      "owner": "trendlog",
      "reviewer": "docs",
      "version": "v26.0930",
      "help_ids": ["IDH_TOPIC_TREND_LOGS"],
      "code": ["src/t3-react/features/trendlog/**", "api/src/t3_device/trendlog*.rs"],
      "aliases": ["t3000/features/trend-log"],
      "reviewed": { "sha": "a1b2c3d", "date": "2026-10-09", "by": "docs" }
    }
  },
  "exclude": {
    "todo/notes.md": "scratch file",
    "help/DESIGN.md": "internal build documentation"
  }
}
```

An area carries its own `path`, because an area's name and its folder on disk need not agree: the *Contributing* area is `design` in every URL and `temco-learn/design` on disk, which keeps the design package's own folder name intact.

### Splitting a large registry

`registry.json` stays the single *logical* source and may be composed of several files, so that no file becomes a blob a reviewer cannot read:

```
docs/help/registry.json          products, categories, areas, waivers, generated
docs/help/registry.d/
├─ t3000-quick-start.json        pages, grouped by area or chapter
├─ t3000-device-management.json
├─ t3000-features.json
├─ legacy.json
└─ design.json
```

The generator merges them in filename order into one in-memory model, and a duplicate key is an error naming both files. `--check` still proves the whole model is reproducible. Splitting is a review convenience, never a second source of truth.

### Page ids and `aliases`

A page id **is** its docs-relative path (`t3000/features/trendlogs`), because that is what the application's routes, the MCP `doc_read` input and every existing link already use: a synthetic id would add a mapping layer and break a live contract for no benefit. The real risk is not the id but a future move, so the registry records previous ids:

```jsonc
"aliases": ["t3000/features/trend-log"]
```

A retired path gets a **generated** redirect stub carrying `redirect_url` metadata (a generated file may hold metadata; a hand-written page never does), so old links, bookmarks and subscriptions keep resolving. Moving a page is therefore allowed, expensive and explicit — never routine ([14](14-governance.md)).

### Validation rules

Every rule below is an error unless it is marked as a warning.

| Rule | Message |
|---|---|
| every `.md` under an area's `path` is either a `pages` key or an `exclude` key | `unregistered page: <path>` |
| `chapter` exists as a chapter of the page's area | `unknown chapter` |
| `order` is unique inside its `chapter` | `duplicate order` (warning) |
| `ship: true` implies `owner`, `chapter`, `order` and `code` are present | `shipped page missing <field>` |
| `code` globs are unique across pages | `ambiguous ownership: <glob> claimed by X and Y` |
| every `code` glob matches at least one file | `glob matches nothing` |
| `help_ids` are unique | `duplicate help id` |
| the page's path starts with its area's `path` | `area mismatch` |
| `category` exists | `unknown category` |
| `version` is a key of `versions.json` | `unknown version` |
| `aliases` do not collide with a live page id | `alias shadows a live page` |
| `deprecated: true` implies a replacement page id, or an explicit `superseded_by: null` | `deprecated without a replacement` (warning) |
| a waiver's expiry is in the future | `expired waiver` |

## Generated artefacts

### `docs/help/index.json`

The package emitter, the site's build and the AI layer all read this; nothing parses Markdown twice.

```json
{
  "generated": "2026-10-10",
  "commit": "a1b2c3d",
  "version": "v26.0930",
  "pages": [
    {
      "id": "t3000/features/trendlogs",
      "url": "/t3000/latest/features/trendlogs",
      "title": "Trend Logs",
      "area": "t3000",
      "chapter": "features",
      "order": 40,
      "category": "products",
      "product": "t3000",
      "audience": "user",
      "tags": ["trend", "history", "chart"],
      "keywords": ["trend log"],
      "owner": "trendlog",
      "version": "v26.0930",
      "git": { "sha": "a1b2c3d", "author": "…", "date": "2026-10-09T11:02:00Z" },
      "reviewed": { "sha": "a1b2c3d", "date": "2026-10-09", "by": "docs" },
      "stale": false,
      "headings": ["Overview", "Setup", "Fields"],
      "code": ["src/t3-react/features/trendlog/**"]
    }
  ]
}
```

`headings` and `git` are filled by the generator: headings by parsing the page, git from `git log -1 --format=… -- <path>`.

### `docs/help/page-meta.json`

Only what the site's `main.js` needs per page, which keeps the client payload small:

```json
{ "t3000/features/trendlogs": { "updated": "2026-10-09", "sha": "a1b2c3d", "owner": "trendlog", "stale": false, "v": "v26.0930" } }
```

### `docs/help/docs-meta.json`

The facets, fetched by the search interface alone:

```json
{ "pages": { "t3000/features/trendlogs": { "category": "products", "product": "t3000", "version": "v26.0930", "tags": ["trend","history"] } } }
```

It is loaded lazily on the first search interaction, so it costs nothing on a normal page view. `index.json` remains the full index for tooling; `docs-meta.json` is the only file the browser needs in order to filter.

### `docs/help/versions.json`

```json
{ "current": "v26.0930", "items": [ { "version": "v26.0930", "url": "https://<host>/t3000/latest/", "current": true },
                                     { "version": "v26.0610", "url": "https://<host>/t3000/v26.0610/", "current": false } ] }
```

### The files the engine reads

`docfx.json`, `docs/toc.yml`, `docs/t3000/toc.yml`, `docs/legacy/toc.yml` and `docs/temco-learn/design/toc.yml` — their exact shape and the parity assertion are in [03](03-site-project.md).

## Staleness

One rule, computed when the metadata is generated and stored in `index.json`:

```
stale  ⇔  a commit touching a path matching page.code exists, with a date later than page.reviewed.date
```

- the page report also carries days since `reviewed.date`, banded at 90, 180 and 365 days;
- the weekly report ([11](11-review-and-cicd.md)) groups stale pages by `owner`;
- the page shows a chip, sourced from `page-meta.json` — never written into the Markdown.

## What the build must satisfy

1. `docs/help/registry.schema.json` exists, and `scripts/docs-registry.mjs` supports `--check` and `--dry-run`.
2. The `pages` map is seeded from the file tree in one pass, with an `exclude` entry and a reason for everything else; the current help file's chapter structure becomes the initial `chapter` and `order` values, so the shipped help file does not change on day one.
3. Every shipped page carries `owner`, `reviewer`, `category`, `product`, `keywords` and `help_ids`.
4. `index.json`, `page-meta.json`, `versions.json` and the staleness pass are emitted by the generator.
5. The five engine-facing files are emitted together with the parity assertion.
6. The help-file build reads the generated manifests, and the hand-written ones are removed from the build path.
7. The site's navigation comes from the package's `nav.json`, generated from the registry.

`npm run docs:registry --check` is clean; every shipped page has an owner; the help file built from the generated manifests is page-for-page identical to the previous one; `index.json` lists `headings` for every page; and a page whose `code` glob was changed reports `stale: true`.
