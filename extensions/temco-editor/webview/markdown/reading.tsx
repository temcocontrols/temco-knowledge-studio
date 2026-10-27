// Reading: the same page, with no engine at all.
//
// This file exists to prove the seam. It is a second implementation of `PageActions` — one that cannot edit, because there
// is no editor behind it — plus the one method the shell actually needs in that mode: `node()`. The bar, the outline, the
// find bar and the status strip are the same React components, handed a different object.
//
// What it is for is real, not a demonstration: a page being read should not be a page being one keystroke from changing. In
// Read mode the document is plain markup, so there is nothing to focus, nothing to type into, and no undo history to get
// lost in — the arrangement every document application calls Read Mode.
//
// The markup is the editor's own `getHTML()`, produced by our schema, so it needs no sanitising beyond that: nothing here
// accepts HTML from a file or from the network.

import * as React from 'react';
import type { PageActions } from './document';

/** The document as markup, in the same box the editor would use — so the typography and the measure do not change. */
export function staticNode(html: string): React.ReactElement {
	return <div className="page-surface__doc page-surface__doc--reading" dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * The page in Read mode.
 *
 * Every operation is a no-op rather than an error: the bar is still drawn, so a reader can press a button and get nothing
 * instead of getting a crash — and the shell needs no branch of its own to know which mode it is in.
 */
export const READING_ACTIONS: PageActions = {
	setBlock: () => undefined,
	toggleMark: () => undefined,
	toggleList: () => undefined,
	toggleQuote: () => undefined,
	toggleCodeBlock: () => undefined,
	horizontalRule: () => undefined,
	undo: () => undefined,
	redo: () => undefined,
	setLink: () => undefined,
	unsetLink: () => undefined,
	insertTable: () => undefined,
	addRow: () => undefined,
	addColumn: () => undefined,
	deleteRow: () => undefined,
	deleteColumn: () => undefined,
	deleteTable: () => undefined,
	insertImage: () => undefined,
	replaceImage: () => false,
	insertLinkText: () => undefined,
	selectionStart: () => 0,
	goto: () => undefined,
	content: () => '',
	load: () => undefined,
	node: () => <div className="page-surface__doc page-surface__doc--reading" />,
};
