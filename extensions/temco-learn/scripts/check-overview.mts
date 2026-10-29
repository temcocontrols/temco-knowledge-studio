// The Overview page's own contract: what it says, in what order, and what it refuses to be.
//
// The page is the one place a newcomer is told what this module is, so its words are checked rather than left to drift:
// the sentences first (counted from the data, naming no project), the one callout, four workflow steps each ending in a
// link, and three sections that describe — a title with the brand bar, a sentence, one link — instead of listing what the
// panel already lists. The last case is the boundary that was crossed once already: this is our page, not a page of the
// website.

import assert from 'node:assert/strict';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';

interface OverviewModule {
	html(state: unknown): string;
	PAGE_STYLE: string;
	OVERVIEW_VIEW_TYPE: string;
}

/** The kit, rendered the way the page uses it — enough markup to read the result, no styling. */
const esc = (text: string) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface HeroOptions {
	eyebrow?: string;
	title: string;
	desc?: string;
	note?: { text: string; link?: { command: string } };
	actions?: readonly { label: string; command: string; kind?: string }[];
	stats?: readonly unknown[];
}

const ui = {
	pageColumn: () => -1,
	page: (body: string) => body,
	escapeHtml: esc,
	icon: (name: string) => `[${name}]`,
	toneMark: (name: string) => `[${name}]`,
	hero: (options: HeroOptions) => {
		const actions = (options.actions ?? []).map((action) => `<button data-command="${action.command}">${esc(action.label)}</button>`).join('');
		const note = options.note === undefined ? '' : `<p class="az-note">${esc(options.note.text)}</p>`;
		const stats = options.stats === undefined ? '' : '<div class="az-lead__stats"></div>';
		return `<div class="az-wash"><p class="az-crumbs">${esc(options.eyebrow ?? '')}</p><h1 class="az-title">${esc(options.title)}</h1><p class="az-intro">${esc(options.desc ?? '')}</p>${note}${stats}<div class="az-row">${actions}</div></div>`;
	},
	optionCards: (items: readonly { tag?: string; title: string; desc: string; ticks: readonly string[]; label: string; command: string }[]) =>
		`<div class="az-options">${items
			.map(
				(item) =>
					`<section class="az-option"><span class="az-option__tag">${esc(item.tag ?? '')}</span><h2 class="az-option__title">${esc(item.title)}</h2><p class="az-option__desc">${esc(item.desc)}</p><ul class="az-option__ticks">${item.ticks.map((tick) => `<li>${esc(tick)}</li>`).join('')}</ul><button data-command="${item.command}">${esc(item.label)}</button></section>`
			)
			.join('')}</div>`,
	callout: (options: { title: string; desc: string; actions?: string }) =>
		`<aside class="az-callout"><p class="az-callout__title">${esc(options.title)}</p><p class="az-callout__desc">${esc(options.desc)}</p><div class="az-callout__actions">${options.actions ?? ''}</div></aside>`,
	section: (options: { title: string; desc?: string; actions?: string }) =>
		`<div class="az-section"><h2 class="az-section__title">${esc(options.title)}</h2>${options.desc === undefined ? '' : `<p class="az-section__desc">${esc(options.desc)}</p>`}${options.actions ?? ''}</div>`,
	entryRow: (options: { title: string; meta?: string; command?: string; args?: unknown; go?: string }) =>
		`<div class="az-entry"${options.command === undefined ? '' : ` data-command="${options.command}"`}${options.args === undefined ? '' : ` data-args="${esc(JSON.stringify(options.args))}"`}><span class="az-entry__title">${esc(options.title)}</span><span class="az-entry__meta">${esc(options.meta ?? '')}</span><span class="az-entry__go">${esc(options.go ?? '')}</span></div>`,
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
	workspace: {
		workspaceFolders: [],
		getConfiguration: () => ({ get: (name: string) => (name === 'workspaceFolder' ? 'C:/Temco' : undefined) })
	}
};

const load = Module._load;
Module._load = function (request: string, parent: unknown, isMain: boolean) {
	if (request === 'vscode') {
		return vscode;
	}
	return load.call(this as unknown as NodeModule, request, parent, isMain);
};

const overview = createRequire(import.meta.url)(fileURLToPath(new URL('../out/overview.js', import.meta.url))) as OverviewModule;

const cases: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => cases.push({ name, run });

/** A website with two projects, one build waiting, three unpublished changes, and the outputs of those builds. */
function state(overrides: { projects?: unknown[]; builds?: unknown[]; artifacts?: unknown[]; pending?: number; published?: unknown } = {}): unknown {
	return {
		site: {
			projects: overrides.projects ?? [
				{ id: 't3000', title: 'T3000', section: 'documentation', versions: [{ version: '13.0', pages: [{ href: 'a', title: 'A' }, { href: 'b', title: 'B' }] }, { version: '12.9', pages: [{ href: 'c', title: 'C' }] }], builtAt: new Date().toISOString() },
				{ id: 'bacnet', title: 'BACnet', section: 'documentation', versions: [{ version: '4.2', pages: [{ href: 'd', title: 'D' }] }], builtAt: new Date().toISOString() }
			]
		},
		builds: overrides.builds ?? [{ folder: 'C:/Temco/nettools/dist/site', title: 'NetTools', id: 'nettools', at: Date.now() }],
		artifacts: overrides.artifacts ?? [
			{
				title: 'T3000', id: 't3000', folder: 'C:/Temco/t3000', builtAt: new Date().toISOString(),
				artifacts: [
					{ kind: 'site', file: 'C:/Temco/t3000/dist/site', label: 'the website', opens: 'editor', size: undefined, at: Date.now() },
					{ kind: 'chm', file: 'C:/Temco/HelpDocs/T3000.chm', label: 'offline help', opens: 'external', size: 1153434, at: Date.now() },
					{ kind: 'zip', file: 'C:/Temco/t3000/dist/T3000-site.zip', label: 'an archive', opens: undefined, size: 4404019, at: Date.now() }
				]
			}
		],
		published: overrides.published ?? {
			where: 'temcocontrols/docs',
			base: 'https://temcocontrols.github.io/docs/',
			commit: '6f2c1ab',
			at: new Date(Date.now() - 12 * 60e3).toISOString(),
			pending: overrides.pending ?? 3
		}
	};
}

/** Nothing at all: no project, no build, no file, no repository. */
const empty = { projects: [], builds: [], artifacts: [], pending: 0, published: { where: undefined, base: undefined, commit: undefined, at: undefined, pending: 0 } };

test('the page opens by saying what this module is, counting from the data and naming no project', () => {
	const html = overview.html(state());
	assert.match(html, /Temco Learn publishes the documentation website\./u);
	assert.match(html, /2 projects are published today, 3 versions and 4 pages between them\./u);
	assert.doesNotMatch(html, /T3000|BACnet/u, 'the page writes project names into its prose');
	assert.equal(html.includes('az-lead__stats'), false, 'the page opens on a row of figures');
	assert.equal(html.includes('az-numbers'), false, 'the page draws a row of numbers');
});

test('the workflow is four steps, in order, each ending in a link with a glyph', () => {
	const html = overview.html(state());
	assert.match(html, /Publishing workflow/u);
	const steps = [...html.matchAll(/az-option__tag">(\d)<\/span><h2 class="az-option__title">([^<]+)</gu)].map((match) => `${match[1]}:${match[2]}`);
	assert.deepEqual(steps, ['1:Build', '2:Add', '3:Publish', '4:Download']);
	assert.match(html, /data-command="temcoDocs\.builds"/u);
	assert.match(html, /data-command="temcoLearn\.addBuilds"/u);
	assert.match(html, /data-command="temcoLearn\.publish"/u);
	assert.match(html, /data-command="temcoLearn\.revealArtifact"/u);
	assert.match(html, /Open Temco Docs/u);
	assert.match(html, /Choose a build · 1 waiting/u);
	assert.match(html, /Publish · 3 changes/u);
	assert.match(html, /Show in the folder/u);
});

test('the three sections describe rather than list: a title, a sentence and one link each', () => {
	const html = overview.html(state());
	for (const title of ['Published projects', 'Build outputs', 'Publication']) {
		assert.ok(html.includes(title), `${title} is missing`);
	}
	assert.equal(html.includes('az-entry'), false, 'the page still draws a list of rows');
	assert.equal(html.includes('az-record'), false, 'the page still draws a list of records');
	assert.match(html, /2 projects are published in Documentation, 3 versions and 4 pages between them\./u);
	assert.match(html, /the newest build wrote 3 files/u);
	assert.match(html, /temcocontrols\.github\.io\/docs · branch gh-pages · last publish 6f2c1ab, 12 min ago\./u);
	assert.match(html, /Open the website/u);
	assert.match(html, /Open in browser/u);
});

test('the callout says what needs doing, or that nothing does, or that nothing exists yet', () => {
	const busy = overview.html(state());
	assert.match(busy, /What needs doing/u);
	assert.match(busy, /1 build on disk is not on the website · 3 changes are not published\./u);
	const idle = overview.html(state({ builds: [], pending: 0 }));
	assert.match(idle, /Nothing needs doing/u);
	const nothing = overview.html(state(empty));
	assert.match(nothing, /Nothing has been built yet/u);
	assert.match(nothing, /Nothing is published yet\./u);
	assert.match(nothing, /No build output was found\./u);
	assert.match(nothing, /there is nowhere to publish to yet/u);
});

test('every section title carries the brand bar, and the cards sit four in a row', () => {
	assert.match(overview.PAGE_STYLE, /\.az-section__title \{ border-left: 3px solid var\(--az-blue/u);
	assert.match(overview.PAGE_STYLE, /\.az-options \{ grid-template-columns: repeat\(auto-fit, minmax\(215px, 1fr\)\)/u);
});

test('the page is the application’s, not the website’s', () => {
	const html = overview.html(state());
	assert.doesNotMatch(html, /overview\.html|reader\.html|assets\/site\.css/u, 'the page reaches into the published website');
	assert.doesNotMatch(html, /<a [^>]*href=/u, 'the page links instead of running a command');
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
console.log(`\n${cases.length - failed}/${cases.length} overview cases passed`);
process.exit(failed === 0 ? 0 : 1);
