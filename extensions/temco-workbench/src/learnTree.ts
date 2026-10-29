// Temco Learn's panel — what a reader receives, drawn the way the workbench draws a list.
//
// It is a native tree, not a webview: VS Code owns the rows, the expansion, the keyboard and the screen reader, so the
// panel looks and behaves like every other one in the workbench. Five groups, in the order a person asks them:
//
//   **Preview**   serve the built site on this machine, or open the copy that was published.
//   **Output**    the files a build wrote — one row per file, because a file that is there is a fact.
//   **Read it**   the reader's own surfaces: the product documentation, paths, downloads, one page as a reader sees it,
//                 and the Learn page itself.
//   **Coverage**  what has no output, was never reviewed, or whose code moved.
//   **Publish**   how what is here reaches a reader.
//
// Every row is a command that already exists, and every number is read from the same catalog and registry rows those
// commands use. A count that cannot be read says so rather than showing a zero nothing measured.

import * as vscode from 'vscode';
import { collectPages, countStale, onDidChange, roots, totals } from './docs';
import { LearnFacts, facts, kindLabel, since } from './learnPanel';
import { ReleaseRow } from './store';

export const LEARN_VIEW_ID = 'temcoLearn.panel';

/** One file a build left. */
type Artifact = LearnFacts['artifacts'][number];

const GROUPS = ['read', 'preview', 'publish', 'health'] as const;
type Group = (typeof GROUPS)[number];

const GROUP_LABEL: Record<Group, string> = {
	read: 'Read',
	preview: 'Preview',
	publish: 'Publish',
	health: 'Health'
};

const GROUP_ICON: Record<Group, string> = {
	read: 'book',
	preview: 'eye',
	publish: 'cloud-upload',
	health: 'pulse'
};

/** Everything the rows are built from: the registry's counts, and the catalog's files and releases. */
interface Snapshot {
	project?: string;
	pages: number;
	areas: number;
	stale: number;
	neverReviewed: number;
	artifacts: Artifact[];
	releases: ReleaseRow[];
}

/** A row that also remembers which group it belongs to, so its children can be drawn. */
interface LearnItem extends vscode.TreeItem {
	group?: Group;
}

function count(n: number, word: string): string {
	return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** The front door: the Learn page, which says what the groups below it are for. */
function home(): LearnItem {
	const item: LearnItem = new vscode.TreeItem('Home', vscode.TreeItemCollapsibleState.None);
	item.id = 'temcoLearn.home';
	item.iconPath = new vscode.ThemeIcon('home');
	item.tooltip = 'Temco Learn — what this panel is for, and where each step lives';
	item.command = { command: 'temcoWorkbench.learn.home', title: 'Temco Learn' };
	return item;
}

/** The newest file a build left, whichever kind it is. */
function newestArtifact(artifacts: readonly Artifact[]): Artifact | undefined {
	return [...artifacts].sort((one, other) => String(other.builtAt).localeCompare(String(one.builtAt)))[0];
}

/** The glyph for a file a build left — theme icons here, because a native tree draws its own. */
function artifactMark(kind: string): string {
	switch (kind) {
		case 'site':
			return 'globe';
		case 'chm':
			return 'package';
		case 'pdf':
			return 'file-pdf';
		case 'search':
			return 'search';
		default:
			return 'file';
	}
}

export class LearnTree implements vscode.TreeDataProvider<LearnItem>, vscode.Disposable {
	private readonly changed = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.changed.event;

	private snapshot: Snapshot | undefined;
	private readonly disposables: vscode.Disposable[] = [];

	constructor(private readonly context: vscode.ExtensionContext) {
		this.disposables.push(onDidChange(() => this.refresh()));
	}

	/** Read the registry and the catalog again; the next draw asks for the rows. */
	refresh(): void {
		this.snapshot = undefined;
		this.changed.fire();
	}

	dispose(): void {
		for (const one of this.disposables) {
			one.dispose();
		}
		this.changed.dispose();
	}

	getTreeItem(item: LearnItem): vscode.TreeItem {
		return item;
	}

	async getChildren(item?: LearnItem): Promise<LearnItem[]> {
		const snapshot = await this.read();
		if (item === undefined) {
			return [home(), ...GROUPS.map(group => this.group(group, snapshot))];
		}
		return item.group === undefined ? [] : this.rows(item.group, snapshot);
	}

	private async read(): Promise<Snapshot> {
		const cached = this.snapshot;
		if (cached !== undefined) {
			return cached;
		}
		const sets = roots();
		const known = totals(sets);
		const catalog = await facts(this.context);
		const snapshot: Snapshot = {
			project: catalog.project,
			pages: known.pages,
			areas: sets.reduce((total, root) => total + root.areas.length, 0),
			stale: sets.reduce((total, root) => total + countStale(collectPages(root)), 0),
			neverReviewed: known.neverReviewed,
			artifacts: catalog.artifacts,
			releases: catalog.releases
		};
		this.snapshot = snapshot;
		return snapshot;
	}

	private group(group: Group, snapshot: Snapshot): LearnItem {
		const item: LearnItem = new vscode.TreeItem(GROUP_LABEL[group], vscode.TreeItemCollapsibleState.Expanded);
		const note = this.groupNote(group, snapshot);
		item.id = `temcoLearn.${group}`;
		item.iconPath = new vscode.ThemeIcon(GROUP_ICON[group]);
		item.tooltip = note === undefined ? GROUP_LABEL[group] : `${GROUP_LABEL[group]} — ${note}`;
		item.contextValue = 'temcoLearn.group';
		item.group = group;
		return item;
	}

	/** The one number worth showing beside a group's name — the rest are on its rows. */
	private groupNote(group: Group, snapshot: Snapshot): string | undefined {
		const newest = snapshot.releases[0];
		switch (group) {
			case 'read':
				return count(snapshot.pages, 'page');
			case 'publish':
				return newest === undefined ? 'not published' : `last ${newest.version}`;
			case 'health':
				return snapshot.stale === 0 ? 'nothing owed' : count(snapshot.stale, 'page') + ' behind';
			default:
				return undefined;
		}
	}

	private rows(group: Group, snapshot: Snapshot): LearnItem[] {
		const newest = snapshot.releases[0];
		switch (group) {
			case 'read':
				return [
					this.row('read.t3000', 'Product documentation', `${count(snapshot.pages, 'page')} · ${count(snapshot.areas, 'area')}`, 'book', { command: 'temcoWorkbench.learn.t3000', title: 'Open the Product Documentation' }),
					this.row('read.downloads', 'Downloads', 'the files a reader can take away', 'cloud-download', { command: 'temcoWorkbench.learn.downloads', title: 'Open Downloads' })
				];
			case 'preview': {
				const built = newestArtifact(snapshot.artifacts);
				const rows = [
					this.row('preview.site', 'Preview the site', 'builds it, then opens it in the reader', 'play', { command: 'temcoDocs.previewSite', title: 'Preview the Site' }),
					this.row('preview.article', 'Preview one page', 'a single article, as a reader sees it', 'preview', { command: 'temcoWorkbench.learn.article', title: 'Preview an Article' })
				];
				if (built !== undefined) {
					rows.push(
						this.row(
							'preview.build',
							'Last build',
							`${kindLabel(built.kind)} · built ${since(built.builtAt)}`,
							artifactMark(built.kind),
							{ command: 'temcoDocs.openArtifact', title: 'Open the Artifact', arguments: [built.path] },
							built.path
						)
					);
				}
				return rows;
			}
			case 'publish':
				return [
					this.row('publish.releases', 'Releases', newest === undefined ? 'nothing published yet' : `last ${newest.version} · ${since(newest.publishedAt)}`, 'cloud-upload', { command: 'temcoDocs.releases', title: 'Publish & Releases' }),
					this.row('publish.site', 'Build the site', 'the pages a server publishes', 'globe', { command: 'temcoDocs.buildSite', title: 'Build the Site' }),
					this.row('publish.help', 'Build the offline help', 'the file a reader keeps offline', 'package', { command: 'temcoDocs.buildHelp', title: 'Build the Offline Help' })
				];
			case 'health':
				return [
					this.row('health.owed', 'Pages behind their code', `${count(snapshot.stale, 'page')} cite code that has since changed`, 'warning', { command: 'temcoDocs.stalenessReport', title: 'Documentation Owed' }),
					this.row('health.unread', 'Pages nobody has read', `${count(snapshot.neverReviewed, 'page')} not reviewed yet`, 'history', { command: 'temcoDocs.overview', title: 'Documentation Overview' }),
					this.row('health.all', 'All pages', `${count(snapshot.pages, 'page')} in ${count(snapshot.areas, 'area')}`, 'list-unordered', { command: 'temcoDocs.openRegistry', title: 'Open Registry' })
				];
		}
	}

	private row(key: string, label: string, note: string, mark: string, command?: vscode.Command, tooltip?: string): LearnItem {
		const item: LearnItem = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
		item.id = `temcoLearn.${key}`;
		item.iconPath = new vscode.ThemeIcon(mark);
		item.tooltip = tooltip ?? `${label} — ${note}`;
		item.command = command;
		return item;
	}
}
