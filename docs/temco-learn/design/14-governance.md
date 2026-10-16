# 14 — Governance

The technical design cannot answer who may publish, who may waive a gate, or how a page is retired. Those are policy — the rules the tooling in [11](11-review-and-cicd.md) enforces. Without them the architecture is complete and the project is still not runnable.

---

## Roles

| Role | Who | Owns | May |
|---|---|---|---|
| **docs owner** — exactly one named person | assigned by management | structure, prose standards, the registry, the weekly ritual | approve any documentation change; waive `docs-owed`; retire a page; decide whether two overlapping pages merge |
| **page owner** | named in `registry.pages[].owner` | the truth of the pages whose `code` globs they claim | update those pages; request a waiver; delete an obsolete page once the docs owner agrees |
| **reviewer** | named in `registry.pages[].reviewer` | review quality in a domain | approve pull requests touching those pages |
| **release owner** | rotates per release | the release artefacts: the help file, the PDF, the offline package and the release notes | publish a version; freeze a snapshot |
| **platform owner** | the maintainer of this design | the engine pin, the template, the generators and CI | upgrade the pin; change the package contract |

1. Every page with `ship: true` has an owner. An unowned page is a build error, not a warning.
2. Owners are **roles rather than people** wherever possible (`trendlog`, `bacnet`, `ui`), so that one person leaving cannot orphan forty pages; the role-to-person mapping lives in the team's roster, outside the registry.
3. The docs owner is a named person — "the docs team" is not an owner.

## When review is required

| Change | Review required |
|---|---|
| prose on a shipped page | the page owner or the docs owner |
| a new page | the docs owner for structure, title and order, plus the page owner |
| `chapter`, `order`, `title` or `ship` in the registry | the docs owner — it changes navigation and the help file |
| a `code` glob | the page owner — it changes what marks the page stale |
| mechanically generated files (`docfx.json`, `toc.yml`, the manifests, `index.json`) | none: they are regenerated and never hand-edited, and CI proves freshness |
| the template or a widget | the platform owner |
| the engine pin | the platform owner, with the upgrade verification in the pull request ([02](02-docfx-engine.md)) |
| release notes | the release owner and the docs owner |

## Publishing

| Action | Who | Mechanism |
|---|---|---|
| publish the site's current version | CI, on a merge to `main` | the `publish` job republishes the package |
| publish a version snapshot | the release owner | a tag → the `publish` job → that version's package |
| publish the help file | the release owner | `npm run build:help`, attached to the release; the installer copies it beside `T3000.exe` |
| publish the PDF and the offline package | the release owner | `npm run docs:pdf`, `npm run docs:offline`, both attached to the release |
| publish a page | any author | a pull request; nothing bypasses review |

**Rollback** is a pointer change: the previous version folder plus `versions.json` ([11](11-review-and-cicd.md), *Workflows*). Rolling back a page is a revert commit.

## Emergencies

An emergency is a customer-visible error in the documentation — a wrong instruction, a dangerous procedure, a wrong field name — during a release window.

| Step | What happens |
|---|---|
| 1 | a comment on the pull request or an issue carrying `docs-urgent`, naming the page |
| 2 | **only that page** is edited: no restructuring and no template changes |
| 3 | the docs owner or the release owner may approve without the usual owner when that owner is unavailable, and the owner is told the same day |
| 4 | `docs-owed` may be waived with the reason `docs-urgent`, and the waiver expires after fourteen days |
| 5 | the help file is rebuilt when the page is in the manual, and the release notes record the correction |

If the docs owner and the release owner are both unreachable, the platform owner may approve — recorded in the pull request, never silently.

## Deprecation and retirement

| Situation | Action |
|---|---|
| the page describes a removed feature | mark `deprecated: true` in the registry, add a banner at the top naming the version that removed it, keep it for one release, then retire it |
| the page describes a feature that was *replaced* | add a "superseded by `<page>`" banner linking to the replacement immediately; two conflicting pages are never left competing in search |
| two pages overlap with different emphasis | the docs owner decides merge or keep; if both stay, each gets a one-line "not the same as `<other page>`" pointer |
| a truly dead page | remove it from the navigation and the manifests first (`ship: false`), then delete the file in a follow-up pull request; the version snapshot keeps it readable |
| a URL that has to survive | a generated redirect stub carrying `redirect_url` metadata — a *generated* file may hold metadata, a hand-written page never does |

A page is never deleted and its replacement added in the same pull request: a removal has to be visible on its own.

## Waivers

A waiver is a time-boxed, recorded exception. It lives in the registry, never in a CI setting:

```jsonc
"waivers": {
  "t3000/features/trendlogs": { "until": "2026-11-15", "reason": "behaviour not shipping yet", "by": "docs" }
}
```

An expired waiver is a gate failure ([11](11-review-and-cicd.md), *Gates*). A waiver longer than one release cycle needs the docs owner's name in `by`. The waiver count is on the health dashboard, where a growing number is a signal rather than a solution.

## The standards the docs owner enforces

1. No page metadata — no front matter — in a shipped page: structure and ownership live in the registry.
2. No file moves: reorganising means a registry change, not a rename.
3. No bare `§N` references: name the target section and link it.
4. Screenshots live in the page's own `media/` folder, named `NN-area-slug.png`; never `image1.png`.
5. A page declares its audience through the registry — user, developer or contributing — and the gates block on user pages.
6. Terminology: T3000, Design Studio, Tstat11 and the product's own names. No third-party product names in a shipped page.
7. The language question is the docs owner's: English only today. A `docs/<lang>/…` layout and translated titles are a registry concern, so the door stays open without paying for it now.

## What the build must satisfy

| # | Requirement |
|---|---|
| 1 | the docs owner is named and recorded in the registry and in this document |
| 2 | this policy is published where authors will see it: the pull-request template and the design index |
| 3 | the registry schema carries the waivers block and the expiry gate runs |
| 4 | the `docs-urgent` label and the emergency checklist are in the pull-request template |
| 5 | deprecation and supersede banners are generated from the registry's `deprecated` and `superseded_by` |
| 6 | retired pages get generated redirect stubs |
| 7 | the role-to-person roster is maintained outside the repository |

An unowned shipped page fails the build; an expired waiver fails the build; the pull-request template carries the docs section and the emergency checklist; and a retired page keeps its URL through a generated redirect stub while disappearing from navigation before its file is deleted.
