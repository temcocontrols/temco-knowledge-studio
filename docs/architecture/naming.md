# Naming

Every identifier in the product follows one rule: **the namespace is the module that owns the feature.**

## Patterns

| Kind | Pattern | Example |
|---|---|---|
| Repository | `temco-<name>` | `temco-platform`, `temco-learn` |
| Module folder | `temco-<module>` | `extensions/temco-docs` |
| Extension id | `temcocontrols.temco-<module>` | `temcocontrols.temco-docs` |
| Command id | `temco<Module>.<action>` | `temcoDocs.validate` |
| Command title | `Temco <Module>: <Action>` | `Temco Docs: Validate` |
| Setting id | `temco<Module>.<name>` | `temcoAi.model` |
| View id | `temco<Module>.<view>` | `temcoDocs.pages` |
| Container id | `temco`, `temcoTools`, `temcoAi` | titles: Temco, Tools, Temco AI |
| Working area | `<module>.<name>` | `temcoRepositories.workspaceFolder` |

## Words

| Word | Used for |
|---|---|
| **Temco Platform** | the product, and the application's display name |
| **Temco Learn** | the published site |
| **Temco Docs**, **Temco AI**, … | a module's name in user-visible text |
| `temco-docs`, `temco-ai`, … | a module in paths, ids and code |

"Knowledge" is not used in any identifier, title, path or document. It survives only in the history of the archived repository.

## Modules

| Module | Extension id | Namespace |
|---|---|---|
| `temco-docs` | `temcocontrols.temco-docs` | `temcoDocs` |
| `temco-ai` | `temcocontrols.temco-ai` | `temcoAi` |
| `temco-repositories` | `temcocontrols.temco-repositories` | `temcoRepositories` |
| `temco-projects` | `temcocontrols.temco-projects` | `temcoProjects` |
| `temco-sql` | `temcocontrols.temco-sql` | `temcoSql` |
| `temco-nettools` | `temcocontrols.temco-nettools` | `temcoNettools` |
| `temco-bacnet` | `temcocontrols.temco-bacnet` | `temcoBacnet` |
| `temco-device-manager` | `temcocontrols.temco-device-manager` | `temcoDevices` |

## Rename map

Applied in one pass, when the extension moves into `extensions/temco-docs` and before any release.

**Extension id**

| Current | Becomes |
|---|---|
| `temcocontrols.temco-knowledge-extension` | `temcocontrols.temco-docs` |

**Settings**

| Current | Becomes | Owner |
|---|---|---|
| `temcoKnowledge.workspaceFolder` | `temcoRepositories.workspaceFolder` | repositories |
| `temcoKnowledge.organisation` | `temcoRepositories.organisation` | repositories |
| `temcoKnowledge.ai.modelFolder` | `temcoAi.modelFolder` | AI |
| `temcoKnowledge.ai.allowUnpinned` | `temcoAi.allowUnpinned` | AI |
| `temcoKnowledge.ai.runtime` | `temcoAi.runtime` | AI |
| `temcoKnowledge.ai.model` | `temcoAi.model` | AI |
| `temcoKnowledge.ai.idleMinutes` | `temcoAi.idleMinutes` | AI |
| `temcoKnowledge.start.open` | `temcoDocs.start.open` | docs |

The default working-area path changes with it: `~/TemcoKnowledge` becomes `~/Temco`.

**Views**

| Current | Becomes |
|---|---|
| `temcoKnowledge.pages` | `temcoDocs.pages` |
| `temcoKnowledge.library` | `temcoDocs.library` |
| `temcoKnowledge.ai` | `temcoAi.panel` |

**Containers**

| Current | Becomes | Title |
|---|---|---|
| `temcoKnowledge` (activity bar) | `temco` | Temco |
| `temcoKnowledgePanel` (secondary side bar) | `temcoAi` | Temco AI |
| — new | `temcoTools` | Tools |

**Commands**

Every `temcoKnowledge.<action>` becomes `temcoDocs.<action>`. A command moves into another module's namespace on the day its code moves into that module.

**Catalog storage**

`<globalStorageUri>/catalog/catalog.db` moves with the extension id, because the storage folder is derived from the id. Any catalog created under the old id is left behind; it can be copied into the new folder by hand.

## Timing

Every identifier above is free to change **before the first release** and expensive afterwards: a renamed extension id orphans its storage, a renamed setting silently resets every user's value, a renamed command id breaks keybindings, menus and user scripts.

So the rename is done once, in the same pass as the move, before anything is released. After a release, an identifier changes only in a release that migrates its state.
