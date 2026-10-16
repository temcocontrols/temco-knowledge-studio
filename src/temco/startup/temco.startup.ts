/*---------------------------------------------------------------------------------------------
 *  Temco Platform — the shell.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../vs/base/common/lifecycle.js';
import { ICommandService } from '../../vs/platform/commands/common/commands.js';
import { IStorageService, StorageScope } from '../../vs/platform/storage/common/storage.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../vs/workbench/common/contributions.js';
import { TEMCO_DOCUMENTATION_COMMAND_ID, TEMCO_FIRST_RUN_STORAGE_KEY } from '../platform/temco.ids.js';

/**
 * Startup: the documentation views are revealed once, so a fresh installation opens on the thing
 * the application is for instead of on an empty editor.
 *
 * The flag is written in the application scope, so an update never asks twice, and the views are
 * revealed through the same command the Temco menu uses — the shell does not reach into a module.
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
			this.storageService.store(TEMCO_FIRST_RUN_STORAGE_KEY, true, StorageScope.APPLICATION);
			void this.commandService.executeCommand(TEMCO_DOCUMENTATION_COMMAND_ID);
		}
	}
}

registerWorkbenchContribution2(TemcoFirstRun.ID, TemcoFirstRun, WorkbenchPhase.AfterRestored);
