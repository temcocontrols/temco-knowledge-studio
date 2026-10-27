// The selection menu: what the marks are for a word, the size is for a picture.
//
// A ribbon asks a person to travel to the top of the window to make a word bold; here the control appears under the words
// being selected and disappears when they are not. It is the one thing a ribbon cannot do, so it is the reason a second
// surface is worth having at all.
//
// Which menu appears is the engine's answer to "what is selected": text gets the six marks the bar draws (the same list,
// `../../ribbon`'s `MARKS`, so the two cannot drift apart), a picture gets the four widths and a delete. A menu of marks
// over a photograph is a menu of buttons that do nothing, which is the one arrangement worth avoiding.
//
// The state is read here rather than taken from the mount's snapshot: the menu has to be right about the selection it is
// floating over, and the mount hears about a selection a render later.

import * as React from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { Delete24Regular } from '@fluentui/react-icons';

import type { PageActions } from '../../contract';
import { MARKS, Tool } from '../../ribbon';

/** The widths a picture may be set to, as a share of the page, plus the way back to full width. */
const WIDTHS: ReadonlyArray<{ label: string; glyph: string; value: string | null }> = [
	{ label: 'Quarter width', glyph: '25%', value: '25%' },
	{ label: 'Half width', glyph: '50%', value: '50%' },
	{ label: 'Three quarters wide', glyph: '75%', value: '75%' },
	{ label: 'Full width', glyph: '100%', value: null },
];

export function SelectionMenu({ editor, actions }: { editor: Editor; actions: PageActions }): React.ReactElement {
	const state = useEditorState({
		editor,
		selector: ({ editor: current }) => {
			const width = current.getAttributes('image').width;
			return {
				picture: current.isActive('image'),
				width: typeof width === 'string' || typeof width === 'number' ? String(width) : undefined,
				bold: current.isActive('bold'),
				italic: current.isActive('italic'),
				underline: current.isActive('underline'),
				strike: current.isActive('strike'),
				code: current.isActive('code'),
				highlight: current.isActive('highlight'),
			};
		},
	});

	if (state.picture) {
		return (
			<BubbleMenu editor={editor} className="bubble" role="toolbar" aria-label="The picture">
				{WIDTHS.map(entry => (
					<Tool
						key={entry.label}
						label={entry.label}
						glyph={<span className="bubble__text">{entry.glyph}</span>}
						// Full width is the picture with no width attribute at all, so it is "on" when nothing is set.
						active={entry.value === null ? state.width === undefined : state.width === entry.value}
						run={() => actions.setImageWidth(entry.value)}
					/>
				))}
				<Tool label="Delete the picture" glyph={<Delete24Regular />} run={actions.deleteSelection} />
			</BubbleMenu>
		);
	}

	return (
		<BubbleMenu editor={editor} className="bubble" role="toolbar" aria-label="Format the selection">
			{MARKS.map(entry => (
				<Tool
					key={entry.mark}
					label={entry.label}
					glyph={entry.glyph}
					shortcut={entry.shortcut}
					active={state[entry.mark]}
					run={() => actions.toggleMark(entry.mark)}
				/>
			))}
		</BubbleMenu>
	);
}
