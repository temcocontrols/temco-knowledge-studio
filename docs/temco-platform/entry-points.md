# Entry points

The fork touches VS Code's source in exactly two places. Both are additive lines in lists. This is the complete list.

## 1. The compile list

| | |
|---|---|
| **File** | `src/tsconfig.json` |
| **Addition** | `src/temco/**` added to the `include` list |
| **Why** | the config includes `./vs/**` and a few root files only. Without this line the shell is not compiled and not type-checked |

## 2. The load list

| | |
|---|---|
| **File** | `src/vs/workbench/workbench.desktop.main.ts` |
| **Addition** | one import of `../temco/temco.contribution.js` |
| **Why** | the workbench loads its parts, services and contributions through explicit imports. Code that nothing imports never runs |

This is how VS Code's own features enter the workbench: a contribution file that is imported and registers itself. The menu bar is built the same way — it renders whatever is registered in the menu registry, and a feature such as the debugger adds its own top-level menu from its own contribution file. That is why Temco's menus are Temco's own code.

## Not entry points

| Not a seam | Why |
|---|---|
| `product.json` | the fork's own identity file: product name, icons, default settings, update and telemetry policy |
| `resources/**` | Temco's own images |
| `extensions/temco-*/**` | new folders; the build picks up any folder with a `package.json` |
| `docs/**` | Temco's own documentation |
| module build wiring | none needed: modules are compiled by the existing extension build, and each folder's dependencies are installed by the root install |
| `build/lib/extensions.ts` | touched only if a module ships a native npm module, which no planned module does |

## Rule

This list may not grow without a decision. An addition needs a written reason and a row above. Before adding one, the first question is whether the need can be met by a new folder instead — a module, a `product.json` field, or an extension contribution point.

## After a VS Code update

1. Does `src/tsconfig.json` still include `src/temco/**`?
2. Does `workbench.desktop.main.ts` still import `temco.contribution`?
3. Does `src/temco/temco.contribution.ts` still exist at that path?

If all three hold, the shell is intact.
