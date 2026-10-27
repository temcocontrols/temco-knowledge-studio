// The published site's rules, checked without a browser.
//
// Every case here is something a reader would notice and a developer would not: an address that moved because a title
// gained a space, a link between two pages that downloads a file instead of opening one, a picture dragged to half width
// that is full width on the web. The renderer is pure, so these are string comparisons — fast, and honest about what
// they prove. `site.ts` (the half that writes files) is checked by building a real project.

import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

/** What the check uses of `siteRender`: the pure half of the generator. */
interface SiteRender {
	slug(segment: string): string;
	slugPath(id: string): string;
	addresses(ids: readonly string[]): Map<string, string>;
	withPictureWidths(html: string): string;
	rewriteLinks(html: string, fromId: string, where: ReadonlyMap<string, string>): string;
	renderPage(options: {
		entry: { id: string; title: string; area: string; markdown: string };
		model: { project: string; version?: string; areas: never[] };
		address: string;
		where: ReadonlyMap<string, string>;
		neighbours: { previous?: { title: string; address: string }; next?: { title: string; address: string } };
		built: string;
	}): string;
	renderIndex(model: {
		project: string;
		areas: { title: string; entries: { id: string; title: string; area: string; markdown: string }[] }[];
	}, where: ReadonlyMap<string, string>): string;
	renderSitemap(base: string, pages: readonly { address: string }[], built: string): string;
	renderStylesheet(): string;
	escapeHtml(text: string): string;
}

const source = fileURLToPath(new URL('../src/siteRender.ts', import.meta.url));
const built = fileURLToPath(new URL('../out/siteRender.js', import.meta.url));

try {
	assert.ok(statSync(built).mtimeMs >= statSync(source).mtimeMs, 'out/siteRender.js is older than src/siteRender.ts');
} catch (error) {
	console.log(`Cannot run: ${(error as Error).message}`);
	console.log('Compile first:  npm run compile');
	process.exit(1);
}

const {
	addresses,
	escapeHtml,
	renderIndex,
	renderPage,
	renderSitemap,
	renderStylesheet,
	rewriteLinks,
	slug,
	slugPath,
	withPictureWidths
} = createRequire(import.meta.url)(built) as SiteRender;

const cases: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => cases.push({ name, run });

test('an address is stable, lower case, and has no punctuation', () => {
	assert.equal(slugPath('01-Getting Started/Commissioning/Wiring Harness'), '01-getting-started/commissioning/wiring-harness');
	// A title that gains an accent later must not move the page it was already linked from.
	assert.equal(slug('Café résumé'), slug('Cafe resume'));
	assert.equal(slug('  --Wiring--  '), 'wiring');
	assert.equal(slug(''), '');
});

test('two pages that want one address both keep one', () => {
	const where = addresses(['a/One Page', 'a/one page', 'a/one-page']);
	assert.deepEqual([...where.values()], ['a/one-page', 'a/one-page-2', 'a/one-page-3']);
});

test('a picture keeps the width it was given in the editor', () => {
	const html = withPictureWidths('<p><img src="media/a.png" alt="A" title="w=480"></p><img src="media/b.png" alt="B">');
	assert.equal(html, '<p><img src="media/a.png" alt="A" width="480"></p><img src="media/b.png" alt="B">');
	assert.equal(withPictureWidths('<img src="a.png" title="A wiring diagram">'), '<img src="a.png" title="A wiring diagram">');
	assert.equal(withPictureWidths('<img src="a.png" title="w=50%">'), '<img src="a.png" width="50%">');
});

test('a link to another page opens that page, not the file', () => {
	const where = addresses(['a/one', 'a/two', 'b/three']);
	const html = rewriteLinks(
		'<a href="./two.md">two</a><a href="../b/three.md">three</a><a href="https://x.dev/a.md">out</a><a href="#top">top</a>',
		'a/one',
		where
	);
	assert.equal(
		html,
		'<a href="two.html">two</a><a href="../b/three.html">three</a><a href="https://x.dev/a.md">out</a><a href="#top">top</a>'
	);
});

test('a link to a page that does not exist is left alone, not broken quietly', () => {
	const html = rewriteLinks('<a href="./missing.md">missing</a>', 'a/one', addresses(['a/one']));
	assert.equal(html, '<a href="./missing.md">missing</a>');
});

test('a page says what it is, and never as markup', () => {
	const where = addresses(['a/one']);
	const html = renderPage({
		entry: { id: 'a/one', title: '<script>x</script>', area: 'a', markdown: '# Hello\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n' },
		model: { project: 'Temco', version: '1.4.2', areas: [] },
		address: 'a/one',
		where,
		neighbours: {},
		built: '2025-01-31'
	});
	assert.match(html, /<title>&lt;script&gt;x&lt;\/script&gt; · Temco<\/title>/u);
	assert.match(html, /<h1>Hello<\/h1>/u);
	assert.match(html, /<table>/u);
	// A page two folders down reaches the stylesheet with two climbs, so the site also opens from `file://`.
	assert.match(html, /href="..\/assets\/site.css"/u);
	assert.match(html, /v1.4.2/u);
});

test('the index lists every area and every page', () => {
	const where = addresses(['a/one', 'b/two']);
	const html = renderIndex(
		{
			project: 'Temco',
			areas: [
				{ title: 'Getting started', entries: [{ id: 'a/one', title: 'One', area: 'a', markdown: '' }] },
				{ title: 'Reference', entries: [{ id: 'b/two', title: 'Two', area: 'b', markdown: '' }] }
			]
		},
		where
	);
	assert.match(html, /<h2>Getting started<\/h2>/u);
	assert.match(html, /<a href="b\/two.html">Two<\/a>/u);
	assert.match(html, /2 pages/u);
});

test('a sitemap holds absolute addresses', () => {
	const xml = renderSitemap('https://temco.example/docs/', [{ address: 'a/one' }, { address: 'b/two' }], '2025-01-31');
	assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/u);
	assert.equal((xml.match(/<loc>/gu) ?? []).length, 2);
	assert.match(xml, /<loc>https:\/\/temco\.example\/docs\/a\/one\.html<\/loc>/u);
	assert.match(xml, /<\/urlset>/u);
});

test('the stylesheet styles what the pages write', () => {
	const css = renderStylesheet();
	for (const selector of ['.bar', '.page', '.doc', '.step', '.foot', '.index', 'pre code', 'th']) {
		assert.ok(css.includes(`${selector} {`) || css.includes(`${selector},`), `the stylesheet has no rule for ${selector}`);
	}
	assert.match(css, /img \{ max-width: 100%/u);
});

test('text a page shows is text', () => {
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
console.log(`\n${cases.length - failed}/${cases.length} site cases passed`);
process.exit(failed === 0 ? 0 : 1);
