// What this module offers the rest of the platform.
//
// The documentation module publishes its model rather than letting another module read its folders: the sets it
// is reading, the pages of a set, the page a file belongs to, the editor column its surfaces open in, and the
// selection — the one piece of state the whole application agrees on. The AI module is the caller today, and it
// declares this extension as a dependency so that these exports exist before its own `activate()` runs.
//
// The shapes are spelled twice, once here and once in the caller: an extension cannot import another
// extension's sources. This file is the definition; the caller's `src/docs.ts` is the copy, and a change here is
// a change there.

import * as vscode from 'vscode';
import { Counts, DocsRoot, PageEntry } from './registry';
import { Selection } from './store';

export interface TemcoDocsApi {
	/** The documentation sets being read. */
	roots(): readonly DocsRoot[];
	/** Every page of a set, in reading order. */
	collectPages(root: DocsRoot): PageEntry[];
	/** How many of these pages the generator says are stale. */
	countStale(pages: readonly PageEntry[]): number;
	/** The sums over the sets: pages, issues, errors, warnings, never reviewed, unshipped. */
	totals(roots: readonly DocsRoot[]): Counts;
	/** The page a file belongs to, in any of the sets. */
	pageForUri(roots: readonly DocsRoot[], uri: vscode.Uri): PageEntry | undefined;
	/** Which of the repository's own scripts the folders being read carry. */
	scriptsIn(roots: readonly DocsRoot[]): Set<string>;
	/** The project and page the window is on. */
	selection: Selection;
	/** The editor column a documentation surface opens in. */
	pageColumn(): vscode.ViewColumn;
	/** Re-reads the sets. What a refresh button anywhere in the application ends up asking for. */
	refresh(): Promise<void>;
	/** Fires when the sets are re-read: a page added, a project selected, a registry changed. */
	onDidChange(listener: () => void): vscode.Disposable;
}
