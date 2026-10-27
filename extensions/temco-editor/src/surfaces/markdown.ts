// A Markdown page, as a document rather than as text.
//
// `WebviewTextEditor` owns the whole conversation with the webview — the ordered-write guard that keeps a caret still, the
// file's own line endings, the single undoable edit, the tab's own actions (preview, diff, source, properties), and the
// capture pipeline that lands a picture beside the page and records what it shows. This file names the bundle to run and
// nothing else: a surface is a bundle, a selector, and a set of rules — and the rules are shared by any surface this
// module grows.
//
// The Markdown ⇄ HTML round trip the webview saves through is `src/markdown.ts`, and `scripts/check-page.mts` is its
// proof. This is the default surface for a page; `Open With… → Text Editor` is the source, one command away.

import * as vscode from 'vscode';
import { WebviewTextEditor } from '../bridge';

/** The custom editor id, matched by the `customEditors` contribution in `package.json`. */
export const MARKDOWN_VIEW_TYPE = 'temcoEditor.markdown';

export class MarkdownEditor extends WebviewTextEditor {
	static readonly VIEW_TYPE = MARKDOWN_VIEW_TYPE;

	constructor(context: vscode.ExtensionContext) {
		// The bundle `scripts/build-webview.mts` writes: `out/webview/markdown/markdown.js` and its stylesheet.
		super(context, 'markdown');
	}
}

/** Opens a Markdown page in the editor. */
export async function openMarkdown(uri: vscode.Uri | undefined): Promise<void> {
	const target = uri ?? vscode.window.activeTextEditor?.document.uri;
	if (target === undefined || target.scheme !== 'file') {
		void vscode.window.showInformationMessage('Temco Editor: open a Markdown page first.');
		return;
	}
	await vscode.commands.executeCommand('vscode.openWith', target, MARKDOWN_VIEW_TYPE);
}
