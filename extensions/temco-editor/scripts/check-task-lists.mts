// A task list, through the editor itself.
//
// Two shapes meet here and neither is wrong: `marked` writes `<ul><li><input type="checkbox"> done</li></ul>`, and Tiptap
// renders `ul[data-type="taskList"] > li[data-type="taskItem"]`. A page whose checkboxes were ticked used to open as a
// plain bullet list — the input matched no parse rule — and then save as `- done`. `webview/markdown/engine/tiptap/taskLists.mts`
// teaches the editor the second shape; `src/markdown.ts` reads the checkbox back wherever it sits.
//
// `check-page.mts` proves the serialiser; this proves the pair. It runs in jsdom because a ProseMirror editor needs a
// document, and it imports the extension module directly rather than the bundle, so the failure names the rule.
//
// Run with `npm run check-task-lists`.

import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { pretendToBeVisual: true });
const globals = globalThis as unknown as Record<string, unknown>;
globals.window = dom.window;
globals.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globals.HTMLElement = dom.window.HTMLElement;
globals.Element = dom.window.HTMLElement;
globals.Node = dom.window.Node;
globals.getSelection = () => dom.window.getSelection();
globals.DOMParser = dom.window.DOMParser;

// The extension is CommonJS, so the page conversion under test is the compiled one — the same rule `check-page.mts`
// follows. A stale `out/` would quietly test yesterday's rules, so it refuses to run instead.
const source = fileURLToPath(new URL('../src/markdown.ts', import.meta.url));
const built = fileURLToPath(new URL('../out/markdown.js', import.meta.url));

try {
	assert.ok(statSync(built).mtimeMs >= statSync(source).mtimeMs, 'out/markdown.js is older than src/markdown.ts');
} catch (error) {
	console.log(`Cannot run: ${(error as Error).message}`);
	console.log('Compile first:  npm run compile');
	process.exit(1);
}

const { Editor } = await import('@tiptap/core');
const { default: StarterKit } = await import('@tiptap/starter-kit');
const { TaskItemWithCheckboxes, TaskListWithCheckboxes } = await import('../webview/markdown/engine/tiptap/taskLists.mts');
const { toHtml, toMarkdown } = createRequire(import.meta.url)(built) as typeof import('../src/markdown');

let failures = 0;
function check(name: string, run: () => void): void {
	try {
		run();
		console.log(`PASS  ${name}`);
	} catch (error) {
		failures++;
		console.log(`FAIL  ${name}\n      ${(error as Error).message.split('\n').join('\n      ')}`);
	}
}

/** The editor the surface builds, with the two extensions under test and nothing else that could hide their effect. */
function editorFor(html: string): InstanceType<typeof Editor> {
	return new Editor({
		extensions: [StarterKit, TaskListWithCheckboxes, TaskItemWithCheckboxes.configure({ nested: true })],
		content: html,
	});
}

/** The document as the file would see it. */
function saved(markdown: string): string {
	const editor = editorFor(toHtml(markdown));
	try {
		return toMarkdown(editor.getHTML());
	} finally {
		editor.destroy();
	}
}

check('a task list written in a page opens as a task list', () => {
	const editor = editorFor(toHtml('- [x] done\n- [ ] to do\n'));
	try {
		const json = JSON.stringify(editor.getJSON());
		assert.match(json, /"type":"taskList"/u);
		assert.match(json, /"type":"taskItem","attrs":\{"checked":true\}/u);
		assert.match(json, /"type":"taskItem","attrs":\{"checked":false\}/u);
	} finally {
		editor.destroy();
	}
});

check('and saves back exactly as it was written', () => {
	assert.equal(saved('- [x] done\n- [ ] to do\n'), '- [x] done\n- [ ] to do\n');
});

check('the shape the editor renders still parses', () => {
	const item = (checked: boolean, words: string): string =>
		`<li data-checked="${checked}" data-type="taskItem"><label><input type="checkbox"${checked ? ' checked="checked"' : ''}><span></span></label><div><p>${words}</p></div></li>`;
	const editor = editorFor(`<ul data-type="taskList">${item(true, 'done')}${item(false, 'to do')}</ul>`);
	try {
		assert.match(JSON.stringify(editor.getJSON()), /"checked":true/u);
		assert.equal(toMarkdown(editor.getHTML()), '- [x] done\n- [ ] to do\n');
	} finally {
		editor.destroy();
	}
});

check('a plain bullet list is still a bullet list', () => {
	const editor = editorFor(toHtml('- one\n- two\n'));
	try {
		const json = JSON.stringify(editor.getJSON());
		assert.match(json, /"type":"bulletList"/u);
		assert.doesNotMatch(json, /"type":"taskList"/u);
	} finally {
		editor.destroy();
	}
});

check('a bullet list wrapping a task list keeps its own kind', () => {
	// The outer list has no checkbox of its own; only the inner one does. Reading the outer one as a task list would
	// turn a plain bullet into a checkbox on the next save.
	const html = '<ul><li><p>outer</p><ul><li><input type="checkbox" checked> inner</li></ul></li></ul>';
	const editor = editorFor(html);
	try {
		const json = JSON.stringify(editor.getJSON());
		assert.match(json, /"type":"bulletList"/u);
		assert.match(json, /"type":"taskList"/u);
	} finally {
		editor.destroy();
	}
});

console.log(failures === 0 ? '\nAll task-list checks passed.' : `\n${failures} task-list check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
