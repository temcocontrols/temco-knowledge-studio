// Temco Tools — the device and data surfaces, in one module until their own modules exist.
//
// The platform documents a `temcoTools` container "declared by the first tools module", and this is it: the six
// surfaces of Devices, the five of I/O Studio, BACnet Studio, Network and SQL Studio, each as a section of a page and
// each reachable from the side bar.
//
// **What is real and what is sample.** The pages, their navigation and their vocabulary are real — the same page kit
// the documentation pages use. The rows are the mock's sample, because the modules that will own these surfaces have
// no connection to a controller, a stack or a database yet; when one lands, it fills `src/data.ts` and nothing on the
// page has to be redesigned. Every page says so at the top rather than pretending the numbers are live.

import * as vscode from 'vscode';
import { page, pageColumn, runCommand } from './ui';
import {
	BACNET_SURFACES, DEVICE_SURFACES, IO_SURFACES, NETWORK_SURFACES, SQL_SURFACES, Surface, commandButton, studioPage
} from './pages';

type Studio = 'devices' | 'io' | 'bacnet' | 'network' | 'sql';

interface StudioDefinition {
	id: Studio;
	mark: string;
	title: string;
	desc: string;
	surfaces: Surface[];
	actions: string;
}

const STUDIOS: StudioDefinition[] = [
	{
		id: 'devices',
		mark: 'chip',
		title: 'Devices',
		desc: 'Every controller on the segment: what it runs, how many points it carries, and what it is complaining about.',
		surfaces: DEVICE_SURFACES,
		actions: commandButton('Firmware', 'temcoTools.open', ['devices', 'firmware'], 'ghost') + commandButton('Alarms', 'temcoTools.open', ['devices', 'health'])
	},
	{
		id: 'io',
		mark: 'plug',
		title: 'I/O Studio',
		desc: 'The points of one controller, where each one is mapped, and the logic that reads and writes them.',
		surfaces: IO_SURFACES,
		actions: commandButton('Points', 'temcoTools.open', ['io', 'points'], 'ghost') + commandButton('Mapping', 'temcoTools.open', ['io', 'mapping'])
	},
	{
		id: 'bacnet',
		mark: 'server',
		title: 'BACnet Studio',
		desc: 'What answers on the network, the objects each device publishes, and the alarms and histories that come with them.',
		surfaces: BACNET_SURFACES,
		actions: commandButton('Discovery', 'temcoTools.open', ['bacnet', 'discovery'], 'ghost') + commandButton('Objects', 'temcoTools.open', ['bacnet', 'objects'])
	},
	{
		id: 'network',
		mark: 'globe',
		title: 'Network',
		desc: 'Who is on the wire: ARP neighbours, Modbus units, reachability, and the captures that answered the question.',
		surfaces: NETWORK_SURFACES,
		actions: commandButton('Discovery', 'temcoTools.open', ['network', 'discovery'], 'ghost') + commandButton('Captures', 'temcoTools.open', ['network', 'captures'])
	},
	{
		id: 'sql',
		mark: 'database',
		title: 'SQL Studio',
		desc: 'The documentation registry as a database: its tables, the queries that answer questions about it, and their history.',
		surfaces: SQL_SURFACES,
		actions: commandButton('Query Editor', 'temcoTools.open', ['sql', 'query'], 'ghost') + commandButton('Schema', 'temcoTools.open', ['sql', 'schema'])
	}
];

/** One page per studio, kept open so a second visit reveals the tab rather than stacking another. */
class StudioPage {
	private readonly panels = new Map<Studio, vscode.WebviewPanel>();

	constructor(private readonly context: vscode.ExtensionContext) { }

	open(studio: Studio, surface?: string): void {
		const definition = STUDIOS.find((entry) => entry.id === studio);
		if (!definition) {
			return;
		}
		const existing = this.panels.get(studio);
		if (existing) {
			existing.reveal(pageColumn());
			existing.webview.html = this.html(definition, surface);
			return;
		}
		const panel = vscode.window.createWebviewPanel(`temcoTools.${studio}`, definition.title, pageColumn(), {
			enableScripts: true,
			localResourceRoots: []
		});
		panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'tools.svg');
		panel.onDidDispose(() => this.panels.delete(studio));
		panel.webview.onDidReceiveMessage((message: { type?: string; command?: string; args?: unknown }) => {
			// A button on the page asks for another *section* of the same page, so the studio and the surface travel
			// with the click; anything else is an ordinary command.
			if (message.type === 'command' && message.command === 'temcoTools.open') {
				const args = Array.isArray(message.args) ? message.args : [];
				if (typeof args[0] === 'string') {
					this.open(args[0] as Studio, typeof args[1] === 'string' ? args[1] : undefined);
					return;
				}
			}
			runCommand(message);
		});
		panel.webview.html = this.html(definition, surface);
		this.panels.set(studio, panel);
	}

	dispose(): void {
		for (const panel of this.panels.values()) {
			panel.dispose();
		}
		this.panels.clear();
	}

	private html(definition: StudioDefinition, surface: string | undefined): string {
		const open = surface ?? definition.surfaces[0].id;
		return page(studioPage(definition.title, definition.desc, definition.surfaces, open, definition.actions, definition.mark), {
			title: definition.title,
			script: commandScriptFor(definition.id)
		});
	}
}

/**
 * The shared script, with the studio and surface packed into every `temcoTools.open` click so a section button does
 * not have to know which page it is on.
 */
function commandScriptFor(studio: Studio): string {
	return `
(function () {
	const api = acquireVsCodeApi();
	document.addEventListener('click', (event) => {
		const target = event.target.closest('[data-command]');
		if (!target) { return; }
		event.preventDefault();
		let args;
		if (target.dataset.args) {
			args = JSON.parse(target.dataset.args);
		} else if (target.dataset.command === 'temcoTools.open') {
			args = ['${studio}'];
		}
		api.postMessage({ type: 'command', command: target.dataset.command, args: args });
	});
})();
`;
}

/** One view per studio: its surfaces, each opening the section it names. */
class SurfaceTree implements vscode.TreeDataProvider<vscode.TreeItem> {
	constructor(private readonly studio: Studio) { }

	getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(): vscode.TreeItem[] {
		const definition = STUDIOS.find((entry) => entry.id === this.studio);
		if (!definition) {
			return [];
		}
		return definition.surfaces.map((surface) => {
			const item = new vscode.TreeItem(surface.label, vscode.TreeItemCollapsibleState.None);
			item.description = surface.count;
			// The mock's side bar gives every row its own glyph; a bullet down the whole panel said
			// nothing about any of them.
			item.iconPath = new vscode.ThemeIcon(surface.mark);
			item.tooltip = `${surface.label} — ${surface.count}`;
			item.command = {
				command: 'temcoTools.open',
				title: surface.label,
				arguments: [this.studio, surface.id]
			};
			return item;
		});
	}
}

export function activate(context: vscode.ExtensionContext): void {
	const pages = new StudioPage(context);
	context.subscriptions.push(pages);

	context.subscriptions.push(
		vscode.commands.registerCommand('temcoTools.open', (studio?: unknown, surface?: unknown) => {
			pages.open(
				(typeof studio === 'string' ? studio : 'devices') as Studio,
				typeof surface === 'string' ? surface : undefined
			);
		})
	);

	for (const studio of STUDIOS) {
		context.subscriptions.push(
			vscode.window.createTreeView(`temcoTools.${studio.id}`, { treeDataProvider: new SurfaceTree(studio.id) })
		);
	}
}

export function deactivate(): void {
	// The panels and the views are the window's; every command was registered on the extension's own context.
}
