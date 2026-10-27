// Publishing, against a real git repository.
//
// The command writes to a branch other people and other machines also write to, and it writes to it with git. That is
// exactly the kind of code where "it compiles" means nothing: a missing parent makes the second publish fail, a forced
// push would erase someone's work, and a stray `checkout` would leave the project on the wrong branch. So this runs the
// real function against a real bare repository and asks git what happened.
//
// Not covered: the push *rejection* path (it needs the branch to move between this build's fetch and its push, which is a
// race, not a state) and anything GitHub itself does — `gh` is never invoked here.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import Module from 'node:module';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function gitIn(cwd: string, args: readonly string[]): string {
	// `safe.bareRepository` is `explicit` on some machines, which forbids `-C` into a bare repository; the check needs to
	// ask that repository what it holds, so the setting is lifted for these reads only.
	return execFileSync('git', ['-c', 'safe.bareRepository=all', '-C', cwd, ...args], {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'ignore']
	}).trim();
}

const root = mkdtempSync(join(tmpdir(), 'temco-publish-'));

function uri(fsPath: string) {
	return {
		fsPath,
		scheme: 'file',
		path: fsPath.split('\\').join('/'),
		toString: () => `file:///${fsPath.split('\\').join('/')}`
	};
}

const fakeVscode = {
	Uri: { file: uri, joinPath: (base: { fsPath: string }, ...parts: string[]) => uri(join(base.fsPath, ...parts)) },
	FileType: { File: 1, Directory: 2 },
	workspace: {
		fs: {
			createDirectory: async (target: { fsPath: string }) => mkdirSync(target.fsPath, { recursive: true }),
			readDirectory: async (target: { fsPath: string }) => {
				return readdirSync(target.fsPath, { withFileTypes: true }).map(entry => [entry.name, entry.isDirectory() ? 2 : 1]);
			},
			copy: async (from: { fsPath: string }, to: { fsPath: string }) => {
				mkdirSync(dirname(to.fsPath), { recursive: true });
				writeFileSync(to.fsPath, readFileSync(from.fsPath));
			},
			delete: async (target: { fsPath: string }, options: { recursive?: boolean }) => rmSync(target.fsPath, options)
		}
	},
	FileSystemError: class extends Error {}
};

const load = (Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = function (request: string, ...rest: unknown[]) {
	return request === 'vscode' ? fakeVscode : (load as (...args: unknown[]) => unknown).call(this, request, ...rest);
};

const built = fileURLToPath(new URL('../out/publish.js', import.meta.url));
const source = fileURLToPath(new URL('../src/publish.ts', import.meta.url));
assert.ok(existsSync(built), 'out/publish.js is missing — run `npm run compile` first');
assert.ok(
	statSync(built).mtimeMs >= statSync(source).mtimeMs,
	'out/publish.js is older than src/publish.ts'
);

const { publish } = createRequire(import.meta.url)(built) as {
	publish(
		target: { root: string; owner: string; repo: string; base: string; branch: string },
		site: unknown,
		output: { appendLine(line: string): void }
	): Promise<string | undefined>;
};

const quiet = { appendLine: () => undefined };

// A bare repository standing in for GitHub, and a project whose `origin` is it.
const bare = join(root, 'bare.git');
const project = join(root, 'project');
execFileSync('git', ['init', '--bare', '--quiet', bare]);
mkdirSync(project, { recursive: true });
gitIn(project, ['init', '--quiet']);
writeFileSync(join(project, 'readme.md'), '# Project\n');
gitIn(project, ['add', '--all']);
gitIn(project, ['-c', 'user.name=Check', '-c', 'user.email=check@example.com', 'commit', '--quiet', '-m', 'first']);
gitIn(project, ['remote', 'add', 'origin', bare]);

// A site to publish: two pages and a picture.
const site = join(root, 'site');
mkdirSync(join(site, 'a'), { recursive: true });
mkdirSync(join(site, 'a', 'media'), { recursive: true });
writeFileSync(join(site, 'index.html'), '<h1>One</h1>');
writeFileSync(join(site, 'a', 'page.html'), '<h1>Page</h1>');
writeFileSync(join(site, 'a', 'media', 'x.png'), 'png');

const target = { root: project, owner: 'owner', repo: 'repo', base: 'https://owner.github.io/repo/', branch: 'main' };
const projectBranch = gitIn(project, ['rev-parse', '--abbrev-ref', 'HEAD']);
const tempBefore = new Set(readdirSync(tmpdir()).filter(name => name.startsWith('temco-docs-')));

const cases: { name: string; run: () => Promise<void> }[] = [];
const test = (name: string, run: () => Promise<void>) => cases.push({ name, run });

test('the first publish creates the branch', async () => {
	assert.equal(await publish(target, uri(site), quiet), undefined);
	assert.equal(gitIn(bare, ['rev-parse', '--abbrev-ref', 'gh-pages']), 'gh-pages');
	const files = gitIn(bare, ['ls-tree', '-r', '--name-only', 'gh-pages']).split('\n');
	assert.deepEqual(files.sort(), ['a/media/x.png', 'a/page.html', 'index.html']);
	assert.equal(gitIn(bare, ['show', 'gh-pages:a/page.html']), '<h1>Page</h1>');
});

test('the project is left exactly where it was', async () => {
	assert.equal(gitIn(project, ['status', '--porcelain']), '');
	assert.equal(gitIn(project, ['rev-parse', '--abbrev-ref', 'HEAD']), projectBranch);
	assert.deepEqual(readdirSync(project).sort(), ['.git', 'readme.md']);
});

test('a second publish is a fast-forward, not a new history', async () => {
	const before = gitIn(bare, ['rev-parse', 'gh-pages']);
	const count = Number(gitIn(bare, ['rev-list', '--count', 'gh-pages']));
	writeFileSync(join(site, 'index.html'), '<h1>Two</h1>');
	assert.equal(await publish(target, uri(site), quiet), undefined);
	assert.equal(Number(gitIn(bare, ['rev-list', '--count', 'gh-pages'])), count + 1);
	// The new tip's parent is the commit that was there before. Had this been an orphan, it would have no parent at all.
	assert.equal(gitIn(bare, ['rev-parse', 'gh-pages~1']), before);
	assert.equal(gitIn(bare, ['show', 'gh-pages:index.html']), '<h1>Two</h1>');
});

test('a page deleted from the site disappears from the branch', async () => {
	rmSync(join(site, 'a', 'page.html'));
	assert.equal(await publish(target, uri(site), quiet), undefined);
	const files = gitIn(bare, ['ls-tree', '-r', '--name-only', 'gh-pages']).split('\n');
	assert.deepEqual(files.sort(), ['a/media/x.png', 'index.html']);
});

test('the throwaway repository is cleaned up', async () => {
	const leftovers = readdirSync(tmpdir()).filter(name => name.startsWith('temco-docs-') && !tempBefore.has(name));
	assert.deepEqual(leftovers, [], `left behind: ${leftovers.join(', ')}`);
});

let failed = 0;
try {
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
} finally {
	rmSync(root, { recursive: true, force: true });
}
console.log(`\n${cases.length - failed}/${cases.length} publish cases passed`);
process.exit(failed === 0 ? 0 : 1);
