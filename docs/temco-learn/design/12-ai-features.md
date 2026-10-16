# 12 — AI features

Two responsibilities, kept strictly apart:

| | Deterministic and unattended | Assisted, advisory, draft only |
|---|---|---|
| Examples | staleness detection, navigation and manifest generation, link checking, mechanical renames | changelog summaries, release-note drafts, prose update proposals, natural-language answers |
| Rule | runs unattended in CI | lands as a draft in a pull request or as a logged answer, and **a person approves it before publication** |

Nothing here writes prose into a shipped page automatically. The model's job is to make the human's edit small.

---

## Commit analysis, and the changelog

```
input    commit range, per commit {sha, author, date, message, files, diffstat}
output   2–4 lines per scope group, each naming the files or features it describes
artefact docs/help/changelog/<version>.md, plus .summarised.json as the idempotency ledger
```

It runs in `npm run docs:sync` locally and in the advisory `docs-sync` job on a push to `main`, and the generated files arrive through an ordinary pull request — so a bad summary is a review comment rather than a published untruth.

The prompt contract is kept in `scripts/prompts/changelog.md`, versioned with the code:

- the input is **only** commit metadata and file paths. File contents are added only when a scope group is too opaque to summarise, and then only the diff of that group's largest file;
- the output is Markdown with a fixed skeleton: `## <scope>`, then bullets, then `Files: …`;
- inventing features, naming customers, hedging language and mentioning the summariser itself are all forbidden;
- when no model is available, the raw grouped commit list is written with a `pending` marker and the build proceeds.

The quality metric compares a generated changelog against the notes the team wrote by hand for the same release, and the target is "no factual error, at most one missed user-visible change per release".

## Documentation impact analysis

```
changed file  →  registry glob match  →  candidate pages
candidate page + diff  →  classify:
    mechanical  a documented token changed (setting, field, command, path, default value)
                → apply as a deterministic rule and show it as a diff in the pull request
    prose       behaviour or wording changed
                → propose a diff in the pull-request body; never applied automatically
    none        the change does not affect documented behaviour
                → recorded, so the page is not flagged again for this commit
```

Deterministic rules live in `docs/help/rules/<slug>.json`:

```jsonc
{
  "id": "setting-rename",
  "match": { "in": "docs/t3000/**/*.md", "old": "CtrlMax" },
  "replace": { "with": "CtrlMaxValue" },
  "evidence": ["src/t3-react/features/**/*.tsx"],
  "lastFired": "2026-10-02"
}
```

`lastFired` is maintained by the job, and a rule that has not fired in two quarters is deleted: dead rules are worse than no rules, because they hide the next real change.

The output is always a **pull request** — "docs follow-up for `<sha range>`" — carrying the mechanical edits already applied and the prose proposals in its body for the page owner to accept or reject.

## Stale content detection

This is deterministic rather than AI ([05](05-content-and-registry.md), *Staleness*). The model is used only to **draft** an update when the owner asks: `npm run docs:sync -- --draft t3000/features/trendlogs` prints a proposed section change beside the diff that caused the flag, and never commits it.

## The natural-language assistant

| Aspect | Design |
|---|---|
| corpus | `docs/help/index.json` plus page text through the MCP document tools. A page flagged `stale` is excluded from answers, or answered with an explicit stale warning |
| retrieval | keyword and embedding over `title`, `headings`, `tags` and the body |
| answer shape | a short answer plus **page citations**. When confidence is low, it returns search results instead of a synthesis |
| audience | internal and partner first; customer-facing only once the review set passes |
| review set | the same twenty support questions used for search ranking ([06](06-search.md), *Natural-language answers*). A pass means every answer cites a correct page and no answer contradicts a page |
| logging | the question, the cited pages and whether the reader clicked through, feeding the monthly content queue |
| providers | model-agnostic. The interface is a single `answer(question, candidates)` call, so the provider can change without touching the pipeline |

## Guardrails

These apply to every AI feature in this design.

1. **A model never edits a shipped page unattended.** Drafts only, and the diff is reviewed.
2. **No secrets and no customer data in prompts.** A prompt takes commit metadata, paths and documentation text; the repository is the boundary.
3. **Traceable.** Every generated artefact names the commit range and the prompt version that produced it.
4. **Degradable.** With no model, the output is deterministic, the build continues, and the artefact carries a visible marker.
5. **Deterministic first.** Anything expressible as a registry rule, a glob or a generator is not given to a model.
6. **Bounded cost.** Summarisation is per commit range rather than per commit, and results are cached by SHA in `.summarised.json`.

## What the build must satisfy

| # | Requirement |
|---|---|
| 1 | `docs-sync --summarise` writes the changelog, uses the versioned prompt file, and maintains the ledger |
| 2 | `docs-sync --impact` finds candidate pages and classifies each change |
| 3 | the follow-up pull request applies the mechanical edits and proposes the prose ones |
| 4 | the rule registry exists, and `lastFired` pruning is enforced |
| 5 | `--draft <page>` produces a proposed change on demand |
| 6 | an embedding index covers pages and code paths |
| 7 | the assistant runs over the MCP tools, with the review set and logging in place |

Over a past release, `docs:sync` produces no factual error against the hand-written notes; impact analysis names the pages a human reviewer agrees with, measured on the same release; the assistant answers the twenty-question set with correct citations; and with the model disabled, every pipeline still completes and marks its output `pending`.
