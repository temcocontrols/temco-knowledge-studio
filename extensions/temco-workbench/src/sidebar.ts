// The application's side-bar groups that are not a data view.
//
// Each of these containers — Workspaces, AI Hub, Temco Learn, Settings, Help — is a short list of rows, one per thing
// that can be done from there. They are rows rather than a page because a side bar answers "where do I go next"; the
// page behind each row is the module's.
//
// They live in the workbench module for one reason: **the order of the activity bar is the order the containers were
// registered**, and a container cannot declare an order. Declaring them all in one manifest is the only way to get the
// mock's sequence — Dashboard, Workspaces, Documentation, Documents, AI Hub, Temco Learn, Devices, I/O, BACnet,
// Network, SQL, Settings, Help — instead of whichever module happened to be scanned first.

import * as vscode from 'vscode';

interface Row {
	label: string;
	/** What the row is for. The mock's side bar has no second line, so this is the tooltip. */
	note: string;
	/** The row's own glyph, as the mock gives every row one. */
	icon: string;
	command: string;
	args?: unknown[];
}

interface Group {
	id: string;
	title: string;
	rows: Row[];
}

const GROUPS: Group[] = [
	{
		id: 'temcoWorkbench.platformView',
		title: 'Platform',
		rows: [
			{ label: 'Overview', note: 'what the platform holds, in one screen', icon: 'home', command: 'temcoWorkbench.overview' },
			{ label: 'Recent Activity', note: 'everything every module recorded', icon: 'history', command: 'temcoWorkbench.activity' },
			{ label: 'Coverage & Health', note: 'read, reviewed and shipped, per area', icon: 'pass', command: 'temcoWorkbench.health' }
		]
	},
	{
		id: 'temcoWorkbench.needsWorkView',
		title: 'Needs Work',
		rows: [
			{ label: 'Needs Review', note: '17 waiting · what wants a person, said in full', icon: 'warning', command: 'temcoWorkbench.openNeeds' }
		]
	},
	{
		id: 'temcoWorkbench.workspacesView',
		title: 'Workspaces',
		rows: [
			{ label: 'All Workspaces', note: 'the folders this window has open', icon: 'layers', command: 'temcoWorkbench.workspaces' },
			{ label: 'T3000', note: 'the workspace this window is on', icon: 'server', command: 'temcoWorkbench.workspace', args: ['t3000'] },
			{ label: 'Templates', note: 'the shape a project starts with', icon: 'package', command: 'temcoWorkbench.templates' }
		]
	},
	{
		id: 'temcoWorkbench.learnView',
		title: 'Site',
		rows: [
			{ label: 'Home', note: 'the published site, as a reader sees it', icon: 'home', command: 'temcoWorkbench.learn.home' },
			{ label: 'T3000', note: 'one product, area by area', icon: 'book', command: 'temcoWorkbench.learn.t3000' },
			{ label: 'Article Preview', note: 'a page as the site renders it', icon: 'preview', command: 'temcoWorkbench.learn.article' }
		]
	},
	{
		id: 'temcoWorkbench.learnDelivery',
		title: 'Delivery',
		rows: [
			{ label: 'Downloads', note: 'the offline artifacts of a published version', icon: 'download', command: 'temcoWorkbench.learn.downloads' },
			{ label: 'Learning Paths', note: 'ordered reading for a job', icon: 'mortar-board', command: 'temcoWorkbench.learn.paths' }
		]
	},
	{
		id: 'temcoWorkbench.settingsProfile',
		title: 'Profile',
		rows: [
			{ label: 'General', note: 'the window, its working folder, diagnostics and updates', icon: 'gear', command: 'temcoWorkbench.settings.general' },
			{ label: 'AI Models', note: 'what this profile loads, and what it may read', icon: 'sparkle', command: 'temcoWorkbench.settings.ai' }
		]
	},
	{
		id: 'temcoWorkbench.settingsPlatform',
		title: 'Platform',
		rows: [
			{ label: 'Modules', note: 'the built-in extensions that ship with the platform', icon: 'package', command: 'temcoWorkbench.settings.modules' },
			{ label: 'Branding', note: 'the mark, the theme and the identity', icon: 'paintcan', command: 'temcoWorkbench.settings.branding' },
			{ label: 'Publishing', note: 'where a release goes and what it may overwrite', icon: 'cloud-upload', command: 'temcoWorkbench.settings.publishing' }
		]
	},
	{
		id: 'temcoWorkbench.helpLearn',
		title: 'Learn',
		rows: [
			{ label: 'Welcome', note: 'what the application is for, and the ways in', icon: 'home', command: 'temcoWorkbench.help.welcome' },
			{ label: 'Help', note: 'where to start, and what this window is', icon: 'info', command: 'temcoWorkbench.help.home' },
			{ label: 'Keyboard Shortcuts', note: 'every binding, by group', icon: 'key', command: 'temcoWorkbench.help.keys' }
		]
	},
	{
		id: 'temcoWorkbench.helpSupport',
		title: 'Support',
		rows: [
			{ label: 'Logs', note: 'four files, and how to read one', icon: 'output', command: 'temcoWorkbench.help.logs' },
			{ label: 'Report an Issue', note: 'the facts a report needs, collected', icon: 'report', command: 'temcoWorkbench.help.issue' },
			{ label: 'About Temco Platform', note: 'the version in front of you', icon: 'info', command: 'temcoWorkbench.help.about' }, { label: 'Documentation', note: 'what is being read', icon: 'book', command: 'temcoDocs.overview' },
			{ label: 'How To Use', note: 'five steps, start here', icon: 'mortar-board', command: 'temcoDocs.howTo' }
		]
	}
];

class RowsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
	constructor(private readonly rows: readonly Row[]) { }

	getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(): vscode.TreeItem[] {
		return this.rows.map((row) => {
			const item = new vscode.TreeItem(row.label, vscode.TreeItemCollapsibleState.None);
			// The mock's side bar is one line per row: the glyph says what kind of thing it is, and the
			// sentence that used to sit beside the label is in the tooltip, where it does not repeat
			// down the panel.
			item.iconPath = new vscode.ThemeIcon(row.icon);
			item.tooltip = `${row.label} — ${row.note}`;
			item.command = { command: row.command, title: row.label, arguments: row.args };
			return item;
		});
	}
}

/** Registers the group views the workbench's containers declare. */
export function registerSidebarViews(context: vscode.ExtensionContext): void {
	for (const group of GROUPS) {
		context.subscriptions.push(
			vscode.window.createTreeView(group.id, { treeDataProvider: new RowsProvider(group.rows) })
		);
	}
}
