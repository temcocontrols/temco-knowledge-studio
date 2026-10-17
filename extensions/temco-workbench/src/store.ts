// What this module reads of the store.
//
// The Library lists projects and sources from the platform's memory, and the dashboard counts them. That memory
// is a *different extension*: `Catalog.open(context)` accepts the context it is handed and ignores it — the file
// is the store's, and a caller's own storage would be an empty database beside its own code.
//
// Why the shapes are written out: an extension cannot import another extension's sources. The definition is
// `extensions/temco-store/src/catalog/store.ts` and `extensions/temco-store/src/api.ts`. The store is a declared
// dependency, so it is activated before this module's entry runs.

import * as vscode from 'vscode';

/** The store module, by the id its manifest declares. */
const STORE_EXTENSION_ID = 'temcocontrols.temco-store';

/** The store's exports — the copy of `extensions/temco-store/src/api.ts`. */
interface StoreApi {
	catalog(): Promise<Catalog>;
	readonly CatalogUnavailable: new (...args: never[]) => Error;
	readonly selection: Selection;
	slugOf(text: string): string;
}

const extension = vscode.extensions.getExtension<StoreApi>(STORE_EXTENSION_ID);
if (extension === undefined || !extension.isActive) {
	throw new Error('The Temco Store module is not available.');
}

const store = extension.exports;

/** The platform's database, opened with the store's storage. The argument is accepted and ignored. */
export const Catalog = {
	open: (_context?: vscode.ExtensionContext): Promise<Catalog> => store.catalog(),
};

/** The error `Catalog.open` throws when this editor has no `node:sqlite`. */
export const CatalogUnavailable = store.CatalogUnavailable;

/** Which project the window is on, and the page it last opened from it. */
export type Selection = SelectionShape;

/** The slug a name gets, as the database keys it. */
export const slugOf = store.slugOf;

/** The one selection instance for this window, published by the store so every module shares it. */
export const selection = store.selection;

/** The store's own selection shape — the copy of `extensions/temco-store/src/selection.ts`. */
interface SelectionShape {
	onDidChange(listener: () => void): vscode.Disposable;
	project(): string | undefined;
	page(): { project: string; id: string; title: string; path?: string } | undefined;
	select(slug: string | undefined): Promise<void>;
	rememberPage(page: { project: string; id: string; title: string; path?: string } | undefined): Promise<void>;
}

/** A row of the projects list. */
export interface DocumentRow {
	name: string;
	version?: string;
	sources: number;
	builtAt?: string;
}

/** A row of the sources list. */
export interface SourceRow {
	id: number;
	slug: string;
	name: string;
	kind: string;
	branch?: string;
	pages?: number;
	state?: string;
	lastReadMode?: string;
}

/** A project as a list reads it back. */
export interface DocumentDetail {
	name: string;
	version?: string;
	audience?: string;
	owner?: string;
	engine?: string;
	outputs: string[];
	sources: { name: string; kind: string; branch?: string }[];
}

/** A page as a read found it. */
export interface PageRow {
	id: string;
	path?: string;
	title?: string;
	owner?: string;
}

/** The platform's database, as this module uses it — the copy of `Catalog` in the store. */
export interface Catalog {
	readonly file: vscode.Uri;
	counts(): [string, number][];
	schemaVersion(): number;
	unseenEvents(): number;
	documents(): DocumentRow[];
	sources(): SourceRow[];
	document(slug: string): DocumentDetail | undefined;
	documentSources(documentSlug: string): { name: string; kind: string; branch?: string }[];
	documentPages(documentSlug: string): (PageRow & { source: string })[];
	documentArtifacts(documentSlug: string): { kind: string; path: string; builtAt: string }[];
	pagesFor(sourceId: number): PageRow[];
	close(): void;
}
