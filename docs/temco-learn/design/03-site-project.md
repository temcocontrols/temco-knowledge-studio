# 03 — The engine's project: `docfx.json`, `toc.yml`, and the package

The engine's project is two generated files plus the mapping that turns its output into a content package:

```
docs/
├─ docfx.json          generated from docs/help/registry.json   (never hand-edited)
├─ toc.yml             generated — the top of the navigation model
├─ index.md            hand-written — the landing page of the rendered copy and of the package
├─ t3000/toc.yml       generated — the left navigation for an area
├─ legacy/toc.yml      generated
├─ temco-learn/design/toc.yml  generated
└─ templates/t3000/    hand-written template layer (04-template.md)
```

`docfx.json` sits in `docs/` because every relative path in the engine is resolved against the folder that holds it: that makes `t3000/quick-start/overview.md` the natural spelling and keeps `~/` links inside the corpus.

---

## `docs/docfx.json`

Written by `scripts/docs-registry.mjs` (`npm run docs:registry`) and verified with `--check` in CI. The comments below are for this document only; the generated file has none.

```jsonc
{
  "build": {
    "content": [
      { "files": ["**/*.md"], "src": "t3000",              "dest": "t3000" },
      { "files": ["**/*.md"], "src": "legacy",             "dest": "legacy" },
      { "files": ["**/*.md"], "src": "temco-learn/design", "dest": "design" },
      { "files": ["index.md"] }
    ],
    "resource": [
      { "files": ["**/*.{png,jpg,jpeg,gif,svg,webp,ico}", "**/*.pdf", "**/*.zip"] }
    ],
    "dest": "../dist/docs",          // the rendered copy; docs:package places it under <product>/<version>/
    "template": ["default", "modern", "templates/t3000"],
    "globalMetadata": {
      "_appName": "T3000",
      "_appTitle": "T3000 Documentation",
      "_appFooter": "Temco Controls · T3000 documentation",
      "_appLogoPath": "logo.svg",
      "_appFaviconPath": "favicon.ico",
      "_enableSearch": "true",
      "_disableContribution": "false",
      "_gitContribute": { "repo": "https://github.com/temcocontrols/T3000Webview", "branch": "feature/lvgl-svg-renderer" },
      "_gitUrlPattern": "github",
      "_lang": "en"
    },
    "fileMetadata": {
      "_noindex": {
        "legacy/**": false,
        "design/**": true
      },
      "pdf": {
        "legacy/**": false,
        "design/**": false
      }
    },
    "markdownEngineProperties": {
      "markdigExtensions": ["FootNotes", "TaskLists", "Tables", "AutoIdentifiers"]
    },
    "rules": { "InvalidHref": "warning" },
    "sitemap": { "baseUrl": "https://<docs-host>/docs", "changefreq": "weekly", "priority": 0.5 },
    "disableGitFeatures": false,
    "xref": []
  }
}
```

| Setting | Why this value |
|---|---|
| `content` per source, each with an explicit `src` and `dest` | the URL is `dest` plus the path, so where content physically lives never appears in a URL |
| `temco-learn/design` mapped to `dest: "design"` | the design package is published as the **Contributing** area while keeping its own folder name on disk |
| `resource` globs include pdf and zip | the offline package and the PDF are downloadable from the site itself |
| `template` order | `default` (base) → `modern` (the Learn-style layout) → `templates/t3000` (the project's; the last entry wins per file) |
| `globalMetadata._gitContribute` | powers the "Edit this page" and "View source" links with no per-page metadata |
| `fileMetadata.pdf` | keeps the engineering areas out of the PDF ([07](07-offline-pdf-chm.md)) |
| `_noindex` on the design area | the design package is published, but never returned in a user's search results |
| `rules.InvalidHref: warning` | a broken link has to be visible; blocking is done by the repository's gate with a baseline ([11](11-review-and-cicd.md)) |
| `disableGitFeatures: false` | "Edit this page" and last-modified need git; `true` is the answer only when a huge repository makes the build slow |
| no `metadata` section | `docfx metadata` is .NET-only; the API pages here are authored Markdown |
| no page `uid`s | no per-page front matter; cross-page links are relative `.md` links, which the engine validates |

| Feature | Why it is not used |
|---|---|
| YAML front matter in shipped pages | no page metadata; everything is expressed by `globalMetadata`, `fileMetadata` and `toc.yml` |
| `uid` and `xref:` in shipped pages | these would require a `uid` on every page |
| `docfx metadata` | the products are C++, Rust and TypeScript; the API pages are written in Markdown |
| remote `xref` maps | they need the network, which the offline rule forbids |

## One build root, many sources

The project is a build root: content is mapped in from one or more sources and the URL comes from `dest`, so a second product costs three configuration lines rather than a second site.

```jsonc
"content": [
  { "files": ["**/*.md"], "src": "../docs/t3000",  "dest": "t3000"  },
  { "files": ["**/*.md"], "src": "../docs/legacy", "dest": "legacy" },
  { "files": ["**/*.md"], "src": "../docs/design", "dest": "design" },
  // when another product's documentation arrives — any path on disk, including a repository CI checks out:
  { "files": ["**/*.md"], "src": "../../productX/docs", "dest": "productx" }
]
```

`src` may point outside the folder that holds `docfx.json`, which is what makes a hub possible; `dest` sets the URL prefix. A second product is three lines here, one node in `docs/toc.yml` and one area in the registry.

Three rules keep that door open:

1. **always set `dest` per source** — a URL never depends on where content happens to sit today;
2. **map `_gitContribute` per source glob** in `fileMetadata` once there is more than one repository, or "Edit this page" points at the wrong one ([08](08-editing-and-git.md));
3. **one template, one package per build** — a product that genuinely needs its own branding or audience gets its own `docfx.json` and its own package, and the site still puts the results side by side.

Lifting the hub into its own repository later (when several teams publish independently) moves the project files, the template, the registry and the scripts; the `src` paths become checked-out repositories and nothing else changes.

## How the output becomes a package

The engine renders a copy of the corpus; the product's build turns that copy into the **content package** the site reads. `scripts/docs-package.mjs` runs after `docs:site` and writes the contract's files from the same registry read:

| Part of the package | Comes from |
|---|---|
| `manifest.json` | the registry — product, version, language, the page list, the downloads, the source commit |
| `nav.json` | the same tree the `toc.yml` files spell for the engine |
| `pages/` | the Markdown sources, mapped by `src` and `dest` |
| `assets/` | the images and files the resource globs select |
| `downloads/` | the PDF, the help file and the offline copy, once they exist |
| `search-index.json` | built from the page list and the page text, or a hook for an index the site builds |

**Where a page lands is a mapping rule, never a file move.** The product's own area lands at the package root; the other areas keep their prefix:

| Source file | In the package | The site's URL |
|---|---|---|
| `docs/t3000/quick-start/overview.md` | `pages/quick-start/overview.md` | `/t3000/13.0/quick-start/overview` |
| `docs/legacy/implementations/…/X.md` | `pages/legacy/implementations/…/X.md` | `/t3000/13.0/legacy/implementations/…/X` |
| `docs/temco-learn/design/01-platform.md` | `pages/design/01-platform.md` | `/t3000/13.0/design/01-platform`, `noindex` |
| `docs/t3000/media/run.png` | `assets/run.png` | served in place |
| `docs/index.md` | `pages/index.md` | the package's landing page |

Page ids stay the registry ids, so nothing in the registry has to change to satisfy the package.

## Where it is published

- **the package goes to the site**, at `temco-learn/content/<product>/<version>/`, committed by the publishing pipeline — the manifest exists so that moving the packages to object storage later is a change in `sync-content.mjs` alone;
- **the rendered copy becomes the version's download**, zipped with relative URLs as the offline copy, together with the PDF ([07](07-offline-pdf-chm.md));
- **the help file ships beside the product executable** and is the F1 channel; it is not part of the package a reader browses;
- **authoring preview: the engine's own server on :8080** (`npm run docs:serve`), never a published surface.

The site's own deployment is the site's business: it is a Next.js application, and whether it runs on a Node host or is exported statically changes nothing here ([`../README.md`](../README.md)).

## The `toc.yml` files

Navigation is YAML. A node carries `name`, `href`, `items`, `uid` and `expanded`; a file may also carry `order` (which table of contents wins when several reference the same article) and `pdf:`.

### `docs/toc.yml` — the top navigation bar

The `toc.yml` beside `docfx.json` becomes the site's top navigation. It uses reference tables of contents (`href: folder/`) so each area keeps its own generated tree:

```yaml
# generated by scripts/docs-registry.mjs — do not edit
items:
- name: Home
  href: index.md
- name: T3000
  href: t3000/
- name: Design Studio
  href: t3000/t3-eez-studio/
- name: Protocols
  href: t3000/building-platform/
- name: API
  href: t3000/api-reference/
- name: Legacy / Engineering
  href: legacy/
- name: Contributing
  href: design/
- name: Release Notes
  href: t3000/releases/
```

### `docs/t3000/toc.yml` — the left navigation for an area

```yaml
# generated by scripts/docs-registry.mjs — do not edit
order: 0
items:
- name: Getting Started
  href: quick-start/toc.yml          # a nested table of contents; its children render inline
- name: Device Management
  href: device-management/toc.yml
- name: Data Points
  href: data-points/toc.yml
- name: Features
  href: features/toc.yml
- name: Building Platform
  href: building-platform/toc.yml
- name: API Reference
  href: api-reference/toc.yml
- name: Guides
  href: guides/toc.yml
- name: Release Notes
  href: releases/toc.yml
```

The generator follows these rules, all from `registry.json`:

| Rule | Source |
|---|---|
| node order | `chapter` order, then `order` inside the chapter |
| node name | `title` — never derived from a file name |
| leaves | `href: <path>.md` for every page with `ship: true` |
| a chapter holding one page | no intermediate folder node |
| areas | one root `toc.yml` per published area: `t3000`, `legacy`, `design` |
| unpublished pages | a page with `ship: false` appears in no table of contents; it exists only in the registry |
| `expanded` | `true` on the first two levels, so the tree arrives open and matches the application's page |

### `docs/toc.pdf.yml` — the table of contents the PDF alone reads

```yaml
order: 200            # keeps it out of the site navigation
pdf: true
pdfFileName: T3000-Learn.pdf
pdfCoverPage: cover.html
pdfTocPage: true
items:
- name: Getting Started
  href: t3000/quick-start/toc.yml
- name: Device Management
  href: t3000/device-management/toc.yml
# … the user-facing areas only; legacy/ and design/ are excluded
```

## Generation and parity

`scripts/docs-registry.mjs` writes all of these from one read of the registry:

```
docs/docfx.json                 docs/toc.yml
docs/t3000/toc.yml              docs/legacy/toc.yml        docs/temco-learn/design/toc.yml
docs/help/manual.json           docs/help/reference.json   docs/help/engineering.json   (the help-file manifests)
docs/help/index.json            docs/help/page-meta.json   docs/help/docs-meta.json
docs/help/versions.json
```

`scripts/docs-package.mjs` then writes the package from the same model plus the engine's output:

```
dist/docs/<product>/<version>/manifest.json      the contract the site reads
dist/docs/<product>/<version>/nav.json           the navigation model
dist/docs/<product>/<version>/pages/             the articles
dist/docs/<product>/<version>/assets/            images and files
dist/docs/<product>/<version>/downloads/         the PDF, the help file, the offline copy
dist/docs/<product>/<version>/search-index.json  the index, or the hook for one the site builds
```

Three assertions run in CI, through `npm run docs:registry --check` and `npm run docs:package --check`:

1. **freshness** — regenerating produces byte-identical files to the ones committed;
2. **parity** — the page set in the tables of contents, in the help-file manifests and in `nav.json` is one set. A page in one and not the others fails the build with every path printed, which is what stops the site, the rendered copy and the shipped help file from drifting apart;
3. **resolvability** — every path in `nav.json` and in the manifest's page list exists in the package, and the navigation reaches every page that does.

## What the build must satisfy

1. `scripts/lib/doc-toc.mjs` turns a table-of-contents tree into YAML, handling quoting, ordering and `expanded`.
2. `scripts/docs-registry.mjs` emits every file listed above, and supports `--check` and `--dry-run`.
3. The parity assertion runs as part of `npm run docs:blocking`.
4. `docs/index.md` exists as the landing page of the rendered copy and of the package.
5. `docs/toc.pdf.yml` exists together with the PDF artefact ([07](07-offline-pdf-chm.md)).
6. `scripts/docs-package.mjs` writes the package, and the mapping table above is recorded in the docs-owner runbook.

`npm run docs:registry --check` is clean; `npm run docs:site && npm run docs:package` produces a package whose `manifest.json` names the product, the version and the source commit, whose `nav.json` resolves every page, and whose page count equals the registry's ship count; every page with `ship: true` has a navigation entry; and deleting a page from the registry makes the parity check fail.
