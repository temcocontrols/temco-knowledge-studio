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
import { asRows, trimCells, widthOf, type Rows } from '../src/cells';
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

let api: ReturnType<typeof createUniver>['univerAPI'] | undefined;
let sheet: { getRange(...args: unknown[]): { getValues(): unknown; setValues(values: unknown): void }; getMaxRows(): number; getMaxColumns(): number } | undefined;
/**
 * The workbook, kept because it is what reports an edit.
 *
 * In Univer 1.2.0 `onCommandExecuted` is on the **workbook**, not on the application: the guard this file used to carry
 * (`api.onCommandExecuted`) was always false, so `send()` was never called and a cell edit was silently lost — the grid
 * looked editable and saved nothing. `watching` is the subscription, so loading a second file cannot stack listeners.
 */
let watching: { dispose(): void } | undefined;
let settle: number | undefined;
let applying = false;
let track = 0;

/** Univer's own sheet size, used as the floor so a small file still has room to grow under the pen. */
const DEFAULT_ROWS = 1000;
const DEFAULT_COLUMNS = 20;

/** Extra blank rows and columns given to a sheet, so typing past the last cell of the file is kept. */
const ROOM_ROWS = 200;
const ROOM_COLUMNS = 8;

/**
 * The grid as text, trimmed of the trailing empty rows and columns a spreadsheet always has.
 *
 * The read is clamped to the sheet's own size. Asking for more than a sheet has throws (`Range is out of bounds`), and
 * because that throw used to happen inside the settle timer, nothing was reported and nothing said why.
 */
function values(): Rows {
	if (sheet === undefined) {
		return [];
	}
	const rows = Math.max(1, sheet.getMaxRows());
	const columns = Math.max(1, sheet.getMaxColumns());
	const range = sheet.getRange(0, 0, rows, columns);
	return trimCells(range.getValues() as (string | number | boolean | null)[][]);
}

/** The last thing this surface told the host, so a command that changed nothing does not look like an edit. */
let lastSent = '';

function flush(): void {
	if (applying || sheet === undefined) {
		return;
	}
	let rows: Rows;
	try {
		rows = values();
	} catch (error) {
		// Loud on purpose: a grid that cannot read its own cells must not look like one that saved them.
		console.error('Temco Grid: the cells could not be read, so this edit was not reported.', error);
		return;
	}
	const text = JSON.stringify(rows);
	if (text === lastSent) {
		return;
	}
	lastSent = text;
	host.postMessage({ type: 'change', rows });
}

/**
 * Report every settled edit.
 *
 * `onCommandExecuted` is the workbook's, see the note on `watching`. Loading the grid runs commands of its own, which is
 * what `track` and `applying` are for: only a command that arrives after the load has settled is a person's edit.
 */
function watch(workbook: { onCommandExecuted?(callback: () => void): { dispose(): void } }): void {
	watching?.dispose();
	watching = undefined;
	if (typeof workbook.onCommandExecuted !== 'function') {
		// A surface that cannot hear its own edits must say so: silence here means an edit is lost without a trace.
		console.warn('Temco Grid: this Univer build does not report command execution, so cell edits cannot be saved.');
		return;
	}
	watching = workbook.onCommandExecuted(() => {
		if (track === 0 || settle !== undefined) {
			return;
		}
		// Armed once and allowed to fire: Univer runs commands continuously (selection, scroll, render), so a
		// debounce that cancels its own timer on every command would never run at all — which is how the first
		// attempt at this fix still saved nothing.
		settle = window.setTimeout(() => {
			settle = undefined;
			flush();
		}, SETTLE_MS);
	});
}

function load(rows: Rows): void {
	if (api === undefined) {
		return;
	}
	applying = true;
	try {
		const height = Math.max(rows.length, 1);
		const width = Math.max(widthOf(rows), 1);
		// Sized to the file, not to Univer's default: a sheet created at 1000x20 cannot be written past that, and
		// `getRange` beyond it throws. The extra room is what keeps a value typed below the last row of the file.
		const workbook = api.createWorkbook({
			id: 'temco-docs',
			sheets: {
				[SHEET]: {
					id: SHEET,
					name: SHEET,
					rowCount: Math.max(rows.length + ROOM_ROWS, DEFAULT_ROWS),
					columnCount: Math.max(width + ROOM_COLUMNS, DEFAULT_COLUMNS),
				},
			},
		});
		// Held directly rather than looked up again: a workbook is the thing this surface edits, and asking the
		// application for "the active one" is one more thing that can be false.
		sheet = workbook.getActiveSheet() as unknown as typeof sheet;
		sheet?.getRange(0, 0, height, width).setValues(rows.length === 0 ? [['']] : rows);
		// After the workbook exists, not at boot: the events belong to it.
		watch(workbook as unknown as { onCommandExecuted?(callback: () => void): { dispose(): void } });
	} finally {
		// One turn of the event loop, then edits count.
		window.setTimeout(() => {
			track = 1;
			applying = false;
			// The file as the host sent it is the baseline, so loading a sheet does not immediately look like an edit.
			try {
				lastSent = JSON.stringify(values());
			} catch {
				lastSent = '';
			}
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
