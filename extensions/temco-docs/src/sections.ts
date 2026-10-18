// The module's side bar, grouped the way the mock groups it.
//
// The mock's Documentation side bar is five headings — Projects, Sources, Documents, Pipeline, How-To — each with the
// surfaces that belong to it. VS Code draws a heading as a view, so each of those becomes one: a short list of rows,
// each row running the command that owns the thing.
//
// None of these rows implements anything. They are the same commands the palette and the views already offer, named
// where a person looks for them, which is the whole point of a side bar: a surface is discovered by being listed, not
// by being remembered.

import * as vscode from 'vscode';

interface Row {
	label: string;
	/** What the row is for. The mock's side bar has no second line, so this is the tooltip. */
	note: string;
	command: string;
	icon: string;
}

interface Group {
	id: string;
	rows: Row[];
}

/** The groups, in the mock's order and with the mock's rows. */
const GROUPS: Group[] = [
	{
		id: 'projects',
		rows: [
			{ label: 'Projects', note: 'the versions, their sources and what they build', command: 'temcoDocs.projects', icon: 'folder' }
		]
	},
	{
		id: 'sources',
		rows: [
			{ label: 'Repositories', note: 'the organisation and the local copies', command: 'temcoDocs.repositories', icon: 'repo' },
			{ label: 'Sources', note: 'everything a project reads', command: 'temcoDocs.sources', icon: 'link' }
		]
	},
	{
		id: 'documents',
		rows: [
			{ label: 'Documents', note: 'the registry, area by area', command: 'temcoDocs.documents', icon: 'book' }
		]
	},
	{
		id: 'pipeline',
		rows: [
			{ label: 'Review Center', note: 'drafts and edits waiting for a person', command: 'temcoDocs.review', icon: 'check' },
			{ label: 'Build Center', note: 'the targets and the errors that block them', command: 'temcoDocs.builds', icon: 'play' },
			{ label: 'Releases', note: 'published versions, and the one in flight', command: 'temcoDocs.releases', icon: 'upload' }
		]
	},
	{
		id: 'howto',
		rows: [
			{ label: 'How To Use', note: 'five steps, start here', command: 'temcoDocs.howTo', icon: 'graduation' }
		]
	}
];

/** A group's rows: one row per command, with the sentence that says what it is kept as its tooltip. */
class SectionProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
	constructor(private readonly rows: readonly Row[]) { }

	getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(): vscode.TreeItem[] {
		return this.rows.map((row) => {
			const item = new vscode.TreeItem(row.label, vscode.TreeItemCollapsibleState.None);
			// The mock's side bar is one line per row, so the note lives in the tooltip rather than beside
			// the label, where it repeated down the whole panel.
			item.iconPath = new vscode.ThemeIcon(row.icon);
			item.tooltip = `${row.label} — ${row.note}`;
			item.command = { command: row.command, title: row.label };
			return item;
		});
	}
}

/** Registers the four group views. The Documents group is the Workspace tree, which is already a view. */
export function registerSectionViews(context: vscode.ExtensionContext): void {
	for (const group of GROUPS) {
		context.subscriptions.push(
			vscode.window.createTreeView(`temcoDocs.section.${group.id}`, { treeDataProvider: new SectionProvider(group.rows) })
		);
	}
}
