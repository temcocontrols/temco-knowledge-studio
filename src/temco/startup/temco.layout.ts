/*---------------------------------------------------------------------------------------------
 *  Temco Platform — the shell.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../vs/base/common/lifecycle.js';
import { IStorageService, StorageScope, StorageTarget } from '../../vs/platform/storage/common/storage.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../vs/workbench/common/contributions.js';

/** The marker that says which layout defaults this profile has already been given. */
const MARKER = 'temco.layoutDefaults';
/** Bumped whenever a container's view weights or default collapse state change. */
const DEFAULTS_VERSION = '2';

/**
 * The documentation panel's remembered view sizes, once.
 *
 * A view container stores how wide each view is, in workspace storage, the first time it is laid out — and those
 * numbers then beat every `initialSize` and `visibility` a manifest declares. That is correct for a person who has
 * sized things by hand, and wrong the one time the defaults themselves change: the panel keeps the old proportions
 * and the new defaults never appear.
 *
 * So this runs at startup, once per profile per version. It removes the stored sizes of the **documentation**
 * container only — every other container, and every other key, is left alone — and records that it did. After that
 * one reset the sizes are the person's again, and nothing here runs until the defaults change again.
 */
class TemcoLayoutDefaults extends Disposable {

	static readonly ID = 'temco.layoutDefaults';

	/** `${containerId}.state` is where `ViewContainerModel` keeps the view states and sizes, in workspace scope. */
	private static readonly CONTAINER_STATE_KEY = 'temco.state';

	constructor(@IStorageService private readonly storageService: IStorageService) {
		super();

		if (this.storageService.get(MARKER, StorageScope.PROFILE, '') === DEFAULTS_VERSION) {
			return;
		}
		this.storageService.remove(TemcoLayoutDefaults.CONTAINER_STATE_KEY, StorageScope.WORKSPACE);
		this.storageService.store(MARKER, DEFAULTS_VERSION, StorageScope.PROFILE, StorageTarget.USER);
	}
}

registerWorkbenchContribution2(TemcoLayoutDefaults.ID, TemcoLayoutDefaults, WorkbenchPhase.BlockStartup);
