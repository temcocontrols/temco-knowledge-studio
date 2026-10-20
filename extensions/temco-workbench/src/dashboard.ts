// The Dashboard's two pages: Overview and Recent Activity.
//
// Coverage & Health used to be a third. It was removed because the documentation module already draws that report
// from the same registry, with the same figures — one report, one owner. The Overview's Knowledge card links there.
//
// Rebuilt from the mock (`docs/mock/js/views.overview.js`) on the shared page kit. What changed is where the
// numbers come from: the registries this window is reading, and the catalog's own record of what the platform did
// — drafts waiting, releases published, events. Both are read once per open, so a page cannot show a figure that
// nobody maintains.

import * as vscode from 'vscode';
import { collectPages, countStale, roots as readRoots, totals } from './docs';
import { Catalog, DraftRow, EventRow, selection } from './store';
import { commandScript, escapeHtml, icon, page, pageColumn, runCommand, toneMark } from './ui';

/** The view types the dashboard opens under. */
export const OVERVIEW_VIEW_TYPE = 'temcoWorkbench.overview';
export const ACTIVITY_VIEW_TYPE = 'temcoWorkbench.activity';

/** What every dashboard page reads: the registries on this machine, and the catalog's account of itself. */
interface DashboardFacts {
	/** The project the catalog's figures are about. */
	project?: string;
	projects: number;
	sources: number;
	areas: number;
	pages: number;
	neverReviewed: number;
	stale: number;
	faults: number;
	drafts: DraftRow[];
	releases: number;
	events: EventRow[];
}

/**
 * Read the two places a number can honestly come from.
 *
 * The registries answer what the documentation is; the catalog answers what the platform did. Nothing here is
 * derived a second time — staleness stays the generator's verdict, and a count stays the count of rows.
 */
async function readFacts(context: vscode.ExtensionContext): Promise<DashboardFacts> {
	const list = readRoots();
	const pages = list.flatMap((root) => collectPages(root));

	const counted = totals(list);
	const facts: DashboardFacts = {
		projects: 0,
		sources: list.length,
		areas: list.reduce((total, root) => total + root.areas.length, 0),
		pages: counted.pages,
		neverReviewed: counted.neverReviewed,
		stale: countStale(pages),
		faults: counted.issues,
		drafts: [],
		releases: 0,
		events: []
	};

	try {
		const catalog = await Catalog.open(context);
		try {
			const documents = catalog.documents();
			facts.projects = documents.length;
			const project = selection.project() ?? (documents.length === 1 ? documents[0].slug : undefined);
			facts.project = project;
			facts.drafts = project === undefined ? [] : catalog.drafts(project);
			facts.releases = project === undefined ? 0 : catalog.releases(project).length;
			facts.events = catalog.events(20);
		} finally {
			catalog.close();
		}
	} catch {
		// No catalog, no record: the pages then show what the folders say and nothing about the platform's history.
	}
	return facts;
}

/** How long ago something happened, in words a person reads at a glance. */
function age(iso: string): string {
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

/** The mark that says what kind of thing was recorded. */
const EVENT_MARK: { [kind: string]: string } = { draft: 'sparkle', release: 'upload', build: 'play', read: 'repo' };

const action = (label: string, command: string, kind?: 'primary' | 'ghost'): string =>
	`<button type="button" class="btn${kind ? ` btn--${kind}` : ''}" data-command="${command}"><span>${escapeHtml(label)}</span></button>`;

/** The small line under a KPI's number. */
const kpi = (entry: { label: string; value: string; note: string }): string =>
	`<div class="kpi"><div class="kpi__label">${escapeHtml(entry.label)}</div><div class="kpi__value">${escapeHtml(entry.value)}</div><div class="cell-muted" style="font-size:12px">${escapeHtml(entry.note)}</div></div>`;

/** One event: a tone mark, what happened, and when. */
const eventRow = (event: EventRow): string =>
	`<li class="feed__item">
	${toneMark(EVENT_MARK[event.kind] ?? 'info', event.seenAt === undefined ? 'info' : 'ok')}
	<div class="feed__main">
		<div class="feed__title">${escapeHtml(event.detail ?? event.kind)}</div>
		<div class="feed__meta">${escapeHtml(event.kind)} · ${escapeHtml(age(event.at))}</div>
	</div>
	<div class="feed__side"><span class="feed__module">Platform</span></div>
</li>`;

function overviewBody(facts: DashboardFacts): string {
	const stage = (n: string, name: string, meta: string, view: string): string =>
		`<button type="button" class="pipeline__stage" data-command="${view}">
			<span class="pipeline__n">${n}</span>
			<span class="pipeline__name">${escapeHtml(name)}</span>
			<span class="pipeline__meta">${escapeHtml(meta)}</span>
		</button>`;

	const pipeline = [
		stage('01', 'Sources', facts.sources === 1 ? '1 read' : `${facts.sources} read`, 'temcoDocs.sources'),
		stage('02', 'Documents', `${facts.pages} pages`, 'temcoDocs.documents'),
		stage('03', 'Review', `${facts.drafts.length} waiting`, 'temcoDocs.review'),
		stage('04', 'Build', `${facts.faults} problems`, 'temcoDocs.builds'),
		stage('05', 'Publish', `${facts.releases} published`, 'temcoDocs.releases')
	].join('');

	const waiting = facts.drafts;
	const hero = waiting.length === 0
		? `<div class="hero-panel">
		<div class="eyebrow">Nothing is waiting</div>
		<div class="hero-panel__title">Nothing needs a person right now</div>
		<p class="hero-panel__desc">No draft is waiting in the Review Center, and every page the registries declare has a file. Writing a page, reading a source or building the site will put something here.</p>
		<div class="hero-panel__actions">${action('New Page', 'temcoDocs.newPage', 'primary')}${action('Open the Documents', 'temcoDocs.documents')}</div>
	</div>`
		: `<div class="hero-panel hero-panel--warn">
		<div class="eyebrow">${escapeHtml(facts.project === undefined ? 'The project being worked on' : 'Review queue')}</div>
		<div class="hero-panel__title">${waiting.length} ${waiting.length === 1 ? 'draft is' : 'drafts are'} waiting for a person</div>
		<p class="hero-panel__desc">Each one is a proposal in the platform database: accepting it writes the page exactly as it reads, discarding it throws the text away. The newest is <b>${escapeHtml(waiting[0].title)}</b>.</p>
		<div class="hero-panel__actions">${action('Open the Review Center', 'temcoDocs.review', 'primary')}${action('See What Needs Doing', 'temcoWorkbench.openNeeds')}</div>
	</div>`;

	const needs = waiting.length === 0
		? '<p class="group-note">Nothing is waiting. The Needs page also lists structural faults, missing files and pages nobody owns.</p>'
		: waiting.slice(0, 4).map((draft) =>
			`<div class="record-row record-row--static">
				${toneMark('sparkle', 'accent')}
				<div class="record-row__main">
					<div class="record-row__title"><span class="record-row__name">${escapeHtml(draft.title)}</span></div>
					<div class="record-row__meta"><span class="cell-mono">${escapeHtml(draft.pageId)}</span> · <span>waiting ${escapeHtml(age(draft.createdAt))}</span></div>
				</div>
				<div class="record-row__state"><span class="badge badge--info">Draft</span></div>
				<span class="record-row__go"></span>
			</div>`).join('');

	const activity = facts.events.length === 0
		? '<p class="group-note">Nothing has been recorded yet. Saving a draft, building or publishing writes the first row here.</p>'
		: `<ol class="feed">${facts.events.slice(0, 6).map(eventRow).join('')}</ol>`;

	return `<div class="page-head">
	<div class="page-head__main">
		<div class="eyebrow">Temco Platform</div>
		<h1 class="page-head__title">${icon('home')}Overview</h1>
		<p class="page-head__desc">What the platform holds, what changed since you last looked, and the one thing that needs you next.</p>
	</div>
	<div class="page-head__actions">${action('New Project', 'temcoProjects.newProject', 'primary')}${action('Build the Site', 'temcoDocs.buildSite')}</div>
</div>

<div class="grid grid--4">${[
			{ label: 'Projects', value: String(facts.projects), note: facts.projects === 1 ? 'in the platform database' : 'in the platform database' },
			{ label: 'Pages', value: String(facts.pages), note: `${facts.sources} source${facts.sources === 1 ? '' : 's'} being read` },
			{ label: 'Drafts waiting', value: String(facts.drafts.length), note: facts.drafts.length === 0 ? 'nothing to review' : 'a person has to settle them' },
			{ label: 'Never reviewed', value: String(facts.neverReviewed), note: 'readable, but nobody has read it' }
		].map(kpi).join('')}</div>

<div class="mt-16">${hero}</div>

<div class="mt-24">
	<div class="row row--between" style="margin-bottom:10px">
		<span class="group-head__label">Documentation Pipeline</span>
		<span class="cell-muted" style="font-size:12px">Sources → Documents → Review → Build → Publish</span>
	</div>
	<div class="pipeline">${pipeline}</div>
</div>

<div class="mt-24 grid grid--2">
	<div>
		${rules('Recent Activity', facts.events.length === 1 ? '1 event' : `${facts.events.length} events`, action('All Activity', 'temcoWorkbench.activity', 'ghost'))}
		${activity}
	</div>
	<div>
		${rules('Needs You', facts.drafts.length === 0 ? 'nothing' : `${facts.drafts.length} waiting`, action('Review', 'temcoWorkbench.openNeeds', 'ghost'))}
		<div class="record-list">${needs}</div>
	</div>
</div>

<div class="mt-24 grid grid--3">
	<div class="card"><div class="card__head"><div class="card__title">Sources</div></div><p class="card__desc">${facts.sources === 0 ? 'Nothing is being read yet: choose a project, or open a folder with a <b>docs/</b> folder.' : `${facts.sources} source${facts.sources === 1 ? ' is' : 's are'} being read. ${facts.faults === 0 ? 'None of their pages has a structural problem.' : `${facts.faults} structural problem${facts.faults === 1 ? '' : 's'} found.`}`}</p><div class="card__body">${bar(facts.sources === 0 ? 0 : 100, facts.sources === 0 ? 'nothing read' : 'all read', facts.sources === 0 ? undefined : 'ok')}</div></div>
	<div class="card"><div class="card__head"><div class="card__title">Knowledge</div><div class="card__actions">${action('Coverage', 'temcoDocs.overview', 'ghost')}</div></div><p class="card__desc">${facts.pages} pages across ${facts.areas} area${facts.areas === 1 ? '' : 's'}. ${facts.neverReviewed} ${facts.neverReviewed === 1 ? 'page has' : 'pages have'} never been reviewed; ${facts.stale} ${facts.stale === 1 ? 'is' : 'are'} stale.</p><div class="card__body">${bar(facts.pages === 0 ? 0 : Math.round(((facts.pages - facts.neverReviewed) / facts.pages) * 100), facts.pages === 0 ? 'no pages' : `${facts.pages - facts.neverReviewed} of ${facts.pages} read`, 'ok')}</div></div>
	<div class="card"><div class="card__head"><div class="card__title">Releases</div></div><p class="card__desc">${facts.releases === 0 ? 'Nothing has been published from this project yet. Build the site, then publish it: the copy is what a reader opens.' : `${facts.releases} version${facts.releases === 1 ? '' : 's'} published. The files stay where the build wrote them.`}</p><div class="card__body">${bar(facts.releases === 0 ? 0 : 100, facts.releases === 0 ? 'not published' : `${facts.releases} published`, facts.releases === 0 ? undefined : 'ok')}</div></div>
</div>`;
}

function rules(label: string, count: string, buttons = ''): string {
	return `<div class="group-head"><span class="group-head__label">${escapeHtml(label)}</span><span class="group-head__rule"></span><span class="group-head__count">${escapeHtml(count)}</span>${buttons ? `<span class="group-head__actions">${buttons}</span>` : ''}</div>`;
}

function bar(pct: number, label: string, kind?: string): string {
	return `<div class="bar"><span class="bar__fill${kind ? ` bar__fill--${kind}` : ''}" style="width:${pct}%"></span></div><div class="cell-muted" style="font-size:12px;margin-top:6px">${escapeHtml(label)}</div>`;
}

/** *Recent Activity* — every row the platform wrote about itself, newest first. */
function activityBody(facts: DashboardFacts): string {
	return `<div class="page-head">
	<div class="page-head__main">
		<h1 class="page-head__title">${icon('clock')}Recent Activity</h1>
		<p class="page-head__desc">Everything the platform recorded, newest first. A row is written by the module that did the thing, so nothing here is a second, derived history.</p>
	</div>
	<div class="page-head__actions">${action('Review Center', 'temcoDocs.review', 'primary')}${action('Open the Builds', 'temcoDocs.builds')}</div>
</div>
${facts.events.length === 0
			? `<div class="mt-16"><div class="callout">${icon('info')}<div><b>Nothing has been recorded yet.</b> The first row appears when a draft is saved, a build runs or a release is published — each of those writes one, and this page lists them in the order they happened.</div></div></div>`
			: `<div class="feed-wrap"><div class="mt-8">${rules('Newest First', facts.events.length === 1 ? '1 event' : `${facts.events.length} events`)}<ol class="feed">${facts.events.map(eventRow).join('')}</ol></div></div>`}`;
}

/** One panel per page, kept open so a second visit reveals the tab. */
export class DashboardPages {
	private readonly panels = new Map<string, vscode.WebviewPanel>();

	constructor(private readonly context: vscode.ExtensionContext) { }

	async open(pageId: 'overview' | 'activity'): Promise<void> {
		const existing = this.panels.get(pageId);
		const definition = await this.body(pageId);
		if (existing) {
			// Redrawn as well as revealed: a queue or a coverage figure that was true when the tab opened need
			// not be true now, and a page that lies quietly is worse than one that takes a moment to open.
			existing.reveal(pageColumn());
			existing.webview.html = page(definition.body, { title: definition.title, script: commandScript });
			return;
		}

		const panel = vscode.window.createWebviewPanel(definition.type, definition.title, pageColumn(), {
			enableScripts: true,
			localResourceRoots: []
		});
		panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'dashboard.svg');
		panel.onDidDispose(() => this.panels.delete(pageId));
		panel.webview.onDidReceiveMessage(runCommand);
		panel.webview.html = page(definition.body, { title: definition.title, script: commandScript });
		this.panels.set(pageId, panel);
	}

	/** One page's body, read fresh: the registries and the catalog answer, in that order. */
	private async body(pageId: 'overview' | 'activity'): Promise<{ type: string; title: string; body: string }> {
		const facts = await readFacts(this.context);
		return pageId === 'overview'
			? { type: OVERVIEW_VIEW_TYPE, title: 'Overview', body: overviewBody(facts) }
			: { type: ACTIVITY_VIEW_TYPE, title: 'Recent Activity', body: activityBody(facts) };
	}

	dispose(): void {
		for (const panel of this.panels.values()) {
			panel.dispose();
		}
		this.panels.clear();
	}
}
