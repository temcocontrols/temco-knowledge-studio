# The application: shell, screens and flow

The record of the agreed shape of Temco Platform as an application — the regions of the window, the screens, the way one
leads to the next, and the two rules the design is built on. It is the design of record: a surface that disagrees with it
is either a bug or a proposal to change this file.

Confirmed 2026-10-27. Decisions and their reasons are in *What was decided*; the work order is in *Order of work*.

To **use** the application rather than design it, read [operating-manual.md](./operating-manual.md): the same flow as click-by-click steps, with the button for every page and the command id behind it.

## The two rules

1. **A VS Code view is native.** The workbench draws a tree view; an extension cannot put Fluent inside one. So the left
   panel is a Fluent **header + chips + footer** (a webview view) above a **native Pages tree**. The tree keeps reveal,
   drag, multi-select, keyboard and accessibility for free — the parts where re-implementing costs the most and shows the
   least.
2. **One project is one window state.** Switching project re-reads and lands on the dashboard. Nothing keeps describing
   the project that was open before.

## The regions

```
┌────┬───────────────────┬───────────────────────────────────────────┬──────────────────┐
│ A  │  LEFT PANEL       │  EDITOR AREA (tabs)                       │  RIGHT PANEL     │
│ C  │  project card     │  dashboards · forms · the page editor     │  Outline         │
│ T  │  search           │                                           │  Draft           │
│ I  │  status chips     │                                           │  Properties      │
│ V  │  pages tree       │                                           │                  │
│ I  │  build/release    │                                           │                  │
│ T  │                   │                                           │                  │
│ Y  │                   │                                           │                  │
├────┴───────────────────┴───────────────────────────────────────────┴──────────────────┤
│ OUTPUT · PROBLEMS · TERMINAL        build log · registry diagnostics · the repo's tasks│
├───────────────────────────────────────────────────────────────────────────────────────┤
│ Contoso T3000 · 2 sources · 148 pages · 3 stale · v1.4 · Build ✓ 10:42 · Pages ✓        │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

## Activity bar: five entries

| | entry | contains | today's views |
|---|---|---|---|
| ◉ | **Home** | projects, recent, what needs you, Learn | `temcoDashboard` (projects, platform, activity) + `temcoLearn` |
| ▤ | **Docs** | the workspace: pages, sources, publish | `temco` (pages, needs-you, sources, publish) + `temcoRepositories.list` |
| ✦ | **AI** | chats, models, drafts | `temcoAiHub` + the `temcoAi` secondary sidebar |
| ⚙ | **Tools** | SQL Studio, and the modules not written yet | `temcoSql` |
| ⚙ | **Settings** | profile, platform, Help | `temcoSettings` + `temcoHelp` |

Eight icons became five: three are places to *be* (Home, Docs, AI), two are where you *configure* things. `Repositories`
moved into Docs ▸ Sources, `Learn` into Home, `Help` under Settings. No view is deleted.

**Implemented** (2026-10-27): the five containers exist with those titles, `temcoRepositories.list` is contributed under
`temco`, and the `temcoLearn`/`temcoHelp`/`temcoRepos` containers are gone. Container **ids** were kept where they were
already used (`temcoDashboard`, `temco`, `temcoAiHub`, `temcoSql`, `temcoSettings`) so saved layout and `onView`
activation keep working — only titles and view membership changed. The guard in `build/check-temco-modules.ts` now refuses
a view pointed at a container nobody declares, which is the mistake this consolidation can make silently.

## Screens

| # | screen | center | left | right |
|---|---|---|---|---|
| S1 | **Home — no project** | hero: New project · Open a source · recent | projects tree | — |
| S2 | **Create project** | 3-step form: name/slug/version → where → what is in it | — | — |
| S3 | **Home — project selected** | stat cards (pages, drafts, stale, issues) + *needs you* rows + last build/release | project tree | — |
| S4 | **Add source** | — | inline form in Sources | — |
| S5 | **Docs workspace** | the page editor or a dashboard tab | **Fluent panel**: project card · search · chips · pages tree · build/release footer | Outline · Draft · Properties |
| S6 | **Registry review** | two panes: areas ↔ pages, with issues, and *Fix* | as S5 | — |
| S7 | **Page editor** | Temco Editor: one-row bar, paper, status strip | as S5 | Outline (default) · Draft · Properties |
| S8 | **New page** | kind · title · area · order · ships → creates file + registry row → **S7** | as S5 | — |
| S9 | **Preview / Diff** | beside the editor: the published layout, or the diff against HEAD | as S5 | — |
| S10 | **Build** | step list (Resolve → Render → Assets → Sitemap), streaming log, result card | as S5 | — |
| S11 | **Release** | version, what ships, destination `releases/<version>/`, a confirmation naming every value | as S5 | — |
| S12 | **Deploy to Pages** | repo · address the site will have · what will be committed · **Publish**; never force-push | as S5 | — |
| S13 | **Export** | format cards: site `.zip` · single-file HTML · Markdown bundle · (`.docx`) · scope | as S5 | — |
| S14 | **AI** | conversations, models, the answer with page citations | conversations + runtime | — |
| S15 | **Learn** | the site: documentation · training · tests · products · Q&A · topics, then the reader for one version | the site folder | — |
| S16 | **Settings** | profile · platform (theme, AI runtime, build defaults, Pages branch) | sections | — |
| S17 | **Help** | search, topics, support (logs, diagnostics) | topics | — |

Screens S1–S13 are the documentation journey; S14–S17 are the platform around it.

## Navigation

| from | action | to |
|---|---|---|
| anywhere, no project | launch | S1 |
| S1 | New project | S2 → S6 |
| S2 | Create | S6; the status bar switches to the new project |
| S5 tree / S3 row | a page | S7 (same tab), split on `Ctrl+click` |
| S6 | a row | S7, or the issue in the page's own Problems |
| S7 | Build | S10 → S11 → S12 |
| S11 | Release | S12 (toast), S10 keeps the result |
| S12 | Deploy | stays; status bar `Pages ✓` and the URL opens |
| S13 | Export | stays; the file is revealed in the OS |
| any | a registry error | S6 with the issue selected |
| any | the project in view is gone | S1 |

## The publish journey

```
create project ─▶ add source ─▶ registry ─▶ write ─▶ validate ─▶ BUILD ─▶ RELEASE ─▶ DEPLOY ─▶ EXPORT
                                    (S6)      (S7)     (S6)      (S10)     (S11)     (S12)    (S13)
```

- **Build** renders the registry itself: `dist/site/<page>.html` from `marked`, one stylesheet, `sitemap.xml` (only when
  the GitHub remote gives a real address), `.nojekyll`. A project that already has its own `docs:site` / `docs:build`
  script keeps using it — the generator is the fallback that makes "a folder of `.md` files" buildable.
- **Release** freezes `releases/<version>/` and records it in the catalog (already built).
- **Deploy** commits the built site to the branch Pages serves and pushes it — a plain, fast-forward push, never a forced
  one: if the branch holds work this build does not know about, that is reported instead of erased. The commit is made in
  a throwaway repository whose only parent is the branch's tip, so the project's own working tree is never touched.
  The one-time Pages switch (`Settings → Pages → Source: branch “gh-pages”, folder “/”`) is attempted through the `gh` CLI
  when it is installed, and printed as two clicks when it is not.
  **Why not Actions:** the generator reads the documentation registry, which only exists inside this extension, so a CI job
  cannot run it. An Actions workflow would need a second copy of the renderer inside the project — a copy that goes stale
  the first time either side changes. CI publishing becomes possible again the day a project owns its own renderer; the
  branch push is what makes publishing work until then.
- **Export** is local and dependency-free: the site as a `.zip`, any page as one self-contained HTML file, the pages and
  their media as a Markdown bundle. The zip writer is in the module (`src/zip.ts`, store + deflate over a CRC32 table)
  rather than a dependency, because an export a colleague cannot open is not an export. `.docx` needs a writer package
  (`mammoth` is import-only) and is still owed.

## Temco Learn

Temco Learn is its own module (`extensions/temco-learn`, the tenth), because a reader-facing website is not the same job as
keeping a page in step with the code. One working area — `temcoRepositories.workspaceFolder`, `~/Temco` when unset — holds a
`site/` folder, and that folder is the whole website a reader opens:

- the site: `index.html` (one section), `project.html` (one project and its versions), `reader.html` (one version), plus
  `assets/site.css`, `assets/reader.css` and `assets/site.js`. The shell and styles are copied in from the module on every
  refresh, so the site can be updated without losing data; the script is `src/siteApp.ts` — TypeScript, because the repository
  keeps no JavaScript of its own — compiled to `out/siteApp.js` and written in as `assets/site.js`, which is why
  `site/assets/` holds no script in the repository;
- `projects.json`: every project with its section, its versions and each version's pages in reading order;
- one folder per project and version holding a build exactly as it came out (`dist/site`).

**The website carries nothing about running it.** No overview, no management page, no status: a reader sees the six sections,
a project and its versions, and the pages. Everything about operating the module is an application page or the panel, and the
brand on every page of the website goes back to Documentation.

`Add to Site` copies a build in, takes the project name from the build's own `<title>`, and records its pages in the order the
build's `index.html` links them; only the version is asked. `Preview` serves that folder on loopback and shows it as a page —
the website a reader would see, with the same URLs the published site will have. `Publish` commits the folder and pushes
`gh-pages`.

**Overview is an application page** (`src/overview.ts`, view type `temcoLearn.overview`), drawn with `temco-ui` the way
every other page of ours is, and it is never published. It opens by saying what the module is, in three sentences — the
website, the projects that feed it, and what a reader opens — with one note line for the publish state and the two ways in.
There is deliberately **no figures row**: a number without a sentence around it was the thing nobody could read. Then, in
this order: the page's single callout (what needs doing, or that nothing does, or that nothing has been built yet); the flow
as three numbered option cards — *Build a project · Add it to the website · Publish the website* — each with what it writes,
its live count on the button, and the recommended step drawn on the brand tint; **Projects on the website**, one row per
project ending in *All versions*; **What each build wrote**, one row per project listing every output with its size and the two
acts (*Look at it · Save a copy*); and **Where it goes**, the address, the branch and the last publish. The module therefore
depends on `temcocontrols.temco-ui`, exactly as `temco-docs` does.

A build is not one thing. `temco-docs` writes the site (`dist/docs` or `dist/site`), an offline help file (`.chm`, inside the
repository or in a `HelpDocs` folder beside it), often a `.pdf`, and the exports it keeps in `dist/` — a zip of the site, a Word
document, single pages. `src/artifacts.ts` reads those three places per project and reports what is there: nothing is invented, so
a project with no `.chm` simply has no `.chm` row, and a file in a shared `HelpDocs` folder belongs to the project it is named
after. Each artifact is either something to look at (`site`, `chm`, `pdf`, a single page) or something to take away (`zip`, `docx`),
which is the divide the panel draws.

The panel is **four views in the container**, the way Home is three — VS Code draws the header, the separator and the
collapse state, so the grouping is the one a person already knows from the Explorer, and each section carries its own
title-bar actions. A row is a name and a glyph, and what it holds is `TreeItem.description` — the grey words the Explorer
writes beside a folder (`3 versions`), never a badge of our own. Sentences live on the Overview page and in tooltips, never in
a row.

| view | rows | the grey words |
|---|---|---|
| **Overview** | one row, `Temco Learn`, which opens the page | — |
| **Browse** | `Preview the site` (the whole site at one address), **Preview by project** (a project, then its versions) | projects, versions |
| **Download** | a project, then the files its build wrote (this view starts small: `initialSize: 2`) | files per project, then their size |
| **Next steps** | Waiting to be added (each build under it), `Publish`, Build a project | builds waiting, changes waiting |

**Browse** separates the two questions a person asks of a site. **Preview the site** is the thing readers open — the six
sections over every published project, at one address — and it carries no count: a page total beside it is noise. **Preview by
project** (a library of projects) is the same content one project at a time (project → version → pages), which is how you check
whether one page is out; the first project is open by default, so the view never reads as a list of shut doors, and neither a
version nor the site row carries a page count. A project row writes the project's **name**, without the "docs" a build's own
page title usually ends with (`Test1 docs` reads as `Test1`); the title itself is never rewritten, because the site is keyed by
it. There is deliberately no group of `dist` builds: the build as written is a file on disk, which is the page's *Build
outputs* and the Download view's business, not something to read here.

**Next steps** is where the acts live, and publishing is one of them: `Publish` pushes the site folder to `gh-pages` the first
time and again after a change, and the words beside it are how many changes are waiting (`up to date` when none are). It is an
act, so it belongs with the other acts, not with the site it publishes.

Nothing is invented: a project with no `.chm` has no `.chm` row, an empty view says so in one row, and "Nothing to do"
appears only when every build is on the website and everything is published. Publishing state is read from git
(`src/state.ts`), so two machines never disagree about what is out, and the panel never asks for a folder: the folder is
the convention, not a question.

Answers appear in the **preview's own strip**, under its address bar, and never in a notification: adding a build, building,
publishing, and every failure say what happened there, with at most one thing to do next. Only the *inputs* stay native — the
version box, and the build picker when a row did not name its build.

## Design system

- **Fluent v9** (`@fluentui/react-components`, `@fluentui/react-icons`) with the brand ramp seeded from Azure blue
  `#0078D4` through `createLightTheme` / `createDarkTheme`, following VS Code's light, dark and high-contrast through
  `data-vscode-theme-kind`. The package named *Azure theme* (`@fluentui/azure-themes`) is v8/Fabric and does not apply.
- **Tokens**: spacing 4 / 8 / 12 / 16 / 24 · radius 4 / 6 / 10 · type 20 / 16 / 14 / 13 / 11 · row 22 (compact 20) ·
  status colours taken from the VS Code chart colours, so a chip, a dot and the status bar cannot disagree.
- **Row anatomy**, one component reused everywhere: `[icon] title · meta · status dot · hover actions`.

## What was decided

| question | decision |
|---|---|
| activity bar | five: Home · Docs · AI · Tools · Settings |
| left panel | Fluent header, search, chips and footer in a webview view; the Pages tree stays native |
| build | our own generator, so a project with only `.md` files builds; a project's own `docs:site` still wins |
| deploy | build in the editor, push to `gh-pages` with a plain (never forced) push; the one-time Pages switch via `gh` when available |
| export | site `.zip`, single-file HTML, Markdown bundle; `.docx` optional |
| order of work | generator → deploy → export → panel and shell |

## Order of work

1. **Generator** ✅ — `src/siteRender.ts` (pure: slugs, page shell, index, sitemap, one stylesheet), `src/site.ts` (host:
   read, render, write, copy media), `scripts/check-site.mts` (10 cases); `Build the Site` falls back to it.
2. **Deploy** ✅ — `src/pages.ts` (the remote decides the sitemap's address) and `src/git.ts` shared with the diff command.
   The push itself lives in `temco-learn` (`src/publish.ts`: `ensureRepo` for a folder that is not a repository yet, then a
   plain, never-forced `git push origin HEAD:gh-pages`; `scripts/check-publish.mts`, 4 cases against a real bare repository);
   `temcoDocs.publishSite` stays behind as a redirect. Still owed: the status-bar state and the confirmation screen S12.
3. **Export** ✅ — `src/zip.ts` (a real archive writer: store, deflate, CRC32), `src/export.ts` (site zip, single-file
   page, Markdown bundle; `temcoDocs.export` + three commands), `scripts/check-export.mts` (5 cases that read the archive
   back). Still owed: `.docx`. Then the panel.
4. **Panel and shell** — *(in progress)* the activity bar is five entries ✅; the **Project** strip above the native Pages
   tree ✅ (`src/panelView.ts`, `check-panel.mts`); the **status bar** ✅ (`src/statusLine.ts`, `check-status.mts`); **S3**
   (the project dashboard) ✅ inside the Project Detail page: pages · drafts · stale · issues, a *Needs you* group, and
   *Last out of the building*; **S13** ✅ as the **Exports** page (`temcoDocs.export` opens it; the three shapes are still
   their own commands, plus **`.docx`** from `src/docxWrite.ts` — Word's format is a zip of XML, so it needs no dependency);
   **S12** ✅ folded into the Releases page as *Where It Publishes*; **S1** ✅ the Projects page opens itself when the window
   is on no project and has no tab; **S6** ✅ as *The Registry* page — every entry with the reason it might not appear in the
   site, and one action per reason; **S10** ✅ the generator reports its steps (Resolve → Render → Assets → Sitemap) to the
   notification and the output channel as they happen; **S11** ✅ publishing a release confirms first, naming version,
   destination and file count.

   **Phase 4 is done, and so is every gap the screen audit found.** What remains for the shell is the tabbed *Ship* surface
   (Build · Release · Deploy · Export as one page) — deliberately not built: after the cross-links and the Exports page, the
   four surfaces point at each other, so it is polish rather than a gap.
   The status line deliberately carries the window's facts (project · pages · issues) and not the version or the last build:
   those need the catalog, and a catalog read on every file save is too high a price for a status bar. The strip in the side
   bar shows them instead, from a render that already had a reason to read the catalog.
**Overview is an application page** (`src/overview.ts`, view type `temcoLearn.overview`), drawn with `temco-ui` the way every
other page of ours is, and it is never published. It opens with the sentence that says what the module is for — *Temco Learn
publishes the documentation website* — continued by the counts it reads from the snapshot (*3 projects are published today, 7
versions and 42 pages between them*) so no project name is ever written into the prose. Then, in this order: one callout for what
needs doing (or that nothing does, or that nothing has been built yet); **Publishing workflow**, four cards — *Build · Add ·
Publish · Download* — one line each, each ending in the link that performs it (`Open Temco Docs`, `Choose a build · 1 waiting`,
`Publish · 3 changes`, `Show in the folder`); and the three parts the work lands in — **Published projects**, **Build outputs**,
**Publication**. Each part is a heading with a 2 px brand bar, a sentence with the live counts, the rows it is about, and its
acts along the **bottom edge**, never at the right of the heading. A project row opens that project's page on the website; a
build-output row is the **project** and opens that project's build folder — the files themselves are the panel's Download view,
so the page never names a `.chm` or an `.html`. Publication puts the address, the branch GitHub Pages serves and the last publish
on **one line**, keeps what is waiting beneath it, and says how publishing works.
**Add a build** never opens a picker: it brings the *What Needs Doing* view forward with the waiting group open, because the
builds to choose are already rows there. A link on this page is text with a glyph (`temcoLearn.*` command), never an `href` into
the website — that boundary was crossed once already. The module therefore depends on `temcocontrols.temco-ui`, exactly as
`temco-docs` does.

A build is not one thing. `temco-docs` writes the site (`dist/docs` or `dist/site`), an offline help file (`.chm`, inside the
repository or in a `HelpDocs` folder beside it), often a `.pdf`, and the exports it keeps in `dist/` — a zip of the site, a Word
document, single pages. `src/artifacts.ts` reads those three places per project and reports what is there: nothing is invented, so
a project with no `.chm` simply has no `.chm` row, and a file in a shared `HelpDocs` folder belongs to the project it is named
after. Each artifact is either something to look at (`site`, `chm`, `pdf`, a single page) or something to take away (`zip`, `docx`,
and the files that are both), which is the divide the panel draws.

The panel (`src/tree.ts`) is four views in the order the questions are asked — **Overview** (one row: the page above),
**Browse** (`Preview the site` with the page count, **Preview by project** with a row per project — the first one open — and
its versions under it), **Download** (`2 files` — a project, the files its build wrote, with their sizes; a row saves a copy
and offers *Show in the Folder* inline), and **Next steps** (`1 build` — the builds newer than what the website holds, opening
onto the build to add, `Publish` with the changes waiting, and where building happens: in Temco Docs). What a row holds is its
`description`: the grey words beside a name, as the Explorer writes them. A row has no sentence under it: what a view is *for*
is its tooltip and, written out, the Overview page.

