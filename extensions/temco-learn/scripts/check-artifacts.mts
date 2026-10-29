// What a build wrote, checked against real folders.
//
// The panel says "offline help · 1.1 MB" only because something found that file. This walks a throwaway project tree the
// way `temco-docs` lays one out — `dist/site`, `dist/*.zip`, a `HelpDocs` folder beside the repository — and holds the
// reader to what is actually there: nothing invented, nothing missed, and the site's own pages never mistaken for "a
// single page".

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface Artifact {
	kind: string;
	file: string;
	label: string;
	opens: string | undefined;
	size: number | undefined;
}

interface ArtifactsModule {
	findArtifacts(): Promise<{ title: string; id: string; folder: string; builtAt: string | undefined; artifacts: Artifact[] }[]>;
	isPreviewable(artifact: Artifact): boolean;
	isDownloadable(artifact: Artifact): boolean;
}

/** The working area is the temporary tree, so the check never reads the real one. */
let area = '';

const vscode = {
	workspace: {
		workspaceFolders: [],
		getConfiguration: () => ({ get: (name: string) => (name === 'workspaceFolder' ? area : undefined) })
	}
};

const load = Module._load;
Module._load = function (request: string, parent: unknown, isMain: boolean) {
	if (request === 'vscode') {
		return vscode;
	}
	return load.call(this, request, parent, isMain) as unknown;
};

const artifacts = createRequire(import.meta.url)(fileURLToPath(new URL('../out/artifacts.js', import.meta.url))) as ArtifactsModule;

const cases: { name: string; run: () => Promise<void> }[] = [];
const test = (name: string, run: () => Promise<void>) => cases.push({ name, run });

/** A throwaway working area; the folder names are the project names, as the working area has them. */
function space(): { root: string; keep: string } {
	const keep = mkdtempSync(join(tmpdir(), 'temco-learn-artifacts-'));
	area = keep;
	return { root: keep, keep };
}

function write(file: string, content = 'x'): void {
	mkdirSync(join(file, '..'), { recursive: true });
	writeFileSync(file, content);
}

const kinds = (found: Artifact[]) => found.map((artifact) => artifact.kind).sort();

test('a site folder is the website, and its own pages are not "a single page"', async () => {
	const world = space();
	try {
		write(join(world.root, 't3000', 'dist', 'site', 'index.html'), '<title>T3000</title>');
		write(join(world.root, 't3000', 'dist', 'site', 'guide', 'intro.html'));
		const [project] = await artifacts.findArtifacts();
		assert.deepEqual(kinds(project.artifacts), ['site']);
		assert.equal(project.title, 'T3000', 'the title comes from the build, not the folder');
		assert.ok(project.builtAt !== undefined);
	} finally {
		rmSync(world.keep, { recursive: true, force: true });
	}
});

test('the help file is found beside the repository, in HelpDocs, and in dist', async () => {
	const world = space();
	try {
		write(join(world.root, 't3000', 'dist', 'site', 'index.html'));
		write(join(world.root, 'HelpDocs', 't3000.chm'));
		write(join(world.root, 't3000', 'dist', 'manual.pdf'));
		const [project] = await artifacts.findArtifacts();
		assert.deepEqual(kinds(project.artifacts), ['chm', 'pdf', 'site']);
		const help = project.artifacts.find((artifact) => artifact.kind === 'chm');
		assert.equal(help?.label, 'offline help');
		assert.equal(help?.opens, 'external', 'a chm opens outside the editor');
	} finally {
		rmSync(world.keep, { recursive: true, force: true });
	}
});

test('the exports a build writes are the downloads: zip and Word', async () => {
	const world = space();
	try {
		write(join(world.root, 't3000', 'dist', 'site', 'index.html'));
		write(join(world.root, 't3000', 'dist', 't3000-site-13.0.zip'), 'zip-bytes');
		write(join(world.root, 't3000', 'dist', 't3000-docs.docx'), 'word-bytes');
		const [project] = await artifacts.findArtifacts();
		const downloads = project.artifacts.filter((artifact) => artifacts.isDownloadable(artifact));
		assert.deepEqual(downloads.map((artifact) => artifact.kind).sort(), ['docx', 'zip']);
		const archive = downloads.find((artifact) => artifact.kind === 'zip');
		assert.equal(archive?.size, 9, 'the size is the file on disk');
		assert.equal(archive?.opens, undefined, 'an archive is not something to look at');
	} finally {
		rmSync(world.keep, { recursive: true, force: true });
	}
});

test('a loose page in dist is a single page, and it can be looked at', async () => {
	const world = space();
	try {
		write(join(world.root, 'bacnet', 'dist', 'first-call.html'), '<html></html>');
		const [project] = await artifacts.findArtifacts();
		assert.deepEqual(kinds(project.artifacts), ['page']);
		assert.ok(artifacts.isPreviewable(project.artifacts[0]));
		assert.equal(artifacts.isDownloadable(project.artifacts[0]), false);
	} finally {
		rmSync(world.keep, { recursive: true, force: true });
	}
});

test('a folder with no build output is not reported at all', async () => {
	const world = space();
	try {
		write(join(world.root, 'notes', 'readme.md'), '# notes');
		assert.deepEqual(await artifacts.findArtifacts(), []);
	} finally {
		rmSync(world.keep, { recursive: true, force: true });
	}
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
console.log(`\n${cases.length - failed}/${cases.length} artifact cases passed`);
process.exit(failed === 0 ? 0 : 1);
