// Workspaces — the mock's three surfaces, over the mock's own sample.
//
// Rebuilt from `docs/mock/js/views.overview.js` (`workspaces/all`, `workspaces/t3000`, `workspaces/templates`): the
// same page head, the same tiles, the same groups and the same words. The rows come from `workspacesSample.ts`,
// because the platform keeps no register of workspaces — a workspace is the folder a window stands in, and a folder
// is what VS Code opens, so the list is the design's and cannot be discovered from the machine.

import * as vscode from 'vscode';
import { commandScript, escapeHtml, icon, page, pageColumn, runCommand, toneMark } from './ui';
import { AREAS, HEADLINE, HEALTH_CHECKS, SETTINGS, SOURCES, TEMPLATES, WORKSPACES, Workspace, WorkspaceSource } from './workspacesSample';

/** The view types the surfaces open under. */
export const WORKSPACES_VIEW_TYPE = 'temcoWorkbench.workspaces';
export const WORKSPACE_VIEW_TYPE = 'temcoWorkbench.workspace';
export const NEW_WORKSPACE_VIEW_TYPE = 'temcoWorkbench.newWorkspace';
export const TEMPLATES_VIEW_TYPE = 'temcoWorkbench.templates';

interface ActionOptions {
	kind?: 'primary' | 'ghost';
	/** The glyph the mock puts before the label. */
	mark?: string;
	args?: unknown;
	small?: boolean;
}

const action = (label: string, command: string, options: ActionOptions = {}): string =>
	`<button type="button" class="btn${options.small ? ' btn--sm' : ''}${options.kind ? ` btn--${options.kind}` : ''}" data-command="${command}"${options.args === undefined ? '' : ` data-args="${escapeHtml(JSON.stringify(options.args))}"`}>${options.mark ? icon(options.mark) : ''}<span>${escapeHtml(label)}</span></button>`;

const rules = (label: string, count: string, actions = ''): string =>
	`<div class="group-head"><span class="group-head__label">${escapeHtml(label)}</span><span class="group-head__rule"></span><span class="group-head__count">${escapeHtml(count)}</span>${actions ? `<span class="group-head__actions">${actions}</span>` : ''}</div>`;

const tiles = (entries: { value: string; label: string }[]): string =>
	`<div class="tiles">${entries.map((entry) => `<div class="tile"><span class="tile__value">${escapeHtml(entry.value)}</span><span class="tile__label">${escapeHtml(entry.label)}</span></div>`).join('')}</div>`;

/** A statement of fact, as the mock writes one: a tone mark, a title, and the sentence under it. */
const fact = (mark: string, title: string, note: string): string =>
	`<div class="record-row record-row--static">
		${toneMark(mark)}
		<div class="record-row__main">
			<div class="record-row__title"><span class="record-row__name">${escapeHtml(title)}</span></div>
			<div class="record-row__meta"><span>${escapeHtml(note)}</span></div>
		</div>
	</div>`;

/** One entry of a `.list`, which is what the mock's `ui.list` emits. */
const listItem = (mark: string, title: string, sub: string, meta: string): string =>
	`<div class="list__item">
		${icon(mark)}
		<div class="list__main">
			<div class="list__title">${escapeHtml(title)}</div>
			<div class="list__sub">${escapeHtml(sub)}</div>
		</div>
		${meta ? `<div class="list__meta">${meta}</div>` : ''}
	</div>`;

const badge = (text: string, tone?: string): string =>
	`<span class="badge${tone ? ` badge--${tone}` : ''}">${escapeHtml(text)}</span>`;

/** One panel per surface, kept open so a second visit reveals the tab. */
export class WorkspacesPages {
	private readonly panels = new Map<string, vscode.WebviewPanel>();
	/** Workspaces created in this window. They are not written anywhere: the sample is the design's, and a
	 * create that outlived the window would be a second source of truth beside it. */
	private readonly created: Workspace[] = [];

	constructor(private readonly context: vscode.ExtensionContext) { }

	/** Every workspace the surfaces know: the ones made here, then the design's. */
	private list(): Workspace[] {
		return [...this.created, ...WORKSPACES];
	}

	/** *All Workspaces* — the mock's `workspaces/all`. */
	open(): void {
		this.show('all', WORKSPACES_VIEW_TYPE, 'All Workspaces', 'workspaces.svg', allBody(this.list()));
	}

	/** *New Workspace* — the mock's `flow/new-workspace`, a two-step wizard. */
	openNewWorkspace(): void {
		this.show('new', NEW_WORKSPACE_VIEW_TYPE, 'New Workspace', 'workspaces.svg', newWorkspaceBody(), WIZARD_SCRIPT);
	}

	/** The wizard's last step: the workspace exists in this window, and the list comes back with it. */
	create(values: { name?: unknown; folder?: unknown; modules?: unknown }): void {
		const name = typeof values.name === 'string' && values.name.trim().length > 0 ? values.name.trim() : 'Untitled Workspace';
		const folder = typeof values.folder === 'string' && values.folder.trim().length > 0
			? values.folder.trim()
			: `~/Temco/${name.replace(/\s+/g, '')}`;
		this.created.unshift({
			id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
			name,
			path: folder,
			desc: 'Created in this window',
			projects: 0,
			sources: 0,
			devices: 0,
			updated: 'just now',
			active: false
		});
		this.panels.get('new')?.dispose();
		this.open();
		void vscode.window.showInformationMessage(`Temco Workspaces: “${name}” created.`);
	}

	/** One workspace, as the mock draws it (`workspaces/t3000`). */
	openWorkspace(id: string): void {
		const workspace = this.list().find((entry) => entry.id === id) ?? WORKSPACES[0];
		this.show(`workspace:${workspace.id}`, WORKSPACE_VIEW_TYPE, workspace.name, 'workspaces.svg', workspaceBody(workspace));
	}

	/** *Templates* — the mock's `workspaces/templates`. */
	openTemplates(): void {
		this.show('templates', TEMPLATES_VIEW_TYPE, 'Templates', 'documents.svg', templatesBody());
	}

	dispose(): void {
		for (const panel of this.panels.values()) {
			panel.dispose();
		}
		this.panels.clear();
	}

	private show(key: string, viewType: string, title: string, iconFile: string, body: string, script = commandScript): void {
		const existing = this.panels.get(key);
		if (existing) {
			existing.reveal(pageColumn());
			existing.webview.html = page(body, { title, script });
			return;
		}
		const panel = vscode.window.createWebviewPanel(viewType, title, pageColumn(), {
			enableScripts: true,
			localResourceRoots: []
		});
		panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'media', iconFile);
		panel.webview.onDidReceiveMessage(runCommand);
		panel.webview.html = page(body, { title, script });
		this.panels.set(key, panel);
		panel.onDidDispose(() => this.panels.delete(key));
	}
}

/** One workspace, as the mock writes one: where it stands, how much is in it, and the way into it. */
function workspaceRow(workspace: Workspace, current: boolean): string {
	return `<div class="record-row${current ? ' record-row--current' : ' record-row--static'}">
		${toneMark('layers', current ? 'accent' : undefined)}
		<div class="record-row__main">
			<div class="record-row__title"><span class="record-row__name">${escapeHtml(workspace.name)}</span></div>
			<div class="record-row__meta">
				<span class="cell-mono">${escapeHtml(workspace.path)}</span>
				<span>${workspace.projects} projects</span>
				<span>${workspace.sources} sources</span>
				<span>${workspace.devices > 0 ? `${workspace.devices} devices` : 'no devices'}</span>
				<span>opened ${escapeHtml(workspace.updated)}</span>
			</div>
		</div>
		<div class="record-row__state">${current ? badge('Current', 'accent') : ''}</div>
		${action(current ? 'Open' : 'Switch', 'temcoWorkbench.workspace', { kind: 'ghost', small: true, args: [workspace.id] })}
	</div>`;
}

/** The modules a workspace can bring forward — the mock's `flow/new-workspace` list. */
const NEW_WORKSPACE_MODULES = [
	{ value: 'docs', label: 'Documentation', sub: 'projects, sources, pages, builds' },
	{ value: 'learn', label: 'Temco Learn', sub: 'the published site' },
	{ value: 'ai', label: 'AI Hub', sub: 'local models and drafts' },
	{ value: 'devices', label: 'Devices', sub: 'fleet, firmware, health' },
	{ value: 'io', label: 'I/O Studio', sub: 'points and mapping' },
	{ value: 'bacnet', label: 'BACnet Studio', sub: 'objects, alarms, trends' },
	{ value: 'network', label: 'Network', sub: 'discovery and captures' },
	{ value: 'sql', label: 'SQL Studio', sub: 'queries and reports' }
];

const NEW_WORKSPACE_DEFAULTS = { name: 'Field Service', folder: '~/Temco/FieldService', modules: ['docs', 'learn', 'ai'] };

/** *New Workspace* — the mock's `flow/new-workspace`: two steps, a rail, and one command at the end. */
function newWorkspaceBody(): string {
	const steps = ['Name', 'Modules'].map((label, index) =>
		`${index > 0 ? '<span class="step__arrow" aria-hidden="true">→</span>' : ''}<button type="button" class="step${index === 0 ? ' is-active' : ''}" data-step="${index}" role="tab" aria-selected="${index === 0}"><span class="step__n">${index + 1}.</span><span class="step__label">${escapeHtml(label)}</span></button>`
	).join('');
	const checklist = NEW_WORKSPACE_MODULES.map((module) =>
		`<label class="checklist__row"><input type="checkbox" data-field="modules" data-multi value="${module.value}"${NEW_WORKSPACE_DEFAULTS.modules.includes(module.value) ? ' checked' : ''}><span class="checklist__text"><span class="checklist__title">${escapeHtml(module.label)}</span><span class="checklist__sub">${escapeHtml(module.sub)}</span></span></label>`
	).join('');

	return `<div class="page-head">
	<div class="page-head__main">
		<div class="eyebrow">Workspaces</div>
		<h1 class="page-head__title">${icon('layers')}New Workspace</h1>
		<p class="page-head__desc">A workspace is the folder the window stands in: its projects, the sources they read and the devices it can reach.</p>
	</div>
	<div class="page-head__actions">${action('Cancel', 'temcoWorkbench.workspaces', { kind: 'ghost', mark: 'close' })}</div>
</div>

<div class="wizard">
	<div class="wizard__steps" role="tablist">${steps}</div>
	<div class="wizard__body">
		<div data-step-body="0">
			<div class="wizard__title">Name and folder</div>
			<p class="wizard__hint">The folder is created on first use; it is not created now.</p>
			<div class="form">
				<div class="field"><label for="ws-name">Name</label><input class="input" id="ws-name" value="${escapeHtml(NEW_WORKSPACE_DEFAULTS.name)}" aria-label="Workspace name"></div>
				<div class="field"><label for="ws-folder">Folder</label><input class="input" id="ws-folder" value="${escapeHtml(NEW_WORKSPACE_DEFAULTS.folder)}" aria-label="Folder"></div>
			</div>
		</div>
		<div data-step-body="1" hidden>
			<div class="wizard__title">What is it for?</div>
			<p class="wizard__hint">This only changes what the workspace brings forward; every module stays available.</p>
			<div class="checklist">${checklist}</div>
		</div>
		<div class="wizard__error" id="wizard-error" hidden></div>
	</div>
	<div class="wizard__foot">
		<span class="cell-muted" style="font-size:12px" id="wizard-count">Step 1 of 2</span>
		<span class="wizard__spacer"></span>
		<button type="button" class="btn" id="wizard-back" hidden>${icon('chevron-left')}<span>Back</span></button>
		<button type="button" class="btn btn--primary" id="wizard-next"><span>Next</span></button>
		<button type="button" class="btn btn--primary" id="wizard-finish" hidden>${icon('check')}<span>Create Workspace</span></button>
	</div>
</div>`;
}

/**
 * The wizard's behaviour, as the mock's flow engine does it: two steps, the name required, and the
 * last button posting what was collected. It never decides what a workspace *is* — the module does.
 */
const WIZARD_SCRIPT = `
(function () {
	const api = acquireVsCodeApi();
	const steps = Array.prototype.slice.call(document.querySelectorAll('.wizard__steps .step'));
	const bodies = Array.prototype.slice.call(document.querySelectorAll('[data-step-body]'));
	const error = document.getElementById('wizard-error');
	const count = document.getElementById('wizard-count');
	const back = document.getElementById('wizard-back');
	const next = document.getElementById('wizard-next');
	const finish = document.getElementById('wizard-finish');
	const name = document.getElementById('ws-name');
	const folder = document.getElementById('ws-folder');
	let at = 0;

	function show() {
		steps.forEach(function (step, index) {
			step.classList.toggle('is-active', index === at);
			step.classList.toggle('is-done', index < at);
			step.setAttribute('aria-selected', String(index === at));
		});
		bodies.forEach(function (body, index) { body.hidden = index !== at; });
		count.textContent = 'Step ' + (at + 1) + ' of ' + bodies.length;
		back.hidden = at === 0;
		next.hidden = at === bodies.length - 1;
		finish.hidden = at !== bodies.length - 1;
	}

	function fail(message) {
		error.textContent = message;
		error.hidden = false;
	}

	function go(to) {
		error.hidden = true;
		at = to;
		show();
	}

	function values() {
		const modules = Array.prototype.slice.call(document.querySelectorAll('[data-field="modules"]:checked')).map(function (input) { return input.value; });
		return { name: name.value, folder: folder.value, modules: modules };
	}

	steps.forEach(function (step) {
		step.addEventListener('click', function () { go(Number(step.dataset.step)); });
	});
	back.addEventListener('click', function () { go(Math.max(0, at - 1)); });
	next.addEventListener('click', function () {
		if (!name.value.trim()) { fail('A workspace needs a name.'); return; }
		go(at + 1);
	});
	finish.addEventListener('click', function () {
		if (!name.value.trim()) { go(0); fail('A workspace needs a name.'); return; }
		api.postMessage({ type: 'command', command: 'temcoWorkbench.createWorkspace', args: values() });
	});

	show();
})();
`;

/** *All Workspaces* — the mock's `workspaces/all`, word for word. */
function allBody(list: readonly Workspace[]): string {
	const current = list.find((workspace) => workspace.active) ?? list[0];
	const others = list.filter((workspace) => workspace.id !== current.id);
	const projects = list.reduce((total, workspace) => total + workspace.projects, 0);
	const sources = list.reduce((total, workspace) => total + workspace.sources, 0);

	return `<div class="page-head">
	<div class="page-head__main">
		<h1 class="page-head__title">${icon('layers')}All Workspaces</h1>
		<p class="page-head__desc">A workspace is the folder the window stands in: its projects, the sources they read, and the devices it can reach. One window is on one workspace at a time.</p>
	</div>
	<div class="page-head__actions">${action('New Workspace', 'temcoWorkbench.newWorkspace', { kind: 'primary', mark: 'plus' })}</div>
</div>

${tiles([
		{ value: String(list.length), label: 'On this machine' },
		{ value: String(projects), label: 'Projects' },
		{ value: String(sources), label: 'Sources' },
		{ value: current.name, label: 'Open now' }
	])}

<div class="mt-24">
	${rules('Open Now', 'this window')}
	<p class="group-note">Every tab, the AI bar and the panel in front of you belong to this workspace. Opening another one does not close them.</p>
	<div class="record-list">${workspaceRow(current, true)}</div>
</div>

<div class="mt-24">
	${rules('Elsewhere On This Machine', `${others.length} workspaces`)}
	<p class="group-note">Each keeps its own tabs, its own working folder and its own selection, so switching back is where you left off.</p>
	<div class="record-list">${others.map((workspace) => workspaceRow(workspace, false)).join('')}</div>
</div>

<div class="mt-24">
	${rules('What Switching Does', '3 facts')}
	<div class="record-list">
		${fact('layers', 'Tabs come back', 'each workspace remembers the surfaces it had open')}
		${fact('folder', 'The working folder follows', 'repositories are cloned beside the workspace, not in one global folder')}
		${fact('chip', 'The device list narrows', 'a workspace only reaches the controllers it lists')}
	</div>
</div>`;
}

/** One workspace — the mock's `workspaces/t3000`. */
function workspaceBody(workspace: Workspace): string {
	const areas = AREAS.map((area) =>
		listItem('book', area.area, `${area.pages} pages · ${area.stale} stale`, badge(area.stale === 0 ? 'Current' : `${area.stale} stale`, area.stale === 0 ? 'ok' : 'warn'))
	).join('');
	const sources = SOURCES.slice(0, 5).map((source: WorkspaceSource) =>
		listItem(source.kind === 'Repository' ? 'repo' : 'document', source.name, source.detail, badge(source.state, source.tone === 'neutral' ? undefined : source.tone))
	).join('');
	const settings = SETTINGS.map((entry) =>
		`<div><div class="settings-strip__label">${escapeHtml(entry.label)}</div><div class="settings-strip__value${entry.mono ? ' cell-mono' : ''}">${escapeHtml(entry.value)}</div></div>`
	).join('');

	return `<div class="page-head">
	<div class="page-head__main">
		<div class="eyebrow">Workspace</div>
		<h1 class="page-head__title">${icon('building')}${escapeHtml(workspace.name)}</h1>
		<p class="page-head__desc">${escapeHtml(workspace.desc)}. ${workspace.projects} projects · ${workspace.sources} sources · ${workspace.devices} devices.</p>
	</div>
	<div class="page-head__actions">${action('Documentation', 'temcoDocs.overview', { mark: 'document' })}${action('Devices', 'temcoTools.open', { mark: 'chip', args: ['devices'] })}</div>
</div>

<div class="hero-panel">
	<div class="eyebrow">Current workspace</div>
	<div class="hero-panel__title">Everything in this window is ${escapeHtml(workspace.name)}</div>
	<p class="hero-panel__desc">${workspace.projects} projects, ${workspace.sources} sources and ${workspace.devices} devices, with one release in flight. Switching workspace closes nothing — the tabs come back when you return.</p>
	<div class="hero-panel__actions">${action('Open Review Center', 'temcoDocs.stalenessReport', { kind: 'primary', mark: 'check' })}${action('Switch Workspace…', 'workbench.action.files.openFolder', { mark: 'layers' })}</div>
</div>

<div class="mt-24">
	${tiles([
		{ value: HEADLINE.pages, label: 'Pages' },
		{ value: String(workspace.sources), label: 'Sources' },
		{ value: String(workspace.devices), label: 'Devices' },
		{ value: HEADLINE.openRelease, label: 'Open release' },
		{ value: HEADLINE.needsReview, label: 'Needs review' }
	])}
</div>

<div class="mt-24 split">
	<div class="card card--plain">
		<div class="card__head"><div class="card__title">Areas</div></div>
		<p class="card__desc">The registry, as the side bar would show it when this workspace is open.</p>
		<div class="list">${areas}</div>
	</div>
	<div class="card card--plain">
		<div class="card__head"><div class="card__title">Sources</div></div>
		<div class="list">${sources}</div>
	</div>
</div>

<div class="mt-24">
	<div class="card card--plain">
		<div class="card__head"><div class="card__title">${icon('gear')}Project Settings</div><div class="card__actions">${action('Edit Settings', 'temcoWorkbench.settings', { kind: 'ghost', small: true })}</div></div>
		<p class="card__desc">Stored in the platform database, not in the repository.</p>
		<div class="settings-strip">${settings}</div>
	</div>
</div>`;
}

/** *Templates* — the mock's `workspaces/templates`. */
function templatesBody(): string {
	const starter = TEMPLATES.reduce((total, template) => total + template.pages, 0);

	const rows = TEMPLATES.map((template) => `<div class="record-row record-row--static">
		${toneMark('document')}
		<div class="record-row__main">
			<div class="record-row__title"><span class="record-row__name">${escapeHtml(template.name)}</span></div>
			<div class="record-row__meta">
				<span>${template.pages} starter pages</span>
				<span>${template.areas.length} areas</span>
				<span>${escapeHtml(template.targets.join(' · '))}</span>
				<span>filled from ${escapeHtml(template.from)}</span>
			</div>
		</div>
		<div class="record-row__state cell-mono cell-muted">${template.pages} pp</div>
		${action('Use Template', 'temcoProjects.newProject', { kind: 'ghost', small: true })}
	</div>`).join('');

	return `<div class="page-head">
	<div class="page-head__main">
		<h1 class="page-head__title">${icon('package')}Templates</h1>
		<p class="page-head__desc">A template is the shape a project starts with: the areas it opens, the pages it stubs out and the artifacts the build will produce. It writes nothing until a project uses it.</p>
	</div>
	<div class="page-head__actions">${action('New Template', 'temcoProjects.newProject', { mark: 'plus' })}</div>
</div>

${tiles([
		{ value: String(TEMPLATES.length), label: 'Templates' },
		{ value: String(starter), label: 'Starter pages' },
		{ value: String(AREAS.length), label: 'Areas it can draw from' },
		{ value: String(HEALTH_CHECKS), label: 'Checks every build runs' }
	])}

<div class="mt-24">
	${rules('Templates', `${TEMPLATES.length} templates`)}
	<p class="group-note">Using one opens New Project with this shape already chosen — the template adds areas and page order, never a page body.</p>
	<div class="record-list">${rows}</div>
</div>

<div class="mt-24">
	${rules('What a Template Decides', '4 facts')}
	<div class="record-list">
		${fact('list', 'Areas and page order', 'the registry areas this kind of book needs, and where its pages sit inside them')}
		${fact('check', 'Checks', `the same ${HEALTH_CHECKS} health checks run on every build, whatever the template`)}
		${fact('package', 'Build targets', 'website is always one; PDF, CHM and the indexes are chosen per template')}
		${fact('users', 'What it does not decide', 'content, owner or version — those come from the project and from the first read')}
	</div>
</div>

<div class="mt-16">
	<div class="callout">${icon('info')}<span>A template creates empty pages with titles and an order. The first read of a source is what fills them, which is why a template on its own produces nothing a reader can reach.</span></div>
</div>`;
}
