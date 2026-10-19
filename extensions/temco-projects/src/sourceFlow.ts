// Add Source — the mock's `flow/add-source`, on the shared page kit.
//
// Three steps: Kind, Location, Read. A source is somewhere documentation is read from — a repository, a document,
// a folder, a connected library — and the kind decides how the platform reads it. The write is this module's own
// store call, and it records exactly what the old dialog recorded: kind, name, where it lives, and the branch a
// repository is pinned to.

import * as https from 'https';
import * as vscode from 'vscode';
import { Catalog, CatalogUnavailable, slugOf } from './store';
import { escapeHtml as esc, icon, page, pageColumn } from './ui';

export const ADD_SOURCE_VIEW_TYPE = 'temcoProjects.addSource';

/**
 * What the wizard opens with.
 *
 * The enterprise and the repository are prefilled with the one Temco ships its documentation from, so the common case
 * is Next → Next → Add; either field can be replaced with anything, and neither lookup is required to finish.
 */
const DEFAULTS = {
	kind: 'repo',
	enterprise: 'temcocontrols',
	location: 'https://github.com/temcocontrols/t3000webview',
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
	readNow: boolean;
}

/** What a page asks the module for, beyond the finished values. */
interface FlowMessage {
	type?: string;
	values?: Values;
	/** The enterprise whose repositories are wanted — an owner, or a URL that contains one. */
	owner?: string;
}

/**
 * The repositories an enterprise publishes, asked of the GitHub API.
 *
 * Best-effort by design: a machine behind a proxy, or offline, gets a sentence and keeps the typed field — loading a
 * list is a convenience, and a form that cannot be completed without a network call would be worse than one that can.
 */
function listRepositories(owner: string): Promise<{ items: string[]; error?: string }> {
	const clean = owner.trim()
		.replace(/^https?:\/\//i, '')
		.replace(/^www\./i, '')
		.replace(/^github\.com\//i, '')
		.replace(/[\/]+$/, '');
	if (clean.length === 0) {
		return Promise.resolve({ items: [], error: 'Type an enterprise name first, for example github.com/temcocontrols.' });
	}

	const ask = (path: string): Promise<{ items: string[]; error?: string }> =>
		new Promise((resolve) => {
			const request = https.get(
				{
					host: 'api.github.com',
					path,
					headers: { 'user-agent': 'temco-platform', accept: 'application/vnd.github+json' },
					timeout: 7000,
				},
				(response) => {
					let body = '';
					response.setEncoding('utf8');
					response.on('data', (chunk: string) => {
						body += chunk;
					});
					response.on('end', () => {
						if (response.statusCode === 404) {
							resolve({ items: [], error: `notfound:${clean}` });
							return;
						}
						if (response.statusCode !== 200) {
							resolve({ items: [], error: `GitHub answered ${response.statusCode}. Type the repository address instead.` });
							return;
						}
						try {
							const parsed = JSON.parse(body) as { full_name?: unknown }[];
							resolve({ items: parsed.map((entry) => String(entry.full_name ?? '')).filter((name) => name.length > 0) });
						} catch {
							resolve({ items: [], error: 'GitHub answered something that is not a repository list.' });
						}
					});
				}
			);
			request.on('timeout', () => {
				request.destroy();
				resolve({ items: [], error: 'GitHub did not answer in time. Type the repository address instead.' });
			});
			request.on('error', () =>
				resolve({ items: [], error: 'GitHub could not be reached from this machine. Type the repository address instead.' })
			);
		});

	// An organisation first: an enterprise is usually one. A personal account is the fallback, not the default.
	return ask(`/orgs/${encodeURIComponent(clean)}/repos?per_page=100&sort=updated`).then((first) => {
		if (first.error === `notfound:${clean}`) {
			return ask(`/users/${encodeURIComponent(clean)}/repos?per_page=100&sort=updated`).then((second) =>
				second.error === `notfound:${clean}`
					? { items: [], error: `GitHub has no organisation or user called “${clean}”.` }
					: second
			);
		}
		return first;
	});
}

export class AddSourcePage {
	private panel: vscode.WebviewPanel | undefined;

	constructor(private readonly context: vscode.ExtensionContext) { }

	open(): void {
		const body = html();
		if (this.panel) {
			this.panel.reveal(pageColumn());
			this.panel.webview.html = page(body, { title: 'Add Source', script: SCRIPT, extraCss: LOCAL_CSS });
			return;
		}
		const panel = vscode.window.createWebviewPanel(ADD_SOURCE_VIEW_TYPE, 'Add Source', pageColumn(), {
			enableScripts: true,
			localResourceRoots: []
		});
		this.panel = panel;
		panel.webview.onDidReceiveMessage((message: { type?: string; values?: Values }) => void this.receive(message));
		panel.webview.html = page(body, { title: 'Add Source', script: SCRIPT, extraCss: LOCAL_CSS });
		panel.onDidDispose(() => {
			this.panel = undefined;
		});
	}

	dispose(): void {
		this.panel?.dispose();
	}

	private async receive(message: FlowMessage): Promise<void> {
		if (message.type === 'cancel') {
			this.panel?.dispose();
			return;
		}
		if (message.type === 'add' && message.values) {
			await this.add(message.values);
			return;
		}
		// The one lookup the location step can ask for. It is a convenience: a failure is a sentence, and the
		// address stays typed-in.
		if (message.type === 'repositories') {
			const answer = await listRepositories(String(message.owner ?? ''));
			await this.panel?.webview.postMessage({ type: 'repositories', items: answer.items, error: answer.error });
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
				branch: kind === 'git' && values.branch ? values.branch : undefined,
				defaultBranch: kind === 'git' && values.branch ? values.branch : undefined
			});
		} catch (error) {
			const message = error instanceof CatalogUnavailable ? error.message : String(error);
			void vscode.window.showErrorMessage(`Temco Projects: ${message}`);
			return;
		} finally {
			catalog?.close();
		}
		this.panel?.dispose();
		// The mock's third step is a promise: "read the source now, after it is added". Adding writes a row; the read
		// is what clones a repository and records the pages, so it is the read that makes the source useful.
		if (values.readNow) {
			void vscode.window.showInformationMessage(`${name} added — reading it now.`);
			await vscode.commands.executeCommand('temcoRepositories.readSource', slugOf(name));
		} else {
			void vscode.window.showInformationMessage(`${name} added. Read it from Sources when you are ready.`);
		}
		await vscode.commands.executeCommand('temcoDocs.sources');
	}
}

const field = (label: string, control: string, hint?: string): string =>
	`<div class="field"><label>${esc(label)}</label>${control}${hint ? `<div class="field__hint">${esc(hint)}</div>` : ''}</div>`;

const choice = (kind: { value: string; label: string; desc: string }): string =>
	`<label class="choice"><input type="radio" name="kind" value="${esc(kind.value)}"${kind.value === DEFAULTS.kind ? ' checked' : ''}><span class="choice__text"><span class="choice__label">${esc(kind.label)}</span><span class="choice__desc">${esc(kind.desc)}</span></span></label>`;

const steps = ['Kind', 'Location', 'Read'];

/** The wizard's own layout: air around the note, and the repository list as a bounded, scrollable area. */
const LOCAL_CSS = `
.wizard__body .source-note { margin: 22px 0 24px; }
.repo-list { max-height: 240px; overflow-y: auto; }
.repo-list .checklist__row { cursor: pointer; }
.repo-list .checklist__row:has(input:checked) { background: color-mix(in srgb, var(--accent) 10%, var(--bg-inset)); }
.repo-list .checklist__row:has(input:checked) .checklist__title { color: var(--fg-strong); font-weight: 500; }
.field > label.check { font-weight: 400; color: var(--fg); }
`;

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
			<div class="source-note" data-when="repo"><div class="callout">${icon('info')}<div><b>An enterprise, then a repository.</b> Type <code>github.com/temcocontrols</code> and press <b>Load Repositories</b> to see what that enterprise publishes — choose one from the list and its address is filled in for you. Asking GitHub is optional: the address can also be typed by hand.</div></div></div>
			<div class="form">
				<div data-when="repo">${field('Enterprise', `<div class="row" style="gap:8px;align-items:center"><input class="input" data-field="enterprise" value="${esc(DEFAULTS.enterprise)}" aria-label="Enterprise"><button type="button" class="btn" id="load-repos">${icon('download')}<span>Load Repositories</span></button></div>`, 'The owner on GitHub — an enterprise, an organisation, or a personal account. A name such as temcocontrols works, or the full address github.com/temcocontrols.')}</div>
				<div data-when="repo" id="repo-pick-wrap" hidden>${field('Repository', `<div class="checklist repo-list" id="repo-list" role="radiogroup" aria-label="Repositories"></div>`, 'Choose one of the repositories this enterprise publishes; the address is filled from it.')}</div>
				${field('Location', `<input class="input" data-field="location" value="${esc(DEFAULTS.location)}" aria-label="Location">`, 'A repository address, another Git URL, or a path to a folder or archive.')}
				<div data-when="repo"><div class="field"><label>Branch</label><label class="check"><input type="checkbox" data-field="useMain" checked><span>Read from <code>main</code> — the branch almost every repository publishes its documentation from.</span></label><div class="field__hint">Untick it to let the repository decide which branch it reads.</div></div></div>
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

/** Three steps, one validation rule, one lookup, and the values the module writes. */
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
	const pickWrap = document.getElementById('repo-pick-wrap');
	const pickList = document.getElementById('repo-list');
	const loadRepos = document.getElementById('load-repos');
	const labels = { repo: 'Repository', document: 'Document', folder: 'Folder', sharepoint: 'SharePoint' };
	let at = 0;

	function element(name) { return document.querySelector('[data-field="' + name + '"]'); }
	function kind() { return (document.querySelector('input[name="kind"]:checked') || {}).value || 'repo'; }
	function values() {
		return {
			kind: kind(),
			location: element('location').value,
			branch: element('useMain').checked ? 'main' : '',
			readNow: element('readNow').checked
		};
	}
	function followKind() {
		const isRepo = kind() === 'repo';
		Array.prototype.forEach.call(document.querySelectorAll('[data-when="repo"]'), function (node) {
			node.hidden = !isRepo;
		});
		// The picker only exists once an enterprise has answered; until then it stays out of the way.
		if (pickWrap && pickWrap.getAttribute('data-loaded') !== 'yes') { pickWrap.hidden = true; }
		hint.textContent = isRepo
			? 'The repository is cloned into the working area; nothing is pushed back.'
			: 'A path or a URL the platform can read.';
	}
	function fail(message) { error.textContent = message; error.hidden = false; }
	function clear() { error.hidden = true; }
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
				['Branch', v.kind === 'repo' ? '<span class="cell-mono">' + (v.branch || 'repository default') + '</span>' : '—']
			].map(function (pair) { return '<dt>' + pair[0] + '</dt><dd>' + pair[1] + '</dd>'; }).join('');
		}
	}
	function go(to) { clear(); at = to; show(); }

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

	function askRepositories() {
		const owner = (element('enterprise').value || '').trim();
		if (!owner) { fail('An enterprise is needed to load its repositories.'); return; }
		clear();
		loadRepos.disabled = true;
		loadRepos.querySelector('span').textContent = 'Loading…';
		api.postMessage({ type: 'repositories', owner: owner });
	}

	if (loadRepos) { loadRepos.addEventListener('click', askRepositories); }
	if (pickList) {
		pickList.addEventListener('change', function (event) {
			if (event.target && event.target.name === 'repoPick') { choose(event.target.value); }
		});
	}

	function choose(name) {
		if (!name) { return; }
		element('location').value = 'https://github.com/' + name;
		clear();
	}

	window.addEventListener('message', function (event) {
		const message = event.data || {};
		if (message.type === 'repositories') {
			if (loadRepos) {
				loadRepos.disabled = false;
				loadRepos.querySelector('span').textContent = 'Load Repositories';
			}
			if (message.error) { fail(message.error); return; }
			const items = message.items || [];
			if (!items.length) { fail('That enterprise returned no repositories.'); return; }
			const picked = document.querySelector('input[name="repoPick"]:checked');
			const previous = picked ? picked.value : '';
			pickList.innerHTML = '';
			items.forEach(function (name, index) {
				const row = document.createElement('label');
				row.className = 'checklist__row';
				const radio = document.createElement('input');
				radio.type = 'radio';
				radio.name = 'repoPick';
				radio.value = name;
				radio.checked = previous ? name === previous : index === 0;
				const text = document.createElement('span');
				text.className = 'checklist__text';
				const title = document.createElement('span');
				title.className = 'checklist__title';
				title.textContent = name;
				const sub = document.createElement('span');
				sub.className = 'checklist__sub';
				sub.textContent = 'github.com/' + name;
				text.appendChild(title);
				text.appendChild(sub);
				row.appendChild(radio);
				row.appendChild(text);
				pickList.appendChild(row);
			});
			pickWrap.setAttribute('data-loaded', 'yes');
			pickWrap.hidden = kind() !== 'repo';
			choose(items.indexOf(previous) >= 0 ? previous : items[0]);
			return;
		}
	});

	show();
})();
`;
