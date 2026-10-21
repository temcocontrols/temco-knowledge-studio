// Settings — the five surfaces the mock draws, on the shared page kit.
//
// Rebuilt from `docs/mock/js/views.platform.js` (`settings/general`, `settings/modules`, `settings/branding`,
// `settings/ai`, `settings/publishing`).
//
// **A control writes.** Two kinds of row sit on these pages and each is honest about which it is: a row backed by a
// real editor setting writes that setting through the configuration API, so the window obeys it at once; a row this
// build has no setting for keeps its value in `settingsStore.ts` and the page's foot says so. A form whose checkbox
// springs back would be worse than no form, and a form that claimed to have changed the theme when it had not would be
// worse still.

import * as vscode from 'vscode';
import { ARTIFACTS, MODULES, ModuleRow, ROLES } from './settingsSample';
import {
	ContextWindow, publishedArtifacts, resetKeys, set, setArtifact, SettingsRegister, UpdateChannel, values
} from './settingsStore';
import { commandScript, escapeHtml as esc, icon, page, pageColumn } from './ui';

export const SETTINGS_GENERAL_VIEW_TYPE = 'temcoWorkbench.settings.general';
export const SETTINGS_MODULES_VIEW_TYPE = 'temcoWorkbench.settings.modules';
export const SETTINGS_BRANDING_VIEW_TYPE = 'temcoWorkbench.settings.branding';
export const SETTINGS_AI_VIEW_TYPE = 'temcoWorkbench.settings.ai';
export const SETTINGS_PUBLISHING_VIEW_TYPE = 'temcoWorkbench.settings.publishing';

/* ------------------------------------------------------------------ page vocabulary */

const button = (label: string, command: string, options: { kind?: 'primary' | 'ghost'; mark?: string; small?: boolean } = {}): string =>
	`<button type="button" class="btn${options.small ? ' btn--sm' : ''}${options.kind ? ` btn--${options.kind}` : ''}" data-command="${command}">${options.mark ? icon(options.mark) : ''}<span>${esc(label)}</span></button>`;

const pageHead = (options: { title: string; mark: string; desc: string; actions?: string }): string =>
	`<div class="page-head"><div class="page-head__main"><h1 class="page-head__title">${icon(options.mark)}${esc(options.title)}</h1><p class="page-head__desc">${options.desc}</p></div>${options.actions ? `<div class="page-head__actions">${options.actions}</div>` : ''}</div>`;

const rule = (label: string, count?: string, note?: string, actions?: string): string =>
	`<div class="group-head"><span class="group-head__label">${esc(label)}</span><span class="group-head__rule"></span>${count ? `<span class="group-head__count">${esc(count)}</span>` : ''}${actions ? `<span class="group-head__actions">${actions}</span>` : ''}</div>${note ? `<p class="group-note">${note}</p>` : ''}`;

const formRow = (label: string, desc: string, control: string, tag?: string): string =>
	`<div class="form-row"><div class="form-row__main"><div class="form-row__label">${esc(label)}${tag ? ` <span class="tag">${esc(tag)}</span>` : ''}</div><div class="form-row__desc">${esc(desc)}</div></div><div class="form-row__control">${control}</div></div>`;

/** A two-or-more-way choice. Each chip carries what it would write, so one script serves every page. */
const segmented = (setting: string, choices: string[], current: string, label: string): string =>
	`<div class="segmented" role="group" aria-label="${esc(label)}">${choices.map((choice) => `<button type="button" data-kind="segment" data-setting="${esc(setting)}" data-value="${esc(choice)}" aria-pressed="${choice === current}">${esc(choice)}</button>`).join('')}</div>`;

const select = (setting: string, options: { value: string; label: string }[], current: string, label: string): string =>
	`<select class="select" data-kind="select" data-setting="${esc(setting)}" aria-label="${esc(label)}">${options.map((option) => `<option value="${esc(option.value)}"${option.value === current ? ' selected' : ''}>${esc(option.label)}</option>`).join('')}</select>`;

const check = (setting: string, on: boolean, caption: string, name?: string): string =>
	`<label class="check"><input type="checkbox" data-kind="check" data-setting="${esc(setting)}"${name === undefined ? '' : ` data-name="${esc(name)}"`}${on ? ' checked' : ''}><span>${esc(caption)}</span></label>`;

const text = (setting: string, value: string, label: string): string =>
	`<input class="input" data-kind="text" data-setting="${esc(setting)}" value="${esc(value)}" aria-label="${esc(label)}">`;

const callout = (html: string, kind?: 'warn' | 'ok'): string =>
	`<div class="callout${kind ? ` callout--${kind}` : ''}">${icon(kind === 'warn' ? 'alert' : kind === 'ok' ? 'check' : 'info')}<div>${html}</div></div>`;

const settingsStrip = (entries: [string, string, boolean?][]): string =>
	`<div class="settings-strip">${entries.map(([label, value, mono]) => `<div><div class="settings-strip__label">${esc(label)}</div><div class="settings-strip__value${mono ? ' cell-mono' : ''}">${esc(value)}</div></div>`).join('')}</div>`;

/** The command that opens the surface a module draws, for the rows that name one. */
const SURFACE_COMMANDS: { [surface: string]: string } = {
	overview: 'temcoWorkbench.overview',
	documents: 'temcoDocs.documents',
	sources: 'temcoProjects.editProject',
	projects: 'temcoDocs.projects',
	chat: 'temcoAi.chat'
};

/* ------------------------------------------------------------------ the editor's own settings */

const configuration = (section: string): vscode.WorkspaceConfiguration => vscode.workspace.getConfiguration(section);

/** Which of the three theme choices the window is on. System means the OS decides, so no theme is pinned. */
function themeChoice(): string {
	if (configuration('window').get<boolean>('autoDetectColorScheme', false)) {
		return 'System';
	}
	const theme = configuration('workbench').get<string>('colorTheme', '');
	return /light/i.test(theme) ? 'Light' : 'Dark';
}

/** The five startup choices the manifest declares, in the order a person meets them. */
const START_OPTIONS = [
	{ value: 'welcome', label: 'Welcome' },
	{ value: 'project', label: 'The project' },
	{ value: 'page', label: 'The last page' },
	{ value: 'home', label: 'Overview' },
	{ value: 'none', label: 'Nothing' }
];

function startChoice(): string {
	return configuration('temcoWorkbench').get<string>('start.open', 'welcome');
}

function breadcrumbsOn(): boolean {
	return configuration('workbench').get<boolean>('breadcrumbs.enabled', false);
}

function telemetryOn(): boolean {
	return configuration('telemetry').get<string>('telemetryLevel', 'all') !== 'off';
}

/* ------------------------------------------------------------------ the pages themselves */

/** The five settings surfaces, one panel each. */
export class SettingsPages {
	private readonly panels = new Map<string, vscode.WebviewPanel>();

	constructor(private readonly context: vscode.ExtensionContext) { }

	general(): void {
		this.open('general', SETTINGS_GENERAL_VIEW_TYPE, 'General', generalBody);
	}

	modules(): void {
		this.open('modules', SETTINGS_MODULES_VIEW_TYPE, 'Modules', modulesBody);
	}

	branding(): void {
		this.open('branding', SETTINGS_BRANDING_VIEW_TYPE, 'Branding', brandingBody);
	}

	ai(): void {
		this.open('ai', SETTINGS_AI_VIEW_TYPE, 'AI Models', aiBody);
	}

	publishing(): void {
		this.open('publishing', SETTINGS_PUBLISHING_VIEW_TYPE, 'Publishing', publishingBody);
	}

	/** Re-draws every page that is open — one page's write is another page's fact. */
	refresh(): void {
		for (const [id, panel] of this.panels) {
			const body = BODIES[id];
			const definition = PAGES.find((entry) => entry.id === id);
			if (body && definition) {
				panel.webview.html = document(definition, body);
			}
		}
	}

	dispose(): void {
		for (const panel of this.panels.values()) {
			panel.dispose();
		}
		this.panels.clear();
	}

	private open(id: string, viewType: string, title: string, body: () => string): void {
		const html = page(body(), { title, script: commandScript + SETTINGS_SCRIPT });
		const existing = this.panels.get(id);
		if (existing) {
			existing.reveal(pageColumn());
			existing.webview.html = html;
			return;
		}
		const panel = vscode.window.createWebviewPanel(viewType, title, pageColumn(), {
			enableScripts: true,
			localResourceRoots: []
		});
		panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'settings.svg');
		panel.webview.html = html;
		panel.webview.onDidReceiveMessage((message: SettingsMessage) => void receive(this, message));
		this.panels.set(id, panel);
		panel.onDidDispose(() => this.panels.delete(id));
	}
}

/** The pages, in the order the side bar lists them. */
const PAGES: { id: string; title: string; body: () => string }[] = [
	{ id: 'general', title: 'General', body: generalBody },
	{ id: 'modules', title: 'Modules', body: modulesBody },
	{ id: 'branding', title: 'Branding', body: brandingBody },
	{ id: 'ai', title: 'AI Models', body: aiBody },
	{ id: 'publishing', title: 'Publishing', body: publishingBody }
];

const BODIES: { [id: string]: () => string } = {
	general: generalBody,
	modules: modulesBody,
	branding: brandingBody,
	ai: aiBody,
	publishing: publishingBody
};

function document(definition: { title: string }, body: () => string): string {
	return page(body(), { title: definition.title, script: commandScript + SETTINGS_SCRIPT });
}

/**
 * The controls' script.
 *
 * Segments, selects, checkboxes and text fields all post the same message — the key they are bound to and the value
 * they now hold — so a page never decides what a setting means. The command script beside it handles the buttons.
 */
const SETTINGS_SCRIPT = `
(function () {
	const api = acquireVsCodeApi();
	function post(key, value, name) {
		api.postMessage({ type: 'setting', key: key, value: value, name: name });
	}
	document.querySelectorAll('[data-kind="segment"]').forEach(function (chip) {
		chip.addEventListener('click', function () { post(chip.dataset.setting, chip.dataset.value); });
	});
	document.querySelectorAll('[data-kind="select"]').forEach(function (field) {
		field.addEventListener('change', function () { post(field.dataset.setting, field.value); });
	});
	document.querySelectorAll('[data-kind="check"]').forEach(function (field) {
		field.addEventListener('change', function () { post(field.dataset.setting, field.checked, field.dataset.name); });
	});
	document.querySelectorAll('[data-kind="text"]').forEach(function (field) {
		field.addEventListener('change', function () { post(field.dataset.setting, field.value); });
	});
})();
`;

/* ------------------------------------------------------------------ General */

/** *General* — the mock's `settings/general`. */
function generalBody(): string {
	const settings = values();

	return `${pageHead({
		title: 'General',
		mark: 'gear',
		desc: 'Settings this profile owns. Only the rows marked <span class="tag">Workspace</span> — nothing else here follows a workspace.',
		actions: button('Open JSON', 'workbench.action.openSettingsJson', { mark: 'code' })
	})}
${rule('Window', '3 settings', 'What the window looks like, and what it opens with.')}
<div class="settings-rows">
${formRow('Theme', 'Colour roles only — a theme never changes the layout.', segmented('theme', ['System', 'Dark', 'Light'], themeChoice(), 'Theme'))}
${formRow('Startup view', 'The tab that opens when the window starts.', select('start', START_OPTIONS, startChoice(), 'Startup view'))}
${formRow('Breadcrumbs', 'The path above the editor. Off by default: this window has no file system, so the bar can only repeat the side bar and the tab.', check('breadcrumbs', breadcrumbsOn(), 'Show breadcrumbs'))}
</div>
${rule('Files', '1 setting', 'One folder holds every repository, capture and build the platform writes.')}
<div class="settings-rows">
${formRow('Working folder', 'Where repositories are cloned and captures are written.', text('workingFolder', settings.workingFolder, 'Working folder'), 'Workspace')}
</div>
${rule('Diagnostics and Updates', '2 settings')}
<div class="settings-rows">
${formRow('Telemetry', 'Documentation checks and build failures only. Never page content, never a prompt.', check('telemetry', telemetryOn(), 'Send diagnostics'))}
${formRow('Update channel', 'Preview adds release candidates one version earlier than Stable.', segmented('updateChannel', ['Stable', 'Preview'], settings.updateChannel, 'Update channel'), 'Restart')}
</div>
${rule('Where These Live', undefined, undefined, button('Restore Defaults', 'temcoWorkbench.settings.reset', { small: true, kind: 'ghost' }))}
${settingsStrip([
		['File', 'settings.json · this profile', true],
		['Profile', 'Default'],
		['Can be overridden', '3 of these 5 settings'],
		['Last changed', settings.lastChanged]
	])}
<div class="mt-16">${callout('Theme, Startup view, Breadcrumbs and Telemetry are the editor’s own settings: writing one here changes the whole window at once. The Working folder and the Update channel have no setting behind them yet, so they are kept in this profile’s register — the strip above says which is which.')}</div>`;
}

/* ------------------------------------------------------------------ Modules */

/**
 * Every module this window really has.
 *
 * The rows come from the extension host, not from a table: a module is present because it is loaded, and its state
 * is whether it has activated yet. What the sample's table adds is only what a manifest cannot say — the sentence
 * naming what the module owns, and the surface it opens.
 */
function moduleRows(): { active: ModuleRow[]; reserved: ModuleRow[] } {
	const described = new Map(MODULES.map((row) => [row.id, row]));
	const loaded = vscode.extensions.all.filter(
		(extension) => extension.packageJSON.publisher === 'temcocontrols'
	);
	const rows: ModuleRow[] = loaded
		.map((extension) => {
			const known = described.get(extension.id);
			const manifest = extension.packageJSON as { description?: unknown; displayName?: unknown };
			const name = known?.name
				?? (typeof manifest.displayName === 'string' ? manifest.displayName : extension.id.replace('temcocontrols.', ''));
			const owns = known?.owns
				?? (typeof manifest.description === 'string' ? manifest.description : 'its manifest says nothing about what it owns');
			return {
				id: extension.id,
				name,
				namespace: known?.namespace ?? '',
				owns,
				surface: known?.surface,
				state: extension.isActive ? 'Active' : 'Loaded',
			};
		})
		.sort((one, other) => one.name.localeCompare(other.name));

	const present = new Set(rows.map((row) => row.id));
	return {
		active: rows,
		reserved: MODULES.filter((row) => !present.has(row.id)),
	};
}

/** *Modules* — what this window loads, and what is only reserved. */
function modulesBody(): string {
	const { active, reserved } = moduleRows();

	const table = (rows: ModuleRow[]): string =>
		`<div class="table-wrap table-wrap--plain"><table class="table table--compact"><thead><tr><th>Module</th><th>Namespace</th><th>What It Owns</th><th></th></tr></thead><tbody>${rows.map((module) => `<tr><td><span class="cell-strong" style="white-space:nowrap">${esc(module.name)}</span><div class="cell-muted cell-mono" style="font-size:11px;white-space:nowrap">${esc(module.id.replace('temcocontrols.', ''))}</div></td><td><span class="cell-mono cell-muted">${esc(module.namespace === '' ? '—' : module.namespace)}</span></td><td>${esc(module.owns)}</td><td style="text-align:right">${module.surface && SURFACE_COMMANDS[module.surface] ? button('Open', SURFACE_COMMANDS[module.surface], { small: true, kind: 'ghost' }) : '<span class="cell-muted" style="white-space:nowrap">No surface</span>'}</td></tr>`).join('')}</tbody></table></div>`;

	return `${pageHead({
		title: 'Modules',
		mark: 'package',
		desc: 'A module is a built-in extension: it ships with the platform and is never installed, removed or updated from the window.',
		actions: button('Show on Disk', 'temcoWorkbench.settings.showOnDisk', { mark: 'folder' })
	})}
${callout('<b>There is no marketplace.</b> The build refuses a <code>product.json</code> that configures an extension gallery, so this window loads the modules in <code>extensions/</code> and nothing else — there is nothing to install and nothing to update on its own.', 'warn')}
${rule('Loaded', `${active.length} modules`, 'Read from the extension host: a module is here because it is loaded, and <b>Active</b> means it has activated. Ids all live under the <code>temcocontrols.</code> scope, so the table drops the prefix.')}
<div class="mt-16">${table(active)}</div>
${rule('Reserved', `${reserved.length} modules`, 'A folder with a README and a surface drawn in the mock, but not loaded in this window. The build ships nothing for them until each has a first real feature.')}
<div class="mt-16">${reserved.length === 0 ? '<p class="group-note">Every reserved module is loaded in this window.</p>' : table(reserved)}</div>
${rule('Platform Updates', `${vscode.version} · stable`, 'A module updates with the platform, never on its own — there is no optional module to add or remove.', button('Check for Updates', 'temcoWorkbench.settings.checkUpdates', { small: true, mark: 'refresh' }))}
${settingsStrip([
		['Version', vscode.version, true],
		['Channel', 'Stable'],
		['Optional modules', 'none']
	])}`;
}

/* ------------------------------------------------------------------ Branding */

/** *Branding* — the mock's `settings/branding`. */
function brandingBody(): string {
	const settings = values();
	const theme = themeChoice();

	const mark = (size: number): string =>
		`<div style="display:grid;place-items:center;width:${size}px;height:${size}px;border-radius:${Math.round(size / 4.6)}px;background:#224E7A;color:#fff;font-size:${Math.round(size / 2.5)}px;font-weight:700">T</div>`;

	const roles = ROLES.map((role) => `<span style="display:inline-flex;align-items:center;gap:6px" class="cell-muted"><span style="width:22px;height:22px;border-radius:5px;background:${role.colour}"></span>${esc(role.name)}</span>`).join('');

	return `${pageHead({
		title: 'Branding',
		mark: 'palette',
		desc: 'The identity the shell draws: the mark, the wordmark and the accent. The mock previews them in place rather than in a specimen sheet.',
		actions: button('Reset', 'temcoWorkbench.settings.resetBranding', { mark: 'refresh' })
	})}
${rule('Application Mark', 'one drawing, three sizes', 'The window, the taskbar and the title bar draw the same file at 64, 32 and 16 pixels.', button('Replace', 'temcoWorkbench.settings.replaceIcon', { small: true, kind: 'ghost' }))}
<div class="row" style="gap:18px;align-items:flex-end;margin-top:12px">${mark(64)}${mark(32)}${mark(16)}<span class="cell-mono cell-muted" style="margin-left:6px">resources/temco-icon.svg</span></div>
${rule('Theme', '2 themes shipped', 'A theme changes colour roles, never layout: every surface here is drawn from the five roles below.')}
<div class="settings-rows">
${formRow('Shell theme', 'Dark ships by default; Light exists because a print shop and a projector are not dark rooms.', button('Dark', 'temcoWorkbench.settings.themeDark', { small: true, kind: theme === 'Dark' ? 'primary' : undefined }) + button('Light', 'temcoWorkbench.settings.themeLight', { small: true, kind: theme === 'Light' ? 'primary' : undefined }))}
</div>
<div class="row" style="gap:10px;align-items:center;margin-top:12px">${roles}</div>
${rule('Identity', '3 settings')}
<div class="settings-rows">
${formRow('Product name', 'Drawn in the title bar and the About window.', text('productName', settings.productName, 'Product name'))}
${formRow('Accent colour', 'Used for focus, selection and the active container indicator.', text('accent', settings.accent, 'Accent colour'))}
${formRow('Welcome page', 'The walkthrough shown on a fresh profile.', select('welcomePage', [{ value: 'Temco Platform', label: 'Temco Platform' }, { value: 'None', label: 'None' }], settings.welcomePage, 'Welcome page'))}
</div>
<div class="mt-16">${callout('The shell theme is the editor’s colour theme, so this row and <em>Appearance</em> in the command palette are the same setting. The mark and the identity are this profile’s register: the window’s icon is compiled into the build and cannot be replaced from inside it.')}</div>`;
}

/* ------------------------------------------------------------------ AI Models */

/** *AI Models* — the mock's `settings/ai`. */
function aiBody(): string {
	const settings = values();

	return `${pageHead({
		title: 'AI Models',
		mark: 'sparkle',
		desc: 'What this profile loads, how much it may read, and what it is allowed to touch. The AI Hub shows what is loaded right now; this page decides what loads next.',
		actions: button('Open Models', 'temcoAi.localModels', { mark: 'chip' })
	})}
${rule('Answering', '3 settings', 'The model behind the AI panel and behind every Draft action.')}
<div class="settings-rows">
${formRow('Chat model', 'Both run on this machine; nothing here calls a service.', select('chatModel', [{ value: 'qwen2.5-3b-instruct', label: 'qwen2.5-3b-instruct' }, { value: 'phi-3-mini-4k', label: 'phi-3-mini-4k' }, { value: 'temco-docs-1.4b', label: 'temco-docs-1.4b' }], settings.chatModel, 'Chat model'))}
${formRow('Context window', 'How much of a page, its area and the sources behind it the model may read at once.', segmented('contextWindow', ['8k', '16k', '32k'], settings.contextWindow, 'Context window'))}
${formRow('Always cite', 'An answer without a citation is refused, not merely discouraged.', check('requireCitations', settings.requireCitations, 'Require citations'))}
</div>
${rule('Retrieval', '1 setting')}
<div class="settings-rows">
${formRow('Embedding model', 'Builds and queries the knowledge index. Changing it re-indexes every page this profile holds.', select('embeddingModel', [{ value: 'nomic-embed-text', label: 'nomic-embed-text' }], settings.embeddingModel, 'Embedding model'))}
</div>
${rule('Drafts and Network', '2 settings')}
<div class="settings-rows">
${formRow('Drafts', 'Where an AI change goes before it is written to a page. Nothing reaches a reader without passing Review Center.', select('drafts', [{ value: 'Review Center', label: 'Review Center' }, { value: 'Review Center, auto-reject after 7 days', label: 'Review Center, auto-reject after 7 days' }], settings.drafts, 'Drafts'))}
${formRow('Offline only', 'Refuse every action that would call a network service.', check('offlineOnly', settings.offlineOnly, 'Keep prompts on this machine'))}
</div>
${rule('This Profile')}
${settingsStrip([
		['Model', settings.chatModel, true],
		['Context', settings.contextWindow],
		['Citations', settings.requireCitations ? 'required' : 'not required'],
		['Network calls', settings.offlineOnly ? 'none — offline only is on' : 'allowed by the profile']
	])}
<div class="mt-16">${callout('These five choices are kept in this profile’s register: the AI module in this build has no model runtime, so nothing is loaded or unloaded by changing them. The AI Hub shows what is actually there.')}</div>`;
}

/* ------------------------------------------------------------------ Publishing */

/** *Publishing* — the mock's `settings/publishing`. */
function publishingBody(): string {
	const settings = values();
	const chosen = publishedArtifacts();

	return `${pageHead({
		title: 'Publishing',
		mark: 'upload',
		desc: 'Where a release goes and what it is allowed to overwrite. Publishing never edits a page; it copies artifacts that Build Center already built.'
	})}
${rule('Target', settings.publishProbe, undefined, button('Test Connection', 'temcoWorkbench.settings.testPublish', { small: true, mark: 'globe' }))}
<div class="settings-rows">
${formRow('Site', 'The origin every published version is served from.', text('site', settings.site, 'Site'))}
${formRow('Path', 'Where under the site a version is written. The {version} token is replaced at publish time.', text('path', settings.path, 'Path'))}
${formRow('Channel', 'Preview publishes with noindex, so a search engine never sees a draft.', segmented('publishChannel', ['Stable', 'Preview'], settings.channel, 'Channel'))}
</div>
${rule('Artifacts', `${chosen} of ${ARTIFACTS.length} published`, 'Each of these is built by Build Center; publishing copies what is already there.')}
<div class="settings-rows">
${ARTIFACTS.map((artifact) => formRow(artifact.name, artifact.desc, check('artifact', settings.artifacts[artifact.name], 'Publish', artifact.name))).join('')}
</div>
<div class="mt-16">${callout('A published version is frozen. To change a page a reader can reach, publish a new version — an edit does not reach the site until it does.', 'warn')}</div>
<div class="mt-16">${callout('Test Connection checks this profile’s own record of the target and nothing else: this build has no network client, so no request leaves the window.')}</div>`;
}

/* ------------------------------------------------------------------ what a control writes */

interface SettingsMessage {
	type?: string;
	key?: string;
	value?: unknown;
	name?: string;
	command?: string;
	args?: unknown;
}

/** Applies one control's message, then re-draws the pages so every one of them agrees. */
async function receive(pages: SettingsPages, message: SettingsMessage): Promise<void> {
	if (message.type === 'command' && typeof message.command === 'string') {
		const args = Array.isArray(message.args) ? message.args : message.args === undefined ? [] : [message.args];
		await vscode.commands.executeCommand(message.command, ...args);
		return;
	}
	if (message.type !== 'setting' || typeof message.key !== 'string') {
		return;
	}
	await applySetting(message.key, message.value, message.name);
	pages.refresh();
}

/**
 * One row, written.
 *
 * A key that names an editor setting writes it through the configuration API; a key that names a register field writes
 * the register. The two are not interchangeable, and each page's foot says which rows are which.
 */
async function applySetting(key: string, value: unknown, name?: string): Promise<void> {
	switch (key) {
		case 'theme': {
			const choice = String(value);
			if (choice === 'System') {
				await configuration('window').update('autoDetectColorScheme', true, vscode.ConfigurationTarget.Global);
				break;
			}
			await configuration('window').update('autoDetectColorScheme', false, vscode.ConfigurationTarget.Global);
			await configuration('workbench').update(
				'colorTheme',
				choice === 'Light' ? 'Default Light Modern' : 'Default Dark Modern',
				vscode.ConfigurationTarget.Global
			);
			break;
		}
		case 'start':
			if (START_OPTIONS.some((option) => option.value === value)) {
				await configuration('temcoWorkbench').update('start.open', String(value), vscode.ConfigurationTarget.Global);
			}
			break;
		case 'breadcrumbs':
			await configuration('workbench').update('breadcrumbs.enabled', Boolean(value), vscode.ConfigurationTarget.Global);
			break;
		case 'telemetry':
			await configuration('telemetry').update('telemetryLevel', value ? 'all' : 'off', vscode.ConfigurationTarget.Global);
			break;
		case 'workingFolder': {
			const folder = String(value).trim();
			if (folder.length > 0) {
				set('workingFolder', folder);
			}
			break;
		}
		case 'updateChannel':
			set('updateChannel', (value === 'Preview' ? 'Preview' : 'Stable') as UpdateChannel);
			break;
		case 'productName':
			if (String(value).trim().length > 0) {
				set('productName', String(value).trim());
			}
			break;
		case 'accent':
			if (/^#[0-9a-fA-F]{6}$/.test(String(value).trim())) {
				set('accent', String(value).trim());
			}
			break;
		case 'welcomePage':
			set('welcomePage', String(value));
			break;
		case 'chatModel':
			set('chatModel', String(value));
			break;
		case 'contextWindow':
			set('contextWindow', (['8k', '16k', '32k'].includes(String(value)) ? String(value) : '32k') as ContextWindow);
			break;
		case 'requireCitations':
			set('requireCitations', Boolean(value));
			break;
		case 'embeddingModel':
			set('embeddingModel', String(value));
			break;
		case 'drafts':
			set('drafts', String(value));
			break;
		case 'offlineOnly':
			set('offlineOnly', Boolean(value));
			break;
		case 'site': {
			const site = String(value).trim();
			if (/^https?:\/\//.test(site)) {
				set('site', site);
			}
			break;
		}
		case 'path': {
			const target = String(value).trim();
			if (target.startsWith('/')) {
				set('path', target);
			}
			break;
		}
		case 'publishChannel':
			set('channel', (value === 'Preview' ? 'Preview' : 'Stable') as UpdateChannel);
			break;
		case 'artifact':
			if (typeof name === 'string') {
				setArtifact(name, Boolean(value));
			}
			break;
		default:
			break;
	}
}

/* ------------------------------------------------------------------ registration */

/**
 * Registers the five pages and everything their buttons run.
 *
 * The resets and the one-off actions are here rather than in the page bodies, because each of them has to write both
 * halves of the register — the editor's settings and this profile's own — and only the module can do that.
 */
export function registerSettings(context: vscode.ExtensionContext): { pages: SettingsPages; disposables: vscode.Disposable[] } {
	const pages = new SettingsPages(context);
	const changed = (): void => pages.refresh();

	const disposables: vscode.Disposable[] = [
		// ---- General
		vscode.commands.registerCommand('temcoWorkbench.settings.reset', async () => {
			resetKeys(['workingFolder', 'updateChannel']);
			await configuration('window').update('autoDetectColorScheme', false, vscode.ConfigurationTarget.Global);
			await configuration('workbench').update('colorTheme', 'Default Dark Modern', vscode.ConfigurationTarget.Global);
			await configuration('workbench').update('breadcrumbs.enabled', undefined, vscode.ConfigurationTarget.Global);
			await configuration('telemetry').update('telemetryLevel', undefined, vscode.ConfigurationTarget.Global);
			await configuration('temcoWorkbench').update('start.open', undefined, vscode.ConfigurationTarget.Global);
			changed();
			await vscode.window.showInformationMessage(
				'Temco Workbench: these five settings are back to their defaults — both the editor’s own and this profile’s register.'
			);
		}),

		// ---- Modules
		vscode.commands.registerCommand('temcoWorkbench.settings.showOnDisk', async () => {
			try {
				await vscode.commands.executeCommand('workbench.extensions.action.openExtensionsFolder');
			} catch {
				// A web build has no folder to open, and saying "opened" there would be a lie.
				await vscode.window.showInformationMessage(
					'Temco Workbench: this window has no folder to open. The modules live in the build’s extensions/ directory.'
				);
			}
		}),

		vscode.commands.registerCommand('temcoWorkbench.settings.checkUpdates', async () => {
			try {
				await vscode.commands.executeCommand('update.check');
			} catch {
				await vscode.window.showInformationMessage(
					`Temco Workbench: this build does not update itself — it is ${vscode.version}, and a module changes only when the build does.`
				);
			}
		}),

		// ---- Branding
		vscode.commands.registerCommand('temcoWorkbench.settings.themeDark', async () => {
			await applySetting('theme', 'Dark');
			changed();
		}),

		vscode.commands.registerCommand('temcoWorkbench.settings.themeLight', async () => {
			await applySetting('theme', 'Light');
			changed();
		}),

		vscode.commands.registerCommand('temcoWorkbench.settings.replaceIcon', async () => {
			await vscode.window.showInformationMessage(
				'Temco Workbench: the application mark is compiled into the build and is drawn before any extension runs. A profile cannot replace it, and this page will not pretend to have tried.'
			);
		}),

		vscode.commands.registerCommand('temcoWorkbench.settings.resetBranding', async () => {
			resetKeys(['productName', 'accent', 'welcomePage']);
			await applySetting('theme', 'Dark');
			changed();
			await vscode.window.showInformationMessage('Temco Workbench: the identity and the shell theme are back to what the build ships.');
		}),

		// ---- Publishing
		vscode.commands.registerCommand('temcoWorkbench.settings.testPublish', async () => {
			const settings = values();
			set('publishProbe', `checked just now · ${settings.site}${settings.path}`);
			changed();
			await vscode.window.showInformationMessage('Temco Workbench: the target reads back as configured.', {
				detail: [
					`Site ${settings.site}`,
					`Path ${settings.path}`,
					`Channel ${settings.channel} · ${publishedArtifacts()} of ${ARTIFACTS.length} artifacts`,
					'No request was sent: this build has no network client.'
				].join('\n')
			});
		})
	];

	return { pages, disposables };
}

/** The register, for the rest of the module: the startup path and the strip both read it. */
export function settingsValues(): SettingsRegister {
	return values();
}
