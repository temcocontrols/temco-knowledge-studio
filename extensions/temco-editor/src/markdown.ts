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
	parentNode?: { childNodes: ArrayLike<RuleNode> } | null;
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
	// Inside a cell the blocks are joined with a space: a cell is one line, and `![x](y)after` is not what was written.
	replacement: (content, node) => (node.parentElement?.closest('td, th') !== null ? ` ${content}` : content),
});

// A picture's width has no Markdown syntax, so it rides in the title: `![caption](media/a.png "w=480")`. `marked` reads
// that title back and `engine/tiptap/image.ts` turns it into the width the drag produced, so a resized picture keeps its
// size in the file rather than only in the session that resized it. With no width this writes exactly what the default
// rule would.
turndown.addRule('imageWithWidth', {
	filter: 'img',
	replacement: (_content, node) => {
		const alt = node.getAttribute?.('alt') ?? '';
		const src = node.getAttribute?.('src') ?? '';
		const width = node.getAttribute?.('width');
		const carried = width !== null && width !== undefined && width !== '' ? `w=${width}` : (node.getAttribute?.('title') ?? '');
		return `![${alt}](${src}${carried === '' ? '' : ` "${carried}"`})`;
	},
});

// A table cell is one line, and GFM's rule does not say so: it hands a cell's content through untouched, so a newline in
// it ends the row and a `|` in it starts a new column. Both corrupt the page silently — the row becomes two lines of
// pipes, and what used to be a table is a paragraph of `|` and raw `<img>`. A cell holds inline content by definition
// (no fence, no list, no second paragraph), so everything that would break that is collapsed here: pipes escaped, runs of
// whitespace and newlines flattened to one space.
turndown.addRule('tableCell', {
	filter: ['th', 'td'],
	replacement: (content, node) => {
		const siblings = node.parentNode?.childNodes;
		let index = 0;
		if (siblings !== undefined && siblings !== null) {
			for (let at = 0; at < siblings.length; at += 1) {
				if (siblings[at] === node) {
					index = at;
					break;
				}
			}
		}
		// The same shape `turndown-plugin-gfm` builds, so its row and border rules still find their cells.
		return `${index === 0 ? '| ' : ' '}${oneLine(content)} |`;
	},
});

/** A cell's content, made safe for a Markdown table row. */
function oneLine(content: string): string {
	return content
		// GFM has one line per row and no way to write a list inside a cell, so each item's marker becomes a separator:
		// `-   one` and `-   two` read `one; two` rather than a run of dashes that no round trip reproduces.
		.replace(/^\s*[-*+]\s+/gmu, '; ')
		.replace(/^\s*\d+[.)]\s+/gmu, '; ')
		// A heading or a quote is the same problem one level up: GFM has no block inside a cell, so the marker goes and the
		// words stay.
		.replace(/^\s*#{1,6}\s+/gmu, '')
		.replace(/^\s*>\s?/gmu, '')
		.replace(/\\\|/gu, '\u0000')
		.replace(/\|/gu, '\\|')
		.replace(/\u0000/gu, '\\|')
		.replace(/\s*\n+\s*/gu, ' ')
		.replace(/^;\s*/u, '')
		.replace(/\s+;/gu, ';')
		.replace(/\s{2,}/gu, ' ')
		.trim();
}

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
