// The archive and the single-file page, checked by reading them back.
//
// An export is only worth anything if the other machine can open it, so this does not trust the writer: it parses the
// bytes it produced — signatures, sizes, checksums — and inflates every entry back to what went in. A zip that opens in
// this check opens in Explorer, Finder and `unzip`.
//
// Run with `npm run check-export`, after `npm run compile`.

import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

interface ZipModule {
	crc32(data: Uint8Array): number;
	zip(files: readonly { name: string; data: Uint8Array }[], when?: Date): Buffer;
}

const built = fileURLToPath(new URL('../out/zip.js', import.meta.url));
const source = fileURLToPath(new URL('../src/zip.ts', import.meta.url));
assert.ok(statSync(built).mtimeMs >= statSync(source).mtimeMs, 'out/zip.js is older than src/zip.ts');

const { crc32, zip } = createRequire(import.meta.url)(built) as ZipModule;

/** One entry of the archive, read the way a reader would: from the central directory. */
interface ReadEntry {
	name: string;
	method: number;
	crc: number;
	compressed: number;
	size: number;
	body: Buffer;
}

function read(archive: Buffer): ReadEntry[] {
	const end = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
	assert.ok(end >= 0, 'no end-of-central-directory record');
	const count = archive.readUInt16LE(end + 10);
	const start = archive.readUInt32LE(end + 16);
	const entries: ReadEntry[] = [];
	let at = start;
	for (let index = 0; index < count; index++) {
		assert.equal(archive.readUInt32LE(at), 0x02014b50, `central header ${index}`);
		const method = archive.readUInt16LE(at + 10);
		const crc = archive.readUInt32LE(at + 16);
		const compressed = archive.readUInt32LE(at + 20);
		const size = archive.readUInt32LE(at + 24);
		const nameLength = archive.readUInt16LE(at + 28);
		const extraLength = archive.readUInt16LE(at + 30);
		const commentLength = archive.readUInt16LE(at + 32);
		const offset = archive.readUInt32LE(at + 42);
		const name = archive.subarray(at + 46, at + 46 + nameLength).toString('utf8');

		assert.equal(archive.readUInt32LE(offset), 0x04034b50, `local header for ${name}`);
		const localName = archive.readUInt16LE(offset + 26);
		const localExtra = archive.readUInt16LE(offset + 28);
		const body = archive.subarray(offset + 30 + localName + localExtra, offset + 30 + localName + localExtra + compressed);
		entries.push({ name, method, crc, compressed, size, body });
		at += 46 + nameLength + extraLength + commentLength;
	}
	return entries;
}

const cases: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => cases.push({ name, run });

test('a checksum matches the published value for "123456789"', () => {
	assert.equal(crc32(Buffer.from('123456789', 'utf8')), 0xcbf43926);
	assert.equal(crc32(new Uint8Array(0)), 0);
});

test('a written archive reads back as what went in', () => {
	const files = [
		{ name: 'index.html', data: Buffer.from('<h1>Hello</h1>'.repeat(40), 'utf8') },
		{ name: '01-guide/setup/media/wiring.png', data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0xfe]) },
		{ name: '.nojekyll', data: new Uint8Array(0) }
	];
	const archive = zip(files, new Date('2026-10-27T10:00:00'));
	const entries = read(archive);
	assert.deepEqual(entries.map(entry => entry.name), files.map(file => file.name));

	for (const [index, entry] of entries.entries()) {
		const original = Buffer.from(files[index].data);
		const restored = entry.method === 8 ? inflateRawSync(entry.body) : Buffer.from(entry.body);
		assert.deepEqual(restored, original, `${entry.name} content`);
		assert.equal(entry.size, original.length, `${entry.name} size`);
		assert.equal(entry.crc, crc32(original), `${entry.name} crc`);
	}
});

test('compressible text is deflated, and a tiny file is stored rather than grown', () => {
	const entries = read(
		zip([
			{ name: 'big.html', data: Buffer.from('<p>the same paragraph, again</p>'.repeat(200), 'utf8') },
			{ name: 'tiny.txt', data: Buffer.from('a', 'utf8') }
		])
	);
	const big = entries.find(entry => entry.name === 'big.html');
	const tiny = entries.find(entry => entry.name === 'tiny.txt');
	assert.equal(big?.method, 8, 'the big page should be deflated');
	assert.ok(big !== undefined && big.compressed < big.size, 'deflating should have made it smaller');
	assert.equal(tiny?.method, 0, 'one byte cannot be compressed, so it is stored');
	assert.ok(tiny !== undefined && tiny.compressed === tiny.size);
});

test('names with folders, accents and spaces survive', () => {
	const names = ['02-reference/errors/e-101.html', 'Übersicht/erste Schritte.html', 'a b/c d.md'];
	const entries = read(zip(names.map(name => ({ name, data: Buffer.from(name, 'utf8') }))));
	assert.deepEqual(entries.map(entry => entry.name), names);
});

test('the same input twice produces the same bytes', () => {
	const files = [{ name: 'a.html', data: Buffer.from('same', 'utf8') }];
	const when = new Date('2026-10-27T10:00:00');
	assert.deepEqual(zip(files, when), zip(files, when));
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
console.log(`\n${cases.length - failed}/${cases.length} export cases passed`);
process.exit(failed === 0 ? 0 : 1);
