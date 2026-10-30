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
keeping a page in step with the code. **The website itself is a separate repository** — `temcocontrols/temco-learn`, Vite ·
React 19 · Fluent UI v9 · Markdown — and this module is a *client* of that checkout: it runs the site's own servers, builds it,
shows it, writes new builds into it, and commits the result. Nothing about rendering the site lives here any more, so the site
can be worked on, built and published by someone who never opens the editor.

`temcoLearn.siteRepo` names the clone (empty means `~/Temco/temco-learn`). Everything below is a fact about that folder:

- `content/<project>/site.json` — the project's title, section and summary; `content/<project>/<version>/*.md` — the pages a
  person writes, with front matter for the title;
- `public/imported/<project>/<version>/` — a project's own build HTML, copied in as it came out;
- `public/catalog.json` — the one file both the website and this module read. `npm run catalog` folds the two sources above
  into it (order, titles, versions, `builtAt`), so the panel cannot list a page the site does not have. A second reader of a
  second shape is how a panel and a page start disagreeing;
- `package.json` scripts — `client-dev` (Vite at 3003), `build` (catalog + search index + `tsc` + `vite build`), `serve`
  (the built site at 1011), `catalog`, `search`, `check`;
- `.github/workflows/pages.yml` — a push at `main` builds the site and hands `dist` to GitHub Pages. The built site is never
  committed: what is published is the source and the catalog it generates.

**The module runs the site, it does not re-implement it.** `src/siteRunner.ts` spawns the repository's own scripts through
`npm`, tracks one server at a time (`preview` = `serve`, `development` = `client-dev`), and treats "starting" as distinct from
"running": it polls the address until it answers, so a frame is never pointed at a port with nothing behind it. `Stop` kills
the process tree and waits for the port to go quiet, because `npm` hands the server to a child that can outlive the kill. A
`dist` that was never built is built before the first preview, rather than served as an empty folder.

**`Preview` is a panel framing the running site** (`src/preview.ts`, `temcoLearn.site.preview`), with a bar that says what is
running (`running · 1011`), then `Reload · Browser · Stop` — no address bar, because the address is not a question: the site's
own scripts own their ports, and a person who wants the site is not choosing a URL. Closing the panel does not stop the
server, the way closing a browser tab does not stop a website; `Stop` does. `Add to Site` copies a build into
`public/imported/<project>/<version>/`, writes the `site.json` the catalog needs (the title comes from the build's own
`<title>`), runs `npm run catalog`, and shows the new version — only the version is asked, and it is asked once, in the
version box, never in a notification. `Publish` commits the clone and pushes it at `main`; it refuses a folder that is not a
clone instead of initialising one, because an empty history pushed at a real site is worse than a refusal.

**Overview is an application page** (`src/overview.ts`, view type `temcoLearn.overview`), drawn with `temco-ui` the way
every other page of ours is, and it is never published. It opens by saying what the module is — the documentation website,
built from its own repository, Markdown under six sections, one folder per project and version — then counts what is on it
today. There is deliberately **no figures row**: a number without a sentence around it was the thing nobody could read.
Then, in this order: the page's single callout (what needs doing, or that nothing does, or that nothing has been built yet);
the flow as four numbered option cards — *Build · Add · Publish · Download* — each ending in a link that performs it;
**Published projects**, one row per project ending in a link to the site; **Build outputs**, one row per project that jumps to
the folder its build wrote; and **Publication**, the address, the branch (`main · built and served by GitHub Actions`) and
the last publish on one line, with what is waiting under them. The module therefore depends on `temcocontrols.temco-ui`,
exactly as `temco-docs` does.

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
| **Browse** | **Site** (`Preview`, `Development`, `Open in Browser`, `Build`, `Install Dependencies`, `Stop`, `Source Folder`), then **Projects** (a project, then its versions) | what the server is doing, or the folder's name; versions per project, pages per version |
| **Download** | a project, then the files its build wrote (this view starts small: `initialSize: 2`) | files per project, then their size |
| **Next steps** | Waiting to be added (each build under it), `Publish`, Build a project | builds waiting, changes waiting |

**Browse** answers two questions, in that order. **Site** is the repository itself, and its description is the answer to
"is it running?": `running · 1011`, `starting…`, `stopped`, `failed` (with the reason in the tooltip). A clone that is not
there collapses to one row — `Choose the Site Folder…` — because a fresh machine has exactly one question to answer. **Projects**
is the site as a reader gets it, one project at a time: a project row opens its newest version and a version row opens that
version, both at `#/<project>/<version>/` on the running server, starting it first if it is stopped. The first project is open
by default, so the view never reads as a list of shut doors, and a project writes the project's **name**, without the "docs" a
build's own page title usually ends with (`Test1 docs` reads as `Test1`). There is deliberately no group of `dist` builds: the
build as written is a file on disk, which is the page's *Build outputs* and the Download view's business, not something to read
here.

**Publishing has a page** (`src/publishPage.ts`, `temcoLearn.publishing`), opened by the `Publish` row: the branch and the
address, the steps of a publish with the act that performs each, how much is waiting, and the lines the last attempt
printed — `src/publishLog.ts` keeps them for the window, and `publishSite` writes to a sink that feeds both the output channel
and that log. **Downloads has a page** (`src/downloadPage.ts`, `temcoLearn.downloads`), opened by the Download view's empty row
and by its title bar: what a build writes, where each kind lands, and the files that are on this machine.
**Next steps** is where the acts live; `Publish` sits there first and again after every change, and the words beside it are how
many changes are waiting (`up to date` when none are). It is an act, so it belongs with the other acts, not with the site it
publishes.

Nothing is invented: a project with no `.chm` has no `.chm` row, an empty view says so in one row, and "Nothing to do"
appears only when every build is on the site and everything is published. Publishing state is read from git
(`src/state.ts`) in the clone, so two machines never disagree about what is out.

Answers appear in the **preview's own strip**, under its bar, and never in a notification: adding a build, building,
publishing, and every failure say what happened there, with at most one thing to do next. Only the *inputs* stay native — the
version box, and the build picker when a row did not name its build, and the folder dialog for a clone that has not been
chosen yet.

﻿**Settings → General is a bundled Fluent page** (`webview/settings/`, React 19 + Fluent UI v9), not markup generated in the
extension host: the tokens are Fluent's, the brand is Azure's blue, and every control is a real Fluent control. It is drawn
in the house page language rather than a settings template — the brand wash with an eyebrow, a title and a note; one tinted
callout; a section heading with the 2px Azure rule before it; an entry row per setting with its control at the right-hand
end; a facts band; and links at the foot of the last block. `main.tsx` imports `temco-ui`'s `media/page.css`, so the wash, the
rule, the row and the buttons are the same rules Temco Learn's Overview page is drawn by and the two pages cannot drift.

The host's half is narrow: `src/settingsPages.ts` builds the bundle when a source tree has none (a compile wipes `out/`),
hands the webview `settings.js` and `settings.css` under a content-security policy that allows nothing else, and answers three
messages — `ready` with one state, `setting` with a key to write, `command` to run. A refresh is a new state and never a new
document, so a write does not throw away the reader's scroll. `npm run build-webview` builds it; `build-webviews` and
`vscode:prepublish` run that too.

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
   The push of a site lives in `temco-learn` (`src/publish.ts`: `ensureRepo` refuses a folder that is not a clone, then a
   plain, never-forced `git push origin HEAD:main`; `scripts/check-publish.mts`, 5 cases against real throwaway
   repositories);
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

