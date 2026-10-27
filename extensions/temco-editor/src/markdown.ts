// The Markdown ⇄ HTML round trip a page is saved through.
//
// The file on disk is Markdown and stays Markdown: a page is opened by rendering it into the editor, and it is saved by
// writing the editor back as Markdown. That means the conversion is the contract — if it drops a table, re-indents a
// bullet or re-wraps a line, every save rewrites text the writer did not touch. It is pure and lives in `src/` beside the
// rest of the module's logic, so the rule can be checked outside a browser (`scripts/check-page.mts`).

import { Marked } from 'marked';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const marked = new Marked({ gfm: true, breaks: false });

/** The part of a DOM node a turndown rule reads. The module is compiled without the DOM lib, and this is all it uses. */
interface RuleNode {
	nodeName: string;
	parentElement?: { closest(selectors: string): unknown } | null;
	getAttribute?(name: string): string | null;
}

interface Rule {
	filter: string | string[] | ((node: RuleNode) => boolean);
	replacement: (content: string, node: RuleNode) => string;
}

// `@types/turndown` describes the options object but not the three methods this module configures with.
const turndown = new TurndownService({
	headingStyle: 'atx',
	codeBlockStyle: 'fenced',
	bulletListMarker: '-',
	emDelimiter: '*',
}) as TurndownService & {
	use(plugin: unknown): void;
	addRule(key: string, rule: Rule): void;
	keep(tags: string[]): void;
};
turndown.use(gfm);

// The GFM plugin writes a single `~`, which is not strikethrough in Markdown — reopening the page would show the tildes.
turndown.addRule('strikethrough', {
	filter: ['del', 's', 'strike'],
	replacement: content => `~~${content}~~`,
});

// A task item's checkbox, wherever the editor put it.
//
// `turndown-plugin-gfm` only recognises a checkbox that is the *first child* of the list item, which is the shape a
// Markdown parser produces. Tiptap renders it inside a `<label>` (so it can be styled and announced), and that input was
// dropped — so a page whose checkboxes were ticked came back as `- done` on the next save. Reading the input wherever it
// sits writes `[x] ` / `[ ] ` for both shapes, and the list item's own rule still supplies the bullet and the indent.
turndown.addRule('taskCheckbox', {
	filter: node => node.nodeName === 'INPUT' && node.getAttribute?.('type') === 'checkbox',
	replacement: (_content, node) => `${isChecked(node) ? '[x]' : '[ ]'} `,
});

/** A checkbox is checked when the property says so, or — without a live DOM — when the attribute is present. */
function isChecked(node: RuleNode): boolean {
	const checked = (node as { checked?: unknown }).checked;
	if (typeof checked === 'boolean') {
		return checked;
	}
	return node.getAttribute?.('checked') !== null && node.getAttribute?.('checked') !== undefined;
}

// Markdown has no underline and no highlight, so a command that produced one would be erased the moment the page was
// saved. They are kept as the inline HTML Markdown already allows, which `marked` reads back as the same element.
turndown.keep(['u', 'mark']);

// A page is one paragraph per source line. Turndown separates blocks with a blank line, which is what the file already
// has between paragraphs — so nothing here re-wraps a line the writer laid out.
turndown.addRule('noWrapping', {
	filter: 'p',
	replacement: content => `${content}\n\n`,
});

// A paragraph inside a list item or a table cell is the exception: the blank line there turns a tight list into a loose
// one and breaks a table row, so every bullet and cell would be rewritten on every save. The `<div>` Tiptap wraps a task
// item's words in is the same exception one level out — it is a wrapper the editor adds, not a block Markdown has.
turndown.addRule('tightBlock', {
	filter: node => (node.nodeName === 'P' || node.nodeName === 'DIV') && node.parentElement?.closest('li, td, th') !== null,
	replacement: content => content,
});

/** Markdown in, HTML for the editor. */
export function toHtml(markdown: string): string {
	return String(marked.parse(markdown));
}

/** HTML from the editor, back to Markdown for the file. */
export function toMarkdown(html: string): string {
	// Tiptap wraps every table in a `<colgroup>`, and the GFM rule only recognises a table whose first child is a row —
	// with the colgroup left in, a table serialises as raw HTML and the file loses its Markdown. Widths are not ours to
	// keep: the reader decides them.
	const markdown = turndown.turndown(html.replace(/<colgroup>[\s\S]*?<\/colgroup>/gi, ''));
	return `${
		markdown
			.replace(/\n{3,}/g, '\n\n')
			// Turndown pads an item's marker to the width of the marker it would have used for a longer list, so a tight
			// list comes back as `-   one`. The file keeps one space, otherwise every save rewrites every bullet.
			.replace(/^(\s*)[-*+]\s{2,}/gm, '$1- ')
			.replace(/^(\s*\d+)[.)]\s{2,}/gm, '$1. ')
			// A checkbox the plugin wrote leaves its own space behind, so the task's text gains one more each save.
			.replace(/^(\s*[-*+] \[[ xX]\])\s{2,}/gm, '$1 ')
			.trimEnd()
	}\n`;
}

/** The page a writer opened, unchanged: what a save must produce when nothing was typed. */
export function roundTrip(markdown: string): string {
	return toMarkdown(toHtml(markdown));
}
