// The only activation entry: register, wire, dispose.

import * as vscode from 'vscode';
import { openPrototype, openSource, PrototypeEditor } from './pageEditor';

export function activate(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		// `retainContextWhenHidden` keeps the caret, the undo history and the drag handle's place across a tab switch —
		// without it, every return to the page rebuilds the surface from the file.
		vscode.window.registerCustomEditorProvider(PrototypeEditor.VIEW_TYPE, new PrototypeEditor(context), {
			webviewOptions: { retainContextWhenHidden: true },
		}),
		vscode.commands.registerCommand('temcoEditor.open', openPrototype),
		vscode.commands.registerCommand('temcoEditor.openSource', openSource)
	);
}

export function deactivate(): void { }
