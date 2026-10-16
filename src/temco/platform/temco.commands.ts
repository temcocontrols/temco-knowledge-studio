/*---------------------------------------------------------------------------------------------
 *  Temco Platform — the shell.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CommandsRegistry, ICommandService } from '../../vs/platform/commands/common/commands.js';
import { TEMCO_DOCUMENTATION_COMMAND_ID, TEMCO_DOCS_VIEWS_COMMAND_ID } from './temco.ids.js';

/**
 * Plumbing: the small commands more than one surface needs, so a menu item, the first run and a
 * keybinding all point at one implementation.
 *
 * Opening the documentation means revealing the container the `temco-docs` module declares. The
 * shell asks for it by the command VS Code generates for that container, and never reaches into
 * the module.
 */
CommandsRegistry.registerCommand({
	id: TEMCO_DOCUMENTATION_COMMAND_ID,
	handler: async accessor => {
		const commandService = accessor.get(ICommandService);

		await commandService.executeCommand(TEMCO_DOCS_VIEWS_COMMAND_ID);
	}
});
