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

/**
 * The Tools menu — the mock's menu bar has File, Edit, View, Go, Run, Tools, Help, and Tools is the one title
 * VS Code does not contribute itself. The shell adds it in the gap between Run and Terminal.
 */
export const TEMCO_TOOLS_MENU_ID = 'TemcoToolsMenu';

/** The five studios the Tools menu opens, one command each: a menu item cannot carry arguments. */
export const TEMCO_TOOLS_COMMAND_IDS = {
	devices: 'temco.platform.tools.devices',
	io: 'temco.platform.tools.io',
	bacnet: 'temco.platform.tools.bacnet',
	network: 'temco.platform.tools.network',
	sql: 'temco.platform.tools.sql'
} as const;

/** The module command that opens a studio page, and the studio argument each shell command passes it. */
export const TEMCO_TOOLS_OPEN_COMMAND_ID = 'temcoTools.open';

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
export const TEMCO_WELCOME_COMMAND_ID = 'temco.platform.welcome';

/**
 * The welcome page's command, owned by the workbench module. The shell names it once, here, because a window that
 * has just started should open on that page and the shell is what decides what a first run does — it does not
 * restore a module's state or reach into its pages.
 */
export const TEMCO_WORKBENCH_WELCOME_COMMAND_ID = 'temcoWorkbench.welcome';

/** The pages the modules publish and the Temco menu names. */
export const TEMCO_DOCS_HOWTO_COMMAND_ID = 'temcoDocs.howTo';
export const TEMCO_SETTINGS_COMMAND_ID = 'temcoWorkbench.settings';
export const TEMCO_HELP_COMMAND_ID = 'temcoWorkbench.help';

/** Set the first time the shell reveals the documentation views, so it never happens twice. */
export const TEMCO_FIRST_RUN_STORAGE_KEY = 'temco.platform.firstRun';

export const TEMCO_MENU_TITLE = localize('temco.menu', "Temco");
export const TEMCO_MENU_MNEMONIC_TITLE = localize({ key: 'mTemco', comment: ['&& denotes a mnemonic'] }, "&&Temco");
export const TEMCO_TOOLS_MENU_TITLE = localize('temco.toolsMenu', "Tools");
export const TEMCO_TOOLS_MENU_MNEMONIC_TITLE = localize({ key: 'mTools', comment: ['&& denotes a mnemonic'] }, "&&Tools");
export const TEMCO_NEW_PROJECT_TITLE = localize('temco.newProjectTitle', "New Project…");
export const TEMCO_ADD_SOURCE_TITLE = localize('temco.addSourceTitle', "Add a Source…");
export const TEMCO_PROJECTS_TITLE = localize('temco.projectsTitle', "Projects");
export const TEMCO_DEVICES_TITLE = localize('temco.devicesTitle', "Devices");
export const TEMCO_IO_TITLE = localize('temco.ioTitle', "I/O Studio");
export const TEMCO_BACNET_TITLE = localize('temco.bacnetTitle', "BACnet Studio");
export const TEMCO_NETWORK_TITLE = localize('temco.networkTitle', "Network");
export const TEMCO_SQL_TITLE = localize('temco.sqlTitle', "SQL Studio");
export const TEMCO_RUN_SITE_TITLE = localize('temco.runSiteTitle', "Build the Site");
export const TEMCO_RUN_HELP_TITLE = localize('temco.runHelpTitle', "Build the Offline Help");
export const TEMCO_RUN_OWED_TITLE = localize('temco.runOwedTitle', "Run the Docs-Owed Check");
export const TEMCO_DASHBOARD_TITLE = localize('temco.dashboardTitle', "Dashboard");
export const TEMCO_OVERVIEW_TITLE = localize('temco.overviewTitle', "Documentation Overview");
export const TEMCO_AI_TITLE = localize('temco.aiTitle', "AI Hub");
export const TEMCO_DISCOVER_TITLE = localize('temco.discoverTitle', "Discover Devices");
export const TEMCO_CAPTURE_TITLE = localize('temco.captureTitle', "New Capture");
export const TEMCO_SHOW_LOGS_TITLE = localize('temco.showLogsTitle', "Show Logs");
export const TEMCO_ABOUT_TITLE = localize('temco.aboutTitle', "About Temco Platform");
export const TEMCO_DOCUMENTATION_TITLE = localize('temco.documentationTitle', "Open Documentation");
export const TEMCO_WELCOME_TITLE = localize('temco.welcomeTitle', "Welcome");
export const TEMCO_HOWTO_TITLE = localize('temco.howToTitle', "How To Use");
export const TEMCO_SETTINGS_TITLE = localize('temco.settingsTitle', "Settings");
export const TEMCO_HELP_TITLE = localize('temco.helpTitle', "Help");
export const TEMCO_PLATFORM_TITLE = localize('temco.platformTitle', "Temco Platform");
