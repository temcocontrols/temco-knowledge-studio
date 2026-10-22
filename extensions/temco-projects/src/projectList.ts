// The Dashboard's project list.
//
// It is a list, not an editor: one row per project, and two inline actions on every row — **edit the pages** (which
// makes the project the one being worked on and shows the Documentation panel) and **show the project** (which brings
// that panel's Project section forward). Everything a project *is* stays on its own form, because a row that grows a
// second line of state stops being scannable.

import * as vscode from 'vscode';
import { Catalog, selection } from './store';

export class ProjectList implements vscode.TreeDataProvider<vscode.TreeItem> {
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
		let catalog: Catalog | undefined;
		try {
			catalog = await Catalog.open(this.context);
			const rows = catalog.documents();
			const current = selection.project();
			if (rows.length === 0) {
				const empty = new vscode.TreeItem('No project yet', vscode.TreeItemCollapsibleState.None);
				empty.iconPath = new vscode.ThemeIcon('plus');
				empty.description = 'create one to start';
				empty.tooltip = 'A project is what a documentation set is managed as: it cites sources and produces a site.';
				empty.command = { command: 'temcoProjects.newProject', title: 'New Project' };
				return [empty];
			}
			return rows.map((row) => {
				const project = new vscode.TreeItem(row.name, vscode.TreeItemCollapsibleState.None);
				project.iconPath = new vscode.ThemeIcon(row.slug === current ? 'folder-active' : 'folder-library');
				project.description = [
					`${row.sources} source${row.sources === 1 ? '' : 's'}`,
					row.builtAt === undefined ? 'never built' : `built ${row.builtAt}`,
					row.slug === current ? 'current' : '',
				].filter((part) => part.length > 0).join(' · ');
				project.tooltip = `${row.name}\n${row.slug}${row.origin === undefined ? '' : ` · ${row.origin}`}`;
				project.contextValue = 'project';
				project.command = { command: 'temcoProjects.openProject', title: 'Edit the Pages', arguments: [row.name] };
				return project;
			});
		} catch {
			// A catalog that cannot be opened is not a list of nothing to say: the Dashboard has other rows, and the
			// projects page is where the reason is shown.
			return [];
		} finally {
			catalog?.close();
		}
	}
}
