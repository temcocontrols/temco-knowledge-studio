# 09 — Feedback, subscriptions and notifications

Each of the three starts at its cheapest implementation — a prefilled GitHub issue, a generated changelog page, repository notifications — and grows the site's own version on top of that. None of them is a precondition for the site.

---

## Feedback

### Without a backend

| Element | Implementation |
|---|---|
| "Was this helpful?" | two buttons in the footer widget in `main.js`. "Yes" records nothing server-side, since a local count is pointless; "No" opens a prefilled form |
| the prefilled issue | `…/issues/new?title=<page title>&body=<page URL + commit SHA + version>&labels=docs-feedback` |
| the zero-result search report | a prefilled issue with `title = "search: <query>"` and `labels=docs-feedback,docs-search`; the person decides whether to submit it |

The trade is deliberate: no infrastructure at all, honest reporting, and everything lands in the queue the reviewers already watch.

### With the endpoint

A route handler in the site's own application, beside search and the assistant: `POST /api/feedback`. The rows live in the site's database, and the center tool reads them for the weekly report.

```
POST /api/feedback
{
  "page": "t3000/features/trendlogs",
  "url":  "/t3000/latest/features/trendlogs",
  "value": "down",                    // up | down
  "reasons": ["outdated"],            // incorrect | missing | outdated | other
  "comment": "the field table is for v25",
  "version": "v26.0930",
  "sha": "a1b2c3d",
  "contact": null,                    // optional
  "ts": "2026-10-10T09:12:00Z"
}
```

```sql
create table docs_feedback (
  id           bigserial primary key,
  page         text        not null,
  url          text,
  value        text        not null check (value in ('up','down')),
  reasons      text[]      not null default '{}',
  comment      text,
  version      text,
  sha          text,
  contact      text,
  created_at   timestamptz not null default now(),
  owner        text,                          -- resolved from the registry when the row is written
  state        text        not null default 'open'   -- open | triaged | fixed | wontfix
);
create index on docs_feedback (owner, state, created_at desc);
create index on docs_feedback (page, created_at desc);
```

- `owner` is resolved from `docs/help/index.json` as the row is written, so routing never depends on the client.
- The **helpfulness ratio** — up against down per page, over ninety days — is published in the weekly report, and a page marked "down" three times with the same reason outranks a merely stale page in the review queue.
- The **aging report** lists rows with `state = 'open'` older than thirty days, grouped by owner. Unhandled feedback has to be visible rather than silent.
- The search beacon (`q`, `resultCount`, `clicked`) lands in the same table with `page = 'search:<query>'`, feeding the content queue described in [06](06-search.md), *Analytics*.

## Subscriptions

| Mechanism | Data | Notes |
|---|---|---|
| repository watch and notifications; the generated What's New page is the "what changed" source | none | the starting point ([10](10-changelog-releases-versioning.md)) |
| RSS and Atom feeds generated with the changelog: `/feed/changelog.xml`, `/feed/releases.xml` | none | |
| site subscriptions | the table below | |

```sql
create table docs_subscriptions (
  id          bigserial primary key,
  subscriber  text not null,                 -- user id or email
  target_type text not null check (target_type in ('product','category','page','release')),
  target_id   text not null,                 -- 't3000', 'protocols', 't3000/features/trendlogs'
  channel     text not null default 'digest',-- digest | immediate | rss
  created_at  timestamptz not null default now(),
  unique (subscriber, target_type, target_id, channel)
);
```

A change to page *P* notifies every subscriber whose target matches *P* by page, by category or by product — all resolved from the registry, so a page moving between categories needs no subscription edits. Delivery defaults to a weekly digest; `immediate` exists for reviewers, not for the public.

## Notifications

| Event | Without the site's endpoints | With them | Recipients |
|---|---|---|---|
| documentation published | changelog page and RSS | the site's bell and digest | subscribers |
| a product release, or its notes, published | release page and RSS | the site and email | subscribers, support |
| a review requested | a repository review request | the site and a Teams webhook | the page owner |
| a page went stale | the weekly report | the site and the digest | the owner |
| docs owed — claimed code changed | a failed pull-request check | the site and the digest | the pull-request author, the owner |
| negative feedback on a page | — | Teams webhook | the owner |
| feedback unhandled for thirty days | the aging report, weekly | escalation | the docs owner |

The webhook payload carries one event per message, so a failure is visible and nothing is batched:

```json
{ "event": "docs.stale", "page": "t3000/features/trendlogs", "owner": "trendlog",
  "reason": "api/src/t3_device/trendlog*.rs changed 2026-10-02", "url": "/t3000/latest/features/trendlogs" }
```

Two guardrails hold this together: notifications are **derived from git and the registry**, never from a hand-maintained list; and every notification links both to the page and to the exact command that resolves it.

## What the build must satisfy

| # | Requirement |
|---|---|
| 1 | the feedback widget posts through the issue URL form, with the `docs-feedback` label and a triage ritual |
| 2 | the changelog page and the RSS feeds are generated |
| 3 | the `docs_feedback` table, the endpoint, owner resolution and the weekly ratio and aging report exist |
| 4 | the Teams webhook carries stale pages, negative feedback and review requests |
| 5 | `docs_subscriptions` and the digest job exist |
| 6 | the site's notification bell and subscription interface exist |
| 7 | the zero-result beacon feeds the content queue |

A "No" click produces an issue carrying the page, the SHA and the version; the RSS feed validates and lists the last twenty changes; a new feedback row resolves to the right owner without any client input; and a stale page notifies its owner once rather than once per run.
