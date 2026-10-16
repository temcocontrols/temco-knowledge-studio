/*---------------------------------------------------------------------------------------------
 *  Temco Platform — the shell.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MenuId, MenuRegistry } from '../../vs/platform/actions/common/actions.js';
import {
	TEMCO_ABOUT_COMMAND_ID, TEMCO_ABOUT_TITLE,
	TEMCO_DOCUMENTATION_COMMAND_ID, TEMCO_DOCUMENTATION_TITLE,
	TEMCO_MENU_ID, TEMCO_MENU_MNEMONIC_TITLE, TEMCO_MENU_TITLE
} from '../platform/temco.ids.js';

/**
 * The shell owns the application's top-level menus, the way VS Code's own features own theirs: a
 * module contributes views and commands, and what appears in the menu bar is the shell's decision.
 *
 * `order: 8` places Temco between Terminal and Help — where a product's own menu belongs.
 */
export const TemcoMenuId = new MenuId(TEMCO_MENU_ID);

MenuRegistry.appendMenuItem(MenuId.MenubarMainMenu, {
	submenu: TemcoMenuId,
	title: {
		value: TEMCO_MENU_TITLE,
		original: TEMCO_MENU_TITLE,
		mnemonicTitle: TEMCO_MENU_MNEMONIC_TITLE
	},
	order: 8
});

MenuRegistry.appendMenuItem(TemcoMenuId, {
	command: { id: TEMCO_DOCUMENTATION_COMMAND_ID, title: TEMCO_DOCUMENTATION_TITLE },
	group: '1_documentation',
	order: 1
});

MenuRegistry.appendMenuItem(TemcoMenuId, {
	command: { id: TEMCO_ABOUT_COMMAND_ID, title: TEMCO_ABOUT_TITLE },
	group: '9_about',
	order: 1
});
