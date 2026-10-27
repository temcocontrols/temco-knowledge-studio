// The two things a webview surface in this module needs that are not about a page: where its bundle is, and the way back
// to the source editor.
//
// The rich page editor lives in `extensions/temco-editor`, which keeps its own copy of `webviewAssets` — one module may not
// import another's sources, and this is small enough that a copy is cheaper than a shared package for two functions.

import * as vscode from 'vscode';

/**
 * Where a surface's built bundle lives.
 *
 * `build-webview.mts` writes `out/webview/<assets>/`, and `out/` is the repository's build-output directory: the
 * `local/code-no-new-javascript-files` rule rejects a newly committed `.js`, so the bundle is built, not shipped.
 */
export function webviewAssets(extensionUri: vscode.Uri, assets: string): vscode.Uri {
	return vscode.Uri.joinPath(extensionUri, 'out', 'webview', assets);
}

/** The way back to the editor of record, without closing and reopening the file by hand. */
export async function openSource(uri: vscode.Uri | undefined): Promise<void> {
	const target = uri ?? vscode.window.activeTextEditor?.document.uri;
	if (target !== undefined) {
		await vscode.commands.executeCommand('vscode.openWith', target, 'default');
	}
}
