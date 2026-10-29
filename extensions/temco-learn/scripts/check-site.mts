// The site's rules, checked without a browser.
//
// Every case is something a visitor would notice and a developer would not: a section the rail promises but the folder
// does not hold, a card that leads to an address nothing writes, a page that says nothing about why it is empty, a
// manifest title that ends up in the markup as markup. The renderers are pure, so these are string comparisons —
// fast, and honest about what they prove. `site.ts` (the half that writes folders) is checked by adding a real build.

import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

interface SiteProduct {
	id: string;
	title: string;
	summary?: string;
	section: string;
	latest: string;
	versions: readonly string[];
}

interface Section {
	id: string;
	title: string;
	desc: string;
	empty: string;
}

interface Portal {
	SECTIONS: readonly Section[];
	escape(text: string): string;
	sectionHref(section: Section): string;
	productHref(product: SiteProduct): string;
	readerHref(product: SiteProduct, version: string): string;
	sectionPage(options: { section: Section; products: readonly SiteProduct[] }): string;
	productPage(options: { product: SiteProduct; sections: readonly Section[] }): string;
	siteCss(): string;
}

const source = fileURLToPath(new URL('../src/portal.ts', import.meta.url));
const built = fileURLToPath(new URL('../out/portal.js', import.meta.url));

try {
	assert.ok(statSync(built).mtimeMs >= statSync(source).mtimeMs, 'out/portal.js is older than src/portal.ts');
} catch (error) {
	console.log(`Cannot run: ${(error as Error).message}`);
	console.log('Compile first:  npm run compile');
	process.exit(1);
}

const portal = createRequire(import.meta.url)(built) as Portal;

const products: SiteProduct[] = [
	{ id: 't3000', title: 'T3000', summary: 'The controller and its workbench.', section: 'documentation', latest: '13.0', versions: ['13.0', '12.9'] },
	{ id: 'bacnet', title: 'BACnet', section: 'documentation', latest: '4.2', versions: ['4.2'] }
];

const cases: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => cases.push({ name, run });

test('the rail promises the six sections, in one order', () => {
	assert.deepEqual(
		portal.SECTIONS.map((section) => section.title),
		['Documentation', 'Training & Labs', 'Tests', 'Products', 'Q&A', 'Topics']
	);
	assert.equal(portal.SECTIONS[0].id, 'documentation');
});

test('a section has a page of its own, and the first one is the site root', () => {
	assert.equal(portal.sectionHref(portal.SECTIONS[0]), 'index.html');
	for (const section of portal.SECTIONS.slice(1)) {
		assert.equal(portal.sectionHref(section), `${section.id}.html`);
	}
});

test('every page carries the whole rail, and marks where the reader is', () => {
	const html = portal.sectionPage({ section: portal.SECTIONS[2], products });
	for (const section of portal.SECTIONS) {
		assert.ok(html.includes(portal.sectionHref(section)), `${section.title} is not in the rail`);
	}
	assert.match(html, /aria-current="page"/u);
	assert.match(html, /<title>Tests · Temco Learn<\/title>/u);
});

test('a section lists its own products, and links to their pages', () => {
	const html = portal.sectionPage({ section: portal.SECTIONS[0], products });
	assert.match(html, /href="t3000\/"/u);
	assert.match(html, /href="bacnet\/"/u);
	// Documentation is the only section with products, so the others must not borrow them.
	assert.ok(!portal.sectionPage({ section: portal.SECTIONS[1], products }).includes('href="t3000/"'));
});

test('an empty section says why it is empty instead of showing nothing', () => {
	const html = portal.sectionPage({ section: portal.SECTIONS[4], products });
	assert.match(html, /class="empty"/u);
	assert.match(html, /Temco forum/u);
});

test('a product page lists its versions, newest first, each reading in the reader', () => {
	const html = portal.productPage({ product: products[0], sections: portal.SECTIONS });
	const first = html.indexOf('13.0');
	const second = html.indexOf('12.9');
	assert.ok(first > 0 && second > first, 'the newest version is not first');
	assert.match(html, /href="13\.0\/temco-reader\.html"/u);
	// A product page is one folder down, so its rail climbs.
	assert.match(html, /href="\.\.\/index\.html"/u);
});

test('a reader address is product, version, and the reader file', () => {
	assert.equal(portal.readerHref(products[0], '13.0'), 't3000/13.0/temco-reader.html');
});

test('text from a manifest is text', () => {
	assert.equal(portal.escape('a & b <c> "d"'), 'a &amp; b &lt;c&gt; &quot;d&quot;');
	const hostile: SiteProduct = { id: 'x', title: '<script>alert(1)</script>', section: 'documentation', latest: '1', versions: ['1'] };
	const html = portal.sectionPage({ section: portal.SECTIONS[0], products: [hostile] });
	assert.ok(!html.includes('<script>alert(1)</script>'), 'a title was written as markup');
	assert.match(html, /&lt;script&gt;/u);
});

test('the stylesheet is one file, and it works in the dark', () => {
	const css = readFileSync(new URL('../site/site.css', import.meta.url), 'utf8');
	for (const selector of ['.bar', '.wrap', '.card', '.row', '.empty', '.foot', '.tab']) {
		assert.ok(css.includes(`${selector} {`) || css.includes(`${selector},`), `the stylesheet has no rule for ${selector}`);
	}
	assert.match(css, /@media \(prefers-color-scheme: dark\)/u);
	// The site is read in a browser: nothing in it may depend on the editor's own variables.
	assert.ok(!css.includes('--vscode-'), 'the stylesheet depends on the editor');
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
console.log(`\n${cases.length - failed}/${cases.length} site cases passed`);
process.exit(failed === 0 ? 0 : 1);
