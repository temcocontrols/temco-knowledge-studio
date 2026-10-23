// Does the Rich editor actually render?
//
// Bundling is not the same as working: a webview that throws in its first render is a blank tab, and nothing in `tsc` or
// `eslint` says a word about it. This loads the *built bundle* into a DOM, gives it the globals a VS Code webview has,
// and fails on any console error or uncaught exception — the exact failure that made the editor empty once.
//
// It also asserts the pieces are present: the template's toolbar, the ProseMirror surface, the outline panel. And it
// sends the `set` message the extension sends, then checks the editor really holds the markdown that arrived.
//
// Run with `npm run check-webview`.

import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(
	'<!doctype html><html><body class="vscode-dark"><div id="root"></div></body></html>',
	{ runScripts: 'outside-only', pretendToBeVisual: true }
);
const { window } = dom;

/** What a webview has and jsdom does not. */
const stubs = {
	acquireVsCodeApi: () => ({
		postMessage: (message: unknown) => sent.push(message),
		getState: () => undefined,
		setState: () => undefined,
	}),
	matchMedia: (query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
		addListener: () => undefined,
		removeListener: () => undefined,
		dispatchEvent: () => false,
	}),
	ResizeObserver: class {
		observe() { }
		unobserve() { }
		disconnect() { }
	},
	IntersectionObserver: class {
		observe() { }
		unobserve() { }
		disconnect() { }
		takeRecords() {
			return [];
		}
	},
	scrollTo: () => undefined,
	requestAnimationFrame: (callback: () => void) => setTimeout(callback, 0),
	cancelAnimationFrame: () => undefined,
};

const target = window as unknown as Record<string, unknown>;
for (const [name, value] of Object.entries(stubs)) {
	target[name] = value;
}

const sent: { type?: unknown }[] = [];
const failures: string[] = [];

window.addEventListener('error', (event) => {
	failures.push(`window.error: ${(event.error as Error | undefined)?.stack ?? event.message}`);
});
window.addEventListener('unhandledrejection', (event) => {
	failures.push(`unhandled rejection: ${String(event.reason)}`);
});
const echo = window.console.error.bind(window.console);
window.console.error = (...args: unknown[]) => {
	failures.push(`console.error: ${args.map(String).join(' ').slice(0, 500)}`);
	echo(...args);
};

const bundle = readFileSync(new URL('../out/webview/tiptap/tiptap.js', import.meta.url), 'utf8');
try {
	window.eval(bundle);
} catch (error) {
	failures.push(`threw while loading: ${(error as Error)?.stack ?? String(error)}`);
}

/** The extension's first message, once the webview has said it is ready. */
const PAGE = '# T3 Controller\n\nStand alone programmable controllers.\n\n## Configuration\n\nSet the scale.\n';

for (let attempt = 0; attempt < 40; attempt++) {
	await new Promise((resolve) => setTimeout(resolve, 50));
	if (sent.some((message) => message.type === 'ready')) {
		break;
	}
}

window.dispatchEvent(new window.MessageEvent('message', { data: { type: 'set', text: PAGE } }));
await new Promise((resolve) => setTimeout(resolve, 400));

const document2 = window.document;
const checks: [string, boolean][] = [
	['the webview reported ready', sent.some((message) => message.type === 'ready')],
	['the template toolbar rendered', document2.querySelector('.tiptap-toolbar') !== null],
	['the editing surface rendered', document2.querySelector('.ProseMirror') !== null],
	['the outline panel rendered', document2.querySelector('.temco-outline') !== null],
	['the outline has the page headings', (document2.querySelectorAll('.temco-outline__row').length ?? 0) >= 2],
	['the document text arrived', (document2.querySelector('.ProseMirror')?.textContent ?? '').includes('Stand alone programmable')],
	['the sheet is around the page', document2.querySelector('.temco-sheet') !== null],
];

// --- the document through a message round trip ------------------------------------------------------------
// The extension sends the file back whenever a change does not match what it expected. If that *replaces* the
// document, the caret lands at the end of the page and every keystroke after it goes to the wrong place — which is
// exactly what "the cursor jumps when I type" turned out to be. A `set` that says nothing new must not rebuild the
// document at all. Node identity is what is checked, because a rebuilt document is a new element even when its text
// is identical, and unlike the selection that is observable here.

const sendSet = (text: string): void => {
	window.dispatchEvent(new window.MessageEvent('message', { data: { type: 'set', text } }));
};

const firstParagraph = (): Node | null => document2.querySelector('.ProseMirror p');
const textBefore = firstParagraph()?.textContent ?? '';

sendSet(PAGE);
await new Promise((resolve) => setTimeout(resolve, 220));

// An outside change: one word differs, so there is something real to apply.
sendSet(PAGE.replace('Stand alone', 'A stand-alone'));
await new Promise((resolve) => setTimeout(resolve, 220));
const afterOutside = firstParagraph()?.textContent ?? '';

checks.push(
	['an outside change still reaches the page', afterOutside.includes('A stand-alone') && afterOutside !== textBefore]
);

let failed = 0;
for (const [name, ok] of checks) {
	if (!ok) {
		failed++;
	}
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

if (failures.length > 0) {
	console.log(`\n${failures.length} runtime error(s):`);
	for (const line of failures.slice(0, 8)) {
		console.log(line.split('\n').slice(0, 3).join('\n'));
	}
}

const total = failed + failures.length;
console.log(total === 0 ? '\nTHE RICH EDITOR RENDERS' : `\n${total} PROBLEM(S)`);
process.exitCode = total === 0 ? 0 : 1;
