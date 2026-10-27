// The bridge between a webview editor and the text file behind it.
//
// A rich surface is a browser editor that owns no document. The file stays the only truth: the webview sends the whole
// Markdown after typing settles, and this class applies it as one `WorkspaceEdit` over the whole file — which is what
// keeps `Ctrl+Z`, the dirty dot, save and *Diff* behaving exactly as they do in the source editor.
//
// (`temco-docs` owns the full version of this seam, with the capture pipeline and the tab's own actions. This module is
// a comparison surface, so it carries only what an editor needs to be safe: the ordered-write guard, the file's own line
// endings, and one undoable edit per keystroke batch.)

import * as path from 'path';
import { statSync } from 'fs';
import * as vscode from 'vscode';

/** One message from a webview, in either direction. Unknown messages are dropped, not guessed at. */
interface HostMessage {
	type?: unknown;
	text?: unknown;
}

/**
 * A bundle URL, addressed by its own modification time.
 *
 * The webview caches a script by its URL, so a rebuilt bundle kept the old address and the surface kept drawing the old
 * editor until the window was reloaded — which looks exactly like "the change did nothing".
 */
function stamped(uri: vscode.Uri): string {
	const address = uri.toString(true);
	try {
		return `${address}${address.includes('?') ? '&' : '?'}v=${Math.round(statSync(uri.fsPath).mtimeMs)}`;
	} catch {
		return address;
	}
}

/** An editor whose surface is a webview and whose document is a text file. */
export abstract class WebviewTextEditor implements vscode.CustomTextEditorProvider {
	constructor(
		protected readonly context: vscode.ExtensionContext,
		/** The folder under `out/webview/` this surface was built into. */
		private readonly assets: string
	) { }

	async resolveCustomTextEditor(
		document: vscode.TextDocument,
		panel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
		// An editor that throws leaves an empty tab and no explanation, which a person cannot act on. Say it instead.
		try {
			this.start(document, panel);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			void vscode.window.showErrorMessage(`Temco Editor: the ${this.assets} surface could not start — ${message}`);
			panel.webview.options = { enableScripts: false };
			panel.webview.html = `<body style="font-family:var(--vscode-font-family);padding:20px">The ${this.assets} surface could not start: ${message}</body>`;
		}
	}

	/** The surface itself: assets, document, and the two-way conversation that keeps them equal. */
	private start(document: vscode.TextDocument, panel: vscode.WebviewPanel): void {
		panel.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				this.bundleRoot(),
				// A page's images are relative to the page, so the page's own folder has to be readable.
				vscode.Uri.file(path.dirname(document.uri.fsPath)),
			],
		};
		panel.webview.html = this.html(document, panel.webview);

		/** The last text this editor put into the document, so its own write is not read back as an outside change. */
		let applied = '';
		/**
		 * Every text this editor asked VS Code to write.
		 *
		 * `applyEdit` is asynchronous, and two writes can land out of order while somebody is typing. `applied` names only
		 * the newest, so a write that is this editor's own but not the last one would look like an outside change — and
		 * answering it with `set` replaces the document under the caret.
		 */
		const written = new Set<string>();
		const remember = (text: string): void => {
			written.add(text);
			for (const oldest of written) {
				if (written.size <= 20) {
					break;
				}
				written.delete(oldest);
			}
		};

		const redraw = (): void => {
			void panel.webview.postMessage({
				type: 'set',
				text: document.getText(),
				// The page's own place, for the head the surface draws: `docs/t3000/commissioning.md`.
				path: vscode.workspace.asRelativePath(document.uri),
			});
		};

		panel.webview.onDidReceiveMessage((message: HostMessage) => {
			if (message.type === 'ready') {
				redraw();
				return;
			}
			if (message.type !== 'change' || typeof message.text !== 'string') {
				return;
			}
			const next = message.text;
			if (next === document.getText() || this.eolOf(document, next) === document.getText()) {
				return;
			}
			applied = this.eolOf(document, next);
			remember(applied);
			void this.replace(document, next);
		});

		this.context.subscriptions.push(
			vscode.workspace.onDidChangeTextDocument((event) => {
				if (event.document.uri.toString() !== document.uri.toString() || event.contentChanges.length === 0) {
					return;
				}
				const now = event.document.getText();
				// One of this editor's own writes — possibly an earlier one that landed late. Never an outside change.
				if (written.delete(now)) {
					return;
				}
				if (now === applied) {
					return;
				}
				redraw();
			})
		);
	}

	/** The whole file, replaced by the webview's Markdown — one undoable edit, not a stream of them. */
	private async replace(document: vscode.TextDocument, text: string): Promise<void> {
		const edit = new vscode.WorkspaceEdit();
		edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), this.eolOf(document, text));
		await vscode.workspace.applyEdit(edit);
	}

	/**
	 * The webview's Markdown with the file's own line endings.
	 *
	 * A browser hands back `\n` because that is all it has. Writing that into a CRLF file would change every line ending
	 * in it — a whole-file diff for a one-word edit.
	 */
	protected eolOf(document: vscode.TextDocument, text: string): string {
		const eol = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
		return eol === '\n' ? text : text.replace(/\r\n|\r|\n/g, '\n').split('\n').join(eol);
	}

	/** Where this surface's bundle lives; `build-webview.mts` writes it into `out/`, which is never committed. */
	protected bundleRoot(): vscode.Uri {
		return vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', this.assets);
	}

	private html(document: vscode.TextDocument, webview: vscode.Webview): string {
		const base = this.bundleRoot();
		const script = stamped(webview.asWebviewUri(vscode.Uri.joinPath(base, `${this.assets}.js`)));
		const style = stamped(webview.asWebviewUri(vscode.Uri.joinPath(base, `${this.assets}.css`)));
		const page = `${webview.asWebviewUri(vscode.Uri.file(path.dirname(document.uri.fsPath)))}/`;
		return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data: https:; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource} data:; script-src ${webview.cspSource};">
<base href="${page}">
<link rel="stylesheet" href="${style}">
<title>${path.basename(document.uri.fsPath)}</title>
</head>
<body>
<div id="root"></div>
<script>
	// If the surface cannot start, say so in the page: an empty tab is the one failure a person cannot act on.
	var say = function (text) {
		var root = document.getElementById('root');
		if (root !== null && root.childElementCount === 0) {
			root.textContent = 'The surface did not start: ' + text;
		}
	};
	window.addEventListener('error', function (event) {
		say(String(event.message) + ' (' + String(event.filename) + ':' + String(event.lineno) + ')');
	});
	window.addEventListener('unhandledrejection', function (event) {
		say(String(event.reason));
	});
</script>
<script src="${script}"></script>
</body>
</html>`;
	}
}
