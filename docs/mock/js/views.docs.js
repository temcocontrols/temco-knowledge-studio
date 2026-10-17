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
			var projects = data.docsProjects;
			var current = projects[0];

			/* A project is one row, and its name never shares a line with its numbers — that is what
			   lets the row survive a narrow editor, which a seven-column table of the same facts did
			   not: the name column collapsed to 108 px and the timestamp wrapped onto three lines. */
			var projectRow = function (project, isCurrent) {
				var facts = [
					'v' + project.version,
					project.audience,
					project.owner,
					project.pages + ' pages',
					project.sources + ' sources',
					'updated ' + project.updated
				];
				return (
					'<div class="record-row' + (isCurrent ? ' record-row--current' : '') + '" data-open="docs/knowledge">' +
					(isCurrent ? ui.toneMark('layers', 'accent') : ui.toneMark('folder')) +
					'<div class="record-row__main">' +
					'<div class="record-row__title">' +
					'<span class="record-row__name">' + ui.esc(project.name) + '</span>' +
					(isCurrent ? ui.badge('Current', 'accent') : '') +
					'</div>' +
					/* Each fact keeps its trailing dot, so a line never breaks in the middle of a count. */
					'<div class="record-row__meta">' +
					facts.map(function (fact, index) {
						return '<span>' + ui.esc(fact) + (index < facts.length - 1 ? ' ·' : '') + '</span>';
					}).join(' ') +
					'</div>' +
					'</div>' +
					'<div class="record-row__state">' + ui.badge(project.state, project.tone) + '</div>' +
					'<span class="record-row__go">' + ui.icon('chevron-right', 'icon--sm') + '</span>' +
					'</div>'
				);
			};

			var body =
				ui.pageHead({
					title: 'Projects',
					icon: 'folder',
					desc: 'A project is a version of a product\'s documentation: its sources, its pages and the artifacts it builds.',
					actions:
						ui.button('New Project', { kind: 'primary', icon: 'plus', action: 'new-project' }) +
						ui.button('Import', { icon: 'download', action: 'import-project' })
				}) +
				'<div class="record-list">' +
				projects.map(function (project, index) {
					return projectRow(project, index === 0);
				}).join('') +
				'</div>' +
				'<div class="mt-24">' +
				ui.card({
					title: 'Sources of This Project',
					icon: 'repo',
					cls: 'card--plain',
					actions: ui.button('All Sources', { small: true, kind: 'ghost', open: 'docs/sources' }),
					desc: 'What ' + ui.esc(current.name) + ' reads. Reading a source is what puts pages in the knowledge base; it never writes to the source.',
					body: ui.list(data.sources.slice(0, 4).map(function (source) {
						return { icon: source.kind === 'Repository' ? 'repo' : 'document', title: source.name, sub: '<span class="cell-muted">' + (source.pages ? source.pages + ' pages' : 'not read') + '</span>', meta: ui.badge(source.state, source.tone) };
					}))
				}) +
				'</div>' +
				/* How the project is set up is not activity — it is the last thing on the page. */
				'<div class="mt-24">' +
				ui.card({
					title: 'Project Settings',
					icon: 'gear',
					cls: 'card--plain',
					actions: ui.button('Edit Settings', { small: true, action: 'project-settings' }),
					desc: 'Stored in the platform database, not in the repository.',
					body:
						'<div class="settings-strip">' +
						'<div><div class="settings-strip__label">Version</div><div class="settings-strip__value cell-mono">13.0</div></div>' +
						'<div><div class="settings-strip__label">Areas</div><div class="settings-strip__value">8</div></div>' +
						'<div><div class="settings-strip__label">Build Targets</div><div class="settings-strip__value">Website · PDF · CHM · Search · AI index</div></div>' +
						'<div><div class="settings-strip__label">Publishes To</div><div class="settings-strip__value">Temco Learn · /t3000/13.0/</div></div>' +
						'</div>'
				}) +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['docs/repositories'] = {
		title: 'Repositories',
		render: function () {
			var repos = data.repositories;
			var cloned = repos.filter(function (repo) { return repo.state === 'Cloned'; });
			var files = repos.reduce(function (total, repo) { return total + repo.files; }, 0);
			var pages = repos.reduce(function (total, repo) { return total + repo.pages; }, 0);

			var repoRow = function (repo) {
				var facts = [repo.remote, repo.branch + ' of ' + repo.branches + ' branches'];
				if (repo.state === 'Cloned') {
					facts.push(repo.files.toLocaleString('en-US') + ' files');
					facts.push(repo.pages + ' pages');
					facts.push('read ' + repo.read);
					if (repo.owner !== '—') {
						facts.push(repo.owner);
					}
				} else {
					facts.push('no local copy');
				}
				var isOpen = repo.state === 'Cloned';
				return (
					'<div class="record-row' + (isOpen ? '' : ' record-row--static') + '"' + (isOpen ? ' data-open="docs/repository"' : '') + '>' +
					(repo.temco ? ui.toneMark('repo', 'accent') : ui.toneMark('repo')) +
					'<div class="record-row__main">' +
					'<div class="record-row__title">' +
					'<span class="record-row__name">' + ui.esc(repo.name) + '</span>' +
					'</div>' +
					'<div class="record-row__meta">' +
					facts.map(function (fact, index) {
						return '<span>' + ui.esc(fact) + (index < facts.length - 1 ? ' ·' : '') + '</span>';
					}).join(' ') +
					'</div>' +
					'</div>' +
					'<div class="record-row__state">' + ui.badge(repo.state, repo.tone) + '</div>' +
					(isOpen
						? '<span class="record-row__go">' + ui.icon('chevron-right', 'icon--sm') + '</span>'
						: ui.button('Clone', { small: true, action: 'clone-repository' })) +
					'</div>'
				);
			};

			var group = function (title, note, items, actions) {
				if (!items.length) {
					return '';
				}
				return ui.group({
					label: title,
					count: items.length + (items.length === 1 ? ' repository' : ' repositories'),
					note: note,
					actions: actions,
					body: items.map(repoRow).join('')
				});
			};

			var temcoRepos = repos.filter(function (repo) { return repo.temco; });
			var thirdPartyRepos = repos.filter(function (repo) { return !repo.temco; });
			var missing = temcoRepos.filter(function (repo) { return repo.state !== 'Cloned'; }).length;

			var body =
				ui.pageHead({
					title: 'Repositories',
					icon: 'repo',
					desc: 'The repositories this workspace reads, and whether their local copy is here. Reading a repository records the pages it declares; it never writes to it.',
					actions:
						ui.button('Add Repository', { kind: 'primary', icon: 'plus', action: 'add-source' })
				}) +
				ui.tiles([
					{ value: String(repos.length), label: 'Repositories' },
					{ value: String(cloned.length), label: 'Cloned locally' },
					{ value: files.toLocaleString('en-US'), label: 'Files' },
					{ value: String(pages), label: 'Pages found' }
				]) +
				group(
					'From Temco',
					'Temco publishes these under <b class="cell-mono">github.com/temcocontrols</b>. They are the sources the platform ships documentation for, so their pages carry product names, register maps and firmware behaviour that Temco stands behind.',
					temcoRepos,
					(missing
						? ui.button('Clone ' + missing + ' Missing', { small: true, kind: 'primary', icon: 'download', action: 'clone-repository' })
						: '') +
					ui.button('Read All', { small: true, kind: 'ghost', icon: 'refresh', action: 'read-all' })
				) +
				group(
					'Third-party',
					'Read exactly like a Temco repository — same clone, same read, same pages — but nothing in one is Temco\'s word. Useful for protocol references; never for product behaviour.',
					thirdPartyRepos,
					ui.button('Read All', { small: true, kind: 'ghost', icon: 'refresh', action: 'read-all' })
				) +
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
			var sources = data.sources;
			var read = sources.filter(function (source) { return source.state === 'Read' || source.state === 'Partial'; });
			var pending = sources.filter(function (source) { return source.state !== 'Read' && source.state !== 'Partial'; });
			var pages = sources.reduce(function (total, source) { return total + source.pages; }, 0);

			var iconFor = function (source) {
				if (source.kind === 'Repository') {
					return 'repo';
				}
				if (source.kind === 'Folder') {
					return 'folder';
				}
				if (source.kind === 'SharePoint') {
					return 'globe';
				}
				return 'document';
			};

			/* A source that needs reading wears the warning, because that is the only thing to do here. */
			var toneFor = function (source) {
				return source.state === 'Read' ? '' : source.state === 'Not read' ? 'info' : 'warn';
			};

			var sourceRow = function (source) {
				var facts = [source.detail];
				if (source.state === 'Not read') {
					facts.push('not read yet');
				} else if (source.state === 'Changed') {
					facts.push('changed since the last read');
					facts.push('last read ' + source.when);
				} else {
					facts.push(source.pages ? source.pages + ' pages found' : 'nothing found');
					facts.push('read ' + source.when);
				}
				var needsRead = source.state === 'Changed' || source.state === 'Not read';
				return (
					'<div class="record-row' + (needsRead ? ' record-row--static' : '') + '"' + (needsRead ? '' : ' data-action="open-source"') + '>' +
					ui.toneMark(iconFor(source), toneFor(source)) +
					'<div class="record-row__main">' +
					'<div class="record-row__title">' +
					'<span class="record-row__name">' + ui.esc(source.name) + '</span>' +
					(source.kind === 'Repository' ? '' : '<span class="tag">' + ui.esc(source.kind) + '</span>') +
					'</div>' +
					'<div class="record-row__meta">' +
					facts.map(function (fact, index) {
						return '<span>' + ui.esc(fact) + (index < facts.length - 1 ? ' ·' : '') + '</span>';
					}).join(' ') +
					'</div>' +
					'</div>' +
					'<div class="record-row__state">' + ui.badge(source.state, source.tone) + '</div>' +
					(needsRead
						? ui.button('Read', { small: true, kind: 'primary', action: 'read-source' })
						: '<span class="record-row__go">' + ui.icon('chevron-right', 'icon--sm') + '</span>') +
					'</div>'
				);
			};

			var group = function (title, note, kinds) {
				var items = sources.filter(function (source) { return kinds.indexOf(source.kind) !== -1; });
				if (!items.length) {
					return '';
				}
				return ui.group({
					label: title,
					count: items.length + (items.length === 1 ? ' source' : ' sources'),
					note: note,
					actions: items.length > 1
						? ui.button('Read All', { small: true, kind: 'ghost', icon: 'refresh', action: 'read-all' })
						: '',
					body: items.map(sourceRow).join('')
				});
			};

			var body =
				ui.pageHead({
					title: 'Sources',
					icon: 'repo',
					desc: 'Everything a project reads: repositories, documents, folders and connected libraries. Reading a source is what puts pages in the knowledge base.',
					actions: ui.button('Add Source', { kind: 'primary', icon: 'plus', action: 'add-source' })
				}) +
				ui.tiles([
					{ value: String(sources.length), label: 'Sources' },
					{ value: String(read.length), label: 'Read' },
					{ value: String(pages), label: 'Pages found' },
					{ value: String(pending.length), label: 'Need a read' }
				]) +
				group(
					'Repositories',
					'Cloned with full history and read by commit, so a draft can point at the commit it came from.',
					['Repository']
				) +
				group(
					'Documents',
					'Read in place from disk — one read per file, no clone and no history. A document that changed keeps its old pages until it is read again.',
					['PDF', 'DOCX']
				) +
				group(
					'Folders and connections',
					'A folder reads like a repository but has no history; a connection is read over the network and can expire.',
					['Folder', 'SharePoint']
				) +
				'<div class="mt-24">' +
				ui.callout('Reading a source never edits it. The pages it finds are recorded in the platform database; the source stays the only copy of its own content.') +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['docs/knowledge'] = {
		title: 'Knowledge',
		render: function () {
			var areas = data.knowledge;
			/* The area whose pages are shown. Picking another one re-renders the page (open-area in
			   the shell); the first one shown is the weak area, not the first alphabetically. */
			var openAreaName = (M.state && M.state.area) || 'API Reference';
			var openArea = areas.filter(function (area) { return area.area === openAreaName; })[0] || areas[3];
			var totalPages = areas.reduce(function (total, area) { return total + area.pages; }, 0);
			var totalReviewed = areas.reduce(function (total, area) { return total + area.reviewed; }, 0);

			/* One line per area, with the reviewed share painted behind it. The bar and the number
			   say the same thing, so they are the same thing; only a stale area gets a badge. */
			var areaRow = function (area) {
				var pct = Math.round((area.reviewed / area.pages) * 100);
				var isOpen = area === openArea;
				return (
					'<div class="area-row' + (isOpen ? ' area-row--open' : '') + '"' +
					' data-action="open-area" data-area="' + ui.esc(area.area) + '"' +
					' style="--coverage: ' + pct + '%"' +
					' title="' + ui.esc(area.reviewed + ' of ' + area.pages + ' pages read') + '">' +
					ui.icon(isOpen ? 'chevron-down' : 'chevron-right', 'icon--sm') +
					'<span class="area-row__name">' + ui.esc(area.area) + '</span>' +
					'<span class="area-row__pct">' + pct + '%</span>' +
					'<span class="area-row__stale">' + (area.stale ? ui.badge(area.stale + ' stale', 'warn') : '') + '</span>' +
					'</div>'
				);
			};

			var pages = data.areaPages[openArea.area] || [];
			var openPct = Math.round((openArea.reviewed / openArea.pages) * 100);

			var body =
				ui.pageHead({
					eyebrow: 'T3000 Documentation · 13.0',
					title: 'Knowledge',
					icon: 'book',
					desc: totalPages.toLocaleString('en-US') + ' pages in ' + areas.length + ' areas, ' + totalReviewed.toLocaleString('en-US') + ' of them read by a person. The registry order is the order the documentation ships in, not the order the files sit on disk.',
					actions:
						ui.button('New Page', { kind: 'primary', icon: 'plus', action: 'new-page' }) +
						ui.button('Generate from Sources', { icon: 'sparkle', prompt: 'Find knowledge gaps in the API Reference area' })
				}) +
				/* Master–detail: the areas on the left, the pages of the one you picked on the right,
				   so a click changes something you can see without scrolling. */
				'<div class="know-wrap mt-24">' +
				'<div class="know-split">' +
				ui.card({
					title: 'Areas',
					icon: 'book',
					cls: 'card--plain',
					actions: ui.button('Coverage & Health', { small: true, kind: 'ghost', open: 'dashboard/health' }),
					desc: 'Read is what a person signed off; stale is what the sources have outrun. Pick an area.',
					body: '<div class="area-list">' + areas.map(areaRow).join('') + '</div>'
				}) +
				ui.card({
					title: 'Pages in ' + openArea.area,
					icon: 'document',
					cls: 'card--plain',
					actions: ui.button('Add Page', { small: true, kind: 'ghost', icon: 'plus', action: 'new-page' }),
					desc: openArea.pages + ' pages · ' + openArea.reviewed + ' read (' + openPct + '%) · ' + (openArea.stale ? openArea.stale + ' stale' : 'nothing stale') + '. Order is the page order inside the area, not a file line.',
					body: ui.table({
						plain: true,
						compact: true,
						columns: [
							{ label: 'Order', render: function (row) { return '<span class="cell-mono">' + row.order + '</span>'; } },
							{
								label: 'Page', render: function (row) {
									return '<span class="cell-strong">' + ui.esc(row.page) + '</span>' +
										'<div class="cell-muted" style="font-size:12px">' + ui.esc(row.owner === '—' ? 'no owner' : row.owner) + ' · changed ' + ui.esc(row.changed) + '</div>';
								}
							},
							{ label: 'State', align: 'right', render: function (row) { return ui.badge(row.state, row.tone); } }
						],
						rows: pages
					})
				}) +
				'</div>' +
				'</div>' +
				'<div class="mt-24 grid grid--2">' +
				ui.card({
					title: 'Gaps',
					icon: 'alert',
					cls: 'card--plain',
					actions: ui.button('Draft All', { small: true, kind: 'primary', icon: 'sparkle', prompt: 'Draft pages for the knowledge gaps' }),
					desc: 'Topics the sources mention that no page covers.',
					body: ui.list([
						{ title: 'Point scaling', sub: '<span class="cell-muted">14 mentions in t3000webview</span>', meta: ui.badge('Open', 'warn') },
						{ title: 'Retry and back-off rules', sub: '<span class="cell-muted">9 mentions in bacnet-stack</span>', meta: ui.badge('Open', 'warn') },
						{ title: 'Alarm priority mapping', sub: '<span class="cell-muted">6 mentions in the BACnet guide</span>', meta: ui.badge('Open', 'warn') }
					])
				}) +
				ui.card({
					title: 'Checks',
					icon: 'check',
					cls: 'card--plain',
					actions: ui.button('Open Problems', { small: true, kind: 'ghost', action: 'panel-problems' }),
					desc: 'What the structural checks found in this project. The Problems panel holds the same findings.',
					body: ui.list([
						{ title: 'Duplicate order', sub: '<span class="cell-muted">order 20 is claimed by two pages</span>', meta: ui.badge('1', 'err') },
						{ title: 'Broken links', sub: '<span class="cell-muted">targets that do not exist</span>', meta: ui.badge('12', 'warn') },
						{ title: 'Unowned pages', sub: '<span class="cell-muted">no owner in the registry</span>', meta: ui.badge('4', 'warn') },
						{ title: 'Never reviewed', sub: '<span class="cell-muted">readable, but nobody has read it</span>', meta: ui.badge('341', 'neutral') }
					])
				}) +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['docs/review'] = {
		title: 'Review Center',
		render: function () {
			var reviews = data.reviews;
			var drafts = reviews.filter(function (review) { return review.kind === 'Draft'; }).length;
			var selected = reviews[0];

			/* The queue is the page, so it takes the width. The row whose diff is open is marked on
			   itself instead of being pulled out into a second column. */
			var reviewRow = function (review) {
				var isDraft = review.kind === 'Draft';
				var isOpen = review === selected;
				var facts = [review.area, 'by ' + review.author, review.changes, 'waiting ' + review.age];
				return (
					'<div class="record-row' + (isOpen ? ' record-row--current' : '') + '">' +
					ui.toneMark(isDraft ? 'sparkle' : review.kind === 'New page' ? 'plus' : 'document', isDraft ? 'accent' : review.kind === 'New page' ? 'ok' : '') +
					'<div class="record-row__main">' +
					'<div class="record-row__title">' +
					'<span class="record-row__name">' + ui.esc(review.page) + '</span>' +
					(isOpen ? '<span class="cell-muted" style="font-size:12px">open below</span>' : '') +
					'</div>' +
					'<div class="record-row__meta">' +
					facts.map(function (fact, index) {
						return '<span>' + ui.esc(fact) + (index < facts.length - 1 ? ' ·' : '') + '</span>';
					}).join(' ') +
					'</div>' +
					'</div>' +
					'<div class="record-row__state">' + ui.badge(review.kind, review.tone) + '</div>' +
					ui.button('Review', { small: true, kind: isOpen ? 'primary' : 'ghost', action: 'open-diff' }) +
					'</div>'
				);
			};

			var body =
				ui.pageHead({
					title: 'Review Center',
					icon: 'check',
					desc: 'Drafts, edits and AI suggestions in one queue. Accepting a change is a diff; rejecting it is undo — nothing is written until you say so.',
					actions: ui.button('Filters', { icon: 'filter', action: 'filters' })
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
				ui.card({
					title: 'Queue',
					icon: 'check',
					cls: 'card--plain',
					desc: reviews.length + ' items waiting, ' + drafts + ' of them AI drafts. Newest first; the one whose diff is open below carries its age on the line.',
					body: '<div class="record-list">' + reviews.map(reviewRow).join('') + '</div>'
				}) +
				'</div>' +
				'<div class="mt-24">' +
				ui.card({
					title: 'Selected diff · Data Points API',
					icon: 'document',
					cls: 'card--plain',
					actions: ui.badge('AI draft', 'info') + ui.badge('+42 −8', 'neutral'),
					desc: 'Accepting writes the page; rejecting leaves it exactly as it was. Either way it is one undo step.',
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
				'<div class="mt-24 grid grid--2">' +
				ui.card({
					title: 'AI Suggestions',
					icon: 'sparkle',
					cls: 'card--plain',
					actions: ui.button('Review All', { small: true, kind: 'ghost', action: 'review-all' }),
					desc: 'The model read the page, its area and the source it came from. Each suggestion cites what it used.',
					body: ui.list([
						{ title: 'Point scaling changed in 2.14', sub: '<span class="cell-muted">api-reference › data-points</span>', meta: ui.badge('Draft', 'info') },
						{ title: 'Firmware screenshot is 5 versions old', sub: '<span class="cell-muted">hardware › t3-8r</span>', meta: ui.badge('Draft', 'info') },
						{ title: 'Trend retention table is incomplete', sub: '<span class="cell-muted">trends › retention</span>', meta: ui.badge('Draft', 'info') }
					])
				}) +
				ui.card({
					title: 'Checks Before Publish',
					icon: 'check',
					cls: 'card--plain',
					actions: ui.button('Open Problems', { small: true, kind: 'ghost', action: 'panel-problems' }),
					desc: 'Two errors must be fixed before 13.0 can publish; the warnings can ship.',
					body:
						'<div class="progress-list">' +
						'<div><div class="progress-list__label"><b>Structure</b><span>10 of 12</span></div>' + ui.bar(83, 'warn') + '</div>' +
						'<div><div class="progress-list__label"><b>Links</b><span>1,254 of 1,266</span></div>' + ui.bar(99, 'ok') + '</div>' +
						'<div><div class="progress-list__label"><b>Ownership</b><span>1,250 of 1,254</span></div>' + ui.bar(99, 'ok') + '</div>' +
						'<div><div class="progress-list__label"><b>Help ids</b><span>1,198 of 1,254</span></div>' + ui.bar(95, undefined) + '</div>' +
						'</div>'
				}) +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['docs/builds'] = {
		title: 'Build Center',
		render: function () {
			var builds = data.builds;
			var done = builds.filter(function (build) { return build.state === 'Succeeded'; }).length;
			var queued = builds.filter(function (build) { return build.state === 'Queued'; }).length;

			var body =
				ui.pageHead({
					eyebrow: 'T3000 Documentation · 13.0',
					title: 'Build Center',
					icon: 'play',
					desc: 'One build produces every artifact of a release. Each target can be run alone; a publish needs all of them.',
					actions: ui.button('Build All', { kind: 'primary', icon: 'play', action: 'build-all' })
				}) +
				ui.hero({
					eyebrow: 'Build 13.0.482',
					title: 'Offline help is still compiling — 612 of 1,254 topics',
					desc: 'The website, the PDF and the search index are done: ' + done + ' of ' + builds.length + ' targets, ' + queued + ' still queued. A publish waits for every target, so the release holds here.',
					actions:
						ui.button('Open the log', { kind: 'primary', icon: 'output', action: 'panel-output' }) +
						ui.button('Cancel the build', { icon: 'close', action: 'build-cancel' })
				}) +
				'<div class="mt-24">' +
				ui.card({
					title: 'Targets',
					icon: 'package',
					cls: 'card--plain',
					desc: 'Everything is written into .temco/build. Running one target does not touch the others.',
					body: ui.table({
						plain: true,
						compact: true,
						columns: [
							{
								label: 'Target', render: function (row) {
									return '<span class="cell-strong">' + ui.esc(row.target) + '</span>' +
										'<div class="cell-muted" style="font-size:12px">' + ui.esc(row.detail) + '</div>';
								}
							},
							{ label: 'State', render: function (row) { return ui.badge(row.state, row.tone); } },
							{ label: 'Progress', render: function (row) { return '<div style="min-width:120px">' + ui.bar(row.pct, row.tone === 'ok' ? 'ok' : row.tone === 'info' ? undefined : 'warn') + '</div>'; } },
							{ label: 'Time', align: 'right', render: function (row) { return '<span class="cell-mono">' + ui.esc(row.time) + '</span>'; } },
							{
								label: '', align: 'right', render: function (row) {
									return row.state === 'Succeeded'
										? ui.button('Open', { small: true, kind: 'ghost', action: 'open-artifact' })
										: ui.button('Build', { small: true, action: 'build-target' });
								}
							}
						],
						rows: builds
					})
				}) +
				'</div>' +
				'<div class="mt-24">' +
				ui.card({
					title: 'Build Log',
					icon: 'output',
					cls: 'card--plain',
					actions: ui.button('Copy', { small: true, kind: 'ghost', action: 'copy-log' }),
					desc: 'Each line is stamped with the time it happened; the help compiler is the last thing in it.',
					body: '<pre class="code" style="border:0;border-radius:0;max-height:300px">' + ui.esc(data.buildLog.join('\n')) + '</pre>'
				}) +
				'</div>' +
				'<div class="mt-24">' +
				ui.card({
					title: 'Artifacts',
					icon: 'download',
					cls: 'card--plain',
					desc: 'What this build has written so far. A target that is still running has a partial file.',
					body: ui.list([
						{ icon: 'globe', title: 't3000-13.0-site.zip', sub: '<span class="cell-muted">1,254 pages · 18.2 MB</span>', meta: ui.badge('Ready', 'ok') },
						{ icon: 'document', title: 't3000-13.0.pdf', sub: '<span class="cell-muted">1,254 pages · 6.2 MB</span>', meta: ui.badge('Ready', 'ok') },
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
			var releases = data.releases;
			var current = releases[0];
			var published = releases.filter(function (release) { return release.state === 'Published'; }).length;

			var releaseRow = function (release) {
				var isCurrent = release === current;
				var facts = [release.date, release.pages.toLocaleString('en-US') + ' pages', release.artifacts];
				return (
					'<div class="record-row' + (isCurrent ? ' record-row--current' : '') + '">' +
					ui.toneMark('upload', isCurrent ? 'accent' : '') +
					'<div class="record-row__main">' +
					'<div class="record-row__title">' +
					'<span class="record-row__name cell-mono">' + ui.esc(release.version) + '</span>' +
					(isCurrent ? '<span class="cell-muted" style="font-size:12px">in flight</span>' : '') +
					'</div>' +
					'<div class="record-row__meta">' +
					facts.map(function (fact, index) {
						return '<span>' + ui.esc(fact) + (index < facts.length - 1 ? ' ·' : '') + '</span>';
					}).join(' ') +
					'</div>' +
					'</div>' +
					'<div class="record-row__state">' + ui.badge(release.state, release.tone) + '</div>' +
					'<span class="row" style="gap:4px">' +
					ui.button('View', { small: true, kind: 'ghost', open: 'learn/home' }) +
					(release.state === 'Published' ? ui.button('Pin', { small: true, kind: 'ghost', action: 'pin-release' }) : '') +
					'</span>' +
					'</div>'
				);
			};

			var body =
				ui.pageHead({
					title: 'Releases',
					icon: 'upload',
					desc: 'A release pins a version of the documentation to a version of the product. Published versions stay reachable forever.',
					actions:
						ui.button('Publish 13.0', { kind: 'primary', icon: 'upload', action: 'publish-release' })
				}) +
				ui.hero({
					tone: 'warn',
					eyebrow: 'Version ' + current.version,
					title: '13.0 is not published yet',
					desc: 'Two pages claim the same order and the offline help is at 612 of 1,254 topics. The site, the PDF and the search index are waiting in the build folder, one action from Temco Learn.',
					actions:
						ui.button('Open Review Center', { kind: 'primary', icon: 'check', open: 'docs/review' }) +
						ui.button('See the Build', { icon: 'play', open: 'docs/builds' })
				}) +
				'<div class="mt-24">' +
				ui.card({
					title: 'Versions',
					icon: 'upload',
					cls: 'card--plain',
					actions: ui.button('Changelog', { small: true, kind: 'ghost', icon: 'list', action: 'open-changelog' }),
					desc: 'Newest first. ' + published + ' published, one in flight; a published version is never rewritten.',
					body: '<div class="record-list">' + releases.map(releaseRow).join('') + '</div>'
				}) +
				'</div>' +
				'<div class="mt-24">' +
				ui.card({
					title: '13.0 Changelog',
					icon: 'list',
					cls: 'card--plain',
					desc: 'What changed between 12.9 and 13.0, counted from the pages themselves.',
					body: ui.list([
						{ title: '48 new pages', sub: '<span class="cell-muted">API Reference · Protocol</span>', meta: ui.badge('New', 'ok') },
						{ title: '112 pages updated', sub: '<span class="cell-muted">firmware 2.14 changes</span>', meta: ui.badge('Edit', 'neutral') },
						{ title: '6 pages removed', sub: '<span class="cell-muted">superseded by the new object model</span>', meta: ui.badge('Removed', 'neutral') },
						{ title: '12 broken links fixed', sub: '<span class="cell-muted">3 still open</span>', meta: ui.badge('3 open', 'warn') }
					])
				}) +
				'</div>';
			return ui.view(body);
		}
	};
})(window.TemcoMock = window.TemcoMock || { views: {} });
