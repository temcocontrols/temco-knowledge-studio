# temco-ai

The local-AI module of Temco Platform. It runs a model on this machine and answers from the documentation it is
given — it is the module that drafts a page's body, and the module that says what a source's documentation is
missing.

| | |
|---|---|
| Extension id | `temcocontrols.temco-ai` |
| Namespace | `temcoAi` |
| State | active |
| Register | [`docs/temco-platform/modules/README.md`](../../docs/temco-platform/modules/README.md) |

## What it owns

The runtime and the models downloaded on request into the user's own folder, the prompts, the AI panel, the AI
page, drafts and their diffs, and the citations that open the page they name. It reads the documentation through
`temco-docs` and never writes a page itself: *Apply* hands the text to `temco-repositories`, which asks where the
page lives — an uncommitted `git apply` in the clone that holds it, with Undo, or the editor's edit and its `Ctrl+Z`
in the tree this window has open — and a person answers that question before anything is written.

```
src/extension.ts      the module's entry point, its panel, and the API the rest of the platform calls
src/docs.ts           what this module reads of the documentation module — the contract, in one file
src/surface.ts        the AI page's view type
src/ai/               the model, the runtime, the downloads, the prompts, and the panel behind them
src/aiPage.ts         the page that says what is installed and where it lives
media/                the panel's script, its styles, and the module's icon
prompts/              the templates the module sends to the model, one file per task
```

## How it talks to `temco-docs`

The dependency runs one way, and it is declared in the manifest:

- **This module requires `temcocontrols.temco-docs`** (`extensionDependencies`). That module is activated first,
  so its exports are ready when this module's `activate()` runs, and the AI panel reads the sets, the pages and
  the selection through them (`src/docs.ts`) instead of keeping a copy.
- **The documentation module requires nothing of this one.** It calls this module's commands when the module is
  installed — the AI page from the project hub and the library view, a body to draft, a source to analyse — and
  every one of those is a plain command, so an install without this module is a smaller install, not a broken one.

## Commands

| Command | What it does |
|---|---|
| `temcoAi.page` | Opens the AI page, or one of its sections (`downloads`) |
| `temcoAi.openPanel` | Focuses the AI panel in the right side bar |
| `temcoAi.models` | Picks the runtime and the model, downloading what is missing |
| `temcoAi.removeModel` | Removes a downloaded model or runtime |
| `temcoAi.openModelFolder` | Opens the folder the models live in |
| `temcoAi.dockRight` | Shows the AI in the right side bar |
| `temcoAi.status` | The runtime, the model and the server, as a message |

## Settings

`temcoAi.modelFolder`, `temcoAi.allowUnpinned`, `temcoAi.runtime`, `temcoAi.model`, `temcoAi.idleMinutes` — every
one of them in this module's namespace, and none of them read by another module.

## Checks

```
npm run check-commands      # no command id is registered twice
```

The platform build runs the same check for every module (`npm run compile` → `check-temco`, which also checks that no module requires another in a circle and that every menu id is declared).
