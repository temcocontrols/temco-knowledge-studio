// The two pages behind a row: Publishing, and Downloads.
//
// Neither page decides anything — they are given the facts and say them — so the checks are about the words: that
// Publishing names the branch and the address and shows the last attempt's lines, and that Downloads names what a build
// writes even when the machine holds nothing.

import assert from 'node:assert/strict';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';

interface PageModule<T> {
	html(state: T): string;
	[kind: string]: unknown;
}

/** The kit, rendered the way the pages use it — enough markup to read the result, no styling. */
const esc = (text: string) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ui = {
	pageColumn: () => -1,
	page: (body: string) => body,
	escapeHtml: esc,
	icon: (name: string) => `[${name}]`,
	toneMark: (name: string) => `[${name}]`,
	hero: (options: { title: string; desc?: string; note?: { text: string } }) =>
		`<h1 class="az-title">${esc(options.title)}</h1><p class="az-intro">${esc(options.desc ?? '')}</p>${options.note === undefined ? '' : `<p class="az-note">${esc(options.note.text)}</p>`}`,
	cards: (items: readonly { title: string; desc: string; mark?: string; command?: string; go?: string; note?: string }[]) =>
		`<div class="az-cards">${items
			.map(
				(item) =>
					`<div class="az-card"><span class="az-card__title">${esc(item.title)}</span><p class="az-card__desc">${esc(item.desc)}</p>${
						item.note === undefined ? '' : `<p class="az-card__note">${esc(item.note)}</p>`
					}${item.command === undefined ? '' : `<span class="az-card__go" data-command="${esc(item.command)}">${esc(item.go ?? 'Open')}</span>`}</div>`
			)
			.join('')}</div>`,
	code: (options: { language: string; lines: readonly { text: string }[] }) =>
		`<div class="az-code"><span class="az-code__language">${esc(options.language)}</span><pre class="az-code__body">${options.lines
			.map((line) => `<span class="az-code__line">${esc(line.text)}</span>`)
			.join('')}</pre></div>`,
	callout: (options: { title: string; desc: string; actions?: string }) =>
		`<aside class="az-callout"><p class="az-callout__title">${esc(options.title)}</p><p class="az-callout__desc">${esc(options.desc)}</p>${
			options.actions ?? ''
		}</aside>`,
	section: (options: { title: string; desc?: string }) =>
		`<div class="az-section"><h2 class="az-section__title">${esc(options.title)}</h2>${options.desc === undefined ? '' : `<p class="az-section__desc">${esc(options.desc)}</p>`}</div>`,
	entryRow: (options: { title: string; meta?: string; command?: string; args?: unknown; go?: string }) =>
		`<div class="az-entry"${options.command === undefined ? '' : ` data-command="${esc(options.command)}"`}><span class="az-entry__title">${esc(options.title)}</span><span class="az-entry__meta">${esc(
			options.meta ?? ''
		)}</span></div>`,
	commandScript: '',
	runCommand: () => undefined
};

const vscode = {
	ViewColumn: { Active: -1 },
	ThemeIcon: class {
		id: string;
		constructor(id: string) {
			this.id = id;
		}
	},
	extensions: { getExtension: () => ({ isActive: true, exports: ui }) },
	window: { createWebviewPanel: () => { throw new Error('not opened by a check'); } },
	workspace: { workspaceFolders: [], getConfiguration: () => ({ get: (name: string) => (name === 'workspaceFolder' ? 'C:/Temco' : undefined) }) }
};

const load = Module._load;
Module._load = function (request: string, parent: unknown, isMain: boolean) {
	if (request === 'vscode') {
		return vscode;
	}
	return load.call(this as unknown as NodeModule, request, parent, isMain);
};

const require_ = createRequire(import.meta.url);
const publishing = require_(fileURLToPath(new URL('../out/publishPage.js', import.meta.url))) as PageModule<unknown>;
const downloads = require_(fileURLToPath(new URL('../out/downloadPage.js', import.meta.url))) as PageModule<unknown>;

const cases: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => cases.push({ name, run });

const published = {
	where: 'temcocontrols/docs',
	base: 'https://temcocontrols.github.io/docs/',
	commit: '6f2c1ab',
	at: new Date(Date.now() - 12 * 60e3).toISOString(),
	pending: 3,
	log: ['[publish] 4 path(s) to commit', '[publish] pushing 6f2c1ab to temcocontrols/docs@gh-pages'],
	logAt: new Date(Date.now() - 12 * 60e3).toISOString()
};

test('Publishing names the branch, the address and what is waiting', () => {
	const html = publishing.html(published);
	assert.match(html, /Publishing/u);
	assert.match(html, /gh-pages branch of temcocontrols\/docs/u);
	assert.match(html, /https:\/\/temcocontrols\.github\.io\/docs\//u);
	assert.match(html, /3 changes are waiting|3 changes waiting/u);
	assert.match(html, /6f2c1ab/u);
});

test('Publishing shows the four steps, each with the act that performs it', () => {
	const html = publishing.html(published);
	for (const step of ['Build', 'Add', 'Publish', 'Check']) {
		assert.ok(html.includes(step), `${step} is missing from the steps`);
	}
	for (const command of ['temcoDocs.builds', 'temcoLearn.addBuilds', 'temcoLearn.publish', 'temcoLearn.openPublished']) {
		assert.match(html, new RegExp(`data-command="${command.replace(/\./gu, '\\.')}"`, 'u'));
	}
});

test('Publishing says what the last attempt printed, or that nothing has run', () => {
	assert.match(publishing.html(published), /pushing 6f2c1ab to temcocontrols\/docs@gh-pages/u);
	assert.match(publishing.html(published), /Publish log/u);
	const quiet = publishing.html({ ...published, commit: undefined, base: undefined, where: undefined, at: undefined, pending: 0, log: [], logAt: undefined });
	assert.match(quiet, /No publish has run in this window yet/u);
	assert.match(quiet, /Never published/u);
	assert.match(quiet, /there is nowhere to publish to/u);
});

test('Downloads names what a build writes even when the machine holds nothing', () => {
	const html = downloads.html({ projects: [], root: 'C:/Temco' });
	for (const kind of ['The website', 'Offline help', 'A pdf', 'An archive', 'A Word document']) {
		assert.ok(html.includes(kind), `${kind} is missing`);
	}
	assert.match(html, /No file to take yet/u);
	assert.match(html, /dist/u);
	assert.match(html, /HelpDocs/u);
});

test('Downloads lists the files it was given, and nothing it was not', () => {
	const html = downloads.html({
		root: 'C:/Temco',
		projects: [
			{
				title: 'T3000',
				id: 't3000',
				folder: 'C:/Temco/t3000',
				artifacts: [{ kind: 'zip', file: 'C:/Temco/t3000/dist/T3000-site.zip', label: 'an archive', opens: undefined, size: 4404019, at: Date.now() }]
			}
		]
	});
	assert.match(html, /T3000-site\.zip/u);
	assert.match(html, /4\.2 MB/u);
	assert.doesNotMatch(html, /No file to take yet/u);
	assert.match(html, /data-command="temcoLearn\.downloadArtifact"/u);
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
console.log(`\n${cases.length - failed}/${cases.length} page cases passed`);
process.exit(failed === 0 ? 0 : 1);
