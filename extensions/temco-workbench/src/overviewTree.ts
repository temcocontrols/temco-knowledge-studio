// The Dashboard's Overview: the facts a person checks before a build, one row each, and every row opens the page
// behind it.
//
// It is deliberately a *tree of facts* rather than another list of links: the number is the row's description, so
// the panel answers "how much" without opening anything, and a click answers "where". Nothing here is stored — the
// counts are the documentation module's own (`totals`, `countStale`), read when the row is drawn.

import * as vscode from 'vscode';
import { collectPages, countStale, roots, totals } from './docs';

export class OverviewTree implements vscode.TreeDataProvider<vscode.TreeItem> {
	private readonly changed = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.changed.event;

	refresh(): void {
		this.changed.fire();
	}

	getTreeItem(item: vscode.TreeItem): vscode.TreeItem {
		return item;
	}

	getChildren(): vscode.TreeItem[] {
		const sets = roots();
		const sum = totals(sets);
		const pages = sets.flatMap((root) => collectPages(root));
		const stale = countStale(pages);
		const reviewed = sum.pages - sum.neverReviewed;

		const row = (label: string, value: string, icon: string, command: string, tooltip: string, args?: unknown[]): vscode.TreeItem => {
			const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
			item.iconPath = new vscode.ThemeIcon(icon);
			item.description = value;
			item.tooltip = `${label} — ${tooltip}`;
			item.command = { command, title: label, arguments: args };
			return item;
		};

		if (sets.length === 0) {
			const empty = new vscode.TreeItem('Nothing is being read', vscode.TreeItemCollapsibleState.None);
			empty.iconPath = new vscode.ThemeIcon('info');
			empty.description = 'open a project first';
			empty.command = { command: 'temcoProjects.projects.focus', title: 'Projects' };
			return [empty];
		}

		return [
			row('Pages', String(sum.pages), 'files', 'temcoDocs.pages.focus', 'every page the registries declare'),
			row('Reviewed', String(reviewed), 'check', 'temcoDocs.stalenessReport', 'pages with a review date'),
			row('Stale', String(stale), 'warning', 'temcoDocs.stalenessReport', 'the code a page claims has moved since its review'),
			row('Issues', `${sum.errors} · ${sum.warnings}`, 'error', 'temcoDocs.validate', 'errors · warnings in the registry itself'),
			row('Sources', String(sets.length), 'library', 'temcoDocs.overview', 'the folders this project reads'),
			row('Outputs', 'Site · help', 'package', 'temcoProjects.editProject', 'what this project produces'),
			row('Build', 'Build Center', 'play', 'temcoDocs.builds', 'the last build, and the acts that make a new one'),
		];
	}
}
