# 07 — The offline copy, the PDF and the help file

The site is the reading surface. These are the copies that travel, all generated from the same sources and all published as a version's downloads:

| Artefact | Produced by | Read where |
|---|---|---|
| the offline copy, `T3000-Docs-<version>.zip` | the rendered copy, with relative URLs, zipped | a laptop with no network |
| the PDF manual, `T3000-Learn.pdf` | the engine, `docfx pdf` | printing, archival, translation |
| the help file, `T3000_Help.chm` | `npm run build:help` → `hhc.exe` | **F1 inside the product** — the channel that ships with every installer |

None of them replaces the site, and nothing here is edited by hand after it is built.

---

## The offline copy

The engine's rendered copy is almost offline-ready: what breaks when the folder is opened from the file system is a root-relative URL, and any remote reference. `scripts/docs-offline.mjs`, run by `npm run docs:offline`, does the rest:

```
1. the rendered copy is already there                →  dist/docs/
2. audit **/*.{html,css,js} for remote URLs          →  fail on any http(s) fetch
                                                        (external <a href> links are allowed)
3. rewrite root-relative hrefs and srcs to relative  →  so file:// navigation works
4. copy the package's search index in                →  search with no server ([06](06-search.md))
5. verify search from file:// in a real browser      →  the verdict is recorded in the release checklist
6. write OFFLINE-README.txt (version, commit, date, how to open)
7. zip → dist/T3000-Docs-<version>.zip               →  published as a download
```

| Detail | Why |
|---|---|
| search works offline, **after verification rather than by assumption** | the index travels inside the copy; where `file://` cannot fetch it, the copy falls back to a static page list, and the checklist records which path was used |
| images are already local | the remote-asset rule guarantees it, so only the URL form changes |
| the archive is flat, with `index.html` at its root | "extract and open `index.html`" is the whole instruction |
| the copy is versioned by the registry's own `version` | it cannot be published untagged |
| size budget: warn above 150 MB | images dominate; if it is exceeded, screenshots are pruned by `audience` |

## The PDF manual

PDF support needs the engine at 2.73 or newer together with the `modern` template — both satisfied by the pin. `npm run docs:pdf` runs:

```
1. docfx build docs/docfx.json    # the rendered copy
2. docfx pdf   docs/docfx.json    # renders one PDF per table of contents with pdf: true
```

A dedicated PDF table of contents produces exactly one manual rather than a file per chapter:

```yaml
# docs/toc.pdf.yml
order: 200                 # a larger order keeps this file out of the navigation
pdf: true
pdfFileName: T3000-Learn.pdf
pdfTocPage: true           # insert a "Table of Contents" page, with clickable page numbers
pdfCoverPage: cover.html   # built from docs/cover.md
items:
- name: Getting Started
  href: t3000/quick-start/toc.yml
- name: Device Management
  href: t3000/device-management/toc.yml
- name: Data Points
  href: t3000/data-points/toc.yml
- name: Features
  href: t3000/features/toc.yml
- name: Building Platform
  href: t3000/building-platform/toc.yml
- name: Design Studio
  href: t3000/t3-eez-studio/toc.yml
- name: API Reference
  href: t3000/api-reference/toc.yml
- name: Troubleshooting
  href: t3000/guides/toc.yml
```

Every key that shapes the PDF belongs in a table of contents or in `docfx.json`, never in a page:

| Key | Value here | Effect |
|---|---|---|
| `pdf` | `true` globally; `false` for `legacy/**` and the design package through `fileMetadata` | include or exclude an area |
| `pdfFileName` | `T3000-Learn.pdf` | the output name, `toc.pdf` by default |
| `pdfTocPage` | `true` | table-of-contents pages carrying page numbers |
| `pdfCoverPage` | `cover.html` | a full-bleed cover, from the built `docs/cover.md` |
| `pdfPrintBackground` | `true` | keeps background graphics — the cover and callouts |
| `pdfHeaderTemplate` | custom HTML | a running header, for example the section name and T3000 |
| `pdfFooterTemplate` | custom HTML | `<span class='pageNumber'></span> / <span class='totalPages'></span>` |
| `pdfHeaderFooterOnCover` | `false` | a clean cover |
| `pdfHeaderFooterOnToc` | `true` | numbered table-of-contents pages |

Precedence is `fileMetadata` over `toc.yml` over `globalMetadata`, and values are selected per key rather than deep-merged — so an engineering area is excluded with `fileMetadata.pdf: false`, not by subtracting it inside the PDF table of contents.

Cover and print styling lives in the template layer ([04](04-template.md)):

```css
@page { margin: 12mm }
@media print {
  pre, table { break-inside: avoid }
  a[href^="http"]::after { content: " (" attr(href) ")"; font-size: .85em }  /* printable links */
}
/* full-bleed cover */
.cover { @page { margin: 0 } print-color-adjust: exact }
/* the table-of-contents page: .pdftoc h1 / ul / li / .page-number / .spacer */
```

Once per release, a person checks: the cover is present, the table-of-contents page numbers are right, the headers and footers appear on article pages only, no code block is clipped, no page shows a stray "Loading…" placeholder, the file opens in two different readers, and the outline is present.

## The help file

```
docs/help/manual.json  →  .hhp / .hhc / .hhk  →  hhc.exe  →  T3000_Help.chm  →  copied beside T3000.exe
```

The pipeline is unchanged, and the design adds guarantees around it:

| Addition | Why |
|---|---|
| the manifests are **generated from the registry** | one structure drives the help file, the site and the rendered copy |
| a parity assertion: the navigation page set equals the manifest page set | a page can never exist in one and not the others ([03](03-site-project.md)) |
| keywords from `registry.keywords` into the `.hhk` | the index is curated rather than scraped |
| `help_ids` from the registry into `[ALIAS]` and `[MAP]` | F1 context-sensitive help, generated rather than hand-maintained ([13](13-implementation-plan.md)) |
| the build is a documented script with a dry run | reproducible locally and in CI |
| a verification checklist | an opened help file, F1 from a known topic, search, no missing images |

The compiler's exit code is unreliable, so each build is judged by its output:

```
1. T3000_Help.chm exists and is larger than 20 MB
2. it opens in the help viewer and the contents tree expands two levels
3. the top-level books equal the chapters in manual.json
4. a search for "trendlog" and for "BACnet" returns hits
5. the Index tab lists the curated keywords
6. F1 from the main dialog opens the expected topic
7. no "page cannot be displayed" placeholder: five pages with images are spot-checked
```

## Where each artefact is published

| Artefact | Destination |
|---|---|
| the offline copy | the package's `downloads/`, and the version's Downloads page on the site |
| the PDF | the package's `downloads/`, and the same page |
| the help file | the installer, beside the product executable — and, for anyone reading the site, the package's `downloads/` |
| the rendered copy itself | not published: it is the base the other three are made from |

The product's own build and deploy are unchanged, and they no longer carry the documentation: the help file is the only documentation artefact that ships inside a product installation. The product's Documentation page links to the site; on a machine with no network it opens the help file.

## Cross-output parity

This is the point of the whole arrangement: one source, and the outputs cannot drift apart unnoticed.

| Check | Tool | A failure means |
|---|---|---|
| the navigation, the help file's manifests and `nav.json` name one page set | `docs:registry --check`, `docs:package --check` | the structure was edited in one place only |
| every page renders in every output | the build, comparing page counts | a glob or an exclusion is wrong |
| no remote assets in the rendered output or the help file's sources | `docs:blocking` | offline reading would break |
| zero broken links in the rendered copy | the warning count against the baseline | a hand-written link has rotted |
| media is neither missing nor oversized; unused media is reported | `docs:media --check` | image rot, the most common decay |
| the PDF has pages and covers every user chapter | `docs:pdf` plus a manual check | the PDF table of contents drifted from the navigation |
| search works from `file://` in the offline copy | manual, recorded per release | readers open the zip, not a server |

## The two build chains

```
the product build (one pass — the documentation rides along)
  ├─ 1  the application and its installer
  ├─ 2  docs:registry   → docs/docfx.json, docs/toc.yml, docs/help/*.json
  ├─ 3  docs:site       → dist/docs/                        the rendered copy
  ├─ 4  docs:package    → manifest · nav · pages · assets · search index   the content package
  ├─ 5  docs:pdf        → T3000-Learn.pdf
  ├─ 6  docs:offline    → T3000-Docs-<version>.zip
  ├─ 7  build:help      → T3000_Help.chm                    (needs hhc.exe on the build host)
  └─ 8  publish         → the package into the site's content/, the help file beside T3000.exe

the site build (its own repository, its own pipeline)
  ├─ 1  validate-content   → every package parses, every path resolves, every product has a latest
  ├─ 2  build-search-index → the index for the published packages
  └─ 3  next build         → the site
```

Rules and traps:

1. the help file must be copied beside the executable by the installer, and every mechanism that mirrors the product's files must carry it;
2. the site's build never re-renders documentation: it reads packages, and a documentation change therefore publishes without redeploying the site's code;
3. a product may use another engine, in which case steps 3 to 6 belong to that engine as long as the package contract holds ([02](02-docfx-engine.md));
4. the documentation-only commands are `docs:site`, `docs:serve` (:8080, development only — never deployed), `docs:package`, `docs:pdf` and `docs:offline`.

## What the build must satisfy

| # | Requirement |
|---|---|
| 1 | `scripts/docs-offline.mjs` audits, rewrites and zips the rendered copy, and `npm run docs:offline` runs it |
| 2 | `docs/cover.md` exists with the cover and print CSS in the template layer |
| 3 | `docs/toc.pdf.yml` exists with the `pdf*` metadata, and `npm run docs:pdf` builds the manual |
| 4 | the PDF, the offline copy and the help file are published in the package's `downloads/` and listed on the version's Downloads page |
| 5 | the help-file manifests, keywords and `help_ids` come from the registry, and the installer copies the help file beside the executable |
| 6 | the verification checklists above are items in the release checklist |
| 7 | the audit reports missing, unused, duplicate and oversized media |
| 8 | version snapshots are published with retention of the current version and the last three, sharing media |

Unzipping the offline copy on an air-gapped machine gives a browsable, searchable copy of one version; `T3000-Learn.pdf` has a cover, a numbered table of contents and no engineering area; `T3000_Help.chm` opens with the expected trees, and its F1 topics resolve for every topic in the map.
