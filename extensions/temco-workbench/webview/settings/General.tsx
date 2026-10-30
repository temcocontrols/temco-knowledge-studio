// General — the window's own settings, drawn in the house page language.
//
// The vocabulary is Temco Learn's Overview page, rule for rule: the brand wash with an eyebrow, a title and a note; one
// tinted callout; a section heading with the brand rule before it; entry rows for the things a page already knows; a facts
// band; and links at the foot of a block. `main.tsx` imports the kit's own stylesheet beside `settings.css`, so this page
// and that one cannot drift apart, and both start on the same 20px gutter.
//
// The controls are Fluent UI — radios, a small dropdown, checkboxes, a small field — one step down from Fluent's default,
// because a row's text is 13px and a 32px control would set the row's height instead of the row setting the control's.
// Nothing here decides anything: a control asks the host to write a key and then draws whatever state comes back.

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
import { Ask, ChannelChoice, GeneralState, START_OPTIONS, ThemeChoice } from './state';

interface Props {
	state: GeneralState;
	ask: (message: Ask) => void;
}

/** The size a button's glyph is set to: the kit draws a 14px mark beside a label. */
const ICON = 14;

/** The chevron a link ends in, at the kit's own size. */
function ArrowRight(): React.ReactElement {
	return (
		<span className="icon" aria-hidden="true">
			<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4">
				<path d="M6 3.5 10.5 8 6 12.5" />
			</svg>
		</span>
	);
}

/** A button in the application's own dress: the primary is filled, the default is outlined, the link is a blue word. */
function Action(props: {
	label: string;
	glyph: React.ReactElement;
	onClick: () => void;
	kind?: 'primary' | 'link';
	small?: boolean;
}): React.ReactElement {
	const size = props.small === true ? ' az-btn--sm' : '';
	const kind = props.kind === 'primary' ? ' az-btn--primary' : props.kind === 'link' ? ' az-btn--link' : '';
	return (
		<button type="button" className={`az-btn${size}${kind}`} onClick={props.onClick}>
			{props.glyph}
			<span>{props.label}</span>
			{props.kind === 'link' ? <ArrowRight /> : null}
		</button>
	);
}

/** A section heading: the brand rule before the title, the sentence under it. */
function Section(props: { title: string; desc?: string; children: React.ReactNode }): React.ReactElement {
	return (
		<>
			<div className="az-section">
				<div className="az-section__text">
					<h2 className="az-section__title">{props.title}</h2>
					{props.desc === undefined ? null : <p className="az-section__desc">{props.desc}</p>}
				</div>
			</div>
			{props.children}
		</>
	);
}

/** One setting, as an entry row: the glyph, the name, the sentence, and the control at the right-hand end. */
function Entry(props: { glyph: React.ReactElement; title: string; desc: string; children: React.ReactNode }): React.ReactElement {
	return (
		<div className="az-entry">
			<span className="az-entry__icon" aria-hidden="true">
				{props.glyph}
			</span>
			<div className="az-entry__main">
				<span className="az-entry__title">{props.title}</span>
				<span className="az-entry__desc">{props.desc}</span>
			</div>
			<div className="setting-control">{props.children}</div>
		</div>
	);
}

/** The facts band: where these rows live, on the floor the Overview page puts its address on. */
function Facts(props: { items: { title: string; value: string; mono?: boolean }[] }): React.ReactElement {
	return (
		<div className="az-facts">
			{props.items.map((item) => (
				<div className="az-fact" key={item.title}>
					<span className="az-fact__title">{item.title}</span>
					<span className={`az-fact__value${item.mono === true ? ' az-fact__value--mono' : ''}`}>{item.value}</span>
				</div>
			))}
		</div>
	);
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
		<div className="view">
			<div className="view__inner">
				<div className="az-wash">
					<header className="az-lead">
						<p className="az-crumbs az-crumbs--eyebrow">Temco Platform</p>
						<h1 className="az-title az-title--hero">
							<span className="az-title__mark">
								<SettingsRegular fontSize={17} />
							</span>
							General
						</h1>
						<p className="az-intro az-intro--wide">
							Settings this profile owns. {state.realSettings} of the {state.totalSettings} rows write the editor&rsquo;s own
							configuration, so a change here changes the whole window at once; the rest are kept in this profile&rsquo;s
							register.
						</p>
						<p className="az-note">
							<span className="az-note__mark">
								<ClockRegular fontSize={13} />
							</span>
							<span className="az-note__text">Last changed {state.lastChanged}</span>
						</p>
						<div className="az-row">
							<Action label="Open settings.json" kind="primary" glyph={<CodeRegular fontSize={ICON} />} onClick={openJson} />
							<Action label="Restore Defaults" glyph={<ArrowSyncRegular fontSize={ICON} />} onClick={restore} />
						</div>
					</header>
				</div>

				<div className="az-main">
					<aside className="az-callout">
						<div className="az-callout__main">
							<span className="az-callout__icon">
								<InfoRegular fontSize={16} />
							</span>
							<div>
								<p className="az-callout__title">
									{state.realSettings} of these {state.totalSettings} rows are the editor&rsquo;s own settings
								</p>
								<p className="az-callout__desc">
									Theme, Startup view, Breadcrumbs and Telemetry write the configuration and take effect at once. The working
									folder and the update channel have no setting behind them yet — they are kept in this profile&rsquo;s register,
									and the band under <em>Where These Live</em> says so.
								</p>
							</div>
						</div>
					</aside>

					<Section title="Window" desc="What the window looks like, and what it opens with — 3 settings.">
						<div className="az-entries">
							<Entry glyph={<PaintBrushRegular fontSize={15} />} title="Theme" desc="Colour roles only — a theme never changes the layout.">
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
							</Entry>
							<Entry glyph={<WindowNewRegular fontSize={15} />} title="Startup view" desc="The tab that opens when the window starts.">
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
							</Entry>
							<Entry
								glyph={<NavigationRegular fontSize={15} />}
								title="Breadcrumbs"
								desc="The path above the editor. Off by default: this window has no file system, so the bar can only repeat the side bar and the tab."
							>
								<Checkbox
									aria-label="Show breadcrumbs"
									checked={state.breadcrumbs}
									onChange={(_event, data) => set('breadcrumbs', data.checked)}
								/>
							</Entry>
						</div>
					</Section>

					<Section title="Files" desc="One folder holds every repository, capture and build the platform writes.">
						<div className="az-entries">
							<Entry glyph={<FolderRegular fontSize={15} />} title="Working folder" desc="Where repositories are cloned and captures are written.">
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
							</Entry>
						</div>
					</Section>

					<Section title="Diagnostics and Updates" desc="What leaves this machine, and which channel a new version comes from.">
						<div className="az-entries">
							<Entry
								glyph={<InfoRegular fontSize={15} />}
								title="Telemetry"
								desc="Documentation checks and build failures only. Never page content, never a prompt."
							>
								<Checkbox
									aria-label="Send diagnostics"
									checked={state.telemetry}
									onChange={(_event, data) => set('telemetry', data.checked)}
								/>
							</Entry>
							<Entry
								glyph={<ArrowDownloadRegular fontSize={15} />}
								title="Update channel"
								desc="Preview adds release candidates one version earlier than Stable. A change takes effect on restart."
							>
								<RadioGroup
									layout="horizontal"
									aria-label="Update channel"
									value={state.channel}
									onChange={(_event, data) => set('updateChannel', data.value as ChannelChoice)}
								>
									<Radio value="Stable" label="Stable" />
									<Radio value="Preview" label="Preview" />
								</RadioGroup>
							</Entry>
						</div>
					</Section>

					<Section
						title="Where These Live"
						desc="The file these rows are written to, and how many of them the editor would honour from a workspace."
					>
						<Facts
							items={[
								{ title: 'File', value: 'settings.json · this profile', mono: true },
								{ title: 'Profile', value: 'Default' },
								{ title: 'Can be overridden', value: `${state.realSettings} of these ${state.totalSettings} settings` },
								{ title: 'Last changed', value: state.lastChanged }
							]}
						/>
						<p className="az-note az-note--foot">
							A row with no setting behind it is kept in this profile&rsquo;s register, which is written beside
							settings.json and read by the platform&rsquo;s own modules.
						</p>
						<div className="az-block__foot">
							<Action label="Open settings.json" kind="link" glyph={<CodeRegular fontSize={ICON} />} onClick={openJson} />
							<Action label="Restore every default" kind="link" glyph={<ArrowSyncRegular fontSize={ICON} />} onClick={restore} />
						</div>
					</Section>
				</div>
			</div>
		</div>
	);
}
