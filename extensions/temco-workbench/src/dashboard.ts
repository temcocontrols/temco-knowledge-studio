// The Dashboard's pages: Overview, Recent Activity, Coverage & Health.
//
// Rebuilt from the mock (`docs/mock/js/views.overview.js`) on the shared page kit. The mock is the design; the only
// thing this module adds is the way a page runs a command — a `data-command` button, which the kit's script turns
// into a message and `runCommand` executes.
//
// The numbers are the mock's sample (`dashboardSample.ts`), because the platform does not yet have one query that
// returns them. The pages say what they are for in their own words; none of them pretends the numbers are live.

import * as vscode from 'vscode';
import { ACTIVITY_TODAY, ACTIVITY_WEEK, ACTIVITY_YESTERDAY, CHECKS, COVERAGE, Event, KPIS, NEEDS, PIPELINE } from './dashboardSample';
import { commandScript, escapeHtml, icon, page, pageColumn, runCommand, toneMark } from './ui';

/** The view types the dashboard opens under. */
export const OVERVIEW_VIEW_TYPE = 'temcoWorkbench.overview';
export const ACTIVITY_VIEW_TYPE = 'temcoWorkbench.activity';
export const HEALTH_VIEW_TYPE = 'temcoWorkbench.health';

const action = (label: string, command: string, kind?: 'primary' | 'ghost'): string =>
	`<button type="button" class="btn${kind ? ` btn--${kind}` : ''}" data-command="${command}"><span>${escapeHtml(label)}</span></button>`;

/** The small line under a KPI's number. */
const kpi = (entry: typeof KPIS[number]): string =>
	`<div class="kpi"><div class="kpi__label">${escapeHtml(entry.label)}</div><div class="kpi__value">${escapeHtml(entry.value)}</div><div class="cell-muted" style="font-size:12px">${escapeHtml(entry.note)}</div></div>`;

/** One event: a tone mark, what happened, and when. */
const eventRow = (entry: Event): string =>
	`<li class="feed__item">
	${toneMark(entry.icon, entry.tone)}
	<div class="feed__main">
		<div class="feed__title">${escapeHtml(entry.title)}</div>
		<div class="feed__meta">${escapeHtml(entry.sub)} · ${escapeHtml(entry.when)}</div>
	</div>
	<div class="feed__side"><span class="feed__module">${escapeHtml(entry.module)}</span></div>
</li>`;

function rules(label: string, count: string, buttons = ''): string {
	return `<div class="group-head"><span class="group-head__label">${escapeHtml(label)}</span><span class="group-head__rule"></span><span class="group-head__count">${escapeHtml(count)}</span>${buttons ? `<span class="group-head__actions">${buttons}</span>` : ''}</div>`;
}

function overviewBody(): string {
	const pipeline = PIPELINE.map((stage) =>
		`<button type="button" class="pipeline__stage" data-command="${stage.view}">
			<span class="pipeline__n">${stage.n}</span>
			<span class="pipeline__name">${escapeHtml(stage.name)}</span>
			<span class="pipeline__meta">${escapeHtml(stage.meta)}</span>
		</button>`).join('');

	return `<div class="page-head">
	<div class="page-head__main">
		<div class="eyebrow">Temco Platform</div>
		<h1 class="page-head__title">${icon('home')}Overview</h1>
		<p class="page-head__desc">What the platform holds, what changed since you last looked, and the one thing that needs you next.</p>
	</div>
	<div class="page-head__actions">${action('New Project', 'temcoProjects.newProject', 'primary')}${action('Build the Site', 'temcoDocs.buildSite')}</div>
</div>

<div class="grid grid--4">${KPIS.map(kpi).join('')}</div>

<div class="mt-16">
	<div class="hero-panel">
		<div class="eyebrow">Version 13.0</div>
		<div class="hero-panel__title">Release 13.0 is waiting on two checks</div>
		<p class="hero-panel__desc">The site, the PDF and the search index are built. The help compiler is still running and <b>Data Points API</b> carries an ordering error the last release did not have.</p>
		<div class="hero-panel__actions">${action('Open Documentation Owed', 'temcoDocs.stalenessReport', 'primary')}${action('Build the Offline Help', 'temcoDocs.buildHelp')}</div>
	</div>
</div>

<div class="mt-24">
	<div class="row row--between" style="margin-bottom:10px">
		<span class="group-head__label">Documentation Pipeline</span>
		<span class="cell-muted" style="font-size:12px">Sources → Documents → Review → Build → Publish</span>
	</div>
	<div class="pipeline">${pipeline}</div>
</div>

<div class="mt-24 grid grid--2">
	<div>
		${rules('Recent Activity', `${ACTIVITY_TODAY.length} today`, action('All Activity', 'temcoWorkbench.activity', 'ghost'))}
		<ol class="feed">${ACTIVITY_TODAY.map(eventRow).join('')}</ol>
	</div>
	<div>
		${rules('Needs You', `${NEEDS.length} items`, action('Review', 'temcoWorkbench.openNeeds', 'ghost'))}
		<div class="record-list">${NEEDS.slice(0, 4).map((entry) =>
			`<div class="record-row record-row--static">
				${toneMark(entry.tone === 'err' ? 'alert' : 'clock', entry.tone)}
				<div class="record-row__main">
					<div class="record-row__title"><span class="record-row__name">${escapeHtml(entry.title)}</span></div>
					<div class="record-row__meta"><span>${escapeHtml(entry.issue)}</span></div>
				</div>
				<div class="record-row__state"><span class="badge badge--${entry.tone === 'err' ? 'err' : entry.tone === 'warn' ? 'warn' : 'info'}">${entry.tone === 'err' ? 'Error' : entry.tone === 'warn' ? 'Warning' : 'Review'}</span></div>
				<span class="record-row__go"></span>
			</div>`).join('')}</div>
	</div>
</div>

<div class="mt-24 grid grid--3">
	<div class="card"><div class="card__head"><div class="card__title">Devices</div></div><p class="card__desc">31 of 34 controllers are answering. T3-22I has been silent for two hours.</p><div class="card__body">${bar(91, '31 / 34', 'ok')}</div></div>
	<div class="card"><div class="card__head"><div class="card__title">Knowledge</div></div><p class="card__desc">1,254 pages across 8 areas. 341 pages have never been reviewed.</p><div class="card__body">${bar(73, '73%')}</div></div>
	<div class="card"><div class="card__head"><div class="card__title">Temco Learn</div></div><p class="card__desc">Version 12.9 is live. 13.0 publishes when the build finishes.</p><div class="card__body">${bar(100, 'Live', 'ok')}</div></div>
</div>`;
}

function bar(pct: number, label: string, kind?: string): string {
	return `<div class="bar"><span class="bar__fill${kind ? ` bar__fill--${kind}` : ''}" style="width:${pct}%"></span></div><div class="cell-muted" style="font-size:12px;margin-top:6px">${escapeHtml(label)}</div>`;
}

function activityBody(): string {
	const group = (label: string, items: Event[]): string =>
		`${rules(label, `${items.length} ${items.length === 1 ? 'event' : 'events'}`)}<ol class="feed">${items.map(eventRow).join('')}</ol>`;

	return `<div class="page-head">
	<div class="page-head__main">
		<h1 class="page-head__title">${icon('clock')}Recent Activity</h1>
		<p class="page-head__desc">Everything every module recorded, newest first. Nothing here is editable.</p>
	</div>
</div>
<div class="feed-wrap">
	<div class="mt-8">${group('Today', ACTIVITY_TODAY)}</div>
	<div class="mt-24">${group('Yesterday', ACTIVITY_YESTERDAY)}</div>
	<div class="mt-24">${group('This Week', ACTIVITY_WEEK)}</div>
</div>`;
}

function healthBody(): string {
	const rows = COVERAGE.map((area) => {
		const pct = Math.round((area.reviewed / area.pages) * 100);
		return `<div class="record-row record-row--static">
			${toneMark('folder', area.stale > 15 ? 'warn' : undefined)}
			<div class="record-row__main">
				<div class="record-row__title"><span class="record-row__name">${escapeHtml(area.area)}</span></div>
				<div class="record-row__meta"><span>${area.pages} pages · ${area.reviewed} reviewed · ${area.stale} stale</span></div>
				<div style="margin-top:8px;max-width:420px">${bar(pct, `${pct}% reviewed`)}</div>
			</div>
			<div class="record-row__state"><span class="badge ${pct >= 70 ? 'badge--ok' : 'badge--warn'}">${pct}%</span></div>
			<span class="record-row__go"></span>
		</div>`;
	}).join('');

	const checks = CHECKS.map((check) =>
		`<div class="record-row record-row--static">
			${toneMark(check.tone === 'err' ? 'error' : check.tone === 'ok' ? 'check' : 'warning', check.tone === 'ok' ? 'ok' : check.tone)}
			<div class="record-row__main">
				<div class="record-row__title"><span class="record-row__name">${escapeHtml(check.name)}</span></div>
				<div class="record-row__meta"><span>${escapeHtml(check.detail)}</span></div>
			</div>
			<div class="record-row__state"><span class="badge ${check.tone === 'ok' ? 'badge--ok' : check.tone === 'err' ? 'badge--err' : check.tone === 'warn' ? 'badge--warn' : 'badge--info'}">${check.found}</span></div>
			<span class="record-row__go"></span>
		</div>`).join('');

	return `<div class="page-head">
	<div class="page-head__main">
		<h1 class="page-head__title">${icon('chart')}Coverage &amp; Health</h1>
		<p class="page-head__desc">How much of the set has been read, reviewed and shipped — per area, and what the checks found.</p>
	</div>
	<div class="page-head__actions">${action('Validate', 'temcoDocs.validate', 'primary')}${action('Documentation Owed', 'temcoDocs.stalenessReport')}</div>
</div>

${rules('Coverage by Area', `${COVERAGE.length} areas`)}
<div class="record-list">${rows}</div>

<div class="mt-24">
	${rules('Checks', `${CHECKS.length} run by the build`)}
	<div class="record-list">${checks}</div>
</div>`;
}

/** One panel per page, kept open so a second visit reveals the tab. */
export class DashboardPages {
	private readonly panels = new Map<string, vscode.WebviewPanel>();

	constructor(private readonly context: vscode.ExtensionContext) { }

	open(pageId: 'overview' | 'activity' | 'health'): void {
		const existing = this.panels.get(pageId);
		if (existing) {
			existing.reveal(pageColumn());
			return;
		}
		const definition = pageId === 'overview'
			? { type: OVERVIEW_VIEW_TYPE, title: 'Overview', body: overviewBody() }
			: pageId === 'activity'
				? { type: ACTIVITY_VIEW_TYPE, title: 'Recent Activity', body: activityBody() }
				: { type: HEALTH_VIEW_TYPE, title: 'Coverage & Health', body: healthBody() };

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

	dispose(): void {
		for (const panel of this.panels.values()) {
			panel.dispose();
		}
		this.panels.clear();
	}
}
