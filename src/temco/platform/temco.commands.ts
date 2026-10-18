/*---------------------------------------------------------------------------------------------
 *  Temco Platform — the shell.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CommandsRegistry, ICommandService } from '../../vs/platform/commands/common/commands.js';
import {
	TEMCO_DOCUMENTATION_COMMAND_ID, TEMCO_DOCS_VIEWS_COMMAND_ID,
	TEMCO_TOOLS_COMMAND_IDS, TEMCO_TOOLS_OPEN_COMMAND_ID,
	TEMCO_WELCOME_COMMAND_ID, TEMCO_WORKBENCH_WELCOME_COMMAND_ID
} from './temco.ids.js';

/**
 * Plumbing: the small commands more than one surface needs, so a menu item, the first run and a
 * keybinding all point at one implementation.
 *
 * Opening the documentation means revealing the container the `temco-docs` module declares. The
 * shell asks for it by the command VS Code generates for that container, and never reaches into
 * the module.
 *
 * Opening the welcome page is the same shape: the page belongs to the `temco-workbench` module,
 * which publishes one command for it, and the shell names that command rather than the page.
 */
CommandsRegistry.registerCommand({
	id: TEMCO_DOCUMENTATION_COMMAND_ID,
	handler: async accessor => {
		const commandService = accessor.get(ICommandService);

		await commandService.executeCommand(TEMCO_DOCS_VIEWS_COMMAND_ID);
	}
});

CommandsRegistry.registerCommand({
	id: TEMCO_WELCOME_COMMAND_ID,
	handler: async accessor => {
		const commandService = accessor.get(ICommandService);

		await commandService.executeCommand(TEMCO_WORKBENCH_WELCOME_COMMAND_ID);
	}
});

/**
 * The Tools menu's five items. A menu item names a command but cannot carry an argument, so each studio gets a
 * shell command of its own that passes the studio on to the one module command that opens a studio page.
 */
for (const studio of Object.keys(TEMCO_TOOLS_COMMAND_IDS) as (keyof typeof TEMCO_TOOLS_COMMAND_IDS)[]) {
	CommandsRegistry.registerCommand({
		id: TEMCO_TOOLS_COMMAND_IDS[studio],
		handler: async accessor => {
			const commandService = accessor.get(ICommandService);

			await commandService.executeCommand(TEMCO_TOOLS_OPEN_COMMAND_ID, studio);
		}
	});
}
