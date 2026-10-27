# Operating manual — from an empty workspace to a published site

This is the click-by-click companion to [application-design.md](./application-design.md). Every button named here exists; the command id beside it is the same action under `Ctrl+Shift+P` (`View → Command Palette`), which is how you reach it when a view is hidden or a build has made a control unavailable.

Read it once end to end, then keep §11 (**all the buttons, one page**) open while you work.

---

## 1. The shell, and where the five things live

```
┌────┬────────────────────────────┬──────────────────────────────────┬──────────────────┐
│ ◫  │ PROJECTS            ＋ ⊞    │                                  │ OUTLINE          │
│ ▤  │  ▪ Temco Handbook          │   the page you are writing,      │  ▸ Overview      │
│ ✦  │    current                 │   opened in the Temco editor     │  ▸ Commissioning │
│ ▷  │  ▪ Spare                   │                                  │                  │
│ ⌗  │                            │ Undo Redo │ Style ▾ Lists ▾ ···  │──────────────────│
├────┼────────────────────────────┼──────────────────────────────────┼──────────────────┤
│ ⚙  │ OVERVIEW                   │                                  │ DRAFT            │
│ ?  │  12 pages · 2 owed         │   ┌──────────────────────────┐   │ the AI version   │
│    │                            │   │  # Commissioning         │   │ beside yours     │
│    │ RECENT ACTIVITY            │   │  Wire the harness to     │   │                  │
│    │  edited Commissioning      │   └──────────────────────────┘   │                  │
│    │                            │                                  │                  │
└────┴────────────────────────────┴──────────────────────────────────┴──────────────────┘
 ▲    ▲                            ▲                                  ▲
 │    │                            │                                  └─ secondary side bar: Outline and the draft (§6)
 │    │                            └─ editor area: the page, and the tool pages
 │    └─ side bar: the views of the container you picked
 └─ activity bar: Home · Docs · AI · Tools · Settings
```

Five entries, and every view is under one of them:

| Container | Views, top to bottom |
|---|---|
| **Home** (house) | **Projects** · **Overview** · **Recent activity** · **Site** · **Delivery** |
| **Docs** (book) | **Project** · **Pages** · **Needs You** · **Sources** · **Publish** · **Repositories** |
| **AI** (spark) | **Assistant** · **Runtime** |
| **Tools** (grid) | **Query & Browse** · **Schema & Maintenance** |
| **Settings** (gear) | **Profile** · **Platform** · **Learn** · **Support** |

The manual never says "click the book icon" without naming the view, because the view is what carries the buttons.

The **Project** strip at the top of **Docs** is not a tree — it is the answer to "what am I looking at":

```
  Temco Handbook  [v1.4.2]
  148 pages · 3 issues
  ( Pages 148 )  ( Needs you 2 )  ( Validate )
  [ Find a page… ]
  ─────────────────────────────────────────────
  built 3 h ago                     [ Build ]  [ Publish ]
```

Its chips run the same commands as the views below (`temcoDocs.documents`, `temcoDocs.review`, `temcoDocs.validate`), **Find a page…** searches every page in the project and opens the one you pick, and the footer builds or publishes without leaving the side bar.

The **status bar**, bottom left, carries one item about the same project:

```
$(book) Temco Handbook · 148 pages · $(warning) 3
```

`$(error) N` replaces the warning when a registry file cannot be read at all. Click it to run **Validate**; hover for the sources, the pages nobody has reviewed and how many things are waiting for you. It hides itself entirely when the window has no documentation, because "0 pages" on a project nobody has started is an accusation, not information.

---

## 2. The whole flow on one line

```
create project ─▶ add material ─▶ write pages ─▶ validate ─▶ BUILD ─▶ RELEASE ─▶ PUBLISH ─▶ EXPORT
   step 3           step 4          step 5          step 7     step 8    step 9      step 10    step 12
```

Steps 3–7 are where the writing happens; 8–10 and 12 are a few clicks and a wait each.

---

## 3. Step 1 — Create the project

**Activity bar → Dashboard → view `Projects` → the `+` in the view title** (command `temcoProjects.newProject`, *Create a Project*).

Afterwards, **right-click the project → Project Detail** (`temcoDocs.projectPage`) is the project's own dashboard in the center: cards for pages, drafts, stale pages and issues; a **Needs you** group when drafts are waiting; and **Last out of the building** — the newest build and release, with **Open** and **Serve** on the release.

The form opens in the editor area. It is one screen, split in two — a rail on the left and the form on the right:

```
  START FROM (left rail)              THE FORM (right)

  > Empty project                     <the title, which follows the choice>
    No sources yet

  > From a repository                 THE PROJECT
    Cite what we have already read      Name      [ Temco Handbook      ]
  > From existing files                 Version   [ 1.0.0               ]
    Markdown, HTML, Word, CHM
                                      WHERE THE PAGES COME FROM
                                        Starter   [ Nothing - begin with no pages  v ]
                                                  User guide - docs/help with an Overview
                                                  area, two topics and a registry
                                        Write it  [ ~/Documents/Temco   ]  (starter only)

                                      WHAT IT BUILDS
                                        [x] Website   [ ] PDF   [ ] Offline help
                                        [ ] Search index   [ ] AI index

                                      summary of the choice      [ Create Project ]
```

The right-hand body changes with the rail: *From a repository* lists the sources already recorded, *From existing files* shows one **Choose a folder or file…** button and the path it picked.

1. Pick **Start from** on the left. For a brand-new handbook: *Empty project* + *User guide* starter, which writes `docs/help/` with an Overview area, two topics and the registry.
2. Fill **Name** and **Version**. The version is what a release is stamped with — publishing is per version.
3. Tick **What it builds** (Website is enough to start).
4. **Create Project**.

Nothing is written to disk until you click **Create Project**. Afterwards the project appears in the `Projects` view with the marker **current** — that is the project every other view reads.

> Wrong project later? Right-click a project → **Start** (`temcoProjects.openProject`) to switch. `Documentation → Pages` follows whatever is current.

---

## 4. Step 2 — Add the material (skip if you used a starter)

Two doors, same result:

- **Dashboard → Projects → right-click the project → Edit** (`temcoProjects.editProject`) — the project's own page, where sources are recorded.
- **Documentation → Pages → view title → `Add a Source`** (`temcoProjects.addSource`, the plug icon next to `＋`).

A **source** is a repository, a folder or a document the pages are written from. For "I already have a `docs/` folder":

**Dashboard → Projects → `+` → Start from: From existing files → Choose a folder or file…**

```
   ▸ From existing files
       [ 📁 Choose a folder or file… ]   ~/work/product/docs
       A folder that already has a registry is cited as it stands;
       anything else — Markdown, HTML, Word or CHM — is converted
       once into docs/ and docs/help/registry.json.
```

---

## 5. Step 3 — Write pages

**Documentation → view `Pages`.** Its title bar carries the verbs, in this order:

```
  PAGES                                    the tree below
  ---------------------------------------  ------------------------------------
  +     New Page                           then pick the kind of page
  []    New Folder...                      a chapter under the area
  ..    Add a Source                       cite a repository, a folder, a document
  ()    Capture a Screenshot               drag a rectangle on screen
  __    Paste Screenshot                   straight from the clipboard
  (o)   Refresh                            re-read the registry
```

The stand-in marks in that figure are the real title-bar icons, in order: `＋` `📁` `🔌` `📷` `📋` `⟳`.

| To do this | Click |
|---|---|
| Add a page | `＋` (**New Page**, `temcoDocs.newPage`) — then pick the kind from the submenu: *New Article Page*, *New Task Page*, *New Reference Page*, *New Troubleshooting Page*, *New Release Note Page* |
| Add a folder | `📁` (**New Folder…**, `temcoDocs.newChapter`) |
| Rename / reorder / retire | right-click the page → **Rename the Page Title**, **Move the Page Up**, **Move the Page Down**, **Retire the Page** |
| Open the page | double-click the row, or right-click → **Open the Page** |
| Open a page that has no file yet | right-click the `missing` row → **Create the Missing Page File** |

Write in the row's own context menu when you want to be precise; the `Pages` title overflow (`…`) also holds **Validate**, **Overview**, **Open Registry** and **Import a Word Document**.

---

## 6. Step 4 — The editor: where the writing happens

Double-clicking a page row opens it in **Temco Editor** — the custom editor that owns `*.md`. One row, no tabs. Left to right, then the right-hand group:

```
  1  Undo   Redo
  2  Style v            paragraph, heading level, alignment of the block
  3  Lists v            bullet, numbered, task list
  4  B  I  U  S  code  highlight      bold, italic, underline, strike, inline code, mark
  5  quote   code block   rule   table
  6  Picture   Screenshot   Annotate   Link to page
  7  ...               everything the row has no space for
                                  ------------------ right-aligned ---------------
  8  Find   Outline   Read/Edit   Preview   Diff   Source   Properties
```

1. **Undo / Redo** — `Ctrl+Z`, `Ctrl+Y`
2. **Style ▾** — paragraph, heading level, alignment of the block
3. **Lists ▾** — bullet, numbered, task list
4. **Marks** — bold `Ctrl+B` · italic `Ctrl+I` · underline `Ctrl+U` · strikethrough `Ctrl+Shift+X` · inline code `Ctrl+E` · highlight `Ctrl+Shift+H`
5. **Blocks** — block quote `Ctrl+Shift+B` · code block `Ctrl+Alt+C` · horizontal rule · table
6. **Insert** — **Picture**, **Screenshot**, **Annotate the picture** (enabled only when a picture is selected), **Link to page**
7. **`···`** — everything the row does not have space for, including *Open the source*, *Page properties*
8. **Right group** — Find `Ctrl+F` · Outline `Ctrl+Alt+O` · **Read the page** (toggles to *Edit the page*) · Preview `Ctrl+Alt+P` · Diff with HEAD `Ctrl+Alt+D` · Source · Page properties

The same verbs are in the editor title bar while a page is open — **Bold**, **Italic**, **Link to a Page**, **Format…**, **Page Properties**, **Preview the Page**, **Diff the Page with HEAD**, **Capture a Screenshot**, **Paste Screenshot** — and in the right-click menu under **Temco Markdown**.

### Pictures

Click a picture once to select it: a ring appears and drag handles at its edges. Drag a handle to resize; the width is remembered in the Markdown title (`"w=480"`) and honoured by the built site. Selecting a picture changes the inline menu to widths **25% · 50% · 75% · 100% · Delete**.

`Ctrl+Z` after a resize puts the width back; the file itself is only written when the editor saves.

### The secondary side bar

Click the **Page** container at the far right of the workbench (or the Outline button in the ribbon): it holds the page's **Outline** (headings, click to jump) and the **Draft** the AI wrote, beside your own text.

---

## 7. Step 5 — Validate before building

**Documentation → Pages → title `…` → Validate** (`temcoDocs.validate`), or the command palette.

It answers one question — *would a reader find a broken link, a missing page or a page nobody registered?* — and reports in the Problems panel. Fix what it finds here; a build will not fail on it, but a published site will contain it.

---

## 8. Step 6 — Build the site

**Documentation → view `Publish` → title button `Build the Site`** (globe icon, `temcoDocs.buildSite`).

The Publish view is short — three rows, and above them the verbs:

```
  PUBLISH                                   the rows below
  ---------------------------------------  -------------------------------------
  (globe)   Build the Site                 ->  dist/site, then Build Center
  (cloud)   Publish to GitHub Pages        ->  gh-pages, then Pages (step 8)
  (box)     Build the Offline Help         CHM; needs the help compiler installed
  (o)       Refresh                        re-read what the builds left
  ---------------------------------------  -------------------------------------
  rows:  Review Center   Build Center   Releases
```

There are four ways to the same place, use whichever is in front of you:

| Where | Button | Command |
|---|---|---|
| `Publish` view title | globe icon | `temcoDocs.buildSite` |
| **Build Center** page | **Build Site** | `temcoDocs.buildSite` |
| **Releases** page | **Build Site** | `temcoDocs.buildSite` |
| Command palette | type *Build the Site* | `temcoDocs.buildSite` |

**What it does.** If the project owns `docs:site` or `docs:build` in its `package.json`, that script runs as a task. If it does not — the normal case for a project written here — the platform's own generator renders the registry's pages itself:

```
<project>/dist/site/
├── index.html                     the front door: every area, every page
├── assets/site.css                one stylesheet, nothing to download
├── .nojekyll                      stops GitHub Pages' Jekyll from eating files
├── sitemap.xml                    only when the GitHub remote is known (§10)
├── 01-guide/setup/commissioning.html      ← one folder per area/chapter
├── 01-guide/setup/verify.html
├── 01-guide/setup/media/wiring.png        ← the page's own media/, copied beside it
└── 02-reference/errors/e-101.html
```

Pages keep their relative paths, so `media/wiring.png` resolves in the file, in the editor, and on the web without rewriting anything. A `.md` link between pages becomes a `.html` link. A picture resized in the editor keeps its width.

**Where to look afterwards:** the **Build Center** page (`Publish` view → **Build Center**) lists the attempt, its exit code and every file it left, each with **Open**. A build that produced nothing says so; the exit code is printed, never trusted.

> **Nothing happened?** Two messages explain themselves. *"has no pages marked for publishing"* — the registry has no page with a file marked for publishing (§13). *"has no package.json, so there is no build to invoke"* — only appears when the generator is not available for that recipe; for the site it always is. For anything else, read **View → Output → channel `Temco Docs`**: every build, publish and generator decision is written there with the path it used.

---

## 9. Step 7 — Release

**Documentation → Publish → row `Releases`** (`temcoDocs.releases`) opens the Releases page:

```
   RELEASES
   A release is what a build left that a reader can be given.
   [ ⬆ Publish ]  [ ☁ Publish to GitHub Pages ]  [ 📡 Serve the Newest ]  [ ▶ Build Site ]  [ 📦 Build Offline Help ]

   ┌ PUBLISHED VERSIONS ─ 1 version ─────────────────────────────────────────┐
   │ ⬆ 1.0.0   build #4   published 2 minutes ago · 8 files · ~/.temco/…     │
   │                                                    [ Serve ]  [ Open ]   │
   └─────────────────────────────────────────────────────────────────────────┘
```

1. **Publish** (`temcoDocs.publishRelease`) copies the built files into a folder the platform owns and records the version. An old release is never overwritten — a new version is a new row.
2. **Serve** on a row (`temcoDocs.servePublished`) starts a loopback server so the site's own links and folder indexes resolve the way they will in production.
3. **Open** (`temcoDocs.openPublished`) opens the page in your browser. **Stop Serving** is in the palette (`temcoDocs.stopServing`).

Releasing is local and versioned. It is not publishing to the internet — that is the next step.

---

## 10. Step 8 — Publish to GitHub Pages

**Documentation → Publish → title button `☁`**, or **Releases → Where It Publishes → Publish to GitHub Pages**, or the palette (*Publish to GitHub Pages*, `temcoDocs.publishSite`).

The Releases page carries a **Where It Publishes** section that names the repository and the address before you press anything — the address comes from the folder's own git remote, not from a setting you have to keep in step:

```
WHERE IT PUBLISHES — owner/repo
  $ https://owner.github.io/repo/     pushed to the gh-pages branch of owner/repo
  ! One time only                     Settings → Pages → Source: branch gh-pages, folder /
  ! Never forced                      a branch with commits this build does not know is reported, not overwritten
```

With no GitHub remote it says so instead, in one line, rather than failing after the push.

One click does four things, with a progress notification naming the phase:

```
building ──▶ committing ──▶ switching Pages on ──▶ done
   │             │                    │                  │
   │             │                    │                  └─ toasts the URL
   │             │                    └─ `gh` CLI, if installed; otherwise it tells you
   │             │                       the two clicks in Settings
   │             └─ a throwaway repository, one commit whose parent is
   │                the branch's current tip, then a plain push
   └─ the same generator as §8, into dist/site
```

- The push goes to **`gh-pages`** and is **never forced**. If the branch holds commits this build does not know about, the notification says *the gh-pages branch has changes that are not in this build* and nothing is lost.
- Your working tree, current branch and staged changes are not touched — the commit is made somewhere else.
- The first deploy takes about a minute; the site is at `https://<owner>.github.io/<repo>/`.

**One time only, if `gh` is not installed:** GitHub → the repository → **Settings → Pages → Source: Deploy from a branch → branch `gh-pages`, folder `/`**.

> If the notification says *this folder is not a git repository with a GitHub `origin`*, the project's folder has no GitHub remote: add one, then publish again.

---

## 11. All the buttons, one page

Print this. Every row is a real control, and the command id is what to type in `Ctrl+Shift+P` when the button is not on screen.

### Dashboard (activity bar, house)

| Button | Where | Command |
|---|---|---|
| **Create a Project** | `Projects` view title `+` | `temcoProjects.newProject` |
| **Projects Overview** | `Projects` view title `⊞` | `temcoProjects.projectsPage` |
| **Remove All Projects** | `Projects` view title | `temcoProjects.removeAllProjects` |
| **Start** (open a project) | right-click a project row | `temcoProjects.openProject` |
| **Edit** (sources of a project) | right-click a project row | `temcoProjects.editProject` |
| **Project Detail** | right-click a project row | `temcoDocs.projectPage` |
| **Build** (the project's own build) | right-click a project row | `temcoProjects.buildProject` |
| **Stop Working on a Project** | right-click the *current* row | `temcoProjects.clearProject` |

### Documentation (activity bar, book)

| Button | Where | Command |
|---|---|---|
| **New Page** | `Pages` title `＋` | `temcoDocs.newPage` |
| **New Folder…** | `Pages` title `📁` | `temcoDocs.newChapter` |
| **Add a Source** | `Pages` title `🔌` | `temcoProjects.addSource` |
| **Capture a Screenshot** | `Pages` title `📷` | `temcoDocs.captureImage` |
| **Paste Screenshot** | `Pages` title `📋` | `temcoDocs.pasteImage` |
| **Refresh** | every view title `⟳` | `temcoDocs.refresh` |
| **Open the Page** | `Pages` `…` / page row | `temcoDocs.openPage` |
| **Validate** | `Pages` `…` | `temcoDocs.validate` |
| **Overview** | `Pages` `…` | `temcoDocs.overview` |
| **Open Registry** | `Pages` `…` | `temcoDocs.openRegistry` |
| **Import a Word Document** | `Pages` `…` | `temcoDocs.importDocx` |
| **Create the Missing Page File** | right-click a `missing` row | `temcoDocs.createPage` |
| **Rename the Page Title / Move Up / Move Down / Retire** | right-click a page | `temcoDocs.renamePage`, `.movePageUp`, `.movePageDown`, `.retirePage` |
| **Attach the Screenshot to a Page…** | right-click a capture in `Needs You` | `temcoDocs.attachCapture` |
| **Build the Site** | `Publish` title `🌐` | `temcoDocs.buildSite` |
| **Publish to GitHub Pages** | `Publish` title `☁` | `temcoDocs.publishSite` |
| **Build the Offline Help** | `Publish` title `📦` | `temcoDocs.buildHelp` |
| **Export…** | Releases page (opens the Exports page) | `temcoDocs.export` |
| **Export the Site as a Zip** | palette | `temcoDocs.exportSite` |
| **Export the Page as HTML** | palette, page right-click | `temcoDocs.exportPage` |
| **Export the Pages as a Markdown Bundle** | palette | `temcoDocs.exportMarkdown` |
| **Export the Page as Word** | Exports page, palette | `temcoDocs.exportDocx` |
| **Review Center** (row) | `Publish` view | `temcoDocs.review` → opens the Review Center page |
| **Build Center** (row) | `Publish` view | `temcoDocs.builds` → opens the Build Center page |
| **Releases** (row) | `Publish` view | `temcoDocs.releases` → opens the Releases page |

### Editor (while a page is open)

| Button | Where | Command |
|---|---|---|
| **Bold / Italic / Link to a Page / Format…** | editor title | `temcoDocs.format.bold`, `.italic`, `.linkPage`, `.pick` |
| **Preview the Page** | editor title, `Ctrl+Alt+P` | `temcoDocs.previewPage` |
| **Diff the Page with HEAD** | editor title, `Ctrl+Alt+D` | `temcoDocs.diffPage` |
| **Page Properties** | editor title | `temcoDocs.pageProperties` |
| **Capture / Paste Screenshot** | editor title | `temcoDocs.captureImage`, `temcoDocs.pasteImage` |
| **Open the source** (plain text) | editor title, ribbon `···` | `temcoEditor.openSource` |
| **Temco Markdown** (whole menu) | editor right-click | submenu with every format verb |

### Tool pages (open in the editor area)

| Button | On the page | Command |
|---|---|---|
| **Build Site** | Build Center, Releases | `temcoDocs.buildSite` |
| **Build Offline Help** | Build Center, Releases | `temcoDocs.buildHelp` |
| **Refresh** | Build Center | `temcoDocs.builds` |
| **Open** (an artifact) | Build Center → Artifacts | `temcoDocs.openArtifact` |
| **Publish** | Releases | `temcoDocs.publishRelease` |
| **Publish to GitHub Pages** | Releases | `temcoDocs.publishSite` |
| **Export…** | Releases | `temcoDocs.export` |
| **Serve / Serve the Newest** | Releases, release rows | `temcoDocs.servePublished` |
| **Open** (a release) | Releases → release rows | `temcoDocs.openPublished` |
| **Stop Serving the Site** | palette | `temcoDocs.stopServing` |

---

## 12. Step 9 — Export

**Documentation → Publish → Releases → `Export…`** (`temcoDocs.export`), which opens the **Exports** page:

```
EXPORTS — Temco Handbook
[ 148 pages ] [ 3 shapes ] [ dist/ — where it lands ]

THE SITE, AS A ZIP
  What you get     index.html, assets/site.css, every page, each page's media/
                   [ Export the Site ]
  Reach for it when a colleague wants the website, or it goes to a static host

ONE PAGE, AS ONE FILE
  What you get     one .html per page, stylesheet and pictures inside it
                   [ Export a Page ]
  Reach for it when a page must survive an e-mail, a chat or a ticket

THE PAGES, AS A MARKDOWN BUNDLE
  What you get     every .md, each folder's media/, and registry.json
                   [ Export the Sources ]
  Reach for it when the sources move to another tool, or need archiving
```

The page exists because a picker answers "which one?" but not "what will I get?", and export is the one step that happens outside the application.

| Shape | Command | What you get | For |
|---|---|---|---|
| **The site, as a zip** | `temcoDocs.exportSite` | `dist/<project>-site-<date>.zip` — `index.html`, `assets/site.css`, every page, every `media/` | a colleague who wants the finished website, or an upload to any static host |
| **This page, as one HTML file** | `temcoDocs.exportPage` | `dist/<page>-<date>.html` — the stylesheet inlined, every picture a `data:` URI | e-mail, a chat message, a support ticket: one file that opens anywhere |
| **This page, as a Word document** | `temcoDocs.exportDocx` | `dist/<page>-<date>.docx` — headings, lists, tables and the pictures embedded | a reviewer who works in Word and will not read Markdown |
| **The pages, as a Markdown bundle** | `temcoDocs.exportMarkdown` | `dist/<project>-markdown-<date>.zip` — the `.md` files, their `media/`, and `registry.json` | handing the sources to another tool, or archiving them |

Every export writes to the project's `dist/` and the notification offers **Show in Folder**. Nothing is uploaded; nothing leaves the machine.

> A page whose pictures are very large produces a very large file. That is the honest trade for a file that always opens — export the site as a zip instead when the pictures matter more than the convenience.
>
> `.docx` export is still not built: `mammoth` is import-only here, so writing Word needs a writer dependency first.

---

## 13. When something does not work

| Symptom | What it means | What to do |
|---|---|---|
| Build Site says *no `docs:site` (or `docs:build`) script* | the project has a `package.json` but no site script | add one, or delete the `package.json` so the built-in generator takes over |
| Build Site says *has no pages marked for publishing* | the registry has no page with `ship: true`, or every page is missing its file | open `Pages`, check for `missing` rows, and **Create the Missing Page File** |
| The site builds but a page is empty | the page was registered, its file exists, and the Markdown is empty | write it, or **Retire the Page** |
| A picture is full width on the web but small in the editor | the page is older than the width support | reopen the picture, drag a handle, save — the width is written into the title |
| *nothing was published — the gh-pages branch has changes that are not in this build* | someone else pushed to `gh-pages` | pull or re-run; the command will not overwrite it |
| *this folder is not a git repository with a GitHub `origin`* | no remote | `git remote add origin …`, then publish again |
| Pages shows 404 for a minute | the first deploy is still running | wait; check the repository's **Actions** tab |
| A page is missing from the published site | it is not registered, or `ship` is false | `Documentation → Pages → … → Open Registry` |
| An export says *has no pages to export* | no registered page has a file yet | create or generate the pages first (§5) |
| A single-file page shows a broken picture | the picture's path in the Markdown is wrong, or it is not under the page's `media/` | fix the reference in the editor; the same link is broken in the site too |
| The editor shows the raw Markdown | the file opened as text | in the `Pages` view, right-click the page → **Open the Page**; or in the Explorer right-click the file → **Reopen Editor With…** → **Temco Editor** |

Output that explains itself: **View → Output → channel `Temco Docs`**. Every build, publish and generator decision is written there with the path it used.
