// The attachment record, driven through a table.
//
// `src/attachmentRecord.ts` is pure on purpose: the rule that decides which screenshots a new version has left behind is
// the one thing in the image pipeline that can be wrong without breaking anything visible, so it is checked rather than
// assumed. No workspace, no editor, no filesystem.
//
// The extension is CommonJS (`main` is `out/extension.js`), so the module under test is the compiled one — the same
// arrangement `check-learn` uses. A stale `out/` would quietly test yesterday's code, so this refuses to run when the
// source is newer than the build.
//
// Run with `npm run check-record`, after `tsc -p .`.

import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

interface RecordModule {
	emptyRecord(): AttachmentFile;
	parseRecord(text: string): AttachmentFile;
	serialiseRecord(file: AttachmentFile): string;
	withImage(file: AttachmentFile, name: string, details: { caption?: string; appliesTo?: string; added?: string }): AttachmentFile;
	withCaption(file: AttachmentFile, name: string, caption: string): AttachmentFile;
	staleImages(images: AttachmentFile['images'], current: string | undefined): { name: string; appliesTo: string }[];
}

interface AttachmentFile {
	version: number;
	images: Record<string, { caption?: string; appliesTo?: string; added?: string }>;
}

const source = fileURLToPath(new URL('../src/attachmentRecord.ts', import.meta.url));
const built = fileURLToPath(new URL('../out/attachmentRecord.js', import.meta.url));

try {
	assert.ok(statSync(built).mtimeMs >= statSync(source).mtimeMs, 'out/attachmentRecord.js is older than src/attachmentRecord.ts');
} catch (error) {
	console.log(`Cannot run: ${(error as Error).message}`);
	console.log('Compile first:  tsc -p .');
	process.exit(1);
}

const {
	emptyRecord,
	parseRecord,
	serialiseRecord,
	staleImages,
	withCaption,
	withImage,
} = createRequire(import.meta.url)(built) as RecordModule;

const failures: string[] = [];

function check(name: string, run: () => void): void {
	try {
		run();
		console.log(`PASS  ${name}`);
	} catch (error) {
		failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
		console.log(`FAIL  ${name}`);
	}
}

check('a missing record is an empty one, not an error', () => {
	assert.deepEqual(parseRecord(''), emptyRecord());
	assert.deepEqual(parseRecord('   '), emptyRecord());
});

check('a record that is not JSON is an empty one', () => {
	assert.deepEqual(parseRecord('not json at all'), emptyRecord());
	assert.deepEqual(parseRecord('{"images": "wrong shape"}'), emptyRecord());
});

check('a record round-trips through its text form', () => {
	const file = withImage(emptyRecord(), '01-scaled.png', {
		caption: 'Scaled input after a reset',
		appliesTo: '13.0',
		added: '2026-10-24',
	});
	assert.deepEqual(parseRecord(serialiseRecord(file)), file);
});

check('a caption is trimmed, and an empty one is recorded as no caption at all', () => {
	const file = withImage(emptyRecord(), '01.png', { caption: '   ', appliesTo: '13.1' });
	assert.equal(file.images['01.png'].caption, undefined);
	assert.equal(file.images['01.png'].appliesTo, '13.1');
});

check('adding an image does not disturb the others', () => {
	const first = withImage(emptyRecord(), '01.png', { caption: 'one', appliesTo: '13.0' });
	const both = withImage(first, '02.png', { caption: 'two', appliesTo: '13.0' });
	assert.deepEqual(Object.keys(both.images), ['01.png', '02.png']);
	assert.equal(both.images['01.png'].caption, 'one');
});

check('a caption changes the words and nothing else', () => {
	const file = withImage(emptyRecord(), '01.png', { caption: 'one', appliesTo: '13.0', added: '2026-10-24' });
	const after = withCaption(file, '01.png', 'Device list after a reset');
	assert.equal(after.images['01.png'].caption, 'Device list after a reset');
	assert.equal(after.images['01.png'].appliesTo, '13.0');
	assert.equal(after.images['01.png'].added, '2026-10-24');
	assert.equal(file.images['01.png'].caption, 'one', 'the record it came from must not be mutated');
});

check('an image is stale only when it names a different version', () => {
	const images = {
		'ancient.png': { appliesTo: '12.8' },
		'current.png': { appliesTo: '13.1' },
		'unknown.png': {},
		'unknown-version.png': { appliesTo: '' },
		'also-current.png': { appliesTo: '13.1', caption: 'the same version' },
	};
	assert.deepEqual(staleImages(images, '13.1'), [{ name: 'ancient.png', appliesTo: '12.8' }]);
});

check('with no version to compare against, nothing is called stale', () => {
	// The report has not run yet: "we do not know" must not become a false accusation on every page.
	assert.deepEqual(staleImages({ 'ancient.png': { appliesTo: '12.8' } }, undefined), []);
});

check('stale images come back in a stable order', () => {
	const images = {
		'03-c.png': { appliesTo: '1.0' },
		'01-a.png': { appliesTo: '1.0' },
		'02-b.png': { appliesTo: '1.0' },
	};
	assert.deepEqual(staleImages(images, '2.0').map((row) => row.name), ['01-a.png', '02-b.png', '03-c.png']);
});

if (failures.length > 0) {
	console.log(`\n${failures.length} problem(s):`);
	for (const failure of failures) {
		console.log(`  ${failure}`);
	}
}

console.log(failures.length === 0 ? '\nTHE RECORD HOLDS' : `\n${failures.length} PROBLEM(S)`);
process.exitCode = failures.length === 0 ? 0 : 1;
