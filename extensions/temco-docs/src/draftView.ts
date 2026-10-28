/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Temco Controls. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// **Page properties** — a sheet, not a form.
//
// It began as a *Draft* panel in the side bar, then a Properties form with a Save button. The button was the problem:
// `docs/help/registry.json` is written by the generator, the moves and the renames, so a save from here was a second
// writer whose only certain outcome was a value that disagreed with the file after the next run. A sheet cannot
// disagree with anything — it reads the entry of the page in front and shows it beside that page, and the two things a
// person actually needs are one click away: the registry file, and the page.

import * as vscode from 'vscode';
import { PropertyRow, describe, locate, placement } from './pageProperties';
import { DocsRoot, PageEntry } from './registry';
import { RegistryEdit } from './registryEdit';
import { escapeHtml as esc } from './ui';

export interface PropertiesDeps {
	/** The page in front, or the row the tree has selected — the rule every command here follows. */
	page: () => PageEntry | undefined;
	/** The roots the page belongs to, so the sheet can find its registry. */
	roots: () => readonly DocsRoot[];
}

interface PanelMessage {
	command?: unknown;
	args?: unknown;
	type?: unknown;
}

export class PagePropertiesPanel {
	static readonly VIEW_TYPE = 'temcoDocs.properties';

	private panel: vscode.WebviewPanel | undefined;

	constructor(private readonly deps: PropertiesDeps) { }

	/** Opens the properties of the page in front, in a tab beside it. One tab, reused while it is open. */
	async show(): Promise<void> {
		const page = this.deps.page();
		if (page === undefined) {
			void vscode.window.showInformationMessage(
				'Temco Docs: open a page first — these are that page’s registry properties.'
			);
			return;
		}
		const panel = this.panel ?? await this.create(page);
		panel.title = title(page);
		panel.reveal(panel.viewColumn, false);
		await this.render();
	}

	/** Redraws the sheet if it is open; called whenever the registry or the page in front changes. */
	refresh(): void {
		void this.render();
	}

	/**
	 * A tab opens at half the window, because the grid splits the active group evenly. `vscode.setEditorLayout` is the
	 * only way to ask for another proportion — and it lays out *every* group, so it runs only when the window has a
	 * single one: the page keeps the room and the sheet gets a narrow column of its own.
	 */
	private async narrowColumn(): Promise<vscode.ViewColumn> {
		if (vscode.window.tabGroups.all.length !== 1) {
			return vscode.ViewColumn.Beside;
		}
		await vscode.commands.executeCommand('vscode.setEditorLayout', {
			orientation: 0,
			groups: [{ size: 0.72 }, { size: 0.28 }]
		}).then(undefined, () => undefined);
		return vscode.ViewColumn.Two;
	}

	private async create(page: PageEntry): Promise<vscode.WebviewPanel> {
		const column = await this.narrowColumn();
		const panel = vscode.window.createWebviewPanel(
			PagePropertiesPanel.VIEW_TYPE,
			title(page),
			{ viewColumn: column, preserveFocus: false },
			{ enableScripts: true, retainContextWhenHidden: true }
		);
		panel.iconPath = new vscode.ThemeIcon('info');
		panel.webview.onDidReceiveMessage((message: PanelMessage) => void this.receive(message));
		panel.onDidDispose(() => {
			this.panel = undefined;
		});
		this.panel = panel;
		return panel;
	}

	private async receive(message: PanelMessage): Promise<void> {
		if (message.type === 'registry') {
			const page = this.deps.page();
			const located = page === undefined ? undefined : locate(this.deps.roots(), page.uri);
			if (located !== undefined) {
				const document = await vscode.workspace.openTextDocument(located.root.registryUri);
				// In the sheet's own column, as a tab beside it — so the two stay side by side and nothing new splits.
				await vscode.window.showTextDocument(document, {
					preview: true,
					viewColumn: this.panel?.viewColumn ?? vscode.ViewColumn.Beside
				});
			}
			return;
		}
		if (typeof message.command !== 'string') {
			return;
		}
		const args = Array.isArray(message.args) ? message.args : [];
		void vscode.commands.executeCommand(message.command, ...args);
	}

	private async render(): Promise<void> {
		const panel = this.panel;
		if (panel === undefined) {
			return;
		}
		const page = this.deps.page();
		panel.title = page === undefined ? 'Page properties' : title(page);
		let body = empty();
		if (page !== undefined) {
			const located = locate(this.deps.roots(), page.uri);
			const edit = located === undefined ? undefined : await RegistryEdit.open(located.root.registryUri);
			body = located === undefined || edit === undefined
				? head(page, true) + `<p class="note">This page is not in a docs registry, so there are no properties to show.</p>`
				: head(page, false)
				+ section('Owner and search', describe(edit, page))
				+ section('Placement', placement(page))
				+ actions();
		}
		panel.webview.html = html(body);
	}
}

function title(page: PageEntry): string {
	return `Properties — ${page.title}`;
}

/** The page's name, the two facts that say which file it is, and what this sheet is. */
function head(page: PageEntry, outside: boolean): string {
	const where = outside ? 'not in a docs root' : vscode.workspace.asRelativePath(page.uri);
	const lede = outside
		? 'This file is not listed in a docs registry, so the help build does not know it exists.'
		: 'What the docs registry records about this page — who keeps it, how a reader finds it, and where it sits in the help.';
	return `<header><h1>${esc(page.title)}</h1><div class="where" title="${esc(page.uri.fsPath)}">${esc(where)}</div><code class="id">${esc(page.id)}</code><p class="lede">${esc(lede)}</p></header>`;
}

/** A named group of rows; an empty value says so in the same small voice as the label. */
function section(name: string, rows: readonly PropertyRow[]): string {
	const body = rows
		.map((row) => `<div class="row"><div class="k">${esc(row.label)}</div><div class="v${row.value === '' ? ' unset' : ''}">${row.value === '' ? 'Not set' : esc(row.value)}</div><div class="hint">${esc(row.hint)}</div></div>`)
		.join('');
	return `<section><h2>${esc(name)}</h2>${body}</section>`;
}

/** The two things a person can do about the values they are looking at, and why there is no Save. */
function actions(): string {
	return `<footer><button data-type="registry">Edit the Registry</button><button class="ghost" data-command="temcoDocs.openSource">Open Source</button><p class="note">These values are read from the registry, never written from here: the help generator, page moves and renames all write that one file, so a second writer could only ever disagree with it. Change a value in the registry, and this sheet follows the next refresh.</p></footer>`;
}

function empty(): string {
	return `<div class="blank"><p class="note">No page is in front.</p><p class="note">Open one from <b>Pages</b> and what the registry says about it appears here.</p></div>`;
}

function html(body: string): string {
	return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><style>
	:root { color-scheme: light dark; }
	body { margin: 0; padding: 0 18px 18px; font-family: var(--vscode-font-family); font-size: 12px;
		color: var(--vscode-foreground); max-width: 400px; }
	header { padding: 18px 0 12px; }
	h1 { margin: 0; font-size: 15px; font-weight: 600; line-height: 1.3; }
	.where { margin-top: 3px; font-size: 11px; color: var(--vscode-descriptionForeground);
		overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.id { display: inline-block; margin-top: 7px; padding: 1px 6px; font-family: var(--vscode-editor-font-family);
		font-size: 11px; color: var(--vscode-descriptionForeground);
		background: var(--vscode-textCodeBlock-background); border-radius: 3px; }
	.lede { margin: 10px 0 0; color: var(--vscode-descriptionForeground); line-height: 1.55; }
	section { border-top: 1px solid var(--vscode-widget-border, rgba(128,128,128,.22)); padding: 10px 0 6px; }
	h2 { margin: 0 0 8px; font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase;
		color: var(--vscode-descriptionForeground); }
	.row { display: grid; grid-template-columns: 108px 1fr; gap: 2px 10px; padding: 6px 0 8px; align-items: baseline; }
	.k { color: var(--vscode-descriptionForeground); }
	.v { line-height: 1.5; overflow-wrap: anywhere; }
	.v.unset { color: var(--vscode-disabledForeground, var(--vscode-descriptionForeground)); font-style: italic; }
	.hint { grid-column: 2; font-size: 11px; line-height: 1.5; color: var(--vscode-descriptionForeground); opacity: .85; }
	.note { color: var(--vscode-descriptionForeground); font-size: 11px; line-height: 1.55; margin: 10px 0 0; }
	footer { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px;
		border-top: 1px solid var(--vscode-widget-border, rgba(128,128,128,.22)); padding-top: 14px; }
	footer .note { flex-basis: 100%; }
	button { font-family: inherit; font-size: 12px; height: 26px; padding: 0 10px; cursor: pointer; border: none;
		border-radius: 2px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); }
	button.ghost { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); }
	button:hover { background: var(--vscode-button-hoverBackground); }
	button.ghost:hover { background: var(--vscode-button-secondaryHoverBackground); }
	.blank { padding: 48px 0; text-align: center; }
	</style></head><body>${body}
	<script>
	const api = acquireVsCodeApi();
	document.addEventListener('click', (event) => {
		const registry = event.target.closest('[data-type="registry"]');
		if (registry) { api.postMessage({ type: 'registry' }); return; }
		const button = event.target.closest('[data-command]');
		if (!button) { return; }
		api.postMessage({ command: button.dataset.command, args: [] });
	});
	</script></body></html>`;
}
