# 13 — The implementation plan

Every task below is sized to be **one pull request** and carries its own acceptance test. The milestones are ordered by dependency, and nothing in a later milestone is required for an earlier one to be useful.

---

## Foundation

*The site exists, its structure is declared once, and the shipped help file is at full parity.*

| # | Task | Files | Acceptance |
|---|---|---|---|
| 1 | shared parser: `stripFences`, `headings`, `slugify`, `titleCase`, fence counting | `scripts/lib/doc-parse.mjs`, `scripts/audit-docs.mjs`, `scripts/build-t3000-help-chm.mjs` | `docs:blocking` and `build:help:dry` output unchanged |
| 2 | engine pin: the local tool manifest with the pinned release, the optional external checkout and `DOCFX_REPO`, `tools/docfx.pin`, the precheck | `.config/dotnet-tools.json`, `tools/docfx.pin`, `scripts/docs-engine.mjs` | `--version` matches the pin; the precheck fails on a missing or mismatched engine **and** on engine files appearing inside the repository ([02](02-docfx-engine.md)) |
| 3 | registry schema and generator, with `--check` and `--dry-run` | `docs/help/registry.schema.json`, `scripts/docs-registry.mjs` | a clean run on the seeded registry; every unregistered page is an error |
| 4 | seed the registry from the file tree and the current help-file manifest, with `exclude` reasons | `docs/help/registry.json` | the same chapters and order as the manifest in use today |
| 5 | fill `owner`, `reviewer`, `category`, `product`, `keywords` and `help_ids` for the shipped pages | the registry | `--check` clean; every shipped page owned ([05](05-content-and-registry.md)) |
| 6 | emit the engine-facing files, and assemble the package | `docs/docfx.json`, `docs/toc.yml`, the area `toc.yml` files, `scripts/docs-package.mjs` | `npm run docs:site && npm run docs:package` produces a package whose navigation resolves every page and whose page count matches the registry ([03](03-site-project.md)) |
| 7 | parity assertion wired into `docs:blocking` | the registry generator and the audit script | editing one chapter fails the check, naming both paths |
| 8 | point the help-file build at the generated manifests | `scripts/build-t3000-help-chm.mjs` | the rebuilt help file is page-for-page identical to the previous one |
| 9 | template layer: brand CSS and JS, logo, favicon, self-hosted fonts | `docs/templates/t3000/public/**` | the site is branded, dark mode works, and there are no remote requests ([04](04-template.md)) |
| 10 | homepage | `docs/index.md` and its generator blocks | a landing page with working cards and "recently updated" |
| 11 | `index.json` and `page-meta.json` emitters plus the staleness pass | the generator | a page whose `code` glob was touched reports `stale: true` |
| 12 | page-meta bar and the version-switcher, feedback and copy widgets | `main.js` | the bar shows date, SHA and owner; every widget degrades silently when its data is missing |
| 13 | the site's navigation from the package's `nav.json`, and its search over the packages | `lib/nav`, `lib/search` | the tree matches the registry, and a search finds a known page ([06](06-search.md)) |
| 14 | CI: `lint` and `site`, the warning baseline, the pull-request artefact | `.github/workflows/docs.yml` | a broken link fails the build; a pull request shows a downloadable site |
| 15 | F1 context ids: seed `help-ids.json`, `scripts/docs-map.mjs`, the generated `T3000_Help_Map.generated.h`, a coverage report | new scripts and the header | coverage of at least 90 % of the topics the dialogs use; the diff guard passes |
| 16 | commit-summary changelog and the What's New chapter | `docs-sync --summarise`, the prompt file, the ledger | re-running duplicates nothing; a model outage degrades to a `pending` list ([12](12-ai-features.md)) |
| 17 | media audit: missing, unused, duplicate, oversized, plus naming rules | the audit script | a missing image fails the gate for user pages; the unused list is produced |
| 18 | publish the governance policy, the waiver gate and the pull-request and emergency checklists | [14](14-governance.md) | an expired waiver fails; an unowned shipped page fails |
| 19 | admin report, first version | a generated page at `/_admin/` | coverage, stale pages by owner, docs owed, unowned and unreviewed pages, and the health score are visible ([11](11-review-and-cicd.md)) |

## Collaboration

*Provenance, impact analysis and the weekly report.*

| # | Task | Acceptance |
|---|---|---|
| 1 | `docs-sync --impact` and the rule registry in `docs/help/rules/*.json` | a past commit range flags the pages a human agrees with |
| 2 | follow-up pull-request generation — mechanical edits applied, prose proposed | a code-only pull request yields a docs follow-up, never a silent edit |
| 3 | the `docs-owed` gate and waivers with an expiry | waiving and then editing code passes; an expired waiver fails |
| 4 | the staleness report job and the weekly review slot | the report lands weekly, grouped by owner |
| 5 | release-note draft generator | a draft release page in a pull request, with the four standard sections ([10](10-changelog-releases-versioning.md)) |
| 6 | RSS feeds for the changelog and for releases | both validate, and list the last twenty entries |
| 7 | the internal reviewer banner behind `?internal=1` | it shows owner, review age, stale reason and feedback count ([08](08-editing-and-git.md)) |

## Editing

*The site, per-version publishing, feedback and the hosted editor.*

| # | Task | Acceptance |
|---|---|---|
| 1 | publish a package per product and version, and put the site in front of them | every published version appears under `/{product}/{version}/`, and the switcher moves between them |
| 2 | `versions.json` and the switcher wiring | switching keeps the reader on the same page path where it exists |
| 3 | the feedback endpoint, `docs_feedback`, and owner routing | a "No" click writes a row routed to the page owner ([09](09-feedback-subscriptions-notifications.md)) |
| 4 | the helpfulness ratio and the aging report | feedback unhandled for more than thirty days appears in the weekly report |
| 5 | the center tool's editor: Monaco, the toolbar, preview, upload, draft branch, publish — see [15](15-online-editor.md) | editing a page end to end produces an ordinary pull request |
| 6 | roles and authentication for editor and reviewer | reading stays anonymous; only a role can draft or publish |
| 7 | the search beacon and the monthly content queue | zero-result queries appear as a to-do list |
| 8 | `docs_subscriptions` and the digest | a category subscription notifies on a change to a page in that category |
| 9 | analytics: page, search and zero-result beacons, the weekly aggregation and the health score on the dashboard | zero-result queries reach the queue, and the health number is visible |

## Offline documentation

*The package, the PDF and the frozen versions.*

| # | Task | Acceptance |
|---|---|---|
| 1 | `scripts/docs-offline.mjs` — audit, relative rewrite, zip | the package browses and searches on an air-gapped machine ([07](07-offline-pdf-chm.md)) |
| 2 | cover page, print CSS and the PDF metadata | a full-bleed cover; article headers and footers numbered |
| 3 | `docs/toc.pdf.yml` and `npm run docs:pdf` | one `T3000-Learn.pdf`, with no engineering area inside |
| 4 | the download section on the release page | the site's links resolve to that version's own artefacts |
| 5 | attach the help file, the PDF and the package to the release | three assets per release, all versioned |
| 6 | document the freeze and backport procedure | a release-note fix republishes one version folder |
| 7 | retention of the current version plus the last three, with media shared across snapshots | host size is bounded and an old version stays readable |

## The assistant

| # | Task | Acceptance |
|---|---|---|
| 1 | an embedding index over pages and code paths | retrieval beats keyword search on the twenty-question set |
| 2 | the assistant over the MCP document tools | every answer cites a correct page, and stale pages are excluded |
| 3 | `--draft <page>` on demand | the proposal matches the diff that caused the flag |
| 4 | a cost and quality review of summarisation | bounded cost per release, with no factual error in the sample |

---

## Dependencies

```
1 → 2 → 3 → 4 → 6 → 7 → 9/10/11/12/13/14/15/16/17/18/19
                5 ↗ (the engine pin is a prerequisite of 6 alone)
3 → 7 → 14 (docs owed needs code globs)
5 → 6 → 18, 5 → 16 (the PDF needs the modern template at 2.73 or newer)
7 → 19 (feedback routing needs the registry)
```

Once step 8 lands, steps 9 to 12 and 14 to 16 are independent of each other and can run in parallel across people.

## What the foundation milestone has to show

- `dotnet tool restore; npm run docs:site` works on a clean clone — or `npm run docs:engine; npm run docs:site` with a source checkout — and no engine file exists anywhere in the working tree.
- `docs/help/registry.json` is the only place the structure is declared, and `--check` is clean.
- Two artefacts come from the same page set with no parity violation: the content package and `T3000_Help.chm`.
- Every shipped page has an owner, and every page appears in `index.json` with its headings and provenance.
- The site is branded and searchable, and contains no remote asset.
- `lint`, `site` and `docs-owed` are required checks on `main`.

## Decisions that need a person

| Decision | Who | Blocks |
|---|---|---|
| name the docs owner | management | the foundation milestone's sign-off, and `docs-owed` waivers |
| a Markdown and `help:preview` verdict from the documentation colleague | that colleague | the collaboration milestone |
| the host decision | IT and platform | publishing in the editing milestone |
| whether the two `TRENDLOG_DATABASE_DESIGN` documents are kept or merged | the docs owner | content cleanup, not the build |
| the installer step that copies `T3000_Help.chm` beside `T3000.exe` | build and release | the help file shipping |
| the model and provider for `docs-sync` | platform | the AI tasks |

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| the engine is community-maintained only, since Microsoft Learn moved off it in 2022 | a needed fix may never come | a source checkout, the pin and `tools/patches`; the template stays thin so upgrades stay cheap ([02](02-docfx-engine.md)) |
| an engine upgrade breaks the template layer | the site build fails on upgrade day | the overrides are recorded and minimal, and the upgrade verification is the gate |
| the registry becomes a bottleneck | documentation changes slow down | registry edits are small and scriptable, with `--dry-run` and a generated diff in the pull request |
| the site and the help file drift apart | a reader sees different help in two places | the parity assertion is a blocking gate |
| content goes stale despite the tooling | trust is lost | the weekly report, `docs-owed` and the feedback aging report — the mechanism needs a reader, hence the named owner |
| gates that are too strict push authors around the documentation | documentation stops being maintained | blocking is limited to `docs/t3000/**`; everything else is a warning plus a report |
