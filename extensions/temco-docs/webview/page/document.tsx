// The engine seam: everything Tiptap knows, and nothing the bar or the mount has to know.
//
// The bar asks for named operations ("make this a heading", "toggle bold", "insert this picture") and reads a snapshot of
// what is true at the caret. It never sees an `Editor`, a `chain()`, or a ProseMirror position it has to understand — so a
// different engine, or a read-only viewer, can be put behind this interface without touching the ribbon, and the ribbon can
// be re-skinned without touching the engine.
//
// What the engine must guarantee, because the file is Markdown: a paragraph is a paragraph (no re-wrapping on save), a
// heading is a level, and everything emitted is something `src/pageMarkdown.ts` can write back.

import * as React from 'react';
import { EditorContent, useEditor, type Editor, type Extensions } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table/row';
import { TableHeader } from '@tiptap/extension-table/header';
import { TableCell } from '@tiptap/extension-table/cell';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import { common, createLowlight } from 'lowlight';

const lowlight = createLowlight(common);

/** A heading, as the outline needs it: the words, how deep, and where the document puts it. */
export interface HeadingAt {
	level: number;
	text: string;
	at: number;
}

/** A match, as a document position pair. */
export interface Match {
	from: number;
	to: number;
}

/** The marks and blocks a page can hold — the whole vocabulary of the bar, and the whole of what Markdown can carry. */
export type Mark = 'bold' | 'italic' | 'underline' | 'strike' | 'code' | 'highlight';
export type ListKind = 'bullet' | 'ordered' | 'task';

/** What is true at the caret, read once per change and handed to the bar as data. */
export interface PageState {
	block: number;
	marks: Record<Mark, boolean>;
	lists: Record<ListKind, boolean>;
	inTable: boolean;
	onImage: boolean;
	link: string | undefined;
	canUndo: boolean;
	canRedo: boolean;
	words: number;
	/** Where the caret is. The outline needs it to say which section the page is being written in. */
	cursor: number;
}

/** What the bar can ask the engine to do. Named operations only: no command strings, no chaining. */
export interface PageActions {
	setBlock(level: number): void;
	toggleMark(mark: Mark): void;
	toggleList(kind: ListKind): void;
	toggleQuote(): void;
	toggleCodeBlock(): void;
	horizontalRule(): void;
	undo(): void;
	redo(): void;
	setLink(href: string): void;
	unsetLink(): void;
	insertTable(): void;
	addRow(): void;
	addColumn(): void;
	deleteRow(): void;
	deleteColumn(): void;
	deleteTable(): void;
	insertImage(src: string, alt: string): void;
	/** Replaces the image at `at`; false when there is no image there any more. */
	replaceImage(at: number, src: string, alt: string): boolean;
	insertLinkText(title: string, href: string): void;
	/** Where the selection starts — what an annotation has to replace when the picture comes back. */
	selectionStart(): number;
	goto(from: number, to?: number): void;
	content(): string;
	load(html: string): void;
	/** The engine's own content element, so the shell does not build one. */
	node(): React.ReactElement;
}

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

/** The named operations, over one editor. Every one of them focuses first, so a click on the bar acts on the page. */
export function actionsFor(editor: Editor): PageActions {
	const chain = (): ReturnType<Editor['chain']> => editor.chain().focus();
	return {
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
		selectionStart: () => editor.state.selection.from,
		goto: (from, to) => {
			chain().setTextSelection({ from, to: to ?? from }).scrollIntoView().run();
		},
		content: () => editor.getHTML(),
		load: html => {
			editor.commands.setContent(html, { emitUpdate: false });
		},
		node: () => <EditorContent editor={editor} />,
	};
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
		TaskList,
		TaskItem.configure({ nested: true }),
		CodeBlockLowlight.configure({ lowlight }),
		Highlight,
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
