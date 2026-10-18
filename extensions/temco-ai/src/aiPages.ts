// The AI Hub's pages and its two side-bar groups, rebuilt from the mock.
//
// Source: `docs/mock/js/views.platform.js` — `ai/chat`, `ai/actions`, `ai/citations`, `ai/models` and
// `ai/knowledge` — and the mock's AI Hub side bar: *Assistant* (Chat · Actions · Citations) and *Runtime*
// (Local Models · Knowledge Base). The rows are the mock's sample (`aiSample.ts`); what the module actually runs
// is still answered by `aiStatus()` and shown in the AI bar, and every button here is one of this module's own
// commands or the documentation module's.

import * as vscode from 'vscode';
import { ACTIONS, AiModel, CITATIONS, MODELS } from './aiSample';
import { escapeHtml as esc, icon, page, pageColumn } from './ui';

export const CHAT_VIEW_TYPE = 'temcoAi.chat';
export const ACTIONS_VIEW_TYPE = 'temcoAi.actions';
export const CITATIONS_VIEW_TYPE = 'temcoAi.citations';
export const MODELS_VIEW_TYPE = 'temcoAi.localModels';
export const KNOWLEDGE_VIEW_TYPE = 'temcoAi.knowledge';

interface ActionOptions {
	kind?: 'primary' | 'ghost';
	mark?: string;
	small?: boolean;
	args?: unknown;
}

const button = (label: string, command: string, options: ActionOptions = {}): string =>
	`<button type="button" class="btn${options.small ? ' btn--sm' : ''}${options.kind ? ` btn--${options.kind}` : ''}" data-command="${command}"${options.args === undefined ? '' : ` data-args="${esc(JSON.stringify(options.args))}"`}>${options.mark ? icon(options.mark) : ''}<span>${esc(label)}</span></button>`;

const pageHead = (options: { title: string; mark: string; desc: string; actions?: string }): string =>
	`<div class="page-head"><div class="page-head__main"><h1 class="page-head__title">${icon(options.mark)}${esc(options.title)}</h1><p class="page-head__desc">${options.desc}</p></div>${options.actions ? `<div class="page-head__actions">${options.actions}</div>` : ''}</div>`;

const card = (options: { title: string; mark?: string; actions?: string; desc?: string; body?: string }): string =>
	`<div class="card card--plain"><div class="card__head">${options.mark ? `<span class="card__icon">${icon(options.mark)}</span>` : ''}<div class="card__title">${esc(options.title)}</div>${options.actions ? `<div class="card__actions">${options.actions}</div>` : ''}</div>${options.desc ? `<p class="card__desc">${options.desc}</p>` : ''}${options.body ?? ''}</div>`;

const badge = (text: string, tone?: string): string =>
	`<span class="badge${tone && tone !== 'neutral' ? ` badge--${tone}` : ''}">${esc(text)}</span>`;

const list = (items: { mark: string; title: string; sub?: string; meta?: string }[]): string =>
	`<div class="list">${items.map((item) => `<div class="list__item">${icon(item.mark)}<div class="list__main"><div class="list__title">${esc(item.title)}</div>${item.sub ? `<div class="list__sub">${item.sub}</div>` : ''}</div>${item.meta ? `<div class="list__meta">${item.meta}</div>` : ''}</div>`).join('')}</div>`;

const tiles = (items: { value: string; label: string }[]): string =>
	`<div class="tiles">${items.map((item) => `<div class="tile"><span class="tile__value">${esc(item.value)}</span><span class="tile__label">${esc(item.label)}</span></div>`).join('')}</div>`;

const table = (head: string[], rows: string[][]): string =>
	`<div class="table-wrap table-wrap--plain"><table class="table table--compact"><thead><tr>${head.map((cell) => `<th>${esc(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map((cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

const barRow = (pct: number, value: string, kind?: string): string =>
	`<div class="bar-row"><div class="bar"><span class="bar__fill${kind ? ` bar__fill--${kind}` : ''}" style="width:${pct}%"></span></div><span class="bar-row__value">${esc(value)}</span></div>`;

const kv = (pairs: [string, string][]): string =>
	`<dl class="kv">${pairs.map(([term, definition]) => `<dt>${esc(term)}</dt><dd>${definition}</dd>`).join('')}</dl>`;

/** The five surfaces, one panel each. */
export class AiPages {
	private readonly panels = new Map<string, vscode.WebviewPanel>();

	constructor(private readonly context: vscode.ExtensionContext) { }

	chat(): void {
		this.open('chat', CHAT_VIEW_TYPE, 'Temco AI', chatBody());
	}

	actions(): void {
		this.open('actions', ACTIONS_VIEW_TYPE, 'Actions', actionsBody());
	}

	citations(): void {
		this.open('citations', CITATIONS_VIEW_TYPE, 'Citations', citationsBody());
	}

	models(): void {
		this.open('models', MODELS_VIEW_TYPE, 'Local Models', modelsBody());
	}

	knowledge(): void {
		this.open('knowledge', KNOWLEDGE_VIEW_TYPE, 'Knowledge Base', knowledgeBody());
	}

	dispose(): void {
		for (const panel of this.panels.values()) {
			panel.dispose();
		}
		this.panels.clear();
	}

	private open(key: string, viewType: string, title: string, body: string): void {
		const existing = this.panels.get(key);
		if (existing) {
			existing.reveal(pageColumn());
			existing.webview.html = page(body, { title });
			return;
		}
		const panel = vscode.window.createWebviewPanel(viewType, title, pageColumn(), {
			enableScripts: true,
			localResourceRoots: []
		});
		panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'ai.svg');
		panel.webview.html = page(body, { title });
		this.panels.set(key, panel);
		panel.onDidDispose(() => this.panels.delete(key));
	}
}

/** *Chat* — the mock's `ai/chat`. */
function chatBody(): string {
	const messages = [
		{ who: 'You', user: true, text: 'Summarise the page I have open and tell me what is out of date.' },
		{ who: 'Temco AI', text: 'Data Points API lists the read and write endpoints for a controller’s points, plus the scale factor each type uses. Two things drifted: the page says every point is a 32-bit float, which stopped being true for AI and AO points on firmware 2.14; and the screenshot was taken on 2.9.', cites: ['Data Points API', 'point.h', 'User Manual p.148'] },
		{ who: 'You', user: true, text: 'Draft the fix.' },
		{ who: 'Temco AI', text: 'I drafted 3 paragraphs and replaced the screenshot reference. Nothing has been written — open Review Center to see the diff, accept or reject it.', cites: ['Draft · api-reference/data-points.md'] }
	];

	const thread = messages.map((message) =>
		`<div class="chat__message${message.user ? ' chat__message--user' : ''}"><div class="chat__who">${icon(message.user ? 'account' : 'sparkle')}${esc(message.who)}</div><div class="chat__bubble"><p>${esc(message.text)}</p>${message.cites ? `<div class="chat__cites">${message.cites.map((cite) => `<button type="button" class="chat__cite" data-command="temcoAi.citations">${esc(cite)}</button>`).join('')}</div>` : ''}</div></div>`
	).join('');

	return `${pageHead({
		title: 'Temco AI',
		mark: 'sparkle',
		desc: 'A local model over the documentation. It reads pages, sources and the registry; it never writes one — every draft lands in Review Center as a diff.',
		actions: badge('local · qwen2.5-3b', 'ok') + button('Models', 'temcoAi.localModels', { mark: 'chip' })
	})}
<div class="mt-24">
${card({
		title: 'Conversation',
		mark: 'sparkle',
		actions: button('Clear', 'temcoAi.chat', { small: true, kind: 'ghost' }),
		desc: `${messages.length} messages. Each answer names what it read; the draft names where it landed.`,
		body: `<div class="chat chat--page">${thread}</div><div class="chat__starters"><span class="cell-muted" style="font-size:11px;align-self:center">Try</span>${button('Find gaps in this area', 'temcoAi.actions', { small: true, kind: 'ghost' })}${button('Draft a release note', 'temcoDocs.review', { small: true, kind: 'ghost' })}${button('Explain this page', 'temcoAi.openPanel', { small: true, kind: 'ghost' })}</div><div class="chat__composer"><div class="chat__row" style="gap:6px"><span class="cell-muted" style="font-size:11px">Reading</span><span class="chat__cite" title="the page that is open">Data Points API</span><span class="chat__cite" title="402 pages, 8 of them in this conversation">API Reference</span><span class="chat__cite" title="412 files read">t3000webview</span><span class="chat__cite" title="8 areas · 1,254 pages">registry.json</span></div><textarea placeholder="Ask about the page that is open…" aria-label="Message"></textarea><div class="chat__row"><span class="chip">qwen2.5-3b · local</span><span class="cell-muted" style="font-size:11px">Nothing leaves this machine</span>${button('Send', 'temcoAi.openPanel', { small: true, kind: 'primary', mark: 'arrow-right' })}</div></div>`
	})}
</div>`;
}

/** *Actions* — the mock's `ai/actions`. */
function actionsBody(): string {
	const rows = ACTIONS.map((action) => [
		`<span class="cell-strong">${esc(action.name)}</span><div class="cell-muted" style="font-size:12px">${esc(action.desc)}</div>`,
		badge(action.state, action.tone),
		action.tone === 'ok' ? button('Run', 'temcoAi.openPanel', { small: true, kind: 'primary' }) : button('Load Model', 'temcoAi.models', { small: true })
	]);

	return `${pageHead({
		title: 'Actions',
		mark: 'play',
		desc: 'The things the AI is allowed to do, and where its output goes. An action that writes anything always routes through Review Center.',
		actions: button('Configure', 'temcoWorkbench.settings', { mark: 'gear' })
	})}
<div class="mt-24">
${card({
		title: 'What It Can Do',
		mark: 'sparkle',
		desc: 'An action without a loaded model says so instead of failing halfway.',
		body: table(['Action', 'State', ''], rows)
	})}
</div>
<div class="mt-24 grid grid--2">
${card({
		title: 'Where Output Goes',
		mark: 'arrow-right',
		desc: 'Nothing an action produces is a silent write.',
		body: list([
			{ mark: 'document', title: 'Drafts', sub: '<span class="cell-muted">Review Center, as a diff</span>', meta: badge('Diff', 'info') },
			{ mark: 'check', title: 'Answers', sub: '<span class="cell-muted">the AI bar, with citations</span>', meta: badge('Chat', 'neutral') },
			{ mark: 'list', title: 'Suggestions', sub: '<span class="cell-muted">the Gaps list of an area</span>', meta: badge('List', 'neutral') }
		])
	})}
${card({
		title: 'Guard Rails',
		mark: 'key',
		desc: 'Fixed on purpose. Changing one of these is a platform change, not a setting.',
		body: list([
			{ mark: 'check', title: 'Never write a page without a draft', meta: badge('Enforced', 'ok') },
			{ mark: 'check', title: 'Always cite the page or source used', meta: badge('Enforced', 'ok') },
			{ mark: 'check', title: 'Refuse when the local model is not loaded', meta: badge('Enforced', 'ok') },
			{ mark: 'check', title: 'Keep prompts and answers out of the repository', meta: badge('Enforced', 'ok') }
		])
	})}
</div>`;
}

/** *Citations* — the mock's `ai/citations`. */
function citationsBody(): string {
	const rows = CITATIONS.map((citation) => [
		`<span class="cell-strong">${esc(citation.title)}</span>`,
		badge(citation.kind, citation.kind === 'page' ? 'accent' : 'neutral'),
		`<span class="cell-mono cell-muted">${esc(citation.where)}</span>`,
		`<span class="cell-muted">${esc(citation.usedIn)}</span>`,
		button('Open', 'temcoDocs.page', { small: true, kind: 'ghost', args: [citation.title] })
	]);

	return `${pageHead({
		title: 'Citations',
		mark: 'link',
		desc: 'Every answer names where it came from. A citation opens the page or the file it points at, in the editor column that is already open.',
		actions: button('Open Source', 'temcoDocs.sources', { mark: 'repo' })
	})}
<div class="mt-24">
${card({
		title: 'Cited So Far',
		mark: 'link',
		desc: 'A citation is kept with the answer that used it, so a reader can check the AI without leaving the page.',
		body: table(['Cited', 'Kind', 'Where', 'Used In', ''], rows)
	})}
</div>`;
}

/** *Local Models* — the mock's `ai/models`. */
function modelsBody(): string {
	const loaded = MODELS.filter((model) => model.state === 'Loaded').length;

	const rows = MODELS.map((model: AiModel) => [
		`<span class="cell-strong cell-mono">${esc(model.name)}</span><div class="cell-muted" style="font-size:12px">${esc(model.kind)}</div>`,
		`<span class="cell-mono">${esc(model.ctx)}</span>`,
		`<span class="cell-mono cell-muted">${esc(model.size)}</span>`,
		badge(model.state, model.tone),
		model.tone === 'ok' ? button('Unload', 'temcoAi.models', { small: true, kind: 'ghost' }) : button('Load', 'temcoAi.models', { small: true })
	]);

	return `${pageHead({
		title: 'Local Models',
		mark: 'chip',
		desc: 'Models run on this machine. Nothing is sent anywhere; a model is downloaded once and kept in the user’s folder.',
		actions: button('Download Model', 'temcoAi.models', { kind: 'primary', mark: 'download' })
	})}
<div class="mt-24">
${card({
		title: 'Models',
		mark: 'chip',
		actions: button('Runtime Settings', 'temcoAi.page', { small: true, kind: 'ghost', mark: 'gear' }),
		desc: `${MODELS.length} downloaded, ${loaded} loaded. A chat model and an embedding model can be loaded at once; everything else waits.`,
		body: table(['Model', 'Context', 'Size', 'State', ''], rows)
	})}
</div>
<div class="mt-24 grid grid--3">
${card({ title: 'Runtime', mark: 'activity', desc: 'llama.cpp · CPU, 6 threads', body: '<div class="cell-muted" style="font-size:12px">12.4 tokens/s · 2.1 GB resident</div>' })}
${card({ title: 'Storage', mark: 'package', desc: 'Models live in ~/Temco/models, outside every repository.', body: barRow(48, '2.4 GB', 'ok') })}
${card({ title: 'Privacy', mark: 'check', desc: 'No network calls once a model is loaded. Prompts stay in the platform database.', body: badge('Offline', 'ok') })}
</div>`;
}

/** *Knowledge Base* — the mock's `ai/knowledge`. */
function knowledgeBody(): string {
	const areas = 8;
	const pages = 1254;

	return `${pageHead({
		title: 'Knowledge Base',
		mark: 'book',
		desc: 'What the model was given, and when it was last rebuilt. The index follows the documentation; it is not a second copy of it.',
		actions: button('Rebuild Index', 'temcoDocs.refresh', { kind: 'primary', mark: 'refresh' })
	})}
${tiles([
		{ value: pages.toLocaleString('en-US'), label: 'Chunks' },
		{ value: String(areas), label: 'Areas' },
		{ value: '768', label: 'Dimensions' },
		{ value: '3 hours', label: 'Index age' }
	])}
<div class="mt-24 grid grid--2">
${card({
		title: 'Sources in the Index',
		mark: 'book',
		desc: 'One chunk per heading, so an answer can point at a section and not just a page.',
		body: list([
			{ mark: 'book', title: 'Documentation pages', sub: `<span class="cell-muted">${pages.toLocaleString('en-US')} pages</span>`, meta: badge('Indexed', 'ok') },
			{ mark: 'repo', title: 't3000webview', sub: '<span class="cell-muted">412 files · code comments</span>', meta: badge('Indexed', 'ok') },
			{ mark: 'repo', title: 'bacnet-stack', sub: '<span class="cell-muted">1,204 files</span>', meta: badge('Indexed', 'ok') },
			{ mark: 'document', title: 'T3000 User Manual.docx', sub: '<span class="cell-muted">changed 4 days ago</span>', meta: badge('Stale', 'warn') }
		])
	})}
${card({
		title: 'Retrieval',
		mark: 'search',
		actions: button('Test Retrieval', 'temcoAi.knowledge', { small: true, kind: 'ghost' }),
		desc: 'How a question is turned into chunks. Reranking is off, so top-k is what you get.',
		body: kv([
			['Chunking', 'heading-aware · 800 tokens'],
			['Overlap', '<span class="cell-mono">120 tokens</span>'],
			['Top k', '<span class="cell-mono">8</span>'],
			['Rerank', 'off'],
			['Min score', '<span class="cell-mono">0.62</span>']
		])
	})}
</div>`;
}

/** The AI Hub's two side-bar groups: the mock's *Assistant* and *Runtime*. */
interface Row {
	label: string;
	note: string;
	mark: string;
	command: string;
}

const GROUPS: { id: string; rows: Row[] }[] = [
	{
		id: 'assistant',
		rows: [
			{ label: 'Chat', note: 'ask about the page that is open', mark: 'sparkle', command: 'temcoAi.chat' },
			{ label: 'Actions', note: 'what the AI is allowed to do', mark: 'play', command: 'temcoAi.actions' },
			{ label: 'Citations', note: 'where each answer came from', mark: 'link', command: 'temcoAi.citations' }
		]
	},
	{
		id: 'runtime',
		rows: [
			{ label: 'Local Models', note: 'what is downloaded, and what is loaded', mark: 'chip', command: 'temcoAi.localModels' },
			{ label: 'Knowledge Base', note: 'what the model was given', mark: 'book', command: 'temcoAi.knowledge' }
		]
	}
];

/** Registers the two group views the AI Hub container shows. */
export function registerAiViews(context: vscode.ExtensionContext): void {
	for (const group of GROUPS) {
		const rows = group.rows;
		context.subscriptions.push(
			vscode.window.createTreeView(`temcoAi.${group.id}`, {
				treeDataProvider: {
					getTreeItem: (element: vscode.TreeItem) => element,
					getChildren: (): vscode.TreeItem[] => rows.map((row) => {
						const item = new vscode.TreeItem(row.label, vscode.TreeItemCollapsibleState.None);
						item.iconPath = new vscode.ThemeIcon(row.mark);
						item.tooltip = `${row.label} — ${row.note}`;
						item.command = { command: row.command, title: row.label };
						return item;
					})
				}
			})
		);
	}
}
