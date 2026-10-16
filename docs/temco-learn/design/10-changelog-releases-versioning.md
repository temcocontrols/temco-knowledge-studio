# 10 — What's New, release notes and versions

Three mechanisms that work together: the **changelog** records what changed in the documentation, the **release notes** record what changed in the product, and **version management** decides what the site shows for a given release.

---

## What's New

Input: the commits since the last published release tag. Output: a changelog page per version, plus a ledger that makes the pass idempotent.

```
scripts/docs-sync.mjs --changelog <fromTag>..HEAD

1. collect commits (hash, author, date, files, message)
2. drop noise: commits by the documentation pipeline, merges, version bumps
3. group by scope, in this order:
     api/            → Backend
     src/            → Application
     T3000-Source/   → Firmware / controllers
     docs/           → Documentation
     other           → Other
4. per group, summarise in 2–4 lines that name the files or features they describe
5. append to docs/help/changelog/<version>.md   (append-only, newest first)
6. record every consumed commit hash in docs/help/changelog/.summarised.json
7. write docs/help/changelog/index.json          (the machine-readable ledger)
```

`.summarised.json` maps a commit hash to the version that consumed it, so a re-run never re-summarises a commit and the changelog can be regenerated at any time without duplicating text.

**The commit-summary changelog is deliberately the first AI feature in this design**, not a later one: it is the ask that started this project, it needs no other component — no feedback endpoint, no site application, no authentication — and it is advisory, so a bad summary is a pull-request comment rather than a broken build. Impact analysis and prose drafting come after it precisely because they touch pages.

The changelog is an ordinary site page, registered in the registry as an area chapter, and it is the `<source>` for `/feed/changelog.xml`. It is also the only place a reader has to look for "what changed in the documentation", which is what makes the subscription system cheap ([09](09-feedback-subscriptions-notifications.md)).

**When no model is available**, the raw grouped commit list is written, the section is marked `pending`, and the build continues. A late changelog is annoying; a release blocked by a summariser is not acceptable.

## Release notes

| Step | Output |
|---|---|
| collect | merged pull requests, changelog entries, changed registry pages, and the version's help-file and PDF artefacts |
| draft | `docs/t3000/releases/<version>.md` with `## New features`, `## Improvements`, `## Fixes` and `## Known issues` |
| human pass | the release owner edits the draft; from then on it is an ordinary page and the last word is a person's |
| publish | the page plus an RSS entry, with that version's PDF, offline package and help file attached to the release |

The draft is generated as a **file on a branch** — a pull request from the release branch — never as a side-channel document, so the review record is git history like everything else.

## Version management

| Question | Answer |
|---|---|
| what is current? | `docs/**` on `main` describes the version under development; the newest release tag is the newest *published* version |
| how are versions named? | `v<YY>.<MMDD>`, for example `v26.0930`. The registry's `version` field and `versions.json` use the same string |
| how does a version get a site? | the publish job publishes that version's package, and the site serves it at `/{product}/{version}/` ([11](11-review-and-cicd.md), *Publishing*) |
| how does the switcher know? | `versions.json` is generated at publish time: `{ current, items: [{version, url, current}] }` |
| are old versions readable? | yes — each version is a frozen package folder, and nothing is overwritten |
| what about the help file and the PDF? | attached to the release: one help file and one PDF per version |
| backports? | release-note and known-issue corrections only: fix on `main`, cherry-pick onto the version branch, re-publish that version's folder |
| retention | the current version and the last three releases stay on the host; older folders remain as release artefacts. Media dominates the size, and if retention is not enough, media is served once from a stable path that versions reference |
| where is the version shown? | the page-meta bar (`page-meta.json.v`) and the version switcher; the PDF cover and footer; the offline package's filename |

**Several versions in one run:** the engine can emit named output groups, each with its own `dest`. That is evaluated for building several versions at once; where the pinned version's semantics do not fit this layout, each version is built from a git worktree — one build per version, slower but entirely explicit and not dependent on engine behaviour that would have to be re-verified on every upgrade.

```
content/t3000/13.0/        ← a published version, which is what the site serves
content/t3000/12.9/
/feed/changelog.xml        ← the site's feeds
/feed/releases.xml
/t3000/13.0/downloads      ← the PDF, the help file and the offline copy
```

Search across versions is deliberately **not** built: the switcher navigates, and each version's offline package carries that version's own index.

## What the build must satisfy

| # | Requirement |
|---|---|
| 1 | `docs-sync --changelog` writes the page, `.summarised.json` and `changelog/index.json`, and is idempotent |
| 2 | the changelog is a registered area chapter with its navigation node |
| 3 | `changelog.xml` and `releases.xml` are generated and validate |
| 4 | the release-note draft generator produces a file on a branch, reviewed as a pull request |
| 5 | `versions.json` and the version switcher exist, and the switcher renders only once a second version exists ([04](04-template.md), *The widgets*) |
| 6 | the publish job publishes the version's package and applies retention of the current version plus the last three |
| 7 | the help file, the PDF and the offline package are attached to the release |
| 8 | the freeze policy and the backport procedure are documented for the release owner |

Running `docs:sync` twice produces no duplicated changelog text; the current version is reachable at `/{product}/latest/` and an older one at `/{product}/<version>/`; the switcher moves between them and keeps the reader on the same page path where it exists; and the help file and PDF published with a version match that version's pages.
