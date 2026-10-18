// Temco Tools — the device and data surfaces, one container each until their own modules exist.
//
// Five studios, each with its own side-bar groups and its own pages:
//
//   * **Devices** — Fleet and Data, six pages;
//   * **I/O Studio** — Engineering and Live, five pages;
//   * **BACnet Studio** — Network and History, five pages;
//   * **Network** — Tools and Traffic, four pages;
//   * **SQL Studio** — Workbench and Docs Database, six pages.
//
// Every one of them was a folded section of a single page until the mock's side bar was taken seriously: each row has
// its own title, its own count where the count means something, and its own actions, and a folded section cannot carry
// any of those. Each studio owns its pages (`devices.ts`, `io.ts`, `bacnet.ts`, `network.ts`, `sql.ts`) and its sample;
// this file is only the wiring — the activation and the views.
//
// **What is real and what is sample.** The pages, their navigation, their vocabulary and their buttons are real: a
// button asks, changes the studio's register, re-renders and reports what it changed. The rows are the mock's sample,
// because the modules that will own these surfaces have no socket to a controller, no BACnet stack, no capture device
// and no database driver yet. Every page says so at the foot rather than pretending the numbers are live.

import * as vscode from 'vscode';
import { BACNET_PAGES, registerBacnet } from './bacnet';
import { ALARMS, DEVICES } from './data';
import { DEVICE_PAGES, onDidChangeDevices, registerDevices } from './devices';
import { IO_PAGES, registerIo } from './io';
import { NETWORK_PAGES, registerNetwork } from './network';
import { SQL_PAGES, registerSql } from './sql';

/** One row of a studio's side bar: the label, the sentence behind it, and the glyph. */
interface StudyRow {
	label: string;
	note: string;
	mark: string;
	command: string;
}

/**
 * A studio's side-bar view: one row per page, no counts.
 *
 * None of these rows carries a count in the mock: a point count or a table count is already in the page head, and the
 * side bar would only repeat what the page it opens says. The row's sentence is the tooltip, as everywhere else.
 */
class PagesTree implements vscode.TreeDataProvider<vscode.TreeItem> {
	constructor(private readonly rows: StudyRow[]) { }

	getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(): vscode.TreeItem[] {
		return this.rows.map((row) => {
			const item = new vscode.TreeItem(row.label, vscode.TreeItemCollapsibleState.None);
			item.iconPath = new vscode.ThemeIcon(row.mark);
			item.tooltip = `${row.label} — ${row.note}`;
			item.command = { command: row.command, title: row.label };
			return item;
		});
	}
}

/**
 * The Devices container's two views — the mock's **Fleet** and **Data**.
 *
 * The mock's side bar puts a count beside two of the six rows (the fleet, and the conditions that are still true),
 * and none beside the rest: a number that is always there stops meaning anything. The row's own sentence is the
 * tooltip, as it is on every other side bar of the application.
 */
class DevicesTree implements vscode.TreeDataProvider<vscode.TreeItem> {
	private readonly emitter = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.emitter.event;

	constructor(private readonly group: 'fleet' | 'data') { }

	/** Re-reads the counts: a controller added or a condition acknowledged is a different panel. */
	refresh(): void {
		this.emitter.fire();
	}

	getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(): vscode.TreeItem[] {
		return DEVICE_PAGES.filter((entry) => entry.group === this.group).map((entry) => {
			const item = new vscode.TreeItem(entry.label, vscode.TreeItemCollapsibleState.None);
			item.iconPath = new vscode.ThemeIcon(entry.mark);
			item.tooltip = `${entry.label} — ${entry.note}`;
			if (entry.id === 'all') {
				item.description = String(DEVICES.length);
			}
			if (entry.id === 'health') {
				const active = ALARMS.filter((alarm) => alarm.state === 'Active').length;
				item.description = active > 0 ? String(active) : undefined;
			}
			item.command = { command: entry.command, title: entry.label };
			return item;
		});
	}
}

export function activate(context: vscode.ExtensionContext): void {
	const devices = registerDevices(context);
	const io = registerIo(context);
	const bacnet = registerBacnet(context);
	const network = registerNetwork(context);
	const sql = registerSql(context);

	const fleet = new DevicesTree('fleet');
	const data = new DevicesTree('data');
	context.subscriptions.push(
		devices.pages,
		...devices.disposables,
		io.pages,
		...io.disposables,
		bacnet.pages,
		...bacnet.disposables,
		network.pages,
		...network.disposables,
		sql.pages,
		...sql.disposables,
		vscode.window.createTreeView('temcoTools.devicesFleet', { treeDataProvider: fleet }),
		vscode.window.createTreeView('temcoTools.devicesData', { treeDataProvider: data }),
		vscode.window.createTreeView('temcoTools.ioEngineering', { treeDataProvider: new PagesTree(IO_PAGES.filter((entry) => entry.group === 'engineering')) }),
		vscode.window.createTreeView('temcoTools.ioLive', { treeDataProvider: new PagesTree(IO_PAGES.filter((entry) => entry.group === 'live')) }),
		vscode.window.createTreeView('temcoTools.bacnetNetwork', { treeDataProvider: new PagesTree(BACNET_PAGES.filter((entry) => entry.group === 'network')) }),
		vscode.window.createTreeView('temcoTools.bacnetHistory', { treeDataProvider: new PagesTree(BACNET_PAGES.filter((entry) => entry.group === 'history')) }),
		vscode.window.createTreeView('temcoTools.networkTools', { treeDataProvider: new PagesTree(NETWORK_PAGES.filter((entry) => entry.group === 'tools')) }),
		vscode.window.createTreeView('temcoTools.networkTraffic', { treeDataProvider: new PagesTree(NETWORK_PAGES.filter((entry) => entry.group === 'traffic')) }),
		vscode.window.createTreeView('temcoTools.sqlWorkbench', { treeDataProvider: new PagesTree(SQL_PAGES.filter((entry) => entry.group === 'workbench')) }),
		vscode.window.createTreeView('temcoTools.sqlDocs', { treeDataProvider: new PagesTree(SQL_PAGES.filter((entry) => entry.group === 'docs')) }),
		onDidChangeDevices(() => {
			fleet.refresh();
			data.refresh();
		})
	);
}

export function deactivate(): void {
	// The panels and the views are the window's; every command was registered on the extension's own context.
}
