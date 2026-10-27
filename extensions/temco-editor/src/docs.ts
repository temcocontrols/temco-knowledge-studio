// What the editor asks of the documentation module.
//
// An extension cannot import another extension's sources, so the shape is spelled twice: `temco-docs/src/api.ts` is the
// definition and this file is the copy. The two agree by hand, and a change there is a change here.
//
// Only what a page needs to be written is here. The editor reads and writes *one file*; it never asks which sets are
// open, which project is selected, or what the tree is showing — that is the documentation module's model, and lending it
// out would make two modules responsible for the same answer.

import * as vscode from 'vscode';

/** The module whose model this file borrows. Declared in `extensionDependencies`, so it is active before this one. */
const DOCS_ID = 'temcocontrols.temco-docs';

/** An image that landed beside a page: the address the Markdown must hold, and the words that describe it. */
export interface LandedImage {
	/** Relative to the page, which is what the build resolves. */
	relative: string;
	/** The caption, or the page's own name when there was none. */
	alt: string;
	/** A sentence to show the person if the picture is fine but not ideal. */
	warning?: string;
}

/** A page in the set the file being edited belongs to. */
export interface LinkablePage {
	title: string;
	id: string;
	fsPath: string;
}

export interface TemcoDocsApi {
	/**
	 * Writes one image into the page's `media/` folder and records what it shows.
	 *
	 * The conversion to a page-relative address, the file name, the attachment record and the version the picture
	 * applies to all belong to the module that owns the page tree — the editor only supplies the bytes and the caption.
	 */
	landImage(
		pageFsPath: string,
		bytes: Uint8Array,
		fallbackExtension: string,
		caption: string
	): Promise<LandedImage | { error: string }>;
	/** Records the words for an image that landed without them. Words only; nothing moves. */
	setCaption(pageFsPath: string, name: string, caption: string): Promise<void>;
	/** The pages of the set this file is in, for a link a relative path can reach. Empty when the file is in no set. */
	pagesNear(pageFsPath: string): LinkablePage[];
}

/**
 * The documentation module's model.
 *
 * `extensionDependencies` puts its `activate()` ahead of this module's, so its exports exist by the time a page is opened.
 * The error is still worth naming: a module that cannot reach the one it depends on should say which, rather than fail
 * later on a page that silently will not save an image.
 */
export function docsApi(): TemcoDocsApi {
	const api = vscode.extensions.getExtension(DOCS_ID)?.exports as TemcoDocsApi | undefined;
	if (api === undefined) {
		throw new Error(`the documentation module (${DOCS_ID}) did not publish its model`);
	}
	return api;
}
