// The engine: the Tiptap schema, the bar, the selection menu and the drag handle.
//
// What this file is for is the comparison. `temco-docs` draws a ribbon with two tabs and ~20 named operations; this
// surface keeps a single slim bar and moves the marks to the selection itself, which is the one thing a ribbon cannot
// do. Everything below the bar — the schema, the Markdown contract, the bridge — is the same as the shipped editor, so
// the difference a person judges is the surface and not the file.

import * as React from 'react';
import { EditorContent, useEditor, type Editor, type Extensions } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { DragHandle } from '@tiptap/extension-drag-handle-react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table/row';
import { TableHeader } from '@tiptap/extension-table/header';
import { TableCell } from '@tiptap/extension-table/cell';
import { TaskItemWithCheckboxes, TaskListWithCheckboxes } from './taskLists.mjs';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import { common, createLowlight } from 'lowlight';
import { StaticPage } from './reading';

const lowlight = createLowlight(common);

/** The marks and blocks a page can hold — the whole vocabulary of the bar, and the whole of what Markdown can carry. */
export type Mark = 'bold' | 'italic' | 'underline' | 'strike' | 'code' | 'highlight';
export type ListKind = 'bullet' | 'ordered' | 'task';

/** What is true at the caret, read once per change and handed to the bar as data. */
export interface DocState {
	block: number;
	marks: Record<Mark, boolean>;
	lists: Record<ListKind, boolean>;
	inTable: boolean;
	link: string | undefined;
	canUndo: boolean;
	canRedo: boolean;
	words: number;
	characters: number;
}

/** The state a page has before the engine has said anything: nothing marked, nothing to undo. */
export const EMPTY: DocState = {
	block: 0,
	marks: { bold: false, italic: false, underline: false, strike: false, code: false, highlight: false },
	lists: { bullet: false, ordered: false, task: false },
	inTable: false,
	link: undefined,
	canUndo: false,
	canRedo: false,
	words: 0,
	characters: 0,
};

function blockOf(editor: Editor): number {
	for (const level of [1, 2, 3, 4]) {
		if (editor.isActive('heading', { level })) {
			return level;
		}
	}
	return 0;
}

/** `CharacterCount` is what makes the status strip honest without walking the document on every keystroke. */
function countsOf(editor: Editor): { words: number; characters: number } {
	const storage = editor.storage.characterCount as { words?: () => number; characters?: () => number } | undefined;
	const words = storage?.words?.();
	const characters = storage?.characters?.();
	if (typeof words === 'number' && typeof characters === 'number') {
		return { words, characters };
	}
	return { words: 0, characters: 0 };
}

export function stateOf(editor: Editor): DocState {
	const href = editor.getAttributes('link').href;
	const { words, characters } = countsOf(editor);
	return {
		...EMPTY,
		block: blockOf(editor),
		marks: {
			bold: editor.isActive('bold'),
			italic: editor.isActive('italic'),
			underline: editor.isActive('underline'),
			strike: editor.isActive('strike'),
			code: editor.isActive('code'),
			highlight: editor.isActive('highlight'),
		},
		lists: {
			bullet: editor.isActive('bulletList'),
			ordered: editor.isActive('orderedList'),
			task: editor.isActive('taskList'),
		},
		inTable: editor.isActive('table'),
		link: typeof href === 'string' ? href : undefined,
		canUndo: editor.can().undo(),
		canRedo: editor.can().redo(),
		words,
		characters,
	};
}

/**
 * The document schema, from the extensions a Markdown page actually contains.
 *
 * What is switched **off** in StarterKit is switched off because it is configured here instead (a code block that
 * highlights, a link whose clicks are ours, an underline with its own keymap). Nothing is listed twice: a second
 * extension with the same name is a silent difference in behaviour, which Tiptap resolves by keeping one and warning.
 */
function extensions(): Extensions {
	return [
		StarterKit.configure({
			codeBlock: false,
			heading: { levels: [1, 2, 3, 4] },
			link: false,
			underline: false,
		}),
		Underline,
		Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener' } }),
		Image.configure({ inline: false }),
		Table.configure({ resizable: true }),
		TableRow,
		TableHeader,
		TableCell,
		TaskListWithCheckboxes,
		TaskItemWithCheckboxes.configure({ nested: true }),
		CodeBlockLowlight.configure({ lowlight }),
		Highlight,
		// The second opinion on serialisation. It never writes the file — the save path is `src/markdown.ts`, the same
		// one the shipped editor uses — but it can say what the file *would* become if the module adopted it.
		Markdown,
		// The three that are the point of this surface: a hint on an empty page, a live count, and a selection menu.
		Placeholder.configure({ placeholder: 'Write the page…' }),
		CharacterCount,
	];
}

/**
 * Tiptap's own Markdown serialiser, for comparison only.
 *
 * `@tiptap/markdown` writes its own dialect: no trailing newline, `| ---- |` table separators, `++u++` and `==mark==`
 * for underline and highlight. Useful to see, not ours to write — anything it produced would rewrite a page that was
 * not edited.
 */
export function alternativeMarkdown(editor: Editor): string {
	const serialize = (editor as unknown as { getMarkdown?: () => string }).getMarkdown;
	return typeof serialize === 'function' ? serialize.call(editor) : '';
}

export interface DocumentOptions {
	onChange: (editor: Editor) => void;
}

/** The editor, for as long as the surface lives. `null` while Tiptap creates it. */
export function usePrototypeDocument(options: DocumentOptions): Editor | null {
	const { onChange } = options;
	return useEditor({
		extensions: extensions(),
		content: '',
		editorProps: {
			attributes: { class: 'doc-surface__doc', 'aria-label': 'Page' },
		},
		onUpdate: ({ editor }) => onChange(editor),
	});
}

// --- the bar --------------------------------------------------------------------------------------

const MARKS: { mark: Mark; label: string; glyph: string; key: string }[] = [
	{ mark: 'bold', label: 'Bold', glyph: 'B', key: 'Ctrl+B' },
	{ mark: 'italic', label: 'Italic', glyph: 'I', key: 'Ctrl+I' },
	{ mark: 'underline', label: 'Underline', glyph: 'U', key: 'Ctrl+U' },
	{ mark: 'strike', label: 'Strikethrough', glyph: 'S', key: 'Ctrl+Shift+X' },
	{ mark: 'code', label: 'Inline code', glyph: '‹›', key: 'Ctrl+E' },
	{ mark: 'highlight', label: 'Highlight', glyph: '▨', key: 'Ctrl+Shift+H' },
];

const BLOCKS: { level: number; label: string }[] = [
	{ level: 0, label: 'Text' },
	{ level: 1, label: 'Heading 1' },
	{ level: 2, label: 'Heading 2' },
	{ level: 3, label: 'Heading 3' },
	{ level: 4, label: 'Heading 4' },
];

function mark(editor: Editor, name: Mark): void {
	const chain = editor.chain().focus();
	const toggles: Record<Mark, () => void> = {
		bold: () => chain.toggleBold().run(),
		italic: () => chain.toggleItalic().run(),
		underline: () => chain.toggleUnderline().run(),
		strike: () => chain.toggleStrike().run(),
		code: () => chain.toggleCode().run(),
		highlight: () => chain.toggleHighlight().run(),
	};
	toggles[name]();
}

/** One button, one control: the bar is a list of these, and the selection menu is the same list, reduced. */
function BarButton(props: {
	label: string;
	glyph: React.ReactNode;
	shortcut?: string;
	on?: boolean;
	disabled?: boolean;
	run: () => void;
}): React.ReactElement {
	return (
		<button
			type="button"
			className="bar__btn"
			aria-label={props.label}
			aria-pressed={props.on === true}
			title={props.shortcut === undefined ? props.label : `${props.label} (${props.shortcut})`}
			disabled={props.disabled === true}
			onMouseDown={event => event.preventDefault()}
			onClick={props.run}
		>
			{props.glyph}
		</button>
	);
}

/** The marks, in the order every editor puts them. Used by both the bar and the selection menu. */
function MarkButtons({ editor, state }: { editor: Editor; state: DocState }): React.ReactElement {
	return (
		<>
			{MARKS.map(entry => (
				<BarButton
					key={entry.mark}
					label={entry.label}
					glyph={entry.glyph}
					shortcut={entry.key}
					on={state.marks[entry.mark]}
					run={() => mark(editor, entry.mark)}
				/>
			))}
		</>
	);
}

export interface BarProps {
	editor: Editor;
	state: DocState;
	onAsk: (title: string, value: string, accept: (answer: string) => void) => void;
}

export function PageBar({ editor, state, onAsk }: BarProps): React.ReactElement {
	return (
		<div className="bar" role="toolbar" aria-label="Writing">
			<select
				className="bar__select"
				aria-label="Paragraph style"
				value={state.block}
				onChange={event => {
					const level = Number(event.target.value);
					const chain = editor.chain().focus();
					if (level === 0) {
						chain.setParagraph().run();
					} else {
						chain.setHeading({ level: level as 1 | 2 | 3 | 4 }).run();
					}
				}}
			>
				{BLOCKS.map(entry => (
					<option key={entry.level} value={entry.level}>{entry.label}</option>
				))}
			</select>

			<span className="bar__group">
				<MarkButtons editor={editor} state={state} />
			</span>

			<span className="bar__group">
				<BarButton label="Bulleted list" glyph="•" on={state.lists.bullet} run={() => editor.chain().focus().toggleBulletList().run()} />
				<BarButton label="Numbered list" glyph="1." on={state.lists.ordered} run={() => editor.chain().focus().toggleOrderedList().run()} />
				<BarButton label="Task list" glyph="☑" on={state.lists.task} run={() => editor.chain().focus().toggleTaskList().run()} />
				<BarButton label="Block quote" glyph="❝" on={editor.isActive('blockquote')} run={() => editor.chain().focus().toggleBlockquote().run()} />
				<BarButton label="Code block" glyph="⧉" on={editor.isActive('codeBlock')} run={() => editor.chain().focus().toggleCodeBlock().run()} />
			</span>

			<span className="bar__group">
				<BarButton
					label={state.link === undefined ? 'Link' : 'Edit link'}
					glyph="🔗"
					on={state.link !== undefined}
					run={() => askForLink(editor, state, onAsk)}
				/>
				<BarButton
					label="Picture"
					glyph="▤"
					run={() => onAsk('Which picture, relative to this page?', '', answer => {
						if (answer !== '') {
							editor.chain().focus().setImage({ src: answer, alt: '' }).run();
						}
					})}
				/>
				<BarButton label="Table" glyph="▦" run={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
				<BarButton label="Horizontal rule" glyph="―" run={() => editor.chain().focus().setHorizontalRule().run()} />
			</span>

			<span className="bar__group bar__group--end">
				<BarButton label="Undo" glyph="↶" shortcut="Ctrl+Z" disabled={!state.canUndo} run={() => editor.chain().focus().undo().run()} />
				<BarButton label="Redo" glyph="↷" shortcut="Ctrl+Y" disabled={!state.canRedo} run={() => editor.chain().focus().redo().run()} />
			</span>
		</div>
	);
}

/** The same "where does the link go?" question the bar asks, from the selection. */
function askForLink(editor: Editor, state: DocState, onAsk: BarProps['onAsk']): void {
	onAsk(state.link === undefined ? 'Where should the link go?' : 'Change the link to', state.link ?? '', answer => {
		const chain = editor.chain().focus().extendMarkRange('link');
		if (answer === '') {
			chain.unsetLink().run();
			return;
		}
		chain.setLink({ href: answer }).run();
	});
}

/**
 * The selection menu: the same marks, where the hand already is.
 *
 * This is the whole argument for a second surface. A ribbon asks a person to travel to the top of the window to make a
 * word bold; here the control appears under the words being selected and disappears when they are not.
 */
function SelectionMenu(props: { editor: Editor; state: DocState; onAsk: BarProps['onAsk'] }): React.ReactElement {
	const { editor, state, onAsk } = props;
	return (
		<BubbleMenu editor={editor} className="bubble" role="toolbar" aria-label="Format the selection">
			<MarkButtons editor={editor} state={state} />
			<BarButton
				label="Link"
				glyph="🔗"
				on={state.link !== undefined}
				run={() => askForLink(editor, state, onAsk)}
			/>
		</BubbleMenu>
	);
}

/** The editor, the bar, the handle and the selection menu, in the box the surface draws. */
export function PageDocument(props: {
	editor: Editor;
	state: DocState;
	onAsk: BarProps['onAsk'];
	/** Read mode: the markup captured on the way in, and no editing controls at all. */
	reading?: false | { html: string };
}): React.ReactElement {
	const { editor, state, onAsk, reading } = props;
	if (reading !== undefined && reading !== false) {
		return (
			<div className="doc-surface__editor doc-surface__editor--reading">
				<div className="doc-surface__canvas">
					<div className="doc-surface__paper">
						<StaticPage html={reading.html} />
					</div>
				</div>
			</div>
		);
	}
	return (
		<div className="doc-surface__editor">
			<PageBar editor={editor} state={state} onAsk={onAsk} />
			<div className="doc-surface__canvas">
				<div className="doc-surface__paper">
					<DragHandle editor={editor} className="drag-handle" nested>
						<span aria-hidden="true">⠿</span>
					</DragHandle>
					<EditorContent editor={editor} />
				</div>
			</div>
			<SelectionMenu editor={editor} state={state} onAsk={onAsk} />
		</div>
	);
}
