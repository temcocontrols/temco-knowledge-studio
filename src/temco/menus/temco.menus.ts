/*---------------------------------------------------------------------------------------------
 *  Temco Platform — the shell.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MenuId, MenuRegistry } from '../../vs/platform/actions/common/actions.js';
import { localize } from '../../vs/nls.js';
import {
	TEMCO_TOOLS_COMMAND_IDS, TEMCO_TOOLS_MENU_ID,
	TEMCO_TOOLS_MENU_MNEMONIC_TITLE, TEMCO_TOOLS_MENU_TITLE
} from '../platform/temco.ids.js';

/**
 * The menu bar is the mock's, title for title and item for item.
 *
 * VS Code's menus *accumulate*: every feature appends, so File always carries New File, Save As, Preferences and Exit,
 * and Help carries release notes and the debug tools. The mock's menus are *authored*: each one is a short, deliberate
 * list. Those are different things, and appending can never turn one into the other — so this module empties each
 * menu first, then fills it from the mock's own table (`docs/mock/js/shell.js`, `menus`).
 *
 * Emptying uses the registry's item store, which is the only handle on items another feature registered: the public
 * API appends and returns a disposable for the caller's own item, and nothing for anyone else's. The store is read
 * here through the registry object itself, in one function, so the assumption is in one place.
 */

const ToolsMenuId = new MenuId(TEMCO_TOOLS_MENU_ID);
const ToolsDocumentationMenuId = new MenuId('TemcoToolsDocumentationMenu');
const ToolsAiMenuId = new MenuId('TemcoToolsAiMenu');

/** Empty one menu, so what follows is the whole of it. */
function reset(id: MenuId): void {
	const registry = MenuRegistry as unknown as { _menuItems?: Map<MenuId, unknown> };
	registry._menuItems?.delete(id);
}

/** One item. `group` is the separator: two different groups are drawn with a rule between them. */
function item(menu: MenuId, command: string, title: string, group: string, order: number): void {
	MenuRegistry.appendMenuItem(menu, { command: { id: command, title }, group, order });
}

/** A submenu: the mock's Tools groups a module once it has three or more actions. */
function submenu(menu: MenuId, id: MenuId, title: string, group: string, order: number): void {
	MenuRegistry.appendMenuItem(menu, { submenu: id, title, group, order });
}

const STUDIOS = [
	['devices', localize('temco.menu.devices', "Devices")],
	['io', localize('temco.menu.io', "I/O Studio")],
	['bacnet', localize('temco.menu.bacnet', "BACnet Studio")],
	['network', localize('temco.menu.network', "Network")],
	['sql', localize('temco.menu.sql', "SQL Studio")]
] as const;

/* ---------------------------------------------------------------- the bar */

MenuRegistry.appendMenuItem(MenuId.MenubarMainMenu, {
	submenu: ToolsMenuId,
	title: {
		value: TEMCO_TOOLS_MENU_TITLE,
		original: TEMCO_TOOLS_MENU_TITLE,
		mnemonicTitle: TEMCO_TOOLS_MENU_MNEMONIC_TITLE
	},
	// Between Run (6) and Help (8) — where the mock puts Tools.
	order: 6.5
});

/* --------------------------------------------------------------- the menus */

// The six menus VS Code fills are emptied first; MenubarMainMenu only gains the Tools title.
for (const menu of [
	MenuId.MenubarFileMenu,
	MenuId.MenubarEditMenu,
	MenuId.MenubarViewMenu,
	MenuId.MenubarGoMenu,
	MenuId.MenubarDebugMenu,
	MenuId.MenubarHelpMenu
]) {
	reset(menu);
}

// File — a project is what this application opens, so the lifecycle is the whole menu.
item(MenuId.MenubarFileMenu, 'temcoProjects.newProject', localize('temco.menu.newProject', "New Project…"), '1_open', 1);
item(MenuId.MenubarFileMenu, 'workbench.action.files.openFolder', localize('temco.menu.openWorkspace', "Open Workspace…"), '1_open', 2);
item(MenuId.MenubarFileMenu, 'temcoProjects.addSource', localize('temco.menu.addSource', "Add Source…"), '1_open', 3);
item(MenuId.MenubarFileMenu, 'workbench.action.files.saveAll', localize('temco.menu.saveAll', "Save All"), '3_save', 1);
item(MenuId.MenubarFileMenu, 'workbench.action.closeActiveEditor', localize('temco.menu.closeTab', "Close Tab"), '5_close', 1);
item(MenuId.MenubarFileMenu, 'workbench.action.closeWindow', localize('temco.menu.closeWindow', "Close Window"), '5_close', 2);

// Edit — the mock disables these because it has no editor; here they are the editor's own commands.
item(MenuId.MenubarEditMenu, 'undo', localize('temco.menu.undo', "Undo"), '1_undo', 1);
item(MenuId.MenubarEditMenu, 'redo', localize('temco.menu.redo', "Redo"), '1_undo', 2);
item(MenuId.MenubarEditMenu, 'actions.find', localize('temco.menu.find', "Find"), '3_find', 1);
item(MenuId.MenubarEditMenu, 'editor.action.startFindReplaceAction', localize('temco.menu.replace', "Replace"), '3_find', 2);
item(MenuId.MenubarEditMenu, 'copyFilePath', localize('temco.menu.copyPath', "Copy Path"), '5_copy', 1);

// View — the two palettes, the three bars, the panel's views, the theme.
item(MenuId.MenubarViewMenu, 'workbench.action.showCommands', localize('temco.menu.palette', "Command Palette…"), '1_palette', 1);
item(MenuId.MenubarViewMenu, 'workbench.action.quickOpen', localize('temco.menu.quickOpen', "Quick Open…"), '1_palette', 2);
item(MenuId.MenubarViewMenu, 'workbench.action.toggleSidebarVisibility', localize('temco.menu.toggleSidebar', "Toggle Primary Side Bar"), '3_bars', 1);
item(MenuId.MenubarViewMenu, 'workbench.action.togglePanel', localize('temco.menu.togglePanel', "Toggle Panel"), '3_bars', 2);
item(MenuId.MenubarViewMenu, 'temcoAi.dockRight', localize('temco.menu.toggleAiBar', "Toggle AI Bar"), '3_bars', 3);
item(MenuId.MenubarViewMenu, 'workbench.action.toggleBreadcrumbs', localize('temco.menu.toggleBreadcrumbs', "Toggle Breadcrumbs"), '3_bars', 4);
item(MenuId.MenubarViewMenu, 'workbench.actions.view.problems', localize('temco.menu.problems', "Problems"), '5_panels', 1);
item(MenuId.MenubarViewMenu, 'workbench.action.output.toggleOutput', localize('temco.menu.output', "Output"), '5_panels', 2);
item(MenuId.MenubarViewMenu, 'workbench.action.terminal.toggleTerminal', localize('temco.menu.terminal', "Terminal"), '5_panels', 3);
item(MenuId.MenubarViewMenu, 'workbench.action.selectTheme', localize('temco.menu.colorTheme', "Color Theme"), '7_theme', 1);

// Go — the modules, then the studios, then the surface palette and settings.
item(MenuId.MenubarGoMenu, 'temcoWorkbench.home', localize('temco.menu.dashboard', "Dashboard"), '1_modules', 1);
item(MenuId.MenubarGoMenu, 'temcoWorkbench.workspaces', localize('temco.menu.workspaces', "Workspaces"), '1_modules', 2);
item(MenuId.MenubarGoMenu, 'temcoDocs.overview', localize('temco.menu.documentation', "Documentation"), '1_modules', 3);
item(MenuId.MenubarGoMenu, 'temcoAi.page', localize('temco.menu.aiHub', "AI Hub"), '1_modules', 4);
STUDIOS.forEach(([studio, title], index) => {
	item(MenuId.MenubarGoMenu, TEMCO_TOOLS_COMMAND_IDS[studio], title, '3_studios', index + 1);
});
item(MenuId.MenubarGoMenu, 'workbench.action.quickOpen', localize('temco.menu.goToSurface', "Go to Surface…"), '5_surface', 1);
item(MenuId.MenubarGoMenu, 'temcoWorkbench.settings', localize('temco.menu.settings', "Settings"), '5_surface', 2);

// Run — the long actions: build, query, discover, capture.
item(MenuId.MenubarDebugMenu, 'temcoDocs.buildSite', localize('temco.menu.buildDocumentation', "Build Documentation"), '1_build', 1);
item(MenuId.MenubarDebugMenu, 'temcoDocs.buildHelp', localize('temco.menu.buildOfflineHelp', "Build Offline Help"), '1_build', 2);
item(MenuId.MenubarDebugMenu, TEMCO_TOOLS_COMMAND_IDS.sql, localize('temco.menu.runQuery', "Run Query"), '3_query', 1);
item(MenuId.MenubarDebugMenu, TEMCO_TOOLS_COMMAND_IDS.devices, localize('temco.menu.discoverDevices', "Discover Devices"), '5_devices', 1);
item(MenuId.MenubarDebugMenu, TEMCO_TOOLS_COMMAND_IDS.network, localize('temco.menu.startCapture', "Start Capture"), '5_devices', 2);
item(MenuId.MenubarDebugMenu, 'workbench.action.tasks.terminate', localize('temco.menu.stopTask', "Stop Running Task"), '7_stop', 1);

// Tools — the modules, a submenu once a module has three or more actions.
submenu(ToolsMenuId, ToolsDocumentationMenuId, localize('temco.menu.toolsDocumentation', "Documentation"), '1_docs', 1);
item(ToolsDocumentationMenuId, 'temcoRepositories.readAllSources', localize('temco.menu.readAll', "Read All Sources"), '1_read', 1);
item(ToolsDocumentationMenuId, 'temcoDocs.validate', localize('temco.menu.validate', "Validate Structure"), '1_read', 2);
item(ToolsDocumentationMenuId, 'temcoDocs.buildSite', localize('temco.menu.buildWebsite', "Build Website"), '2_build', 1);
item(ToolsDocumentationMenuId, 'temcoDocs.buildHelp', localize('temco.menu.buildOfflineHelpTools', "Build Offline Help"), '2_build', 2);

item(ToolsMenuId, TEMCO_TOOLS_COMMAND_IDS.devices, localize('temco.menu.devicesDiscover', "Devices: Discover"), '2_studios', 1);
item(ToolsMenuId, TEMCO_TOOLS_COMMAND_IDS.io, localize('temco.menu.ioAutoMap', "I/O Studio: Auto-Map Points"), '2_studios', 2);
item(ToolsMenuId, TEMCO_TOOLS_COMMAND_IDS.network, localize('temco.menu.networkScan', "Network: Scan Segment"), '2_studios', 3);

submenu(ToolsMenuId, ToolsAiMenuId, localize('temco.menu.toolsAi', "AI"), '3_ai', 1);
item(ToolsAiMenuId, 'temcoAi.models', localize('temco.menu.loadModel', "Load Model…"), '1_model', 1);
item(ToolsAiMenuId, 'temcoAi.page', localize('temco.menu.openAiActions', "Open Actions"), '1_model', 2);

item(ToolsMenuId, 'workbench.action.openSettingsJson', localize('temco.menu.openSettingsJson', "Developer: Open Settings JSON"), '9_developer', 1);

// Help — the product's own help first, then support, then about.
item(MenuId.MenubarHelpMenu, 'temcoWorkbench.welcome', localize('temco.menu.welcome', "Welcome"), '1_help', 1);
item(MenuId.MenubarHelpMenu, 'temcoWorkbench.help', localize('temco.menu.help', "Help"), '1_help', 2);
item(MenuId.MenubarHelpMenu, 'temcoDocs.overview', localize('temco.menu.documentationHelp', "Documentation"), '1_help', 3);
item(MenuId.MenubarHelpMenu, 'workbench.action.openGlobalKeybindings', localize('temco.menu.shortcuts', "Keyboard Shortcuts"), '1_help', 4);
item(MenuId.MenubarHelpMenu, 'workbench.action.showLogs', localize('temco.menu.showLogs', "Show Logs"), '3_support', 1);
item(MenuId.MenubarHelpMenu, 'workbench.action.openIssueReporter', localize('temco.menu.reportIssue', "Report an Issue"), '3_support', 2);
item(MenuId.MenubarHelpMenu, 'temco.platform.about', localize('temco.menu.about', "About Temco Platform"), '9_about', 1);
