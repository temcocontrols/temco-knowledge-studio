// The panel: the site's index, and the three things that change it.
//
// Names only. A row here is a place or an act — a project on the site, one of its versions, or a command — so nothing
// needs a sentence under it, and the folder the site lives in is not something to read on every glance. What a row
// does say is where it goes: Preview opens the portal, a project opens its page, a version opens the reader.

import * as vscode from 'vscode';
import { Site, SiteProject } from './site';

export const VIEW_ID = 'temcoLearn.panel';

/** A row that also knows which project it belongs to, so its versions can be drawn. */
interface Row extends vscode.TreeItem {
	project?: SiteProject;
}

export class SiteTree implements vscode.TreeDataProvider<Row>, vscode.Disposable {
	private readonly changed = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.changed.event;

	constructor(private readonly site: () => Promise<Site>) { }

	refresh(): void {
		this.changed.fire();
	}

	dispose(): void {
		this.changed.dispose();
	}

	getTreeItem(item: Row): vscode.TreeItem {
		return item;
	}

	async getChildren(item?: Row): Promise<Row[]> {
		if (item !== undefined) {
			return item.project === undefined ? [] : this.versions(item.project);
		}
		const site = await this.site();
		return [
			this.row('preview', 'Preview', 'open-preview', 'temcoLearn.preview', { page: 'index.html' }),
			...site.projects.map((project) => this.project(project)),
			this.row('build', 'Build', 'tools', 'temcoLearn.build'),
			this.row('add', 'Add to Site', 'add', 'temcoLearn.assemble'),
			this.row('publish', 'Publish', 'cloud-upload', 'temcoLearn.publish')
		];
	}

	/** A project: its page, and under it every version it has, newest first. */
	private project(project: SiteProject): Row {
		const item: Row = new vscode.TreeItem(
			project.title,
			project.versions.length > 1 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None
		);
		item.id = `temcoLearn.project.${project.id}`;
		item.iconPath = new vscode.ThemeIcon('book');
		item.contextValue = 'temcoLearn.project';
		item.project = project;
		item.command = {
			command: 'temcoLearn.preview',
			title: project.title,
			arguments: [{ page: `project.html?id=${encodeURIComponent(project.id)}` }]
		};
		return item;
	}

	private versions(project: SiteProject): Row[] {
		return project.versions.map((version) => {
			const item: Row = new vscode.TreeItem(version.version, vscode.TreeItemCollapsibleState.None);
			item.id = `temcoLearn.version.${project.id}.${version.version}`;
			item.iconPath = new vscode.ThemeIcon('tag');
			item.contextValue = 'temcoLearn.version';
			item.command = {
				command: 'temcoLearn.preview',
				title: version.version,
				arguments: [
					{ page: `reader.html?id=${encodeURIComponent(project.id)}&version=${encodeURIComponent(version.version)}` }
				]
			};
			return item;
		});
	}

	private row(key: string, label: string, mark: string, command: string, args?: { page: string }): Row {
		const item: Row = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
		item.id = `temcoLearn.${key}`;
		item.iconPath = new vscode.ThemeIcon(mark);
		item.command = { command, title: label, arguments: args === undefined ? [] : [args] };
		return item;
	}
}
