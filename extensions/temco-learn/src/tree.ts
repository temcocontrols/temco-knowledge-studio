// The panel: VS Code's own grouping, in VS Code's own tree.
//
// Each group is a *view* — a real section with its own header, its own collapse state, its own title-bar actions — not a
// row pretending to be a heading. A row is a name and a glyph, and what it holds is `description`: the grey words the
// Explorer writes beside a folder, never a badge of our own. Sentences belong on the Overview page, never in a row.
//
// Four views: the module's page as one row, **Browse** (the site as a whole, and the same pages project by project),
// **Download** (the files a build wrote) and **Next steps** (the acts, publishing among them).

import * as path from 'path';
import * as vscode from 'vscode';
import { Artifact, ArtifactKind, formatSize, isDownloadable, isPreviewable, nameOf } from './artifacts';
import { Build } from './builds';
import { shortName, SiteProject } from './site';
import { Snapshot } from './snapshot';
import { ago } from './state';

/** The four views this module contributes, by the ids its manifest declares. */
export const VIEWS = {
	overview: 'temcoLearn.overviewView',
	browse: 'temcoLearn.browse',
	download: 'temcoLearn.download',
	todo: 'temcoLearn.todo'
} as const;

/** A row that knows what hangs under it. */
interface Row extends vscode.TreeItem {
	/** The rows under this one, decided when the row is built. */
	kids?: Row[];
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

/** `3 versions` — how many things a row holds, in the words the Explorer writes beside a folder. */
const plural = (count: number, one: string, many?: string): string =>
	`${count} ${count === 1 ? one : many === undefined ? `${one}s` : many}`;

/** A row: the name, its glyph, and the grey words beside it that say what it holds. */
function row(label: string, icon: string, options: { description?: string; command?: vscode.Command; tooltip?: string } = {}): Row {
	const item: Row = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
	item.iconPath = new vscode.ThemeIcon(icon);
	if (options.description !== undefined) {
		item.description = options.description;
	}
	if (options.tooltip !== undefined) {
		item.tooltip = options.tooltip;
	}
	if (options.command !== undefined) {
		item.command = options.command;
	}
	return item;
}

/** A row that holds rows: a heading, the grey words beside it, and what hangs under it. */
function group(
	label: string,
	icon: string,
	options: {
		kids: Row[];
		description?: string;
		tooltip?: string;
		state?: vscode.TreeItemCollapsibleState;
		command?: vscode.Command;
	}
): Row {
	const item: Row = new vscode.TreeItem(label, options.state ?? vscode.TreeItemCollapsibleState.Collapsed);
	item.iconPath = new vscode.ThemeIcon(icon);
	item.kids = options.kids;
	if (options.description !== undefined) {
		item.description = options.description;
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

/* ---- Overview: the module's page, as one row ------------------------------------------------------------------ */

export class OverviewTree implements vscode.TreeDataProvider<Row> {
	private readonly changed = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.changed.event;

	refresh(): void {
		this.changed.fire();
	}

	getTreeItem(item: Row): vscode.TreeItem {
		return item;
	}

	async getChildren(item?: Row): Promise<Row[]> {
		if (item !== undefined) {
			return [];
		}
		const entry = row('Temco Learn', 'cloud-upload', {
			tooltip: 'Open the Overview page: what is on the website, what is waiting, and where it is published',
			command: { command: 'temcoLearn.overview', title: 'Open the Overview Page' }
		});
		entry.id = 'temcoLearn.overview.root';
		return [entry];
	}
}

/* ---- Browse: the whole site, the pages by project, and the dist sites ------------------------------------------ */

export class BrowseTree implements vscode.TreeDataProvider<Row> {
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
		if (item !== undefined) {
			return item.kids ?? [];
		}
		const data = await this.reads.data();
		return [this.theSite(), this.byProject(data)];
	}

	/** The site as a reader gets it: six sections over every published project, at one address. */
	private theSite(): Row {
		const entry = row('Preview the site', 'globe', {
			tooltip: 'The site readers open — Documentation, Training & Labs, Tests, Products, Q&A and Topics',
			command: { command: 'temcoLearn.preview', title: 'Preview the Site' }
		});
		entry.id = 'temcoLearn.browse.site';
		entry.contextValue = 'temcoLearn.browse.site';
		return entry;
	}

	/** The same pages, one project at a time. */
	private byProject(data: Snapshot): Row {
		const kids =
			data.site.projects.length === 0
				? [row('Nothing yet', 'info', { tooltip: 'Build a project in Temco Docs, then add the build here.' })]
				: data.site.projects.map((project, index) => this.project(project, index === 0));
		const entry = group('Preview by project', 'library', {
			description: plural(data.site.projects.length, 'project'),
			tooltip: 'The projects on the website, with every version they keep',
			kids,
			state: vscode.TreeItemCollapsibleState.Expanded
		});
		entry.id = 'temcoLearn.browse.projects';
		return entry;
	}

	/** One project: its versions, each with what it holds. The first project opens, so the view never reads as shut doors. */
	private project(project: SiteProject, open: boolean): Row {
		const kids = project.versions.map((version) => {
			const entry = row(version.version, 'tag', {
				tooltip: `Published ${version.builtAt === undefined ? 'at an unknown time' : ago(version.builtAt)}`,
				command: {
					command: 'temcoLearn.preview',
					title: version.version,
					arguments: [{ page: `reader.html?id=${encodeURIComponent(project.id)}&version=${encodeURIComponent(version.version)}` }]
				}
			});
			entry.id = `temcoLearn.browse.version.${project.id}.${version.version}`;
			entry.contextValue = 'temcoLearn.version';
			return entry;
		});
		const entry = group(shortName(project.title), 'file-directory', {
			description: plural(kids.length, 'version'),
			tooltip: `Read ${shortName(project.title)} on the website`,
			kids,
			state: open ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed,
			command: {
				command: 'temcoLearn.preview',
				title: project.title,
				arguments: [{ page: `project.html?id=${encodeURIComponent(project.id)}` }]
			}
		});
		entry.id = `temcoLearn.browse.project.${project.id}`;
		entry.contextValue = 'temcoLearn.project';
		return entry;
	}
}

/* ---- Download: the project name is the category -------------------------------------------------------------- */

export class DownloadTree implements vscode.TreeDataProvider<Row> {
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
		if (item !== undefined) {
			return item.kids ?? [];
		}
		const data = await this.reads.data();
		const rows: Row[] = [];
		for (const project of data.artifacts) {
			const shown = project.artifacts.filter(isDownloadable);
			if (shown.length === 0) {
				continue;
			}
			const entry = group(shortName(project.title), 'book', {
				description: plural(shown.length, 'file'),
				kids: shown.map((artifact) => this.artifact(artifact))
			});
			entry.id = `temcoLearn.download.${project.id}`;
			entry.contextValue = 'temcoLearn.download.project';
			rows.push(entry);
		}
		return rows.length === 0
			? [row('No file to take', 'info', { tooltip: 'A build writes these; build a project in Temco Docs.' })]
			: rows;
	}

	/** One file the build wrote: its name, and how big it is. */
	private artifact(artifact: Artifact): Row {
		const entry = row(nameOf(artifact), ICON[artifact.kind], {
			description: artifact.size === undefined ? undefined : formatSize(artifact.size),
			tooltip: artifact.file,
			command: { command: 'temcoLearn.downloadArtifact', title: 'Save a Copy', arguments: [artifact.file] }
		});
		entry.id = `temcoLearn.download.artifact.${artifact.file}`;
		entry.contextValue = isPreviewable(artifact) ? 'temcoLearn.artifact.look' : 'temcoLearn.artifact';
		entry.file = artifact.file;
		return entry;
	}
}
/* ---- Next steps: the acts, with how many things each one clears ------------------------------------------------ */

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
			const add = group('Waiting to be added', 'add', {
				description: plural(builds.length, 'build'),
				tooltip: 'Builds on disk that the website does not have yet',
				kids: builds.map((build) => this.build(build))
			});
			add.id = 'temcoLearn.todo.builds';
			add.contextValue = 'temcoLearn.todo.builds';
			rows.push(add);
		}
		rows.push(this.publish(data));
		rows.push(row('Build a project', 'tools', { command: { command: 'temcoDocs.builds', title: 'Build a Project in Temco Docs' }, tooltip: 'Building belongs to Temco Docs' }));
		if (builds.length === 0 && data.published.pending === 0) {
			return [row('Nothing to do', 'check', { tooltip: 'Everything built is on the website, and it is published' }), ...rows];
		}
		return rows;
	}

	/** Publishing is an act, so it lives with the acts: the first time, and again after a change. */
	private publish(data: Snapshot): Row {
		const published = data.published;
		const last = published.commit === undefined ? 'never published' : `last publish ${published.commit}, ${ago(published.at)}`;
		const entry = row('Publish', 'cloud-upload', {
			description: published.pending === 0 ? 'up to date' : plural(published.pending, 'change'),
			tooltip: `${published.base ?? 'no address yet'} · ${last} · publishes the site, or publishes it again after a change`,
			command: { command: 'temcoLearn.publish', title: 'Publish the Website' }
		});
		entry.id = 'temcoLearn.todo.publish';
		entry.contextValue = 'temcoLearn.publish';
		return entry;
	}

	/** The builds to add, under the finding that names them. */
	private under(item: Row, data: Snapshot): Row[] {
		return item.id === 'temcoLearn.todo.builds' ? waiting(data).map((build) => this.build(build)) : [];
	}

	/** One build waiting to be added: its name, and the act that adds it. */
	private build(build: Build): Row {
		const entry: Row = new vscode.TreeItem(build.title, vscode.TreeItemCollapsibleState.None);
		entry.id = `temcoLearn.todo.build.${build.folder}`;
		entry.iconPath = new vscode.ThemeIcon('package');
		entry.contextValue = 'temcoLearn.build';
		entry.tooltip = path.join(build.folder, 'index.html');
		entry.command = { command: 'temcoLearn.addBuild', title: 'Add to the Website', arguments: [build.folder] };
		return entry;
	}
}
