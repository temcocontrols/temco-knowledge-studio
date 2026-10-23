// The highlight toggle.
//
// The template ships a colour-highlight popover, which is right for an HTML document and wrong here: Markdown holds one
// highlight, `==text==`, so every colour a person picked would be gone the next time the file was opened. This is the
// same button with the colour chooser removed — it toggles the only highlight a Markdown file can carry.

import { useEditorState } from '@tiptap/react';
import { Button } from '@/components/tiptap-ui-primitive/button';
import { useTiptapEditor } from '@/hooks/use-tiptap-editor';

const HIGHLIGHTER =
	'M6 14.5 13.8 6.7l3.5 3.5L9.5 18H6zm9.2-9.2 1.4-1.4a1 1 0 0 1 1.4 0l2.1 2.1a1 1 0 0 1 0 1.4l-1.4 1.4zM4 20h16v2H4z';

export function HighlightToggle() {
	const { editor } = useTiptapEditor();
	const active = useEditorState({
		editor,
		selector: ({ editor: current }) => current?.isActive('highlight') ?? false,
	});

	return (
		<Button
			type="button"
			variant="ghost"
			data-style="ghost"
			data-active-state={active ? 'on' : 'off'}
			tooltip="Highlight — ==text=="
			aria-label="Highlight"
			aria-pressed={active}
			onClick={() => editor?.chain().focus().toggleHighlight().run()}
		>
			<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="tiptap-button-icon" aria-hidden="true">
				<path fill="currentColor" d={HIGHLIGHTER} />
			</svg>
		</Button>
	);
}
