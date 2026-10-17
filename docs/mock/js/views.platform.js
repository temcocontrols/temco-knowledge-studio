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
					desc: 'A local model over the documentation. It reads pages, sources and the registry; it never writes one — every draft lands in Review Center as a diff.',
					actions:
						ui.badge('local · qwen2.5-3b', 'ok') +
						ui.button('Models', { icon: 'chip', open: 'ai/models' })
				}) +
				'<div class="mt-24">' +
				ui.card({
					title: 'Conversation',
					icon: 'sparkle',
					cls: 'card--plain',
					actions: ui.button('Clear', { small: true, kind: 'ghost', action: 'clear-chat' }),
					desc: messages.length + ' messages. Each answer names what it read; the draft names where it landed.',
					body:
						'<div class="chat chat--page">' +
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
						'</div>' +
						/* What the next answer will be allowed to read, on one line above the box you
						   type in — the context is a property of the conversation, not a page section. */
						'<div class="chat__starters">' +
						'<span class="cell-muted" style="font-size:11px;align-self:center">Try</span>' +
						ui.button('Find gaps in this area', { small: true, kind: 'ghost', prompt: 'Find knowledge gaps in the API Reference area' }) +
						ui.button('Draft a release note', { small: true, kind: 'ghost', prompt: 'Generate release notes from the commits since 12.9' }) +
						ui.button('Explain this page', { small: true, kind: 'ghost', prompt: 'Explain data-points.md to a new integrator' }) +
						'</div>' +
						'<div class="chat__composer">' +
						'<div class="chat__row" style="gap:6px">' +
						'<span class="cell-muted" style="font-size:11px">Reading</span>' +
						'<span class="chat__cite" title="the page that is open">Data Points API</span>' +
						'<span class="chat__cite" title="402 pages, 8 of them in this conversation">API Reference</span>' +
						'<span class="chat__cite" title="412 files read">t3000webview</span>' +
						'<span class="chat__cite" title="8 areas · 1,254 pages">registry.json</span>' +
						'</div>' +
						'<textarea placeholder="Ask about the page that is open…" aria-label="Message"></textarea>' +
						'<div class="chat__row">' +
						'<span class="chip">qwen2.5-3b · local</span>' +
						'<span class="cell-muted" style="font-size:11px">Nothing leaves this machine</span>' +
						ui.button('Send', { small: true, kind: 'primary', icon: 'arrow-right', action: 'send-chat' }) +
						'</div>' +
						'</div>'
				}) +
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
				'<div class="mt-24">' +
				ui.card({
					title: 'What It Can Do',
					icon: 'sparkle',
					cls: 'card--plain',
					desc: 'An action without a loaded model says so instead of failing halfway.',
					body: ui.table({
						plain: true,
						compact: true,
						columns: [
							{
								label: 'Action', render: function (row) {
									return '<span class="cell-strong">' + ui.esc(row.name) + '</span>' +
										'<div class="cell-muted" style="font-size:12px">' + ui.esc(row.desc) + '</div>';
								}
							},
							{ label: 'State', render: function (row) { return ui.badge(row.state, row.tone); } },
							{
								label: '', align: 'right', render: function (row) {
									return row.tone === 'ok'
										? ui.button('Run', { small: true, kind: 'primary', action: 'run-action' })
										: ui.button('Load Model', { small: true, action: 'load-model' });
								}
							}
						],
						rows: data.aiActions
					})
				}) +
				'</div>' +
				'<div class="mt-24 grid grid--2">' +
				ui.card({
					title: 'Where Output Goes',
					icon: 'arrow-right',
					cls: 'card--plain',
					desc: 'Nothing an action produces is a silent write.',
					body: ui.list([
						{ icon: 'document', title: 'Drafts', sub: '<span class="cell-muted">Review Center, as a diff</span>', meta: ui.badge('Diff', 'info') },
						{ icon: 'check', title: 'Answers', sub: '<span class="cell-muted">the AI bar, with citations</span>', meta: ui.badge('Chat', 'neutral') },
						{ icon: 'list', title: 'Suggestions', sub: '<span class="cell-muted">the Gaps list of an area</span>', meta: ui.badge('List', 'neutral') }
					])
				}) +
				ui.card({
					title: 'Guard Rails',
					icon: 'key',
					cls: 'card--plain',
					desc: 'Fixed on purpose. Changing one of these is a platform change, not a setting.',
					body: ui.list([
						{ icon: 'check', title: 'Never write a page without a draft', meta: ui.badge('Enforced', 'ok') },
						{ icon: 'check', title: 'Always cite the page or source used', meta: ui.badge('Enforced', 'ok') },
						{ icon: 'check', title: 'Refuse when the local model is not loaded', meta: ui.badge('Enforced', 'ok') },
						{ icon: 'check', title: 'Keep prompts and answers out of the repository', meta: ui.badge('Enforced', 'ok') }
					])
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
				'<div class="mt-24">' +
				ui.card({
					title: 'Cited So Far',
					icon: 'link',
					cls: 'card--plain',
					desc: 'A citation is kept with the answer that used it, so a reader can check the AI without leaving the page.',
					body: ui.table({
						plain: true,
						compact: true,
						columns: [
							{ label: 'Cited', render: function (row) { return '<span class="cell-strong">' + ui.esc(row.title) + '</span>'; } },
							{ label: 'Kind', render: function (row) { return ui.badge(row.kind, row.kind === 'page' ? 'accent' : 'neutral'); } },
							{ label: 'Where', render: function (row) { return '<span class="cell-mono cell-muted">' + ui.esc(row.where) + '</span>'; } },
							{ label: 'Used In', render: function (row) { return '<span class="cell-muted">' + ui.esc(row.usedIn) + '</span>'; } },
							{ label: '', align: 'right', render: function () { return ui.button('Open', { small: true, kind: 'ghost', action: 'open-citation' }); } }
						],
						rows: data.citations
					})
				}) +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['ai/models'] = {
		title: 'Local Models',
		render: function () {
			var models = data.aiModels;
			var loaded = models.filter(function (model) { return model.state === 'Loaded'; }).length;

			var body =
				ui.pageHead({
					title: 'Local Models',
					icon: 'chip',
					desc: 'Models run on this machine. Nothing is sent anywhere; a model is downloaded once and kept in the user\'s folder.',
					actions: ui.button('Download Model', { kind: 'primary', icon: 'download', action: 'download-model' })
				}) +
				'<div class="mt-24">' +
				ui.card({
					title: 'Models',
					icon: 'chip',
					cls: 'card--plain',
					actions: ui.button('Runtime Settings', { small: true, kind: 'ghost', icon: 'gear', open: 'settings/ai' }),
					desc: models.length + ' downloaded, ' + loaded + ' loaded. A chat model and an embedding model can be loaded at once; everything else waits.',
					body: ui.table({
						plain: true,
						compact: true,
						columns: [
							{
								label: 'Model', render: function (row) {
									return '<span class="cell-strong cell-mono">' + ui.esc(row.name) + '</span>' +
										'<div class="cell-muted" style="font-size:12px">' + ui.esc(row.kind) + '</div>';
								}
							},
							{ label: 'Context', align: 'right', render: function (row) { return '<span class="cell-mono">' + ui.esc(row.ctx) + '</span>'; } },
							{ label: 'Size', align: 'right', render: function (row) { return '<span class="cell-mono cell-muted">' + ui.esc(row.size) + '</span>'; } },
							{ label: 'State', render: function (row) { return ui.badge(row.state, row.tone); } },
							{
								label: '', align: 'right', render: function (row) {
									return row.tone === 'ok' ? ui.button('Unload', { small: true, kind: 'ghost', action: 'unload-model' }) : ui.button('Load', { small: true, action: 'load-model' });
								}
							}
						],
						rows: models
					})
				}) +
				'</div>' +
				'<div class="mt-24 grid grid--3">' +
				ui.card({ title: 'Runtime', icon: 'activity', cls: 'card--plain', desc: 'llama.cpp · CPU, 6 threads', body: '<div class="cell-muted" style="font-size:12px">12.4 tokens/s · 2.1 GB resident</div>' }) +
				ui.card({ title: 'Storage', icon: 'package', cls: 'card--plain', desc: 'Models live in ~/Temco/models, outside every repository.', body: ui.barRow(48, '2.4 GB', 'ok') }) +
				ui.card({ title: 'Privacy', icon: 'check', cls: 'card--plain', desc: 'No network calls once a model is loaded. Prompts stay in the platform database.', body: ui.badge('Offline', 'ok') }) +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['ai/knowledge'] = {
		title: 'Knowledge Base',
		render: function () {
			var pages = data.knowledge.reduce(function (total, area) { return total + area.pages; }, 0);

			var body =
				ui.pageHead({
					title: 'Knowledge Base',
					icon: 'book',
					desc: 'What the model was given, and when it was last rebuilt. The index follows the documentation; it is not a second copy of it.',
					actions: ui.button('Rebuild Index', { kind: 'primary', icon: 'refresh', action: 'rebuild-index' })
				}) +
				ui.tiles([
					{ value: pages.toLocaleString('en-US'), label: 'Chunks' },
					{ value: String(data.knowledge.length), label: 'Areas' },
					{ value: '768', label: 'Dimensions' },
					{ value: '3 hours', label: 'Index age' }
				]) +
				'<div class="mt-24 grid grid--2">' +
				ui.card({
					title: 'Sources in the Index',
					icon: 'book',
					cls: 'card--plain',
					desc: 'One chunk per heading, so an answer can point at a section and not just a page.',
					body: ui.list([
						{ icon: 'book', title: 'Documentation pages', sub: '<span class="cell-muted">' + pages.toLocaleString('en-US') + ' pages</span>', meta: ui.badge('Indexed', 'ok') },
						{ icon: 'repo', title: 't3000webview', sub: '<span class="cell-muted">412 files · code comments</span>', meta: ui.badge('Indexed', 'ok') },
						{ icon: 'repo', title: 'bacnet-stack', sub: '<span class="cell-muted">1,204 files</span>', meta: ui.badge('Indexed', 'ok') },
						{ icon: 'document', title: 'T3000 User Manual.docx', sub: '<span class="cell-muted">changed 4 days ago</span>', meta: ui.badge('Stale', 'warn') }
					])
				}) +
				ui.card({
					title: 'Retrieval',
					icon: 'search',
					cls: 'card--plain',
					actions: ui.button('Test Retrieval', { small: true, kind: 'ghost', action: 'test-retrieval' }),
					desc: 'How a question is turned into chunks. Reranking is off, so top-k is what you get.',
					body:
						'<dl class="kv">' +
						'<dt>Chunking</dt><dd>heading-aware · 800 tokens</dd>' +
						'<dt>Overlap</dt><dd class="cell-mono">120 tokens</dd>' +
						'<dt>Top k</dt><dd class="cell-mono">8</dd>' +
						'<dt>Rerank</dt><dd>off</dd>' +
						'<dt>Min score</dt><dd class="cell-mono">0.62</dd>' +
						'</dl>'
				}) +
				'</div>';
			return ui.view(body);
		}
	};

	/* ------------------------------------------------------------------ learn */

	M.views['learn/home'] = {
		title: 'Temco Learn',
		render: function () {
			var products = data.learnProducts;
			var pages = products.reduce(function (total, product) { return total + product.pages; }, 0);
			var live = data.releases.filter(function (release) { return release.state === 'Published'; })[0];
			var building = data.releases.filter(function (release) { return release.state === 'Publishing'; })[0];

			var cards = products.map(function (product) {
				return (
					'<button type="button" class="learn-card" data-open="learn/article">' +
					'<span class="learn-card__title">' + ui.esc(product.name) + '</span>' +
					'<span class="learn-card__desc">' + ui.esc(product.desc) + '</span>' +
					'<span class="row" style="gap:10px;font-size:11px;color:var(--fg-subtle)">' +
					'<span class="tag">v' + ui.esc(product.version) + '</span>' +
					'<span>' + product.pages.toLocaleString('en-US') + ' pages</span>' +
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
				'<div class="group-head">' +
				'<span class="group-head__label">Products</span>' +
				'<span class="group-head__rule"></span>' +
				'<span class="group-head__count">' + products.length + ' products · ' + pages.toLocaleString('en-US') + ' pages</span>' +
				'</div>' +
				'<p class="group-note">' +
				(live ? '<b>' + ui.esc(live.version) + '</b> is live' : '') +
				(building ? ', <b>' + ui.esc(building.version) + '</b> is still building' : '') +
				'. Every product is versioned and searchable, and the offline artifacts are on Downloads.' +
				'</p>' +
				'<div class="grid grid--4">' + cards + '</div>' +
				'<div class="mt-24 grid grid--2">' +
				ui.card({
					title: 'Learning Paths',
					icon: 'graduation',
					cls: 'card--plain',
					actions: ui.button('All Paths', { small: true, kind: 'ghost', open: 'learn/paths' }),
					desc: 'Ordered reading for a job rather than for a product.',
					body: ui.list(data.learnPaths.map(function (path) {
						return { icon: 'graduation', title: path.name, sub: '<span class="cell-muted">' + path.level + ' · ' + path.steps + ' steps · ' + path.minutes + ' min</span>', meta: ui.button('Start', { small: true, kind: 'ghost', action: 'start-path' }) };
					}))
				}) +
				ui.card({
					title: 'Downloads',
					icon: 'download',
					cls: 'card--plain',
					actions: ui.button('All', { small: true, kind: 'ghost', open: 'learn/downloads' }),
					desc: 'The offline artifacts of the versions that are published.',
					body: ui.list(data.downloads.slice(0, 3).map(function (item) {
						return {
							icon: item.format === 'PDF' ? 'document' : item.format === 'CHM' ? 'package' : 'download',
							title: item.name + ' ' + item.version,
							sub: '<span class="cell-muted">' + item.format + ' · ' + item.size + ' · ' + item.date + '</span>',
							meta: ui.badge(item.state, item.tone)
						};
					}))
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
			var areas = data.knowledge;
			var pages = areas.reduce(function (total, area) { return total + area.pages; }, 0);
			var live = data.releases.filter(function (release) { return release.state === 'Published'; })[0];
			var building = data.releases.filter(function (release) { return release.state === 'Publishing'; })[0];

			var body =
				'<div class="learn-hero">' +
				'<div class="learn-hero__inner">' +
				'<div class="eyebrow">Product documentation</div>' +
				'<h1 class="learn-hero__title">T3000</h1>' +
				'<p class="learn-hero__desc">The controller platform: hardware, points, programs, schedules and the web UI. ' + pages.toLocaleString('en-US') + ' pages across ' + areas.length + ' areas.</p>' +
				'<div class="row" style="margin-top:14px">' +
				(building ? ui.badge(building.version + ' · building', 'info') : '') +
				(live ? ui.badge(live.version + ' · live', 'ok') : '') +
				(live ? '<span class="cell-muted" style="font-size:12px">last published ' + ui.esc(live.date) + '</span>' : '') +
				'</div>' +
				'</div>' +
				'</div>' +
				'<div class="view__inner view__inner--wide">' +
				'<div style="margin-bottom:20px">' +
				ui.hero({
					tone: 'warn',
					eyebrow: 'Release state',
					title: '13.0 is building — readers still get 12.9',
					desc: 'The build center is compiling the offline help. Until it publishes, the site keeps serving the last complete version and the version selector stays on 12.9.',
					actions:
						ui.button('Open Build Center', { kind: 'primary', icon: 'play', open: 'docs/builds' }) +
						ui.button('Preview 13.0', { icon: 'document', open: 'learn/article' })
				}) +
				'</div>' +
				'<div class="group-head">' +
				'<span class="group-head__label">Areas</span>' +
				'<span class="group-head__rule"></span>' +
				'<span class="group-head__count">' + areas.length + ' areas · ' + pages.toLocaleString('en-US') + ' pages</span>' +
				'</div>' +
				'<p class="group-note">The site is organised the way the documentation is written, so a reader and an author see the same eight areas.</p>' +
				'<div class="grid grid--3">' +
				areas.map(function (area) {
					return (
						'<button type="button" class="learn-card" data-open="learn/article">' +
						'<span class="learn-card__title">' + ui.esc(area.area) + '</span>' +
						'<span class="learn-card__desc">' + ui.esc(area.desc || '') + '</span>' +
						'<span class="row" style="gap:8px;font-size:11px;color:var(--fg-subtle)"><span>' + area.pages + ' pages</span>' +
						(area.stale ? '<span>·</span><span>' + area.stale + ' behind their source</span>' : '') +
						'</span>' +
						'</button>'
					);
				}).join('') +
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
				'<span>Updated 3 hours ago · 14 min read · Owner: Derek</span>' +
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
				'<div style="margin:16px 0">' + ui.callout('<b>AI note.</b> This paragraph was rewritten by a draft that is still in review. The published 12.9 page still says every point is a float.', { icon: 'sparkle' }) + '</div>' +
				'<h2 id="errors">Errors</h2>' +
				'<p>A write to a read-only point returns <code>409</code>. A write while the device is offline returns <code>503</code> with the last known contact time.</p>' +
				'</div>';

			var body =
				'<div class="learn-reader">' +
				'<div class="learn-grid">' +
				'<div class="learn-nav">' +
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
				'<div class="stack learn-rail">' +
				'<div>' +
				'<div class="learn-nav__title">On this page</div>' +
				toc.map(function (item, index) {
					return '<button type="button" class="toc__item' + (index === 0 ? ' is-active' : '') + '" data-action="toc">' + ui.esc(item) + '</button>';
				}).join('') +
				'</div>' +
				'<div class="side-note">' +
				'<div class="learn-nav__title">This page</div>' +
				'<dl class="kv">' +
				'<dt>Owner</dt><dd>Derek</dd>' +
				'<dt>Reviewed</dt><dd>never</dd>' +
				'<dt>Source</dt><dd>t3000webview</dd>' +
				'<dt>Help id</dt><dd class="cell-mono">dp-api</dd>' +
				'</dl>' +
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
				'</div>' +
				'</div>';
			return '<div class="view">' + body + '</div>';
		}
	};

	M.views['learn/downloads'] = {
		title: 'Downloads',
		render: function () {
			var downloads = data.downloads;
			var groups = [];

			/* Grouped by product and version: the format is what differs between rows, so the row
			   stops repeating the product name five times. */
			downloads.forEach(function (item) {
				var key = item.name + ' · ' + item.version;
				var group = groups.filter(function (candidate) { return candidate.key === key; })[0];
				if (!group) {
					group = { key: key, name: item.name, version: item.version, date: item.date, items: [] };
					groups.push(group);
				}
				group.items.push(item);
			});

			var formatIcon = function (format) {
				return format === 'PDF' ? 'document' : format === 'CHM' ? 'package' : 'download';
			};

			var row = function (item) {
				var size = item.size === '—' ? 'size not known until the build finishes' : item.size;
				return (
					'<div class="record-row' + (item.state === 'Ready' ? '' : ' record-row--static') + '">' +
					ui.toneMark(formatIcon(item.format), item.state === 'Ready' ? '' : 'accent') +
					'<div class="record-row__main">' +
					'<div class="record-row__title">' +
					'<span class="record-row__name">' + ui.esc(item.format) + '</span>' +
					'</div>' +
					'<div class="record-row__meta"><span>' + ui.esc(size) + '</span></div>' +
					'</div>' +
					'<div class="record-row__state">' + ui.badge(item.state, item.tone) + '</div>' +
					(item.state === 'Ready'
						? ui.button('Download', { small: true, kind: 'primary', icon: 'download', action: 'download' })
						: '') +
					'</div>'
				);
			};

			var body =
				ui.pageHead({
					title: 'Downloads',
					icon: 'download',
					cls: 'card--plain',
					desc: 'The offline artifacts of each published version. A version stays downloadable after a newer one ships.',
					actions: ui.button('Build Missing', { icon: 'play', action: 'build-missing' })
				}) +
				groups.map(function (group) {
					/* The published date belongs to the group, not to each row, and only a group with a
					   build still running has anything extra worth saying. */
					var pending = group.items.filter(function (item) { return item.state !== 'Ready'; });
					return ui.group({
						label: group.name + ' · ' + group.version,
						plain: true,
						count: group.items.length + (group.items.length === 1 ? ' artifact' : ' artifacts') + ' · published ' + group.date,
						note: pending.length
							? 'The ' + pending.map(function (item) { return ui.esc(item.format); }).join(' and ') + ' build is still running — there is nothing to fetch for it yet.'
							: '',
						body: group.items.map(row).join('')
					});
				}).join('');
			return ui.view(body);
		}
	};

	M.views['learn/paths'] = {
		title: 'Learning Paths',
		render: function () {
			var paths = data.learnPaths;
			var steps = paths.reduce(function (total, path) { return total + path.steps; }, 0);
			var minutes = paths.reduce(function (total, path) { return total + path.minutes; }, 0);

			var body =
				ui.pageHead({
					title: 'Learning Paths',
					icon: 'graduation',
					desc: 'Ordered reading for a job, not for a product. Each step names the page and what it assumes you already know.',
					actions: ui.button('New Path', { icon: 'plus', action: 'new-path' })
				}) +
				'<div class="group-head">' +
				'<span class="group-head__label">Paths</span>' +
				'<span class="group-head__rule"></span>' +
				'<span class="group-head__count">' + paths.length + ' paths · ' + steps + ' steps · ' + Math.floor(minutes / 60) + ' h ' + (minutes % 60) + ' min of reading</span>' +
				'</div>' +
				'<p class="group-note">A path is a reading order, not a course: every step is an existing page with an owner and a review date, so a stale step shows up here as a stale page.</p>' +
				'<div class="grid grid--3">' +
				paths.map(function (path) {
					return ui.card({
						title: path.name,
						icon: 'graduation',
						desc: ui.esc(path.desc),
						body:
							'<div class="facts">' +
							'<span class="tag">' + ui.esc(path.level) + '</span>' +
							'<span>' + path.steps + ' steps · ' + path.minutes + ' min</span>' +
							'</div>' +
							'<ol class="path-steps">' +
							path.outline.map(function (step) { return '<li>' + ui.esc(step) + '</li>'; }).join('') +
							'<li class="cell-muted">and ' + (path.steps - path.outline.length) + ' more</li>' +
							'</ol>',
						foot: ui.button('Start', { small: true, kind: 'primary', action: 'start-path' }) + ui.button('Preview', { small: true, kind: 'ghost', action: 'preview-path' })
					});
				}).join('') +
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
					title: 'General',
					icon: 'gear',
					desc: 'Settings this profile owns. Only the rows marked <span class="tag">Workspace</span> — nothing else here follows a workspace.',
					actions: ui.button('Open JSON', { icon: 'code', action: 'open-settings-json' })
				}) +
				ui.rule({ label: 'Window', count: '3 settings', note: 'What the window looks like, and what it opens with.' }) +
				'<div class="settings-rows">' +
				ui.formRow('Theme', 'Colour roles only — a theme never changes the layout.', ui.segmented('Theme', ['System', 'Dark', 'Light'], 'System')) +
				ui.formRow('Startup view', 'The tab that opens when the window starts.', '<select class="select" aria-label="Startup view"><option>Needs Work</option><option>Dashboard</option><option>Last used</option><option>Empty editor</option></select>') +
				ui.formRow('Breadcrumbs', 'The path above the editor. Off by default: this window has no file system, so the bar can only repeat the side bar and the tab.', '<input type="checkbox" data-action="toggle-breadcrumbs" aria-label="Breadcrumbs"' + (window.TemcoMock.state && window.TemcoMock.state.breadcrumbs ? ' checked' : '') + '>') +
				'</div>' +
				ui.rule({ label: 'Files', count: '1 setting', note: 'One folder holds every repository, capture and build the platform writes.' }) +
				'<div class="settings-rows">' +
				ui.formRow('Working folder', 'Where repositories are cloned and captures are written.', '<input class="input" value="~/Temco" aria-label="Working folder">', { tag: 'Workspace' }) +
				'</div>' +
				ui.rule({ label: 'Diagnostics and Updates', count: '2 settings' }) +
				'<div class="settings-rows">' +
				ui.formRow('Telemetry', 'Documentation checks and build failures only. Never page content, never a prompt.', '<label class="check"><input type="checkbox" checked data-setting="Telemetry"><span>Send diagnostics</span></label>') +
				ui.formRow('Update channel', 'Preview adds release candidates one version earlier than Stable.', ui.segmented('Update channel', ['Stable', 'Preview'], 'Stable'), { tag: 'Restart' }) +
				'</div>' +
				ui.rule({ label: 'Where These Live', actions: ui.button('Restore Defaults', { small: true, kind: 'ghost', action: 'reset-settings' }) }) +
				'<div class="settings-strip">' +
				'<div><div class="settings-strip__label">File</div><div class="settings-strip__value cell-mono">~/.temco/settings.json</div></div>' +
				'<div><div class="settings-strip__label">Profile</div><div class="settings-strip__value">Default</div></div>' +
				'<div><div class="settings-strip__label">Can be overridden</div><div class="settings-strip__value">1 of these 5 settings</div></div>' +
				'<div><div class="settings-strip__label">Last changed</div><div class="settings-strip__value">2 days ago · Derek</div></div>' +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['settings/modules'] = {
		title: 'Modules',
		render: function () {
			var active = data.modules.filter(function (module) { return module.state === 'Active'; });
			var reserved = data.modules.filter(function (module) { return module.state === 'Reserved'; });

			/* Every module id is scoped under `temcocontrols.`, so the column shows the part that
			   differs. A whole id wraps mid-word at this width and reads as an error. */
			var table = function (rows) {
				return ui.table({
					plain: true,
					columns: [
						{
							label: 'Module', render: function (row) {
								return '<span class="cell-strong" style="white-space:nowrap">' + ui.esc(row.name) + '</span>' +
									'<div class="cell-muted cell-mono" style="font-size:11px;white-space:nowrap">' + ui.esc(row.id.replace('temcocontrols.', '')) + '</div>';
							}
						},
						{ label: 'Namespace', render: function (row) { return '<span class="cell-mono cell-muted">' + ui.esc(row.namespace) + '</span>'; } },
						{ label: 'What It Owns', render: function (row) { return ui.esc(row.owns); } },
						{
							label: '', align: 'right', render: function (row) {
								return row.surface
									? ui.button('Open', { small: true, kind: 'ghost', open: row.surface })
									: '<span class="cell-muted" style="white-space:nowrap">No surface</span>';
							}
						}
					],
					rows: rows
				});
			};

			var body =
				ui.pageHead({
					title: 'Modules',
					icon: 'package',
					desc: 'A module is a built-in extension: it ships with the platform and is never installed, removed or updated from the window.',
					actions: ui.button('Show on Disk', { icon: 'folder', action: 'open-modules-folder' })
				}) +
				ui.callout('<b>There is no marketplace.</b> The build refuses a <code>product.json</code> that configures an extension gallery, so this window loads the modules in <code>extensions/</code> and nothing else — there is nothing to install and nothing to update on its own.', { kind: 'warn' }) +
				ui.rule({ label: 'Active', count: active.length + ' modules', note: 'Ids all live under the <code>temcocontrols.</code> scope, so the table drops the prefix and shows the part that differs.' }) +
				'<div class="mt-16">' + table(active) + '</div>' +
				ui.rule({ label: 'Reserved', count: reserved.length + ' modules', note: 'A folder with a README and a surface drawn in this mock. The build ships nothing for them until each has a first real feature.' }) +
				'<div class="mt-16">' + table(reserved) + '</div>' +
				ui.rule({ label: 'Platform Updates', count: '1.143.0 · stable', note: 'A module updates with the platform, never on its own — there is no optional module to add or remove.', actions: ui.button('Check for Updates', { small: true, icon: 'refresh', action: 'check-updates' }) }) +
				'<div class="settings-strip">' +
				'<div><div class="settings-strip__label">Version</div><div class="settings-strip__value cell-mono">1.143.0</div></div>' +
				'<div><div class="settings-strip__label">Channel</div><div class="settings-strip__value">Stable</div></div>' +
				'<div><div class="settings-strip__label">Last checked</div><div class="settings-strip__value">2 hours ago</div></div>' +
				'<div><div class="settings-strip__label">Optional modules</div><div class="settings-strip__value">none</div></div>' +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['settings/branding'] = {
		title: 'Branding',
		render: function () {
			/* One drawing at the three sizes the shell actually draws it, so a wrong mark is visible
			   here rather than in a taskbar. */
			var mark = function (size) {
				return '<div style="display:grid;place-items:center;width:' + size + 'px;height:' + size + 'px;' +
					'border-radius:' + Math.round(size / 4.6) + 'px;background:#224E7A;color:#fff;' +
					'font-size:' + Math.round(size / 2.5) + 'px;font-weight:700">T</div>';
			};

			var roles = [
				{ colour: '#1f1f1f', name: 'background' },
				{ colour: '#0078d4', name: 'accent' },
				{ colour: '#3fb950', name: 'ok' },
				{ colour: '#d29922', name: 'warn' },
				{ colour: '#f85149', name: 'danger' }
			];

			var body =
				ui.pageHead({
					title: 'Branding',
					icon: 'palette',
					desc: 'The identity the shell draws: the mark, the wordmark and the accent. The mock previews them in place rather than in a specimen sheet.',
					actions: ui.button('Reset', { icon: 'refresh', action: 'reset-branding' })
				}) +
				ui.rule({ label: 'Application Mark', count: 'one drawing, three sizes', actions: ui.button('Replace', { small: true, kind: 'ghost', action: 'replace-icon' }), note: 'The window, the taskbar and the title bar draw the same file at 64, 32 and 16 pixels.' }) +
				'<div class="row" style="gap:18px;align-items:flex-end;margin-top:12px">' +
				mark(64) + mark(32) + mark(16) +
				'<span class="cell-mono cell-muted" style="margin-left:6px">resources/temco-icon.svg</span>' +
				'</div>' +
				ui.rule({ label: 'Theme', count: '2 themes shipped', note: 'A theme changes colour roles, never layout: every surface here is drawn from the five roles below.' }) +
				'<div class="settings-rows">' +
				ui.formRow('Shell theme', 'Dark ships by default; Light exists because a print shop and a projector are not dark rooms.', ui.button('Dark', { small: true, kind: 'primary', action: 'theme-dark' }) + ui.button('Light', { small: true, action: 'theme-light' })) +
				'</div>' +
				'<div class="row" style="gap:10px;align-items:center;margin-top:12px">' +
				roles.map(function (role) {
					return '<span style="display:inline-flex;align-items:center;gap:6px" class="cell-muted">' +
						'<span style="width:22px;height:22px;border-radius:5px;background:' + role.colour + '"></span>' +
						role.name +
						'</span>';
				}).join('') +
				'</div>' +
				ui.rule({ label: 'Identity', count: '3 settings' }) +
				'<div class="settings-rows">' +
				ui.formRow('Product name', 'Drawn in the title bar and the About window.', '<input class="input" value="Temco Platform" aria-label="Product name">') +
				ui.formRow('Accent colour', 'Used for focus, selection and the active container indicator.', '<input class="input" value="#0078d4" aria-label="Accent colour">') +
				ui.formRow('Welcome page', 'The walkthrough shown on a fresh profile.', '<select class="select" aria-label="Welcome page"><option>Temco Platform</option><option>None</option></select>') +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['settings/ai'] = {
		title: 'AI Models',
		render: function () {
			var pages = data.knowledge.reduce(function (total, area) { return total + area.pages; }, 0);

			var body =
				ui.pageHead({
					title: 'AI Models',
					icon: 'sparkle',
					desc: 'What this profile loads, how much it may read, and what it is allowed to touch. The AI Hub shows what is loaded right now; this page decides what loads next.',
					actions: ui.button('Open Models', { icon: 'chip', open: 'ai/models' })
				}) +
				ui.rule({ label: 'Answering', count: '3 settings', note: 'The model behind the AI panel and behind every Draft action.' }) +
				'<div class="settings-rows">' +
				ui.formRow('Chat model', 'Both run on this machine; nothing here calls a service.', '<select class="select" aria-label="Chat model"><option>qwen2.5-3b-instruct</option><option>phi-3-mini-4k</option><option>temco-docs-1.4b</option></select>') +
				ui.formRow('Context window', 'How much of a page, its area and the sources behind it the model may read at once.', ui.segmented('Context window', ['8k', '16k', '32k'], '32k')) +
				ui.formRow('Always cite', 'An answer without a citation is refused, not merely discouraged.', '<label class="check"><input type="checkbox" checked data-setting="Require citations"><span>Require citations</span></label>') +
				'</div>' +
				ui.rule({ label: 'Retrieval', count: '1 setting' }) +
				'<div class="settings-rows">' +
				ui.formRow('Embedding model', 'Builds and queries the knowledge index. Changing it re-indexes all ' + pages.toLocaleString('en-US') + ' pages.', '<select class="select" aria-label="Embedding model"><option>nomic-embed-text</option></select>') +
				'</div>' +
				ui.rule({ label: 'Drafts and Network', count: '2 settings' }) +
				'<div class="settings-rows">' +
				ui.formRow('Drafts', 'Where an AI change goes before it is written to a page. Nothing reaches a reader without passing Review Center.', '<select class="select" aria-label="Drafts"><option>Review Center</option><option>Review Center, auto-reject after 7 days</option></select>') +
				ui.formRow('Offline only', 'Refuse every action that would call a network service.', '<label class="check"><input type="checkbox" checked data-setting="Keep prompts on this machine"><span>Keep prompts on this machine</span></label>') +
				'</div>' +
				ui.rule({ label: 'Loaded Right Now' }) +
				'<div class="settings-strip">' +
				'<div><div class="settings-strip__label">Model</div><div class="settings-strip__value cell-mono">qwen2.5-3b-instruct</div></div>' +
				'<div><div class="settings-strip__label">Loaded</div><div class="settings-strip__value">since 09:12 · 2.1 GB</div></div>' +
				'<div><div class="settings-strip__label">Indexed</div><div class="settings-strip__value">' + pages.toLocaleString('en-US') + ' pages in 8 areas</div></div>' +
				'<div><div class="settings-strip__label">Network calls</div><div class="settings-strip__value">none — offline only is on</div></div>' +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['settings/publishing'] = {
		title: 'Publishing',
		render: function () {
			var artifacts = [
				{ name: 'Website', desc: 'The rendered site at the path below.', on: true },
				{ name: 'PDF', desc: 'One file per version, built from the same pages.', on: true },
				{ name: 'Offline help (CHM)', desc: 'The Windows help file readers open from the Start menu.', on: true },
				{ name: 'Search index', desc: 'The static index the site loads to answer a search.', on: true },
				{ name: 'AI index', desc: 'Local chunks for the AI panel. Never uploaded with the site.', on: false }
			];
			var chosen = artifacts.filter(function (artifact) { return artifact.on; }).length;

			var body =
				ui.pageHead({
					title: 'Publishing',
					icon: 'upload',
					desc: 'Where a release goes and what it is allowed to overwrite. Publishing never edits a page; it copies artifacts that Build Center already built.'
				}) +
				ui.rule({ label: 'Target', count: 'connected · last publish 12 Sep · 6.2 MB', actions: ui.button('Test Connection', { small: true, icon: 'globe', action: 'test-publish' }) }) +
				'<div class="settings-rows">' +
				ui.formRow('Site', 'The origin every published version is served from.', '<input class="input" value="https://learn.temcocontrols.com" aria-label="Site">') +
				ui.formRow('Path', 'Where under the site a version is written. The {version} token is replaced at publish time.', '<input class="input" value="/t3000/{version}/" aria-label="Path">') +
				ui.formRow('Channel', 'Preview publishes with noindex, so a search engine never sees a draft.', ui.segmented('Channel', ['Stable', 'Preview'], 'Stable')) +
				'</div>' +
				ui.rule({ label: 'Artifacts', count: chosen + ' of ' + artifacts.length + ' published', note: 'Each of these is built by Build Center; publishing copies what is already there.' }) +
				'<div class="settings-rows">' +
				artifacts.map(function (artifact) {
					return ui.formRow(artifact.name, artifact.desc, '<input type="checkbox"' + (artifact.on ? ' checked' : '') + ' data-setting="' + ui.esc(artifact.name) + '" aria-label="' + ui.esc(artifact.name) + '">');
				}).join('') +
				'</div>' +
				'<div class="mt-16">' +
				ui.callout('A published version is frozen. To change a page a reader can reach, publish a new version — an edit does not reach the site until it does.', { kind: 'warn' }) +
				'</div>';
			return ui.view(body);
		}
	};
})(window.TemcoMock = window.TemcoMock || { views: {} });
