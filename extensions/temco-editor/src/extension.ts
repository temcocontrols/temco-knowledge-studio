// The only activation entry: register, wire, dispose.
//
// Three of the commands here are one hop: the page's *preview*, *diff* and *properties* are the documentation module's
// work — it owns the page tree, the registry and the version report — so this module asks for them by name rather than
// reaching into it. That is the documented direction for a module that depends on another: a command that may be missing,
// never an import.

import * as vscode from 'vscode';
import { MarkdownEditor, openMarkdown } from './surfaces/markdown';

/** The way back to the source, without closing and reopening the file by hand. */
async function openSource(uri: vscode.Uri | undefined): Promise<void> {
	const target = uri ?? vscode.window.activeTextEditor?.document.uri;
	if (target !== undefined) {
		await vscode.commands.executeCommand('vscode.openWith', target, 'default');
	}
}

/** One of the page's own actions, done by the module that owns the page. */
function delegating(command: string): (uri?: vscode.Uri) => Promise<void> {
	return async (uri?: vscode.Uri): Promise<void> => {
		const target = uri ?? vscode.window.activeTextEditor?.document.uri;
		if (target !== undefined) {
			await vscode.commands.executeCommand(command, target);
		}
	};
}

export function activate(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		// `retainContextWhenHidden` keeps the caret, the undo history and the block handle's place across a tab switch —
		// without it, every return to the page rebuilds the surface from the file.
		vscode.window.registerCustomEditorProvider(MarkdownEditor.VIEW_TYPE, new MarkdownEditor(context), {
			webviewOptions: { retainContextWhenHidden: true },
		}),
		vscode.commands.registerCommand('temcoEditor.open', (target?: unknown) =>
			openMarkdown(target instanceof vscode.Uri ? target : undefined)
		),
		vscode.commands.registerCommand('temcoEditor.openSource', (target?: unknown) =>
			openSource(target instanceof vscode.Uri ? target : undefined)
		),
		vscode.commands.registerCommand('temcoEditor.preview', delegating('temcoDocs.previewPage')),
		vscode.commands.registerCommand('temcoEditor.diff', delegating('temcoDocs.diffPage')),
		vscode.commands.registerCommand('temcoEditor.pageProperties', delegating('temcoDocs.pageProperties'))
	);
}

export function deactivate(): void { }
