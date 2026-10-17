/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Temco Controls. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*
 * The catalog: which modules the window has, what each one's side bar offers, and the mock data
 * behind them. Everything here is invented for layout work — it is not read from the real
 * extensions and must never be treated as a fixture.
 */

(function (M) {
	'use strict';

	M.modules = [
		{
			id: 'dashboard',
			label: 'Dashboard',
			icon: 'home',
			defaultView: 'dashboard/overview',
			sections: [
				{
					label: 'Platform',
					views: [
						{ id: 'dashboard/overview', label: 'Overview', icon: 'home' },
						{ id: 'dashboard/activity', label: 'Recent Activity', icon: 'clock' },
						{ id: 'dashboard/health', label: 'Coverage & Health', icon: 'check' }
					]
				},
				{
					label: 'Needs Work',
					views: [
						{ id: 'dashboard/needs', label: 'Needs Review', icon: 'alert', badge: 17, tone: 'warn' }
					]
				}
			]
		},
		{
			id: 'workspaces',
			label: 'Workspaces',
			icon: 'layers',
			defaultView: 'workspaces/all',
			sections: [
				{
					label: 'Workspaces',
					views: [
						{ id: 'workspaces/all', label: 'All Workspaces', icon: 'layers' },
						{ id: 'workspaces/t3000', label: 'T3000', icon: 'building' },
						{ id: 'workspaces/templates', label: 'Templates', icon: 'package' }
					]
				}
			]
		},
		{
			id: 'docs',
			label: 'Documentation',
			icon: 'document',
			defaultView: 'docs/projects',
			/* Grouped by what the surface is about: what you are building, where its text comes from,
			   the text itself, and the road to a reader. A single-surface group still earns its
			   heading, because the four names are the map of the module. */
			sections: [
				{
					label: 'Projects',
					/* Expanded into the projects themselves, so the one being worked on is visible without opening
					   the list first. */
					tree: 'projects',
					views: [
						{ id: 'docs/projects', label: 'Projects', icon: 'folder', badge: 12 }
					]
				},
				{
					label: 'Sources',
					views: [
						{ id: 'docs/repositories', label: 'Repositories', icon: 'repo', badge: 4 },
						{ id: 'docs/sources', label: 'Sources', icon: 'link', badge: 7 }
					]
				},
				{
					label: 'Documents',
					/* Expanded into the areas, so the registry is reachable by name rather than only through
					   the master list. */
					tree: 'areas',
					views: [
						{ id: 'docs/knowledge', label: 'Documents', icon: 'book' }
					]
				},
				{
					label: 'Pipeline',
					views: [
						{ id: 'docs/review', label: 'Review Center', icon: 'check', badge: 17, tone: 'warn' },
						{ id: 'docs/builds', label: 'Build Center', icon: 'play' },
						{ id: 'docs/releases', label: 'Releases', icon: 'upload' }
					]
				}
			]
		},
		{
			id: 'ai',
			label: 'AI Hub',
			icon: 'sparkle',
			defaultView: 'ai/chat',
			sections: [
				{
					label: 'Assistant',
					views: [
						{ id: 'ai/chat', label: 'Chat', icon: 'sparkle' },
						{ id: 'ai/actions', label: 'Actions', icon: 'play' },
						{ id: 'ai/citations', label: 'Citations', icon: 'link' }
					]
				},
				{
					label: 'Runtime',
					views: [
						{ id: 'ai/models', label: 'Local Models', icon: 'chip' },
						{ id: 'ai/knowledge', label: 'Knowledge Base', icon: 'book' }
					]
				}
			]
		},
		{
			id: 'learn',
			label: 'Temco Learn',
			icon: 'graduation',
			defaultView: 'learn/home',
			sections: [
				{
					label: 'Site',
					views: [
						{ id: 'learn/home', label: 'Home', icon: 'home' },
						{ id: 'learn/t3000', label: 'T3000', icon: 'book' },
						{ id: 'learn/article', label: 'Article Preview', icon: 'document' }
					]
				},
				{
					label: 'Delivery',
					views: [
						{ id: 'learn/downloads', label: 'Downloads', icon: 'download' },
						{ id: 'learn/paths', label: 'Learning Paths', icon: 'graduation' }
					]
				}
			]
		},
		{
			id: 'devices',
			label: 'Devices',
			icon: 'chip',
			defaultView: 'devices/all',
			sections: [
				{
					label: 'Fleet',
					views: [
						{ id: 'devices/all', label: 'Devices', icon: 'chip', badge: 34 },
						{ id: 'devices/firmware', label: 'Firmware', icon: 'package' },
						{ id: 'devices/health', label: 'Health & Alarms', icon: 'alert', badge: 4, tone: 'warn' }
					]
				},
				{
					label: 'Data',
					views: [
						{ id: 'devices/schedules', label: 'Schedules', icon: 'clock' },
						{ id: 'devices/trends', label: 'Trend Logs', icon: 'chart' },
						{ id: 'devices/backups', label: 'Backups', icon: 'download' }
					]
				}
			]
		},
		{
			id: 'io',
			label: 'I/O Studio',
			icon: 'plug',
			defaultView: 'io/points',
			sections: [
				{
					label: 'Engineering',
					views: [
						{ id: 'io/points', label: 'Point Browser', icon: 'list' },
						{ id: 'io/mapping', label: 'Mapping', icon: 'link' },
						{ id: 'io/logic', label: 'Logic', icon: 'code' }
					]
				},
				{
					label: 'Live',
					views: [
						{ id: 'io/live', label: 'Live Values', icon: 'activity' },
						{ id: 'io/trends', label: 'Trends', icon: 'chart' }
					]
				}
			]
		},
		{
			id: 'bacnet',
			label: 'BACnet Studio',
			icon: 'building',
			defaultView: 'bacnet/discovery',
			sections: [
				{
					label: 'Network',
					views: [
						{ id: 'bacnet/discovery', label: 'Discovery', icon: 'search' },
						{ id: 'bacnet/objects', label: 'Object Browser', icon: 'list' },
						{ id: 'bacnet/alarms', label: 'Alarms', icon: 'alert', badge: 2, tone: 'warn' }
					]
				},
				{
					label: 'History',
					views: [
						{ id: 'bacnet/trendlogs', label: 'Trend Logs', icon: 'chart' },
						{ id: 'bacnet/schedules', label: 'Schedules', icon: 'clock' }
					]
				}
			]
		},
		{
			id: 'network',
			label: 'Network',
			icon: 'globe',
			defaultView: 'network/discovery',
			sections: [
				{
					label: 'Tools',
					views: [
						{ id: 'network/discovery', label: 'Discovery', icon: 'search' },
						{ id: 'network/modbus', label: 'Modbus Scanner', icon: 'list' },
						{ id: 'network/diagnostics', label: 'Diagnostics', icon: 'activity' }
					]
				},
				{
					label: 'Traffic',
					views: [
						{ id: 'network/captures', label: 'Captures', icon: 'download' }
					]
				}
			]
		},
		{
			id: 'sql',
			label: 'SQL Studio',
			icon: 'database',
			defaultView: 'sql/query',
			/* The database this window actually edits is the documentation registry, so the studio is
			   laid out around it: one place to connect, one to ask, one to look at the shape, one to
			   keep the questions worth asking again. */
			sections: [
				{
					label: 'Workbench',
					views: [
						{ id: 'sql/query', label: 'Query Editor', icon: 'code' },
						{ id: 'sql/connections', label: 'Connections', icon: 'database' },
						{ id: 'sql/history', label: 'History', icon: 'clock' }
					]
				},
				{
					label: 'Docs Database',
					views: [
						{ id: 'sql/schema', label: 'Schema', icon: 'list' },
						{ id: 'sql/saved', label: 'Saved Queries', icon: 'book' },
						{ id: 'sql/reports', label: 'Reports', icon: 'chart', badge: 3 }
					]
				}
			]
		},
		{
			id: 'settings',
			label: 'Settings',
			icon: 'gear',
			defaultView: 'settings/general',
			bottom: true,
			/* Two groups, named the way the other modules name theirs: what follows this person
			   between machines, and what the platform itself is and where it publishes. */
			sections: [
				{
					label: 'Profile',
					views: [
						{ id: 'settings/general', label: 'General', icon: 'gear' },
						{ id: 'settings/ai', label: 'AI Models', icon: 'sparkle' }
					]
				},
				{
					label: 'Platform',
					views: [
						{ id: 'settings/modules', label: 'Modules', icon: 'package', badge: 7 },
						{ id: 'settings/branding', label: 'Branding', icon: 'palette' },
						{ id: 'settings/publishing', label: 'Publishing', icon: 'upload' }
					]
				}
			]
		}
	];

	/* The index the router and the side bar share. */
	M.viewIndex = {};
	M.modules.forEach(function (module) {
		/* A module with one section has no level to distinguish, so nothing in the chrome should
		   name that section: not the side bar, not the breadcrumb. */
		var singleSection = module.sections.length === 1;
		module.sections.forEach(function (section) {
			section.views.forEach(function (view) {
				view.moduleId = module.id;
				view.moduleLabel = module.label;
				view.moduleDefaultView = module.defaultView || section.views[0].id;
				view.sectionLabel = section.label;
				view.sectionFirstView = section.views[0].id;
				view.singleSection = singleSection;
				M.viewIndex[view.id] = view;
			});
		});
	});

	/* A detail surface opens from a list, so it is a tab without a side-bar entry of its own. */
	M.viewIndex['docs/repository'] = {
		id: 'docs/repository',
		label: 'Repository',
		icon: 'repo',
		moduleId: 'docs',
		moduleLabel: 'Documentation',
		moduleDefaultView: 'docs/projects',
		sectionLabel: 'Sources',
		sectionFirstView: 'docs/repositories',
		singleSection: false
	};

	/* The code a read turns into pages. It is evidence, not editable content: a page is changed by
	   an edit and a release, never by changing a source here. */
	M.viewIndex['docs/source'] = {
		id: 'docs/source',
		label: 'Source',
		icon: 'code',
		moduleId: 'docs',
		moduleLabel: 'Documentation',
		moduleDefaultView: 'docs/projects',
		sectionLabel: 'Sources',
		sectionFirstView: 'docs/repositories',
		singleSection: false
	};

	/* One page of the registry, opened from the Knowledge list or from the working set. */
	M.viewIndex['docs/page'] = {
		id: 'docs/page',
		label: 'Page',
		icon: 'document',
		moduleId: 'docs',
		moduleLabel: 'Documentation',
		moduleDefaultView: 'docs/projects',
		sectionLabel: 'Documents',
		sectionFirstView: 'docs/knowledge',
		singleSection: false
	};

	/* ------------------------------------------------------------------ data */

	M.data = {
		user: { name: 'Derek', initials: 'DK', role: 'Controls engineer' },

		workspaces: [
			{ id: 't3000', name: 'T3000', path: '~/Temco/t3000', desc: 'Building automation controller platform', projects: 5, sources: 14, devices: 6, updated: '12 minutes ago', active: true, tone: 'accent' },
			{ id: 't3-bacnet', name: 'T3-BACnet', path: '~/Temco/t3-bacnet', desc: 'BACnet stack and object model', projects: 3, sources: 9, devices: 12, updated: '2 hours ago' },
			{ id: 'temco-learn', name: 'Temco Learn', path: '~/Temco/temco-learn', desc: 'Published documentation site', projects: 2, sources: 6, devices: 0, updated: 'yesterday' },
			{ id: 'legacy', name: 'Legacy Products', path: '~/Temco/legacy', desc: 'T3-8R, T3-22I, T3-LB archives', projects: 4, sources: 11, devices: 8, updated: '4 days ago' }
		],

		/* A template is the shape a project starts with: which areas it opens, how many pages it
		   stubs out, and which artifacts the build produces. It writes nothing until a project uses
		   it, and it never carries content, an owner or a version. */
		templates: [
			{ name: 'Controller Manual', desc: 'Product overview, wiring, points, specifications and troubleshooting.', pages: 48, areas: ['Overview', 'Getting Started', 'Hardware', 'Protocols', 'Troubleshooting'], targets: ['Website', 'PDF'], from: 'written by hand' },
			{ name: 'Protocol Reference', desc: 'Objects, services, conformance and the notes an integrator needs.', pages: 26, areas: ['Overview', 'Architecture', 'Protocols'], targets: ['Website', 'PDF', 'CHM'], from: 'a written outline' },
			{ name: 'API Reference', desc: 'Endpoints, schemas and samples generated from a repository.', pages: 34, areas: ['Overview', 'Getting Started', 'API Reference'], targets: ['Website', 'PDF'], from: 'a repository' },
			{ name: 'Release Notes', desc: 'One page per release, from the commits since the previous tag.', pages: 8, areas: ['Release Notes'], targets: ['Website'], from: 'git tags' }
		],

		kpis: [
			{ label: 'Documentation Projects', value: '12', delta: '+2 this month', meta: '4 need attention' },
			{ label: 'Sources Read', value: '38', delta: '+6', meta: 'repositories · PDF · DOCX' },
			{ label: 'Pages', value: '1,254', delta: '+48', meta: '341 never reviewed' },
			{ label: 'Devices Online', value: '4 / 6', delta: '−1', down: true, meta: 'T3-22I offline 2 h' }
		],

		pipeline: [
			{ n: '01', name: 'Sources', meta: '7 read', view: 'docs/sources', current: false },
			{ n: '02', name: 'Documents', meta: '1,254 pages', view: 'docs/knowledge', current: false },
			{ n: '03', name: 'Review', meta: '17 waiting', view: 'docs/review', current: true },
			{ n: '04', name: 'Build', meta: '4 targets', view: 'docs/builds', current: false },
			{ n: '05', name: 'Publish', meta: '13.0 ready', view: 'docs/releases', current: false },
			{ n: '06', name: 'Temco Learn', meta: 'live', view: 'learn/home', current: false }
		],

		activity: [
			{ module: 'Documentation', icon: 'check', tone: 'ok', title: 'Release 13.0 published to Temco Learn', sub: 't3000 · 1,254 pages', when: 'Just now' },
			{ module: 'AI', icon: 'sparkle', tone: 'accent', title: 'AI drafted 8 page updates', sub: 'Data Points API · waiting for review', when: '26 min ago' },
			{ module: 'Documentation', icon: 'repo', tone: 'info', title: 'Source t3000webview read', sub: '412 files · 3 new pages found', when: '1 hr ago' },
			{ module: 'Devices', icon: 'alert', tone: 'warn', title: 'T3-22I stopped reporting', sub: 'Device health', when: '2 hr ago' }
		],

		/* The review queue, in the order it is worked: the two errors that stop a release first, then
		   the pages a person has to make a decision about, then the AI drafts. 17 pages, which is
		   the number the pipeline and the workspace tiles quote. */
		needs: [
			{ title: 'Data Points API', where: 't3000 › api-reference', issue: 'Order 20 is used by more than one page', kind: 'err', age: '14 months' },
			{ title: 'BACnet Object Model', where: 't3-bacnet › concepts', issue: 'Missing 3 object types', kind: 'err', age: '2 months' },
			{ title: 'Time Schedules', where: 't3000 › schedules', issue: 'No owner assigned', kind: 'warn', age: '11 months' },
			{ title: 'T3-8R Wiring', where: 't3000 › hardware', issue: 'Screenshot from firmware 2.9, current is 2.14', kind: 'warn', age: '9 months' },
			{ title: 'Getting Started', where: 't3000 › overview', issue: 'No owner assigned', kind: 'warn', age: '6 months' },
			{ title: 'User Accounts', where: 't3000 › security', issue: 'Missing the sections the template requires', kind: 'warn', age: '5 months' },
			{ title: 'T3-8R Datasheet', where: 't3000 › hardware', issue: 'References the 2.9 pinout', kind: 'warn', age: '4 months' },
			{ title: 'Screen Designer', where: 't3000 › ui', issue: 'Broken image on "Toolbar"', kind: 'warn', age: '1 month' },
			{ title: 'Trend Log Retention', where: 't3000 › trends', issue: 'Broken link to /help/retention', kind: 'warn', age: '3 weeks' },
			{ title: 'Network Settings', where: 't3000 › network', issue: 'Broken link to /help/ip-config', kind: 'warn', age: '2 weeks' },
			{ title: 'Modbus Register Map', where: 't3000 › protocols', issue: 'Never reviewed', kind: 'warn', age: '—' },
			{ title: 'Point Types', where: 't3000 › protocols', issue: 'AI draft pending', kind: 'info', age: '3 days' },
			{ title: 'Firmware Upgrade', where: 't3000 › firmware', issue: 'AI draft pending', kind: 'info', age: '2 days' },
			{ title: 'Alarm Routing', where: 't3000 › alarms', issue: 'AI draft pending since yesterday', kind: 'info', age: '1 day' },
			{ title: 'Alarm Limits', where: 't3000 › alarms', issue: 'AI draft waiting for review', kind: 'info', age: '1 day' },
			{ title: 'BACnet Object Types', where: 't3-bacnet › concepts', issue: 'AI draft rewritten from v1.4', kind: 'info', age: '6 hours' },
			{ title: 'Trend Logs', where: 't3000 › trends', issue: 'AI draft updated 4 tables', kind: 'info', age: '4 hours' }
		],

		docsProjects: [
			{ name: 'T3000 Documentation', version: '13.0', audience: 'Integrators and installers', pages: 1254, sources: 14, owner: 'Derek', state: 'In review', tone: 'warn', updated: '12 minutes ago' },
			{ name: 'T3-BACnet Reference', version: '4.2', audience: 'BACnet integrators', pages: 186, sources: 6, owner: 'Mei', state: 'Published', tone: 'ok', updated: '2 days ago' },
			{ name: 'T3-8R Hardware Guide', version: '2.1', audience: 'Installers and service technicians', pages: 74, sources: 4, owner: 'Derek', state: 'Draft', tone: 'neutral', updated: '5 days ago' },
			{ name: 'Temco SDK', version: '1.4', audience: 'Application developers', pages: 100, sources: 8, owner: 'Ana', state: 'Published', tone: 'ok', updated: '1 week ago' }
		],

		/* `pages` is what a read found, 0 when nothing has been read. Seven sources is the count every
		   surface quotes for this project: the pipeline stage, the health scan, the toolbar, the output
		   line and the command palette. */
		sources: [
			{ name: 't3000webview', kind: 'Repository', detail: 'main · 412 files', state: 'Read', tone: 'ok', pages: 138, when: '1 hour ago' },
			{ name: 't3000-esp', kind: 'Repository', detail: 'main · 268 files', state: 'Read', tone: 'ok', pages: 64, when: '3 hours ago' },
			{ name: 'bacnet-stack', kind: 'Repository', detail: 'v1.4 · 1,204 files', state: 'Read', tone: 'ok', pages: 52, when: 'yesterday' },
			{ name: 'BACnet Protocol Guide.pdf', kind: 'PDF', detail: '248 pages · 6.2 MB', state: 'Read', tone: 'ok', pages: 31, when: 'yesterday' },
			{ name: 'T3000 User Manual.docx', kind: 'DOCX', detail: '94 pages · 2.1 MB', state: 'Changed', tone: 'warn', pages: 0, when: '4 days ago' },
			{ name: 'SharePoint · Field Notes', kind: 'SharePoint', detail: 'Connected · 3 libraries', state: 'Not read', tone: 'neutral', pages: 0, when: 'never' },
			{ name: 'LegacyDocs', kind: 'Folder', detail: '~/Temco/LegacyDocs', state: 'Partial', tone: 'warn', pages: 18, when: '2 weeks ago' }
		],

		/* `temco` marks the repositories Temco itself publishes under github.com/temcocontrols —
		   the ones the platform ships documentation for. Everything else is read as a third party. */
		repositories: [
			{ name: 't3000webview', remote: 'github.com/temcocontrols/t3000webview', temco: true, branch: 'main', branches: 4, branchNames: ['main', 't3000', 'release/13.0', 'feature/web-ui'], head: '4de5eda', docs: 'docs/help', state: 'Cloned', tone: 'ok', files: 412, pages: 138, size: '48 MB', read: '1 hour ago', owner: 'Derek', scripts: [{ name: 'docs:registry', note: 'writes docs/help/registry.json' }, { name: 'docs:build', note: 'builds the site into .temco/build' }, { name: 'docs:check', note: 'structural checks, no writes' }] },
			{ name: 't3000-esp', remote: 'github.com/temcocontrols/t3000-esp', temco: true, branch: 'main', branches: 2, branchNames: ['main', 'feature/ota'], head: 'c41f002', docs: 'docs', state: 'Cloned', tone: 'ok', files: 268, pages: 64, size: '22 MB', read: '3 hours ago', owner: 'Mei', scripts: [{ name: 'docs:read', note: 'writes docs/index.json' }] },
			{ name: 'temco-learn', remote: 'github.com/temcocontrols/temco-learn', temco: true, branch: 'main', branches: 3, branchNames: [], head: '—', docs: 'content', state: 'Not cloned', tone: 'neutral', files: 0, pages: 0, size: '—', read: 'never', owner: '—', scripts: [] },
			{ name: 'bacnet-stack', remote: 'github.com/bacnet-stack/bacnet-stack', temco: false, branch: 'v1.4', branches: 4, branchNames: ['v1.4', 'master', 'release/1.3', 'feature/sc'], head: '9b21c04', docs: 'doc', state: 'Cloned', tone: 'ok', files: 1204, pages: 52, size: '96 MB', read: 'yesterday', owner: 'Ana', scripts: [] },
		],

		/* The files a read turned into pages, and the code an AI draft is asked to work from. */
		sourceFiles: [
			{ path: 'src/api/points.ts', role: 'the endpoints the API Reference documents', lines: 412, lang: 'TypeScript' },
			{ path: 'src/api/point-types.ts', role: 'the point type table and its scale factors', lines: 168, lang: 'TypeScript' },
			{ path: 'src/web/point-table/point-table.component.ts', role: 'what the screenshots on the page show', lines: 640, lang: 'TypeScript' },
			{ path: 'src/models/point.model.ts', role: 'the schema the page quotes', lines: 96, lang: 'TypeScript' },
			{ path: 'docs/scale-factor.md', role: 'a page written by hand, not generated', lines: 54, lang: 'Markdown' },
			{ path: 'README.md', role: 'the overview page', lines: 88, lang: 'Markdown' }
		],

		sourceCode: [
			'/* t3000webview · src/api/points.ts · read 1 hour ago at 4de5eda */',
			'',
			'export interface Point {',
			'  id: string;          // AI1, AO2, DI1 ...',
			'  label: string;',
			'  type: "AI" | "AO" | "DI" | "DO" | "AV" | "BV";',
			'  raw: number;         // what the controller stores',
			'  scale: number;       // engineering value = raw * scale + offset',
			'  offset: number;',
			'  unit: string;',
			'}',
			'',
			'/** Every point on a device. */',
			'export async function listPoints(deviceId: string): Promise<Point[]> {',
			'  const response = await fetch("/api/devices/" + deviceId + "/points");',
			'  if (!response.ok) {',
			'    throw new Error("GET /api/devices/" + deviceId + "/points -> " + response.status);',
			'  }',
			'  return response.json();',
			'}'
		],

		reads: [
			{ repo: 't3000webview', branch: 'main', commit: '4de5eda', when: '1 hour ago', pages: 138, added: 12, changed: 4, removed: 0 },
			{ repo: 't3000webview', branch: 'main', commit: 'b968a0f', when: 'yesterday', pages: 134, added: 3, changed: 9, removed: 1 },
			{ repo: 't3000webview', branch: 't3000', commit: '10e23fb', when: '3 days ago', pages: 131, added: 0, changed: 2, removed: 0 },
			{ repo: 't3000-esp', branch: 'main', commit: 'c41f002', when: '3 hours ago', pages: 64, added: 5, changed: 0, removed: 2 }
		],

		/* `reviewed` counts pages a person signed off; `stale` counts pages whose source moved after
		   they were written. The two are independent, so reviewed + stale is not the page count: an
		   area can be fully reviewed and still stale. Totals: 1,254 pages, 913 reviewed, 89 stale. */
		knowledge: [
			{ area: 'Overview', pages: 24, reviewed: 24, stale: 0, desc: 'What the platform is, in one sitting' },
			{ area: 'Getting Started', pages: 56, reviewed: 47, stale: 3, desc: 'Install, connect, and a first point that answers' },
			{ area: 'Architecture', pages: 92, reviewed: 82, stale: 3, desc: 'How the controller, the points and the schedules fit' },
			{ area: 'API Reference', pages: 402, reviewed: 194, stale: 45, desc: 'Endpoints, schemas and the scale factor of every type' },
			{ area: 'Hardware', pages: 208, reviewed: 186, stale: 6, desc: 'Controllers, terminals, power and wiring diagrams' },
			{ area: 'Protocols', pages: 268, reviewed: 196, stale: 25, desc: 'Modbus, BACnet and MSTP, with worked examples' },
			{ area: 'Troubleshooting', pages: 148, reviewed: 128, stale: 7, desc: 'The failures people actually call about' },
			{ area: 'Release Notes', pages: 56, reviewed: 56, stale: 0, desc: 'What changed, version by version' }
		],

		/* The pages of each area, so picking an area on the Knowledge page shows its own registry
		   instead of a fixed example. `order` is the page order inside the area, not a file line. */
		areaPages: {
			'Overview': [
				{ order: 1, page: 'What T3000 Is', state: 'Reviewed', tone: 'ok', owner: 'Derek', changed: '3 weeks ago' },
				{ order: 2, page: 'Product Lineup', state: 'Reviewed', tone: 'ok', owner: 'Derek', changed: '3 weeks ago' },
				{ order: 3, page: 'Getting Help', state: 'Reviewed', tone: 'ok', owner: 'Mei', changed: '2 months ago' }
			],
			'Getting Started': [
				{ order: 1, page: 'Install T3000', state: 'Reviewed', tone: 'ok', owner: 'Mei', changed: '2 weeks ago' },
				{ order: 2, page: 'First Connection', state: 'Reviewed', tone: 'ok', owner: 'Mei', changed: '2 weeks ago' },
				{ order: 3, page: 'Licensing', state: 'Stale', tone: 'warn', owner: 'Ana', changed: '5 months ago' },
				{ order: 4, page: 'Uninstall', state: 'Draft', tone: 'info', owner: '—', changed: 'yesterday' }
			],
			'Architecture': [
				{ order: 1, page: 'Controller Model', state: 'Reviewed', tone: 'ok', owner: 'Derek', changed: '1 month ago' },
				{ order: 2, page: 'Point Engine', state: 'Reviewed', tone: 'ok', owner: 'Derek', changed: '1 month ago' },
				{ order: 3, page: 'Data Flow', state: 'Stale', tone: 'warn', owner: 'Mei', changed: '4 months ago' }
			],
			'API Reference': [
				{ order: 18, page: 'Points and Properties', state: 'Reviewed', tone: 'ok', owner: 'Mei', changed: '2 weeks ago' },
				{ order: 19, page: 'Reading a Point', state: 'Reviewed', tone: 'ok', owner: 'Mei', changed: '2 weeks ago' },
				{ order: 20, page: 'Data Points API', state: 'Conflict', tone: 'err', owner: 'Derek', changed: '3 hours ago' },
				{ order: 20, page: 'Data Points API (duplicate)', state: 'Duplicate', tone: 'err', owner: '—', changed: '14 months ago' },
				{ order: 21, page: 'Writing a Point', state: 'Stale', tone: 'warn', owner: 'Derek', changed: '9 months ago' },
				{ order: 22, page: 'Point Types', state: 'Draft', tone: 'info', owner: 'Ana', changed: 'yesterday' }
			],
			'Hardware': [
				{ order: 1, page: 'T3-8R Wiring', state: 'Stale', tone: 'warn', owner: 'Derek', changed: '9 months ago' },
				{ order: 2, page: 'Terminal Layout', state: 'Reviewed', tone: 'ok', owner: 'Derek', changed: '3 weeks ago' },
				{ order: 3, page: 'Power Requirements', state: 'Reviewed', tone: 'ok', owner: 'Ana', changed: '1 month ago' }
			],
			'Protocols': [
				{ order: 1, page: 'Modbus Register Map', state: 'Stale', tone: 'warn', owner: 'Derek', changed: '6 months ago' },
				{ order: 2, page: 'BACnet Object Model', state: 'Conflict', tone: 'err', owner: '—', changed: '2 months ago' },
				{ order: 3, page: 'MSTP Addressing', state: 'Reviewed', tone: 'ok', owner: 'Ana', changed: '3 weeks ago' }
			],
			'Troubleshooting': [
				{ order: 1, page: 'Controller Offline', state: 'Reviewed', tone: 'ok', owner: 'Mei', changed: '2 weeks ago' },
				{ order: 2, page: 'Sensor Drift', state: 'Reviewed', tone: 'ok', owner: 'Mei', changed: '1 month ago' },
				{ order: 3, page: 'Comm Timeouts', state: 'Stale', tone: 'warn', owner: 'Ana', changed: '7 months ago' }
			],
			'Release Notes': [
				{ order: 1, page: '13.0', state: 'Draft', tone: 'info', owner: 'Derek', changed: '2 hours ago' },
				{ order: 2, page: '12.9', state: 'Reviewed', tone: 'ok', owner: 'Derek', changed: '3 weeks ago' },
				{ order: 3, page: '12.8', state: 'Reviewed', tone: 'ok', owner: 'Derek', changed: '3 months ago' }
			]
		},

		/* What the coverage report checks besides coverage itself. `found: 0` is a pass. */
		healthChecks: [
			{ name: 'Internal links', found: 12, tone: 'warn', detail: '12 of 1,266 links point at a page that no longer exists', view: 'docs/knowledge' },
			{ name: 'Screenshots older than the firmware', found: 7, tone: 'warn', detail: '7 images show a UI from before 2.9', view: 'dashboard/needs' },
			{ name: 'Pages with no owner', found: 4, tone: 'warn', detail: 'Nobody is told when these go stale', view: 'dashboard/needs' },
			{ name: 'Duplicate order keys', found: 1, tone: 'warn', detail: 'Two pages claim order 20 in API Reference', view: 'dashboard/needs' },
			{ name: 'Orphan pages', found: 0, tone: 'ok', detail: 'Every page is reachable from a landing page' },
			{ name: 'Missing alt text', found: 0, tone: 'ok', detail: 'Every image has a description' },
			{ name: 'Empty areas', found: 0, tone: 'ok', detail: 'Every area has at least one page' }
		],

		reviews: [
			{ page: 'Data Points API', area: 'api-reference', author: 'AI draft', kind: 'Draft', tone: 'info', changes: '+42 −8', reviewer: '—', age: '26 m' },
			{ page: 'Trend Log Retention', area: 'trends', author: 'Mei', kind: 'Edit', tone: 'neutral', changes: '+12 −4', reviewer: 'Derek', age: '1 h' },
			{ page: 'T3-8R Wiring', area: 'hardware', author: 'AI draft', kind: 'Draft', tone: 'info', changes: '+88 −31', reviewer: '—', age: '3 h' },
			{ page: 'BACnet Object Types', area: 'concepts', author: 'Ana', kind: 'New page', tone: 'ok', changes: '+210', reviewer: 'Mei', age: '5 h' },
			{ page: 'Modbus Register Map', area: 'protocols', author: 'Derek', kind: 'Edit', tone: 'neutral', changes: '+6 −2', reviewer: '—', age: 'yesterday' },
			{ page: 'Alarm Routing', area: 'alarms', author: 'AI draft', kind: 'Draft', tone: 'info', changes: '+54 −12', reviewer: 'Derek', age: 'yesterday' }
		],

		builds: [
			{ target: 'Website', detail: '1,254 pages · static', state: 'Succeeded', tone: 'ok', pct: 100, time: '1 m 42 s' },
			{ target: 'PDF', detail: '1,254 pages · 6.2 MB', state: 'Succeeded', tone: 'ok', pct: 100, time: '4 m 08 s' },
			{ target: 'Offline Help (CHM)', detail: '1,254 topics · 18.4 MB', state: 'Running', tone: 'info', pct: 62, time: '2 m 51 s' },
			{ target: 'Search Index', detail: 'lunr · 12,884 terms', state: 'Queued', tone: 'neutral', pct: 0, time: '—' },
			{ target: 'AI Index', detail: 'embeddings · 1,254 chunks', state: 'Queued', tone: 'neutral', pct: 0, time: '—' }
		],

		buildLog: [
			'[12:04:11] Temco Docs build 13.0.482',
			'[12:04:11] project: T3000 Documentation (13.0)',
			'[12:04:12] sources: 14 read, 1 changed (T3000 User Manual.docx)',
			'[12:04:18] knowledge: 1,254 pages, 3,412 links',
			'[12:04:19] check: 12 issues (2 errors, 10 warnings)',
			'[12:04:24] website: 1,254 pages -> .temco/build/site',
			'[12:06:02] pdf: 1254 pages -> .temco/build/t3000-13.0.pdf',
			'[12:08:53] chm: 612 of 1,254 topics',
			'[12:08:53] waiting for the help compiler...'
		],

		releases: [
			{ version: '13.0', date: 'Today', pages: 1254, artifacts: 'Website · PDF · CHM · ZIP', state: 'Publishing', tone: 'info' },
			{ version: '12.9', date: '12 Sep', pages: 1211, artifacts: 'Website · PDF · CHM', state: 'Published', tone: 'ok' },
			{ version: '12.8', date: '24 Jul', pages: 1188, artifacts: 'Website · PDF', state: 'Published', tone: 'ok' },
			{ version: '12.7', date: '02 Jun', pages: 1140, artifacts: 'Website · PDF', state: 'Archived', tone: 'neutral' }
		],

		devices: [
			{ serial: 2371, name: 'T3-BB · AHU-1', product: 'T3-BB', ip: '192.168.10.21', status: 'Online', firmware: '2.14.3', points: 96, alarms: 1, last: 'just now' },
			{ serial: 2372, name: 'T3-8R · Boiler Room', product: 'T3-8R', ip: '192.168.10.22', status: 'Online', firmware: '2.14.3', points: 48, alarms: 0, last: '8 s ago' },
			{ serial: 2388, name: 'T3-22I · Lab Wing', product: 'T3-22I', ip: '192.168.10.31', status: 'Offline', firmware: '2.12.1', points: 22, alarms: 2, last: '2 h ago' },
			{ serial: 2401, name: 'T3-NC · Chiller', product: 'T3-NC', ip: '192.168.10.35', status: 'Online', firmware: '2.14.1', points: 64, alarms: 0, last: '12 s ago' },
			{ serial: 2402, name: 'T3-LB · Lighting', product: 'T3-LB', ip: '192.168.10.41', status: 'Online', firmware: '2.14.3', points: 40, alarms: 1, last: '3 s ago' },
			{ serial: 2410, name: 'T3-EXP · Floor 2', product: 'T3-EXP', ip: '192.168.10.42', status: 'Warning', firmware: '2.13.7', points: 32, alarms: 1, last: '45 s ago' }
		],

		firmware: [
			{ version: '2.14.3', channel: 'Stable', devices: 21, size: '3.8 MB', released: '2 weeks ago', state: 'Current', tone: 'ok' },
			{ version: '2.14.1', channel: 'Stable', devices: 6, size: '3.8 MB', released: '1 month ago', state: 'Update available', tone: 'warn' },
			{ version: '2.15.0-rc2', channel: 'Preview', devices: 0, size: '3.9 MB', released: '3 days ago', state: 'Not staged', tone: 'neutral' }
		],

		points: [
			{ id: 'AI1', label: 'Supply Air Temp', type: 'AI', unit: '°C', value: '18.4', range: '0 – 50', trend: 'Analog Input', state: 'ok' },
			{ id: 'AI2', label: 'Return Air Temp', type: 'AI', unit: '°C', value: '22.1', range: '0 – 50', trend: 'Analog Input', state: 'ok' },
			{ id: 'AI3', label: 'Humidity', type: 'AI', unit: '%RH', value: '46.8', range: '0 – 100', trend: 'Analog Input', state: 'ok' },
			{ id: 'AO1', label: 'Valve Position', type: 'AO', unit: '%', value: '38.5', range: '0 – 100', trend: 'Analog Output', state: 'ok' },
			{ id: 'AO2', label: 'Fan Speed', type: 'AO', unit: '%', value: '62.0', range: '0 – 100', trend: 'Analog Output', state: 'ok' },
			{ id: 'DI1', label: 'Filter Status', type: 'DI', unit: '—', value: 'Normal', range: 'Open / Closed', trend: 'Digital Input', state: 'warn' },
			{ id: 'DO1', label: 'Alarm Relay', type: 'DO', unit: '—', value: 'Off', range: 'On / Off', trend: 'Digital Output', state: 'ok' }
		],

		mappings: [
			{ source: 'AI1 · Supply Air Temp', target: 'AV-101 · SAT', scale: '×1.0 + 0', state: 'Mapped', tone: 'ok' },
			{ source: 'AI2 · Return Air Temp', target: 'AV-102 · RAT', scale: '×1.0 + 0', state: 'Mapped', tone: 'ok' },
			{ source: 'AO1 · Valve Position', target: 'BO-11 · Heat Valve', scale: '×1.0 + 0', state: 'Mapped', tone: 'ok' },
			{ source: 'DI1 · Filter Status', target: 'BV-31 · Filter Alarm', scale: '—', state: 'Needs review', tone: 'warn' },
			{ source: 'AI3 · Humidity', target: '—', scale: '—', state: 'Unmapped', tone: 'neutral' }
		],

		bacnetObjects: [
			{ instance: 'AV-101', type: 'Analog Value', name: 'Supply Air Temp', units: '°C', value: '18.4', flags: '—' },
			{ instance: 'AV-102', type: 'Analog Value', name: 'Return Air Temp', units: '°C', value: '22.1', flags: '—' },
			{ instance: 'AV-103', type: 'Analog Value', name: 'Valve Position', units: '%', value: '38.5', flags: '—' },
			{ instance: 'BV-31', type: 'Binary Value', name: 'Filter Alarm', units: '—', value: 'Inactive', flags: 'Fault' },
			{ instance: 'MSV-7', type: 'Multi-state Value', name: 'Occupancy Mode', units: '—', value: 'Occupied', flags: '—' },
			{ instance: 'SCH-1', type: 'Schedule', name: 'Weekday Schedule', units: '—', value: 'Active', flags: '—' },
			{ instance: 'TL-4', type: 'Trend Log', name: 'AHU-1 Temperatures', units: '°C', value: '1,882 samples', flags: '—' }
		],

		alarms: [
			{ time: '12:41', device: 'T3-22I · Lab Wing', message: 'Device not responding (2 h)', priority: 'High', state: 'Active', tone: 'err' },
			{ time: '11:58', device: 'T3-EXP · Floor 2', message: 'Sensor fault · AI3 open circuit', priority: 'Medium', state: 'Active', tone: 'warn' },
			{ time: '10:12', device: 'T3-BB · AHU-1', message: 'Filter differential above limit', priority: 'Low', state: 'Acknowledged', tone: 'neutral' },
			{ time: '09:04', device: 'T3-LB · Lighting', message: 'Schedule override applied', priority: 'Low', state: 'Cleared', tone: 'ok' }
		],

		hosts: [
			{ ip: '192.168.10.21', mac: '00:0C:5A:11:22:33', name: 'T3-BB', vendor: 'Temco', protocol: 'BACnet/IP', state: 'Online', tone: 'ok' },
			{ ip: '192.168.10.22', mac: '00:0C:5A:11:22:34', name: 'T3-8R', vendor: 'Temco', protocol: 'BACnet/IP', state: 'Online', tone: 'ok' },
			{ ip: '192.168.10.31', mac: '00:0C:5A:11:22:41', name: 'T3-22I', vendor: 'Temco', protocol: 'BACnet/IP', state: 'Unreachable', tone: 'err' },
			{ ip: '192.168.10.50', mac: '00:1D:9C:44:11:02', name: 'Modbus Gateway', vendor: 'Moxa', protocol: 'Modbus TCP', state: 'Online', tone: 'ok' },
			{ ip: '192.168.10.77', mac: 'A4:BB:6D:01:9F:12', name: 'Workstation', vendor: 'Dell', protocol: '—', state: 'Online', tone: 'ok' }
		],

		/* SQL Studio is about the documentation registry: this window edits one database, and every
		   page of the module is a view of it. */
		connections: [
			{ name: 'Temco Docs', kind: 'SQLite', host: '~/Temco/t3000/.temco/docs.db', database: 'temco_docs', state: 'Connected', tone: 'ok', role: 'The registry this window edits', access: 'Read and write' },
			{ name: 'Temco Docs · snapshot', kind: 'SQLite', host: '~/Temco/t3000/.temco/docs.2026-10-17.db', database: 'temco_docs', state: 'Idle', tone: 'warn', role: 'What the last build read', access: 'Read-only' },
			{ name: 'Build history', kind: 'PostgreSQL', host: 'reports.temco.local', database: 'builds', state: 'Idle', tone: 'warn', role: 'Timings of every build, kept off the registry', access: 'Read-only' }
		],

		/* The tables of `temco_docs`, in the order a reader learns them. */
		sqlTables: [
			{ name: 'pages', rows: 1254, key: 'id', note: 'One row per page. `order_key` is unique inside an area.' },
			{ name: 'areas', rows: 8, key: 'id', note: 'The eight knowledge areas and their coverage counters.' },
			{ name: 'sources', rows: 7, key: 'id', note: 'Repositories, documents and folders a read pulls pages from.' },
			{ name: 'links', rows: 3412, key: 'id', note: 'Every internal link, resolved against `pages.slug`.' },
			{ name: 'reviews', rows: 6, key: 'id', note: 'Something waiting for a person: an edit, a draft, a new page.' },
			{ name: 'builds', rows: 5, key: 'id', note: 'One row per artifact of the last build.' },
			{ name: 'releases', rows: 4, key: 'id', note: 'Published versions, newest first.' },
			{ name: 'citations', rows: 4, key: 'id', note: 'What an AI answer cited, and where it is used.' },
			{ name: 'checks', rows: 7, key: 'id', note: 'The health checks the build runs, with the count each found.' }
		],

		/* The columns of `pages`, which is the table everything else joins to. */
		sqlColumns: [
			{ name: 'id', type: 'TEXT', nullable: 'no', note: 'Slug-shaped, stable across renames' },
			{ name: 'area_id', type: 'INTEGER', nullable: 'no', note: '→ areas.id' },
			{ name: 'order_key', type: 'INTEGER', nullable: 'no', note: 'Unique per area — duplicate 20 is the error the build reports' },
			{ name: 'title', type: 'TEXT', nullable: 'no', note: '' },
			{ name: 'owner', type: 'TEXT', nullable: 'yes', note: 'Null means nobody is told when it goes stale' },
			{ name: 'state', type: 'TEXT', nullable: 'no', note: 'draft · in-review · published · stale' },
			{ name: 'source_id', type: 'INTEGER', nullable: 'yes', note: '→ sources.id, null for a page written by hand' },
			{ name: 'reviewed_at', type: 'TEXT', nullable: 'yes', note: 'Null until a person signs it off' },
			{ name: 'updated_at', type: 'TEXT', nullable: 'no', note: '' }
		],

		sqlQueries: [
			{ name: 'Stale pages by area', rows: 89, ms: 18, run: '4 minutes ago', sql: "SELECT a.name AS area, count(*) AS stale\nFROM pages p JOIN areas a ON a.id = p.area_id\nWHERE p.state = 'stale'\nGROUP BY a.name\nORDER BY stale DESC;" },
			{ name: 'Pages with no owner', rows: 4, ms: 6, run: 'yesterday', sql: "SELECT id, title, area_id\nFROM pages\nWHERE owner IS NULL\nORDER BY area_id, order_key;" },
			{ name: 'Duplicate order keys', rows: 2, ms: 11, run: 'yesterday', sql: "SELECT area_id, order_key, count(*) AS n\nFROM pages\nGROUP BY area_id, order_key\nHAVING n > 1;" },
			{ name: 'Broken internal links', rows: 12, ms: 34, run: '2 days ago', sql: "SELECT l.page_id, l.target\nFROM links l LEFT JOIN pages p ON p.slug = l.target\nWHERE p.id IS NULL;" },
			{ name: 'Never reviewed', rows: 341, ms: 52, run: 'never', sql: "SELECT id, title, updated_at\nFROM pages\nWHERE reviewed_at IS NULL\nORDER BY updated_at\nLIMIT 100;" }
		],

		sqlHistory: [
			{ time: '12:41', statement: 'SELECT area, stale FROM v_stale_by_area ORDER BY stale DESC', rows: 8, ms: 18, state: 'ok' },
			{ time: '11:58', statement: 'SELECT count(*) FROM pages WHERE reviewed_at IS NULL', rows: 1, ms: 6, state: 'ok' },
			{ time: '11:20', statement: "UPDATE pages SET owner = 'Derek' WHERE id = 'api-reference/data-points'", rows: 0, ms: 0, state: 'err' },
			{ time: '09:04', statement: 'SELECT * FROM reviews ORDER BY created_at DESC', rows: 6, ms: 9, state: 'ok' },
			{ time: '08:31', statement: 'EXPLAIN SELECT a.name, count(*) FROM pages p JOIN areas a ON a.id = p.area_id GROUP BY a.name', rows: 4, ms: 2, state: 'ok' }
		],

		reports: [
			{ name: 'Coverage by area', desc: 'Pages, reviewed and stale per area — the numbers the Coverage page shows', updated: '4 minutes ago', view: 'dashboard/health' },
			{ name: 'Release readiness', desc: 'What still blocks 13.0: errors, unowned pages, unreviewed pages', updated: '12 minutes ago', view: 'docs/releases' },
			{ name: 'What each source contributed', desc: 'Files and pages per repository, document and folder', updated: 'yesterday', view: 'docs/sources' }
		],

		queryRows: [
			{ id: 2371, name: 'T3-BB · AHU-1', product: 'T3-BB', firmware: '2.14.3', online: '1', updated: '2026-10-17 12:41:02' },
			{ id: 2372, name: 'T3-8R · Boiler Room', product: 'T3-8R', firmware: '2.14.3', online: '1', updated: '2026-10-17 12:41:05' },
			{ id: 2388, name: 'T3-22I · Lab Wing', product: 'T3-22I', firmware: '2.12.1', online: '0', updated: '2026-10-17 10:38:44' },
			{ id: 2401, name: 'T3-NC · Chiller', product: 'T3-NC', firmware: '2.14.1', online: '1', updated: '2026-10-17 12:41:01' },
			{ id: 2402, name: 'T3-LB · Lighting', product: 'T3-LB', firmware: '2.14.3', online: '1', updated: '2026-10-17 12:41:03' }
		],


		aiModels: [
			{ name: 'qwen2.5-3b-instruct', kind: 'Chat', size: '1.9 GB', state: 'Loaded', tone: 'ok', ctx: '32k' },
			{ name: 'nomic-embed-text', kind: 'Embedding', size: '274 MB', state: 'Loaded', tone: 'ok', ctx: '8k' },
			{ name: 'phi-3-mini-4k', kind: 'Chat', size: '2.2 GB', state: 'Not loaded', tone: 'neutral', ctx: '4k' },
			{ name: 'temco-docs-1.4b', kind: 'Chat · fine-tune', size: '840 MB', state: 'Not loaded', tone: 'neutral', ctx: '16k' }
		],

		aiActions: [
			{ name: 'Draft a page update', desc: 'Rewrites the open page against the registry and its sources', state: 'Enabled', tone: 'ok' },
			{ name: 'Ask this area', desc: 'Answers from the whole area, with citations', state: 'Enabled', tone: 'ok' },
			{ name: 'Find knowledge gaps', desc: 'Lists topics the sources mention but no page covers', state: 'Enabled', tone: 'ok' },
			{ name: 'Generate release notes', desc: 'Summarises commits since the last release', state: 'Needs a model', tone: 'warn' },
			{ name: 'Summarise a device log', desc: 'Reads trend and alarm history for one device', state: 'Enabled', tone: 'ok' }
		],

		citations: [
			{ title: 'Data Points API', where: 't3000 › api-reference › data-points', kind: 'page', usedIn: 'Answer · 26 m ago' },
			{ title: 'Point object', where: 'bacnet-stack › src/bacnet/point.h', kind: 'source', usedIn: 'Draft · 1 h ago' },
			{ title: 'T3000 User Manual.pdf', where: 'page 148 · §7.3', kind: 'document', usedIn: 'Answer · 26 m ago' },
			{ title: 'Trend Log Retention', where: 't3000 › trends › retention', kind: 'page', usedIn: 'Suggestion · 3 h ago' }
		],

		learnProducts: [
			{ id: 't3000', name: 'T3000', desc: 'The controller platform: hardware, points, programs and the web UI', version: '13.0', pages: 1254 },
			{ id: 'bacnet', name: 'BACnet', desc: 'Protocol reference, object model and conformance', version: '4.2', pages: 186 },
			{ id: 'devices', name: 'Devices', desc: 'Every T3 controller, its wiring and its specifications', version: '2.14', pages: 94 },
			{ id: 'sdk', name: 'SDK', desc: 'Build on the platform: APIs, schemas and samples', version: '1.4', pages: 80 }
		],

		/* The offline artifacts the site offers. `version` and `date` belong to the release, so the
		   Downloads page can group by them instead of repeating the product on every row. */
		downloads: [
			{ name: 'T3000 Documentation', version: '13.0', format: 'PDF', size: '6.2 MB', date: 'Today', state: 'Ready', tone: 'ok' },
			{ name: 'T3000 Documentation', version: '13.0', format: 'CHM', size: '—', date: 'Today', state: 'Building', tone: 'info' },
			{ name: 'T3000 Documentation', version: '12.9', format: 'PDF', size: '6.0 MB', date: '12 Sep', state: 'Ready', tone: 'ok' },
			{ name: 'T3000 Documentation', version: '12.9', format: 'ZIP', size: '18.2 MB', date: '12 Sep', state: 'Ready', tone: 'ok' },
			{ name: 'T3-BACnet Reference', version: '4.2', format: 'PDF', size: '1.8 MB', date: '2 days ago', state: 'Ready', tone: 'ok' }
		],

		learnPaths: [
			{ name: 'Commission a T3 controller', level: 'Beginner', steps: 6, minutes: 55, desc: 'From unboxing to a device that answers on the network.', outline: ['Mount and wire the controller', 'Set the IP and add it to the platform', 'Name the first points'] },
			{ name: 'Design a control strategy', level: 'Intermediate', steps: 9, minutes: 130, desc: 'Points, programs, schedules and the logic behind them.', outline: ['Choose point types and scaling', 'Write the program', 'Schedule the setpoints'] },
			{ name: 'Write a BACnet integration', level: 'Advanced', steps: 11, minutes: 210, desc: 'Objects, services, alarms and trend logs across vendors.', outline: ['Map objects to points', 'Read a foreign device', 'Route alarms to the platform'] }
		],

		/* The module register, as `docs/temco-platform/modules/README.md` states it: seven active modules
		   that ship with the platform, and four reserved ones whose folders hold a README only. A module
		   is never installed, removed or updated from the window. */
		modules: [
			{ name: 'Temco Workbench', id: 'temcocontrols.temco-workbench', namespace: 'temcoWorkbench', state: 'Active', owns: 'The application\u2019s own surfaces: the Library, the dashboard, what needs doing', surface: 'dashboard/overview' },
			{ name: 'Temco UI', id: 'temcocontrols.temco-ui', namespace: 'temcoUi', state: 'Active', owns: 'Where a page of ours opens, and what a command argument means' },
			{ name: 'Temco Store', id: 'temcocontrols.temco-store', namespace: 'temcoStore', state: 'Active', owns: 'The platform\u2019s own memory: the catalog, the selection, the naming rules' },
			{ name: 'Temco Docs', id: 'temcocontrols.temco-docs', namespace: 'temcoDocs', state: 'Active', owns: 'The registry, pages, checks, editor surfaces, and the writes', surface: 'docs/knowledge' },
			{ name: 'Temco Repositories', id: 'temcocontrols.temco-repositories', namespace: 'temcoRepositories', state: 'Active', owns: 'The organisation, local copies, the working area, reading a source', surface: 'docs/sources' },
			{ name: 'Temco Projects', id: 'temcocontrols.temco-projects', namespace: 'temcoProjects', state: 'Active', owns: 'Projects, sources, outputs, builds', surface: 'docs/projects' },
			{ name: 'Temco AI', id: 'temcocontrols.temco-ai', namespace: 'temcoAi', state: 'Active', owns: 'The local runtime and models, the prompts, the panel, drafts and answers', surface: 'ai/chat' },
			{ name: 'Temco SQL', id: 'temcocontrols.temco-sql', namespace: 'temcoSql', state: 'Reserved', owns: 'Registers, queries, export', surface: 'sql/query' },
			{ name: 'Temco NetTools', id: 'temcocontrols.temco-nettools', namespace: 'temcoNettools', state: 'Reserved', owns: 'Devices on the wire', surface: 'network/discovery' },
			{ name: 'Temco BACnet', id: 'temcocontrols.temco-bacnet', namespace: 'temcoBacnet', state: 'Reserved', owns: 'Objects, points, trends', surface: 'bacnet/objects' },
			{ name: 'Temco Device Manager', id: 'temcocontrols.temco-device-manager', namespace: 'temcoDevices', state: 'Reserved', owns: 'Fleets, firmware, health', surface: 'devices/all' }
		],

		problems: [
			{ severity: 'err', where: 'api-reference/data-points.md', message: 'Order 20 is used by more than one page in this area.' },
			{ severity: 'err', where: 'protocols/modbus.md', message: 'Link target /help/register-map does not exist.' },
			{ severity: 'warn', where: 'hardware/t3-8r.md', message: 'Image predates the current firmware (2.14.3).' },
			{ severity: 'warn', where: 'trends/retention.md', message: 'No owner assigned to this page.' }
		],

		output: [
			'[Temco Docs] registry loaded: 8 areas, 54 chapters, 1,254 pages',
			'[Temco Docs] sources: 7 read, 1 changed since the last build',
			'[Temco AI] runtime ready · qwen2.5-3b-instruct (local)',
			'[Temco Projects] project T3000 Documentation selected',
			'[Temco Docs] build 13.0.482 · website 1,254 pages · 1 m 42 s'
		]
	};
})(window.TemcoMock = window.TemcoMock || { views: {} });
