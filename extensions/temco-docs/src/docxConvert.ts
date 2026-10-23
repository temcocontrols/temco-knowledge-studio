// `.docx` → Markdown, as a child process.
//
// Run by `src/docx.ts` through `node` on the compiled `out/docxConvert.js`, so the extension host is never blocked by a
// large conversion. Arguments: the source `.docx`, then the target `.md`.
//
// It is TypeScript, not a `.mjs` beside the sources, for two reasons: the repository's pre-commit hook rejects a newly
// added JavaScript file, and `scripts/**` is excluded from the packaged extension — so a `.js` there would convert Word
// documents from a source tree and fail from an installed one.
//
// Print one line of JSON on stdout — `{"warnings":[…]}` — so the caller can tell a person what was dropped.

import * as mammoth from 'mammoth';
import * as path from 'path';
import { writeFile } from 'fs/promises';
import TurndownService from 'turndown';

/** One row of a Word table, as far as Markdown cares: the text of each cell, on one line. */
function cellsOf(row: { querySelectorAll(selector: string): ArrayLike<{ textContent: string | null }> }): string[] {
	return Array.from(row.querySelectorAll('th,td')).map((cell) => (cell.textContent ?? '').trim().replace(/\s+/g, ' '));
}

async function convert(source: string, target: string): Promise<void> {
	const { value: html, messages } = await mammoth.convertToHtml({ path: source });

	const turndown = new TurndownService({
		headingStyle: 'atx',
		codeBlockStyle: 'fenced',
		bulletListMarker: '-',
		emDelimiter: '*',
		strongDelimiter: '**',
	});

	// Markdown has no tables in plain turndown; keep them as GFM pipes so the page still reads as a table.
	turndown.addRule('table', {
		filter: 'table',
		replacement: (content, node) => {
			const rows = Array.from(node.querySelectorAll('tr'));
			if (rows.length === 0) {
				return content;
			}
			const header = cellsOf(rows[0]);
			const width = header.length;
			if (width === 0) {
				return content;
			}
			const line = (values: string[]): string =>
				`| ${values.concat(Array(Math.max(0, width - values.length)).fill('')).join(' | ')} |`;
			const body = rows.slice(1).map((row) => line(cellsOf(row)));
			return ['', line(header), `| ${Array(width).fill('---').join(' | ')} |`, ...body, ''].join('\n');
		},
	});

	const markdown = turndown
		.turndown(html)
		// turndown pads list markers (`-   item`); this documentation writes `- item`.
		.replace(/^(\s*)([-*+])\s{2,}/gm, '$1$2 ')
		.replace(/^(\s*)(\d+\.)\s{2,}/gm, '$1$2 ')
		// Word writes a lot of trailing whitespace and double blank lines; a page wants neither.
		.replace(/[ \t]+$/gm, '')
		.replace(/\n{3,}/g, '\n\n')
		.trim();

	await writeFile(target, `${markdown}\n`, 'utf8');
	console.log(JSON.stringify({ warnings: messages.map((message) => `${message.type}: ${message.message}`) }));
}

async function main(): Promise<void> {
	const [, , source, target] = process.argv;
	if (source === undefined || target === undefined) {
		console.error(`usage: ${path.basename(process.argv[1] ?? 'docxConvert.js')} <source.docx> <target.md>`);
		process.exit(2);
	}
	await convert(source, target);
}

void main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
