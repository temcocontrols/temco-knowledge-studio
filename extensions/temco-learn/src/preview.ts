// The site, inside the editor — and the place where the module answers.
//
// Preview is a page here rather than a jump to the browser: the site is what this application produces, and leaving it
// to look at it breaks the loop that makes it worth previewing. A frame shows the served site, and the bar above it
// carries the one thing a frame cannot do — open the same address in the reader's own browser.
//
// The other thing the bar carries is the answer to what just happened. Adding a build, publishing, or a failure all end
// up in the strip under the address instead of in a corner notification, because the answer belongs next to the thing it
// is about: a person who pressed Publish is already looking here.
//
// The frame is same-origin with the loopback server, which is what lets the reader fill its "In this article" panel;
// `frame-src` in the content-security policy is the only permission it needs.

import * as vscode from 'vscode';

export type NoteLevel = 'info' | 'warn' | 'error' | 'progress';

/** What a note can offer: one thing to do next. */
export interface NoteAction {
	label: string;
	run: () => void | Thenable<unknown>;
}

/** A sentence about what just happened, shown in the preview's own strip. */
export interface Note {
	level: NoteLevel;
	text: string;
	action?: NoteAction;
}

/** What the page is told about a note: the action travels as a label, its behaviour stays here. */
interface NoteMessage {
	level: NoteLevel;
	text: string;
	action?: string;
}

function noteMessage(note: Note | undefined): NoteMessage | undefined {
	return note === undefined ? undefined : { level: note.level, text: note.text, action: note.action?.label };
}

/** The panel's own document: an address bar, the answer strip, and the site below them. */
function document(url: string | undefined, note: Note | undefined, nonce: string, title: string): string {
	const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
	const address = url === undefined ? '' : escape(url);
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
button { padding: 4px 10px; color: var(--vscode-button-secondaryForeground, var(--vscode-foreground)); background: var(--vscode-button-secondaryBackground, transparent); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font: inherit; }
button:hover { background: var(--vscode-button-secondaryHoverBackground, var(--vscode-list-hoverBackground)); }
button[disabled] { opacity: .5; cursor: default; }
.note { display: flex; align-items: flex-start; gap: 8px; padding: 6px 10px; border-bottom: 1px solid var(--vscode-panel-border); line-height: 1.45; }
.note[hidden] { display: none; }
.note__mark { flex: none; width: 12px; }
.note__text { flex: 1; min-width: 0; }
.note__x { padding: 0 6px; border: 0; background: none; opacity: .7; }
.note__x:hover { background: none; opacity: 1; }
.note--info { background: var(--vscode-inputValidation-infoBackground, var(--vscode-panel-background)); color: var(--vscode-editorInfo-foreground, var(--vscode-foreground)); border-left: 3px solid var(--vscode-editorInfo-foreground, #3794ff); }
.note--warn { background: var(--vscode-inputValidation-warningBackground, var(--vscode-panel-background)); color: var(--vscode-editorWarning-foreground, var(--vscode-foreground)); border-left: 3px solid var(--vscode-editorWarning-foreground, #cca700); }
.note--error { background: var(--vscode-inputValidation-errorBackground, var(--vscode-panel-background)); color: var(--vscode-errorForeground, var(--vscode-foreground)); border-left: 3px solid var(--vscode-errorForeground, #f14c4c); }
.note--progress { background: var(--vscode-panel-background); border-left: 3px solid var(--vscode-progressBar-background, #0e70c0); }
.note--progress .note__mark { border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; width: 10px; height: 10px; margin-top: 3px; animation: turn .8s linear infinite; }
@keyframes turn { to { transform: rotate(360deg); } }
.nothing { flex: 1; display: grid; place-items: center; color: var(--vscode-descriptionForeground); padding: 24px; text-align: center; }
iframe { flex: 1; border: 0; width: 100%; background: #fff; }
</style>
</head>
<body>
<div class="bar">
	<input class="addr" id="addr" readonly value="${address}" aria-label="Address"${url === undefined ? ' placeholder="Nothing is being served yet"' : ''}>
	<button id="reload" type="button"${url === undefined ? ' disabled' : ''}>Reload</button>
	<button id="open" type="button"${url === undefined ? ' disabled' : ''}>Open in browser</button>
	<button id="stop" type="button">Stop</button>
</div>
<div class="note" id="note" hidden role="status" aria-live="polite">
	<span class="note__mark" id="note-mark"></span>
	<span class="note__text" id="note-text"></span>
	<button id="note-action" type="button" hidden></button>
	<button class="note__x" id="note-close" type="button" title="Dismiss" aria-label="Dismiss">✕</button>
</div>
${url === undefined ? '<div class="nothing">Nothing is being served yet.</div>' : `<iframe id="page" title="${escape(title)}" src="${address}"></iframe>`}
<script nonce="${nonce}">
(function () {
	const api = acquireVsCodeApi();
	const marks = { info: '✔', warn: '⚠', error: '✕', progress: '' };
	const note = document.getElementById('note');
	const text = document.getElementById('note-text');
	const mark = document.getElementById('note-mark');
	const action = document.getElementById('note-action');
	const frame = document.getElementById('page');

	function draw(found) {
		if (!found) {
			note.hidden = true;
			return;
		}
		note.hidden = false;
		note.className = 'note note--' + found.level;
		mark.textContent = marks[found.level] === undefined ? '' : marks[found.level];
		text.textContent = found.text;
		if (found.action) {
			action.hidden = false;
			action.textContent = found.action;
		} else {
			action.hidden = true;
		}
	}

	if (${JSON.stringify(noteMessage(note) ?? null)} !== null) {
		draw(${JSON.stringify(noteMessage(note) ?? null)});
	}

	window.addEventListener('message', (event) => {
		const message = event.data ?? {};
		if (message.type === 'note') {
			draw(message.note);
		} else if (message.type === 'clear') {
			draw(undefined);
		}
	});

	document.getElementById('reload').addEventListener('click', () => {
		if (!frame) { return; }
		const src = frame.getAttribute('src').split('?')[0];
		frame.setAttribute('src', 'about:blank');
		setTimeout(() => frame.setAttribute('src', src), 20);
	});
	document.getElementById('open').addEventListener('click', () => api.postMessage({ type: 'open' }));
	document.getElementById('stop').addEventListener('click', () => api.postMessage({ type: 'stop' }));
	action.addEventListener('click', () => api.postMessage({ type: 'action' }));
	document.getElementById('note-close').addEventListener('click', () => {
		draw(undefined);
		api.postMessage({ type: 'dismiss' });
	});
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
	private strip: Note | undefined;
	private onClose: (() => void) | undefined;

	/** Show `url`, opening the panel if it is not already up. The strip keeps whatever it was last told. */
	show(url: string, title: string, options: { onClose?: () => void } = {}): void {
		this.url = url;
		this.onClose = options.onClose;
		this.render(title);
	}

	/**
	 * Say what just happened, in the page rather than in a notification.
	 *
	 * When nothing is open yet the panel opens for the sentence alone: a failure that only exists in a corner of the
	 * window is the thing this replaces.
	 */
	note(level: NoteLevel, text: string, action?: NoteAction): void {
		this.strip = action === undefined ? { level, text } : { level, text, action };
		if (this.panel === undefined) {
			this.render('Temco Learn');
			return;
		}
		this.panel.reveal(vscode.ViewColumn.Active, false);
		void this.panel.webview.postMessage({ type: 'note', note: noteMessage(this.strip) });
	}

	/** Take the strip away once it has been read. */
	clear(): void {
		this.strip = undefined;
		void this.panel?.webview.postMessage({ type: 'clear' });
	}

	/** The address on screen, when the panel is open. */
	get current(): string | undefined {
		return this.url;
	}

	dispose(): void {
		this.panel?.dispose();
	}

	private render(title: string): void {
		if (this.panel === undefined) {
			this.panel = vscode.window.createWebviewPanel('temcoLearn.preview', title, vscode.ViewColumn.Active, {
				enableScripts: true,
				retainContextWhenHidden: true
			});
			this.panel.iconPath = new vscode.ThemeIcon('eye');
			this.panel.webview.onDidReceiveMessage((message: { type?: string }) => {
				switch (message?.type) {
					case 'open':
						void this.openExternally();
						break;
					case 'stop':
						this.panel?.dispose();
						break;
					case 'action':
						void this.strip?.action?.run();
						break;
					case 'dismiss':
						this.strip = undefined;
						break;
					default:
						break;
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
			this.panel.reveal(vscode.ViewColumn.Active, false);
		}
		const nonce = Array.from({ length: 16 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
		this.panel.webview.html = document(this.url, this.strip, nonce, title);
	}

	private async openExternally(): Promise<void> {
		if (this.url !== undefined) {
			await vscode.env.openExternal(vscode.Uri.parse(this.url));
		}
	}
}
