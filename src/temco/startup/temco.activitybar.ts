/*---------------------------------------------------------------------------------------------
 *  Temco Platform — the shell.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../vs/base/common/lifecycle.js';
import { Registry } from '../../vs/platform/registry/common/platform.js';
import { IStorageService, StorageScope } from '../../vs/platform/storage/common/storage.js';
import { Extensions, IViewContainersRegistry, ViewContainer } from '../../vs/workbench/common/views.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../vs/workbench/common/contributions.js';

/** The key the activity bar keeps its own order in: an array of container ids, written as icons are pinned. */
const PINNED_VIEWLETS_KEY = 'workbench.activity.pinnedViewlets2';

/** The bar's order, as the mock has it. Explorer and Search come before these and are VS Code's own. */
const ORDER = [
	'temcoDashboard',
	'temco',
	'temcoRepos',
	'temcoAiHub',
	'temcoLearn',
	'temcoSql',
	'temcoSettings',
	'temcoHelp'
];

/**
 * The activity bar, arranged as the mock arranges it.
 *
 * The mock's bar is the modules and nothing else; VS Code's bar is Explorer, Search, Source Control, Run, Extensions
 * and then whatever a module contributed. The shell keeps the two that a workbench cannot do without — **Explorer**
 * and **Search** — and takes the other three out, so the bar is: Explorer · Search · the modules.
 *
 * Why it happens here and not in a manifest: `viewsContainers` is an *additive* contribution point. There is no
 * "remove container" in any extension API, and the one registry that can do it is the workbench's own — which is
 * exactly what the shell is for. Nothing is deleted: the containers are deregistered, so their views are unreachable
 * from the bar and every one of their commands still exists in the palette.
 *
 * The order is a second problem with the same cause. A container cannot declare an order, so the bar renders in the
 * order containers were registered — and it *remembers* that order in a profile storage key. A container added later
 * is appended to a remembered list rather than placed where its manifest puts it. So before the bar is built, the
 * remembered list is compared with `ORDER`: if our containers are not in that sequence, the list is dropped and the
 * bar renders from registration order, which is now the manifest's order. It runs in `BlockStartup`, not after the
 * window has been restored, because the bar reads the key while it is being built.
 */
class TemcoActivityBar extends Disposable {

	static readonly ID = 'temco.activityBar';

	/** The built-in containers the mock's bar does not have. Explorer and Search are deliberately absent from this list. */
	private static readonly HIDDEN = [
		'workbench.view.scm',
		'workbench.view.debug',
		'workbench.view.extensions',
		// The module containers that are shelved for now. Deregistering a container takes it off the bar and leaves
		// every command of it in the palette: nothing is deleted, and putting one back is one line here.
		'temcoDevices',
		'temcoIo',
		'temcoBacnet',
		'temcoNetwork'
	];

	constructor(@IStorageService storageService: IStorageService) {
		super();

		// The remembered order, before anything reads it.
		const raw = storageService.get(PINNED_VIEWLETS_KEY, StorageScope.PROFILE, '[]');
		const hidden = new Set(TemcoActivityBar.HIDDEN);
		try {
			const stored = (JSON.parse(raw) as { id?: string }[]).map((entry) => entry.id).filter((id): id is string => typeof id === 'string');
			const ours = stored.filter((id) => ORDER.includes(id));
			// Dropped when the remembered list disagrees with ORDER *or* still names a shelved container: a remembered
			// id keeps an icon on the bar by itself, long after the container behind it has gone.
			if (ours.join('|') !== ORDER.join('|') || stored.some((id) => hidden.has(id))) {
				storageService.remove(PINNED_VIEWLETS_KEY, StorageScope.PROFILE);
			}
		} catch {
			storageService.remove(PINNED_VIEWLETS_KEY, StorageScope.PROFILE);
		}

		const registry = Registry.as<IViewContainersRegistry>(Extensions.ViewContainersRegistry);
		const remove = (container: ViewContainer): void => {
			if (hidden.has(container.id)) {
				registry.deregisterViewContainer(container);
			}
		};

		// Whatever is already registered when this phase runs — VS Code's own containers: SCM, Run, Extensions.
		for (const id of hidden) {
			const container = registry.get(id);
			if (container !== undefined) {
				remove(container);
			}
		}

		// And whatever arrives later. A container contributed by an extension is registered when the extension host
		// registers it — *after* this phase — so a single sweep at startup only ever saw VS Code's own containers,
		// which is why the module icons stayed on the bar. Watching the registry catches both cases.
		this._register(registry.onDidRegister(({ viewContainer }) => remove(viewContainer)));
	}
}

registerWorkbenchContribution2(TemcoActivityBar.ID, TemcoActivityBar, WorkbenchPhase.BlockStartup);
