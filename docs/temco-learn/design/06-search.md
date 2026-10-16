# 06 — Search

The index belongs to the site. It is built over the published packages, served through the site's own search route, and filtered with facets taken from each package's manifest. Two other indexes exist and stay where they are: the help file's own, compiled inside it, and whatever search data the engine writes for its rendered copy, which nothing reads at runtime.

---

## What the index holds

One record per page, per package — so the same page exists once for every version that published it, which is what lets a reader search inside the version they are running.

| Field | Comes from |
|---|---|
| `id` | the registry page id (`t3000/features/trendlogs`) |
| `product`, `version` | the package's `manifest.json` |
| `path`, `url` | the page's path in `pages/`, and its site URL `/{product}/{version}/{path}` |
| `title`, `section` | the manifest's page list, which comes from the registry |
| `headings` | parsed from the page, so a result can deep-link into a section |
| `body` | the page text, for full-text matching |
| `noindex` | the section flag, for the areas that must not appear ([05](05-content-and-registry.md)) |

The engine's own `uids` and `xrefmap.yml` are not used: cross-page links are relative `.md` links the build already validates, and a synthetic id would be a second identity for every page.

## Where the index is built

```
temco-learn/
├─ scripts/build-search-index.mjs   reads content/<product>/<version>/ and writes the index
├─ lib/search/                      the query: matching, ranking, facets, snippets
└─ app/api/search/route.ts          the endpoint the interface calls
```

The build reads each package and writes one index for the site. **A package may carry `search-index.json` instead**, and the site prefers it when it is present — that is exactly what makes the offline copy searchable with no server, and it means a product may ship a better index than the generic one.

`noindex` sections are left out of the index, so the design package and the internal notes never surface in a reader's results.

## How it is used

| Surface | Behaviour |
|---|---|
| the header's search box | a type-ahead over the index, scoped to the product and version the reader is in |
| `/search` | a full results page with filters for product, version and section, and the filters in the URL so a search is linkable |
| a result | the title, the section, the product and version, and a snippet with the matched terms |
| a deep link | choosing a heading inside a result lands on that section of the page |
| the assistant | reads the same index for its candidates, then the pages themselves ([12](12-ai-features.md)) |

Ranking is tuned once against a fixed set of **twenty real support questions**, and the same twenty questions are the review set for the assistant. The baseline is recorded in the repository so a change in ranking can be measured rather than argued about.

## Facets

Facets are the manifest's own fields — product, version and section — so no page changes to appear in a filter, and adding a product adds its facet by existing. The interface fetches the facet values with the search results; there is nothing extra to generate and no second metadata file to keep in step.

## What searches tell the content owners

Every search that returns nothing is one of exactly three things: a synonym problem, answered by adding the term to the page's `keywords`; a missing page; or a badly titled page. The site reports zero-result queries to the feedback endpoint ([09](09-feedback-subscriptions-notifications.md)), and the weekly review classifies and closes them. That loop is the cheapest improvement available to this corpus, and it only works because the signal is collected.

| Signal | Where it lands |
|---|---|
| zero-result queries | the content queue, owned by the docs owner |
| most-searched terms | the same queue, as a hint about what to write next |
| which result was chosen | a quality signal for ranking |
| page views | which areas matter, and where polish pays off |

Collection is first-party: same-origin beacons, no cookies, no identifiers and no third-party script — the site makes no remote request for anything, including analytics.

## The offline copy

The offline copy opens from the file system, where a runtime-fetched index can be blocked. It ships the index inside itself and is opened from a real local browser during the release check; when the index cannot be fetched in that environment, the copy's search falls back to a static page list. Either way a field laptop gets search with no network, and the checklist records which path was used ([07](07-offline-pdf-chm.md)).

The help file is independent: its own index is compiled by `hhc.exe` and never competes with the site's.

## What the build must satisfy

| # | Requirement |
|---|---|
| 1 | `scripts/build-search-index.mjs` indexes every published package, with the fields in the table above |
| 2 | a package that carries `search-index.json` is used as it is, and the site's build does not overwrite it |
| 3 | `noindex` sections are absent from the index |
| 4 | the header's type-ahead and `/search` both query the index, and the filters are linkable |
| 5 | the twenty-question baseline is recorded, and the same set reviews the assistant |
| 6 | zero-result queries and chosen results are reported to the feedback endpoint |
| 7 | the offline copy is verified from `file://`, and the fallback is decided by that measurement |

Searching "trendlog" and "static pressure" on the site returns the expected pages; the design package never appears; the facet filters narrow correctly and survive a page reload because they are in the URL; the offline copy searches with no network; and the help file's own search is unchanged.
