// The reader, checked without a browser.
//
// The reader is the page a visitor actually reads a version in: a bar with the product and a version picker, the
// navigation down the left, the article in a frame, and the article's own headings on the right. Each case here is
// something a reader would notice: a page that opens on nothing, a breadcrumb that starts on an empty trail, a title
// from a folder that ends up in the markup as markup.

import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

interface ReaderModel {
	product: string;
	version: string;
	versions: readonly string[];
	pages: readonly { href: string; title: string }[];
}

interface ReaderModule {
	readerPage(model: ReaderModel): string;
}

const source = fileURLToPath(new URL('../src/reader.ts', import.meta.url));
const built = fileURLToPath(new URL('../out/reader.js', import.meta.url));

try {
	assert.ok(statSync(built).mtimeMs >= statSync(source).mtimeMs, 'out/reader.js is older than src/reader.ts');
} catch (error) {
	console.log(`Cannot run: ${(error as Error).message}`);
	console.log('Compile first:  npm run compile');
	process.exit(1);
}

const { readerPage } = createRequire(import.meta.url)(built) as ReaderModule;

const pages = [
	{ href: 'getting-started/install.html', title: 'Installing T3000' },
	{ href: 'getting-started/commissioning.html', title: 'Commissioning points' }
];
const read = readerPage({ product: 'T3000', version: '13.0', versions: ['13.0', '12.9'], pages });

const cases: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => cases.push({ name, run });

test('the navigation is server-written, so it works with scripting off', () => {
	assert.match(read, /class="nav"[^>]*aria-label="Documentation"/u);
	for (const page of pages) {
		assert.ok(read.includes(`href="${page.href}"`), `${page.title} is not in the navigation`);
	}
	assert.match(read, /class="nav__link is-active"/u);
});

test('the article is framed, so the generator keeps rendering its own pages', () => {
	assert.match(read, /<iframe class="page" id="page" title="Page" src="getting-started\/install\.html">/u);
	assert.ok(!/class="article/.test(read), 'the reader drew the article itself');
});

test('the breadcrumb starts on the product, and the headings panel starts empty', () => {
	assert.match(read, /<b>T3000<\/b> › Installing T3000/u);
	assert.match(read, /class="toc"[^>]*aria-label="In this article"/u);
	assert.match(read, /<main class="main">/u);
});

test('every version is in the picker, and the current one is chosen', () => {
	assert.match(read, /<option value="13\.0" selected>13\.0<\/option>/u);
	assert.match(read, /<option value="12\.9">12\.9<\/option>/u);
});

test('one version is not a choice, and there is nothing to ask about it', () => {
	const single = readerPage({ product: 'T3000', version: '13.0', versions: ['13.0'], pages });
	assert.ok(!single.includes('<select class="version"'), 'a dead version picker was drawn');
});

test('a page can be linked to: the hash carries the page, not a position', () => {
	assert.match(read, /history\.replaceState\(null, '', '#' \+ encodeURIComponent\(page\.href\)\)/u);
	assert.match(read, /decodeURIComponent\(location\.hash\.replace\(\/\^#\/, ''\)\)/u);
});

test('a title from a folder cannot inject markup', () => {
	const hostile = readerPage({
		product: '<script>alert(1)</script>',
		version: '1</script><script>alert(2)</script>',
		versions: ['1</script><script>alert(2)</script>'],
		pages: [{ href: 'a.html', title: '</script><script>alert(3)</script>' }]
	});
	assert.ok(!hostile.includes('<script>alert(1)</script>'), 'a product title was written as markup');
	assert.ok(!hostile.includes('</script><script>alert(2)'), 'a version closed the payload block');
	assert.ok(!hostile.includes('</script><script>alert(3)'), 'a page title was written as markup');
});

test('a version with no pages still renders, and says so', () => {
	const empty = readerPage({ product: 'T3000', version: '1.0', versions: ['1.0'], pages: [] });
	assert.match(empty, /This version has no pages yet\./u);
	assert.match(empty, /title="Page" src="about:blank"/u);
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
console.log(`\n${cases.length - failed}/${cases.length} reader cases passed`);
process.exit(failed === 0 ? 0 : 1);
