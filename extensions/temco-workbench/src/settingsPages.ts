// Settings — the five surfaces the mock draws, on the shared page kit.
//
// Rebuilt from `docs/mock/js/views.platform.js` (`settings/general`, `settings/modules`, `settings/branding`,
// `settings/ai`, `settings/publishing`). The settings the platform really owns are still written by the module's
// own command (`temcoWorkbench.setStartOpen` writes `start.open`); everything else here is the mock's form, drawn
// so the shape is decided once — a control that writes is added when its setting exists.

import * as vscode from 'vscode';
import { ARTIFACTS, MODULES, ModuleRow, ROLES } from './settingsSample';
import { escapeHtml as esc, icon, page, pageColumn } from './ui';

export const SETTINGS_GENERAL_VIEW_TYPE = 'temcoWorkbench.settings.general';
export const SETTINGS_MODULES_VIEW_TYPE = 'temcoWorkbench.settings.modules';
export const SETTINGS_BRANDING_VIEW_TYPE = 'temcoWorkbench.settings.branding';
export const SETTINGS_AI_VIEW_TYPE = 'temcoWorkbench.settings.ai';
export const SETTINGS_PUBLISHING_VIEW_TYPE = 'temcoWorkbench.settings.publishing';

const button = (label: string, command: string, options: { kind?: 'primary' | 'ghost'; mark?: string; small?: boolean } = {}): string =>
	`<button type="button" class="btn${options.small ? ' btn--sm' : ''}${options.kind ? ` btn--${options.kind}` : ''}" data-command="${command}">${options.mark ? icon(options.mark) : ''}<span>${esc(label)}</span></button>`;

const pageHead = (options: { title: string; mark: string; desc: string; actions?: string }): string =>
	`<div class="page-head"><div class="page-head__main"><h1 class="page-head__title">${icon(options.mark)}${esc(options.title)}</h1><p class="page-head__desc">${options.desc}</p></div>${options.actions ? `<div class="page-head__actions">${options.actions}</div>` : ''}</div>`;

const rule = (label: string, count?: string, note?: string, actions?: string): string =>
	`<div class="group-head"><span class="group-head__label">${esc(label)}</span><span class="group-head__rule"></span>${count ? `<span class="group-head__count">${esc(count)}</span>` : ''}${actions ? `<span class="group-head__actions">${actions}</span>` : ''}</div>${note ? `<p class="group-note">${note}</p>` : ''}`;

const formRow = (label: string, desc: string, control: string, tag?: string): string =>
	`<div class="form-row"><div class="form-row__main"><div class="form-row__label">${esc(label)}${tag ? ` <span class="tag">${esc(tag)}</span>` : ''}</div><div class="form-row__desc">${esc(desc)}</div></div><div class="form-row__control">${control}</div></div>`;

const segmented = (name: string, values: string[], current: string): string =>
	`<div class="segmented" role="group" aria-label="${esc(name)}">${values.map((value) => `<button type="button" aria-pressed="${value === current}">${esc(value)}</button>`).join('')}</div>`;

const callout = (html: string, kind?: 'warn' | 'ok'): string =>
	`<div class="callout${kind ? ` callout--${kind}` : ''}">${icon(kind === 'warn' ? 'alert' : 'info')}<div>${html}</div></div>`;

const settingsStrip = (entries: [string, string, boolean?][]): string =>
	`<div class="settings-strip">${entries.map(([label, value, mono]) => `<div><div class="settings-strip__label">${esc(label)}</div><div class="settings-strip__value${mono ? ' cell-mono' : ''}">${esc(value)}</div></div>`).join('')}</div>`;

/** The command that opens the surface a module draws, for the rows that name one. */
const SURFACE_COMMANDS: { [surface: string]: string } = {
	overview: 'temcoWorkbench.overview',
	documents: 'temcoDocs.documents',
	sources: 'temcoDocs.sources',
	projects: 'temcoDocs.projects',
	chat: 'temcoAi.chat'
};

/** The five settings surfaces, one panel each. */
export class SettingsPages {
	private readonly panels = new Map<string, vscode.WebviewPanel>();

	constructor(private readonly context: vscode.ExtensionContext) { }

	general(): void {
		this.open('general', SETTINGS_GENERAL_VIEW_TYPE, 'General', generalBody());
	}

	modules(): void {
		this.open('modules', SETTINGS_MODULES_VIEW_TYPE, 'Modules', modulesBody());
	}

	branding(): void {
		this.open('branding', SETTINGS_BRANDING_VIEW_TYPE, 'Branding', brandingBody());
	}

	ai(): void {
		this.open('ai', SETTINGS_AI_VIEW_TYPE, 'AI Models', aiBody());
	}

	publishing(): void {
		this.open('publishing', SETTINGS_PUBLISHING_VIEW_TYPE, 'Publishing', publishingBody());
	}

	/** Re-renders General if it is open — the startup setting is also written from the welcome page. */
	refresh(): void {
		const panel = this.panels.get('general');
		if (panel) {
			panel.webview.html = page(generalBody(), { title: 'General' });
		}
	}

	dispose(): void {
		for (const panel of this.panels.values()) {
			panel.dispose();
		}
		this.panels.clear();
	}

	private open(key: string, viewType: string, title: string, body: string): void {
		const html = page(body, { title });
		const existing = this.panels.get(key);
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
		this.panels.set(key, panel);
		panel.onDidDispose(() => this.panels.delete(key));
	}
}

/** *General* — the mock's `settings/general`. */
function generalBody(): string {
	return `${pageHead({
		title: 'General',
		mark: 'gear',
		desc: 'Settings this profile owns. Only the rows marked <span class="tag">Workspace</span> — nothing else here follows a workspace.',
		actions: button('Open JSON', 'workbench.action.openSettingsJson', { mark: 'code' })
	})}
${rule('Window', '3 settings', 'What the window looks like, and what it opens with.')}
<div class="settings-rows">
${formRow('Theme', 'Colour roles only — a theme never changes the layout.', segmented('Theme', ['System', 'Dark', 'Light'], 'System'))}
${formRow('Startup view', 'The tab that opens when the window starts.', '<select class="select" aria-label="Startup view"><option>Welcome</option><option>Needs Work</option><option>Dashboard</option><option>Last used</option><option>Empty editor</option></select>')}
${formRow('Breadcrumbs', 'The path above the editor. Off by default: this window has no file system, so the bar can only repeat the side bar and the tab.', '<input type="checkbox" aria-label="Breadcrumbs">')}
</div>
${rule('Files', '1 setting', 'One folder holds every repository, capture and build the platform writes.')}
<div class="settings-rows">
${formRow('Working folder', 'Where repositories are cloned and captures are written.', '<input class="input" value="~/Temco" aria-label="Working folder">', 'Workspace')}
</div>
${rule('Diagnostics and Updates', '2 settings')}
<div class="settings-rows">
${formRow('Telemetry', 'Documentation checks and build failures only. Never page content, never a prompt.', '<label class="check"><input type="checkbox" checked><span>Send diagnostics</span></label>')}
${formRow('Update channel', 'Preview adds release candidates one version earlier than Stable.', segmented('Update channel', ['Stable', 'Preview'], 'Stable'), 'Restart')}
</div>
${rule('Where These Live', undefined, undefined, button('Restore Defaults', 'workbench.action.openSettings', { small: true, kind: 'ghost' }))}
${settingsStrip([
		['File', '~/.temco/settings.json', true],
		['Profile', 'Default'],
		['Can be overridden', '1 of these 5 settings'],
		['Last changed', '2 days ago · Derek']
	])}`;
}

/** *Modules* — the mock's `settings/modules`. */
function modulesBody(): string {
	const active = MODULES.filter((module) => module.state === 'Active');
	const reserved = MODULES.filter((module) => module.state === 'Reserved');

	const table = (rows: ModuleRow[]): string =>
		`<div class="table-wrap table-wrap--plain"><table class="table table--compact"><thead><tr><th>Module</th><th>Namespace</th><th>What It Owns</th><th></th></tr></thead><tbody>${rows.map((module) => `<tr><td><span class="cell-strong" style="white-space:nowrap">${esc(module.name)}</span><div class="cell-muted cell-mono" style="font-size:11px;white-space:nowrap">${esc(module.id.replace('temcocontrols.', ''))}</div></td><td><span class="cell-mono cell-muted">${esc(module.namespace)}</span></td><td>${esc(module.owns)}</td><td style="text-align:right">${module.surface && SURFACE_COMMANDS[module.surface] ? button('Open', SURFACE_COMMANDS[module.surface], { small: true, kind: 'ghost' }) : '<span class="cell-muted" style="white-space:nowrap">No surface</span>'}</td></tr>`).join('')}</tbody></table></div>`;

	return `${pageHead({
		title: 'Modules',
		mark: 'package',
		desc: 'A module is a built-in extension: it ships with the platform and is never installed, removed or updated from the window.',
		actions: button('Show on Disk', 'workbench.action.openExtensionsFolder', { mark: 'folder' })
	})}
${callout('<b>There is no marketplace.</b> The build refuses a <code>product.json</code> that configures an extension gallery, so this window loads the modules in <code>extensions/</code> and nothing else — there is nothing to install and nothing to update on its own.', 'warn')}
${rule('Active', `${active.length} modules`, 'Ids all live under the <code>temcocontrols.</code> scope, so the table drops the prefix and shows the part that differs.')}
<div class="mt-16">${table(active)}</div>
${rule('Reserved', `${reserved.length} modules`, 'A folder with a README and a surface drawn in this mock. The build ships nothing for them until each has a first real feature.')}
<div class="mt-16">${table(reserved)}</div>
${rule('Platform Updates', '1.143.0 · stable', 'A module updates with the platform, never on its own — there is no optional module to add or remove.', button('Check for Updates', 'workbench.action.checkForUpdates', { small: true, mark: 'refresh' }))}
${settingsStrip([
		['Version', '1.143.0', true],
		['Channel', 'Stable'],
		['Last checked', '2 hours ago'],
		['Optional modules', 'none']
	])}`;
}

/** *Branding* — the mock's `settings/branding`. */
function brandingBody(): string {
	const mark = (size: number): string =>
		`<div style="display:grid;place-items:center;width:${size}px;height:${size}px;border-radius:${Math.round(size / 4.6)}px;background:#224E7A;color:#fff;font-size:${Math.round(size / 2.5)}px;font-weight:700">T</div>`;

	const roles = ROLES.map((role) => `<span style="display:inline-flex;align-items:center;gap:6px" class="cell-muted"><span style="width:22px;height:22px;border-radius:5px;background:${role.colour}"></span>${esc(role.name)}</span>`).join('');

	return `${pageHead({
		title: 'Branding',
		mark: 'palette',
		desc: 'The identity the shell draws: the mark, the wordmark and the accent. The mock previews them in place rather than in a specimen sheet.',
		actions: button('Reset', 'workbench.action.openSettings', { mark: 'refresh' })
	})}
${rule('Application Mark', 'one drawing, three sizes', 'The window, the taskbar and the title bar draw the same file at 64, 32 and 16 pixels.', button('Replace', 'workbench.action.openSettings', { small: true, kind: 'ghost' }))}
<div class="row" style="gap:18px;align-items:flex-end;margin-top:12px">${mark(64)}${mark(32)}${mark(16)}<span class="cell-mono cell-muted" style="margin-left:6px">resources/temco-icon.svg</span></div>
${rule('Theme', '2 themes shipped', 'A theme changes colour roles, never layout: every surface here is drawn from the five roles below.')}
<div class="settings-rows">
${formRow('Shell theme', 'Dark ships by default; Light exists because a print shop and a projector are not dark rooms.', button('Dark', 'workbench.action.selectTheme', { small: true, kind: 'primary' }) + button('Light', 'workbench.action.selectTheme', { small: true }))}
</div>
<div class="row" style="gap:10px;align-items:center;margin-top:12px">${roles}</div>
${rule('Identity', '3 settings')}
<div class="settings-rows">
${formRow('Product name', 'Drawn in the title bar and the About window.', '<input class="input" value="Temco Platform" aria-label="Product name">')}
${formRow('Accent colour', 'Used for focus, selection and the active container indicator.', '<input class="input" value="#0078d4" aria-label="Accent colour">')}
${formRow('Welcome page', 'The walkthrough shown on a fresh profile.', '<select class="select" aria-label="Welcome page"><option>Temco Platform</option><option>None</option></select>')}
</div>`;
}

/** *AI Models* — the mock's `settings/ai`. */
function aiBody(): string {
	const pages = 1254;

	return `${pageHead({
		title: 'AI Models',
		mark: 'sparkle',
		desc: 'What this profile loads, how much it may read, and what it is allowed to touch. The AI Hub shows what is loaded right now; this page decides what loads next.',
		actions: button('Open Models', 'temcoAi.localModels', { mark: 'chip' })
	})}
${rule('Answering', '3 settings', 'The model behind the AI panel and behind every Draft action.')}
<div class="settings-rows">
${formRow('Chat model', 'Both run on this machine; nothing here calls a service.', '<select class="select" aria-label="Chat model"><option>qwen2.5-3b-instruct</option><option>phi-3-mini-4k</option><option>temco-docs-1.4b</option></select>')}
${formRow('Context window', 'How much of a page, its area and the sources behind it the model may read at once.', segmented('Context window', ['8k', '16k', '32k'], '32k'))}
${formRow('Always cite', 'An answer without a citation is refused, not merely discouraged.', '<label class="check"><input type="checkbox" checked><span>Require citations</span></label>')}
</div>
${rule('Retrieval', '1 setting')}
<div class="settings-rows">
${formRow('Embedding model', `Builds and queries the knowledge index. Changing it re-indexes all ${pages.toLocaleString('en-US')} pages.`, '<select class="select" aria-label="Embedding model"><option>nomic-embed-text</option></select>')}
</div>
${rule('Drafts and Network', '2 settings')}
<div class="settings-rows">
${formRow('Drafts', 'Where an AI change goes before it is written to a page. Nothing reaches a reader without passing Review Center.', '<select class="select" aria-label="Drafts"><option>Review Center</option><option>Review Center, auto-reject after 7 days</option></select>')}
${formRow('Offline only', 'Refuse every action that would call a network service.', '<label class="check"><input type="checkbox" checked><span>Keep prompts on this machine</span></label>')}
</div>
${rule('Loaded Right Now')}
${settingsStrip([
		['Model', 'qwen2.5-3b-instruct', true],
		['Loaded', 'since 09:12 · 2.1 GB'],
		['Indexed', `${pages.toLocaleString('en-US')} pages in 8 areas`],
		['Network calls', 'none — offline only is on']
	])}`;
}

/** *Publishing* — the mock's `settings/publishing`. */
function publishingBody(): string {
	const chosen = ARTIFACTS.filter((artifact) => artifact.on).length;

	return `${pageHead({
		title: 'Publishing',
		mark: 'upload',
		desc: 'Where a release goes and what it is allowed to overwrite. Publishing never edits a page; it copies artifacts that Build Center already built.'
	})}
${rule('Target', 'connected · last publish 12 Sep · 6.2 MB', undefined, button('Test Connection', 'temcoDocs.buildSite', { small: true, mark: 'globe' }))}
<div class="settings-rows">
${formRow('Site', 'The origin every published version is served from.', '<input class="input" value="https://learn.temcocontrols.com" aria-label="Site">')}
${formRow('Path', 'Where under the site a version is written. The {version} token is replaced at publish time.', '<input class="input" value="/t3000/{version}/" aria-label="Path">')}
${formRow('Channel', 'Preview publishes with noindex, so a search engine never sees a draft.', segmented('Channel', ['Stable', 'Preview'], 'Stable'))}
</div>
${rule('Artifacts', `${chosen} of ${ARTIFACTS.length} published`, 'Each of these is built by Build Center; publishing copies what is already there.')}
<div class="settings-rows">
${ARTIFACTS.map((artifact) => formRow(artifact.name, artifact.desc, `<input type="checkbox"${artifact.on ? ' checked' : ''} aria-label="${esc(artifact.name)}">`)).join('')}
</div>
<div class="mt-16">${callout('A published version is frozen. To change a page a reader can reach, publish a new version — an edit does not reach the site until it does.', 'warn')}</div>`;
}
