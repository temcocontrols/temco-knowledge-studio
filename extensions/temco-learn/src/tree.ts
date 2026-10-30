// The panel: VS Code's own grouping, in VS Code's own tree.
//
// Each group is a *view* — a real section with its own header, its own collapse state, its own title-bar actions — not a
// row pretending to be a heading. A row is a name and a glyph, and what it holds is `description`: the grey words the
// Explorer writes beside a folder, never a badge of our own. Sentences belong on the Overview page, never in a row.
//
// Four views: the module's page as one row, **Browse** (the site's own servers, and the projects on the site),
// **Download** (the files a build wrote) and **Next steps** (the acts, publishing among them).

import * as path from 'path';
import * as vscode from 'vscode';
import { Artifact, ArtifactKind, formatSize, isDownloadable, isPreviewable, nameOf } from './artifacts';
import { Build } from './builds';
import { shortName, SiteProject } from './site';
import { repoReady, siteRepo } from './siteRepo';
import { describe, SiteStatus } from './siteRunner';
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

/* ---- Browse: the site's own processes, and the projects on it ------------------------------------------------- */

export class BrowseTree implements vscode.TreeDataProvider<Row> {
	private readonly changed = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.changed.event;

	constructor(private readonly reads: Reads, private readonly site: () => SiteStatus) { }

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
		return [this.theSite(), this.projects(data)];
	}

	/** The site itself: the two ways of running it, the acts that keep it up to date, and where the source is. */
	private theSite(): Row {
		const status = this.site();
		const ready = repoReady(siteRepo());
		const entry = group('Site', 'library', {
			description: ready ? describe(status) : 'not configured',
			tooltip: ready
				? status.reason ?? 'The site repository: run it, build it, and open the folder it lives in'
				: siteRepo() + ' is not the clone of temcocontrols/temco-learn',
			state: vscode.TreeItemCollapsibleState.Expanded,
			kids: this.rows()
		});
		entry.id = 'temcoLearn.browse.site';
		return entry;
	}

	/** The rows of the Site group: one way of running the site here, one for editing it, then the acts. */
	private rows(): Row[] {
		const status = this.site();
		const running = status.state === 'running' || status.state === 'starting';

		if (!repoReady(siteRepo())) {
			const choose = row('Choose the Site Folder…', 'folder-library', {
				tooltip: 'Point Temco Learn at the clone of temcocontrols/temco-learn',
				command: { command: 'temcoLearn.site.choose', title: 'Choose the Site Folder' }
			});
			choose.id = 'temcoLearn.browse.site.choose';
			return [choose];
		}

		const preview = row('Preview', 'globe', {
			description: 'localhost:1011',
			tooltip: 'Run the built site and show it here — the site readers get, at the address it is served from',
			command: { command: 'temcoLearn.site.preview', title: 'Preview the Site' }
		});
		preview.id = 'temcoLearn.browse.site.preview';

		const development = row('Development', 'code', {
			description: 'localhost:3003',
			tooltip: 'Run the development server, for editing the site repository itself',
			command: { command: 'temcoLearn.site.dev', title: 'Start the Development Server' }
		});
		development.id = 'temcoLearn.browse.site.dev';

		const browser = row('Open in Browser', 'link-external', {
			description: 'localhost:1011',
			tooltip: 'Open the running site in the browser rather than in the editor',
			command: { command: 'temcoLearn.site.open', title: 'Open the Site in the Browser' }
		});
		browser.id = 'temcoLearn.browse.site.open';

		const build = row('Build', 'tools', {
			tooltip: 'Build the site: the catalog, the search index, then the bundle Vite writes to dist/',
			command: { command: 'temcoLearn.site.build', title: 'Build the Site' }
		});
		build.id = 'temcoLearn.browse.site.build';

		const install = row('Install Dependencies', 'package', {
			tooltip: 'Run npm install in the site repository, when a clone is new',
			command: { command: 'temcoLearn.site.install', title: 'Install the Site Dependencies' }
		});
		install.id = 'temcoLearn.browse.site.install';

		const stop = row('Stop', 'debug-stop', {
			description: running ? 'running' : 'not running',
			tooltip: 'Stop the server, whichever of the two is running',
			command: { command: 'temcoLearn.site.stop', title: 'Stop the Site' }
		});
		stop.id = 'temcoLearn.browse.site.stop';

		const folder = row('Source Folder', 'folder-opened', {
			description: path.basename(siteRepo()),
			tooltip: siteRepo(),
			command: { command: 'temcoLearn.site.folder', title: 'Open the Site Folder' }
		});
		folder.id = 'temcoLearn.browse.site.folder';

		return [preview, development, browser, build, install, stop, folder];
	}

	/** The projects on the site, with every version each one keeps. */
	private projects(data: Snapshot): Row {
		const kids =
			data.site.projects.length === 0
				? [row('Nothing on the site yet', 'info', { tooltip: 'Add a build, or write a page under content/ in the site repository.' })]
				: data.site.projects.map((project, index) => this.project(project, index === 0));
		const entry = group('Projects', 'file-directory', {
			description: plural(data.site.projects.length, 'project'),
			tooltip: 'The projects the site serves, with every version each one keeps',
			kids,
			state: vscode.TreeItemCollapsibleState.Expanded
		});
		entry.id = 'temcoLearn.browse.projects';
		return entry;
	}

	/** One project: its versions. The first project opens, so the view never reads as shut doors. */
	private project(project: SiteProject, open: boolean): Row {
		const kids = project.versions.map((version) => {
			const entry = row(version.version, 'tag', {
				description: plural(version.pages.length, 'page'),
				tooltip: 'Written ' + (version.builtAt === undefined ? 'at an unknown time' : ago(version.builtAt)),
				command: {
					command: 'temcoLearn.site.preview',
					title: project.title + ' ' + version.version,
					arguments: [{ project: project.id, version: version.version }]
				}
			});
			entry.id = 'temcoLearn.browse.version.' + project.id + '.' + version.version;
			entry.contextValue = 'temcoLearn.version';
			return entry;
		});
		const entry = group(shortName(project.title), 'book', {
			description: plural(kids.length, 'version'),
			tooltip: 'Read ' + shortName(project.title) + ' on the site',
			kids,
			state: open ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed,
			command: {
				command: 'temcoLearn.site.preview',
				title: project.title,
				arguments: [{ project: project.id }]
			}
		});
		entry.id = 'temcoLearn.browse.project.' + project.id;
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
			? [
					row('No file to take', 'info', {
						tooltip: 'Open the Downloads page: what a build writes, and where it lands',
						command: { command: 'temcoLearn.downloads', title: 'Downloads' }
					})
				]
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
			command: { command: 'temcoLearn.publishing', title: 'Publishing' }
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
