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
import { draftProjectPage } from './aiModule';
import { RepositoryFile, RepositorySource, repositoryFiles, repositoryMaterial } from './repositories';
import { Catalog, CatalogUnavailable, Selection, slugOf, SourceRow } from './store';
import { escapeHtml as esc, icon, page, pageColumn } from './ui';

export const NEW_PROJECT_VIEW_TYPE = 'temcoProjects.newProject';

/**
 * The repository a project is being created *from*, when the flow was opened from one.
 *
 * Present means the repository is already the answer to "where do the pages come from": the flow does not ask, it
 * starts from that repository and asks only what is inside it.
 */
export interface PinnedRepository {
	name: string;
	cloneUrl?: string;
	branch?: string;
}

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

/** The starters a project can be written from. One, and it is the MSDN shape: area — topics. */
const TEMPLATES = [{ value: 'user-guide', label: 'User guide', sub: 'docs/help with an Overview area, two topics and a registry' }];

export class ProjectFlowPage {
	private panel: vscode.WebviewPanel | undefined;
	private sources: SourceRow[] = [];
	/** The repository this flow was opened from, when it was opened from one. */
	private pinned: PinnedRepository | undefined;

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly selection: Selection,
		private readonly refresh: () => void
	) { }

	async open(pinned?: PinnedRepository): Promise<void> {
		this.pinned = pinned;
		let unavailable: string | undefined;
		try {
			const catalog = await Catalog.open(this.context);
			// A project created *from* a repository cites it, so the source exists before the form does — the same
			// row `Start` writes on the repositories page, reached from the other end.
			if (pinned !== undefined) {
				catalog.addSource({
					kind: 'git',
					name: pinned.name,
					slug: slugOf(pinned.name),
					remoteUrl: pinned.cloneUrl,
					defaultBranch: pinned.branch,
				});
			}
			this.sources = catalog.sources();
		} catch (error) {
			unavailable = error instanceof CatalogUnavailable ? error.message : String(error);
			this.sources = [];
		}

		const body = html(this.sources, pinned, unavailable);
		if (this.panel) {
			this.panel.reveal(pageColumn());
			this.panel.webview.html = page(body, { title: 'New Project', script: WIZARD_SCRIPT, extraCss: FLOW_CSS });
			return;
		}

		this.panel = vscode.window.createWebviewPanel(NEW_PROJECT_VIEW_TYPE, 'New Project', pageColumn(), {
			enableScripts: true,
			localResourceRoots: []
		});
		this.panel.webview.onDidReceiveMessage((message: { type?: string; command?: string; values?: Values; picked?: string[]; files?: string[] }) => void this.receive(message));
		this.panel.webview.html = page(body, { title: 'New Project', script: WIZARD_SCRIPT, extraCss: FLOW_CSS });
		this.panel.onDidDispose(() => {
			this.panel = undefined;
		});
	}

	dispose(): void {
		this.panel?.dispose();
	}

	/**
	 * What a project cites, chosen from a multi-select over every repository the catalog records.
	 *
	 * A quick pick rather than a page: choosing is one field in a form, and the form must not be thrown away to
	 * answer it. Typing filters, space ticks, Enter answers — the ticks then land back in the list on the page.
	 */
	private async chooseRepositories(picked: readonly string[]): Promise<void> {
		let catalog: Catalog | undefined;
		let rows: { label: string; description: string; picked: boolean }[] = [];
		try {
			catalog = await Catalog.open(this.context);
			rows = catalog.sources().filter((source) => source.kind === 'git').map((source) => ({
				label: source.name,
				description: `${source.branch ?? 'no branch'} · ${source.pages === undefined || source.pages === 0 ? 'not read yet' : `${source.pages} ${source.pages === 1 ? 'page' : 'pages'}`}`,
				picked: picked.includes(source.name),
			}));
		} catch {
			// No catalog, nothing to choose: the page already says so.
		} finally {
			catalog?.close();
		}

		if (rows.length === 0) {
			void vscode.window.showInformationMessage('Temco Projects: no repository is recorded yet. Add one from the Repositories panel.');
			return;
		}

		const chosen = await vscode.window.showQuickPick(rows, {
			canPickMany: true,
			matchOnDescription: true,
			placeHolder: 'Repositories this project cites',
		});
		if (chosen === undefined) {
			return;
		}
		await this.panel?.webview.postMessage({ type: 'chosen', sources: chosen.map((row) => row.label) });
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

	private async receive(message: { type?: string; command?: string; values?: Values; picked?: string[]; files?: string[] }): Promise<void> {
		if (message.type === 'cancel') {
			this.panel?.dispose();
			return;
		}
		if (message.type === 'pick') {
			await this.pickMaterial();
			return;
		}
		if (message.type === 'files') {
			await this.sendFiles();
			return;
		}
		if (message.type === 'draft') {
			await this.draft(message.files ?? []);
			return;
		}
		if (message.type === 'choose') {
			await this.chooseRepositories(message.picked ?? []);
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

	/** The pinned repository as a source, as the repositories module reads one. */
	private pinnedSource(): RepositorySource | undefined {
		if (this.pinned === undefined) {
			return undefined;
		}
		const branch = this.pinned.branch;
		return {
			name: this.pinned.name,
			remoteUrl: this.pinned.cloneUrl,
			branch,
			defaultBranch: branch
		};
	}

	/**
	 * What the pinned repository carries, classified: the documentation it already has, and the files a page could be
	 * written from. One listing, two answers, and the documentation's own registry and overview are ticked for you.
	 */
	private async sendFiles(): Promise<void> {
		const source = this.pinnedSource();
		if (source === undefined) {
			return;
		}
		const listed = await repositoryFiles(source);
		if ('error' in listed) {
			await this.panel?.webview.postMessage({ type: 'files', error: listed.error });
			return;
		}
		const files = listed.files.map((file: RepositoryFile) => ({
			path: file.path,
			size: file.size,
			category: isDocumentation(file.path) ? 'docs' : 'code',
			ticked: defaultTick(file.path)
		}));
		await this.panel?.webview.postMessage({ type: 'files', files, note: listed.note });
	}

	/** One page of the project, drafted from the files a person ticked — returned, never written. */
	private async draft(names: readonly string[]): Promise<void> {
		const source = this.pinnedSource();
		if (source === undefined || names.length === 0) {
			await this.panel?.webview.postMessage({ type: 'drafted', error: 'Choose at least one file to draft from.' });
			return;
		}
		const material = await repositoryMaterial(source, names);
		if (material.text.trim().length === 0) {
			await this.panel?.webview.postMessage({
				type: 'drafted',
				error: 'Those files are empty or could not be read, so there is nothing to draft from.'
			});
			return;
		}
		const answer = await draftProjectPage({ title: this.pinned?.name ?? 'The project', material: material.text });
		if (answer === undefined) {
			await this.panel?.webview.postMessage({
				type: 'drafted',
				error: 'The AI module is not installed, so nothing was drafted. The project can still be created without one.'
			});
			return;
		}
		if ('error' in answer) {
			await this.panel?.webview.postMessage({ type: 'drafted', error: answer.error });
			return;
		}
		await this.panel?.webview.postMessage({
			type: 'drafted',
			text: answer.text,
			characters: material.characters,
			included: material.included.length,
			skipped: material.skipped
		});
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
			// A drafted page is kept with the project, not written beside it: the project's own page is where text
			// becomes a file, and a draft that wrote itself would be a file nobody asked for yet.
			if (values.draft !== undefined && values.draft.trim().length > 0) {
				catalog.saveDraft({
					documentSlug: slug,
					pageId: 'docs/help/overview.md',
					title: `${name} — overview`,
					kind: 'overview',
					body: values.draft
				});
			}
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
	origin: string;
	folder: string;
	template: string;
	importKind: string;
	importSource: string;
	sources: string[];
	targets: string[];
	/** The files of the pinned repository the person ticked, and the page the AI drafted from them. */
	files?: string[];
	draft?: string;
}

/** A file of the pinned repository under `docs/`, in one of the shapes a page is written in. */
function isDocumentation(file: string): boolean {
	const lower = file.toLowerCase();
	if (!/\.(md|markdown|html|htm|json)$/.test(lower)) {
		return false;
	}
	return /(^|\/)docs\//.test(lower) || lower.endsWith('registry.json');
}

/**
 * What starts ticked: the repository's own registry and its overview, when it has them.
 *
 * The two files that *are* the documentation's shape. Everything else — every topic, every class — starts unticked,
 * so a person adds what a draft should read rather than removing most of a repository from it.
 */
function defaultTick(file: string): boolean {
	const lower = file.toLowerCase();
	return /(^|\/)docs\/help\/registry\.json$/.test(lower) || /(^|\/)docs\/help\/overview\.md$/.test(lower);
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
	return `<label class="checklist__row" data-source data-pages="${source.pages ?? 0}"><input type="checkbox" data-field="sources" value="${esc(source.name)}"${ticked}><span class="checklist__text"><span class="checklist__title">${esc(source.name)}</span><span class="checklist__sub">${facts.map((fact) => esc(fact)).join(' · ')}</span></span></label>`;
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
		{ value: 'repository', mark: 'repo', label: 'From a repository', note: 'Cite repositories already recorded' },
		{ value: 'files', mark: 'layers', label: 'From existing files', note: 'HTML, Markdown, Word, CHM — or a docs folder' }
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
 * The flow's markup.
 *
 * Everything the flow needs is on this one page: a starting point on the left, its form on the right. It never sends a
 * person to another page to finish an answer — a wizard that jumps away and comes back loses both the thread and the
 * half-filled form.
 */
function html(sources: SourceRow[], pinned: PinnedRepository | undefined, unavailable?: string): string {
	const repositories = sources.filter((source) => source.kind === 'git');
	const initial = pinned === undefined ? 'empty' : 'repository';
	const empty = unavailable
		? `<div class="callout callout--warn">${icon('alert')}<div><b>The store is not available.</b> ${esc(unavailable)}</div></div>`
		: '';

	// Opened from a repository: it is already the answer to *where the pages come from*, so the chooser is replaced by
	// the one repository and the section continues into what is inside it.
	const sourceSection = pinned === undefined
		? `<div class="split__section-title">Where the pages come from</div>
			<p class="split__section-note">Repositories the platform already records. A project cites the pages they declare; reading and cloning happen on the Sources page.</p>
			<div class="checklist-tools">
				<input class="input input--sm" data-filter="sources" placeholder="Search repositories" aria-label="Search repositories">
				<button type="button" class="btn btn--sm" id="choose-repositories">${icon('list')}<span>Choose…</span></button>
			</div>
			${repositories.length === 0
				? `<div class="callout">${icon('info')}<div><b>No repository is recorded yet.</b> Create the project now — its own page is where sources are added and read, and this project can cite them from then on.</div></div>`
				: `<div class="checklist src-list" data-source-list>${repositories.map((source) => sourceRow(source, [])).join('')}</div>
		<p class="split__section-note" id="source-empty" hidden>No repository matches that.</p>
		<p class="split__section-note" style="margin-top:10px"><span id="source-summary">No repository selected</span><button type="button" class="link" id="source-clear">Clear</button></p>`}
			<p class="split__section-note"><button type="button" class="link" id="manage-repositories">Manage repositories</button> — the page where they are added, cloned and read. This form stays as it is, in its own tab.</p>`
		: `<div class="split__section-title">Where the pages come from</div>
			<p class="split__section-note">This project starts from <b>${esc(pinned.name)}</b>: it is added as the project's source, and nothing is written into the repository.</p>
			<div class="checklist"><label class="checklist__row is-fixed"><input type="checkbox" data-field="sources" value="${esc(pinned.name)}" checked disabled><span class="checklist__text"><span class="checklist__title">${esc(pinned.name)}</span><span class="checklist__sub">repository${pinned.branch === undefined ? '' : ` · ${esc(pinned.branch)}`} · added by this project</span></span></label></div>

			<div class="split__section-title mt-16">What inside it</div>
			<p class="split__section-note">The documentation it already has, and the files a page could be written from. Nothing is copied: the draft is kept with the project.</p>
			<div class="checklist-tools">
				<input class="input input--sm" data-filter="files" placeholder="Search files" aria-label="Search files">
				<button type="button" class="btn btn--sm" id="file-all">Select all</button>
				<button type="button" class="btn btn--sm" id="file-none">Clear</button>
			</div>
			<div class="checklist src-list" id="file-list"><p class="cell-muted" style="font-size:12px;margin:8px 0">Reading the file list…</p></div>
			<p class="split__section-note" id="file-summary" style="margin-top:10px">No file selected yet.</p>
			<div class="draft-row">
				<button type="button" class="btn" id="draft-run">AI draft from these</button>
				<button type="button" class="btn btn--ghost" id="draft-clear" hidden>Clear the draft</button>
				<span class="cell-muted" style="font-size:12px" id="draft-note"></span>
			</div>
			<pre class="draft-preview" id="draft-preview" hidden></pre>`;

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
				${field('Name', `<input class="input" data-field="name" value="${esc(DEFAULTS.name)}" aria-label="Project name">`)}
				${field('Version', `<input class="input" data-field="version" value="${esc(DEFAULTS.version)}" aria-label="Version">`, 'A project publishes one version at a time.')}
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

		<div class="split__section" data-form="repository" hidden>
			${sourceSection}
		</div>

		<div class="split__section" data-form="files" hidden>
			<div class="split__section-title">What the material is</div>
			<p class="split__section-note">Choose the folder or file. A folder that already has a registry is cited as it stands; anything else — Markdown, HTML, Word or CHM — is converted once into <code>docs/</code> and <code>docs/help/registry.json</code>.</p>
			<div class="pick-row">
				<button type="button" class="btn" id="pick-material">${icon('folder')}<span>Choose a folder or file…</span></button>
				<span class="pick-row__path" id="material-path">Nothing chosen yet</span>
			</div>
			<p class="split__section-note" id="material-note" style="margin-top:8px"></p>
		</div>

		<div class="split__section">
			<div class="split__section-title">What it builds</div>
			<p class="split__section-note">One build produces every target you tick here — and every one of them can be turned on later in the Build Center.</p>
			${tiles(TARGETS, DEFAULT_TARGETS)}
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
 * The flow's own layout: the file list as a bounded area, and a draft that reads like text rather than like code.
 *
 * A `pre` is the honest element for text that already has line breaks and must not be re-wrapped by markup rules, and
 * it is set in the mono face only because Markdown's indentation is part of what was drafted.
 */
const FLOW_CSS = `
.checklist__row.is-fixed { cursor: default; background: transparent; }
.draft-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 12px; }
.draft-preview { margin: 10px 0 0; max-height: 300px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere;
  background: var(--bg-inset); border-radius: var(--radius); padding: 12px 14px;
  font-family: ui-monospace, monospace; font-size: 12.5px; line-height: 1.6; color: var(--fg); }
`;

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
	// The page the AI wrote for this project, kept here until *Create Project* records it.
	let draftText = '';
	// A draft written by an older build can name a type this build no longer has; the rail is the truth.
	const known = rails.some(function (rail) { return rail.getAttribute('data-type') === type; });
	if (!known) { type = 'empty'; }

	const HINTS = {
		empty: 'Nothing is read and nothing is converted: the project exists, and the first page is yours to write.',
		repository: 'A repository project cites pages that already exist. Reading a repository records the pages it declares; it never changes the repository.',
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
		if (type === 'repository') { return 'repository'; }
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
		if (v.origin === 'repository') {
			v.sources = checked('sources');
			v.files = tickedFiles();
			v.draft = draftText;
		}
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
			list.textContent = 'No repository selected — a repository project needs at least one.';
			return;
		}
		const pages = rows.reduce(function (total, row) { return total + Number(row.getAttribute('data-pages') || 0); }, 0);
		list.textContent = rows.length + (rows.length === 1 ? ' repository' : ' repositories') + ' · ' + pages + (pages === 1 ? ' page' : ' pages') + ' from them';
	}
	/** The search narrows the list; with one kind in it there is nothing else to filter by. */
	function applyFilter() {
		const search = document.querySelector('[data-filter="sources"]');
		const term = search ? search.value.trim().toLowerCase() : '';
		let shown = 0;
		sourceRows().forEach(function (row) {
			row.hidden = term.length > 0 && row.textContent.toLowerCase().indexOf(term) < 0;
			if (!row.hidden) { shown++; }
		});
		const empty = document.getElementById('source-empty');
		if (empty) { empty.hidden = shown > 0; }
	}
	function refresh() {
		counts();
		if (!summary) { return; }
		const v = values();
		const parts = [type === 'repository' ? 'From a repository' : type === 'files' ? 'From existing files' : 'Empty project'];
		if (v.origin === 'template') { parts.push('user-guide starter'); }
		if (v.origin === 'repository') { parts.push(v.sources.length + (v.sources.length === 1 ? ' repository' : ' repositories')); }
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
		if (!message) { return; }
		if (message.type === 'files') {
			const list = document.getElementById('file-list');
			if (message.error) {
				if (list) { list.textContent = message.error; }
				return;
			}
			renderFiles(message.files || []);
			if (message.note && list) { list.setAttribute('title', message.note); }
			return;
		}
		if (message.type === 'drafted') {
			const note = document.getElementById('draft-note');
			const preview = document.getElementById('draft-preview');
			const clear = document.getElementById('draft-clear');
			if (draftRun) { draftRun.disabled = false; }
			if (message.error) {
				if (note) { note.textContent = message.error; }
				return;
			}
			draftText = message.text || '';
			if (preview) { preview.hidden = draftText.length === 0; preview.textContent = draftText; }
			if (clear) { clear.hidden = draftText.length === 0; }
			if (note) {
				const skipped = (message.skipped || []).length;
				note.textContent = 'Drafted ' + draftText.length + ' characters from ' + (message.included || 0)
					+ (message.included === 1 ? ' file' : ' files')
					+ (skipped > 0 ? ' — ' + skipped + ' left out of the 12 000-character budget' : '');
			}
			refresh();
			return;
		}
		if (message.type === 'chosen') {
			const names = message.sources || [];
			Array.prototype.forEach.call(document.querySelectorAll('[data-source] input'), function (input) {
				input.checked = names.indexOf(input.value) >= 0;
			});
			refresh();
			return;
		}
		const section = document.querySelector('[data-form="files"]');
		if (message.type !== 'picked' || !section) { return; }
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
		if (v.origin === 'repository' && v.sources.length === 0) { fail('Choose at least one repository to cite.'); return; }
		if (v.targets.length === 0) { fail('Choose at least one output to build.'); return; }
		api.postMessage({ type: 'create', values: v });
	});

	const filter = document.querySelector('[data-filter="sources"]');
	if (filter) { filter.addEventListener('input', applyFilter); }
	const clear = document.getElementById('source-clear');
	if (clear) {
		clear.addEventListener('click', function () {
			Array.prototype.forEach.call(document.querySelectorAll('[data-source] input'), function (input) { input.checked = false; });
			refresh();
		});
	}
	// Choosing from a list that is not on this page: the host filters, ticks and answers in one quick pick, so the
	// form keeps everything typed so far.
	const choose = document.getElementById('choose-repositories');
	if (choose) {
		choose.addEventListener('click', function () {
			api.postMessage({ type: 'choose', picked: checked('sources') });
		});
	}
	const manage = document.getElementById('manage-repositories');
	if (manage) {
		// The page itself, not the side-bar panel: the panel lists the sources already added, while adding, cloning
		// and reading happen on the page. A page of ours is a tab in the strip beside this one, so this form is
		// still whole when the person comes back to it.
		manage.addEventListener('click', function () {
			api.postMessage({ type: 'command', command: 'temcoRepositories.page' });
		});
	}

	/* What is inside the pinned repository: listed by the host, ticked here, and the material for one draft. */

	function escape(value) {
		return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}
	function fileInputs() {
		return Array.prototype.slice.call(document.querySelectorAll('[data-file]'));
	}
	function tickedFiles() {
		return fileInputs().filter(function (input) { return input.checked; })
			.map(function (input) { return input.value; });
	}
	function kilo(bytes) {
		return bytes >= 1024 ? (bytes / 1024).toFixed(1) + ' KB' : bytes + ' B';
	}
	/** The count of what is ticked, and what it costs to read — the same budget the host applies. */
	function filesSummary() {
		const list = document.getElementById('file-summary');
		if (!list) { return; }
		const ticked = fileInputs().filter(function (input) { return input.checked; });
		if (ticked.length === 0) { list.textContent = 'No file selected yet.'; return; }
		const bytes = ticked.reduce(function (total, input) { return total + Number(input.getAttribute('data-size') || 0); }, 0);
		list.textContent = ticked.length + (ticked.length === 1 ? ' file' : ' files') + ' · ' + kilo(bytes)
			+ ' · the draft reads up to 12 000 characters';
	}
	function renderFiles(files) {
		const list = document.getElementById('file-list');
		if (!list) { return; }
		const group = function (title, rows) {
			if (rows.length === 0) { return ''; }
			return '<div class="checklist-heading">' + title + '</div>' + rows.map(function (file) {
				return '<label class="checklist__row" data-file-row><input type="checkbox" data-file value="'
					+ escape(file.path) + '" data-size="' + file.size + '"' + (file.ticked ? ' checked' : '') + '>'
					+ '<span class="checklist__text"><span class="checklist__title">' + escape(file.path)
					+ '</span><span class="checklist__sub">' + kilo(file.size) + '</span></span></label>';
			}).join('');
		};
		const docs = files.filter(function (file) { return file.category === 'docs'; });
		const code = files.filter(function (file) { return file.category !== 'docs'; });
		list.innerHTML = group('Documentation in this repository', docs) + group('Classes and source', code)
			|| '<p class="cell-muted" style="font-size:12px;margin:8px 0">This repository has no file a draft could read.</p>';
		filesSummary();
	}

	const fileAll = document.getElementById('file-all');
	if (fileAll) {
		fileAll.addEventListener('click', function () {
			fileInputs().forEach(function (input) { input.checked = true; });
			filesSummary();
		});
	}
	const fileNone = document.getElementById('file-none');
	if (fileNone) {
		fileNone.addEventListener('click', function () {
			fileInputs().forEach(function (input) { input.checked = false; });
			filesSummary();
		});
	}
	document.addEventListener('change', function (event) {
		if (event.target && event.target.hasAttribute && event.target.hasAttribute('data-file')) { filesSummary(); }
	});
	const fileFilter = document.querySelector('[data-filter="files"]');
	if (fileFilter) {
		fileFilter.addEventListener('input', function () {
			const term = fileFilter.value.trim().toLowerCase();
			Array.prototype.slice.call(document.querySelectorAll('[data-file-row]')).forEach(function (row) {
				row.hidden = term.length > 0 && row.textContent.toLowerCase().indexOf(term) < 0;
			});
		});
	}

	const draftRun = document.getElementById('draft-run');
	if (draftRun) {
		draftRun.addEventListener('click', function () {
			const ticked = tickedFiles();
			const note = document.getElementById('draft-note');
			if (ticked.length === 0) {
				if (note) { note.textContent = 'Choose at least one file to draft from.'; }
				return;
			}
			if (note) { note.textContent = 'Drafting from ' + ticked.length + (ticked.length === 1 ? ' file…' : ' files…'); }
			draftRun.disabled = true;
			api.postMessage({ type: 'draft', files: ticked });
		});
	}
	const draftClear = document.getElementById('draft-clear');
	if (draftClear) {
		draftClear.addEventListener('click', function () {
			draftText = '';
			const preview = document.getElementById('draft-preview');
			if (preview) { preview.hidden = true; preview.textContent = ''; }
			const note = document.getElementById('draft-note');
			if (note) { note.textContent = ''; }
			draftClear.hidden = true;
		});
	}

	document.addEventListener('change', refresh);
	document.addEventListener('input', refresh);
	show();
	applyFilter();
	// The pinned repository's files are a listing the host owns; the page asks for them once it is drawn.
	if (document.getElementById('file-list')) { api.postMessage({ type: 'files' }); }
})();
`;
