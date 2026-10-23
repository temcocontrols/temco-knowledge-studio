// Grid mode: a CSV edited as cells, saved back as the same CSV.
//
// The file stays the source of truth and stays line-per-row, so the diff of a one-cell change is one line. The grid
// is Univer; the quoting, the delimiter, the end-of-line and the final newline are `csv.ts`, so nothing about the
// file's shape is left to a spreadsheet library to decide.
//
// A save is skipped when the cells did not actually change: opening a grid, clicking around and closing it must not
// touch the file, and an empty edit is the most common way a review gets polluted.

import * as path from 'path';
import * as vscode from 'vscode';
import { parseCsv, writeCsv } from './csv';
import { webviewAssets } from './webviewText';

/** The custom editor id, matched by the `customEditors` contribution in `package.json`. */
export const GRID_VIEW_TYPE = 'temcoDocs.grid';

interface HostMessage {
	type?: unknown;
	rows?: unknown;
}

export class GridEditor implements vscode.CustomTextEditorProvider {
	static readonly VIEW_TYPE = GRID_VIEW_TYPE;

	constructor(private readonly context: vscode.ExtensionContext) { }

	async resolveCustomTextEditor(
		document: vscode.TextDocument,
		panel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
		panel.webview.options = {
			enableScripts: true,
			localResourceRoots: [webviewAssets(this.context.extensionUri, 'grid')],
		};
		panel.webview.html = this.html(document, panel.webview);

		/** The file as this editor last read or wrote it, so an untouched grid is never written back. */
		let known = document.getText();
		const first = parseCsv(known);
		let style = { format: first.format, quoted: first.quoted };

		panel.webview.onDidReceiveMessage((message: HostMessage) => {
			if (message.type === 'ready') {
				void panel.webview.postMessage({ type: 'set', rows: parseCsv(document.getText()).rows });
				return;
			}
			if (message.type !== 'change') {
				return;
			}
			const rows = rowsOf(message.rows);
			if (rows === undefined) {
				return;
			}
			const next = writeCsv(rows, style);
			if (next === document.getText()) {
				return;
			}
			known = next;
			void this.replace(document, next);
		});

		this.context.subscriptions.push(
			vscode.workspace.onDidChangeTextDocument((event) => {
				if (event.document.uri.toString() !== document.uri.toString()) {
					return;
				}
				const text = event.document.getText();
				if (text === known) {
					return;
				}
				known = text;
				const again = parseCsv(text);
				style = { format: again.format, quoted: again.quoted };
				void panel.webview.postMessage({ type: 'set', rows: again.rows });
			})
		);
	}

	private async replace(document: vscode.TextDocument, text: string): Promise<void> {
		const edit = new vscode.WorkspaceEdit();
		edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), text);
		await vscode.workspace.applyEdit(edit);
	}

	private html(document: vscode.TextDocument, webview: vscode.Webview): string {
		const base = webviewAssets(this.context.extensionUri, 'grid');
		const script = webview.asWebviewUri(vscode.Uri.joinPath(base, 'grid.js'));
		const style = webview.asWebviewUri(vscode.Uri.joinPath(base, 'grid.css'));
		return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data: blob:; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource} data:; script-src ${webview.cspSource} 'unsafe-eval'; worker-src blob:; child-src blob:;">
<link rel="stylesheet" href="${style}">
<title>${path.basename(document.uri.fsPath)}</title>
</head>
<body>
<div id="root"></div>
<script src="${script}"></script>
</body>
</html>`;
	}
}

/** The cells a webview sent, or undefined when the shape is not one a file can be written from. */
function rowsOf(value: unknown): string[][] | undefined {
	if (!Array.isArray(value)) {
		return undefined;
	}
	const rows: string[][] = [];
	for (const row of value) {
		if (!Array.isArray(row)) {
			return undefined;
		}
		rows.push(row.map((cell) => (cell === null || cell === undefined ? '' : String(cell))));
	}
	return rows;
}

/** Opens a CSV or TSV in the grid. Text files only: a grid writes text back, and nothing else can be written safely. */
export async function openGrid(uri: vscode.Uri | undefined): Promise<void> {
	const target = uri ?? vscode.window.activeTextEditor?.document.uri;
	if (target === undefined || target.scheme !== 'file') {
		void vscode.window.showInformationMessage('Temco Docs: open a CSV or TSV file first.');
		return;
	}
	await vscode.commands.executeCommand('vscode.openWith', target, GRID_VIEW_TYPE);
}
