// The selection menu: the marks, where the hand already is.
//
// A ribbon asks a person to travel to the top of the window to make a word bold; here the control appears under the words
// being selected and disappears when they are not. It is the one thing a ribbon cannot do, so it is the reason a second
// surface is worth having at all.
//
// It draws the same six marks, in the same order and with the same button (`../../ribbon`'s `Tool` and `MARKS`), so the
// bar and the menu cannot drift apart. The state is read here rather than taken from the mount's snapshot: the menu has to
// be right about the selection it is floating over, and the mount hears about a selection a render later.

import * as React from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';

import type { PageActions } from '../../contract';
import { MARKS, Tool } from '../../ribbon';

export function SelectionMenu({ editor, actions }: { editor: Editor; actions: PageActions }): React.ReactElement {
	const marks = useEditorState({
		editor,
		selector: ({ editor: current }) => ({
			bold: current.isActive('bold'),
			italic: current.isActive('italic'),
			underline: current.isActive('underline'),
			strike: current.isActive('strike'),
			code: current.isActive('code'),
			highlight: current.isActive('highlight'),
		}),
	});

	return (
		<BubbleMenu editor={editor} className="bubble" role="toolbar" aria-label="Format the selection">
			{MARKS.map(entry => (
				<Tool
					key={entry.mark}
					label={entry.label}
					glyph={entry.glyph}
					shortcut={entry.shortcut}
					active={marks[entry.mark]}
					run={() => actions.toggleMark(entry.mark)}
				/>
			))}
		</BubbleMenu>
	);
}
