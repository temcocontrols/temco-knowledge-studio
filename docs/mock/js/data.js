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
			sections: [
				{
					label: 'Projects',
					views: [
						{ id: 'docs/projects', label: 'Projects', icon: 'folder', badge: 12 },
						{ id: 'docs/repositories', label: 'Repositories', icon: 'repo', badge: 4 },
						{ id: 'docs/sources', label: 'Sources', icon: 'link', badge: 38 },
						{ id: 'docs/knowledge', label: 'Knowledge', icon: 'book' }
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
			sections: [
				{
					label: 'Workbench',
					views: [
						{ id: 'sql/query', label: 'Query Editor', icon: 'code' },
						{ id: 'sql/connections', label: 'Connections', icon: 'database' },
						{ id: 'sql/reports', label: 'Reports', icon: 'chart' }
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
			sections: [
				{
					label: 'Temco Platform',
					views: [
						{ id: 'settings/general', label: 'General', icon: 'gear' },
						{ id: 'settings/modules', label: 'Modules', icon: 'package', badge: 7 },
						{ id: 'settings/branding', label: 'Branding', icon: 'palette' },
						{ id: 'settings/ai', label: 'AI Models', icon: 'sparkle' },
						{ id: 'settings/publishing', label: 'Publishing', icon: 'upload' }
					]
				}
			]
		}
	];

	/* The index the router and the side bar share. */
	M.viewIndex = {};
	M.modules.forEach(function (module) {
		module.sections.forEach(function (section) {
			section.views.forEach(function (view) {
				view.moduleId = module.id;
				view.moduleLabel = module.label;
				view.sectionLabel = section.label;
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
		sectionLabel: 'Projects'
	};

	/* ------------------------------------------------------------------ data */

	M.data = {
		user: { name: 'Derek', initials: 'DK', role: 'Controls engineer' },

		workspaces: [
			{ id: 't3000', name: 'T3000', desc: 'Building automation controller platform', projects: 5, sources: 14, devices: 34, updated: '12 minutes ago', active: true, tone: 'accent' },
			{ id: 't3-bacnet', name: 'T3-BACnet', desc: 'BACnet stack and object model', projects: 3, sources: 9, devices: 12, updated: '2 hours ago' },
			{ id: 'temco-learn', name: 'Temco Learn', desc: 'Published documentation site', projects: 2, sources: 6, devices: 0, updated: 'yesterday' },
			{ id: 'legacy', name: 'Legacy Products', desc: 'T3-8R, T3-22I, T3-LB archives', projects: 4, sources: 11, devices: 8, updated: '4 days ago' }
		],

		kpis: [
			{ label: 'Documentation Projects', value: '12', delta: '+2 this month', meta: '4 need attention' },
			{ label: 'Sources Read', value: '38', delta: '+6', meta: 'repositories · PDF · DOCX' },
			{ label: 'Pages', value: '1,254', delta: '+48', meta: '341 never reviewed' },
			{ label: 'Devices Online', value: '31 / 34', delta: '−1', down: true, meta: 'T3-22I offline 2 h' }
		],

		pipeline: [
			{ n: '01', name: 'Sources', meta: '38 read', view: 'docs/sources', current: false },
			{ n: '02', name: 'Knowledge', meta: '1,254 pages', view: 'docs/knowledge', current: false },
			{ n: '03', name: 'Review', meta: '17 waiting', view: 'docs/review', current: true },
			{ n: '04', name: 'Build', meta: '4 targets', view: 'docs/builds', current: false },
			{ n: '05', name: 'Publish', meta: '13.0 ready', view: 'docs/releases', current: false },
			{ n: '06', name: 'Temco Learn', meta: 'live', view: 'learn/home', current: false }
		],

		activity: [
			{ icon: 'check', tone: 'ok', title: 'Release 13.0 published to Temco Learn', sub: 't3000 · 1,254 pages', when: 'Just now' },
			{ icon: 'sparkle', tone: 'accent', title: 'AI drafted 8 page updates', sub: 'Data Points API · waiting for review', when: '26 min ago' },
			{ icon: 'repo', tone: 'info', title: 'Source t3000webview read', sub: '412 files · 3 new pages found', when: '1 hr ago' },
			{ icon: 'alert', tone: 'warn', title: 'T3-22I stopped reporting', sub: 'Device health', when: '2 hr ago' }
		],

		needs: [
			{ title: 'Data Points API', where: 't3000 › api-reference', issue: 'Order 20 is used by more than one page', kind: 'err', age: '14 months' },
			{ title: 'Getting Started', where: 't3000 › overview', issue: 'No owner assigned', kind: 'warn', age: '6 months' },
			{ title: 'T3-8R Wiring', where: 't3000 › hardware', issue: 'Screenshot from firmware 2.9, current is 2.14', kind: 'warn', age: '9 months' },
			{ title: 'BACnet Object Model', where: 't3-bacnet › concepts', issue: 'Missing 3 object types', kind: 'err', age: '2 months' },
			{ title: 'Trend Log Retention', where: 't3000 › trends', issue: 'Broken link to /help/retention', kind: 'err', age: '3 weeks' },
			{ title: 'Modbus Register Map', where: 't3000 › protocols', issue: 'Never reviewed', kind: 'warn', age: '—' },
			{ title: 'Alarm Routing', where: 't3000 › alarms', issue: 'AI draft pending since yesterday', kind: 'info', age: '1 day' }
		],

		docsProjects: [
			{ name: 'T3000 Documentation', version: '13.0', pages: 894, sources: 14, owner: 'Derek', state: 'In review', tone: 'warn', updated: '12 minutes ago' },
			{ name: 'T3-BACnet Reference', version: '4.2', pages: 186, sources: 6, owner: 'Mei', state: 'Published', tone: 'ok', updated: '2 days ago' },
			{ name: 'T3-8R Hardware Guide', version: '2.1', pages: 74, sources: 4, owner: 'Derek', state: 'Draft', tone: 'neutral', updated: '5 days ago' },
			{ name: 'Temco SDK', version: '1.4', pages: 100, sources: 8, owner: 'Ana', state: 'Published', tone: 'ok', updated: '1 week ago' }
		],

		sources: [
			{ name: 't3000webview', kind: 'Repository', detail: 'main · 412 files', state: 'Read', tone: 'ok', found: '138 pages', when: '1 hour ago' },
			{ name: 't3000-esp', kind: 'Repository', detail: 'main · 268 files', state: 'Read', tone: 'ok', found: '64 pages', when: '3 hours ago' },
			{ name: 'bacnet-stack', kind: 'Repository', detail: 'v1.4 · 1,204 files', state: 'Read', tone: 'ok', found: '52 pages', when: 'yesterday' },
			{ name: 'BACnet Protocol Guide.pdf', kind: 'PDF', detail: '248 pages · 6.2 MB', state: 'Read', tone: 'ok', found: '31 pages', when: 'yesterday' },
			{ name: 'T3000 User Manual.docx', kind: 'DOCX', detail: '94 pages · 2.1 MB', state: 'Changed', tone: 'warn', found: '—', when: '4 days ago' },
			{ name: 'SharePoint · Field Notes', kind: 'SharePoint', detail: 'Connected · 3 libraries', state: 'Not read', tone: 'neutral', found: '—', when: 'never' },
			{ name: 'LegacyDocs', kind: 'Folder', detail: '~/Temco/LegacyDocs', state: 'Partial', tone: 'warn', found: '18 pages', when: '2 weeks ago' }
		],

		repositories: [
			{ name: 't3000webview', remote: 'github.com/temcocontrols/t3000webview', branch: 'main', branches: 4, state: 'Cloned', tone: 'ok', files: 412, pages: 138, size: '48 MB', read: '1 hour ago', owner: 'Derek' },
			{ name: 't3000-esp', remote: 'github.com/temcocontrols/t3000-esp', branch: 'main', branches: 2, state: 'Cloned', tone: 'ok', files: 268, pages: 64, size: '22 MB', read: '3 hours ago', owner: 'Mei' },
			{ name: 'bacnet-stack', remote: 'github.com/bacnet-stack/bacnet-stack', branch: 'v1.4', branches: 9, state: 'Cloned', tone: 'ok', files: 1204, pages: 52, size: '96 MB', read: 'yesterday', owner: 'Ana' },
			{ name: 'temco-learn', remote: 'github.com/temcocontrols/temco-learn', branch: 'main', branches: 3, state: 'Not cloned', tone: 'neutral', files: 0, pages: 0, size: '—', read: 'never', owner: '—' }
		],

		reads: [
			{ repo: 't3000webview', branch: 'main', commit: '4de5eda', when: '1 hour ago', pages: 138, added: 12, changed: 4, removed: 0 },
			{ repo: 't3000webview', branch: 'main', commit: 'b968a0f', when: 'yesterday', pages: 134, added: 3, changed: 9, removed: 1 },
			{ repo: 't3000webview', branch: 't3000', commit: '10e23fb', when: '3 days ago', pages: 131, added: 0, changed: 2, removed: 0 },
			{ repo: 't3000-esp', branch: 'main', commit: 'c41f002', when: '3 hours ago', pages: 64, added: 5, changed: 0, removed: 2 }
		],

		knowledge: [
			{ area: 'Overview', pages: 12, reviewed: 12, stale: 0 },
			{ area: 'Getting Started', pages: 24, reviewed: 21, stale: 3 },
			{ area: 'Architecture', pages: 38, reviewed: 35, stale: 3 },
			{ area: 'API Reference', pages: 186, reviewed: 141, stale: 45 },
			{ area: 'Hardware', pages: 94, reviewed: 88, stale: 6 },
			{ area: 'Protocols', pages: 121, reviewed: 96, stale: 25 },
			{ area: 'Troubleshooting', pages: 68, reviewed: 61, stale: 7 },
			{ area: 'Release Notes', pages: 54, reviewed: 54, stale: 0 }
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
			{ target: 'PDF', detail: '894 pages · 6.2 MB', state: 'Succeeded', tone: 'ok', pct: 100, time: '4 m 08 s' },
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
			'[12:06:02] pdf: 894 pages -> .temco/build/t3000-13.0.pdf',
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

		connections: [
			{ name: 'MSSQL · Production', kind: 'SQL Server', host: 't3-sql01\\prod', database: 'T3000', state: 'Connected', tone: 'ok' },
			{ name: 'SQLite · Cache', kind: 'SQLite', host: '~/Temco/cache.db', database: 'main', state: 'Connected', tone: 'ok' },
			{ name: 'PostgreSQL · Reports', kind: 'PostgreSQL', host: 'reports.temco.local', database: 'analytics', state: 'Idle', tone: 'warn' }
		],

		queryRows: [
			{ id: 2371, name: 'T3-BB · AHU-1', product: 'T3-BB', firmware: '2.14.3', online: '1', updated: '2026-10-17 12:41:02' },
			{ id: 2372, name: 'T3-8R · Boiler Room', product: 'T3-8R', firmware: '2.14.3', online: '1', updated: '2026-10-17 12:41:05' },
			{ id: 2388, name: 'T3-22I · Lab Wing', product: 'T3-22I', firmware: '2.12.1', online: '0', updated: '2026-10-17 10:38:44' },
			{ id: 2401, name: 'T3-NC · Chiller', product: 'T3-NC', firmware: '2.14.1', online: '1', updated: '2026-10-17 12:41:01' },
			{ id: 2402, name: 'T3-LB · Lighting', product: 'T3-LB', firmware: '2.14.3', online: '1', updated: '2026-10-17 12:41:03' }
		],

		reports: [
			{ name: 'Device inventory', desc: 'Every device, its firmware and last contact', updated: '5 minutes ago' },
			{ name: 'Alarm history · 7 days', desc: 'Counts by device, priority and hour', updated: '1 hour ago' },
			{ name: 'Firmware drift', desc: 'Devices not on the current stable release', updated: 'yesterday' }
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
			{ title: 'Data Points API', where: 't3000 › api-reference › data-points', kind: 'page' },
			{ title: 'Point object', where: 'bacnet-stack › src/bacnet/point.h', kind: 'source' },
			{ title: 'T3000 User Manual.pdf', where: 'page 148 · §7.3', kind: 'document' },
			{ title: 'Trend Log Retention', where: 't3000 › trends › retention', kind: 'page' }
		],

		learnProducts: [
			{ id: 't3000', name: 'T3000', desc: 'The controller platform: hardware, points, programs and the web UI', version: '13.0', pages: 894 },
			{ id: 'bacnet', name: 'BACnet', desc: 'Protocol reference, object model and conformance', version: '4.2', pages: 186 },
			{ id: 'devices', name: 'Devices', desc: 'Every T3 controller, its wiring and its specifications', version: '2.14', pages: 94 },
			{ id: 'sdk', name: 'SDK', desc: 'Build on the platform: APIs, schemas and samples', version: '1.4', pages: 80 }
		],

		learnPaths: [
			{ name: 'Commission a T3 controller', level: 'Beginner', steps: 6, minutes: 55, desc: 'From unboxing to a device that answers on the network.' },
			{ name: 'Design a control strategy', level: 'Intermediate', steps: 9, minutes: 130, desc: 'Points, programs, schedules and the logic behind them.' },
			{ name: 'Write a BACnet integration', level: 'Advanced', steps: 11, minutes: 210, desc: 'Objects, services, alarms and trend logs across vendors.' }
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
			'[Temco Docs] sources: 38 read, 1 changed since the last build',
			'[Temco AI] runtime ready · qwen2.5-3b-instruct (local)',
			'[Temco Projects] project T3000 Documentation selected',
			'[Temco Docs] build 13.0.482 · website 1,254 pages · 1 m 42 s'
		]
	};
})(window.TemcoMock = window.TemcoMock || { views: {} });
