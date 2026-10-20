// New Project — where a project begins, then what it is, what it brings in, and what it builds.
//
// Five steps: **Origin**, Basics, Bring in, Outputs, Review. The origin is not a label: it decides what the
// third step asks. A project from a repository cites what the platform has already read; a project from a
// folder records that folder as a source; a project from a template writes a starter `docs/help` tree first.
// A choice that did not change the next question would be a dropdown that lies, so the one origin we cannot
// finish yet — importing Word, RTF, HTML or CHM — is shown disabled and says why.
//
// Nothing is written until *Create Project*: the wizard is markup and a small script, and every write happens
// in `create()` — the project, its sources, its outputs, and for a template its files.

import * as vscode from 'vscode';
import * as os from 'node:os';
import * as path from 'node:path';
import { Catalog, CatalogUnavailable, Selection, slugOf, SourceRow } from './store';
import { escapeHtml as esc, icon, page, pageColumn } from './ui';

export const NEW_PROJECT_VIEW_TYPE = 'temcoProjects.newProject';

/** What the wizard offers when it opens. The mock's defaults, over whatever sources the catalog has. */
const DEFAULTS = { name: 'T3000 Documentation', version: '13.0', owner: 'Derek', audience: 'Integrators and installers', folder: '~/Temco' };

const TARGETS = [
	{ value: 'website', label: 'Website', sub: 'Static pages for Temco Learn' },
	{ value: 'pdf', label: 'PDF', sub: 'One document, printed layout' },
	{ value: 'help', label: 'Offline help', sub: 'CHM · needs the help compiler' },
	{ value: 'search', label: 'Search index', sub: 'lunr index for the site' },
	{ value: 'ai', label: 'AI index', sub: 'Embeddings, kept on this machine only' }
];

/** The outputs ticked when the page opens. */
const DEFAULT_TARGETS = ['website', 'pdf', 'help', 'search'];

/** How a project begins. `available: false` is shown, disabled, with the reason — never hidden. */
interface Origin {
	value: string;
	label: string;
	sub: string;
	available: boolean;
}

const ORIGINS: Origin[] = [
	{ value: 'blank', label: 'Start empty', sub: 'No pages yet; the first one is written in the workspace.', available: true },
	{ value: 'repository', label: 'From a repository', sub: 'Cite what the platform has already read — repositories, files and folders.', available: true },
	{ value: 'folder', label: 'From a folder', sub: 'Record a folder on this machine as the pages it reads.', available: true },
	{ value: 'template', label: 'From a template', sub: 'Write a starter docs/help tree: an area, two topics and the registry.', available: true },
	{ value: 'import', label: 'Import a document set', sub: 'Word, RTF, HTML, an HTML folder or CHM — converted into docs/ and the registry.', available: true }
];

/** What an import can read. The converter lives in the documentation module, behind `temcoDocs.import`. */
const IMPORT_KINDS = [
	{ value: 'html', label: 'HTML folder or page', sub: 'One page per .html / .htm / .txt under the folder' },
	{ value: 'markdown', label: 'Markdown folder', sub: 'Existing .md files, brought into the project shape' },
	{ value: 'word', label: 'Word, RTF or ODT', sub: 'Converted with pandoc — it must be on the PATH' },
	{ value: 'chm', label: 'Compiled help (CHM)', sub: 'Decompiled with hh.exe, then converted — Windows only' }
];

/** The starters a project can be written from. One, and it is the MSDN shape: area → topics. */
const TEMPLATES = [{ value: 'user-guide', label: 'User guide', sub: 'docs/help with an Overview area, two topics and a registry' }];

export class ProjectFlowPage {
	private panel: vscode.WebviewPanel | undefined;
	private sources: SourceRow[] = [];

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly selection: Selection,
		private readonly refresh: () => void
	) { }

	async open(): Promise<void> {
		let unavailable: string | undefined;
		try {
			const catalog = await Catalog.open(this.context);
			this.sources = catalog.sources();
		} catch (error) {
			unavailable = error instanceof CatalogUnavailable ? error.message : String(error);
			this.sources = [];
		}

		const body = html(this.sources, unavailable);
		if (this.panel) {
			this.panel.reveal(pageColumn());
			this.panel.webview.html = page(body, { title: 'New Project', script: WIZARD_SCRIPT });
			return;
		}

		this.panel = vscode.window.createWebviewPanel(NEW_PROJECT_VIEW_TYPE, 'New Project', pageColumn(), {
			enableScripts: true,
			localResourceRoots: []
		});
		this.panel.webview.onDidReceiveMessage((message: { type?: string; command?: string; values?: Values }) => void this.receive(message));
		this.panel.webview.html = page(body, { title: 'New Project', script: WIZARD_SCRIPT });
		this.panel.onDidDispose(() => {
			this.panel = undefined;
		});
	}

	dispose(): void {
		this.panel?.dispose();
	}

	private async receive(message: { type?: string; command?: string; values?: Values }): Promise<void> {
		if (message.type === 'cancel') {
			this.panel?.dispose();
			return;
		}
		if (message.type === 'command' && typeof message.command === 'string') {
			await vscode.commands.executeCommand(message.command);
			return;
		}
		if (message.type === 'create' && message.values) {
			await this.create(message.values);
		}
	}

	/**
	 * The project, where its pages come from, and what it builds.
	 *
	 * The origin decides the middle: a folder or a template has to exist (or be written) before the project can
	 * cite it, and only then is the document recorded — so a project never points at a folder nobody made.
	 */
	private async create(values: Values): Promise<void> {
		const name = values.name.trim();
		if (name.length === 0) {
			return;
		}
		const slug = slugOf(name);
		const origin = ORIGINS.find((entry) => entry.value === values.origin && entry.available)?.value ?? 'blank';
		const outputs = values.targets.filter((target) => TARGETS.some((known) => known.value === target));
		const cited = origin === 'repository' ? values.sources.map((source) => slugOf(source)) : [];

		let catalog: Catalog | undefined;
		try {
			catalog = await Catalog.open(this.context);

			if (origin === 'folder' || origin === 'template' || origin === 'import') {
				const folder = resolveFolder(values.folder, name, origin !== 'folder');
				if (origin === 'template') {
					const outcome = await writeTemplate(folder, name, values.template);
					if (outcome !== undefined) {
						void vscode.window.showErrorMessage(`Temco Projects: ${outcome}`);
						return;
					}
				} else if (origin === 'import') {
					const imported = await this.importInto(folder, values);
					if (imported === undefined) {
						return;
					}
				} else if (!(await exists(folder))) {
					void vscode.window.showErrorMessage(
						`Temco Projects: ${folder.fsPath} is not there, so nothing was recorded. Check the path and try again.`
					);
					return;
				}
				// A folder of pages is a source like any other: recorded once, cited by however many projects use it.
				const sourceSlug = slugOf(path.basename(folder.fsPath) || name);
				catalog.addSource({ kind: 'folder', name, slug: sourceSlug, path: folder.fsPath });
				cited.push(sourceSlug);
			}

			catalog.createDocument({
				name,
				slug,
				version: values.version.trim() || undefined,
				audience: values.audience.trim() || undefined,
				owner: values.owner.trim() || undefined,
				origin,
				template: origin === 'template' ? values.template : undefined
			});
			catalog.setDocumentSources(slug, [...new Set(cited)]);
			catalog.setRecipe(slug, 'docfx', outputs);
		} catch (error) {
			const message = error instanceof CatalogUnavailable ? error.message : String(error);
			void vscode.window.showErrorMessage(`Temco Projects: ${message}`);
			return;
		} finally {
			catalog?.close();
		}

		// A project you have just made is the one you are working on: it is what the Workspace view and the AI read.
		await this.selection.select(slug);
		this.refresh();
		this.panel?.dispose();
		void vscode.window.showInformationMessage(`${name} created as a draft.`);
		await vscode.commands.executeCommand('temcoDocs.projects');
	}

	/**
	 * Converts the material into the folder, through the documentation module's own importer.
	 *
	 * A command rather than an import: the converter belongs to the module that owns the registry contract, and a
	 * project must not reach into another module's sources. Answers `undefined` when nothing should be recorded,
	 * after saying why on screen.
	 */
	private async importInto(folder: vscode.Uri, values: Values): Promise<undefined> {
		const source = expand(values.importSource);
		if (source.length === 0) {
			void vscode.window.showErrorMessage('Temco Projects: an import needs a file or a folder to read.');
			return undefined;
		}

		let outcome: ImportOutcome | undefined;
		try {
			outcome = await vscode.commands.executeCommand<ImportOutcome>('temcoDocs.import', {
				kind: values.importKind,
				source,
				destination: folder.fsPath
			});
		} catch {
			void vscode.window.showErrorMessage(
				'Temco Projects: the documentation module is not active, so nothing was imported.'
			);
			return undefined;
		}

		if (outcome === undefined || typeof outcome.error === 'string') {
			void vscode.window.showErrorMessage(
				`Temco Projects: ${outcome?.error ?? 'the import did not complete, so nothing was recorded.'}`
			);
			return undefined;
		}

		if ((outcome.pages ?? 0) > 0) {
			void vscode.window.showInformationMessage(`Temco Projects: ${outcome.pages} page(s) imported into ${folder.fsPath}.`);
		}
		return undefined;
	}
}

interface Values {
	name: string;
	version: string;
	owner: string;
	audience: string;
	origin: string;
	folder: string;
	template: string;
	importKind: string;
	importSource: string;
	sources: string[];
	targets: string[];
}

/** What `temcoDocs.import` answers: the pages it wrote, or the sentence that stopped it. */
interface ImportOutcome {
	pages?: number;
	error?: string;
}

/**
 * A path a person typed, with `~` for their home folder — the only shorthand the field takes.
 *
 * `under` is the difference between the two origins that use a path: a folder project *is* the folder it names,
 * while a template writes its tree into a folder of the project's own inside the one it names.
 */
function resolveFolder(text: string, name: string, under: boolean): vscode.Uri {
	const base = text.trim() || DEFAULTS.folder;
	const expanded = expand(base);
	const folder = under ? path.join(expanded, name.replace(/[^A-Za-z0-9]+/g, '') || 'Project') : expanded;
	return vscode.Uri.file(folder);
}

/** `~` and `~/…` as the home folder — the only shorthand either path field takes. */
function expand(text: string): string {
	const trimmed = text.trim();
	if (trimmed === '~') {
		return os.homedir();
	}
	return trimmed.startsWith('~/') || trimmed.startsWith('~\\') ? path.join(os.homedir(), trimmed.slice(2)) : trimmed;
}

async function exists(uri: vscode.Uri): Promise<boolean> {
	try {
		await vscode.workspace.fs.stat(uri);
		return true;
	} catch {
		return false;
	}
}

/**
 * Writes the starter tree a `template` project begins from — and nothing over anything.
 *
 * The shape is the one the product's own generator writes: pages under `docs/<area>/`, the registry at
 * `docs/help/registry.json`, a page id of `area/chapter/slug`. Two topics, so the tree has something in it and
 * the first edit is an edit rather than a form.
 *
 * Returns the reason it could not be written, or `undefined` when it was.
 */
async function writeTemplate(folder: vscode.Uri, name: string, template: string): Promise<string | undefined> {
	if (!TEMPLATES.some((known) => known.value === template)) {
		return `“${template}” is not a starter this build knows.`;
	}

	const files: { uri: vscode.Uri; text: string }[] = [
		{
			uri: vscode.Uri.joinPath(folder, 'docs', 'overview', 'index.md'),
			text: `# ${name}\n\nWhat this product is, in a paragraph a reader can act on.\n\n## Sections\n\n- [Getting started](getting-started.md)\n`
		},
		{
			uri: vscode.Uri.joinPath(folder, 'docs', 'overview', 'getting-started.md'),
			text: '# Getting started\n\n## Before you start\n\n## Steps\n\n## If it does not work\n'
		},
		{
			uri: vscode.Uri.joinPath(folder, 'docs', 'help', 'registry.json'),
			text: registryTemplate(name)
		}
	];

	// Refuse before writing one byte: a starter that replaces a page is a starter that loses work.
	for (const file of files) {
		if (await exists(file.uri)) {
			return `${file.uri.fsPath} already exists, so nothing was written. Choose an empty folder.`;
		}
	}

	for (const file of files) {
		await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(file.uri, '..'));
		await vscode.workspace.fs.writeFile(file.uri, Buffer.from(file.text, 'utf8'));
	}
	return undefined;
}

/** The registry a starter ships with — the generator's own shape, so its next run keeps every value. */
function registryTemplate(name: string): string {
	const registry = {
		version: 1,
		areas: {
			overview: { title: 'Overview' }
		},
		pages: {
			'overview/index': { title: name, area: 'overview', chapter: '(root)', order: 10, ship: true },
			'overview/getting-started': { title: 'Getting started', area: 'overview', chapter: '(root)', order: 20, ship: true }
		}
	};
	return `${JSON.stringify(registry, null, 2)}\n`;
}

const field = (label: string, control: string, hint?: string): string =>
	`<div class="field"><label>${esc(label)}</label>${control}${hint ? `<div class="field__hint">${esc(hint)}</div>` : ''}</div>`;

const options = (values: string[], selected: string): string =>
	values.map((value) => `<option${value === selected ? ' selected' : ''}>${esc(value)}</option>`).join('');

const checklist = (items: { value: string; label: string; sub: string }[], checked: (item: { value: string }) => boolean, fieldName: string): string =>
	`<div class="checklist">${items.map((item) => `<label class="checklist__row"><input type="checkbox" data-field="${fieldName}" data-multi value="${esc(item.value)}"${checked(item) ? ' checked' : ''}><span class="checklist__text"><span class="checklist__title">${esc(item.label)}</span><span class="checklist__sub">${esc(item.sub)}</span></span></label>`).join('')}</div>`;

const steps = ['Origin', 'Basics', 'Bring in', 'Outputs', 'Review'];

function html(sources: SourceRow[], unavailable?: string): string {
	const repositories = sources.filter((source) => source.kind === 'git');
	const files = sources.filter((source) => source.kind !== 'git');
	const repositoryRows = repositories.map((source) => ({ value: source.name, label: source.name, sub: `${source.kind} · ${source.branch ?? 'no branch'} · ${source.pages ? `${source.pages} pages` : 'not read'}` }));
	const fileRows = files.map((source) => ({ value: source.name, label: source.name, sub: source.kind }));

	const rail = steps.map((label, index) =>
		`${index > 0 ? '<span class="step__arrow" aria-hidden="true">→</span>' : ''}<button type="button" class="step${index === 0 ? ' is-active' : ''}" data-step="${index}" role="tab" aria-selected="${index === 0}"><span class="step__n">${index + 1}.</span><span class="step__label">${esc(label)}</span></button>`
	).join('');

	const empty = unavailable
		? `<div class="callout callout--warn">${icon('alert')}<div><b>The store is not available.</b> ${esc(unavailable)}</div></div>`
		: '';

	return `<div class="page-head">
	<div class="page-head__main">
		<div class="eyebrow">Documentation</div>
		<h1 class="page-head__title">${icon('plus')}New Project</h1>
		<p class="page-head__desc">A project is a version of a product’s documentation: the sources it reads, the pages it holds and the artifacts it builds.</p>
	</div>
	<div class="page-head__actions"><button type="button" class="btn btn--ghost" id="wizard-cancel">${icon('close')}<span>Cancel</span></button></div>
</div>

${empty}

<div class="wizard">
	<div class="wizard__steps" role="tablist">${rail}</div>
	<div class="wizard__body">
		<div data-step-body="0">
			<div class="wizard__title">Where the project begins</div>
			<p class="wizard__hint">This decides what the next question is, not just what the project is called.</p>
			<div class="checklist">
				${ORIGINS.map((origin) => `<label class="checklist__row"><input type="radio" name="origin" data-field="origin" value="${esc(origin.value)}"${origin.available ? (origin.value === 'blank' ? ' checked' : '') : ' disabled'}><span class="checklist__text"><span class="checklist__title">${esc(origin.label)}${origin.available ? '' : ' — not built yet'}</span><span class="checklist__sub">${esc(origin.sub)}</span></span></label>`).join('')}
			</div>
		</div>
		<div data-step-body="1" hidden>
			<div class="wizard__title">Name, version and owner</div>
			<p class="wizard__hint">The name, the version, and who answers for the result.</p>
			<div class="form">
				${field('Name', `<input class="input" data-field="name" value="${esc(DEFAULTS.name)}" aria-label="Project name">`)}
				${field('Version', `<input class="input" data-field="version" value="${esc(DEFAULTS.version)}" aria-label="Version">`, 'A project publishes one version at a time.')}
				${field('Owner', `<select class="select" data-field="owner" aria-label="Owner">${options(['Derek', 'Mei', 'Ana', 'Unassigned'], DEFAULTS.owner)}</select>`)}
				${field('Audience', `<input class="input" data-field="audience" value="${esc(DEFAULTS.audience)}" aria-label="Audience">`)}
			</div>
		</div>
		<div data-step-body="2" hidden>
			<div class="wizard__title">What it brings in</div>
			<div data-bring="blank">
				<p class="wizard__hint">Nothing. The project starts with no pages, and the first one is written from the workspace.</p>
			</div>
			<div data-bring="repository" hidden>
				<p class="wizard__hint">Search the repositories, or choose individual files and folders. Both record the pages they declare.</p>
				<div class="checklist-group">
					<div class="checklist-heading">Repositories<span class="checklist-heading__count">${repositories.length}</span></div>
					<div class="checklist-tools"><input class="input input--sm" data-filter="repos" placeholder="Search repositories" aria-label="Search repositories"><button type="button" class="btn btn--sm btn--ghost" id="clone-source">${icon('repo')}<span>Clone a source…</span></button><button type="button" class="btn btn--sm btn--ghost" id="load-all">${icon('download')}<span>Load all</span></button></div>
					<div data-filter-list="repos">${checklist(repositoryRows, () => false, 'sources')}</div>
				</div>
				<div class="checklist-group" data-role="files">
					<div class="checklist-heading">Files and folders<span class="checklist-heading__count">${files.length}</span></div>
					<details class="disclosure"><summary>Choose files and folders…<span class="cell-muted" id="file-count">0 of ${files.length} selected</span></summary>${checklist(fileRows, () => false, 'sources')}</details>
				</div>
				<p class="wizard__hint" style="margin-top:12px"><span id="source-count">0</span> of ${sources.length} selected</p>
			</div>
			<div data-bring="folder" hidden>
				<p class="wizard__hint">The folder is recorded as a source; its pages are read from <code>docs/help/registry.json</code>.</p>
				<div class="form">
					${field('Folder on this machine', `<input class="input" data-field="folder" value="${esc(DEFAULTS.folder)}" aria-label="Folder">`, 'A path; ~ is your home folder.')}
				</div>
			</div>
			<div data-bring="template" hidden>
				<p class="wizard__hint">A starter tree is written where you point. Nothing that already exists is replaced.</p>
				<div class="form">
					${field('Starter', `<select class="select" data-field="template" aria-label="Starter">${TEMPLATES.map((template) => `<option value="${esc(template.value)}">${esc(template.label)} — ${esc(template.sub)}</option>`).join('')}</select>`)}
					${field('Write it under', `<input class="input" data-field="folder" value="${esc(DEFAULTS.folder)}" aria-label="Folder">`, 'A path; ~ is your home folder. The project name becomes the folder under it.')}
				</div>
			</div>
			<div data-bring="import" hidden>
				<p class="wizard__hint">The material is converted into <code>docs/</code> and <code>docs/help/registry.json</code>. Nothing is overwritten — a folder that already has a registry is refused.</p>
				<div class="form">
					${field('Material', `<select class="select" data-field="importKind" aria-label="Material">${IMPORT_KINDS.map((kind) => `<option value="${esc(kind.value)}">${esc(kind.label)} — ${esc(kind.sub)}</option>`).join('')}</select>`)}
					${field('Where it is', `<input class="input" data-field="importSource" placeholder="C:\\docs\\manual or ~/Downloads/help.chm" aria-label="Source">`, 'A file or a folder; ~ is your home folder.')}
					${field('Write the project into', `<input class="input" data-field="folder" value="${esc(DEFAULTS.folder)}" aria-label="Folder">`, 'A path; ~ is your home folder. The project name becomes the folder under it.')}
				</div>
			</div>
		</div>
		<div data-step-body="3" hidden>
			<div class="wizard__title">What it builds</div>
			<p class="wizard__hint">One build produces every target you tick here.</p>
			${checklist(TARGETS, (item) => DEFAULT_TARGETS.includes(item.value), 'targets')}
		</div>
		<div data-step-body="4" hidden>
			<div class="wizard__title">Check before creating</div>
			<p class="wizard__hint">Nothing has been written yet.</p>
			<dl class="kv" id="review"></dl>
			<div class="mt-16"><div class="callout">${icon('info')}<div>The project is recorded in the platform database under <code>temcoStore</code>. A template writes its files where the step above points; nothing is written into an existing repository, and the first build is yours to start.</div></div></div>
		</div>
		<div class="wizard__error" id="wizard-error" hidden></div>
	</div>
	<div class="wizard__foot">
		<span class="cell-muted" style="font-size:12px" id="wizard-count">Step 1 of 5</span>
		<span class="wizard__spacer"></span>
		<button type="button" class="btn" id="wizard-back" hidden>${icon('chevron-left')}<span>Back</span></button>
		<button type="button" class="btn btn--primary" id="wizard-next"><span>Next</span></button>
		<button type="button" class="btn btn--primary" id="wizard-finish" hidden>${icon('check')}<span>Create Project</span></button>
	</div>
</div>`;
}

/** The wizard's behaviour: five steps, the one rule the middle step has per origin, and one message at the end. */
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
	const review = document.getElementById('review');
	let at = 0;

	function field(name) {
		return document.querySelector('[data-field="' + name + '"]');
	}
	function checked(name) {
		return Array.prototype.slice.call(document.querySelectorAll('[data-field="' + name + '"]:checked')).map(function (input) { return input.value; });
	}
	function origin() {
		const chosen = document.querySelector('[data-field="origin"]:checked');
		return chosen ? chosen.value : 'blank';
	}
	function originLabel() {
		const chosen = document.querySelector('[data-field="origin"]:checked');
		const title = chosen && chosen.parentElement ? chosen.parentElement.querySelector('.checklist__title') : null;
		return title ? title.textContent : 'Start empty';
	}
	function bringField(name) {
		return document.querySelector('[data-bring="' + origin() + '"] [data-field="' + name + '"]');
	}
	function values() {
		const folder = bringField('folder');
		const template = bringField('template');
		const importKind = bringField('importKind');
		const importSource = bringField('importSource');
		return {
			name: field('name').value,
			version: field('version').value,
			owner: field('owner').value,
			audience: field('audience').value,
			origin: origin(),
			folder: folder ? folder.value : '',
			template: template ? template.value : '',
			importKind: importKind ? importKind.value : '',
			importSource: importSource ? importSource.value : '',
			sources: checked('sources'),
			targets: checked('targets')
		};
	}
	function counts() {
		const total = document.querySelectorAll('[data-bring="repository"] [data-field="sources"]').length;
		const chosen = checked('sources').length;
		const sourceCount = document.getElementById('source-count');
		if (sourceCount) { sourceCount.textContent = String(chosen); }
		const files = Array.prototype.slice.call(document.querySelectorAll('[data-role="files"] [data-field="sources"]'));
		const filesChosen = files.filter(function (input) { return input.checked; }).length;
		const fileCount = document.getElementById('file-count');
		if (fileCount) { fileCount.textContent = filesChosen + ' of ' + files.length + ' selected'; }
		return { total: total, chosen: chosen };
	}
	function fail(message) {
		error.textContent = message;
		error.hidden = false;
	}
	function show() {
		steps.forEach(function (step, index) {
			step.classList.toggle('is-active', index === at);
			step.classList.toggle('is-done', index < at);
			step.setAttribute('aria-selected', String(index === at));
		});
		bodies.forEach(function (body, index) { body.hidden = index !== at; });
		// The third step is whichever answer the origin gives: the four blocks are one question.
		const chosenOrigin = origin();
		Array.prototype.forEach.call(document.querySelectorAll('[data-bring]'), function (block) {
			block.hidden = block.getAttribute('data-bring') !== chosenOrigin;
		});
		count.textContent = 'Step ' + (at + 1) + ' of ' + bodies.length;
		back.hidden = at === 0;
		next.hidden = at === bodies.length - 1;
		finish.hidden = at !== bodies.length - 1;
		if (at === bodies.length - 1) {
			const v = values();
			const rows = [
				['Origin', originLabel()],
				['Name', '<span class="cell-strong">' + v.name + '</span>'],
				['Version', '<span class="cell-mono">' + v.version + '</span>'],
				['Owner', v.owner],
				['Audience', v.audience]
			];
			if (v.origin === 'repository') {
				rows.push(['Sources', v.sources.length + ' — ' + (v.sources.join(', ') || 'none')]);
			} else if (v.origin === 'folder' || v.origin === 'template' || v.origin === 'import') {
				rows.push(['Folder', '<span class="cell-mono">' + v.folder + '</span>']);
			}
			if (v.origin === 'template') {
				rows.push(['Starter', v.template]);
			}
			if (v.origin === 'import') {
				rows.push(['Material', v.importKind]);
				rows.push(['Read from', '<span class="cell-mono">' + v.importSource + '</span>']);
			}
			rows.push(['Outputs', v.targets.join(', ') || 'none']);
			review.innerHTML = rows.map(function (pair) { return '<dt>' + pair[0] + '</dt><dd>' + pair[1] + '</dd>'; }).join('');
		}
	}
	function go(to) {
		error.hidden = true;
		at = to;
		show();
		counts();
	}
	/** The one rule the middle step has, per origin: a repository project needs a source, a path project its path. */
	function middleStepSays(v) {
		if (v.origin === 'repository' && v.sources.length === 0) { return 'Choose at least one source to read.'; }
		if ((v.origin === 'folder' || v.origin === 'template' || v.origin === 'import') && !v.folder.trim()) { return 'Name a folder on this machine.'; }
		if (v.origin === 'import' && !v.importSource.trim()) { return 'Say where the material is.'; }
		return '';
	}

	steps.forEach(function (step) { step.addEventListener('click', function () { go(Number(step.dataset.step)); }); });
	back.addEventListener('click', function () { go(Math.max(0, at - 1)); });
	Array.prototype.forEach.call(document.querySelectorAll('[data-field="origin"]'), function (radio) {
		radio.addEventListener('change', function () { error.hidden = true; show(); });
	});
	next.addEventListener('click', function () {
		const v = values();
		if (at === 1 && !v.name.trim()) { fail('A project needs a name.'); return; }
		if (at === 2) { const reason = middleStepSays(v); if (reason) { fail(reason); return; } }
		if (at === 3 && v.targets.length === 0) { fail('Choose at least one output to build.'); return; }
		go(at + 1);
	});
	finish.addEventListener('click', function () {
		const v = values();
		if (!v.name.trim()) { go(1); fail('A project needs a name.'); return; }
		const reason = middleStepSays(v);
		if (reason) { go(2); fail(reason); return; }
		if (v.targets.length === 0) { go(3); fail('Choose at least one output to build.'); return; }
		api.postMessage({ type: 'create', values: v });
	});
	document.getElementById('wizard-cancel').addEventListener('click', function () { api.postMessage({ type: 'cancel' }); });
	const filter = document.querySelector('[data-filter="repos"]');
	if (filter) {
		filter.addEventListener('input', function () {
			const term = filter.value.toLowerCase();
			Array.prototype.forEach.call(document.querySelectorAll('[data-filter-list="repos"] .checklist__row'), function (row) {
				row.hidden = term.length > 0 && row.textContent.toLowerCase().indexOf(term) < 0;
			});
		});
	}
	const loadAll = document.getElementById('load-all');
	if (loadAll) {
		loadAll.addEventListener('click', function () {
			Array.prototype.forEach.call(document.querySelectorAll('[data-filter-list="repos"] [data-field="sources"]'), function (input) { input.checked = true; });
			counts();
		});
	}
	// Cloning lives where sources live: this opens that page rather than growing a second clone form here.
	const clone = document.getElementById('clone-source');
	if (clone) {
		clone.addEventListener('click', function () { api.postMessage({ type: 'command', command: 'temcoRepositories.page' }); });
	}
	document.addEventListener('change', function (event) {
		if (event.target && event.target.getAttribute && event.target.getAttribute('data-field')) { counts(); }
	});
	show();
	counts();
})();
`;
