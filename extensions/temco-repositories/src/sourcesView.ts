// The Repositories panel: what the platform records, and what can be done to each one.
//
// A repository exists before any project cites it — it is cloned and read here, and a project then points at the
// pages a read recorded. That is why this panel is its own container rather than a group inside Documentation: a
// person can start here, with no project open.
//
// The rows are the catalog's own list. Every action a row offers is this module's (or the documentation module's
// detail page), so nothing is re-implemented here: the panel names what exists and what can be done to it.

import * as vscode from 'vscode';
import { Catalog, SourceRow } from './store';

/** The view the panel draws into. */
export const SOURCES_VIEW_ID = 'temcoRepositories.list';

const MARK: { [kind: string]: string } = { git: 'repo', folder: 'folder', archive: 'package' };

/** One row: the source, its facts, and the page that opens when it is clicked. */
function item(source: SourceRow): vscode.TreeItem {
	const row = new vscode.TreeItem(source.name, vscode.TreeItemCollapsibleState.None);
	row.id = source.slug;
	row.iconPath = new vscode.ThemeIcon(MARK[source.kind] ?? 'package');
	row.contextValue = 'temcoSource';

	const facts = [source.kind === 'git' ? 'repository' : source.kind];
	if (source.branch !== undefined) {
		facts.push(source.branch);
	}
	facts.push(source.pages === undefined || source.pages === 0 ? 'not read' : `${source.pages} ${source.pages === 1 ? 'page' : 'pages'}`);
	if (source.state !== undefined) {
		facts.push(source.state);
	}
	row.description = facts.join(' · ');
	row.tooltip = new vscode.MarkdownString(`**${source.name}**\n\n${facts.join(' · ')}`);

	// A repository opens the page that shows its reads, its scripts and the pages it recorded; a folder or an
	// archive opens where it lives, because there is no clone to describe.
	row.command = {
		command: source.kind === 'git' ? 'temcoDocs.repository' : 'temcoRepositories.revealSource',
		title: source.kind === 'git' ? 'Open the repository' : 'Open where it lives',
		arguments: [source.slug],
	};
	return row;
}

class SourcesView implements vscode.TreeDataProvider<vscode.TreeItem> {
	private readonly changed = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.changed.event;

	constructor(private readonly context: vscode.ExtensionContext) { }

	refresh(): void {
		this.changed.fire();
	}

	getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
		return element;
	}

	async getChildren(): Promise<vscode.TreeItem[]> {
		let catalog: Catalog | undefined;
		try {
			catalog = await Catalog.open(this.context);
			const rows = catalog.sources();
			if (rows.length === 0) {
				const empty = new vscode.TreeItem('No repository yet', vscode.TreeItemCollapsibleState.None);
				empty.iconPath = new vscode.ThemeIcon('info');
				empty.description = 'add one with +';
				empty.tooltip = 'A repository is added here or read from a folder, and a project then cites the pages it declares.';
				empty.command = { command: 'temcoRepositories.page', title: 'Add a repository' };
				return [empty];
			}
			return rows.map(item);
		} catch {
			// No catalog, no list: the panel says nothing rather than inventing a repository.
			return [];
		} finally {
			catalog?.close();
		}
	}
}

/**
 * Registers the panel.
 *
 * `changed` is the module's one signal — a read finished, a clone arrived, a source was forgotten — so the panel is
 * never a snapshot that drifts from what the actions did.
 */
export function registerSourcesView(context: vscode.ExtensionContext, changed: vscode.Event<void>): vscode.TreeView<vscode.TreeItem> {
	const view = new SourcesView(context);
	const tree = vscode.window.createTreeView(SOURCES_VIEW_ID, { treeDataProvider: view, showCollapseAll: false });
	context.subscriptions.push(tree, changed(() => view.refresh()));
	return tree;
}
