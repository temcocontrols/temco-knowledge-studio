// New Project — two screens, and one question each.
//
// **The first screen is the choice**: three cards — Empty project, From a repository, From existing files. There is
// no step rail and no Next/Back across five screens; a person picks the kind of project, and the second screen is a
// single form whose middle section is what that kind needs. Everything else on it — name, version, owner, audience,
// outputs — is the same for all three.
//
// The card is not a label: it decides which origin `create()` receives. Empty plus a starter is a `template`, a
// folder that already has a registry is a `folder`, anything else under *existing files* is an `import`. That
// derivation is in the page's own script, so the host keeps the one code path it had.//
// The form asks for two things and shows them as tiles: a name with a version, and which outputs to build. Owner and
// audience were asked here for a while and removed — a field nobody must answer is a field that stops the flow for
// everyone, and both are editable later on the page that owns a project.//
// Nothing is written until *Create Project*: the flow is markup and a small script, and every write happens
// in `create()` — the project, its sources, its outputs, and for a template its files.

import * as vscode from 'vscode';
import * as os from 'node:os';
import * as path from 'node:path';
import { Catalog, CatalogUnavailable, Selection, slugOf, SourceRow } from './store';
import { escapeHtml as esc, icon, page, pageColumn } from './ui';

export const NEW_PROJECT_VIEW_TYPE = 'temcoProjects.newProject';

/** What the flow offers when it opens. The mock's defaults, over whatever sources the catalog has. */
const DEFAULTS = { name: 'T3000 Documentation', version: '13.0', folder: '~/Temco' };

/** What a project can build. One build produces every one of them, so they are ticks, not a choice. */
const TARGETS = [
	{ value: 'website', label: 'Website', sub: 'Static pages for Temco Learn', mark: 'globe' },
	{ value: 'pdf', label: 'PDF', sub: 'One document, printed layout', mark: 'document' },
	{ value: 'help', label: 'Offline help', sub: 'CHM · needs the help compiler', mark: 'book' },
	{ value: 'search', label: 'Search index', sub: 'lunr index for the site', mark: 'search' },
	{ value: 'ai', label: 'AI index', sub: 'Embeddings, kept on this machine only', mark: 'sparkle' }
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

		const body = html(this.sources, unavailable, this.context.workspaceState.get<Draft>(DRAFT_KEY));
		if (this.panel) {
			this.panel.reveal(pageColumn());
			this.panel.webview.html = page(body, { title: 'New Project', script: WIZARD_SCRIPT });
			return;
		}

		this.panel = vscode.window.createWebviewPanel(NEW_PROJECT_VIEW_TYPE, 'New Project', pageColumn(), {
			enableScripts: true,
			localResourceRoots: []
		});
		this.panel.webview.onDidReceiveMessage((message: { type?: string; command?: string; values?: Values; draft?: Draft }) => void this.receive(message));
		this.panel.webview.html = page(body, { title: 'New Project', script: WIZARD_SCRIPT });
		this.panel.onDidDispose(() => {
			this.panel = undefined;
		});
	}

	dispose(): void {
		this.panel?.dispose();
	}

	/**
	 * The one question *from existing files* asks: which folder or file.
	 *
	 * The kind is worked out here rather than asked of the person: they know where their material is, and they should not
	 * have to know which converter the platform will reach for. The answer goes back to the page as `{ path, kind, note }`,
	 * and the page derives the origin from `kind` exactly as it did when the kind was a dropdown.
	 */
	private async pickMaterial(): Promise<void> {
		const picked = await vscode.window.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: 'Use this',
			title: 'Choose the material to bring in'
		});
		const uri = picked?.[0];
		if (uri === undefined) {
			return;
		}
		await this.panel?.webview.postMessage({ type: 'picked', ...(await describeMaterial(uri)) });
	}

	private async receive(message: { type?: string; command?: string; values?: Values; draft?: Draft }): Promise<void> {
		if (message.type === 'cancel') {
			this.panel?.dispose();
			return;
		}
		if (message.type === 'pick') {
			await this.pickMaterial();
			return;
		}
		if (message.type === 'command' && typeof message.command === 'string') {
			// Leaving for another page disposes this tab, so what the form holds is written down first.
			if (message.draft !== undefined) {
				await this.context.workspaceState.update(DRAFT_KEY, message.draft);
			}
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
					const outcome = await writeTemplate(this.context.extensionUri, folder, name, values.version.trim() || '0.1.0', values.template);
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
		await this.context.workspaceState.update(DRAFT_KEY, undefined);
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
 * What a picked folder or file is, in the importer's own vocabulary.
 *
 * A folder with a registry is cited as it stands; a folder of Markdown or HTML is a conversion; a file is whatever its
 * extension says. The count is bounded, because this runs to fill in one line of a page and a person may well point it
 * at a whole drive by accident.
 */
async function describeMaterial(uri: vscode.Uri): Promise<{ path: string; kind: string; note: string }> {
	const at = uri.fsPath;
	let stat: vscode.FileStat;
	try {
		stat = await vscode.workspace.fs.stat(uri);
	} catch {
		return { path: at, kind: '', note: 'That path cannot be read.' };
	}

	if ((stat.type & vscode.FileType.Directory) !== 0) {
		const registered = await exists(vscode.Uri.joinPath(uri, 'docs', 'help', 'registry.json'))
			|| await exists(vscode.Uri.joinPath(uri, 'docs', 'registry.json'))
			|| await exists(vscode.Uri.joinPath(uri, 'registry.json'));
		if (registered) {
			return { path: at, kind: 'existing', note: 'A docs folder that already has a registry — its pages are cited as they stand.' };
		}
		const counts = await countDocuments(uri);
		if (counts.markdown > 0) {
			return { path: at, kind: 'markdown', note: `A Markdown folder — ${counts.markdown} ${counts.markdown === 1 ? 'file' : 'files'} to convert.` };
		}
		if (counts.html > 0) {
			return { path: at, kind: 'html', note: `An HTML folder — ${counts.html} ${counts.html === 1 ? 'file' : 'files'} to convert.` };
		}
		return { path: at, kind: '', note: 'That folder holds neither a registry nor Markdown or HTML files.' };
	}

	const name = at.toLowerCase();
	if (name.endsWith('.chm')) {
		return { path: at, kind: 'chm', note: 'A compiled help file — decompiled with hh.exe, then converted.' };
	}
	if (name.endsWith('.docx') || name.endsWith('.doc') || name.endsWith('.rtf') || name.endsWith('.odt')) {
		return { path: at, kind: 'word', note: 'A Word document — converted with pandoc.' };
	}
	if (name.endsWith('.md') || name.endsWith('.markdown')) {
		return { path: at, kind: 'markdown', note: 'A Markdown file — brought in as pages.' };
	}
	if (name.endsWith('.html') || name.endsWith('.htm')) {
		return { path: at, kind: 'html', note: 'An HTML page — brought in as pages.' };
	}
	return { path: at, kind: '', note: 'That file is not a document this build can read.' };
}

/** Markdown and HTML files under a folder, counted to a budget rather than to the end of the drive. */
async function countDocuments(folder: vscode.Uri): Promise<{ markdown: number; html: number }> {
	const counts = { markdown: 0, html: 0 };
	let budget = 2000;

	const walk = async (dir: vscode.Uri): Promise<void> => {
		if (budget <= 0) {
			return;
		}
		let entries: [string, vscode.FileType][];
		try {
			entries = await vscode.workspace.fs.readDirectory(dir);
		} catch {
			return;
		}
		for (const [name, type] of entries) {
			if (budget <= 0) {
				return;
			}
			budget--;
			if ((type & vscode.FileType.Directory) !== 0) {
				await walk(vscode.Uri.joinPath(dir, name));
				continue;
			}
			const lower = name.toLowerCase();
			if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
				counts.markdown++;
			} else if (lower.endsWith('.html') || lower.endsWith('.htm')) {
				counts.html++;
			}
		}
	};

	await walk(folder);
	return counts;
}

/**
 * Writes the starter tree a `template` project begins from — and nothing over anything.
 *
 * The files are the extension's own assets under `templates/<id>/`, copied rather than written from strings, so the
 * starter is readable and reviewable like any other source. Two of them are what make the project *finished* rather
 * than merely started: `scripts/docs-registry.mjs` (the generator the repository would otherwise have to bring, which
 * is what turns a new page into a page) and `scripts/docs-site.mjs` (the site build the Build Center invokes). Without
 * them a project made in this window could not index its own page or build its own site.
 *
 * `*.mjs.txt` assets are copied to `*.mjs`: the repository's hygiene rule forbids committing JavaScript, and a starter's
 * copy is JavaScript only once it is a project's own file.
 *
 * Returns the reason it could not be written, or `undefined` when it was.
 */
async function writeTemplate(
	extensionUri: vscode.Uri,
	folder: vscode.Uri,
	name: string,
	version: string,
	template: string
): Promise<string | undefined> {
	if (!TEMPLATES.some((known) => known.value === template)) {
		return `“${template}” is not a starter this build knows.`;
	}

	const files = TEMPLATE_FILES.map((relative) => ({
		source: vscode.Uri.joinPath(extensionUri, 'templates', template, ...relative.split('/')),
		target: vscode.Uri.joinPath(folder, ...relative.replace(/\.txt$/, '').split('/'))
	}));

	// Refuse before writing one byte: a starter that replaces a page is a starter that loses work.
	for (const file of files) {
		if (await exists(file.target)) {
			return `${file.target.fsPath} already exists, so nothing was written. Choose an empty folder.`;
		}
	}

	for (const file of files) {
		const text = Buffer.from(await vscode.workspace.fs.readFile(file.source))
			.toString('utf8')
			.replace(/\{\{name\}\}/g, name)
			.replace(/\{\{version\}\}/g, version);
		await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(file.target, '..'));
		await vscode.workspace.fs.writeFile(file.target, Buffer.from(text, 'utf8'));
	}
	return undefined;
}

/**
 * The files a starter is made of, relative to `templates/<id>/`.
 *
 * Everything a project needs to be self-sufficient: the pages, the registry, the generator that keeps the registry
 * in step with the pages, and the site build.
 */
const TEMPLATE_FILES = [
	'package.json',
	'docs/help/registry.json',
	'docs/overview/index.md',
	'docs/overview/getting-started.md',
	'scripts/docs-registry.mjs.txt',
	'scripts/docs-site.mjs.txt'
];

const field = (label: string, control: string, hint?: string): string =>
	`<div class="field"><label>${esc(label)}</label>${control}${hint ? `<div class="field__hint">${esc(hint)}</div>` : ''}</div>`;

/**
 * One source, as a row you tick.
 *
 * Every row answers the same three things in the same order — what kind of source it is, which branch it is on, and
 * how many pages it has already given up — so two sources can be compared without opening either. "Not read yet" is
 * stated rather than hidden: ticking it is allowed, and the project will simply start with none of its pages.
 */
const sourceRow = (source: SourceRow, selected: readonly string[]): string => {
	const kind = source.kind === 'git' ? 'repository' : source.kind === 'folder' ? 'folder' : source.kind;
	const pages = source.pages === undefined || source.pages === 0
		? 'not read yet'
		: `${source.pages} ${source.pages === 1 ? 'page' : 'pages'}`;
	const facts = [kind];
	if (source.branch !== undefined) {
		facts.push(source.branch);
	}
	facts.push(pages);
	if (source.state !== undefined) {
		facts.push(source.state);
	}
	const ticked = selected.includes(source.name) ? ' checked' : '';
	return `<label class="checklist__row" data-source data-kind="${source.kind === 'git' ? 'git' : 'other'}" data-pages="${source.pages ?? 0}"><input type="checkbox" data-field="sources" value="${esc(source.name)}"${ticked}><span class="checklist__text"><span class="checklist__title">${esc(source.name)}</span><span class="checklist__sub">${facts.map((fact) => esc(fact)).join(' · ')}</span></span></label>`;
};

/**
 * The outputs, as compact ticks.
 *
 * A column of five ticks has to be read line by line to learn which are on; a tile carries its own state in its
 * border, its wash and a check, so "what does this project build?" is answered by a glance. Each one stays a single
 * line high — these are switches, not panels. The input stays a real checkbox, hidden but focusable, so a click, a tap
 * and the space bar all do the same thing and a screen reader still announces a check box.
 */
const tiles = (items: { value: string; label: string; sub: string; mark: string }[], ticked: readonly string[]): string =>
	`<div class="out-grid">${items.map((item) => `<label class="out-tile"><input type="checkbox" data-field="targets" data-multi value="${esc(item.value)}"${ticked.includes(item.value) ? ' checked' : ''}><span class="out-tile__mark">${icon(item.mark)}</span><span class="out-tile__text"><span class="out-tile__label">${esc(item.label)}</span><span class="out-tile__note">${esc(item.sub)}</span></span><span class="out-tile__check">${icon('check', 'icon--sm')}</span></label>`).join('')}</div>`;

/**
 * The three starting points, as a side rail against the form.
 *
 * This is the master/detail shape a settings surface has in Fluent and in Material: the choice is a narrow rail on the
 * left that stays put, and the right side is the thing itself — no second screen, no step rail, and no box drawn round
 * each choice. The rail also shows every type's one-line identity at once, so a person can compare without going back.
 */
function typeOptions(initial: string): string {
	const options = [
		{ value: 'empty', mark: 'document', label: 'Empty project', note: 'No sources, no pages yet' },
		{ value: 'source', mark: 'repo', label: 'From a source', note: 'Cite sources already recorded' },
		{ value: 'files', mark: 'layers', label: 'From existing files', note: 'HTML, Markdown, Word or CHM' }
	];

	return `<div class="opt-list" role="listbox" aria-label="Starting point">${options.map((option) => {
		const on = option.value === initial;
		return `<button type="button" class="opt${on ? ' is-on' : ''}" role="option" aria-selected="${on}" data-type="${option.value}" data-title="${esc(option.label)}">
	<span class="opt__mark">${icon(option.mark)}</span>
	<span class="opt__text"><span class="opt__title">${esc(option.label)}</span><span class="opt__desc">${esc(option.note)}</span></span>
</button>`;
	}).join('')}</div>`;
}

/**
 * What the form remembers when a person leaves it for another page.
 *
 * The link to the Sources page has to be a link — adding and reading sources is that page's job — but leaving would
 * otherwise throw away a half-filled form, because a page replaces the tab it is in. So the values the form holds are
 * written to the workspace's own storage before the jump and read back when the flow opens again.
 */
interface Draft {
	type?: string;
	name?: string;
	version?: string;
	sources?: string[];
	targets?: string[];
}

const DRAFT_KEY = 'temcoProjects.newProject.draft';

function html(sources: SourceRow[], unavailable?: string, draft?: Draft): string {
	const repositories = sources.filter((source) => source.kind === 'git');
	const files = sources.filter((source) => source.kind !== 'git');
	const initial = draft?.type ?? 'empty';
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

<div class="split" data-initial-type="${esc(initial)}">
	<div class="split__side">
		<div class="split__label">Start from</div>
		${typeOptions(initial)}
	</div>

	<div class="split__main">
		<div class="split__title" id="form-title">Empty project</div>
		<p class="split__hint" id="form-hint"></p>

		<div class="split__section">
			<div class="split__section-title">The project</div>
			<p class="split__section-note">What it is called, and who answers for it.</p>
			<div class="form">
				${field('Name', `<input class="input" data-field="name" value="${esc(draft?.name ?? DEFAULTS.name)}" aria-label="Project name">`)}
				${field('Version', `<input class="input" data-field="version" value="${esc(draft?.version ?? DEFAULTS.version)}" aria-label="Version">`, 'A project publishes one version at a time.')}
			</div>
		</div>

		<div class="split__section" data-form="empty">
			<div class="split__section-title">Where the pages come from</div>
			<p class="split__section-note">An empty project has no sources at all. A starter writes the first ones — an overview area, two topics, and the registry the platform reads.</p>
			<div class="form">
				${field('Starter', `<select class="select" data-field="template" aria-label="Starter"><option value="">Nothing — begin with no pages</option>${TEMPLATES.map((template) => `<option value="${esc(template.value)}">${esc(template.label)} — ${esc(template.sub)}</option>`).join('')}</select>`)}
			</div>
			<div class="form" data-starter-folder hidden>
				${field('Write it under', `<input class="input" data-field="folder" value="${esc(DEFAULTS.folder)}" aria-label="Folder">`, 'A path; ~ is your home folder. The project name becomes the folder under it.')}
			</div>
		</div>

		<div class="split__section" data-form="source" hidden>
			<div class="split__section-title">Where the pages come from</div>
			<p class="split__section-note">Every source the platform has recorded, in one list. A project cites what it ticks; nothing is written into any of them.</p>
			<p class="split__section-note"><button type="button" class="link" id="open-sources">Add or read a source on the Sources page</button> — what you have typed here is kept while you are there.</p>
			<div class="checklist-tools">
				<input class="input input--sm" data-filter="sources" placeholder="Search sources" aria-label="Search sources">
				<span class="src-chips">
					<button type="button" class="src-chip is-on" data-kind="all">All<span>${sources.length}</span></button>
					<button type="button" class="src-chip" data-kind="git">Repositories<span>${repositories.length}</span></button>
					<button type="button" class="src-chip" data-kind="other">Files &amp; folders<span>${files.length}</span></button>
				</span>
			</div>
			${sources.length === 0
			? `<div class="callout">${icon('info')}<div><b>No source is recorded yet.</b> Create the project now, then add a source from <b>Sources</b>; this project can cite it as soon as it is there.</div></div>`
			: `<div class="checklist src-list" data-source-list>${sources.map((source) => sourceRow(source, draft?.sources ?? [])).join('')}</div>
		<p class="split__section-note" id="source-empty" hidden>No source matches that.</p>
		<p class="split__section-note" style="margin-top:10px"><span id="source-summary">No source selected</span><button type="button" class="link" id="source-clear">Clear</button></p>`}
		</div>

		<div class="split__section" data-form="files" hidden>
			<div class="split__section-title">What the material is</div>
			<p class="split__section-note">Choose the folder or file. What it is — a docs folder, Markdown, HTML, Word or CHM — is read from what you pick, so there is nothing to classify by hand. A folder that already has a registry is cited as it stands; anything else is converted once into <code>docs/</code> and <code>docs/help/registry.json</code>.</p>
			<div class="pick-row">
				<button type="button" class="btn" id="pick-material">${icon('folder')}<span>Choose a folder or file…</span></button>
				<span class="pick-row__path" id="material-path">Nothing chosen yet</span>
			</div>
			<p class="split__section-note" id="material-note" style="margin-top:8px"></p>
		</div>

		<div class="split__section">
			<div class="split__section-title">What it builds</div>
			<p class="split__section-note">One build produces every target you tick here — and every one of them can be turned on later in the Build Center.</p>
			${tiles(TARGETS, draft?.targets ?? DEFAULT_TARGETS)}
		</div>

		<div class="wizard__error" id="wizard-error" hidden></div>

		<div class="wizard__foot">
			<span class="cell-muted" style="font-size:12px" id="wizard-summary"></span>
			<span class="wizard__spacer"></span>
			<button type="button" class="btn btn--primary" id="wizard-create">${icon('check')}<span>Create Project</span></button>
		</div>
	</div>
</div>`;
}

/**
 * The flow's behaviour: one screen, a rail of three starting points, and a form that follows the rail.
 *
 * The origin the host receives is derived here — `empty` plus a starter is a `template`, a folder that already has a
 * registry is a `folder`, anything else under *existing files* is an `import` — so `create()` keeps its one code path.
 */
const WIZARD_SCRIPT = `
(function () {
	const api = acquireVsCodeApi();
	const error = document.getElementById('wizard-error');
	const summary = document.getElementById('wizard-summary');
	const titleEl = document.getElementById('form-title');
	const hintEl = document.getElementById('form-hint');
	const rails = Array.prototype.slice.call(document.querySelectorAll('.opt'));
	const split = document.querySelector('.split');
	let type = split ? split.getAttribute('data-initial-type') || 'empty' : 'empty';
	// A draft written by an older build can name a type this build no longer has; the rail is the truth.
	const known = rails.some(function (rail) { return rail.getAttribute('data-type') === type; });
	if (!known) { type = 'empty'; }

	const HINTS = {
		empty: 'Nothing is read and nothing is converted: the project exists, and the first page is yours to write.',
		source: 'Pages come from the sources you tick. Reading a source records its pages and changes nothing in it.',
		files: 'The material is converted once; from then on it is written as pages like any other project.'
	};

	function visible(name) {
		const all = Array.prototype.slice.call(document.querySelectorAll('[data-field="' + name + '"]'));
		for (let i = 0; i < all.length; i++) {
			if (all[i].offsetParent !== null) { return all[i]; }
		}
		return null;
	}
	function value(name) {
		const el = visible(name);
		return el ? el.value : '';
	}
	function checked(name) {
		// Not filtered by visibility: a tick inside the closed *files and folders* disclosure is still a tick.
		return Array.prototype.slice.call(document.querySelectorAll('[data-field="' + name + '"]:checked'))
			.map(function (input) { return input.value; });
	}
	function material() {
		const section = document.querySelector('[data-form="files"]');
		return section ? section.getAttribute('data-kind') || 'existing' : 'existing';
	}
	function picked() {
		const section = document.querySelector('[data-form="files"]');
		return section ? section.getAttribute('data-path') || '' : '';
	}
	function origin() {
		if (type === 'empty') { return value('template') ? 'template' : 'blank'; }
		if (type === 'source') { return 'repository'; }
		return material() === 'existing' ? 'folder' : 'import';
	}
	function values() {
		const v = {
			name: value('name'),
			version: value('version'),
			origin: origin(),
			folder: '',
			template: '',
			importKind: '',
			importSource: '',
			sources: [],
			targets: checked('targets')
		};
		if (v.origin === 'template') { v.template = value('template'); v.folder = value('folder'); }
		if (v.origin === 'folder') { v.folder = picked(); v.importSource = picked(); }
		if (v.origin === 'import') { v.importKind = material(); v.importSource = picked(); }
		if (v.origin === 'repository') { v.sources = checked('sources'); }
		return v;
	}
	function sourceRows() {
		return Array.prototype.slice.call(document.querySelectorAll('[data-source]'));
	}
	/** What is ticked, as a sentence: the count, and how many pages those sources actually bring. */
	function counts() {
		const list = document.getElementById('source-summary');
		if (!list) { return; }
		const rows = sourceRows().filter(function (row) { return row.querySelector('input').checked; });
		if (rows.length === 0) {
			list.textContent = 'No source selected — a project from a source needs at least one.';
			return;
		}
		const pages = rows.reduce(function (total, row) { return total + Number(row.getAttribute('data-pages') || 0); }, 0);
		list.textContent = rows.length + (rows.length === 1 ? ' source' : ' sources') + ' · ' + pages + (pages === 1 ? ' page' : ' pages') + ' from them';
	}
	let kind = 'all';
	/** One filter for both controls: the search text and the kind chip narrow the same list. */
	function applyFilter() {
		const search = document.querySelector('[data-filter="sources"]');
		const term = search ? search.value.trim().toLowerCase() : '';
		let shown = 0;
		sourceRows().forEach(function (row) {
			const matchesKind = kind === 'all' || row.getAttribute('data-kind') === kind;
			const matchesTerm = term.length === 0 || row.textContent.toLowerCase().indexOf(term) >= 0;
			row.hidden = !(matchesKind && matchesTerm);
			if (!row.hidden) { shown++; }
		});
		const empty = document.getElementById('source-empty');
		if (empty) { empty.hidden = shown > 0; }
	}
	function refresh() {
		counts();
		if (!summary) { return; }
		const v = values();
		const parts = [type === 'source' ? 'From a source' : type === 'files' ? 'From existing files' : 'Empty project'];
		if (v.origin === 'template') { parts.push('user-guide starter'); }
		if (v.origin === 'repository') { parts.push(v.sources.length + (v.sources.length === 1 ? ' source' : ' sources')); }
		if (v.origin === 'folder') { parts.push('a folder with a registry'); }
		if (v.origin === 'import') { parts.push((v.importKind || 'material') + ' import'); }
		parts.push(v.targets.length + (v.targets.length === 1 ? ' output' : ' outputs'));
		summary.textContent = parts.join(' · ');
	}
	function fail(message) {
		error.textContent = message;
		error.hidden = false;
	}
	function show() {
		Array.prototype.forEach.call(document.querySelectorAll('[data-form]'), function (block) {
			block.hidden = block.getAttribute('data-form') !== type;
		});
		rails.forEach(function (rail) {
			const on = rail.getAttribute('data-type') === type;
			rail.classList.toggle('is-on', on);
			rail.setAttribute('aria-selected', String(on));
		});
		const starter = document.querySelector('[data-starter-folder]');
		if (starter) { starter.hidden = !value('template'); }
		const rail = document.querySelector('.opt[data-type="' + type + '"]');
		titleEl.textContent = rail ? rail.getAttribute('data-title') : 'The project';
		hintEl.textContent = HINTS[type] || '';
		refresh();
	}

	rails.forEach(function (rail) {
		rail.addEventListener('click', function () {
			type = rail.getAttribute('data-type');
			error.hidden = true;
			show();
		});
	});
	document.getElementById('wizard-cancel').addEventListener('click', function () { api.postMessage({ type: 'cancel' }); });

	const template = document.querySelector('[data-field="template"]');
	if (template) { template.addEventListener('change', show); }

	// The picker opens in the host — a webview cannot show a file dialog — and answers with what it read.
	const pick = document.getElementById('pick-material');
	if (pick) { pick.addEventListener('click', function () { api.postMessage({ type: 'pick' }); }); }
	window.addEventListener('message', function (event) {
		const message = event.data;
		const section = document.querySelector('[data-form="files"]');
		if (!message || message.type !== 'picked' || !section) { return; }
		section.setAttribute('data-path', message.path || '');
		section.setAttribute('data-kind', message.kind || '');
		const shown = document.getElementById('material-path');
		if (shown) { shown.textContent = message.path || 'Nothing chosen yet'; }
		const note = document.getElementById('material-note');
		if (note) { note.textContent = message.note || ''; }
		error.hidden = true;
		refresh();
	});

	document.getElementById('wizard-create').addEventListener('click', function () {
		const v = values();
		if (!v.name.trim()) { fail('A project needs a name.'); return; }
		if (v.origin === 'template' && !v.folder.trim()) { fail('Name the folder to write the starter under.'); return; }
		if ((v.origin === 'folder' || v.origin === 'import') && !v.importSource.trim()) { fail('Choose the folder or file to bring in.'); return; }
		if (v.origin === 'repository' && v.sources.length === 0) { fail('Choose at least one source to read.'); return; }
		if (v.targets.length === 0) { fail('Choose at least one output to build.'); return; }
		api.postMessage({ type: 'create', values: v });
	});

	const filter = document.querySelector('[data-filter="sources"]');
	if (filter) { filter.addEventListener('input', applyFilter); }
	Array.prototype.forEach.call(document.querySelectorAll('.src-chip'), function (chip) {
		chip.addEventListener('click', function () {
			kind = chip.getAttribute('data-kind');
			Array.prototype.forEach.call(document.querySelectorAll('.src-chip'), function (other) {
				other.classList.toggle('is-on', other === chip);
			});
			applyFilter();
		});
	});
	const clear = document.getElementById('source-clear');
	if (clear) {
		clear.addEventListener('click', function () {
			Array.prototype.forEach.call(document.querySelectorAll('[data-source] input'), function (input) { input.checked = false; });
			refresh();
		});
	}
	// Adding or reading a source is the Sources page's job. The form's values go with the message, so returning here
	// finds the same half-filled form rather than an empty one.
	const openSources = document.getElementById('open-sources');
	if (openSources) {
		openSources.addEventListener('click', function () {
			api.postMessage({
				type: 'command',
				command: 'temcoDocs.sources',
				draft: { type: type, name: value('name'), version: value('version'), sources: checked('sources'), targets: checked('targets') }
			});
		});
	}
	document.addEventListener('change', refresh);
	document.addEventListener('input', refresh);
	show();
	applyFilter();
})();
`;
