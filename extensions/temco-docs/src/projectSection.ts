// The Project section of the Documentation panel: what the project in front is *made of*.
//
// The tree above it answers "which page"; this answers "which sources, and what does it produce" — the two facts a
// person needs before a build, and the two the pipeline rows beside them act on. It reads the roots the module has
// already loaded, so it never opens the catalog a second time and never disagrees with the tree.

import * as vscode from 'vscode';
import { DocsRoot } from './registry';

export class ProjectSection implements vscode.TreeDataProvider<vscode.TreeItem> {
	private readonly changed = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.changed.event;

	constructor(private readonly roots: () => readonly DocsRoot[]) { }

	refresh(): void {
		this.changed.fire();
	}

	getTreeItem(item: vscode.TreeItem): vscode.TreeItem {
		return item;
	}

	getChildren(item?: vscode.TreeItem): vscode.TreeItem[] {
		const roots = this.roots();
		if (item !== undefined) {
			// The branch is open: one row per source, which is what a build reads.
			return roots.map((root) => {
				const row = new vscode.TreeItem(root.folder.name, vscode.TreeItemCollapsibleState.None);
				row.iconPath = new vscode.ThemeIcon(root.origin === 'catalog' ? 'cloud' : 'folder');
				row.description = `${root.pages} pages${root.origin === 'catalog' ? ' · read from the remote' : ''}`;
				row.tooltip = root.folder.uri.fsPath;
				row.command = {
					command: 'temcoDocs.source',
					title: root.folder.name,
					arguments: [root.folder.name],
				};
				return row;
			});
		}

		const sources = new vscode.TreeItem(
			'Sources',
			roots.length === 0 ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed
		);
		sources.iconPath = new vscode.ThemeIcon('library');
		sources.description = String(roots.length);
		sources.tooltip = 'What this project cites. A source is a folder on this machine, or one read over the API.';
		if (roots.length === 0) {
			sources.command = { command: 'temcoProjects.addSource', title: 'Add a Source' };
		}

		const outputs = new vscode.TreeItem('Outputs', vscode.TreeItemCollapsibleState.None);
		outputs.iconPath = new vscode.ThemeIcon('package');
		outputs.description = 'Site · Offline help';
		outputs.tooltip = 'What this project produces, and where. Editing this is the project form.';
		outputs.command = { command: 'temcoProjects.editProject', title: 'Edit the Project' };

		return [sources, outputs];
	}
}
