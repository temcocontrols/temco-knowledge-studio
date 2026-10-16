# 04 — The look of the rendered copies

The site's own look is **Fluent UI v9**, and it belongs to the site: its components, its theme and its layout are designed in [`../README.md`](../README.md). This document covers what the engine's template layer still owns — the look of the **rendered copies**, which are the version's offline download and the source of the PDF — and it says plainly which parts the site renders for itself.

Keeping the layer thin is the point: the site's chrome is not built out of an engine template, and every file added here is a file to re-check on the next engine upgrade ([02](02-docfx-engine.md), *Version policy*).

---

## The stack

```
"template": ["default", "modern", "templates/t3000"]
                        └── the last entry wins, file by file
```

| Layer | Provides |
|---|---|
| `default` | the base rendering machinery |
| `modern` | the navigation bar, the left navigation column, the article column, the right rail, breadcrumbs, previous and next, dark mode, a search box and "Edit this page" |
| `templates/t3000` | the project's own: brand colours, typography, print styles, the logo and favicon, self-hosted fonts |

```
docs/templates/t3000/
├─ public/
│  ├─ main.css        brand colours, typography, spacing, print styles
│  ├─ main.js         the template entry module: options and the small runtime affordances
│  ├─ logo.svg        referenced by _appLogoPath
│  ├─ favicon.ico
│  └─ fonts/…         self-hosted font files — no CDN, by the offline rule
└─ partials/…         markup overrides for the rendered copies only; the goal is to keep this empty
```

A template layer is a folder whose `public/` is merged into the rendered output and whose `public/main.js` is the entry module; `main.css` and `main.js` are the supported extension points. Markup overrides are the escape hatch, not the plan: `docfx template export modern` gives the reference to diff against, and every overridden file is recorded in `tools/patches/TEMPLATE-OVERRIDES.md` so an upgrade knows what to re-check.

## What the rendered copy is for

Two readers exist, and the same information is rendered for each of them:

| The reader sees | On the site | In the rendered copy |
|---|---|---|
| the product's navigation | `NavTree`, built from the package's `nav.json` | the table-of-contents tree |
| the article | the site's article layout, in Fluent UI | the engine's article column |
| "On this page" | `OnThisPage`, from the page's headings | the right rail |
| the product and version | a sticky header with `ProductCard` and `VersionSwitcher` | the header, from `_appName` and the metadata |
| search | the site's own index and results page ([06](06-search.md)) | no search of its own in the offline copy — the index travels inside the package |
| downloads | `DownloadCard` rows from the manifest's `downloads` | a link to the version's page on the site, where one exists |
| "Was this helpful?" | the site's feedback component ([09](09-feedback-subscriptions-notifications.md)) | nothing; a printed page has no form |
| when it changed, and who owns it | the page's provenance line | the same line, from the same metadata |
| print | the site's print stylesheet | `@media print` rules in `main.css`, which is what the PDF renders |

The rendered copy carries no interactive chrome of value, which is why nothing was built to keep the two visually identical: the offline copy must read well on a laptop and the PDF must print well, and the site is free to look like itself.

## The entry module

The `modern` template loads `public/main.js` as an ES module whose default export is an options object. The typings for the pinned version come from the engine itself — `templates/modern/src/options.d.ts` in a source checkout, or the exported template for a pinned release — and it ships a worked example at `samples/seed/template/public/main.js`.

```js
export default {
  defaultTheme: 'light',                 // 'light' | 'dark' | 'auto'
  iconLinks: [
    { icon: 'github', href: 'https://github.com/temcocontrols/T3000Webview', title: 'Repository' }
  ],
  configureHljs: (hljs) => {
    // the corpus uses text, json, yaml, powershell, rust, cpp and ts
  },
  start: () => {
    mountCopyButtons();       // per code block, for a reader copying a command out of the offline copy
    mountPrintAffordances();  // "print this page" in the footer
  }
};
```

The options set is small on purpose. The page-meta bar, the version switcher, the feedback form and the "recently updated" list are the site's components, and the offline copy does not need them.

**Check option names against the pinned version** — the field set has changed across releases, and the documentation shows both `_enableNewTab` and `_disableNewTab` depending on version. `options.d.ts` for the pinned version is authoritative.

## Which knob does what

Everything here shapes the rendered copies. Global defaults live in `docfx.json` under `globalMetadata`, per-area deviations in `fileMetadata`, and nothing at all in the pages.

| Zone | Provided by | Configuration |
|---|---|---|
| top navigation | the root `toc.yml` | generated ([03](03-site-project.md)) |
| breadcrumb | table-of-contents ancestry | `_disableBreadcrumb: false` |
| left navigation tree | the area's `toc.yml` | generated; `expanded: true` on the first two levels |
| article column | the page | — |
| right rail, "In this article" | the heading tree | on for the product's pages; `_disableAffix: true` for `legacy/**`, whose pages are long engineering notes |
| table-of-contents filter box | the `modern` template | `_disableTocFilter: false` |
| previous and next article | table-of-contents order | `_disableNextArticle: false` |
| "Edit this page" and "View source" | `_gitContribute` and `_gitUrlPattern: github` | on for the product's pages; off (`_disableContribution: true`) for `legacy/**` and the design package |
| footer | `_appFooter` | the brand line |
| the engine's own search box | off (`_enableSearch: false`) | the index belongs to the site, and the offline copy's search is the site's, shipped inside the package |
| dark mode | the `modern` template | `defaultTheme: 'light'`, user-toggleable |
| a landing layout | `_layout: landing` for `index.md` via `fileMetadata` | below |
| the `chromeless` layout | the `modern` template | available for a popup or an embedded page |

`_layout` is a page-level metadata key in general, but it is never written into a page: the landing layout comes from a `fileMetadata` rule for `index.md`, the only page that needs it.

## The landing page

`docs/index.md` is the only hand-written page in the engine's project, and it is built from generated blocks so that it cannot go stale. It is the landing page of the rendered copy and of the package; the site's home page is the product catalogue, built from `products.json`.

```markdown
<!-- BEGIN GENERATED: hero -->
# T3000 documentation
Everything for T3000: hardware, protocols, the Design Studio, the API and the troubleshooting guides.
<!-- END GENERATED: hero -->

<!-- BEGIN GENERATED: cards -->
| | |
|---|---|
| **Quick start** | Install, connect, first screen — [start here](t3000/quick-start/overview.md) |
| **Design Studio** | Build and deploy Tstat11 screens — [manual](t3000/t3-eez-studio/README.md) |
| **Protocols** | BACnet, Modbus, MQTT — [building platform](t3000/building-platform/overview.md) |
| **API reference** | REST, control messages, data points — [api](t3000/api-reference/overview.md) |
| **Troubleshooting** | Known issues and field cases — [guides](t3000/guides/troubleshooting.md) |
| **What's new** | Release notes and changelog — [releases](t3000/releases/beta-webui-announcement.md) |
<!-- END GENERATED: cards -->
```

- the hero and the cards are **curated by a person** — the docs owner decides what is featured — and the generator rewrites only the *links* inside them, so a renamed chapter cannot leave a dead card;
- the same blocks travel into the package, so the offline copy opens on the same page;
- a fully generated landing page reads like a sitemap and is worse than a short curated one.

## Styling

- brand values are CSS custom properties at the top of `main.css`. The `modern` template is Bootstrap-based, so the supported way to retheme the rendered copies is its own variables: `--bs-link-color-rgb`, `--bs-body-font-size` and the rest;
- only overrides live in `public/main.css` — never a forked copy of a template stylesheet;
- **no remote assets**: no Google Fonts, no CDN. Fonts are self-hosted under `public/fonts/`, and the `remote-asset` audit rule covers the rendered output as well as the sources ([11](11-review-and-cicd.md));
- print styles are part of the design from the start, because the PDF renders the same HTML ([07](07-offline-pdf-chm.md)): `@media print` rules for code blocks, tables and the cover page;
- accessibility: heading order comes from the pages — the audit gate enforces a single `h1` — landmark regions come from the template, and the brand palette is checked for contrast. The site's own accessibility comes from Fluent UI and its own components.

## The development loop

```powershell
npm run docs:site          # render once
npm run docs:serve         # docfx build --serve → http://localhost:8080
```

- editing a page rebuilds the served copy while the browser keeps its position;
- `main.css` and `main.js` are static assets, so a reload is enough. A markup change means editing a partial: run `docfx template export modern` and diff first;
- when something renders empty, build with `--exportRawModel` or `--debug` to dump the model the template received and read the JSON instead of guessing;
- the site's own development is the site's own loop: `npm run dev` in its repository, over the packages in `content/`.

## What the build must satisfy

1. `docs/templates/t3000/public/` exists with `main.css`, `main.js`, the logo, the favicon and the self-hosted fonts.
2. The brand variables and the print stylesheet are in place, with contrast verified, and the palette matches the site's Fluent theme.
3. `docs/index.md` holds the hero and card blocks, and a `fileMetadata` rule gives it the landing layout.
4. The rendered copies carry the provenance line (owner, updated date, review state) from the generated metadata.
5. `scripts/audit-docs.mjs` checks the rendered output for remote assets, a missing favicon and a missing landing page.
6. The override list exists at `tools/patches/TEMPLATE-OVERRIDES.md` — empty, which is the goal.
