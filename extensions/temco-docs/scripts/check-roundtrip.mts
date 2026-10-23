// Does a page survive the rich editor unchanged?
//
// This is the check that matters more than any other in this extension: a rich editor that rewrites a file it did not
// change turns every one-word edit into an unreviewable diff. It runs the real stack — TipTap 3.30.3 with the official
// `@tiptap/markdown` and `tidy()` from `webview/markdown.ts` — parses a page exactly as the editor does, serializes it
// back, and reports every line that moved.
//
// Each fixture is a shape the documentation actually uses. Every one must come back **byte-identical**, and running the
// round trip twice must produce the same answer as running it once — otherwise the first save is clean and the second
// is not, which is the same defect one edit later.
//
// Run with `npm run check-roundtrip`.

import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="editor"></div></body></html>');
const global = globalThis as unknown as Record<string, unknown>;
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.Node = dom.window.Node;
global.DOMParser = dom.window.DOMParser;
global.ClipboardEvent = dom.window.ClipboardEvent;
global.DragEvent = dom.window.DragEvent;
global.getSelection = dom.window.getSelection.bind(dom.window);
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });

const { Editor } = await import('@tiptap/core');
const { default: StarterKit } = await import('@tiptap/starter-kit');
const { Table, TableRow, TableCell, TableHeader } = await import('@tiptap/extension-table');
const { TaskList, TaskItem } = await import('@tiptap/extension-list');
const { Image } = await import('@tiptap/extension-image');
const { Highlight } = await import('@tiptap/extension-highlight');
const { Underline } = await import('@tiptap/extension-underline');
const { Mathematics } = await import('@tiptap/extension-mathematics');
const { CodeBlockLowlight } = await import('@tiptap/extension-code-block-lowlight');
const { Markdown } = await import('@tiptap/markdown');
const { common, createLowlight } = await import('lowlight');
const { tidy } = await import('../webview/markdown.mts');

const editor = new Editor({
	element: document.getElementById('editor'),
	extensions: [
		StarterKit.configure({ codeBlock: false, link: { openOnClick: false } }),
		CodeBlockLowlight.configure({ lowlight: createLowlight(common) }),
		Table,
		TableRow,
		TableCell,
		TableHeader,
		TaskList,
		TaskItem.configure({ nested: true }),
		Image.configure({ inline: false, allowBase64: false }),
		Highlight,
		Underline,
		Mathematics.configure({ katexOptions: { throwOnError: false } }),
		Markdown.configure({ indentation: { style: 'space', size: 2 }, markedOptions: { gfm: true, breaks: false } }),
	],
	content: '',
});

/** One pass through the editor, exactly as the webview does it. */
function roundTrip(page: string): string {
	editor.commands.setContent(page, { contentType: 'markdown', emitUpdate: false });
	return tidy(editor.getMarkdown(), page.endsWith('\n'));
}

const FIXTURES: readonly { name: string; page: string }[] = [
	{
		name: 'headings and prose, one paragraph per line',
		page: '# Point Scaling\n\nPoint scaling is configured per controller, and the panel is rated for 24 V only.\n\n## Configuration\n\nSet the scale.\n',
	},
	{ name: 'a table with a header row', page: '| Field | Scale | Unit |\n| --- | --- | --- |\n| AI1 | 0.1 | V |\n| AI2 | 0.5 | V |\n' },
	{ name: 'a table with alignment', page: '| Left | Middle | Right |\n| :--- | :---: | ---: |\n| a | b | c |\n' },
	{ name: 'a table after a heading', page: '## Configuration\n\n| Field | Scale |\n| --- | --- |\n| AI1 | 0.1 |\n' },
	{ name: 'bullet and numbered lists', page: '- a bullet\n- another bullet\n\n1. first\n2. second\n' },
	{ name: 'a task list', page: '- [ ] todo\n- [x] done\n' },
	{ name: 'a code fence with a language', page: '```cpp\nint main() { return 0; }\n```\n' },
	{ name: 'a note callout', page: '> [!NOTE]\n> Rated for 24 V only.\n' },
	{ name: 'a warning callout with prose after it', page: '> [!WARNING]\n> Isolate power first.\n\nThen continue.\n' },
	{ name: 'a plain quote is not a callout', page: '> just a quote\n' },
	{ name: 'inline marks', page: 'Inline `code` and **bold** and *italic* and ~~strike~~ and a [link](other.md).\n' },
	{ name: 'highlight and maths', page: 'Use ==this== and $E = mc^2$ inline.\n' },
	{ name: 'block maths', page: '$$\n\\int_0^1 x^2 dx\n$$\n' },
	{ name: 'an image beside the page', page: '![A screenshot](media/01-panel.png)\n' },
	{ name: 'a horizontal rule', page: '---\n' },
	{ name: 'a page with no trailing newline', page: '# Title\n\nBody text with no final newline.' },
];

let failures = 0;
for (const fixture of FIXTURES) {
	const once = roundTrip(fixture.page);
	const twice = roundTrip(once);
	const same = once === fixture.page;
	const stable = twice === once;

	if (!same || !stable) {
		failures++;
	}
	console.log(
		`${same && stable ? 'PASS' : 'FAIL'}  ${fixture.name}${same ? '  (byte-identical)' : ''}${
			stable ? '' : '  [NOT IDEMPOTENT]'
		}`
	);

	if (!same) {
		const before = fixture.page.split('\n');
		const after = once.split('\n');
		for (let index = 0; index < Math.max(before.length, after.length); index++) {
			if ((before[index] ?? '') !== (after[index] ?? '')) {
				console.log(`        ${index + 1}: in  ${JSON.stringify(before[index] ?? null)}`);
				console.log(`        ${index + 1}: out ${JSON.stringify(after[index] ?? null)}`);
			}
		}
	}
	if (!stable) {
		console.log(`        second pass changed the text again: ${JSON.stringify(twice)}`);
	}
}

editor.destroy();
console.log(failures === 0 ? `\nALL ${FIXTURES.length} FIXTURES PASSED` : `\n${failures} FIXTURE(S) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
