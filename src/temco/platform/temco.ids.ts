/*---------------------------------------------------------------------------------------------
 *  Temco Platform — the shell.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../vs/nls.js';

/**
 * Every id and title the shell owns, in one place.
 *
 * The naming rules are in `docs/temco-platform/naming.md`: the namespace belongs to the part that
 * owns the feature, so a module's ids start with its own namespace (`temcoDocs.*`) and the shell's
 * start with `temco.platform.*`.
 */

/** The shell's own menu, appended to the menu bar by `menus/temco.menus.ts`. */
export const TEMCO_MENU_ID = 'TemcoMenu';

/** The documentation container, declared by the `temco-docs` module's manifest. */
export const TEMCO_DOCS_CONTAINER_ID = 'temco';

/**
 * The command VS Code generates for a view container. Revealing the container is how the shell
 * opens the module's views without knowing anything about them.
 */
export const TEMCO_DOCS_VIEWS_COMMAND_ID = `workbench.view.extension.${TEMCO_DOCS_CONTAINER_ID}`;

/** The shell's commands. */
export const TEMCO_ABOUT_COMMAND_ID = 'temco.platform.about';
export const TEMCO_DOCUMENTATION_COMMAND_ID = 'temco.platform.documentation';

/** Set the first time the shell reveals the documentation views, so it never happens twice. */
export const TEMCO_FIRST_RUN_STORAGE_KEY = 'temco.platform.firstRun';

export const TEMCO_MENU_TITLE = localize('temco.menu', "Temco");
export const TEMCO_MENU_MNEMONIC_TITLE = localize({ key: 'mTemco', comment: ['&& denotes a mnemonic'] }, "&&Temco");
export const TEMCO_ABOUT_TITLE = localize('temco.aboutTitle', "About Temco Platform");
export const TEMCO_DOCUMENTATION_TITLE = localize('temco.documentationTitle', "Open Documentation");
export const TEMCO_PLATFORM_TITLE = localize('temco.platformTitle', "Temco Platform");
