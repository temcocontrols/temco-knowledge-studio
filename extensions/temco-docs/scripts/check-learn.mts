// The Temco Learn portal, which has never had a product to show.
//
// `writePortal` runs on every publish, and until now nothing had ever been published: the page it writes has never been
// read by anything but a person opening a folder. This covers the two decisions inside it — what a `manifest.json`
// means, and what the page says — and checks the one thing a reader actually does with it: follow a link.
//
// The extension is CommonJS (`main` is `out/extension.js`), so the module under test is the compiled one. A stale `out/`
// would quietly test yesterday's code, so the check refuses to run when the source is newer than the build.
//
// Run with `npm run check-learn`, after `tsc -p .`.

import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

interface Product {
	id: string;
	title: string;
	latest: string;
	versions: string[];
}

interface LearnPage {
	toProduct(folder: string, manifest: unknown): Product | undefined;
	portalPage(products: readonly Product[]): string;
}

const source = fileURLToPath(new URL('../src/learnPage.ts', import.meta.url));
const built = fileURLToPath(new URL('../out/learnPage.js', import.meta.url));

try {
	assert.ok(statSync(built).mtimeMs >= statSync(source).mtimeMs, 'out/learnPage.js is older than src/learnPage.ts');
} catch (error) {
	console.log(`Cannot run: ${(error as Error).message}`);
	console.log('Compile first:  tsc -p .');
	process.exit(1);
}

const { toProduct, portalPage } = createRequire(import.meta.url)(built) as LearnPage;

let failures = 0;

function check(name: string, run: () => void): void {
	try {
		run();
		console.log(`PASS  ${name}`);
	} catch (error) {
		failures++;
		console.log(`FAIL  ${name}\n      ${(error as Error).message.split('\n')[0]}`);
	}
}

/** The publisher has written three manifest shapes; all three are still on disk somewhere. */
check('a manifest with latest and versions', () => {
	assert.deepEqual(toProduct('t3000', { title: 'T3000', latest: '13.0', versions: ['13.0', '12.0'] }), {
		id: 't3000',
		title: 'T3000',
		latest: '13.0',
		versions: ['13.0', '12.0'],
	});
});

check('a manifest with only a version', () => {
	assert.deepEqual(toProduct('sdk', { version: '1.4' }), { id: 'sdk', title: 'sdk', latest: '1.4', versions: ['1.4'] });
});

check('a manifest with only versions takes the first as latest', () => {
	assert.deepEqual(toProduct('bacnet', { versions: ['4.2', '4.1'] }), {
		id: 'bacnet',
		title: 'bacnet',
		latest: '4.2',
		versions: ['4.2', '4.1'],
	});
});

check('a manifest with nothing to link to is skipped', () => {
	assert.equal(toProduct('empty', {}), undefined);
	assert.equal(toProduct('blank', { versions: [] }), undefined);
	assert.equal(toProduct('junk', null), undefined);
	assert.equal(toProduct('text', 'a string'), undefined);
});

check('a manifest with a broken title still produces a product', () => {
	assert.equal(toProduct('devices', { title: 42, version: '2.14' })?.title, 'devices');
});

check('an empty published folder says so', () => {
	assert.match(portalPage([]), /No product has been published yet\./);
});

const products: Product[] = [
	{ id: 't3000', title: 'T3000', latest: '13.0', versions: ['13.0', '12.0'] },
	{ id: 'sdk', title: 'SDK', latest: '1.4', versions: ['1.4'] },
];

check('every product is listed with its newest version', () => {
	const html = portalPage(products);
	assert.match(html, /<h2>T3000<\/h2>/);
	assert.match(html, /<h2>SDK<\/h2>/);
	assert.match(html, /Latest <b>13\.0<\/b>/);
});

check('every version is linked', () => {
	const html = portalPage(products);
	assert.match(html, /href="t3000\/13\.0\/"/);
	assert.match(html, /href="t3000\/12\.0\/"/);
	assert.match(html, /href="sdk\/1\.4\/"/);
});

check('a title from a manifest cannot inject markup', () => {
	const html = portalPage([{ id: 'x', title: '<script>alert(1)</script>', latest: '1.0', versions: ['1.0'] }]);
	assert.ok(!html.includes('<script>alert(1)</script>'), 'a title was written as markup');
	assert.match(html, /&lt;script&gt;/);
});

/** The file is written beside the product folders, so a link that leaves the folder is a link that 404s. */
check('every link is a relative path into a product folder', () => {
	const hrefs = [...portalPage(products).matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
	assert.ok(hrefs.length >= 3, 'no links were generated');
	for (const href of hrefs) {
		assert.ok(!/^[a-z]+:/i.test(href), `${href} is absolute`);
		assert.ok(!href.startsWith('/'), `${href} is root-relative`);
		assert.match(href, /^[^/]+\/[^/]+\/$/, `${href} does not name a version folder`);
	}
});

/** A product id or a version with a space must still resolve to its folder. */
check('an id or version that needs encoding is encoded in the link', () => {
	const html = portalPage([{ id: 'a b', title: 'A B', latest: '1.0 beta', versions: ['1.0 beta'] }]);
	assert.match(html, /href="a%20b\/1\.0%20beta\/"/);
});

console.log(failures === 0 ? '\nTHE PORTAL PAGE IS CORRECT' : `\n${failures} PROBLEM(S)`);
process.exitCode = failures === 0 ? 0 : 1;
