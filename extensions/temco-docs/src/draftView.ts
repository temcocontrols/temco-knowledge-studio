// The right-hand panel: **DRAFT**.
//
// It is the one panel that is about the page in front rather than about a list, which is why it lives in the
// auxiliary bar: while you write, the thing you may want next is what the model makes of the same page. Three ways
// to feed it — the page's own history, one file of the repository, or another page — then a diff you accept or
// reject. Nothing here writes: `acceptDraft` is the only act that does, and it is the same command the Review
// Center runs.

import * as vscode from 'vscode';
import { PageEntry } from './registry';
import { Catalog, DraftRow, selection } from './store';
import { escapeHtml as esc } from './ui';

export interface DraftDeps {
	/** The page in front, or the row the tree has selected — the rule every command here follows. */
	page: () => PageEntry | undefined;
}

export class DraftView implements vscode.WebviewViewProvider {
	static readonly TYPE = 'temcoDocs.draft';

	private view: vscode.WebviewView | undefined;

	constructor(private readonly context: vscode.ExtensionContext, private readonly deps: DraftDeps) { }

	resolveWebviewView(view: vscode.WebviewView): void {
		this.view = view;
		view.webview.options = { enableScripts: true };
		view.webview.onDidReceiveMessage((message: { command?: unknown; args?: unknown }) => {
			if (typeof message?.command !== 'string') {
				return;
			}
			const args = Array.isArray(message.args) ? message.args : [];
			void vscode.commands.executeCommand(message.command, ...args);
		});
		view.onDidDispose(() => {
			this.view = undefined;
		});
		void this.render();
	}

	refresh(): void {
		void this.render();
	}

	private async render(): Promise<void> {
		const view = this.view;
		if (view === undefined) {
			return;
		}
		const page = this.deps.page();
		view.description = page?.title;
		const start = page === undefined ? false : await isBlank(page);
		view.webview.html = html(page, page === undefined ? [] : await waiting(this.context, page), start);
	}
}

/** Whether the page has nothing but its headings — the state a page is in the moment it is created. */
async function isBlank(page: PageEntry): Promise<boolean> {
	try {
		const text = Buffer.from(await vscode.workspace.fs.readFile(page.uri)).toString('utf8');
		const prose = text
			.split(/\r?\n/)
			.filter((line) => line.trim().length > 0 && !line.trim().startsWith('#'))
			.join('');
		return prose.length === 0;
	} catch {
		return false;
	}
}

/** The drafts waiting for this page, from the catalog — the same rows the Review Center settles. */
async function waiting(context: vscode.ExtensionContext, page: PageEntry): Promise<DraftRow[]> {
	let catalog: Catalog | undefined;
	try {
		catalog = await Catalog.open(context);
		const documents = catalog.documents();
		const project = selection.project() ?? (documents.length === 1 ? documents[0].slug : undefined);
		if (project === undefined) {
			return [];
		}
		return catalog.drafts(project).filter((draft) => draft.state === 'draft' && draft.pageId === page.id);
	} catch {
		return [];
	} finally {
		catalog?.close();
	}
}

function html(page: PageEntry | undefined, drafts: readonly DraftRow[], start: boolean): string {
	const body = page === undefined
		? `<p class="note">No page is in front. Open one from <b>Pages</b> and its draft panel appears here.</p>`
		: `<div class="head"><div class="title">${esc(page.title)}</div><div class="note">${esc(page.id)}</div></div>
${start ? `<div class="label">Start it</div>
<p class="note">The page has its title and its headings. Three ways in:</p>
<div class="row">
  <button data-command="temcoDocs.captureImage">Capture a screen</button>
  <button class="ghost" data-command="temcoDocs.chooseImage">Insert an image…</button>
</div>
<div class="row">
  <button data-command="temcoDocs.revisePage" data-args="${esc(JSON.stringify([{ id: page.id, title: page.title }]))}">Draft it from a source</button>
</div>` : ''}
<p class="note">Draft from this page’s history, a source file, or another page. The model reads the page as it
stands, and nothing is written until you apply the result.</p>
<div class="row">
  <button data-command="temcoDocs.revisePage" data-args="${esc(JSON.stringify([{ id: page.id, title: page.title }]))}">Draft a Change</button>
  <button class="ghost" data-command="temcoDocs.review">Review Center</button>
</div>
<div class="label">Waiting (${drafts.length})</div>
${drafts.length === 0
			? `<p class="note">No draft is waiting for this page.</p>`
			: drafts.map((draft) => `<div class="draft">
  <div class="draft__title">${esc(draft.title || draft.kind || 'Draft')}<span class="note"> · ${esc(draft.createdAt)}</span></div>
  <div class="row">
    <button data-command="temcoDocs.acceptDraft" data-args="${esc(JSON.stringify([draft.id]))}">Apply</button>
    <button class="ghost" data-command="temcoDocs.discardDraft" data-args="${esc(JSON.stringify([draft.id]))}">Reject</button>
  </div>
</div>`).join('')}`;

	return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><style>
	body { font-family: var(--vscode-font-family); font-size: 12px; color: var(--vscode-foreground); padding: 10px 12px; }
	.head { margin-bottom: 8px; }
	.title { font-size: 13px; font-weight: 600; }
	.note { color: var(--vscode-descriptionForeground); line-height: 1.45; margin: 6px 0; }
	.label { margin: 14px 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--vscode-descriptionForeground); }
	.row { display: flex; gap: 6px; flex-wrap: wrap; margin: 8px 0; }
	button { font-family: inherit; font-size: 12px; padding: 4px 10px; border: none; border-radius: 2px; cursor: pointer;
		color: var(--vscode-button-foreground); background: var(--vscode-button-background); }
	button.ghost { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); }
	button:hover { background: var(--vscode-button-hoverBackground); }
	.draft { border-top: 1px solid var(--vscode-panel-border, rgba(128,128,128,.25)); padding: 8px 0; }
	.draft__title { font-weight: 500; }
	</style></head><body>${body}
	<script>
	const api = acquireVsCodeApi();
	document.addEventListener('click', (event) => {
		const button = event.target.closest('[data-command]');
		if (!button) { return; }
		api.postMessage({ command: button.dataset.command, args: JSON.parse(button.dataset.args || '[]') });
	});
	</script></body></html>`;
}