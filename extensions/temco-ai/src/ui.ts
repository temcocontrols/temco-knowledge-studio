// What this module reads of the UI conventions.
//
// Where a page opens, and what that page is made of — the application's page vocabulary — are decided once in
// `temco-ui` and read here. The definition is `extensions/temco-ui/src/`; this is the copy.

import * as vscode from 'vscode';

/** The UI module, by the id its manifest declares. */
const UI_EXTENSION_ID = 'temcocontrols.temco-ui';

/** The UI module's exports. */
interface UiApi {
	pageColumn(): vscode.ViewColumn;
	page(body: string, options?: { title?: string; script?: string; extraCss?: string }): string;
	escapeHtml(text: string): string;
	icon(name: string, cls?: string): string;
}

const extension = vscode.extensions.getExtension<UiApi>(UI_EXTENSION_ID);
if (extension === undefined || !extension.isActive) {
	throw new Error('The Temco UI module is not available.');
}

const ui = extension.exports;

/** The editor column every page of ours opens in. */
export const pageColumn = ui.pageColumn;

/** A document around `body`, carrying the application's page vocabulary. */
export const page = ui.page;

/** Text that came from a page or a person, escaped for a page. */
export const escapeHtml = ui.escapeHtml;

/** One glyph from the page's sprite. */
export const icon = ui.icon;
