// What this module reads of the store.
//
// The store is a *different extension*: the platform's own memory, which this module neither owns nor opens with
// its own storage. Everything else here says exactly what the module said before the split — `Catalog.open`,
// the same `Catalog` shape, the same `CatalogUnavailable`, the same selection, the same slug rule — so a call
// site reads as it always did and only the import moved.
//
// Why the shapes are written out: an extension cannot import another extension's sources. This is the copy; the
// definition is `extensions/temco-store/src/catalog/store.ts` and `extensions/temco-store/src/api.ts`, and a
// change there is a change here.
//
// The store is a declared dependency (`extensionDependencies` in this module's manifest), so it is activated
// before this module's own entry runs and the exports are there when this file is evaluated.

import * as vscode from 'vscode';

/** The store module, by the id its manifest declares. */
const STORE_EXTENSION_ID = 'temcocontrols.temco-store';

/** The store's exports — the copy of `extensions/temco-store/src/api.ts`. */
interface StoreApi {
	available(): boolean;
	catalog(): Promise<Catalog>;
	readonly selection: Selection;
	slugOf(text: string): string;
}

const extension = vscode.extensions.getExtension<StoreApi>(STORE_EXTENSION_ID);
if (extension === undefined || !extension.isActive) {
	throw new Error('The Temco Store module is not available.');
}

const store = extension.exports;

/**
 * The platform's database, opened with the *store's* storage.
 *
 * The argument is accepted and ignored: a dozen call sites pass the extension context they happen to hold, and it
 * must not be used — a caller's own `globalStorageUri` is a different, empty database beside its own code.
 */
export const Catalog = {
	open: (_context?: vscode.ExtensionContext): Promise<Catalog> => store.catalog(),
};

/** Which project the window is on, and the page it last opened from it. */
export type Selection = SelectionShape;

/** The slug a name gets, as the database keys it. */
export const slugOf = store.slugOf;

/** The one selection instance for this window, published by the store so every module shares it. */
export const selection = store.selection;

/** The page the platform last opened from the selected project. */
export interface RememberedPage {
	project: string;
	id: string;
	title: string;
	path?: string;
}

/** The store's own selection shape — the copy of `extensions/temco-store/src/selection.ts`. */
interface SelectionShape {
	onDidChange(listener: () => void): vscode.Disposable;
	project(): string | undefined;
	page(): RememberedPage | undefined;
	select(slug: string | undefined): Promise<void>;
	rememberPage(page: RememberedPage | undefined): Promise<void>;
}

/** What `createDocument` needs. */
export interface DocumentInput {
	name: string;
	slug: string;
	version?: string;
	audience?: string;
	owner?: string;
}

/** A document as the edit page sees it. */
export interface DocumentDetail {
	name: string;
	version?: string;
	audience?: string;
	owner?: string;
	engine?: string;
	outputs: string[];
	sources: { name: string; kind: string; branch?: string }[];
}

/** A source's coordinates, as a read needs them. */
export interface SourceDetail {
	id: number;
	kind: 'git' | 'folder' | 'archive';
	name: string;
	remoteUrl?: string;
	path?: string;
	branch?: string;
	defaultBranch?: string;
	docsRoot?: string;
	registryPath?: string;
}

/** A page as a read found it — enough for a tree, and nothing invented. */
export interface PageInput {
	id: string;
	path?: string;
	title?: string;
	owner?: string;
	counts?: Record<string, number>;
}

/** A page as a tree reads it back. */
export interface PageRow {
	id: string;
	path?: string;
	title?: string;
	owner?: string;
}

/** What `addSource` needs. Everything optional is genuinely optional: a folder has no branch. */
export interface SourceInput {
	kind: 'git' | 'folder' | 'archive';
	name: string;
	slug: string;
	remoteUrl?: string;
	path?: string;
	defaultBranch?: string;
	branch?: string;
	docsRoot?: string;
	registryPath?: string;
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
	/** What the last read concluded, in one line. */
	state?: string;
	lastReadMode?: string;
}

/** The platform's database, as this module uses it — the copy of `Catalog` in the store. */
export interface Catalog {
	/** Where the file is. */
	readonly file: vscode.Uri;
	counts(): [string, number][];
	schemaVersion(): number;
	documents(): DocumentRow[];
	sources(): SourceRow[];
	unseenEvents(): number;
	addSource(source: SourceInput): number;
	removeSource(slug: string): void;
	recordScan(sourceId: number, mode: string, revision: string | undefined, counts: unknown): void;
	createDocument(document: DocumentInput): number;
	attachSource(documentSlug: string, sourceSlug: string, role?: string): void;
	documentSourceSlugs(documentSlug: string): string[];
	setDocumentSources(documentSlug: string, sourceSlugs: readonly string[]): void;
	documentSources(documentSlug: string): { name: string; kind: string; branch?: string }[];
	documentArtifacts(documentSlug: string): { kind: string; path: string; builtAt: string }[];
	documentPages(documentSlug: string): (PageRow & { source: string })[];
	startBuild(documentSlug: string, revision?: string): number;
	finishBuild(buildId: number, status: string): void;
	recordArtifact(
		documentSlug: string,
		artifact: { kind: string; path: string; bytes?: number; buildId?: number }
	): void;
	document(slug: string): DocumentDetail | undefined;
	setRecipe(slug: string, engine: string, outputs: string[]): void;
	deleteDocument(slug: string): void;
	source(slug: string): SourceDetail | undefined;
	setSourceBranch(slug: string, branch: string | undefined): void;
	setSourcePath(slug: string, path: string | undefined): void;
	setSourceState(
		slug: string,
		state: { pages?: number; docsRoot?: string; registryPath?: string; state?: string }
	): void;
	replacePages(sourceId: number, pages: PageInput[]): void;
	pagesFor(sourceId: number): PageRow[];
	close(): void;
}
