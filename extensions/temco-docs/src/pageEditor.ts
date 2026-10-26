// The rich page: Tiptap editing the same Markdown file the source editor edits.
//
// `WebviewTextEditor` owns the whole conversation with the webview — the ordered-write guard that keeps a caret still, the
// file's own line endings, the single undoable edit, the tab's own actions (preview, diff, source, properties), and the
// capture pipeline that lands a picture beside the page and records what it shows. This file names the bundle to run and
// nothing else: a surface is a bundle, a selector, and a set of rules — and the rules are shared.
//
// The Markdown ⇄ HTML round trip the webview saves through is `src/pageMarkdown.ts`, and `scripts/check-page.mts` is its
// proof. This is the only editing surface for a page; `Open With… → Text Editor` is the source, one command away.

import * as vscode from 'vscode';
import { DocsRoot } from './registry';
import { WebviewTextEditor } from './webviewText';

/** The custom editor id, matched by the `customEditors` contribution in `package.json`. */
export const PAGE_VIEW_TYPE = 'temcoDocs.page';

export class PageEditor extends WebviewTextEditor {
	static readonly VIEW_TYPE = PAGE_VIEW_TYPE;

	constructor(context: vscode.ExtensionContext, roots?: () => readonly DocsRoot[]) {
		super(context, 'page', roots);
	}
}

/** Opens a Markdown page in the rich editor. */
export async function openPage(uri: vscode.Uri | undefined): Promise<void> {
	const target = uri ?? vscode.window.activeTextEditor?.document.uri;
	if (target === undefined || target.scheme !== 'file') {
		void vscode.window.showInformationMessage('Temco Docs: open a Markdown page first.');
		return;
	}
	await vscode.commands.executeCommand('vscode.openWith', target, PAGE_VIEW_TYPE);
}