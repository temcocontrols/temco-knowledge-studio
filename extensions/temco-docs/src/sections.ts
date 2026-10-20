// The module's side bar, grouped and counted the way the mock draws it.
//
// The mock's Documentation side bar (`docs/mock/js/shell.js`, `renderSidebar`) had five headings — Projects,
// Sources, Areas, Pipeline, How-To — and three things each heading does that a flat list of rows does not. How-To
// is gone with its page (a mock guide with invented counts); the rest are here:
//
//   * it carries a **count**, at the end of the row;
//   * the two headings that name things inside them — the projects and the areas — list those things, with the one
//     being worked on first and the rest behind "… N more" (`treeBody`);
//   * the pages opened in this window are the group **Working Set**, folded by area.
//
// VS Code draws a heading as a view, so each group is one. The view's own header carries the count as a badge, and
// every row carries its own as the description — the same number at the same end of the row as the mock.
//
// None of these rows implements anything. They are the commands the pages already offer, named where a person looks
// for them: a surface is discovered by being listed, not by being remembered.

import * as vscode from 'vscode';
import { slugOf } from './store';

/** A page opened in this window, newest first: what the Working Set lists. */
export interface WorkingEntry {
	/** The area the page belongs to — the branch it is filed under. */
	area: string;
	title: string;
	id: string;
	path?: string;
}

/** What the side bar reads: live questions, so a refresh is one call rather than a snapshot to keep in step. */
export interface SidebarModel {
	/** The projects the catalog knows, the one being worked on first. */
	projects(): { name: string; current: boolean }[];
	/** The areas of the project being worked on, the area of the open page first. */
	areas(): { area: string; title: string; pages: number; current: boolean }[];
	/** The pages opened in this window. */
	working(): readonly WorkingEntry[];
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

const TOGGLE = 'temcoDocs.sidebar.toggle';

/**
 * A row's number, as a decoration rather than as text beside the label.
 *
 * A tree row has two text slots: the label and the description, and the description sits *after* the label, not at
 * the end of the row. The one thing a row pushes to the right edge is its decoration — the slot the Explorer uses
 * for "M"/"U" and the Source Control view uses for its counts. So the number goes there: the count travels in the
 * URI and one provider for the whole module turns it into a badge.
 */
const COUNT_SCHEME = 'temco-count';

/** The scheme a link-coloured row travels in. */
const LINK_SCHEME = 'temco-link';

/** A right-aligned badge: a number, or the word "current" when the row is the one being worked on. */
function badge(text: string, key: string, current = false): vscode.Uri {
	const uri = vscode.Uri.parse(`${COUNT_SCHEME}:/${encodeURIComponent(text)}/${encodeURIComponent(key)}`);
	return current ? uri.with({ query: 'current' }) : uri;
}

/** Every provider keeps its own "… N more" state, and the toggle command finds it through this table. */
const TOGGLES = new Map<string, () => void>();

abstract class Group implements vscode.TreeDataProvider<vscode.TreeItem> {
	private readonly changed = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.changed.event;

	constructor(readonly groupId: string) {
		TOGGLES.set(groupId, () => {
			this.toggle();
			this.changed.fire();
		});
	}

	refresh(): void {
		this.changed.fire();
	}

	getTreeItem(item: vscode.TreeItem): vscode.TreeItem {
		return item;
	}

	protected toggle(): void {
		/* Only the groups that fold long lists override this. */
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

	/** The row that opens or closes the rest of a long list: the mock's "… N more" / "Show less". */
	protected more(hidden: number, expanded: boolean): vscode.TreeItem {
		const item = new vscode.TreeItem(
			expanded ? 'Show less' : `… ${hidden} more`,
			vscode.TreeItemCollapsibleState.None
		);
		item.iconPath = new vscode.ThemeIcon(expanded ? 'chevron-down' : 'chevron-right');
		// A link, as far as a tree row can be one: the label is drawn in the theme's link colour by the same
		// decoration slot the counts use. A row's font size is the list's, and no item can change it.
		item.resourceUri = vscode.Uri.parse(`${LINK_SCHEME}:/toggle/${this.groupId}`);
		item.tooltip = expanded
			? 'Show only the one being worked on.'
			: `${hidden} more behind this row — the full list is one click away.`;
		item.command = { command: TOGGLE, title: 'Show the rest', arguments: [this.groupId] };
		return item;
	}

	abstract getChildren(element?: vscode.TreeItem): vscode.TreeItem[];
}

/**
 * A group that lists the things inside it: the current one, then "… N more".
 *
 * The mock truncates these two lists — the projects and the areas — to the one being worked on, because a side bar
 * says *where you are*; the full list is the page's own job. The toggle is the same row the mock draws.
 */
class LongList extends Group {
	private expanded = false;

	constructor(groupId: string, private readonly rows: () => Row[]) {
		super(groupId);
	}

	protected override toggle(): void {
		this.expanded = !this.expanded;
	}

	getChildren(): vscode.TreeItem[] {
		const rows = this.rows();
		const current = rows.filter((row) => row.current === true)[0] ?? rows[0];
		if (current === undefined) {
			return [];
		}
		const rest = rows.filter((row) => row !== current);
		const items = [this.item(current)];
		if (this.expanded) {
			items.push(...rest.map((row) => this.item(row)));
		}
		if (rest.length > 0) {
			items.push(this.more(rest.length, this.expanded));
		}
		return items;
	}
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

/**
 * The Working Set: the pages opened in this window, folded by area.
 *
 * The mock keeps the same list (`M.state.working`, capped, newest first) and draws it the same way: a branch per
 * area with the count of pages under it, and the pages as its leaves. Nothing here is stored — it is what this
 * window has shown, and it goes when the window does.
 */
class WorkingSet extends Group {
	constructor(private readonly model: SidebarModel) {
		super('working');
	}

	getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
		const entries = this.model.working();
		if (element !== undefined) {
			// The branch is open: its pages, in the order they were opened.
			const area = String(element.label);
			return entries
				.filter((entry) => entry.area === area)
				.map((entry) => {
					const page = new vscode.TreeItem(entry.title, vscode.TreeItemCollapsibleState.None);
					page.iconPath = new vscode.ThemeIcon('file');
					page.tooltip = `${entry.title} — opened in this window`;
					page.command = {
						command: 'temcoRepositories.openFile',
						title: entry.title,
						arguments: [{ path: entry.path, id: entry.id, title: entry.title }],
					};
					return page;
				});
		}
		if (entries.length === 0) {
			const empty = new vscode.TreeItem('No page opened yet', vscode.TreeItemCollapsibleState.None);
			empty.iconPath = new vscode.ThemeIcon('info');
			empty.tooltip = 'Pages you open are listed here, grouped by area, until the window closes.';
			empty.description = '';
			return [empty];
		}

		const branches: { area: string; entries: WorkingEntry[] }[] = [];
		for (const entry of entries) {
			let branch = branches.filter((candidate) => candidate.area === entry.area)[0];
			if (branch === undefined) {
				branch = { area: entry.area, entries: [] };
				branches.push(branch);
			}
			branch.entries.push(entry);
		}

		return branches.map((branch) => {
			const node = new vscode.TreeItem(branch.area, vscode.TreeItemCollapsibleState.Expanded);
			node.iconPath = new vscode.ThemeIcon('folder');
			node.description = String(branch.entries.length);
			node.tooltip = `${branch.entries.length} page${branch.entries.length === 1 ? '' : 's'} opened in ${branch.area}`;
			node.contextValue = 'workingBranch';
			return node;
		});
	}
}

/** The side bar, after it is registered: the one call a refresh needs. */
export interface DocsSidebar {
	refresh(): void;
}

/** Registers the six group views and the one command their long lists share. */
export function registerSectionViews(context: vscode.ExtensionContext, model: SidebarModel): DocsSidebar {
	const groups: Group[] = [];

	const project = (): Row[] => {
		const rows = model.projects();
		if (rows.length === 0) {
			// Nothing recorded is not nothing to say: the row carries the reason and the one act that fills it.
			return [
				{
					label: 'No project yet',
					note: 'a project is what you manage — create one, then give it a source',
					command: 'temcoProjects.newProject',
					icon: 'plus',
				},
			];
		}
		return rows.map((entry) => ({
			label: entry.name,
			note: entry.current ? 'the project this window is on' : 'make it the project this window is on',
			// The mock's project row *becomes* the project and opens the projects page (`tree-project`); it does
			// not open a project's own editor. One command does both, so the side bar has one click, not two.
			command: 'temcoDocs.selectProject',
			args: [slugOf(entry.name)],
			icon: 'folder',
			current: entry.current,
		}));
	};

	const area = (): Row[] => {
		const rows = model.areas();
		if (rows.length === 0) {
			return [
				{
					label: 'No area to show',
					note: 'the project has no registry yet, or none of its sources has been read',
					command: 'temcoDocs.sources',
					icon: 'info',
				},
			];
		}
		return rows.map((entry) => ({
			label: entry.title || entry.area,
			note: 'the registry, area by area',
			command: 'temcoDocs.documents',
			args: [entry.area],
			icon: 'book',
			count: entry.pages,
			current: entry.current,
		}));
	};

	const sources = (): Row[] => [
		{
			label: 'Sources',
			note: 'everything a project reads',
			command: 'temcoDocs.sources',
			icon: 'link',
			count: model.counts().sources,
		},
	];

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

	const projects = new LongList('projects', project);
	const areas = new LongList('areas', area);
	const flatSources = new Flat('sources', sources);
	const flatPipeline = new Flat('pipeline', pipeline);
	const working = new WorkingSet(model);
	groups.push(projects, areas, flatSources, flatPipeline, working);

	const view = (id: string, group: Group): void => {
		context.subscriptions.push(
			vscode.window.createTreeView(`temcoDocs.section.${id}`, { treeDataProvider: group })
		);
	};

	view('projects', projects);
	view('areas', areas);
	view('sources', flatSources);
	view('pipeline', flatPipeline);
	view('working', working);

	context.subscriptions.push(
		vscode.window.registerFileDecorationProvider({
			provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
				if (uri.scheme === LINK_SCHEME) {
					return { color: new vscode.ThemeColor('textLink.foreground') };
				}
				if (uri.scheme !== COUNT_SCHEME) {
					return undefined;
				}
				const text = decodeURIComponent(uri.path.split('/')[1] ?? '');
				return text.length === 0
					? undefined
					: { badge: text, tooltip: text, color: uri.query === 'current' ? new vscode.ThemeColor('textLink.foreground') : undefined };
			},
		}),
		vscode.commands.registerCommand(TOGGLE, (groupId?: unknown) => {
			TOGGLES.get(typeof groupId === 'string' ? groupId : '')?.();
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
