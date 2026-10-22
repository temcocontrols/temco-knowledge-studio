// Needs You — the only other view in the side bar, and the only one that is a queue rather than a place.
//
// A documentation tool's second surface is not another list of things that exist; it is the work the tool knows
// about and the person does not. Three kinds, and each one already has a command behind it:
//
//   * a screenshot with no page yet — taken with no page in front, waiting in the capture inbox;
//   * a page the code has moved away from — the product repo's own `stale` verdict, read and never recomputed;
//   * pages that have never been reviewed — one row with a count, because forty rows is a report, not a to-do.
//
// Nothing here writes, and nothing here is a destination: every row runs a command that already existed, and the
// work leaves the list when the fact behind it changes. That is why there is no *refresh* of its own — the
// module's refresh already redraws it.

import * as path from 'path';
import * as vscode from 'vscode';
import { capturesOf } from './media';
import { DocsRoot, collectPages } from './registry';
import { firstVersionReport } from './versionReport';

/** How many stale pages are worth listing before the report is the better answer. */
const STALE_SHOWN = 12;

export interface QueueDeps {
	roots: () => readonly DocsRoot[];
}

/** A heading with children that are read when it opens, so the view does not read the disk to draw a label. */
class QueueGroup extends vscode.TreeItem {
	constructor(label: string, private readonly load: () => Promise<vscode.TreeItem[]>) {
		super(label, vscode.TreeItemCollapsibleState.Expanded);
		this.contextValue = 'queueGroup';
		// The group itself opens the queue as a page: the tree is the summary, the page is where the acts are read.
		this.command = { command: 'temcoDocs.needsPage', title: 'Open Needs You' };
	}

	getChildren(): Promise<vscode.TreeItem[]> {
		return this.load();
	}
}

export class QueueTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
	private readonly changed = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.changed.event;

	constructor(private readonly deps: QueueDeps) { }

	refresh(): void {
		this.changed.fire();
	}

	getTreeItem(item: vscode.TreeItem): vscode.TreeItem {
		return item;
	}

	async getChildren(item?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
		if (item instanceof QueueGroup) {
			return item.getChildren();
		}
		if (item !== undefined) {
			return [];
		}

		const roots = this.deps.roots();
		const captures = await capturesOf(roots);
		const pages = roots.flatMap((root) => collectPages(root));
		const stale = pages.filter((page) => page.provenance?.stale === true);
		const unreviewed = pages.filter((page) => page.reviewed === null).length;
		const version = await firstVersionReport(roots);
		const changed = version?.report.changed ?? [];
		const retake = version?.report.retake ?? [];

		const groups: QueueGroup[] = [];

		if (changed.length > 0 || retake.length > 0) {
			// One shape for both halves of the report: a page, and the sentence that says why it is here.
			const reportRows = [
				...retake.map((row) => ({ page: row.page, title: row.title, note: row.note ?? 'retake the screenshot' })),
				...changed.map((row) => ({ page: row.page, title: row.title, note: (row.code ?? []).join(' · ') || 'the code moved' })),
			];
			groups.push(new QueueGroup(
				`Changed by ${version?.report.version ?? 'the new version'}`,
				async () => reportRows.slice(0, STALE_SHOWN).map((row) => {
					const page = row.page === undefined ? undefined : pages.find((entry) => entry.id === row.page);
					const item = new vscode.TreeItem(row.title ?? page?.title ?? row.page ?? 'a page', vscode.TreeItemCollapsibleState.None);
					item.iconPath = new vscode.ThemeIcon('versions');
					item.description = row.note;
					item.tooltip = 'Named by the release workflow, not inferred here.';
					if (page !== undefined) {
						item.command = { command: 'temcoDocs.openFile', title: String(item.label), arguments: [page.uri.fsPath] };
					}
					return item;
				})
			));
		}

		if (captures.length > 0) {
			groups.push(new QueueGroup(
				`${captures.length} screenshot${captures.length === 1 ? '' : 's'} to place`,
				async () => captures.map((capture) => {
					const row = new vscode.TreeItem(
						path.basename(capture.uri.fsPath),
						vscode.TreeItemCollapsibleState.None
					);
					row.iconPath = new vscode.ThemeIcon('device-camera');
					row.description = 'no page yet';
					row.tooltip = `${capture.uri.fsPath}\nAttach it to a page and it lands in that page’s media/.`;
					row.contextValue = 'capture';
					row.command = {
						command: 'temcoDocs.attachCapture',
						title: 'Attach to a Page…',
						arguments: [capture.uri.fsPath],
					};
					return row;
				})
			));
		}

		if (stale.length > 0) {
			groups.push(new QueueGroup(
				`${stale.length} page${stale.length === 1 ? '' : 's'} the code moved away from`,
				async () => {
					const rows = stale.slice(0, STALE_SHOWN).map((page) => {
						const row = new vscode.TreeItem(page.title, vscode.TreeItemCollapsibleState.None);
						row.iconPath = new vscode.ThemeIcon('warning');
						row.description = page.area;
						row.tooltip = `${page.id}\nIts code globs changed after the page was last reviewed.`;
						row.command = { command: 'temcoDocs.openFile', title: page.title, arguments: [page.uri.fsPath] };
						return row;
					});
					if (stale.length > rows.length) {
						const more = new vscode.TreeItem(
							`…and ${stale.length - rows.length} more`,
							vscode.TreeItemCollapsibleState.None
						);
						more.iconPath = new vscode.ThemeIcon('list-unordered');
						more.command = { command: 'temcoDocs.stalenessReport', title: 'Open the report' };
						rows.push(more);
					}
					return rows;
				}
			));
		}

		if (unreviewed > 0) {
			groups.push(new QueueGroup(
				`${unreviewed} page${unreviewed === 1 ? '' : 's'} never reviewed`,
				async () => {
					const row = new vscode.TreeItem('Open the staleness report', vscode.TreeItemCollapsibleState.None);
					row.iconPath = new vscode.ThemeIcon('checklist');
					row.tooltip = 'The pages that need attention, grouped by owner. Nothing is written.';
					row.command = { command: 'temcoDocs.stalenessReport', title: 'Open the report' };
					return [row];
				}
			));
		}

		if (groups.length > 0) {
			return groups;
		}

		const nothing = new vscode.TreeItem('Nothing waiting', vscode.TreeItemCollapsibleState.None);
		nothing.iconPath = new vscode.ThemeIcon('check');
		nothing.description = 'Ctrl+Alt+S captures a screen into the page';
		nothing.tooltip = 'Captures with no page, pages the code moved away from, and pages never reviewed land here.';
		return [nothing];
	}
}
