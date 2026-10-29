/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Temco Controls. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// *Forum* — the community forum, as the platform reads it: categories, the topics in each, and the conversation inside
// one, with what the documentation should do about it.
//
// The forum is `forums.temcocontrols.com`, and it is read the way a reader uses it:
//
//   **the panel**   the categories, in the site's own order, with how many topics each holds.
//   **the page**    one category's topics, in the site's own table: title, who is in it, replies, views, last activity.
//   **the topic**   one thread as a tab — the discussion history, the page it is about, and a suggestion.
//
// Everything is read from the catalog (`forum_categories`, `forum_topics`, `forum_posts`, `forum_suggestions`), which a
// sync fills from the site; no surface talks to the network and no view parses JSON. Nothing is ever posted, replied to
// or liked from here: the community site owns the conversation, and this is the reading side of it.

import * as vscode from 'vscode';
import { categoryUrl, forumBase, readCategories, readCategoryTopics, readTopic, topicUrl } from './forumSource';
import { DocsRoot, PageEntry, collectPages } from './registry';
import { Catalog, ForumCategoryRow, ForumPostRow, ForumTopicRow, selection } from './store';
import { commandScript, escapeHtml as esc, hero, icon, numbers, page, pageColumn, runCommand, section } from './ui';

export const FORUM_VIEW_ID = 'temcoDocs.forum';
export const FORUM_PAGE_TYPE = 'temcoDocs.forumPage';
const TOPIC_TYPE = 'temcoDocs.forumTopic';

/** A topic that has sat unanswered this long is called out rather than left in the table. */
const AGING_DAYS = 30;

/** The three glyphs the panel draws. Inline, on the same 24-unit grid as the sprite, because the panel loads nothing. */
const glyph = (paths: string): string =>
	`<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const USERS = glyph('<circle cx="9.5" cy="8" r="3.2"/><path d="M3.5 19c0-3 2.7-4.8 6-4.8s6 1.8 6 4.8"/><path d="M16.5 5.6a3.2 3.2 0 0 1 0 5"/><path d="M17.5 14.6c2 .6 3.2 2.1 3.2 4.4"/>');
const REFRESH = glyph('<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v4.8h-4.8"/>');
const LIST = glyph('<path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><circle cx="4.5" cy="6" r="1.2"/><circle cx="4.5" cy="12" r="1.2"/><circle cx="4.5" cy="18" r="1.2"/>');

/** What the panel paints: the categories, and when they were last read. */
interface ForumFacts {
	categories: ForumCategoryRow[];
	syncedAt?: string;
}

/** Reads the categories out of the catalog — the only thing the panel needs. */
async function facts(context: vscode.ExtensionContext): Promise<ForumFacts> {
	let catalog: Catalog | undefined;
	try {
		catalog = await Catalog.open(context);
		return { categories: catalog.forumCategories(), syncedAt: catalog.forumSyncedAt() };
	} catch {
		// No catalog, no forum: an empty list says so without an error nobody can act on.
		return { categories: [] };
	} finally {
		catalog?.close();
	}
}

/**
 * Reads the forum's categories, and the topics of one category when a category is named.
 *
 * Returns the sentence to show when something went wrong, or nothing when everything was read.
 */
export async function syncForum(
	context: vscode.ExtensionContext,
	category?: { id: number; slug: string }
): Promise<string | undefined> {
	let catalog: Catalog | undefined;
	try {
		catalog = await Catalog.open(context);
		const categories = await readCategories();
		if (!categories.ok) {
			return categories.note;
		}
		catalog.saveForumCategories(categories.body);
		if (category === undefined) {
			return undefined;
		}
		const topics = await readCategoryTopics(category);
		if (!topics.ok) {
			return topics.note;
		}
		catalog.saveForumTopics(topics.body);
		return undefined;
	} catch (error) {
		return messageOf(error);
	} finally {
		catalog?.close();
	}
}

/** Reads one topic's posts, so its tab has the conversation and not only the title. */
async function syncTopic(context: vscode.ExtensionContext, topic: { id: number; slug: string }): Promise<string | undefined> {
	let catalog: Catalog | undefined;
	try {
		catalog = await Catalog.open(context);
		const answer = await readTopic(topic);
		if (!answer.ok) {
			return answer.note;
		}
		// A topic page carries the posts and the counters, but not the participants or the excerpt the list read
		// recorded: those are kept, so opening a topic does not empty the table it was opened from.
		const listed = catalog.forumTopics().find((candidate) => candidate.id === answer.body.topic.id);
		catalog.saveForumTopics([
			{ ...answer.body.topic, posters: (answer.body.topic.posters ?? []).length > 0 ? answer.body.topic.posters : listed?.posters ?? [], excerpt: answer.body.topic.excerpt ?? listed?.excerpt }
		]);
		catalog.saveForumPosts(answer.body.topic.id, answer.body.posts);
		return undefined;
	} catch (error) {
		return messageOf(error);
	} finally {
		catalog?.close();
	}
}

/**
 * The panel: the forum's categories, as the site's own left column has them.
 *
 * A row opens that category's topics in the page. *All topics* comes first because that is the question a reader
 * arrives with, and the category names are the forum's own, not a translation of them.
 */
export class ForumPanel implements vscode.WebviewViewProvider {
	private view: vscode.WebviewView | undefined;
	private state: ForumFacts = { categories: [] };
	private reads = 0;

	constructor(private readonly context: vscode.ExtensionContext, private readonly list: TopicListPage) { }

	resolveWebviewView(view: vscode.WebviewView): void {
		this.view = view;
		view.webview.options = { enableScripts: true };
		view.webview.onDidReceiveMessage((message: { type?: unknown; id?: unknown; command?: unknown; args?: unknown }) => {
			void this.receive(message);
		});
		view.onDidDispose(() => {
			this.view = undefined;
		});
		this.refresh();
	}

	refresh(): void {
		// A refresh can start while another is still reading: only the newest answer may paint.
		const run = ++this.reads;
		void (async () => {
			const next = await facts(this.context);
			if (run !== this.reads) {
				return;
			}
			this.state = next;
			this.paint();
		})();
	}

	private paint(): void {
		const view = this.view;
		if (view !== undefined) {
			view.webview.html = forumPanelHtml(this.state, nonce());
		}
	}

	private async receive(message: { type?: unknown; id?: unknown; command?: unknown; args?: unknown }): Promise<void> {
		if (message.type === 'command') {
			runCommand({ type: 'command', command: typeof message.command === 'string' ? message.command : undefined, args: message.args });
			return;
		}
		if (message.type === 'refresh') {
			this.refresh();
			return;
		}
		if (message.type === 'category') {
			const id = typeof message.id === 'number' ? message.id : undefined;
			// The page is where topics are listed, so a category row opens it — the panel stays the navigation.
			this.list.syncCategories(this.state.categories);
			await this.list.open(id);
		}
	}
}

/** One topic, opened for reading: its posts, the page it is about, and a suggestion. */
export class TopicPage {
	private readonly panels = new Map<number, vscode.WebviewPanel>();

	constructor(private readonly context: vscode.ExtensionContext, private readonly roots: () => readonly DocsRoot[]) { }

	async open(topic: { id: number; slug: string; title: string }, categoryName?: string): Promise<void> {
		const existing = this.panels.get(topic.id);
		if (existing !== undefined) {
			existing.reveal(undefined, true);
			await this.render(topic, categoryName);
			return;
		}
		const panel = vscode.window.createWebviewPanel(TOPIC_TYPE, topic.title, vscode.ViewColumn.Beside, {
			enableScripts: true,
			localResourceRoots: []
		});
		panel.iconPath = new vscode.ThemeIcon('comment-discussion');
		panel.onDidDispose(() => this.panels.delete(topic.id));
		panel.webview.onDidReceiveMessage(runCommand);
		this.panels.set(topic.id, panel);
		await this.render(topic, categoryName);
	}

	/** Reads the conversation again and repaints — after a sync, or when a suggestion was just written. */
	async render(topic: { id: number; slug: string; title: string }, categoryName?: string): Promise<void> {
		const panel = this.panels.get(topic.id);
		if (panel === undefined) {
			return;
		}
		let catalog: Catalog | undefined;
		try {
			catalog = await Catalog.open(this.context);
			// Nothing cached for this topic yet: read it once, so the tab always shows the conversation rather than a
			// request for one.
			if (catalog.forumPosts(topic.id).length === 0) {
				catalog.close();
				catalog = undefined;
				await syncTopic(this.context, topic);
				catalog = await Catalog.open(this.context);
			}
			const row = catalog.forumTopics().find((candidate) => candidate.id === topic.id);
			const posts = catalog.forumPosts(topic.id);
			const named = row === undefined ? undefined : pageFor(row, this.roots());
			let suggestion = catalog.forumSuggestion(topic.id);
			// The platform's own guess is recorded the first time a topic is read, so the tab never shows "nothing" when
			// the registry already knows which page the topic is about. An answer from the model replaces it later.
			if (suggestion === undefined && named !== undefined && row !== undefined) {
				const text = `The topic names ${named.title}. A fix here is a draft of that page — ${named.reviewed === null ? 'it has never been reviewed' : `last reviewed ${named.reviewed}`}${named.provenance?.stale === true ? ', and its code has moved since' : ''}.`;
				catalog.saveForumSuggestion({ topicId: row.id, pageId: named.id, pageTitle: named.title, text, source: 'match' });
				suggestion = catalog.forumSuggestion(topic.id);
			}
			if (this.panels.get(topic.id) !== panel) {
				return;
			}
			const title = row?.title ?? topic.title;
			panel.title = title;
			panel.webview.html = page(
				topicBody({ topic: row ?? virtualTopic(topic), posts, named, suggestion, categoryName }),
				{ title, script: commandScript }
			);
		} finally {
			catalog?.close();
		}
	}

	dispose(): void {
		for (const panel of this.panels.values()) {
			panel.dispose();
		}
		this.panels.clear();
	}
}

/**
 * The page: one category's topics, in the forum's own table.
 *
 * Title, who is in it, replies, views, last activity — the five columns the site shows, because that is the shape a
 * person already knows how to read. A row opens the topic beside the page; the header reads the category again.
 */
export class TopicListPage {
	private panel: vscode.WebviewPanel | undefined;
	private categoryId: number | undefined;
	private categories: ForumCategoryRow[] = [];

	constructor(private readonly context: vscode.ExtensionContext) { }

	/** The categories the page names in its own heading — the panel has them already, so it hands them over. */
	syncCategories(categories: readonly ForumCategoryRow[]): void {
		this.categories = [...categories];
		if (this.panel !== undefined) {
			void this.render();
		}
	}

	async open(categoryId?: number): Promise<void> {
		this.categoryId = categoryId;
		if (this.panel !== undefined) {
			this.panel.reveal(pageColumn());
			await this.render();
			return;
		}
		this.panel = vscode.window.createWebviewPanel(FORUM_PAGE_TYPE, 'Forum — Topics', pageColumn(), {
			enableScripts: true,
			localResourceRoots: []
		});
		this.panel.iconPath = new vscode.ThemeIcon('comment-discussion');
		this.panel.onDidDispose(() => {
			this.panel = undefined;
		});
		this.panel.webview.onDidReceiveMessage(runCommand);
		await this.render();
	}

	/** Repaint after a sync, when the page is the surface that asked for it. */
	async refresh(): Promise<void> {
		await this.render();
	}

	private async render(): Promise<void> {
		const panel = this.panel;
		if (panel === undefined) {
			return;
		}
		let catalog: Catalog | undefined;
		try {
			catalog = await Catalog.open(this.context);
			if (this.categories.length === 0) {
				this.categories = catalog.forumCategories();
			}
			const topics = catalog.forumTopics(this.categoryId);
			const syncedAt = catalog.forumSyncedAt();
			const category = this.categories.find((candidate) => candidate.id === this.categoryId);
			if (this.panel !== panel) {
				return;
			}
			const title = category === undefined ? 'Forum — Topics' : `Forum — ${category.name}`;
			panel.title = title;
			panel.webview.html = page(
				topicListBody({ topics, category, categories: this.categories, syncedAt, project: selection.project() }),
				{ title, script: commandScript }
			);
		} finally {
			catalog?.close();
		}
	}

	dispose(): void {
		this.panel?.dispose();
		this.panel = undefined;
	}
}

/**
 * Opens the forum in the browser.
 *
 * Only an `http(s)` address is opened: a command can be called with anything, and a URL from a forum row is data.
 */
export async function openForum(url: unknown): Promise<void> {
	if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
		void vscode.window.showWarningMessage('Temco Docs: that is not a forum address this window will open.');
		return;
	}
	await vscode.env.openExternal(vscode.Uri.parse(url));
}

/**
 * What the documentation should do about a topic, as the model proposes it.
 *
 * The registry match is the platform's own guess — a page whose id or title the topic names. This asks the AI module
 * for the sentence a triager reads: what that page should add, or which page is missing. The answer is stored against
 * the topic, so the tab, and whoever opens it next, sees it without asking again.
 */
export async function suggestForTopic(
	context: vscode.ExtensionContext,
	roots: () => readonly DocsRoot[],
	topics: TopicPage,
	payload: unknown
): Promise<void> {
	const request = (payload ?? {}) as { id?: unknown };
	if (typeof request.id !== 'number') {
		return;
	}
	let catalog: Catalog | undefined;
	try {
		catalog = await Catalog.open(context);
		const topic = catalog.forumTopics().find((candidate) => candidate.id === request.id);
		if (topic === undefined) {
			void vscode.window.showWarningMessage(`Temco Docs: topic ${request.id} is not in the last read of the forum.`);
			return;
		}
		const named = pageFor(topic, roots());
		// What a person would read to decide: the opening posts, and the page the platforms thinks it is about.
		const thread = catalog
			.forumPosts(topic.id)
			.slice(0, 4)
			.map((post) => `${post.username ?? 'someone'}: ${plainText(post.cooked ?? '')}`)
			.join('\n\n');
		const answer = await vscode.commands.executeCommand<string | undefined>('temcoAi.suggestTopic', {
			title: topic.title,
			excerpt: topic.excerpt ?? '',
			thread,
			pageId: named?.id,
			pageTitle: named?.title
		});
		const text = typeof answer === 'string' ? answer.trim() : '';
		if (text.length === 0) {
			void vscode.window.showWarningMessage(
				'Temco Docs: the AI gave no suggestion — check that a model is downloaded and the runtime is running.'
			);
			return;
		}
		catalog.saveForumSuggestion({
			topicId: topic.id,
			pageId: named?.id,
			pageTitle: named?.title,
			text,
			source: 'ai'
		});
		await topics.render({ id: topic.id, slug: topic.slug, title: topic.title });
	} catch (error) {
		void vscode.window.showWarningMessage(`Temco Docs: ${messageOf(error)}.`);
	} finally {
		catalog?.close();
	}
}

/** A topic that was opened before it was read, so the tab has something to draw while the read lands. */function virtualTopic(topic: { id: number; slug: string; title: string }): ForumTopicRow {	return {
		id: topic.id,
		categoryId: 0,
		slug: topic.slug,
		title: topic.title,
		posts: 0,
		replies: 0,
		views: 0,
		pinned: false,
		closed: false,
		posters: []
	};
}

/** The page a topic is about: its id in the title or the excerpt, else its title. */
function pageFor(topic: ForumTopicRow, roots: readonly DocsRoot[]): PageEntry | undefined {
	const text = `${topic.title}\n${topic.excerpt ?? ''}`;
	const pages = roots.flatMap((root) => collectPages(root)).filter((candidate) => candidate.exists);
	// Longest id first, so `data-points-api` wins over `data` rather than every topic landing on the shortest page.
	for (const id of pages.map((candidate) => candidate.id).sort((a, b) => b.length - a.length)) {
		if (id.length < 4) {
			continue;
		}
		if (new RegExp(`(^|[^a-z0-9-])${escapeRegExp(id)}([^a-z0-9-]|$)`, 'i').test(text)) {
			return pages.find((candidate) => candidate.id === id);
		}
	}
	const lower = text.toLowerCase();
	return pages.find((candidate) => candidate.title.length >= 8 && lower.includes(candidate.title.toLowerCase()));
}

/** A date as the forum shows it: the month and the year. */
function when(value: string | undefined): string {
	if (value === undefined) {
		return '';
	}
	const parsed = Date.parse(value);
	if (Number.isNaN(parsed)) {
		return '';
	}
	return new Date(parsed).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** Views the way the forum abbreviates them: 1.1k rather than 1103. */
function reads(count: number): string {
	return count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
}

/** Days since a date, for the "waiting" marks. */
function ageDays(value: string | undefined): number {
	if (value === undefined) {
		return 0;
	}
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? 0 : Math.max(0, Math.round((Date.now() - parsed) / 86_400_000));
}

/** The panel, as HTML: the categories, and the two ways to read again. */
export function forumPanelHtml(state: ForumFacts, nonceValue: string): string {
	const total = state.categories.reduce((sum, category) => sum + category.topics, 0);
	const rows = state.categories
		.map(
			(category) => `<li><button type="button" class="cat" data-type="category" data-id="${category.id}">
<span class="cat__dot" style="background:${category.color === undefined ? 'var(--vscode-descriptionForeground)' : esc(category.color)}"></span>
<span class="cat__name">${esc(category.name)}</span>
<span class="cat__count">${category.topics}</span>
</button></li>`
		)
		.join('');

	const body = state.categories.length === 0
		? `<p class="note">Nothing has been read from the forum yet.</p>
<button type="button" class="more" data-command="temcoDocs.forumSync">Read the forum</button>`
		: `<ul class="cats">
<li><button type="button" class="cat" data-type="category"><span class="cat__dot cat__dot--all">${LIST}</span><span class="cat__name">All topics</span><span class="cat__count">${total}</span></button></li>
${rows}
</ul>`;

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonceValue}';">
<style>
	body { margin: 0; padding: 6px 8px 10px; font: 12px/1.35 var(--vscode-font-family); color: var(--vscode-foreground); }
	.head { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
	.head__title { display: flex; align-items: center; gap: 5px; font-weight: 600; }
	.head__acts { display: flex; align-items: center; gap: 2px; }
	.head__meta { margin: 2px 0 6px 0; color: var(--vscode-descriptionForeground); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.icon { background: none; border: 0; padding: 2px; color: inherit; cursor: pointer; opacity: .75; }
	.icon:hover { opacity: 1; }
	.cats { list-style: none; margin: 0; padding: 0; }
	.cats li + li { border-top: 1px solid var(--vscode-panel-border); }
	.cat { display: flex; align-items: center; gap: 6px; width: 100%; text-align: left; background: none; border: 0; padding: 5px 4px; color: inherit; font: inherit; cursor: pointer; }
	.cat:hover { background: var(--vscode-list-hoverBackground); }
	.cat:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }
	.cat__dot { width: 10px; height: 10px; border-radius: 2px; flex: none; }
	.cat__dot--all { width: 12px; height: 12px; opacity: .8; }
	.cat__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.cat__count { color: var(--vscode-descriptionForeground); font-variant-numeric: tabular-nums; }
	.note { margin: 8px 2px 0; color: var(--vscode-descriptionForeground); }
	.more { margin-top: 8px; width: 100%; padding: 4px 6px; background: none; border: 1px solid var(--vscode-panel-border); border-radius: 4px; color: inherit; font: inherit; cursor: pointer; }
	.more:hover { background: var(--vscode-list-hoverBackground); }
	.glyph { width: 12px; height: 12px; }
</style>
</head>
<body>
<div class="head"><div class="head__title">${USERS}<span>Forum</span></div><span class="head__acts"><button type="button" class="icon" data-command="temcoDocs.forumPage" title="Every category's topics, in one page" aria-label="Open the forum page">${LIST}</button><button type="button" class="icon" data-command="temcoDocs.forumSync" title="Read the categories again" aria-label="Read the categories again">${REFRESH}</button></span></div>
<div class="head__meta">${esc(forumBase().replace(/^https?:\/\//, ''))}${state.syncedAt === undefined ? '' : ` · read ${esc(state.syncedAt.slice(0, 10))}`}</div>
${body}
<script nonce="${nonceValue}">
(function () {
	const api = acquireVsCodeApi();
	document.addEventListener('click', (event) => {
		const target = event.target.closest('[data-type], [data-command]');
		if (target === null) { return; }
		if (target.dataset.command !== undefined) {
			const args = target.dataset.args;
			api.postMessage({ type: 'command', command: target.dataset.command, args: args === undefined ? undefined : JSON.parse(args) });
			return;
		}
		api.postMessage(target.dataset.id === undefined ? { type: 'category' } : { type: 'category', id: Number(target.dataset.id) });
	});
})();
</script>
</body>
</html>`;
}

/** One row of the topics table, as the forum's own table draws it. */
function topicRow(topic: ForumTopicRow, categories: readonly ForumCategoryRow[]): string {
	const category = categories.find((candidate) => candidate.id === topic.categoryId);
	const waiting = topic.replies === 0 && !topic.closed && ageDays(topic.lastPostedAt ?? topic.createdAt) >= AGING_DAYS;
	const people = topic.posters.length === 0
		? ''
		: `<span class="people">${topic.posters
			.slice(0, 4)
			.map((poster) => `<span class="person" title="${esc(poster.name ?? poster.username)}">${esc(initials(poster.name ?? poster.username))}</span>`)
			.join('')}</span>`;
	const args = esc(JSON.stringify({ id: topic.id, slug: topic.slug, title: topic.title }));
	return `<tr class="topic" data-command="temcoDocs.forumTopic" data-args="${args}">
<td><div class="topic__title">${topic.pinned ? '<span class="badge">pinned</span>' : ''}${esc(topic.title)}</div>
<div class="topic__meta">${esc(category?.name ?? '')}${waiting ? ' · <strong>no reply yet</strong>' : ''}${topic.closed ? ' · closed' : ''}</div></td>
<td>${people}</td>
<td class="num">${topic.replies}</td>
<td class="num">${reads(topic.views)}</td>
<td class="when">${when(topic.lastPostedAt ?? topic.createdAt)}</td>
</tr>`;
}

/** The page, as HTML: one category's topics, in the forum's own five columns. */
export function topicListBody(state: {
	topics: readonly ForumTopicRow[];
	category?: ForumCategoryRow;
	categories: readonly ForumCategoryRow[];
	syncedAt?: string;
	project?: string;
}): string {
	const title = state.category === undefined ? 'Forum — Topics' : `Forum — ${state.category.name}`;
	const replies = state.topics.reduce((sum, topic) => sum + topic.replies, 0);
	const views = state.topics.reduce((sum, topic) => sum + topic.views, 0);
	const unanswered = state.topics.filter((topic) => topic.replies === 0 && !topic.closed).length;
	const readArgs = state.category === undefined ? undefined : { id: state.category.id, slug: state.category.slug };

	const table = state.topics.length === 0
		? `<div class="mt-24"><div class="card card--plain"><p class="card__desc">${state.syncedAt === undefined ? 'Nothing has been read from the forum yet.' : 'This category has no topics in the last read.'} <button type="button" class="az-btn az-btn--sm az-btn--primary" data-command="temcoDocs.forumSync"${readArgs === undefined ? '' : ` data-args="${esc(JSON.stringify(readArgs))}"`}>Read the forum</button></p></div></div>`
		: `<div class="mt-24"><div class="table-wrap table-wrap--plain"><table class="table table--compact"><thead><tr><th>Topic</th><th>Participants</th><th class="num">Replies</th><th class="num">Views</th><th class="when">Activity</th></tr></thead><tbody>${state.topics.map((topic) => topicRow(topic, state.categories)).join('')}</tbody></table></div></div>`;

	return `${hero({
		eyebrow: forumBase().replace(/^https?:\/\//, ''),
		title,
		mark: 'users',
		desc: state.category === undefined
			? 'The community forum, read into this window: every category the site lists, and the topics in the one you opened. Nothing is posted from here.'
			: `The topics of ${state.category.name}, newest activity first. A row opens the conversation beside this page.`,
		actions: [
			{
				label: 'Read the forum',
				command: 'temcoDocs.forumSync',
				args: readArgs,
				mark: 'refresh',
				kind: 'primary' as const
			},
			...(state.category === undefined
				? []
				: [{ label: 'Open on the forum', command: 'temcoDocs.openForum', args: categoryUrl(state.category), mark: 'link' as const }])
		]
	})}
${numbers([
		{ value: String(state.topics.length), label: state.topics.length === 1 ? 'topic' : 'topics' },
		{ value: String(replies), label: replies === 1 ? 'reply' : 'replies' },
		{ value: String(unanswered), label: 'with no reply' },
		{ value: String(views), label: 'reads' }
	])}
${section({
		title: state.category === undefined ? 'Every topic' : 'Topics',
		desc: state.syncedAt === undefined ? undefined : `read ${state.syncedAt.slice(0, 10)}${state.project === undefined ? '' : ` · project ${state.project}`}`
	})}
${table}`;
}

/** One topic as a tab: the conversation, the page it is about, and what to do. */
export function topicBody(state: {
	topic: ForumTopicRow;
	posts: readonly ForumPostRow[];
	named?: PageEntry;
	suggestion?: { pageId?: string; pageTitle?: string; text: string; source: string; at: string };
	categoryName?: string;
}): string {
	const topic = state.topic;
	const waiting = topic.replies === 0 && !topic.closed;
	const answers = topic.replies === 0 ? 'no reply yet' : `${topic.replies} ${topic.replies === 1 ? 'reply' : 'replies'}`;
	const named = state.named;
	const suggestion = state.suggestion;
	const suggestArgs = esc(JSON.stringify({ id: topic.id }));

	const history = state.posts.length === 0
		? '<div class="card card--plain"><p class="card__desc">The conversation has not been read yet.</p></div>'
		: state.posts
			.map(
				(post) => `<div class="post"><div class="post__head"><span class="post__who">${esc(post.name ?? post.username ?? 'someone')}</span>
<span class="post__when">#${post.postNumber} · ${esc(when(post.createdAt))}${post.replyTo === undefined ? '' : ` · replied to #${post.replyTo}`}</span></div>
<div class="post__text">${esc(plainText(post.cooked ?? ''))}</div></div>`
			)
			.join('');

	const suggestionCard = suggestion === undefined
		? `<div class="card card--plain"><p class="card__desc">No suggestion yet. The platform can match a topic to a page on its own; the AI can say what that page should add.</p>
<div class="az-row" style="margin-top:10px"><button type="button" class="az-btn az-btn--sm" data-command="temcoDocs.forumSuggest" data-args="${suggestArgs}"><span>Suggest with the AI</span></button></div></div>`
		: `<div class="card card--plain"><div class="card__head"><span class="card__icon">${icon('sparkle')}</span><div class="card__title">${suggestion.source === 'ai' ? 'The AI suggests' : 'The platform suggests'}</div><div class="card__actions"><span class="badge">${esc(suggestion.source)}</span></div></div>
<p class="card__desc" style="white-space:pre-wrap">${esc(suggestion.text)}</p>
<div class="az-row" style="margin-top:10px"><button type="button" class="az-btn az-btn--sm" data-command="temcoDocs.forumSuggest" data-args="${suggestArgs}"><span>Ask the AI again</span></button></div></div>`;

	const pageCard = named === undefined
		? '<div class="card card--plain"><p class="card__desc">No page in this documentation set is named by the topic, so a suggestion has nothing to attach to. A page\'s id or title in the topic is enough.</p></div>'
		: `<div class="card card--plain"><div class="card__head"><span class="card__icon">${icon('document')}</span><div class="card__title">${esc(named.title)}</div><div class="card__actions"><span class="badge${named.provenance?.stale === true ? ' badge--warn' : ''}">${named.provenance?.stale === true ? 'code moved' : 'current'}</span></div></div>
<p class="card__desc">${esc(named.id)} · ${esc(named.area)}${named.chapter === '' ? '' : ` › ${esc(named.chapter)}`} · ${named.reviewed === null ? 'never reviewed' : `last reviewed ${esc(named.reviewed)}`}</p>
<div class="az-row" style="margin-top:10px"><button type="button" class="az-btn az-btn--sm" data-command="temcoDocs.openFile" data-args="${esc(JSON.stringify(named.uri.fsPath))}"><span>Open the page</span></button><button type="button" class="az-btn az-btn--sm az-btn--primary" data-command="temcoAi.openPanel" data-args="${esc(JSON.stringify(named.uri.fsPath))}"><span>Draft the fix</span></button></div></div>`;

	return `${hero({
		eyebrow: state.categoryName ?? 'Forum',
		title: topic.title,
		mark: 'users',
		desc: `${esc(topic.posters[0]?.name ?? topic.posters[0]?.username ?? 'someone')} · ${answers} · ${reads(topic.views)} reads · ${esc(when(topic.lastPostedAt ?? topic.createdAt))}${waiting ? ' · waiting for an answer' : ''}`,
		actions: [
			{
				label: 'Open on the forum',
				command: 'temcoDocs.openForum',
				args: topicUrl({ id: topic.id, slug: topic.slug }),
				mark: 'link',
				kind: 'primary' as const
			}
		]
	})}
<div class="mt-24">${section({ title: 'The page it is about' })}</div>
${pageCard}
<div class="mt-24">${section({ title: 'What to do about it', desc: 'A suggestion is advice, not a decision: nothing is written to a page or posted to the forum from here.' })}</div>
${suggestionCard}
<div class="mt-24">${section({ title: 'Discussion', desc: state.posts.length === 0 ? undefined : `${state.posts.length} ${state.posts.length === 1 ? 'post' : 'posts'}, as the forum shows them` })}</div>
${history}`;
}

/** Cooked HTML as readable text: what a reader needs from a post, without trusting markup this module did not write. */
export function plainText(cooked: string): string {
	return decodeEntities(
		cooked
			.replace(/<br\s*\/?>/gi, '\n')
			.replace(/<\/(p|div|li|blockquote|pre|h[1-6])>/gi, '\n')
			.replace(/<li>/gi, '• ')
			.replace(/<[^>]+>/g, '')
	)
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

function decodeEntities(text: string): string {
	const named: Record<string, string> = {
		amp: '&',
		lt: '<',
		gt: '>',
		quot: '"',
		apos: "'",
		nbsp: ' ',
		hellip: '…',
		mdash: '—',
		ndash: '–',
		rsquo: '’',
		lsquo: '‘',
		rdquo: '”',
		ldquo: '“'
	};
	return text
		.replace(/&#(\d+);/g, (_whole, code: string) => String.fromCodePoint(Number(code)))
		.replace(/&([a-z]+);/gi, (whole, name: string) => named[name.toLowerCase()] ?? whole);
}

function initials(name: string): string {
	const parts = name.trim().split(/[\s.\-_]+/).filter((part) => part.length > 0);
	if (parts.length === 0) {
		return '?';
	}
	return (parts.length === 1 ? parts[0].slice(0, 2) : `${parts[0][0]}${parts[1][0]}`).toUpperCase();
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
