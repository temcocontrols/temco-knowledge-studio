// The rich page saves through a Markdown ⇄ HTML round trip, so the conversion is the product's contract with the file.
//
// A page is written by a person; the editor must not rewrite text they did not touch. Every case below is a paragraph,
// a bullet, a table or a fence that would come back differently — a stray blank line, a re-indented bullet, a table
// serialised as raw HTML — because each one is a `git diff` full of changes nobody made.
//
// The extension is CommonJS (`main` is `out/extension.js`), so the module under test is the compiled one. A stale `out/`
// would quietly test yesterday's code, so the check refuses to run when the source is newer than the build.
//
// Run with `npm run check-page`, after `tsc -p .`.

import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

interface PageMarkdown {
	toHtml(markdown: string): string;
	toMarkdown(html: string): string;
	roundTrip(markdown: string): string;
}

const source = fileURLToPath(new URL('../src/markdown.ts', import.meta.url));
const built = fileURLToPath(new URL('../out/markdown.js', import.meta.url));

try {
	assert.ok(statSync(built).mtimeMs >= statSync(source).mtimeMs, 'out/markdown.js is older than src/markdown.ts');
} catch (error) {
	console.log(`Cannot run: ${(error as Error).message}`);
	console.log('Compile first:  tsc -p .');
	process.exit(1);
}

const { toHtml, toMarkdown, roundTrip } = createRequire(import.meta.url)(built) as PageMarkdown;

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

/** A whole page, in the shape the docs module writes them. */
const page = [
	'# Wiring a T3000 controller to a BACnet network',
	'',
	'A T3000 controller joins a BACnet/IP network the moment it has an address.',
	'',
	'## Before you start',
	'',
	'- A T3000 controller with firmware 4.2 or later',
	'- A laptop on the same subnet as the controller',
	'- The commissioning sheet for the building',
	'',
	'## Wiring',
	'',
	'1. Land the RS-485 pair on `NET+` and `NET-`.',
	'2. Set the address switch to the number on the sheet.',
	'3. Apply 24 VAC and wait for the run light to settle.',
	'',
	'> A controller that answers on the wrong address is usually a switch read upside down.',
	'',
	'| Step | Test | Expected |',
	'| --- | --- | --- |',
	'| 1 | Ping the address | Reply under 5 ms |',
	'| 2 | Read device object | Model T3000 |',
	'',
	'```text',
	'whois 1001',
	'```',
	'',
	'A [link](https://temcocontrols.com) and a picture:',
	'',
	'![The cabinet](media/cabinet.png)',
	'',
].join('\n');

check('a whole page survives the round trip unchanged', () => {
	assert.equal(roundTrip(page), page);
});

check('a table stays a Markdown table, not raw HTML', () => {
	const markdown = roundTrip('| Step | Test |\n| --- | --- |\n| 1 | Ping |\n');
	assert.equal(markdown, '| Step | Test |\n| --- | --- |\n| 1 | Ping |\n');
});

check('a tight list stays tight', () => {
	assert.equal(roundTrip('- one\n- two\n'), '- one\n- two\n');
	assert.equal(roundTrip('1. one\n2. two\n'), '1. one\n2. two\n');
});

check('a nested list keeps its indentation', () => {
	assert.equal(roundTrip('- one\n    - inside\n- two\n'), '- one\n    - inside\n- two\n');
});

check('marks come back as marks', () => {
	assert.equal(roundTrip('Some **bold**, *italic*, `code` and ~~struck~~ text.\n'), 'Some **bold**, *italic*, `code` and ~~struck~~ text.\n');
});

check('an underline and a highlight survive as inline HTML', () => {
	// Markdown has no underline and no highlight; the surface keeps them as the HTML Markdown already allows, so the
	// command is not erased by the next save.
	assert.equal(roundTrip('A <u>underlined</u> word and a <mark>marked</mark> one.\n'), 'A <u>underlined</u> word and a <mark>marked</mark> one.\n');
});

check('a quote and a fence keep their shape', () => {	assert.equal(roundTrip('> quoted\n\n```js\nconst a = 1;\n```\n'), '> quoted\n\n```js\nconst a = 1;\n```\n');
});

check('a task list keeps its boxes', () => {
	assert.equal(roundTrip('- [x] done\n- [ ] to do\n'), '- [x] done\n- [ ] to do\n');
});

check('a task list the editor rendered keeps its boxes', () => {
	// The checkbox as Tiptap renders it: inside a `<label>`, with the words in a `<div>`. `turndown-plugin-gfm` only sees
	// a checkbox that is its item's first child, so this is the shape that used to save as `- done` — every ticked box in
	// a page was lost on the next save. `scripts/check-task-lists.mts` drives the editor itself; this is the same HTML.
	const item = (checked: boolean, words: string): string =>
		`<li data-checked="${checked}" data-type="taskItem"><label><input type="checkbox"${checked ? ' checked="checked"' : ''}><span></span></label><div><p>${words}</p></div></li>`;
	assert.equal(
		toMarkdown(`<ul data-type="taskList">${item(true, 'done')}${item(false, 'to do')}</ul>`),
		'- [x] done\n- [ ] to do\n'
	);
});

check('a plain bullet list is not a task list', () => {
	assert.equal(roundTrip('- one\n- two\n'), '- one\n- two\n');
});

check('markdown in, the editor gets blocks', () => {
	const html = toHtml('- one\n\n| a | b |\n| --- | --- |\n');
	assert.match(html, /<ul>/u);
	assert.match(html, /<table>/u);
});

check('the file always ends with one newline', () => {
	assert.equal(toMarkdown('<p>end</p>'), 'end\n');
	assert.equal(toMarkdown('<p>end</p>\n\n\n'), 'end\n');
});

check('an empty page stays empty', () => {
	assert.equal(roundTrip(''), '\n');
});

console.log(failures === 0 ? '\nAll page round-trip checks passed.' : `\n${failures} page round-trip check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
