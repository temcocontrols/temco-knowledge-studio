/*---------------------------------------------------------------------------------------------
 *  Temco Platform — the shell.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../vs/base/common/lifecycle.js';
import { ICommandService } from '../../vs/platform/commands/common/commands.js';
import { IStorageService, StorageScope, StorageTarget } from '../../vs/platform/storage/common/storage.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../vs/workbench/common/contributions.js';
import { TEMCO_DOCUMENTATION_COMMAND_ID, TEMCO_FIRST_RUN_STORAGE_KEY, TEMCO_WELCOME_COMMAND_ID } from '../platform/temco.ids.js';

/**
 * Startup: a fresh installation opens on the welcome page, and reveals the documentation views
 * beside it, so the first thing a person sees is what the application is for rather than an empty
 * editor.
 *
 * The flag is written in the application scope, so an update never asks twice, and both surfaces
 * are reached through the same commands the Temco menu uses — the shell does not reach into a
 * module. The welcome page is a module's page, so if that module is not there the documentation
 * reveal still happens and the first run is not wasted.
 */
class TemcoFirstRun extends Disposable {

	static readonly ID = 'temco.firstRun';

	constructor(
		@ICommandService private readonly commandService: ICommandService,
		@IStorageService private readonly storageService: IStorageService
	) {
		super();

		const seen = this.storageService.getBoolean(TEMCO_FIRST_RUN_STORAGE_KEY, StorageScope.APPLICATION, false);
		if (!seen) {
			this.storageService.store(TEMCO_FIRST_RUN_STORAGE_KEY, true, StorageScope.APPLICATION, StorageTarget.USER);
			void this.commandService.executeCommand(TEMCO_WELCOME_COMMAND_ID);
			void this.commandService.executeCommand(TEMCO_DOCUMENTATION_COMMAND_ID);
		}
	}
}

registerWorkbenchContribution2(TemcoFirstRun.ID, TemcoFirstRun, WorkbenchPhase.AfterRestored);
