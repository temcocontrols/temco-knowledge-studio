// The module's side bar, grouped and counted the way the mock draws it.
//
// The mock's Documentation side bar (`docs/mock/js/shell.js`, `renderSidebar`) had five headings — Projects,
// Sources, Areas, Pipeline, How-To. How-To went with its page (a mock guide with invented counts) and Sources went
// later: a source is only ever read *through a project*, so the list of them belongs on that project's own page
// (`temcoProjects.editProject`) rather than in a catalog-wide group here. The three that remain list things:
//
//   * each carries a **count**, at the end of the row;
//   * the two headings that name things inside them — the projects and the areas — list those things, with the one
//     being worked on first and the rest behind "… N more" (`treeBody`);
//   * the pipeline is the group **Publish**: review, build and release.
//
// VS Code draws a heading as a view, so each group is one. The view's own header carries the count as a badge, and
// every row carries its own as the description — the same number at the same end of the row as the mock.
//
// None of these rows implements anything. They are the commands the pages already offer, named where a person looks
// for them: a surface is discovered by being listed, not by being remembered.

import * as vscode from 'vscode';

/** What the side bar reads: live questions, so a refresh is one call rather than a snapshot to keep in step. */
export interface SidebarModel {
	counts(): { repositories: number; sources: number; review: number };
}

/** One row of a group: what it says, what it runs, and the number at its end. */
interface Row {
	label: string;
	note: string;
	command: string;
	args?: unknown[];
	icon: string;
	count?: number;
	/** The row for the thing being worked on: drawn as the item that is current, not merely first. */
	current?: boolean;
}

const COUNT_SCHEME = 'temco-count';

/** A right-aligned badge: a number, or the word "current" when the row is the one being worked on. */
function badge(text: string, key: string, current = false): vscode.Uri {
	const uri = vscode.Uri.parse(`${COUNT_SCHEME}:/${encodeURIComponent(text)}/${encodeURIComponent(key)}`);
	return current ? uri.with({ query: 'current' }) : uri;
}

abstract class Group implements vscode.TreeDataProvider<vscode.TreeItem> {
	private readonly changed = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.changed.event;

	constructor(readonly groupId: string) { }

	refresh(): void {
		this.changed.fire();
	}

	getTreeItem(item: vscode.TreeItem): vscode.TreeItem {
		return item;
	}

	protected item(row: Row): vscode.TreeItem {
		const item = new vscode.TreeItem(row.label, vscode.TreeItemCollapsibleState.None);
		item.iconPath = new vscode.ThemeIcon(row.icon);
		item.tooltip = `${row.label} — ${row.note}${row.count === undefined ? '' : ` · ${row.count}`}`;
		// The one slot a row pushes to its right edge: the word "current" on the row being worked on, the number
		// on every other counted row.
		if (row.current === true) {
			item.resourceUri = badge('current', row.label, true);
		} else if (row.count !== undefined) {
			item.resourceUri = badge(String(row.count), row.label);
		}
		item.command = { command: row.command, title: row.label, arguments: row.args ?? [] };
		return item;
	}

	abstract getChildren(element?: vscode.TreeItem): vscode.TreeItem[];
}

/** A group whose rows are short and fixed: a heading's own surfaces, each with its count. */
class Flat extends Group {
	constructor(groupId: string, private readonly rows: () => Row[]) {
		super(groupId);
	}

	getChildren(): vscode.TreeItem[] {
		return this.rows().map((row) => this.item(row));
	}
}

/** The side bar, after it is registered: the one call a refresh needs. */
export interface DocsSidebar {
	refresh(): void;
}

/** Registers the Publish group: review, build and release. */
export function registerSectionViews(context: vscode.ExtensionContext, model: SidebarModel): DocsSidebar {
	const groups: Group[] = [];

	const pipeline = (): Row[] => [
		{
			label: 'Review Center',
			note: 'drafts and edits waiting for a person',
			command: 'temcoDocs.review',
			icon: 'check',
			count: model.counts().review,
		},
		{ label: 'Build Center', note: 'the targets and the errors that block them', command: 'temcoDocs.builds', icon: 'play' },
		{ label: 'Releases', note: 'published versions, and the one in flight', command: 'temcoDocs.releases', icon: 'cloud-upload' },
	];

	const flatPipeline = new Flat('pipeline', pipeline);
	groups.push(flatPipeline);

	const view = (id: string, group: Group): void => {
		context.subscriptions.push(
			vscode.window.createTreeView(`temcoDocs.section.${id}`, { treeDataProvider: group })
		);
	};

	view('pipeline', flatPipeline);

	context.subscriptions.push(
		vscode.window.registerFileDecorationProvider({
			provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
				if (uri.scheme !== COUNT_SCHEME) {
					return undefined;
				}
				const text = decodeURIComponent(uri.path.split('/')[1] ?? '');
				return text.length === 0
					? undefined
					: { badge: text, tooltip: text, color: uri.query === 'current' ? new vscode.ThemeColor('textLink.foreground') : undefined };
			},
		})
	);

	return {
		refresh(): void {
			for (const group of groups) {
				group.refresh();
			}
		},
	};
}
