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

export class OverviewTree implements vscode.TreeDataProvider<vscode.TreeItem> {
	private readonly changed = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.changed.event;

	constructor(private readonly context: vscode.ExtensionContext) { }

	refresh(): void {
		this.changed.fire();
	}

	getTreeItem(item: vscode.TreeItem): vscode.TreeItem {
		return item;
	}

	async getChildren(item?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
		if (item !== undefined) {
			return [];
		}
		const counted = totals(roots());
		const sources = roots().length;
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

		const row = (label: string, description: string, icon: string, command?: vscode.Command): vscode.TreeItem => {
			const entry = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
			entry.description = description;
			entry.iconPath = new vscode.ThemeIcon(icon);
			if (command !== undefined) {
				entry.command = command;
			}
			return entry;
		};

		return [
			row('Projects', projects === undefined ? '—' : String(projects), 'folder-library', { command: 'temcoProjects.projectsPage', title: 'Projects' }),
			row('Pages', String(counted.pages), 'book', { command: 'temcoDocs.pages.focus', title: 'Show the Pages' }),
			row('Sources', String(sources), 'library', { command: 'temcoRepositories.page', title: 'The Repositories' }),
			row('Needs review', String(counted.neverReviewed + (waiting ?? 0)), 'check', { command: 'temcoDocs.review', title: 'Review Center' }),
			row('Last release', published ?? 'never', 'cloud-upload', { command: 'temcoDocs.releases', title: 'Releases' })
		];
	}
}
