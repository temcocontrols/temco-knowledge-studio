/*---------------------------------------------------------------------------------------------
 *  Temco Platform — the shell.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../vs/base/common/lifecycle.js';
import { ICommandService } from '../../vs/platform/commands/common/commands.js';
import { Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../vs/platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../vs/platform/registry/common/platform.js';
import { IStorageService, StorageScope, StorageTarget } from '../../vs/platform/storage/common/storage.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../vs/workbench/common/contributions.js';
import { IViewDescriptorService } from '../../vs/workbench/common/views.js';
import { IViewsService } from '../../vs/workbench/services/views/common/viewsService.js';
import { TEMCO_DOCS_CONTAINER_ID, TEMCO_FIRST_RUN_STORAGE_KEY, TEMCO_WELCOME_COMMAND_ID } from '../platform/temco.ids.js';

/**
 * The window opens on our welcome page and nothing else: `none` is the only value of
 * `workbench.startupEditor` that keeps VS Code's own Welcome editor out of a window whose editors
 * cannot be restored. The Temco page is opened by the workbench module's start setting instead
 * (`temcoWorkbench.start.open`, default `welcome`).
 *
 * Registered here, not in `product.json`: the workbench does not read a product configuration's
 * `configurationDefaults`, so that spelling silently fell back to `welcomePage` and showed both.
 */
Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerDefaultConfigurations([{
	overrides: {
		'workbench.startupEditor': 'none',
		// Installing a module must not swap the window for VS Code's walkthrough editor either.
		'workbench.welcomePage.walkthroughs.openOnInstall': false
	}
}]);

/**
 * Startup: a fresh installation opens on the welcome page and selects Documentation in the
 * activity bar, so the first thing a person sees is what the application is for rather than an
 * empty editor beside Explorer.
 *
 * This is the same arrangement VS Code has: a fresh window opens on the welcome page, the page
 * carries the checkbox that turns that off, and Help ▸ Welcome brings it back. What this
 * contribution adds over the setting (`temcoWorkbench.start.open`, whose default is `welcome`) is
 * the *once-only* case — on a fresh installation the welcome page is shown even if a profile was
 * copied in with the setting already turned off.
 *
 * The flag is written in the application scope, so an update never asks twice. The welcome page is
 * reached through the command the Temco menu uses; the container is opened through the view
 * services, because it is contributed by a module that may not have been activated yet.
 */
class TemcoFirstRun extends Disposable {

	static readonly ID = 'temco.firstRun';

	constructor(
		@ICommandService private readonly commandService: ICommandService,
		@IStorageService private readonly storageService: IStorageService,
		@IViewDescriptorService private readonly viewDescriptorService: IViewDescriptorService,
		@IViewsService private readonly viewsService: IViewsService
	) {
		super();

		const seen = this.storageService.getBoolean(TEMCO_FIRST_RUN_STORAGE_KEY, StorageScope.APPLICATION, false);
		if (!seen) {
			this.storageService.store(TEMCO_FIRST_RUN_STORAGE_KEY, true, StorageScope.APPLICATION, StorageTarget.USER);
			void this.commandService.executeCommand(TEMCO_WELCOME_COMMAND_ID);
			this.selectDocumentation();
		}
	}

	/**
	 * Selects the Documentation container in the activity bar.
	 *
	 * The container is contributed by a module's manifest, so it is in the registry only once that
	 * module has been activated — and the first run happens earlier than that. Asking the container's
	 * own command is not a way around it: that command is registered with the container, so it does
	 * not exist yet either. Waiting for the registry is.
	 */
	private selectDocumentation(): void {
		if (this.viewDescriptorService.getViewContainerById(TEMCO_DOCS_CONTAINER_ID) !== null) {
			void this.viewsService.openViewContainer(TEMCO_DOCS_CONTAINER_ID);
			return;
		}

		const listener = this.viewDescriptorService.onDidChangeViewContainers(({ added }) => {
			if (added.some(({ container }) => container.id === TEMCO_DOCS_CONTAINER_ID)) {
				listener.dispose();
				void this.viewsService.openViewContainer(TEMCO_DOCS_CONTAINER_ID);
			}
		});
		this._register(listener);
	}
}

registerWorkbenchContribution2(TemcoFirstRun.ID, TemcoFirstRun, WorkbenchPhase.AfterRestored);
