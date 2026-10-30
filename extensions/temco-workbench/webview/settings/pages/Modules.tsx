// Modules — what this window loads, and what is only reserved.
//
// The rows come from the extension host, not from a table: a module is here because it is loaded, and its state is whether
// it has activated yet. What the sample adds is only what a manifest cannot say — the sentence naming what the module owns,
// and the surface it opens.

import { ArrowSyncRegular, CubeRegular, FolderRegular } from '@fluentui/react-icons';
import { Action, Callout, Entries, Entry, Facts, Foot, Hero, ICON, Page, Section } from '../chrome';
import { Ask, ModuleFact, ModulesState } from '../state';

interface Props {
	state: ModulesState;
	ask: (message: Ask) => void;
}

function ModuleRow(props: { module: ModuleFact; ask: (message: Ask) => void }): React.ReactElement {
	const module = props.module;
	return (
		<Entry
			glyph={<CubeRegular fontSize={15} />}
			title={module.name}
			desc={module.owns}
			badge={
				<span className="setting-badge">
					{module.namespace === '' ? '' : `${module.namespace} · `}
					{module.state}
				</span>
			}
			control={
				module.open === undefined ? undefined : (
					<Action label="Open" kind="link" onClick={() => props.ask({ type: 'command', command: module.open as string })} />
				)
			}
		/>
	);
}

export function Modules({ state, ask }: Props): React.ReactElement {
	const loaded = state.loaded.length;
	const reserved = state.reserved.length;

	return (
		<Page>
			<Hero
				title="Modules"
				mark={<CubeRegular fontSize={17} />}
				desc="A module is a built-in extension: it ships with the platform and is never installed, removed or updated from the window."
				note={<span className="az-note__text">{`${String(loaded)} loaded · ${String(reserved)} reserved · ${state.version}`}</span>}
				actions={<Action label="Show on Disk" glyph={<FolderRegular fontSize={ICON} />} onClick={() => ask({ type: 'command', command: 'temcoWorkbench.settings.showOnDisk' })} />}
			/>

			<Callout
				tone="warn"
				title="There is no marketplace"
				desc="The build refuses a product.json that configures an extension gallery, so this window loads the modules in extensions/ and nothing else — there is nothing to install and nothing to update on its own."
			/>

			<Section
				title="Loaded"
				desc={`${String(loaded)} ${loaded === 1 ? 'module' : 'modules'}, read from the extension host: a module is here because it is loaded. Ids all live under the temcocontrols. scope, which the rows leave out.`}
			>
				<Entries>
					{state.loaded.map((module) => (
						<ModuleRow key={module.id} module={module} ask={ask} />
					))}
				</Entries>
			</Section>

			<Section
				title="Reserved"
				desc={
					reserved === 0
						? 'Every reserved module is loaded in this window.'
						: `${String(reserved)} modules with a folder and a surface drawn, but not loaded here: the build ships nothing for them until each has a first real feature.`
				}
			>
				{reserved === 0 ? null : (
					<Entries>
						{state.reserved.map((module) => (
							<ModuleRow key={module.id} module={module} ask={ask} />
						))}
					</Entries>
				)}
			</Section>

			<Section title="Platform Updates" desc="A module updates with the platform, never on its own — there is no optional module to add or remove.">
				<Facts
					items={[
						{ title: 'Version', value: state.version, mono: true },
						{ title: 'Channel', value: 'Stable' },
						{ title: 'Optional modules', value: 'none' }
					]}
				/>
				<Foot>
					<Action label="Check for updates" kind="link" glyph={<ArrowSyncRegular fontSize={ICON} />} onClick={() => ask({ type: 'command', command: 'temcoWorkbench.settings.checkUpdates' })} />
				</Foot>
			</Section>
		</Page>
	);
}
