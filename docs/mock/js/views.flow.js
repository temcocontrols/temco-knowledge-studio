/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Temco Controls. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*
 * Flows: surfaces that ask for something in steps. A flow is an editor tab like any other — same
 * tabs, same breadcrumbs, same deep link — with a step rail at the top and Back / Next at the
 * bottom. Nothing is written until Finish, and Finish announces what the real surface would do.
 */

(function (M) {
	'use strict';

	var ui = M.ui;
	var data = M.data;

	var states = {};

	/* ------------------------------------------------------------------ small builders */

	function field(label, control, hint) {
		return (
			'<div class="field">' +
			'<label>' + ui.esc(label) + '</label>' +
			control +
			(hint ? '<div class="field__hint">' + ui.esc(hint) + '</div>' : '') +
			'</div>'
		);
	}

	function options(list, selected) {
		return list.map(function (value) {
			return '<option' + (value === selected ? ' selected' : '') + '>' + ui.esc(value) + '</option>';
		}).join('');
	}

	function checklist(items, isChecked, fieldName) {
		return (
			'<div class="checklist">' +
			items.map(function (item) {
				return (
					'<label class="checklist__row">' +
					'<input type="checkbox" data-field="' + fieldName + '" data-multi value="' + ui.esc(item.value) + '"' + (isChecked(item) ? ' checked' : '') + '>' +
					'<span class="checklist__text">' +
					'<span class="checklist__title">' + ui.esc(item.label) + '</span>' +
					(item.sub ? '<span class="checklist__sub">' + ui.esc(item.sub) + '</span>' : '') +
					'</span>' +
					'</label>'
				);
			}).join('') +
			'</div>'
		);
	}

	function choices(name, items, selected) {
		return (
			'<div class="choice-grid">' +
			items.map(function (item) {
				return (
					'<label class="choice">' +
					'<input type="radio" name="' + name + '" data-field="' + name + '" value="' + ui.esc(item.value) + '"' + (item.value === selected ? ' checked' : '') + '>' +
					'<span class="choice__text">' +
					'<span class="choice__label">' + ui.esc(item.label) + '</span>' +
					'<span class="choice__desc">' + ui.esc(item.desc || '') + '</span>' +
					'</span>' +
					'</label>'
				);
			}).join('') +
			'</div>'
		);
	}

	function choiceGroups(groups, selected) {
		return groups.map(function (group) {
			return (
				'<div class="checklist-group">' +
				'<div class="checklist-heading">' + ui.esc(group.label) + '</div>' +
				choices(group.name, group.items, selected) +
				'</div>'
			);
		}).join('');
	}

	function summary(pairs) {
		return '<dl class="kv">' + pairs.map(function (pair) {
			return '<dt>' + ui.esc(pair[0]) + '</dt><dd>' + pair[1] + '</dd>';
		}).join('') + '</dl>';
	}

	function stepHead(title, hint) {
		return '<div class="wizard__title">' + ui.esc(title) + '</div>' +
			(hint ? '<p class="wizard__hint">' + ui.esc(hint) + '</p>' : '');
	}

	function slugify(value) {
		return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
	}

	function nextFreeOrder(area) {
		var pages = data.areaPages[area] || [];
		return pages.reduce(function (top, page) { return Math.max(top, page.order); }, 0) + 1;
	}

	/* Where a new page would sit: the page above it, the page itself, and the page below, read from
	   the area's own registry so the step answers the question it asks. */
	function locationPreview(s) {
		var area = String(s.values.area);
		var order = Number(s.values.order);
		var pages = (data.areaPages[area] || []).slice().sort(function (a, b) { return a.order - b.order; });
		var above = null;
		var below = null;
		pages.forEach(function (page) {
			if (page.order < order) {
				above = page;
			}
			if (page.order > order && !below) {
				below = page;
			}
		});

		var neighbour = function (page, where) {
			return (
				'<div class="record-row record-row--static">' +
				ui.toneMark(page ? 'document' : 'info') +
				'<div class="record-row__main">' +
				'<div class="record-row__title"><span class="record-row__name">' +
				(page ? 'Order ' + page.order + ' \u00b7 ' + ui.esc(page.page) : 'nothing ' + where) +
				'</span></div>' +
				'<div class="record-row__meta"><span>' + (page ? ui.esc(page.state) + ' \u00b7 ' + ui.esc(page.owner === '\u2014' ? 'no owner' : page.owner) : 'it is the edge of this area') + '</span></div>' +
				'</div>' +
				'<div class="record-row__state"></div>' +
				'<div class="record-row__state"></div>' +
				'</div>'
			);
		};

		var created =
			'<div class="record-row record-row--current">' +
			ui.toneMark('plus', 'accent') +
			'<div class="record-row__main">' +
			'<div class="record-row__title"><span class="record-row__name">Order ' + (isNaN(order) ? '?' : order) + ' \u00b7 ' + ui.esc(s.values.title || 'untitled page') + '</span></div>' +
			'<div class="record-row__meta"><span>the page this flow creates</span></div>' +
			'</div>' +
			'<div class="record-row__state">' + ui.badge('Draft', 'info') + '</div>' +
			'<div class="record-row__state"></div>' +
			'</div>';

		var reviewers = pages.map(function (page) { return page.owner; }).filter(function (owner, index, all) {
			return owner && owner !== '\u2014' && all.indexOf(owner) === index;
		});

		return '<div class="mt-16">' + ui.group({
			label: 'Where It Lands',
			count: pages.length + ' pages in ' + area,
			note: reviewers.length ? 'Pages here are owned by ' + reviewers.join(', ') + ', who will be asked to review this one.' : '',
			body: neighbour(above, 'above') + created + neighbour(below, 'below')
		}) + '</div>';
	}

	/* What the chosen page template produces. */
	function templatePreview(s) {
		var chosen = String(s.values.template);
		var sections = chosen === 'source' ? ['Overview', 'Details'] : chosen === 'ai' ? ['Overview', 'Examples', 'Errors'] : [];
		var note = chosen === 'source'
			? 'A source read fills the heading structure it found; a heading with no text stays a stub.'
			: chosen === 'ai'
				? 'The draft lands in Review Center. Nothing is written to the page until a person accepts it.'
				: 'A blank page has a title and an empty body; nothing is stubbed out for you.';
		var rows = sections.length
			? sections.map(function (section, index) {
				return '<div class="record-row record-row--static">' +
					ui.toneMark('list') +
					'<div class="record-row__main">' +
					'<div class="record-row__title"><span class="record-row__name">' + ui.esc(section) + '</span></div>' +
					'<div class="record-row__meta"><span>section ' + (index + 1) + ' \u00b7 a heading with an empty body</span></div>' +
					'</div><div class="record-row__state"></div><div class="record-row__state"></div>' +
					'</div>';
			}).join('')
			: '<div class="record-row record-row--static">' + ui.toneMark('document') +
				'<div class="record-row__main">' +
				'<div class="record-row__title"><span class="record-row__name">Title only</span></div>' +
				'<div class="record-row__meta"><span>the body is yours to write</span></div>' +
				'</div><div class="record-row__state"></div><div class="record-row__state"></div></div>';

		return '<div class="mt-16">' + ui.group({
			label: 'This Template',
			count: sections.length ? sections.length + ' sections' : 'no sections',
			note: note,
			body: rows
		}) + '</div>';
	}

	/* ------------------------------------------------------------------ the flows */

	var defs = [
		{
			id: 'flow/new-project',
			moduleId: 'docs',
			title: 'New Project',
			icon: 'plus',
			eyebrow: 'Documentation',
			/* This flow shows a table of sources, so it takes the width every other working surface
			   takes instead of the 860 px wizard column. */
			wide: true,
			desc: 'A project is a version of a product’s documentation: the sources it reads, the pages it holds and the artifacts it builds.',
			finishLabel: 'Create Project',
			defaults: {
				name: 'T3000 Documentation',
				version: '13.0',
				owner: 'Derek',
				audience: 'Integrators and installers',
				sources: ['t3000webview', 't3000-esp', 'BACnet Protocol Guide.pdf'],
				targets: ['website', 'pdf', 'help', 'search']
			},
			steps: [
				{
					label: 'Basics',
					render: function (s) {
						return stepHead('Name, version and owner', 'The name, the version, and who answers for the result.') +
							'<div class="form">' +
							field('Name', '<input class="input" data-field="name" value="' + ui.esc(s.values.name) + '" aria-label="Project name">') +
							field('Version', '<input class="input" data-field="version" value="' + ui.esc(s.values.version) + '" aria-label="Version">', 'A project publishes one version at a time.') +
							field('Owner', '<select class="select" data-field="owner" aria-label="Owner">' + options(['Derek', 'Mei', 'Ana', 'Unassigned'], s.values.owner) + '</select>') +
							field('Audience', '<input class="input" data-field="audience" value="' + ui.esc(s.values.audience) + '" aria-label="Audience">') +
							'</div>';
					}
				},
				{
					label: 'Sources',
					render: function (s) {
						var isChecked = function (item) { return s.values.sources.indexOf(item.value) >= 0; };
						var repositories = data.sources.filter(function (source) { return source.kind === 'Repository'; });
						var files = data.sources.filter(function (source) { return source.kind !== 'Repository'; });
						var chosenFiles = files.filter(function (source) { return s.values.sources.indexOf(source.name) >= 0; }).length;

						var repositoryGroup =
							'<div class="checklist-group">' +
							'<div class="checklist-heading">Repositories<span class="checklist-heading__count">' + repositories.length + '</span></div>' +
							'<div class="checklist-tools">' +
							'<input class="input input--sm" data-filter="repos" placeholder="Search repositories" aria-label="Search repositories">' +
							ui.button('Load all', { small: true, kind: 'ghost', icon: 'download', action: 'check-all' }) +
							'</div>' +
							'<div data-filter-list="repos">' +
							checklist(
								repositories.map(function (source) {
									return { value: source.name, label: source.name, sub: source.detail + ' · ' + (source.pages ? source.pages + ' pages' : 'not read') };
								}),
								isChecked,
								'sources'
							) +
							'</div>' +
							'</div>';

						var fileGroup =
							'<div class="checklist-group">' +
							'<div class="checklist-heading">Files and folders<span class="checklist-heading__count">' + files.length + '</span></div>' +
							'<details class="disclosure">' +
							'<summary>Choose files and folders…<span class="cell-muted">' + chosenFiles + ' of ' + files.length + ' selected</span></summary>' +
							checklist(
								files.map(function (source) {
									return { value: source.name, label: source.name, sub: source.kind + ' · ' + source.detail };
								}),
								isChecked,
								'sources'
							) +
							'</details>' +
							'</div>';

						return stepHead('What it reads', 'Search the repositories, or choose individual files and folders. Both record the pages they declare.') +
							repositoryGroup + fileGroup +
							'<p class="wizard__hint" style="margin-top:12px">' + s.values.sources.length + ' of ' + data.sources.length + ' selected</p>';
					}
				},
				{
					label: 'Outputs',
					render: function (s) {
						var targets = [
							{ value: 'website', label: 'Website', sub: 'Static pages for Temco Learn' },
							{ value: 'pdf', label: 'PDF', sub: 'One document, printed layout' },
							{ value: 'help', label: 'Offline help', sub: 'CHM · needs the help compiler' },
							{ value: 'search', label: 'Search index', sub: 'lunr index for the site' },
							{ value: 'ai', label: 'AI index', sub: 'Embeddings, kept on this machine only' }
						];
						return stepHead('What it builds', 'One build produces every target you tick here.') +
							checklist(
								targets,
								function (item) { return s.values.targets.indexOf(item.value) >= 0; },
								'targets'
							);
					}
				},
				{
					label: 'Review',
					render: function (s) {
						return stepHead('Check before creating', 'Nothing has been written yet.') +
							summary([
								['Name', '<span class="cell-strong">' + ui.esc(s.values.name) + '</span>'],
								['Version', '<span class="cell-mono">' + ui.esc(s.values.version) + '</span>'],
								['Owner', ui.esc(s.values.owner)],
								['Audience', ui.esc(s.values.audience)],
								['Sources', s.values.sources.length + ' — ' + ui.esc(s.values.sources.join(', '))],
								['Outputs', ui.esc(s.values.targets.join(', ') || 'none')]
							]) +
							'<div class="mt-16">' +
							ui.callout('The project is recorded in the platform database under <code>temcoStore</code>. Nothing is written into a repository, and the first build is yours to start.') +
							'</div>';
					}
				}
			],
			validate: function (s, step) {
				if (step === 0 && !String(s.values.name).trim()) {
					return 'A project needs a name.';
				}
				if (step === 1 && !s.values.sources.length) {
					return 'Choose at least one source to read.';
				}
				if (step === 2 && !s.values.targets.length) {
					return 'Choose at least one output to build.';
				}
				return '';
			},
			apply: function (s) {
				data.docsProjects.unshift({
					name: s.values.name,
					version: s.values.version,
					pages: 0,
					sources: s.values.sources.length,
					owner: s.values.owner,
					state: 'Draft',
					tone: 'neutral',
					updated: 'just now'
				});
				return {
					toast: s.values.name + ' created as a draft.',
					open: 'docs/projects'
				};
			}
		},

		{
			id: 'flow/add-source',
			moduleId: 'docs',
			title: 'Add Source',
			icon: 'repo',
			eyebrow: 'Documentation',
			/* The 860 px wizard column fit this form; now it matches the page it writes to. */
			wide: true,
			desc: 'A source is somewhere documentation is read from: a repository, a document, a folder, or a connected library.',
			finishLabel: 'Add Source',
			defaults: {
				kind: 'repo',
				location: 'https://github.com/temcocontrols/t3000webview',
				branch: 'main',
				shallow: false,
				readNow: true
			},
			steps: [
				{
					label: 'Kind',
					render: function (s) {
						return stepHead('What kind of source?', 'The kind decides how the platform reads it, and what it records.') +
							choiceGroups([
								{
									label: 'Repositories', name: 'kind', items: [
										{ value: 'repo', label: 'Git repository', desc: 'Cloned locally with full history, so a draft can be about a commit.' }
									]
								},
								{
									label: 'Files and folders', name: 'kind', items: [
										{ value: 'document', label: 'Document', desc: 'A PDF or a Word file on this machine.' },
										{ value: 'folder', label: 'Folder', desc: 'A directory of Markdown or HTML files.' },
										{ value: 'sharepoint', label: 'SharePoint', desc: 'A connected library, read through the API.' }
									]
								}
							], s.values.kind);
					}
				},
				{
					label: 'Location',
					render: function (s) {
						var isRepo = s.values.kind === 'repo';
						return stepHead('Where is it?', isRepo
							? 'The repository is cloned into the working area; nothing is pushed back.'
							: 'A path or a URL the platform can read.') +
							'<div class="form">' +
							field('Location', '<input class="input" data-field="location" value="' + ui.esc(s.values.location) + '" aria-label="Location">') +
							(isRepo ? field('Branch', '<select class="select" data-field="branch" aria-label="Branch">' + options(['main', 't3000', 'release/13.0'], s.values.branch) + '</select>') : '') +
							(isRepo ? '<label class="check"><input type="checkbox" data-field="shallow"' + (s.values.shallow ? ' checked' : '') + '><span>Shallow copy — faster, but the history is not there for drafts</span></label>' : '') +
							'</div>';
					}
				},
				{
					label: 'Read',
					render: function (s) {
						var kinds = { repo: 'Repository', document: 'Document', folder: 'Folder', sharepoint: 'SharePoint' };
						return stepHead('Read it', 'Reading records what the source contains. It is safe to repeat.') +
							summary([
								['Kind', ui.esc(kinds[s.values.kind] || s.values.kind)],
								['Location', '<span class="cell-mono">' + ui.esc(s.values.location) + '</span>'],
								['Branch', s.values.kind === 'repo' ? '<span class="cell-mono">' + ui.esc(s.values.branch) + (s.values.shallow ? ' · shallow' : '') + '</span>' : '—']
							]) +
							'<label class="check" style="margin-top:14px"><input type="checkbox" data-field="readNow"' + (s.values.readNow ? ' checked' : '') + '><span>Read the source now, after it is added</span></label>' +
							'<div class="mt-16">' +
							ui.callout('A source is never edited. The pages a read finds are recorded in the platform database; the source stays the only copy of its own content.') +
							'</div>';
					}
				}
			],
			validate: function (s, step) {
				if (step === 1 && !String(s.values.location).trim()) {
					return 'A source needs a location.';
				}
				return '';
			},
			apply: function (s) {
				var kinds = { repo: 'Repository', document: 'Document', folder: 'Folder', sharepoint: 'SharePoint' };
				var name = String(s.values.location).replace(/[\\/]+$/, '').split(/[\\/]/).pop() || s.values.location;
				data.sources.unshift({
					name: name,
					kind: kinds[s.values.kind] || 'Source',
					detail: s.values.location,
					state: s.values.readNow ? 'Read' : 'Not read',
					tone: s.values.readNow ? 'ok' : 'neutral',
					found: s.values.readNow ? '42 pages' : '—',
					when: s.values.readNow ? 'just now' : 'never'
				});
				return {
					toast: name + ' added' + (s.values.readNow ? ' and read.' : '.'),
					open: 'docs/sources'
				};
			}
		},

		{
			id: 'flow/publish',
			moduleId: 'docs',
			title: 'Publish Release',
			icon: 'upload',
			eyebrow: 'Documentation · 13.0',
			/* The preflight lists every target and every open problem, which needs the width. */
			wide: true,
			desc: 'Publishing copies the built artifacts to Temco Learn and freezes this version of the pages. It is the last thing that happens to a version, not the first thing you can undo.',
			finishLabel: 'Publish 13.0',
			defaults: {
				version: '13.0',
				channel: 'Stable',
				pin: true,
				notes: 'Generated from commits since 12.9'
			},
			steps: [
				{
					label: 'Preflight',
					render: function () {
						/* Read from Build Center and from the checks, so this step cannot claim a
						   target is ready when the build says otherwise. The AI index is built here
						   and never published, so it is listed but never blocks. */
						var localOnly = ['AI Index'];
						var targets = data.builds.map(function (build) {
							var local = localOnly.indexOf(build.target) >= 0;
							return {
								name: build.target,
								sub: build.detail + ' · ' + build.time,
								state: build.state,
								tone: build.tone,
								local: local,
								blocking: !local && build.state !== 'Succeeded'
							};
						});
						var blocking = targets.filter(function (target) { return target.blocking; });
						var errors = data.problems.filter(function (problem) { return problem.severity === 'err'; });
						var warnings = data.problems.filter(function (problem) { return problem.severity !== 'err'; });

						var targetRow = function (target) {
							return (
								'<div class="record-row record-row--static">' +
								ui.toneMark('package', target.local ? '' : target.blocking ? 'err' : 'ok') +
								'<div class="record-row__main">' +
								'<div class="record-row__title"><span class="record-row__name">' + ui.esc(target.name) + '</span>' +
								(target.local ? '<span class="cell-muted">stays on this machine</span>' : '') +
								'</div>' +
								'<div class="record-row__meta"><span>' + ui.esc(target.sub) + '</span></div>' +
								'</div>' +
								'<div class="record-row__state">' + ui.badge(target.local ? 'Not published' : target.state, target.local ? 'neutral' : target.tone) + '</div>' +
								'<div class="record-row__state"></div>' +
								'</div>'
							);
						};

						var problemRow = function (problem) {
							var blockingProblem = problem.severity === 'err';
							return (
								'<div class="record-row record-row--static">' +
								ui.toneMark('alert', blockingProblem ? 'err' : 'warn') +
								'<div class="record-row__main">' +
								'<div class="record-row__title"><span class="record-row__name">' + ui.esc(problem.message) + '</span></div>' +
								'<div class="record-row__meta">' +
								'<span class="cell-mono">' + ui.esc(problem.where) + '</span>' +
								'<span>' + (blockingProblem ? 'blocks this release' : 'ships with this release') + '</span>' +
								'</div>' +
								'</div>' +
								'<div class="record-row__state">' + ui.badge(blockingProblem ? 'Error' : 'Warning', blockingProblem ? 'err' : 'warn') + '</div>' +
								'<div class="record-row__state"></div>' +
								'</div>'
							);
						};

						return stepHead('Before publishing', 'Every artifact this release publishes has to be finished, and every structural error has to be closed.') +
							ui.group({
								label: 'Build Targets',
								count: targets.length + ' targets · ' + (targets.length - blocking.length) + ' ready',
								note: 'These are Build Center\'s own rows. A target that is queued has not started; one that is running has a percentage.',
								body: targets.map(targetRow).join('')
							}) +
							ui.group({
								label: 'Structure Checks',
								count: errors.length + ' errors · ' + warnings.length + ' warnings',
								body: data.problems.map(problemRow).join('')
							}) +
							'<div class="mt-16">' +
							ui.callout(
								blocking.length
									? 'Publishing is refused while a target is incomplete: ' + blocking.map(function (target) { return '<b>' + ui.esc(target.name) + '</b>'; }).join(' and ') + ' ' + (blocking.length === 1 ? 'is' : 'are') + ' not finished, and ' + errors.length + ' structural errors are open.'
									: 'Every published artifact is built and every structural check passes. Publishing freezes this version.',
								{ kind: blocking.length ? 'warn' : 'ok' }
							) +
							'</div>';
					}
				},
				{
					label: 'Version',
					render: function (s) {
						return stepHead('Version and channel', 'A published version cannot be edited afterwards — only superseded by the next one.') +
							'<div class="settings-rows">' +
							ui.formRow('Version', 'Major and minor, like 13.0. It becomes the path segment a reader sees.', '<input class="input" data-field="version" value="' + ui.esc(s.values.version) + '" aria-label="Version">') +
							ui.formRow('Channel', 'Preview is served with noindex and is not linked from the product index.', '<select class="select" data-field="channel" aria-label="Channel">' + options(['Stable', 'Preview (noindex)'], s.values.channel) + '</select>') +
							ui.formRow('Release notes', 'Where the changelog for this version comes from.', '<select class="select" data-field="notes" aria-label="Release notes">' + options(['Generated from commits since 12.9', 'Written by hand', 'None'], s.values.notes) + '</select>') +
							ui.formRow('Previous version', 'A superseded version stays reachable at its own path instead of being replaced.', '<label class="check"><input type="checkbox" data-field="pin"' + (s.values.pin ? ' checked' : '') + '><span>Keep at its own path</span></label>') +
							'</div>' +
							'<div class="mt-16">' +
							ui.callout('The version number is the one thing that cannot change later: the artifact filenames, the URL and the help id all embed it.') +
							'</div>';
					}
				},
				{
					label: 'Publish',
					render: function (s) {
						var artifactCount = data.builds.filter(function (build) { return build.target !== 'AI Index'; }).length;
						return stepHead('Confirm and publish', 'This is the last step; nothing here can be undone, only superseded.') +
							'<div class="grid grid--2">' +
							ui.card({
								title: 'This Release',
								cls: 'card--plain',
								body: summary([
									['Version', '<span class="cell-mono">' + ui.esc(s.values.version) + '</span>'],
									['Channel', ui.esc(s.values.channel)],
									['Target', '<span class="cell-mono">https://learn.temcocontrols.com/t3000/' + ui.esc(s.values.version) + '/</span>'],
									['Artifacts', artifactCount + ' of ' + data.builds.length + ' · website, PDF, offline help, search index'],
									['Not published', 'the AI index stays local'],
									['Notes', ui.esc(s.values.notes)],
									['Previous', s.values.pin ? 'kept at its own path' : 'replaced']
								])
							}) +
							ui.card({
								title: 'After Publishing',
								cls: 'card--plain',
								desc: 'What exists once this finishes, and where it is.',
								body: ui.list([
									{ icon: 'globe', title: 'The site answers at the target', sub: '<span class="cell-muted">/t3000/' + ui.esc(s.values.version) + '/</span>', meta: ui.badge('Public', 'ok') },
									{ icon: 'document', title: 't3000-' + ui.esc(s.values.version) + '.pdf', sub: '<span class="cell-muted">the download page links it</span>', meta: ui.badge('Download', 'neutral') },
									{ icon: 'package', title: 'Offline help', sub: '<span class="cell-muted">the CHM ships with the installer, not the site</span>', meta: ui.badge('Artifact', 'neutral') },
									{ icon: 'search', title: 'Search index rebuilt', sub: '<span class="cell-muted">the site loads this one, not the previous version\'s</span>', meta: ui.badge('Live', 'ok') },
									{ icon: 'clock', title: 'This version is frozen', sub: '<span class="cell-muted">an edit now needs a new release</span>', meta: ui.badge('Frozen', 'accent') }
								])
							}) +
							'</div>' +
							'<div class="mt-16">' +
							ui.callout('Published pages are frozen: a later edit reaches readers only through a new release. The version you replace stays on disk, so a rollback is a publish of the older version.', { kind: 'warn' }) +
							'</div>';
					}
				}
			],
			/* A version is a number a person types, so it is checked: the shape, and whether this
			   version already shipped. */
			validate: function (s, step) {
				if (step !== 1) {
					return '';
				}
				var version = String(s.values.version || '').trim();
				if (!/^\d+\.\d+$/.test(version)) {
					return 'A version is a major and a minor number, like 13.0.';
				}
				var taken = data.releases.filter(function (release) { return release.version === version; })[0];
				if (taken && taken.state === 'Published') {
					return 'Version ' + version + ' is already published. A published version is superseded, never overwritten.';
				}
				return '';
			},
			apply: function (s) {
				if (data.releases.length) {
					data.releases[0].state = 'Published';
					data.releases[0].tone = 'ok';
					data.releases[0].version = s.values.version;
					data.releases[0].artifacts = 'Website · PDF · CHM · ZIP';
				}
				return {
					toast: '13.0 published to Temco Learn.',
					open: 'docs/releases'
				};
			}
		},

		{
			id: 'flow/stage-firmware',
			moduleId: 'devices',
			title: 'Stage Firmware',
			icon: 'package',
			eyebrow: 'Devices',
			desc: 'Staging writes an image to a controller. It does not flash anything until the device is told to restart.',
			finishLabel: 'Stage Update',
			defaults: {
				devices: [2388, 2410],
				version: '2.15.0-rc2',
				channel: 'Preview'
			},
			steps: [
				{
					label: 'Devices',
					render: function (s) {
						var candidates = data.devices.filter(function (device) { return device.firmware !== '2.14.3'; });
						return stepHead('Which devices?', 'Only devices that are not on the current stable release are listed.') +
							checklist(
								candidates.map(function (device) {
									return { value: String(device.serial), label: device.name, sub: device.product + ' · firmware ' + device.firmware + ' · ' + device.status };
								}),
								function (item) { return s.values.devices.indexOf(Number(item.value)) >= 0; },
								'devices'
							);
					}
				},
				{
					label: 'Image',
					render: function (s) {
						return stepHead('Which image?', 'A preview image is refused on a production workspace unless the channel is switched.') +
							'<div class="form">' +
							field('Version', '<select class="select" data-field="version" aria-label="Firmware version">' + options(['2.15.0-rc2', '2.14.3', '2.14.1'], s.values.version) + '</select>') +
							field('Channel', '<select class="select" data-field="channel" aria-label="Channel">' + options(['Preview', 'Stable'], s.values.channel) + '</select>') +
							'</div>' +
							(s.values.version.indexOf('rc') >= 0
								? '<div class="mt-16">' + ui.callout('<b>2.15.0-rc2 is a preview.</b> Staging is allowed; the restart is refused until the workspace channel matches.', { kind: 'warn' }) + '</div>'
								: '');
					}
				},
				{
					label: 'Confirm',
					render: function (s) {
						var names = data.devices
							.filter(function (device) { return s.values.devices.indexOf(device.serial) >= 0; })
							.map(function (device) { return device.name; });
						return stepHead('Check before staging', 'Nothing has been written yet.') +
							summary([
								['Image', '<span class="cell-mono">' + ui.esc(s.values.version) + '</span> · ' + ui.esc(s.values.channel)],
								['Devices', String(names.length) + ' — ' + ui.esc(names.join(', ') || 'none')],
								['Restart', 'not before the device is told to']
							]) +
							'<div class="mt-16">' +
							ui.callout('The image is written next to the current database; the platform keeps a rollback copy before the restart.', { kind: 'warn' }) +
							'</div>';
					}
				}
			],
			validate: function (s, step) {
				if (step === 0 && !s.values.devices.length) {
					return 'Choose at least one device.';
				}
				return '';
			},
			apply: function (s) {
				return {
					toast: 'Firmware ' + s.values.version + ' staged for ' + s.values.devices.length + ' devices.',
					open: 'devices/firmware'
				};
			}
		},

		{
			id: 'flow/new-page',
			moduleId: 'docs',
			title: 'New Page',
			icon: 'document',
			eyebrow: 'Documentation',
			wide: true,
			desc: 'A page belongs to a chapter in an area. Its order is what the site and the PDF use.',
			finishLabel: 'Create Page',
			defaults: {
				area: 'API Reference',
				order: '23',
				template: 'blank',
				owner: 'Derek',
				title: 'Point Scaling'
			},
			steps: [
				{
					label: 'Location',
					render: function (s) {
						return stepHead('Where does it go?', 'The area decides who is asked to review it.') +
						'<div class="settings-rows">' +
						ui.formRow('Area', 'Each area has its own order, so 20 here is not 20 there.', '<select class="select" data-field="area" aria-label="Area">' + options(['Overview', 'Getting Started', 'Architecture', 'API Reference', 'Hardware', 'Protocols', 'Troubleshooting', 'Release Notes'], s.values.area) + '</select>') +
						ui.formRow('Order', 'Position inside the area. The next free one is ' + nextFreeOrder(s.values.area) + '.', '<input class="input" data-field="order" value="' + ui.esc(s.values.order) + '" aria-label="Order">') +
						'</div>' +
						locationPreview(s);
					}
				},
				{
					label: 'Template',
					render: function (s) {
						return stepHead('Start from what?', 'A template is a page outline, not a copy of someone else’s content.') +
							choices('template', [
								{ value: 'blank', label: 'Blank page', desc: 'A title and an empty body.' },
								{ value: 'source', label: 'From a source read', desc: 'Pulls the headings the source already has.' },
								{ value: 'ai', label: 'AI draft', desc: 'A draft lands in Review Center, not in the page.' }
							], s.values.template) + templatePreview(s);
					}
				},
				{
					label: 'Draft',
					render: function (s) {
						var slug = slugify(s.values.title);
						return stepHead('Name it', 'The slug comes from the title and never changes afterwards — links and help ids point at it.') +
						'<div class="settings-rows">' +
						ui.formRow('Title', 'What a reader sees in the list and in the PDF.', '<input class="input" data-field="title" value="' + ui.esc(s.values.title) + '" aria-label="Page title">') +
						ui.formRow('Slug', 'Derived from the title; two pages cannot share one inside an area.', '<input class="input" value="' + ui.esc(slug) + '" aria-label="Slug" readonly>') +
						ui.formRow('Owner', 'Who is told when this page goes stale.', '<select class="select" data-field="owner" aria-label="Owner">' + options(['Derek', 'Mei', 'Ana', 'nobody yet'], s.values.owner) + '</select>') +
						'</div>' +
						'<div class="mt-16">' +
						ui.group({
							label: 'Address',
							count: s.values.template === 'ai' ? 'draft first' : 'draft',
							body: '<div class="record-row record-row--static">' +
								ui.toneMark('link') +
								'<div class="record-row__main">' +
								'<div class="record-row__title"><span class="record-row__name cell-mono">t3000 › ' + ui.esc(slugify(s.values.area)) + ' › ' + ui.esc(slug || '…') + '</span></div>' +
								'<div class="record-row__meta"><span>where the site and the search index will list it</span></div>' +
								'</div><div class="record-row__state"></div><div class="record-row__state"></div></div>'
						}) +
						'</div>' +
						'<div class="mt-16">' +
						ui.callout('The page is created as a draft. It reaches the site only through a build and a release.') +
						'</div>';
					}
				}
			],
			validate: function (s, step) {
				var area = String(s.values.area);
				var pages = data.areaPages[area] || [];
				var order = String(s.values.order).trim();
				if (step === 0) {
					if (!/^\d+$/.test(order)) {
						return 'Order is a whole number; it is what the site and the PDF sort by.';
					}
					var taken = pages.filter(function (page) { return page.order === Number(order); })[0];
					if (taken) {
						return 'Order ' + order + ' is already taken by “' + taken.page + '” in ' + area + '. Two pages cannot share a position.';
					}
				}
				if (step === 2) {
					var title = String(s.values.title).trim();
					if (!title) {
						return 'A page needs a title.';
					}
					var clash = pages.filter(function (page) { return page.page.toLowerCase() === title.toLowerCase(); })[0];
					if (clash) {
						return 'A page called “' + clash.page + '” already exists in ' + area + '.';
					}
				}
				return '';
			},
			apply: function (s) {
				return {
					toast: 'Draft “' + s.values.title + '” created in ' + s.values.area + ' at order ' + s.values.order + '.',
					open: 'docs/knowledge'
				};
			}
		},

		{
			id: 'flow/new-workspace',
			moduleId: 'workspaces',
			title: 'New Workspace',
			icon: 'layers',
			eyebrow: 'Workspaces',
			wide: true,
			desc: 'A workspace is the folder the window stands in: its projects, the sources they read and the devices it can reach.',
			finishLabel: 'Create Workspace',
			defaults: {
				name: 'Field Service',
				folder: '~/Temco/FieldService',
				modules: ['docs', 'learn', 'ai']
			},
			steps: [
				{
					label: 'Name',
					render: function (s) {
						return stepHead('Name and folder', 'The folder is created on first use; it is not created now.') +
							'<div class="form">' +
							field('Name', '<input class="input" data-field="name" value="' + ui.esc(s.values.name) + '" aria-label="Workspace name">') +
							field('Folder', '<input class="input" data-field="folder" value="' + ui.esc(s.values.folder) + '" aria-label="Folder">') +
							'</div>';
					}
				},
				{
					label: 'Modules',
					render: function (s) {
						var modules = [
							{ value: 'docs', label: 'Documentation', sub: 'projects, sources, pages, builds' },
							{ value: 'learn', label: 'Temco Learn', sub: 'the published site' },
							{ value: 'ai', label: 'AI Hub', sub: 'local models and drafts' },
							{ value: 'devices', label: 'Devices', sub: 'fleet, firmware, health' },
							{ value: 'io', label: 'I/O Studio', sub: 'points and mapping' },
							{ value: 'bacnet', label: 'BACnet Studio', sub: 'objects, alarms, trends' },
							{ value: 'network', label: 'Network', sub: 'discovery and captures' },
							{ value: 'sql', label: 'SQL Studio', sub: 'queries and reports' }
						];
						return stepHead('What is it for?', 'This only changes what the workspace brings forward; every module stays available.') +
							checklist(
								modules,
								function (item) { return s.values.modules.indexOf(item.value) >= 0; },
								'modules'
							);
					}
				}
			],
			validate: function (s, step) {
				if (step === 0 && !String(s.values.name).trim()) {
					return 'A workspace needs a name.';
				}
				return '';
			},
			apply: function (s) {
				data.workspaces.push({
					id: String(s.values.name).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
					name: s.values.name,
					desc: 'Created in this window',
					projects: 0,
					sources: 0,
					devices: 0,
					updated: 'just now',
					active: false,
					tone: 'neutral'
				});
				return {
					toast: s.values.name + ' created.',
					open: 'workspaces/all'
				};
			}
		}
	];

	/* ------------------------------------------------------------------ the engine */

	function definition(id) {
		for (var index = 0; index < defs.length; index++) {
			if (defs[index].id === id) {
				return defs[index];
			}
		}
		return null;
	}

	function state(id) {
		if (!states[id]) {
			var def = definition(id);
			states[id] = {
				step: 0,
				error: '',
				values: JSON.parse(JSON.stringify((def && def.defaults) || {}))
			};
		}
		return states[id];
	}

	function collect(id, root) {
		var current = state(id);
		if (!root) {
			return;
		}
		var multi = {};
		Array.prototype.forEach.call(root.querySelectorAll('[data-field]'), function (input) {
			var key = input.getAttribute('data-field');
			if (input.type === 'checkbox') {
				if (input.hasAttribute('data-multi')) {
					multi[key] = multi[key] || [];
					if (input.checked) {
						multi[key].push(key === 'devices' ? Number(input.value) : input.value);
					}
				} else {
					current.values[key] = input.checked;
				}
			} else if (input.type === 'radio') {
				if (input.checked) {
					current.values[key] = input.value;
				}
			} else {
				current.values[key] = input.value;
			}
		});

		/* Rebuilt in DOM order, so the review step reads in the order the checkboxes are shown. */
		Object.keys(multi).forEach(function (key) {
			current.values[key] = multi[key];
		});
	}

	function render(id) {
		var def = definition(id);
		var current = state(id);
		if (!def) {
			return ui.view(ui.empty('This flow does not exist', ''));
		}
		var stepIndex = Math.min(current.step, def.steps.length - 1);
		var rail = def.steps.map(function (step, index) {
			var cls = 'step' + (index === stepIndex ? ' is-active' : '') + (index < stepIndex ? ' is-done' : '');
			var button =
				'<button type="button" class="' + cls + '" data-action="flow-step" data-step="' + index + '" role="tab" aria-selected="' + (index === stepIndex) + '">' +
				'<span class="step__n">' + (index + 1) + '.</span>' +
				'<span class="step__label">' + ui.esc(step.label) + '</span>' +
				'</button>';
			return index === 0 ? button : '<span class="step__arrow" aria-hidden="true">→</span>' + button;
		}).join('');

		return ui.view(
			ui.pageHead({
				eyebrow: def.eyebrow,
				title: def.title,
				icon: def.icon,
				desc: def.desc,
				actions: ui.button('Cancel', { kind: 'ghost', icon: 'close', action: 'flow-cancel' })
			}) +
			'<div class="wizard">' +
			'<div class="wizard__steps" role="tablist">' + rail + '</div>' +
			'<div class="wizard__body">' +
			def.steps[stepIndex].render(current) +
			(current.error ? '<div class="wizard__error">' + ui.esc(current.error) + '</div>' : '') +
			'</div>' +
			'<div class="wizard__foot">' +
			'<span class="cell-muted" style="font-size:12px">Step ' + (stepIndex + 1) + ' of ' + def.steps.length + '</span>' +
			'<span class="wizard__spacer"></span>' +
			(stepIndex > 0 ? ui.button('Back', { icon: 'chevron-left', action: 'flow-back' }) : '') +
			(stepIndex < def.steps.length - 1
				? ui.button('Next', { kind: 'primary', action: 'flow-next' })
				: ui.button(def.finishLabel, { kind: 'primary', icon: 'check', action: 'flow-finish' })) +
			'</div>' +
			'</div>',
			(def.wide ? {} : { narrow: true })
		);
	}

	M.flow = {
		refresh: function (id, root) {
			collect(id, root);
		},
		next: function (id, root) {
			var def = definition(id);
			var current = state(id);
			collect(id, root);
			current.error = def.validate ? def.validate(current, current.step) || '' : '';
			if (current.error) {
				return false;
			}
			current.step = Math.min(current.step + 1, def.steps.length - 1);
			return true;
		},
		back: function (id, root) {
			var current = state(id);
			collect(id, root);
			current.error = '';
			current.step = Math.max(0, current.step - 1);
		},
		step: function (id, index, root) {
			var def = definition(id);
			var current = state(id);
			collect(id, root);
			current.error = '';
			current.step = Math.max(0, Math.min(index, def.steps.length - 1));
		},
		finish: function (id, root) {
			var def = definition(id);
			var current = state(id);
			collect(id, root);
			current.error = def.validate ? def.validate(current, current.step) || '' : '';
			if (current.error) {
				return null;
			}
			var result = def.apply ? def.apply(current) : null;
			delete states[id];
			return result;
		},
		cancel: function (id) {
			delete states[id];
		}
	};

	/* Register every flow as a tab-able surface, outside the side bar. */
	defs.forEach(function (def) {
		var module = null;
		M.modules.forEach(function (candidate) {
			if (candidate.id === def.moduleId) {
				module = candidate;
			}
		});
		M.viewIndex[def.id] = {
			id: def.id,
			label: def.title,
			icon: def.icon,
			moduleId: def.moduleId,
			moduleLabel: module ? module.label : '',
			/* A flow opens from a button, not from a group in the side bar: there is no level to
			   name between the module and the flow itself. */
			singleSection: true
		};
		M.views[def.id] = {
			title: def.title,
			render: function () {
				return render(def.id);
			}
		};
	});

	/* A workspace picker, because File › Open Workspace opens a page rather than a wizard. */
	M.viewIndex['flow/open-workspace'] = {
		id: 'flow/open-workspace',
		label: 'Open Workspace',
		icon: 'layers',
		moduleId: 'workspaces',
		moduleLabel: 'Workspaces',
		singleSection: true
	};
	M.views['flow/open-workspace'] = {
		title: 'Open Workspace',
		render: function () {
			return ui.view(
				ui.pageHead({
					title: 'Open Workspace',
					icon: 'layers',
					desc: 'One window stands in one workspace at a time. Switching closes nothing — the tabs of the previous workspace come back when you return.',
					actions: ui.button('New Workspace…', { kind: 'primary', icon: 'plus', action: 'new-workspace' })
				}) +
				'<div class="list">' +
				data.workspaces.map(function (workspace) {
					return (
						'<div class="list__item">' +
						ui.icon('layers') +
						'<div class="list__main">' +
						'<div class="list__title">' + ui.esc(workspace.name) + (workspace.active ? ' ' + ui.badge('Current', 'accent') : '') + '</div>' +
						'<div class="list__sub">' + ui.esc(workspace.desc) + ' · ' + workspace.projects + ' projects · ' + workspace.devices + ' devices</div>' +
						'</div>' +
						'<div class="list__meta">' +
						ui.button('Open', {
							small: true,
							kind: workspace.active ? 'primary' : undefined,
							open: workspace.active ? 'workspaces/t3000' : undefined,
							toast: workspace.active ? undefined : 'Only T3000 has a detail page in the mock.'
						}) +
						'</div>' +
						'</div>'
					);
				}).join('') +
				'</div>'
			);
		}
	};
})(window.TemcoMock = window.TemcoMock || { views: {} });
