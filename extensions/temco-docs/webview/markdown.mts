// What the serializer produces, turned back into the file the author wrote.
//
// `@tiptap/markdown` is the official serializer and it is careful — which is the problem: it escapes `[` and `]` so a
// round-trip cannot invent a link, it pads table cells so the source is readable, and it separates blocks with a blank
// line it also adds at the end. All three are reasonable for a Markdown *document*; none of them is acceptable for a
// Markdown *file* that a person reviews with `git diff`.
//
// So one function, applied on the way out, undoes exactly three things and nothing else:
//
//   1. the DocFX marker escape (`> \[!NOTE\]` → `> [!NOTE]`), which the build would otherwise print with a backslash
//   2. table padding (`| a   | b   |` → `| a | b |`), which would otherwise rewrite every table on the first save
//   3. blank-line noise (runs of empty lines, a leading blank line), plus the file's own trailing-newline rule
//
// Every transformation is covered by `scripts/check-roundtrip.mts`, which fails on any line that moves.
//
// This module is deliberately free of TipTap and of `vscode`: the app bundles it into the webview and the check script
// imports it directly, so the thing that is tested is the thing that runs.

/** The DocFX renders, by the word the marker uses. */
const KINDS = 'NOTE|TIP|IMPORTANT|CAUTION|WARNING';

/**
 * The serializer escapes both brackets (`\[!NOTE\]`); an older build escaped only the opening one. Both are restored,
 * and nothing else in the file is touched — a genuine `\[link]` stays escaped.
 */
const MARKER = new RegExp(`\\\\\\[!(${KINDS})\\\\]?`, 'g');

/** A table row, as the serializer writes it. */
const ROW = /^\s*\|.*\|\s*$/;

/** A separator cell, however it is padded: `---`, `:--`, `--:`, `:-:`. */
const SEPARATOR = /^:?-+:?$/;

/** One cell of a separator row, written the way this documentation writes it. */
function separator(cell: string): string {
	const left = cell.startsWith(':');
	const right = cell.endsWith(':');
	return left && right ? ':---:' : left ? ':---' : right ? '---:' : '---';
}

/** One table row with its padding removed, or the line unchanged when it is not a row. */
function unpadded(line: string): string {
	if (!ROW.test(line)) {
		return line;
	}
	const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '');
	// A pipe inside a cell is written as `\|`, so only unescaped pipes split.
	const cells = inner.split(/(?<!\\)\|/).map((cell) => cell.trim());
	const canonical = cells.every((cell) => SEPARATOR.test(cell)) ? cells.map(separator) : cells;
	return `| ${canonical.join(' | ')} |`;
}

/**
 * The Markdown as the file should hold it.
 *
 * `trailingNewline` is the file's own rule, not a guess: a page that ended with a newline keeps it, and one that did not
 * does not silently gain one.
 */
export function tidy(markdown: string, trailingNewline: boolean): string {
	const lines = markdown
		.replace(/\r\n/g, '\n')
		.replace(MARKER, '[!$1]')
		.split('\n')
		.map(unpadded);

	let text = lines.join('\n');
	// A run of blank lines is the serializer's block spacing, not the author's; one blank line is the maximum a page
	// means to have. The leading one comes from the same place.
	text = text.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '');
	text = text.replace(/[ \t]+$/gm, '');
	text = text.replace(/\s+$/, '');
	return text.length === 0 ? '' : trailingNewline ? `${text}\n` : text;
}
