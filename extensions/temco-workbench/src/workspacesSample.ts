// The sample the Workspaces surfaces are drawn from.
//
// This is the mock's sample (`docs/mock/js/data.js`: `M.data.workspaces`, `sources`, `knowledge` and `templates`),
// carried over as-is. The platform keeps no register of workspaces — a workspace is the folder a window stands in,
// and a folder is what VS Code opens — so the rows here are the design's, not something the product can discover.
// One file holds them all, so replacing the sample later is one file and the pages have one table to read.

/** A workspace: the folder a window stands in, and what is in it. */
export interface Workspace {
	id: string;
	name: string;
	path: string;
	desc: string;
	projects: number;
	sources: number;
	devices: number;
	updated: string;
	active: boolean;
}

export const WORKSPACES: Workspace[] = [
	{ id: 't3000', name: 'T3000', path: '~/Temco/t3000', desc: 'Building automation controller platform', projects: 5, sources: 14, devices: 6, updated: '12 minutes ago', active: true },
	{ id: 't3-bacnet', name: 'T3-BACnet', path: '~/Temco/t3-bacnet', desc: 'BACnet stack and object model', projects: 3, sources: 9, devices: 12, updated: '2 hours ago', active: false },
	{ id: 'temco-learn', name: 'Temco Learn', path: '~/Temco/temco-learn', desc: 'Published documentation site', projects: 2, sources: 6, devices: 0, updated: 'yesterday', active: false },
	{ id: 'legacy', name: 'Legacy Products', path: '~/Temco/legacy', desc: 'T3-8R, T3-22I, T3-LB archives', projects: 4, sources: 11, devices: 8, updated: '4 days ago', active: false }
];

/** An area of the current workspace's registry, as its page lists it. */
export interface WorkspaceArea {
	area: string;
	pages: number;
	stale: number;
}

export const AREAS: WorkspaceArea[] = [
	{ area: 'Overview', pages: 24, stale: 0 },
	{ area: 'Getting Started', pages: 56, stale: 3 },
	{ area: 'Architecture', pages: 92, stale: 3 },
	{ area: 'API Reference', pages: 402, stale: 45 },
	{ area: 'Hardware', pages: 208, stale: 6 },
	{ area: 'Protocols', pages: 268, stale: 25 },
	{ area: 'Troubleshooting', pages: 148, stale: 7 },
	{ area: 'Release Notes', pages: 56, stale: 0 }
];

/** A source of the current workspace's projects. */
export interface WorkspaceSource {
	name: string;
	kind: string;
	detail: string;
	state: string;
	tone: 'ok' | 'warn' | 'neutral';
}

export const SOURCES: WorkspaceSource[] = [
	{ name: 't3000webview', kind: 'Repository', detail: 'main · 412 files', state: 'Read', tone: 'ok' },
	{ name: 't3000-esp', kind: 'Repository', detail: 'main · 268 files', state: 'Read', tone: 'ok' },
	{ name: 'bacnet-stack', kind: 'Repository', detail: 'v1.4 · 1,204 files', state: 'Read', tone: 'ok' },
	{ name: 'BACnet Protocol Guide.pdf', kind: 'PDF', detail: '248 pages · 6.2 MB', state: 'Read', tone: 'ok' },
	{ name: 'T3000 User Manual.docx', kind: 'DOCX', detail: '94 pages · 2.1 MB', state: 'Changed', tone: 'warn' },
	{ name: 'SharePoint · Field Notes', kind: 'SharePoint', detail: 'Connected · 3 libraries', state: 'Not read', tone: 'neutral' },
	{ name: 'LegacyDocs', kind: 'Folder', detail: '~/Temco/LegacyDocs', state: 'Partial', tone: 'warn' }
];

/** The current workspace's settings, as the strip at the foot of its page reads them. */
export const SETTINGS: { label: string; value: string; mono: boolean }[] = [
	{ label: 'Owner', value: 'Derek', mono: false },
	{ label: 'Working Folder', value: '~/Temco', mono: true },
	{ label: 'Default Branch', value: 'main', mono: true },
	{ label: 'Publishes To', value: 'Temco Learn · /t3000/', mono: false }
];

/** The current workspace's headline numbers. */
export const HEADLINE = { pages: '1,254', openRelease: '1', needsReview: '17' };

/** How many health checks every build runs — the number the Templates tiles quote. */
export const HEALTH_CHECKS = 7;

/** What a template decides, and what it deliberately does not. */
export interface Template {
	name: string;
	desc: string;
	pages: number;
	areas: string[];
	targets: string[];
	from: string;
}

export const TEMPLATES: Template[] = [
	{ name: 'Controller Manual', desc: 'Product overview, wiring, points, specifications and troubleshooting.', pages: 48, areas: ['Overview', 'Getting Started', 'Hardware', 'Protocols', 'Troubleshooting'], targets: ['Website', 'PDF'], from: 'written by hand' },
	{ name: 'Protocol Reference', desc: 'Objects, services, conformance and the notes an integrator needs.', pages: 26, areas: ['Overview', 'Architecture', 'Protocols'], targets: ['Website', 'PDF', 'CHM'], from: 'a written outline' },
	{ name: 'API Reference', desc: 'Endpoints, schemas and samples generated from a repository.', pages: 34, areas: ['Overview', 'Getting Started', 'API Reference'], targets: ['Website', 'PDF'], from: 'a repository' },
	{ name: 'Release Notes', desc: 'One page per release, from the commits since the previous tag.', pages: 8, areas: ['Release Notes'], targets: ['Website'], from: 'git tags' }
];
