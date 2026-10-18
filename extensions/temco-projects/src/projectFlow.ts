// New Project — the mock's `flow/new-project`, on the shared page kit.
//
// Four steps: Basics, Sources, Outputs, Review. The wizard is markup and a small script; the act of creating the
// project is this module's own, and it writes exactly what the old form wrote — the project, the sources it cites
// and the outputs it builds — so nothing about the catalog changed with the page.

import * as vscode from 'vscode';
import { Catalog, CatalogUnavailable, Selection, slugOf, SourceRow } from './store';
import { escapeHtml as esc, icon, page, pageColumn } from './ui';

export const NEW_PROJECT_VIEW_TYPE = 'temcoProjects.newProject';

/** What the wizard offers when it opens. The mock's defaults, over whatever sources the catalog has. */
const DEFAULTS = { name: 'T3000 Documentation', version: '13.0', owner: 'Derek', audience: 'Integrators and installers' };

const TARGETS = [
	{ value: 'website', label: 'Website', sub: 'Static pages for Temco Learn' },
	{ value: 'pdf', label: 'PDF', sub: 'One document, printed layout' },
	{ value: 'help', label: 'Offline help', sub: 'CHM · needs the help compiler' },
	{ value: 'search', label: 'Search index', sub: 'lunr index for the site' },
	{ value: 'ai', label: 'AI index', sub: 'Embeddings, kept on this machine only' }
];

/** The outputs ticked when the page opens. */
const DEFAULT_TARGETS = ['website', 'pdf', 'help', 'search'];

export class ProjectFlowPage {
	private panel: vscode.WebviewPanel | undefined;
	private sources: SourceRow[] = [];

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly selection: Selection,
		private readonly refresh: () => void
	) { }

	async open(): Promise<void> {
		let unavailable: string | undefined;
		try {
			const catalog = await Catalog.open(this.context);
			this.sources = catalog.sources();
		} catch (error) {
			unavailable = error instanceof CatalogUnavailable ? error.message : String(error);
			this.sources = [];
		}

		const body = html(this.sources, unavailable);
		if (this.panel) {
			this.panel.reveal(pageColumn());
			this.panel.webview.html = page(body, { title: 'New Project', script: WIZARD_SCRIPT });
			return;
		}

		this.panel = vscode.window.createWebviewPanel(NEW_PROJECT_VIEW_TYPE, 'New Project', pageColumn(), {
			enableScripts: true,
			localResourceRoots: []
		});
		this.panel.webview.onDidReceiveMessage((message: { type?: string; values?: Values }) => void this.receive(message));
		this.panel.webview.html = page(body, { title: 'New Project', script: WIZARD_SCRIPT });
		this.panel.onDidDispose(() => {
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
		if (message.type === 'create' && message.values) {
			await this.create(message.values);
		}
	}

	/** The project, the sources it cites and the outputs it builds — the same write the form made. */
	private async create(values: Values): Promise<void> {
		const name = values.name.trim();
		if (name.length === 0) {
			return;
		}
		const slug = slugOf(name);
		const outputs = values.targets.filter((target) => TARGETS.some((known) => known.value === target));
		const cited = values.sources.map((source) => slugOf(source));

		let catalog: Catalog | undefined;
		try {
			catalog = await Catalog.open(this.context);
			catalog.createDocument({
				name,
				slug,
				version: values.version.trim() || undefined,
				audience: values.audience.trim() || undefined,
				owner: values.owner.trim() || undefined
			});
			catalog.setDocumentSources(slug, cited);
			catalog.setRecipe(slug, 'docfx', outputs);
		} catch (error) {
			const message = error instanceof CatalogUnavailable ? error.message : String(error);
			void vscode.window.showErrorMessage(`Temco Projects: ${message}`);
			return;
		} finally {
			catalog?.close();
		}

		// A project you have just made is the one you are working on: it is what the Workspace view and the AI read.
		await this.selection.select(slug);
		this.refresh();
		this.panel?.dispose();
		void vscode.window.showInformationMessage(`${name} created as a draft.`);
		await vscode.commands.executeCommand('temcoDocs.projects');
	}
}

interface Values {
	name: string;
	version: string;
	owner: string;
	audience: string;
	sources: string[];
	targets: string[];
}

const field = (label: string, control: string, hint?: string): string =>
	`<div class="field"><label>${esc(label)}</label>${control}${hint ? `<div class="field__hint">${esc(hint)}</div>` : ''}</div>`;

const options = (values: string[], selected: string): string =>
	values.map((value) => `<option${value === selected ? ' selected' : ''}>${esc(value)}</option>`).join('');

const checklist = (items: { value: string; label: string; sub: string }[], checked: (item: { value: string }) => boolean, fieldName: string): string =>
	`<div class="checklist">${items.map((item) => `<label class="checklist__row"><input type="checkbox" data-field="${fieldName}" data-multi value="${esc(item.value)}"${checked(item) ? ' checked' : ''}><span class="checklist__text"><span class="checklist__title">${esc(item.label)}</span><span class="checklist__sub">${esc(item.sub)}</span></span></label>`).join('')}</div>`;

const steps = ['Basics', 'Sources', 'Outputs', 'Review'];

function html(sources: SourceRow[], unavailable?: string): string {
	const repositories = sources.filter((source) => source.kind === 'git');
	const files = sources.filter((source) => source.kind !== 'git');
	const repositoryRows = repositories.map((source) => ({ value: source.name, label: source.name, sub: `${source.kind} · ${source.branch ?? 'no branch'} · ${source.pages ? `${source.pages} pages` : 'not read'}` }));
	const fileRows = files.map((source) => ({ value: source.name, label: source.name, sub: source.kind }));

	const rail = steps.map((label, index) =>
		`${index > 0 ? '<span class="step__arrow" aria-hidden="true">→</span>' : ''}<button type="button" class="step${index === 0 ? ' is-active' : ''}" data-step="${index}" role="tab" aria-selected="${index === 0}"><span class="step__n">${index + 1}.</span><span class="step__label">${esc(label)}</span></button>`
	).join('');

	const empty = unavailable
		? `<div class="callout callout--warn">${icon('alert')}<div><b>The store is not available.</b> ${esc(unavailable)}</div></div>`
		: '';

	return `<div class="page-head">
	<div class="page-head__main">
		<div class="eyebrow">Documentation</div>
		<h1 class="page-head__title">${icon('plus')}New Project</h1>
		<p class="page-head__desc">A project is a version of a product’s documentation: the sources it reads, the pages it holds and the artifacts it builds.</p>
	</div>
	<div class="page-head__actions"><button type="button" class="btn btn--ghost" id="wizard-cancel">${icon('close')}<span>Cancel</span></button></div>
</div>

${empty}

<div class="wizard">
	<div class="wizard__steps" role="tablist">${rail}</div>
	<div class="wizard__body">
		<div data-step-body="0">
			<div class="wizard__title">Name, version and owner</div>
			<p class="wizard__hint">The name, the version, and who answers for the result.</p>
			<div class="form">
				${field('Name', `<input class="input" data-field="name" value="${esc(DEFAULTS.name)}" aria-label="Project name">`)}
				${field('Version', `<input class="input" data-field="version" value="${esc(DEFAULTS.version)}" aria-label="Version">`, 'A project publishes one version at a time.')}
				${field('Owner', `<select class="select" data-field="owner" aria-label="Owner">${options(['Derek', 'Mei', 'Ana', 'Unassigned'], DEFAULTS.owner)}</select>`)}
				${field('Audience', `<input class="input" data-field="audience" value="${esc(DEFAULTS.audience)}" aria-label="Audience">`)}
			</div>
		</div>
		<div data-step-body="1" hidden>
			<div class="wizard__title">What it reads</div>
			<p class="wizard__hint">Search the repositories, or choose individual files and folders. Both record the pages they declare.</p>
			<div class="checklist-group">
				<div class="checklist-heading">Repositories<span class="checklist-heading__count">${repositories.length}</span></div>
				<div class="checklist-tools"><input class="input input--sm" data-filter="repos" placeholder="Search repositories" aria-label="Search repositories"><button type="button" class="btn btn--sm btn--ghost" id="load-all">${icon('download')}<span>Load all</span></button></div>
				<div data-filter-list="repos">${checklist(repositoryRows, () => false, 'sources')}</div>
			</div>
			<div class="checklist-group">
				<div class="checklist-heading">Files and folders<span class="checklist-heading__count">${files.length}</span></div>
				<details class="disclosure"><summary>Choose files and folders…<span class="cell-muted" id="file-count">0 of ${files.length} selected</span></summary>${checklist(fileRows, () => false, 'sources')}</details>
			</div>
			<p class="wizard__hint" style="margin-top:12px"><span id="source-count">0</span> of ${sources.length} selected</p>
		</div>
		<div data-step-body="2" hidden>
			<div class="wizard__title">What it builds</div>
			<p class="wizard__hint">One build produces every target you tick here.</p>
			${checklist(TARGETS, (item) => DEFAULT_TARGETS.includes(item.value), 'targets')}
		</div>
		<div data-step-body="3" hidden>
			<div class="wizard__title">Check before creating</div>
			<p class="wizard__hint">Nothing has been written yet.</p>
			<dl class="kv" id="review"></dl>
			<div class="mt-16"><div class="callout">${icon('info')}<div>The project is recorded in the platform database under <code>temcoStore</code>. Nothing is written into a repository, and the first build is yours to start.</div></div></div>
		</div>
		<div class="wizard__error" id="wizard-error" hidden></div>
	</div>
	<div class="wizard__foot">
		<span class="cell-muted" style="font-size:12px" id="wizard-count">Step 1 of 4</span>
		<span class="wizard__spacer"></span>
		<button type="button" class="btn" id="wizard-back" hidden>${icon('chevron-left')}<span>Back</span></button>
		<button type="button" class="btn btn--primary" id="wizard-next"><span>Next</span></button>
		<button type="button" class="btn btn--primary" id="wizard-finish" hidden>${icon('check')}<span>Create Project</span></button>
	</div>
</div>`;
}

/** The wizard's behaviour: four steps, the mock's three rules, and one message at the end. */
const WIZARD_SCRIPT = `
(function () {
	const api = acquireVsCodeApi();
	const steps = Array.prototype.slice.call(document.querySelectorAll('.wizard__steps .step'));
	const bodies = Array.prototype.slice.call(document.querySelectorAll('[data-step-body]'));
	const error = document.getElementById('wizard-error');
	const count = document.getElementById('wizard-count');
	const back = document.getElementById('wizard-back');
	const next = document.getElementById('wizard-next');
	const finish = document.getElementById('wizard-finish');
	const review = document.getElementById('review');
	let at = 0;

	function field(name) {
		return document.querySelector('[data-field="' + name + '"]');
	}
	function checked(name) {
		return Array.prototype.slice.call(document.querySelectorAll('[data-field="' + name + '"]:checked')).map(function (input) { return input.value; });
	}
	function values() {
		return {
			name: field('name').value,
			version: field('version').value,
			owner: field('owner').value,
			audience: field('audience').value,
			sources: checked('sources'),
			targets: checked('targets')
		};
	}
	function counts() {
		const total = document.querySelectorAll('[data-field="sources"]').length;
		const chosen = checked('sources');
		document.getElementById('source-count').textContent = String(chosen.length);
		const files = Array.prototype.slice.call(document.querySelectorAll('.checklist-group:last-of-type [data-field="sources"]'));
		const filesChosen = files.filter(function (input) { return input.checked; }).length;
		document.getElementById('file-count').textContent = filesChosen + ' of ' + files.length + ' selected';
		return { total: total, chosen: chosen.length };
	}
	function fail(message) {
		error.textContent = message;
		error.hidden = false;
	}
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
		if (at === 3) {
			const v = values();
			review.innerHTML = [
				['Name', '<span class="cell-strong">' + v.name + '</span>'],
				['Version', '<span class="cell-mono">' + v.version + '</span>'],
				['Owner', v.owner],
				['Audience', v.audience],
				['Sources', v.sources.length + ' — ' + v.sources.join(', ')],
				['Outputs', v.targets.join(', ') || 'none']
			].map(function (pair) { return '<dt>' + pair[0] + '</dt><dd>' + pair[1] + '</dd>'; }).join('');
		}
	}
	function go(to) {
		error.hidden = true;
		at = to;
		show();
		counts();
	}

	steps.forEach(function (step) { step.addEventListener('click', function () { go(Number(step.dataset.step)); }); });
	back.addEventListener('click', function () { go(Math.max(0, at - 1)); });
	next.addEventListener('click', function () {
		const v = values();
		if (at === 0 && !v.name.trim()) { fail('A project needs a name.'); return; }
		if (at === 1 && v.sources.length === 0) { fail('Choose at least one source to read.'); return; }
		if (at === 2 && v.targets.length === 0) { fail('Choose at least one output to build.'); return; }
		go(at + 1);
	});
	finish.addEventListener('click', function () {
		const v = values();
		if (!v.name.trim()) { go(0); fail('A project needs a name.'); return; }
		if (v.sources.length === 0) { go(1); fail('Choose at least one source to read.'); return; }
		if (v.targets.length === 0) { go(2); fail('Choose at least one output to build.'); return; }
		api.postMessage({ type: 'create', values: v });
	});
	document.getElementById('wizard-cancel').addEventListener('click', function () { api.postMessage({ type: 'cancel' }); });
	const filter = document.querySelector('[data-filter="repos"]');
	if (filter) {
		filter.addEventListener('input', function () {
			const term = filter.value.toLowerCase();
			Array.prototype.forEach.call(document.querySelectorAll('[data-filter-list="repos"] .checklist__row'), function (row) {
				row.hidden = term.length > 0 && row.textContent.toLowerCase().indexOf(term) < 0;
			});
		});
	}
	const loadAll = document.getElementById('load-all');
	if (loadAll) {
		loadAll.addEventListener('click', function () {
			Array.prototype.forEach.call(document.querySelectorAll('[data-filter-list="repos"] [data-field="sources"]'), function (input) { input.checked = true; });
			counts();
		});
	}
	document.addEventListener('change', function (event) {
		if (event.target && event.target.getAttribute && event.target.getAttribute('data-field')) { counts(); }
	});
	show();
	counts();
})();
`;
