/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Temco Controls. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* Dashboard and Workspaces — the two surfaces the workbench module owns. */

(function (M) {
	'use strict';

	var ui = M.ui;
	var data = M.data;

	/* ------------------------------------------------------------------ dashboard */

	M.views['dashboard/overview'] = {
		title: 'Overview',
		render: function () {
			var body =
				ui.pageHead({
					eyebrow: 'Temco Platform',
					title: 'Overview',
					icon: 'home',
					desc: 'What the platform holds, what changed since you last looked, and the one thing that needs you next.',
					actions:
						ui.button('New Project', { kind: 'primary', icon: 'plus', action: 'new-project' }) +
						ui.button('Build the Site', { icon: 'play', action: 'build-site' })
				}) +
				ui.kpis(data.kpis) +
				'<div class="mt-16">' +
				ui.hero({
					title: 'Release 13.0 is waiting on two checks',
					desc: 'The site, the PDF and the search index are built. The help compiler is still running and <b>Data Points API</b> carries an ordering error that the last release did not have.',
					actions:
						ui.button('Open Review Center', { kind: 'primary', icon: 'check', open: 'docs/review' }) +
						ui.button('See the Build', { icon: 'play', open: 'docs/builds' }) +
						ui.button('Dismiss', { kind: 'ghost', action: 'toast-dismissed' })
				}) +
				'</div>' +
				'<div class="mt-24">' +
				'<div class="row row--between" style="margin-bottom:10px">' +
				'<h2 style="font-size:15px">Documentation Pipeline</h2>' +
				'<span class="cell-muted" style="font-size:12px">Sources → Knowledge → Review → Build → Publish → Learn</span>' +
				'</div>' +
				ui.pipeline(data.pipeline) +
				'</div>' +
				'<div class="mt-24 split">' +
				ui.card({
					title: 'Recent Activity',
					cls: 'card--plain',
					actions: ui.button('All Activity', { kind: 'ghost', small: true, open: 'dashboard/activity' }),
					body: ui.list(
						data.activity.map(function (item) {
							return {
								icon: item.icon,
								title: item.title,
								sub: '<span class="cell-muted">' + ui.esc(item.sub) + ' · ' + ui.esc(item.when) + '</span>',
								meta: ui.status(item.tone)
							};
						})
					)
				}) +
				ui.card({
					title: 'Needs You',
					cls: 'card--plain',
					actions: ui.button('Open', { kind: 'ghost', small: true, open: 'dashboard/needs' }),
					body: ui.list(
						data.needs.slice(0, 4).map(function (item) {
							return {
								icon: item.kind === 'err' ? 'alert' : 'clock',
								title: item.title,
								sub: '<span class="cell-muted">' + ui.esc(item.issue) + '</span>',
								meta: ui.badge(item.kind === 'err' ? 'Error' : item.kind === 'warn' ? 'Warning' : 'Review', item.kind === 'err' ? 'err' : item.kind === 'warn' ? 'warn' : 'info')
							};
						})
					)
				}) +
				'</div>' +
				'<div class="mt-24 grid grid--3">' +
				ui.card({ title: 'Devices', icon: 'chip', desc: '31 of 34 controllers are answering. T3-22I has been silent for two hours.', actions: ui.button('Open', { kind: 'ghost', small: true, open: 'devices/all' }), body: ui.barRow(91, '31/34', 'ok') }) +
				ui.card({ title: 'Knowledge', icon: 'book', desc: '1,254 pages across 8 areas. 341 pages have never been reviewed.', actions: ui.button('Open', { kind: 'ghost', small: true, open: 'docs/knowledge' }), body: ui.barRow(73, '73%', undefined) }) +
				ui.card({ title: 'Temco Learn', icon: 'graduation', desc: 'Version 12.9 is live. 13.0 publishes when the build finishes.', actions: ui.button('Open', { kind: 'ghost', small: true, open: 'learn/home' }), body: ui.barRow(100, 'Live', 'ok') }) +
				'</div>';

			return ui.view(body);
		}
	};

	M.views['dashboard/activity'] = {
		title: 'Recent Activity',
		render: function () {
			var groups = [
				{ label: 'Today', items: data.activity },
				{
					label: 'Yesterday',
					items: [
						{ module: 'Documentation', icon: 'upload', tone: 'ok', title: 'Release 12.9 archived', sub: 't3000 · kept for pinned links', when: '17:20' },
						{ module: 'Devices', icon: 'package', tone: 'info', title: 'Firmware 2.14.3 staged for 6 devices', sub: 'Fleet', when: '10:15' },
						{ module: 'Devices', icon: 'download', tone: 'info', title: 'Firmware 2.15.0-rc2 downloaded', sub: 'Preview channel · 3.9 MB', when: '09:04' },
						{ module: 'Documentation', icon: 'link', tone: 'warn', title: 'SharePoint source needs re-authorisation', sub: 'Field Notes · expired 8 days ago', when: '08:32' }
					]
				},
				{
					label: 'This week',
					items: [
						{ module: 'Documentation', icon: 'repo', tone: 'info', title: 'Source bacnet-stack read', sub: '52 pages found', when: 'Tue' },
						{ module: 'Documentation', icon: 'check', tone: 'ok', title: '48 pages reviewed by Mei', sub: 'api-reference', when: 'Mon' },
						{ module: 'Documentation', icon: 'package', tone: 'info', title: 'Project T3-8R Hardware Guide created', sub: 'from the Hardware template', when: 'Sun' }
					]
				}
			];

			var body =
				ui.pageHead({
					title: 'Recent Activity',
					icon: 'clock',
					desc: 'Everything every module recorded, newest first. Filters narrow the list; nothing here is editable.',
					actions:
						'<div class="segmented" role="group" aria-label="Filter activity">' +
						'<button type="button" aria-pressed="true" data-action="filter-all">All</button>' +
						'<button type="button" aria-pressed="false" data-action="filter-docs">Documentation</button>' +
						'<button type="button" aria-pressed="false" data-action="filter-devices">Devices</button>' +
						'<button type="button" aria-pressed="false" data-action="filter-ai">AI</button>' +
						'</div>'
				}) +
				'<div class="feed-wrap">' +
				groups.map(function (group) {
					return (
						'<div class="group-head">' +
						'<span class="group-head__label">' + ui.esc(group.label) + '</span>' +
						'<span class="group-head__rule"></span>' +
						'<span class="group-head__count">' + group.items.length + (group.items.length === 1 ? ' event' : ' events') + '</span>' +
						'</div>' +
						'<ol class="feed">' +
						group.items.map(function (item) {
							return (
								'<li class="feed__item">' +
								ui.toneMark(item.icon, item.tone) +
								'<div class="feed__main">' +
								'<div class="feed__title">' + ui.esc(item.title) + '</div>' +
								'<div class="feed__meta">' + ui.esc(item.sub) + '</div>' +
								'</div>' +
								'<div class="feed__module">' + ui.esc(item.module || '') + '</div>' +
								'<div class="feed__side">' +
								ui.status(item.tone) +
								'<time class="feed__when">' + ui.esc(item.when) + '</time>' +
								'</div>' +
								'</li>'
							);
						}).join('') +
						'</ol>'
					);
				}).join('') +
				'</div>';

			return ui.view(body);
		}
	};

	M.views['dashboard/health'] = {
		title: 'Coverage & Health',
		render: function () {
			var areas = data.knowledge.slice().sort(function (a, b) {
				return a.reviewed / a.pages - b.reviewed / b.pages;
			});
			var total = areas.reduce(function (sum, area) {
				return { pages: sum.pages + area.pages, reviewed: sum.reviewed + area.reviewed, stale: sum.stale + area.stale };
			}, { pages: 0, reviewed: 0, stale: 0 });
			var pct = function (reviewed, pages) { return Math.round((reviewed / pages) * 100); };
			var failing = data.healthChecks.filter(function (check) { return check.found > 0; }).length;

			var coverageRow = function (name, pages, reviewed, stale, extra) {
				return (
					'<div class="coverage__row' + (extra || '') + '">' +
					'<div class="coverage__name">' +
					'<span class="coverage__area">' + ui.esc(name) + '</span>' +
					'<span class="coverage__pages">' + pages.toLocaleString('en-US') + ' pages</span>' +
					'</div>' +
					ui.bar(pct(reviewed, pages)) +
					'<span class="coverage__value">' + reviewed.toLocaleString('en-US') + ' of ' + pages.toLocaleString('en-US') + '</span>' +
					'<span class="coverage__pct">' + pct(reviewed, pages) + '%</span>' +
					'<span class="coverage__stale">' + (stale === 0 ? '<span class="cell-muted">—</span>' : ui.badge(stale + ' stale', 'warn')) + '</span>' +
					'</div>'
				);
			};

			var body =
				ui.pageHead({
					title: 'Coverage & Health',
					icon: 'check',
					desc: 'Where the documentation stands against the sources it was read from. A page is "stale" when its source changed after the page did.',
					actions: ui.button('Export Report', { icon: 'download', action: 'export-report' })
				}) +
				ui.hero({
					tone: 'warn',
					eyebrow: 'Scanned 14 minutes ago · ' + data.sources.length + ' sources',
					title: total.stale + ' pages describe a source that has already moved on',
					desc: 'API Reference carries 45 of them, and the last read of <b>t3000webview</b> changed 12 signatures that no page mentions. Reviewed coverage everywhere else is between 73% and 100%.',
					actions:
						ui.button('Review the Stale Pages', { kind: 'primary', icon: 'check', open: 'docs/review' }) +
						ui.button('Rebuild Report', { icon: 'refresh', action: 'rebuild-report' })
				}) +
				'<div class="mt-24">' +
				ui.kpis([
					{ label: 'Pages', value: total.pages.toLocaleString('en-US'), meta: 'across ' + areas.length + ' areas' },
					{ label: 'Reviewed', value: pct(total.reviewed, total.pages) + '%', meta: total.reviewed.toLocaleString('en-US') + ' of ' + total.pages.toLocaleString('en-US') },
					{ label: 'Stale', value: String(total.stale), meta: 'source moved after the page' },
					{ label: 'Health checks', value: (data.healthChecks.length - failing) + ' of ' + data.healthChecks.length, meta: 'passing' }
				]) +
				'</div>' +
				'<div class="mt-24">' +
				ui.card({
					title: 'Coverage by Area',
					cls: 'card--plain',
					actions: ui.button('Open Knowledge', { small: true, kind: 'ghost', open: 'docs/knowledge' }),
					desc: 'Worst first. Reviewed counts pages a person has signed off since the last source read; stale counts pages the source has since outrun.',
					body:
						'<div class="coverage">' +
						areas.map(function (area) {
							return coverageRow(area.area, area.pages, area.reviewed, area.stale);
						}).join('') +
						coverageRow('All areas', total.pages, total.reviewed, total.stale, ' coverage__row--total') +
						'</div>'
				}) +
				'</div>' +
				'<div class="mt-24">' +
				ui.card({
					title: 'Health Checks',
					cls: 'card--plain',
					actions: ui.button('Run Checks', { small: true, kind: 'ghost', icon: 'refresh', action: 'run-checks' }),
					desc: 'What the report looks at besides coverage. A check with a count is a queue you can open, not a number to glance at.',
					body: ui.list(data.healthChecks.map(function (check) {
						return {
							icon: check.found === 0 ? 'check' : 'alert',
							title: check.name,
							sub: '<span class="cell-muted">' + ui.esc(check.detail) + '</span>',
							meta: check.found === 0 ? ui.badge('Pass', 'ok') : ui.badge(check.found + ' found', 'warn'),
							open: check.found === 0 ? undefined : check.view
						};
					}))
				}) +
				'</div>' +
				'<div class="mt-16 cell-muted" style="font-size:12px">Every number here is derived from the source reads, not typed in. Rebuild the report after a source changes.</div>';

			return ui.view(body);
		}
	};

	M.views['dashboard/needs'] = {
		title: 'Needs Review',
		render: function () {
			var groups = [
				{ kind: 'err', label: 'Blocking the release' },
				{ kind: 'warn', label: 'Needs a decision' },
				{ kind: 'info', label: 'AI drafts waiting' }
			];

			var rowActions = function (row) {
				if (row.kind === 'err') {
					return ui.button('Fix with AI', { small: true, kind: 'primary', icon: 'sparkle', prompt: 'Fix this page for me' }) +
						ui.button('Open', { small: true, kind: 'ghost', action: 'open-page' });
				}
				if (row.kind === 'info') {
					/* Secondary on purpose: only the errors that stop a release get the loud button. */
					return ui.button('Review Draft', { small: true, icon: 'check', action: 'open-page' });
				}
				return ui.button('Open', { small: true, icon: 'document', action: 'open-page' });
			};

			/* The mark says the kind before the reason does: broken, waiting on a person, or a draft. */
			var marks = { err: ['alert', 'err'], warn: ['clock', 'warn'], info: ['sparkle', 'accent'] };
			var rowMark = function (row) {
				var mark = marks[row.kind] || ['info', 'info'];
				return ui.toneMark(mark[0], mark[1]);
			};

			var body =
				ui.pageHead({
					title: 'Needs Review',
					icon: 'alert',
					desc: data.needs.length + ' pages are waiting on a person. Each group says what it wants from you — a fix, a decision, or a look at a draft — and nothing here is a report.',
					actions:
						ui.button('Review Next', { kind: 'primary', icon: 'check', action: 'open-page' }) +
						ui.button('Ask AI to Draft', { icon: 'sparkle', prompt: 'Draft updates for every page in the review queue' })
				}) +
				'<div class="mt-16">' +
				ui.callout('<b>Two errors keep 13.0 from publishing.</b> Everything under them is ownership, an out-of-date screenshot or a draft — worth clearing, none of it blocking the build.', { kind: 'warn' }) +
				'</div>' +
				groups.map(function (group) {
					var rows = data.needs.filter(function (row) { return row.kind === group.kind; });
					if (!rows.length) {
						return '';
					}
					return (
						'<div class="group-head">' +
						'<span class="group-head__label">' + ui.esc(group.label) + '</span>' +
						'<span class="group-head__rule"></span>' +
						'<span class="group-head__count">' + rows.length + (rows.length === 1 ? ' page' : ' pages') + '</span>' +
						'</div>' +
						ui.table({
							plain: true,
							compact: true,
							columns: [
								{ label: '', render: rowMark },
								{
									label: 'Page', render: function (row) {
										return '<span class="cell-strong">' + ui.esc(row.title) + '</span>' +
											'<div class="cell-muted" style="font-size:12px">' + ui.esc(row.where) + '</div>';
									}
								},
								{ label: 'Why It Is Here', render: function (row) { return ui.esc(row.issue); } },
								{ label: 'Waiting', align: 'right', render: function (row) { return '<span class="cell-muted">' + ui.esc(row.age) + '</span>'; } },
								{ label: '', align: 'right', render: rowActions }
							],
							rows: rows
						})
					);
				}).join('');

			return ui.view(body);
		}
	};

	/* ------------------------------------------------------------------ workspaces */

	M.views['workspaces/all'] = {
		title: 'All Workspaces',
		render: function () {
			var current = data.workspaces.filter(function (workspace) { return workspace.active; })[0];
			var others = data.workspaces.filter(function (workspace) { return !workspace.active; });
			var projects = data.workspaces.reduce(function (total, workspace) { return total + workspace.projects; }, 0);
			var sources = data.workspaces.reduce(function (total, workspace) { return total + workspace.sources; }, 0);

			/* A workspace row is a folder, not a card: what you need before switching is where it
			   stands and how much is in it. Only the current one has a detail surface, so only it
			   pretends to be a link — the others offer the switch they can actually perform. */
			var workspaceRow = function (workspace, isCurrent) {
				return (
					'<div class="record-row' + (isCurrent ? ' record-row--current' : ' record-row--static') + '"' +
					(isCurrent ? ' data-open="workspaces/t3000"' : '') + '>' +
					ui.toneMark('layers', isCurrent ? 'accent' : '') +
					'<div class="record-row__main">' +
					'<div class="record-row__title"><span class="record-row__name">' + ui.esc(workspace.name) + '</span></div>' +
					'<div class="record-row__meta">' +
					'<span class="cell-mono">' + ui.esc(workspace.path) + '</span>' +
					'<span>' + workspace.projects + ' projects</span>' +
					'<span>' + workspace.sources + ' sources</span>' +
					(workspace.devices ? '<span>' + workspace.devices + ' devices</span>' : '<span>no devices</span>') +
					'<span>opened ' + ui.esc(workspace.updated) + '</span>' +
					'</div>' +
					'</div>' +
					'<div class="record-row__state">' + (isCurrent ? ui.badge('Current', 'accent') : '') + '</div>' +
					(isCurrent
						? ui.button('Open', { small: true, kind: 'ghost', open: 'workspaces/t3000' })
						: ui.button('Switch', { small: true, kind: 'ghost', action: 'switch-workspace' })) +
					'</div>'
				);
			};

			var body =
				ui.pageHead({
					title: 'All Workspaces',
					icon: 'layers',
					desc: 'A workspace is the folder the window stands in: its projects, the sources they read, and the devices it can reach. One window is on one workspace at a time.',
					actions: ui.button('New Workspace', { kind: 'primary', icon: 'plus', action: 'new-workspace' })
				}) +
				ui.tiles([
					{ value: String(data.workspaces.length), label: 'On this machine' },
					{ value: String(projects), label: 'Projects' },
					{ value: String(sources), label: 'Sources' },
					{ value: current ? current.name : '—', label: 'Open now' }
				]) +
				ui.group({
					label: 'Open Now',
					count: 'this window',
					note: 'Every tab, the AI bar and the panel in front of you belong to this workspace. Opening another one does not close them.',
					body: current ? workspaceRow(current, true) : ''
				}) +
				ui.group({
					label: 'Elsewhere On This Machine',
					count: others.length + ' workspaces',
					note: 'Each keeps its own tabs, its own working folder and its own selection, so switching back is where you left off.',
					body: others.map(function (workspace) { return workspaceRow(workspace, false); }).join('')
				}) +
				ui.group({
					label: 'What Switching Does',
					count: '3 facts',
					body:
						'<div class="record-row record-row--static">' +
						ui.toneMark('layers') +
						'<div class="record-row__main">' +
						'<div class="record-row__title"><span class="record-row__name">Tabs come back</span></div>' +
						'<div class="record-row__meta"><span>each workspace remembers the surfaces it had open</span></div>' +
						'</div><div class="record-row__state"></div><div class="record-row__state"></div>' +
						'</div>' +
						'<div class="record-row record-row--static">' +
						ui.toneMark('folder') +
						'<div class="record-row__main">' +
						'<div class="record-row__title"><span class="record-row__name">The working folder follows</span></div>' +
						'<div class="record-row__meta"><span>repositories are cloned beside the workspace, not in one global folder</span></div>' +
						'</div><div class="record-row__state"></div><div class="record-row__state"></div>' +
						'</div>' +
						'<div class="record-row record-row--static">' +
						ui.toneMark('chip') +
						'<div class="record-row__main">' +
						'<div class="record-row__title"><span class="record-row__name">The device list narrows</span></div>' +
						'<div class="record-row__meta"><span>a workspace only reaches the controllers it lists</span></div>' +
						'</div><div class="record-row__state"></div><div class="record-row__state"></div>' +
						'</div>'
				});

			return ui.view(body);
		}
	};

	M.views['workspaces/t3000'] = {
		title: 'T3000',
		render: function () {
			var workspace = data.workspaces.filter(function (candidate) { return candidate.id === 't3000'; })[0];
			var body =
				ui.pageHead({
					eyebrow: 'Workspace',
					title: 'T3000',
					icon: 'building',
					desc: ui.esc(workspace.desc) + '. ' + workspace.projects + ' projects · ' + workspace.sources + ' sources · ' + workspace.devices + ' devices.',
					actions:
						ui.button('Documentation', { icon: 'document', open: 'docs/projects' }) +
						ui.button('Devices', { icon: 'chip', open: 'devices/all' })
				}) +
				ui.hero({
					eyebrow: 'Current workspace',
					title: 'Everything in this window is T3000',
					desc: workspace.projects + ' projects, ' + workspace.sources + ' sources and ' + workspace.devices + ' devices, with one release in flight. Switching workspace closes nothing — the tabs come back when you return.',
					actions:
						ui.button('Open Review Center', { kind: 'primary', icon: 'check', open: 'docs/review' }) +
						ui.button('Switch Workspace…', { icon: 'layers', action: 'switch-workspace' })
				}) +
				'<div class="mt-24">' +
				ui.tiles([
					{ value: '1,254', label: 'Pages' },
					{ value: String(workspace.sources), label: 'Sources' },
					{ value: String(workspace.devices), label: 'Devices' },
					{ value: '1', label: 'Open release' },
					{ value: '17', label: 'Needs review' }
				]) +
				'</div>' +
				'<div class="mt-24 split">' +
				ui.card({
					title: 'Areas',
					cls: 'card--plain',
					desc: 'The registry, as the side bar would show it when this workspace is open.',
					body: ui.list(data.knowledge.map(function (area) {
						return {
							icon: 'book',
							title: area.area,
							sub: '<span class="cell-muted">' + area.pages + ' pages · ' + area.stale + ' stale</span>',
							meta: ui.badge(area.stale === 0 ? 'Current' : area.stale + ' stale', area.stale === 0 ? 'ok' : 'warn')
						};
					}))
				}) +
				ui.card({
					title: 'Sources',
					cls: 'card--plain',
					body: ui.list(data.sources.slice(0, 5).map(function (source) {
						return { icon: source.kind === 'Repository' ? 'repo' : 'document', title: source.name, sub: '<span class="cell-muted">' + ui.esc(source.detail) + '</span>', meta: ui.badge(source.state, source.tone) };
					}))
				}) +
				'</div>' +
				/* How the workspace is set up is not activity — it is the last thing on the page. */
				'<div class="mt-24">' +
				ui.card({
					title: 'Project Settings',
					icon: 'gear',
					cls: 'card--plain',
					actions: ui.button('Edit Settings', { small: true, action: 'project-settings' }),
					desc: 'Stored in the platform database, not in the repository.',
					body:
						'<div class="settings-strip">' +
						'<div><div class="settings-strip__label">Owner</div><div class="settings-strip__value">Derek</div></div>' +
						'<div><div class="settings-strip__label">Working Folder</div><div class="settings-strip__value cell-mono">~/Temco</div></div>' +
						'<div><div class="settings-strip__label">Default Branch</div><div class="settings-strip__value cell-mono">main</div></div>' +
						'<div><div class="settings-strip__label">Publishes To</div><div class="settings-strip__value">Temco Learn · /t3000/</div></div>' +
						'</div>'
				}) +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['workspaces/templates'] = {
		title: 'Templates',
		render: function () {
			var templates = data.templates;
			var starter = templates.reduce(function (total, template) { return total + template.pages; }, 0);

			var fact = function (icon, title, note) {
				return (
					'<div class="record-row record-row--static">' +
					ui.toneMark(icon) +
					'<div class="record-row__main">' +
					'<div class="record-row__title"><span class="record-row__name">' + ui.esc(title) + '</span></div>' +
					'<div class="record-row__meta"><span>' + ui.esc(note) + '</span></div>' +
					'</div>' +
					'<div class="record-row__state"></div>' +
					'<div class="record-row__state"></div>' +
					'</div>'
				);
			};

			var body =
				ui.pageHead({
					title: 'Templates',
					icon: 'package',
					desc: 'A template is the shape a project starts with: the areas it opens, the pages it stubs out and the artifacts the build will produce. It writes nothing until a project uses it.',
					actions: ui.button('New Template', { icon: 'plus', action: 'new-template' })
				}) +
				ui.tiles([
					{ value: String(templates.length), label: 'Templates' },
					{ value: String(starter), label: 'Starter pages' },
					{ value: String(data.knowledge.length), label: 'Areas it can draw from' },
					{ value: String(data.healthChecks.length), label: 'Checks every build runs' }
				]) +
				ui.group({
					label: 'Templates',
					count: templates.length + ' templates',
					note: 'Using one opens New Project with this shape already chosen — the template adds areas and page order, never a page body.',
					body: templates.map(function (template) {
						return (
							'<div class="record-row">' +
							ui.toneMark('document') +
							'<div class="record-row__main">' +
							'<div class="record-row__title"><span class="record-row__name">' + ui.esc(template.name) + '</span></div>' +
							'<div class="record-row__meta">' +
							'<span>' + template.pages + ' starter pages</span>' +
							'<span>' + template.areas.length + ' areas</span>' +
							'<span>' + ui.esc(template.targets.join(' · ')) + '</span>' +
							'<span>filled from ' + ui.esc(template.from) + '</span>' +
							'</div>' +
							'</div>' +
							'<div class="record-row__state cell-mono cell-muted">' + template.pages + ' pp</div>' +
							ui.button('Use Template', { small: true, kind: 'ghost', action: 'use-template', attrs: 'data-template="' + ui.esc(template.name) + '"' }) +
							'</div>'
						);
					}).join('')
				}) +
				ui.group({
					label: 'What a Template Decides',
					count: '4 facts',
					body:
						fact('list', 'Areas and page order', 'the registry areas this kind of book needs, and where its pages sit inside them') +
						fact('check', 'Checks', 'the same ' + data.healthChecks.length + ' health checks run on every build, whatever the template') +
						fact('package', 'Build targets', 'website is always one; PDF, CHM and the indexes are chosen per template') +
						fact('users', 'What it does not decide', 'content, owner or version — those come from the project and from the first read')
				}) +
				'<div class="mt-16">' +
				ui.callout('A template creates empty pages with titles and an order. The first read of a source is what fills them, which is why a template on its own produces nothing a reader can reach.') +
				'</div>';

			return ui.view(body);
		}
	};
})(window.TemcoMock = window.TemcoMock || { views: {} });
