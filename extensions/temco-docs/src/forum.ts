/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Temco Controls. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// *Forum* — the conversations about this documentation set, in a panel, and one thread opened for triage beside it.
//
// Two surfaces, because they answer two different questions:
//
//   **the panel**   what is being said. It is contributed as a view of its own, so it can sit in the secondary side
//                   bar next to the page a reader is reading instead of taking a tab away from it.
//   **Triage**      one thread, opened as its own tab *beside* the thread rather than on top of it: a triager keeps
//                   the conversation in view while deciding what the page should say.
//
// The threads are the issues carrying the `docs-feedback` label in the repository the project cites — the shape
// `docs/temco-learn/design/09-feedback-subscriptions-notifications.md` settled on for a feedback row. They are read
// through the repositories module and never written: deciding is a person's act, and the decision is recorded on
// GitHub. What this surface adds is the thing a bare issue list cannot say — which page the thread is about, how stale
// that page is, and the two acts that follow from knowing it.

import * as vscode from 'vscode';
import { DocsRoot, PageEntry, collectPages } from './registry';
import { Thread, threads as readThreads } from './repositories';
import { Catalog, selection } from './store';
import { commandScript, escapeHtml as esc, hero, icon, page, runCommand, section } from './ui';

export const FORUM_VIEW_ID = 'temcoDocs.forum';
const TRIAGE_TYPE = 'temcoDocs.triage';
/** The label a feedback row arrives with, and the only thing the forum asks GitHub for. */
const LABEL = 'docs-feedback';
/** A thread that has waited longer than this is called out rather than left in the list. */
const AGING_DAYS = 14;

/** The two glyphs the panel draws. Inline, on the same 24-unit grid as the sprite, because the panel loads nothing. */
const glyph = (paths: string): string =>
	`<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const USERS = glyph('<circle cx="9.5" cy="8" r="3.2"/><path d="M3.5 19c0-3 2.7-4.8 6-4.8s6 1.8 6 4.8"/><path d="M16.5 5.6a3.2 3.2 0 0 1 0 5"/><path d="M17.5 14.6c2 .6 3.2 2.1 3.2 4.4"/>');
const REFRESH = glyph('<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v4.8h-4.8"/>');

/** What the panel knows when it paints: the threads, and the reason there might be none. */
interface ForumState {
	project?: string;
	/** `owner/repo`, when there is one to name. */
	repository?: string;
	/** The source's own name, which is what a person sees elsewhere in the window. */
	source?: string;
	threads: Thread[];
	note?: string;
}

/** Reads the threads of the repository this project cites. */
async function read(context: vscode.ExtensionContext): Promise<ForumState> {
	const project = selection.project();
	if (project === undefined) {
		return { threads: [], note: 'No project is open. Open one in Documentation and this list reads the repository it cites.' };
	}
	let catalog: Catalog | undefined;
	try {
		catalog = await Catalog.open(context);
		for (const slug of catalog.documentSourceSlugs(project)) {
			const source = catalog.source(slug);
			// A folder has no issues, and a source without an address has no repository to ask.
			if (source === undefined || source.kind !== 'git' || source.remoteUrl === undefined) {
				continue;
			}
			const answer = await readThreads(
				{ name: source.name, remoteUrl: source.remoteUrl, branch: source.branch },
				LABEL
			);
			return { project, repository: answer.repository, source: source.name, threads: answer.threads, note: answer.note };
		}
		return {
			project,
			threads: [],
			note: 'This project cites no GitHub repository, so there is no forum to read. Add one on the repositories page.'
		};
	} catch (error) {
		return { project, threads: [], note: `The catalog could not be read (${messageOf(error)})` };
	} finally {
		catalog?.close();
	}
}

/**
 * The thread panel: a list of what is being said, each row a way into its triage tab.
 *
 * It is a webview rather than a tree because a thread is more than a label — a title, a person, how long it has
 * waited and whether it has been answered — and a tree row carries one string.
 */
export class ForumPanel implements vscode.WebviewViewProvider {
	private view: vscode.WebviewView | undefined;
	/** The last list read, so a triage tab opened from a row does not have to ask GitHub again. */
	private state: ForumState = { threads: [] };

	constructor(private readonly context: vscode.ExtensionContext, private readonly triage: TriagePage) { }

	resolveWebviewView(view: vscode.WebviewView): void {
		this.view = view;
		view.webview.options = { enableScripts: true };
		view.webview.onDidReceiveMessage((message: { type?: unknown; number?: unknown }) => {
			void this.receive(message);
		});
		view.onDidDispose(() => {
			this.view = undefined;
		});
		this.refresh();
	}

	/** Reads the threads again and repaints. The only way the panel's numbers change. */
	refresh(): void {
		void (async () => {
			this.state = await read(this.context);
			const view = this.view;
			if (view !== undefined) {
				view.webview.html = forumHtml(this.state, nonce());
			}
		})();
	}

	private async receive(message: { type?: unknown; number?: unknown }): Promise<void> {
		if (message.type === 'refresh') {
			this.refresh();
			return;
		}
		if (message.type === 'triage' && typeof message.number === 'number') {
			const thread = this.state.threads.find(candidate => candidate.number === message.number);
			if (thread !== undefined) {
				await this.triage.open(thread, this.state.repository);
			}
		}
	}
}

/** The Triage tabs: one per thread, each beside whatever the person was reading when they opened it. */
export class TriagePage {
	private readonly panels = new Map<number, vscode.WebviewPanel>();

	constructor(private readonly roots: () => readonly DocsRoot[]) { }

	async open(thread: Thread, repository: string | undefined): Promise<void> {
		const existing = this.panels.get(thread.number);
		if (existing !== undefined) {
			existing.reveal(undefined, true);
			return;
		}
		const panel = vscode.window.createWebviewPanel(
			TRIAGE_TYPE,
			`Triage · #${thread.number}`,
			vscode.ViewColumn.Beside,
			{ enableScripts: true, localResourceRoots: [] }
		);
		panel.iconPath = new vscode.ThemeIcon('comment-discussion');
		panel.onDidDispose(() => this.panels.delete(thread.number));
		// Every button on the tab names a command; the tab never decides what one means.
		panel.webview.onDidReceiveMessage(runCommand);
		panel.webview.html = triageHtml(thread, repository, this.roots());
		this.panels.set(thread.number, panel);
	}

	dispose(): void {
		for (const panel of this.panels.values()) {
			panel.dispose();
		}
		this.panels.clear();
	}
}

/**
 * Opens a thread where it was written.
 *
 * Only an http(s) address is opened. A thread's own URL is the only thing this window hands to the browser, and a
 * command can be called with anything — so the scheme is checked rather than trusted.
 */
export async function openThread(url: unknown): Promise<void> {
	if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
		void vscode.window.showWarningMessage('Temco Docs: that is not a thread address this window will open.');
		return;
	}
	await vscode.env.openExternal(vscode.Uri.parse(url));
}

/** The page a thread is about, if it names one. */
function pageFor(thread: Thread, roots: readonly DocsRoot[]): PageEntry | undefined {
	const text = `${thread.title}\n${thread.body}`;
	const pages = roots.flatMap(root => collectPages(root)).filter(candidate => candidate.exists);
	// The longest id first: `data-points-api` must win over `data`, or every thread would land on the shortest page.
	for (const id of pages.map(candidate => candidate.id).sort((a, b) => b.length - a.length)) {
		if (id.length < 4) {
			continue;
		}
		if (new RegExp(`(^|[^a-z0-9-])${escapeRegExp(id)}([^a-z0-9-]|$)`, 'i').test(text)) {
			return pages.find(candidate => candidate.id === id);
		}
	}
	const lower = text.toLowerCase();
	return pages.find(candidate => candidate.title.length >= 8 && lower.includes(candidate.title.toLowerCase()));
}

/** The triage tab, as HTML. Public because the point of it is what it says, and that is worth checking. */
export function triageHtml(thread: Thread, repository: string | undefined, roots: readonly DocsRoot[]): string {
	const named = pageFor(thread, roots);
	const stale = named?.provenance?.stale === true;
	const where = repository === undefined ? 'the forum' : repository;
	const body = thread.body.trim().length === 0
		? '<p class="cell-muted">The thread has no text — only the title.</p>'
		: `<div class="card card--plain"><p style="white-space:pre-wrap;margin:0">${esc(thread.body.trim())}</p></div>`;

	const pageSection = named === undefined
		? `<div class="mt-24">${section({ title: 'The page it names' })}</div>
<div class="card card--plain"><p class="card__desc">No page in this documentation set is named by the thread, so a triager has to say which one it is about before it can be settled. The page's id, or its title, is enough — either in the title or in the thread.</p></div>`
		: `<div class="mt-24">${section({ title: 'The page it names', desc: stale ? 'The code behind this page moved after its last review: a fix here is likely to be about that.' : undefined })}</div>
${namedCard(named, stale)}`;

	return page(
		`${hero({
			eyebrow: where,
			title: `#${thread.number} · ${thread.title}`,
			mark: 'users',
			desc: `${esc(thread.author)} opened this ${thread.days === 0 ? 'today' : `${thread.days} ${thread.days === 1 ? 'day' : 'days'} ago`} · ${thread.comments} ${thread.comments === 1 ? 'reply' : 'replies'} · ${esc(thread.state)}`,
			actions: [
				...(thread.url.length === 0 ? [] : [{ label: 'Open on GitHub', command: 'temcoDocs.openThread', args: thread.url, mark: 'link', kind: 'primary' as const }]),
				{ label: 'Go to the forum', command: 'temcoDocs.forum', mark: 'users' }
			]
		})}
<div class="mt-24">${section({ title: 'What was said' })}</div>
${body}
${pageSection}
<div class="mt-24">${section({ title: 'What a triage decides' })}</div>
<div class="card card--plain"><p class="card__desc">A decision is recorded on the thread, because the person who wrote it is owed an answer where they wrote it. The two acts that follow from a page are here so the decision can be made with the page in view — open it read-only, or draft the change; no draft is applied to a file without Review Center and a person.</p>
<div class="az-row" style="margin-top:10px">${named === undefined ? '' : `<button type="button" class="az-btn" data-command="temcoDocs.openFile" data-args="${esc(JSON.stringify(named.uri.fsPath))}">${icon('document')}<span>Open the page</span></button>`}<button type="button" class="az-btn" data-command="temcoAi.openPanel"><span>Draft the fix</span></button>${thread.url.length === 0 ? '' : `<button type="button" class="az-btn" data-command="temcoDocs.openThread" data-args="${esc(JSON.stringify(thread.url))}"><span>Decide on GitHub</span></button>`}</div></div>`,
		{ title: `Triage · #${thread.number}`, script: commandScript }
	);
}

function namedCard(entry: PageEntry, stale: boolean): string {
	const review = entry.reviewed === null ? 'never reviewed' : `last reviewed ${entry.reviewed}`;
	return `<div class="card card--plain"><div class="card__head"><span class="card__icon">${icon('document')}</span><div class="card__title">${esc(entry.title)}</div><div class="card__actions"><span class="badge${stale ? ' badge--warn' : ''}">${stale ? 'code moved' : 'current'}</span></div></div>
<p class="card__desc">${esc(entry.id)} · ${esc(entry.area)}${entry.chapter === '' ? '' : ` › ${esc(entry.chapter)}`} · ${esc(review)}${entry.owner.trim().length === 0 ? '' : ` · ${esc(entry.owner)}`}</p></div>`;
}

/** The panel, as HTML: a list of threads, and the sentence that explains an empty one. */
export function forumHtml(state: ForumState, nonceValue: string): string {
	const rows = state.threads.map(thread => {
		const aging = thread.state === 'open' && thread.days >= AGING_DAYS;
		return `<li><button type="button" class="thread" data-number="${thread.number}">
<span class="thread__title">${esc(thread.title)}</span>
<span class="thread__meta"><span class="thread__number">#${thread.number}</span> ${esc(thread.author)} · ${thread.days === 0 ? 'today' : `${thread.days}d`}${thread.comments === 0 ? '' : ` · ${thread.comments} ${thread.comments === 1 ? 'reply' : 'replies'}`}${aging ? ' · <strong>waiting</strong>' : ''}${thread.state === 'open' ? '' : ' · closed'}</span>
</button></li>`;
	}).join('');

	const heading = `<div class="head"><div class="head__title">${USERS}<span>Forum</span></div><button type="button" class="icon" data-type="refresh" title="Read the threads again" aria-label="Read the threads again">${REFRESH}</button></div>
<div class="head__meta">${state.repository === undefined ? esc(state.source ?? 'no repository') : esc(state.repository)}${state.threads.length === 0 ? '' : ` · ${state.threads.length} ${state.threads.length === 1 ? 'thread' : 'threads'}`}</div>`;

	const list = state.threads.length === 0
		? `<p class="note">${esc(state.note ?? 'Nothing carries the feedback label yet.')}</p>`
		: `<ul class="threads">${rows}</ul>${state.note === undefined ? '' : `<p class="note">${esc(state.note)}</p>`}`;

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonceValue}';">
<style>
	body { margin: 0; padding: 6px 8px 10px; font: 12px/1.35 var(--vscode-font-family); color: var(--vscode-foreground); }
	.head { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
	.head__title { display: flex; align-items: center; gap: 5px; font-weight: 600; }
	.head__meta { margin: 2px 0 6px 0; color: var(--vscode-descriptionForeground); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.icon { background: none; border: 0; padding: 2px; color: inherit; cursor: pointer; opacity: .75; }
	.icon:hover { opacity: 1; }
	.threads { list-style: none; margin: 0; padding: 0; }
	.threads li + li { border-top: 1px solid var(--vscode-panel-border); }
	.thread { display: flex; flex-direction: column; gap: 2px; width: 100%; text-align: left; background: none; border: 0; padding: 6px 4px; color: inherit; font: inherit; cursor: pointer; }
	.thread:hover { background: var(--vscode-list-hoverBackground); }
	.thread:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }
	.thread__title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.thread__meta { color: var(--vscode-descriptionForeground); font-size: 11px; }
	.thread__number { font-variant-numeric: tabular-nums; }
	.note { margin: 8px 2px 0; color: var(--vscode-descriptionForeground); }
	.glyph { width: 14px; height: 14px; flex: none; }
</style>
</head>
<body>
${heading}
${list}
<script nonce="${nonceValue}">
(function () {
	const api = acquireVsCodeApi();
	document.addEventListener('click', (event) => {
		const target = event.target.closest('[data-number], [data-type]');
		if (target === null) { return; }
		if (target.dataset.number !== undefined) {
			api.postMessage({ type: 'triage', number: Number(target.dataset.number) });
			return;
		}
		api.postMessage({ type: 'refresh' });
	});
})();
</script>
</body>
</html>`;
}

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function nonce(): string {
	const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	return Array.from({ length: 32 }, () => alphabet.charAt(Math.floor(Math.random() * alphabet.length))).join('');
}
