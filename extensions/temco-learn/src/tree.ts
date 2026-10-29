// The panel: VS Code's own grouping, the way Home ▸ Overview does it.
//
// Each group is a *view* — a real section with its own header, its own collapse state, its own title-bar actions — not a
// row pretending to be a heading. A row is a name and an icon; the one thing a row shows besides its name is a number,
// and that number sits at the row's right edge as a badge (a `FileDecoration`), the way Home counts projects and pages.
// Sentences belong on the Overview page, never in a row.

import * as path from 'path';
import * as vscode from 'vscode';
import { Artifact, ArtifactKind, formatSize, isDownloadable, isPreviewable, nameOf } from './artifacts';
import { SiteProject } from './site';
import { Snapshot } from './snapshot';
import { ago } from './state';

/** The four views this module contributes, by the ids its manifest declares. */
export const VIEWS = {
	overview: 'temcoLearn.overviewView',
	projects: 'temcoLearn.projects',
	preview: 'temcoLearn.preview',
	download: 'temcoLearn.download',
	todo: 'temcoLearn.todo'
} as const;

/** What a row's click means in Preview and Download: looking at something, or taking a copy of it. */
type Intent = 'preview' | 'download';

/** A row that knows what hangs under it. */
interface Row extends vscode.TreeItem {
	root?: boolean;
	artifacts?: Artifact[];
	intent?: Intent;
	/** The file the row stands for, so a context-menu command can find it. */
	file?: string;
}

/** The glyph for each kind of build output. */
const ICON: Record<ArtifactKind, string> = {
	site: 'globe',
	chm: 'book',
	pdf: 'file-pdf',
	page: 'file-code',
	zip: 'file-zip',
	docx: 'file-text'
};

const COUNT_SCHEME = 'temco-learn-count';

/** The number, as the badge a row pushes to its right edge — a description would sit beside the label instead. */
function badge(text: string, key: string): vscode.Uri {
	return vscode.Uri.parse(`${COUNT_SCHEME}:/${encodeURIComponent(text)}/${encodeURIComponent(key)}`);
}

/** Teaches the workbench to draw the counts. Registered once, by the module's activation. */
export function registerCounts(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.window.registerFileDecorationProvider({
			provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
				if (uri.scheme !== COUNT_SCHEME) {
					return undefined;
				}
				const text = decodeURIComponent(uri.path.split('/')[1] ?? '');
				return text.length === 0 ? undefined : { badge: text, tooltip: text };
			}
		})
	);
}

/** A row: the name, its glyph, and — when there is one — the number at its right edge. */
function row(label: string, icon: string, options: { count?: string; command?: vscode.Command; tooltip?: string } = {}): Row {
	const item: Row = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
	item.iconPath = new vscode.ThemeIcon(icon);
	if (options.count !== undefined) {
		item.resourceUri = badge(options.count, label);
	}
	if (options.tooltip !== undefined) {
		item.tooltip = options.tooltip;
	}
	if (options.command !== undefined) {
		item.command = options.command;
	}
	return item;
}

/** One read per refresh, shared by the four views, so a panel and a page can never disagree. */
export class Reads {
	private reading: Promise<Snapshot> | undefined;

	constructor(private readonly read: () => Promise<Snapshot>) { }

	data(): Promise<Snapshot> {
		if (this.reading === undefined) {
			this.reading = this.read().catch((error: unknown) => {
				this.reading = undefined;
				throw error;
			});
		}
		return this.reading;
	}

	forget(): void {
		this.reading = undefined;
	}
}

/** The number of a project's versions, in a form a badge can take. */
const versionsOf = (project: SiteProject): number => project.versions.length;

/** The builds newer than what the website holds: those are the ones worth adding. */
function waiting(data: Snapshot): Snapshot['builds'] {
	return data.builds.filter((build) => {
		const project = data.site.projects.find((entry) => entry.id === build.id);
		if (project === undefined) {
			return true;
		}
		const newest = project.versions[0]?.builtAt;
		return newest === undefined || build.at > Date.parse(newest);
	});
}

/* ---- Overview: the platform's facts, one row each ------------------------------------------------------------- */

export class OverviewTree implements vscode.TreeDataProvider<Row> {
	private readonly changed = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.changed.event;

	constructor(private readonly reads: Reads) { }

	refresh(): void {
		this.changed.fire();
	}

	getTreeItem(item: Row): vscode.TreeItem {
		return item;
	}

	async getChildren(item?: Row): Promise<Row[]> {
		if (item === undefined) {
			const root: Row = new vscode.TreeItem('Temco Learn', vscode.TreeItemCollapsibleState.Expanded);
			root.root = true;
			root.id = 'temcoLearn.overview.root';
			root.iconPath = new vscode.ThemeIcon('cloud-upload');
			root.tooltip = 'What is on the website, what is waiting, and where it is published';
			root.command = { command: 'temcoLearn.overview', title: 'How Temco Learn Works' };
			return [root];
		}
		return item.root === true ? this.facts() : [];
	}

	private async facts(): Promise<Row[]> {
		const data = await this.reads.data();
		const pages = data.site.projects.reduce(
			(total, project) => total + project.versions.reduce((count, version) => count + version.pages.length, 0),
			0
		);
		const versions = data.site.projects.reduce((total, project) => total + versionsOf(project), 0);
		const last = data.published.commit === undefined ? 'never' : ago(data.published.at);
		return [
			row('Projects', 'book', { count: String(data.site.projects.length), command: { command: `${VIEWS.projects}.focus`, title: 'Projects' } }),
			row('Versions', 'tag', { count: String(versions), command: { command: `${VIEWS.projects}.focus`, title: 'Versions' } }),
			row('Pages', 'file', { count: String(pages), command: { command: 'temcoLearn.preview', title: 'Read the Website' } }),
			row('Waiting to be added', 'add', { count: String(waiting(data).length), command: { command: `${VIEWS.todo}.focus`, title: 'What Needs Doing' } }),
			row('Not published', 'cloud-upload', { count: String(data.published.pending), command: { command: `${VIEWS.todo}.focus`, title: 'What Needs Doing' } }),
			row('Last publish', 'repo', { count: last === 'never' ? 'never' : last.replace(' ago', ''), command: { command: 'temcoLearn.openPublished', title: 'Open the Published Website' } })
		];
	}
}

/* ---- Projects: the website's projects, and the versions of each ------------------------------------------------ */

export class ProjectsTree implements vscode.TreeDataProvider<Row> {
	private readonly changed = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.changed.event;

	constructor(private readonly reads: Reads) { }

	refresh(): void {
		this.changed.fire();
	}

	getTreeItem(item: Row): vscode.TreeItem {
		return item;
	}

	async getChildren(item?: Row): Promise<Row[]> {
		const data = await this.reads.data();
		if (item !== undefined) {
			return (item as Row & { project?: SiteProject }).project === undefined ? [] : this.versions((item as Row & { project: SiteProject }).project);
		}
		if (data.site.projects.length === 0) {
			return [row('Nothing yet', 'info', { tooltip: 'Build a project in Temco Docs, then add the build here.' })];
		}
		return data.site.projects.map((project) => {
			const entry: Row & { project?: SiteProject } = new vscode.TreeItem(
				project.title,
				project.versions.length > 1 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None
			);
			entry.id = `temcoLearn.project.${project.id}`;
			entry.iconPath = new vscode.ThemeIcon('book');
			entry.contextValue = 'temcoLearn.project';
			entry.project = project;
			entry.resourceUri = badge(String(versionsOf(project)), project.title);
			entry.command = {
				command: 'temcoLearn.preview',
				title: project.title,
				arguments: [{ page: `project.html?id=${encodeURIComponent(project.id)}` }]
			};
			return entry;
		});
	}

	private versions(project: SiteProject): Row[] {
		return project.versions.map((version) => {
			const entry: Row = new vscode.TreeItem(version.version, vscode.TreeItemCollapsibleState.None);
			entry.id = `temcoLearn.version.${project.id}.${version.version}`;
			entry.iconPath = new vscode.ThemeIcon('tag');
			entry.contextValue = 'temcoLearn.version';
			entry.resourceUri = badge(String(version.pages.length), `${project.id}-${version.version}`);
			entry.command = {
				command: 'temcoLearn.preview',
				title: version.version,
				arguments: [{ page: `reader.html?id=${encodeURIComponent(project.id)}&version=${encodeURIComponent(version.version)}` }]
			};
			return entry;
		});
	}
}

/* ---- Preview and Download: the project name is the category --------------------------------------------------- */

export class ArtifactsTree implements vscode.TreeDataProvider<Row> {
	private readonly changed = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.changed.event;

	constructor(private readonly reads: Reads, private readonly intent: Intent) { }

	refresh(): void {
		this.changed.fire();
	}

	getTreeItem(item: Row): vscode.TreeItem {
		return item;
	}

	async getChildren(item?: Row): Promise<Row[]> {
		const data = await this.reads.data();
		if (item !== undefined) {
			return item.artifacts === undefined ? [] : item.artifacts.map((artifact) => this.artifact(artifact));
		}
		const keep = this.intent === 'preview' ? isPreviewable : isDownloadable;
		const rows: Row[] = [];
		for (const project of data.artifacts) {
			const shown = project.artifacts.filter(keep);
			if (shown.length === 0) {
				continue;
			}
			const entry: Row = new vscode.TreeItem(project.title, vscode.TreeItemCollapsibleState.Collapsed);
			entry.id = `temcoLearn.${this.intent}.${project.id}`;
			entry.iconPath = new vscode.ThemeIcon('book');
			entry.contextValue = `temcoLearn.${this.intent}.project`;
			entry.resourceUri = badge(String(shown.length), `${this.intent}-${project.id}`);
			entry.artifacts = shown;
			entry.intent = this.intent;
			rows.push(entry);
		}
		return rows.length === 0
			? [row(this.intent === 'preview' ? 'Nothing to look at' : 'No file to take', 'info', { tooltip: 'A build writes these; build a project in Temco Docs.' })]
			: rows;
	}

	/** One file the build wrote: its name, and for a download how big it is. */
	private artifact(artifact: Artifact): Row {
		const entry: Row = new vscode.TreeItem(nameOf(artifact), vscode.TreeItemCollapsibleState.None);
		entry.id = `temcoLearn.${this.intent}.artifact.${artifact.file}`;
		entry.iconPath = new vscode.ThemeIcon(ICON[artifact.kind]);
		entry.contextValue = 'temcoLearn.artifact';
		entry.file = artifact.file;
		entry.tooltip = artifact.file;
		if (this.intent === 'download' && artifact.size !== undefined) {
			entry.resourceUri = badge(formatSize(artifact.size), artifact.file);
		}
		entry.command = {
			command: this.intent === 'preview' ? 'temcoLearn.previewArtifact' : 'temcoLearn.downloadArtifact',
			title: this.intent === 'preview' ? 'Look at It' : 'Save a Copy',
			arguments: [artifact.file]
		};
		return entry;
	}
}

/* ---- What needs doing: the acts, with how many things each one clears ------------------------------------------ */

export class TodoTree implements vscode.TreeDataProvider<Row> {
	private readonly changed = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.changed.event;

	constructor(private readonly reads: Reads) { }

	refresh(): void {
		this.changed.fire();
	}

	getTreeItem(item: Row): vscode.TreeItem {
		return item;
	}

	async getChildren(item?: Row): Promise<Row[]> {
		const data = await this.reads.data();
		if (item !== undefined) {
			return this.under(item, data);
		}
		const builds = waiting(data);
		const rows: Row[] = [];
		if (builds.length > 0) {
			const add: Row = new vscode.TreeItem('Waiting to be added', vscode.TreeItemCollapsibleState.Collapsed);
			add.id = 'temcoLearn.todo.builds';
			add.iconPath = new vscode.ThemeIcon('add');
			add.contextValue = 'temcoLearn.todo.builds';
			add.resourceUri = badge(String(builds.length), 'waiting');
			rows.push(add);
		}
		if (data.published.pending > 0) {
			const publish: Row = new vscode.TreeItem('Not published', vscode.TreeItemCollapsibleState.Collapsed);
			publish.id = 'temcoLearn.todo.publish';
			publish.iconPath = new vscode.ThemeIcon('cloud-upload');
			publish.contextValue = 'temcoLearn.todo.publish';
			publish.resourceUri = badge(String(data.published.pending), 'changes');
			rows.push(publish);
		}
		rows.push(row('Build a project', 'tools', { command: { command: 'temcoDocs.builds', title: 'Build a Project in Temco Docs' }, tooltip: 'Building belongs to Temco Docs' }));
		if (builds.length === 0 && data.published.pending === 0) {
			return [row('Nothing to do', 'check', { tooltip: 'Everything built is on the website, and it is published' }), ...rows];
		}
		return rows;
	}

	/** The acts under a finding: the builds to add, or the publish that clears the changes. */
	private under(item: Row, data: Snapshot): Row[] {
		if (item.id === 'temcoLearn.todo.builds') {
			return waiting(data).map((build) => {
				const entry: Row = new vscode.TreeItem(build.title, vscode.TreeItemCollapsibleState.None);
				entry.id = `temcoLearn.todo.build.${build.folder}`;
				entry.iconPath = new vscode.ThemeIcon('package');
				entry.contextValue = 'temcoLearn.build';
				entry.tooltip = path.join(build.folder, 'index.html');
				entry.command = { command: 'temcoLearn.addBuild', title: 'Add to the Website', arguments: [build.folder] };
				return entry;
			});
		}
		if (item.id === 'temcoLearn.todo.publish') {
			return [row('Publish the website', 'cloud-upload', { command: { command: 'temcoLearn.publish', title: 'Publish the Website' } })];
		}
		return [];
	}
}
