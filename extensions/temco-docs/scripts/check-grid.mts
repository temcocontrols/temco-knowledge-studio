// The Grid surface edits a CSV as cells, and the promise is that a one-cell edit is a one-line diff.
//
// That promise has two halves, and both have been broken before: the sheet has to hand back the cells that exist
// rather than a rectangle as wide and as tall as itself, and the writer has to keep the quoting and the line endings
// the file arrived with. The first half is `src/cells.ts` and the second is `src/csv.ts`; this check runs the two
// together, on the shape Univer actually returns (a full sheet, mostly blank).
//
// The extension is CommonJS (`main` is `out/extension.js`), so the modules under test are the compiled ones, and a
// stale `out/` would quietly test yesterday's code. So the check refuses to run when the sources are newer.
//
// Run with `npm run check-grid`, after `tsc -p .`.

import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

interface CsvFormat {
	readonly delimiter: string;
	readonly eol: string;
	readonly finalNewline: boolean;
}

interface CsvModule {
	parseCsv(text: string): { rows: string[][]; quoted: boolean[][]; format: CsvFormat };
	writeCsv(rows: readonly (readonly string[])[], before: { format: CsvFormat; quoted?: readonly (readonly boolean[])[] }): string;
}

interface CellsModule {
	trimCells(read: readonly (readonly (string | number | boolean | null)[])[]): string[][];
}

type Rows = string[][];

const require_ = createRequire(import.meta.url);

for (const name of ['csv', 'cells']) {
	const source = fileURLToPath(new URL(`../src/${name}.ts`, import.meta.url));
	const built = fileURLToPath(new URL(`../out/${name}.js`, import.meta.url));
	try {
		assert.ok(statSync(built).mtimeMs >= statSync(source).mtimeMs, `out/${name}.js is older than src/${name}.ts`);
	} catch (error) {
		console.log(`Cannot run: ${(error as Error).message}`);
		console.log('Compile first:  tsc -p .');
		process.exit(1);
	}
}

const { parseCsv, writeCsv } = require_('../out/csv.js') as CsvModule;
const { trimCells } = require_('../out/cells.js') as CellsModule;

/** What `getValues()` gives back: every cell of the sheet, blank ones included. */
const SHEET_ROWS = 1000;
const SHEET_COLUMNS = 20;

function asSheet(rows: Rows): string[][] {
	return Array.from({ length: SHEET_ROWS }, (_, row) => Array.from({ length: SHEET_COLUMNS }, (_, column) => rows[row]?.[column] ?? ''));
}

/** The file after a grid session: open it, change these cells, save it. */
function edit(text: string, change: (rows: Rows) => void): { after: string; lines: number } {
	const before = parseCsv(text);
	const cells = before.rows.map((row) => [...row]);
	change(cells);
	const sheet = asSheet(cells);
	const after = writeCsv(trimCells(sheet), before);
	return { after, lines: differingLines(text, after) };
}

function differingLines(before: string, after: string): number {
	const was = before.split(/\r?\n/u);
	const now = after.split(/\r?\n/u);
	let count = 0;
	for (let index = 0; index < Math.max(was.length, now.length); index++) {
		if (was[index] !== now[index]) {
			count++;
		}
	}
	return count;
}

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

const points = 'Point,Value\nAV-1,20\nAV-2,21\nAV-3,22\n';

check('a full sheet reads back as the cells the file has', () => {
	assert.deepEqual(trimCells(asSheet([['Point', 'Value'], ['AV-1', '20']])), [['Point', 'Value'], ['AV-1', '20']]);
});

check('a cell typed below the last row is kept', () => {
	const rows = [['Point', 'Value']];
	for (let index = 1; index < 250; index++) {
		rows.push(index === 249 ? ['AV-250', '99'] : ['', '']);
	}
	const trimmed = trimCells(asSheet(rows));
	assert.equal(trimmed.length, 250);
	assert.deepEqual(trimmed[249], ['AV-250', '99']);
});

check('a blank line inside the file is a row, not padding', () => {
	assert.deepEqual(trimCells(asSheet([['a', 'b'], ['', ''], ['c', 'd']])), [['a', 'b'], [], ['c', 'd']]);
});

check('opening a grid and changing nothing writes the file back unchanged', () => {
	const { after } = edit(points, () => undefined);
	assert.equal(after, points);
});

check('one edited cell changes one line', () => {
	const { after, lines } = edit(points, (rows) => {
		rows[1][1] = '25';
	});
	assert.equal(after, 'Point,Value\nAV-1,25\nAV-2,21\nAV-3,22\n');
	assert.equal(lines, 1);
});

check('a value typed past the last column keeps the columns it needs', () => {
	const { after, lines } = edit(points, (rows) => {
		rows[2][3] = 'note';
	});
	// Only the row that grew gains the empty columns: the writer drops the trailing blanks every other line would
	// otherwise gain from the sheet's width.
	assert.equal(after, 'Point,Value\nAV-1,20\nAV-2,21,,note\nAV-3,22\n');
	assert.equal(lines, 1);
});

check('quoting and line endings survive an edit elsewhere', () => {
	const text = '"Point","Value"\r\n"AV-1","a, b"\r\n"AV-2","21"\r\n';
	const { after, lines } = edit(text, (rows) => {
		rows[2][1] = '22';
	});
	assert.equal(after, '"Point","Value"\r\n"AV-1","a, b"\r\n"AV-2","22"\r\n');
	assert.equal(lines, 1);
});

check('a file with no final newline keeps it that way', () => {
	const text = 'Point,Value\nAV-1,20';
	const { after } = edit(text, (rows) => {
		rows[1][1] = '21';
	});
	assert.equal(after, 'Point,Value\nAV-1,21');
});

check('a tab-separated file stays tab separated', () => {
	const text = 'Point\tValue\nAV-1\t20\n';
	const { after, lines } = edit(text, (rows) => {
		rows[1][1] = '21';
	});
	assert.equal(after, 'Point\tValue\nAV-1\t21\n');
	assert.equal(lines, 1);
});

console.log(failures === 0 ? '\nAll grid round-trip checks passed.' : `\n${failures} grid round-trip check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
