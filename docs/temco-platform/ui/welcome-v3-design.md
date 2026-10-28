# The front page — the Azure portal's palette and scale

**Status: implemented, corrected after review.** The page is the **platform description** — titled `Temco Platform`, with no breadcrumb — in the **Azure portal's own palette and type scale** (24px page title, 18px section, 14px card, 13px text; `#0078d4` blue, `#1f2327` ink, `#faf9f8` page, `#edebe9` hairline), not the marketing scale of §2. The rules are in `extensions/temco-ui/media/page.css`; the markup in `extensions/temco-ui/src/components.ts`.

---

## 0. What went wrong twice, so it does not go wrong a third time

| attempt | what it was | why it was wrong |
|---|---|---|
| v1 | a navy→blue gradient band with a cyan glow and a grid | that is a marketing *poster*. Nothing on the Azure pricing page looks like it, and it made the first screen shout |
| v2 | the OpenAI documentation page from the screenshot | calm and readable, but it turned the front page into a *reading* page and dropped the one thing the Azure page is built on: **three options side by side, each with ticks and a button** |

**v3** is the Azure account / purchase-options page read as five bands, built out of Microsoft's own Fluent 2 numbers (taken
from the Fluent 2 design-system stylesheet, not invented): a tinted wash behind the title, three option cards, a numbers
strip, one tinted callout, and questions at the bottom.

---

## 1. The reference, as five bands

```
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │  Home › Pricing › Purchase options                          ← breadcrumb 12px │
  │                                                                              │
  │  Choose how you want to pay for Azure                           ← H1 40/52    │
  │  Pay only for what you use, or commit and save. Every option starts with      │
  │  the same free grant.                                                         │
  │                                                                              │
  │ [ Search pricing… ]                      ( Create an account )  ← 40px, 4px  │
  ├──────────────────────────────────────────────────────────────────────────────┤
  │  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐               │
  │  │ ▣ Pay as you go  │ │ ▣ Savings plan   │ │ ▣ Reservations   │  ← 3 option  │
  │  │ one line of what │ │ ┃ recommended    │ │ one line         │    cards 20/28│
  │  │ ✓ tick one       │ │ ✓ tick one       │ │ ✓ tick one       │               │
  │  │ ✓ tick two       │ │ ✓ tick two       │ │ ✓ tick two       │  ← 14/20     │
  │  │ ✓ tick three     │ │ ✓ tick three     │ │ ✓ tick three     │               │
  │  │ ( Get started )  │ │ ( Get started )  │ │ ( Get started )  │  ← button 32px│
  │  └──────────────────┘ └──────────────────┘ └──────────────────┘               │
  ├──────────────────────────────────────────────────────────────────────────────┤
  │   99.99%    │   60+     │    $200      │   1,000s     ← numbers 24/32           │
  │   uptime    │  regions  │  free grant  │   customers                              │
  ├──────────────────────────────────────────────────────────────────────────────┤
  │  ┌────────────────────────────────────────────────────────────────────┐      │
  │  │ ▣  One tinted callout: a sentence and a link            Learn more │           │
  │  └────────────────────────────────────────────────────────────────────┘      │
  ├──────────────────────────────────────────────────────────────────────────────┤
  │  Questions                                      ← section 24/32 semibold      │
  │  ▸ What counts as a free service?                                            │
  │  ▸ Can I change options later?                                               │
  └──────────────────────────────────────────────────────────────────────────────┘
```

What makes it *that* page, in order of importance:

1. **The wash.** A soft brand tint behind the title, fading into the page — not a saturated band, not a photo.
2. **Three cards in a row, the same height, each ending in a button.** The middle one is marked, not coloured in.
3. **Ticks, not paragraphs.** Three short lines per card.
4. **Numbers in a row** under the cards.
5. **One tinted callout** in the whole page.
6. **Questions at the bottom**, in rows, not in a dialog.

---

## 2. The tokens — Microsoft's own numbers

Taken from the Fluent 2 design-system stylesheet (`--fontSizeHero800`, `--colorNeutralBackground1`, …), so the page is
the system rather than an imitation of it.

### Type

| role | token | size / line | weight |
|---|---|---|---|
| page title (H1) | Hero900 | **40 / 52** | 600 |
| panel & section title (H2) | Base600 | **24 / 32** | 600 |
| card title (H3) | Base500 | **20 / 28** | 600 |
| intro paragraph | Base400 | **16 / 22** | 400 |
| body & card copy | Base300 | **14 / 20** | 400 |
| caption, breadcrumb, label | Base200 | **12 / 16** | 400 |
| code | — | **12.5 / 20** | 400 mono |

Font family: the workbench font in the app (as now), with **Segoe UI** named first in the fallback chain.

### Space, radius, elevation

| | values |
|---|---|
| spacing | 2 · 4 · 6 · 8 · 10 · 12 · 16 · 20 · 24 · 32 · 40 · 48 |
| radius | 2 · 4 (controls) · 8 (cards) · 12 (the one big panel) · pill |
| shadow | `2`: `0 0 2px rgba(0,0,0,.12), 0 1px 2px rgba(0,0,0,.14)` · `4` · `8` · `16` — the reference uses **4** on a resting card and **8** on hover |

### Colour — light

| role | value | used for |
|---|---|---|
| brand | **`#0f6cbd`** | the primary button, links, the recommended card's stroke |
| brand hover / pressed | `#115ea3` / `#0c3b5e` | states |
| brand tint | **`#ebf3fc`** | the wash behind the title, the callout, the recommended card's fill |
| text 1 / 2 / 3 | `#242424` / `#616161` / `#707070` | headings / body / captions |
| surface page / card / subtle | `#fafafa` / `#ffffff` / `#f5f5f5` | page / cards / inset bars |
| stroke | `#d1d1d1` | hairlines; `#616161` when it must be seen |
| success / warning / danger | `#0e700e` / `#bc4b09` / `#d13438` | state only, never decoration |

### Colour — dark (Windows dark)

| role | value |
|---|---|
| brand / hover / tint | `#115ea3` / `#479ef5` / `#082338` |
| text 1 / 2 / 3 | `#ffffff` / `#d6d6d6` / `#adadad` |
| surface page / card / subtle | `#1f1f1f` / `#292929` / `#333333` |
| stroke | `#666666` |

### What the theme owns, and what Azure owns

| | owner | why |
|---|---|---|
| page background, card background, strokes, text | **the VS Code theme** (`--vscode-*`), with the Fluent value as the fallback | a person's editor theme must not be argued with |
| the brand blue, its tint, the type ramp, spacing, radius, shadows, the wash | **Fluent 2 / Azure**, fixed | this is the identity; it is the same in both themes |
| the wash | brand tint → transparent, 160px tall, behind the title only | it is the one thing that makes the top of the page read as Azure |

---

## 3. Welcome, drawn (light, in the app's window)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  Temco Platform › Documentation                                   12px #707070 │
│                                                                                │
│  Documentation                                                    40/52  600    │
│  Write the pages of a product, draft them from the code that runs it, and      │
│  publish a site a customer can open.                              16/22  #616161 │
│                                                                                │
│  ┌──────────────────────────────────────────┐    ( Create a project )           │
│  │ 🔍 Find a page, a file or a command      │    ← field 40px, 4px, 1px #d1d1d1│
│  └──────────────────────────────────────────┘    ← primary 40px, 4px, #0f6cbd │
├────────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐          │
│  │ ＋ Start a project │ │ ▤ Draft from code  │ │ ⇪ Publish a site   │  20/28   │
│  │ 12px caption       │ │ ┃ RECOMMENDED      │ │ 12px caption       │          │
│  │ A name, a version, │ │ Tick files, write  │ │ Build every        │  14/20   │
│  │ and the sources it │ │ the sentence, get  │ │ artifact, freeze   │  #616161 │
│  │ reads.             │ │ a draft with its   │ │ the version.       │          │
│  │                    │ │ provenance.        │ │                    │          │
│  │ ✓ pages            │ │ ✓ file + commit    │ │ ✓ html · pdf · chm │  ✓ 14/20 │
│  │ ✓ sources          │ │ ✓ 12,000 chars     │ │ ✓ one folder       │          │
│  │ ✓ versions         │ │ ✓ nothing written  │ │ ✓ GitHub Pages     │          │
│  │ ( New project )    │ │ ( Draft a page )   │ │ ( Open Ship )      │  32px    │
│  └────────────────────┘ └────────────────────┘ └────────────────────┘          │
│   white, 1px #d1d1d1,   tinted #ebf3fc,        white, 1px #d1d1d1,             │
│   8px, shadow 4          1px #0f6cbd, 8px       8px, shadow 4                  │
├────────────────────────────────────────────────────────────────────────────────┤
│    148         1           96            2          ← numbers 24/32 600         │
│    pages   ·  project  ·   read    ·   sources        ← labels 12/16 #707070    │
├────────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │ ▣ Drafting keeps its receipts                              [ Read a Source ]│ │
│  │   Every drafted page records the repository, the files and the commit    │ │
│  │   it was written from — on Properties, on Review and in Registry.        │ │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│   #ebf3fc, no shadow, 8px                                                      │
├────────────────────────────────────────────────────────────────────────────────┤
│  Questions                                                         24/32 600   │
│  ▸ What is a project?                                                          │
│  ▸ Where do the pages live?                                                    │
│  ▸ What happens when I publish?                                                │
│  ▸ Which languages can a page be translated into?                              │
└────────────────────────────────────────────────────────────────────────────────┘
                                                    ( ✦ Ask AI )  ← pill, bottom right
```

Notes on the drawing:

- **The wash** sits behind the title band only, 160px tall, `#ebf3fc → transparent`, and it is the *only* decoration on
  the page.
- **The three cards are the page.** They are the Azure purchase-option cards with our three acts.
- The **middle card is recommended** — filled with the tint and stroked with brand, because drafting from code is the
  thing this product does that others do not.
- **No panel with a code sample** on the front page: the code moved to where it belongs (the Drafting page, `§4.8a`), and
  the front page stopped competing with it. This is the change I most want confirmed.

---

## 4. Dark theme — the same page

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  Temco Platform › Documentation                                   12px #adadad │
│  Documentation                                                    40/52  #fff  │
│  Write the pages of a product…                                    16/22  #d6d6d6│
│  ┌──────────────────────────────────────────┐    ( Create a project )           │
│  └──────────────────────────────────────────┘    ← #115ea3, white text         │
├────────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐          │
│  │ #292929  1px #666  │ │ #082338  1px #479ef5│ │ #292929  1px #666  │         │
│  └────────────────────┘ └────────────────────┘ └────────────────────┘          │
└────────────────────────────────────────────────────────────────────────────────┘
   the wash is #082338 → transparent: the same shape, eleven shades darker
```

---

## 5. The option card, up close

```
   resting                      hover                        recommended
┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐
│ #ffffff            │   │ #ffffff            │   │ #ebf3fc            │
│ 1px #d1d1d1        │   │ 1px #0f6cbd        │   │ 1px #0f6cbd        │
│ shadow 4           │   │ shadow 8           │   │ shadow 4           │
│                    │   │                    │   │ ┃ RECOMMENDED 11px │
└────────────────────┘   └────────────────────┘   └────────────────────┘
```

- The whole card is not a button: the **button inside it** is the action (rule 2 from the shell document).
- Hover moves the stroke and the shadow, never the layout.
- A tick is a 16px check glyph in `#0f6cbd` and a 14/20 line — the same construction as the Azure page.

---

## 6. The other pages inherit the same language

| page | title | what sits under it |
|---|---|---|
| Projects | 32/40 | the same three-band rhythm: figures strip → list → tinted callout when there is nothing yet |
| Overview | 32/40 | figures strip → pipeline → feeds → cards |
| Documents | 32/40 | figures strip → areas + pages table |
| Ship (later) | 32/40 | four tabs, then the same card grid |

One rule keeps them from drifting: **a page has at most one tinted callout, and its title is one size (32/40) unless it
is the front page (40/52).**

---

## 7. Translation, in the design

Because the translator exists, the design has to say where it appears — background and content both:

```
  Documentation                                   ← 40/52
  ┌──────────────┐
  │ EN ▾ · 11 languages │   ← a chip row under the title, 12px, on the wash
  └──────────────┘
    the page in front is English; the chip says so and opens "Translate this page…"

  a translated page (guide/wiring.de.md)
  ┌────────────────────────────────────────────────────────────────────┐
  │  ▣ German · written from temco-platform@3f2a1c       12px #616161  │
  └────────────────────────────────────────────────────────────────────┘
     #f5f5f5 bar, 8px, inside the page's own top — it is not a callout
```

Translate is a **chip and one bar**, never a banner: a banner would make every page look like it is asking a question.

---

## 8. The content (the actual words)

| where | words |
|---|---|
| breadcrumb | `Temco Platform › Documentation` |
| H1 | **Documentation** |
| intro | Write the pages of a product, draft them from the code that runs it, and publish a site a customer can open. |
| field | `Find a page, a file or a command` · `Ctrl P` |
| primary | **Create a project** |
| card 1 | **Start a project** — A name, a version, and the sources it reads. · ticks: pages, sources, versions · `New project` |
| card 2 | **Draft from code** — Tick the files, write one sentence, and the draft arrives with its provenance. · ticks: file + commit, 12,000 characters, nothing written until accepted · `Draft a page` |
| card 3 | **Publish a site** — Build every artifact, then freeze the version for readers. · ticks: html · pdf · chm, one folder, GitHub Pages · `Open Ship` |
| numbers | 148 pages · 1 project · 96 read · 2 sources |
| callout | **Drafting keeps its receipts** — Every drafted page records the repository, the files and the commit it was written from. · `Read a Source` |
| questions | What is a project? · Where do the pages live? · What happens when I publish? · Which languages can a page be translated into? |
| floating | `Ask AI` |

---

## 9. What changes in code, when this is agreed

| # | file | change |
|---|---|---|
| 1 | `extensions/temco-ui/media/page.css` | the layer is rewritten to these tokens: Hero900/Base600/Base500/Base400/Base300, spacing 2–48, radius 2/4/8/12, shadow 4/8, brand `#0f6cbd` + tint `#ebf3fc`, and **one** sanctioned wash |
| 2 | `extensions/temco-ui/src/components.ts` | `hero()` gains the wash + breadcrumb; `optionCards()` replaces `cards()` on the front page; `callout()` replaces `banner()`; `questions()`; `chipRow()`; `numbers()` |
| 3 | `extensions/temco-workbench/src/helpPages.ts` | Welcome rebuilt to §3 and §8 |
| 4 | `extensions/temco-docs/src/docsPages.ts`, `dashboard.ts` | title 32/40, figures strip, one callout where it earns it |
| 5 | `check-components.mts` | the gradient ban becomes "exactly one sanctioned wash, on `.az-wash`, brand tint → transparent"; the rest of the checks stay |
| 6 | `docs/temco-platform/ui/shell-v2.md` §10 | replaced by this document once approved |

Risk: low — it is CSS plus one page's markup. Everything else on the page (`kpi`, `section`, feeds, tables) keeps its
current markup and only changes clothes.

---

## 10. What I need confirmed

| # | decision | my recommendation | the alternative |
|---|---|---|---|
| 1 | **The three option cards** on the front page | yes — it is the Azure page's whole idea | keep the panel-with-code from v2 |
| 2 | **Title size** | 40/52 on the front page, 32/40 elsewhere | 32/40 everywhere |
| 3 | **The wash** behind the title | yes, 160px, `#ebf3fc → transparent` | no wash, flat page |
| 4 | **Recommended card** | the middle one, tinted | none recommended |
| 5 | **Questions** at the bottom | yes, four rows | omit |
| 6 | **Floating Ask AI** | yes | omit |

Say which of the six to change; everything else is as drawn. Then I implement it in one pass and show the render.
