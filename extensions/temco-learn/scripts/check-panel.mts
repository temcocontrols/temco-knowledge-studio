// The panel's own contract: five views, names only, and the number at the row's right edge.
//
// A tree row has two slots — the label and the thing pushed to its right edge — and this module promised to use them the
// way Home does: never a sentence in a row, and the one extra fact is a number, drawn as a badge. Each case below is that
// promise, per view, against one snapshot.

import assert from 'node:assert/strict';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';

interface Row {
	label?: string;
	iconPath?: { id: string };
	resourceUri?: { toString(): string };
	command?: { command: string };
}

interface Views {
	Reads: new (read: () => Promise<unknown>) => unknown;
	OverviewTree: new (reads: unknown) => { getChildren(item?: Row): Promise<Row[]> };
	ProjectsTree: new (reads: unknown) => { getChildren(item?: Row): Promise<Row[]> };
	ArtifactsTree: new (reads: unknown, intent: 'preview' | 'download') => { getChildren(item?: Row): Promise<Row[]> };
	TodoTree: new (reads: unknown) => { getChildren(item?: Row): Promise<Row[]> };
	VIEWS: Record<string, string>;
}

class TreeItem {
	label?: string;
	collapsibleState?: number;
	iconPath?: { id: string };
	resourceUri?: { toString(): string };
	command?: { command: string };
	id?: string;
	tooltip?: string;
	contextValue?: string;
	constructor(label?: string, collapsibleState?: number) {
		this.label = label;
		this.collapsibleState = collapsibleState;
	}
}

const vscode = {
	TreeItem,
	TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
	ThemeIcon: class {
		id: string;
		constructor(id: string) {
			this.id = id;
		}
	},
	EventEmitter: class {
		event = () => ({ dispose() { } });
		fire() { }
		dispose() { }
	},
	Uri: {
		parse: (value: string) => ({
			scheme: 'temco-learn-count',
			toString: () => value
		})
	},
	workspace: { workspaceFolders: [], getConfiguration: () => ({ get: () => undefined }) },
	extensions: { getExtension: () => ({ isActive: true, exports: {} }) },
	window: { registerFileDecorationProvider: () => ({ dispose() { } }) }
};

const load = Module._load;
Module._load = function (request: string, parent: unknown, isMain: boolean) {
	if (request === 'vscode') {
		return vscode;
	}
	return load.call(this as unknown as NodeModule, request, parent, isMain);
};

const views = createRequire(import.meta.url)(fileURLToPath(new URL('../out/tree.js', import.meta.url))) as Views;

/** The number a row pushes to its right edge. */
const count = (row: Row): string => {
	if (row.resourceUri === undefined) {
		return '';
	}
	return decodeURIComponent(String(row.resourceUri.toString()).split('/')[1] ?? '');
};

const now = Date.now();
const snapshot = {
	site: {
		projects: [
			{ id: 't3000', title: 'T3000', section: 'documentation', versions: [{ version: '13.0', builtAt: new Date(now - 7200e3).toISOString(), pages: [{ href: 'a', title: 'A' }, { href: 'b', title: 'B' }] }, { version: '12.9', builtAt: new Date(now - 5 * 86400e3).toISOString(), pages: [{ href: 'c', title: 'C' }] }] },
			{ id: 'bacnet', title: 'BACnet', section: 'documentation', versions: [{ version: '4.2', builtAt: new Date(now - 86400e3).toISOString(), pages: [{ href: 'd', title: 'D' }] }] }
		]
	},
	builds: [{ folder: 'C:/Temco/nettools/dist/site', title: 'NetTools', id: 'nettools', at: now }],
	artifacts: [
		{
			title: 'T3000', id: 't3000', folder: 'C:/Temco/t3000', builtAt: new Date(now - 7200e3).toISOString(),
			artifacts: [
				{ kind: 'site', file: 'C:/Temco/t3000/dist/site', label: 'the website', opens: 'editor', size: undefined, at: now },
				{ kind: 'chm', file: 'C:/Temco/HelpDocs/T3000.chm', label: 'offline help', opens: 'external', size: 1153434, at: now },
				{ kind: 'zip', file: 'C:/Temco/t3000/dist/T3000-site.zip', label: 'an archive', opens: undefined, size: 4404019, at: now }
			]
		}
	],
	published: { where: 'temcocontrols/docs', base: 'https://temcocontrols.github.io/docs/', commit: '6f2c1ab', at: new Date(now - 12 * 60e3).toISOString(), pending: 3 }
};

const clean = {
	...snapshot,
	builds: [],
	published: { ...snapshot.published, pending: 0 }
};

const cases: { name: string; run: () => Promise<void> }[] = [];
const test = (name: string, run: () => Promise<void>) => cases.push({ name, run });

const newReads = (state: unknown) => new views.Reads(async () => state);

test('the Overview view is one subject row, and every fact is a number at the right edge', async () => {
	const provider = new views.OverviewTree(newReads(snapshot));
	const [root] = await provider.getChildren();
	assert.equal(root.label, 'Temco Learn');
	assert.equal(root.command?.command, 'temcoLearn.overview');
	const facts = await provider.getChildren(root);
	assert.deepEqual(facts.map((row) => [row.label, count(row)]), [
		['Projects', '2'],
		['Versions', '3'],
		['Pages', '4'],
		['Waiting to be added', '1'],
		['Not published', '3'],
		['Last publish', '12 min']
	]);
});

test('the Projects view counts versions per project and pages per version', async () => {
	const provider = new views.ProjectsTree(newReads(snapshot));
	const [t3000, bacnet] = await provider.getChildren();
	assert.deepEqual([t3000.label, count(t3000)], ['T3000', '2']);
	assert.deepEqual([bacnet.label, count(bacnet)], ['BACnet', '1']);
	const versions = await provider.getChildren(t3000);
	assert.deepEqual(versions.map((row) => [row.label, count(row)]), [['13.0', '2'], ['12.9', '1']]);
});

test('Preview is the project name as the category, and its rows are names only', async () => {
	const provider = new views.ArtifactsTree(newReads(snapshot), 'preview');
	const [project] = await provider.getChildren();
	assert.deepEqual([project.label, count(project)], ['T3000', '2']);
	const artifacts = await provider.getChildren(project);
	assert.deepEqual(artifacts.map((row) => row.label), ['Website', 'T3000.chm']);
	assert.deepEqual(artifacts.map(count), ['', ''], 'a preview row carries no number');
	assert.ok(artifacts.every((row) => row.command?.command === 'temcoLearn.previewArtifact'));
});

test('Download is the same category, and its rows carry the size', async () => {
	const provider = new views.ArtifactsTree(newReads(snapshot), 'download');
	const [project] = await provider.getChildren();
	assert.deepEqual([project.label, count(project)], ['T3000', '2']);
	const artifacts = await provider.getChildren(project);
	assert.deepEqual(artifacts.map((row) => [row.label, count(row)]), [['T3000.chm', '1.1 MB'], ['T3000-site.zip', '4.2 MB']]);
	assert.ok(artifacts.every((row) => row.command?.command === 'temcoLearn.downloadArtifact'));
});

test('What needs doing counts what each act clears, and says so when there is nothing', async () => {
	const provider = new views.TodoTree(newReads(snapshot));
	const rows = await provider.getChildren();
	assert.deepEqual(rows.map((row) => [row.label, count(row)]), [
		['Waiting to be added', '1'],
		['Not published', '3'],
		['Build a project', '']
	]);
	const builds = await provider.getChildren(rows[0]);
	assert.deepEqual(builds.map((row) => row.label), ['NetTools']);
	const cleanRows = await new views.TodoTree(newReads(clean)).getChildren();
	assert.deepEqual(cleanRows.map((row) => row.label), ['Nothing to do', 'Build a project']);
});

test('an empty Preview says so in a row instead of showing nothing', async () => {
	const provider = new views.ArtifactsTree(newReads({ ...snapshot, artifacts: [] }), 'preview');
	const rows = await provider.getChildren();
	assert.deepEqual(rows.map((row) => row.label), ['Nothing to look at']);
});

test('the five views are declared, and none of them is the old single panel', () => {
	assert.deepEqual(Object.values(views.VIEWS), [
		'temcoLearn.overviewView',
		'temcoLearn.projects',
		'temcoLearn.preview',
		'temcoLearn.download',
		'temcoLearn.todo'
	]);
});

let failed = 0;
for (const { name, run } of cases) {
	try {
		await run();
		console.log(`  ok  ${name}`);
	} catch (error) {
		failed += 1;
		console.error(`FAIL  ${name}`);
		console.error(error instanceof Error ? error.message : error);
	}
}
console.log(`\n${cases.length - failed}/${cases.length} panel cases passed`);
process.exit(failed === 0 ? 0 : 1);
