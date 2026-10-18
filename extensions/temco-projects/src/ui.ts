// What this module reads of the UI conventions.
//
// Where a page of ours opens is one rule for the whole application — the group that already holds a page of ours,
// never a split — and it is the UI module's. The definition is `extensions/temco-ui/src/`; this is the copy.

import * as vscode from 'vscode';

/** The UI module, by the id its manifest declares. */
const UI_EXTENSION_ID = 'temcocontrols.temco-ui';

/** The UI module's exports. */
interface UiApi {
	pageColumn(): vscode.ViewColumn;
	rowSlug(target: unknown): string | undefined;
	page(body: string, options?: { title?: string; script?: string; extraCss?: string }): string;
	escapeHtml(text: string): string;
	icon(name: string, cls?: string): string;
	toneMark(name: string, tone?: 'ok' | 'warn' | 'err' | 'info' | 'accent'): string;
}

const extension = vscode.extensions.getExtension<UiApi>(UI_EXTENSION_ID);
if (extension === undefined || !extension.isActive) {
	throw new Error('The Temco UI module is not available.');
}

const ui = extension.exports;

/** The editor column every page of ours opens in. */
export const pageColumn = ui.pageColumn;

/** The slug a command argument names, whether it is a slug, a row, or a row's own command argument. */
export const rowSlug = ui.rowSlug;

/** A document around `body`, carrying the application's page vocabulary. */
export const page = ui.page;

/** Text that came from a folder or a person, escaped for a page. */
export const escapeHtml = ui.escapeHtml;

/** One glyph from the page's sprite. */
export const icon = ui.icon;

/** One glyph in a tinted circle: a state you can see before you read it. */
export const toneMark = ui.toneMark;

/**
 * Shows the list of projects.
 *
 * It used to be the workbench's *Library* view, which is gone: the Documentation module's *Projects* section is
 * where projects are listed now, so anything that used to "open the projects page" brings that forward rather
 * than leaving an empty editor behind.
 */
export async function focusLibrary(): Promise<void> {
	const available = await vscode.commands.getCommands(true);
	await vscode.commands.executeCommand(
		available.includes('temcoDocs.section.projects.focus') ? 'temcoDocs.section.projects.focus' : 'workbench.view.explorer'
	);
}
