/*---------------------------------------------------------------------------------------------
 *  Temco Platform — the shell.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CommandsRegistry } from '../../vs/platform/commands/common/commands.js';
import { INotificationService } from '../../vs/platform/notification/common/notification.js';
import { TEMCO_ABOUT_COMMAND_ID } from '../platform/temco.ids.js';
import { ITemcoIdentityService } from '../services/temco.identity.js';

/**
 * Branding: what the application says about itself.
 *
 * The shell owns the identity behaviour — the About command today, the splash and first-run words
 * as they arrive. The art it uses lives in `resources/temco/`, and the strings it shows come from
 * the identity service rather than from a literal, so renaming the product is one file.
 */
CommandsRegistry.registerCommand({
	id: TEMCO_ABOUT_COMMAND_ID,
	handler: accessor => {
		const identity = accessor.get(ITemcoIdentityService);
		const notificationService = accessor.get(INotificationService);

		notificationService.info(identity.summary());
	}
});
