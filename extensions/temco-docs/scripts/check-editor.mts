// Editing operations, driven through a real browser.
//
// This exists because `check-webview.mts` cannot see the bug it was written for. In jsdom the editor renders, and
// `setContent` produces no DOM change when the content is identical — so a check on node identity or on the selection
// passes either way. Chromium is the only place the caret actually exists.
//
// What it protects: the extension answers an unrecognised change by sending the file back, and the editor used to apply
// that with `setContent`, which replaces the document and leaves the caret at the end of the page. The symptom is the
// one that was reported three times — the selection stops halfway, and typing jumps somewhere else.
//
// Run with `npm run check-editor`. Needs `npm run build-webview` first.

import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));

const types: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.svg': 'image/svg+xml',
	'.woff2': 'font/woff2',
	'.woff': 'font/woff',
	'.ttf': 'font/ttf',
};

const server = createServer((request, response) => {
	const path = normalize(decodeURIComponent((request.url ?? '/').split('?')[0])).replace(/^[\\/]+/, '');
	const file = join(root, path);
	if (!file.startsWith(root)) {
		response.writeHead(403).end();
		return;
	}
	readFile(file).then(
		(data) => {
			response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
			response.end(data);
		},
		() => response.writeHead(404).end()
	);
});

await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
const port = (server.address() as { port: number }).port;

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
	if (!ok) {
		failures++;
	}
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || detail === '' ? '' : `\n      ${detail}`}`);
}

const browser = await chromium.launch();
try {
	const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
	const errors: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error') {
			errors.push(message.text().slice(0, 160));
		}
	});
	page.on('pageerror', (error) => errors.push(String(error).slice(0, 160)));

	// `?echo=1` answers every `change` with a `set`, the way the extension does when it does not recognise the text.
	await page.goto(`http://127.0.0.1:${port}/scripts/editor-harness.html?echo=1`, { waitUntil: 'load' });
	await page.waitForSelector('.ProseMirror h1', { timeout: 15000 });
	await page.waitForTimeout(500);

	/** Where the caret is, as an offset into the editor's text, and what is selected. */
	const caret = () =>
		page.evaluate(() => {
			const selection = window.getSelection();
			if (selection === null || selection.rangeCount === 0) {
				return { at: -1, selected: '' };
			}
			const range = selection.getRangeAt(0);
			const editor = document.querySelector('.ProseMirror') as Node;
			const upTo = document.createRange();
			upTo.setStart(editor, 0);
			upTo.setEnd(range.startContainer, range.startOffset);
			return { at: upTo.toString().length, selected: range.toString() };
		});

	const paragraph = () => page.evaluate(() => document.querySelector('.ProseMirror p')?.textContent ?? '');

	/** A click that lands between the "d" and the "i" of "different" — a position easy to find again in the text. */
	const point = await page.evaluate(() => {
		const target = [...document.querySelectorAll('.ProseMirror p')].find((node) =>
			(node.textContent ?? '').includes('Rated for 24 V')
		);
		const walker = document.createTreeWalker(target as Node, NodeFilter.SHOW_TEXT);
		let node: Node | null = null;
		while ((node = walker.nextNode()) !== null) {
			const at = (node.textContent ?? '').indexOf('different');
			if (at >= 0) {
				const range = document.createRange();
				range.setStart(node, at);
				range.setEnd(node, at + 1);
				const box = range.getBoundingClientRect();
				return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
			}
		}
		return null;
	});

	if (point === null) {
		check('the fixture has a paragraph to click', false);
	} else {
		await page.mouse.click(point.x, point.y);
		await page.waitForTimeout(250);
		const clicked = await caret();

		// Type, then let the settle fire and the echo come back.
		for (const character of ['a', 'b', 'c']) {
			await page.keyboard.type(character);
			await page.waitForTimeout(120);
		}
		const typed = await caret();
		await page.waitForTimeout(900);
		const echoed = await caret();

		check('typing inserts at the caret', (await paragraph()).includes('abc') && typed.at === clicked.at + 3, `caret ${clicked.at} -> ${typed.at}`);
		check('the echoed document does not move the caret', echoed.at === typed.at, `caret was ${typed.at}, became ${echoed.at}`);
		check('the echoed document keeps what was typed', (await paragraph()).includes('abc'));

		// Backspace must delete where the caret is, not at the end of the page.
		await page.keyboard.press('Backspace');
		await page.waitForTimeout(900);
		const afterBackspace = await caret();
		check('Backspace deletes the character before the caret', afterBackspace.at === typed.at - 1 && (await paragraph()).includes('ab') && !(await paragraph()).includes('abc'), `caret ${afterBackspace.at}`);

		// A selection must survive a round trip, and typing must replace exactly it.
		await page.keyboard.down('Shift');
		for (let i = 0; i < 4; i++) {
			await page.keyboard.press('ArrowLeft');
		}
		await page.keyboard.up('Shift');
		await page.waitForTimeout(900);
		const selected = await caret();
		check('a selection survives the echoed document', selected.selected.length === 4, `selected "${selected.selected}"`);

		await page.keyboard.press('ArrowRight');
		await page.waitForTimeout(100);

		// The rule that matters most: an outside change may not replace the document under somebody's hands.
		const caretBeforeOutside = await caret();
		const textBeforeOutside = await paragraph();
		await page.evaluate(() => {
			window.dispatchEvent(
				new window.MessageEvent('message', {
					data: { type: 'set', text: '# Replaced\n\nThe file changed on disk while you were typing.\n' },
				})
			);
		});
		await page.waitForTimeout(300);
		const whileFocused = await caret();
		const textWhileFocused = await paragraph();

		check(
			'an outside change does not touch the document while the editor is focused',
			whileFocused.at === caretBeforeOutside.at && textWhileFocused === textBeforeOutside,
			`caret ${caretBeforeOutside.at} -> ${whileFocused.at}`
		);

		// Leaving the editor is the moment it becomes safe to apply.
		await page.evaluate(() => (document.querySelector('.ProseMirror') as HTMLElement).blur());
		await page.waitForTimeout(400);
		const afterBlur = await page.evaluate(() => document.querySelector('.ProseMirror')?.textContent ?? '');

		check('the outside change arrives once the editor is left', afterBlur.includes('changed on disk'), afterBlur.slice(0, 60));
	}

	check('no console or page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
	await browser.close();
	server.close();
}

console.log(failures === 0 ? '\nEDITING BEHAVES' : `\n${failures} PROBLEM(S)`);
process.exitCode = failures === 0 ? 0 : 1;
