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
				'<div class="hero-panel">' +
				'<div class="hero-panel__title">Release 13.0 is waiting on two checks</div>' +
				'<p class="hero-panel__desc">The site, the PDF and the search index are built. The help compiler is still running and <b>Data Points API</b> carries an ordering error that the last release did not have.</p>' +
				'<div class="hero-panel__actions">' +
				ui.button('Open Review Center', { kind: 'primary', icon: 'check', open: 'docs/review' }) +
				ui.button('See the Build', { icon: 'play', open: 'docs/builds' }) +
				ui.button('Dismiss', { kind: 'ghost', action: 'toast-dismissed' }) +
				'</div>' +
				'</div>' +
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
					actions: ui.button('All Activity', { kind: 'ghost', small: true, open: 'dashboard/activity' }),
					body: ui.list(
						data.activity.map(function (item) {
							return {
								icon: item.icon,
								title: item.title,
								sub: '<span class="cell-muted">' + ui.esc(item.sub) + '</span>',
								meta: ui.badge(item.tone === 'warn' ? 'Attention' : item.tone === 'ok' ? 'Done' : 'Info', item.tone === 'warn' ? 'warn' : item.tone === 'ok' ? 'ok' : 'info')
							};
						})
					)
				}) +
				ui.card({
					title: 'Needs You',
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
						{ icon: 'upload', tone: 'ok', title: 'Release 12.9 archived', sub: 't3000 · kept for pinned links · yesterday' },
						{ icon: 'download', tone: 'info', title: 'Firmware 2.15.0-rc2 downloaded', sub: 'Preview channel · 3.9 MB · yesterday' },
						{ icon: 'link', tone: 'warn', title: 'SharePoint source needs re-authorisation', sub: 'Field Notes · expired 8 days ago · yesterday' }
					]
				},
				{
					label: 'This week',
					items: [
						{ icon: 'repo', tone: 'info', title: 'Source bacnet-stack read', sub: '52 pages found · 2 days ago' },
						{ icon: 'check', tone: 'ok', title: '48 pages reviewed by Mei', sub: 'api-reference · 3 days ago' },
						{ icon: 'package', tone: 'info', title: 'Project T3-8R Hardware Guide created', sub: 'from the Hardware template · 5 days ago' }
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
				groups.map(function (group) {
					return (
						'<div class="mt-24">' +
						'<div class="eyebrow">' + ui.esc(group.label) + '</div>' +
						ui.list(group.items.map(function (item) {
							return {
								icon: item.icon,
								title: item.title,
								sub: '<span class="cell-muted">' + ui.esc(item.sub) + '</span>',
								meta: ui.badge(item.tone === 'warn' ? 'Attention' : item.tone === 'ok' ? 'Done' : 'Info', item.tone === 'warn' ? 'warn' : item.tone === 'ok' ? 'ok' : 'info')
							};
						})) +
						'</div>'
					);
				}).join('');

			return ui.view(body, { narrow: true });
		}
	};

	M.views['dashboard/health'] = {
		title: 'Coverage & Health',
		render: function () {
			var areas = data.knowledge;
			var body =
				ui.pageHead({
					title: 'Coverage & Health',
					icon: 'check',
					desc: 'Where the documentation stands against the sources it was read from. A page is "stale" when its source changed after the page did.',
					actions: ui.button('Rebuild Report', { icon: 'refresh', action: 'rebuild-report' })
				}) +
				ui.tiles([
					{ value: '94%', label: 'Areas covered' },
					{ value: '1,254', label: 'Pages' },
					{ value: '73%', label: 'Reviewed' },
					{ value: '89', label: 'Stale pages' },
					{ value: '12', label: 'Broken links' },
					{ value: '4', label: 'Unowned pages' }
				]) +
				'<div class="mt-24">' +
				ui.table({
					columns: [
						{ label: 'Area', render: function (row) { return '<span class="cell-strong">' + ui.esc(row.area) + '</span>'; } },
						{ label: 'Pages', align: 'right', render: function (row) { return '<span class="cell-mono">' + row.pages + '</span>'; } },
						{ label: 'Reviewed', align: 'right', render: function (row) { return '<span class="cell-mono">' + row.reviewed + '</span>'; } },
						{ label: 'Stale', align: 'right', render: function (row) { return '<span class="cell-mono">' + row.stale + '</span>'; } },
						{ label: 'Coverage', render: function (row) {
							var pct = Math.round((row.reviewed / row.pages) * 100);
							return ui.barRow(pct, pct + '%', pct >= 85 ? 'ok' : pct >= 70 ? undefined : 'warn');
						} }
					],
					rows: areas
				}) +
				'</div>' +
				'<div class="mt-24">' +
				ui.callout('<b>API Reference is the weak area.</b> 45 of 186 pages are older than the code they describe; the last source read changed 12 signatures that no page mentions.', { kind: 'warn' }) +
				'</div>';

			return ui.view(body);
		}
	};

	M.views['dashboard/needs'] = {
		title: 'Needs Review',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Needs Review',
					icon: 'alert',
					desc: 'The queue, not the report: each row names the page and the reason it is here, and opens that page in the editor.',
					actions: ui.button('Select All', { icon: 'check', action: 'select-all' })
				}) +
				ui.table({
					columns: [
						{ label: '', render: function (row) { return ui.dot(row.kind === 'err' ? 'err' : row.kind === 'warn' ? 'warn' : 'accent'); } },
						{ label: 'Page', render: function (row) { return '<span class="cell-strong">' + ui.esc(row.title) + '</span><div class="cell-muted" style="font-size:12px">' + ui.esc(row.where) + '</div>'; } },
						{ label: 'Why It Is Here', render: function (row) { return ui.esc(row.issue); } },
						{ label: 'Last Change', render: function (row) { return '<span class="cell-muted">' + ui.esc(row.age) + '</span>'; } },
						{ label: '', align: 'right', render: function () {
							return ui.button('Open', { small: true, icon: 'document', action: 'open-page' }) +
								ui.button('Ask AI', { small: true, kind: 'ghost', icon: 'sparkle', prompt: 'Draft an update for this page' });
						} }
					],
					rows: data.needs
				});
			return ui.view(body);
		}
	};

	/* ------------------------------------------------------------------ workspaces */

	M.views['workspaces/all'] = {
		title: 'All Workspaces',
		render: function () {
			var cards = data.workspaces.map(function (workspace) {
				return ui.card({
					interactive: true,
					open: workspace.active ? 'workspaces/t3000' : 'workspaces/all',
					title: workspace.name,
					icon: workspace.active ? 'layers' : 'folder',
					actions: workspace.active ? ui.badge('Open', 'accent') : '',
					desc: ui.esc(workspace.desc),
					body:
						'<div class="row" style="gap:14px;margin-top:10px;color:var(--fg-muted);font-size:12px">' +
						'<span>' + workspace.projects + ' projects</span>' +
						'<span>' + workspace.sources + ' sources</span>' +
						'<span>' + workspace.devices + ' devices</span>' +
						'</div>',
					foot: '<span>' + ui.icon('clock') + ' ' + ui.esc(workspace.updated) + '</span>'
				});
			}).join('');

			var body =
				ui.pageHead({
					title: 'All Workspaces',
					icon: 'layers',
					desc: 'A workspace is the folder the window is standing in — its projects, the sources they read, and the devices it can reach.',
					actions: ui.button('New Workspace', { kind: 'primary', icon: 'plus', action: 'new-workspace' })
				}) +
				'<div class="grid grid--2">' + cards + '</div>' +
				'<div class="mt-24">' +
				ui.callout('One window is on <b>one</b> workspace at a time. Switching one closes nothing: the tabs of the previous workspace come back when you return.') +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['workspaces/t3000'] = {
		title: 'T3000',
		render: function () {
			var body =
				ui.pageHead({
					eyebrow: 'Workspace',
					title: 'T3000',
					icon: 'building',
					desc: 'Building automation controller platform. 5 projects · 14 sources · 34 devices.',
					actions:
						ui.button('Documentation', { icon: 'document', open: 'docs/projects' }) +
						ui.button('Devices', { icon: 'chip', open: 'devices/all' })
				}) +
				ui.tiles([
					{ value: '894', label: 'Pages' },
					{ value: '14', label: 'Sources' },
					{ value: '34', label: 'Devices' },
					{ value: '1', label: 'Open release' },
					{ value: '17', label: 'Needs review' }
				]) +
				'<div class="mt-24 split">' +
				ui.card({
					title: 'Areas',
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
				'<div class="stack">' +
				ui.card({
					title: 'Sources',
					body: ui.list(data.sources.slice(0, 5).map(function (source) {
						return { icon: source.kind === 'Repository' ? 'repo' : 'document', title: source.name, sub: '<span class="cell-muted">' + ui.esc(source.detail) + '</span>', meta: ui.badge(source.state, source.tone) };
					}))
				}) +
				ui.card({
					title: 'Project Settings',
					body:
						'<dl class="kv">' +
						'<dt>Owner</dt><dd>Derek</dd>' +
						'<dt>Working folder</dt><dd class="cell-mono">~/Temco</dd>' +
						'<dt>Default branch</dt><dd class="cell-mono">main</dd>' +
						'<dt>Publishes to</dt><dd>Temco Learn · /t3000/</dd>' +
						'</dl>'
				}) +
				'</div>' +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['workspaces/templates'] = {
		title: 'Templates',
		render: function () {
			var templates = [
				{ name: 'Controller Manual', desc: 'Product overview, wiring, points, specifications and troubleshooting.', pages: 48 },
				{ name: 'Protocol Reference', desc: 'Objects, services, conformance and integration notes.', pages: 26 },
				{ name: 'API Reference', desc: 'Endpoints, schemas and samples generated from a repository.', pages: 34 },
				{ name: 'Release Notes', desc: 'One page per release, from commits since the previous tag.', pages: 8 }
			];
			var body =
				ui.pageHead({
					title: 'Templates',
					icon: 'package',
					desc: 'A template creates a project with its areas, its checks and its build targets already in place.',
					actions: ui.button('New Template', { icon: 'plus', action: 'new-template' })
				}) +
				'<div class="grid grid--2">' +
				templates.map(function (template) {
					return ui.card({
						title: template.name,
						icon: 'document',
						desc: ui.esc(template.desc),
						body: '<div class="cell-muted" style="font-size:12px;margin-top:8px">' + template.pages + ' pages · 8 areas · website + PDF</div>',
						foot: ui.button('Use Template', { small: true, action: 'use-template' }) + '<span>' + ui.esc('Included with the platform') + '</span>'
					});
				}).join('') +
				'</div>';
			return ui.view(body);
		}
	};
})(window.TemcoMock = window.TemcoMock || { views: {} });
