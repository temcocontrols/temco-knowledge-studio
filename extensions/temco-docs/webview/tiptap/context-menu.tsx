// The editor's own context menu.
//
// A webview does not get the application's editing menu: VS Code offers Cut, Copy and Paste and nothing else, and it
// hides even that as soon as the page handles the event itself (see `pre/index.html` in the workbench — the host checks
// `defaultPrevented`). So the page has to own the menu, and owning it is the only way to offer the three things the
// host cannot know about: select all, inserting an image, and editing the link under the pointer.
//
// Paste is done through the clipboard API rather than `document.execCommand`, because the webview iframe is created
// with `allow="clipboard-read; clipboard-write"` and the async API is the one that can tell an image from text.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useTiptapEditor } from '@/hooks/use-tiptap-editor';
import { insertImage } from '@/components/tiptap-ui/image-upload-button';
import { requestImageSave } from './document';

export interface ContextMenuPosition {
	x: number;
	y: number;
}

interface Entry {
	label: string;
	run: () => void | Promise<void>;
	disabled?: boolean;
	/** A rule above this entry. */
	separate?: boolean;
}

/** A clipboard image needs a name and an extension; the MIME type is the only clue available. */
function nameForMime(mime: string): string {
	const extension = mime === 'image/jpeg' ? 'jpg' : mime.replace('image/', '').split('+')[0] || 'png';
	return `pasted.${extension}`;
}

/** What the clipboard holds, inserted where the caret is. Images come back as files beside the page. */
async function pasteClipboard(editor: Editor): Promise<void> {
	let items: ClipboardItems | undefined;
	try {
		items = await navigator.clipboard.read();
	} catch {
		// No permission, or a browser without the async API. The host's own paste still works from the keyboard.
		document.execCommand('paste');
		return;
	}

	for (const item of items) {
		const imageType = item.types.find((type) => type.startsWith('image/'));
		if (imageType !== undefined) {
			const blob = await item.getType(imageType);
			const source = await requestImageSave(new Uint8Array(await blob.arrayBuffer()), nameForMime(imageType));
			if (editor.view.dom.isConnected) {
				editor.chain().focus().setImage({ src: source }).run();
			}
			continue;
		}
		if (item.types.includes('text/html')) {
			const html = await (await item.getType('text/html')).text();
			editor.chain().focus().insertContent(html).run();
			continue;
		}
		if (item.types.includes('text/plain')) {
			const text = await (await item.getType('text/plain')).text();
			editor.chain().focus().insertContent(text).run();
		}
	}
}

/**
 * The menu itself: rendered only while open, so it cannot hold the focus or the pointer when it is not wanted.
 */
export function EditorContextMenu({
	at,
	onClose,
}: {
	at: ContextMenuPosition | null;
	onClose: () => void;
}) {
	const { editor } = useTiptapEditor();
	const menuRef = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState<ContextMenuPosition>({ x: 0, y: 0 });

	// Keep the menu inside the window: a right-click near the bottom edge would otherwise open it off-screen.
	useEffect(() => {
		if (at === null) {
			return;
		}
		const menu = menuRef.current;
		const width = menu?.offsetWidth ?? 200;
		const height = menu?.offsetHeight ?? 260;
		setPosition({
			x: Math.max(4, Math.min(at.x, window.innerWidth - width - 4)),
			y: Math.max(4, Math.min(at.y, window.innerHeight - height - 4)),
		});
	}, [at]);

	// Anything that means "I am done with this menu": Escape, a click elsewhere, a scroll, or the window losing focus.
	// The keyboard also has to be able to reach the menu, since it deliberately leaves the focus in the page.
	useEffect(() => {
		if (at === null) {
			return;
		}
		const items = (): HTMLButtonElement[] =>
			Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('.temco-menu__item:not(:disabled)') ?? []);
		const onPointerDown = (event: MouseEvent): void => {
			if (!menuRef.current?.contains(event.target as Node)) {
				onClose();
			}
		};
		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.key === 'Escape') {
				event.preventDefault();
				onClose();
				return;
			}
			if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
				const all = items();
				if (all.length === 0) {
					return;
				}
				event.preventDefault();
				const index = all.indexOf(document.activeElement as HTMLButtonElement);
				const next =
					event.key === 'ArrowDown'
						? all[Math.min(all.length - 1, index + 1)]
						: all[index <= 0 ? all.length - 1 : index - 1];
				next.focus();
			}
		};
		window.addEventListener('mousedown', onPointerDown, true);
		window.addEventListener('keydown', onKeyDown, true);
		window.addEventListener('scroll', onClose, true);
		window.addEventListener('blur', onClose);
		return () => {
			window.removeEventListener('mousedown', onPointerDown, true);
			window.removeEventListener('keydown', onKeyDown, true);
			window.removeEventListener('scroll', onClose, true);
			window.removeEventListener('blur', onClose);
		};
	}, [at, onClose]);

	const act = useCallback(
		(run: () => void | Promise<void>) => () => {
			onClose();
			// The menu is closed first so the editor regains the focus before the action needs it.
			requestAnimationFrame(() => void run());
		},
		[onClose]
	);

	/**
	 * Puts the editor's own selection back into the DOM and gives it the focus.
	 *
	 * The menu leaves the focus in the page on purpose, so the highlight stays visible; but the keyboard, or a click
	 * that landed on the menu, can still have moved it. Cut and Copy act on the browser's selection, so it is restored
	 * before they run rather than trusted.
	 */
	const restoreSelection = useCallback((): boolean => {
		if (!editor) {
			return false;
		}
		const { from, to, empty } = editor.state.selection;
		if (empty) {
			return false;
		}
		editor.chain().focus().setTextSelection({ from, to }).run();
		return true;
	}, [editor]);

	if (at === null) {
		return null;
	}

	const selection = editor?.state.selection;
	const hasSelection = selection !== undefined && !selection.empty;
	const inLink = editor?.isActive('link') ?? false;

	const entries: Entry[] = [
		{
			label: 'Cut',
			run: () => {
				if (restoreSelection()) {
					document.execCommand('cut');
				}
			},
			disabled: !hasSelection,
		},
		{
			label: 'Copy',
			run: () => {
				if (restoreSelection()) {
					document.execCommand('copy');
				}
			},
			disabled: !hasSelection,
		},
		{ label: 'Paste', run: () => (editor ? pasteClipboard(editor) : undefined) },
		{ label: 'Select all', run: () => editor?.chain().focus().selectAll().run() },
		{ label: 'Insert image…', run: () => (editor ? insertImage(editor) : undefined), separate: true },
	];
	if (inLink) {
		entries.push({ label: 'Remove link', run: () => editor?.chain().focus().unsetLink().run() });
	}

	return (
		<div
			ref={menuRef}
			className="temco-menu"
			role="menu"
			aria-label="Editing"
			style={{ left: `${position.x}px`, top: `${position.y}px` }}
		>
			{entries.map((entry) => (
				<div key={entry.label} className="temco-menu__slot">
					{entry.separate ? <div className="temco-menu__rule" role="separator" /> : null}
					<button
						type="button"
						role="menuitem"
						className="temco-menu__item"
						disabled={entry.disabled ?? false}
						onClick={act(entry.run)}
					>
						{entry.label}
					</button>
				</div>
			))}
		</div>
	);
}
