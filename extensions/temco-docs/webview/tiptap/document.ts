// The VS Code side of the Tiptap template: one message channel, and the bridge that uses it.
//
// The webview is a surface, not a second copy of the file. `attach` replaces the editor's content with the document's
// text, reports `ready`, and sends the whole Markdown back after typing settles so the extension can apply it as one
// undoable edit. `tidy()` decides what that text looks like; this module only carries it.

import type { Editor } from '@tiptap/react';

/** How long typing rests before the whole document is sent. */
const SETTLE_MS = 300;

interface Host {
	postMessage(message: unknown): void;
}

interface HostMessage {
	type?: unknown;
	text?: unknown;
	src?: unknown;
}

declare function acquireVsCodeApi(): Host;

export const host: Host = acquireVsCodeApi();

/** One message to the extension. */
export function post(type: string, extra: Record<string, unknown> = {}): void {
	host.postMessage({ type, ...extra });
}

/** An image the extension is choosing; resolved when its page-relative address comes back. */
let pendingImage: ((source: string) => void) | undefined;

/** Asks the extension to put an image beside the page and hand back its address. */
export function requestImage(): Promise<string> {
	return new Promise<string>((resolve) => {
		pendingImage = resolve;
		post('action', { action: 'image' });
	});
}

/**
 * Wires an editor to its document.
 *
 * Returns a disposer, so a remount cannot leave two listeners reporting the same file.
 */
export function attach(
	editor: Editor,
	tidyText: (markdown: string, trailingNewline: boolean) => string
): () => void {
	let settle: number | undefined;
	let applying = false;
	let trailingNewline = true;

	const onMessage = (event: MessageEvent<HostMessage>): void => {
		const message = event.data;
		if (message === null || typeof message !== 'object') {
			return;
		}
		if (message.type === 'image' && typeof message.src === 'string') {
			const resolve = pendingImage;
			pendingImage = undefined;
			resolve?.(decodeURI(message.src));
			return;
		}
		if (message.type !== 'set') {
			return;
		}
		const text = typeof message.text === 'string' ? message.text : '';
		trailingNewline = text.endsWith('\n');
		applying = true;
		try {
			editor.commands.setContent(text, { contentType: 'markdown', emitUpdate: false });
		} finally {
			applying = false;
		}
	};

	const onUpdate = (): void => {
		if (applying) {
			return;
		}
		if (settle !== undefined) {
			window.clearTimeout(settle);
		}
		settle = window.setTimeout(() => {
			settle = undefined;
			post('change', { text: tidyText(editor.getMarkdown(), trailingNewline) });
		}, SETTLE_MS);
	};

	window.addEventListener('message', onMessage);
	editor.on('update', onUpdate);
	// The extension answers `ready` by sending the file; anything before this would be lost.
	post('ready');

	return () => {
		if (settle !== undefined) {
			window.clearTimeout(settle);
		}
		window.removeEventListener('message', onMessage);
		editor.off('update', onUpdate);
	};
}
