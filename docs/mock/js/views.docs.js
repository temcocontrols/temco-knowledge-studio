/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Temco Controls. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* Documentation — Sources, Knowledge, Review, Build, Releases. */

(function (M) {
	'use strict';

	var ui = M.ui;
	var data = M.data;

	M.views['docs/projects'] = {
		title: 'Projects',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Projects',
					icon: 'folder',
					desc: 'A project is a version of a product\'s documentation: its sources, its pages and the artifacts it builds.',
					actions:
						ui.button('New Project', { kind: 'primary', icon: 'plus', action: 'new-project' }) +
						ui.button('Import', { icon: 'download', action: 'import-project' })
				}) +
				ui.table({
					columns: [
						{
							label: 'Project', render: function (row) {
								return '<span class="cell-strong">' + ui.esc(row.name) + '</span><div class="cell-muted cell-mono" style="font-size:11px">v' + ui.esc(row.version) + '</div>';
							}
						},
						{ label: 'Pages', align: 'right', render: function (row) { return '<span class="cell-mono">' + row.pages + '</span>'; } },
						{ label: 'Sources', align: 'right', render: function (row) { return '<span class="cell-mono">' + row.sources + '</span>'; } },
						{ label: 'Owner', render: function (row) { return ui.esc(row.owner); } },
						{ label: 'State', render: function (row) { return ui.badge(row.state, row.tone); } },
						{ label: 'Updated', render: function (row) { return '<span class="cell-muted">' + ui.esc(row.updated) + '</span>'; } },
						{ label: '', align: 'right', render: function () { return ui.button('Open', { small: true, open: 'docs/knowledge' }); } }
					],
					rows: data.docsProjects
				}) +
				'<div class="mt-24 split">' +
				ui.card({
					title: 'Current Project',
					cls: 'card--current',
					desc: 'T3000 Documentation is selected in this window.',
					body:
						'<dl class="kv">' +
						'<dt>Version</dt><dd class="cell-mono">13.0</dd>' +
						'<dt>Audience</dt><dd>Integrators and installers</dd>' +
						'<dt>Areas</dt><dd>8</dd>' +
						'<dt>Build targets</dt><dd>Website · PDF · CHM · Search · AI index</dd>' +
						'<dt>Publishes to</dt><dd>Temco Learn · /t3000/13.0/</dd>' +
						'</dl>',
					foot: ui.button('Project Settings', { small: true, action: 'project-settings' }) + '<span>Stored in the platform database, not in the repository</span>'
				}) +
				ui.card({
					title: 'Sources of This Project',
					body: ui.list(data.sources.slice(0, 4).map(function (source) {
						return { icon: source.kind === 'Repository' ? 'repo' : 'document', title: source.name, sub: '<span class="cell-muted">' + ui.esc(source.found) + '</span>', meta: ui.badge(source.state, source.tone) };
					})),
					foot: ui.button('All Sources', { small: true, kind: 'ghost', open: 'docs/sources' })
				}) +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['docs/repositories'] = {
		title: 'Repositories',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Repositories',
					icon: 'repo',
					desc: 'The repositories this workspace reads, and whether their local copy is here. Reading a repository records the pages it declares; it never writes to it.',
					actions:
						ui.button('Add Repository', { kind: 'primary', icon: 'plus', action: 'add-source' }) +
						ui.button('Read All', { icon: 'refresh', action: 'read-all' })
				}) +
				ui.tiles([
					{ value: String(data.repositories.length), label: 'Repositories' },
					{ value: '3', label: 'Cloned locally' },
					{ value: '1,884', label: 'Files' },
					{ value: '254', label: 'Pages found' }
				]) +
				'<div class="mt-24">' +
				ui.table({
					columns: [
						{ label: 'Repository', render: function (row) {
							return '<span class="cell-strong">' + ui.esc(row.name) + '</span><div class="cell-muted" style="font-size:11px">' + ui.esc(row.remote) + '</div>';
						} },
						{ label: 'Branch', render: function (row) {
							return '<span class="cell-mono" style="white-space:nowrap">' + ui.esc(row.branch) + '</span> <span class="cell-muted" style="white-space:nowrap">of ' + row.branches + '</span>';
						} },
						{ label: 'Local copy', render: function (row) { return ui.badge(row.state, row.tone); } },
						{ label: 'Files', align: 'right', render: function (row) { return '<span class="cell-mono">' + row.files.toLocaleString() + '</span>'; } },
						{ label: 'Pages', align: 'right', render: function (row) { return '<span class="cell-mono">' + row.pages + '</span>'; } },
						{ label: 'Last read', render: function (row) { return '<span class="cell-muted">' + ui.esc(row.read) + '</span>'; } },
						{ label: '', align: 'right', render: function (row) {
							return row.state === 'Cloned'
								? ui.button('Open', { small: true, kind: 'ghost', open: 'docs/repository' })
								: ui.button('Clone', { small: true, action: 'clone-repository' });
						} }
					],
					rows: data.repositories
				}) +
				'</div>' +
				'<div class="mt-24">' +
				ui.callout('A repository is cloned into the working area (<code>~/Temco</code>) with full history, so a draft can be about a commit. Nothing is ever pushed back.') +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['docs/repository'] = {
		title: 'Repository',
		render: function () {
			var repo = data.repositories[0];
			var reads = data.reads.filter(function (read) { return read.repo === repo.name; });

			var body =
				ui.pageHead({
					eyebrow: 'Documentation · Repositories',
					title: repo.name,
					icon: 'repo',
					desc: repo.remote + ' · on branch ' + repo.branch + ' of ' + repo.branches,
					actions:
						ui.button('Read Source', { kind: 'primary', icon: 'refresh', action: 'read-source' }) +
						ui.button('Open Working Copy', { icon: 'folder', action: 'open-folder' })
				}) +
				ui.tiles([
					{ value: repo.files.toLocaleString(), label: 'Files' },
					{ value: String(repo.pages), label: 'Pages found' },
					{ value: repo.size, label: 'Local copy' },
					{ value: String(reads.length), label: 'Reads recorded' }
				]) +
				'<div class="mt-24 split">' +
				'<div class="stack">' +
				ui.card({
					title: 'Branches',
					desc: 'The local copy has every branch; a read uses one of them.',
					body: ui.list([
						{ icon: 'branch', title: 'main', sub: '<span class="cell-muted">default · read 1 hour ago</span>', meta: ui.badge('Checked out', 'accent') },
						{ icon: 'branch', title: 't3000', sub: '<span class="cell-muted">read 3 days ago</span>', meta: ui.button('Read', { small: true, kind: 'ghost', action: 'read-source' }) },
						{ icon: 'branch', title: 'release/13.0', sub: '<span class="cell-muted">never read</span>', meta: ui.button('Read', { small: true, kind: 'ghost', action: 'read-source' }) },
						{ icon: 'branch', title: 'feature/web-ui', sub: '<span class="cell-muted">never read</span>', meta: ui.button('Read', { small: true, kind: 'ghost', action: 'read-source' }) }
					])
				}) +
				ui.card({
					title: 'Recent Reads',
					desc: 'What each read found, keyed by the commit it read.',
					flush: true,
					body: ui.table({
						compact: true,
						columns: [
							{ label: 'Commit', render: function (row) { return '<span class="cell-mono">' + ui.esc(row.commit) + '</span>'; } },
							{ label: 'Branch', render: function (row) { return '<span class="cell-muted">' + ui.esc(row.branch) + '</span>'; } },
							{ label: 'Pages', align: 'right', render: function (row) { return '<span class="cell-mono">' + row.pages + '</span>'; } },
							{ label: 'Change', render: function (row) {
								return '<span class="cell-mono cell-muted">+' + row.added + ' ~' + row.changed + ' −' + row.removed + '</span>';
							} },
							{ label: 'When', render: function (row) { return '<span class="cell-muted">' + ui.esc(row.when) + '</span>'; } }
						],
						rows: reads
					})
				}) +
				'</div>' +
				'<div class="stack">' +
				ui.card({
					title: 'Repository',
					body:
						'<dl class="kv">' +
						'<dt>Remote</dt><dd class="cell-mono">' + ui.esc(repo.remote) + '</dd>' +
						'<dt>Working copy</dt><dd class="cell-mono">~/Temco/' + ui.esc(repo.name) + '</dd>' +
						'<dt>Owner</dt><dd>' + ui.esc(repo.owner) + '</dd>' +
						'<dt>Last read</dt><dd>' + ui.esc(repo.read) + '</dd>' +
						'</dl>'
				}) +
				ui.card({
					title: 'Documentation Scripts',
					desc: 'The repository’s own vocabulary. The platform calls these and nothing else.',
					body: ui.list([
						{ icon: 'code', title: 'docs:registry', sub: '<span class="cell-muted">writes docs/help/registry.json</span>' },
						{ icon: 'code', title: 'docs:build', sub: '<span class="cell-muted">builds the site into .temco/build</span>' },
						{ icon: 'code', title: 'docs:check', sub: '<span class="cell-muted">structural checks, no writes</span>' }
					])
				}) +
				'</div>' +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['docs/sources'] = {
		title: 'Sources',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Sources',
					icon: 'repo',
					desc: 'Everything a project reads: repositories, documents, folders and connected libraries. Reading a source is what puts pages in the knowledge base.',
					actions:
						ui.button('Add Source', { kind: 'primary', icon: 'plus', action: 'add-source' }) +
						ui.button('Read All', { icon: 'refresh', action: 'read-all' })
				}) +
				'<div class="toolbar">' +
				'<input class="input" type="search" placeholder="Filter sources" aria-label="Filter sources">' +
				'<div class="segmented" role="group" aria-label="Source kind">' +
				'<button type="button" aria-pressed="true">All</button>' +
				'<button type="button" aria-pressed="false">Repositories</button>' +
				'<button type="button" aria-pressed="false">Documents</button>' +
				'<button type="button" aria-pressed="false">Folders</button>' +
				'</div>' +
				'<span class="toolbar__spacer"></span>' +
				'<span class="cell-muted" style="font-size:12px">38 sources · 1 changed since the last read</span>' +
				'</div>' +
				ui.table({
					columns: [
						{ label: 'Source', render: function (row) { return '<span class="cell-strong">' + ui.esc(row.name) + '</span>'; } },
						{ label: 'Kind', render: function (row) { return '<span class="tag">' + ui.esc(row.kind) + '</span>'; } },
						{ label: 'Detail', render: function (row) { return '<span class="cell-muted cell-mono">' + ui.esc(row.detail) + '</span>'; } },
						{ label: 'State', render: function (row) { return ui.badge(row.state, row.tone); } },
						{ label: 'Pages Found', align: 'right', render: function (row) { return '<span class="cell-mono">' + ui.esc(row.found) + '</span>'; } },
						{ label: 'Last Read', render: function (row) { return '<span class="cell-muted">' + ui.esc(row.when) + '</span>'; } },
						{
							label: '', align: 'right', render: function (row) {
								return row.state === 'Not read' || row.state === 'Changed'
									? ui.button('Read', { small: true, kind: 'primary', action: 'read-source' })
									: ui.button('Open', { small: true, kind: 'ghost', action: 'open-source' });
							}
						}
					],
					rows: data.sources
				}) +
				'<div class="mt-24">' +
				ui.callout('Reading a source never edits it. The pages it finds are recorded in the platform database; the source stays the only copy of its own content.') +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['docs/knowledge'] = {
		title: 'Knowledge',
		render: function () {
			var areaRows = data.knowledge;

			var body =
				ui.pageHead({
					eyebrow: 'T3000 Documentation · 13.0',
					title: 'Knowledge',
					icon: 'book',
					desc: '1,254 pages in 8 areas. The tree on the left is the registry; the counts say how much of each area a person has actually read.',
					actions:
						ui.button('New Page', { icon: 'plus', action: 'new-page' }) +
						ui.button('Generate from Sources', { icon: 'sparkle', prompt: 'Find knowledge gaps in the API Reference area' })
				}) +
				'<div class="split">' +
				'<div class="stack">' +
				ui.card({
					title: 'Areas',
					flush: true,
					body:
						'<div class="list">' +
						areaRows.map(function (area, index) {
							var pct = Math.round((area.reviewed / area.pages) * 100);
							return (
								'<div class="list__item">' +
								'<span class="cell-muted">' + ui.icon(index === 3 ? 'chevron-down' : 'chevron-right') + '</span>' +
								'<div class="list__main">' +
								'<div class="list__title">' + ui.esc(area.area) + '</div>' +
								'<div style="margin-top:6px;max-width:280px">' + ui.bar(pct) + '</div>' +
								'</div>' +
								'<div class="list__meta">' +
								'<span>' + area.pages + ' pages</span>' +
								(area.stale ? ui.badge(area.stale + ' stale', 'warn') : ui.badge('Current', 'ok')) +
								'</div>' +
								'</div>'
							);
						}).join('') +
						'</div>'
				}) +
				ui.card({
					title: 'Pages in API Reference',
					desc: 'Order matters: the number on the left is the page order in the area, not a file line.',
					body: ui.table({
						compact: true,
						columns: [
							{ label: 'Order', align: 'right', render: function (row) { return '<span class="cell-mono">' + row.order + '</span>'; } },
							{ label: 'Page', render: function (row) { return '<span class="cell-strong">' + ui.esc(row.page) + '</span>'; } },
							{ label: 'State', render: function (row) { return ui.badge(row.state, row.tone); } },
							{ label: 'Owner', render: function (row) { return '<span class="cell-muted">' + ui.esc(row.owner) + '</span>'; } },
							{ label: 'Changed', render: function (row) { return '<span class="cell-muted">' + ui.esc(row.changed) + '</span>'; } }
						],
						rows: [
							{ order: 18, page: 'Points and Properties', state: 'Reviewed', tone: 'ok', owner: 'Mei', changed: '2 weeks ago' },
							{ order: 19, page: 'Reading a Point', state: 'Reviewed', tone: 'ok', owner: 'Mei', changed: '2 weeks ago' },
							{ order: 20, page: 'Data Points API', state: 'Conflict', tone: 'err', owner: 'Derek', changed: '3 hours ago' },
							{ order: 20, page: 'Data Points API (duplicate)', state: 'Duplicate', tone: 'err', owner: '—', changed: '14 months ago' },
							{ order: 21, page: 'Writing a Point', state: 'Stale', tone: 'warn', owner: 'Derek', changed: '9 months ago' },
							{ order: 22, page: 'Point Types', state: 'Draft', tone: 'info', owner: 'Ana', changed: 'yesterday' }
						]
					})
				}) +
				'</div>' +
				'<div class="stack">' +
				ui.card({
					title: 'Gaps',
					icon: 'alert',
					desc: 'Topics the sources mention that no page covers.',
					body: ui.list([
						{ title: 'Point scaling (14 mentions)', meta: ui.badge('Open', 'warn') },
						{ title: 'Retry and back-off rules (9)', meta: ui.badge('Open', 'warn') },
						{ title: 'Alarm priority mapping (6)', meta: ui.badge('Open', 'warn') }
					]),
					foot: ui.button('Draft All', { small: true, kind: 'primary', icon: 'sparkle', prompt: 'Draft pages for the knowledge gaps' })
				}) +
				ui.card({
					title: 'Checks',
					body:
						'<div class="list">' +
						'<div class="list__item"><div class="list__main"><div class="list__title">Duplicate order</div><div class="list__sub">order 20 in api-reference</div></div><div class="list__meta">' + ui.badge('2', 'err') + '</div></div>' +
						'<div class="list__item"><div class="list__main"><div class="list__title">Broken links</div><div class="list__sub">targets that do not exist</div></div><div class="list__meta">' + ui.badge('12', 'warn') + '</div></div>' +
						'<div class="list__item"><div class="list__main"><div class="list__title">Unowned pages</div><div class="list__sub">no owner in the registry</div></div><div class="list__meta">' + ui.badge('4', 'warn') + '</div></div>' +
						'<div class="list__item"><div class="list__main"><div class="list__title">Never reviewed</div><div class="list__sub">readable, but nobody has read it</div></div><div class="list__meta">' + ui.badge('341', 'neutral') + '</div></div>' +
						'</div>',
					foot: '<span>Problems panel holds the same findings</span>'
				}) +
				'</div>' +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['docs/review'] = {
		title: 'Review Center',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Review Center',
					icon: 'check',
					desc: 'Drafts, edits and AI suggestions in one queue. Accepting a change is a diff; rejecting it is undo — nothing is written until you say so.',
					actions:
						ui.button('Filters', { icon: 'filter', action: 'filters' })
				}) +
				ui.hero({
					tone: 'warn',
					eyebrow: 'Release 13.0',
					title: '2 errors keep 13.0 from publishing',
					desc: 'Duplicate page order in <b>Data Points API</b>, and <b>Modbus Register Map</b> links to a page that no longer exists. Everything else — the site, the PDF and the search index — is built.',
					actions:
						ui.button('Open the first error', { kind: 'primary', icon: 'alert', action: 'open-page' }) +
						ui.button('Review next draft', { icon: 'check', action: 'review-next' })
				}) +
				'<div class="mt-24">' +
				ui.tiles([
					{ value: '17', label: 'Waiting' },
					{ value: '6', label: 'AI drafts' },
					{ value: '3', label: 'Outdated pages' },
					{ value: '2', label: 'Broken links' },
					{ value: '14 months', label: 'Oldest unreviewed' }
				]) +
				'</div>' +
				'<div class="mt-24 split">' +
				'<div class="stack">' +
				ui.table({
					columns: [
						{ label: 'Page', render: function (row) { return '<span class="cell-strong">' + ui.esc(row.page) + '</span><div class="cell-muted" style="font-size:11px">' + ui.esc(row.area) + '</div>'; } },
						{ label: 'Kind', render: function (row) { return ui.badge(row.kind, row.tone); } },
						{ label: 'By', render: function (row) { return '<span class="cell-muted">' + ui.esc(row.author) + '</span>'; } },
						{ label: 'Lines', render: function (row) { return '<span class="cell-mono">' + ui.esc(row.changes) + '</span>'; } },
						{ label: 'Reviewer', render: function (row) { return '<span class="cell-muted">' + ui.esc(row.reviewer) + '</span>'; } },
						{ label: 'Age', render: function (row) { return '<span class="cell-muted">' + ui.esc(row.age) + '</span>'; } },
						{ label: '', align: 'right', render: function () { return ui.button('Review', { small: true, action: 'open-diff' }); } }
					],
					rows: data.reviews
				}) +
				ui.card({
					title: 'Selected Diff · Data Points API',
					actions: ui.badge('AI draft', 'info') + ui.badge('+42 −8', 'neutral'),
					body:
						'<div class="diff">' +
						'<div class="diff__line diff__line--hunk"><span class="diff__sign"></span>@@ -18,6 +18,9 @@</div>' +
						'<div class="diff__line diff__line--del"><span class="diff__sign">−</span>Points are stored as 32-bit floats.</div>' +
						'<div class="diff__line diff__line--add"><span class="diff__sign">+</span>Points are stored as 32-bit floats, except <b>AI</b> and <b>AO</b></div>' +
						'<div class="diff__line diff__line--add"><span class="diff__sign">+</span>values on controllers with firmware 2.14 and later, which use a</div>' +
						'<div class="diff__line diff__line--add"><span class="diff__sign">+</span>scaled integer with the factor from <code>point.scale</code>.</div>' +
						'<div class="diff__line"><span class="diff__sign"></span> </div>' +
						'<div class="diff__line"><span class="diff__sign"></span>Ranges are inclusive:</div>' +
						'</div>',
					foot:
						ui.button('Accept', { small: true, kind: 'primary', icon: 'check', action: 'accept-change' }) +
						ui.button('Reject', { small: true, icon: 'close', action: 'reject-change' }) +
						'<span>written on accept · undoable after</span>'
				}) +
				'</div>' +
				'<div class="stack">' +
				ui.card({
					title: 'AI Suggestions',
					icon: 'sparkle',
					desc: 'The model read the page, its area and the source it came from. Each suggestion cites what it used.',
					body: ui.list([
						{ title: 'Point scaling changed in 2.14', sub: '<span class="cell-muted">api-reference › data-points</span>', meta: ui.badge('Draft', 'info') },
						{ title: 'Firmware screenshot is 5 versions old', sub: '<span class="cell-muted">hardware › t3-8r</span>', meta: ui.badge('Draft', 'info') },
						{ title: 'Trend retention table is incomplete', sub: '<span class="cell-muted">trends › retention</span>', meta: ui.badge('Draft', 'info') }
					]),
					foot: ui.button('Review All', { small: true, action: 'review-all' })
				}) +
				ui.card({
					title: 'Checks Before Publish',
					body:
						'<div class="progress-list">' +
						'<div><div class="progress-list__label"><b>Structure</b><span>10 of 12</span></div>' + ui.bar(83, 'warn') + '</div>' +
						'<div><div class="progress-list__label"><b>Links</b><span>1,254 of 1,266</span></div>' + ui.bar(99, 'ok') + '</div>' +
						'<div><div class="progress-list__label"><b>Ownership</b><span>1,250 of 1,254</span></div>' + ui.bar(99, 'ok') + '</div>' +
						'<div><div class="progress-list__label"><b>Help ids</b><span>1,198 of 1,254</span></div>' + ui.bar(95, undefined) + '</div>' +
						'</div>',
					foot: '<span>2 errors must be fixed before 13.0 can publish</span>'
				}) +
				'</div>' +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['docs/builds'] = {
		title: 'Build Center',
		render: function () {
			var body =
				ui.pageHead({
					eyebrow: 'T3000 Documentation · 13.0',
					title: 'Build Center',
					icon: 'play',
					desc: 'One build produces every artifact of a release. Each target can be run alone; a publish needs all of them.',
					actions:
						ui.button('Build All', { kind: 'primary', icon: 'play', action: 'build-all' })
				}) +
				ui.hero({
					eyebrow: 'Build 13.0.482',
					title: 'Offline help is still compiling — 612 of 1,254 topics',
					desc: 'The website, the PDF and the search index are done. A publish waits for every target, so the release holds here.',
					actions:
						ui.button('Open the log', { kind: 'primary', icon: 'output', action: 'panel-output' }) +
						ui.button('Cancel the build', { icon: 'close', action: 'build-cancel' })
				}) +
				'<div class="mt-24">' +
				ui.table({
					columns: [
						{ label: 'Target', render: function (row) { return '<span class="cell-strong">' + ui.esc(row.target) + '</span><div class="cell-muted" style="font-size:11px">' + ui.esc(row.detail) + '</div>'; } },
						{ label: 'State', render: function (row) { return ui.badge(row.state, row.tone); } },
						{ label: 'Progress', render: function (row) { return '<div style="min-width:160px">' + ui.bar(row.pct, row.tone === 'ok' ? 'ok' : row.tone === 'info' ? undefined : 'warn') + '</div>'; } },
						{ label: 'Time', align: 'right', render: function (row) { return '<span class="cell-mono">' + ui.esc(row.time) + '</span>'; } },
						{
							label: '', align: 'right', render: function (row) {
								return row.state === 'Succeeded'
									? ui.button('Open', { small: true, kind: 'ghost', action: 'open-artifact' })
									: ui.button('Build', { small: true, action: 'build-target' });
							}
						}
					],
					rows: data.builds
				}) +
				'</div>' +
				'<div class="mt-24 split">' +
				ui.card({
					title: 'Build Log',
					actions: ui.button('Copy', { small: true, kind: 'ghost', action: 'copy-log' }),
					flush: true,
					body: '<pre class="code" style="border:0;border-radius:0;max-height:280px">' + ui.esc(data.buildLog.join('\n')) + '</pre>'
				}) +
				ui.card({
					title: 'Artifacts',
					body: ui.list([
						{ icon: 'globe', title: 't3000-13.0-site.zip', sub: '<span class="cell-muted">1,254 pages · 18.2 MB</span>', meta: ui.badge('Ready', 'ok') },
						{ icon: 'document', title: 't3000-13.0.pdf', sub: '<span class="cell-muted">894 pages · 6.2 MB</span>', meta: ui.badge('Ready', 'ok') },
						{ icon: 'package', title: 't3000-13.0.chm', sub: '<span class="cell-muted">612 of 1,254 topics</span>', meta: ui.badge('Running', 'info') },
						{ icon: 'search', title: 'search-index.json', sub: '<span class="cell-muted">12,884 terms</span>', meta: ui.badge('Queued', 'neutral') }
					]),
					foot: '<span>Written to .temco/build · never committed</span>'
				}) +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['docs/releases'] = {
		title: 'Releases',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Releases',
					icon: 'upload',
					desc: 'A release pins a version of the documentation to a version of the product. Published versions stay reachable forever.',
					actions:
						ui.button('Publish 13.0', { kind: 'primary', icon: 'upload', action: 'publish-release' }) +
						ui.button('Changelog', { icon: 'list', action: 'open-changelog' })
				}) +
				ui.table({
					columns: [
						{ label: 'Version', render: function (row) { return '<span class="cell-strong cell-mono">' + ui.esc(row.version) + '</span>'; } },
						{ label: 'Released', render: function (row) { return '<span class="cell-muted">' + ui.esc(row.date) + '</span>'; } },
						{ label: 'Pages', align: 'right', render: function (row) { return '<span class="cell-mono">' + row.pages.toLocaleString() + '</span>'; } },
						{ label: 'Artifacts', render: function (row) { return '<span class="cell-muted">' + ui.esc(row.artifacts) + '</span>'; } },
						{ label: 'State', render: function (row) { return ui.badge(row.state, row.tone); } },
						{
							label: '', align: 'right', render: function (row) {
								return ui.button('View', { small: true, kind: 'ghost', open: 'learn/home' }) +
									(row.state === 'Published' ? ui.button('Pin', { small: true, kind: 'ghost', action: 'pin-release' }) : '');
							}
						}
					],
					rows: data.releases
				}) +
				'<div class="mt-24 split">' +
				ui.card({
					title: 'Publish 13.0',
					desc: 'Publishing copies the built artifacts to Temco Learn and freezes this version of the pages.',
					body:
						'<div class="progress-list">' +
						'<div><div class="progress-list__label"><b>Website</b><span>ready</span></div>' + ui.bar(100, 'ok') + '</div>' +
						'<div><div class="progress-list__label"><b>PDF</b><span>ready</span></div>' + ui.bar(100, 'ok') + '</div>' +
						'<div><div class="progress-list__label"><b>Offline help</b><span>612 of 1,254</span></div>' + ui.bar(62, 'warn') + '</div>' +
						'<div><div class="progress-list__label"><b>Checks</b><span>2 errors</span></div>' + ui.bar(83, 'err') + '</div>' +
						'</div>',
					foot: ui.button('Open Review Center', { small: true, kind: 'primary', open: 'docs/review' }) + '<span>fixes the two errors blocking the publish</span>'
				}) +
				ui.card({
					title: '13.0 Changelog',
					body: ui.list([
						{ title: '48 new pages', sub: '<span class="cell-muted">API Reference · Protocol</span>' },
						{ title: '112 pages updated', sub: '<span class="cell-muted">firmware 2.14 changes</span>' },
						{ title: '6 pages removed', sub: '<span class="cell-muted">superseded by the new object model</span>' },
						{ title: '12 broken links fixed', sub: '<span class="cell-muted">3 still open</span>', meta: ui.badge('3 open', 'warn') }
					])
				}) +
				'</div>';
			return ui.view(body);
		}
	};
})(window.TemcoMock = window.TemcoMock || { views: {} });
