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
			var current = projects.filter(function (project) {
				return project.name === ((M.state && M.state.project) || projects[0].name);
			})[0] || projects[0];

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
					'<div class="record-row' + (isOpen ? '' : ' record-row--static') + '"' + (isOpen ? ' data-action="open-repository" data-repository="' + ui.esc(repo.name) + '"' : '') + '>' +
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
			/* One surface for every repository: the row that was clicked names the one to show. */
			var repos = data.repositories;
			var requested = M.state && M.state.repository;
			var repo = repos.filter(function (candidate) { return candidate.name === requested; })[0] || repos[0];
			var reads = data.reads.filter(function (read) { return read.repo === repo.name; });
			var cloned = repo.state === 'Cloned';
			var branchNames = repo.branchNames || [];
			var scripts = repo.scripts || [];

			var readOfBranch = function (name) {
				var read = reads.filter(function (candidate) { return candidate.branch === name; })[0];
				return read ? 'read ' + read.when : 'never read';
			};

			var commitOfBranch = function (name) {
				var read = reads.filter(function (candidate) { return candidate.branch === name; })[0];
				return read ? read.commit : '—';
			};

			var body =
				ui.pageHead({
					eyebrow: 'Repositories',
					title: repo.name,
					icon: 'repo',
					desc: ui.esc(repo.remote) + ' · ' + (cloned ? ui.esc(repo.branch) + ' at ' + ui.esc(repo.head) : 'no local copy yet') + ' · ' + repo.branches + ' branches · ' + (repo.temco ? 'published by Temco' : 'third party'),
					actions: cloned
						? ui.button('Read Source', { kind: 'primary', icon: 'refresh', action: 'read-source' }) + ui.button('Browse Source', { icon: 'code', action: 'browse-source', attrs: 'data-repository="' + ui.esc(repo.name) + '"' }) + ui.button('Open Working Copy', { icon: 'folder', action: 'open-folder' })
						: ui.button('Clone', { kind: 'primary', icon: 'download', action: 'clone-repository' })
				}) +
				(cloned
					? ui.tiles([
						{ value: repo.files.toLocaleString('en-US'), label: 'Files' },
						{ value: String(repo.pages), label: 'Pages found' },
						{ value: repo.size, label: 'Local copy' },
						{ value: String(reads.length), label: 'Reads recorded' }
					])
					: ui.callout('<b>Nothing is local yet.</b> Cloning copies the repository into <code>~/Temco</code> with its history; until then this page can only describe the remote.', { kind: 'warn' })) +
				(cloned && branchNames.length
					? ui.group({
						label: 'Branches',
						count: branchNames.length === repo.branches ? branchNames.length + ' branches' : branchNames.length + ' of ' + repo.branches + ' branches listed',
						note: 'The copy has every branch; a read uses one of them, and a read is keyed by the commit it read.',
						body: branchNames.map(function (name) {
							var isCheckedOut = name === repo.branch;
							return (
								'<div class="record-row">' +
								ui.toneMark('branch', isCheckedOut ? 'accent' : '') +
								'<div class="record-row__main">' +
								'<div class="record-row__title">' +
								'<span class="record-row__name cell-mono">' + ui.esc(name) + '</span>' +
								(isCheckedOut ? '<span class="cell-muted">the one reads use by default</span>' : '') +
								'</div>' +
								'<div class="record-row__meta">' +
								'<span>' + ui.esc(readOfBranch(name)) + '</span>' +
								'<span class="cell-mono">' + ui.esc(isCheckedOut ? repo.head : commitOfBranch(name)) + '</span>' +
								'</div>' +
								'</div>' +
								'<div class="record-row__state">' + (isCheckedOut ? ui.badge('Checked out', 'accent') : '') + '</div>' +
								ui.button('Read', { small: true, kind: 'ghost', action: 'read-source' }) +
								'</div>'
							);
						}).join('')
					})
					: '') +
				(reads.length
					? ui.group({
						label: 'Reads',
						count: reads.length + (reads.length === 1 ? ' read' : ' reads'),
						note: 'What each read found, keyed by the commit it read, so a change on the wire can be explained later.',
						body: reads.map(function (read) {
							return (
								'<div class="record-row record-row--static">' +
								ui.toneMark('check', 'ok') +
								'<div class="record-row__main">' +
								'<div class="record-row__title">' +
								'<span class="record-row__name cell-mono">' + ui.esc(read.commit) + '</span>' +
								'<span class="tag">' + ui.esc(read.branch) + '</span>' +
								'</div>' +
								'<div class="record-row__meta">' +
								'<span>' + read.pages + ' pages</span>' +
								'<span class="cell-mono">+' + read.added + ' ~' + read.changed + ' −' + read.removed + '</span>' +
								'<span>' + ui.esc(read.when) + '</span>' +
								'</div>' +
								'</div>' +
								'<div class="record-row__state"></div>' +
								'<div class="record-row__state"></div>' +
								'</div>'
							);
						}).join('')
					})
					: cloned
						? ui.callout('Nothing has been read from this copy yet. A read records the pages the repository declares and the commit it read them at; it never writes to the repository.')
						: '') +
				(cloned
					? scripts.length
						? ui.group({
							label: 'Scripts',
							count: scripts.length + (scripts.length === 1 ? ' script' : ' scripts'),
							note: 'The repository\'s own vocabulary. The platform calls these and nothing else.',
							body: scripts.map(function (script) {
								return (
									'<div class="record-row record-row--static">' +
									ui.toneMark('code') +
									'<div class="record-row__main">' +
									'<div class="record-row__title"><span class="record-row__name cell-mono">' + ui.esc(script.name) + '</span></div>' +
									'<div class="record-row__meta"><span>' + ui.esc(script.note) + '</span></div>' +
									'</div>' +
									'<div class="record-row__state"></div>' +
									'<div class="record-row__state"></div>' +
									'</div>'
								);
							}).join('')
						})
						: ui.callout('<b>No documentation scripts.</b> The platform reads <code>' + ui.esc(repo.docs) + '/</code> as files instead: a page is a file, and nothing in the repository runs.')
					: '') +
				ui.rule({ label: 'Where It Lives' }) +
				'<div class="settings-strip">' +
				'<div><div class="settings-strip__label">Remote</div><div class="settings-strip__value cell-mono">' + ui.esc(repo.remote) + '</div></div>' +
				'<div><div class="settings-strip__label">Working copy</div><div class="settings-strip__value cell-mono">' + (cloned ? '~/Temco/' + ui.esc(repo.name) : '—') + '</div></div>' +
				'<div><div class="settings-strip__label">Pages folder</div><div class="settings-strip__value cell-mono">' + ui.esc(repo.docs) + '/</div></div>' +
				'<div><div class="settings-strip__label">Owner</div><div class="settings-strip__value">' + ui.esc(repo.owner) + ' · last read ' + ui.esc(repo.read) + '</div></div>' +
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
		title: 'Documents',
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
					title: 'Documents',
					icon: 'book',
					desc: totalPages.toLocaleString('en-US') + ' pages in ' + areas.length + ' areas, ' + totalReviewed.toLocaleString('en-US') + ' of them read by a person. The registry order is the order the documentation ships in, not the order the files sit on disk.',
					actions:
						ui.button('New Page', { kind: 'primary', icon: 'plus', action: 'new-page' }) +
						ui.button('Generate from Sources', { icon: 'sparkle', action: 'generate-from-sources' })
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
					desc: openArea.pages + ' pages · ' + openArea.reviewed + ' read (' + openPct + '%) · ' + (openArea.stale ? openArea.stale + ' stale' : 'nothing stale') + '. Order is the page order inside the area, not a file line. Pick a page to open it.',
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
						/* Every row is a page; opening one puts it in the working set on the left. */
						rowAction: function (row) {
							return ' data-action="open-page" data-page="' + ui.esc(row.page) + '" data-area="' + ui.esc(openArea.area) + '"';
						},
						rows: pages.map(function (row) {
							return {
								order: row.order,
								page: row.page,
								state: row.state,
								tone: row.tone,
								owner: row.owner,
								changed: row.changed,
								selected: !!(M.state && M.state.page === row.page)
							};
						})
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

	/* One page, in the state the registry holds it: the text, the facts that decide where it ships,
	   and what a save actually writes. */
	M.views['docs/page'] = {
		title: 'Page',
		render: function () {
			var requested = (M.state && M.state.page) || 'Data Points API';
			var areaName = (M.state && M.state.area) || 'API Reference';
			var rows = data.areaPages[areaName] || [];
			var record = rows.filter(function (row) { return row.page === requested; })[0];

			/* Open from a working-set row whose area is not the one on screen: find it where it lives. */
			if (!record) {
				Object.keys(data.areaPages).forEach(function (name) {
					data.areaPages[name].forEach(function (row) {
						if (!record && row.page === requested) {
							record = row;
							areaName = name;
						}
					});
				});
			}
			record = record || { order: 1, page: requested, state: 'Draft', tone: 'info', owner: '—', changed: 'just now' };

			var issues = {
				Conflict: 'Two pages claim order ' + record.order + ' in ' + ui.esc(areaName) + '. The build refuses to guess which one ships, so neither does.',
				Duplicate: 'This page exists twice in the registry — one copy is ' + ui.esc(record.changed) + ' old and has no owner. One of the two has to go.',
				Stale: 'A source changed after this page was written, so the text may describe a version none of the controllers run.',
				Draft: 'This page has not been reviewed by a person. A draft is readable in the window and never in a release.'
			}[record.state];

			/* The page as markdown in a code-editor surface: a gutter, the text, a toolbar and a
			   status line. The shape of an editor, because the page is edited as text — the mock
			   shows the surface, not a working buffer. */
			var markdown = [
				{ kind: 'h1', text: '# ' + record.page },
				{ kind: 'p', text: '' },
				{ kind: 'p', text: record.page + ' is page ' + record.order + ' of the ' + areaName + ' area.' },
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

			var tool = function (label, command, title) {
				return ui.button(label, { small: true, kind: 'ghost', action: 'md-insert', attrs: 'data-md="' + command + '"', title: title });
			};

			var editor =
				'<div class="md-editor">' +
				'<div class="md-editor__bar">' +
				tool('B', 'bold', 'Bold') +
				tool('I', 'italic', 'Italic') +
				tool('H2', 'heading', 'Section heading') +
				tool('• List', 'list', 'Bulleted list') +
				tool('❝', 'quote', 'Note') +
				tool('</>', 'code', 'Code sample') +
				tool('Link', 'link', 'Link to another page') +
				tool('Image', 'image', 'Screenshot from the last read') +
				tool('Table', 'table', 'Table with a header row') +
				'<span class="toolbar__spacer"></span>' +
				'<span class="cell-muted" style="font-size:11px">Markdown · the build reads headings, code and links</span>' +
				'</div>' +
				'<div class="md-editor__body">' +
				'<div class="md-editor__gutter">' +
				markdown.map(function (line, index) { return '<div>' + (index + 1) + '</div>'; }).join('') +
				'</div>' +
				'<div class="md-editor__code">' +
				markdown.map(function (line) {
					return '<div class="md-line md-line--' + line.kind + '">' + (line.text ? ui.esc(line.text) : '&nbsp;') + '</div>';
				}).join('') +
				'</div>' +
				'</div>' +
				'<div class="md-editor__status">' +
				'<span>Ln 1, Col 1</span><span>' + markdown.length + ' lines</span><span>Markdown</span><span>UTF-8</span><span>' + ui.esc(areaName) + ' · order ' + record.order + '</span>' +
				'</div>' +
				'</div>';

			var body =
				ui.pageHead({
					eyebrow: ui.esc(areaName) + ' · order ' + record.order + ' · T3000 13.0',
					title: record.page,
					icon: 'document',
					desc: 'The page as the registry holds it. Saving writes a draft; nothing here reaches a reader until a build and a release carry it.',
					actions:
						ui.button('Submit for Review', { kind: 'primary', icon: 'check', action: 'submit-page' }) +
						ui.button('Read Source', { icon: 'code', action: 'browse-source' })
				}) +
				(issues ? '<div class="mt-16">' + ui.callout(issues, { kind: record.tone === 'err' ? 'warn' : '' }) + '</div>' : '') +
				'<div class="split mt-24" style="grid-template-columns: minmax(0, 1fr) 300px">' +
				editor +
				'<div class="stack">' +
				ui.rule({ label: 'Registry', count: '6 facts' }) +
				'<div class="mt-16">' +
				'<dl class="kv">' +
				'<dt>Area</dt><dd>' + ui.esc(areaName) + '</dd>' +
				'<dt>Order</dt><dd class="cell-mono">' + record.order + '</dd>' +
				'<dt>State</dt><dd>' + ui.badge(record.state, record.tone) + '</dd>' +
				'<dt>Owner</dt><dd>' + ui.esc(record.owner === '—' ? 'nobody yet' : record.owner) + '</dd>' +
				'<dt>Source</dt><dd class="cell-mono">t3000webview</dd>' +
				'<dt>Changed</dt><dd>' + ui.esc(record.changed) + '</dd>' +
				'</dl>' +
				'</div>' +
				ui.group({
					label: 'Links',
					count: '3',
					body:
						'<div class="record-row record-row--static">' + ui.toneMark('arrow-right') +
						'<div class="record-row__main"><div class="record-row__title"><span class="record-row__name">→ Reading a Point</span></div>' +
						'<div class="record-row__meta"><span>outgoing</span></div></div><div class="record-row__state"></div><div class="record-row__state"></div></div>' +
						'<div class="record-row record-row--static">' + ui.toneMark('arrow-right') +
						'<div class="record-row__main"><div class="record-row__title"><span class="record-row__name">→ Point Types</span></div>' +
						'<div class="record-row__meta"><span>outgoing</span></div></div><div class="record-row__state"></div><div class="record-row__state"></div></div>' +
						'<div class="record-row record-row--static">' + ui.toneMark('link') +
						'<div class="record-row__main"><div class="record-row__title"><span class="record-row__name">← Writing a Point</span></div>' +
						'<div class="record-row__meta"><span>incoming · the link the build resolves</span></div></div><div class="record-row__state"></div><div class="record-row__state"></div></div>'
				}) +
				ui.group({
					label: 'History',
					count: '3 revisions',
					body:
						'<div class="record-row record-row--static">' + ui.toneMark('sparkle', 'accent') +
						'<div class="record-row__main"><div class="record-row__title"><span class="record-row__name">AI draft · +42 −8</span></div>' +
						'<div class="record-row__meta"><span>26 minutes ago</span><span>in Review Center</span></div></div><div class="record-row__state"></div><div class="record-row__state"></div></div>' +
						'<div class="record-row record-row--static">' + ui.toneMark('check', 'ok') +
						'<div class="record-row__main"><div class="record-row__title"><span class="record-row__name">Reviewed by Mei</span></div>' +
						'<div class="record-row__meta"><span>2 weeks ago</span><span>12.9</span></div></div><div class="record-row__state"></div><div class="record-row__state"></div></div>' +
						'<div class="record-row record-row--static">' + ui.toneMark('code') +
						'<div class="record-row__main"><div class="record-row__title"><span class="record-row__name">Written from t3000webview</span></div>' +
						'<div class="record-row__meta"><span>3 months ago</span><span>4de5eda</span></div></div><div class="record-row__state"></div><div class="record-row__state"></div></div>'
				}) +
				'</div>' +
				'</div>' +
				ui.group({
					label: 'What Saving Does',
					count: '3 facts',
					body:
						'<div class="record-row record-row--static">' + ui.toneMark('document') +
						'<div class="record-row__main"><div class="record-row__title"><span class="record-row__name">It writes a draft</span></div>' +
						'<div class="record-row__meta"><span>to the registry, not to a source file</span></div></div><div class="record-row__state"></div><div class="record-row__state"></div></div>' +
						'<div class="record-row record-row--static">' + ui.toneMark('check') +
						'<div class="record-row__main"><div class="record-row__title"><span class="record-row__name">The diff goes to Review Center</span></div>' +
						'<div class="record-row__meta"><span>accepting it is a review, not a save</span></div></div><div class="record-row__state"></div><div class="record-row__state"></div></div>' +
						'<div class="record-row record-row--static">' + ui.toneMark('upload') +
						'<div class="record-row__main"><div class="record-row__title"><span class="record-row__name">Only a release reaches a reader</span></div>' +
						'<div class="record-row__meta"><span>a build and a publish, in that order</span></div></div><div class="record-row__state"></div><div class="record-row__state"></div></div>'
				});

			return ui.view(body, { wide: true });
		}
	};

	/* The code behind the pages: what a read turned into text, and what an AI draft is reading when
	   it says it drafted from a source. Read-only, because a page is changed by an edit and a
	   release — never by editing the repository. */
	M.views['docs/source'] = {
		title: 'Source',
		render: function () {
			var requested = M.state && M.state.repository;
			var repo = data.repositories.filter(function (candidate) { return candidate.name === requested; })[0] || data.repositories[0];
			var files = data.sourceFiles;
			var open = files[0];

			var fileRow = function (file, isOpen) {
				return (
					'<div class="record-row' + (isOpen ? ' record-row--current' : ' record-row--static') + '">' +
					ui.toneMark(file.lang === 'Markdown' ? 'document' : 'code', isOpen ? 'accent' : '') +
					'<div class="record-row__main">' +
					'<div class="record-row__title"><span class="record-row__name cell-mono">' + ui.esc(file.path) + '</span></div>' +
					'<div class="record-row__meta"><span>' + ui.esc(file.role) + '</span><span>' + file.lines + ' lines</span></div>' +
					'</div>' +
					'<div class="record-row__state">' + (isOpen ? ui.badge('Open', 'accent') : '') + '</div>' +
					'<div class="record-row__state"></div>' +
					'</div>'
				);
			};

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
					eyebrow: 'Source · ' + repo.name,
					title: 'Source Explorer',
					icon: 'code',
					desc: 'The files behind the pages, as the last read left them. Read-only: a page is changed by an edit and a release, never by editing a source.',
					actions:
						ui.button('Read Again', { icon: 'refresh', action: 'read-source' }) +
						ui.button('Repository', { icon: 'repo', open: 'docs/repository' })
				}) +
				ui.tiles([
					{ value: repo.files.toLocaleString('en-US'), label: 'Files in the repository' },
					{ value: String(repo.pages), label: 'Pages found' },
					{ value: repo.head || '—', label: 'Commit read' },
					{ value: repo.read || 'never', label: 'Last read' }
				]) +
				'<div class="split mt-24" style="grid-template-columns: 320px minmax(0, 1fr)">' +
				ui.group({
					label: 'Files',
					count: files.length + ' files',
					note: 'The six files that produced the API Reference pages. A read keeps the heading structure, not a copy of the file.',
					body: files.map(function (file) { return fileRow(file, file === open); }).join('')
				}) +
				'<div>' +
				ui.group({
					label: open.path,
					plain: true,
					count: open.lang + ' · ' + open.lines + ' lines',
					actions: ui.button('Open on GitHub', { small: true, kind: 'ghost', action: 'open-source-file' }),
					body:
						'<div style="padding-top:10px">' +
						'<pre class="code" style="max-height:420px">' + data.sourceCode.map(ui.esc).join('\n') + '</pre>' +
						'</div>' +
						'<div class="facts">' +
						'<span>read at 4de5eda</span>' +
						'<span>declares 12 headings</span>' +
						'<span>feeds 9 pages</span>' +
						'<span>cited 4 times</span>' +
						'</div>'
				}) +
				'</div>' +
				'</div>' +
				ui.group({
					label: 'What a Read Does With These Files',
					count: '3 steps',
					body:
						fact('search', 'Finds the headings', 'a heading with text under it becomes a page; a heading with nothing under it becomes a gap') +
						fact('document', 'Keeps the code samples', 'a fenced block in the source is quoted verbatim, so the page cannot drift from the code') +
						fact('link', 'Records the links', 'a link to another heading becomes an internal link, which is what the broken-link check reads')
				}) +
				'<div class="mt-16">' +
				ui.callout('An AI draft reads this file as evidence and cites it. Editing the file does not change a page: the next read finds the change, and the page then shows as stale until somebody reviews it.') +
				'</div>';

			return ui.view(body, { wide: true });
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
