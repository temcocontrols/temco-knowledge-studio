/*---------------------------------------------------------------------------------------------
 *  Temco Platform — the shell.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CommandsRegistry, ICommandService } from '../../vs/platform/commands/common/commands.js';
import { INotificationService } from '../../vs/platform/notification/common/notification.js';
import { TEMCO_ABOUT_COMMAND_ID, TEMCO_WORKBENCH_ABOUT_COMMAND_ID } from '../platform/temco.ids.js';
import { ITemcoIdentityService } from '../services/temco.identity.js';

/**
 * Branding: what the application says about itself.
 *
 * About is a page, not a dialog. The workbench module owns it because the page reports what this build
 * actually loaded — the modules, their versions, the platform and the remote — which a notification
 * cannot. This command opens that page. The identity summary is the fallback for a window where the
 * module is not there: Help ▸ About still says what this build is instead of opening nothing.
 *
 * The art it uses lives in `resources/temco/`, and the strings it shows come from the identity service
 * rather than from a literal, so renaming the product is one file.
 */
CommandsRegistry.registerCommand({
	id: TEMCO_ABOUT_COMMAND_ID,
	handler: async accessor => {
		if (!CommandsRegistry.getCommand(TEMCO_WORKBENCH_ABOUT_COMMAND_ID)) {
			accessor.get(INotificationService).info(accessor.get(ITemcoIdentityService).summary());
			return;
		}

		await accessor.get(ICommandService).executeCommand(TEMCO_WORKBENCH_ABOUT_COMMAND_ID);
	}
});
