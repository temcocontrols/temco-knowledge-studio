// What this module reads of the documentation module.
//
// The Library, the dashboard and the needs page all say something about *the documentation being read*: how many
// pages, how many are stale, which of the repository's own scripts a folder carries. That model is the
// documentation module's, and it is published rather than copied — this module asks for it.
//
// Why the shapes are written out: an extension cannot import another extension's sources. The definition is
// `extensions/temco-docs/src/registry.ts` and `extensions/temco-docs/src/api.ts`, and a change there is a change
// here. The documentation module is a declared dependency, so it is activated before this module's entry runs.

import * as vscode from 'vscode';

/** The documentation module, by the id its manifest declares. */
const DOCS_EXTENSION_ID = 'temcocontrols.temco-docs';

/** Something wrong with the shape of the documentation set, not with the prose. */
export interface Issue {
	severity: 'error' | 'warning';
	message: string;
}

/** What the generator knows about a page: its history, its headings, and the code globs it is judged against. */
export interface Provenance {
	git: { author?: string; sha?: string; date?: string } | null;
	updated: string | null;
	stale: boolean;
	headings: string[];
	code: string[];
}

/** One page of a documentation set, as the registry describes it. */
export interface PageEntry {
	id: string;
	title: string;
	area: string;
	chapter: string;
	order: number;
	audience: string;
	ship: boolean;
	owner: string;
	reviewed: string | null;
	tags: string[];
	keywords: string[];
	uri: vscode.Uri;
	exists: boolean;
	issues: Issue[];
	provenance?: Provenance;
	origin?: 'workspace' | 'catalog';
}

/** The counts a set, an area or a chapter carries. */
export interface Counts {
	pages: number;
	issues: number;
	errors: number;
	warnings: number;
	neverReviewed: number;
	unshipped: number;
}

/** A chapter of an area, and the pages in it. */
export interface ChapterGroup {
	chapter: string;
	pages: PageEntry[];
}

/** One area of a documentation set: what a page's id starts with. */
export interface AreaGroup extends Counts {
	area: string;
	title: string;
	audience: string;
	noindex: boolean;
	chapters: ChapterGroup[];
}

/** One documentation set: a folder with a registry, read here or recorded from a source. */
export interface DocsRoot extends Counts {
	folder: vscode.WorkspaceFolder;
	rootUri: vscode.Uri;
	registryUri: vscode.Uri;
	areas: AreaGroup[];
	problems: Issue[];
	origin?: 'workspace' | 'catalog';
}

/** The documentation module's exports — the copy of `extensions/temco-docs/src/api.ts`. */
interface TemcoDocsApi {
	roots(): readonly DocsRoot[];
	collectPages(root: DocsRoot): PageEntry[];
	countStale(pages: readonly PageEntry[]): number;
	totals(roots: readonly DocsRoot[]): Counts;
	scriptsIn(roots: readonly DocsRoot[]): Set<string>;
	refresh(): Promise<void>;
	onDidChange(listener: () => void): vscode.Disposable;
}

const extension = vscode.extensions.getExtension<TemcoDocsApi>(DOCS_EXTENSION_ID);
if (extension === undefined || !extension.isActive) {
	throw new Error('The Temco Docs module is not available.');
}

const docs = extension.exports;

/** The documentation sets being read. */
export function roots(): readonly DocsRoot[] {
	return docs.roots();
}

/** Every page of a set, in reading order. */
export const collectPages = docs.collectPages;

/** How many of these pages the generator says are stale. */
export const countStale = docs.countStale;

/** The sums over the sets. */
export const totals = docs.totals;

/** Which of the repository's own scripts the folders being read carry. */
export const scriptsIn = docs.scriptsIn;

/** Re-reads the sets — what the Library's refresh button ends up asking for. */
export function refresh(): Promise<void> {
	return docs.refresh();
}

/** Fires when the sets were re-read: a page added, a project selected, a registry changed. */
export function onDidChange(listener: () => void): vscode.Disposable {
	return docs.onDidChange(listener);
}
