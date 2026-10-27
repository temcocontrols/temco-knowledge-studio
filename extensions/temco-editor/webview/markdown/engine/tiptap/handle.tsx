// The block handle: the grip that appears beside the block the pointer is over, and moves it.
//
// Tiptap's own `DragHandle`, in the engine folder because it is a plugin over the ProseMirror view. The surface draws
// nothing for it and the contract does not mention it — a page is still a page with no handle at all, which is why the
// keyboard (`Alt+↑`/`Alt+↓` in the engine's own keymap) is the way that never depends on a pointer.

import * as React from 'react';
import type { Editor } from '@tiptap/react';
import { DragHandle } from '@tiptap/extension-drag-handle-react';

/** Six dots, drawn by `surface.css`; the glyph is decoration, so a screen reader skips it. */
export function BlockHandle({ editor }: { editor: Editor }): React.ReactElement {
	return (
		<DragHandle editor={editor} className="drag-handle" nested>
			<span aria-hidden="true">⠿</span>
		</DragHandle>
	);
}
