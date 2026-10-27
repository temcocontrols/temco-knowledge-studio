// The panel at the top of the documentation side bar: what project you are in, what it owes, and the two buttons that
// take it out of the building.
//
// It exists because the side bar is otherwise five headings and no answer: a person opening Docs could not see which
// project the tree below belongs to, how many pages it has, or whether the last build worked. The tree stays native — VS
// Code draws it, with reveal, keyboard navigation and filtering for free — so this is only the strip above it.
//
// The markup is a pure function of the state (`panelHtml`), which is what makes it checkable: `check-panel.mts` proves the
// numbers are real, the project name cannot inject markup, and every button names a command that exists.

import * as vscode from 'vscode';
import { DocsRoot, collectPages } from './registry';
import { count } from './statusLine';

export interface DocsPanelState {
	/** The project being worked on, as the catalog knows it. */
	project?: { name: string; version?: string; sources: number; builtAt?: string };
	pages: number;
	issues: number;
	unshipped: number;
	/** Drafts and captures waiting for a person. */
	owed: number;
}

export interface DocsPanelDeps {
	roots(): readonly DocsRoot[];
	state(): Promise<DocsPanelState>;
}

const TYPE = 'temcoDocs.panel';

export class DocsPanel implements vscode.WebviewViewProvider {
	private view: vscode.WebviewView | undefined;

	constructor(private readonly deps: DocsPanelDeps) { }

	resolveWebviewView(view: vscode.WebviewView): void {
		this.view = view;
		view.webview.options = { enableScripts: true };
		view.webview.onDidReceiveMessage((message: { type?: unknown; command?: unknown; args?: unknown }) => {
			void this.receive(message);
		});
		view.onDidDispose(() => {
			this.view = undefined;
		});
		void this.render();
	}

	/** Re-reads the counts; called whenever the registry, the queue or the catalog changes under it. */
	refresh(): void {
		void this.render();
	}

	private async render(): Promise<void> {
		const state = await this.deps.state();
		// The view can be closed while the catalog is being read; writing to it then throws where nobody can see it.
		const view = this.view;
		if (view !== undefined) {
			view.webview.html = panelHtml(state, nonce());
		}
	}

	private async receive(message: { type?: unknown; command?: unknown; args?: unknown }): Promise<void> {
		if (message.type === 'find') {
			await this.find();
			return;
		}
		if (typeof message.command === 'string') {
			const args = Array.isArray(message.args) ? message.args : [];
			void vscode.commands.executeCommand(message.command, ...args);
		}
	}

	/**
	 * Find a page and open it.
	 *
	 * A native tree cannot be filtered from a webview — the filter lives in the tree's own input box — so the panel does the
	 * next best thing rather than a search field that filters nothing: it asks the reader which page, and opens it in the
	 * editor the same way the Pages view does.
	 */
	private async find(): Promise<void> {
		const pages = this.deps.roots().flatMap(root => collectPages(root)).filter(page => page.exists);
		const chosen = await vscode.window.showQuickPick(
			pages.map(page => ({ label: page.title, description: page.id, uri: page.uri })),
			{ placeHolder: 'Find a page', matchOnDescription: true }
		);
		if (chosen !== undefined) {
			await vscode.commands.executeCommand('vscode.openWith', chosen.uri, 'temcoEditor.markdown').then(undefined, () =>
				vscode.commands.executeCommand('vscode.open', chosen.uri)
			);
		}
	}
}

/** The panel, as HTML.
 *
 * Plain CSS and `--vscode-*` variables: this strip sits inside the workbench, so it has to follow the theme, the font and
 * the spacing of everything around it. Nothing is loaded from anywhere — the style is inline, the script is one listener,
 * and the policy allows exactly that.
 */
export function panelHtml(state: DocsPanelState, nonceValue: string): string {
	const project = state.project;
	const name = project?.name ?? 'No project';
	const version = project?.version === undefined ? '' : `<span class="tag">v${escapeHtml(project.version)}</span>`;
	const body = project === undefined
		? `<p class="note">Pick a project in <b>Home ▸ Projects</b> to give this tree something to be about.</p>`
		: `<p class="facts">${escapeHtml(count(state.pages, 'page', 'pages'))} · ${escapeHtml(count(state.issues, 'issue', 'issues'))}${state.unshipped === 0 ? '' : ` · ${escapeHtml(`${state.unshipped} unshipped`)}`}</p>`;

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonceValue}';">
<style>
	body {
		margin: 0;
		padding: 10px 12px 8px;
		font: 13px/1.5 var(--vscode-font-family);
		color: var(--vscode-foreground);
	}
	.head { display: flex; align-items: baseline; gap: 8px; }
	.name {
		font-size: 14px;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tag {
		font-size: 11px;
		color: var(--vscode-descriptionForeground);
		border: 1px solid var(--vscode-widget-border, rgba(128, 128, 128, 0.35));
		border-radius: 4px;
		padding: 0 4px;
	}
	.facts { margin: 4px 0 10px; color: var(--vscode-descriptionForeground); font-size: 12px; }
	.note { margin: 4px 0 10px; color: var(--vscode-descriptionForeground); font-size: 12px; }
	.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border: 1px solid var(--vscode-widget-border, rgba(128, 128, 128, 0.35));
		background: var(--vscode-editorWidget-background, transparent);
		color: inherit;
		border-radius: 10px;
		padding: 2px 10px;
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}
	.chip:hover { background: var(--vscode-list-hoverBackground); }
	.chip:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: 1px; }
	.badge { font-variant-numeric: tabular-nums; color: var(--vscode-descriptionForeground); }
	.find {
		display: block;
		width: 100%;
		text-align: left;
		border: 1px solid var(--vscode-input-border, rgba(128, 128, 128, 0.35));
		background: var(--vscode-input-background);
		color: var(--vscode-input-foreground);
		border-radius: 4px;
		padding: 3px 8px;
		font: inherit;
		font-size: 12px;
		cursor: text;
	}
	.foot {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 10px;
		padding-top: 8px;
		border-top: 1px solid var(--vscode-widget-border, rgba(128, 128, 128, 0.25));
	}
	.when { flex: 1; color: var(--vscode-descriptionForeground); font-size: 11px; overflow: hidden; text-overflow: ellipsis; }
	.act {
		border: 1px solid var(--vscode-button-border, transparent);
		background: var(--vscode-button-secondaryBackground, rgba(128, 128, 128, 0.2));
		color: var(--vscode-button-secondaryForeground, inherit);
		border-radius: 4px;
		padding: 2px 8px;
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}
	.act:hover { background: var(--vscode-button-secondaryHoverBackground, rgba(128, 128, 128, 0.3)); }
	.act:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: 1px; }
</style>
</head>
<body>
<div class="head"><span class="name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>${version}</div>
${body}
<div class="chips">
	<button type="button" class="chip" data-command="temcoDocs.documents" title="Show the pages">Pages <span class="badge">${state.pages}</span></button>
	<button type="button" class="chip" data-command="temcoDocs.review" title="Drafts and captures waiting for a person">Needs you <span class="badge">${state.owed}</span></button>
	<button type="button" class="chip" data-command="temcoDocs.validate" title="Look for broken links and missing pages">Validate</button>
</div>
<button type="button" class="find" data-type="find">Find a page…</button>
<div class="foot">
	<span class="when" title="${escapeHtml(builtTitle(state))}">${escapeHtml(builtWhen(state))}</span>
	<button type="button" class="act" data-command="temcoDocs.buildSite" title="Build the site">Build</button>
	<button type="button" class="act" data-command="temcoDocs.publishSite" title="Publish to GitHub Pages">Publish</button>
</div>
<script nonce="${nonceValue}">
	const vscode = acquireVsCodeApi();
	const post = (message) => vscode.postMessage(message);
	const feedback = (button) => {
		button.disabled = true;
		setTimeout(() => { button.disabled = false; }, 600);
	};
	document.addEventListener('click', (event) => {
		const target = event.target.closest('[data-command], [data-type]');
		if (!target) {
			return;
		}
		if (target.dataset.command) {
			feedback(target);
			post({ command: target.dataset.command });
		} else if (target.dataset.type === 'find') {
			post({ type: 'find' });
		}
	});
</script>
</body>
</html>`;
}

function builtWhen(state: DocsPanelState): string {
	const builtAt = state.project?.builtAt;
	if (builtAt === undefined) {
		return 'never built';
	}
	const then = Date.parse(builtAt);
	if (Number.isNaN(then)) {
		return `built ${builtAt}`;
	}
	const minutes = Math.round((Date.now() - then) / 60000);
	if (minutes < 1) {
		return 'built just now';
	}
	if (minutes < 60) {
		return `built ${minutes} min ago`;
	}
	const hours = Math.round(minutes / 60);
	return hours < 24 ? `built ${hours} h ago` : `built ${Math.round(hours / 24)} d ago`;
}

function builtTitle(state: DocsPanelState): string {
	const builtAt = state.project?.builtAt;
	return builtAt === undefined ? 'No build has been recorded for this project' : `Last build: ${builtAt}`;
}

/** Text a reader sees as text. */
export function escapeHtml(text: string): string {
	return text
		.replace(/&/gu, '&amp;')
		.replace(/</gu, '&lt;')
		.replace(/>/gu, '&gt;')
		.replace(/"/gu, '&quot;');
}

/** A random id for the inline script, so the policy can allow that one script and no other. */
export function nonce(): string {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let value = '';
	for (let index = 0; index < 24; index++) {
		value += alphabet[Math.floor(Math.random() * alphabet.length)];
	}
	return value;
}

export { TYPE as PANEL_VIEW_TYPE };
