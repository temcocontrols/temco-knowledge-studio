# TEMCO Platform — Figure Atlas

Every ASCII figure from [platform-design.md](./platform-design.md), in document order. Generated, not hand-copied.

## Figure 1 — 2.1 The boundary

```
┌──────────────────────────────────────────────────────────────────────────┐
│ REGISTER A — THE SHELL                            owner: VS Code core     │
│ library: none (native workbench DOM + CSS)                                │
│ styling: --vscode-* theme variables only                                  │
│                                                                           │
│   title bar · activity bar · side bar trees · tabs · breadcrumbs ·        │
│   status bar · command palette · notifications · quick pick · settings     │
├──────────────────────────────────────────────────────────────────────────┤
│ REGISTER B — THE CONTENT                          owner: temco extensions │
│ library: Fluent UI v9 + React 19                                          │
│ styling: Fluent tokens, bridged from --vscode-* (§7.2)                    │
│                                                                           │
│   every custom editor webview · every webview view panel ·                │
│   every dialog drawn inside our own surfaces                              │
├──────────────────────────────────────────────────────────────────────────┤
│ REGISTER C — THE REMOTE ENGINE                    owner: ONLYOFFICE Docs  │
│ library: ONLYOFFICE's own web app                                         │
│ styling: ONLYOFFICE's own themes, told to match ours                      │
│                                                                           │
│   the document canvas inside an <iframe>, in register B's webview only    │
└──────────────────────────────────────────────────────────────────────────┘
```

## Figure 2 — 2.4 The seam, drawn

```
   side bar (register A)                 editor webview (register B)
 ┌────────────────────────┐            ┌────────────────────────────────────┐
 │ ▾ 📦 T3000             │            │  [Publish] [History] [Share]       │ ← Fluent
 │   ▾ 📚 Documentation   │  click     │ ┌────────────────────────────────┐ │
 │     • Installation     │ ─────────► │ │                                │ │
 │     • Commissioning    │            │ │   F  l  u  e  n  t   d  o  c   │ │
 │   ▸ 🔌 Hardware        │            │ │                                │ │
 │   ▸ 🔄 Variables       │            │ └────────────────────────────────┘ │
 │                        │            │  Status: draft · rev 7 · 2 KB      │ ← Fluent
 └────────────────────────┘            └────────────────────────────────────┘
   VS Code TreeView                      React 19 + Fluent v9 in a webview
   VS Code theme variables               Fluent tokens bridged from the same vars
```

## Figure 3 — 3.1 Planes and processes

```
┌───────────────────────────────────────────────────────────────────────────┐
│ 1. WORKBENCH (renderer)                          thread: renderer          │
│    VS Code shell. Owns layout, tabs, trees, commands, keybindings, theme.  │
│    Knows nothing about ONLYOFFICE. Calls commands and custom editors only. │
└───────────────┬───────────────────────────────────────────────────────────┘
                │ custom editor / webview view / tree data provider
┌───────────────▼───────────────────────────────────────────────────────────┐
│ 2. EXTENSION HOST (node)                         thread: ext host          │
│    temco-docs · temco-workbench · temco-ui · temco-projects · …            │
│    Owns: asset registry, tree contents, commands, document server client,  │
│          storage adapter, publication state machine, HTTP endpoints.       │
│    May touch the filesystem and the network. Never touches DOM.            │
└───────────────┬───────────────────────────────────────────────────────────┘
                │ postMessage (typed protocol, §4.6)
┌───────────────▼───────────────────────────────────────────────────────────┐
│ 3. CONTENT (webview)                             context: browser sandbox  │
│    React 19 + Fluent UI v9. Owns: everything inside an editor tab.         │
│    No filesystem. No network except to the document server it is framing.  │
│    May embed ONE remote iframe (§4.2).                                     │
└───────────────┬───────────────────────────────────────────────────────────┘
                │ <iframe src="https://docs.temco.local/…">   (register C)
┌───────────────▼───────────────────────────────────────────────────────────┐
│ 4. DOCUMENT SERVER (ONLYOFFICE Docs)             process: separate host    │
│    Renders and edits docx/xlsx/pptx/pdf/md. Fetches the file from a URL    │
│    IT can reach. POSTs save callbacks to a URL it can reach. Signs with JWT.│
└───────────────┬───────────────────────────────────────────────────────────┘
                │ GET  <contentUrl>      POST <callbackUrl>
┌───────────────▼───────────────────────────────────────────────────────────┐
│ 5. STORAGE + BUILD                                process: local or remote │
│    Asset store (SQLite or Postgres), content blobs, revisions,             │
│    publication jobs, search index, knowledge chunks.                       │
└───────────────────────────────────────────────────────────────────────────┘
```

## Figure 4 — 4.1 What we are integrating

```
  we write                     they own                        they render
 ─────────                    ─────────                       ───────────
  config JSON  ──JWT──►  document server  ──HTTP GET──►  our content URL
   + iframe                    │                              (signed)
   mount point                 └──HTTP POST──►  our callback URL
                                    │
                                    └───────────►  editor UI inside our iframe
```

## Figure 5 — 4.1.1 Why the engine cannot be vendored into the VSIX

```
┌─ CAN be inside VS Code ──────────────────────────────────────────────────────┐
│  VS Code (Electron renderer)                                                 │
│   └ webview (our React 19 + Fluent host)                                     │
│      └ <iframe src="{server}/web-apps/apps/api/documents/api.js">            │
│         the editor UI is already inside VS Code. This is not a limitation.   │
└──────────────────────────────────────────────────────────────────────────────┘
┌─ CANNOT be inside VS Code ───────────────────────────────────────────────────┐
│  Document Server: nginx + node + conversion services + Redis/Postgres,       │
│  ~2.5 GB image, ~1.5 GB RAM, its own process tree and network listeners      │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Figure 6 — 4.2 Composition inside a VS Code custom editor

```
┌─ VS Code editor tab: "T3000 Manual.docx" ─────────────────────────────────┐
│                                                                           │
│  ┌─ webview document (register B, our origin) ─────────────────────────┐   │
│  │                                                                     │   │
│  │  ┌─ Fluent header (React) ────────────────────────────────────────┐ │   │
│  │  │ [◀ Back]  T3000 Manual.docx   rev 7   ● unsaved    [Publish ▾] │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                     │   │
│  │  ┌─ Fluent banner, only when degraded ────────────────────────────┐ │   │
│  │  │ ⚠ Document server unreachable — read-only. [Retry] [Details]   │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                     │   │
│  │  ┌─ #onlyoffice-host (100% × 100%) ───────────────────────────────┐ │   │
│  │  │ ┌─ <iframe src="https://docs.temco.local/…"> ────────────────┐ │ │   │
│  │  │ │                                                            │ │ │   │
│  │  │ │   ONLYOFFICE editor: ribbons, canvas, its own right panel  │ │ │   │
│  │  │ │   (register C — we do not style anything in here)          │ │ │   │
│  │  │ │                                                            │ │ │   │
│  │  │ └────────────────────────────────────────────────────────────┘ │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                     │   │
│  │  ┌─ Fluent status bar (React) ────────────────────────────────────┐ │   │
│  │  │ Page 4 of 41 · 100% · saved 14:02 · server ok                  │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────┘
```

## Figure 7 — 4.3 The key — the only thing that causes corruption if you get it wrong

```
        ┌───────────────┐   user edits + saves
        │ rev 7 · key A │ ──────────────────────► callback status 6 (force save)
        └───────┬───────┘                                │
                │                                        ▼
                │                              store writes rev 8
                │                                        │
                │                                        ▼
                │                        host computes key B ≠ key A
                │                                        │
                ▼                                        ▼
   reopening with key A is allowed            reload iframe with key B
   only for the SAME revision                 (editor state is re-fetched)
```

## Figure 8 — 4.5 The save callback — status machine and the 10-second rule

```
 ONLYOFFICE            our callback endpoint            store             webview
     │                          │                        │                  │
     │  POST status=1 (editing) │                        │                  │
     ├─────────────────────────►│ mark session active    │                  │
     │                          │                        │                  │
     │        … user types …    │                        │                  │
     │                          │                        │                  │
     │  POST status=2 (ready)   │                        │                  │
     ├─────────────────────────►│ 1. GET url  ──────────►│                  │
     │                          │ 2. validate bytes      │                  │
     │                          │ 3. write rev N+1 ─────►│                  │
     │                          │ 4. reply {"error":0}   │                  │
     │◄─────────────────────────┤                        │                  │
     │                          │ 5. notify ────────────────────────────────►│
     │                          │                        │   revision N+1    │
     │  POST status=6 (force)   │                        │                  │
     ├─────────────────────────►│ same as status 2       │                  │
     │                          │                        │                  │
     │  POST status=4 (closed)  │                        │                  │
     ├─────────────────────────►│ clear session, no write│                  │
     │                          │                        │                  │
     │  POST status=3 or 7      │                        │                  │
     ├─────────────────────────►│ surface error, keep rev│                  │
```

## Figure 9 — 4.8.1 Per-asset host memory

```
 resolve(asset, explicitOverride?)
   │
   ├─ 1. explicitOverride           ← "Open With…" right now
   ├─ 2. asset.preferredHost        ← remembered from the last explicit choice
   ├─ 3. temco.docs.defaultHost     ← user setting ('auto' = skip to 4)
   └─ 4. registry priority          ← the table in §4.11
```

## Figure 10 — 4.10 Degraded states — never a blank frame

```
 server state    what the user sees                                    what still works
 ─────────────   ───────────────────────────────────────────────────   ────────────────────
 unknown         skeleton · "Connecting to document server…"           tree, other assets
 reachable       the editor                                            everything
 unreachable     MessageBar · "Read-only — server unreachable."         download, history,
                 [Retry] [Health check]                                publish existing rev
 auth-failed     "Token mismatch. An administrator must check the       download, history
                 JWT secret." + Diagnostics link, no Retry loop
 too-old         "This needs ONLYOFFICE 9.0+ (server is X)."            download
 server-error    "Document server returned 500." + correlation id       download
 no-secret       "Document server is not configured."                   all non-Office
```

## Figure 11 — 5. The five core concepts

```
┌─────────────┐   contains   ┌──────────────────────────────────────────────────┐
│   PRODUCT   │─────────────►│  T3000 · T3-ESP · CM5 · BACnet Router · Cloud     │
│  (a thing   │              │  documentation · hardware · firmware · releases·  │
│  we support)│              │  downloads · repository · knowledge               │
└─────────────┘              └──────────────────────┬───────────────────────────┘
                                                    │ holds
                                     ┌──────────────▼────────────────┐
                                     │            ASSET              │
                                     │  one addressable, versioned,  │
                                     │  publishable unit of content  │
                                     │  id AS-8812 · revision 7      │
                                     └──────┬────────────────┬───────┘
                                            │ opened by      │ published as
                                  ┌─────────▼───────┐  ┌─────▼──────────────┐
                                  │  EDITOR HOST    │  │   PUBLICATION      │
                                  │ which surface   │  │   a frozen snapshot │
                                  │ edits it (§4.11)│  │   of a revision,    │
                                  └─────────────────┘  │   in a channel      │
                                                       └─────┬───────────────┘
                                                             │ produces
                                                   ┌─────────▼───────────────┐
                                                   │       KNOWLEDGE         │
                                                   │  chunks + edges, built  │
                                                   │  from published text    │
                                                   └─────────────────────────┘
```

## Figure 12 — 5.1 The tree is the product, rendered by VS Code

```
📦 T3000                        ← Product (register A: VS Code TreeView)
  📚 Documentation              ← Area
     Installation               ← Document asset
     Commissioning              ← Document asset
     Troubleshooting/
        No comms with router    ← Document asset
  🔌 Hardware
     Inputs (12)                ← Asset collection, opens a Fluent table
     Outputs (8)
     Variables (240)
  💾 Firmware
     13.0 · Latest
     12.9 · LTS
  📜 Releases
     13.0 · 2026-09
  ⬇  Downloads
```

## Figure 13 — 7.2 The theme bridge — how Fluent stops looking foreign

```
 VS Code workbench theme (any theme, incl. user themes)
        │  injects --vscode-* custom properties into every webview
        ▼
 ┌───────────────────────────────────────────────────────────────┐
 │ document.documentElement                                       │
 │   --vscode-editor-background: #1e1e1e                          │
 │   --vscode-foreground:        #cccccc                          │
 │   --vscode-button-background: #0e639c                          │
 │   --vscode-panel-border:      #2b2b2b                          │
 │   --vscode-font-family:       "Segoe WPC", "Segoe UI", …       │
 └──────────────────────┬────────────────────────────────────────┘
                        │  readVSCodeTheme()  (getComputedStyle)
                        ▼
 ┌───────────────────────────────────────────────────────────────┐
 │ toFluentTheme()                                                │
 │   brand ramp     ← button-background + focusBorder             │
 │   neutral bg     ← editor-background / sideBar / widget        │
 │   foreground     ← foreground / descriptionForeground          │
 │   stroke         ← panel-border / widget-border                │
 │   status         ← errorForeground / charts-*                  │
 │   radius         ← 4px (VS Code) not Fluent's 4–8px default    │
 └──────────────────────┬────────────────────────────────────────┘
                        ▼
              <FluentProvider theme={bridged} />
                        │
        every Fluent component now matches the shell
```

## Figure 14 — 8.1 Full layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TEMCO Platform   T3000 › Documentation › Commissioning              ─  □  ✕ │
├─────────────────────────────────────────────────────────────────────────────┤
│ ⌕  Search products, assets, firmware…                              ⌘K       │
├───┬──────────────────────────┬──────────────────────────────────────────────┤
│ H │ ▾ P · T3000              │ ┌ tabs ────────────────────────────────────┐ │
│ P │   ▾ D · Documentation    │ │ Commissioning.docx ×   md-editor.md ×    │ │
│ D │     • Installation       │ └──────────────────────────────────────────┘ │
│ W │     • Commissioning  ◀───│ ┌ breadcrumbs ─────────────────────────────┐ │
│ F │     ▸ Troubleshooting    │ │ T3000 › Documentation › Commissioning    │ │
│ R │   ▸ W · Hardware         │ └──────────────────────────────────────────┘ │
│ ↓ │   ▸ F · Firmware         │ ┌ REGISTER B · Fluent UI (React) ──────────┐ │
│ S │   ▸ R · Releases         │ │ [Back]  Commissioning.docx   rev 7       │ │
│ A │   ▸ ↓ · Downloads        │ │                         [Publish ▾]      │ │
│   │                          │ ├──────────────────────────────────────────┤ │
│   │                          │ │┌ REGISTER C · ONLYOFFICE Docs ───────────┐││
│   │  ▲ register A            │ ││                                         │││
│   │    VS Code TreeView      │ ││ the document canvas (iframe)            │││
│   │    22px rows · native    │ ││                                         │││
│   │                          │ ││                                         │││
│   │                          │ │└─────────────────────────────────────────┘││
│   │                          │ ├──────────────────────────────────────────┤ │
│   │                          │ │ Page 4 of 41 · 100% · saved 14:02        │ │
│   │                          │ └──────────────────────────────────────────┘ │
├───┴──────────────────────────┴──────────────────────────────────────────────┤
│ ⚠ 1  ⓘ 2   Document server: reachable        T3000 › master    UTF-8        │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Figure 15 — 10.1 Home — `temcoWorkbench.home` (webview)

```
┌─ TEMCO ──────────────────────────────────────────────────────────────────────┐
│  Good evening, Ada                                       ⌘K Search anything  │
│                                                                              │
│  ┌─ Continue ───────────────────┐ ┌─ Needs attention ────────────────────┐   │
│  │ ▸ Commissioning.docx   rev 7 │ │ ⚠ 1 asset has an unreviewed change   │   │
│  │   T3000 · 2 h ago            │ │ ⚠ Document server: 240 ms (ok)       │   │
│  │ ▸ BACnet Router Guide.md     │ │ ⚠ 2 publications queued              │   │
│  │   Cloud · yesterday          │ │                                      │   │
│  └──────────────────────────────┘ └──────────────────────────────────────┘   │
│                                                                              │
│  ┌─ Products ───────────────────────────────────────────────────────────┐     │
│  │  T3000      41 docs   13.0 latest   ▸ Open                           │     │
│  │  T3-ESP      8 docs   2.4  latest   ▸ Open                           │     │
│  │  CM5         6 docs   1.1  latest   ▸ Open                           │     │
│  └──────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  ┌─ Recent activity ────────────────────────────────────────────────────┐     │
│  │  Ada    saved Commissioning.docx rev 7            14:02              │     │
│  │  Bo     published T3000 13.0 release-notes        11:20              │     │
│  └──────────────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Figure 16 — 10.2 Product tree — `temcoWorkbench.products` (register A)

```
▾ T3000                       product · 41 docs · firmware 13.0
    ▾ Documentation           area · guides (18 assets)
        Installation          docx · rev 7
        Commissioning         docx · rev 7
      ▸ Troubleshooting       area · 4 assets
    ▸ Hardware                12 inputs · 8 outputs · 240 variables
    ▸ Firmware                13.0 latest · 12.9 LTS
    ▸ Releases                3
    ▸ Downloads               14
▸ T3-ESP                      product · 8 docs
▸ CM5                         product · 6 docs
```

## Figure 17 — 10.3 Product overview — `temcoWorkbench.product` (webview, secondary)

```
┌─ T3000 ─────────────────────────────────── [Open Docs] [New ▾] [Publish ▾] ─┐
│ 41 documents · 12 inputs · 8 outputs · firmware 13.0 · last published 09-14 │
├─────────────────────────────────────────────────────────────────────────────┤
│ Tabs: Overview │ Documentation │ Hardware │ Firmware │ Releases │ Downloads  │
├─────────────────────────────────────────────────────────────────────────────┤
│ Documentation by area          │ Recently changed                            │
│  guides            18          │  Commissioning.docx        rev 7  2 h      │
│  tutorials          6          │  Troubleshooting.md        rev 3  yesterday│
│  api               11          │                                             │
│  troubleshooting    4          │ Health                                      │
│  release-notes      2          │  ○ Document server     240 ms              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Figure 18 — 10.5 Markdown editor — `temcoDocs.markdown` (webview, Fluent)

```
┌─ Commissioning.md ───────────────────── rev 7 · draft ─ [Preview] [Publish] ┐
│ B I U H1 H2 • 1. " </> 🔗 ▦ ─  ≡  (Fluent Toolbar, size=small, 22px)        │
├───────────────────────────────────────────┬─────────────────────────────────┤
│ ## Commissioning the T3000                │  (preview pane, toggleable)     │
│                                           │  Commissioning the T3000        │
│ 1. Connect power to terminals 24 V.       │  ─────────────────────────      │
│ 2. Open the T3000 app and select…         │  1. Connect power…              │
│                                           │                                 │
│ | Input | Range |                         │                                 │
│ |-------|-------|                         │                                 │
│ | AI1   | 0–10V |                         │                                 │
├───────────────────────────────────────────┴─────────────────────────────────┤
│ Ln 12, Col 4 · 1,204 words · Markdown · saved 14:02                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Figure 19 — 10.6 Properties — `temcoWorkbench.properties` (webview, secondary side bar)

```
┌─ Properties ─────────────────────────────────┐
│ Title      [Commissioning.docx        ]      │
│ Slug       [commissioning             ]      │
│ Area       [guides                  ▾ ]      │
│ Product    [T3000                   ▾ ]      │
│ Format     docx                    (read)    │
│ Revision   7 · 41 KB · 2026-10-23 14:02      │
│ Published  rev 6 → T3000 13.0                │
│ [Show History]  [Download Copy…]             │
└──────────────────────────────────────────────┘
```

## Figure 20 — 10.7 Publish — `temcoWorkbench.publish` (webview)

```
┌─ Publish T3000 13.0 ─────────────────────────────────────────────────────────┐
│ Channel  ( ) Internal  (•) Public         [Publish 3 assets]                 │
│                                                                              │
│ ┌─ Check ──────────────────────────────────────────────────────────────────┐ │
│ │ ✔ All 3 anchors resolve                                                  │ │
│ │ ✔ 1 code block language missing  → warning                               │ │
│ │ ✔ No asset is open in an editor                                          │ │
│ │ ✔ 2 assets already published at this revision (will be skipped)          │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ Queue: Commissioning.docx · Troubleshooting.md · Release-notes.docx          │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Figure 21 — 10.8 Publication queue — `temcoWorkbench.publish` (webview, admin)

```
┌─────────────────────┬─────┬──────────┬───────────┬─────────┬────────┬───────┐
│ Asset               │ Rev │ Channel  │ State     │ Started │ Time   │       │
├─────────────────────┼─────┼──────────┼───────────┼─────────┼────────┼───────┤
│ Commissioning.docx  │ 7   │ public   │ live      │ 14:02   │ 1.8 s  │ log   │
│ Troubleshooting.md  │ 3   │ public   │ building  │ 14:02   │ 0.4 s  │ log   │
│ Release-notes.docx  │ 9   │ internal │ failed    │ 13:58   │ 2.1 s  │ retry │
└─────────────────────┴─────┴──────────┴───────────┴─────────┴────────┴───────┘
```

## Figure 22 — 10.9 Releases and Downloads — tree views (register A)

```
Releases                                      Downloads
  13.0    2026-09-14  latest  verified          T3000-Setup.exe          48 MB
  12.9    2026-03-02  LTS     shield            T3000-Setup.zip         112 MB
  12.10   2025-11-20  beta    beaker            T3000-Firmware.bin        9 MB
  12.8    2025-06-11  EOL                       T3-ESP-Firmware.bin       2 MB
▸ T3-ESP                                      ▸ SDK
▸ CM5                                         ▸ Documentation packs
```

## Figure 23 — 10.10 Search — built-in (register A)

```
┌────────────────────────────────────────────────────────────────────────┐
│ asset:docx product:T3000 output                          [Aa] [.*] [ab]│
├────────────────────────────────────────────────────────────────────────┤
│ Commissioning.docx  ›  guides  ›  T3000                    4 matches   │
│   12   …connect power to terminals 24 V, then open the…                │
│   31   …output calibration is described in chapter 4…                  │
│ Troubleshooting.docx  ›  troubleshooting  ›  T3000         1 match     │
│    8   …no output on terminal 5: check the schedule…                   │
├────────────────────────────────────────────────────────────────────────┤
│ 5 results in 2 assets      filters: asset:docx product:T3000 output    │
└────────────────────────────────────────────────────────────────────────┘
```

## Figure 24 — 10.11 Review — `temcoWorkbench.review` (webview)

```
┌─ Review ─────────────────────────────────────────────────────────────────────┐
│ Awaiting review (2)                          diff: rev 6 → rev 7             │
│  ▸ Commissioning.docx   Ada   2 h   [Approve] [Request changes]              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Text diff (for md/docx-as-text).  For Office files: open both revisions.     │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Figure 25 — 10.12 Diagnostics — `temcoWorkbench.admin` (webview)

```
┌─ Diagnostics ────────────────────────────────────────────────────────────────┐
│ Server URL     https://docs.temco.local                        (configured)  │
│ JWT secret     •••••••• set 3 days ago                          (ok)         │
│ Health check   200 in 240 ms                                    (ok)         │
│ Version        ONLYOFFICE Docs 9.0.4                                        │
│ Reachability   platform → server ✔      server → platform ✔                 │
│ Last error     none                                                          │
│ [Run health check]  [Edit secret]  [Copy diagnostics JSON]                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Figure 26 — F1 — Open a Word document from the tree (the primary flow)

```
user          A workbench         B ext host            D server          C webview
  │             │                   │                     │                 │
  ├──click row─►│                   │                     │                 │
  │             ├──resolve asset───►│                     │                 │
  │             │                   ├──probe health──────►│                 │
  │             │                   │◄──200 / timeout─────┤                 │
  │             │◄──open editor─────┤                     │                 │
  │             │                   │  temco-asset:/AS-8812                 │
  │             │                   ├─────────────────init{config+JWT}─────►│
  │             │                   │                     │◄──GET content───┤
  │             │                   │                     ├───bytes────────►│
  │             │                   │                     │   render        │
  │◄────────────────────────────────────usable──────────────────────────────┤
```

## Figure 27 — F2 — Edit, force save, revision bump

```
 C webview           D doc server            B callback            E store
   │  user edits            │                      │                  │
   │                        │ POST status=1        │                  │
   │                        ├─────────────────────►│ session active   │
   │                        │                      │                  │
   │  autosave 30s / ⌘S     │ POST status=6        │                  │
   │                        ├─────────────────────►│ GET url (start)  │
   │                        │                      ├─────► bytes      │
   │                        │◄── {"error":0} ──────┤ write rev 8 ────►│
   │                        │                      │                  │
   │◄──── {t:'saved', revision:8} ─────────────────┤                  │
   │  header: "rev 8 · saved 14:02"                │                  │
```

## Figure 28 — F3 — New document from a template

```
 user            A                      B                        E
  │ New From Template…                  │                        │
  ├────────────────►│ showQuickPick(templates)                     │
  │ choose "Manual" │                    │                        │
  │                 ├───────────────────►│ copy template bytes    │
  │                 │                    ├───────────────────────►│ create asset,
  │                 │                    │                        │ rev 1, source='template'
  │                 │                    │◄─ AssetRecord ─────────┤
  │                 │ open temco-asset:/AS-9001?host=office        │
  │◄────────────────┤                    │                        │
```

## Figure 29 — F4 — Publish a product version

```
 user        A / B                    E                    build runner
  │ Publish…    │                     │                         │
  ├────────────►│ preflight (§10.7)   │                         │
  │             │  - assets not open  │                         │
  │             │  - anchors resolve  │                         │
  │             │  - channel chosen   │                         │
  │             │ create Publication{state:'queued'}             │
  │             ├────────────────────►│                         │
  │             │                     ├── job ─────────────────►│
  │             │                     │       render each asset │
  │             │                     │       (docx→html via D) │
  │             │                     │◄── artifacts ───────────┤
  │             │  Publication → 'live' (or 'failed' + log)      │
  │◄────────────┤  status bar: $(tag) 0 queued                    │
```

## Figure 30 — F5 — Document server unreachable

```
 click asset
      │
      ▼
 health probe ──timeout──► C: MessageBar(read-only) + [Retry] [Health check]
      │                          │
   reachable                     └── Retry → probe again (max 1 in flight)
      │
      ▼
 normal editor
```

## Figure 31 — F6 — Two editors, one asset, revision conflict

```
 tab 1 (rev 7)         tab 2 (rev 7)            B                    E
     │                      │                   │                    │
     │ save ────────────────┼──────────────────►│ write rev 8        │
     │                      │                   ├───────────────────►│
     │◄─ saved rev 8 ───────┤                   │                    │
     │                      │ save ────────────►│ expected base 7,   │
     │                      │                   │ current is 8 → 409 │
     │                      │◄─ {t:'reload', reason:'outdated'} ────┤
     │                      │                   │                    │
     │                      │ C: banner "This document changed.      │
     │                      │    [Reload latest] [Keep my copy]"     │
```

## Figure 32 — F7 — Import files

```
 user          A                B                     E
  │ Import Files…               │                     │
  ├─────────────►│ showOpenDialog(filters: docx,xlsx,pptx,md,csv) │
  │ multi-select │               │                     │
  │              ├──────────────►│ read bytes          │
  │              │               │ sniff format (magic + ext)
  │              │               │ title = basename    │
  │              │               ├────────────────────►│ create asset rev 1
  │              │               │ link to selected product/area
  │◄─────────────┤ tree refreshes; first asset opens  │
```

## Figure 33 — F8 — History and restore

```
 context menu → Show History
      │
      ▼
 ┌─ History: Commissioning.docx ────────────────────────────────┐
 │ rev 7  41 KB  14:02  editor   • current                      │
 │ rev 6  41 KB  09-14  editor                                  │
 │ rev 5  39 KB  09-02  import                                  │
 │              [Open]  [Restore as rev 8]  [Download]          │
 └──────────────────────────────────────────────────────────────┘
```

## Figure 34 — F9 — Open With (forcing a host)

```
 context menu → Open With…  →  QuickPick, ordered by the registry
      │
      ▼
 ┌─────────────────────────────────────┐
 │ Office (Word)          ● default    │
 │ Markdown editor                     │
 │ Text Editor                         │
 └─────────────────────────────────────┘
      │ choose "Text Editor"
      ▼
 temco-asset:/AS-8812?host=text  →  opens in the native text editor (read/write)
```

## Figure 35 — F10 — Search to open

```
 ⌘K → type "commissioning"            (command center, register A)
      │
      ▼
 results: assets · commands · settings · files
      │ Enter on an asset
      ▼
 temco.asset.open → F1
```

## Figure 36 — 12.2 The focus contract (the rule that prevents the "typing goes somewhere else" class of bug)

```
             ┌──────────────────────────────────────────────┐
             │  A user is typing in a document              │
             │  → B must not steal focus                    │
             │  → B must not replace the document           │
             │  → B must not re-render the surface          │
             └──────────────────────────────────────────────┘
```

