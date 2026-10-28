# Shell and pages, v2 — the full layout, drawn

This supersedes the shell, activity-bar and left-panel parts of [application-design.md](./application-design.md). Every
surface below is drawn in full; nothing is summarised as "keeps the same frame".

Counted from the manifests before designing anything:

| | today | v2 |
|---|---|---|
| activity-bar containers | 5 | **4** |
| side-bar views | 19 | **7** |
| center pages | ~44 | **17** |
| commands | 250+ | 250+ (every id unchanged) |

Legend: `[ Button ]` is a button · `▸ ▾ •` are tree disclosure and items · `⋯` is a menu · `⬚` is a picture · `‹ ›` are
tabs · `◀` marks the selected row · `(•)` marks a radio choice.

---

## The four rules

1. **A side bar is a list you work in** — not a dashboard, not a status board. Status belongs to the status bar; actions
   belong to the view's title bar.
2. **A row is a thing, or it is an action — never both.** `test11.md` is a thing. *Build Center* is an action wearing a tree
   row at the same weight, which is why the column reads as noise.
3. **One name per concept.** Not *Needs You* here and *Review Center* there. Not *Publish* for both "copy a build" and "push
   to GitHub".
4. **A module with nothing to show gets no icon.** An empty container is a broken promise.

---

## 1. The window

```
┌────┬──────────────────────────────┬─────────────────────────────┬────────────────────┐
│ ⌂  │ [view title]            ⋯  ＋ │                             │ AI                 │
│ ▤  │ [ one-line header / search ]  │      the page you are       │ ─────────────────  │
│ ⌗  │ ────────────────────────────  │      working in             │ you: …             │
│ ≡  │                              │                             │ ai: …              │
│    │     the list you work in     │  ┌───────────────────────┐  ├────────────────────┤
│    │                              │  │                       │  │ PAGE               │
│    │                              │  │                       │  │ Outline·Draft·Props│
├────┴──────────────────────────────┴─────────────────────────────┴────────────────────┤
│ PROBLEMS · OUTPUT · TERMINAL                                                          │
├───────────────────────────────────────────────────────────────────────────────────────┤
│ ▤ Test1 · 148 pages · 1 owed · v1.4 · Build ✓ 10:42 · Pages ✓                          │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

**Left** one container, one list · **Center** one page · **Right** two secondary side bars that follow the page (§5) ·
**Bottom** the window's facts, once.

---

## 2. Activity bar: four icons

The activity bar is the whole application's top-level navigation: **one icon is one container, and a container is one side
bar.** That is the only structure VS Code gives an extension, so the bar is where "how many places does this application
have?" is decided.

```
 ┌────┬──────────────┬───────────────────────────────────────────────────────────┐
 │    │ GLYPH        │ TOOLTIP — what the icon is                               │
 ├────┼──────────────┼───────────────────────────────────────────────────────────┤
 │  1 │ house        │ Home — projects, recent activity, repositories, the site   │
 │  2 │ book         │ Docs — the documentation workspace                        │
 │  3 │ grid         │ Tools — SQL, BACnet, IO, network                          │
 │  4 │ sliders      │ Settings — settings and help                              │
 ├────┼──────────────┼───────────────────────────────────────────────────────────┤
 │  5 │ account      │ accounts                     (VS Code's own, not ours)    │
 │  6 │ gear         │ Manage                       (VS Code's own, not ours)    │
 └────┴──────────────┴───────────────────────────────────────────────────────────┘
```

Rows 1–4 are ours; 5–6 belong to VS Code and cannot be removed. The whole bar can be collapsed by the user at any time, so
nothing here may be the *only* way to reach a page — every icon's contents are also in the command palette.

### 2.1 What each icon opens

| # | icon | tooltip | side bar it opens | the job it does | you reach for it when |
|---|---|---|---|---|---|
| 1 | house | **Home** | `Projects` · `Repositories` · `Recent activity` | orient: which project, which Temco code the docs are written from, what happened, what was published | you start a session, or you are not sure what to do next |
| 2 | book | **Docs** | `Pages` | write: the tree of pages, the two acts that ship them | you are working on the documentation, which is most of the time |
| 3 | grid | **Tools** | `Query & Browse` · `Schema & Maintenance` | diagnose: devices, IO points, BACnet objects, network, SQL | a controller is misbehaving, or you need data out of the system |
| 4 | sliders | **Settings** | `Settings` | configure: appearance, modules, models, publishing, help | something is wrong with the installation, or you are changing how it behaves |

The lists are unevenly split — **Home 3, Docs 1, Tools 2, Settings 1** — because that is the real number of lists that
hold things you click into (rule 1). An uneven bar is the honest bar: a container with one list is fine, a container kept
only so the bar looks symmetric is not.

### 2.2 Why these four, in this order

```
   orient ──▶ write ──▶ diagnose ──▶ configure
     ⌂          ▤           ⌗            ≡
   (daily)   (all day)    (sometimes)  (rarely)
```

- **Order follows a session, not a feature list.** Left to right is the order a person actually moves: find the project, do
  the work, investigate a problem, change a setting. Icons are muscle memory; the position is the documentation.
- **One icon per kind of activity, not per module.** Nine modules, four activities: that is why the count is four and not
  nine, and why adding a module does not add an icon.
- **The test for membership.** An icon earns its place only if it opens a list you *work in* and revisit regularly. If it
  opens one page you visit monthly, it is a row somewhere, not an icon. That test is what removed *Learn* (read-only output →
  a page under Home) and *AI* (see §2.4).

### 2.3 The Settings glyph: sliders, not a gear

```
   ours                          VS Code's
 ┌──────────────┐              ┌──────────────┐
 │   ══╪══      │  sliders     │      ⚙       │  Manage
 │   ══╪══      │              │              │
 └──────────────┘              └──────────────┘
      row 4                        row 6
```

A gear at 16 px is a grey blob; two gears in one column is one meaning too many, and the one at the bottom is not ours. So
the Settings container is drawn as **sliders** — the second universal conventions for preferences — and its tooltip reads
**Settings** where VS Code's reads *Manage*.

The container id stays `temcoSettings`, so saved layout and `onView` activation are untouched. The whole change is one file:
`media/settings.svg`.

### 2.4 What is deliberately *not* in the bar

| not here | where it is | why |
|---|---|---|
| **AI** | the right-hand secondary side bar (§4.16) | a conversation is not a destination; it is a thing you have *while* writing. Putting it on the left would make it a place you leave the page to visit |
| **Published site / Learn** | Home ▸ Published site (§4.6) | read-only output of work done elsewhere — a page, not a place to keep open |
| **Repositories** | the **Home** side bar (§4.4) | it is the shelf of **Temco code** that pages are written from — a list of things, opened while orienting, not an activity of its own. The drafting that reads it happens in Docs (§4.8a), and every draft names the file it was given |
| **BACnet · network · device manager** | inside Tools | they are jobs inside the diagnostic activity, not activities of their own — and two of them have no manifest yet, so they must not get an icon that opens nothing (rule 4) |

### 2.5 Before and after

Today the manifest declares five activity-bar containers, all from `temco-workbench`:

```
        TODAY (manifest)                        V2
┌────┐  ⌂ Home        (5 views) ───────▶  ┌────┐  ⌂ Home      (3 views)
│ ⌂  │  ▤ Docs        (6 views) ───────▶  │ ⌂  │  ▤ Docs      (1 view)
│ ▤  │  ✦ AI          (2 views) ───────▶  │ ▤  │  ⌗ Tools     (2 views)
│ ✦  │  ⌗ Tools       (2 views) ───────▶  │ ⌗  │  ≡ Settings  (1 view)
│ ⌗  │  ≡ Settings    (4 views)           │ ≡  │
│ ≡  │                                   └────┘
└────┘
  5 icons · 19 views                     4 icons · 7 views
```

Two things move — nothing disappears:

- **AI leaves the bar** for the right-hand side bar: the *assistant* and *runtime* views regroup there (§4.16), next to the
  draft panel that is already on that side.
- **Repositories changes container.** It is a view inside **Docs** today (the sixth one), which is why it never had an icon.
  It moves to **Home**, where "what can I read?" is one of the questions Home answers. Home's five sections today are mostly
  status boards; under this design it has three real lists — *Projects*, *Repositories*, *Recent activity* — while Docs drops
  to the single *Pages* tree (§4.4).

Home, Docs, Tools and Settings all stay. Their *contents* change (§3–§7), not their identity.

Two other containers exist today but were never in the bar, and this design keeps them out:

| container | location | what it is |
|---|---|---|
| `temcoAi` | secondary side bar (right) | the AI side bar — already where §2.4 wants AI |
| `temcoDraft` | auxiliary bar (right, bottom) | the AI draft panel, titled *Page* — it renders the page being written beside the page list |

**What the eight icons you saw were.** The earlier build also carried `temcoLearn`, `temcoHelp` and
`temco-repositories` containers. Those three were *removed* in the manifest fix that preceded this document, which is why
the bar reads five today: Learn → Home ▸ Published site, Help → Settings ▸ Help, Repositories → Home ▸ Repositories. So
the sequence is **8 → 5 (done, manifest) → 4 (this document, AI leaves)**.

### 2.6 States

```
   selected              hover                 no project yet
 ┌────┐               ┌────┐                ┌────┐
 │ ▤  │ ◀ accent bar  │ ▤  │ ◀ tint         │ ⌂  │ ◀ Home is where the
 │    │               │    │                │    │   answer is
 └────┘               └────┘                └────┘
```

- **Selected** — the icon for the open container carries VS Code's accent bar; clicking it again collapses the side bar.
- **No badge on any icon.** Counts belong to the status bar and to the view that owns them; a number on an icon is read as
  "notifications" and gets ignored after a week.
- **No empty container, ever** (rule 4): if a module has nothing to show it is not in the bar at all.

### 2.7 What implementing this touches

| change | risk |
|---|---|
| 5 containers → 4 (remove the AI container) | one manifest, no code — `onView` for its views moves with them |
| 19 views → 7 | views are removed only after their content exists elsewhere (§8); *Repositories* is **moved**, not removed |
| `media/settings.svg` redrawn as sliders | one icon file |
| container ids unchanged | saved layout, `onView` activation and every `when: view == …` clause keep working |
| `check-temco-modules` already refuses a view inside a container that does not exist | a half-finished step fails the build instead of showing an empty panel |

---

## 3. Docs — the one container that changes shape

### Before (as you saw it): five stacked regions, the tree got ~120 px

```
┌─────────────────────────────┐
│ Project                     │
│  Test1  v1.0                │  status
│  1 page · no issues         │
│  [Pages 1][Needs you 1]     │
│  [ Find a page…           ] │
├─────────────────────────────┤
│ Pages                       │
│  ▾ Test1                    │  the work — squeezed
│    test11.md                │
├─────────────────────────────┤
│ Needs You                   │  status
├─────────────────────────────┤
│ Sources                     │  status
├─────────────────────────────┤
│ Publish                     │  actions drawn as rows
│  Review Center              │
│  Build Center               │
│  Releases                   │
└─────────────────────────────┘
```

### After: one header line, one tree, everything else one click away

```
┌─────────────────────────────┐
│ Test1 · 1 owed   [Build][⇪] │  ← project · what needs you · the two acts
│ [ Find a page…            ] │
├─────────────────────────────┤
│ PAGES                       │
│  ▾ Test1                    │
│    ▾ Overview               │
│      • test11.md            │
│    ▸ media                  │
│    ▸ Commissioning          │
│                             │
│                             │  ← the tree owns the height
│                             │
└─────────────────────────────┘
```

`1 owed` **is** the link to Review. `[Build]` builds the site; `[⇪]` publishes it.

### The `⋯` menu in the view title

```
┌──────────────────────────────┐
│ ＋  New Page…                 │
│ 📁  New Folder…               │
│ ────────────────────────────  │
│ ✓   Review            1 owed  │
│ ☰   Registry                  │
│ ⚠   Problems                  │
│ ────────────────────────────  │
│ ▶   Build Center              │
│ ⬆   Releases                  │
│ ⤓   Exports                   │
│ ────────────────────────────  │
│ ⚙   Page Properties           │
│ ⟳   Refresh                   │
└──────────────────────────────┘
```

---

## 4. Every page, drawn in full

All pages share one frame, so a page is recognisable at a glance:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ EYEBROW › HERE                                                               │
│ Title                                     [ secondary ]  [ primary action ]  │
│ one line saying why a person is on this page                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│  content                                                                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### The Home side bar — three lists under one icon

Home's six pages (§4.1–§4.6) are opened from this column; each section is a real view, so it collapses, filters and keeps
its own `⋯`:

```
┌──────────────────────────────┐
│ Test1                        │  ← the project everything else is about
│ 148 pages · 2 sources        │
│ [ Find a project…          ] │
├──────────────────────────────┤
│ PROJECTS                   ⋯ │
│  ▸ Test1                ◀    │
├──────────────────────────────┤
│ REPOSITORIES               ⋯ │
│  ▸ temco-docs      main  ✓   │
│  ▸ temco-platform  main      │
│  ▸ docs/help       folder    │
├──────────────────────────────┤
│ RECENT ACTIVITY            ⋯ │
│  ⬆ Test1 v1.0       2 h      │
│  ✎ Commissioning    12 min   │
└──────────────────────────────┘
```

`Repositories` is the view today filed under **Docs**; it belongs here because "what can I read?" is a Home question.

### 4.1 Home ─ Projects

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ DASHBOARD › PROJECTS                                                         │
│ Projects                                          [ + New Project ]          │
│ Everything this machine documents. A project is what a release is named after │
│ and what every other page asks about.                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────┐  ┌────────────────────────┐                      │
│  │ Test1           v1.0   │  │ (empty)                │                      │
│  │ 148 pages · 2 sources  │  │ Start a project to see │                      │
│  │ current            [▸] │  │ it here                │                      │
│  └────────────────────────┘  └────────────────────────┘                      │
│                                                                              │
│  First time here?   [ Create a Project ]   [ Create from a Repository… ]      │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Home ─ Create a project *(full-window form; no side bar)*

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Back                                             [ Create Project ]         │
├──────────────────────┬───────────────────────────────────────────────────────┤
│ START FROM           │  Empty project                                        │
│                      │                                                       │
│ ▸ Empty project      │  THE PROJECT                                          │
│   no sources yet     │   Name     [ Temco Handbook           ]               │
│ ▸ From a repository  │   Version  [ 1.0.0                    ]               │
│   cite what we have  │                                                       │
│ ▸ From existing files│  WHERE THE PAGES COME FROM                            │
│   MD · HTML · Word   │   Starter  [ Nothing - begin with no pages       ▾ ]  │
│                      │            User guide - an Overview area, two topics  │
│                      │            and the registry                           │
│                      │   Write it [ ~/Documents/Temco       ]                │
│                      │                                                       │
│                      │  WHAT IT BUILDS                                       │
│                      │   [x] Website   [ ] PDF   [ ] Offline help            │
│                      │   [ ] Search index   [ ] AI index                     │
└──────────────────────┴───────────────────────────────────────────────────────┘
```

### 4.3 Home ─ Recent activity

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ DASHBOARD › RECENT ACTIVITY                                                  │
│ Recent activity                                                              │
│ What changed lately, newest first. Read-only — no row acts.                   │
├──────────────────────────────────────────────────────────────────────────────┤
│ 10:42  ▶  built the site        Test1 · 148 pages → dist/site                │
│ 10:31  ✎  test11.md             Test1 › Overview                             │
│ 10:18  ⬆  published 1.0.0       Test1 · 8 files · ~/.temco/published/test1    │
│ 09:55  ⌁  read temco-docs       main · 148 pages · 2 errors                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.4 Home ─ Repositories *(the Temco code the documentation is written from)*

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ HOME › REPOSITORIES                                                          │
│ Repositories                                      [ + Add a Repository… ]    │
│ The Temco repositories these pages are written from — one list, two acts:    │
│ read them to cite what they hold, or tick files and draft from the code.     │
├──────────────────────────────────────────────────────────────────────────────┤
│ ▽ temcocontrols                                          organisation        │
│  ▸ temco-platform   C:\QN\temcocontrols\temco-platform                       │
│     main · read 12 min ago · 148 pages · 2 errors  [Read] [Draft] [⋯]        │
│  ▸ temco-docs       C:\QN\temcocontrols\temco-docs                           │
│     main · never read · local copy on disk         [Read] [Draft] [⋯]        │
│  ▸ docs/help        D:\Contoso\docs\help                                     │
│     a folder · read yesterday · 64 pages           [Read] [Draft] [⋯]        │
├──────────────────────────────────────────────────────────────────────────────┤
│ ⋯ on a row: Set the branch · Open the local copy · Copy the URL ·            │
│             Remove the local copy · Forget it                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

The word on the row is *repository*; inside a project the same thing is called a *source* (§4.7), because that is what
it is there — one of the places a project cites. One entity, two scopes, and the list is the scope where you act on it.

| button | what it does | what it costs |
|---|---|---|
| **[ Read ]** | finds `docs/*/registry.json` inside it — or converts a folder once — and records the pages it holds | one API call, or one folder walk; **nothing is ever written to the source** |
| **[ Draft ]** | opens the file ticker (§4.5) so code files can be ticked as material for a new page (§4.8a) | nothing until *Draft* is pressed; a page exists only when the draft is accepted |

`[ Draft ]` is the button that makes this page part of writing rather than a library: the code in these repositories is the
raw material of every page that is not already written, and the material a page was given is recorded on the page.

**Why both a view and a page.** The view in the Home side bar is the everyday list — arrow keys, filter, open one. This
page is the same sources drawn wide, for what a tree row cannot hold: the organisation they came from,
`[ + Add a Repository… ]`, in bulk. One law on both: a row is a thing, an action is in its buttons or `⋯` (rule 2).

### 4.5 Home ─ Repository detail *(the file ticker: what a page can be written from)*

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ REPOSITORY                                                                   │
│ temco-platform          [ Copy the Clone URL ] [ Open on GitHub ] [ Refresh ]│
│ What this repository holds that documentation can be written from.           │
├──────────────────────────────────────────────────────────────────────────────┤
│ [ main ]  [ 148 pages ]  [ 2 errors ]  [ read 12 minutes ago ]               │
├──────────────────────────────────────────────────────────────────────────────┤
│ [ Download ]  [ Pull ]  [ Remove the Local Copy ]                            │
├──────────────────────────────────────────────────────────────────────────────┤
│ CODE TO DRAFT FROM                                 [ Filter by path… ]       │
│ 3 ticked · 41 kB of 12,000     [ Code only ]  [ Select All ]  [ Clear ]      │
├──────────────────────────────────────────────────────────────────────────────┤
│ ☑ src/commissioning/wiring.ts     12 kB   the order a technician follows     │
│ ☑ src/commissioning/torque.ts      9 kB   limits and units                   │
│ ☑ src/safety/interlocks.ts        20 kB   what stops a run                   │
│ ☐ src/ui/panel.tsx                61 kB   too large — would be skipped       │
│ ☐ docs/help/registry.json          —      already read as 148 pages          │
│ ☐ package.json                     —      generated, never material          │
├──────────────────────────────────────────────────────────────────────────────┤
│ [ Draft a Page from These 3 Files ]    [ Create a Project from These Files ] │
└──────────────────────────────────────────────────────────────────────────────┘
```

This is the step the user asked for, made explicit: **code in, page out.** The list is honest about what it will cost —
generated, vendored and build output are never offered, and a file over the size budget is shown greyed with the reason
rather than silently dropped. What is ticked here is exactly what the draft is given (§4.8a), and the page that results
says so.

### 4.6 Home ─ Published site *(Learn's 5 pages + 2 views → one page; lives in Home)*

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ HOME › PUBLISHED SITE                                                        │
│ The published site              [ Serve ]   [ Open ]   [ Open the Folder ]    │
│ What a reader sees, once a release exists. Read here; ship on the Ship page.   │
├──────────────────────────────────────────────────────────────────────────────┤
│  ✓ v1.0.0   published 10:44 · 8 files · ~/.temco/published/test1/1.0.0         │
│                                                                              │
│  DELIVERY                                                                    │
│   Site           served from this machine at 127.0.0.1:8080     [ Serve ]      │
│   Offline help   the CHM that ships inside the installer        [ Open ]       │
│   Downloads      [ Open the Release Folder ]                                   │
│                                                                              │
│  WHAT THE READER SEES                                                        │
│   ⬚  the front page, as served                                                 │
│                                                                              │
│  LEARNING PATHS ─ 3                                        [ All Paths ]       │
│   ▸ Getting started with T3000 · 6 articles                                   │
│   ▸ Commissioning a controller · 4 articles                                   │
│   ▸ Reading trends · 3 articles                                               │
│                                                                              │
│  DOWNLOADS ─ 2                                                 [ All ]        │
│   ⬚ Temco Platform 1.144.0 (installer)                     [ Open ]            │
│   ⬚ Offline help 1.0.0 (CHM)                              [ Open ]            │
│                                                                              │
│  No published version?  [ Build the Site ]   [ Publish ]                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.7 Docs ─ Project *(S3, the project dashboard)*

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ DOCS › TEST1                                                                 │
│ Test1                                   [ Edit the Project ]   [ Build ]     │
│ What this project cites, what it produces, and what needs a person.           │
├──────────────────────────────────────────────────────────────────────────────┤
│  [ 148 pages ]   [ 2 drafts ]   [ 3 stale ]   [ 5 issues ]                    │
│                                                                              │
│ NEEDS YOU ─ 2                                   [ Open the Review Center ]   │
│   ⚡ Wiring the harness    01-guide/setup/commissioning · rewrite             │
│   ⚡ First power-on         01-guide/setup/verify · rewrite                    │
│                                                                              │
│ SOURCES ─ 2                                             [ Add a Source ]     │
│   ▸ temco-docs       repository · main                                       │
│   ▸ docs/help        a folder                                                │
│                                                                              │
│ OUTPUTS ─ Site · Offline help                              [ Build ]          │
│                                                                              │
│ LAST OUT OF THE BUILDING                                                     │
│   ▶ build #4   succeeded · 10:42                   [ Build Center ]          │
│   ⬆ 1.0.0      published · 8 files · ~/.temco/releases/1.0.0    [ Open ]     │
│                                                                              │
│ CHANGED IN 1.4 ─ 6                                             [ 6 rows ]     │
│   ⑂ Wiring the harness      code moved                                        │
│   ⑂ First power-on          code moved                                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.8 Docs ─ Add a source *(a form in place of the list)*

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ DOCS › TEST1 › ADD A SOURCE                          [ Add ]   [ Cancel ]     │
├──────────────────────────────────────────────────────────────────────────────┤
│  What kind of source?                                                        │
│   (•) A folder on this machine       ( ) A repository we already know         │
│                                                                              │
│   Folder  [ D:\Contoso\docs\help        ]  [ Choose… ]                        │
│           A folder with a registry is cited as it stands; anything else is    │
│           converted once into docs/ and docs/help/registry.json              │
│                                                                              │
│   Name    [ Contoso help               ]                                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.8a Docs ─ New page *(material first — this is where code becomes prose)*

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ DOCS › TEST1 › NEW PAGE                        [ Draft ]   [ ✕ ]             │
├──────────────────────────────────────────────────────────────────────────────┤
│  Goes in      Overview/ ▾       File name   commissioning.md                 │
│  Title        Wiring the harness                                             │
├──────────────────────────────────────────────────────────────────────────────┤
│  WHAT IS IT WRITTEN FROM?                                                    │
│   ( ) Nothing — a blank page                                                 │
│   (•) The pages already here    ids, titles and headings · 148 pages         │
│   ( ) A repository's code                                                    │
│        temco-platform ▾   [ main ]   [ Tick the files… ]  3 files · 41 kB    │
│        ☑ wiring.ts   ☑ torque.ts   ☑ interlocks.ts                           │
├──────────────────────────────────────────────────────────────────────────────┤
│  WHAT SHOULD IT SAY?                                                         │
│  [ Explain how the harness is wired, in the order a technician follows. ]    │
├──────────────────────────────────────────────────────────────────────────────┤
│  12,000 characters of room · 3 files in · 1 file too large, left out         │
└──────────────────────────────────────────────────────────────────────────────┘
```

Three things are decided on this page and nowhere else:

- **What the draft may read.** Three choices, and code is only one of them. The budget is stated, not discovered: 12,000
  characters, largest files first, and everything left out is named. Generated, vendored and build output are never offered.
- **What the draft is for.** One sentence in the person's words — the note, not a template.
- **What it is.** Where it goes, the file name and the title, so the page lands in the right place rather than being moved
  afterwards.

`[ Draft ]` writes nothing. It opens the proposal in the PAGE side bar (§4.18); the page exists when **Accept** is pressed,
and from that moment it carries one line of provenance — `temco-platform · src/commissioning/wiring.ts + 2 · 3f2a1c` — shown
on Properties, on **Review**, and in **Registry**.

### 4.9 Docs ─ the page editor (Temco Editor)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ↶ ↷ │ Style ▾ │ Lists ▾ │ B I U S ⌨ ▮ │ ❝ ⌨ ─ ▦ │ ⬚ │ ⋯ │     🔍 ☰ 📖       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                     Commissioning                                            │
│                     ─────────────────────────────                            │
│                     Wire the harness as shown.                               │
│                                                                              │
│                     ⬚  the harness   (drag a handle to resize)                │
│                                                                              │
│                     | Step | Done |                                          │
│                     | ---- | ---- |                                          │
│                     | Wire | Yes  |                                          │
│                                                                              │
│                     Then read [ the next page ](./verify.md).                │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ 1,204 words · 6 min read · saved 10:44 · Markdown · UTF-8 · LF               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.10 Docs ─ Preview / Diff *(beside the editor, same tab group)*

```
┌───────────────────────────────┬──────────────────────────────────────────────┐
│ the page you are writing      │ PREVIEW                      [ Diff ]  [ × ] │
│ (Temco Editor)                │ the published layout, from the same renderer  │
├───────────────────────────────┼──────────────────────────────────────────────┤
│ # Commissioning               │  Commissioning                               │
│ Wire the harness as shown.    │  ─────────────                               │
│ | Step | Done |               │  Wire the harness as shown.                  │
└───────────────────────────────┴──────────────────────────────────────────────┘
```

### 4.11 Docs ─ the grid editor (CSV / TSV)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ points.csv                                                 saved · 42 rows    │
├─────┬──────────┬──────────┬──────────────┬────────────────────────────────────┤
│  #  │ point    │ units    │ range        │ description                        │
├─────┼──────────┼──────────┼──────────────┼────────────────────────────────────┤
│  1  │ AI-1     │ °C       │ -40 … 120    │ supply air temperature             │
│  2  │ AO-7     │ V        │ 0 … 10       │ valve position                     │
└─────┴──────────┴──────────┴──────────────┴────────────────────────────────────┘
```

### 4.12 Docs ─ Review *(absorbs the Needs You view, the Review Center and the Needs You page)*

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ DOCS › REVIEW                                                                │
│ Review                                            [ Draft a Change ]         │
│ Drafts the local model wrote that no person has settled. One at a time.       │
├───────────────────────────────┬──────────────────────────────────────────────┤
│ DRAFTS ─ 2                    │  Wiring the harness                          │
│   ▸ Wiring the harness    ◀   │  01-guide/setup/commissioning · rewrite      │
│   ▸ First power-on            │                                              │
│                               │  ┌ the draft ──────────────────────────────┐ │
│ CAPTURES ─ 1                  │  │ Add a torque note to the table.         │ │
│   ⬚ 2026-10-27-1042.png   ◀   │  └─────────────────────────────────────────┘ │
│                               │  ┌ the page today ────────────────────────┐ │
│                               │  │ Wire the harness as shown.              │ │
│                               │  └─────────────────────────────────────────┘ │
│                               │  [ Accept ]  [ Discard ]  [ Attach Capture ] │
└───────────────────────────────┴──────────────────────────────────────────────┘
```

### 4.13 Docs ─ Registry *("why is this page not in the site?")*

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ DOCS › REGISTRY                                                              │
│ The Registry                    [ Validate ]   [ Open registry.json ]        │
│ What the registry says exists, what it ships, and why a page may be missing.  │
├──────────────────────────────────────────────────────────────────────────────┤
│  [ 148 pages ]   [ 3 no file ]   [ 1 not shipped ]   [ 2 with problems ]      │
│                                                                              │
│ docs/help/registry.json                                                      │
│   ✓ Overview          01/overview             registered and written          │
│   ⚠ Commissioning     01/setup/commissioning  missing screenshot             │
│   ✕ First power-on    01/setup/verify         does not ship                  │
│   ⚠ E-101             02/errors/e-101         the file was never written      │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.14 Docs ─ Problems *(validate + staleness in one list)*

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ DOCS › PROBLEMS                                                              │
│ Problems                                          [ Run Validate ]           │
│ Broken links, unregistered pages, pages whose code moved, stale screenshots.  │
├──────────────────────────────────────────────────────────────────────────────┤
│  ⚠ 3 pages claim code that has changed      [ Open the Staleness Report ]     │
│  ✕ 1 broken link  commissioning.md:14 → ./verify.md                          │
│  ⚠ 12 pages have never been reviewed        [ Group by Owner ]               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.15 Ship ─ one page, four tabs

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ DOCS › SHIP                                                                  │
│ Ship Test1                                                                   │
│ The four ways documentation leaves this application. Nothing here is a draft. │
├──────────────────────────────────────────────────────────────────────────────┤
│ ‹ Build ›   Release   Deploy   Export                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                          (the tab's body, §4.15a–d)                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### 4.15a ‹ Build ›

```
│  [ Build Site ]   [ Build Offline Help ]   [ Refresh ]                        │
│                                                                              │
│  ✓ Resolve   148 pages to publish, 148 addresses                              │
│  ✓ Render    148 pages written beside their media/                            │
│  ✓ Assets    index.html, assets/site.css                                      │
│  ✓ Sitemap   148 addresses under https://owner.github.io/temco/               │
│                                                                              │
│  BUILDS ─ 4                                                                   │
│   #4  succeeded · 10:42 · 8 files                    [ Open dist/site ]       │
│   #3  failed · 10:30 · no artifact                   [ Open the Output ]      │
│                                                                              │
│  ARTIFACTS ─ 8                                                                │
│   index.html · site.css · 6 pages                              [ Open ]       │
```

#### 4.15b Release

```
│  [ ⬆ Publish ]        version 1.0.0 → ~/.temco/published/test1/1.0.0           │
│      a confirmation names version · destination · file count before copying    │
│                                                                              │
│  PUBLISHED VERSIONS ─ 1                                                       │
│   1.0.0   build #4   published 10:44 · 8 files         [ Serve ]   [ Open ]   │
│                                                                              │
│  WHAT PUBLISHING DOES                                                        │
│   · copies the files a build wrote, into a folder the platform owns            │
│   · records version, build, destination and date                              │
│   · never rewrites a version that already exists                              │
```

#### 4.15c Deploy

```
│  WHERE IT PUBLISHES ─ owner/temco                                             │
│                                                                              │
│   🌐 https://owner.github.io/temco/   pushed to the gh-pages branch            │
│   ⚙ One time only                     Settings → Pages → branch gh-pages, /    │
│   ⚠ Never forced                      a branch with unknown commits is         │
│                                       reported, never overwritten             │
│                                        [ Publish to GitHub Pages ]            │
│                                                                              │
│  No GitHub remote?  this folder is not a git repository with an origin, so     │
│  there is nowhere to publish to until one is added.                           │
```

#### 4.15d Export

```
│  [ 148 pages ]   [ 4 shapes ]   [ every file lands in dist/ ]                  │
│                                                                              │
│  THE SITE, AS A ZIP         index.html, site.css, pages, media/   [ Export ]   │
│  ONE PAGE, AS ONE FILE      a .html with the pictures inside      [ Export ]   │
│  ONE PAGE, AS WORD          a .docx a reviewer can mark up        [ Export ]   │
│  THE PAGES, AS MARKDOWN     .md + media/ + registry.json          [ Export ]   │
```

### 4.16 AI ─ chat, in the right-hand side bar

```
┌─────────────────────────────┐
│ AI                       ⋯  │
├─────────────────────────────┤
│ you: why is commissioning    │
│      missing a screenshot?   │
│                              │
│ ai:  The page refers to      │
│      media/wiring.png, which │
│      is not in media/.       │
│      ┌────────────────────┐  │
│      │ 01-guide/setup/…   │  │  ← citations, clickable
│      │ registry.json:112  │  │
│      └────────────────────┘  │
│      [ Take me there ]       │
│      [ Draft the fix ]       │
├─────────────────────────────┤
│ [ Ask about this page…   ] ⏎ │
└─────────────────────────────┘
        ⋯ : Actions · Citations · Models · Knowledge · Configure
```

### 4.17 AI ─ the configuration page *(6 pages → one page, four tabs)*

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ AI › SETTINGS                                                                │
│ AI Models                        [ local · qwen2.5-3b ]   [ Open the Folder ] │
│ What the model may do, what it read, and what runs on this machine.           │
├──────────────────────────────────────────────────────────────────────────────┤
│ ‹ Actions ›   Citations   Models   Knowledge                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│  WHAT IT CAN DO                                                              │
│   ✓ Summarise a page            drafts, as a diff         [ Run ]             │
│   ✓ Draft a change to a page    drafts, as a diff         [ Run ]             │
│   ✓ Answer about a page         the AI bar, with citations [ Run ]            │
│   ✕ Edit a page directly        never                      blocked            │
│                                                                              │
│  WHERE OUTPUT GOES                                                           │
│   ▸ Drafts        Review Center, as a diff             ✓ never silent         │
│   ▸ Answers       the AI bar, with citations           ✓ never silent         │
│   ▸ Suggestions   the Gaps list of an area             ✓ never silent         │
│                                                                              │
│  GUARD RAILS — fixed on purpose, not settings                                 │
│   ✓ Never write a page without a draft                                        │
│   ✓ Always cite the page or source used                                       │
│   ✓ Refuse when the local model is not loaded                                 │
│   ✓ Keep prompts and answers out of the repository                            │
└──────────────────────────────────────────────────────────────────────────────┘

‹ Citations ›  every answer's sources, kept with the answer that used it
‹ Models ›     2 downloaded, 1 loaded · Runtime llama.cpp · CPU, 6 threads ·
               Storage ~/Temco/models · Privacy: no network once loaded
‹ Knowledge ›  what the index holds — Chunks · Areas · Dimensions · Index age,
               and [ Rebuild Index ]
```

### 4.18 The PAGE side bar (right): Outline · Draft · Properties

```
┌─────────────────────────────┐   ┌─────────────────────────────┐
│ PAGE                        │   │ DRAFT                       │
│ Outline │ Draft │ Properties│   │ draft │ preview │ properties│
├─────────────────────────────┤   ├─────────────────────────────┤
│ ▸ Overview                  │   │ The wiring table needs a     │
│ ▸ Commissioning             │   │ note about torque.           │
│   • Wiring the harness   ◀  │   │                              │
│   • First power-on          │   │ WRITTEN FROM                │
│ ▸ Reference                 │   │  temco-platform             │
│                             │   │  wiring.ts · torque.ts      │
│                             │   │  + 1 more · 41 kB · 3f2a1c  │
│                             │   │  [ Change the files… ]      │
│                             │   │                              │
│                             │   │ [ Accept ]   [ Discard ]     │
│                             │   │ [ Record in the Review Center]│
└─────────────────────────────┘   └─────────────────────────────┘
```

`WRITTEN FROM` is the answer to *"where did this text come from?"* — one line, every time: which repository, which files,
which commit, and how much of the budget they took. It is on the draft, on the finished page's `Properties`, on **Review**,
and on every row of **Registry**, so nobody has to trust a memory. `[ Change the files… ]` reopens the ticker (§4.5) without
asking the question again.

`Properties` is the page's registry values — title, owner, audience, ship, and that same `written from` line — edited in place.

### 4.19 Tools ─ SQL and diagnostics *(unchanged in shape; drawn so the whole window is accounted for)*

```
┌─────────────────────────────┐        ┌────────────────────────────────────────┐
│ QUERY & BROWSE          ⋯ ＋ │        │ TOOLS › QUERY                          │
│  ▸ devices      42          │        │ Query                         [ Run ]  │
│  ▸ io points    118         │        │ SELECT * FROM devices LIMIT 50;        │
│  ▸ bacnet       7           │        ├────────────────────────────────────────┤
│  ▸ network      3           │        │ id │ name     │ firmware │ status       │
│                             │        │ 1  │ T3000    │ 4.2.1    │ ok           │
│ SCHEMA & MAINTENANCE        │        │ 2  │ T3000-B2 │ 4.2.1    │ ok           │
│  ▸ tables                   │        ├────────────────────────────────────────┤
│  ▸ saved queries            │        │ 2 rows · 14 ms          [ Export CSV ]  │
└─────────────────────────────┘        └────────────────────────────────────────┘
```

### 4.20 Settings ─ one page, five sections, left rail

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ SETTINGS                                                                     │
│ Settings                                                                     │
│ How this installation looks and behaves. Every change applies at once.        │
├──────────────────────┬───────────────────────────────────────────────────────┤
│ PROFILE              │  GENERAL                                  [ Open JSON ]│
│   General       ◀    │   Start on         [ Overview ▾ ]                     │
│   Modules            │   Where these live [ Restore Defaults ]               │
│   Branding           │                                                       │
│   AI Models          │  MODULES                              [ Show on Disk ] │
│   Publishing         │   Module          State      Version                 │
│                      │   temco-docs      active     0.0.1                    │
│                      │   temco-editor    active     0.0.1                    │
│                      │   temco-ai        active     0.0.1                    │
│                      │   temco-bacnet    reserved   —                        │
│                      │                                                       │
│                      │  BRANDING                                    [ Reset ] │
│                      │   Application mark  [ Replace the icon… ]              │
│                      │   Shell theme       ( ) Dark (•) Light ( ) System      │
│                      │   Welcome page      [ Welcome ▾ ]                      │
│                      │                                                       │
│                      │  AI MODELS                              [ Open Models ]│
│                      │   Chat model      [ qwen2.5-3b ▾ ]                     │
│                      │   Embedding model [ nomic-embed ▾ ]                    │
│                      │                                                       │
│                      │  PUBLISHING                                           │
│                      │   Pages branch    [ gh-pages ▾ ]   [ Test the Publish ]│
└──────────────────────┴───────────────────────────────────────────────────────┘
```

### 4.21 Settings ─ Help *(6 pages + 2 views → one page, six sections)*

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ SETTINGS › HELP                                                              │
│ Help                                          [ Report an Issue ]            │
│ What this build can do, where its logs are, and how to report a problem.       │
├──────────────────────┬───────────────────────────────────────────────────────┤
│ WELCOME              │  START HERE                                           │
│   Start here    ◀    │   6 ways in · 3 walkthroughs                          │
│   Keyboard           │   [ Keyboard Shortcuts ]  [ Release Notes ]           │
│   Logs               │                                                       │
│   Report an issue    │  THIS WINDOW ─ 3 facts                                │
│   About              │   Version 1.144.0 · commit 72a5048 · 9 modules active │
│                      │                                                       │
│                      │  KEYBOARD SHORTCUTS               [ Command Palette ] │
│                      │   Ctrl+Shift+P   the command palette                  │
│                      │   Ctrl+Alt+P     preview the page                     │
│                      │   Ctrl+Alt+D     diff with HEAD                       │
│                      │                                                       │
│                      │  LOGS                                 [ Open Log Folder ]│
│                      │   main.log        42 KB · last 9 lines           [ Open ]│
│                      │   renderer.log    12 KB · last 9 lines           [ Open ]│
│                      │                                                       │
│                      │  REPORT AN ISSUE                                      │
│                      │   What goes with it — 4 of 6                [ Copy ]   │
│                      │   ✓ version · ✓ modules · ☐ logs · ☐ settings snapshot │
│                      │                                                       │
│                      │  ABOUT                                  [ Check Updates]│
│                      │   Version · Modules · Active modules                  │
└──────────────────────┴───────────────────────────────────────────────────────┘
```

---

## 5. How code, AI, the page and the draft fit together

Four things, four jobs. Only one of them is a place you navigate to; the rest happen where you already are:

```
  Repositories (§4.4, §4.5)      the shelf: Temco code, read or ticked
        │  tick files
        ▼
 ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
 │ MATERIAL §4.8a   │   │ DRAFT §4.18      │   │ PAGE §4.9        │
 │ 41 kB of 12,000  │──▶│ + WRITTEN FROM   │──▶│ *.md in Pages    │
 └──────────────────┘   └──────────────────┘   └──────────────────┘
                                              AI proposes; Accept writes
```

```
      right side bar                    center                      right side bar
┌───────────────────────────┐     ┌────────────────────┐     ┌───────────────────────────┐
│ AI                        │     │ the page           │     │ PAGE                      │
│ ask about the page,       │ ──▶ │ being written      │ ◀── │ Outline · Draft · Props   │
│ read its citations        │     │                    │     │ accept or discard a draft │
└───────────────────────────┘     └────────────────────┘     └───────────────────────────┘
   "help me understand"              "the work"                 "the proposed change"
```

A draft arrives in the PAGE side bar, is settled there, and also appears on **Review** while it waits. Nothing is written
until **Accept**; no draft is applied without a person. A draft that came from code never loses the thread back to it —
**Repo.** is one click from the draft, and one page of the same code file is one click from the repository (§4.5).

---

## 6. Where every action lives

| you want to… | you go to | not to |
|---|---|---|
| start a project | Home ▸ Projects ▸ **+ New Project** | a second "Projects Overview" page |
| read code from a repository | Home ▸ Repositories ▸ **[ Read ]** | the raw registry.json |
| write a page by hand | Docs ▸ Pages ▸ double-click, or `⋯` ▸ **New Page…** ▸ *Nothing* | a section called *Needs You* |
| write a page from code | Docs ▸ `⋯` ▸ **New Page…** ▸ *A repository's code* ▸ tick files | a separate *Drafting* page or container |
| settle a draft | the `1 owed` link, Ship ▸ Review, or the PAGE side bar | three different lists |
| build / release / deploy / export | `[Build]` `[⇪]` in the Docs header, or Ship | four separate pages |
| see why a page is not in the site | Docs ▸ `⋯` ▸ **Registry** | the raw registry.json |
| read what was published | Home ▸ Published site | a *Site* view |
| change a setting | Settings ▸ Settings (left rail) | a container with four views |
| find a shortcut or the logs | Settings ▸ Help | a *Help* container with two views |
| ask about a page | the AI side bar (right) | an activity-bar icon |

Every command id is unchanged, so the palette still reaches all 250.

---

## 7. What is removed, and what absorbs it

| removed | absorbed by |
|---|---|
| *Project* side-bar section | the one-line header in Docs |
| *Needs You* view + Needs You page | **Review** page + the `1 owed` link |
| *Sources* view | the **Project** page (already lists sources with branches) |
| *Publish* view (3 action rows) | `[Build]` `[⇪]` in the header, and `⋯ ▸ Build Center / Releases / Exports` |
| *Repositories* view | **moves** from Docs to Home (still a view; the page stays for the wide work) |
| *Overview* view | **Home ▸ Recent activity** + the project cards |
| *Site* / *Delivery* views | **Home ▸ Published site** page |
| *Profile* / *Platform* / *Learn* / *Support* views | **Settings** page + **Help** page |
| **AI** activity-bar container | the AI secondary side bar (§4.16) |
| Build Center · Releases · Exports pages | **Ship** tabs (bodies moved, not rewritten) |
| 5 AI pages | **AI ▸ Settings** with four tabs (§4.17) |
| 4 registry commands | **Registry** page (the raw file stays one click away) |

19 side-bar views → **7**. ~44 pages → **17**. Nothing is deleted before its content exists elsewhere.

---

## 8. Order of work

1. **Docs panel** — 5 regions → header + tree + `⋯`. No page touched; reversible.
2. **Home** — three lists (Projects · Repositories · Recent) and their pages, including Published site (§4.3, §4.4, §4.6). The
   *Repositories* view changes container only; no code moves. On the page, `[ Draft ]` is added beside `[ Read ]`.
3. **Drafting loop** — the ticker on the repository page (§4.5), the material picker on *New Page* (§4.8a) and `WRITTEN FROM`
   on the draft (§4.18). The parts exist today (`newPagePage.ts`, `codeFiles`/`readMaterials`); this step names them in the UI
   and records the line on the accepted page.
4. **Settings + Help** — two pages with rails (§4.20, §4.21); four views retire.
5. **Ship** — one page, four tabs (§4.15); the three bodies move as they are.
6. **Quality** — Review and Registry (§4.12, §4.13); retire the *Needs You* view and four registry commands.
7. **AI** — the side bar and one settings page (§4.16, §4.17); the activity-bar icon goes.

After each step `npm run check-temco` refuses a view inside a container that no longer exists, so a half-finished step fails
the build instead of showing an empty panel.

---

## 9. Decisions taken here

- **Published site lives in Home** (§4.6) — decided.
- **Four activity-bar icons, kept as designed** — Home · Docs · Tools · Settings. The Settings container keeps its own icon
  but is **drawn as sliders instead of a gear**, because VS Code's own *Manage* gear sits at the bottom of the same column;
  two gears is one meaning too many. Id unchanged, so saved layout survives.
- **Tools stays in the activity bar** with both views untouched, because 94 commands and two of its modules have no manifest
  yet; hiding it would make existing work unreachable.
- **Settings and Help are pages, not containers** (§4.20, §4.21) — decided.
- **Repositories stays a view, under Home** (§2.5, §4.4) — it is a list you work in, so it keeps the free filter, arrow keys
  and collapse of a native view; its page adds the two per-row acts. **It is the shelf of Temco code the documentation is
  written from**, not a library of finished docs: `[ Read ]` cites what a repository already holds, `[ Draft ]` turns ticked
  code files into material for a new page (§4.5 → §4.8a → §4.18).
- **Drafting always starts on one page** — *New Page* (§4.8a) — where the material is chosen before a word is proposed. The
  budget (12,000 characters) and everything left out are stated on that page, and the accepted page keeps a one-line
  `written from` record (repository · files · commit) wherever it is shown. Provenance is part of the page, not a note about it.
- **Ship replaces Build Center, Releases and Exports in one move** (§4.15) — decided. The three bodies move into the four
  tabs unchanged; the three commands stay registered so anything bound to them keeps working, and each opens Ship on its
  own tab.

Nothing in this document has been implemented. Step 1 is the Docs panel, and it waits for a go-ahead.

---

## 10. Look and feel

> **Superseded by a proposal awaiting confirmation:** [welcome-v3-design.md](./welcome-v3-design.md) — Fluent 2 tokens with
> Azure's purchase-options anatomy (three option cards, a brand-tinted wash, numbers, one callout, questions). Read that
> first; the section below describes the version now in the code, which v3 replaces.

The look is the one a developer reads every day (platform.openai.com/docs): **a big quiet title, one line of grey, pill
buttons, and content held in soft panels.** What it replaced was a coloured band with a gradient and a glow; it made the
first screen shout and left every page under it looking unfinished, which is exactly what was wrong with it.

**Implemented.** The rules are in `extensions/temco-ui/media/page.css` (the "document page" layer), the markup in
`extensions/temco-ui/src/components.ts`, and Welcome · Projects · Overview · Documents use it today.

```
  Documentation
  Write the pages of a product, draft them from the code that runs it,
  and publish a site a customer can open.

  [ Search ]  Find a page, a file or a command…            Ctrl P
  ( Create a project )   ( Read a source )

  ┌────────────────────────────────────────────────────────────────────────────┐
  │ Start with a project               │ TypeScript                              │
  │ A project holds the pages, the     │  1  // a page, drafted from the code    │
  │ sources they are read from, and    │  2  const page = await temco.draft({    │
  │ the artifacts a build produces.    │  3    from: 'src/wiring.ts',            │
  │                                    │  4    into: 'guide/wiring.md',          │
  │ ( New project )   ( Add a source ) │  5  });                                 │
  │                                                                            │
  └────────────────────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────────────────────┐
  │ Draft a page from the repository it documents    ( Read a Source )         │
  └────────────────────────────────────────────────────────────────────────────┘

  Build paths                                        [ All Commands ]
  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
  │ ▣ Create… │ │ ▣ Read…   │ │ ▣ Open…   │ │ ▣ Review… │
  └───────────┘ └───────────┘ └───────────┘ └───────────┘

                                                     ( ✦ Ask AI )

  a 34px title, a 15px grey line, pill buttons, a soft panel, a code card,
  a banner, and four dense tiles
```

### 10.1 Near-monochrome, and why

| surface | colour | why |
|---|---|---|
| the page | the theme's own background | a page is not a poster |
| the panel and the banner | `--bg-inset` / `--bg-card` | one step in from the page, no fill colours |
| borders | `--border` | a hairline, never a shadow |
| the one filled button | **the theme's foreground** — black pill in a light theme, white in a dark one | it is the thing to press, and it survives both themes without a second rule |
| the accent (`--az-blue` `#0078d4`) | a link, the 3px rule on the leading figure, a focus ring | three places on a page, or it stops meaning anything |
| syntax in the code card | four tones mixed against the page | reads in a dark theme, and is the only saturated colour on the screen |

**No gradient, no glow, no brand band.** The check fails the build if a gradient reappears in this layer.

### 10.2 Type does the work

| role | size / weight | note |
|---|---|---|
| page title | 34px / 600, `-0.028em` | 27px under 900px wide |
| panel heading | 20px / 600 | the `h2` a section is told apart by |
| body | 15px / 1.7 for the page's line, `--fs-sm` for supporting text | still follows the workbench font |
| code | 12.5px / 1.75, tabular line numbers | numbers drawn, never written into the text |
| small caps, letter-spacing, chips | **none** | the one thing the previous version over-used |

### 10.3 The eight components, and the gate that holds them to the stylesheet

`hero()` (the title block: eyebrow · `h1` · line · field · buttons · figures) · `panel()` (soft box + the code card
beside it) · `code()` (numbered, four tones) · `banner()` (one sentence + one action) · `kpi()` · `section()` ·
`cards(items, { dense })` · `floatAction()`. All are published by `temco-ui` and reached through each module's `ui.ts`,
the same way `page()` and `icon()` are.

`scripts/check-components.mts` runs in `npm run compile` (`check-temco`) and fails the build when:

- a class the components emit has **no rule** in `page.css`;
- a value a person typed reaches the document **unescaped**;
- an option left out still renders an empty element;
- **the code card edits the sample** — the gate parses the rendered card back into plain text and compares it with the
  source lines, because line numbers and colour are drawn, not written;
- a surface stops taking its background from the theme, or the filled button stops being the theme's foreground;
- a **gradient** appears in the page layer.

### 10.4 Where it is used now

| page | title block | panel | banner | figures | sections |
|---|---|---|---|---|---|
| Welcome (`temcoWorkbench.help.welcome`) | yes — with the field and two buttons | yes — "Start with a project" + the drafting sample | yes — the draft-from-repository line | — | *Build paths* (4 tiles) · *Pick up where you left off* · *Guides* (3 walks) · floating **Ask AI** |
| Projects (`temcoDocs.projects`) | yes — with two buttons and four figures | — | — | in the title block | *All Projects* |
| Overview (`temcoWorkbench.platformView`) | yes — two buttons, four figures | — | — | in the title block | *Documentation Pipeline*, feeds, cards |
| Documents (`temcoDocs.documents`) | — (page head kept) | — | — | yes — pages · read · missing · problems | — |

Next surfaces to take it: the AI dashboard, the Tools pages, the Ship tabs.

### 10.5 Translating pages, and translating the interface

Two different jobs, kept apart on purpose.

**Pages** — `Temco Docs: Translate This Page…` turns the page in front into a sibling file (`setup.md` → `setup.de.md`)
using an Azure AI Translator resource. The service is given *sentences*, never the file: `translate.ts` cuts the page into
segments whose concatenation reproduces it exactly, sends only the prose, and puts everything back — code fences, inline
code, table rules, link targets, image paths, front matter, line markers. That invariant is a build gate, not a comment.
`scripts/check-translate.mts` proves it with a fake transport that echoes its input: the page comes back byte for byte, a
fenced sample never appears in what was sent, and each failure a person can meet (401, 403, 429, unreachable, a short
answer) is a sentence about what to do. Proved by negative test: removing the front-matter rule fails the gate by name.

The key is a secret in the OS keychain (`context.secrets`); the endpoint and region are settings — where the resource
lives is configuration, who may use it is not.

**Interface** — strings on the new surfaces go through `vscode.l10n.t()`, so a bundle can be dropped in without touching
code. The rest of the application is still plain English; the rule from here is that a string a person reads is marked.
