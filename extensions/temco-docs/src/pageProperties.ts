// Page properties — the registry fields a person curates, in one form, for the page in front.
//
// Dr.Explain puts a topic's properties in a side panel. Here they are one page, because a page is where a form
// can show every field at once and name the file it will change. It writes `docs/help/registry.json` through
// `RegistryEdit` — the same write the rest of the module uses — so nothing here re-implements that file, and the
// repository's own generator keeps every value written here.
//
// What it does not offer is as deliberate as what it does: header, footer and page numbering belong to the printed
// profile, not to a topic, and a body is edited in the editor rather than in a form.

import * as vscode from 'vscode';
import { DocsRoot, PageEntry, collectPages } from './registry';
import { RegistryEdit, describeChange } from './registryEdit';
import { escapeHtml as esc, icon, page, pageColumn } from './ui';

export const PAGE_PROPERTIES_VIEW_TYPE = 'temcoDocs.pageProperties';

interface Field {
	key: string;
	label: string;
	hint: string;
	kind: 'text' | 'number' | 'check' | 'list';
}

/** The registry's own names, so nothing has to be translated on the way to disk. */
const FIELDS: Field[] = [
	{ key: 'title', label: 'Title', hint: 'What the topic is called in the tree and at the top of the page.', kind: 'text' },
	{ key: 'owner', label: 'Owner', hint: 'Who answers for this page.', kind: 'text' },
	{ key: 'audience', label: 'Audience', hint: 'Who it is written for.', kind: 'text' },
	{ key: 'order', label: 'Order', hint: 'Position inside its chapter. The generator hands out 10, 20, 30 to whatever nobody curated.', kind: 'number' },
	{ key: 'ship', label: 'Ships', hint: 'The export condition: a page that does not ship is in neither the site nor the offline help.', kind: 'check' },
	{ key: 'keywords', label: 'Keywords', hint: 'Index entries, separated by commas — what a reader searches for.', kind: 'list' },
	{ key: 'tags', label: 'Tags', hint: 'Search facets, separated by commas.', kind: 'list' },
	{ key: 'help_ids', label: 'Help context IDs', hint: 'The IDs the application asks for when a person presses Help. Separated by commas.', kind: 'list' }
];

/** The page whose file is in front, and the root it belongs to. */
interface Located {
	root: DocsRoot;
	entry: PageEntry;
}

export class PageProperties {
	private panel: vscode.WebviewPanel | undefined;

	constructor(
		private readonly roots: () => readonly DocsRoot[],
		private readonly redraw: () => void
	) { }

	/** Opens the properties of the page in the active editor — or says why there is nothing to show. */
	async open(): Promise<void> {
		const editor = vscode.window.activeTextEditor;
		const uri = editor?.document.uri;
		if (uri === undefined) {
			void vscode.window.showInformationMessage(
				'Temco Docs: open a page first — page properties belong to the page in front.'
			);
			return;
		}

		const located = locate(this.roots(), uri);
		if (located === undefined) {
			void vscode.window.showWarningMessage(
				`Temco Docs: ${vscode.workspace.asRelativePath(uri)} is not a page in a docs/help registry, so it has no properties to edit.`
			);
			return;
		}

		const edit = await RegistryEdit.open(located.root.registryUri);
		if (edit === undefined) {
			return;
		}
		const values = read(edit, located.entry);
		const body = html(located, values);
		const title = `Page Properties — ${located.entry.title}`;

		if (this.panel) {
			this.panel.title = title;
			this.panel.reveal(pageColumn());
			this.panel.webview.html = page(body, { title, script: SCRIPT });
			return;
		}

		this.panel = vscode.window.createWebviewPanel(PAGE_PROPERTIES_VIEW_TYPE, title, pageColumn(), {
			enableScripts: true,
			localResourceRoots: []
		});
		this.panel.iconPath = new vscode.ThemeIcon('symbol-property');
		this.panel.webview.html = page(body, { title, script: SCRIPT });
		this.panel.webview.onDidReceiveMessage((message: { type?: string; values?: Record<string, unknown> }) =>
			void this.receive(located, message)
		);
		this.panel.onDidDispose(() => {
			this.panel = undefined;
		});
	}

	dispose(): void {
		this.panel?.dispose();
	}

	private async receive(located: Located, message: { type?: string; values?: Record<string, unknown> }): Promise<void> {
		if (message.type === 'cancel') {
			this.panel?.dispose();
			return;
		}
		if (message.type === 'reveal') {
			const document = await vscode.workspace.openTextDocument(located.root.registryUri);
			await vscode.window.showTextDocument(document, { preview: true, viewColumn: vscode.ViewColumn.Beside });
			return;
		}
		if (message.type !== 'save' || message.values === undefined) {
			return;
		}

		const edit = await RegistryEdit.open(located.root.registryUri);
		if (edit === undefined) {
			return;
		}

		const posted = message.values;
		for (const field of FIELDS) {
			const value = normalise(field, posted[field.key]);
			edit.set(located.entry.id, field.key, value);
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
		this.redraw();
		void vscode.window.showInformationMessage(
			`Temco Docs: ${changes.length} ${changes.length === 1 ? 'value' : 'values'} written for “${located.entry.title}”.`
		);
		this.panel?.dispose();
	}
}

/** The registry entry of the page whose file is `uri`, and the root it came from. */
function locate(roots: readonly DocsRoot[], uri: vscode.Uri): Located | undefined {
	const wanted = uri.toString();
	for (const root of roots) {
		const entry = collectPages(root).find((page) => page.uri.toString() === wanted);
		if (entry !== undefined) {
			return { root, entry };
		}
	}
	return undefined;
}

/**
 * What the form starts with: the curated entry where it has a value, and what the tree already knows where it
 * does not — so an empty field means "not curated", never "not known".
 */
function read(edit: RegistryEdit, entry: PageEntry): Record<string, string | number | boolean> {
	const raw = edit.entry(entry.id) ?? {};
	const text = (key: string, fallback: string): string => {
		const value = raw[key];
		return typeof value === 'string' ? value : fallback;
	};
	const list = (key: string, fallback: readonly string[]): string => {
		const value = raw[key];
		return Array.isArray(value) ? value.map((item) => String(item)).join(', ') : fallback.join(', ');
	};

	return {
		title: text('title', entry.title),
		owner: text('owner', entry.owner),
		audience: text('audience', entry.audience),
		order: typeof raw['order'] === 'number' ? raw['order'] : entry.order,
		ship: typeof raw['ship'] === 'boolean' ? raw['ship'] : entry.ship,
		keywords: list('keywords', entry.keywords),
		tags: list('tags', entry.tags),
		help_ids: list('help_ids', [])
	};
}

/** One posted value, in the shape the registry holds it. An empty field is removed rather than written as `""`. */
function normalise(field: Field, posted: unknown): unknown {
	if (field.kind === 'check') {
		return posted === true;
	}
	if (field.kind === 'number') {
		const number = Number(posted);
		return Number.isFinite(number) ? number : undefined;
	}
	if (field.kind === 'list') {
		const items = String(posted ?? '')
			.split(',')
			.map((item) => item.trim())
			.filter((item) => item.length > 0);
		return items.length > 0 ? items : undefined;
	}
	const text = String(posted ?? '').trim();
	return text.length > 0 ? text : undefined;
}

const control = (field: Field, value: string | number | boolean): string => {
	const id = `prop-${field.key}`;
	if (field.kind === 'check') {
		return `<label class="check"><input type="checkbox" id="${id}" data-field="${field.key}"${value === true ? ' checked' : ''}><span>Include this page in the built output</span></label>`;
	}
	if (field.kind === 'number') {
		return `<input class="input" id="${id}" type="number" data-field="${field.key}" value="${esc(String(value))}">`;
	}
	return `<input class="input" id="${id}" data-field="${field.key}" value="${esc(String(value))}">`;
};

function html(located: Located, values: Record<string, string | number | boolean>): string {
	const rows = FIELDS.map((field) =>
		`<div class="field"><label for="prop-${field.key}">${esc(field.label)}</label>${control(field, values[field.key] ?? '')}<div class="field__hint">${esc(field.hint)}</div></div>`
	).join('');

	return `<div class="page-head">
	<div class="page-head__main">
		<div class="eyebrow">${esc(located.entry.area)}${located.entry.chapter ? ` › ${esc(located.entry.chapter)}` : ''}</div>
		<h1 class="page-head__title">${icon('gear')}Page Properties</h1>
		<p class="page-head__desc">${esc(located.entry.id)} — the fields this page carries in <code>docs/help/registry.json</code>. The body is edited in the page itself.</p>
	</div>
	<div class="page-head__actions"><button type="button" class="btn btn--ghost" id="properties-show">${icon('go-to-file')}<span>Show the registry</span></button></div>
</div>

<div class="form">${rows}</div>

<div class="callout mt-16">${icon('info')}<div>These values survive the next regeneration: the repository's generator keeps what a person curated, field by field.</div></div>

<div class="row mt-24" style="gap:8px;justify-content:flex-end">
	<button type="button" class="btn" id="properties-cancel"><span>Close</span></button>
	<button type="button" class="btn btn--primary" id="properties-save">${icon('check')}<span>Save Properties</span></button>
</div>`;
}

/** Reads the form and posts it; nothing is written from the page itself. */
const SCRIPT = `
(function () {
	const api = acquireVsCodeApi();
	function values() {
		const out = {};
		Array.prototype.forEach.call(document.querySelectorAll('[data-field]'), function (element) {
			const key = element.getAttribute('data-field');
			out[key] = element.type === 'checkbox' ? element.checked : element.value;
		});
		return out;
	}
	const save = document.getElementById('properties-save');
	if (save) { save.addEventListener('click', function () { api.postMessage({ type: 'save', values: values() }); }); }
	const cancel = document.getElementById('properties-cancel');
	if (cancel) { cancel.addEventListener('click', function () { api.postMessage({ type: 'cancel' }); }); }
	const show = document.getElementById('properties-show');
	if (show) { show.addEventListener('click', function () { api.postMessage({ type: 'reveal' }); }); }
})();
`;
