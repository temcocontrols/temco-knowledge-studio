// The projects page: every documentation set this machine manages, in one list.
//
// The Dashboard's *Projects* view is where a project is worked on — one row, one current project. This page is the
// overview: what exists, which one is current, and how each one is doing. It is a page rather than a second tree
// because the questions are different: a tree answers "which page do I open", a page answers "which project needs
// me".
//
// Every fact here is read from the catalog, never estimated: pages as the last read recorded them, sources as they
// are cited, drafts as they are waiting, and the build time of the last artifact written. A project with no local
// copy says so, because a page count read over an API is not the same thing as a working tree.

import * as vscode from 'vscode';
import { Catalog, CatalogUnavailable, Selection } from './store';
import { PROJECTS_PAGE_VIEW_TYPE } from './surface';
import { commandScript, escapeHtml as esc, icon, page, pageColumn, runCommand, toneMark } from './ui';

/** One row of the list: the catalog's own fields, plus what the four queries beside it counted. */
interface ProjectRow {
	slug: string;
	name: string;
	version?: string;
	origin?: string;
	sources: number;
	builtAt?: string;
	pages: number;
	drafts: number;
	/** Cited sources with no copy on this machine — their pages were read over an API and cannot be checked. */
	readOnly: number;
}

/** Just the view types are exported by `surface.ts`; this is the page's own. */
export class ProjectsPage {
	private panel: vscode.WebviewPanel | undefined;

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly selection: Selection
	) { }

	async open(): Promise<void> {
		const rows = await this.read();
		if (this.panel !== undefined) {
			this.panel.reveal(pageColumn());
			this.panel.webview.html = this.html(rows);
			return;
		}
		this.panel = vscode.window.createWebviewPanel(
			PROJECTS_PAGE_VIEW_TYPE,
			'Projects',
			pageColumn(),
			{ enableScripts: true, localResourceRoots: [] }
		);
		this.panel.iconPath = new vscode.ThemeIcon('layout');
		this.panel.webview.html = this.html(rows);
		this.panel.webview.onDidReceiveMessage(runCommand);
		// Coming back to the page after an act elsewhere — *Work on*, *Open* — is a re-read, not a stale list: the
		// current marker and the counts are read from the catalog, and the catalog has changed.
		this.panel.onDidChangeViewState((state) => {
			if (state.webviewPanel.visible) {
				void this.reload();
			}
		});
		this.panel.onDidDispose(() => {
			this.panel = undefined;
		});
	}

	/** Redraws the open page — the list is a reading of the catalog, so it is re-read rather than patched. */
	async reload(): Promise<void> {
		if (this.panel !== undefined) {
			this.panel.webview.html = this.html(await this.read());
		}
	}

	dispose(): void {
		this.panel?.dispose();
	}

	private async read(): Promise<ProjectRow[]> {
		let catalog: Catalog | undefined;
		try {
			catalog = await Catalog.open(this.context);
			return catalog.documents().map((row) => {
				const cited = catalog?.documentSourceSlugs(row.slug) ?? [];
				const readOnly = cited.filter((slug) => {
					const source = catalog?.source(slug);
					return source !== undefined && source.path === undefined;
				}).length;
				return {
					slug: row.slug,
					name: row.name,
					version: row.version,
					origin: row.origin,
					sources: row.sources,
					builtAt: row.builtAt,
					pages: catalog?.documentPages(row.slug).length ?? 0,
					drafts: catalog?.drafts(row.slug, 'draft').length ?? 0,
					readOnly,
				};
			});
		} catch (error) {
			const message = error instanceof CatalogUnavailable ? error.message : String(error);
			void vscode.window.showErrorMessage(`Temco Projects: ${message}`);
			return [];
		} finally {
			catalog?.close();
		}
	}

	private html(rows: readonly ProjectRow[]): string {
		const current = this.selection.project();
		const withDrafts = rows.filter((row) => row.drafts > 0).length;
		const neverBuilt = rows.filter((row) => row.builtAt === undefined).length;
		const summary = rows.length === 0
			? 'No project yet.'
			: [
				`${rows.length} project${rows.length === 1 ? '' : 's'}`,
				current === undefined ? 'none current' : '1 current',
				withDrafts > 0 ? `${withDrafts} with drafts waiting` : '',
				neverBuilt > 0 ? `${neverBuilt} never built` : '',
			].filter((part) => part.length > 0).join(' · ');

		const head = `<div class="page-head"><div class="page-head__main">
  <div class="eyebrow">Dashboard › Projects</div>
  <h1 class="page-head__title">${icon('list')}Projects</h1>
  <p class="page-head__desc">Every documentation set this machine manages. Open one to see what it cites and what it
  produces; make one current to work on its pages.</p>
</div>
<div class="page-head__actions">${button('New Project', 'temcoProjects.newProject', { primary: true, mark: 'plus' })}</div>
</div>
<div class="facts"><span>${esc(summary)}</span></div>`;

		const body = rows.length === 0
			? `<div class="empty"><div class="empty__title">No project yet</div>
  <p>A project is what you manage: it cites sources and produces a site.</p>
  <div class="row">${button('Create a Project', 'temcoProjects.newProject', { primary: true, mark: 'plus' })}
  ${button('Create from a Repository', 'temcoProjects.newProjectFromRepository', { mark: 'repo' })}</div></div>`
			: rows.map((row) => projectRow(row, row.slug === current)).join('\n');

		return page(`${head}<div class="card card--flush">${body}</div>`, {
			title: 'Projects',
			script: commandScript,
		});
	}
}

/**
 * One project: what it is called, how it began, how it is doing, and the two acts a list offers.
 *
 * The row's grid is the kit's — a mark cell, the main cell, a state cell and an actions cell, in that order. The
 * mark is first because the grid reserves 24px for it: a row that starts with `__main` shifts every column left and
 * reads as misaligned, which is what a row missing this cell looked like.
 */
function projectRow(row: ProjectRow, current: boolean): string {
	const facts = [
		row.pages === 0 ? 'no pages' : `${row.pages} page${row.pages === 1 ? '' : 's'}`,
		row.sources === 0 ? 'no source' : `${row.sources} source${row.sources === 1 ? '' : 's'}`,
		row.builtAt === undefined ? 'never built' : `built ${when(row.builtAt)}`,
		row.drafts > 0 ? `${row.drafts} draft${row.drafts === 1 ? '' : 's'} waiting` : 'no drafts',
	].map((fact) => `<span>${esc(fact)}</span>`).join('<span> · </span>');
	const warning = row.readOnly === 0
		? ''
		: `<div class="record-row__meta" style="color:var(--warn,#b8860b)">${icon('warning')}<span>${row.readOnly} source${row.readOnly === 1 ? ' has' : 's have'} no local copy, so ${row.readOnly === 1 ? 'its pages were' : 'their pages were'} read over the API</span></div>`;

	return `<div class="record-row${current ? ' record-row--current' : ''}" data-command="temcoProjects.openProject" data-args="${esc(JSON.stringify(row.slug))}">
  ${toneMark(current ? 'book' : 'folder', current ? 'accent' : 'info')}
  <div class="record-row__main">
    <div class="record-row__title">
      <span class="record-row__name">${esc(row.name)}</span>
      ${row.version === undefined ? '' : `<span class="cell-mono">${esc(row.version)}</span>`}
      ${row.origin === undefined ? '' : `<span class="tag">${esc(row.origin)}</span>`}
    </div>
    <div class="record-row__meta">${facts}</div>
    ${warning}
  </div>
  <div class="record-row__state">${current ? badge('Current', 'ok') : row.drafts > 0 ? badge(`${row.drafts} waiting`, 'warn') : ''}</div>
  <div style="display:flex;gap:6px;align-items:center">
    ${current ? '' : button('Work on', 'temcoProjects.selectProject', { small: true, ghost: true, arg: row.slug })}
  </div>
</div>`;
}

interface ButtonOptions {
	primary?: boolean;
	ghost?: boolean;
	small?: boolean;
	mark?: string;
	/** The one argument the command is run with — a slug, encoded so `rowSlug` reads it. */
	arg?: string;
}

/**
 * One act, as the kit draws it: a command id the page posts back, never a script of its own.
 *
 * The argument is encoded as a single JSON value rather than an array, because the shared script hands whatever it
 * read to `executeCommand` as **one** argument, and the commands here read it with `rowSlug`, which knows a string
 * and an object with a `slug` — not a list.
 */
function button(label: string, command: string, options: ButtonOptions = {}): string {
	const kind = options.primary === true ? ' btn--primary' : options.ghost === true ? ' btn--ghost' : '';
	const size = options.small === true ? ' btn--sm' : '';
	const mark = options.mark === undefined ? '' : icon(options.mark);
	const args = options.arg === undefined ? '' : ` data-args="${esc(JSON.stringify(options.arg))}"`;
	return `<button type="button" class="btn${kind}${size}" data-command="${command}"${args}>${mark}<span>${esc(label)}</span></button>`;
}

function badge(label: string, tone: 'ok' | 'warn' | 'err' | 'info'): string {
	return `<span class="badge badge--${tone}">${esc(label)}</span>`;
}

/** When something happened, said the way a person says it: an hour ago, three days ago, or the date. */
function when(stamp: string): string {
	const at = new Date(stamp);
	if (Number.isNaN(at.getTime())) {
		return stamp;
	}
	const minutes = Math.floor((Date.now() - at.getTime()) / 60000);
	if (minutes < 1) {
		return 'just now';
	}
	if (minutes < 60) {
		return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
	}
	const hours = Math.floor(minutes / 60);
	if (hours < 24) {
		return `${hours} hour${hours === 1 ? '' : 's'} ago`;
	}
	const days = Math.floor(hours / 24);
	return days < 30 ? `${days} day${days === 1 ? '' : 's'} ago` : at.toISOString().slice(0, 10);
}

