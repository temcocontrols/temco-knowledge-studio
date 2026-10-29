// The app's own contract: the files, and the elements its script reaches for.
//
// The site app is plain HTML, two stylesheets and one script, served as written — there is no per-page build step that
// would catch a page whose script was renamed, or a script asking for an element a page no longer has. That is what this
// checks: every page loads the script, the reader loads its own stylesheet, every element the script looks up exists in
// the page that provides it, and nothing in the app is addressed from the root, because the published site lives in a
// subfolder.
//
// The script is TypeScript (`src/siteApp.ts`) and only becomes `assets/site.js` when the site is installed, so the checks
// run against the source and against the built `out/siteApp.js` — the file a browser actually receives.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const module = fileURLToPath(new URL('..', import.meta.url));
const app = join(module, 'site');
const read = (file: string) => readFileSync(join(app, file), 'utf8');
const script = readFileSync(join(module, 'src', 'siteApp.ts'), 'utf8');
const built = join(module, 'out', 'siteApp.js');
const pages = ['index.html', 'project.html', 'reader.html'] as const;

/** The elements each page provides, by id: the script looks these up and would otherwise draw nothing. */
const ELEMENTS: Record<(typeof pages)[number], readonly string[]> = {
	'index.html': ['tabs', 'wrap'],
	'project.html': ['tabs', 'wrap'],
	'reader.html': ['product', 'version', 'search', 'nav-head', 'nav-list', 'crumbs', 'page', 'prev', 'next', 'headings', 'foot', 'count']
};

const cases: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => cases.push({ name, run });

test('every page loads the app script and says which page it is', () => {
	for (const page of pages) {
		const html = read(page);
		assert.match(html, /<script src="assets\/site\.js"><\/script>/u, `${page} does not load the app script`);
		assert.match(html, /<body data-page="/u, `${page} does not say which page it is`);
	}
});

test('the portal pages and the reader load the stylesheets that dress them', () => {
	for (const page of ['index.html', 'project.html'] as const) {
		assert.match(read(page), /<link rel="stylesheet" href="assets\/site\.css">/u, `${page} has no stylesheet`);
	}
	const reader = read('reader.html');
	assert.match(reader, /href="assets\/site\.css"/u, 'the reader lost the shared tokens');
	assert.match(reader, /href="assets\/reader\.css"/u, 'the reader lost its own layout');
});

test('the script only looks up elements the pages provide', () => {
	const provided = new Set(Object.values(ELEMENTS).flat());
	for (const match of script.matchAll(/(?:getElementById|need(?:<[^>]+>)?)\(\s*'([^']+)'/g)) {
		const id = match[1];
		// The search box and the rows are drawn by the script itself, so they are not in the page's markup.
		if (id === 'q') {
			continue;
		}
		assert.ok(provided.has(id), `siteApp.ts reaches for #${id}, which no page has`);
	}
	for (const [page, ids] of Object.entries(ELEMENTS)) {
		for (const id of ids) {
			assert.match(read(page), new RegExp(`id="${id}"`, 'u'), `${page} has no #${id}`);
		}
	}
});

test('the site folder carries no JavaScript of its own: the script is built from TypeScript', () => {
	assert.ok(existsSync(join(module, 'src', 'siteApp.ts')), 'the app script has no source');
	assert.equal(existsSync(join(app, 'assets', 'site.js')), false, 'site/assets/site.js is built into the site folder, never kept here');
});

test('the built script is a classic script a page can load, and it parses', () => {
	assert.ok(existsSync(built), 'out/siteApp.js is missing: build the module before checking the app');
	const code = readFileSync(built, 'utf8');
	execFileSync(process.execPath, ['--check', built], { stdio: 'pipe' });
	assert.doesNotMatch(code, /Object\.defineProperty\(exports|exports\.\w+\s*=|\brequire\(/u, 'the built script is a module, not a page script');
	assert.match(code, /^'use strict';/mu, 'the built script is not strict');
});

test('the brand on every page goes back to the first section, and the site carries nothing about managing it', () => {
	for (const page of pages) {
		assert.match(read(page), /(?:bar__brand|r-brand)" href="index\.html"/u, `${page} has no way back to Documentation`);
		assert.doesNotMatch(read(page), /overview\.html/u, `${page} sends a reader to an application page`);
	}
});

test('nothing in the app is addressed from the root, because the site lives in a subfolder', () => {
	for (const file of [...pages, join('assets', 'reader.css')]) {
		const text = read(file);
		assert.doesNotMatch(text, /(?:href|src)="\/(?!\/)/u, `${file} links to the server's root`);
		assert.doesNotMatch(text, /file:\/\//u, `${file} assumes a file:// origin`);
	}
	assert.doesNotMatch(script, /127\.0\.0\.1|localhost/u, 'the app names a host of its own');
});

test('the site has the six sections a reader looks for, Documentation first', () => {
	const found = [...script.matchAll(/\n\t\tid: '([a-z]+)',/g)].map((match) => match[1]);
	assert.deepEqual(found, ['documentation', 'training', 'tests', 'products', 'qa', 'topics']);
});

test('the app reads its data from the file it is published beside', () => {
	assert.match(script, /fetch\('projects\.json'/u, 'the app does not read projects.json');
	assert.doesNotMatch(script, /\.\.\//u, 'the app climbs out of its own folder');
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
console.log(`\n${cases.length - failed}/${cases.length} app cases passed`);
process.exit(failed === 0 ? 0 : 1);
