// The sample the Settings surfaces are drawn from.
//
// The mock's (`docs/mock/js/data.js`: `modules`), carried over as-is: the module register is the platform's own
// statement about what ships, and the rest of these pages are settings the window owns.

export interface ModuleRow {
	name: string;
	id: string;
	namespace: string;
	state: string;
	owns: string;
	/** The surface the module draws, when it has one — the mock's `surface` ids. */
	surface?: string;
}

export const MODULES: ModuleRow[] = [
	{ name: 'Temco Workbench', id: 'temcocontrols.temco-workbench', namespace: 'temcoWorkbench', state: 'Active', owns: 'The application’s own surfaces: the dashboard, workspaces, what needs doing', surface: 'overview' },
	{ name: 'Temco UI', id: 'temcocontrols.temco-ui', namespace: 'temcoUi', state: 'Active', owns: 'Where a page of ours opens, and what a command argument means' },
	{ name: 'Temco Store', id: 'temcocontrols.temco-store', namespace: 'temcoStore', state: 'Active', owns: 'The platform’s own memory: the catalog, the selection, the naming rules' },
	{ name: 'Temco Docs', id: 'temcocontrols.temco-docs', namespace: 'temcoDocs', state: 'Active', owns: 'The registry, pages, checks, editor surfaces, and the writes', surface: 'documents' },
	{ name: 'Temco Repositories', id: 'temcocontrols.temco-repositories', namespace: 'temcoRepositories', state: 'Active', owns: 'The organisation, local copies, the working area, reading a source', surface: 'sources' },
	{ name: 'Temco Projects', id: 'temcocontrols.temco-projects', namespace: 'temcoProjects', state: 'Active', owns: 'Projects, sources, outputs, builds', surface: 'projects' },
	{ name: 'Temco AI', id: 'temcocontrols.temco-ai', namespace: 'temcoAi', state: 'Active', owns: 'The local runtime and models, the prompts, the panel, drafts and answers', surface: 'chat' },
	{ name: 'Temco SQL', id: 'temcocontrols.temco-sql', namespace: 'temcoSql', state: 'Reserved', owns: 'Registers, queries, export' },
	{ name: 'Temco NetTools', id: 'temcocontrols.temco-nettools', namespace: 'temcoNettools', state: 'Reserved', owns: 'Devices on the wire' },
	{ name: 'Temco BACnet', id: 'temcocontrols.temco-bacnet', namespace: 'temcoBacnet', state: 'Reserved', owns: 'Objects, points, trends' },
	{ name: 'Temco Device Manager', id: 'temcocontrols.temco-device-manager', namespace: 'temcoDevices', state: 'Reserved', owns: 'Fleets, firmware, health' }
];

/** The five colour roles the shell draws every surface from. */
export const ROLES = [
	{ colour: '#1f1f1f', name: 'background' },
	{ colour: '#0078d4', name: 'accent' },
	{ colour: '#3fb950', name: 'ok' },
	{ colour: '#d29922', name: 'warn' },
	{ colour: '#f85149', name: 'danger' }
];

/** What a release may publish, and whether it is on by default. */
export const ARTIFACTS = [
	{ name: 'Website', desc: 'The rendered site at the path below.', on: true },
	{ name: 'PDF', desc: 'One file per version, built from the same pages.', on: true },
	{ name: 'Offline help (CHM)', desc: 'The Windows help file readers open from the Start menu.', on: true },
	{ name: 'Search index', desc: 'The static index the site loads to answer a search.', on: true },
	{ name: 'AI index', desc: 'Local chunks for the AI panel. Never uploaded with the site.', on: false }
];
