/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Temco Controls. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// *Temco Learn* — the readings its surfaces share.
//
// There used to be a webview panel here drawing a second Learn home page. The panel is a native tree now
// (`learnTree.ts`), and its front door is the Learn page (`learnPages.ts`), so what is left here is the handful of
// readings both of them need: the catalog facts, the words for an artifact's kind, and how long ago a build was.
// It reads the same catalog rows as Build Center and Publish & Releases rather than keeping a second record — a page
// that says "3 outputs" is wrong the moment a build writes a fourth, and a second copy of the truth is how that
// happens.

import * as vscode from 'vscode';
import { Catalog, ReleaseRow, selection } from './store';

/** One file a build left. */
interface Artifact {
	kind: string;
	path: string;
	builtAt: string;
}

export interface LearnFacts {
	project?: string;
	pages: number;
	releases: ReleaseRow[];
	artifacts: Artifact[];
}

/** The words for an artifact's kind, in the order a build produces them. */
export function kindLabel(kind: string): string {
	return kind === 'chm' ? 'Offline help (CHM)' : kind === 'pdf' ? 'PDF' : kind === 'site' ? 'Website' : kind === 'search' ? 'Search index' : kind;
}

/** When something happened, in the words a person uses. */
export function since(iso: string | undefined): string {
	if (iso === undefined) {
		return 'never';
	}
	const then = Date.parse(iso);
	if (Number.isNaN(then)) {
		return iso;
	}
	const minutes = Math.floor((Date.now() - then) / 60_000);
	if (minutes < 1) {
		return 'just now';
	}
	if (minutes < 60) {
		return `${minutes} min ago`;
	}
	const hours = Math.floor(minutes / 60);
	if (hours < 24) {
		return `${hours} h ago`;
	}
	const days = Math.floor(hours / 24);
	return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** What the catalog knows: the project on screen, its releases, the files they left, and how many pages there are. */
export async function facts(context: vscode.ExtensionContext): Promise<LearnFacts> {
	let catalog: Catalog | undefined;
	try {
		catalog = await Catalog.open(context);
		const documents = catalog.documents();
		const slug = selection.project() ?? (documents.length === 1 ? documents[0].slug : undefined);
		if (slug === undefined) {
			return { pages: 0, releases: [], artifacts: [] };
		}
		return {
			project: documents.find((document) => document.slug === slug)?.name ?? slug,
			pages: catalog.documentPages(slug).length,
			releases: catalog.releases(slug),
			artifacts: catalog.documentArtifacts(slug)
		};
	} catch {
		// No catalog, nothing learned: the page says so rather than showing a sample.
		return { pages: 0, releases: [], artifacts: [] };
	} finally {
		catalog?.close();
	}
}