// The site, inside the editor.
//
// Preview is a page here rather than a jump to the browser: the site is what this application produces, and leaving it
// to look at it breaks the loop that makes it worth previewing. A frame shows the served site, and the bar above it
// carries the one thing a frame cannot do — open the same address in the reader's own browser.
//
// The frame is same-origin with the loopback server, which is what lets the reader fill its "In this article" panel;
// `frame-src` in the content-security policy is the only permission it needs.

import * as vscode from 'vscode';

/** The panel's own document: a bar, and the site below it. */
function document(url: string, nonce: string, title: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; frame-src http://127.0.0.1:*; script-src 'nonce-${nonce}';">
<style>
* { box-sizing: border-box; }
body { margin: 0; height: 100vh; display: flex; flex-direction: column; background: var(--vscode-editor-background); color: var(--vscode-foreground); font: 13px var(--vscode-font-family); }
.bar { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-bottom: 1px solid var(--vscode-panel-border); background: var(--vscode-panel-background); }
.addr { flex: 1; min-width: 0; padding: 4px 8px; font: 12px var(--vscode-editor-font-family); color: var(--vscode-input-foreground, var(--vscode-foreground)); background: var(--vscode-input-background, transparent); border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius: 2px; }
button { padding: 4px 10px; color: var(--vscode-button-secondaryForeground, var(--vscode-foreground)); background: var(--vscode-button-secondaryBackground, transparent); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; }
button:hover { background: var(--vscode-button-secondaryHoverBackground, var(--vscode-list-hoverBackground)); }
button[disabled] { opacity: .5; cursor: default; }
iframe { flex: 1; border: 0; width: 100%; background: #fff; }
</style>
</head>
<body>
<div class="bar">
	<input class="addr" id="addr" readonly value="${url.replace(/"/g, '&quot;')}" aria-label="Address">
	<button id="reload" type="button">Reload</button>
	<button id="open" type="button">Open in browser</button>
	<button id="stop" type="button">Stop</button>
</div>
<iframe id="page" title="${title.replace(/"/g, '&quot;')}" src="${url.replace(/"/g, '&quot;')}"></iframe>
<script nonce="${nonce}">
(function () {
	const api = acquireVsCodeApi();
	const frame = document.getElementById('page');
	document.getElementById('reload').addEventListener('click', () => {
		const src = frame.getAttribute('src').split('?')[0];
		frame.setAttribute('src', 'about:blank');
		setTimeout(() => frame.setAttribute('src', src), 20);
	});
	document.getElementById('open').addEventListener('click', () => api.postMessage({ type: 'open' }));
	document.getElementById('stop').addEventListener('click', () => api.postMessage({ type: 'stop' }));
})();
</script>
</body>
</html>`;
}

/**
 * One preview at a time.
 *
 * A second address replaces the first — the site is one thing, and two panels showing two versions of it is a
 * confusion nobody asked for. Closing the panel stops the server, because a loopback port left open is a surprise.
 */
export class Preview implements vscode.Disposable {
	private panel: vscode.WebviewPanel | undefined;
	private url: string | undefined;
	private onClose: (() => void) | undefined;

	/** Show `url`, opening the panel if it is not already up. */
	show(url: string, title: string, options: { onClose?: () => void } = {}): void {
		this.url = url;
		this.onClose = options.onClose;
		if (this.panel === undefined) {
			this.panel = vscode.window.createWebviewPanel('temcoLearn.preview', title, vscode.ViewColumn.Active, {
				enableScripts: true,
				retainContextWhenHidden: true
			});
			this.panel.iconPath = new vscode.ThemeIcon('eye');
			this.panel.webview.onDidReceiveMessage((message: { type?: string }) => {
				if (message?.type === 'open') {
					if (this.url !== undefined) {
						void vscode.env.openExternal(vscode.Uri.parse(this.url));
					}
				} else if (message?.type === 'stop') {
					this.panel?.dispose();
				}
			});
			this.panel.onDidDispose(() => {
				this.panel = undefined;
				this.url = undefined;
				const closing = this.onClose;
				this.onClose = undefined;
				closing?.();
			});
		} else {
			this.panel.title = title;
			this.panel.reveal(vscode.ViewColumn.Active);
		}
		const nonce = Array.from({ length: 16 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
		this.panel.webview.html = document(url, nonce, title);
	}

	/** The address on screen, when the panel is open. */
	get current(): string | undefined {
		return this.url;
	}

	dispose(): void {
		this.panel?.dispose();
	}
}
