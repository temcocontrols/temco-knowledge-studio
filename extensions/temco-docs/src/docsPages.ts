// The Documentation module's pages, rebuilt from the mock.
//
// Source: `docs/mock/js/views.docs.js` — the eleven surfaces the Documentation container has (Projects,
// Repositories, a repository, Sources, Documents, a page, a source, Review Center, Build Center, Releases,
// How To Use). The markup, the groups, the words and the order are the mock's; what changes is the data, which
// is the mock's own sample (`mockDocs.ts`), and the actions, which are this module's real commands.

import * as vscode from 'vscode';
import {
	AREA_PAGES, AREAS, BUILD_LOG, BUILDS, PROJECTS, READS, RELEASES, REPOSITORIES, REVIEWS, SOURCES,
	SOURCE_CODE, SOURCE_FILES, Area, PageRow, Repository
} from './mockDocs';
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

const hero = (options: { tone?: string; eyebrow?: string; title: string; desc?: string; actions?: string }): string =>
	`<div class="hero-panel${options.tone && options.tone !== 'accent' ? ` hero-panel--${options.tone}` : ''}">${options.eyebrow ? `<div class="eyebrow">${esc(options.eyebrow)}</div>` : ''}<div class="hero-panel__title">${esc(options.title)}</div>${options.desc ? `<p class="hero-panel__desc">${options.desc}</p>` : ''}${options.actions ? `<div class="hero-panel__actions">${options.actions}</div>` : ''}</div>`;

const card = (options: { title: string; mark?: string; actions?: string; desc?: string; body?: string; foot?: string; plain?: boolean }): string =>
	`<div class="card${options.plain ? ' card--plain' : ''}"><div class="card__head">${options.mark ? `<span class="card__icon">${icon(options.mark)}</span>` : ''}<div class="card__title">${esc(options.title)}</div>${options.actions ? `<div class="card__actions">${options.actions}</div>` : ''}</div>${options.desc ? `<p class="card__desc">${options.desc}</p>` : ''}${options.body ?? ''}${options.foot ? `<div class="card__foot">${options.foot}</div>` : ''}</div>`;

const badge = (text: string, tone?: string): string =>
	`<span class="badge${tone && tone !== 'neutral' ? ` badge--${tone}` : ''}">${esc(text)}</span>`;

const list = (items: { mark: string; title: string; sub: string; meta?: string }[]): string =>
	`<div class="list">${items.map((item) => `<div class="list__item">${icon(item.mark)}<div class="list__main"><div class="list__title">${esc(item.title)}</div><div class="list__sub">${item.sub}</div></div>${item.meta ? `<div class="list__meta">${item.meta}</div>` : ''}</div>`).join('')}</div>`;

const bar = (pct: number, kind?: string): string =>
	`<div class="bar"><span class="bar__fill${kind ? ` bar__fill--${kind}` : ''}" style="width:${pct}%"></span></div>`;

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

/** The module's pages: one panel per surface, kept open so a second visit reveals the tab. */
export class DocsPages {
	private readonly panels = new Map<string, vscode.WebviewPanel>();

	constructor(private readonly context: vscode.ExtensionContext) { }

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
		this.open('projects', PROJECTS_VIEW_TYPE, 'Projects', projectsBody());
	}

	repositories(): void {
		this.open('repositories', REPOSITORIES_VIEW_TYPE, 'Repositories', repositoriesBody());
	}

	repository(name?: string): void {
		const repo = REPOSITORIES.find((candidate) => candidate.name === name) ?? REPOSITORIES[0];
		this.open(`repository:${repo.name}`, REPOSITORY_VIEW_TYPE, repo.name, repositoryBody(repo));
	}

	sources(): void {
		this.open('sources', SOURCES_VIEW_TYPE, 'Sources', sourcesBody());
	}

	documents(area?: string): void {
		this.open('documents', DOCUMENTS_VIEW_TYPE, 'Areas', documentsBody(area));
	}

	pageOf(title?: string, area?: string): void {
		const name = title ?? 'Data Points API';
		this.open(`page:${name}`, PAGE_VIEW_TYPE, name, pageBody(name, area));
	}

	source(repo?: string): void {
		const name = repo ?? REPOSITORIES[0].name;
		this.open(`source:${name}`, SOURCE_VIEW_TYPE, 'Source Explorer', sourceBody(name));
	}

	review(): void {
		this.open('review', REVIEW_VIEW_TYPE, 'Review Center', reviewBody());
	}

	builds(): void {
		this.open('builds', BUILDS_VIEW_TYPE, 'Build Center', buildsBody());
	}

	releases(): void {
		this.open('releases', RELEASES_VIEW_TYPE, 'Releases', releasesBody());
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

/** *Projects* — the mock's `docs/projects`. */
function projectsBody(): string {
	const current = PROJECTS[0];

	const row = (project: typeof PROJECTS[number], isCurrent: boolean): string =>
		`<div class="record-row${isCurrent ? ' record-row--current' : ''}" data-command="temcoDocs.documents">${toneMark(isCurrent ? 'layers' : 'folder', isCurrent ? 'accent' : undefined)}<div class="record-row__main"><div class="record-row__title"><span class="record-row__name">${esc(project.name)}</span>${isCurrent ? badge('Current', 'accent') : ''}</div><div class="record-row__meta">${facts([`v${project.version}`, project.audience, project.owner, `${project.pages} pages`, `${project.sources} sources`, `updated ${project.updated}`])}</div></div><div class="record-row__state">${badge(project.state, project.tone)}</div><span class="record-row__go">${icon('chevron-right', 'icon--sm')}</span></div>`;

	return `${pageHead({
		title: 'Projects',
		mark: 'folder',
		desc: 'A project is a version of a product&#39;s documentation: its sources, its pages and the artifacts it builds.',
		actions: button('New Project', 'temcoProjects.newProject', { kind: 'primary', mark: 'plus' }) + button('Import', 'temcoProjects.addSource', { mark: 'download' })
	})}
<div class="record-list">${PROJECTS.map((project, index) => row(project, index === 0)).join('')}</div>
<div class="mt-24">
${card({
		title: 'Sources of This Project',
		mark: 'repo',
		plain: true,
		actions: button('All Sources', 'temcoDocs.sources', { small: true, kind: 'ghost' }),
		desc: `What ${esc(current.name)} reads. Reading a source is what puts pages in the knowledge base; it never writes to the source.`,
		body: list(SOURCES.slice(0, 4).map((source) => ({
			mark: source.kind === 'Repository' ? 'repo' : 'document',
			title: source.name,
			sub: `<span class="cell-muted">${source.pages ? `${source.pages} pages` : 'not read'}</span>`,
			meta: badge(source.state, source.tone)
		})))
	})}
</div>
<div class="mt-24">
${card({
		title: 'Project Settings',
		mark: 'gear',
		plain: true,
		actions: button('Edit Settings', 'temcoWorkbench.settings', { small: true, kind: 'ghost' }),
		desc: 'Stored in the platform database, not in the repository.',
		body: settingsStrip([
			{ label: 'Version', value: '13.0', mono: true },
			{ label: 'Areas', value: '8' },
			{ label: 'Build Targets', value: 'Website · PDF · CHM · Search · AI index' },
			{ label: 'Publishes To', value: 'Temco Learn · /t3000/13.0/' }
		])
	})}
</div>`;
}

/** *Repositories* — the mock's `docs/repositories`. */
function repositoriesBody(): string {
	const cloned = REPOSITORIES.filter((repo) => repo.state === 'Cloned');
	const files = REPOSITORIES.reduce((total, repo) => total + repo.files, 0);
	const pages = REPOSITORIES.reduce((total, repo) => total + repo.pages, 0);

	const row = (repo: Repository): string => {
		const isOpen = repo.state === 'Cloned';
		const items = [repo.remote, `${repo.branch} of ${repo.branches} branches`];
		if (isOpen) {
			items.push(`${repo.files.toLocaleString('en-US')} files`, `${repo.pages} pages`, `read ${repo.read}`);
			if (repo.owner !== '—') {
				items.push(repo.owner);
			}
		} else {
			items.push('no local copy');
		}
		return `<div class="record-row${isOpen ? '' : ' record-row--static'}"${isOpen ? ` data-command="temcoDocs.repository" data-args="${esc(JSON.stringify([repo.name]))}"` : ''}>${toneMark('repo', repo.temco ? 'accent' : undefined)}<div class="record-row__main"><div class="record-row__title"><span class="record-row__name">${esc(repo.name)}</span></div><div class="record-row__meta">${facts(items)}</div></div><div class="record-row__state">${badge(repo.state, repo.tone)}</div>${isOpen ? `<span class="record-row__go">${icon('chevron-right', 'icon--sm')}</span>` : button('Clone', 'temcoRepositories.page', { small: true })}</div>`;
	};

	const partition = (title: string, note: string, items: Repository[], actions: string): string =>
		items.length === 0 ? '' : `<div class="mt-24">${group({ label: title, count: `${items.length} ${items.length === 1 ? 'repository' : 'repositories'}`, note, actions, body: items.map(row).join('') })}</div>`;

	const temco = REPOSITORIES.filter((repo) => repo.temco);
	const thirdParty = REPOSITORIES.filter((repo) => !repo.temco);
	const missing = temco.filter((repo) => repo.state !== 'Cloned').length;

	return `${pageHead({
		title: 'Repositories',
		mark: 'repo',
		desc: 'The repositories this workspace reads, and whether their local copy is here. Reading a repository records the pages it declares; it never writes to it.',
		actions: button('Add Repository', 'temcoRepositories.page', { kind: 'primary', mark: 'plus' })
	})}
${tiles([
		{ value: String(REPOSITORIES.length), label: 'Repositories' },
		{ value: String(cloned.length), label: 'Cloned locally' },
		{ value: files.toLocaleString('en-US'), label: 'Files' },
		{ value: String(pages), label: 'Pages found' }
	])}
${partition('From Temco', 'Temco publishes these under <b class="cell-mono">github.com/temcocontrols</b>. They are the sources the platform ships documentation for, so their pages carry product names, register maps and firmware behaviour that Temco stands behind.', temco, (missing ? button(`Clone ${missing} Missing`, 'temcoRepositories.page', { small: true, kind: 'primary', mark: 'download' }) : '') + button('Read All', 'temcoRepositories.readAllSources', { small: true, kind: 'ghost', mark: 'refresh' }))}
${partition('Third-party', 'Read exactly like a Temco repository — same clone, same read, same pages — but nothing in one is Temco&#39;s word. Useful for protocol references; never for product behaviour.', thirdParty, button('Read All', 'temcoRepositories.readAllSources', { small: true, kind: 'ghost', mark: 'refresh' }))}
<div class="mt-24">${callout('A repository is cloned into the working area (<code>~/Temco</code>) with full history, so a draft can be about a commit. Nothing is ever pushed back.')}</div>`;
}

/** *Repository* — the mock's `docs/repository`, for the repository the row named. */
function repositoryBody(repo: Repository): string {
	const reads = READS.filter((read) => read.repo === repo.name);
	const cloned = repo.state === 'Cloned';
	const readOf = (branch: string) => reads.find((read) => read.branch === branch);
	const commitOf = (branch: string) => readOf(branch)?.commit ?? '—';

	const branches = cloned && repo.branchNames.length > 0
		? group({
			label: 'Branches',
			count: repo.branchNames.length === repo.branches ? `${repo.branchNames.length} branches` : `${repo.branchNames.length} of ${repo.branches} branches listed`,
			note: 'The copy has every branch; a read uses one of them, and a read is keyed by the commit it read.',
			body: repo.branchNames.map((name) => {
				const checkedOut = name === repo.branch;
				const read = readOf(name);
				return `<div class="record-row">${toneMark('branch', checkedOut ? 'accent' : undefined)}<div class="record-row__main"><div class="record-row__title"><span class="record-row__name cell-mono">${esc(name)}</span>${checkedOut ? '<span class="cell-muted">the one reads use by default</span>' : ''}</div><div class="record-row__meta"><span>${read ? `read ${esc(read.when)}` : 'never read'}</span><span class="cell-mono">${esc(checkedOut ? repo.head : commitOf(name))}</span></div></div><div class="record-row__state">${checkedOut ? badge('Checked out', 'accent') : ''}</div>${button('Read', 'temcoRepositories.readSource', { small: true, kind: 'ghost' })}</div>`;
			}).join('')
		})
		: '';

	const readRows = reads.length > 0
		? group({
			label: 'Reads',
			count: `${reads.length} ${reads.length === 1 ? 'read' : 'reads'}`,
			note: 'What each read found, keyed by the commit it read, so a change on the wire can be explained later.',
			body: reads.map((read) => `<div class="record-row record-row--static">${toneMark('check', 'ok')}<div class="record-row__main"><div class="record-row__title"><span class="record-row__name cell-mono">${esc(read.commit)}</span><span class="tag">${esc(read.branch)}</span></div><div class="record-row__meta"><span>${read.pages} pages</span><span class="cell-mono">+${read.added} ~${read.changed} −${read.removed}</span><span>${esc(read.when)}</span></div></div><div class="record-row__state"></div><div class="record-row__state"></div></div>`).join('')
		})
		: cloned ? callout('Nothing has been read from this copy yet. A read records the pages the repository declares and the commit it read them at; it never writes to the repository.') : '';

	const scripts = cloned
		? repo.scripts.length > 0
			? group({
				label: 'Scripts',
				count: `${repo.scripts.length} ${repo.scripts.length === 1 ? 'script' : 'scripts'}`,
				note: 'The repository&#39;s own vocabulary. The platform calls these and nothing else.',
				body: repo.scripts.map((script) => `<div class="record-row record-row--static">${toneMark('code')}<div class="record-row__main"><div class="record-row__title"><span class="record-row__name cell-mono">${esc(script.name)}</span></div><div class="record-row__meta"><span>${esc(script.note)}</span></div></div><div class="record-row__state"></div><div class="record-row__state"></div></div>`).join('')
			})
			: callout(`<b>No documentation scripts.</b> The platform reads <code>${esc(repo.docs)}/</code> as files instead: a page is a file, and nothing in the repository runs.`)
		: '';

	return `${pageHead({
		eyebrow: 'Repositories',
		title: repo.name,
		mark: 'repo',
		desc: `${esc(repo.remote)} · ${cloned ? `${esc(repo.branch)} at ${esc(repo.head)}` : 'no local copy yet'} · ${repo.branches} branches · ${repo.temco ? 'published by Temco' : 'third party'}`,
		actions: cloned
			? button('Read Source', 'temcoRepositories.readSource', { kind: 'primary', mark: 'refresh' }) + button('Browse Source', 'temcoDocs.source', { mark: 'code', args: [repo.name] }) + button('Open Working Copy', 'workbench.action.files.openFolder', { mark: 'folder' })
			: button('Clone', 'temcoRepositories.page', { kind: 'primary', mark: 'download' })
	})}
${cloned
			? tiles([
				{ value: repo.files.toLocaleString('en-US'), label: 'Files' },
				{ value: String(repo.pages), label: 'Pages found' },
				{ value: repo.size, label: 'Local copy' },
				{ value: String(reads.length), label: 'Reads recorded' }
			])
			: callout('<b>Nothing is local yet.</b> Cloning copies the repository into <code>~/Temco</code> with its history; until then this page can only describe the remote.', 'warn')}
${branches ? `<div class="mt-24">${branches}</div>` : ''}
${readRows ? `<div class="mt-24">${readRows}</div>` : ''}
${scripts ? `<div class="mt-24">${scripts}</div>` : ''}
<div class="mt-24">${rule({ label: 'Where It Lives' })}${settingsStrip([
				{ label: 'Remote', value: repo.remote, mono: true },
				{ label: 'Working copy', value: cloned ? `~/Temco/${repo.name}` : '—', mono: true },
				{ label: 'Pages folder', value: `${repo.docs}/`, mono: true },
				{ label: 'Owner', value: `${repo.owner} · last read ${repo.read}` }
			])}</div>`;
}

/** *Sources* — the mock's `docs/sources`. */
function sourcesBody(): string {
	const read = SOURCES.filter((source) => source.state === 'Read' || source.state === 'Partial');
	const pending = SOURCES.filter((source) => source.state !== 'Read' && source.state !== 'Partial');
	const pages = SOURCES.reduce((total, source) => total + source.pages, 0);

	const markFor = (kind: string): string => kind === 'Repository' ? 'repo' : kind === 'Folder' ? 'folder' : kind === 'SharePoint' ? 'globe' : 'document';
	const toneFor = (state: string): 'info' | 'warn' | undefined => state === 'Read' ? undefined : state === 'Not read' ? 'info' : 'warn';

	const row = (source: typeof SOURCES[number]): string => {
		const needsRead = source.state === 'Changed' || source.state === 'Not read';
		const items = [source.detail];
		if (source.state === 'Not read') {
			items.push('not read yet');
		} else if (source.state === 'Changed') {
			items.push('changed since the last read', `last read ${source.when}`);
		} else {
			items.push(source.pages ? `${source.pages} pages found` : 'nothing found', `read ${source.when}`);
		}
		return `<div class="record-row${needsRead ? ' record-row--static' : ''}"${needsRead ? '' : ` data-command="temcoDocs.source" data-args="${esc(JSON.stringify([source.name]))}"`}>${toneMark(markFor(source.kind), toneFor(source.state))}<div class="record-row__main"><div class="record-row__title"><span class="record-row__name">${esc(source.name)}</span>${source.kind === 'Repository' ? '' : `<span class="tag">${esc(source.kind)}</span>`}</div><div class="record-row__meta">${facts(items)}</div></div><div class="record-row__state">${badge(source.state, source.tone)}</div>${needsRead ? button('Read', 'temcoRepositories.readSource', { small: true, kind: 'primary' }) : `<span class="record-row__go">${icon('chevron-right', 'icon--sm')}</span>`}</div>`;
	};

	const partition = (title: string, note: string, kinds: string[]): string => {
		const items = SOURCES.filter((source) => kinds.includes(source.kind));
		if (items.length === 0) {
			return '';
		}
		return `<div class="mt-24">${group({ label: title, count: `${items.length} ${items.length === 1 ? 'source' : 'sources'}`, note, actions: items.length > 1 ? button('Read All', 'temcoRepositories.readAllSources', { small: true, kind: 'ghost', mark: 'refresh' }) : '', body: items.map(row).join('') })}</div>`;
	};

	return `${pageHead({
		title: 'Sources',
		mark: 'repo',
		desc: 'Everything a project reads: repositories, documents, folders and connected libraries. Reading a source is what puts pages in the knowledge base.',
		actions: button('Add Source', 'temcoProjects.addSource', { kind: 'primary', mark: 'plus' })
	})}
${tiles([
		{ value: String(SOURCES.length), label: 'Sources' },
		{ value: String(read.length), label: 'Read' },
		{ value: String(pages), label: 'Pages found' },
		{ value: String(pending.length), label: 'Need a read' }
	])}
${partition('Repositories', 'Cloned with full history and read by commit, so a draft can point at the commit it came from.', ['Repository'])}
${partition('Documents', 'Read in place from disk — one read per file, no clone and no history. A document that changed keeps its old pages until it is read again.', ['PDF', 'DOCX'])}
${partition('Folders and connections', 'A folder reads like a repository but has no history; a connection is read over the network and can expire.', ['Folder', 'SharePoint'])}
<div class="mt-24">${callout('Reading a source never edits it. The pages it finds are recorded in the platform database; the source stays the only copy of its own content.')}</div>`;
}

/** *Documents* — the mock's `docs/knowledge`, with the area that was picked open. */
function documentsBody(areaName?: string): string {
	const openArea: Area = AREAS.find((area) => area.area === areaName) ?? AREAS[3];
	const totalPages = AREAS.reduce((total, area) => total + area.pages, 0);
	const totalReviewed = AREAS.reduce((total, area) => total + area.reviewed, 0);

	const areaRow = (area: Area): string => {
		const pct = Math.round((area.reviewed / area.pages) * 100);
		const open = area.area === openArea.area;
		return `<div class="area-row${open ? ' area-row--open' : ''}" data-command="temcoDocs.knowledge" data-args="${esc(JSON.stringify([area.area]))}" style="--coverage: ${pct}%" title="${esc(`${area.reviewed} of ${area.pages} pages read`)}">${icon(open ? 'chevron-down' : 'chevron-right', 'icon--sm')}<span class="area-row__name">${esc(area.area)}</span><span class="area-row__pct">${pct}%</span><span class="area-row__stale">${area.stale ? badge(`${area.stale} stale`, 'warn') : ''}</span></div>`;
	};

	const pages = AREA_PAGES[openArea.area] ?? [];
	const openPct = Math.round((openArea.reviewed / openArea.pages) * 100);

	return `${pageHead({
		eyebrow: 'T3000 Documentation · 13.0',
		title: 'Areas',
		mark: 'book',
		desc: `${totalPages.toLocaleString('en-US')} pages in ${AREAS.length} areas, ${totalReviewed.toLocaleString('en-US')} of them read by a person. The registry order is the order the documentation ships in, not the order the files sit on disk.`,
		actions: button('New Page', 'temcoDocs.newPage', { kind: 'primary', mark: 'plus' }) + button('Generate from Sources', 'temcoDocs.createPage', { mark: 'sparkle' }) + button('Open Tree', 'temcoDocs.pages.focus', { mark: 'sidebar', title: 'Show this content as a folder tree in the side bar' })
	})}
<div class="know-wrap mt-24">
<div class="know-split">
${card({
		title: 'Areas',
		mark: 'book',
		plain: true,
		actions: button('Coverage & Health', 'temcoWorkbench.health', { small: true, kind: 'ghost' }),
		desc: 'Read is what a person signed off; stale is what the sources have outrun. Pick an area.',
		body: `<div class="area-list">${AREAS.map(areaRow).join('')}</div>`
	})}
${card({
		title: `Pages in ${openArea.area}`,
		mark: 'document',
		plain: true,
		actions: button('Add Page', 'temcoDocs.newPage', { small: true, kind: 'ghost', mark: 'plus' }),
		desc: `${openArea.pages} pages · ${openArea.reviewed} read (${openPct}%) · ${openArea.stale ? `${openArea.stale} stale` : 'nothing stale'}. Order is the page order inside the area, not a file line. Pick a page to open it.`,
		body: table(
			['Order', 'Page', 'State'],
			pages.map((entry: PageRow) => [
				`<span class="cell-mono">${entry.order}</span>`,
				`<span class="cell-strong">${esc(entry.page)}</span><div class="cell-muted" style="font-size:12px">${esc(entry.owner === '—' ? 'no owner' : entry.owner)} · changed ${esc(entry.changed)}</div>`,
				badge(entry.state, entry.tone)
			]),
			(index) => ({ command: 'temcoDocs.page', args: [pages[index].page, openArea.area] })
		)
	})}
</div>
</div>
<div class="mt-24 grid grid--2">
${card({
		title: 'Gaps',
		mark: 'alert',
		plain: true,
		actions: button('Draft All', 'temcoDocs.createPage', { small: true, kind: 'primary', mark: 'sparkle' }),
		desc: 'Topics the sources mention that no page covers.',
		body: list([
			{ mark: 'book', title: 'Point scaling', sub: '<span class="cell-muted">14 mentions in t3000webview</span>', meta: badge('Open', 'warn') },
			{ mark: 'book', title: 'Retry and back-off rules', sub: '<span class="cell-muted">9 mentions in bacnet-stack</span>', meta: badge('Open', 'warn') },
			{ mark: 'book', title: 'Alarm priority mapping', sub: '<span class="cell-muted">6 mentions in the BACnet guide</span>', meta: badge('Open', 'warn') }
		])
	})}
${card({
		title: 'Checks',
		mark: 'check',
		plain: true,
		actions: button('Open Problems', 'workbench.actions.view.problems', { small: true, kind: 'ghost' }),
		desc: 'What the structural checks found in this project. The Problems panel holds the same findings.',
		body: list([
			{ mark: 'alert', title: 'Duplicate order', sub: '<span class="cell-muted">order 20 is claimed by two pages</span>', meta: badge('1', 'err') },
			{ mark: 'link', title: 'Broken links', sub: '<span class="cell-muted">targets that do not exist</span>', meta: badge('12', 'warn') },
			{ mark: 'account', title: 'Unowned pages', sub: '<span class="cell-muted">no owner in the registry</span>', meta: badge('4', 'warn') },
			{ mark: 'check', title: 'Never reviewed', sub: '<span class="cell-muted">readable, but nobody has read it</span>', meta: badge('341', 'neutral') }
		])
	})}
</div>
<div class="mt-24">${callout('A folder is a position in the content tree, not a directory on disk: <code>Hardware / Controllers / T3-8R</code>. The Documents container in the side bar is where folders are added, renamed and moved, and the order it shows is the order the site and the PDF use — this list is that order, flattened.')}</div>`;
}

/** *Page* — the mock's `docs/page`: one page in the state the registry holds it. */
function pageBody(requested: string, areaName?: string): string {
	let area = areaName ?? 'API Reference';
	let record = (AREA_PAGES[area] ?? []).find((row) => row.page === requested);
	if (!record) {
		for (const name of Object.keys(AREA_PAGES)) {
			const found = AREA_PAGES[name].find((row) => row.page === requested);
			if (found) {
				record = found;
				area = name;
				break;
			}
		}
	}
	record = record ?? { order: 1, page: requested, state: 'Draft', tone: 'info', owner: '—', changed: 'just now' };

	const issues: { [state: string]: string } = {
		Conflict: `Two pages claim order ${record.order} in ${esc(area)}. The build refuses to guess which one ships, so neither does.`,
		Duplicate: `This page exists twice in the registry — one copy is ${esc(record.changed)} old and has no owner. One of the two has to go.`,
		Stale: 'A source changed after this page was written, so the text may describe a version none of the controllers run.',
		Draft: 'This page has not been reviewed by a person. A draft is readable in the window and never in a release.'
	};

	const markdown = [
		{ kind: 'h1', text: `# ${record.page}` },
		{ kind: 'p', text: '' },
		{ kind: 'p', text: `${record.page} is page ${record.order} of the ${area} area.` },
		{ kind: 'p', text: 'The registry decides where it sits, so the site and the PDF agree.' },
		{ kind: 'p', text: '' },
		{ kind: 'h2', text: '## What it covers' },
		{ kind: 'p', text: '' },
		{ kind: 'list', text: '- what the thing is' },
		{ kind: 'list', text: '- what it does' },
		{ kind: 'list', text: '- what it refuses to do' },
		{ kind: 'p', text: '' },
		{ kind: 'h2', text: '## Reading a point' },
		{ kind: 'p', text: '' },
		{ kind: 'p', text: 'GET /api/devices/{id}/points returns every point on a device,' },
		{ kind: 'p', text: 'with its raw value and the scale factor the page documents.' },
		{ kind: 'p', text: '' },
		{ kind: 'quote', text: '> A heading with nothing under it is a gap: the build counts it.' }
	];

	const tool = (label: string, title: string): string => button(label, 'temcoDocs.analyseSource', { small: true, kind: 'ghost', title });

	const editor = `<div class="md-editor"><div class="md-editor__bar">${tool('B', 'Bold')}${tool('I', 'Italic')}${tool('H2', 'Section heading')}${tool('• List', 'Bulleted list')}${tool('❝', 'Note')}${tool('</>', 'Code sample')}${tool('Link', 'Link to another page')}${tool('Image', 'Screenshot from the last read')}${tool('Table', 'Table with a header row')}<span class="toolbar__spacer"></span><span class="cell-muted" style="font-size:11px">Markdown · the build reads headings, code and links</span></div><div class="md-editor__body"><div class="md-editor__gutter">${markdown.map((_line, index) => `<div>${index + 1}</div>`).join('')}</div><div class="md-editor__code">${markdown.map((line) => `<div class="md-line md-line--${line.kind}">${line.text ? esc(line.text) : '&nbsp;'}</div>`).join('')}</div></div><div class="md-editor__status"><span>Ln 1, Col 1</span><span>${markdown.length} lines</span><span>Markdown</span><span>UTF-8</span><span>${esc(area)} · order ${record.order}</span></div></div>`;

	return `${pageHead({
		eyebrow: `${area} · order ${record.order} · T3000 13.0`,
		title: record.page,
		mark: 'document',
		desc: 'The page as the registry holds it. Saving writes a draft; nothing here reaches a reader until a build and a release carry it.',
		actions: button('Submit for Review', 'temcoDocs.validate', { kind: 'primary', mark: 'check' }) + button('Read Source', 'temcoDocs.source', { mark: 'code' })
	})}
${issues[record.state] ? `<div class="mt-16">${callout(issues[record.state], record.tone === 'err' ? 'warn' : undefined)}</div>` : ''}
<div class="mt-16">${settingsStrip([
		{ label: 'Area', value: area },
		{ label: 'Order', value: String(record.order), mono: true },
		{ label: 'State', value: record.state },
		{ label: 'Owner', value: record.owner === '—' ? 'nobody yet' : record.owner },
		{ label: 'Source', value: 't3000webview', mono: true },
		{ label: 'Changed', value: record.changed }
	], true)}</div>
<div class="mt-24">${editor}</div>
<div class="mt-24 grid grid--2">
<div>${group({
		label: 'Links',
		count: '3',
		body: factRow('arrow-right', '→ Reading a Point', 'outgoing') + factRow('arrow-right', '→ Point Types', 'outgoing') + factRow('link', '← Writing a Point', 'incoming · the link the build resolves')
	})}</div>
<div>${group({
		label: 'History',
		count: '3 revisions',
		body: factRow('sparkle', 'AI draft · +42 −8', '26 minutes ago · in Review Center') + factRow('check', 'Reviewed by Mei', '2 weeks ago · 12.9') + factRow('code', 'Written from t3000webview', '3 months ago · 4de5eda')
	})}</div>
</div>
<div class="mt-24">${group({
		label: 'What Saving Does',
		count: '3 facts',
		body: factRow('document', 'It writes a draft', 'to the registry, not to a source file') + factRow('check', 'The diff goes to Review Center', 'accepting it is a review, not a save') + factRow('upload', 'Only a release reaches a reader', 'a build and a publish, in that order')
	})}</div>`;
}

/** *Source* — the mock's `docs/source`: the code behind the pages. */
function sourceBody(repoName: string): string {
	const repo = REPOSITORIES.find((candidate) => candidate.name === repoName) ?? REPOSITORIES[0];
	const open = SOURCE_FILES[0];

	const fileRow = (file: typeof SOURCE_FILES[number], isOpen: boolean): string =>
		`<div class="record-row${isOpen ? ' record-row--current' : ' record-row--static'}">${toneMark(file.lang === 'Markdown' ? 'document' : 'code', isOpen ? 'accent' : undefined)}<div class="record-row__main"><div class="record-row__title"><span class="record-row__name cell-mono">${esc(file.path)}</span></div><div class="record-row__meta"><span>${esc(file.role)}</span><span>${file.lines} lines</span></div></div><div class="record-row__state">${isOpen ? badge('Open', 'accent') : ''}</div><div class="record-row__state"></div></div>`;

	return `${pageHead({
		eyebrow: `Source · ${repo.name}`,
		title: 'Source Explorer',
		mark: 'code',
		desc: 'The files behind the pages, as the last read left them. Read-only: a page is changed by an edit and a release, never by editing a source.',
		actions: button('Read Again', 'temcoRepositories.readSource', { mark: 'refresh' }) + button('Repository', 'temcoDocs.repository', { mark: 'repo', args: [repo.name] })
	})}
${tiles([
		{ value: repo.files.toLocaleString('en-US'), label: 'Files in the repository' },
		{ value: String(repo.pages), label: 'Pages found' },
		{ value: repo.head || '—', label: 'Commit read' },
		{ value: repo.read || 'never', label: 'Last read' }
	])}
<div class="split mt-24" style="grid-template-columns: 320px minmax(0, 1fr)">
${group({ label: 'Files', count: `${SOURCE_FILES.length} files`, note: 'The six files that produced the API Reference pages. A read keeps the heading structure, not a copy of the file.', body: SOURCE_FILES.map((file) => fileRow(file, file === open)).join('') })}
<div>
${group({
		label: open.path,
		plain: true,
		count: `${open.lang} · ${open.lines} lines`,
		actions: button('Open on GitHub', 'vscode.open', { small: true, kind: 'ghost', args: [vscode.Uri.parse(`https://${repo.remote}`)] }),
		body: `<div style="padding-top:10px"><pre class="code" style="max-height:420px">${SOURCE_CODE.map(esc).join('\n')}</pre></div><div class="facts"><span>read at 4de5eda</span><span>declares 12 headings</span><span>feeds 9 pages</span><span>cited 4 times</span></div>`
	})}
</div>
</div>
<div class="mt-24">${group({
		label: 'What a Read Does With These Files',
		count: '3 steps',
		body: factRow('search', 'Finds the headings', 'a heading with text under it becomes a page; a heading with nothing under it becomes a gap') + factRow('document', 'Keeps the code samples', 'a fenced block in the source is quoted verbatim, so the page cannot drift from the code') + factRow('link', 'Records the links', 'a link to another heading becomes an internal link, which is what the broken-link check reads')
	})}</div>
<div class="mt-16">${callout('An AI draft reads this file as evidence and cites it. Editing the file does not change a page: the next read finds the change, and the page then shows as stale until somebody reviews it.')}</div>`;
}

/** *Review Center* — the mock's `docs/review`. */
function reviewBody(): string {
	const drafts = REVIEWS.filter((review) => review.kind === 'Draft').length;

	const row = (review: typeof REVIEWS[number]): string => {
		const isDraft = review.kind === 'Draft';
		const isOpen = review === REVIEWS[0];
		const items = [review.area, `by ${review.author}`, review.changes, `waiting ${review.age}`];
		return `<div class="record-row${isOpen ? ' record-row--current' : ''}">${toneMark(isDraft ? 'sparkle' : review.kind === 'New page' ? 'plus' : 'document', isDraft ? 'accent' : review.kind === 'New page' ? 'ok' : undefined)}<div class="record-row__main"><div class="record-row__title"><span class="record-row__name">${esc(review.page)}</span>${isOpen ? '<span class="cell-muted" style="font-size:12px">open below</span>' : ''}</div><div class="record-row__meta">${facts(items)}</div></div><div class="record-row__state">${badge(review.kind, review.tone)}</div>${button('Review', 'temcoDocs.page', { small: true, kind: isOpen ? 'primary' : 'ghost', args: [review.page] })}</div>`;
	};

	return `${pageHead({
		title: 'Review Center',
		mark: 'check',
		desc: 'Drafts, edits and AI suggestions in one queue. Accepting a change is a diff; rejecting it is undo — nothing is written until you say so.',
		actions: button('Filters', 'workbench.action.quickOpen', { mark: 'filter' })
	})}
${hero({
		tone: 'warn',
		eyebrow: 'Release 13.0',
		title: '2 errors keep 13.0 from publishing',
		desc: 'Duplicate page order in <b>Data Points API</b>, and <b>Modbus Register Map</b> links to a page that no longer exists. Everything else — the site, the PDF and the search index — is built.',
		actions: button('Open the first error', 'temcoDocs.page', { kind: 'primary', mark: 'alert', args: ['Data Points API'] }) + button('Review next draft', 'temcoDocs.page', { mark: 'check', args: ['Trend Log Retention'] })
	})}
<div class="mt-24">
${card({
		title: 'Queue',
		mark: 'check',
		plain: true,
		desc: `${REVIEWS.length} items waiting, ${drafts} of them AI drafts. Newest first; the one whose diff is open below carries its age on the line.`,
		body: `<div class="record-list">${REVIEWS.map(row).join('')}</div>`
	})}
</div>
<div class="mt-24">
${card({
		title: 'Selected diff · Data Points API',
		mark: 'document',
		plain: true,
		actions: badge('AI draft', 'info') + badge('+42 −8', 'neutral'),
		desc: 'Accepting writes the page; rejecting leaves it exactly as it was. Either way it is one undo step.',
		body: '<div class="diff"><div class="diff__line diff__line--hunk"><span class="diff__sign"></span>@@ -18,6 +18,9 @@</div><div class="diff__line diff__line--del"><span class="diff__sign">−</span>Points are stored as 32-bit floats.</div><div class="diff__line diff__line--add"><span class="diff__sign">+</span>Points are stored as 32-bit floats, except <b>AI</b> and <b>AO</b></div><div class="diff__line diff__line--add"><span class="diff__sign">+</span>values on controllers with firmware 2.14 and later, which use a</div><div class="diff__line diff__line--add"><span class="diff__sign">+</span>scaled integer with the factor from <code>point.scale</code>.</div><div class="diff__line"><span class="diff__sign"></span> </div><div class="diff__line"><span class="diff__sign"></span>Ranges are inclusive:</div></div>',
		foot: button('Accept', 'temcoDocs.validate', { small: true, kind: 'primary', mark: 'check' }) + button('Reject', 'temcoDocs.refresh', { small: true, mark: 'close' }) + '<span>written on accept · undoable after</span>'
	})}
</div>
<div class="mt-24 grid grid--2">
${card({
		title: 'AI Suggestions',
		mark: 'sparkle',
		plain: true,
		actions: button('Review All', 'temcoDocs.review', { small: true, kind: 'ghost' }),
		desc: 'The model read the page, its area and the source it came from. Each suggestion cites what it used.',
		body: list([
			{ mark: 'sparkle', title: 'Point scaling changed in 2.14', sub: '<span class="cell-muted">api-reference › data-points</span>', meta: badge('Draft', 'info') },
			{ mark: 'sparkle', title: 'Firmware screenshot is 5 versions old', sub: '<span class="cell-muted">hardware › t3-8r</span>', meta: badge('Draft', 'info') },
			{ mark: 'sparkle', title: 'Trend retention table is incomplete', sub: '<span class="cell-muted">trends › retention</span>', meta: badge('Draft', 'info') }
		])
	})}
${card({
		title: 'Checks Before Publish',
		mark: 'check',
		plain: true,
		actions: button('Open Problems', 'workbench.actions.view.problems', { small: true, kind: 'ghost' }),
		desc: 'Two errors must be fixed before 13.0 can publish; the warnings can ship.',
		body: `<div class="progress-list"><div><div class="progress-list__label"><b>Structure</b><span>10 of 12</span></div>${bar(83, 'warn')}</div><div><div class="progress-list__label"><b>Links</b><span>1,254 of 1,266</span></div>${bar(99, 'ok')}</div><div><div class="progress-list__label"><b>Ownership</b><span>1,250 of 1,254</span></div>${bar(99, 'ok')}</div><div><div class="progress-list__label"><b>Help ids</b><span>1,198 of 1,254</span></div>${bar(95)}</div></div>`
	})}
</div>`;
}

/** *Build Center* — the mock's `docs/builds`. */
function buildsBody(): string {
	const done = BUILDS.filter((build) => build.state === 'Succeeded').length;
	const queued = BUILDS.filter((build) => build.state === 'Queued').length;

	const rows = BUILDS.map((build) => [
		`<span class="cell-strong">${esc(build.target)}</span><div class="cell-muted" style="font-size:12px">${esc(build.detail)}</div>`,
		badge(build.state, build.tone),
		`<div style="min-width:120px">${bar(build.pct, build.tone === 'ok' ? 'ok' : build.tone === 'info' ? undefined : 'warn')}</div>`,
		`<span class="cell-mono">${esc(build.time)}</span>`,
		build.state === 'Succeeded' ? button('Open', 'temcoDocs.buildSite', { small: true, kind: 'ghost' }) : button('Build', 'temcoDocs.buildSite', { small: true })
	]);

	return `${pageHead({
		eyebrow: 'T3000 Documentation · 13.0',
		title: 'Build Center',
		mark: 'play',
		desc: 'One build produces every artifact of a release. Each target can be run alone; a publish needs all of them.',
		actions: button('Build All', 'temcoDocs.buildSite', { kind: 'primary', mark: 'play' })
	})}
${hero({
		eyebrow: 'Build 13.0.482',
		title: 'Offline help is still compiling — 612 of 1,254 topics',
		desc: `The website, the PDF and the search index are done: ${done} of ${BUILDS.length} targets, ${queued} still queued. A publish waits for every target, so the release holds here.`,
		actions: button('Open the log', 'workbench.action.output.toggleOutput', { kind: 'primary', mark: 'output' }) + button('Cancel the build', 'workbench.action.tasks.terminate', { mark: 'close' })
	})}
<div class="mt-24">
${card({
		title: 'Targets',
		mark: 'package',
		plain: true,
		desc: 'Everything is written into .temco/build. Running one target does not touch the others.',
		body: table(['Target', 'State', 'Progress', 'Time', ''], rows)
	})}
</div>
<div class="mt-24">
${card({
		title: 'Build Log',
		mark: 'output',
		plain: true,
		actions: button('Copy', 'temcoDocs.copyPath', { small: true, kind: 'ghost' }),
		desc: 'Each line is stamped with the time it happened; the help compiler is the last thing in it.',
		body: `<pre class="code" style="border:0;border-radius:0;max-height:300px">${esc(BUILD_LOG.join('\n'))}</pre>`
	})}
</div>
<div class="mt-24">
${card({
		title: 'Artifacts',
		mark: 'download',
		plain: true,
		desc: 'What this build has written so far. A target that is still running has a partial file.',
		body: list([
			{ mark: 'globe', title: 't3000-13.0-site.zip', sub: '<span class="cell-muted">1,254 pages · 18.2 MB</span>', meta: badge('Ready', 'ok') },
			{ mark: 'document', title: 't3000-13.0.pdf', sub: '<span class="cell-muted">1,254 pages · 6.2 MB</span>', meta: badge('Ready', 'ok') },
			{ mark: 'package', title: 't3000-13.0.chm', sub: '<span class="cell-muted">612 of 1,254 topics</span>', meta: badge('Running', 'info') },
			{ mark: 'search', title: 'search-index.json', sub: '<span class="cell-muted">12,884 terms</span>', meta: badge('Queued', 'neutral') }
		]),
		foot: '<span>Written to .temco/build · never committed</span>'
	})}
</div>`;
}

/** *Releases* — the mock's `docs/releases`. */
function releasesBody(): string {
	const current = RELEASES[0];
	const published = RELEASES.filter((release) => release.state === 'Published').length;

	const row = (release: typeof RELEASES[number]): string => {
		const isCurrent = release === current;
		return `<div class="record-row${isCurrent ? ' record-row--current' : ''}">${toneMark('upload', isCurrent ? 'accent' : undefined)}<div class="record-row__main"><div class="record-row__title"><span class="record-row__name cell-mono">${esc(release.version)}</span>${isCurrent ? '<span class="cell-muted" style="font-size:12px">in flight</span>' : ''}</div><div class="record-row__meta">${facts([release.date, `${release.pages.toLocaleString('en-US')} pages`, release.artifacts])}</div></div><div class="record-row__state">${badge(release.state, release.tone)}</div><span class="row" style="gap:4px">${button('View', 'temcoDocs.overview', { small: true, kind: 'ghost' })}${release.state === 'Published' ? button('Pin', 'temcoDocs.buildSite', { small: true, kind: 'ghost' }) : ''}</span></div>`;
	};

	return `${pageHead({
		title: 'Releases',
		mark: 'upload',
		desc: 'A release pins a version of the documentation to a version of the product. Published versions stay reachable forever.',
		actions: button('Publish 13.0', 'temcoDocs.buildSite', { kind: 'primary', mark: 'upload' })
	})}
${hero({
		tone: 'warn',
		eyebrow: `Version ${current.version}`,
		title: '13.0 is not published yet',
		desc: 'Two pages claim the same order and the offline help is at 612 of 1,254 topics. The site, the PDF and the search index are waiting in the build folder, one action from Temco Learn.',
		actions: button('Open Review Center', 'temcoDocs.review', { kind: 'primary', mark: 'check' }) + button('See the Build', 'temcoDocs.builds', { mark: 'play' })
	})}
<div class="mt-24">
${card({
		title: 'Versions',
		mark: 'upload',
		plain: true,
		actions: button('Changelog', 'temcoDocs.overview', { small: true, kind: 'ghost', mark: 'list' }),
		desc: `Newest first. ${published} published, one in flight; a published version is never rewritten.`,
		body: `<div class="record-list">${RELEASES.map(row).join('')}</div>`
	})}
</div>
<div class="mt-24">
${card({
		title: '13.0 Changelog',
		mark: 'list',
		plain: true,
		desc: 'What changed between 12.9 and 13.0, counted from the pages themselves.',
		body: list([
			{ mark: 'document', title: '48 new pages', sub: '<span class="cell-muted">API Reference · Protocol</span>', meta: badge('New', 'ok') },
			{ mark: 'edit', title: '112 pages updated', sub: '<span class="cell-muted">firmware 2.14 changes</span>', meta: badge('Edit', 'neutral') },
			{ mark: 'close', title: '6 pages removed', sub: '<span class="cell-muted">superseded by the new object model</span>', meta: badge('Removed', 'neutral') },
			{ mark: 'link', title: '12 broken links fixed', sub: '<span class="cell-muted">3 still open</span>', meta: badge('3 open', 'warn') }
		])
	})}
</div>`;
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
		actions: button('Open Areas', 'temcoDocs.documents', { kind: 'primary', mark: 'book' }) + button('Ask the AI', 'temcoAi.openPanel', { mark: 'sparkle' })
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
${step(4, 'Open, edit and review', 'Open a page from the Docs Explorer tree or the Areas list, edit it in the page editor and save. The change waits in Review Center until someone approves it.', '<p>Every page carries an area, an order, an owner and the source it came from. Two pages cannot share an order inside one area — the build reports it as an error — and <strong>17</strong> pages are waiting for review right now.</p>', 'Areas', 'temcoDocs.documents')}
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
