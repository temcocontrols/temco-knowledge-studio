/*---------------------------------------------------------------------------------------------
 *  Temco Platform — the shell.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../vs/base/common/lifecycle.js';
import { Registry } from '../../vs/platform/registry/common/platform.js';
import { IStorageService, StorageScope, StorageTarget } from '../../vs/platform/storage/common/storage.js';
import { Extensions, IViewContainersRegistry, ViewContainer } from '../../vs/workbench/common/views.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../vs/workbench/common/contributions.js';

/** The key the activity bar keeps its own order in: an array of container ids, written as icons are pinned. */
const PINNED_VIEWLETS_KEY = 'workbench.activity.pinnedViewlets2';

/**
 * How a container contributed by an extension is named in that key.
 *
 * The registry knows the container as `temco`; the bar stores it as `workbench.view.extension.temco`. Comparing the
 * two directly never matches, which is how the bar's remembered list was being thrown away on every start.
 */
const EXTENSION_PREFIX = 'workbench.view.extension.';

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
		let stored: string[] = [];
		try {
			stored = (JSON.parse(raw) as { id?: string }[]).map((entry) => entry.id).filter((id): id is string => typeof id === 'string');
		} catch {
			stored = [];
		}

		const bare = stored.map(TemcoActivityBar.bare);
		const ours = bare.filter((id) => ORDER.includes(id));
		// A remembered list that disagrees with ORDER — or that still names a shelved container — is not edited but
		// **replaced**, with every one of our containers pinned, in order. Editing it was the older approach and it had
		// two faults: it removed the key (so the bar rebuilt from whatever the registration order happened to be, and a
		// module could be left without an icon), and it compared `temco` against the stored `workbench.view.extension.temco`
		// so it never matched and ran on every start.
		if (ours.join('|') !== ORDER.join('|') || bare.some((id) => hidden.has(id))) {
			storageService.store(
				PINNED_VIEWLETS_KEY,
				JSON.stringify(TemcoActivityBar.pinnedOrder(stored)),
				StorageScope.PROFILE,
				StorageTarget.USER
			);
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

	/** The container's id as the bar's storage writes it: extension containers carry a prefix, VS Code's own do not. */
	private static bare(id: string): string {
		return id.startsWith(EXTENSION_PREFIX) ? id.slice(EXTENSION_PREFIX.length) : id;
	}

	/**
	 * The bar's list, built rather than remembered: whatever else is there, then our modules in `ORDER`.
	 *
	 * Everything is pinned and visible, so no module depends on a default that a rebuild can change, and the icons are
	 * in the sequence the mock draws. Items that are neither ours nor shelved are kept as they were — Explorer and
	 * Search are the two the workbench cannot do without, and an extension nobody here wrote keeps its own icon.
	 */
	private static pinnedOrder(stored: readonly string[]): { id: string; pinned: boolean; visible: boolean; order: number }[] {
		const hidden = new Set(TemcoActivityBar.HIDDEN);
		const kept = stored.filter((id) => {
			const id_ = TemcoActivityBar.bare(id);
			return !ORDER.includes(id_) && !hidden.has(id_) && !hidden.has(id);
		});
		const items = kept.map((id, index) => ({ id, pinned: true, visible: true, order: index }));
		for (const id of ORDER) {
			items.push({ id: `${EXTENSION_PREFIX}${id}`, pinned: true, visible: true, order: items.length });
		}
		return items;
	}
}

registerWorkbenchContribution2(TemcoActivityBar.ID, TemcoActivityBar, WorkbenchPhase.BlockStartup);
