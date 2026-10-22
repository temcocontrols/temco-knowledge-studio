// The right-hand panel: **DRAFT**.
//
// It is the one panel that is about the page in front rather than about a list, which is why it lives in the
// auxiliary bar: while you write, the thing you may want next is what the model makes of the same page. Three ways
// to feed it — the page's own history, one file of the repository, or another page — then a diff you accept or
// reject. Nothing here writes: `acceptDraft` is the only act that does, and it is the same command the Review
// Center runs.

import * as vscode from 'vscode';
import { FIELDS, control, locate, normalise, read } from './pageProperties';
import { DocsRoot, PageEntry } from './registry';
import { RegistryEdit, describeChange } from './registryEdit';
import { Catalog, DraftRow, selection } from './store';
import { escapeHtml as esc } from './ui';

export interface DraftDeps {
	/** The page in front, or the row the tree has selected — the rule every command here follows. */
	page: () => PageEntry | undefined;
	/** The roots the page belongs to, so the Properties tab can find its registry. */
	roots: () => readonly DocsRoot[];
	/** Redraws the tree after a registry write. */
	redraw: () => void;
}

type Tab = 'draft' | 'properties';

interface PanelMessage {
	command?: unknown;
	args?: unknown;
	type?: unknown;
	tab?: unknown;
	values?: Record<string, unknown>;
}

export class DraftView implements vscode.WebviewViewProvider {
	static readonly TYPE = 'temcoDocs.draft';

	private view: vscode.WebviewView | undefined;
	private tab: Tab = 'draft';

	constructor(private readonly context: vscode.ExtensionContext, private readonly deps: DraftDeps) { }

	resolveWebviewView(view: vscode.WebviewView): void {
		this.view = view;
		view.webview.options = { enableScripts: true };
		view.webview.onDidReceiveMessage((message: PanelMessage) => void this.receive(message));
		view.onDidDispose(() => {
			this.view = undefined;
		});
		void this.render();
	}

	refresh(): void {
		void this.render();
	}

	/** Opens the panel on its Properties tab — what *Page Properties* does now that the form lives here. */
	showProperties(): void {
		this.tab = 'properties';
		void vscode.commands.executeCommand('temcoDocs.draft.focus');
		void this.render();
	}

	private async receive(message: PanelMessage): Promise<void> {
		if (message.type === 'tab' && (message.tab === 'draft' || message.tab === 'properties')) {
			this.tab = message.tab;
			await this.render();
			return;
		}
		if (message.type === 'save' && message.values !== undefined) {
			await this.save(message.values);
			return;
		}
		if (message.type === 'registry') {
			const page = this.deps.page();
			const located = page === undefined ? undefined : locate(this.deps.roots(), page.uri);
			if (located !== undefined) {
				const document = await vscode.workspace.openTextDocument(located.root.registryUri);
				await vscode.window.showTextDocument(document, { preview: true, viewColumn: vscode.ViewColumn.Beside });
			}
			return;
		}
		if (typeof message.command !== 'string') {
			return;
		}
		const args = Array.isArray(message.args) ? message.args : [];
		void vscode.commands.executeCommand(message.command, ...args);
	}

	/** The registry write: the same edit the standalone form made, naming each value it changes. */
	private async save(values: Record<string, unknown>): Promise<void> {
		const page = this.deps.page();
		const located = page === undefined ? undefined : locate(this.deps.roots(), page.uri);
		if (located === undefined) {
			return;
		}
		const edit = await RegistryEdit.open(located.root.registryUri);
		if (edit === undefined) {
			return;
		}
		for (const field of FIELDS) {
			edit.set(located.entry.id, field.key, normalise(field, values[field.key]));
		}
		const changes = edit.changed;
		if (changes.length === 0) {
			void vscode.window.showInformationMessage('Temco Docs: nothing changed, so nothing was written.');
			return;
		}
		const confirmed = await vscode.window.showWarningMessage(
			`Write ${changes.length} ${changes.length === 1 ? 'value' : 'values'} to ${vscode.workspace.asRelativePath(located.root.registryUri)}?`,
			{ modal: true, detail: changes.map(describeChange).join('\n') },
			'Write'
		);
		if (confirmed !== 'Write') {
			return;
		}
		await edit.save();
		this.deps.redraw();
		void this.render();
	}

	private async render(): Promise<void> {
		const view = this.view;
		if (view === undefined) {
			return;
		}
		const page = this.deps.page();
		view.description = page?.title;
		let properties = '';
		if (this.tab === 'properties' && page !== undefined) {
			const located = locate(this.deps.roots(), page.uri);
			const edit = located === undefined ? undefined : await RegistryEdit.open(located.root.registryUri);
			properties = located === undefined || edit === undefined
				? `<p class="note">This page is not in a docs registry, so it has no properties to edit.</p>`
				: propertiesForm(read(edit, located.entry));
		}
		const start = page === undefined ? false : await isBlank(page);
		view.webview.html = html(
			page,
			page === undefined ? [] : await waiting(this.context, page),
			start,
			this.tab,
			properties
		);
	}
}

/** The registry fields as a compact form; saving posts the values and the extension writes them. */
function propertiesForm(values: Record<string, string | number | boolean>): string {
	const rows = FIELDS.map((field) =>
		`<div class="field"><label for="prop-${field.key}">${esc(field.label)}</label>${control(field, values[field.key] ?? '')}<div class="note">${esc(field.hint)}</div></div>`
	).join('');
	return `${rows}<div class="row"><button id="properties-save">Save Properties</button><button class="ghost" data-type="registry">Show the Registry</button></div>`;
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

function html(
	page: PageEntry | undefined,
	drafts: readonly DraftRow[],
	start: boolean,
	tab: Tab,
	properties: string
): string {
	const draftBody = page === undefined
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

	const tabs = `<div class="tabs"><button class="tab${tab === 'draft' ? ' tab--on' : ''}" data-type="tab" data-tab="draft">Draft</button><button class="tab${tab === 'properties' ? ' tab--on' : ''}" data-type="tab" data-tab="properties">Properties</button></div>`;
	const body = page === undefined || tab === 'draft'
		? draftBody
		: `<div class="head"><div class="title">${esc(page.title)}</div><div class="note">${esc(page.id)}</div></div>${properties}`;

	return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><style>
	.tabs { display: flex; gap: 2px; margin: -2px 0 10px; border-bottom: 1px solid var(--vscode-panel-border, rgba(128,128,128,.25)); }
	.tab { background: none; color: var(--vscode-foreground); border-radius: 0; padding: 4px 10px; opacity: .7; border-bottom: 2px solid transparent; }
	.tab:hover { background: none; opacity: 1; }
	.tab--on { opacity: 1; border-bottom-color: var(--vscode-focusBorder); }
	.field { margin: 8px 0; }
	.field label { display: block; font-weight: 500; margin-bottom: 3px; }
	.input { width: 100%; box-sizing: border-box; padding: 3px 6px; font-family: inherit; font-size: 12px;
		color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, transparent); }
	.check { display: flex; gap: 6px; align-items: center; font-weight: normal; }
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
	</style></head><body>${page === undefined ? '' : tabs}${body}
	<script>
	const api = acquireVsCodeApi();
	document.addEventListener('click', (event) => {
		const typed = event.target.closest('[data-type]');
		if (typed) {
			api.postMessage({ type: typed.dataset.type, tab: typed.dataset.tab });
			return;
		}
		if (event.target.closest('#properties-save')) {
			const values = {};
			document.querySelectorAll('[data-field]').forEach((element) => {
				values[element.getAttribute('data-field')] = element.type === 'checkbox' ? element.checked : element.value;
			});
			api.postMessage({ type: 'save', values });
			return;
		}
		const button = event.target.closest('[data-command]');
		if (!button) { return; }
		api.postMessage({ command: button.dataset.command, args: JSON.parse(button.dataset.args || '[]') });
	});
	</script></body></html>`;
}