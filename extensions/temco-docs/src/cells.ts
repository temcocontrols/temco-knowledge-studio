// The shape of a grid, apart from Univer and apart from the extension.
//
// A sheet is always bigger than the file it came from: Univer hands back a rectangle as wide as the sheet and as tall
// as the sheet, and a CSV is a handful of rows. Everything here is about that difference, because getting it wrong
// writes the empty cells into the file and turns a one-cell edit into a diff of every line.
//
// Nothing in this module touches the DOM, so `scripts/check-grid.mts` runs the same code the bundle runs.

export type Rows = string[][];

/** Cells as the host or Univer gave them, as text. Blank cells are the empty string, never `null`. */
export function asRows(value: unknown): Rows {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.map((row) => (Array.isArray(row) ? row.map((cell) => (cell === null || cell === undefined ? '' : String(cell))) : []));
}

/** The widest row, which is how many columns a sheet has to be given to hold these cells. */
export function widthOf(rows: Rows): number {
	return rows.reduce((widest, row) => Math.max(widest, row.length), 0);
}

/**
 * The cells that exist, without the blank rows and trailing blank cells a sheet always has.
 *
 * A blank line *inside* the cells is kept: it is a row of the file. Only the blank space past the last row and past
 * the last cell of a row is dropped, because that space belongs to the sheet.
 */
export function trimCells(read: readonly (readonly (string | number | boolean | null)[])[]): Rows {
	const text = read.map((row) => row.map((cell) => (cell === null || cell === undefined ? '' : String(cell))));
	while (text.length > 0 && text[text.length - 1].every((cell) => cell === '')) {
		text.pop();
	}
	return text.map((row) => {
		let last = row.length;
		while (last > 0 && row[last - 1] === '') {
			last--;
		}
		return row.slice(0, last);
	});
}
