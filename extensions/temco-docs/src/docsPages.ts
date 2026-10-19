// The Documentation module's pages.
//
// The eleven surfaces the Documentation container has (Projects, Repositories, a repository, Sources, Documents,
// a page, a source, Review Center, Build Center, Releases, How To Use). The markup, the groups, the words and the
// order came from the mock (`docs/mock/js/views.docs.js`); the data is now the platform's own — the catalog, the
// registries this window reads, and the clones in the working area — so an empty platform draws empty lists
// rather than a demonstration.

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { DocsRoot, PageEntry, collectPages } from './registry';
import { BuildRow, Catalog, DocumentRow, DraftRow, ReleaseRow, ScanRow, SourceRow, selection, slugOf } from './store';
import { commandScript, escapeHtml as esc, icon, page, pageColumn, runCommand, toneMark } from './ui';

/** The view types, one per surface. */
export const PROJECTS_VIEW_TYPE = 'temcoDocs.projects';
export const REPOSITORIES_VIEW_TYPE = 'temcoDocs.repositories';
export const REPOSITORY_VIEW_TYPE = 'temcoDocs.repository';
export const SOURCES_VIEW_TYPE = 'temcoDocs.sources';
export const DOCUMENTS_VIEW_TYPE = 'temcoDocs.knowledge';
export const PAGE_VIEW_TYPE = 'temcoDocs.page';
export const SOURCE_VIEW_TYPE = 'temcoDocs.source';
export const REVIEW_VIEW_TYPE = 'temcoDocs.review';
export const BUILDS_VIEW_TYPE = 'temcoDocs.builds';
export const RELEASES_VIEW_TYPE = 'temcoDocs.releases';
export const HOW_TO_VIEW_TYPE = 'temcoDocs.howTo';

interface ActionOptions {
	kind?: 'primary' | 'ghost';
	mark?: string;
	args?: unknown;
	small?: boolean;
	title?: string;
}

const button = (label: string, command: string, options: ActionOptions = {}): string =>
	`<button type="button" class="btn${options.small ? ' btn--sm' : ''}${options.kind ? ` btn--${options.kind}` : ''}" data-command="${command}"${options.args === undefined ? '' : ` data-args="${esc(JSON.stringify(options.args))}"`}${options.title ? ` title="${esc(options.title)}"` : ''}>${options.mark ? icon(options.mark) : ''}<span>${esc(label)}</span></button>`;

const rule = (options: { label: string; count?: string; note?: string; actions?: string; plain?: boolean }): string =>
	`<div class="group-head"><span class="group-head__label${options.plain ? ' group-head__label--plain' : ''}">${esc(options.label)}</span><span class="group-head__rule"></span>${options.count ? `<span class="group-head__count">${esc(options.count)}</span>` : ''}${options.actions ? `<span class="group-head__actions">${options.actions}</span>` : ''}</div>${options.note ? `<p class="group-note">${options.note}</p>` : ''}`;

const group = (options: { label: string; count?: string; note?: string; actions?: string; body: string; plain?: boolean }): string =>
	rule(options) + `<div class="record-list">${options.body}</div>`;

const pageHead = (options: { eyebrow?: string; title: string; mark?: string; desc?: string; actions?: string }): string =>
	`<div class="page-head"><div class="page-head__main">${options.eyebrow ? `<div class="eyebrow">${esc(options.eyebrow)}</div>` : ''}<h1 class="page-head__title">${options.mark ? icon(options.mark) : ''}${esc(options.title)}</h1>${options.desc ? `<p class="page-head__desc">${options.desc}</p>` : ''}</div>${options.actions ? `<div class="page-head__actions">${options.actions}</div>` : ''}</div>`;

const tiles = (items: { value: string; label: string }[]): string =>
	`<div class="tiles">${items.map((item) => `<div class="tile"><span class="tile__value">${esc(item.value)}</span><span class="tile__label">${esc(item.label)}</span></div>`).join('')}</div>`;

const card = (options: { title: string; mark?: string; actions?: string; desc?: string; body?: string; foot?: string; plain?: boolean }): string =>
	`<div class="card${options.plain ? ' card--plain' : ''}"><div class="card__head">${options.mark ? `<span class="card__icon">${icon(options.mark)}</span>` : ''}<div class="card__title">${esc(options.title)}</div>${options.actions ? `<div class="card__actions">${options.actions}</div>` : ''}</div>${options.desc ? `<p class="card__desc">${options.desc}</p>` : ''}${options.body ?? ''}${options.foot ? `<div class="card__foot">${options.foot}</div>` : ''}</div>`;

const badge = (text: string, tone?: string): string =>
	`<span class="badge${tone && tone !== 'neutral' ? ` badge--${tone}` : ''}">${esc(text)}</span>`;

const list = (items: { mark: string; title: string; sub: string; meta?: string }[]): string =>
	`<div class="list">${items.map((item) => `<div class="list__item">${icon(item.mark)}<div class="list__main"><div class="list__title">${esc(item.title)}</div><div class="list__sub">${item.sub}</div></div>${item.meta ? `<div class="list__meta">${item.meta}</div>` : ''}</div>`).join('')}</div>`;

const callout = (html: string, kind?: 'warn' | 'ok'): string =>
	`<div class="callout${kind ? ` callout--${kind}` : ''}">${icon(kind === 'warn' ? 'alert' : kind === 'ok' ? 'check' : 'info')}<div>${html}</div></div>`;

/** A row of facts, as the mock writes one under a group. */
const factRow = (mark: string, title: string, note: string): string =>
	`<div class="record-row record-row--static">${toneMark(mark)}<div class="record-row__main"><div class="record-row__title"><span class="record-row__name">${esc(title)}</span></div><div class="record-row__meta"><span>${esc(note)}</span></div></div><div class="record-row__state"></div><div class="record-row__state"></div></div>`;

/** Facts on one line, each keeping its trailing dot so a count never breaks in half. */
const facts = (items: string[]): string =>
	items.map((item, index) => `<span>${esc(item)}${index < items.length - 1 ? ' ·' : ''}</span>`).join(' ');

const settingsStrip = (entries: { label: string; value: string; mono?: boolean }[], wide = false): string =>
	`<div class="settings-strip${wide ? ' settings-strip--wide' : ''}">${entries.map((entry) => `<div><div class="settings-strip__label">${esc(entry.label)}</div><div class="settings-strip__value${entry.mono ? ' cell-mono' : ''}">${esc(entry.value)}</div></div>`).join('')}</div>`;

const table = (head: string[], rows: string[][], rowCommand?: (index: number) => { command: string; args?: unknown } | undefined): string =>
	`<div class="table-wrap table-wrap--plain"><table class="table table--compact"><thead><tr>${head.map((cell) => `<th>${esc(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map((cells, index) => {
		const action = rowCommand?.(index);
		return `<tr${action ? ` data-command="${action.command}"${action.args === undefined ? '' : ` data-args="${esc(JSON.stringify(action.args))}"`} style="cursor:pointer"` : ''}>${cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`;
	}).join('')}</tbody></table></div>`;

/** One file a build left. */
interface ArtifactFact {
	kind: string;
	path: string;
	builtAt: string;
}

/** What the Build Center and Releases show: the builds of the project on, every file they left, and releases. */
interface BuildFacts {
	project?: string;
	builds: BuildRow[];
	artifacts: ArtifactFact[];
	releases: ReleaseRow[];
}

/** The module's pages: one panel per surface, kept open so a second visit reveals the tab. */
export class DocsPages {
	private readonly panels = new Map<string, vscode.WebviewPanel>();

	constructor(private readonly context: vscode.ExtensionContext, private readonly roots: () => readonly DocsRoot[]) { }

	open(key: string, viewType: string, title: string, body: string, mark = 'document'): void {
		const existing = this.panels.get(key);
		if (existing) {
			existing.reveal(pageColumn());
			existing.webview.html = page(body, { title, script: commandScript });
			return;
		}
		const panel = vscode.window.createWebviewPanel(viewType, title, pageColumn(), {
			enableScripts: true,
			localResourceRoots: []
		});
		panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'media', `${mark}.svg`);
		panel.webview.onDidReceiveMessage(runCommand);
		panel.webview.html = page(body, { title, script: commandScript });
		this.panels.set(key, panel);
		panel.onDidDispose(() => this.panels.delete(key));
	}

	projects(): void {
		void this.openProjects();
	}

	/** The projects the catalog holds, the one the window is on, and the sources attached to it. */
	private async openProjects(): Promise<void> {
		let documents: DocumentRow[] = [];
		let linked: { name: string; kind: string; branch?: string }[] = [];
		let catalog: Catalog | undefined;
		try {
			catalog = await Catalog.open(this.context);
			documents = catalog.documents();
			const current = selection.project() ?? (documents.length === 1 ? documents[0].slug : undefined);
			linked = current === undefined ? [] : catalog.documentSources(current);
		} catch {
			// A catalog that cannot be read shows no projects, which is honest: none is known to exist.
		} finally {
			catalog?.close();
		}
		this.open('projects', PROJECTS_VIEW_TYPE, 'Projects', projectsBody(documents, selection.project(), linked));
	}

	repositories(): void {
		void this.openRepositories();
	}

	repository(name?: string): void {
		void this.openRepository(name);
	}

	/** Every repository source, with its clone, its reads, its scripts and the pages the last read recorded. */
	private async repositoryFacts(): Promise<RepositoryFact[]> {
		const facts: RepositoryFact[] = [];
		let catalog: Catalog | undefined;
		try {
			catalog = await Catalog.open(this.context);
			for (const source of catalog.sources().filter((row) => row.kind === 'git')) {
				const detail = catalog.source(source.slug);
				const clone = detail?.path;
				facts.push({
					slug: source.slug,
					name: source.name,
					kind: source.kind,
					remoteUrl: detail?.remoteUrl,
					branch: detail?.branch ?? source.branch,
					defaultBranch: detail?.defaultBranch,
					docsRoot: detail?.docsRoot,
					path: clone,
					cloned: clone !== undefined && fs.existsSync(clone),
					pages: source.pages ?? 0,
					reads: catalog.scans(source.slug),
					pageRows: detail === undefined ? [] : catalog.pagesFor(detail.id),
					files: clone === undefined ? [] : pageFiles(clone, detail?.docsRoot),
					scripts: clone === undefined ? [] : docScripts(clone)
				});
			}
		} catch {
			// No catalog, no repositories: the list is empty rather than invented.
		} finally {
			catalog?.close();
		}
		return facts;
	}

	private async openRepositories(): Promise<void> {
		this.open('repositories', REPOSITORIES_VIEW_TYPE, 'Repositories', repositoriesBody(await this.repositoryFacts()));
	}

	private async openRepository(name: string | undefined): Promise<void> {
		const facts = await this.repositoryFacts();
		const fact = facts.find((candidate) => candidate.slug === name || candidate.name === name) ?? facts[0];
		this.open(`repository:${fact?.slug ?? 'none'}`, REPOSITORY_VIEW_TYPE, fact?.name ?? 'Repository', repositoryBody(fact));
	}

	sources(): void {
		void this.openSources();
	}

	/** The sources the catalog holds, which is what a read records and what a clone belongs to. */
	private async openSources(): Promise<void> {
		let sources: SourceRow[] = [];
		let catalog: Catalog | undefined;
		try {
			catalog = await Catalog.open(this.context);
			sources = catalog.sources();
		} catch {
			// A catalog that cannot be read shows no sources, which is honest: none is known to exist.
		} finally {
			catalog?.close();
		}
		this.open('sources', SOURCES_VIEW_TYPE, 'Sources', sourcesBody(sources, this.roots()));
	}

	documents(area?: string): void {
		this.open('documents', DOCUMENTS_VIEW_TYPE, 'Documents', documentsBody(this.roots(), area));
	}

	pageOf(title?: string, area?: string): void {
		void this.openPage(title, area);
	}

	/** One page, read from the registry and the file behind it — never from a sample. */
	private async openPage(title: string | undefined, area: string | undefined): Promise<void> {
		const body = await pageBody(this.roots(), title, area);
		this.open(`page:${body.title}`, PAGE_VIEW_TYPE, body.title, body.html);
	}

	source(repo?: string): void {
		void this.openSource(repo);
	}

	/** The files behind the pages of one repository, read from its clone. */
	private async openSource(repo: string | undefined): Promise<void> {
		const facts = await this.repositoryFacts();
		const fact = facts.find((candidate) => candidate.slug === repo || candidate.name === repo) ?? facts[0];
		this.open(`source:${fact?.slug ?? 'none'}`, SOURCE_VIEW_TYPE, 'Source Explorer', sourceBody(fact));
	}

	/** Whether a page is open, so a caller can decide to redraw it rather than open it. */
	isOpen(key: string): boolean {
		return this.panels.has(key);
	}

	review(): void {
		void this.openReview();
	}

	/**
	 * The queue, read from the catalog rather than from the mock.
	 *
	 * A draft is the only thing that waits for a person: a page that was written is a page, and a page that was
	 * never written has no diff to weigh. So the Review Center lists exactly the unsettled drafts of the project
	 * the window is on, and says so when there are none.
	 */
	private async openReview(): Promise<void> {
		let project = selection.project();
		let drafts: DraftRow[] = [];
		let catalog: Catalog | undefined;
		try {
			catalog = await Catalog.open(this.context);
			if (project === undefined) {
				// Nothing is selected: a window with one project means that project, and its drafts are still real.
				const all = catalog.documents();
				project = all.length === 1 ? slugOf(all[0].name) : undefined;
			}
			drafts = project === undefined ? [] : catalog.drafts(project);
		} catch {
			// A catalog that cannot be read shows an empty queue, which is honest: nothing is known to be waiting.
		} finally {
			catalog?.close();
		}
		this.open('review', REVIEW_VIEW_TYPE, 'Review Center', reviewBody(drafts, project));
	}

	builds(): void {
		void this.openBuilds();
	}

	releases(): void {
		void this.openReleases();
	}

	/** What the catalog knows about builds: the project on, its builds, the files they left, and its releases. */
	private async buildFacts(): Promise<BuildFacts> {
		let project = selection.project();
		let builds: BuildRow[] = [];
		let artifacts: ArtifactFact[] = [];
		let releases: ReleaseRow[] = [];
		let catalog: Catalog | undefined;
		try {
			catalog = await Catalog.open(this.context);
			// Nothing selected and one project in the catalog means that project, which is what a lone author has.
			project = project ?? (catalog.documents().length === 1 ? catalog.documents()[0].slug : undefined);
			if (project !== undefined) {
				builds = catalog.builds(project);
				artifacts = catalog.documentArtifacts(project);
				releases = catalog.releases(project);
			}
		} catch {
			// A catalog that cannot be read shows an empty build page, which is honest: nothing is known to exist.
		} finally {
			catalog?.close();
		}
		return { project, builds, artifacts, releases };
	}

	private async openBuilds(): Promise<void> {
		this.open('builds', BUILDS_VIEW_TYPE, 'Build Center', buildsBody(await this.buildFacts()));
	}

	private async openReleases(): Promise<void> {
		this.open('releases', RELEASES_VIEW_TYPE, 'Releases', releasesBody(await this.buildFacts()));
	}

	howTo(): void {
		this.open('howTo', HOW_TO_VIEW_TYPE, 'How To Use', howToBody());
	}

	dispose(): void {
		for (const panel of this.panels.values()) {
			panel.dispose();
		}
		this.panels.clear();
	}
}

/**
 * *Projects* — the projects the catalog holds.
 *
 * A project is a row in `documents`: the sources attached to it, how many pages they declare, and what it has
 * built. Nothing on this page is a sample, so an empty catalog draws an empty list and says why.
 */
function projectsBody(
	documents: readonly DocumentRow[],
	current: string | undefined,
	linked: readonly { name: string; kind: string; branch?: string }[]
): string {
	const on = documents.find((document) => document.slug === current) ?? documents[0];

	const row = (document: DocumentRow): string => {
		const isCurrent = on !== undefined && document.slug === on.slug;
		const items = [`${document.sources} ${document.sources === 1 ? 'source' : 'sources'}`];
		if (document.version !== undefined) {
			items.unshift(`v${document.version}`);
		}
		items.push(document.builtAt === undefined ? 'never built' : `built ${waitingSince(document.builtAt)}`);
		return `<div class="record-row${isCurrent ? ' record-row--current' : ''}" data-command="temcoDocs.selectProject" data-args="${esc(JSON.stringify([document.slug]))}">${toneMark(isCurrent ? 'layers' : 'folder', isCurrent ? 'accent' : undefined)}<div class="record-row__main"><div class="record-row__title"><span class="record-row__name">${esc(document.name)}</span>${isCurrent ? badge('Current', 'accent') : ''}</div><div class="record-row__meta">${facts(items)}</div></div><div class="record-row__state">${isCurrent ? badge('Working on it', 'ok') : badge('Switch to', 'neutral')}</div><span class="record-row__go">${icon('chevron-right', 'icon--sm')}</span></div>`;
	};

	return `${pageHead({
		title: 'Projects',
		mark: 'folder',
		desc: 'A project is a version of a product&#39;s documentation: its sources, its pages and the artifacts it builds. Choosing one decides what every other page is about.',
		actions: button('New Project', 'temcoProjects.newProject', { kind: 'primary', mark: 'plus' }) + button('Import', 'temcoProjects.addSource', { mark: 'download' })
	})}
${documents.length === 0
			? `<div class="mt-16">${callout('<b>No project yet.</b> A project is a row in the platform database that sources, pages, drafts and builds all point at. Create one and it appears here.')}</div>`
			: `<div class="record-list">${documents.map(row).join('')}</div>`}
${on === undefined ? '' : `<div class="mt-24">
${card({
				title: 'Sources of This Project',
				mark: 'repo',
				plain: true,
				actions: button('All Sources', 'temcoDocs.sources', { small: true, kind: 'ghost' }),
				desc: `What <b>${esc(on.name)}</b> reads. Reading a source is what puts pages in the knowledge base; it never writes to the source.`,
				body: linked.length === 0
					? callout('No source is attached to this project yet. Add one, then read it: the pages it declares are what the rest of these pages list.')
					: list(linked.map((source) => ({
						mark: source.kind === 'git' ? 'repo' : source.kind === 'folder' ? 'folder' : 'package',
						title: source.name,
						sub: `<span class="cell-muted">${esc(source.kind)}${source.branch === undefined ? '' : ` · ${esc(source.branch)}`}</span>`
					})))
			})}
</div>`}
${on === undefined ? '' : `<div class="mt-24">
${card({
				title: 'What This Project Stores',
				mark: 'gear',
				plain: true,
				actions: button('Edit Settings', 'temcoWorkbench.settings', { small: true, kind: 'ghost' }),
				desc: 'All of it in the platform database, beside the pages it is about — not in the repository.',
				body: settingsStrip([
					{ label: 'Name', value: on.name },
					{ label: 'Key', value: on.slug, mono: true },
					{ label: 'Version', value: on.version ?? 'not set', mono: true },
					{ label: 'Sources', value: String(on.sources) },
					{ label: 'Last build', value: on.builtAt === undefined ? 'never' : waitingSince(on.builtAt) },
					{ label: 'Projects', value: String(documents.length) }
				])
			})}
</div>`}`;
}

/**
 * The Markdown files under a clone's pages folder, relative to it.
 *
 * Bounded on purpose: four levels and four hundred files is more than any documentation set this platform reads,
 * and a runaway walk in a view that opens on a click is worse than a truncated list.
 */
function pageFiles(clone: string, docsRoot: string | undefined): string[] {
	const base = path.join(clone, docsRoot ?? 'docs');
	const files: string[] = [];
	const walk = (folder: string, prefix: string, depth: number): void => {
		if (depth > 4 || files.length > 400) {
			return;
		}
		let entries: fs.Dirent[];
		try {
			entries = fs.readdirSync(folder, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			if (entry.name.startsWith('.') || entry.name === 'node_modules') {
				continue;
			}
			const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
			if (entry.isDirectory()) {
				walk(path.join(folder, entry.name), relative, depth + 1);
				continue;
			}
			if (/\.(md|markdown)$/i.test(entry.name)) {
				files.push(relative);
			}
		}
	};
	walk(base, '', 0);
	return files.sort();
}

/**
 * The documentation scripts a clone declares, read from its own `package.json`.
 *
 * Read, never guessed: a script the repository does not have is not offered, and the words are the
 * repository's, so a rename there shows up here instead of being papered over.
 */
function docScripts(clone: string): RepositoryScript[] {
	try {
		const manifest = JSON.parse(fs.readFileSync(path.join(clone, 'package.json'), 'utf8')) as {
			scripts?: Record<string, string>;
		};
		return Object.entries(manifest.scripts ?? {})
			.filter(([name]) => name.startsWith('docs:') || name === 'build:help' || name === 'build:help:dry')
			.sort(([one], [other]) => one.localeCompare(other))
			.map(([name, command]) => ({ name, command: String(command) }));
	} catch {
		// No manifest, or one that cannot be read: the repository simply has no scripts this page can name.
		return [];
	}
}

/** One script in a clone's own `package.json` that has to do with documentation. */
interface RepositoryScript {
	name: string;
	command: string;
}

/** One repository as the list and the detail page read it: the row, the clone, the reads, the scripts. */
interface RepositoryFact {
	slug: string;
	name: string;
	kind: string;
	remoteUrl?: string;
	branch?: string;
	defaultBranch?: string;
	docsRoot?: string;
	/** Where the clone is, when a read has put one on this machine. */
	path?: string;
	cloned: boolean;
	pages: number;
	reads: ScanRow[];
	pageRows: { id: string; title?: string; path?: string }[];
	/** Markdown under the pages folder of the clone, relative to it. */
	files: string[];
	scripts: RepositoryScript[];
}

/**
 * *Repositories* — the repository sources the catalog holds, and whether each has a local copy.
 *
 * Reading a repository records the pages it declares; cloning it puts the working tree where a draft can read
 * the code behind those pages. Neither writes to the repository.
 */
function repositoriesBody(repositories: readonly RepositoryFact[]): string {
	const cloned = repositories.filter((fact) => fact.cloned);
	const pages = repositories.reduce((total, fact) => total + fact.pages, 0);
	const reads = repositories.reduce((total, fact) => total + fact.reads.length, 0);

	const row = (fact: RepositoryFact): string => {
		const items = [fact.remoteUrl ?? 'no remote recorded'];
		if (fact.branch !== undefined) {
			items.push(`on ${fact.branch}`);
		}
		items.push(fact.pages === 0 ? 'never read' : `${fact.pages} ${fact.pages === 1 ? 'page' : 'pages'} found`);
		items.push(fact.cloned ? 'cloned locally' : 'no local copy');
		return `<div class="record-row" data-command="temcoDocs.repository" data-args="${esc(JSON.stringify([fact.slug]))}">${toneMark('repo', fact.cloned ? 'accent' : undefined)}<div class="record-row__main"><div class="record-row__title"><span class="record-row__name">${esc(fact.name)}</span></div><div class="record-row__meta">${facts(items)}</div></div><div class="record-row__state">${badge(fact.cloned ? 'Cloned' : 'Remote only', fact.cloned ? 'ok' : 'neutral')}</div><span class="record-row__go">${icon('chevron-right', 'icon--sm')}</span></div>`;
	};

	const partition = (title: string, note: string, items: RepositoryFact[]): string =>
		items.length === 0 ? '' : `<div class="mt-24">${group({ label: title, count: `${items.length} ${items.length === 1 ? 'repository' : 'repositories'}`, note, actions: button('Read All', 'temcoRepositories.readAllSources', { small: true, kind: 'ghost', mark: 'refresh' }), body: items.map(row).join('') })}</div>`;

	const origin = (fact: RepositoryFact): string => {
		const remote = fact.remoteUrl ?? '';
		return /github\.com\/temcocontrols/i.test(remote) ? 'temco' : 'other';
	};

	const missing = repositories.filter((fact) => !fact.cloned).length;

	return `${pageHead({
		title: 'Repositories',
		mark: 'repo',
		desc: 'The repository sources this platform reads, and whether their local copy is here. Reading one records the pages it declares; a draft reads its code. Nothing is ever written back.',
		actions: button('Add Repository', 'temcoRepositories.page', { kind: 'primary', mark: 'plus' }) + (missing > 0 ? button(`Read ${missing} Missing`, 'temcoRepositories.readAllSources', { mark: 'download' }) : '')
	})}
${tiles([
			{ value: String(repositories.length), label: repositories.length === 1 ? 'Repository' : 'Repositories' },
			{ value: String(cloned.length), label: 'Cloned locally' },
			{ value: String(pages), label: 'Pages found' },
			{ value: String(reads), label: 'Reads recorded' }
		])}
${repositories.length === 0
			? `<div class="mt-16">${callout('<b>No repository yet.</b> A repository is added as a source, then read: reading clones it into the working area and records the pages it declares.')}</div>`
			: partition('Temco', 'Published under <b class="cell-mono">github.com/temcocontrols</b>. Their pages carry product names, register maps and firmware behaviour that Temco stands behind.', repositories.filter((fact) => origin(fact) === 'temco'))
				+ partition('Third-party', 'Read exactly like a Temco repository — same clone, same read, same pages — but nothing in one is Temco&#39;s word. Useful for protocol references; never for product behaviour.', repositories.filter((fact) => origin(fact) === 'other'))}
<div class="mt-24">${callout('A repository is cloned into the working area (<code>~/Temco</code>) with its history, so a draft can name the commit it read. Nothing is ever pushed back.')}</div>`;
}

/**
 * *Repository* — one repository: its clone, what each read found, its own scripts, and the pages it declares.
 *
 * Every row here is a fact the platform owns — a row in the catalog, a file in the clone, or a script read from
 * the clone's own `package.json`. Nothing is inferred from the repository's name.
 */
function repositoryBody(fact: RepositoryFact | undefined): string {
	if (fact === undefined) {
		return `${pageHead({
			title: 'Repository',
			mark: 'repo',
			desc: 'No repository with that name is recorded in the platform database.',
			actions: button('All Repositories', 'temcoDocs.repositories', { kind: 'primary', mark: 'repo' })
		})}
<div class="mt-16">${callout('A repository is a source the catalog holds. If it was removed, its row is gone with it — the clone in the working area is not touched.')}</div>`;
	}

	const newest = fact.reads[0];
	const readRow = (read: ScanRow): string =>
		`<div class="record-row record-row--static">${toneMark('check', 'ok')}<div class="record-row__main"><div class="record-row__title"><span class="record-row__name cell-mono">${esc(read.revision ?? 'no revision')}</span><span class="tag">${esc(read.mode)}</span></div><div class="record-row__meta">${facts([waitingSince(read.at), readSummary(read.counts)])}</div></div><div class="record-row__state"></div><div></div></div>`;

	const scriptRow = (script: RepositoryScript): string =>
		`<div class="record-row">${toneMark('code')}<div class="record-row__main"><div class="record-row__title"><span class="record-row__name cell-mono">${esc(script.name)}</span></div><div class="record-row__meta"><span class="cell-mono">${esc(script.command)}</span></div></div><div class="record-row__state"></div>${button('Run', 'temcoDocs.runScript', { small: true, kind: 'ghost', args: [script.name] })}</div>`;

	const pageRow = (page: { id: string; title?: string; path?: string }): string =>
		`<div class="record-row" data-command="temcoDocs.page" data-args="${esc(JSON.stringify([page.id]))}">${toneMark('document')}<div class="record-row__main"><div class="record-row__title"><span class="record-row__name">${esc(page.title ?? page.id)}</span></div><div class="record-row__meta"><span class="cell-mono">${esc(page.path ?? page.id)}</span></div></div><div class="record-row__state"></div><span class="record-row__go">${icon('chevron-right', 'icon--sm')}</span></div>`;

	return `${pageHead({
		eyebrow: 'Repositories',
		title: fact.name,
		mark: 'repo',
		desc: `${fact.remoteUrl === undefined ? 'no remote recorded' : `<span class="cell-mono">${esc(fact.remoteUrl)}</span>`} · ${fact.cloned ? `cloned at <span class="cell-mono">${esc(fact.path ?? '')}</span>` : 'no local copy yet'}`,
		actions: button('Read Source', 'temcoRepositories.readSource', { kind: 'primary', mark: 'refresh', args: [fact.slug] })
			+ (fact.cloned ? button('Pull', 'temcoRepositories.pullSource', { mark: 'download', args: [fact.slug] }) + button('Open the Copy', 'temcoRepositories.openClone', { mark: 'folder', args: [fact.slug] }) : '')
			+ button('All Repositories', 'temcoDocs.repositories', { mark: 'repo' })
	})}
${tiles([
			{ value: String(fact.pages), label: fact.pages === 1 ? 'Page found' : 'Pages found' },
			{ value: String(fact.reads.length), label: fact.reads.length === 1 ? 'Read recorded' : 'Reads recorded' },
			{ value: String(fact.scripts.length), label: fact.scripts.length === 1 ? 'Doc script' : 'Doc scripts' },
			{ value: newest === undefined ? 'never' : waitingSince(newest.at), label: 'Last read' }
		])}
${fact.cloned ? '' : `<div class="mt-16">${callout('<b>Nothing is local yet.</b> Reading this repository clones it into the working area with its history; until then there is no code for a draft to read.', 'warn')}</div>`}
${fact.reads.length === 0
			? `<div class="mt-24">${callout('Nothing has been read from this repository yet. A read records the pages it declares and the commit it read them at; it never writes to the repository.')}</div>`
			: `<div class="mt-24">${group({
				label: 'Reads',
				count: `${fact.reads.length} ${fact.reads.length === 1 ? 'read' : 'reads'}`,
				note: 'Newest first, keyed by the commit each read saw — which is what explains a page later.',
				body: fact.reads.map(readRow).join('')
			})}</div>`}
${fact.scripts.length === 0
			? fact.cloned ? `<div class="mt-24">${callout(`<b>No documentation scripts.</b> The platform reads <code>${esc(fact.docsRoot ?? 'docs')}/</code> as files instead: a page is a file, and nothing in the repository runs.`)}</div>` : ''
			: `<div class="mt-24">${group({
				label: 'Scripts',
				count: `${fact.scripts.length} ${fact.scripts.length === 1 ? 'script' : 'scripts'}`,
				note: 'The repository&#39;s own vocabulary, read from its <code>package.json</code>. The platform calls these and nothing else.',
				body: fact.scripts.map(scriptRow).join('')
			})}</div>`}
${fact.pageRows.length === 0
			? ''
			: `<div class="mt-24">${group({
				label: 'Pages It Declares',
				count: `${fact.pageRows.length} ${fact.pageRows.length === 1 ? 'page' : 'pages'}`,
				note: 'What the last read recorded, as the catalog holds it. Pick one to read it.',
				body: fact.pageRows.slice(0, 40).map(pageRow).join('')
			})}</div>`}
<div class="mt-24">${rule({ label: 'Where It Lives' })}${settingsStrip([
			{ label: 'Remote', value: fact.remoteUrl ?? 'not recorded', mono: true },
			{ label: 'Working copy', value: fact.path ?? '—', mono: true },
			{ label: 'Branch', value: fact.branch ?? 'not recorded', mono: true },
			{ label: 'Default branch', value: fact.defaultBranch ?? 'not recorded', mono: true },
			{ label: 'Pages folder', value: `${fact.docsRoot ?? 'docs'}/`, mono: true },
			{ label: 'Catalog row', value: fact.slug, mono: true }
		])}</div>`;
}

/** What a read reported, in the one number a person looks for — or the JSON it was written as. */
function readSummary(counts: string | undefined): string {
	if (counts === undefined || counts.length === 0) {
		return 'no counts recorded';
	}
	try {
		const parsed = JSON.parse(counts) as Record<string, unknown>;
		const pages = parsed.pages;
		return typeof pages === 'number' ? `${pages} ${pages === 1 ? 'page' : 'pages'}` : counts;
	} catch {
		return counts;
	}
}

/**
 * *Sources* — the sources the catalog holds, and whether the working tree behind one is here.
 *
 * A source is a row in the database plus, when it is a repository, a clone in the working area: the row says
 * what a read found; the clone is what a draft reads code from.
 */
function sourcesBody(sources: readonly SourceRow[], roots: readonly DocsRoot[]): string {
	const reading = new Set(roots.map((root) => root.folder.name));
	const read = sources.filter((source) => (source.pages ?? 0) > 0);
	const pages = sources.reduce((total, source) => total + (source.pages ?? 0), 0);
	const pending = sources.filter((source) => (source.pages ?? 0) === 0);

	const labelOf = (kind: string): string => kind === 'git' ? 'Repository' : kind === 'folder' ? 'Folder' : kind === 'archive' ? 'Archive' : kind;
	const markFor = (kind: string): string => kind === 'git' ? 'repo' : kind === 'folder' ? 'folder' : 'package';

	const row = (source: SourceRow): string => {
		const here = reading.has(source.name);
		const items = [labelOf(source.kind)];
		if (source.branch !== undefined) {
			items.push(source.branch);
		}
		items.push(source.pages === undefined ? 'never read' : `${source.pages} ${source.pages === 1 ? 'page' : 'pages'} found`);
		items.push(here ? 'its working tree is open here' : 'not open in this window');
		if (source.state !== undefined) {
			items.push(source.state);
		}
		return `<div class="record-row">${toneMark(markFor(source.kind), here ? 'accent' : undefined)}<div class="record-row__main"><div class="record-row__title"><span class="record-row__name">${esc(source.name)}</span><span class="tag">${esc(source.slug)}</span></div><div class="record-row__meta">${facts(items)}</div></div><div class="record-row__state">${badge(here ? 'Here' : 'Recorded', here ? 'ok' : 'neutral')}</div>${button('Read', 'temcoRepositories.readSource', { small: true, kind: here ? 'primary' : 'ghost' })}</div>`;
	};

	const partition = (title: string, note: string, kinds: string[]): string => {
		const items = sources.filter((source) => kinds.includes(source.kind));
		if (items.length === 0) {
			return '';
		}
		return `<div class="mt-24">${group({ label: title, count: `${items.length} ${items.length === 1 ? 'source' : 'sources'}`, note, actions: items.length > 1 ? button('Read All', 'temcoRepositories.readAllSources', { small: true, kind: 'ghost', mark: 'refresh' }) : '', body: items.map(row).join('') })}</div>`;
	};

	return `${pageHead({
		title: 'Sources',
		mark: 'repo',
		desc: 'Everything a project reads: repositories, folders and archives. Reading a source is what puts pages in the knowledge base, and a repository is cloned locally so a draft can read its code.',
		actions: button('Add Source', 'temcoProjects.addSource', { kind: 'primary', mark: 'plus' }) + button('Repositories', 'temcoDocs.repositories', { mark: 'repo' })
	})}
${tiles([
			{ value: String(sources.length), label: sources.length === 1 ? 'Source' : 'Sources' },
			{ value: String(read.length), label: 'Read at least once' },
			{ value: String(pages), label: 'Pages found' },
			{ value: String(pending.length), label: 'Never read' }
		])}
${sources.length === 0
			? `<div class="mt-16">${callout('<b>No source yet.</b> A project reads sources — a repository, a folder of Markdown, a document. Adding one records it here; reading it fills in the pages it declares.')}</div>`
			: partition('Repositories', 'Cloned into the working area with full history and read by commit, so a draft can point at the commit it came from.', ['git'])
				+ partition('Folders', 'Read in place from disk — one read per file, no clone and no history. A folder that changed keeps its old pages until it is read again.', ['folder'])
				+ partition('Archives', 'Unpacked and read like a folder; the archive stays the only copy of what it held.', ['archive'])}
<div class="mt-24">${callout('Reading a source never edits it. The pages it finds are recorded in the platform database; the source stays the only copy of its own content.')}</div>`;
}

/** One area across every root being read, which is how the list draws it. */
interface AreaFact {
	name: string;
	title: string;
	pages: number;
	issues: number;
	neverReviewed: number;
	stale: number;
	roots: number;
}

function areaFacts(roots: readonly DocsRoot[]): AreaFact[] {
	const seen = new Map<string, AreaFact>();
	for (const root of roots) {
		for (const area of root.areas) {
			const stale = area.chapters.reduce(
				(total, chapter) => total + chapter.pages.filter((page) => page.provenance?.stale === true).length,
				0
			);
			const found = seen.get(area.area);
			if (found === undefined) {
				seen.set(area.area, {
					name: area.area,
					title: area.title || area.area,
					pages: area.pages,
					issues: area.issues,
					neverReviewed: area.neverReviewed,
					stale,
					roots: 1
				});
				continue;
			}
			found.pages += area.pages;
			found.issues += area.issues;
			found.neverReviewed += area.neverReviewed;
			found.stale += stale;
			found.roots += 1;
		}
	}
	return [...seen.values()].sort((one, other) => one.name.localeCompare(other.name));
}

/** What a page's row says: a file that has to be written, a problem, a review, or nothing yet. */
function stateOf(page: PageEntry): { text: string; tone?: string } {
	if (!page.exists) {
		return { text: 'No file', tone: 'warn' };
	}
	const errors = page.issues.filter((issue) => issue.severity === 'error').length;
	if (errors > 0) {
		return { text: `${errors} error${errors === 1 ? '' : 's'}`, tone: 'err' };
	}
	if (page.issues.length > 0) {
		return { text: `${page.issues.length} warning${page.issues.length === 1 ? '' : 's'}`, tone: 'warn' };
	}
	if (page.provenance?.stale === true) {
		return { text: 'Stale', tone: 'warn' };
	}
	return page.reviewed ? { text: 'Reviewed', tone: 'ok' } : { text: 'Never read', tone: 'info' };
}

/**
 * *Documents* — the pages the registries declare, grouped by area.
 *
 * The order is the registry's order, which is the order the site and the PDF ship in. A page that is in the
 * registry and has no file is shown rather than hidden: it is the page somebody still has to write.
 */
function documentsBody(roots: readonly DocsRoot[], areaName?: string): string {
	const pages = roots.flatMap((root) => collectPages(root));
	const areas = areaFacts(roots);
	const remembered = selection.page()?.id.split('/')[0];
	const open = areas.find((area) => area.name === areaName)
		?? areas.find((area) => area.name === remembered)
		?? areas[0];
	const inArea = open === undefined
		? []
		: pages.filter((page) => page.area === open.name).sort((one, other) => one.order - other.order);
	const reviewed = pages.filter((page) => page.reviewed !== null && page.reviewed !== undefined).length;
	const missing = pages.filter((page) => !page.exists).length;
	const problems = pages.reduce((total, page) => total + page.issues.length, 0);

	const areaRow = (area: AreaFact): string => {
		const read = Math.max(0, area.pages - area.neverReviewed);
		const pct = area.pages === 0 ? 0 : Math.round((read / area.pages) * 100);
		const isOpen = open !== undefined && area.name === open.name;
		const title = `${read} of ${area.pages} pages read${area.stale > 0 ? `, ${area.stale} stale` : ''}`;
		return `<div class="area-row${isOpen ? ' area-row--open' : ''}" data-command="temcoDocs.knowledge" data-args="${esc(JSON.stringify([area.name]))}" style="--coverage: ${pct}%" title="${esc(title)}">${icon(isOpen ? 'chevron-down' : 'chevron-right', 'icon--sm')}<span class="area-row__name">${esc(area.title)}</span><span class="area-row__pct">${pct}%</span><span class="area-row__stale">${area.stale > 0 ? badge(`${area.stale} stale`, 'warn') : ''}</span></div>`;
	};

	return `${pageHead({
		eyebrow: roots.length === 0 ? 'Nothing is being read' : roots.map((root) => root.folder.name).join(' · '),
		title: 'Documents',
		mark: 'book',
		desc: `${pages.length.toLocaleString('en-US')} pages in ${areas.length} ${areas.length === 1 ? 'area' : 'areas'}, ${reviewed.toLocaleString('en-US')} of them read by a person. The registry order is the order the documentation ships in, not the order the files sit on disk.`,
		actions: button('New Page', 'temcoDocs.newPage', { kind: 'primary', mark: 'plus' }) + button('Generate from Sources', 'temcoDocs.createPage', { mark: 'sparkle' }) + button('Open Tree', 'temcoDocs.pages.focus', { mark: 'sidebar', title: 'Show this content as a folder tree in the side bar' })
	})}
${tiles([
			{ value: pages.length.toLocaleString('en-US'), label: 'Pages' },
			{ value: String(reviewed), label: 'Read by a person' },
			{ value: String(missing), label: 'Registry, no file' },
			{ value: String(problems), label: 'Problems found' }
		])}
${roots.length === 0
			? `<div class="mt-16">${callout('<b>No registry is being read.</b> A page is a file the registry declares, so this list is empty until a source with a <code>docs/</code> folder is open in this window.')}</div>`
			: `<div class="know-wrap mt-24">
<div class="know-split">
${card({
				title: 'Areas',
				mark: 'book',
				plain: true,
				actions: button('Coverage & Health', 'temcoWorkbench.health', { small: true, kind: 'ghost' }),
				desc: 'Read is what a person signed off; stale is what the sources have outrun. Pick an area.',
				body: `<div class="area-list">${areas.map(areaRow).join('')}</div>`
			})}
${card({
				title: `Pages in ${open === undefined ? 'this project' : open.title}`,
				mark: 'document',
				plain: true,
				actions: button('Add Page', 'temcoDocs.newPage', { small: true, kind: 'ghost', mark: 'plus' }),
				desc: open === undefined ? 'Nothing to list yet.' : `${open.pages} pages · ${open.pages - open.neverReviewed} read · ${open.issues > 0 ? `${open.issues} problems` : 'no problems'} · ${open.stale > 0 ? `${open.stale} stale` : 'nothing stale'}. Order is the page order inside the area, not a file line. Pick a page to open it.`,
				body: inArea.length === 0
					? callout('This area declares no pages.')
					: table(
						['Order', 'Page', 'State'],
						inArea.map((page) => [
							`<span class="cell-mono">${page.order}</span>`,
							`<span class="cell-strong">${esc(page.title)}</span><div class="cell-muted" style="font-size:12px">${esc(page.chapter)} · ${esc(page.owner === '' ? 'no owner' : page.owner)} · ${page.provenance?.updated === null || page.provenance?.updated === undefined ? 'no history' : esc(page.provenance.updated)}</div>`,
							badge(stateOf(page).text, stateOf(page).tone)
						]),
						(index) => ({ command: 'temcoDocs.page', args: [inArea[index].id, inArea[index].area] })
					)
			})}
</div>
</div>
<div class="mt-24">${callout('A folder is a position in the content tree, not a directory on disk: <code>Hardware / Controllers / T3-8R</code>. The Documents container in the side bar is where folders are added, renamed and moved, and the order it shows is the order the site and the PDF use — this list is that order, flattened.')}</div>`}`;
}

/** What a Markdown line is, for the editor's own colours. */
function lineKind(line: string): 'h1' | 'h2' | 'list' | 'quote' | 'p' {
	if (/^#\s/.test(line)) {
		return 'h1';
	}
	if (/^#{2,6}\s/.test(line)) {
		return 'h2';
	}
	if (/^\s*([-*+]|\d+\.)\s/.test(line)) {
		return 'list';
	}
	if (/^>/.test(line)) {
		return 'quote';
	}
	return 'p';
}

/** The file, or nothing: a page whose file cannot be read is a page with no text, not an error page. */
async function readPageText(uri: vscode.Uri): Promise<string> {
	try {
		return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
	} catch {
		return '';
	}
}

/**
 * *Page* — one page as the registry holds it and as its file reads.
 *
 * The lines are the file's, one for one: the editor's colours are a Markdown reader's, not a renderer's, so what
 * a person sees here is what a build will read.
 */
async function pageBody(
	roots: readonly DocsRoot[],
	requested: string | undefined,
	areaName: string | undefined
): Promise<{ title: string; html: string }> {
	const pages = roots.flatMap((root) => collectPages(root));
	const page = pages.find((entry) => entry.id === requested)
		?? pages.find((entry) => entry.title === requested && (areaName === undefined || entry.area === areaName))
		?? pages.find((entry) => entry.title === requested);

	if (page === undefined) {
		const title = requested ?? 'Page';
		return {
			title,
			html: `${pageHead({
				title,
				mark: 'document',
				desc: 'No page with that name is in a registry this window is reading.',
				actions: button('New Page', 'temcoDocs.newPage', { kind: 'primary', mark: 'plus' }) + button('Documents', 'temcoDocs.documents', { mark: 'book' })
			})}
<div class="mt-16">${callout(`<b>${esc(title)}</b> is not declared by any registry on this machine, so there is no file, no owner and nothing to show.`)}</div>`
		};
	}

	const state = stateOf(page);
	const text = page.exists ? await readPageText(page.uri) : '';
	const lines = page.exists ? text.split(/\r?\n/) : [];
	if (lines.length > 0 && lines[lines.length - 1] === '') {
		lines.pop();
	}

	const tool = (label: string, title: string): string => button(label, 'temcoDocs.analyseSource', { small: true, kind: 'ghost', title });

	const editor = `<div class="md-editor"><div class="md-editor__bar">${tool('B', 'Bold')}${tool('I', 'Italic')}${tool('H2', 'Section heading')}${tool('• List', 'Bulleted list')}${tool('❝', 'Note')}${tool('</>', 'Code sample')}${tool('Link', 'Link to another page')}${tool('Image', 'Screenshot from the last read')}${tool('Table', 'Table with a header row')}<span class="toolbar__spacer"></span><span class="cell-muted" style="font-size:11px">Markdown · the build reads headings, code and links</span></div><div class="md-editor__body"><div class="md-editor__gutter">${lines.map((_line, index) => `<div>${index + 1}</div>`).join('')}</div><div class="md-editor__code">${lines.map((line) => `<div class="md-line md-line--${lineKind(line)}">${line.length === 0 ? '&nbsp;' : esc(line)}</div>`).join('')}</div></div><div class="md-editor__status"><span>Ln 1, Col 1</span><span>${lines.length} lines</span><span>Markdown</span><span>UTF-8</span><span>${esc(page.area)} · order ${page.order}</span></div></div>`;

	return {
		title: page.title,
		html: `${pageHead({
			eyebrow: `${page.area}${page.chapter === '' ? '' : ` / ${page.chapter}`} · order ${page.order} · ${page.id}`,
			title: page.title,
			mark: 'document',
			desc: 'The page as the registry holds it and the file as it reads. Saving the file changes the page; a draft is <b>New Page</b> → <b>Draft</b>, and it waits in the Review Center until a person settles it.',
			actions: page.exists
				? button('Open the File', 'temcoDocs.openFile', { kind: 'primary', mark: 'code', args: [page.uri.fsPath] }) + button('Draft a Change', 'temcoDocs.revisePage', { mark: 'sparkle', title: 'Ask the model for a revision, and settle it in the Review Center', args: [{ id: page.id, title: page.title }] }) + button('Validate', 'temcoDocs.validate', { mark: 'check' })
				: button('New Page', 'temcoDocs.newPage', { kind: 'primary', mark: 'plus' }) + button('Validate', 'temcoDocs.validate', { mark: 'check' })
		})}
${page.exists ? '' : `<div class="mt-16">${callout(`<b>The registry declares this page and there is no file for it.</b> Its id is <code>${esc(page.id)}</code>; the file belongs at <code>${esc(page.uri.fsPath)}</code>.`, 'warn')}</div>`}
<div class="mt-16">${settingsStrip([
			{ label: 'Area', value: page.area },
			{ label: 'Chapter', value: page.chapter === '' ? 'the area itself' : page.chapter },
			{ label: 'Order', value: String(page.order), mono: true },
			{ label: 'State', value: state.text },
			{ label: 'Owner', value: page.owner === '' ? 'nobody yet' : page.owner },
			{ label: 'Reviewed', value: page.reviewed ?? 'never' },
			{ label: 'Ships', value: page.ship ? 'yes' : 'no' }
		], true)}</div>
<div class="mt-24">${editor}</div>
<div class="mt-24 grid grid--2">
<div>${group({
		label: 'What the Checks Found',
		count: page.issues.length === 0 ? 'nothing' : `${page.issues.length} ${page.issues.length === 1 ? 'finding' : 'findings'}`,
		body: page.issues.length === 0
			? factRow('check', 'No structural problem', 'this page agrees with the registry and with the pages it links to')
			: page.issues.map((issue) => factRow(issue.severity === 'error' ? 'alert' : 'info', issue.severity, issue.message)).join('')
	})}</div>
<div>${group({
		label: 'Where It Comes From',
		count: page.provenance === undefined ? 'nothing recorded' : 'what the generator knows',
		body: page.provenance === undefined
			? factRow('info', 'No neighbour file', 'neither the history nor the headings could be read for this page')
			: factRow('edit', page.provenance.updated ?? 'no date recorded', page.provenance.git?.author === undefined ? 'no commit recorded' : `${page.provenance.git.author} · ${page.provenance.git.sha ?? 'no sha'}`)
				+ factRow('code', `${page.provenance.headings.length} headings`, page.provenance.code.length === 0 ? 'claims no code, so nothing can make it stale' : `judged against ${page.provenance.code.join(', ')}`)
				+ factRow(page.provenance.stale ? 'alert' : 'check', page.provenance.stale ? 'Stale' : 'Current', page.provenance.stale ? 'a code glob moved on after the last review' : 'nothing the page claims has changed since it was written')
	})}</div>
</div>
<div class="mt-24">${group({
		label: 'How a Page Reaches a Reader',
		count: '3 steps',
		body: factRow('edit', 'A person edits the file', `the page is the file at ${page.id}.md, so editing it is editing the page`)
			+ factRow('sparkle', 'Or a draft reaches it', 'New Page → Draft writes a proposal into the database and it waits in the Review Center until somebody accepts it')
			+ factRow('upload', 'A build and a release carry it', 'only then does the site, the CHM or the PDF show it')
		})}</div>
<div class="mt-16">${callout('This view is read-only. It shows the file as the build will read it — headings, lists, notes and code fence markers — rather than as a browser would render it.')}</div>`
	};
}

/**
 * *Source* — the files behind the pages, as the clone on this machine has them.
 *
 * Read-only: a page is changed by an edit and a release, never by editing a source behind its back.
 */
function sourceBody(fact: RepositoryFact | undefined): string {
	if (fact === undefined) {
		return `${pageHead({
			title: 'Source Explorer',
			mark: 'code',
			desc: 'No repository with that name is recorded in the platform database.',
			actions: button('All Repositories', 'temcoDocs.repositories', { kind: 'primary', mark: 'repo' })
		})}
<div class="mt-16">${callout('The Source Explorer reads a clone. A repository is added as a source and read, which puts a copy on this machine.')}</div>`;
	}

	const files = fact.files;
	const fileRow = (file: string): string =>
		`<div class="record-row" data-command="temcoDocs.openFile" data-args="${esc(JSON.stringify([path.join(fact.path ?? '', fact.docsRoot ?? 'docs', file)]))}">${toneMark('document')}<div class="record-row__main"><div class="record-row__title"><span class="record-row__name cell-mono">${esc(file)}</span></div><div class="record-row__meta"><span class="cell-mono">${esc(fact.docsRoot ?? 'docs')}/</span></div></div><div class="record-row__state"></div><span class="record-row__go">${icon('chevron-right', 'icon--sm')}</span></div>`;

	const newest = fact.reads[0];

	return `${pageHead({
		eyebrow: `Source · ${fact.name}`,
		title: 'Source Explorer',
		mark: 'code',
		desc: fact.cloned
			? 'The files behind the pages, as the clone has them. Read-only: a page is changed by an edit and a release, never by editing a source.'
			: 'This repository has no local copy, so there are no files to show.',
		actions: button('Read Again', 'temcoRepositories.readSource', { kind: 'primary', mark: 'refresh', args: [fact.slug] }) + button('Repository', 'temcoDocs.repository', { mark: 'repo', args: [fact.slug] })
	})}
${tiles([
			{ value: String(files.length), label: files.length === 1 ? 'Page file' : 'Page files' },
			{ value: String(fact.pages), label: 'Pages recorded' },
			{ value: newest?.revision ?? '—', label: 'Commit read' },
			{ value: newest === undefined ? 'never' : waitingSince(newest.at), label: 'Last read' }
		])}
${fact.cloned ? '' : `<div class="mt-16">${callout('<b>Nothing is local yet.</b> Reading the repository clones it into the working area; the files behind the pages are only there once it has.', 'warn')}</div>`}
${files.length === 0
			? fact.cloned ? `<div class="mt-24">${callout(`<b>No Markdown under <code>${esc(fact.docsRoot ?? 'docs')}/</code>.</b> The clone is there, but it declares no page files — so there is nothing for a read to record.`)}</div>` : ''
			: `<div class="mt-24">${group({
				label: 'Files',
				count: `${files.length} ${files.length === 1 ? 'file' : 'files'}`,
				actions: fact.path === undefined ? '' : button('Open the Folder', 'temcoRepositories.openClone', { small: true, kind: 'ghost', args: [fact.slug] }),
				note: `Markdown under <code>${esc(fact.docsRoot ?? 'docs')}/</code>, in the clone's own order. A page is one of these files.`,
				body: files.slice(0, 60).map(fileRow).join('')
			})}</div>`}
<div class="mt-24">${group({
			label: 'What a Read Does With These Files',
			count: '3 steps',
			body: factRow('search', 'Finds the headings', 'a heading with text under it becomes a page; a heading with nothing under it becomes a gap')
				+ factRow('document', 'Keeps the code samples', 'a fenced block in the source is quoted verbatim, so the page cannot drift from the code')
				+ factRow('link', 'Records the links', 'a link to another heading becomes an internal link, which is what the broken-link check reads')
		})}</div>
<div class="mt-16">${callout('A draft reads these files as evidence and cites them. Editing a file does not change a page on its own: the page is written, and the next read records what changed.')}</div>`;
}

/** *Review Center* — the drafts the platform is holding. The mock's queue, with the sample rows swapped for real ones. */
function reviewBody(drafts: readonly DraftRow[], project: string | undefined): string {
	const waiting = drafts.length;
	const fromSources = drafts.filter((draft) => draft.source !== undefined).length;
	const proposed = new Set(drafts.map((draft) => draft.pageId)).size;
	const newest = drafts[0];

	const row = (draft: DraftRow): string => {
		const isOpen = draft === newest;
		const items = [
			draft.pageId,
			`written ${waitingSince(draft.createdAt)}`,
			draft.source === undefined ? 'no source' : `read from ${draft.source}`
		];
		return `<div class="record-row${isOpen ? ' record-row--current' : ''}">${toneMark('sparkle', 'accent')}<div class="record-row__main"><div class="record-row__title"><span class="record-row__name">${esc(draft.title)}</span>${isOpen ? '<span class="cell-muted" style="font-size:12px">open below</span>' : ''}</div><div class="record-row__meta">${facts(items)}</div></div><div class="record-row__state">${badge(draft.kind || 'Draft', 'info')}</div><div style="display:flex;gap:6px;align-items:center">${button('Accept', 'temcoDocs.acceptDraft', { small: true, kind: isOpen ? 'primary' : 'ghost', args: [draft.id] })}${button('Discard', 'temcoDocs.discardDraft', { small: true, kind: 'ghost', args: [draft.id] })}</div></div>`;
	};

	return `${pageHead({
		title: 'Review Center',
		mark: 'check',
		desc: `${project === undefined ? 'No project is selected' : `Every draft <b>${esc(project)}</b> is holding`}, newest first. Accepting one writes the page exactly as it reads; discarding one throws the text away. Either way nothing reaches a reader until a build and a release carry it.`,
		actions: button('New Page', 'temcoDocs.newPage', { kind: 'primary', mark: 'plus' }) + button('Refresh', 'temcoDocs.review', { mark: 'refresh' })
	})}
${tiles([
		{ value: String(waiting), label: waiting === 1 ? 'Draft waiting' : 'Drafts waiting' },
		{ value: String(proposed), label: proposed === 1 ? 'Page proposed' : 'Pages proposed' },
		{ value: String(fromSources), label: 'Read from a source' },
		{ value: newest === undefined ? '—' : waitingSince(newest.createdAt), label: 'Newest' }
	])}
${waiting === 0
			? `<div class="mt-16">${callout('<b>Nothing is waiting.</b> A draft is written by <b>New Page</b> → <b>Draft</b>; it lands here until somebody accepts or discards it, and a draft that is never settled never becomes a page.')}</div>`
			: `<div class="mt-24">
${card({
				title: 'Queue',
				mark: 'check',
				plain: true,
				desc: `${waiting} ${waiting === 1 ? 'draft' : 'drafts'} waiting${fromSources > 0 ? `, ${fromSources} of them written from a source` : ''}. Newest first; the one open below carries its age on the line.`,
				body: `<div class="record-list">${drafts.map(row).join('')}</div>`
			})}
</div>`}
${newest === undefined ? '' : `<div class="mt-24">
${card({
			title: `Open draft · ${newest.title}`,
			mark: 'sparkle',
			plain: true,
			actions: badge(newest.kind || 'Draft', 'info') + badge(`${newest.body.split('\n').length} lines`, 'neutral'),
			desc: `Proposed for <code>${esc(newest.pageId)}</code>${newest.source === undefined ? '' : `, written from <code>${esc(newest.source)}</code>`}, ${waitingSince(newest.createdAt)}. Accepting writes the page exactly as it reads here; discarding keeps the page as it was and settles the draft.`,
			body: `<div style="padding-top:10px"><pre class="code" style="max-height:420px">${esc(newest.body)}</pre></div>`,
			foot: button('Accept', 'temcoDocs.acceptDraft', { small: true, kind: 'primary', mark: 'check', args: [newest.id] }) + button('Discard', 'temcoDocs.discardDraft', { small: true, mark: 'close', args: [newest.id] }) + '<span>accepting writes the page · discarding settles the draft</span>'
		})}
</div>`}
<div class="mt-24">${group({
			label: 'What Settling a Draft Does',
			count: '3 steps',
			body: factRow('check', 'Accepting writes the page', 'the draft becomes the file at the id it proposed, and the row is settled as accepted')
				+ factRow('document', 'The text stays as evidence', 'it remains in the database as an accepted draft, so what a page was written from survives the write')
				+ factRow('upload', 'Only a release reaches a reader', 'a build and a publish, in that order')
		})}</div>
<div class="mt-16">${callout('A draft is a proposal, not a page. It belongs to the project it was written for and remembers the source it read, and it leaves this queue the moment a person settles it.')}</div>`;
}

/** How long a draft has been waiting, in words a reviewer reads at a glance. */
function waitingSince(iso: string): string {
	const at = new Date(iso).getTime();
	if (Number.isNaN(at)) {
		return 'just now';
	}
	const minutes = Math.floor((Date.now() - at) / 60_000);
	if (minutes < 1) {
		return 'just now';
	}
	if (minutes < 60) {
		return `${minutes} min ago`;
	}
	const hours = Math.floor(minutes / 60);
	if (hours < 24) {
		return `${hours} h ago`;
	}
	const days = Math.floor(hours / 24);
	return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** *Build Center* — what the catalog recorded, which is every build a person started from here. */
function buildsBody(facts1: BuildFacts): string {
	const { project, builds, artifacts } = facts1;
	const succeeded = builds.filter((build) => build.status === 'succeeded').length;
	const running = builds.filter((build) => build.status === 'running').length;

	const buildRow = (build: BuildRow): string =>
		`<div class="record-row record-row--static">${toneMark('play', build.status === 'succeeded' ? 'ok' : undefined)}<div class="record-row__main"><div class="record-row__title"><span class="record-row__name cell-mono">#${build.id}</span>${build.revision === undefined ? '' : `<span class="tag">${esc(build.revision)}</span>`}</div><div class="record-row__meta">${facts([`started ${waitingSince(build.startedAt)}`, build.finishedAt === undefined ? 'no finish recorded' : `finished ${waitingSince(build.finishedAt)}`, `${artifacts.length === 0 ? 'no artifacts' : 'see artifacts below'}`])}</div></div><div class="record-row__state">${badge(build.status, build.status === 'succeeded' ? 'ok' : build.status === 'running' ? 'info' : 'warn')}</div><div></div></div>`;

	const artifactRow = (artifact: ArtifactFact): string =>
		`<div class="record-row">${toneMark(artifact.kind === 'chm' ? 'package' : artifact.kind === 'pdf' ? 'document' : 'globe')}<div class="record-row__main"><div class="record-row__title"><span class="record-row__name cell-mono">${esc(artifact.path.split(/[\\/]/).pop() ?? artifact.path)}</span><span class="tag">${esc(artifactLabel(artifact.kind))}</span></div><div class="record-row__meta"><span class="cell-mono">${esc(artifact.path)}</span><span>built ${waitingSince(artifact.builtAt)}</span></div></div><div class="record-row__state"></div>${button('Open', 'temcoDocs.openArtifact', { small: true, kind: 'ghost', args: [artifact.path] })}</div>`;

	return `${pageHead({
		eyebrow: project === undefined ? 'No project selected' : `${esc(project)} · builds`,
		title: 'Build Center',
		mark: 'play',
		desc: 'A build is the repository&#39;s own script, run as a task and then judged by what it left: the attempt, its exit code and every file that appeared are recorded here.',
		actions: button('Build Site', 'temcoDocs.buildSite', { kind: 'primary', mark: 'play' }) + button('Build Offline Help', 'temcoDocs.buildHelp', { mark: 'package' }) + button('Refresh', 'temcoDocs.builds', { mark: 'refresh' })
	})}
${tiles([
		{ value: String(builds.length), label: builds.length === 1 ? 'Build recorded' : 'Builds recorded' },
		{ value: String(succeeded), label: 'Left an artifact' },
		{ value: String(artifacts.length), label: artifacts.length === 1 ? 'Artifact' : 'Artifacts' },
		{ value: running > 0 ? String(running) : '—', label: 'Running now' }
	])}
${builds.length === 0
			? `<div class="mt-16">${callout('<b>No build has run here yet.</b> Building runs the repository&#39;s own script (<code>docs:site</code>, <code>build:help:dry</code>) as a task and then looks for the file it should have written. The exit code is printed, never believed.')}</div>`
			: `<div class="mt-24">
${card({
				title: 'Builds',
				mark: 'play',
				plain: true,
				desc: 'Newest first. A row is opened before the script runs, so a build that crashed the editor is still here.',
				body: `<div class="record-list">${builds.map(buildRow).join('')}</div>`
			})}
</div>`}
${artifacts.length === 0
			? ''
			: `<div class="mt-24">
${card({
				title: 'Artifacts',
				mark: 'download',
				plain: true,
				desc: 'Every file a build left behind, newest first. A file that is here is a file a reader can be given.',
				body: `<div class="record-list">${artifacts.map(artifactRow).join('')}</div>`,
				foot: '<span>recorded in the platform database · the files stay where the build wrote them</span>'
			})}
</div>`}`;
}

/** *Releases* — what a build left behind, grouped by what it is. The files are the release. */
function releasesBody(facts1: BuildFacts): string {
	const { project, artifacts, releases } = facts1;
	const kinds = [...new Set(artifacts.map((artifact) => artifact.kind))];

	const releaseRow = (release: ReleaseRow): string =>
			`<div class="record-row record-row--static">${toneMark('upload', 'ok')}<div class="record-row__main"><div class="record-row__title"><span class="record-row__name cell-mono">${esc(release.version)}</span>${release.buildId === undefined ? '' : `<span class="tag">build #${release.buildId}</span>`}</div><div class="record-row__meta">${facts([`published ${waitingSince(release.publishedAt)}`, `${release.files} ${release.files === 1 ? 'file' : 'files'}`, release.destination])}</div></div><div class="record-row__state">${badge('Published', 'ok')}</div><div style="display:flex;gap:6px;align-items:center">${button('Serve', 'temcoDocs.servePublished', { small: true, kind: 'ghost', args: [release.destination] })}${button('Open', 'temcoDocs.openPublished', { small: true, kind: 'ghost', args: [release.destination] })}</div></div>`;

	const fileRow = (file: ArtifactFact): string =>
		`<div class="record-row">${toneMark(file.kind === 'chm' ? 'package' : file.kind === 'pdf' ? 'document' : 'globe')}<div class="record-row__main"><div class="record-row__title"><span class="record-row__name cell-mono">${esc(file.path.split(/[\\/]/).pop() ?? file.path)}</span></div><div class="record-row__meta"><span class="cell-mono">${esc(file.path)}</span><span>built ${waitingSince(file.builtAt)}</span></div></div><div class="record-row__state"></div>${button('Open', 'temcoDocs.openArtifact', { small: true, kind: 'ghost', args: [file.path] })}</div>`;

	const section = (kind: string): string => {
		const files = artifacts.filter((artifact) => artifact.kind === kind);
		return `<div class="mt-24">
${card({
			title: artifactLabel(kind),
			mark: kind === 'chm' ? 'package' : kind === 'pdf' ? 'document' : 'globe',
			plain: true,
			desc: `${files.length} file${files.length === 1 ? '' : 's'}, newest first. This is what a reader downloads: nothing is copied, the path is the release.`,
			body: `<div class="record-list">${files.map(fileRow).join('')}</div>`
		})}
</div>`;
	};

	return `${pageHead({
		title: 'Releases',
		mark: 'upload',
		desc: 'A release is what a build left that a reader can be given: the website, the offline help, the PDF, the search index. Publishing copies the site where it can be opened; serving it puts it on loopback so its own links resolve.',
		actions: button('Publish', 'temcoDocs.publishRelease', { kind: 'primary', mark: 'upload' }) + button('Serve the Newest', 'temcoDocs.servePublished', { mark: 'radio-tower' }) + button('Build Site', 'temcoDocs.buildSite', { mark: 'play' }) + button('Build Offline Help', 'temcoDocs.buildHelp', { mark: 'package' })
	})}
${tiles([
			{ value: project ?? '—', label: 'Project' },
			{ value: String(releases.length), label: releases.length === 1 ? 'Version published' : 'Versions published' },
			{ value: String(artifacts.length), label: artifacts.length === 1 ? 'Artifact' : 'Artifacts' },
			{ value: String(kinds.length), label: kinds.length === 1 ? 'Kind of file' : 'Kinds of file' }
		])}
${releases.length === 0
			? ''
			: `<div class="mt-24">${group({
				label: 'Published Versions',
				count: `${releases.length} ${releases.length === 1 ? 'version' : 'versions'}`,
				note: 'Each one is a copy of a build, in a folder the platform owns. A new version is a new row; an old one is never rewritten.',
				body: releases.map(releaseRow).join('')
			})}</div>`}
${artifacts.length === 0
			? `<div class="mt-16">${callout('<b>Nothing to release yet.</b> A release is not a state the platform sets: it is the files a build wrote. Build the site or the offline help, and everything that appeared is listed here — a Learn site to publish, a CHM or a PDF to download.')}</div>`
			: kinds.map(section).join('')}
<div class="mt-24">${group({
			label: 'What Publishing Does',
			count: '3 facts',
			body: factRow('upload', 'Copies the site', 'the files a build wrote, into a folder the platform owns — nothing is uploaded anywhere')
				+ factRow('document', 'Records the release', 'version, build, destination and date, so "when did 13.0 go out" is a query rather than a memory')
				+ factRow('check', 'Leaves the old one alone', 'a new version is a new row beside the last one; no published file is ever rewritten in place')
		})}</div>
<div class="mt-16">${callout('A downloadable CHM or PDF needs no publishing at all — it is a file the build wrote. Publishing is for the site: it puts the same pages in one folder with an entry point, which is what a Learn site is here.')}</div>`;
}

/** The words for an artifact's kind, in the order a build produces them. */
function artifactLabel(kind: string): string {
	return kind === 'chm' ? 'Offline help (CHM)' : kind === 'pdf' ? 'PDF' : kind === 'site' ? 'Website' : kind === 'search' ? 'Search index' : kind;
}

/** *How To Use* — the mock's `docs/how-to`. */
function howToBody(): string {
	const step = (n: number, title: string, text: string, detail: string, label: string, command: string): string =>
		`<div class="howto__row"><span class="howto__n">${n}</span><div class="howto__main"><div class="howto__title">${esc(title)}</div><p class="howto__text">${text}</p><details class="disclosure howto__more"><summary>What happens underneath</summary><div class="howto__detail">${detail}</div></details></div><div class="howto__do">${button(label, command, { small: true, kind: 'ghost' })}</div></div>`;

	const question = (q: string, a: string): string => `<details class="howto__q"><summary>${esc(q)}</summary><div class="howto__a">${a}</div></details>`;

	const railStep = (n: string, title: string, hint: string, command: string): string =>
		`<button type="button" class="howto-rail__step" data-command="${command}"><span class="howto-rail__n">${n}</span><span class="howto-rail__title">${esc(title)}</span><span class="howto-rail__hint">${esc(hint)}</span></button>`;

	const linkRow = (mark: string, title: string, note: string, command: string): string =>
		`<div class="record-row" data-command="${command}">${toneMark(mark)}<div class="record-row__main"><div class="record-row__title"><span class="record-row__name">${esc(title)}</span></div><div class="record-row__meta"><span>${esc(note)}</span></div></div><div class="record-row__state"></div><span class="record-row__go">${icon('chevron-right', 'icon--sm')}</span></div>`;

	return `${pageHead({
		title: 'How To Use',
		mark: 'graduation',
		desc: 'From a repository to a page a reader can open, in five steps.',
		actions: button('Open Documents', 'temcoDocs.documents', { kind: 'primary', mark: 'book' }) + button('Ask the AI', 'temcoAi.openPanel', { mark: 'sparkle' })
	})}
<div class="howto-rail">
${railStep('01', 'Pick a project', '13.0 is current', 'temcoDocs.projects')}
${railStep('02', 'Add a source', 'a repo or a library', 'temcoDocs.sources')}
${railStep('03', 'Read it', 'files become pages', 'temcoDocs.sources')}
${railStep('04', 'Edit and review', 'one approval', 'temcoDocs.documents')}
${railStep('05', 'Build and publish', 'readers get it', 'temcoDocs.builds')}
</div>
${rule({ label: 'Each Step, In Full', count: 'about 10 minutes' })}
<div class="howto">
${step(1, 'Choose the project', 'A project is one version of a product’s documentation — <strong>13.0</strong> is the current one. Everything below happens inside it.', '<p>The text stays in the repositories you already own. The project keeps only the choices around it: version, audience, owner and where it publishes. Two versions of the same repository therefore share files but never share pages.</p>', 'Projects', 'temcoDocs.projects')}
${step(2, 'Say where the text comes from', 'A repository you have cloned, or a connected library. Adding a source records <code>where to read</code>; it copies nothing.', '<p>A repository is read at a commit, a connected library at a version. The commit is kept with every read, so a page can always name the exact file and revision it came from.</p>', 'Sources', 'temcoDocs.sources')}
${step(3, 'Read it', 'Reading turns files into pages. A file becomes a page, its heading becomes the name, its folder becomes the <strong>area</strong>, and its order in the file becomes the reading order.', '<p>A read writes <code>docs/help/registry.json</code> inside a repository, and <code>docs/index.json</code> for a connected library. Files that did not change are skipped, so a second read is quick, and a page written by hand in the window is never overwritten by a read.</p>', 'Read Now', 'temcoRepositories.readAllSources')}
${step(4, 'Open, edit and review', 'Open a page from the Docs Explorer tree or the Documents list, edit it in the page editor and save. The change waits in Review Center until someone approves it.', '<p>Every page carries an area, an order, an owner and the source it came from. Two pages cannot share an order inside one area — the build reports it as an error — and <strong>17</strong> pages are waiting for review right now.</p>', 'Documents', 'temcoDocs.documents')}
${step(5, 'Build, then publish', 'A build turns approved pages into the artifacts readers get: the website, the PDF, the offline CHM, the search index and the AI index. Publishing points Temco Learn at one build.', '<p>The AI index never blocks a build: a slow embedding pass delays answers, not readers. A published version is frozen, so a correction after release starts the next version rather than rewriting a link someone already sent.</p>', 'Build Center', 'temcoDocs.builds')}
</div>
<div class="mt-24">
${rule({ label: 'Questions That Come Up', count: '5 answers' })}
<div class="howto__faq">
${question('I edited a page — why has the site not changed?', 'Saving edits the page in the registry; the site reads a <em>build</em>. Run Build Center, then publish, and the page is on Temco Learn. Until then the edit is visible here and in review, and nowhere else.')}
${question('Do I lose a hand-written page when the source is read again?', 'No. A read only writes pages for files that changed, and leaves pages that were written in this window alone — <code>docs/scale-factor.md</code> is one of them.')}
${question('Two pages have the same order. What now?', 'The build refuses it as an error. Open one of the two pages, change its order in the facts strip, and build again; Review Center lists the pair so you do not have to search for it.')}
${question('Where does the text actually live?', 'The pages live in the registry — the platform database — and the files stay in the repository untouched. SQL Studio queries that same database, which is why its numbers match the dashboard.')}
${question('Can I publish the site without the PDF?', 'A build produces the targets you tick. A release publishes the artifacts it includes, so a version can ship the website and the search index on its own and add the PDF later.')}
</div>
</div>
<div class="mt-24">
${rule({ label: 'Where the Rest Lives', count: '5 pages' })}
<div class="record-list">
${linkRow('folder', 'Projects', 'the versions, their sources and what each one publishes', 'temcoDocs.projects')}
${linkRow('link', 'Sources', 'repositories and connected libraries, and when each was last read', 'temcoDocs.sources')}
${linkRow('check', 'Review Center', 'the 17 changes waiting for an approval', 'temcoDocs.review')}
${linkRow('play', 'Build Center', 'the targets and the errors that block them', 'temcoDocs.builds')}
${linkRow('upload', 'Releases', 'published versions, and the one still in flight', 'temcoDocs.releases')}
</div>
</div>`;
}
