/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Temco Controls. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// *Temco Learn* — what a reader actually receives.
//
// Everything before this surface is about producing documentation; this is the only one about *reading* it. Three
// questions, in the order a person asks them:
//
//   **Preview**  — serve the built site on loopback, or open the copy that was published.
//   **Outputs**  — the files a build wrote: the site, the offline help, the PDF, the search index.
//   **Coverage** — what has no output, was never reviewed, or whose code moved.
//
// It reads the same catalog rows as Build Center and Publish & Releases rather than keeping a second record: a page
// that says "3 outputs" is wrong the moment a build writes a fourth, and a second copy of the truth is how that happens.

import * as path from 'path';
import * as vscode from 'vscode';
import { Catalog, ReleaseRow, selection } from './store';
import { commandScript, escapeHtml as esc, icon, page, pageColumn, runCommand } from './ui';

export const LEARN_VIEW_ID = 'temcoLearn.panel';
export const LEARN_PAGE_TYPE = 'temcoLearn.page';

/** One file a build left. */
interface Artifact {
	kind: string;
	path: string;
	builtAt: string;
}

interface LearnFacts {
	project?: string;
	pages: number;
	releases: ReleaseRow[];
	artifacts: Artifact[];
}

/** The words for an artifact's kind, in the order a build produces them. */
function kindLabel(kind: string): string {
	return kind === 'chm' ? 'Offline help (CHM)' : kind === 'pdf' ? 'PDF' : kind === 'site' ? 'Website' : kind === 'search' ? 'Search index' : kind;
}

function kindMark(kind: string): string {
	return kind === 'chm' ? 'package' : kind === 'pdf' ? 'document' : kind === 'search' ? 'search' : 'globe';
}

/** When something happened, in the words a person uses. */
function since(iso: string | undefined): string {
	if (iso === undefined) {
		return 'never';
	}
	const then = Date.parse(iso);
	if (Number.isNaN(then)) {
		return iso;
	}
	const minutes = Math.floor((Date.now() - then) / 60_000);
	if (minutes < 1) {
		return 'just now';
	}
	if (minutes < 60) {
		return `${minutes} min ago`;
	}
	const hours = Math.floor(minutes / 60);
	if (hours < 24) {
		return `${hours} h ago`;
	}
	const days = Math.floor(hours / 24);
	return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** What the catalog knows: the project on screen, its releases, the files they left, and how many pages there are. */
async function facts(context: vscode.ExtensionContext): Promise<LearnFacts> {
	let catalog: Catalog | undefined;
	try {
		catalog = await Catalog.open(context);
		const documents = catalog.documents();
		const slug = selection.project() ?? (documents.length === 1 ? documents[0].slug : undefined);
		if (slug === undefined) {
			return { pages: 0, releases: [], artifacts: [] };
		}
		return {
			project: documents.find((document) => document.slug === slug)?.name ?? slug,
			pages: catalog.documentPages(slug).length,
			releases: catalog.releases(slug),
			artifacts: catalog.documentArtifacts(slug)
		};
	} catch {
		// No catalog, nothing learned: the page says so rather than showing a sample.
		return { pages: 0, releases: [], artifacts: [] };
	} finally {
		catalog?.close();
	}
}

/** The rows of the panel: three ways into the same page, each with the fact it is about. */
function panelRows(state: LearnFacts): { label: string; note: string; mark: string; command: string }[] {
	const newest = state.releases[0];
	return [
		{ label: 'Preview', note: newest === undefined ? 'nothing published yet' : `published ${since(newest.publishedAt)} · ${newest.destination}`, mark: 'globe', command: 'temcoDocs.releases' },
		{ label: 'Outputs', note: `${state.artifacts.length} ${state.artifacts.length === 1 ? 'file' : 'files'} a build wrote`, mark: 'package', command: 'temcoLearn.page' },
		{ label: 'Coverage', note: `${state.pages} ${state.pages === 1 ? 'page' : 'pages'} in this project`, mark: 'check', command: 'temcoLearn.page' }
	];
}

/** The panel above the container: what was built, and the one way in. */
export class LearnPanel implements vscode.WebviewViewProvider {
	private view: vscode.WebviewView | undefined;

	constructor(private readonly context: vscode.ExtensionContext) { }

	resolveWebviewView(view: vscode.WebviewView): void {
		this.view = view;
		view.webview.options = { enableScripts: true };
		view.webview.onDidReceiveMessage(runCommand);
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
		const state = await facts(this.context);
		view.webview.html = strip(state, commandScript);
	}
}

function strip(state: LearnFacts, script: string): string {
	const newest = state.releases[0];
	const body = `${panelHead(state)}
<div class="learn-strip">${panelRows(state).map((row) => `<button type="button" class="learn-row" data-command="${row.command}" title="${esc(row.note)}">${icon(row.mark)}<span class="learn-row__main"><span class="learn-row__label">${esc(row.label)}</span><span class="learn-row__note">${esc(row.note)}</span></span></button>`).join('')}</div>
<button type="button" class="btn btn--sm btn--ghost learn-open" data-command="temcoLearn.page"><span>Open the page</span></button>
${newest === undefined ? '<p class="learn-note">Nothing has been published. Build the site, then publish it from Publish &amp; Releases.</p>' : ''}`;
	return page(body, { title: 'Temco Learn', script, extraCss: STRIP_CSS });
}

function panelHead(state: LearnFacts): string {
	return `<div class="learn-head"><span class="learn-head__title">Temco Learn</span><span class="learn-head__meta">${state.project === undefined ? 'no project' : esc(state.project)} · ${state.artifacts.length} ${state.artifacts.length === 1 ? 'output' : 'outputs'}</span></div>`;
}

const STRIP_CSS = `
.learn-head { display: flex; align-items: baseline; gap: 8px; margin: 2px 0 8px; }
.learn-head__title { font-weight: 600; }
.learn-head__meta { color: var(--fg-muted); font-size: 11px; }
.learn-strip { display: flex; flex-direction: column; gap: 1px; }
.learn-row { display: flex; align-items: flex-start; gap: 8px; text-align: left; border: 0; background: none;
  color: inherit; font: inherit; padding: 6px; border-radius: var(--radius-sm); cursor: pointer; }
.learn-row:hover { background: var(--bg-hover); }
.learn-row .icon { width: 16px; height: 16px; color: var(--fg-muted); flex: none; margin-top: 1px; }
.learn-row__main { display: flex; flex-direction: column; min-width: 0; }
.learn-row__label { font-size: 12px; }
.learn-row__note { color: var(--fg-subtle); font-size: 11px; overflow: hidden; text-overflow: ellipsis; }
.learn-open { margin-top: 8px; }
.learn-note { color: var(--fg-subtle); font-size: 11px; margin: 8px 0 0; line-height: 1.5; }
`;

/** The page: hero, then Preview, Outputs and Coverage side by side where there is room. */
export function learnPageBody(state: LearnFacts): string {
	const newest = state.releases[0];
	const outputs = state.artifacts.map((artifact) => `<div class="az-entry" data-command="temcoDocs.openArtifact" data-args="${esc(JSON.stringify([artifact.path]))}">
<span class="az-entry__icon">${icon(kindMark(artifact.kind))}</span>
<div class="az-entry__main"><span class="az-entry__title">${esc(path.basename(artifact.path))}<span class="tag">${esc(kindLabel(artifact.kind))}</span></span>
<span class="az-entry__meta">built ${esc(since(artifact.builtAt))} · ${esc(artifact.path)}</span></div>
<span class="az-entry__go">Open ${icon('chevron-right', 'icon--sm')}</span></div>`).join('');

	const summary = `${state.pages} ${state.pages === 1 ? 'page' : 'pages'} · ${state.artifacts.length} ${state.artifacts.length === 1 ? 'output' : 'outputs'} · ${state.releases.length} ${state.releases.length === 1 ? 'version published' : 'versions published'}`;

	return `<div class="az-wash"><header class="az-lead">
<h1 class="az-title">Temco Learn</h1>
<p class="az-intro az-intro--wide">What a reader actually receives. Preview serves the built site on this machine, Outputs lists every file a build wrote, and Coverage says what has none of them.</p>
<div class="az-row">
<button type="button" class="az-btn az-btn--primary" data-command="temcoDocs.servePublished">${icon('server')}<span>Serve the site</span></button>
<button type="button" class="az-btn" data-command="temcoDocs.openPublished">${icon('globe')}<span>Open the published copy</span></button>
<button type="button" class="az-btn" data-command="temcoDocs.buildSite">${icon('play')}<span>Build the site</span></button>
<button type="button" class="az-btn" data-command="temcoDocs.releases">${icon('upload')}<span>Publish &amp; Releases</span></button>
</div>
</header></div>
<p class="az-note">${esc(state.project === undefined ? 'No project is selected.' : state.project)} · ${esc(summary)}</p>
<div class="learn-grid">
<div>
<div class="az-section"><div class="az-section__text"><h2 class="az-section__title">Preview</h2><p class="az-section__desc">The site as it would be served: the same pages, the same assets, on a port this machine only.</p></div></div>
<div class="az-entries">
<div class="az-entry"><span class="az-entry__icon">${icon('server')}</span><div class="az-entry__main"><span class="az-entry__title">127.0.0.1 · loopback</span><span class="az-entry__meta">${newest === undefined ? 'nothing published yet — build, then publish' : `newest version ${esc(newest.version)}, published ${esc(since(newest.publishedAt))}`}</span></div>
<button type="button" class="az-btn az-btn--sm" data-command="temcoDocs.servePublished">Serve</button></div>
<div class="az-entry"><span class="az-entry__icon">${icon('globe')}</span><div class="az-entry__main"><span class="az-entry__title">The published copy</span><span class="az-entry__meta">${newest === undefined ? 'no destination recorded' : esc(newest.destination)}</span></div>
<button type="button" class="az-btn az-btn--sm" data-command="temcoDocs.openPublished">Open</button></div>
</div>
</div>
<div>
<div class="az-section"><div class="az-section__text"><h2 class="az-section__title">Outputs</h2><p class="az-section__desc">Every file a build wrote. A file that is here is a file a reader can be given.</p></div></div>
${outputs.length === 0 ? '<p class="az-note">No build has written a file yet. Build the site or the offline help from Build Center.</p>' : `<div class="az-entries">${outputs}</div>`}
</div>
</div>
<div class="az-section"><div class="az-section__text"><h2 class="az-section__title">Coverage</h2><p class="az-section__desc">The two lists that say what to do next, both read from the registry rather than counted by hand.</p></div><div class="az-section__actions"><button type="button" class="az-btn az-btn--sm" data-command="temcoAi.stale">Pages whose code moved</button><button type="button" class="az-btn az-btn--sm" data-command="temcoDocs.registryPage">The registry</button></div></div>
<div class="az-entries">
<div class="az-entry" data-command="temcoDocs.staleScreenshots"><span class="az-entry__icon">${icon('warning')}</span><div class="az-entry__main"><span class="az-entry__title">Screenshots that may be out of date</span><span class="az-entry__meta">the pages that cite code which has since changed</span></div><span class="az-entry__go">Open ${icon('chevron-right', 'icon--sm')}</span></div>
<div class="az-entry" data-command="temcoDocs.review"><span class="az-entry__icon">${icon('sparkle')}</span><div class="az-entry__main"><span class="az-entry__title">Drafts waiting for a person</span><span class="az-entry__meta">a page is not changed by the model; it is changed by accepting a draft</span></div><span class="az-entry__go">Open ${icon('chevron-right', 'icon--sm')}</span></div>
</div>`;
}

/** The page's own layout: two columns for Preview and Outputs, one full width for Coverage. */
const PAGE_CSS = `
.learn-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start;
  gap: var(--sp-6) var(--sp-8); margin-top: var(--sp-2); }
.learn-grid > * { min-width: 0; }
.learn-grid .az-section { margin-top: 0; }
@media (max-width: 1100px) { .learn-grid { grid-template-columns: minmax(0, 1fr); } }
`;

/** Opens the Learn page as a tab, reusing the one already open. */
export class LearnPage {
	private panel: vscode.WebviewPanel | undefined;

	constructor(private readonly context: vscode.ExtensionContext) { }

	async open(): Promise<void> {
		if (this.panel !== undefined) {
			this.panel.reveal(pageColumn());
		} else {
			this.panel = vscode.window.createWebviewPanel(LEARN_PAGE_TYPE, 'Temco Learn', pageColumn(), {
				enableScripts: true,
				localResourceRoots: []
			});
			this.panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'help.svg');
			this.panel.webview.onDidReceiveMessage(runCommand);
			this.panel.onDidDispose(() => {
				this.panel = undefined;
			});
		}
		this.panel.webview.html = page(learnPageBody(await facts(this.context)), {
			title: 'Temco Learn',
			script: commandScript,
			extraCss: PAGE_CSS
		});
	}

	dispose(): void {
		this.panel?.dispose();
	}
}
