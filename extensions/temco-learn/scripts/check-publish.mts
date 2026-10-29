// Publishing, checked without a network.
//
// What a publish depends on is the folder's own repository: which repository it is, and the address GitHub Pages serves
// it at. Both are decided from the remote and nothing else, so both are checkable against a throwaway repository with a
// fake `origin` — no account, no push, no network.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

interface Publish {
	publishingTarget(root: string): Promise<{ owner: string; repo: string; base: string } | undefined>;
	publishSite(root: string, output: { appendLine(text: string): void }): Promise<unknown>;
}

const source = fileURLToPath(new URL('../src/publish.ts', import.meta.url));
const built = fileURLToPath(new URL('../out/publish.js', import.meta.url));

try {
	assert.ok(statSync(built).mtimeMs >= statSync(source).mtimeMs, 'out/publish.js is older than src/publish.ts');
} catch (error) {
	console.log(`Cannot run: ${(error as Error).message}`);
	console.log('Compile first:  npm run compile');
	process.exit(1);
}

const { publishingTarget, publishSite } = createRequire(import.meta.url)(built) as Publish;

/** A throwaway repository whose `origin` is `remote`. */
function repository(remote: string | undefined): string {
	const folder = mkdtempSync(join(tmpdir(), 'temco-publish-'));
	execFileSync('git', ['init', '-q', folder], { stdio: 'ignore' });
	execFileSync('git', ['-C', folder, 'config', 'user.name', 'Check'], { stdio: 'ignore' });
	if (remote !== undefined) {
		execFileSync('git', ['-C', folder, 'remote', 'add', 'origin', remote], { stdio: 'ignore' });
	}
	writeFileSync(join(folder, 'index.html'), '<!doctype html><title>site</title>');
	return folder;
}

const cases: { name: string; run: () => Promise<void> }[] = [];
const test = (name: string, run: () => Promise<void>) => cases.push({ name, run });

test('a project repository publishes under its own name', async () => {
	const folder = repository('https://github.com/temcocontrols/docs.git');
	try {
		const target = await publishingTarget(folder);
		// `git rev-parse` answers with forward slashes, whatever the platform: the address, not the path, is the point.
		assert.equal(target?.owner, 'temcocontrols');
		assert.equal(target?.repo, 'docs');
		assert.equal(target?.base, 'https://temcocontrols.github.io/docs/');
	} finally {
		rmSync(folder, { recursive: true, force: true });
	}
});

test('an owner site publishes at the domain root', async () => {
	const folder = repository('git@github.com:temcocontrols/temcocontrols.github.io.git');
	try {
		const target = await publishingTarget(folder);
		assert.equal(target?.base, 'https://temcocontrols.github.io/');
	} finally {
		rmSync(folder, { recursive: true, force: true });
	}
});

test('a repository with no remote is not publishable, and says so', async () => {
	const folder = repository(undefined);
	try {
		assert.equal(await publishingTarget(folder), undefined);
		await assert.rejects(
			() => publishSite(folder, { appendLine: () => undefined }),
			/is not a git repository with a GitHub `origin`/u
		);
	} finally {
		rmSync(folder, { recursive: true, force: true });
	}
});

test('a folder that is not a repository at all is not publishable either', async () => {
	const folder = mkdtempSync(join(tmpdir(), 'temco-plain-'));
	try {
		assert.equal(await publishingTarget(folder), undefined);
	} finally {
		rmSync(folder, { recursive: true, force: true });
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
console.log(`\n${cases.length - failed}/${cases.length} publish cases passed`);
process.exit(failed === 0 ? 0 : 1);
