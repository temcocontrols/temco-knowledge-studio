// Tiptap, behind the contract. This is the only file in the module that names an engine.
//
// Everything below the surface — the schema, the named operations, the snapshot of the caret, the heading index, the
// search — is here so that `../contract` can stay a list of types. Replacing Tiptap means deleting this folder and
// writing another one that returns the same `PageActions`: the bar, the mount and the ribbon do not change.
//
// What the engine must guarantee, because the file is Markdown: a paragraph is a paragraph (no re-wrapping on save), a
// heading is a level, and everything emitted is something `src/markdown.ts` can write back.

import { EditorContent, useEditor, type Editor, type Extensions } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { ImageWithSize } from './image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table/row';
import { TableHeader } from '@tiptap/extension-table/header';
import { TableCell } from '@tiptap/extension-table/cell';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import { Placeholder } from '@tiptap/extensions';
import { Extension } from '@tiptap/core';
import { common, createLowlight } from 'lowlight';

import type { HeadingAt } from '../../../../src/outlineModel';
import type { Mark, Match, PageActions, PageState } from '../../contract';
import { BlockHandle } from './handle';
import { SelectionMenu } from './bubble';
import { TaskItemWithCheckboxes, TaskListWithCheckboxes } from './taskLists.mjs';

const lowlight = createLowlight(common);

/**
 * `Ctrl+Shift+X` for strikethrough, because that is the key the bar teaches.
 *
 * The engine binds `Mod-Shift-s` for strike and nothing else, so the button's tooltip was naming a key that did nothing.
 * Either the label or the key had to move; the key moved, because `Ctrl+Shift+S` is "Save As" in every other application
 * a writer has used. Every other mark's key comes from its own extension, so this one does too rather than from the shell.
 */
const STRIKE_KEY = Extension.create({
	name: 'temcoStrikeKey',
	addKeyboardShortcuts() {
		return { 'Mod-Shift-x': () => this.editor.commands.toggleStrike() };
	},
});

// --- reading the document -------------------------------------------------------------------------

/** Every heading in the document, in order — read from the document itself, so it cannot disagree with the page. */
export function headingsIn(editor: Editor): HeadingAt[] {
	const found: HeadingAt[] = [];
	editor.state.doc.descendants((node, position) => {
		if (node.type.name === 'heading') {
			found.push({ level: Number(node.attrs.level ?? 1), text: node.textContent, at: position });
		}
		return true;
	});
	return found;
}

/**
 * Where a query is in the document.
 *
 * A rich document is not a string, so the match is found in its text and each offset is mapped back to a position. The
 * map breaks at a block boundary (`-1`), which is why a match that spans two paragraphs is not offered: a replace or a
 * selection across blocks means something different in ProseMirror, and guessing would be worse than not offering it.
 */
export function matchesIn(editor: Editor, query: string): Match[] {
	if (query === '') {
		return [];
	}
	const positions: number[] = [];
	let text = '';
	editor.state.doc.descendants((node, position) => {
		if (node.isText) {
			const value = node.text ?? '';
			for (let index = 0; index < value.length; index += 1) {
				positions.push(position + index);
			}
			text += value;
			return true;
		}
		if (node.isBlock && text !== '' && !text.endsWith('\n')) {
			text += '\n';
			positions.push(-1);
		}
		return true;
	});
	const needle = query.toLowerCase();
	const haystack = text.toLowerCase();
	const found: Match[] = [];
	for (let index = haystack.indexOf(needle); index >= 0; index = haystack.indexOf(needle, index + needle.length)) {
		const start = positions[index];
		const end = positions[index + needle.length - 1];
		if (start === undefined || end === undefined || start < 0 || end < 0) {
			continue;
		}
		found.push({ from: start, to: end + 1 });
	}
	return found;
}

/** The block the caret is in, as a level: 0 is a paragraph. */
function blockOf(editor: Editor): number {
	for (const level of [1, 2, 3, 4]) {
		if (editor.isActive('heading', { level })) {
			return level;
		}
	}
	return 0;
}

function wordsOf(editor: Editor): number {
	const plain = editor.getText().trim();
	return plain === '' ? 0 : plain.split(/\s+/).length;
}

export function stateOf(editor: Editor): PageState {
	const href = editor.getAttributes('link').href;
	return {
		block: blockOf(editor),
		marks: {
			bold: editor.isActive('bold'),
			italic: editor.isActive('italic'),
			underline: editor.isActive('underline'),
			strike: editor.isActive('strike'),
			code: editor.isActive('code'),
			highlight: editor.isActive('highlight'),
		},
		inTable: editor.isActive('table'),
		lists: {
			bullet: editor.isActive('bulletList'),
			ordered: editor.isActive('orderedList'),
			task: editor.isActive('taskList'),
		},
		onImage: editor.isActive('image'),
		link: typeof href === 'string' ? href : undefined,
		canUndo: editor.can().undo(),
		canRedo: editor.can().redo(),
		words: wordsOf(editor),
		cursor: editor.state.selection.from,
	};
}

// --- the named operations -------------------------------------------------------------------------

/** The named operations, over one editor. Every one of them focuses first, so a click on the bar acts on the page. */
export function actionsFor(editor: Editor): PageActions {
	const chain = (): ReturnType<Editor['chain']> => editor.chain().focus();
	const actions: PageActions = {
		setBlock: level => {
			if (level === 0) {
				chain().setParagraph().run();
				return;
			}
			chain().setHeading({ level: level as 1 | 2 | 3 | 4 }).run();
		},
		toggleMark: mark => {
			const toggles: Record<Mark, () => void> = {
				bold: () => chain().toggleBold().run(),
				italic: () => chain().toggleItalic().run(),
				underline: () => chain().toggleUnderline().run(),
				strike: () => chain().toggleStrike().run(),
				code: () => chain().toggleCode().run(),
				highlight: () => chain().toggleHighlight().run(),
			};
			toggles[mark]();
		},
		toggleList: kind => {
			// Toggling a list off when another kind is on would leave the caret in a list it cannot see; the engine
			// lifts it first, which is what a person means by choosing a different kind.
			if (kind === 'bullet') {
				chain().toggleBulletList().run();
			} else if (kind === 'ordered') {
				chain().toggleOrderedList().run();
			} else {
				chain().toggleTaskList().run();
			}
		},
		toggleQuote: () => chain().toggleBlockquote().run(),
		toggleCodeBlock: () => chain().toggleCodeBlock().run(),
		horizontalRule: () => chain().setHorizontalRule().run(),
		undo: () => chain().undo().run(),
		redo: () => chain().redo().run(),
		setLink: href => {
			chain().extendMarkRange('link').setLink({ href }).run();
		},
		unsetLink: () => chain().extendMarkRange('link').unsetLink().run(),
		insertTable: () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
		addRow: () => chain().addRowAfter().run(),
		addColumn: () => chain().addColumnAfter().run(),
		deleteRow: () => chain().deleteRow().run(),
		deleteColumn: () => chain().deleteColumn().run(),
		deleteTable: () => chain().deleteTable().run(),
		insertImage: (src, alt) => {
			chain().setImage({ src, alt }).run();
		},
		replaceImage: (at, src, alt) => {
			let replaced = false;
			chain().command(({ tr, state }) => {
				const node = state.doc.nodeAt(at);
				if (node === null || node.type.name !== 'image') {
					return false;
				}
				tr.replaceWith(at, at + node.nodeSize, state.schema.nodes.image.create({ src, alt }));
				replaced = true;
				return true;
			}).run();
			return replaced;
		},
		insertLinkText: (title, href) => {
			chain().insertContent({ type: 'text', text: title, marks: [{ type: 'link', attrs: { href } }] }).run();
		},
		imageWidth: () => {
			const width = editor.getAttributes('image').width;
			return typeof width === 'string' || typeof width === 'number' ? String(width) : undefined;
		},
		setImageWidth: width => {
			// Only ever on a selected picture: `updateAttributes` finds the node the selection is on, and does nothing when
			// there is none — which is what a `null` width means here, "back to the width of the page".
			editor.chain().focus().updateAttributes('image', { width }).run();
		},
		deleteSelection: () => {
			editor.chain().focus().deleteSelection().run();
		},
		selectionStart: () => editor.state.selection.from,
		goto: (from, to) => {
			chain().setTextSelection({ from, to: to ?? from }).scrollIntoView().run();
		},
		content: () => editor.getHTML(),
		load: html => {
			editor.commands.setContent(html, { emitUpdate: false });
		},
		// The handle before the content and the selection menu after it: both are the engine's own furniture, so the
		// mount inserts one element and gets the whole editing surface.
		node: () => (
			<>
				<BlockHandle editor={editor} />
				<EditorContent editor={editor} />
				<SelectionMenu editor={editor} actions={actions} />
			</>
		),
	};
	return actions;
}

// --- the hook -------------------------------------------------------------------------------------

export interface PageDocumentOptions {
	/** Called whenever the document changed, after the engine has settled. */
	onChange: (editor: Editor) => void;
	/** A screenshot pasted from another application: the words are asked for, then the host writes the file. */
	onPasteImage: (file: File) => void;
}

/**
 * The document schema, from the extensions that a Markdown page actually contains.
 *
 * What is switched **off** in StarterKit is switched off because it is configured here instead (a code block that
 * highlights, a link whose clicks are ours, an underline with its own keymap). What is **not** listed at all is already
 * inside StarterKit: bold, italic, strike, code, blockquote, the three lists, headings, hard breaks, undo/redo, the drop
 * and gap cursors, and the horizontal rule. Adding one of those a second time registers two extensions with the same name,
 * which Tiptap resolves by keeping one of them and warning — a silent, invisible difference in behaviour.
 *
 * The two task-list extensions are Tiptap's own, extended rather than replaced: `taskLists.mts` adds the shape `marked`
 * writes (`<ul><li><input type="checkbox">`) to the one Tiptap renders (`ul[data-type="taskList"]`), so a page's
 * checkboxes survive being opened.
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
		// The picture is a block with handles: dragging one writes a width, and `image.ts` keeps that width in the file.
		// A picture smaller than 120 px is a thumbnail nobody can read, so that is the floor the drag stops at.
		ImageWithSize.configure({ inline: false, resize: { enabled: true, minWidth: 120 } }),
		Table.configure({ resizable: true }),
		TableRow,
		TableHeader,
		TableCell,
		TaskListWithCheckboxes,
		TaskItemWithCheckboxes.configure({ nested: true }),
		CodeBlockLowlight.configure({ lowlight }),
		Highlight,
		STRIKE_KEY,
		// An empty page says what to do with it. The words live in the engine rather than in `surface.css`, so the one
		// place that draws the hint also owns its text.
		Placeholder.configure({ placeholder: 'Start writing, or press Ctrl+V to paste from an application.' }),
	];
}

/**
 * The editor, for as long as the surface lives.
 *
 * `null` while Tiptap creates it: the document can arrive before that, which is the mount's problem, not this one.
 */
export function usePageDocument(options: PageDocumentOptions): Editor | null {
	const { onChange, onPasteImage } = options;
	return useEditor({
		extensions: extensions(),
		content: '',
		editorProps: {
			attributes: { class: 'page-surface__doc', 'aria-label': 'Page' },
			handlePaste: (_view, event) => {
				const item = Array.from(event.clipboardData?.items ?? []).find(entry => entry.type.startsWith('image/'));
				const file = item?.getAsFile() ?? null;
				if (file === null) {
					return false;
				}
				onPasteImage(file);
				return true;
			},
		},
		onUpdate: ({ editor }) => onChange(editor),
	});
}

/** The engine's types, for the mount. Nothing else may import a Tiptap package. */
export type { ListKind, Mark, Match, PageActions, PageState } from '../../contract';
