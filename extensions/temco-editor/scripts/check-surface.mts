// The surface, loaded into a DOM and driven the way the host drives it.
//
// The bundle is what a person actually runs, so the check is against the built file and not against the sources: it
// answers "does this surface start, does it ask for the page, does it draw what arrives, and does an edit reach the
// host?" — the four failures that are invisible in a compiler and obvious in an empty tab.
//
// It is also the only place the engine's furniture is asserted: the block handle and the selection menu are drawn by
// Tiptap, not by the ribbon, so nothing else would notice if they stopped being mounted.
//
// Run with `npm run check-surface`, after `npm run compile && npm run build-webview`.

import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const assets = 'markdown';
const bundle = fileURLToPath(new URL(`../out/webview/${assets}/${assets}.js`, import.meta.url));
const entry = fileURLToPath(new URL('../webview/markdown/main.tsx', import.meta.url));

try {
	assert.ok(statSync(bundle).mtimeMs >= statSync(entry).mtimeMs, `out/webview/${assets}/${assets}.js is older than webview/markdown/main.tsx`);
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

// The observers a positioner needs and a DOM without layout cannot provide. No-op is enough: nothing here asserts a
// position, only that the surface draws and that an edit travels.
class Observer {
	observe(): void { }
	unobserve(): void { }
	disconnect(): void { }
	takeRecords(): unknown[] { return []; }
}
(window as unknown as { ResizeObserver: unknown }).ResizeObserver = Observer;
(window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = Observer;

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
async function drawn(tryIt: () => boolean, what: string, timeout = 5000): Promise<void> {
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

/** The control the surface draws for `label`: a `Tool` names itself with `aria-label`, a tab with its own text. */
function button(label: string): HTMLElement {
	const byLabel = root?.querySelector<HTMLElement>(`[aria-label="${label}"]`) ?? null;
	const byText = Array.from(root?.querySelectorAll<HTMLElement>('.btn, .ribbon__tab') ?? [])
		.find(element => (element.textContent ?? '').trim() === label) ?? null;
	const found = byLabel ?? byText;
	assert.ok(found, `no "${label}" control`);
	return found;
}

await check('the surface starts and asks for the page, once', async () => {
	await drawn(() => (root?.childElementCount ?? 0) > 0, 'the surface to start');
	assert.deepEqual(sent.map(message => message.type), ['ready']);
});

// The host answers `ready` with the document — this is the real handshake, in the real order.
window.postMessage({ type: 'set', text: page, path: 'docs/t3000/wiring.md' }, '*');

await check('the document arrives and is drawn as a page', async () => {
	await drawn(() => root?.querySelector('.page-surface__doc h1')?.textContent === 'Wiring a T3000 controller', 'the heading to be drawn');
	assert.equal(root?.querySelectorAll('.page-surface__doc li').length, 2, 'the bullets are not there');
});

await check('the ribbon, the status strip and the engine furniture are there', async () => {
	await drawn(() => root?.querySelector('.ribbon') !== null, 'the ribbon to be drawn');
	assert.equal((root?.querySelectorAll('.ribbon .btn').length ?? 0) > 5, true, 'the ribbon has no controls');
	assert.equal(/\d+ words/.test(root?.textContent ?? ''), true, 'no word count');
	// The block handle and the selection menu are the engine's own: mounted by `actions.node()`, not by the ribbon.
	assert.ok(root?.querySelector('.drag-handle'), 'the block handle was not mounted');
	assert.equal(root?.querySelector('.bubble') === null, true, 'the selection menu showed with nothing selected');
});

await check('nothing was written back just because the page arrived', async () => {
	assert.deepEqual(sent.map(message => message.type), ['ready']);
});

// The write path: an edit in the surface must reach the host as the whole page, once the typing settles. The edit is a
// DOM mutation plus the `input` event a browser fires for it — the same path ProseMirror's DOM observer reads.
function typeInto(paragraph: Element): void {
	const text = paragraph.firstChild;
	assert.ok(text !== null, 'no text node to type into');
	const range = window.document.createRange();
	range.setStart(text, (text.textContent ?? '').length);
	range.collapse(true);
	window.getSelection()?.removeAllRanges();
	window.getSelection()?.addRange(range);
	text.textContent = `${text.textContent ?? ''}Z`;
	paragraph.dispatchEvent(new window.Event('input', { bubbles: true }));
}

await check('an edit is written back as Markdown, once', async () => {
	const paragraph = root?.querySelector('.page-surface__doc p');
	assert.ok(paragraph, 'no paragraph to type into');
	typeInto(paragraph);

	await drawn(() => sent.some(message => message.type === 'change'), 'the edit to reach the host');
	const changes = sent.filter(message => message.type === 'change');
	assert.equal(changes.length, 1, `the host saw ${changes.length} changes`);
	assert.equal(changes[0].text?.includes('# Wiring a T3000 controller'), true, 'the page lost its heading');
	assert.equal(changes[0].text?.includes('address.Z'), true, 'the typed text did not reach the file');
	assert.equal(changes[0].text?.endsWith('\n'), true, 'the file must end with one newline');
	assert.equal(changes[0].text?.includes('- one\n- two'), true, 'the bullets did not survive the save');
});

await check('Read mode hides the editor and keeps the page', async () => {
	// Read mode lives on the View tab, so the tab has to be opened before its control exists.
	button('View').click();
	await drawn(() => root?.querySelector('[aria-label="Read the page"]') !== null, 'the read control');
	button('Read the page').click();
	await drawn(() => root?.querySelector('.page-surface__doc--reading') !== null, 'Read mode to appear');
	assert.equal(root?.querySelector('[contenteditable]') !== null, false, 'the editor is still there');
	assert.equal(root?.querySelector('.page-surface__doc--reading h1')?.textContent, 'Wiring a T3000 controller');
});

await check('leaving Read mode gives the editor back with the same words', async () => {
	button('Edit the page').click();
	await drawn(() => root?.querySelector('[contenteditable]') !== null, 'the editor to come back');
	assert.equal(root?.querySelector('.page-surface__doc--reading') !== null, false, 'Read mode is still showing');
	assert.equal(root?.querySelector('.page-surface__doc h1')?.textContent, 'Wiring a T3000 controller');
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
	const paragraph = root?.querySelector('.page-surface__doc p');
	assert.ok(paragraph, 'no paragraph to type into');
	typeInto(paragraph);

	await drawn(() => sent.filter(message => message.type === 'change').length === 2, 'the task list to be saved');
	const saved = sent.filter(message => message.type === 'change')[1].text ?? '';
	assert.equal(saved.includes('- [x] doneZ'), true, `the ticked item lost its box: ${JSON.stringify(saved)}`);
	assert.equal(saved.includes('- [ ] to do'), true, `the empty item lost its box: ${JSON.stringify(saved)}`);
});

process.exit(failures === 0 ? 0 : 1);
