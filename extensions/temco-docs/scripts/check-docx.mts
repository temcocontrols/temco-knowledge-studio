// A Word document is a zip of XML, and Word rejects the whole file when one part is missing or one relationship points at
// nothing. So this reads the package back and checks the invariants Word enforces: the parts it requires are present, every
// picture the body refers to exists in the archive, and the values a page carries reach the file escaped.
//
// Not checked: whether Word *renders* it. That needs Word; what is checked here is the structure Word validates before it
// shows a page.

import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

interface DocxModule {
	docx(options: {
		title: string;
		markdown: string;
		pictures: { src: string; data: Uint8Array; width: number; height: number }[];
	}): Buffer;
	pngSize(data: Uint8Array): { width: number; height: number } | undefined;
	xmlText(text: string): string;
}

const built = fileURLToPath(new URL('../out/docxWrite.js', import.meta.url));
const source = fileURLToPath(new URL('../src/docxWrite.ts', import.meta.url));
assert.ok(statSync(built).mtimeMs >= statSync(source).mtimeMs, 'out/docxWrite.js is older than src/docxWrite.ts');

const { docx, pngSize, xmlText } = createRequire(import.meta.url)(built) as DocxModule;

/** Every entry of the archive, name → text, read from the central directory. */
function parts(archive: Buffer): Map<string, string> {
	const end = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
	assert.ok(end >= 0, 'no end-of-central-directory record');
	const count = archive.readUInt16LE(end + 10);
	let at = archive.readUInt32LE(end + 16);
	const found = new Map<string, string>();
	for (let index = 0; index < count; index++) {
		const method = archive.readUInt16LE(at + 10);
		const compressed = archive.readUInt32LE(at + 20);
		const nameLength = archive.readUInt16LE(at + 28);
		const offset = archive.readUInt32LE(at + 42);
		const name = archive.subarray(at + 46, at + 46 + nameLength).toString('utf8');
		const localName = archive.readUInt16LE(offset + 26);
		const body = archive.subarray(offset + 30 + localName, offset + 30 + localName + compressed);
		found.set(name, (method === 8 ? inflateRawSync(body) : body).toString('utf8'));
		at += 46 + nameLength + archive.readUInt16LE(at + 30) + archive.readUInt16LE(at + 32);
	}
	return found;
}

const png = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
	'base64'
);
const picture = { src: 'media/wiring.png', data: png, width: 1, height: 1 };

const sample = () => parts(docx({
	title: 'Commissioning',
	markdown: [
		'# Commissioning',
		'',
		'A **bold** word, an *italic* one and `code`.',
		'',
		'- first',
		'- second',
		'',
		'1. one',
		'2. two',
		'',
		'> quoted',
		'',
		'| Step | Done |',
		'| --- | --- |',
		'| Wire | Yes |',
		'',
		'![The harness](media/wiring.png)',
		'',
		'[the next page](./verify.md)',
		''
	].join('\n'),
	pictures: [picture]
}));

const cases: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => cases.push({ name, run });

test('the parts Word requires are all there', () => {
	const entries = sample();
	for (const name of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/_rels/document.xml.rels']) {
		assert.ok(entries.has(name), `missing ${name}`);
	}
	assert.ok([...entries.keys()].some(name => name.startsWith('word/media/')), 'the picture is not in the package');
});

test('every picture the body embeds exists, and every relationship points at a part', () => {
	const entries = sample();
	const body = entries.get('word/document.xml') ?? '';
	const rels = entries.get('word/_rels/document.xml.rels') ?? '';
	const embeds = [...body.matchAll(/r:embed="(rId\d+)"/gu)].map(match => match[1]);
	assert.ok(embeds.length > 0, 'the body embeds no picture');
	for (const id of embeds) {
		const target = new RegExp(`Id="${id}"[^>]*Target="([^"]+)"`, 'u').exec(rels)?.[1];
		assert.ok(target !== undefined, `${id} has no relationship`);
		assert.ok(entries.has(`word/${target}`), `${target} is not in the package`);
	}
});

test('the body is one document, not a fragment', () => {
	const body = sample().get('word/document.xml') ?? '';
	assert.ok(body.startsWith('<?xml'), 'no XML declaration');
	assert.ok(body.includes('<w:document '), 'no w:document element');
	assert.ok(body.trimEnd().endsWith('</w:document>'), 'the document is not closed');
	assert.ok(body.includes('<w:sectPr>'), 'no section properties, so no page size');
});

test('Markdown structure survives as Word structure', () => {
	const body = sample().get('word/document.xml') ?? '';
	assert.ok(body.includes('w:val="Heading1"'), 'the heading lost its style');
	assert.ok(body.includes('<w:b/>'), 'bold was lost');
	assert.ok(body.includes('<w:i/>'), 'italic was lost');
	assert.ok(body.includes('w:ascii="Consolas"'), 'inline code was lost');
	assert.ok(body.includes('<w:tbl>'), 'the table was lost');
	assert.ok(body.includes('• '), 'the bullet was lost');
	assert.ok(body.includes('w:ind w:left="480"'), 'the quote lost its indent');
	assert.ok(body.includes('(./verify.md)'), 'the link address was dropped');
});

test('a picture that could not be read leaves its caption, not a hole', () => {
	const body = parts(docx({ title: 'T', markdown: '![Missing](media/gone.png)\n', pictures: [] })).get('word/document.xml') ?? '';
	assert.ok(body.includes('[Missing]'), 'the caption should stand in for the picture');
	assert.ok(!body.includes('r:embed'), 'nothing should be embedded');
});

test('a value from the page cannot break the document', () => {
	assert.equal(xmlText('a & b <c> "d" \'e\''), 'a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos;');
	const entries = parts(docx({ title: '<script>', markdown: '# A & B < C\n', pictures: [] }));
	assert.ok((entries.get('docProps/core.xml') ?? '').includes('&lt;script&gt;'));
	assert.ok((entries.get('word/document.xml') ?? '').includes('A &amp; B &lt; C'));
});

test('a PNG reports its own size, and other bytes do not pretend to', () => {
	assert.deepEqual(pngSize(png), { width: 1, height: 1 });
	assert.equal(pngSize(Buffer.from('not a png at all, just text')), undefined);
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
console.log(`\n${cases.length - failed}/${cases.length} docx cases passed`);
process.exit(failed === 0 ? 0 : 1);
