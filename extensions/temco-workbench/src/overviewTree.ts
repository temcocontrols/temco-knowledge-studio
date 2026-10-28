/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// The Home panel's Overview: the platform's facts as rows, each opening the page behind it.
//
// Five rows, and every number in them is one this window can attest to: the projects the catalog holds, the pages the
// sets in front declare, the sources they read, what is waiting for a person, and the last version published. A number
// that cannot be read says so — the row is drawn with a dash rather than with a zero nothing measured.

import * as vscode from 'vscode';
import { roots, totals } from './docs';
import { Catalog, selection } from './store';

const COUNT_SCHEME = 'temco-workbench-count';

/** The row the facts hang under. */
interface RootNode extends vscode.TreeItem {
	isRoot?: boolean;
}

/** The number, as the badge a row pushes to its right edge — a tree item's description would sit beside the label. */
function badge(text: string, key: string): vscode.Uri {
	return vscode.Uri.parse(`${COUNT_SCHEME}:/${encodeURIComponent(text)}/${encodeURIComponent(key)}`);
}

export class OverviewTree implements vscode.TreeDataProvider<vscode.TreeItem> {
	private readonly changed = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.changed.event;

	constructor(private readonly context: vscode.ExtensionContext) {
		context.subscriptions.push(
			vscode.window.registerFileDecorationProvider({
				provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
					if (uri.scheme !== COUNT_SCHEME) {
						return undefined;
					}
					const text = decodeURIComponent(uri.path.split('/')[1] ?? '');
					return text.length === 0 ? undefined : { badge: text, tooltip: text };
				},
			})
		);
	}

	refresh(): void {
		this.changed.fire();
	}

	getTreeItem(item: vscode.TreeItem): vscode.TreeItem {
		return item;
	}

	async getChildren(item?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
		if (item !== undefined) {
			return (item as RootNode).isRoot === true ? this.facts() : [];
		}
		return [this.root()];
	}

	/**
	 * The one row everything else hangs under.
	 *
	 * It exists for two reasons: the five numbers are facts about *this window*, and a list needs a subject; and a tree
	 * indents a child by a level, which is the only left margin a native tree row has to give.
	 */
	private root(): RootNode {
		const item: RootNode = new vscode.TreeItem('Temco Platform', vscode.TreeItemCollapsibleState.Expanded);
		item.isRoot = true;
		item.id = 'temcoWorkbench.overview.root';
		item.iconPath = new vscode.ThemeIcon('folder-library');
		item.tooltip = 'What this window holds';
		item.command = { command: 'temcoWorkbench.overview', title: 'Overview' };
		return item;
	}

	private async facts(): Promise<vscode.TreeItem[]> {
		const counted = totals(roots());
		let projects: number | undefined;
		let waiting: number | undefined;
		let published: string | undefined;
		let catalog: Catalog | undefined;
		try {
			catalog = await Catalog.open(this.context);
			const documents = catalog.documents();
			projects = documents.length;
			// The window's project, or the only one there is: a lone author never picks a project, and a queue that
			// ignored their drafts would be the one row on this panel that lies.
			const current = selection.project() ?? (documents.length === 1 ? documents[0].slug : undefined);
			if (current !== undefined) {
				waiting = catalog.drafts(current).length;
				published = catalog.releases(current)[0]?.version;
			}
		} catch {
			// A catalog that cannot be read leaves the two rows it feeds empty rather than wrong.
		} finally {
			catalog?.close();
		}

		const row = (label: string, value: string, icon: string, command?: vscode.Command): vscode.TreeItem => {
			const entry = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
			entry.iconPath = new vscode.ThemeIcon(icon);
			entry.tooltip = `${label} — ${value}`;
			// The one slot a row pushes to its right edge: the number, at the end of the row and not beside the label.
			entry.resourceUri = badge(value, label);
			if (command !== undefined) {
				entry.command = command;
			}
			return entry;
		};

		return [
			row('Projects', projects === undefined ? '—' : String(projects), 'folder-library', { command: 'temcoProjects.projectsPage', title: 'Projects' }),
			row('Pages', String(counted.pages), 'book', { command: 'temcoDocs.pages.focus', title: 'Show the Pages' }),
			row('Needs review', String(counted.neverReviewed + (waiting ?? 0)), 'check', { command: 'temcoDocs.review', title: 'Review Center' }),
			row('Last release', published ?? 'never', 'cloud-upload', { command: 'temcoDocs.releases', title: 'Releases' })
		];
	}
}
