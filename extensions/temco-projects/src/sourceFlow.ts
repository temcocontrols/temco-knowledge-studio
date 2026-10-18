// Add Source — the mock's `flow/add-source`, on the shared page kit.
//
// Three steps: Kind, Location, Read. A source is somewhere documentation is read from — a repository, a document,
// a folder, a connected library — and the kind decides how the platform reads it. The write is this module's own
// store call, and it records exactly what the old dialog recorded: kind, name, where it lives, and the branch a
// repository is pinned to.

import * as vscode from 'vscode';
import { Catalog, CatalogUnavailable, slugOf } from './store';
import { escapeHtml as esc, icon, page, pageColumn } from './ui';

export const ADD_SOURCE_VIEW_TYPE = 'temcoProjects.addSource';

/** What the wizard opens with. The mock's defaults. */
const DEFAULTS = {
	kind: 'repo',
	location: 'https://github.com/temcocontrols/t3000webview',
	branch: 'main',
	shallow: false,
	readNow: true
};

const KINDS = [
	{ value: 'repo', label: 'Git repository', desc: 'Cloned locally with full history, so a draft can be about a commit.' },
	{ value: 'document', label: 'Document', desc: 'A PDF or a Word file on this machine.' },
	{ value: 'folder', label: 'Folder', desc: 'A directory of Markdown or HTML files.' },
	{ value: 'sharepoint', label: 'SharePoint', desc: 'A connected library, read through the API.' }
];

/** The kinds the store records, which is not the same list: it has three storage shapes, not four kinds of place. */
const STORE_KIND: { [kind: string]: 'git' | 'folder' | 'archive' } = {
	repo: 'git',
	document: 'archive',
	folder: 'folder',
	sharepoint: 'folder'
};

interface Values {
	kind: string;
	location: string;
	branch: string;
	shallow: boolean;
	readNow: boolean;
}

export class AddSourcePage {
	private panel: vscode.WebviewPanel | undefined;

	constructor(private readonly context: vscode.ExtensionContext) { }

	open(): void {
		const body = html();
		if (this.panel) {
			this.panel.reveal(pageColumn());
			this.panel.webview.html = page(body, { title: 'Add Source', script: SCRIPT });
			return;
		}
		const panel = vscode.window.createWebviewPanel(ADD_SOURCE_VIEW_TYPE, 'Add Source', pageColumn(), {
			enableScripts: true,
			localResourceRoots: []
		});
		this.panel = panel;
		panel.webview.onDidReceiveMessage((message: { type?: string; values?: Values }) => void this.receive(message));
		panel.webview.html = page(body, { title: 'Add Source', script: SCRIPT });
		panel.onDidDispose(() => {
			this.panel = undefined;
		});
	}

	dispose(): void {
		this.panel?.dispose();
	}

	private async receive(message: { type?: string; values?: Values }): Promise<void> {
		if (message.type === 'cancel') {
			this.panel?.dispose();
			return;
		}
		if (message.type === 'add' && message.values) {
			await this.add(message.values);
		}
	}

	/** Records the source in the store, then shows the page it now appears on. */
	private async add(values: Values): Promise<void> {
		const location = values.location.trim();
		if (location.length === 0) {
			return;
		}
		const name = location.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? location;
		const kind = STORE_KIND[values.kind] ?? 'folder';
		let catalog: Catalog | undefined;
		try {
			catalog = await Catalog.open(this.context);
			catalog.addSource({
				kind,
				name,
				slug: slugOf(name),
				remoteUrl: kind === 'git' ? location : undefined,
				path: kind === 'git' ? undefined : location,
				branch: kind === 'git' ? values.branch : undefined,
				defaultBranch: kind === 'git' ? values.branch : undefined
			});
		} catch (error) {
			const message = error instanceof CatalogUnavailable ? error.message : String(error);
			void vscode.window.showErrorMessage(`Temco Projects: ${message}`);
			return;
		} finally {
			catalog?.close();
		}
		this.panel?.dispose();
		void vscode.window.showInformationMessage(`${name} added${values.readNow ? ' — read it from Sources when you are ready.' : '.'}`);
		await vscode.commands.executeCommand('temcoDocs.sources');
	}
}

const field = (label: string, control: string, hint?: string): string =>
	`<div class="field"><label>${esc(label)}</label>${control}${hint ? `<div class="field__hint">${esc(hint)}</div>` : ''}</div>`;

const options = (values: string[], selected: string): string =>
	values.map((value) => `<option${value === selected ? ' selected' : ''}>${esc(value)}</option>`).join('');

const choice = (kind: { value: string; label: string; desc: string }): string =>
	`<label class="choice"><input type="radio" name="kind" value="${esc(kind.value)}"${kind.value === DEFAULTS.kind ? ' checked' : ''}><span class="choice__text"><span class="choice__label">${esc(kind.label)}</span><span class="choice__desc">${esc(kind.desc)}</span></span></label>`;

const steps = ['Kind', 'Location', 'Read'];

function html(): string {
	const rail = steps.map((label, index) =>
		`${index > 0 ? '<span class="step__arrow" aria-hidden="true">→</span>' : ''}<button type="button" class="step${index === 0 ? ' is-active' : ''}" data-step="${index}" role="tab" aria-selected="${index === 0}"><span class="step__n">${index + 1}.</span><span class="step__label">${esc(label)}</span></button>`
	).join('');

	return `<div class="page-head">
	<div class="page-head__main">
		<div class="eyebrow">Documentation</div>
		<h1 class="page-head__title">${icon('repo')}Add Source</h1>
		<p class="page-head__desc">A source is somewhere documentation is read from: a repository, a document, a folder, or a connected library.</p>
	</div>
	<div class="page-head__actions"><button type="button" class="btn btn--ghost" id="wizard-cancel">${icon('close')}<span>Cancel</span></button></div>
</div>

<div class="wizard">
	<div class="wizard__steps" role="tablist">${rail}</div>
	<div class="wizard__body">
		<div data-step-body="0">
			<div class="wizard__title">What kind of source?</div>
			<p class="wizard__hint">The kind decides how the platform reads it, and what it records.</p>
			<div class="checklist-heading">Repositories</div>
			<div class="choice-grid">${choice(KINDS[0])}</div>
			<div class="checklist-heading mt-16">Files and folders</div>
			<div class="choice-grid">${KINDS.slice(1).map(choice).join('')}</div>
		</div>
		<div data-step-body="1" hidden>
			<div class="wizard__title">Where is it?</div>
			<p class="wizard__hint" id="location-hint">The repository is cloned into the working area; nothing is pushed back.</p>
			<div class="form">
				${field('Location', `<input class="input" data-field="location" value="${esc(DEFAULTS.location)}" aria-label="Location">`)}
				<div data-when="repo">${field('Branch', `<select class="select" data-field="branch" aria-label="Branch">${options(['main', 't3000', 'release/13.0'], DEFAULTS.branch)}</select>`)}</div>
				<label class="check" data-when="repo"><input type="checkbox" data-field="shallow"><span>Shallow copy — faster, but the history is not there for drafts</span></label>
			</div>
		</div>
		<div data-step-body="2" hidden>
			<div class="wizard__title">Read it</div>
			<p class="wizard__hint">Reading records what the source contains. It is safe to repeat.</p>
			<dl class="kv" id="review"></dl>
			<label class="check" style="margin-top:14px"><input type="checkbox" data-field="readNow"${DEFAULTS.readNow ? ' checked' : ''}><span>Read the source now, after it is added</span></label>
			<div class="mt-16"><div class="callout">${icon('info')}<div>A source is never edited. The pages a read finds are recorded in the platform database; the source stays the only copy of its own content.</div></div></div>
		</div>
		<div class="wizard__error" id="wizard-error" hidden></div>
	</div>
	<div class="wizard__foot">
		<span class="cell-muted" style="font-size:12px" id="wizard-count">Step 1 of 3</span>
		<span class="wizard__spacer"></span>
		<button type="button" class="btn" id="wizard-back" hidden>${icon('chevron-left')}<span>Back</span></button>
		<button type="button" class="btn btn--primary" id="wizard-next"><span>Next</span></button>
		<button type="button" class="btn btn--primary" id="wizard-finish" hidden>${icon('check')}<span>Add Source</span></button>
	</div>
</div>`;
}

/** Three steps, one validation rule, and the values the module writes. */
const SCRIPT = `
(function () {
	const api = acquireVsCodeApi();
	const bodies = Array.prototype.slice.call(document.querySelectorAll('[data-step-body]'));
	const steps = Array.prototype.slice.call(document.querySelectorAll('.wizard__steps .step'));
	const error = document.getElementById('wizard-error');
	const count = document.getElementById('wizard-count');
	const back = document.getElementById('wizard-back');
	const next = document.getElementById('wizard-next');
	const finish = document.getElementById('wizard-finish');
	const review = document.getElementById('review');
	const hint = document.getElementById('location-hint');
	const labels = { repo: 'Repository', document: 'Document', folder: 'Folder', sharepoint: 'SharePoint' };
	let at = 0;

	function element(name) { return document.querySelector('[data-field="' + name + '"]'); }
	function kind() { return (document.querySelector('input[name="kind"]:checked') || {}).value || 'repo'; }
	function values() {
		return {
			kind: kind(),
			location: element('location').value,
			branch: element('branch').value,
			shallow: element('shallow').checked,
			readNow: element('readNow').checked
		};
	}
	function followKind() {
		const isRepo = kind() === 'repo';
		Array.prototype.forEach.call(document.querySelectorAll('[data-when="repo"]'), function (node) { node.hidden = !isRepo; });
		hint.textContent = isRepo
			? 'The repository is cloned into the working area; nothing is pushed back.'
			: 'A path or a URL the platform can read.';
	}
	function fail(message) { error.textContent = message; error.hidden = false; }
	function show() {
		steps.forEach(function (step, index) {
			step.classList.toggle('is-active', index === at);
			step.classList.toggle('is-done', index < at);
			step.setAttribute('aria-selected', String(index === at));
		});
		bodies.forEach(function (body, index) { body.hidden = index !== at; });
		count.textContent = 'Step ' + (at + 1) + ' of ' + bodies.length;
		back.hidden = at === 0;
		next.hidden = at === bodies.length - 1;
		finish.hidden = at !== bodies.length - 1;
		followKind();
		if (at === 2) {
			const v = values();
			review.innerHTML = [
				['Kind', labels[v.kind] || v.kind],
				['Location', '<span class="cell-mono">' + v.location + '</span>'],
				['Branch', v.kind === 'repo' ? '<span class="cell-mono">' + v.branch + (v.shallow ? ' · shallow' : '') + '</span>' : '—']
			].map(function (pair) { return '<dt>' + pair[0] + '</dt><dd>' + pair[1] + '</dd>'; }).join('');
		}
	}
	function go(to) { error.hidden = true; at = to; show(); }

	steps.forEach(function (step) { step.addEventListener('click', function () { go(Number(step.dataset.step)); }); });
	back.addEventListener('click', function () { go(Math.max(0, at - 1)); });
	next.addEventListener('click', function () {
		if (at === 1 && !values().location.trim()) { fail('A source needs a location.'); return; }
		go(at + 1);
	});
	finish.addEventListener('click', function () {
		if (!values().location.trim()) { go(1); fail('A source needs a location.'); return; }
		api.postMessage({ type: 'add', values: values() });
	});
	document.getElementById('wizard-cancel').addEventListener('click', function () { api.postMessage({ type: 'cancel' }); });
	document.addEventListener('change', function (event) {
		if (event.target && event.target.name === 'kind') { followKind(); }
	});
	show();
})();
`;
