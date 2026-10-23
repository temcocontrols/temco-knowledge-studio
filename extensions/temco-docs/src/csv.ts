// CSV as a grid can hold it, and back again without rewriting what nobody touched.
//
// The grid is the *view*; the file on disk stays CSV, one row per line. That is what keeps a one-cell change to a
// one-line diff, and it is the whole reason this module exists rather than a spreadsheet library doing the saving.
//
// The rules are RFC 4180 with the parts real files actually use: a quoted field may hold the delimiter, a quote, or a
// line break; a doubled quote is one quote; and the delimiter is whichever of comma, semicolon or tab the file uses
// most outside quotes. End-of-line and the final newline are carried through untouched, because a file that changes
// every line ending in its first edit cannot be reviewed.

/** What a CSV file says about its own shape, beyond the cells. */
export interface CsvFormat {
	readonly delimiter: string;
	readonly eol: string;
	readonly finalNewline: boolean;
}

/** A parsed file: the cells, and what is needed to write it back the way it was. */
export interface Csv {
	readonly rows: string[][];
	/**
	 * Which cells the file wrote inside quotes, position for position.
	 *
	 * Kept because quoting is a *style* as well as a necessity: an exporter that quotes every field produces a file
	 * this would otherwise rewrite from top to bottom on the first edit. A cell whose value did not change keeps the
	 * quoting it arrived with.
	 */
	readonly quoted: boolean[][];
	readonly format: CsvFormat;
}

/** The delimiters worth guessing between, most specific first. */
const DELIMITERS = ['\t', ',', ';'];

/**
 * The delimiter a file uses.
 *
 * Counted on the first line that has any of them at all, outside quotes — which is the header in every file that has
 * one, and the first row in every file that does not.
 */
export function delimiterOf(text: string): string {
	for (const line of text.split(/\r?\n/)) {
		if (line.trim().length === 0) {
			continue;
		}
		const counts = DELIMITERS.map((delimiter) => ({ delimiter, count: countOutsideQuotes(line, delimiter) }));
		const best = counts.reduce((winner, entry) => (entry.count > winner.count ? entry : winner), counts[0]);
		if (best.count > 0) {
			return best.delimiter;
		}
	}
	return ',';
}

function countOutsideQuotes(line: string, delimiter: string): number {
	let count = 0;
	let quoted = false;
	for (const character of line) {
		if (character === '"') {
			quoted = !quoted;
		} else if (character === delimiter && !quoted) {
			count++;
		}
	}
	return count;
}

/** The cells of a CSV file, with the format that produced them. */
export function parseCsv(text: string): Csv {
	const delimiter = delimiterOf(text);
	const eol = text.includes('\r\n') ? '\r\n' : '\n';
	const finalNewline = text.endsWith('\n');

	const rows: string[][] = [];
	const quotedRows: boolean[][] = [];
	let quotedRow: boolean[] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;
	let opened = false;
	let index = 0;

	while (index < text.length) {
		const character = text.charAt(index);
		if (quoted) {
			if (character === '"') {
				if (text.charAt(index + 1) === '"') {
					field += '"';
					index += 2;
					continue;
				}
				quoted = false;
				index++;
				continue;
			}
			field += character;
			index++;
			continue;
		}
		if (character === '"' && field.length === 0 && !opened) {
			quoted = true;
			opened = true;
			index++;
			continue;
		}
		if (character === delimiter) {
			row.push(field);
			quotedRow.push(opened);
			field = '';
			opened = false;
			index++;
			continue;
		}
		if (character === '\r' && text.charAt(index + 1) === '\n') {
			row.push(field);
			quotedRow.push(opened);
			rows.push(row);
			quotedRows.push(quotedRow);
			row = [];
			quotedRow = [];
			field = '';
			opened = false;
			index += 2;
			continue;
		}
		if (character === '\n') {
			row.push(field);
			quotedRow.push(opened);
			rows.push(row);
			quotedRows.push(quotedRow);
			row = [];
			quotedRow = [];
			field = '';
			opened = false;
			index++;
			continue;
		}
		field += character;
		index++;
	}

	// A file that does not end in a newline still has its last row.
	if (field.length > 0 || row.length > 0) {
		row.push(field);
		quotedRow.push(opened);
		rows.push(row);
		quotedRows.push(quotedRow);
	}

	return { rows, quoted: quotedRows, format: { delimiter, eol, finalNewline } };
}

/**
 * One cell.
 *
 * Quoted when it has to be — a delimiter, a quote, a line break, or padding somebody meant to keep — and also when the
 * file quoted it in the first place, so a grid edit does not silently restyle the lines nobody touched.
 */
function field(value: string, delimiter: string, quotedBefore: boolean): string {
	const needs =
		value.includes(delimiter) ||
		value.includes('"') ||
		value.includes('\n') ||
		value.includes('\r') ||
		value.trim() !== value;
	return needs || quotedBefore ? `"${value.split('"').join('""')}"` : value;
}

/**
 * The file again.
 *
 * Rows are written in order and cells are quoted only where they must be — or where the file already quoted them, which
 * is what `before` carries. So a grid that changed one cell produces a diff of one line, not a file whose quoting
 * changed everywhere.
 *
 * `before` is the parse the rows came from, not a bare format: quoting style and end-of-line are one decision, and an
 * API that let a caller pass half of it is an API that loses half of it.
 */
export function writeCsv(
	rows: readonly (readonly string[])[],
	before: { format: CsvFormat; quoted?: readonly (readonly boolean[])[] }
): string {
	const { format, quoted } = before;
	const width = rows.reduce((widest, row) => Math.max(widest, row.length), 0);
	const lines = rows.map((row, rowIndex) => {
		const cells: string[] = [];
		for (let column = 0; column < width; column++) {
			const wasQuoted = quoted?.[rowIndex]?.[column] === true;
			cells.push(field(row[column] ?? '', format.delimiter, wasQuoted));
		}
		// Trailing empty cells are not written: a spreadsheet always has more columns than a file does.
		while (cells.length > 0 && (cells[cells.length - 1].length === 0 || cells[cells.length - 1] === '""')) {
			cells.pop();
		}
		return cells.join(format.delimiter);
	});
	const body = lines.join(format.eol);
	return format.finalNewline ? `${body}${format.eol}` : body;
}
