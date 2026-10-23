// The bridge every webview editor in this extension shares.
//
// A rich surface is a browser editor that owns no document. The file stays
// the only truth, the webview sends the whole Markdown after typing settles, and this class applies it as one
// `WorkspaceEdit` over the whole file. That is what keeps `Ctrl+Z`, the dirty dot, save and *Diff* behaving exactly as
// they do in the source editor.
//
// Everything a subclass decides is a folder of built assets and a few strings. Everything that could corrupt a file —
// line endings, the echo guard, which command a bar button runs — is decided here, once.

import * as path from 'path';
import * as vscode from 'vscode';

/** What a bar button may ask the extension to do. */
export type PageAction = 'preview' | 'diff' | 'source';

/** One message from a webview: the editor's own protocol, in either direction. */
interface HostMessage {
	type?: unknown;
	text?: unknown;
	action?: unknown;
}

const COMMANDS: Record<PageAction, string> = {
	preview: 'temcoDocs.previewPage',
	diff: 'temcoDocs.diffPage',
	source: 'temcoDocs.openSource',
};

function actionOf(value: unknown): PageAction | undefined {
	return value === 'preview' || value === 'diff' || value === 'source' ? value : undefined;
}

/**
 * Where a surface's built bundle lives, for the editors that are not `WebviewTextEditor` subclasses.
 *
 * `build-webview.mts` writes `out/webview/<assets>/`, and `out/` is the repository's build-output directory: the
 * `local/code-no-new-javascript-files` rule rejects a newly committed `.js`, so the bundle is built, not shipped.
 */
export function webviewAssets(extensionUri: vscode.Uri, assets: string): vscode.Uri {
	return vscode.Uri.joinPath(extensionUri, 'out', 'webview', assets);
}

/**
 * An editor whose surface is a webview and whose document is a text file.
 *
 * Subclasses supply the built bundles; this owns the conversation with them.
 */
export abstract class WebviewTextEditor implements vscode.CustomTextEditorProvider {
	constructor(protected readonly context: vscode.ExtensionContext, private readonly assets: string) { }

	async resolveCustomTextEditor(
		document: vscode.TextDocument,
		panel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
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

		const redraw = (): void => {
			void panel.webview.postMessage({ type: 'set', text: document.getText() });
		};

		panel.webview.onDidReceiveMessage((message: HostMessage) => {
			if (message.type === 'ready') {
				redraw();
				return;
			}
			if (message.type === 'action' && message.action === 'image') {
				void this.pickImage(document, panel);
				return;
			}
			if (message.type === 'action') {
				void this.act(document, actionOf(message.action));
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
			void this.replace(document, next);
		});

		this.context.subscriptions.push(
			vscode.workspace.onDidChangeTextDocument((event) => {
				if (event.document.uri.toString() !== document.uri.toString() || event.contentChanges.length === 0) {
					return;
				}
				if (event.document.getText() === applied) {
					return;
				}
				redraw();
			})
		);
	}

	/**
	 * Puts an image beside the page and tells the editor where it is.
	 *
	 * The file goes into the page's own `media/` folder and the editor receives a **page-relative** address, because
	 * that is what the Markdown has to contain for the build to resolve it. Nothing is written to the document here:
	 * the webview inserts the image node, and the normal save path carries it into the file.
	 */
	private async pickImage(document: vscode.TextDocument, panel: vscode.WebviewPanel): Promise<void> {
		const picked = await vscode.window.showOpenDialog({
			canSelectMany: false,
			openLabel: 'Insert',
			filters: { Images: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'] },
		});
		const source = picked?.[0];
		if (source === undefined) {
			return;
		}

		const folder = vscode.Uri.joinPath(vscode.Uri.file(path.dirname(document.uri.fsPath)), 'media');
		try {
			await vscode.workspace.fs.createDirectory(folder);
			const target = vscode.Uri.joinPath(folder, path.basename(source.fsPath));
			if (target.toString() !== source.toString()) {
				await vscode.workspace.fs.copy(source, target, { overwrite: true });
			}
			const relative = `media/${path.basename(source.fsPath)}`.split(path.sep).join('/');
			await panel.webview.postMessage({ type: 'image', src: encodeURI(relative) });
		} catch (error) {
			void vscode.window.showErrorMessage(
				`Temco Docs: the image could not be copied beside the page — ${
					error instanceof Error ? error.message : String(error)
				}`
			);
		}
	}

	/**
	 * A button on the bar that leaves the page: the preview beside it, the diff against HEAD, or the source editor.
	 *
	 * The document is passed explicitly. Inside a custom editor there is no `activeTextEditor`, so a command that fell
	 * back to "whatever editor is in front" would find nothing and quietly do nothing.
	 */
	private async act(document: vscode.TextDocument, action: PageAction | undefined): Promise<void> {
		if (action !== undefined) {
			await vscode.commands.executeCommand(COMMANDS[action], document.uri);
		}
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
	 * in it — a whole-file diff for a one-word edit, which is the exact failure these modes exist to avoid.
	 */
	protected eolOf(document: vscode.TextDocument, text: string): string {
		const eol = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
		return eol === '\n' ? text : text.replace(/\r\n|\r|\n/g, '\n').split('\n').join(eol);
	}

	/**
	 * Where this surface's bundle lives. `build-webview.mts` writes it, and `out/` is the repository's build-output
	 * directory — a committed `.js` here would be rejected by the `local/code-no-new-javascript-files` rule.
	 */
	protected bundleRoot(): vscode.Uri {
		return webviewAssets(this.context.extensionUri, this.assets);
	}

	private html(document: vscode.TextDocument, webview: vscode.Webview): string {
		const base = this.bundleRoot();
		const script = webview.asWebviewUri(vscode.Uri.joinPath(base, `${this.assets}.js`));
		const style = webview.asWebviewUri(vscode.Uri.joinPath(base, `${this.assets}.css`));
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
<script src="${script}"></script>
</body>
</html>`;
	}
}

/** The way back to the editor of record, without closing and reopening the file by hand. */
export async function openSource(uri: vscode.Uri | undefined): Promise<void> {
	const target = uri ?? vscode.window.activeTextEditor?.document.uri;
	if (target !== undefined) {
		await vscode.commands.executeCommand('vscode.openWith', target, 'default');
	}
}
