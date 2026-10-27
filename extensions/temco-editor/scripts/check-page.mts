// The prototype saves through the same Markdown ⇄ HTML round trip the shipped editor uses, so the conversion is this
// module's contract with the file too: what a person did not type must not change on save.
//
// The extension is CommonJS (`main` is `out/extension.js`), so the module under test is the compiled one, and a stale
// `out/` would quietly test yesterday's code — hence the freshness check.
//
// Run with `npm run check-page`, after `npm run compile`.

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
	console.log('Compile first:  npm run compile');
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
	'1. Set the address on the controller.',
	'2. Run the cable.',
	'3. Confirm the link light.',
	'',
	'> Note: do not power the controller from the network switch.',
	'',
	'```js',
	'const device = { id: 1, name: "AHU-1" };',
	'```',
	'',
	'| Step | Test | Expected |',
	'| --- | --- | --- |',
	'| 1 | Ping | replies |',
	'',
].join('\n');

check('a whole page comes back unchanged', () => {
	assert.equal(roundTrip(page), page);
});

check('a table keeps its Markdown', () => {
	const markdown = '| Step | Test |\n| --- | --- |\n| 1 | Ping |\n';
	assert.equal(roundTrip(markdown), markdown);
});

check('a tight list keeps one space per bullet', () => {
	assert.equal(roundTrip('- one\n- two\n'), '- one\n- two\n');
	assert.equal(roundTrip('1. one\n2. two\n'), '1. one\n2. two\n');
});

check('a nested list keeps its indentation', () => {
	assert.equal(roundTrip('- one\n    - inside\n- two\n'), '- one\n    - inside\n- two\n');
});

check('marks keep their delimiters', () => {
	assert.equal(
		roundTrip('Some **bold**, *italic*, `code` and ~~struck~~ text.\n'),
		'Some **bold**, *italic*, `code` and ~~struck~~ text.\n'
	);
});

check('underline and highlight survive as inline HTML', () => {
	assert.equal(
		roundTrip('A <u>underlined</u> word and a <mark>marked</mark> one.\n'),
		'A <u>underlined</u> word and a <mark>marked</mark> one.\n'
	);
});

check('a task list keeps its checkboxes', () => {
	assert.equal(roundTrip('- [x] done\n- [ ] to do\n'), '- [x] done\n- [ ] to do\n');
});

// The checkbox as the *editor* renders it: inside a `<label>`, with the words in a `<div>`. `turndown-plugin-gfm` only
// sees a checkbox that is its item's first child, so this is the shape that used to save as `- done`.
check('a task list the editor rendered keeps its checkboxes', () => {
	const item = (checked: boolean, words: string): string =>
		`<li data-checked="${checked}" data-type="taskItem"><label><input type="checkbox"${checked ? ' checked="checked"' : ''}><span></span></label><div><p>${words}</p></div></li>`;
	const html = `<ul data-type="taskList">${item(true, 'done')}${item(false, 'to do')}</ul>`;
	assert.equal(toMarkdown(html), '- [x] done\n- [ ] to do\n');
});

check('a plain bullet list is not a task list', () => {
	assert.equal(roundTrip('- one\n- two\n'), '- one\n- two\n');
});

check('an empty page is one newline', () => {
	assert.equal(roundTrip(''), '\n');
	assert.equal(toMarkdown('<p></p>'), '\n');
});

// The prototype's editor adds headings and table cells the shipped one never emits with this HTML; both must still
// serialise as Markdown rather than as raw HTML.
check('editor markup for a heading and a table serialises', () => {
	const html = toHtml('# Title\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n');
	assert.match(html, /<h1>/u);
	assert.match(html, /<table>/u);
	assert.equal(roundTrip('# Title\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n'), '# Title\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n');
});

process.exit(failures === 0 ? 0 : 1);
