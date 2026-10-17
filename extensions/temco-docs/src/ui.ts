// What this module reads of the UI conventions.
//
// Two rules, owned by `temco-ui` and read here rather than re-decided: where a page of ours opens (one group,
// never a split), and what a command argument means (a slug, a row, or a row's own command argument).
//
// The definition is `extensions/temco-ui/src/`; this is the copy.

import * as vscode from 'vscode';

/** The UI module, by the id its manifest declares. */
const UI_EXTENSION_ID = 'temcocontrols.temco-ui';

/** The UI module's exports. */
interface UiApi {
	pageColumn(): vscode.ViewColumn;
	fileColumn(): vscode.ViewColumn;
}

const extension = vscode.extensions.getExtension<UiApi>(UI_EXTENSION_ID);
if (extension === undefined || !extension.isActive) {
	throw new Error('The Temco UI module is not available.');
}

const ui = extension.exports;

/** The editor column every page of ours opens in. */
export const pageColumn = ui.pageColumn;

/** The editor column for something that is not a page of ours — a documentation page, a registry. */
export const fileColumn = ui.fileColumn;
