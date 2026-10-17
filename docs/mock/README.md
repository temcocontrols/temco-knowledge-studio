# The layout mock

A static, interactive site that shows **the whole platform window** — activity bar, side bar, editor, panel, AI bar, status bar — so a layout can be argued about and changed before anything in the shell is touched.

Open [`index.html`](index.html) in a browser. There is no build step, no server, no dependency and no network call: the site is HTML, CSS and plain scripts, and it works from a `file://` path.

## What it is not

| It is | It is not |
|---|---|
| a design surface, read by people | a product surface, read by users |
| mock data, invented to fill the layout | a fixture, or anything the extensions read |
| plain static files under `docs/` | part of the build, the package or the shipped app |

Every number in it — 1,254 pages, 34 devices, 17 drafts — is invented. The **names** are not: modules, areas, surfaces and states come from [`../temco-platform/modules/README.md`](../temco-platform/modules/README.md), so a layout decision here is about the product that exists.

## The window

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ logo  File Edit View Go Tools Help        [ search or run a command ]  ▤ ▥ ✦ ◐  ─ □ ✕ │ 35
├────┬─────────────────────┬───────────────────────────────────────────┬───────────────┤
│    │ SIDE BAR  300       │ tabs                                      │ AI BAR  340   │
│ 48 │                     ├───────────────────────────────────────────┤               │
│    │ the module's tree   │ breadcrumbs                        22     │ chat about    │
│    │                     ├───────────────────────────────────────────┤ the page      │
│    │                     │ editor                                    │               │
│    │                     │  the surface the module draws             │               │
│    │                     ├───────────────────────────────────────────┤               │
│    │                     │ PANEL  Problems Output Terminal Ports     │               │
├────┴─────────────────────┴───────────────────────────────────────────┴───────────────┤
│  t3000  0↑0↓  ⊗2 ⚠2                    Ln 1, Col 1  Spaces: 2  UTF-8  LF  1.143.0  │ 22
└──────────────────────────────────────────────────────────────────────────────────────┘
```

| Region | Size | What it is | Whose |
|---|---|---|---|
| **Title bar** | 35 px | menus, the command centre, the layout controls | the shell's |
| **Activity bar** | 48 px | one icon per module; the badge is that module's own open work | ours — one entry per module |
| **Side bar** | 300 px | the module's tree: sections, surfaces, counts | each module's |
| **Editor group** | flexible | tabs, breadcrumbs, and the one surface in front | the shell's; the surface is ours |
| **Panel** | `clamp(132px, 26vh, 240px)` | Problems · Output · Terminal · Ports | mostly ours |
| **AI bar** | 340 px | the conversation, its context and its citations | `temco-ai` |
| **Status bar** | 22 px | branch, problems, cursor, encoding, product | mixed |

The mock keeps the sides at fixed widths and the editor flexible, which is what the workbench does. Nothing here is a webview: a surface is a normal editor tab, so it keeps tabs, breadcrumbs, the panel and the status bar for free.

## The menu bar

Menus are **verbs**, not features. A module contributes items into these shared titles; it never gets a menu of its own, or the bar would become the activity bar.

| Menu | Holds |
|---|---|
| **File** | workspace and project lifecycle: new project, open workspace, add source, save, close |
| **Edit** | text operations on what has focus |
| **View** | layout and panels: palette, quick open, the bars, Problems/Output/Terminal, theme |
| **Go** | navigation between modules and surfaces |
| **Run** | long actions that start and stop: build, query, discover, capture |
| **Tools** | module toolkits — a submenu at three or more actions, otherwise a flat item carrying the module's word (`I/O Studio: Auto-Map Points`) |
| **Help** | documentation, shortcuts, logs, an issue, about |

Two rules keep it from collapsing under more modules. **Every menu item also exists as a control on the surface it acts on** — the menu is an accelerator, never the only home for a feature. And **the long tail is not in the menus at all**: it is in `Ctrl+Shift+P`, where every command is searchable by its module prefix (`Devices: Discover`, `BACnet: Read Objects`).

A module never adds a menu title. If `Tools` ever stops being the right home, the answer is a new *verb* that the whole platform shares, the way `Run` was added here — not an eleventh menu.

## One state per surface

The tinted panel (`.hero-panel`, built by `M.ui.hero`) appears **once** on a surface, names a state and offers the decision:

| Surface | The state |
|---|---|
| Dashboard | Release 13.0 is waiting on two checks |
| Review Center | two errors keep 13.0 from publishing |
| Build Center | the offline help is still compiling |
| Devices | one controller has not answered for two hours |
| Temco Learn › T3000 | 13.0 is building; readers still get 12.9 |
| Workspaces › T3000 | everything in this window is this workspace |

Three tones: `accent` for something in motion, `warn` for something blocking, `ok` for something finished. Everything else — a note about how reading a source works, a preference, a definition — is a callout or a card. A second tinted panel on the same surface turns the signal into decoration.

The card the window is actually standing in (the current workspace, the current project) uses the same tint at roughly half strength through `.card--current`, so "current" reads without a badge.

## The modules and their surfaces

| Module | Surfaces in the mock |
|---|---|
| **Dashboard** | Overview · Recent Activity · Coverage & Health · Needs Review |
| **Workspaces** | All Workspaces · T3000 · Templates |
| **Documentation** | Projects · Sources · Knowledge · Review Center · Build Center · Releases |
| **Devices** | Devices · Firmware · Health & Alarms · Schedules · Trend Logs · Backups |
| **I/O Studio** | Point Browser · Mapping · Logic · Live Values · Trends |
| **BACnet Studio** | Discovery · Object Browser · Alarms · Trend Logs · Schedules |
| **Network** | Discovery · Modbus Scanner · Diagnostics · Captures |
| **SQL Studio** | Query Editor · Connections · Reports |
| **AI Hub** | Chat · Actions · Citations · Local Models · Knowledge Base |
| **Temco Learn** | Home · T3000 · Article Preview · Downloads · Learning Paths |
| **Settings** | General · Modules · Branding · AI Models · Publishing |

The reserved modules (`temco-device-manager`, `temco-bacnet`, `temco-nettools`, `temco-sql`) appear as full modules here on purpose: the point of the mock is to decide the shape **before** a module becomes active. **Settings › Modules** is where the mock says which of them the build actually ships.

## Modules, not a marketplace

There is no Store and no Install button, because there is nothing to install. `temco-store` is not a shop — it is the platform's own SQLite memory (the catalog, the selection, the naming rules), with no view of its own. Every other extension is a **module**: it ships with the platform, activates with it and cannot be removed. The build also refuses a `product.json` that configures an extension gallery, so a community marketplace is not reachable from this window at all.

So the mock keeps one honest surface, **Settings › Modules**: the seven active modules with their ids, namespaces and the surfaces they open; the four reserved ones marked as such; and platform updates, because a module updates with the platform and never on its own. If Temco later ships optional add-ons outside the platform's release cadence, that is a new surface — curated, Temco-only — not a marketplace.

## What moves

| Action | How |
|---|---|
| Change module | click the activity bar, or `Go` in the title bar |
| Change surface | click the side bar; each surface is a tab and a deep link (`#/docs/review`) |
| Everything else | `Ctrl+P` quick open · `Ctrl+Shift+P` command palette |
| Layout | `Ctrl+B` side bar · `Ctrl+J` panel · `Ctrl+Alt+B` AI bar |
| Theme | the palette icon in the title bar, or **Settings › Branding** |
| Ask the AI | the composer in the AI bar; answers cite what they read |

State — theme, open tabs, which panel, which bars are visible — is kept in `localStorage`, so a reload returns to the same window. Below 780 px the mock hides the columns that no longer fit rather than squeezing the editor to nothing.

Buttons that would write something are **announcements**, not actions: they toast what the real surface would do. The exception is anything that only moves the window, which really moves.

## Adding a surface

1. Add a view to a module in `js/data.js` — `{ id, label, icon, badge, tone }`.
2. Register it in one of `js/views.*.js`:

```js
M.views['docs/releases'] = {
	title: 'Releases',
	render: function () {
		return M.ui.view(
			M.ui.pageHead({ title: 'Releases', icon: 'upload', desc: '…' }) +
			M.ui.table({ columns: [/* … */], rows: M.data.releases })
		);
	}
};
```

3. Build it from `M.ui` (`pageHead`, `card`, `kpis`, `table`, `list`, `bar`, `callout`, `tiles`), never from new CSS unless the pattern is genuinely new.
4. Any behaviour is a `data-` attribute — `data-open`, `data-action`, `data-prompt`, `data-toast` — handled in one place in `js/shell.js`. A view never adds a listener.
5. Icons are `<use href="#i-name">` against the sprite in `index.html`; add a symbol there rather than an image file.

## The questions this site exists to answer

- **One editor column, or several?** `temco-ui` decides that a surface of ours opens in one group and never splits. I/O Studio and Device Manager are the surfaces that will argue with that rule.
- **Where the AI bar lives.** A container contributed to the panel can be docked on the right, but a fresh profile needs one drag; a webview beside the page is a tab instead of a dock. The mock draws it docked.
- **Learn inside the window, or only a preview?** The mock treats it as both: a module that previews the site with the shipped template, so the layout is decided once.
- **The dashboard's place.** `ui/app-layout.md` puts the organisation-wide dashboard on the site at `/_admin/`, and the extension is the hand-off target. The mock keeps a dashboard in the window **and** a needs queue beside it; which of the two is the product is still open.
- **Whether anything is ever optional.** Today every module ships with the platform and none can be removed. If an add-on catalogue ever exists, it is a surface of its own with a publisher, a signature and a rollback — not a tab added to Settings.
