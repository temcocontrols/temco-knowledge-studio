// The surface, loaded into a DOM and driven the way the host drives it.
//
// The bundle is what a person actually runs, so the check is against the built file and not against the sources: it
// answers "does this surface start, does it ask for the page, does it draw what arrives, and does an edit reach the
// host?" — the four failures that are invisible in a compiler and obvious in an empty tab.
//
// Run with `npm run check-surface`, after `npm run compile && npm run build-webview`.

import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const bundle = fileURLToPath(new URL('../out/webview/page/page.js', import.meta.url));
const entry = fileURLToPath(new URL('../webview/page/main.tsx', import.meta.url));

try {
	assert.ok(statSync(bundle).mtimeMs >= statSync(entry).mtimeMs, 'out/webview/page/page.js is older than webview/page/main.tsx');
} catch (error) {
	console.log(`Cannot run: ${(error as Error).message}`);
	console.log('Build first:  npm run compile && npm run build-webview');
	process.exit(1);
}

const page = [
	'# Wiring a T3000 controller',
	'',
	'A controller joins the network when it has an address.',
	'',
	'- one',
	'- two',
	'',
].join('\n');

/** What the surface sent to its host, in order. */
const sent: { type?: string; text?: string }[] = [];

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
	runScripts: 'outside-only',
	pretendToBeVisual: true,
	url: 'https://example.test/',
});

const { window } = dom;
// jsdom has no layout: ProseMirror asks for rectangles while it dispatches, and a `Range` without `getClientRects`
// throws before the transaction reaches `onUpdate`. These are the two calls it makes, answered with an empty box.
const box = { x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, toJSON: () => ({}) };
const rects = Object.assign([], { item: () => null }) as unknown as DOMRectList;
window.Range.prototype.getClientRects = () => rects;
window.Range.prototype.getBoundingClientRect = () => box as DOMRect;
window.Element.prototype.getClientRects = () => rects;
window.Element.prototype.getBoundingClientRect = () => box as DOMRect;
// The one API a webview has that a browser does not: the message pipe back to the extension host.
(window as unknown as { acquireVsCodeApi: () => unknown }).acquireVsCodeApi = () => ({
	postMessage: (message: { type?: string; text?: string }) => sent.push(message),
});

// Loaded as a classic script, exactly as the webview loads it.
window.eval(readFileSync(bundle, 'utf8'));

let failures = 0;
async function check(name: string, run: () => void | Promise<void>): Promise<void> {
	try {
		await run();
		console.log(`PASS  ${name}`);
	} catch (error) {
		failures++;
		console.log(`FAIL  ${name}\n      ${(error as Error).message.split('\n').join('\n      ')}`);
	}
}

/**
 * Wait for the surface to finish drawing.
 *
 * React renders on its own schedule, so a fixed sleep is a race: the same run passes on a warm machine and fails on a
 * cold one. The check waits for the fact it is about to assert, and fails on the deadline instead.
 */
async function drawn(tryIt: () => boolean, what: string, timeout = 3000): Promise<void> {
	const started = Date.now();
	while (Date.now() - started < timeout) {
		if (tryIt()) {
			return;
		}
		await new Promise(resolve => window.setTimeout(resolve, 10));
	}
	throw new Error(`timed out waiting for ${what}`);
}

const root = window.document.getElementById('root');

await check('the surface starts and asks for the page, once', async () => {
	await drawn(() => (root?.childElementCount ?? 0) > 0, 'the surface to start');
	assert.deepEqual(sent.map(message => message.type), ['ready']);
});

// The host answers `ready` with the document — this is the real handshake, in the real order.
window.postMessage({ type: 'set', text: page, path: 'docs/t3000/wiring.md' }, '*');

await check('the document arrives and is drawn as a page', async () => {
	// The page and the head are two renders: ProseMirror paints the document itself, React commits the head a tick
	// later. Wait for both before asserting anything about the whole surface.
	await drawn(() => root?.querySelector('.doc-surface__where')?.textContent === 'docs/t3000/wiring.md', 'the head to name the page');
	assert.equal(root?.querySelector('h1')?.textContent, 'Wiring a T3000 controller');
	assert.equal(root?.querySelectorAll('li').length, 2);
	assert.equal(root?.textContent?.includes('docs/t3000/wiring.md'), true, 'the head does not name the page');
});

await check('the bar and the status strip are there', async () => {
	await drawn(() => root?.querySelector('[role="toolbar"]') !== null, 'the bar to be drawn');
	assert.equal((root?.querySelectorAll('.bar__btn').length ?? 0) > 10, true, 'the bar has no controls');
	assert.equal(/\d+ words/.test(root?.textContent ?? ''), true, 'no word count');
	assert.equal(/\d+ characters/.test(root?.textContent ?? ''), true, 'no character count');
});

await check('nothing was written back just because the page arrived', async () => {
	assert.deepEqual(sent.map(message => message.type), ['ready']);
});

// The write path: an edit in the surface must reach the host as the whole page, once the typing settles. The edit is a
// DOM mutation plus the `input` event a browser fires for it — the same path ProseMirror's DOM observer reads.
const doc = root?.querySelector<HTMLElement>('.doc-surface__doc') ?? null;
const paragraph = doc?.querySelector('p') ?? null;
const text = paragraph?.firstChild ?? null;

await check('an edit is written back as Markdown, once', async () => {
	assert.ok(paragraph !== null && paragraph !== undefined && text !== null && text !== undefined, 'no paragraph to type into');
	const range = window.document.createRange();
	range.setStart(text, (text.textContent ?? '').length);
	range.collapse(true);
	window.getSelection()?.removeAllRanges();
	window.getSelection()?.addRange(range);
	text.textContent = `${text.textContent ?? ''}Z`;
	paragraph.dispatchEvent(new window.Event('input', { bubbles: true }));

	await drawn(() => sent.some(message => message.type === 'change'), 'the edit to reach the host');
	const changes = sent.filter(message => message.type === 'change');
	assert.equal(changes.length, 1, `the host saw ${changes.length} changes`);
	assert.equal(changes[0].text?.includes('# Wiring a T3000 controller'), true, 'the page lost its heading');
	assert.equal(changes[0].text?.includes('address.Z'), true, 'the typed text did not reach the file');
	assert.equal(changes[0].text?.endsWith('\n'), true, 'the file must end with one newline');
});

/** The button whose label is `label`, wherever the surface put it. */
function link(label: string): HTMLElement {
	const found = Array.from(root?.querySelectorAll<HTMLElement>('.doc-surface__link') ?? [])
		.find(element => element.textContent === label);
	assert.ok(found, `no "${label}" control`);
	return found;
}

await check('the serializer panel shows both, and the file kept the contract', async () => {
	// The badge may say either thing — what must hold is that it agrees with the panes it is describing.
	link('Compare serialisers').click();
	await drawn(() => root?.querySelectorAll('.doc-surface__code').length === 2, 'the two panes to open');
	const panes = Array.from(root?.querySelectorAll<HTMLElement>('.doc-surface__code') ?? []).map(pane => pane.textContent ?? '');
	const saved = sent.filter(message => message.type === 'change')[0].text;
	assert.equal(panes[0], saved, 'the left pane is not what is saved');
	assert.equal(panes[1].length > 0, true, 'the right pane is empty');
	const badge = Array.from(root?.querySelectorAll('.badge') ?? []).find(element => /serialisers/.test(element.textContent ?? ''));
	assert.ok(badge, 'no serializer badge');
	const agree = badge.textContent === 'serialisers agree';
	assert.equal(agree, panes[0] === panes[1], 'the badge disagrees with the panes');
	// Closing it must leave the page alone: the comparison never writes.
	Array.from(root?.querySelectorAll<HTMLElement>('.doc-surface__btn') ?? []).find(element => element.textContent === 'Close')?.click();
	await drawn(() => root?.querySelectorAll('.doc-surface__code').length === 0, 'the panel to close');
	assert.equal(sent.filter(message => message.type === 'change').length, 1, 'the comparison wrote to the host');
});

await check('Read mode hides the editor and keeps the page', async () => {
	link('Read the page').click();
	await drawn(() => root?.querySelector('.doc-surface__doc--reading') !== null, 'Read mode to appear');
	assert.equal(root?.querySelector('[contenteditable]') !== null, false, 'the editor is still there');
	assert.equal(root?.querySelector('.doc-surface__doc--reading h1')?.textContent, 'Wiring a T3000 controller');
	assert.equal(root?.querySelector('[role="toolbar"]') !== null, false, 'the bar is still there');
});

await check('leaving Read mode gives the editor back with the same words', async () => {
	link('Edit the page').click();
	await drawn(() => root?.querySelector('[contenteditable]') !== null, 'the editor to come back');
	assert.equal(root?.querySelector('.doc-surface__doc--reading') !== null, false, 'Read mode is still showing');
	assert.equal(root?.querySelector('.doc-surface__doc h1')?.textContent, 'Wiring a T3000 controller');
	assert.equal(root?.textContent?.includes('address.Z'), true, 'the typed text was lost across the mode switch');
});

// A task list is the one construct that used to be destroyed twice: `marked` writes `<ul><li><input type="checkbox">`,
// which is not the shape Tiptap's task list accepts, and the checkbox then sat inside a `<label>`, which the save rule
// did not recognise. Both halves are checked here, through the surface a person actually uses.
window.postMessage({ type: 'set', text: '# Tasks\n\n- [x] done\n- [ ] to do\n', path: 'docs/t000_tasks.md' }, '*');

await check('a task list opens as a task list, checkboxes and all', async () => {
	await drawn(() => root?.querySelector('ul[data-type="taskList"]') !== null, 'the task list to be drawn');
	// The item's own `data-type` is not in the DOM while its interactive node view is mounted, so the list is the anchor.
	assert.equal(root?.querySelectorAll('ul[data-type="taskList"] li').length, 2);
	const boxes = Array.from(root?.querySelectorAll<HTMLInputElement>('ul[data-type="taskList"] input[type="checkbox"]') ?? []);
	assert.equal(boxes.length, 2, 'the checkboxes are not there');
	assert.equal(boxes[0].checked, true, 'the ticked box is not ticked');
	assert.equal(boxes[1].checked, false, 'the empty box is ticked');
});

await check('and it saves back with its checkboxes', async () => {
	const paragraph = root?.querySelector('.doc-surface__doc p') ?? null;
	const text = paragraph?.firstChild ?? null;
	assert.ok(paragraph !== null && text !== null && text !== undefined, 'no paragraph to type into');
	const range = window.document.createRange();
	range.setStart(text, (text.textContent ?? '').length);
	range.collapse(true);
	window.getSelection()?.removeAllRanges();
	window.getSelection()?.addRange(range);
	text.textContent = `${text.textContent ?? ''}Z`;
	paragraph.dispatchEvent(new window.Event('input', { bubbles: true }));

	await drawn(() => sent.filter(message => message.type === 'change').length === 2, 'the task list to be saved');
	const saved = sent.filter(message => message.type === 'change')[1].text ?? '';
	assert.equal(saved.includes('- [x] doneZ'), true, `the ticked item lost its box: ${JSON.stringify(saved)}`);
	assert.equal(saved.includes('- [ ] to do'), true, `the empty item lost its box: ${JSON.stringify(saved)}`);
});

process.exit(failures === 0 ? 0 : 1);
