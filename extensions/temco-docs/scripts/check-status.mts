// The status-bar line, checked for the two things that make a status bar useless: saying nothing when there is something
// to say, and shouting when there is not.
//
// `statusLine` is pure — no editor, no services — so these are plain string assertions against what VS Code would render,
// including the `$(icon)` syntax it expands.

import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

interface StatusModule {
	statusLine(facts: {
		project?: string;
		sources: number;
		pages: number;
		issues: number;
		neverReviewed: number;
		unreadable: number;
		owed: number;
	}): { text: string; tooltip: string } | undefined;
	count(value: number, one: string, many: string): string;
	shorten(name: string, limit?: number): string;
}

const built = fileURLToPath(new URL('../out/statusLine.js', import.meta.url));
const source = fileURLToPath(new URL('../src/statusLine.ts', import.meta.url));
assert.ok(statSync(built).mtimeMs >= statSync(source).mtimeMs, 'out/statusLine.js is older than src/statusLine.ts');

const { statusLine, count, shorten } = createRequire(import.meta.url)(built) as StatusModule;

const base = { project: 'Temco Handbook', sources: 2, pages: 148, issues: 0, neverReviewed: 12, unreadable: 0, owed: 0 };

const cases: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => cases.push({ name, run });

test('a window with no documentation says nothing at all', () => {
	assert.equal(statusLine({ ...base, project: undefined, pages: 0, neverReviewed: 0 }), undefined);
});

test('a registry that cannot be read is worth a line even with no pages', () => {
	const line = statusLine({ ...base, pages: 0, unreadable: 1 });
	assert.ok(line !== undefined);
	assert.ok(line.text.includes('$(error) 1'), line?.text);
});

test('the project leads, and the page count follows', () => {
	assert.equal(statusLine(base)?.text, '$(book) Temco Handbook · 148 pages');
});

test('without a project the count still reads', () => {
	assert.equal(statusLine({ ...base, project: undefined })?.text, '$(book) 148 pages');
});

test('an issue is a warning, an unreadable registry is an error, and only one shows', () => {
	assert.equal(statusLine({ ...base, issues: 3 })?.text, '$(book) Temco Handbook · 148 pages · $(warning) 3');
	assert.equal(statusLine({ ...base, issues: 3, unreadable: 2 })?.text, '$(book) Temco Handbook · 148 pages · $(error) 2');
});

test('a very long project name is shortened, not clipped mid-word by the bar', () => {
	const long = 'Contoso T3000 Building Automation Controller Handbook';
	const text = statusLine({ ...base, project: long })?.text ?? '';
	assert.ok(text.length < long.length, 'the name should be shortened');
	assert.ok(text.includes('…'), text);
	assert.equal(shorten('short', 26), 'short');
	assert.ok(shorten(long, 26).length <= 26);
});

test('the tooltip carries what the line has no room for', () => {
	const tooltip = statusLine({ ...base, issues: 3, owed: 2 })?.tooltip ?? '';
	assert.ok(tooltip.startsWith('Temco Handbook'), tooltip);
	assert.ok(tooltip.includes('148 pages'), tooltip);
	assert.ok(tooltip.includes('3 issues'), tooltip);
	assert.ok(tooltip.includes('12 never reviewed'), tooltip);
	assert.ok(tooltip.includes('2 sources'), tooltip);
	assert.ok(tooltip.includes('2 waiting for you'), tooltip);
	assert.ok(tooltip.includes('Click to run Validate.'), tooltip);
});

test('nothing waiting is stated, not left as a zero', () => {
	assert.ok((statusLine(base)?.tooltip ?? '').includes('nothing waiting for you'));
	assert.ok(!(statusLine(base)?.tooltip ?? '').includes('0 waiting'));
});

test('counts say "no" rather than "0", and singular when there is one', () => {
	assert.equal(count(0, 'page', 'pages'), 'no pages');
	assert.equal(count(1, 'page', 'pages'), '1 page');
	assert.equal(count(2, 'page', 'pages'), '2 pages');
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
console.log(`\n${cases.length - failed}/${cases.length} status cases passed`);
process.exit(failed === 0 ? 0 : 1);
