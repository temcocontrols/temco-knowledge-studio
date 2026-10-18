// The sample the Documentation surfaces are drawn from.
//
// This is the mock's sample (`docs/mock/js/data.js`: `docsProjects`, `repositories`, `reads`, `sources`,
// `knowledge`, `areaPages`, `sourceFiles`, `sourceCode`, `reviews`, `builds`, `buildLog`, `releases`), carried
// over as-is. The pages are the design's; the product's own registry is read separately, by `registry.ts`, and
// nothing here is written anywhere.

export interface DocsProject {
	name: string;
	version: string;
	audience: string;
	pages: number;
	sources: number;
	owner: string;
	state: string;
	tone: string;
	updated: string;
}

export const PROJECTS: DocsProject[] = [
	{ name: 'T3000 Documentation', version: '13.0', audience: 'Integrators and installers', pages: 1254, sources: 14, owner: 'Derek', state: 'In review', tone: 'warn', updated: '12 minutes ago' },
	{ name: 'T3-BACnet Reference', version: '4.2', audience: 'BACnet integrators', pages: 186, sources: 6, owner: 'Mei', state: 'Published', tone: 'ok', updated: '2 days ago' },
	{ name: 'T3-8R Hardware Guide', version: '2.1', audience: 'Installers and service technicians', pages: 74, sources: 4, owner: 'Derek', state: 'Draft', tone: 'neutral', updated: '5 days ago' },
	{ name: 'Temco SDK', version: '1.4', audience: 'Application developers', pages: 100, sources: 8, owner: 'Ana', state: 'Published', tone: 'ok', updated: '1 week ago' }
];

export interface Repository {
	name: string;
	remote: string;
	temco: boolean;
	branch: string;
	branches: number;
	branchNames: string[];
	head: string;
	docs: string;
	state: string;
	tone: string;
	files: number;
	pages: number;
	size: string;
	read: string;
	owner: string;
	scripts: { name: string; note: string }[];
}

export const REPOSITORIES: Repository[] = [
	{
		name: 't3000webview', remote: 'github.com/temcocontrols/t3000webview', temco: true, branch: 'main', branches: 4,
		branchNames: ['main', 't3000', 'release/13.0', 'feature/web-ui'], head: '4de5eda', docs: 'docs/help',
		state: 'Cloned', tone: 'ok', files: 412, pages: 138, size: '48 MB', read: '1 hour ago', owner: 'Derek',
		scripts: [
			{ name: 'docs:registry', note: 'writes docs/help/registry.json' },
			{ name: 'docs:build', note: 'builds the site into .temco/build' },
			{ name: 'docs:check', note: 'structural checks, no writes' }
		]
	},
	{
		name: 't3000-esp', remote: 'github.com/temcocontrols/t3000-esp', temco: true, branch: 'main', branches: 2,
		branchNames: ['main', 'feature/ota'], head: 'c41f002', docs: 'docs', state: 'Cloned', tone: 'ok',
		files: 268, pages: 64, size: '22 MB', read: '3 hours ago', owner: 'Mei',
		scripts: [{ name: 'docs:read', note: 'writes docs/index.json' }]
	},
	{
		name: 'temco-learn', remote: 'github.com/temcocontrols/temco-learn', temco: true, branch: 'main', branches: 3,
		branchNames: [], head: '—', docs: 'content', state: 'Not cloned', tone: 'neutral', files: 0, pages: 0,
		size: '—', read: 'never', owner: '—', scripts: []
	},
	{
		name: 'bacnet-stack', remote: 'github.com/bacnet-stack/bacnet-stack', temco: false, branch: 'v1.4', branches: 4,
		branchNames: ['v1.4', 'master', 'release/1.3', 'feature/sc'], head: '9b21c04', docs: 'doc', state: 'Cloned',
		tone: 'ok', files: 1204, pages: 52, size: '96 MB', read: 'yesterday', owner: 'Ana', scripts: []
	}
];

export interface Read {
	repo: string;
	branch: string;
	commit: string;
	when: string;
	pages: number;
	added: number;
	changed: number;
	removed: number;
}

export const READS: Read[] = [
	{ repo: 't3000webview', branch: 'main', commit: '4de5eda', when: '1 hour ago', pages: 138, added: 12, changed: 4, removed: 0 },
	{ repo: 't3000webview', branch: 'main', commit: 'b968a0f', when: 'yesterday', pages: 134, added: 3, changed: 9, removed: 1 },
	{ repo: 't3000webview', branch: 't3000', commit: '10e23fb', when: '3 days ago', pages: 131, added: 0, changed: 2, removed: 0 },
	{ repo: 't3000-esp', branch: 'main', commit: 'c41f002', when: '3 hours ago', pages: 64, added: 5, changed: 0, removed: 2 }
];

export interface Source {
	name: string;
	kind: string;
	detail: string;
	state: string;
	tone: string;
	pages: number;
	when: string;
}

export const SOURCES: Source[] = [
	{ name: 't3000webview', kind: 'Repository', detail: 'main · 412 files', state: 'Read', tone: 'ok', pages: 138, when: '1 hour ago' },
	{ name: 't3000-esp', kind: 'Repository', detail: 'main · 268 files', state: 'Read', tone: 'ok', pages: 64, when: '3 hours ago' },
	{ name: 'bacnet-stack', kind: 'Repository', detail: 'v1.4 · 1,204 files', state: 'Read', tone: 'ok', pages: 52, when: 'yesterday' },
	{ name: 'BACnet Protocol Guide.pdf', kind: 'PDF', detail: '248 pages · 6.2 MB', state: 'Read', tone: 'ok', pages: 31, when: 'yesterday' },
	{ name: 'T3000 User Manual.docx', kind: 'DOCX', detail: '94 pages · 2.1 MB', state: 'Changed', tone: 'warn', pages: 0, when: '4 days ago' },
	{ name: 'SharePoint · Field Notes', kind: 'SharePoint', detail: 'Connected · 3 libraries', state: 'Not read', tone: 'neutral', pages: 0, when: 'never' },
	{ name: 'LegacyDocs', kind: 'Folder', detail: '~/Temco/LegacyDocs', state: 'Partial', tone: 'warn', pages: 18, when: '2 weeks ago' }
];

export interface Area {
	area: string;
	pages: number;
	reviewed: number;
	stale: number;
}

export const AREAS: Area[] = [
	{ area: 'Overview', pages: 24, reviewed: 24, stale: 0 },
	{ area: 'Getting Started', pages: 56, reviewed: 47, stale: 3 },
	{ area: 'Architecture', pages: 92, reviewed: 82, stale: 3 },
	{ area: 'API Reference', pages: 402, reviewed: 194, stale: 45 },
	{ area: 'Hardware', pages: 208, reviewed: 186, stale: 6 },
	{ area: 'Protocols', pages: 268, reviewed: 196, stale: 25 },
	{ area: 'Troubleshooting', pages: 148, reviewed: 128, stale: 7 },
	{ area: 'Release Notes', pages: 56, reviewed: 56, stale: 0 }
];

export interface PageRow {
	order: number;
	page: string;
	state: string;
	tone: string;
	owner: string;
	changed: string;
}

export const AREA_PAGES: { [area: string]: PageRow[] } = {
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
};

export const SOURCE_FILES = [
	{ path: 'src/api/points.ts', role: 'the endpoints the API Reference documents', lines: 412, lang: 'TypeScript' },
	{ path: 'src/api/point-types.ts', role: 'the point type table and its scale factors', lines: 168, lang: 'TypeScript' },
	{ path: 'src/web/point-table/point-table.component.ts', role: 'what the screenshots on the page show', lines: 640, lang: 'TypeScript' },
	{ path: 'src/models/point.model.ts', role: 'the schema the page quotes', lines: 96, lang: 'TypeScript' },
	{ path: 'docs/scale-factor.md', role: 'a page written by hand, not generated', lines: 54, lang: 'Markdown' },
	{ path: 'README.md', role: 'the overview page', lines: 88, lang: 'Markdown' }
];

export const SOURCE_CODE = [
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
];

export interface Review {
	page: string;
	area: string;
	author: string;
	kind: string;
	tone: string;
	changes: string;
	age: string;
}

export const REVIEWS: Review[] = [
	{ page: 'Data Points API', area: 'api-reference', author: 'AI draft', kind: 'Draft', tone: 'info', changes: '+42 −8', age: '26 m' },
	{ page: 'Trend Log Retention', area: 'trends', author: 'Mei', kind: 'Edit', tone: 'neutral', changes: '+12 −4', age: '1 h' },
	{ page: 'T3-8R Wiring', area: 'hardware', author: 'AI draft', kind: 'Draft', tone: 'info', changes: '+88 −31', age: '3 h' },
	{ page: 'BACnet Object Types', area: 'concepts', author: 'Ana', kind: 'New page', tone: 'ok', changes: '+210', age: '5 h' },
	{ page: 'Modbus Register Map', area: 'protocols', author: 'Derek', kind: 'Edit', tone: 'neutral', changes: '+6 −2', age: 'yesterday' },
	{ page: 'Alarm Routing', area: 'alarms', author: 'AI draft', kind: 'Draft', tone: 'info', changes: '+54 −12', age: 'yesterday' }
];

export interface Build {
	target: string;
	detail: string;
	state: string;
	tone: string;
	pct: number;
	time: string;
}

export const BUILDS: Build[] = [
	{ target: 'Website', detail: '1,254 pages · static', state: 'Succeeded', tone: 'ok', pct: 100, time: '1 m 42 s' },
	{ target: 'PDF', detail: '1,254 pages · 6.2 MB', state: 'Succeeded', tone: 'ok', pct: 100, time: '4 m 08 s' },
	{ target: 'Offline Help (CHM)', detail: '1,254 topics · 18.4 MB', state: 'Running', tone: 'info', pct: 62, time: '2 m 51 s' },
	{ target: 'Search Index', detail: 'lunr · 12,884 terms', state: 'Queued', tone: 'neutral', pct: 0, time: '—' },
	{ target: 'AI Index', detail: 'embeddings · 1,254 chunks', state: 'Queued', tone: 'neutral', pct: 0, time: '—' }
];

export const BUILD_LOG = [
	'[12:04:11] Temco Docs build 13.0.482',
	'[12:04:11] project: T3000 Documentation (13.0)',
	'[12:04:12] sources: 14 read, 1 changed (T3000 User Manual.docx)',
	'[12:04:18] knowledge: 1,254 pages, 3,412 links',
	'[12:04:19] check: 12 issues (2 errors, 10 warnings)',
	'[12:04:24] website: 1,254 pages -> .temco/build/site',
	'[12:06:02] pdf: 1254 pages -> .temco/build/t3000-13.0.pdf',
	'[12:08:53] chm: 612 of 1,254 topics',
	'[12:08:53] waiting for the help compiler...'
];

export interface Release {
	version: string;
	date: string;
	pages: number;
	artifacts: string;
	state: string;
	tone: string;
}

export const RELEASES: Release[] = [
	{ version: '13.0', date: 'Today', pages: 1254, artifacts: 'Website · PDF · CHM · ZIP', state: 'Publishing', tone: 'info' },
	{ version: '12.9', date: '12 Sep', pages: 1211, artifacts: 'Website · PDF · CHM', state: 'Published', tone: 'ok' },
	{ version: '12.8', date: '24 Jul', pages: 1188, artifacts: 'Website · PDF', state: 'Published', tone: 'ok' },
	{ version: '12.7', date: '02 Jun', pages: 1140, artifacts: 'Website · PDF', state: 'Archived', tone: 'neutral' }
];
