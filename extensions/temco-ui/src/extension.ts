// The UI module's entry point.
//
// It is the application's shared UI conventions, and it has no surface of its own: no command, no view, no
// setting — only the two rules that every module's pages and rows depend on, published so that each of them is
// decided once instead of once per module.

import * as vscode from 'vscode';
import { fileColumn, pageColumn } from './columns';
import { rowSlug } from './rows';

/** What this module offers the rest of the platform. */
export interface TemcoUiApi {
	/** The editor column every page of ours opens in. */
	pageColumn(): vscode.ViewColumn;
	/** The editor column for something that is not a page of ours. */
	fileColumn(): vscode.ViewColumn;
	/** The slug a command argument names, whether it is a slug, a row, or a row's own command argument. */
	rowSlug(target: unknown): string | undefined;
}

export function activate(): TemcoUiApi {
	return { pageColumn, fileColumn, rowSlug };
}

export function deactivate(): void {
	// Nothing to unwind: this module owns two pure rules and no state.
}
