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
	description?: string;
	collapsibleState?: number;
	iconPath?: { id: string };
	resourceUri?: { toString(): string };
	command?: { command: string; arguments?: unknown[] };
	tooltip?: unknown;
	contextValue?: string;
}

interface Views {
	Reads: new (read: () => Promise<unknown>) => unknown;
	OverviewTree: new () => { getChildren(item?: Row): Promise<Row[]> };
	BrowseTree: new (reads: unknown) => { getChildren(item?: Row): Promise<Row[]> };
	DownloadTree: new (reads: unknown) => { getChildren(item?: Row): Promise<Row[]> };
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

/** The grey words a row writes beside its name. */
const count = (row: Row): string => row.description ?? '';

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

const cleanState = {
	...snapshot,
	builds: [],
	published: { ...snapshot.published, pending: 0 }
};

const cases: { name: string; run: () => Promise<void> }[] = [];
const test = (name: string, run: () => Promise<void>) => cases.push({ name, run });

const newReads = (state: unknown) => new views.Reads(async () => state);

test('the Overview view is one row, and it opens the page', async () => {
	const provider = new views.OverviewTree();
	const [root] = await provider.getChildren();
	assert.equal(root.label, 'Temco Learn');
	assert.equal(root.command?.command, 'temcoLearn.overview');
	assert.deepEqual(await provider.getChildren(root), [], 'the Overview view still lists facts');
});

test('the Browse view answers the whole site first, then one project at a time', async () => {
	const provider = new views.BrowseTree(newReads(snapshot));
	const roots = await provider.getChildren();
	assert.deepEqual(
		roots.map((row) => [row.label, count(row), row.command?.command ?? '']),
		[
			['Preview the site', '', 'temcoLearn.preview'],
			['Preview by project', '2 projects', '']
		]
	);
});

test('Preview by project lists the projects, opens the first, and counts versions and pages', async () => {
	const provider = new views.BrowseTree(newReads(snapshot));
	const [, byProject] = await provider.getChildren();
	const [t3000, bacnet] = await provider.getChildren(byProject);
	assert.deepEqual([t3000.label, count(t3000)], ['T3000', '2 versions']);
	assert.equal(byProject.iconPath?.id, 'library', 'the group lost its own glyph');
	assert.equal(t3000.iconPath?.id, 'file-directory', 'a project wears the group glyph');
	assert.deepEqual([bacnet.label, count(bacnet)], ['BACnet', '1 version']);
	assert.equal(t3000.collapsibleState, 2, 'the first project is not open');
	assert.equal(bacnet.collapsibleState, 1, 'every project opens at once');
	assert.equal(t3000.command?.command, 'temcoLearn.preview', 'a project row does not open its page on the website');
	const versions = await provider.getChildren(t3000);
	assert.deepEqual(versions.map((row) => [row.label, count(row)]), [['13.0', ''], ['12.9', '']], 'a version still carries a page count');
	assert.ok(versions.every((row) => row.command?.command === 'temcoLearn.preview'));
});

test('a website with no build says so instead of showing an empty group', async () => {
	const provider = new views.BrowseTree(newReads({ ...snapshot, site: { projects: [] } }));
	const roots = await provider.getChildren();
	const [, byProject] = roots;
	assert.deepEqual((await provider.getChildren(byProject)).map((row) => row.label), ['Nothing yet']);
	assert.deepEqual([roots[0].label, count(roots[0])], ['Preview the site', '']);
});

test('Download is the project name as the category, and its rows carry the size', async () => {
	const provider = new views.DownloadTree(newReads(snapshot));
	const [project] = await provider.getChildren();
	assert.deepEqual([project.label, count(project)], ['T3000', '2 files']);
	const artifacts = await provider.getChildren(project);
	assert.deepEqual(artifacts.map((row) => [row.label, count(row)]), [['T3000.chm', '1.1 MB'], ['T3000-site.zip', '4.2 MB']]);
	assert.ok(artifacts.every((row) => row.command?.command === 'temcoLearn.downloadArtifact'));
	assert.deepEqual(artifacts.map((row) => row.contextValue), ['temcoLearn.artifact.look', 'temcoLearn.artifact']);
	const none = await new views.DownloadTree(newReads({ ...snapshot, artifacts: [] })).getChildren();
	assert.deepEqual(none.map((row) => row.label), ['No file to take']);
});

test('Next steps holds the acts, publishing among them', async () => {
	const provider = new views.TodoTree(newReads(snapshot));
	const rows = await provider.getChildren();
	assert.deepEqual(rows.map((row) => [row.label, count(row), row.command?.command ?? '']), [
		['Waiting to be added', '1 build', ''],
		['Publish', '3 changes', 'temcoLearn.publish'],
		['Build a project', '', 'temcoDocs.builds']
	]);
	const builds = await provider.getChildren(rows[0]);
	assert.deepEqual(builds.map((row) => [row.label, row.command?.command]), [['NetTools', 'temcoLearn.addBuild']]);
	assert.match(String(rows[1].tooltip), /last publish 6f2c1ab/u);
});

test('Next steps says when there is nothing to do, and still offers to publish', async () => {
	const rows = await new views.TodoTree(newReads(cleanState)).getChildren();
	assert.deepEqual(rows.map((row) => [row.label, count(row)]), [
		['Nothing to do', ''],
		['Publish', 'up to date'],
		['Build a project', '']
	]);
});

test('the four views are declared, and Projects and Preview do not survive as views', () => {
	assert.deepEqual(Object.values(views.VIEWS), [
		'temcoLearn.overviewView',
		'temcoLearn.browse',
		'temcoLearn.download',
		'temcoLearn.todo'
	]);
});

test('every menu names a view that exists and a command the manifest declares', () => {
	const manifest = createRequire(import.meta.url)('../package.json') as {
		contributes: {
			commands: { command: string }[];
			menus: Record<string, { command: string; when?: string }[]>;
		};
	};
	const declared = new Set(Object.values(views.VIEWS));
	const commands = new Set(manifest.contributes.commands.map((entry) => entry.command));
	for (const [where, entries] of Object.entries(manifest.contributes.menus)) {
		for (const entry of entries) {
			assert.ok(commands.has(entry.command), `${where} cites ${entry.command}, which the manifest does not declare`);
			const cited = /view == ([^ &]+)/u.exec(entry.when ?? '')?.[1];
			if (cited !== undefined) {
				assert.ok(declared.has(cited), `${where} cites the view ${cited}, which does not exist`);
			}
		}
	}
	const actions = (id: string, item: string): string[] =>
		manifest.contributes.menus['view/item/context']
			.filter((entry) => entry.when === `view == ${id} && viewItem == ${item}`)
			.map((entry) => entry.command)
			.sort();
	assert.deepEqual(actions('temcoLearn.download', 'temcoLearn.artifact.look'), ['temcoLearn.previewArtifact']);
	assert.deepEqual(actions('temcoLearn.download', 'temcoLearn.artifact'), ['temcoLearn.downloadArtifact', 'temcoLearn.revealArtifact']);
});

test('a project is written by its name, without the "docs" its page title ends with', async () => {
	const named = {
		...snapshot,
		site: { projects: [{ id: 'test1-docs', title: 'Test1 docs', section: 'documentation', versions: [{ version: '1.0', pages: [{ href: 'a', title: 'A' }] }] }] },
		artifacts: [{ title: 'Test1 docs', id: 'test1-docs', folder: 'C:/Temco/test1', artifacts: [{ kind: 'zip', file: 'C:/Temco/test1/dist/Test1.zip', label: 'an archive', opens: undefined, size: 1024, at: Date.now() }] }]
	};
	const browse = new views.BrowseTree(newReads(named));
	const [, byProject] = await browse.getChildren();
	assert.deepEqual((await browse.getChildren(byProject)).map((row) => row.label), ['Test1']);
	const download = new views.DownloadTree(newReads(named));
	assert.deepEqual((await download.getChildren()).map((row) => row.label), ['Test1']);
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
