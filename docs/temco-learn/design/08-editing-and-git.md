# 08 — Editing, preview and Git integration

Two halves: how a change is **made** — editing and preview — and what a page **shows about itself**, its provenance. Both work with no hosted service at all; the hosted editor is an addition, not a precondition.

---

## The editing workflow

```
edit Markdown in any editor
  → npm run docs:serve     the site, with live preview at :8080
  → npm run help:preview   the help file, when the page ships in it
  → npm run docs:blocking  the link, offline and structure gate
  → commit → pull request → review by the page owner → merge → publish
```

| Need | How it is met | Notes |
|---|---|---|
| Markdown editing | any editor; VS Code with the workspace settings | no format lock-in |
| site preview | `npm run docs:serve` | rebuilds as the page is saved, and keeps the scroll position |
| help-file preview | `npm run help:preview` | the only way to see how a page looks in the help viewer |
| images | `media/` beside the page they belong to, PNG, at least 1600 px wide | the application renders documentation images at full content width, so a small screenshot upscales into blur |
| link checking | `npm run docs:blocking`, plus the engine's own broken-link warnings | relative `.md` links are validated by the build |
| tables | Markdown tables (GFM) | no grid editor |
| drafts | a branch, or a `[WIP]` pull request | nothing unpublished is ever in `docs/` on `main` |
| pull-request checklist | the repository's template gains a docs section | below |

Three prose rules outlive any tooling: no `§N` references, since a section is named rather than numbered; a cross-document pointer names its target section in bold beside the link; and a section anchor is computed from the heading, never typed by hand.

## The hosted editor

| Feature | Design |
|---|---|
| entry point | "Edit this page" on an article opens the center tool's editor for that page. Until it exists, the link goes straight to the file in the repository |
| editing | **Monaco**, the VS Code core, as the source editor — a heading outline in the breadcrumb bar, and the registry fields for the page shown read-only while editing |
| preview | a server-side render of the page, through the same pipeline, in a right-hand pane; "view in site" opens the real thing |
| image upload | `POST /api/docs/upload`, validated for content type and size (10 MB) and committed to the page's `media/` folder on the draft branch |
| draft | a commit on the branch `docs/<page-id>-<user>-<ts>`; no database table ever holds content |
| publish | "Publish" opens the pull request for that branch — title is the page id, body is the diff summary — and a person still merges it |
| authentication | Entra ID, LDAP or local accounts for the `editor` and `reviewer` roles; reading stays anonymous |
| conflicts | the ordinary git flow: the editor refuses to publish while its branch is behind `main` |

**The editor stores no document bodies.** It edits working-tree files and pushes branches. The full design — library choice, screen layout, API contract, the server-side git flow and the safety rules — is in [15](15-online-editor.md).

## What a page shows about itself

The engine already has the mechanism; it is configured, and the gaps are filled here.

| Shown | Mechanism | Configured in |
|---|---|---|
| "Edit this page" on the site | the repository, the branch and the source commit recorded in the package's manifest, plus the page's path | `manifest.json` |
| "Edit this page" in the rendered copy | `_gitContribute: { repo, branch }` with `_gitUrlPattern: "github"` | `docfx.json`, `globalMetadata` |
| the same, for a second content repository | `_gitContribute` mapped per source glob | `fileMetadata` — required as soon as content comes from more than one repository, because the URL is configuration and never where the file happens to sit |
| "View source" | the same keys, with the file path and line | `docfx.json` |
| git features off for an area | `_disableContribution: true`, for `legacy/**` and `design/**` | `fileMetadata` |
| last updated | `page-meta.json`, rendered by the page-meta bar | generated ([05](05-content-and-registry.md)) |
| author of the last change | `page-meta.json`, `git.author` | generated |
| the commit | a linked short SHA pointing at `…/commit/<sha>` | generated |
| the full history | a link to `…/commits/main/<path>` | the template's page-meta bar |
| the version the page belongs to | `page-meta.json` and `versions.json` | generated |
| review state | `page-meta.json`: `owner`, `reviewed`, `stale` | generated, as a stale chip only |

The engine's built-in git dates are not enough on their own: they are derived per build, they are not cheap on a large repository, and they cannot express "reviewed by", "owner" or "stale". `page-meta.json` is one small fetch that carries all of it, and `disableGitFeatures` stays `false` because the edit and source links are worth the cost.

## What a reviewer sees

A reviewer gets the same page plus the context that only matters to them:

- an **internal banner**, visible only with `?internal=1` or on the internal host, summarising the owner, the review age, the reason the page is stale (`api/src/t3_device/trendlog*.rs changed on 2026-10-02`) and the open feedback for the page;
- a **diff-first review**: the pull-request body lists the registry fields that changed alongside the rendered pages, so an order or title change is visible without reading YAML;
- a **"docs owed" badge** on a page that claims code which changed without the page changing ([11](11-review-and-cicd.md)).

## The docs section of the pull-request template

```markdown
## Docs impact
- [ ] Pages updated: <page ids>
- [ ] Registry updated (chapter/order/title/owner/code/tags): <what and why>
- [ ] `npm run docs:blocking` passes
- [ ] `npm run docs:serve` spot-checked the changed pages (site)
- [ ] `npm run help:preview` spot-checked the changed pages (help file, if the page ships)
- [ ] New or changed images are local and at least 1600 px wide
- [ ] No new page metadata (front matter) was added
```

## What the build must satisfy

| # | Requirement |
|---|---|
| 1 | `_gitContribute` points at the real repository and branch, and the edit and source links resolve |
| 2 | `page-meta.json` and the page-meta bar render date, SHA and owner, and link to the history |
| 3 | `_disableContribution` is set for `legacy/**` and `design/**` |
| 4 | the pull-request template carries the docs section |
| 5 | the internal banner appears only with `?internal=1` |
| 6 | the center tool's editor, the image upload and the draft-branch publish exist, with roles for editor and reviewer |

"Edit this page" on a T3000 page opens the right file at the right branch; the page's provenance line shows the date, the SHA and the owner with a link to the history; the internal banner appears only with `?internal=1`; and a draft branch published through the editor produces an ordinary pull request.
