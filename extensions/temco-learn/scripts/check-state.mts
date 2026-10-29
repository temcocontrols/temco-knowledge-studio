// The panel's publishing sentence, checked against real repositories.
//
// The panel never remembers what was published: it asks git. That means the sentences it draws — "not published yet",
// "3 changes to publish", "6f2c1ab · 12 min ago" — are only as good as this reader, so it is checked against a folder
// that is not a repository, a fresh one with an origin, and one with a commit and something left over.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface StateModule {
	readPublishedState(root: string): Promise<{ where: string | undefined; base: string | undefined; commit: string | undefined; at: string | undefined; pending: number }>;
	ago(iso: string | undefined): string;
}

const built = fileURLToPath(new URL('../out/state.js', import.meta.url));

// `state.ts` reaches `vscode` through `publish.ts`; nothing checked here reads a setting, but the import has to resolve.
const load = Module._load;
Module._load = function (request: string, parent: unknown, isMain: boolean) {
	if (request === 'vscode') {
		return { workspace: { getConfiguration: () => ({ get: () => undefined }) } };
	}
	return load.call(this as unknown as NodeModule, request, parent, isMain);
};

const state = createRequire(import.meta.url)(built) as StateModule;

const cases: { name: string; run: () => Promise<void> }[] = [];
const test = (name: string, run: () => Promise<void>) => cases.push({ name, run });

const git = (cwd: string, args: readonly string[]) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });

/** A throwaway folder, removed whatever the case does with it. */
function fresh(prefix: string): { root: string; keep: string } {
	const keep = mkdtempSync(join(tmpdir(), `temco-learn-${prefix}-`));
	const root = join(keep, 'site');
	mkdirSync(root, { recursive: true });
	return { root, keep };
}

test('a folder that is not a repository is not published, and owes nothing', async () => {
	const space = fresh('plain');
	try {
		writeFileSync(join(space.root, 'index.html'), '<!doctype html>');
		const found = await state.readPublishedState(space.root);
		assert.deepEqual(found, { where: undefined, base: undefined, commit: undefined, at: undefined, pending: 0 });
	} finally {
		rmSync(space.keep, { recursive: true, force: true });
	}
});

test('a repository with an origin knows the address before it has a commit', async () => {
	const space = fresh('origin');
	try {
		git(space.root, ['init']);
		git(space.root, ['remote', 'add', 'origin', 'https://github.com/temcocontrols/docs.git']);
		const found = await state.readPublishedState(space.root);
		assert.equal(found.base, 'https://temcocontrols.github.io/docs/');
		assert.equal(found.commit, undefined);
		assert.equal(found.at, undefined);
	} finally {
		rmSync(space.keep, { recursive: true, force: true });
	}
});

test('a commit is reported by hash and date, and a change after it is waiting', async () => {
	const space = fresh('commit');
	try {
		git(space.root, ['init']);
		git(space.root, ['remote', 'add', 'origin', 'https://github.com/temcocontrols/docs.git']);
		writeFileSync(join(space.root, 'index.html'), '<!doctype html>');
		git(space.root, ['add', '--all']);
		git(space.root, ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'first']);

		const published = await state.readPublishedState(space.root);
		assert.equal(published.pending, 0);
		assert.match(String(published.commit), /^[0-9a-f]{7,}$/u);
		assert.ok(!Number.isNaN(Date.parse(String(published.at))), 'the commit has no readable date');

		writeFileSync(join(space.root, 'projects.json'), '{"projects":[]}');
		const after = await state.readPublishedState(space.root);
		assert.equal(after.pending, 1);
		assert.equal(after.commit, published.commit);
	} finally {
		rmSync(space.keep, { recursive: true, force: true });
	}
});

test('ages read as words, and a missing date says so', () => {
	assert.equal(state.ago(undefined), 'at an unknown time');
	assert.equal(state.ago(new Date().toISOString()), 'just now');
	assert.equal(state.ago(new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()), '3 hours ago');
	assert.equal(state.ago(new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString()), 'yesterday');
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
console.log(`\n${cases.length - failed}/${cases.length} state cases passed`);
process.exit(failed === 0 ? 0 : 1);
