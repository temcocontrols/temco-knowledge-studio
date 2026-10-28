/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Temco Controls. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Page properties — what the registry says about the page in front.
//
// It is a read-only sheet. The registry file is the single place a value is written — the generator reads it, the
// moves and renames write it — and a form here could only ever disagree with that file after the next run. So the
// sheet shows the curated entry *beside the page it describes*, which is the one thing about a page that nothing else
// in the window shows, and offers the two ways to change it: the registry, and the page itself.

import * as vscode from 'vscode';
import { DocsRoot, PageEntry, collectPages } from './registry';
import { RegistryEdit } from './registryEdit';

/** One line of the sheet: a name, what the registry holds for it (`''` when it says nothing), and what it means. */
export interface PropertyRow {
	label: string;
	value: string;
	hint: string;
}

/** The page whose file is in front, and the root it belongs to. */
interface Located {
	root: DocsRoot;
	entry: PageEntry;
}

/** The registry entry of the page whose file is `uri`, and the root it came from. */
export function locate(roots: readonly DocsRoot[], uri: vscode.Uri): Located | undefined {
	const wanted = uri.toString();
	for (const root of roots) {
		const entry = collectPages(root).find((page) => page.uri.toString() === wanted);
		if (entry !== undefined) {
			return { root, entry };
		}
	}
	return undefined;
}

/**
 * The curated values, in the order a person reads them.
 *
 * A row nobody curated starts from what the tree already knows, so an empty line means "not curated", never
 * "not known".
 */
export function describe(edit: RegistryEdit, entry: PageEntry): PropertyRow[] {
	const raw = edit.entry(entry.id) ?? {};
	const text = (key: string, fallback: string): string => {
		const value = raw[key];
		return typeof value === 'string' ? value : fallback;
	};
	const list = (key: string, fallback: readonly string[]): string => {
		const value = raw[key];
		const items = Array.isArray(value) ? value.map((item) => String(item)) : fallback;
		return items.length > 0 ? items.join(', ') : '';
	};

	return [
		{ label: 'Owner', value: text('owner', entry.owner), hint: 'Who answers for this page. A person keeping the page true is the only thing that keeps it true.' },
		{ label: 'Keywords', value: list('keywords', entry.keywords), hint: 'What a reader types to find this page. It feeds the search index, in the writer\u2019s own words.' },
		{ label: 'Tags', value: list('tags', entry.tags), hint: 'Facets shared with other pages, so a search can narrow to a set of topics rather than one page.' },
		{ label: 'Help context IDs', value: list('help_ids', []), hint: 'The IDs the application passes when somebody presses Help. This is how a screen finds this page.' }
	];
}

/** Where the registry puts the page. Shown, never typed: a move writes these, not a person. */
export function placement(entry: PageEntry): PropertyRow[] {
	return [
		{ label: 'Area', value: entry.area, hint: 'The part of the help this page lives in. Moving the page between areas is what changes it.' },
		{ label: 'Chapter', value: entry.chapter, hint: 'The page\u2019s home inside its area, and the group it is listed under in the tree.' },
		{ label: 'Last reviewed', value: entry.reviewed ?? '', hint: 'The date somebody last read the page against the product and said it was still right.' }
	];
}
