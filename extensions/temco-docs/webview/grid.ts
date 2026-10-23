// The Grid surface: Univer's spreadsheet, driven by messages from the extension.
//
// Bundled by `scripts/build-webview.mts`, never compiled by `tsc` — it runs in the webview, with no `vscode` module
// and no Node. The extension owns the file; this owns the cells. Everything it is told arrives as a message, and the
// only thing it sends back is the whole grid, after an edit settles.
//
// It is a *text-backed* grid: the file on disk is still CSV, one row per line, so a one-cell change is a one-line
// diff. That is why the values it sends back are plain strings and why the extension does the quoting.

import { LocaleType, createUniver, mergeLocales } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import UniverPresetSheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US';

import '@univerjs/preset-sheets-core/lib/index.css';
import './grid.css';

interface Host {
	postMessage(message: unknown): void;
}

interface HostMessage {
	type?: unknown;
	rows?: unknown;
	readonly?: unknown;
}

declare function acquireVsCodeApi(): Host;

const host = acquireVsCodeApi();
const root = document.getElementById('root');

/** How long an edit rests before the whole grid is sent. */
const SETTLE_MS = 350;

/** Univer paints its own chrome; this is the minimum a sheet needs to exist. */
const SHEET = 'Sheet1';

type Rows = string[][];

let api: ReturnType<typeof createUniver>['univerAPI'] | undefined;
let sheet: { getRange(...args: unknown[]): { getValues(): unknown; setValues(values: unknown): void }; getMaxRows(): number; getMaxColumns(): number } | undefined;
let settle: number | undefined;
let applying = false;
let track = 0;

/** Blank cells the grid will always report back, so typing below the last row does not lose data. */
const MIN_ROWS = 200;
const MIN_COLUMNS = 26;

function asRows(value: unknown): Rows {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.map((row) => (Array.isArray(row) ? row.map((cell) => (cell === null || cell === undefined ? '' : String(cell))) : []));
}

function widthOf(rows: Rows): number {
	return rows.reduce((widest, row) => Math.max(widest, row.length), 0);
}

/** The grid as text, trimmed of the trailing empty rows and columns a spreadsheet always has. */
function values(): Rows {
	if (sheet === undefined) {
		return [];
	}
	const range = sheet.getRange(0, 0, Math.max(MIN_ROWS, sheet.getMaxRows()), Math.max(MIN_COLUMNS, sheet.getMaxColumns()));
	const read = range.getValues() as (string | number | boolean | null)[][];

	const text = read.map((row) => row.map((cell) => (cell === null || cell === undefined ? '' : String(cell))));
	while (text.length > 0 && text[text.length - 1].every((cell) => cell === '')) {
		text.pop();
	}
	const width = widthOf(text);
	return text.map((row) => {
		const next = row.slice(0, width);
		while (next.length < width) {
			next.push('');
		}
		return next;
	});
}

function send(): void {
	host.postMessage({ type: 'change', rows: values() });
}

function watch(): void {
	if (api === undefined || typeof api.onCommandExecuted !== 'function') {
		return;
	}
	api.onCommandExecuted(() => {
		// Loading the grid runs commands too; only a change made after it settles counts as an edit.
		if (track === 0) {
			return;
		}
		if (settle !== undefined) {
			window.clearTimeout(settle);
		}
		settle = window.setTimeout(() => {
			settle = undefined;
			if (!applying) {
				send();
			}
		}, SETTLE_MS);
	});
}

function load(rows: Rows): void {
	if (api === undefined) {
		return;
	}
	applying = true;
	try {
		const workbook = api.createWorkbook({
			id: 'temco-docs',
			sheets: { [SHEET]: { id: SHEET, name: SHEET } },
		});
		// Held directly rather than looked up again: a workbook is the thing this surface edits, and asking the
		// application for "the active one" is one more thing that can be false.
		sheet = workbook.getActiveSheet() as unknown as typeof sheet;
		const height = Math.max(rows.length, 1);
		const width = Math.max(widthOf(rows), 1);
		sheet?.getRange(0, 0, height, width).setValues(rows.length === 0 ? [['']] : rows);
	} finally {
		// One turn of the event loop, then edits count.
		window.setTimeout(() => {
			track = 1;
			applying = false;
		}, 0);
	}
}

function boot(): void {
	const created = createUniver({
		locale: LocaleType.EN_US,
		locales: { [LocaleType.EN_US]: mergeLocales(UniverPresetSheetsCoreEnUS) },
		presets: [UniverSheetsCorePreset({ container: root as HTMLElement })],
	});
	api = created.univerAPI;
	watch();
	host.postMessage({ type: 'ready' });
}

window.addEventListener('message', (event: MessageEvent<HostMessage>) => {
	const message = event.data;
	if (message === null || typeof message !== 'object') {
		return;
	}
	if (message.type === 'set' && api !== undefined) {
		load(asRows(message.rows));
	}
});

boot();
