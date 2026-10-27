// The panel strip, checked as the thing a reader sees.
//
// Two failures matter here and neither is a compile error: a button whose command does not exist (dead on click, no
// message) and a project name that reaches the page as markup. Both are checked against the manifest and the text, so this
// runs without an editor — and the counts are checked because "0 pages" reads as a bug, "no pages yet" reads as an answer.

import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import Module from 'node:module';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// The module holds the view provider as well as the renderer, so `require`ing it needs the editor's own API. The tests
// below only reach the renderer, which never touches it — an empty stand-in is enough, and it keeps the check honest
// about what it is testing.
const stub = {
	window: { registerWebviewViewProvider: () => ({ dispose() { } }), showQuickPick: async () => undefined },
	commands: { executeCommand: async () => undefined },
	Uri: { file: (fsPath: string) => ({ fsPath }), joinPath: (base: { fsPath: string }, ...parts: string[]) => ({ fsPath: parts.join('/') }) },
	ProgressLocation: { Notification: 15 },
	ViewColumn: { Beside: -2 }
};
const load = (Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = function (request: string, ...rest: unknown[]) {
	return request === 'vscode' ? stub : (load as (...args: unknown[]) => unknown).call(this, request, ...rest);
};

interface PanelModule {
	panelHtml(state: unknown, nonce: string): string;
	escapeHtml(text: string): string;
	nonce(): string;
}

const built = fileURLToPath(new URL('../out/panelView.js', import.meta.url));
const source = fileURLToPath(new URL('../src/panelView.ts', import.meta.url));
assert.ok(statSync(built).mtimeMs >= statSync(source).mtimeMs, 'out/panelView.js is older than src/panelView.ts');

const { panelHtml, escapeHtml, nonce } = createRequire(import.meta.url)(built) as PanelModule;

const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')) as {
	contributes?: { commands?: { command?: string }[] };
};
const declared = new Set((manifest.contributes?.commands ?? []).map(entry => entry.command));

const withProject = {
	project: { name: 'Temco Handbook', version: '1.4.2', sources: 2, builtAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString() },
	pages: 148,
	issues: 3,
	unshipped: 0,
	owed: 2
};

const cases: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => cases.push({ name, run });

test('every button names a command the manifest declares', () => {
	const html = panelHtml(withProject, 'NONCE1234567890ABCDEFGH');
	const commands = [...html.matchAll(/data-command="([^"]+)"/gu)].map(match => match[1]);
	assert.ok(commands.length >= 5, `expected the panel's buttons, found ${commands.length}`);
	for (const command of commands) {
		assert.ok(declared.has(command), `${command} is not declared in contributes.commands`);
	}
});

test('the project name is text, never markup', () => {
	const html = panelHtml({ ...withProject, project: { name: '<script>alert(1)</script>', sources: 0 } }, 'NONCE1234567890ABCDEFGH');
	assert.ok(!html.includes('<script>alert(1)</script>'), 'the name reached the page unescaped');
	assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});

test('counts are phrased the way a person says them', () => {
	const none = panelHtml({ ...withProject, pages: 0, issues: 0 }, 'NONCE1234567890ABCDEFGH');
	assert.ok(none.includes('no pages'), 'zero pages should read as "no pages"');
	assert.ok(none.includes('no issues'));
	const one = panelHtml({ ...withProject, pages: 1, issues: 1 }, 'NONCE1234567890ABCDEFGH');
	assert.match(one, /1 page(?!s)/u, 'one page should be singular');
	assert.match(one, /1 issue(?!s)/u, 'one issue should be singular');
	const many = panelHtml(withProject, 'NONCE1234567890ABCDEFGH');
	assert.ok(many.includes('148 pages'));
});

test('no project says what to do, and still offers the way there', () => {
	const html = panelHtml({ pages: 0, issues: 0, unshipped: 0, owed: 0 }, 'NONCE1234567890ABCDEFGH');
	assert.ok(html.includes('No project'));
	assert.ok(html.includes('Home'));
});

test('nothing is loaded from anywhere', () => {
	const html = panelHtml(withProject, 'NONCE1234567890ABCDEFGH');
	assert.ok(!/https?:\/\//u.test(html), 'the panel must not reference the network');
	assert.ok(!/<link\b/u.test(html), 'the panel must not link a stylesheet');
	assert.ok(!/<img\b/u.test(html), 'the panel must not load an image');
});

test('the policy allows one nonce, and the script carries it', () => {
	const value = nonce();
	assert.equal(value.length, 24);
	const html = panelHtml(withProject, value);
	assert.match(html, /Content-Security-Policy" content="default-src 'none'/u);
	assert.ok(html.includes(`script-src 'nonce-${value}'`), 'the script policy does not name the nonce');
	assert.ok(html.includes(`<script nonce="${value}">`), 'the script does not carry the nonce');
	assert.notEqual(nonce(), value, 'two panels must not share a nonce');
});

test('a build that never happened says so', () => {
	const html = panelHtml({ ...withProject, project: { name: 'Temco', sources: 1 } }, 'NONCE1234567890ABCDEFGH');
	assert.ok(html.includes('never built'));
	const recent = panelHtml(withProject, 'NONCE1234567890ABCDEFGH');
	assert.ok(recent.includes('built 3 h ago'), 'a three-hour-old build should read as hours');
});

test('the find button is the only element that does not run a command', () => {
	const html = panelHtml(withProject, 'NONCE1234567890ABCDEFGH');
	assert.equal((html.match(/data-type="find"/gu) ?? []).length, 1);
	assert.ok(html.includes('Find a page'));
});

test('the script acquires the editor API exactly once', () => {
	const html = panelHtml(withProject, 'NONCE1234567890ABCDEFGH');
	// `acquireVsCodeApi()` throws on the second call, which would leave every button dead — and no compile or DOM-less
	// test notices. One call, one bus.
	assert.equal((html.match(/acquireVsCodeApi\(\)/gu) ?? []).length, 1);
});

test('escaping covers the characters that break out', () => {
	assert.equal(escapeHtml('a & b <c> "d"'), 'a &amp; b &lt;c&gt; &quot;d&quot;');
});

let failed = 0;
for (const { name, run } of cases) {
	try {
		run();
		console.log(`  ok  ${name}`);
	} catch (error) {
		failed += 1;
		console.error(`FAIL  ${name}`);
		console.error(error instanceof Error ? error.message : error);
	}
}
console.log(`\n${cases.length - failed}/${cases.length} panel cases passed`);
process.exit(failed === 0 ? 0 : 1);
