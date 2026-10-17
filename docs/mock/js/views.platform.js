/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Temco Controls. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* AI Hub, Temco Learn, Store and Settings. */

(function (M) {
	'use strict';

	var ui = M.ui;
	var data = M.data;

	/* ------------------------------------------------------------------ AI hub */

	M.views['ai/chat'] = {
		title: 'Chat',
		render: function () {
			var messages = [
				{ who: 'You', user: true, text: 'Summarise the page I have open and tell me what is out of date.' },
				{
					who: 'Temco AI',
					text: 'Data Points API lists the read and write endpoints for a controller\'s points, plus the scale factor each type uses. Two things drifted: the page says every point is a 32-bit float, which stopped being true for AI and AO points on firmware 2.14; and the screenshot was taken on 2.9.',
					cites: ['Data Points API', 'point.h', 'User Manual p.148']
				},
				{ who: 'You', user: true, text: 'Draft the fix.' },
				{
					who: 'Temco AI',
					text: 'I drafted 3 paragraphs and replaced the screenshot reference. Nothing has been written — open Review Center to see the diff, accept or reject it.',
					cites: ['Draft · api-reference/data-points.md']
				}
			];

			var body =
				ui.pageHead({
					title: 'Temco AI',
					icon: 'sparkle',
					desc: 'A local model over the documentation. It reads pages, sources and registry; it never writes one — every draft lands in Review Center as a diff.',
					actions:
						ui.badge('local · qwen2.5-3b', 'ok') +
						ui.button('Models', { icon: 'chip', open: 'ai/models' })
				}) +
				'<div class="split">' +
				ui.card({
					title: 'Conversation',
					actions: ui.button('Clear', { small: true, kind: 'ghost', action: 'clear-chat' }),
					flush: true,
					body:
						'<div class="chat" style="padding:16px;max-height:none">' +
						messages.map(function (message) {
							return (
								'<div class="chat__message' + (message.user ? ' chat__message--user' : '') + '">' +
								'<div class="chat__who">' + (message.user ? ui.icon('account') : ui.icon('sparkle')) + ui.esc(message.who) + '</div>' +
								'<div class="chat__bubble"><p>' + ui.esc(message.text) + '</p>' +
								(message.cites ? '<div class="chat__cites">' + message.cites.map(function (cite) {
									return '<button type="button" class="chat__cite" data-action="open-citation">' + ui.esc(cite) + '</button>';
								}).join('') + '</div>' : '') +
								'</div></div>'
							);
						}).join('') +
						'</div>'
				}) +
				'<div class="stack">' +
				ui.card({
					description: '',
					title: 'Context',
					desc: 'What the model can see for this conversation.',
					body: ui.list([
						{ icon: 'document', title: 'api-reference/data-points.md', sub: '<span class="cell-muted">open page · 1,204 words</span>', meta: ui.badge('Page', 'accent') },
						{ icon: 'book', title: 'API Reference', sub: '<span class="cell-muted">186 pages</span>', meta: ui.badge('Area', 'neutral') },
						{ icon: 'repo', title: 't3000webview', sub: '<span class="cell-muted">412 files read</span>', meta: ui.badge('Source', 'neutral') },
						{ icon: 'check', title: 'registry.json', sub: '<span class="cell-muted">8 areas · 1,254 pages</span>', meta: ui.badge('Registry', 'neutral') }
					])
				}) +
				ui.card({
					title: 'Try',
					body:
						'<div class="row">' +
						ui.button('Find gaps in this area', { small: true, prompt: 'Find knowledge gaps in the API Reference area' }) +
						ui.button('Draft a release note', { small: true, prompt: 'Generate release notes from the commits since 12.9' }) +
						ui.button('Explain this page', { small: true, prompt: 'Explain data-points.md to a new integrator' }) +
						'</div>'
				}) +
				'</div>' +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['ai/actions'] = {
		title: 'Actions',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Actions',
					icon: 'play',
					desc: 'The things the AI is allowed to do, and where its output goes. An action that writes anything always routes through Review Center.',
					actions: ui.button('Configure', { icon: 'gear', open: 'settings/ai' })
				}) +
				ui.table({
					columns: [
						{ label: 'Action', render: function (row) { return '<span class="cell-strong">' + ui.esc(row.name) + '</span><div class="cell-muted" style="font-size:12px">' + ui.esc(row.desc) + '</div>'; } },
						{ label: 'State', render: function (row) { return ui.badge(row.state, row.tone); } },
						{ label: '', align: 'right', render: function (row) {
							return row.tone === 'ok'
								? ui.button('Run', { small: true, kind: 'primary', action: 'run-action' })
								: ui.button('Load Model', { small: true, action: 'load-model' });
						} }
					],
					rows: data.aiActions
				}) +
				'<div class="mt-24 split">' +
				ui.card({
					title: 'Where Output Goes',
					body:
						'<div class="list">' +
						'<div class="list__item"><div class="list__main"><div class="list__title">Drafts</div><div class="list__sub">Review Center, as a diff</div></div><div class="list__meta">' + ui.icon('arrow-right') + ' ' + ui.badge('Diff', 'info') + '</div></div>' +
						'<div class="list__item"><div class="list__main"><div class="list__title">Answers</div><div class="list__sub">the panel, with citations</div></div><div class="list__meta">' + ui.icon('arrow-right') + ' ' + ui.badge('Chat', 'neutral') + '</div></div>' +
						'<div class="list__item"><div class="list__main"><div class="list__title">Suggestions</div><div class="list__sub">the Gaps list of an area</div></div><div class="list__meta">' + ui.icon('arrow-right') + ' ' + ui.badge('List', 'neutral') + '</div></div>' +
						'</div>'
				}) +
				ui.card({
					title: 'Guard Rails',
					body:
						'<div class="check"><input type="checkbox" checked disabled><span>Never write a page without a draft</span></div>' +
						'<div class="check" style="margin-top:8px"><input type="checkbox" checked disabled><span>Always cite the page or source used</span></div>' +
						'<div class="check" style="margin-top:8px"><input type="checkbox" checked disabled><span>Refuse when the local model is not loaded</span></div>' +
						'<div class="check" style="margin-top:8px"><input type="checkbox" checked disabled><span>Keep every prompt and answer out of the repository</span></div>'
				}) +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['ai/citations'] = {
		title: 'Citations',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Citations',
					icon: 'link',
					desc: 'Every answer names where it came from. A citation opens the page or the file it points at, in the editor column that is already open.',
					actions: ui.button('Open Source', { icon: 'repo', open: 'docs/sources' })
				}) +
				ui.table({
					columns: [
						{ label: 'Cited', render: function (row) { return '<span class="cell-strong">' + ui.esc(row.title) + '</span>'; } },
						{ label: 'Kind', render: function (row) { return ui.badge(row.kind, row.kind === 'page' ? 'accent' : 'neutral'); } },
						{ label: 'Where', render: function (row) { return '<span class="cell-mono cell-muted">' + ui.esc(row.where) + '</span>'; } },
						{ label: '', align: 'right', render: function () { return ui.button('Open', { small: true, kind: 'ghost', action: 'open-citation' }); } }
					],
					rows: data.citations
				});
			return ui.view(body);
		}
	};

	M.views['ai/models'] = {
		title: 'Local Models',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Local Models',
					icon: 'chip',
					desc: 'Models run on this machine. Nothing is sent anywhere; a model is downloaded once and kept in the user\'s folder.',
					actions:
						ui.button('Download Model', { kind: 'primary', icon: 'download', action: 'download-model' }) +
						ui.button('Runtime Settings', { icon: 'gear', open: 'settings/ai' })
				}) +
				ui.table({
					columns: [
						{ label: 'Model', render: function (row) { return '<span class="cell-strong cell-mono">' + ui.esc(row.name) + '</span>'; } },
						{ label: 'Kind', render: function (row) { return '<span class="tag">' + ui.esc(row.kind) + '</span>'; } },
						{ label: 'Context', render: function (row) { return '<span class="cell-mono">' + ui.esc(row.ctx) + '</span>'; } },
						{ label: 'Size', render: function (row) { return '<span class="cell-mono cell-muted">' + ui.esc(row.size) + '</span>'; } },
						{ label: 'State', render: function (row) { return ui.badge(row.state, row.tone); } },
						{ label: '', align: 'right', render: function (row) {
							return row.tone === 'ok' ? ui.button('Unload', { small: true, kind: 'ghost', action: 'unload-model' }) : ui.button('Load', { small: true, action: 'load-model' });
						} }
					],
					rows: data.aiModels
				}) +
				'<div class="mt-24 grid grid--3">' +
				ui.card({ title: 'Runtime', icon: 'activity', desc: 'llama.cpp · CPU, 6 threads', body: '<div class="cell-muted" style="font-size:12px">12.4 tokens/s · 2.1 GB resident</div>' }) +
				ui.card({ title: 'Storage', icon: 'package', desc: 'Models live in ~/Temco/models, outside every repository.', body: ui.barRow(48, '2.4 GB', 'ok') }) +
				ui.card({ title: 'Privacy', icon: 'check', desc: 'No network calls once a model is loaded. Prompts stay in the platform database.', body: ui.badge('Offline', 'ok') }) +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['ai/knowledge'] = {
		title: 'Knowledge Base',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Knowledge Base',
					icon: 'book',
					desc: 'What the model was given, and when it was last rebuilt. The index follows the documentation; it is not a second copy of it.',
					actions: ui.button('Rebuild Index', { kind: 'primary', icon: 'refresh', action: 'rebuild-index' })
				}) +
				ui.tiles([
					{ value: '1,254', label: 'Chunks' },
					{ value: '8', label: 'Areas' },
					{ value: '768', label: 'Dimensions' },
					{ value: '3 hours', label: 'Index age' }
				]) +
				'<div class="mt-24 split">' +
				ui.card({
					title: 'Sources in the Index',
					body: ui.list([
						{ icon: 'book', title: 'Documentation pages', sub: '<span class="cell-muted">1,254 pages</span>', meta: ui.badge('Indexed', 'ok') },
						{ icon: 'repo', title: 't3000webview', sub: '<span class="cell-muted">412 files · code comments</span>', meta: ui.badge('Indexed', 'ok') },
						{ icon: 'repo', title: 'bacnet-stack', sub: '<span class="cell-muted">1,204 files</span>', meta: ui.badge('Indexed', 'ok') },
						{ icon: 'document', title: 'T3000 User Manual.docx', sub: '<span class="cell-muted">changed 4 days ago</span>', meta: ui.badge('Stale', 'warn') }
					])
				}) +
				ui.card({
					title: 'Retrieval',
					body:
						'<dl class="kv">' +
						'<dt>Chunking</dt><dd>heading-aware · 800 tokens</dd>' +
						'<dt>Overlap</dt><dd class="cell-mono">120 tokens</dd>' +
						'<dt>Top k</dt><dd class="cell-mono">8</dd>' +
						'<dt>Rerank</dt><dd>off</dd>' +
						'<dt>Min score</dt><dd class="cell-mono">0.62</dd>' +
						'</dl>',
					foot: ui.button('Test Retrieval', { small: true, kind: 'ghost', action: 'test-retrieval' })
				}) +
				'</div>';
			return ui.view(body);
		}
	};

	/* ------------------------------------------------------------------ learn */

	M.views['learn/home'] = {
		title: 'Temco Learn',
		render: function () {
			var cards = data.learnProducts.map(function (product) {
				return (
					'<button type="button" class="learn-card" data-open="learn/article">' +
					'<span class="learn-card__title">' + ui.esc(product.name) + '</span>' +
					'<span class="learn-card__desc">' + ui.esc(product.desc) + '</span>' +
					'<span class="row" style="gap:10px;font-size:11px;color:var(--fg-subtle)">' +
					'<span class="tag">v' + ui.esc(product.version) + '</span>' +
					'<span>' + product.pages + ' pages</span>' +
					'</span>' +
					'</button>'
				);
			}).join('');

			var body =
				'<div class="learn-hero">' +
				'<div class="learn-hero__inner">' +
				'<div class="row" style="gap:10px;margin-bottom:10px">' +
				ui.badge('Temco Learn', 'accent') +
				'<span class="cell-muted" style="font-size:12px">the published site, as a reader sees it</span>' +
				'</div>' +
				'<h1 class="learn-hero__title">Documentation for Temco Controls products</h1>' +
				'<p class="learn-hero__desc">Versioned, searchable, and available offline. This preview renders the same template the site ships, so a layout change here is a layout change there.</p>' +
				'<div class="learn-hero__search">' + ui.icon('search') + '<span>Search T3000, BACnet, devices, SDK…</span><span style="margin-left:auto" class="cell-mono">Ctrl+K</span></div>' +
				'</div>' +
				'</div>' +
				'<div class="view__inner view__inner--wide">' +
				'<div class="row row--between" style="margin-bottom:12px">' +
				'<h2 style="font-size:16px">Products</h2>' +
				'<span class="cell-muted" style="font-size:12px">4 products · 1,254 pages · versions 12.9 (live) and 13.0 (building)</span>' +
				'</div>' +
				'<div class="grid grid--4">' + cards + '</div>' +
				'<div class="mt-24 split">' +
				ui.card({
					title: 'Learning Paths',
					actions: ui.button('All Paths', { small: true, kind: 'ghost', open: 'learn/paths' }),
					body: ui.list(data.learnPaths.map(function (path) {
						return { icon: 'graduation', title: path.name, sub: '<span class="cell-muted">' + path.level + ' · ' + path.steps + ' steps · ' + path.minutes + ' min</span>', meta: ui.button('Start', { small: true, kind: 'ghost', action: 'start-path' }) };
					}))
				}) +
				ui.card({
					title: 'Downloads',
					actions: ui.button('All', { small: true, kind: 'ghost', open: 'learn/downloads' }),
					body: ui.list([
						{ icon: 'document', title: 'T3000 13.0 · PDF', sub: '<span class="cell-muted">894 pages · 6.2 MB</span>', meta: ui.badge('Ready', 'ok') },
						{ icon: 'package', title: 'T3000 13.0 · Offline help', sub: '<span class="cell-muted">CHM · building</span>', meta: ui.badge('62%', 'info') },
						{ icon: 'download', title: 'T3000 12.9 · ZIP', sub: '<span class="cell-muted">18.2 MB · pinned</span>', meta: ui.badge('Archived', 'neutral') }
					])
				}) +
				'</div>' +
				'<div class="mt-24">' +
				ui.callout('The preview and the shipped site share one template. A layout decision made in this window is the layout the reader gets — there is no second design to keep in sync.') +
				'</div>' +
				'</div>';
			return '<div class="view">' + body + '</div>';
		}
	};

	M.views['learn/t3000'] = {
		title: 'T3000',
		render: function () {
			var body =
				'<div class="learn-hero">' +
				'<div class="learn-hero__inner">' +
				'<div class="eyebrow">Product documentation</div>' +
				'<h1 class="learn-hero__title">T3000</h1>' +
				'<p class="learn-hero__desc">The controller platform: hardware, points, programs, schedules and the web UI. 894 pages across 8 areas.</p>' +
				'<div class="row" style="margin-top:14px">' +
				ui.badge('13.0 · building', 'info') + ui.badge('12.9 · live', 'ok') +
				'<span class="cell-muted" style="font-size:12px">last published 12 Sep</span>' +
				'</div>' +
				'</div>' +
				'</div>' +
				'<div class="view__inner view__inner--wide">' +
				'<div class="grid grid--3">' +
				['Getting Started', 'Architecture', 'API Reference', 'Hardware', 'Protocols', 'Troubleshooting', 'Trends', 'Release Notes', 'Glossary'].map(function (area) {
					return (
						'<button type="button" class="learn-card" data-open="learn/article">' +
						'<span class="learn-card__title">' + ui.esc(area) + '</span>' +
						'<span class="learn-card__desc">' + ui.esc('Pages, examples and the API surface for ' + area.toLowerCase()) + '</span>' +
						'<span class="row" style="gap:8px;font-size:11px;color:var(--fg-subtle)"><span>' + (12 + (area.length % 7) * 18) + ' pages</span></span>' +
						'</button>'
					);
				}).join('') +
				'</div>' +
				'<div class="mt-24">' +
				ui.callout('Version 13.0 is not published yet. Readers still get 12.9; the build center decides when that changes.', { kind: 'warn' }) +
				'</div>' +
				'</div>';
			return '<div class="view">' + body + '</div>';
		}
	};

	M.views['learn/article'] = {
		title: 'Data Points API',
		render: function () {
			var nav = ['Overview', 'Getting Started', 'Architecture', 'API Reference', 'Hardware', 'Protocols', 'Troubleshooting', 'Release Notes'];
			var toc = ['Endpoints', 'Reading a point', 'Writing a point', 'Point types', 'Scaling', 'Errors'];

			var article =
				'<div class="article__body">' +
				'<div class="eyebrow">T3000 · API Reference</div>' +
				'<h1>Data Points API</h1>' +
				'<div class="article__meta">' +
				ui.badge('13.0', 'accent') +
				'<span>Updated 3 hours ago</span><span>·</span><span>14 min read</span><span>·</span><span>Owner: Derek</span>' +
				'<span style="margin-left:auto">' + ui.badge('In review', 'warn') + '</span>' +
				'</div>' +
				'<p>Read and write the data points of a controller. Every point has a type, a unit and a scale factor; the scale factor is what turns the integer a controller stores into the value a person reads.</p>' +
				'<h2 id="endpoints">Endpoints</h2>' +
				'<table><thead><tr><th>Method</th><th>Path</th><th>Purpose</th></tr></thead><tbody>' +
				'<tr><td><code>GET</code></td><td><code>/api/points</code></td><td>List every point on a device</td></tr>' +
				'<tr><td><code>GET</code></td><td><code>/api/points/{id}</code></td><td>One point, with its metadata</td></tr>' +
				'<tr><td><code>PUT</code></td><td><code>/api/points/{id}</code></td><td>Write a value at a priority</td></tr>' +
				'</tbody></table>' +
				'<h2 id="reading">Reading a point</h2>' +
				'<p>A read returns the raw integer, the scale factor and the engineering value. The engineering value is derived, never stored:</p>' +
				'<pre class="code">' + ui.esc('{\n  "id": "AI1",\n  "type": "analog-input",\n  "raw": 1840,\n  "scale": 0.01,\n  "offset": 0,\n  "unit": "°C",\n  "value": 18.4\n}') + '</pre>' +
				'<h2 id="writing">Writing a point</h2>' +
				'<p>Writes carry a priority. A lower number wins; writing at priority 8 is an operator override and is undone by the schedule at the next event.</p>' +
				'<h2 id="types">Point types</h2>' +
				'<ul>' +
				'<li><b>AI</b> — analog input, read-only</li>' +
				'<li><b>AO</b> — analog output, writable</li>' +
				'<li><b>DI</b> — digital input, read-only</li>' +
				'<li><b>DO</b> — digital output, writable</li>' +
				'<li><b>AV</b>, <b>BV</b> — values with no physical channel</li>' +
				'</ul>' +
				'<h2 id="scaling">Scaling</h2>' +
				'<p>Points are stored as 32-bit floats, except AI and AO values on controllers running firmware 2.14 or later, which store a scaled integer and apply the factor in <code>point.scale</code>.</p>' +
				'<div class="callout" style="margin:16px 0"><span>' + ui.icon('sparkle') + '</span><div><b>AI note.</b> This paragraph was rewritten by a draft that is still in review. The published 12.9 page still says every point is a float.</div></div>' +
				'<h2 id="errors">Errors</h2>' +
				'<p>A write to a read-only point returns <code>409</code>. A write while the device is offline returns <code>503</code> with the last known contact time.</p>' +
				'</div>';

			var body =
				'<div class="learn-grid">' +
				'<div>' +
				'<div class="learn-nav__title">T3000</div>' +
				nav.map(function (item) {
					return '<button type="button" class="learn-nav__item' + (item === 'API Reference' ? ' is-active' : '') + '" data-action="learn-nav">' + ui.esc(item) + '</button>';
				}).join('') +
				'<div class="learn-nav__title" style="margin-top:16px">API Reference</div>' +
				['Points and Properties', 'Reading a Point', 'Data Points API', 'Writing a Point', 'Point Types', 'Errors'].map(function (item) {
					return '<button type="button" class="learn-nav__item' + (item === 'Data Points API' ? ' is-active' : '') + '" data-action="learn-nav">' + ui.esc(item) + '</button>';
				}).join('') +
				'</div>' +
				'<div class="stack">' +
				article +
				'<div class="row" style="gap:10px;border-top:1px solid var(--border);padding-top:16px">' +
				ui.button('Previous', { icon: 'chevron-left' }) +
				ui.button('Next', { icon: 'chevron-right' }) +
				'<span style="margin-left:auto" class="cell-muted">' + ui.icon('clock') + ' 13.0 · preview</span>' +
				'</div>' +
				'</div>' +
				'<div class="stack">' +
				'<div>' +
				'<div class="learn-nav__title">On this page</div>' +
				toc.map(function (item, index) {
					return '<button type="button" class="toc__item' + (index === 0 ? ' is-active' : '') + '" data-action="toc">' + ui.esc(item) + '</button>';
				}).join('') +
				'</div>' +
				'<div class="side-note">' +
				'<div class="learn-nav__title">This page</div>' +
				'<b>Owner</b> Derek<br>' +
				'<b>Reviewed</b> never<br>' +
				'<b>Source</b> t3000webview<br>' +
				'<b>Help id</b> <span class="cell-mono">dp-api</span>' +
				'</div>' +
				'<div class="side-note">' +
				'<div class="learn-nav__title">Feedback</div>' +
				'Was this page helpful?<br>' +
				'<div class="row" style="margin-top:6px">' +
				ui.button('Yes', { small: true, icon: 'check', action: 'feedback' }) +
				ui.button('No', { small: true, icon: 'close', action: 'feedback' }) +
				'</div>' +
				'</div>' +
				'</div>' +
				'</div>';
			return '<div class="view">' + body + '</div>';
		}
	};

	M.views['learn/downloads'] = {
		title: 'Downloads',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Downloads',
					icon: 'download',
					desc: 'The offline artifacts of each published version. A version stays downloadable after a newer one ships.',
					actions: ui.button('Build Missing', { icon: 'play', action: 'build-missing' })
				}) +
				ui.table({
					columns: [
						{ label: 'Artifact', render: function (row) { return '<span class="cell-strong">' + ui.esc(row.name) + '</span>'; } },
						{ label: 'Version', render: function (row) { return '<span class="cell-mono">' + ui.esc(row.version) + '</span>'; } },
						{ label: 'Format', render: function (row) { return '<span class="tag">' + ui.esc(row.format) + '</span>'; } },
						{ label: 'Size', align: 'right', render: function (row) { return '<span class="cell-mono">' + ui.esc(row.size) + '</span>'; } },
						{ label: 'Published', render: function (row) { return '<span class="cell-muted">' + ui.esc(row.date) + '</span>'; } },
						{ label: 'State', render: function (row) { return ui.badge(row.state, row.tone); } },
						{ label: '', align: 'right', render: function () { return ui.button('Download', { small: true, kind: 'ghost', action: 'download' }); } }
					],
					rows: [
						{ name: 'T3000 Documentation', version: '13.0', format: 'PDF', size: '6.2 MB', date: 'Today', state: 'Ready', tone: 'ok' },
						{ name: 'T3000 Documentation', version: '13.0', format: 'CHM', size: '—', date: 'Today', state: 'Building', tone: 'info' },
						{ name: 'T3000 Documentation', version: '12.9', format: 'PDF', size: '6.0 MB', date: '12 Sep', state: 'Ready', tone: 'ok' },
						{ name: 'T3000 Documentation', version: '12.9', format: 'ZIP', size: '18.2 MB', date: '12 Sep', state: 'Ready', tone: 'ok' },
						{ name: 'T3-BACnet Reference', version: '4.2', format: 'PDF', size: '1.8 MB', date: '2 days ago', state: 'Ready', tone: 'ok' }
					]
				});
			return ui.view(body);
		}
	};

	M.views['learn/paths'] = {
		title: 'Learning Paths',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Learning Paths',
					icon: 'graduation',
					desc: 'Ordered reading for a job, not for a product. Each step names the page and what it assumes you already know.',
					actions: ui.button('New Path', { icon: 'plus', action: 'new-path' })
				}) +
				'<div class="grid grid--3">' +
				data.learnPaths.map(function (path) {
					return ui.card({
						title: path.name,
						icon: 'graduation',
						desc: ui.esc(path.desc),
						body:
							'<div class="row" style="gap:8px;margin-top:10px;font-size:12px;color:var(--fg-muted)">' +
							'<span class="tag">' + ui.esc(path.level) + '</span>' +
							'<span>' + path.steps + ' steps</span><span>·</span><span>' + path.minutes + ' min</span>' +
							'</div>',
						foot: ui.button('Start', { small: true, kind: 'primary', action: 'start-path' }) + ui.button('Preview', { small: true, kind: 'ghost', action: 'preview-path' })
					});
				}).join('') +
				'</div>';
			return ui.view(body);
		}
	};

	/* ------------------------------------------------------------------ store */

	M.views['store/marketplace'] = {
		title: 'Marketplace',
		render: function () {
			var cards = data.extensions.map(function (extension) {
				return (
					'<div class="store-card">' +
					'<div class="store-card__top">' +
					'<span class="store-card__icon">' + ui.icon(extension.icon, 'icon--lg') + '</span>' +
					'<div style="min-width:0">' +
					'<div class="store-card__name">' + ui.esc(extension.name) + ' ' + (extension.official ? ui.badge('Temco', 'accent') : '') + '</div>' +
					'<div class="store-card__publisher">' + ui.esc(extension.publisher) + ' · v' + ui.esc(extension.version) + '</div>' +
					'</div>' +
					'</div>' +
					'<p class="store-card__desc">' + ui.esc(extension.desc) + '</p>' +
					'<div class="store-card__foot">' +
					(extension.installed ? ui.badge('Installed', 'ok') : ui.badge('Not installed', 'neutral')) +
					ui.button(extension.installed ? 'Manage' : 'Install', { small: true, kind: extension.installed ? undefined : 'primary', action: extension.installed ? 'manage-extension' : 'install-extension' }) +
					'</div>' +
					'</div>'
				);
			}).join('');

			var body =
				ui.pageHead({
					title: 'Marketplace',
					icon: 'bag',
					desc: 'Extensions add a module or a tool. Temco extensions are built into the platform; community ones are installed into your user folder.',
					actions: '<input class="input" type="search" placeholder="Search extensions" aria-label="Search extensions">'
				}) +
				'<div class="toolbar">' +
				'<div class="segmented" role="group" aria-label="Extension source">' +
				'<button type="button" aria-pressed="true">All</button>' +
				'<button type="button" aria-pressed="false">Temco</button>' +
				'<button type="button" aria-pressed="false">Community</button>' +
				'<button type="button" aria-pressed="false">Installed</button>' +
				'</div>' +
				'<span class="toolbar__spacer"></span>' +
				'<span class="cell-muted" style="font-size:12px">5 extensions · 2 installed · 3 updates</span>' +
				'</div>' +
				'<div class="grid grid--2">' + cards + '</div>';
			return ui.view(body);
		}
	};

	M.views['store/installed'] = {
		title: 'Installed',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Installed',
					icon: 'package',
					desc: 'What this window loads. A built-in module cannot be uninstalled; a community extension can.',
					actions: ui.button('Check for Updates', { icon: 'refresh', action: 'check-updates' })
				}) +
				ui.table({
					columns: [
						{ label: 'Extension', render: function (row) { return '<span class="cell-strong">' + ui.esc(row.name) + '</span><div class="cell-muted" style="font-size:12px">' + ui.esc(row.publisher) + '</div>'; } },
						{ label: 'Version', render: function (row) { return '<span class="cell-mono">' + ui.esc(row.version) + '</span>'; } },
						{ label: 'Source', render: function (row) { return ui.badge(row.official ? 'Built in' : 'Community', row.official ? 'accent' : 'neutral'); } },
						{ label: 'State', render: function (row) { return ui.badge(row.installed ? 'Enabled' : 'Disabled', row.installed ? 'ok' : 'neutral'); } },
						{ label: '', align: 'right', render: function (row) {
							return row.official ? ui.button('Settings', { small: true, kind: 'ghost', action: 'manage-extension' }) : ui.button('Uninstall', { small: true, kind: 'danger', action: 'uninstall-extension' });
						} }
					],
					rows: data.extensions.filter(function (extension) { return extension.installed; })
				});
			return ui.view(body);
		}
	};

	M.views['store/updates'] = {
		title: 'Updates',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Updates',
					icon: 'sync',
					desc: 'Updates the platform found. A built-in module updates with the platform; a community one updates here.',
					actions: ui.button('Update All', { kind: 'primary', icon: 'download', action: 'update-all' })
				}) +
				ui.list([
					{ icon: 'building', title: 'Temco BACnet Studio 0.9.2 → 0.9.4', sub: '<span class="cell-muted">Temco · changelog available</span>', meta: ui.button('Update', { small: true, kind: 'primary', action: 'update-extension' }) },
					{ icon: 'database', title: 'Temco SQL Studio 0.4.0 → 0.5.0', sub: '<span class="cell-muted">Temco · new results grid</span>', meta: ui.button('Update', { small: true, kind: 'primary', action: 'update-extension' }) },
					{ icon: 'sparkle', title: 'Fluent Icon Preview 2.0.0 → 2.1.2', sub: '<span class="cell-muted">Community</span>', meta: ui.button('Update', { small: true, kind: 'primary', action: 'update-extension' }) }
				]) +
				'<div class="mt-24">' +
				ui.callout('An update is staged, not applied: the platform restarts the extension host when the window is idle so a running query is never cut in half.') +
				'</div>';
			return ui.view(body);
		}
	};

	/* ------------------------------------------------------------------ settings */

	M.views['settings/general'] = {
		title: 'General',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Settings',
					icon: 'gear',
					desc: 'Settings the platform owns. Everything here is stored per user; a workspace can override the ones marked as such.',
					actions: ui.button('Open JSON', { icon: 'code', action: 'open-settings-json' })
				}) +
				'<div class="card" style="padding:0 16px">' +
				ui.formRow('Theme', 'Follows the operating system unless forced.', '<select class="select"><option>System</option><option>Dark</option><option>Light</option></select>') +
				ui.formRow('Startup view', 'The tab that opens when the window starts.', '<select class="select"><option>Needs Work</option><option>Dashboard</option><option>Last used</option><option>Empty editor</option></select>') +
				ui.formRow('Working folder', 'Where repositories are cloned and captures are written.', '<input class="input" value="~/Temco" aria-label="Working folder">') +
				ui.formRow('Telemetry', 'Documentation checks and build failures only. Never page content.', '<label class="check"><input type="checkbox" checked><span>Send diagnostics</span></label>') +
				ui.formRow('Update channel', 'Preview adds release candidates one version earlier.', '<select class="select"><option>Stable</option><option>Preview</option></select>') +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['settings/branding'] = {
		title: 'Branding',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Branding',
					icon: 'palette',
					desc: 'The product identity the shell draws: the icon, the wordmark and the accent. The mock previews them in place rather than in a specimen sheet.',
					actions: ui.button('Reset', { icon: 'refresh', action: 'reset-branding' })
				}) +
				'<div class="split">' +
				ui.card({
					title: 'Application Icon',
					desc: 'Used by the window, the taskbar and the title bar mark.',
					body:
						'<div class="row" style="gap:18px;align-items:flex-end">' +
						'<div style="display:grid;place-items:center;width:64px;height:64px;border-radius:14px;background:#224E7A;color:#fff;font-size:26px;font-weight:700">T</div>' +
						'<div style="display:grid;place-items:center;width:32px;height:32px;border-radius:8px;background:#224E7A;color:#fff;font-size:14px;font-weight:700">T</div>' +
						'<div style="display:grid;place-items:center;width:16px;height:16px;border-radius:4px;background:#224E7A;color:#fff;font-size:8px;font-weight:700">T</div>' +
						'</div>',
					foot: '<span class="cell-mono">resources/temco-icon.svg</span>' + ui.button('Replace', { small: true, kind: 'ghost', action: 'replace-icon' })
				}) +
				ui.card({
					title: 'Theme',
					desc: 'Two themes ship. A theme changes colour roles, never layout.',
					body:
						'<div class="row">' +
						ui.button('Dark', { small: true, kind: 'primary', action: 'theme-dark' }) +
						ui.button('Light', { small: true, action: 'theme-light' }) +
						'</div>' +
						'<div class="mt-16 row" style="gap:8px">' +
						'<span style="width:28px;height:28px;border-radius:6px;background:#1f1f1f;border:1px solid #3c3c3c"></span>' +
						'<span style="width:28px;height:28px;border-radius:6px;background:#0078d4"></span>' +
						'<span style="width:28px;height:28px;border-radius:6px;background:#3fb950"></span>' +
						'<span style="width:28px;height:28px;border-radius:6px;background:#d29922"></span>' +
						'<span style="width:28px;height:28px;border-radius:6px;background:#f85149"></span>' +
						'</div>'
				}) +
				'</div>' +
				'<div class="mt-24 card" style="padding:0 16px">' +
				ui.formRow('Product name', 'Drawn in the title bar and the About window.', '<input class="input" value="Temco Platform" aria-label="Product name">') +
				ui.formRow('Accent colour', 'Used for focus, selection and the active container indicator.', '<input class="input" value="#0078d4" aria-label="Accent colour">') +
				ui.formRow('Welcome page', 'The walkthrough shown on a fresh profile.', '<select class="select"><option>Temco Platform</option><option>None</option></select>') +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['settings/ai'] = {
		title: 'AI Models',
		render: function () {
			var body =
				ui.pageHead({
					title: 'AI Models',
					icon: 'sparkle',
					desc: 'Which model answers, how much context it gets, and what it is allowed to touch.',
					actions: ui.button('Open Models', { icon: 'chip', open: 'ai/models' })
				}) +
				'<div class="card" style="padding:0 16px">' +
				ui.formRow('Chat model', 'The model behind the AI panel and Draft actions.', '<select class="select"><option>qwen2.5-3b-instruct</option><option>phi-3-mini-4k</option><option>temco-docs-1.4b</option></select>') +
				ui.formRow('Embedding model', 'Used to build and query the knowledge index.', '<select class="select"><option>nomic-embed-text</option></select>') +
				ui.formRow('Context window', 'How much of a page and its area the model may read at once.', '<select class="select"><option>32k</option><option>16k</option><option>8k</option></select>') +
				ui.formRow('Always cite', 'An answer without a citation is refused.', '<label class="check"><input type="checkbox" checked><span>Require citations</span></label>') +
				ui.formRow('Drafts', 'Where an AI change goes before it is written.', '<select class="select"><option>Review Center</option><option>Review Center, auto-reject after 7 days</option></select>') +
				ui.formRow('Offline only', 'Refuse every action that would call a network service.', '<label class="check"><input type="checkbox" checked><span>Keep prompts on this machine</span></label>') +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['settings/publishing'] = {
		title: 'Publishing',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Publishing',
					icon: 'upload',
					desc: 'Where a release goes and what it is allowed to overwrite. Publishing never edits a page; it copies built artifacts.',
					actions: ui.button('Test Connection', { icon: 'globe', action: 'test-publish' })
				}) +
				'<div class="split">' +
				ui.card({
					title: 'Target',
					body:
						'<div class="field"><label>Site</label><input class="input" value="https://learn.temcocontrols.com" aria-label="Site"></div>' +
						'<div class="field" style="margin-top:12px"><label>Path</label><input class="input" value="/t3000/{version}/" aria-label="Path"></div>' +
						'<div class="field" style="margin-top:12px"><label>Channel</label><select class="select"><option>Stable</option><option>Preview (noindex)</option></select></div>',
					foot: ui.badge('Connected', 'ok') + '<span>last publish 12 Sep · 6.2 MB</span>'
				}) +
				ui.card({
					title: 'Artifacts',
					body:
						'<div class="check"><input type="checkbox" checked><span>Website</span></div>' +
						'<div class="check" style="margin-top:8px"><input type="checkbox" checked><span>PDF</span></div>' +
						'<div class="check" style="margin-top:8px"><input type="checkbox" checked><span>Offline help (CHM)</span></div>' +
						'<div class="check" style="margin-top:8px"><input type="checkbox" checked><span>Search index</span></div>' +
						'<div class="check" style="margin-top:8px"><input type="checkbox"><span>AI index (local only)</span></div>'
				}) +
				'</div>' +
				'<div class="mt-24">' +
				ui.callout('A published version is frozen. To change a page a reader can reach, publish a new version — an edit does not reach the site until it does.', { kind: 'warn' }) +
				'</div>';
			return ui.view(body);
		}
	};
})(window.TemcoMock = window.TemcoMock || { views: {} });
