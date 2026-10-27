// The prototype page: the same Markdown file, edited by a second surface.
//
// This file names the bundle to run and nothing else — how a page is written back (one undoable edit, the file's own
// line endings, the echo guard) is `bridge.ts`, shared by any surface this module grows.

import * as vscode from 'vscode';
import { WebviewTextEditor } from './bridge';

/** The custom editor id, matched by the `customEditors` contribution in `package.json`. */
export const PAGE_VIEW_TYPE = 'temcoEditor.page';

export class PrototypeEditor extends WebviewTextEditor {
	static readonly VIEW_TYPE = PAGE_VIEW_TYPE;

	constructor(context: vscode.ExtensionContext) {
		super(context, 'page');
	}
}

/** Opens a Markdown page in the prototype. */
export async function openPrototype(uri: vscode.Uri | undefined): Promise<void> {
	const target = uri ?? vscode.window.activeTextEditor?.document.uri;
	if (target === undefined || target.scheme !== 'file') {
		void vscode.window.showInformationMessage('Temco Editor: open a Markdown page first.');
		return;
	}
	await vscode.commands.executeCommand('vscode.openWith', target, PAGE_VIEW_TYPE);
}

/** The way back to the editor of record, without closing and reopening the file by hand. */
export async function openSource(uri: vscode.Uri | undefined): Promise<void> {
	const target = uri ?? vscode.window.activeTextEditor?.document.uri;
	if (target !== undefined) {
		await vscode.commands.executeCommand('vscode.openWith', target, 'default');
	}
}
