// Temco Learn — the published site, as a reader sees it.
//
// Rebuilt from the mock (`docs/mock/js/views.platform.js`: `learn/home`, `learn/t3000`, `learn/article`,
// `learn/downloads`, `learn/paths`). The markup, the wording and the order are the mock's; the rows are its sample
// (`learnSample.ts`), because the site is a build artifact and nothing on these pages is written from here.

import * as vscode from 'vscode';
import { AREAS, BUILDING, DOWNLOADS, Download, LIVE, PATHS, PRODUCTS } from './learnSample';
import { escapeHtml as esc, icon, page, pageColumn } from './ui';

export const LEARN_HOME_VIEW_TYPE = 'temcoWorkbench.learn.home';
export const LEARN_PRODUCT_VIEW_TYPE = 'temcoWorkbench.learn.t3000';
export const LEARN_ARTICLE_VIEW_TYPE = 'temcoWorkbench.learn.article';
export const LEARN_DOWNLOADS_VIEW_TYPE = 'temcoWorkbench.learn.downloads';
export const LEARN_PATHS_VIEW_TYPE = 'temcoWorkbench.learn.paths';

interface ActionOptions {
	kind?: 'primary' | 'ghost';
	mark?: string;
	small?: boolean;
}

const button = (label: string, command: string, options: ActionOptions = {}): string =>
	`<button type="button" class="btn${options.small ? ' btn--sm' : ''}${options.kind ? ` btn--${options.kind}` : ''}" data-command="${command}">${options.mark ? icon(options.mark) : ''}<span>${esc(label)}</span></button>`;

const badge = (text: string, tone?: string): string =>
	`<span class="badge${tone && tone !== 'neutral' ? ` badge--${tone}` : ''}">${esc(text)}</span>`;

const card = (options: { title: string; mark?: string; actions?: string; desc?: string; body?: string; foot?: string }): string =>
	`<div class="card card--plain"><div class="card__head">${options.mark ? `<span class="card__icon">${icon(options.mark)}</span>` : ''}<div class="card__title">${esc(options.title)}</div>${options.actions ? `<div class="card__actions">${options.actions}</div>` : ''}</div>${options.desc ? `<p class="card__desc">${options.desc}</p>` : ''}${options.body ?? ''}${options.foot ? `<div class="card__foot">${options.foot}</div>` : ''}</div>`;

const list = (items: { mark: string; title: string; sub?: string; meta?: string }[]): string =>
	`<div class="list">${items.map((item) => `<div class="list__item">${icon(item.mark)}<div class="list__main"><div class="list__title">${esc(item.title)}</div>${item.sub ? `<div class="list__sub">${item.sub}</div>` : ''}</div>${item.meta ? `<div class="list__meta">${item.meta}</div>` : ''}</div>`).join('')}</div>`;

const hero = (options: { tone?: string; eyebrow?: string; title: string; desc?: string; actions?: string }): string =>
	`<div class="hero-panel${options.tone && options.tone !== 'accent' ? ` hero-panel--${options.tone}` : ''}">${options.eyebrow ? `<div class="eyebrow">${esc(options.eyebrow)}</div>` : ''}<div class="hero-panel__title">${esc(options.title)}</div>${options.desc ? `<p class="hero-panel__desc">${options.desc}</p>` : ''}${options.actions ? `<div class="hero-panel__actions">${options.actions}</div>` : ''}</div>`;

const pageHead = (options: { title: string; mark: string; desc: string; actions?: string }): string =>
	`<div class="page-head"><div class="page-head__main"><h1 class="page-head__title">${icon(options.mark)}${esc(options.title)}</h1><p class="page-head__desc">${options.desc}</p></div>${options.actions ? `<div class="page-head__actions">${options.actions}</div>` : ''}</div>`;

const rule = (label: string, count: string, note?: string, actions?: string): string =>
	`<div class="group-head"><span class="group-head__label">${esc(label)}</span><span class="group-head__rule"></span><span class="group-head__count">${esc(count)}</span>${actions ? `<span class="group-head__actions">${actions}</span>` : ''}</div>${note ? `<p class="group-note">${note}</p>` : ''}`;

/** The site's five surfaces, one panel each. */
export class LearnPages {
	private readonly panels = new Map<string, vscode.WebviewPanel>();

	constructor(private readonly context: vscode.ExtensionContext) { }

	home(): void {
		this.open('home', LEARN_HOME_VIEW_TYPE, 'Temco Learn', homeBody());
	}

	product(): void {
		this.open('t3000', LEARN_PRODUCT_VIEW_TYPE, 'T3000', productBody());
	}

	article(): void {
		this.open('article', LEARN_ARTICLE_VIEW_TYPE, 'Data Points API', articleBody());
	}

	downloads(): void {
		this.open('downloads', LEARN_DOWNLOADS_VIEW_TYPE, 'Downloads', downloadsBody());
	}

	paths(): void {
		this.open('paths', LEARN_PATHS_VIEW_TYPE, 'Learning Paths', pathsBody());
	}

	dispose(): void {
		for (const panel of this.panels.values()) {
			panel.dispose();
		}
		this.panels.clear();
	}

	private open(key: string, viewType: string, title: string, body: string): void {
		const html = page(body, { title });
		const existing = this.panels.get(key);
		if (existing) {
			existing.reveal(pageColumn());
			existing.webview.html = html;
			return;
		}
		const panel = vscode.window.createWebviewPanel(viewType, title, pageColumn(), {
			enableScripts: true,
			localResourceRoots: []
		});
		panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'learn.svg');
		panel.webview.html = html;
		this.panels.set(key, panel);
		panel.onDidDispose(() => this.panels.delete(key));
	}
}

/** *Home* — the mock's `learn/home`. */
function homeBody(): string {
	const pages = PRODUCTS.reduce((total, product) => total + product.pages, 0);

	const cards = PRODUCTS.map((product) =>
		`<button type="button" class="learn-card" data-command="temcoWorkbench.learn.t3000"><span class="learn-card__title">${esc(product.name)}</span><span class="learn-card__desc">${esc(product.desc)}</span><span class="row" style="gap:10px;font-size:11px;color:var(--fg-subtle)"><span class="tag">v${esc(product.version)}</span><span>${product.pages.toLocaleString('en-US')} pages</span></span></button>`
	).join('');

	return `<div class="learn-hero">
	<div class="learn-hero__inner">
		<div class="row" style="gap:10px;margin-bottom:10px">${badge('Temco Learn', 'accent')}<span class="cell-muted" style="font-size:12px">the published site, as a reader sees it</span></div>
		<h1 class="learn-hero__title">Documentation for Temco Controls products</h1>
		<p class="learn-hero__desc">Versioned, searchable, and available offline. This preview renders the same template the site ships, so a layout change here is a layout change there.</p>
		<div class="learn-hero__search">${icon('search')}<span>Search T3000, BACnet, devices, SDK…</span><span style="margin-left:auto" class="cell-mono">Ctrl+K</span></div>
	</div>
</div>
${rule('Products', `${PRODUCTS.length} products · ${pages.toLocaleString('en-US')} pages`, `<b>${esc(LIVE.version)}</b> is live, <b>${esc(BUILDING.version)}</b> is still building. Every product is versioned and searchable, and the offline artifacts are on Downloads.`)}
<div class="grid grid--4">${cards}</div>
<div class="mt-24 grid grid--2">
${card({
		title: 'Learning Paths',
		mark: 'graduation',
		actions: button('All Paths', 'temcoWorkbench.learn.paths', { small: true, kind: 'ghost' }),
		desc: 'Ordered reading for a job rather than for a product.',
		body: list(PATHS.map((path) => ({ mark: 'graduation', title: path.name, sub: `<span class="cell-muted">${esc(path.level)} · ${path.steps} steps · ${path.minutes} min</span>`, meta: button('Start', 'temcoWorkbench.learn.paths', { small: true, kind: 'ghost' }) })))
	})}
${card({
		title: 'Downloads',
		mark: 'download',
		actions: button('All', 'temcoWorkbench.learn.downloads', { small: true, kind: 'ghost' }),
		desc: 'The offline artifacts of the versions that are published.',
		body: list(DOWNLOADS.slice(0, 3).map((item) => ({ mark: item.format === 'PDF' ? 'document' : item.format === 'CHM' ? 'package' : 'download', title: `${item.name} ${item.version}`, sub: `<span class="cell-muted">${esc(item.format)} · ${esc(item.size)} · ${esc(item.date)}</span>`, meta: badge(item.state, item.tone) })))
	})}
</div>
<div class="mt-24"><div class="callout">${icon('info')}<div>The preview and the shipped site share one template. A layout decision made in this window is the layout the reader gets — there is no second design to keep in sync.</div></div></div>`;
}

/** *The T3000 product page* — the mock's `learn/t3000`. */
function productBody(): string {
	const pages = AREAS.reduce((total, area) => total + area.pages, 0);

	const areas = AREAS.map((area) =>
		`<button type="button" class="learn-card" data-command="temcoWorkbench.learn.article"><span class="learn-card__title">${esc(area.area)}</span><span class="learn-card__desc">${esc(area.desc)}</span><span class="row" style="gap:8px;font-size:11px;color:var(--fg-subtle)"><span>${area.pages} pages</span>${area.stale ? `<span>·</span><span>${area.stale} behind their source</span>` : ''}</span></button>`
	).join('');

	return `<div class="learn-hero">
	<div class="learn-hero__inner">
		<div class="eyebrow">Product documentation</div>
		<h1 class="learn-hero__title">T3000</h1>
		<p class="learn-hero__desc">The controller platform: hardware, points, programs, schedules and the web UI. ${pages.toLocaleString('en-US')} pages across ${AREAS.length} areas.</p>
		<div class="row" style="margin-top:14px">${badge(`${BUILDING.version} · building`, 'info')}${badge(`${LIVE.version} · live`, 'ok')}<span class="cell-muted" style="font-size:12px">last published ${esc(LIVE.date)}</span></div>
	</div>
</div>
<div style="margin-bottom:20px">
${hero({
		tone: 'warn',
		eyebrow: 'Release state',
		title: '13.0 is building — readers still get 12.9',
		desc: 'The build center is compiling the offline help. Until it publishes, the site keeps serving the last complete version and the version selector stays on 12.9.',
		actions: button('Open Build Center', 'temcoDocs.builds', { kind: 'primary', mark: 'play' }) + button('Preview 13.0', 'temcoWorkbench.learn.article', { mark: 'document' })
	})}
</div>
${rule('Areas', `${AREAS.length} areas · ${pages.toLocaleString('en-US')} pages`, 'The site is organised the way the documentation is written, so a reader and an author see the same eight areas.')}
<div class="grid grid--3">${areas}</div>`;
}

/** *One article* — the mock's `learn/article`. */
function articleBody(): string {
	const nav = ['Overview', 'Getting Started', 'Architecture', 'API Reference', 'Hardware', 'Protocols', 'Troubleshooting', 'Release Notes'];
	const toc = ['Endpoints', 'Reading a point', 'Writing a point', 'Point types', 'Scaling', 'Errors'];

	const article = `<div class="article__body">
	<div class="eyebrow">T3000 · API Reference</div>
	<h1>Data Points API</h1>
	<div class="article__meta">${badge('13.0', 'accent')}<span>Updated 3 hours ago · 14 min read · Owner: Derek</span><span style="margin-left:auto">${badge('In review', 'warn')}</span></div>
	<p>Read and write the data points of a controller. Every point has a type, a unit and a scale factor; the scale factor is what turns the integer a controller stores into the value a person reads.</p>
	<h2 id="endpoints">Endpoints</h2>
	<table><thead><tr><th>Method</th><th>Path</th><th>Purpose</th></tr></thead><tbody>
		<tr><td><code>GET</code></td><td><code>/api/points</code></td><td>List every point on a device</td></tr>
		<tr><td><code>GET</code></td><td><code>/api/points/{id}</code></td><td>One point, with its metadata</td></tr>
		<tr><td><code>PUT</code></td><td><code>/api/points/{id}</code></td><td>Write a value at a priority</td></tr>
	</tbody></table>
	<h2 id="reading">Reading a point</h2>
	<p>A read returns the raw integer, the scale factor and the engineering value. The engineering value is derived, never stored:</p>
	<pre class="code">${esc('{\n  "id": "AI1",\n  "type": "analog-input",\n  "raw": 1840,\n  "scale": 0.01,\n  "offset": 0,\n  "unit": "°C",\n  "value": 18.4\n}')}</pre>
	<h2 id="writing">Writing a point</h2>
	<p>Writes carry a priority. A lower number wins; writing at priority 8 is an operator override and is undone by the schedule at the next event.</p>
	<h2 id="types">Point types</h2>
	<ul><li><b>AI</b> — analog input, read-only</li><li><b>AO</b> — analog output, writable</li><li><b>DI</b> — digital input, read-only</li><li><b>DO</b> — digital output, writable</li><li><b>AV</b>, <b>BV</b> — values with no physical channel</li></ul>
	<h2 id="scaling">Scaling</h2>
	<p>Points are stored as 32-bit floats, except AI and AO values on controllers running firmware 2.14 or later, which store a scaled integer and apply the factor in <code>point.scale</code>.</p>
	<div style="margin:16px 0"><div class="callout">${icon('sparkle')}<div><b>AI note.</b> This paragraph was rewritten by a draft that is still in review. The published 12.9 page still says every point is a float.</div></div></div>
	<h2 id="errors">Errors</h2>
	<p>A write to a read-only point returns <code>409</code>. A write while the device is offline returns <code>503</code> with the last known contact time.</p>
</div>`;

	const navItems = nav.map((item) => `<button type="button" class="learn-nav__item${item === 'API Reference' ? ' is-active' : ''}" data-command="temcoWorkbench.learn.article">${esc(item)}</button>`).join('');
	const sectionItems = ['Points and Properties', 'Reading a Point', 'Data Points API', 'Writing a Point', 'Point Types', 'Errors'].map((item) => `<button type="button" class="learn-nav__item${item === 'Data Points API' ? ' is-active' : ''}" data-command="temcoWorkbench.learn.article">${esc(item)}</button>`).join('');

	return `<div class="learn-reader"><div class="learn-grid">
	<div class="learn-nav"><div class="learn-nav__title">T3000</div>${navItems}<div class="learn-nav__title" style="margin-top:16px">API Reference</div>${sectionItems}</div>
	<div class="stack">${article}<div class="row" style="gap:10px;border-top:1px solid var(--border);padding-top:16px">${button('Previous', 'temcoWorkbench.learn.article', { mark: 'chevron-left' })}${button('Next', 'temcoWorkbench.learn.article', { mark: 'chevron-right' })}<span style="margin-left:auto" class="cell-muted">${icon('clock')} 13.0 · preview</span></div></div>
	<div class="stack learn-rail">
		<div><div class="learn-nav__title">On this page</div>${toc.map((item, index) => `<button type="button" class="toc__item${index === 0 ? ' is-active' : ''}" data-command="temcoWorkbench.learn.article">${esc(item)}</button>`).join('')}</div>
		<div class="side-note"><div class="learn-nav__title">This page</div><dl class="kv"><dt>Owner</dt><dd>Derek</dd><dt>Reviewed</dt><dd>never</dd><dt>Source</dt><dd>t3000webview</dd><dt>Help id</dt><dd class="cell-mono">dp-api</dd></dl></div>
		<div class="side-note"><div class="learn-nav__title">Feedback</div>Was this page helpful?<br><div class="row" style="margin-top:6px">${button('Yes', 'temcoDocs.feedback', { small: true, mark: 'check' })}${button('No', 'temcoDocs.feedback', { small: true, mark: 'close' })}</div></div>
	</div>
</div></div>`;
}

/** *Downloads* — the mock's `learn/downloads`. */
function downloadsBody(): string {
	const groups: { key: string; name: string; version: string; date: string; items: Download[] }[] = [];
	for (const item of DOWNLOADS) {
		const key = `${item.name} · ${item.version}`;
		let group = groups.find((candidate) => candidate.key === key);
		if (!group) {
			group = { key, name: item.name, version: item.version, date: item.date, items: [] };
			groups.push(group);
		}
		group.items.push(item);
	}

	const markFor = (format: string): string => format === 'PDF' ? 'document' : format === 'CHM' ? 'package' : 'download';
	const row = (item: Download): string =>
		`<div class="record-row${item.state === 'Ready' ? '' : ' record-row--static'}">${toneMarkOf(markFor(item.format), item.state === 'Ready' ? undefined : 'accent')}<div class="record-row__main"><div class="record-row__title"><span class="record-row__name">${esc(item.format)}</span></div><div class="record-row__meta"><span>${esc(item.size === '—' ? 'size not known until the build finishes' : item.size)}</span></div></div><div class="record-row__state">${badge(item.state, item.tone)}</div>${item.state === 'Ready' ? button('Download', 'temcoWorkbench.learn.downloads', { small: true, kind: 'primary', mark: 'download' }) : ''}</div>`;

	const sections = groups.map((group) => {
		const pending = group.items.filter((item) => item.state !== 'Ready');
		const note = pending.length > 0 ? `The ${pending.map((item) => esc(item.format)).join(' and ')} build is still running — there is nothing to fetch for it yet.` : undefined;
		return `<div class="mt-24">${rule(`${group.name} · ${group.version}`, `${group.items.length} ${group.items.length === 1 ? 'artifact' : 'artifacts'} · published ${group.date}`, note)}<div class="record-list">${group.items.map(row).join('')}</div></div>`;
	}).join('');

	return `${pageHead({
		title: 'Downloads',
		mark: 'download',
		desc: 'The offline artifacts of each published version. A version stays downloadable after a newer one ships.',
		actions: button('Build Missing', 'temcoDocs.buildSite', { mark: 'play' })
	})}${sections}`;
}

/** *Learning Paths* — the mock's `learn/paths`. */
function pathsBody(): string {
	const steps = PATHS.reduce((total, path) => total + path.steps, 0);
	const minutes = PATHS.reduce((total, path) => total + path.minutes, 0);

	const cards = PATHS.map((path) => card({
		title: path.name,
		mark: 'graduation',
		desc: esc(path.desc),
		body: `<div class="facts"><span class="tag">${esc(path.level)}</span><span>${path.steps} steps · ${path.minutes} min</span></div><ol class="path-steps">${path.outline.map((step) => `<li>${esc(step)}</li>`).join('')}<li class="cell-muted">and ${path.steps - path.outline.length} more</li></ol>`,
		foot: button('Start', 'temcoWorkbench.learn.article', { small: true, kind: 'primary' }) + button('Preview', 'temcoWorkbench.learn.article', { small: true, kind: 'ghost' })
	})).join('');

	return `${pageHead({
		title: 'Learning Paths',
		mark: 'graduation',
		desc: 'Ordered reading for a job, not for a product. Each step names the page and what it assumes you already know.',
		actions: button('New Path', 'temcoWorkbench.learn.paths', { mark: 'plus' })
	})}
${rule('Paths', `${PATHS.length} paths · ${steps} steps · ${Math.floor(minutes / 60)} h ${minutes % 60} min of reading`, 'A path is a reading order, not a course: every step is an existing page with an owner and a review date, so a stale step shows up here as a stale page.')}
<div class="grid grid--3">${cards}</div>`;
}

/** A tone mark, since this module's UI copy does not export one. */
function toneMarkOf(mark: string, tone?: 'accent' | 'ok' | 'warn' | 'err' | 'info'): string {
	return `<span class="tone-mark${tone ? ` tone-mark--${tone}` : ''}">${icon(mark, 'icon--sm')}</span>`;
}
