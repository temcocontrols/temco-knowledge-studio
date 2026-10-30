// General — the window's own settings.
//
// Six rows, and each one says which it is: four write the editor's configuration, and two are kept in this profile's
// register. A control asks the host to write a key and then draws whatever state comes back, so nothing here can claim a
// change it did not make.

import { useEffect, useState } from 'react';
import { Checkbox, Dropdown, Input, Option, Radio, RadioGroup } from '@fluentui/react-components';
import {
	ArrowDownloadRegular,
	ArrowSyncRegular,
	ClockRegular,
	CodeRegular,
	FolderOpenRegular,
	FolderRegular,
	InfoRegular,
	NavigationRegular,
	PaintBrushRegular,
	SettingsRegular,
	WindowNewRegular
} from '@fluentui/react-icons';
import { Action, Callout, Entries, Entry, Facts, Foot, Hero, ICON, Page, Section } from '../chrome';
import { Ask, ChannelChoice, GeneralState, START_OPTIONS, ThemeChoice } from '../state';

interface Props {
	state: GeneralState;
	ask: (message: Ask) => void;
}

export function General({ state, ask }: Props): React.ReactElement {
	const set = (key: string, value: unknown): void => ask({ type: 'setting', key, value });

	// The working folder is typed as well as chosen, so the field keeps its own text until the host has written it: a value
	// driven straight from the state would fight the person typing.
	const [folder, setFolder] = useState(state.workingFolder);
	useEffect(() => {
		setFolder(state.workingFolder);
	}, [state.workingFolder]);

	const commitFolder = (): void => {
		const trimmed = folder.trim();
		if (trimmed !== '' && trimmed !== state.workingFolder) {
			set('workingFolder', trimmed);
		}
	};

	const openJson = (): void => ask({ type: 'command', command: 'workbench.action.openSettingsJson' });
	const restore = (): void => ask({ type: 'command', command: 'temcoWorkbench.settings.reset' });
	const startLabel = START_OPTIONS.find((option) => option.value === state.start)?.label ?? 'Welcome';

	return (
		<Page>
			<Hero
				title="General"
				mark={<SettingsRegular fontSize={17} />}
				desc={`Settings this profile owns. ${String(state.realSettings)} of the ${String(state.totalSettings)} rows write the editor's own configuration, so a change here changes the whole window at once; the rest are kept in this profile's register.`}
				note={
					<>
						<span className="az-note__mark">
							<ClockRegular fontSize={13} />
						</span>
						<span className="az-note__text">Last changed {state.lastChanged}</span>
					</>
				}
				actions={
					<>
						<Action label="Open settings.json" kind="primary" glyph={<CodeRegular fontSize={ICON} />} onClick={openJson} />
						<Action label="Restore Defaults" glyph={<ArrowSyncRegular fontSize={ICON} />} onClick={restore} />
					</>
				}
			/>

			<Callout
				title={`${String(state.realSettings)} of these ${String(state.totalSettings)} rows are the editor's own settings`}
				desc="Theme, Startup view, Breadcrumbs and Telemetry write the configuration and take effect at once. The working folder and the update channel have no setting behind them yet — they are kept in this profile's register, and the band under Where These Live says so."
			/>

			<Section title="Window" desc="What the window looks like, and what it opens with — 3 settings.">
				<Entries>
					<Entry
						glyph={<PaintBrushRegular fontSize={15} />}
						title="Theme"
						desc="Colour roles only — a theme never changes the layout."
						control={
							<RadioGroup
								layout="horizontal"
								aria-label="Theme"
								value={state.theme}
								onChange={(_event, data) => set('theme', data.value as ThemeChoice)}
							>
								<Radio value="System" label="System" />
								<Radio value="Dark" label="Dark" />
								<Radio value="Light" label="Light" />
							</RadioGroup>
						}
					/>
					<Entry
						glyph={<WindowNewRegular fontSize={15} />}
						title="Startup view"
						desc="The tab that opens when the window starts."
						control={
							<Dropdown
								size="small"
								aria-label="Startup view"
								value={startLabel}
								selectedOptions={[state.start]}
								onOptionSelect={(_event, data) => {
									if (data.optionValue !== undefined) {
										set('start', data.optionValue);
									}
								}}
							>
								{START_OPTIONS.map((option) => (
									<Option key={option.value} value={option.value}>
										{option.label}
									</Option>
								))}
							</Dropdown>
						}
					/>
					<Entry
						glyph={<NavigationRegular fontSize={15} />}
						title="Breadcrumbs"
						desc="The path above the editor. Off by default: this window has no file system, so the bar can only repeat the side bar and the tab."
						control={
							<Checkbox
								aria-label="Show breadcrumbs"
								checked={state.breadcrumbs}
								onChange={(_event, data) => set('breadcrumbs', data.checked)}
							/>
						}
					/>
				</Entries>
			</Section>

			<Section title="Files" desc="One folder holds every repository, capture and build the platform writes.">
				<Entries>
					<Entry
						glyph={<FolderRegular fontSize={15} />}
						title="Working folder"
						desc="Where repositories are cloned and captures are written."
						control={
							<>
								<Input
									size="small"
									aria-label="Working folder"
									value={folder}
									onChange={(_event, data) => setFolder(data.value)}
									onBlur={commitFolder}
									onKeyDown={(event) => {
										if (event.key === 'Enter') {
											commitFolder();
										}
									}}
								/>
								<Action label="Choose" small glyph={<FolderOpenRegular fontSize={ICON} />} onClick={() => ask({ type: 'pick-folder' })} />
							</>
						}
					/>
				</Entries>
			</Section>

			<Section title="Diagnostics and Updates" desc="What leaves this machine, and which channel a new version comes from.">
				<Entries>
					<Entry
						glyph={<InfoRegular fontSize={15} />}
						title="Telemetry"
						desc="Documentation checks and build failures only. Never page content, never a prompt."
						control={<Checkbox aria-label="Send diagnostics" checked={state.telemetry} onChange={(_event, data) => set('telemetry', data.checked)} />}
					/>
					<Entry
						glyph={<ArrowDownloadRegular fontSize={15} />}
						title="Update channel"
						desc="Preview adds release candidates one version earlier than Stable. A change takes effect on restart."
						control={
							<RadioGroup
								layout="horizontal"
								aria-label="Update channel"
								value={state.channel}
								onChange={(_event, data) => set('updateChannel', data.value as ChannelChoice)}
							>
								<Radio value="Stable" label="Stable" />
								<Radio value="Preview" label="Preview" />
							</RadioGroup>
						}
					/>
				</Entries>
			</Section>

			<Section
				title="Where These Live"
				desc="The file these rows are written to, and how many of them the editor would honour from a workspace."
			>
				<Facts
					items={[
						{ title: 'File', value: 'settings.json · this profile', mono: true },
						{ title: 'Profile', value: 'Default' },
						{ title: 'Can be overridden', value: `${String(state.realSettings)} of these ${String(state.totalSettings)} settings` },
						{ title: 'Last changed', value: state.lastChanged }
					]}
				/>
				<p className="az-note az-note--foot">
					A row with no setting behind it is kept in this profile&rsquo;s register, which is written beside settings.json and read
					by the platform&rsquo;s own modules.
				</p>
				<Foot>
					<Action label="Open settings.json" kind="link" glyph={<CodeRegular fontSize={ICON} />} onClick={openJson} />
					<Action label="Restore every default" kind="link" glyph={<ArrowSyncRegular fontSize={ICON} />} onClick={restore} />
				</Foot>
			</Section>
		</Page>
	);
}
