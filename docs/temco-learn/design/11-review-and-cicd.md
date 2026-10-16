# 11 — Ownership, gates and continuous delivery

---

## Ownership

| Role | Responsibility | Recorded in |
|---|---|---|
| **docs owner** — one named person | the final word on prose, structure and the registry; triages feedback; owns the weekly report | `docs/help/registry.json` as the default `reviewer`, and in this folder |
| **page owner** | keeps the pages whose `code` globs they are responsible for true after the code changes | `registry.pages[].owner` |
| **reviewer** | approves a pull request touching those pages | `registry.pages[].reviewer` |

An unowned page is a bug: `ship: true` requires `owner` ([05](05-content-and-registry.md), *Validation rules*).

Who may publish, who may waive a gate, how an urgent fix is approved and how a page is retired are policy rather than tooling, and live in [14](14-governance.md).

## Staleness

```
stale      ⇔ a commit touching page.code landed after page.reviewed.date
review age ⇔ today − page.reviewed.date   →  90 days: notice
                                            180 days: warning
                                            365 days: escalate
```

Both are computed when the metadata is generated, into `index.json` and `page-meta.json`, and never written into a page.

The weekly job `docs-report.yml` writes `docs/help/reports/staleness-<date>.md`:

```markdown
# Documentation staleness — 2026-10-10
commit a1b2c3d · 216 pages · 47 stale · 12 escalated · health 86/100

## Escalated (> 365 days)
| page | owner | last reviewed | claimed code changed |
|---|---|---|---|
| t3000/features/trendlogs | trendlog | 2025-08-11 | api/src/t3_device/trendlog*.rs @ 2026-10-02 |

## Owed (code changed, page not updated)
## Negative feedback (last 30 days)
## Unhandled feedback (> 30 days)
## Media (missing 4 · unused 61 · oversized 9)
## Search (top zero-result queries → to-do list)
## Health 86/100  (staleness · broken links · unreviewed · feedback ratio)
```

The job commits the report, so a week with no report is itself visible, and posts it to the review channel. It is the agenda for the weekly documentation slot — the mechanism only works if somebody reads it.

## Gates

| Gate | Command | Blocking | What it proves |
|---|---|---|---|
| the registry is valid and fresh | `npm run docs:registry --check` | yes | the structure is declared once; no unregistered pages; globs match; the navigation and the help-file manifests agree |
| documentation lint | `npm run docs:blocking` | yes, for `docs/t3000/**` | links resolve, fences are balanced, one `h1` comes first, no remote assets, no TODO in prose |
| the site builds | `npm run docs:site` | yes | every page renders, broken-link warnings are zero, the total warning count is within the baseline |
| the package validates | `npm run docs:package --check` | yes | the manifest is complete, `nav.json` resolves every page, and the page count matches the registry |
| offline-safe | `npm run docs:offline -- --check` | yes | no remote URL anywhere in the rendered copy |
| docs owed | `npm run docs:owed -- --base <sha>` | yes, for a pull request touching a `code` glob | a claimed feature that changed has a documentation change, or an explicit waiver |
| media | `npm run docs:media -- --check` | yes, for `docs/t3000/**` | missing images and oversized files; unused and duplicate media reported |
| the help file builds | `npm run build:help:dry` | yes, before a release | the shipping file still compiles and matches the navigation |
| the PDF | `npm run docs:pdf` | at release time | the manual renders with a cover and a numbered table of contents |

A waiver for docs owed lives in the registry, per page, with an expiry and a reason:

```jsonc
"waivers": { "t3000/features/trendlogs": { "until": "2026-11-15", "reason": "behavior not shipping yet" } }
```

An expired waiver is itself a gate failure.

## Workflows, in `.github/workflows/docs.yml`

| Job | Trigger | Steps | Blocking |
|---|---|---|---|
| `lint` | any pull request touching `docs/**` or `scripts/**` | registry `--check`, `docs:blocking` | yes |
| `site` | the same | the engine pin check, `docs:site && docs:package`, upload the package as a pull-request artefact so a reviewer can click it | yes |
| `docs-owed` | any pull request touching a code path claimed in the registry | `docs:owed --base` | yes |
| `docs-sync` | a push to `main` | changelog and impact analysis, committing the generated files, and opening a "docs follow-up" pull request when pages are owed | no — advisory |
| `report` | weekly | the staleness report, committed | no |
| `publish` | a release tag | `docs:site`, `docs:package`, `docs:pdf`, `docs:offline`, `build:help`, then publish the package and refresh the version list | yes |

Publishing is a package operation: a validated package is copied into the site's `content/<product>/<version>/`, the site's index is rebuilt, and the version appears. Nothing is re-rendered, so a publish never changes a page.

**Rollback** is a folder swap: the previous package folder stays where it is, and a bad publish is repaired by restoring it and rebuilding the index, with no re-render — which is the reason a version is a folder.

## Branch protection and the pull-request ritual

`main` requires the `lint`, `site` and `docs-owed` checks green, one approval, and the owner of every touched page among the reviewers — or an explicit waiver in the pull-request body.

```markdown
## Docs impact
- [ ] Pages updated: …
- [ ] Registry updated (chapter/order/title/owner/code/tags): …
- [ ] `npm run docs:blocking` passes
- [ ] `npm run docs:serve` spot-checked the changed pages
- [ ] `npm run help:preview` spot-checked the changed pages, if they ship
- [ ] New or changed images are local and at least 1600 px wide
- [ ] No page metadata was added
```

## What the build must satisfy

| # | Requirement |
|---|---|
| 1 | the docs owner is named, and recorded in the registry and in this folder |
| 2 | `scripts/docs-registry.mjs --check` and `scripts/docs-owed.mjs` exist |
| 3 | `docs.yml` runs `lint` and `site`, and uploads the built site as a pull-request artefact |
| 4 | the warning baseline is recorded, and the build fails when it grows |
| 5 | the offline check over the rendered copy is part of `docs:blocking`, and `docs:package --check` validates the package |
| 6 | the staleness report job runs weekly, and the review slot exists |
| 7 | the advisory `docs-sync` job runs on every push to `main` |
| 8 | the per-tag publish writes the version folder, updates `versions.json`, and the rollback drill has been performed |
| 9 | the release checklist covers the help file, the PDF, the package, the attachments and the verification steps |

A pull request that renames a registry chapter fails `lint` with the parity message; a pull request that changes a file matching a page's `code` glob without touching a page fails `docs-owed` unless it is waived; the weekly report lands in the repository on schedule; a release publishes a version folder, updates `versions.json` and attaches all three artefacts; and restoring the previous folder plus regenerating `versions.json` rolls it back.
