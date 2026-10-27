// The contract between the surface and whichever engine draws the page.
//
// The bar asks for named operations ("make this a heading", "toggle bold", "insert this picture") and reads a snapshot of
// what is true at the caret. It never sees an `Editor`, a `chain()`, or a ProseMirror position it has to understand — so a
// different engine, or a read-only viewer, can be put behind this interface without touching the ribbon, and the ribbon can
// be re-skinned without touching the engine.
//
// Nothing here imports a package: this file is the whole of what the surface knows about the engine, and `engine/` is the
// only folder allowed to know more. Every caller imports `./contract`, so splitting it into a folder later changes no
// import.

import type * as React from 'react';

/** A heading, as the outline needs it: the words, how deep, and where the document puts it. */
export type { HeadingAt } from '../../src/outlineModel';

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
	/** The engine's own content element, with whatever the engine draws around it. So the shell does not build one. */
	node(): React.ReactElement;
}
