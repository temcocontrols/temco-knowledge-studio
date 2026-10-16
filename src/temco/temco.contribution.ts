/*---------------------------------------------------------------------------------------------
 *  Temco Platform — the shell.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// TEMCO: fork edit — the shell's single entry point.
//
// `src/vs/workbench/workbench.desktop.main.ts` imports this file and nothing else of Temco's.
// Every part below registers itself on import, the way VS Code's own contributions do, so this
// file stays a list and never grows a body. See `docs/temco-platform/README.md`.

import './services/temco.identity.js';
import './platform/temco.commands.js';
import './branding/temco.about.js';
import './menus/temco.menus.js';
import './startup/temco.startup.js';
