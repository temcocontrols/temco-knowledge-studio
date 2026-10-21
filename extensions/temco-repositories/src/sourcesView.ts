// The Repositories panel: the enterprises this window asks about, and the repositories under each.
//
// Two things live here, and they are two levels of one idea. An **enterprise** is where a list comes from — the
// platform's default, one a person adds, or a single repository named by its address. A **repository** is a row of
// that list, which becomes a source when the project being worked on starts it.
//
// So the tree is the same shape as the page: enterprise, then repository. A repository that is already a source
// says so, and clicking it opens the page that shows what its read recorded; one that is not says so, and the page
// starts it. Anything recorded that no enterprise claims — a folder, an archive, a clone of an address nobody
// added — is listed under *Other sources* rather than disappearing.

import * as vscode from 'vscode';
import {
	Catalog,
	OrganisationRow,
	RepositoryCacheRow,
	SourceRow,
	slugOf,
} from './store';

/** The view the panel draws into. */
export const SOURCES_VIEW_ID = 'temcoRepositories.list';

const MARK: { [kind: string]: string } = { git: 'repo', folder: 'folder', archive: 'package' };

/** One row of the tree, kept as data so a child can be found from its parent. */
type Node =
	| { kind: 'organisation'; row: OrganisationRow }
	| { kind: 'repository'; row: RepositoryCacheRow; source?: string }
	| { kind: 'other'; label: string; note: string }
	| { kind: 'source'; row: SourceRow }
	| { kind: 'empty'; label: string; note: string; command: vscode.Command };

/** A tree item that remembers which node it came from. */
class NodeItem extends vscode.TreeItem {
	constructor(readonly node: Node, collapsibleState: vscode.TreeItemCollapsibleState) {
		super('', collapsibleState);
	}
}

/** When a list was read, in a form that survives a missing stamp. */
function when(stamp: string | undefined): string {
	if (stamp === undefined || stamp.length === 0) {
		return 'not read';
	}
	const date = new Date(stamp);
	return isNaN(date.getTime()) ? 'read' : `read ${date.toLocaleDateString()}`;
}

function item(node: Node): NodeItem {
	switch (node.kind) {
		case 'organisation': {
			const row = node.row;
			const organisation = new NodeItem(node, vscode.TreeItemCollapsibleState.Expanded);
			organisation.label = row.name;
			organisation.id = `org:${row.slug}`;
			organisation.iconPath = new vscode.ThemeIcon(row.kind === 'repository' ? 'repo' : 'organization');
			organisation.contextValue = 'temcoOrganisation';
			organisation.description =
				`${row.repositories} ${row.repositories === 1 ? 'repository' : 'repositories'} · ${when(row.lastRead)}`;
			organisation.tooltip = new vscode.MarkdownString(
				`**${row.name}**\n\n${row.kind === 'repository' ? 'One repository, named by its address' : 'An enterprise or account on GitHub'}\n\n${organisation.description}`
			);
			// The page is where a list is read again; the panel names what exists and where to go.
			organisation.command = { command: 'temcoRepositories.page', title: 'Open the repositories page' };
			return organisation;
		}
		case 'repository': {
			const repository = new NodeItem(node, vscode.TreeItemCollapsibleState.None);
			repository.label = node.row.name;
			repository.id = `repo:${node.row.fullName}`;
			// The mark carries the state, because the description cannot: green for a source of this project, amber for
			// one nothing has started yet. The words sit at the right edge, where a tree puts its second column.
			repository.iconPath = node.source === undefined
				? new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('charts.yellow'))
				: new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('charts.green'));
			repository.contextValue = node.source === undefined ? 'temcoRepository' : 'temcoSource';
			// No second column: a tree puts its description straight after the label, where it reads as part of the name,
			// and the state is already the mark's colour. The facts live in the tooltip.
			repository.tooltip = new vscode.MarkdownString(
				`**${node.row.fullName}**\n\n${node.row.description ?? ''}\n\n` +
				[
					node.row.language === undefined || node.row.language.length === 0 ? 'repository' : node.row.language,
					node.row.isPrivate ? 'private' : 'public',
					node.source === undefined ? 'not started' : 'source of this project',
				]
					.filter((part) => part.length > 0)
					.join(' · ')
			);
			repository.command =
				node.source === undefined
					? { command: 'temcoRepositories.repository', title: 'Open the repository', arguments: [node.row.name] }
					: { command: 'temcoDocs.repository', title: 'Open the repository', arguments: [node.source] };
			return repository;
		}
		case 'other': {
			const group = new NodeItem(node, vscode.TreeItemCollapsibleState.Expanded);
			group.label = node.label;
			group.id = 'other';
			group.iconPath = new vscode.ThemeIcon('library');
			group.description = node.note;
			return group;
		}
		case 'source': {
			const source = node.row;
			const row = new NodeItem(node, vscode.TreeItemCollapsibleState.None);
			const facts = [source.kind === 'git' ? 'repository' : source.kind];
			if (source.branch !== undefined) {
				facts.push(source.branch);
			}
			facts.push(
				source.pages === undefined || source.pages === 0
					? 'not read'
					: `${source.pages} ${source.pages === 1 ? 'page' : 'pages'}`
			);
			if (source.state !== undefined) {
				facts.push(source.state);
			}
			row.label = source.name;
			row.id = `source:${source.slug}`;
			row.iconPath = new vscode.ThemeIcon(MARK[source.kind] ?? 'package');
			row.contextValue = 'temcoSource';
			row.description = facts.join(' · ');
			row.tooltip = new vscode.MarkdownString(`**${source.name}**\n\n${row.description}`);
			row.command = {
				command: source.kind === 'git' ? 'temcoDocs.repository' : 'temcoRepositories.revealSource',
				title: source.kind === 'git' ? 'Open the repository' : 'Open where it lives',
				arguments: [source.slug],
			};
			return row;
		}
		default: {
			const empty = new NodeItem(node, vscode.TreeItemCollapsibleState.None);
			empty.label = node.label;
			empty.iconPath = new vscode.ThemeIcon('info');
			empty.description = node.note;
			empty.command = node.command;
			return empty;
		}
	}
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

	async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
		const parent = element instanceof NodeItem ? element.node : undefined;
		let catalog: Catalog | undefined;
		try {
			catalog = await Catalog.open(this.context);

			if (parent === undefined) {
				const organisations = catalog.organisations();
				const nodes: Node[] = organisations.map((row) => ({ kind: 'organisation', row }));
				const other = this.unclaimed(catalog).length;
				if (other > 0) {
					nodes.push({
						kind: 'other',
						label: 'Other sources',
						note: `${other} recorded ${other === 1 ? 'source' : 'sources'} no enterprise lists`,
					});
				}
				if (nodes.length === 0) {
					nodes.push({
						kind: 'empty',
						label: 'No repository yet',
						note: 'add one on the page',
						command: { command: 'temcoRepositories.page', title: 'Add a repository' },
					});
				}
				return nodes.map(item);
			}

			if (parent.kind === 'organisation') {
				const sources = new Set(catalog.sources().map((row) => row.slug));
				const rows = catalog.repositoriesOf(parent.row.slug);
				if (rows.length === 0) {
					return [
						item({
							kind: 'empty',
							label: parent.row.state === 'refused' ? 'GitHub would not answer' : 'Nothing listed yet',
							note: 'open the page',
							command: { command: 'temcoRepositories.page', title: 'Open the repositories page' },
						}),
					];
				}
				return rows.map((row) =>
					item({ kind: 'repository', row, source: sources.has(slugOf(row.name)) ? slugOf(row.name) : undefined })
				);
			}

			if (parent.kind === 'other') {
				return this.unclaimed(catalog).map((row) => item({ kind: 'source', row }));
			}

			return [];
		} catch {
			// No catalog, no list: the panel says nothing rather than inventing a repository.
			return [];
		} finally {
			catalog?.close();
		}
	}

	/** What is recorded but named by no enterprise: a folder, an archive, or a repository nobody added. */
	private unclaimed(catalog: Catalog): SourceRow[] {
		const listed = new Set<string>();
		for (const organisation of catalog.organisations()) {
			for (const repository of catalog.repositoriesOf(organisation.slug)) {
				listed.add(slugOf(repository.name));
			}
		}
		return catalog.sources().filter((source) => !listed.has(source.slug));
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
