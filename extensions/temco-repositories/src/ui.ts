// What this module reads of the platform's UI conventions.
//
// Two rules, each owned once for the whole application, and neither of them this module's to decide:
//
//   * **where a page opens** — the group that already holds a page of ours, never a second column.
//   * **what a command argument means** — a slug, a row, or a row's own command argument, read the same way by
//     every module whose rows pass slugs to commands.
//
// The definition is `extensions/temco-ui/src/`, and this is the copy.

import * as vscode from 'vscode';

/** The UI module, by the id its manifest declares. */
const UI_EXTENSION_ID = 'temcocontrols.temco-ui';

/** The UI module's exports. */
interface UiApi {
	pageColumn(): vscode.ViewColumn;
	fileColumn(): vscode.ViewColumn;
	rowSlug(target: unknown): string | undefined;
}

const extension = vscode.extensions.getExtension<UiApi>(UI_EXTENSION_ID);
if (extension === undefined || !extension.isActive) {
	throw new Error('The Temco UI module is not available.');
}

const ui = extension.exports;

/** The editor column every page of ours opens in. */
export const pageColumn = ui.pageColumn;

/** The editor column for something that is not a page of ours — a page of documentation, a registry. */
export const fileColumn = ui.fileColumn;

/** The slug a command argument names, whether it is a slug, a row, or a row's own command argument. */
export const rowSlug = ui.rowSlug;
