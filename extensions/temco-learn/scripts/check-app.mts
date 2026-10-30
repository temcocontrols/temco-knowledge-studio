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
const pages = ['index.html', 'reader.html'] as const;

/** The one page a bundle draws: it has no elements of its own beyond the mount point. */
const BUNDLED = 'project.html';

/** The elements each page provides, by id: the script looks these up and would otherwise draw nothing. */
const ELEMENTS: Record<(typeof pages)[number], readonly string[]> = {
	'index.html': ['tabs', 'wrap'],
	'reader.html': ['product', 'version', 'search', 'nav-head', 'nav-list', 'crumbs', 'page', 'prev', 'next', 'headings', 'foot', 'count']
};

const cases: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => cases.push({ name, run });

test('every page loads its script and says which page it is', () => {
	for (const page of pages) {
		const html = read(page);
		assert.match(html, /<script src="assets\/site\.js"><\/script>/u, `${page} does not load the app script`);
		assert.match(html, /<body data-page="/u, `${page} does not say which page it is`);
	}
	// The project view is a bundle with its own mount point and no elements to look up.
	const project = read(BUNDLED);
	assert.match(project, /<script src="assets\/preview\.js"><\/script>/u, 'project.html does not load the project view');
	assert.match(project, /<div id="root"><\/div>/u, 'project.html has no mount point');
	assert.match(project, /<body data-page="project">/u, 'project.html does not say which page it is');
});

test('the pages load the stylesheets that dress them', () => {
	for (const page of ['index.html', BUNDLED] as const) {
		assert.match(read(page), /href="assets\/site\.css"/u, `${page} has no stylesheet`);
	}
	assert.match(read(BUNDLED), /href="assets\/preview\.css"/u, 'the project view has no stylesheet');
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

test('the site folder carries no JavaScript of its own: both scripts are built from TypeScript', () => {
	assert.ok(existsSync(join(module, 'src', 'siteApp.ts')), 'the app script has no source');
	assert.ok(existsSync(join(module, 'webview', 'preview', 'main.tsx')), 'the project view has no source');
	assert.equal(existsSync(join(app, 'assets', 'site.js')), false, 'site/assets/site.js is built into the site folder, never kept here');
	assert.equal(existsSync(join(app, 'assets', 'preview.js')), false, 'site/assets/preview.js is copied in at install, never kept here');
});

test('the built script is a classic script a page can load, and it parses', () => {
	assert.ok(existsSync(built), 'out/siteApp.js is missing: build the module before checking the app');
	const code = readFileSync(built, 'utf8');
	execFileSync(process.execPath, ['--check', built], { stdio: 'pipe' });
	assert.doesNotMatch(code, /Object\.defineProperty\(exports|exports\.\w+\s*=|\brequire\(/u, 'the built script is a module, not a page script');
	assert.match(code, /^'use strict';/mu, 'the built script is not strict');
});

test('every page goes back to Documentation, and the site carries nothing about managing it', () => {
	for (const page of pages) {
		assert.match(read(page), /(?:bar__brand|r-brand)" href="index\.html"/u, `${page} has no way back to Documentation`);
		assert.doesNotMatch(read(page), /overview\.html/u, `${page} sends a reader to an application page`);
	}
	// The project view's way back is drawn by the bundle, so the page is held to the address it loads.
	assert.match(read(BUNDLED), /<script src="assets\/preview\.js"><\/script>/u, 'project.html loads no view at all');
	assert.doesNotMatch(read(BUNDLED), /overview\.html/u, 'project.html sends a reader to an application page');
});

test('nothing in the app is addressed from the root, because the site lives in a subfolder', () => {
	for (const file of [...pages, BUNDLED, join('assets', 'reader.css')]) {
		const text = read(file);
		assert.doesNotMatch(text, /(?:href|src)="\/(?!\/)/u, `${file} links to the server's root`);
		assert.doesNotMatch(text, /file:\/\//u, `${file} assumes a file:// origin`);
	}
	assert.doesNotMatch(script, /127\.0\.0\.1|localhost/u, 'the app names a host of its own');
	const view = readFileSync(join(module, 'webview', 'preview', 'main.tsx'), 'utf8');
	assert.doesNotMatch(view, /127\.0\.0\.1|localhost/u, 'the project view names a host of its own');
	assert.doesNotMatch(readFileSync(join(module, 'webview', 'preview', 'preview.css'), 'utf8'), /url\(\s*['"]?\//u, 'the project view reaches for the root');
});

test('the site has the six sections a reader looks for, Documentation first', () => {
	const found = [...script.matchAll(/\n\t\tid: '([a-z]+)',/g)].map((match) => match[1]);
	assert.deepEqual(found, ['documentation', 'training', 'tests', 'products', 'qa', 'topics']);
});

test('the app reads its data from the file it is published beside', () => {
	assert.match(script, /fetch\('projects\.json'/u, 'the app does not read projects.json');
	assert.doesNotMatch(script, /\.\.\//u, 'the app climbs out of its own folder');
});

test('both scripts are built by a step the repository build actually runs', () => {
	const manifest = JSON.parse(readFileSync(join(module, 'package.json'), 'utf8')) as { scripts?: Record<string, string> };
	assert.ok(manifest.scripts?.['build-webview'] !== undefined, 'the module has no build-webview script');
	assert.ok(manifest.scripts?.['vscode:prepublish'] === 'npm run build-webview', 'packaging does not build the project view');
	// The root build is where every module's browser bundle is produced: a module missing from it compiles without one.
	const root = JSON.parse(readFileSync(join(module, '..', '..', 'package.json'), 'utf8')) as { scripts?: Record<string, string> };
	assert.match(String(root.scripts?.['build-webviews']), /extensions\/temco-learn run build-webview/u, 'npm run compile does not build this module\'s project view');
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
