// Rich mode: the page as a document, on the official Tiptap UI Components template.
//
// The surface is `webview/tiptap/`: the template installed by `npx @tiptap/cli add simple-editor` (161 files, used as
// they ship) plus a bridge to this document. It is opt-in by command and never an editor *association*: a Markdown file
// still opens in the source editor unless somebody asks for something else.
//
// Milkdown used to offer the same page as a second opinion. The comparison is settled — TipTap keeps tables byte for
// byte and its bar is the official one — so it is gone.

import * as path from 'path';
import * as vscode from 'vscode';
import { WebviewTextEditor } from './webviewText';

/** The custom editor id, matched by the `customEditors` contribution in `package.json`. */
export const TIPTAP_VIEW_TYPE = 'temcoDocs.richTiptap';

export class TiptapEditor extends WebviewTextEditor {
	static readonly VIEW_TYPE = TIPTAP_VIEW_TYPE;

	constructor(context: vscode.ExtensionContext) {
		super(context, 'tiptap');
	}
}

/**
 * Opens a page in the TipTap editor.
 *
 * The warning is narrow on purpose, and it is measured rather than argued: this editor keeps tables exactly as they are,
 * so the risk is blank-line and callout normalisation, not a table rewritten from top to bottom.
 */
export async function openRich(uri: vscode.Uri | undefined): Promise<void> {
	const target = uri ?? vscode.window.activeTextEditor?.document.uri;
	if (target === undefined || target.scheme !== 'file') {
		void vscode.window.showInformationMessage('Temco Docs: open a Markdown page first.');
		return;
	}
	let text = '';
	try {
		text = Buffer.from(await vscode.workspace.fs.readFile(target)).toString('utf8');
	} catch {
		void vscode.window.showErrorMessage('Temco Docs: the page could not be read.');
		return;
	}

	const callouts = text
		.split(/\r?\n/)
		.filter((line) => /^>\s*\[!(?:NOTE|TIP|IMPORTANT|CAUTION|WARNING)\]/.test(line)).length;
	if (callouts > 0) {
		const answer = await vscode.window.showWarningMessage(
			`Open ${path.basename(target.fsPath)} in Rich mode?`,
			{
				modal: true,
				detail:
					`This page has ${callouts} callout ${callouts === 1 ? 'marker' : 'markers'}. Rich editors normalise ` +
					`blank lines around them, so expect a small diff in those blocks. Tables are kept exactly as written.`,
			},
			'Switch to Rich',
			'Stay in Source'
		);
		if (answer !== 'Switch to Rich') {
			return;
		}
	}
	await vscode.commands.executeCommand('vscode.openWith', target, TIPTAP_VIEW_TYPE);
}
