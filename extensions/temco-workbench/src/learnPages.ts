// Temco Learn — the published site, as a reader sees it.
//
// Rebuilt from the mock (`docs/mock/js/views.platform.js`: `learn/home`, `learn/t3000`, `learn/article`,
// `learn/downloads`, `learn/paths`). The markup and the wording are the mock's; the rows are now the platform's
// own: the areas this window is reading, the artifacts its builds left, and the versions it published. A Learn page
// that cannot read any of that says so instead of showing a sample.

import * as vscode from 'vscode';
import { roots as readRoots, totals } from './docs';
import { Catalog, ReleaseRow, selection } from './store';
import { commandScript, escapeHtml as esc, icon, page, pageColumn, runCommand } from './ui';

/** What the Learn pages read: the registries on this machine, and what the catalog has published. */
interface LearnFacts {
	project?: string;
	projects: number;
	pages: number;
	areas: { name: string; pages: number; neverReviewed: number; stale: number }[];
	artifacts: { kind: string; path: string; builtAt: string }[];
	releases: ReleaseRow[];
}

async function readLearnFacts(context: vscode.ExtensionContext): Promise<LearnFacts> {
	const list = readRoots();
	const areas = new Map<string, { name: string; pages: number; neverReviewed: number; stale: number }>();
	for (const root of list) {
		for (const area of root.areas) {
			const stale = area.chapters.reduce(
				(total, chapter) => total + chapter.pages.filter((entry) => entry.provenance?.stale === true).length,
				0
			);
			const found = areas.get(area.area);
			if (found === undefined) {
				areas.set(area.area, { name: area.area, pages: area.pages, neverReviewed: area.neverReviewed, stale });
				continue;
			}
			found.pages += area.pages;
			found.neverReviewed += area.neverReviewed;
			found.stale += stale;
		}
	}

	const facts: LearnFacts = {
		projects: 0,
		pages: totals(list).pages,
		areas: [...areas.values()].sort((one, other) => one.name.localeCompare(other.name)),
		artifacts: [],
		releases: []
	};

	try {
		const catalog = await Catalog.open(context);
		try {
			const documents = catalog.documents();
			facts.projects = documents.length;
			const project = selection.project() ?? (documents.length === 1 ? documents[0].slug : undefined);
			facts.project = project;
			facts.artifacts = project === undefined ? [] : catalog.documentArtifacts(project);
			facts.releases = project === undefined ? [] : catalog.releases(project);
		} finally {
			catalog.close();
		}
	} catch {
		// Nothing published is a state, not an error: the pages say so and offer the build.
	}
	return facts;
}

/** The mark that says what an artifact is. */
const ARTIFACT_MARK: { [kind: string]: string } = { chm: 'package', pdf: 'document', site: 'globe', search: 'search' };

/** The words for an artifact's kind. */
const artifactName = (kind: string): string =>
	kind === 'chm' ? 'Offline help (CHM)' : kind === 'pdf' ? 'PDF' : kind === 'site' ? 'Website' : kind === 'search' ? 'Search index' : kind;

export const LEARN_HOME_VIEW_TYPE = 'temcoWorkbench.learn.home';
export const LEARN_PRODUCT_VIEW_TYPE = 'temcoWorkbench.learn.t3000';
export const LEARN_ARTICLE_VIEW_TYPE = 'temcoWorkbench.learn.article';
export const LEARN_DOWNLOADS_VIEW_TYPE = 'temcoWorkbench.learn.downloads';
export const LEARN_PATHS_VIEW_TYPE = 'temcoWorkbench.learn.paths';

interface ActionOptions {
	kind?: 'primary' | 'ghost';
	mark?: string;
	small?: boolean;
	args?: unknown;
}

const button = (label: string, command: string, options: ActionOptions = {}): string =>
	`<button type="button" class="btn${options.small ? ' btn--sm' : ''}${options.kind ? ` btn--${options.kind}` : ''}" data-command="${command}"${options.args === undefined ? '' : ` data-args="${esc(JSON.stringify(options.args))}"`}>${options.mark ? icon(options.mark) : ''}<span>${esc(label)}</span></button>`;

const badge = (text: string, tone?: string): string =>
	`<span class="badge${tone && tone !== 'neutral' ? ` badge--${tone}` : ''}">${esc(text)}</span>`;

const card = (options: { title: string; mark?: string; actions?: string; desc?: string; body?: string; foot?: string }): string =>
	`<div class="card card--plain"><div class="card__head">${options.mark ? `<span class="card__icon">${icon(options.mark)}</span>` : ''}<div class="card__title">${esc(options.title)}</div>${options.actions ? `<div class="card__actions">${options.actions}</div>` : ''}</div>${options.desc ? `<p class="card__desc">${options.desc}</p>` : ''}${options.body ?? ''}${options.foot ? `<div class="card__foot">${options.foot}</div>` : ''}</div>`;

const list = (items: { mark: string; title: string; sub?: string; meta?: string }[]): string =>
	`<div class="list">${items.map((item) => `<div class="list__item">${icon(item.mark)}<div class="list__main"><div class="list__title">${esc(item.title)}</div>${item.sub ? `<div class="list__sub">${item.sub}</div>` : ''}</div>${item.meta ? `<div class="list__meta">${item.meta}</div>` : ''}</div>`).join('')}</div>`;

const hero = (options: { tone?: string; eyebrow?: string; title: string; desc?: string; actions?: string }): string =>
	`<div class="hero-panel${options.tone && options.tone !== 'accent' ? ` hero-panel--${options.tone}` : ''}">${options.eyebrow ? `<div class="eyebrow">${esc(options.eyebrow)}</div>` : ''}<div class="hero-panel__title">${esc(options.title)}</div>${options.desc ? `<p class="hero-panel__desc">${options.desc}</p>` : ''}${options.actions ? `<div class="hero-panel__actions">${options.actions}</div>` : ''}</div>`;

const pageHead = (options: { title: string; mark: string; desc: string; actions?: string }): string =>
	`<div class="page-head"><div class="page-head__main"><h1 class="page-head__title">${icon(options.mark)}${esc(options.title)}</h1><p class="page-head__desc">${options.desc}</p></div>${options.actions ? `<div class="page-head__actions">${options.actions}</div>` : ''}</div>`;

const rule = (label: string, count: string, note?: string, actions?: string): string =>
	`<div class="group-head"><span class="group-head__label">${esc(label)}</span><span class="group-head__rule"></span><span class="group-head__count">${esc(count)}</span>${actions ? `<span class="group-head__actions">${actions}</span>` : ''}</div>${note ? `<p class="group-note">${note}</p>` : ''}`;

/** The site's five surfaces, one panel each. */
export class LearnPages {
	private readonly panels = new Map<string, vscode.WebviewPanel>();

	constructor(private readonly context: vscode.ExtensionContext) { }

	async home(): Promise<void> {
		this.open('home', LEARN_HOME_VIEW_TYPE, 'Temco Learn', homeBody(await readLearnFacts(this.context)));
	}

	async product(): Promise<void> {
		this.open('t3000', LEARN_PRODUCT_VIEW_TYPE, 'T3000', productBody(await readLearnFacts(this.context)));
	}

	/**
	 * *An article* — the published site itself.
	 *
	 * A reader's page is the file a release put on disk, so this opens that rather than drawing a second copy of it:
	 * a preview that can disagree with the shipped page is worse than no preview.
	 */
	async article(): Promise<void> {
		const facts = await readLearnFacts(this.context);
		const newest = facts.releases[0];
		if (newest === undefined) {
			this.open('article', LEARN_ARTICLE_VIEW_TYPE, 'Article', `${pageHead({
				title: 'Nothing is published yet',
				mark: 'document',
				desc: 'A reader\u2019s page is a file a release put on disk. Build the site and publish it, and this opens the site itself.',
				actions: button('Build the Site', 'temcoDocs.buildSite', { kind: 'primary', mark: 'play' }) + button('Publish', 'temcoDocs.publishRelease', { mark: 'upload' })
			})}${hero({ tone: 'warn', title: 'No published version', desc: 'The build writes the site; publishing copies it to a folder a reader can open. Until both have happened there is no page to read.', actions: button('Open Build Center', 'temcoDocs.builds', { kind: 'primary', mark: 'play' }) })}`);
			return;
		}
		await vscode.commands.executeCommand('temcoDocs.openPublished', newest.destination);
	}

	async downloads(): Promise<void> {
		this.open('downloads', LEARN_DOWNLOADS_VIEW_TYPE, 'Downloads', downloadsBody(await readLearnFacts(this.context)));
	}

	paths(): void {
		this.open('paths', LEARN_PATHS_VIEW_TYPE, 'Learning Paths', pathsBody());
	}

	dispose(): void {
		for (const panel of this.panels.values()) {
			panel.dispose();
		}
		this.panels.clear();
	}

	private open(key: string, viewType: string, title: string, body: string): void {
		const html = page(body, { title, script: commandScript });
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
		panel.iconPath = new vscode.ThemeIcon('cloud-upload');
		panel.webview.onDidReceiveMessage(runCommand);
		panel.webview.html = html;
		this.panels.set(key, panel);
		panel.onDidDispose(() => this.panels.delete(key));
	}
}

/** How long ago something was published, in words a reader reads at a glance. */
function since(iso: string): string {
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

/** *Home* — what is published, and what the documentation is made of. */
function homeBody(facts: LearnFacts): string {
	const newest = facts.releases[0];
	const areas = facts.areas.map((area) =>
		`<button type="button" class="learn-card" data-command="temcoWorkbench.learn.t3000"><span class="learn-card__title">${esc(area.name)}</span><span class="learn-card__desc">${area.pages} ${area.pages === 1 ? 'page' : 'pages'}${area.stale > 0 ? ` · ${area.stale} behind their source` : ''}</span><span class="row" style="gap:10px;font-size:11px;color:var(--fg-subtle)"><span>${area.neverReviewed} never reviewed</span></span></button>`
	).join('');

	const downloads = facts.artifacts.slice(0, 3).map((artifact) => ({
		mark: ARTIFACT_MARK[artifact.kind] ?? 'download',
		title: artifact.path.split(/[\\/]/).pop() ?? artifact.path,
		sub: `<span class="cell-muted">${esc(artifactName(artifact.kind))}</span>`,
		meta: button('Open', 'temcoDocs.openArtifact', { small: true, kind: 'ghost', args: [artifact.path] })
	}));

	return `<div class="learn-hero">
	<div class="learn-hero__inner">
		<div class="row" style="gap:10px;margin-bottom:10px">${badge('Temco Learn', 'accent')}<span class="cell-muted" style="font-size:12px">the published site, as a reader sees it</span></div>
		<h1 class="learn-hero__title">Documentation for Temco Controls products</h1>
		<p class="learn-hero__desc">Versioned, searchable, and available offline. This window reads the same pages a build ships, so what is listed here is what a reader gets.</p>
		<div class="learn-hero__search">${icon('search')}<span>Search ${facts.areas.length === 0 ? 'the documentation' : facts.areas.slice(0, 3).map((area) => esc(area.name)).join(', ')}…</span><span style="margin-left:auto" class="cell-mono">Ctrl+K</span></div>
	</div>
</div>
${rule('Published', `${facts.releases.length} ${facts.releases.length === 1 ? 'version' : 'versions'} · ${facts.artifacts.length} ${facts.artifacts.length === 1 ? 'file' : 'files'}`, newest === undefined
		? '<b>Nothing is published yet.</b> A build writes the site; publishing copies it to a folder a reader can open. Until both have happened there is no version to point at.'
		: `<b>${esc(newest.version)}</b> is live, published ${esc(since(newest.publishedAt))} with ${newest.files} file(s).`)}
${facts.areas.length === 0
			? '<p class="group-note">Nothing is being read yet, so there is no product to show. Choose the project you are working on and its areas appear here.</p>'
			: `<div class="grid grid--4">${areas}</div>`}
<div class="mt-24 grid grid--2">
${card({
		title: 'Learning Paths',
		mark: 'graduation',
		actions: button('All Paths', 'temcoWorkbench.learn.paths', { small: true, kind: 'ghost' }),
		desc: 'Ordered reading for a job rather than for a product.',
		body: '<p class="group-note">No path has been written yet. A path is a reading order over existing pages, and nothing stores one today — when the site defines them, they will be listed here.</p>'
	})}
${card({
		title: 'Downloads',
		mark: 'download',
		actions: button('All', 'temcoWorkbench.learn.downloads', { small: true, kind: 'ghost' }),
		desc: 'The offline artifacts the builds left.',
		body: downloads.length === 0
			? '<p class="group-note">Nothing has been built yet. The CHM and the PDF are files a build writes; this list is those files.</p>'
			: list(downloads)
	})}
</div>
<div class="mt-24"><div class="callout">${icon('info')}<div>These pages read the platform, not a copy of it. A reader\u2019s page is the file a release put on disk, and the artifact list is what the build wrote — so a layout decision made here is not a second design to keep in sync.</div></div></div>`;
}

/** *The T3000 product page* — the areas the registries declare. */
function productBody(facts: LearnFacts): string {
	const newest = facts.releases[0];

	const areas = facts.areas.map((area) =>
		`<button type="button" class="learn-card" data-command="temcoWorkbench.learn.t3000"><span class="learn-card__title">${esc(area.name)}</span><span class="learn-card__desc">${area.pages} ${area.pages === 1 ? 'page' : 'pages'}</span><span class="row" style="gap:8px;font-size:11px;color:var(--fg-subtle)"><span>${area.neverReviewed} never reviewed</span>${area.stale ? `<span>·</span><span>${area.stale} behind their source</span>` : ''}</span></button>`
	).join('');

	return `<div class="learn-hero">
	<div class="learn-hero__inner">
		<div class="eyebrow">Product documentation</div>
		<h1 class="learn-hero__title">${esc(facts.areas.length === 0 ? 'Nothing is being read' : 'T3000')}</h1>
		<p class="learn-hero__desc">${facts.pages.toLocaleString('en-US')} pages across ${facts.areas.length} ${facts.areas.length === 1 ? 'area' : 'areas'}, as this window is reading them.</p>
		<div class="row" style="margin-top:14px">${newest === undefined ? badge('not published', 'info') : badge(`${newest.version} · live`, 'ok')}<span class="cell-muted" style="font-size:12px">${newest === undefined ? 'no version has been published' : `last published ${esc(since(newest.publishedAt))}`}</span></div>
	</div>
</div>
<div style="margin-bottom:20px">
${hero({
		tone: newest === undefined ? 'warn' : undefined,
		eyebrow: 'Release state',
		title: newest === undefined ? 'Nothing has been published yet' : `${newest.version} is live`,
		desc: newest === undefined
			? 'The build writes the site and the offline help; publishing copies them where a reader can open them. Until then a reader has nothing to read.'
			: `Published ${esc(since(newest.publishedAt))} — ${newest.files} file(s). The CHM and the PDF are on Downloads, and the site opens from the release itself.`,
		actions: newest === undefined
			? button('Open Build Center', 'temcoDocs.builds', { kind: 'primary', mark: 'play' }) + button('Publish', 'temcoDocs.publishRelease', { mark: 'upload' })
			: button('Open the Site', 'temcoDocs.openPublished', { kind: 'primary', mark: 'globe', args: [newest.destination] }) + button('Downloads', 'temcoWorkbench.learn.downloads', { mark: 'download' })
	})}
</div>
${rule('Areas', `${facts.areas.length} ${facts.areas.length === 1 ? 'area' : 'areas'} · ${facts.pages.toLocaleString('en-US')} pages`, 'The site is organised the way the documentation is written, so a reader and an author see the same areas.')}
${facts.areas.length === 0
			? '<p class="group-note">Nothing is being read yet: choose the project you are working on, and its areas will be listed here.</p>'
			: `<div class="grid grid--3">${areas}</div>`}`;
}

/** *Downloads* — the files the builds left, which is what a reader can have offline. */
function downloadsBody(facts: LearnFacts): string {
	const kinds = [...new Set(facts.artifacts.map((artifact) => artifact.kind))];

	const fileRow = (artifact: { kind: string; path: string; builtAt: string }): string =>
		`<div class="record-row">${toneMarkOf(ARTIFACT_MARK[artifact.kind] ?? 'download', 'accent')}<div class="record-row__main"><div class="record-row__title"><span class="record-row__name cell-mono">${esc(artifact.path.split(/[\\/]/).pop() ?? artifact.path)}</span><span class="tag">${esc(artifactName(artifact.kind))}</span></div><div class="record-row__meta"><span class="cell-mono">${esc(artifact.path)}</span> · <span>built ${esc(since(artifact.builtAt))}</span></div></div><div class="record-row__state">${badge('Ready', 'ok')}</div>${button('Open', 'temcoDocs.openArtifact', { small: true, kind: 'primary', mark: 'download', args: [artifact.path] })}</div>`;

	const sections = kinds.map((kind) => {
		const files = facts.artifacts.filter((artifact) => artifact.kind === kind);
		return `<div class="mt-24">${rule(artifactName(kind), `${files.length} ${files.length === 1 ? 'file' : 'files'}`, 'The file stays where the build wrote it. A downloadable CHM or PDF needs nothing else.')}<div class="record-list">${files.map(fileRow).join('')}</div></div>`;
	}).join('');

	const versions = facts.releases.length === 0
		? ''
		: `<div class="mt-24">${rule('Published Versions', `${facts.releases.length} ${facts.releases.length === 1 ? 'version' : 'versions'}`, 'A published version is a copy of a build in a folder the platform owns. The newest is what a reader gets.')}<div class="record-list">${facts.releases.map((release) =>
			`<div class="record-row">${toneMarkOf('upload', 'ok')}<div class="record-row__main"><div class="record-row__title"><span class="record-row__name cell-mono">${esc(release.version)}</span>${release.buildId === undefined ? '' : `<span class="tag">build #${release.buildId}</span>`}</div><div class="record-row__meta"><span>published ${esc(since(release.publishedAt))}</span> · <span>${release.files} file(s)</span> · <span class="cell-mono">${esc(release.destination)}</span></div></div><div class="record-row__state">${badge('Published', 'ok')}</div>${button('Open the Site', 'temcoDocs.openPublished', { small: true, kind: 'ghost', mark: 'globe', args: [release.destination] })}</div>`).join('')}</div></div>`;

	return `${pageHead({
		title: 'Downloads',
		mark: 'download',
		desc: 'The offline artifacts the builds left, and the versions that were published from them. A version stays downloadable after a newer one ships.',
		actions: button('Build the Site', 'temcoDocs.buildSite', { kind: 'primary', mark: 'play' }) + button('Build the Offline Help', 'temcoDocs.buildHelp', { mark: 'package' }) + button('Publish', 'temcoDocs.publishRelease', { mark: 'upload' })
	})}
${facts.artifacts.length === 0
			? `<div class="mt-16"><div class="callout">${icon('info')}<div><b>Nothing has been built yet.</b> The CHM and the PDF are files a build writes — the build runs the repository\u2019s own script and then looks for the file it should have left. Build one, and it is listed here.</div></div></div>`
			: `${sections}${versions}`}`;
}

/** *Learning Paths* — a reading order over pages; nothing stores one yet, and this says so. */
function pathsBody(): string {
	return `${pageHead({
		title: 'Learning Paths',
		mark: 'graduation',
		desc: 'Ordered reading for a job, not for a product. Each step names the page and what it assumes you already know.',
		actions: button('Open the Documents', 'temcoDocs.documents', { kind: 'primary', mark: 'book' })
	})}
<div class="mt-16"><div class="callout">${icon('info')}<div><b>No path has been written yet.</b> A path is a reading order over existing pages — every step an existing page with an owner and a review date, so a stale step shows up as a stale page. Nothing stores one today; these pages read the platform, and the platform has no paths in it yet.</div></div></div>`;
}

/** A tone mark, since this module's UI copy does not export one. */
function toneMarkOf(mark: string, tone?: 'accent' | 'ok' | 'warn' | 'err' | 'info'): string {
	return `<span class="tone-mark${tone ? ` tone-mark--${tone}` : ''}">${icon(mark, 'icon--sm')}</span>`;
}
