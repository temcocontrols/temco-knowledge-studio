/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Temco Controls. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*
 * The window's behaviour: which module is forward, which tabs are open, the panel, the palette,
 * the menus and the AI bar. Views are pure HTML; everything interactive arrives through the
 * `data-*` attributes and is handled here in one place.
 */

(function (M) {
	'use strict';

	var ui = M.ui;
	var data = M.data;

	var STORAGE_KEY = 'temco.mock.window.v1';
	var theme = 'dark';
	var moduleId = 'dashboard';
	var activeView = 'dashboard/overview';
	var tabs = [];
	var sidebarVisible = true;
	var auxVisible = true;
	var panelVisible = true;
	/* The breadcrumb row is off by default. This window has no file system, so the bar could only
	   repeat the side bar's module and the tab's page — and in VS Code it is a setting, not a
	   fixture. View › Toggle Breadcrumbs brings it back. */
	var breadcrumbsVisible = false;
	var panelTab = 'problems';
	var chat = [];
	var chatBusy = false;
	var paletteMode = null;
	var paletteIndex = 0;
	var paletteItems = [];

	var el = {};

	function storageGet() {
		try {
			return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
		} catch (error) {
			return null;
		}
	}

	function storageSet(value) {
		try {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
		} catch (error) {
			/* a file:// origin may refuse storage; the mock still works */
		}
	}

	function persist() {
		storageSet({ theme: theme, moduleId: moduleId, activeView: activeView, tabs: tabs, sidebarVisible: sidebarVisible, auxVisible: auxVisible, panelVisible: panelVisible, breadcrumbsVisible: breadcrumbsVisible, panelTab: panelTab });
	}

	function viewOf(viewId) {
		return M.viewIndex[viewId];
	}

	function moduleOf(id) {
		for (var index = 0; index < M.modules.length; index++) {
			if (M.modules[index].id === id) {
				return M.modules[index];
			}
		}
		return null;
	}

	/* ------------------------------------------------------------------ activity bar */

	function moduleBadge(module) {
		var total = 0;
		module.sections.forEach(function (section) {
			section.views.forEach(function (view) {
				if (view.badge && view.tone === 'warn') {
					total += view.badge;
				}
			});
		});
		return total;
	}

	function renderActivityBar() {
		var html = '';
		M.modules.forEach(function (module) {
			if (module.bottom) {
				return;
			}
			var badge = moduleBadge(module);
			html +=
				'<button type="button" class="activitybar__item" data-module="' + module.id + '" aria-selected="' + (module.id === moduleId) + '" title="' + ui.esc(module.label) + '" aria-label="' + ui.esc(module.label) + '">' +
				ui.icon(module.icon, 'icon--lg') +
				(badge ? '<span class="activitybar__badge">' + badge + '</span>' : '') +
				'</button>';
		});

		html += '<div class="activitybar__spacer"></div>';

		M.modules.forEach(function (module) {
			if (!module.bottom) {
				return;
			}
			html +=
				'<button type="button" class="activitybar__item" data-module="' + module.id + '" aria-selected="' + (module.id === moduleId) + '" title="' + ui.esc(module.label) + '" aria-label="' + ui.esc(module.label) + '">' +
				ui.icon(module.icon, 'icon--lg') +
				'</button>';
		});

		html +=
			'<button type="button" class="activitybar__item" data-action="account" title="Accounts" aria-label="Accounts">' +
			ui.icon('account', 'icon--lg') +
			'</button>';

		el.activitybar.innerHTML = html;
	}

	/* ------------------------------------------------------------------ side bar */

	function renderSidebar() {
		var module = moduleOf(moduleId);
		if (!module) {
			return;
		}
		el.sidebarTitle.textContent = module.label;
		var html = '';
		module.sections.forEach(function (section) {
			/* A heading above the only group of items names nothing the title did not. */
			if (module.sections.length > 1) {
				html += '<div class="tree__section">' + ui.esc(section.label) + '</div>';
			}
			section.views.forEach(function (view) {
				html +=
					'<button type="button" class="tree__item' + (view.id === activeView ? ' is-active' : '') + '" data-open="' + view.id + '">' +
					ui.icon(view.icon) +
					'<span class="tree__label">' + ui.esc(view.label) + '</span>' +
					(view.badge ? '<span class="tree__count' + (view.tone === 'warn' ? ' tree__count--warn' : '') + '">' + view.badge + '</span>' : '') +
					'</button>';
			});
		});
		el.sidebarBody.innerHTML = html;
	}

	/* ------------------------------------------------------------------ tabs */

	function renderTabs() {
		el.tabs.innerHTML = tabs.map(function (id) {
			var view = viewOf(id);
			var label = view ? view.label : id;
			return (
				'<button type="button" class="tab' + (id === activeView ? ' is-active' : '') + '" data-tab="' + id + '" title="' + ui.esc(label) + '">' +
				ui.icon((view && view.icon) || 'document') +
				'<span class="tab__label">' + ui.esc(label) + '</span>' +
				'<span class="tab__close" role="button" aria-label="Close ' + ui.esc(label) + '" data-close-tab="' + id + '">' + ui.icon('close', 'icon--sm') + '</span>' +
				'</button>'
			);
		}).join('');

		/* With more tabs than fit, the one you just opened has to be the one you can see. */
		var active = el.tabs.querySelector('.tab.is-active');
		if (active) {
			var left = active.offsetLeft;
			var right = left + active.offsetWidth;
			if (left < el.tabs.scrollLeft) {
				el.tabs.scrollLeft = left;
			} else if (right > el.tabs.scrollLeft + el.tabs.clientWidth) {
				el.tabs.scrollLeft = right - el.tabs.clientWidth;
			}
		}
	}

	function renderBreadcrumbs() {
		el.breadcrumbs.hidden = !breadcrumbsVisible;
		var view = viewOf(activeView);
		if (!view || !breadcrumbsVisible) {
			el.breadcrumbs.innerHTML = '';
			return;
		}
		/* The bar names the path, not the whole chrome. The side bar already shows the module and
		   its groups, so a module with a single section contributes one level rather than two:
		   "Settings › Temco Platform › Modules" named Settings twice and pointed at a group with no
		   sibling to distinguish it from. A level is also a place you can go back to, so every
		   segment above the page is a button. */
		var parts = [crumb(view.moduleLabel, view.moduleDefaultView)];
		if (!view.singleSection && view.sectionLabel && view.sectionLabel !== view.moduleLabel && view.sectionLabel !== view.label) {
			parts.push(ui.icon('chevron-right', 'icon--sm'));
			parts.push(crumb(view.sectionLabel, view.sectionFirstView));
		}
		parts.push(ui.icon('chevron-right', 'icon--sm'));
		parts.push('<span class="breadcrumbs__item is-current">' + ui.esc(view.label) + '</span>');
		el.breadcrumbs.innerHTML = parts.join('');
	}

	function crumb(label, viewId) {
		if (!viewId || viewId === activeView) {
			return '<span class="breadcrumbs__item">' + ui.esc(label) + '</span>';
		}
		return '<button type="button" class="breadcrumbs__item breadcrumbs__item--link" data-open="' + ui.esc(viewId) + '">' + ui.esc(label) + '</button>';
	}

	/* ------------------------------------------------------------------ editor */

	function renderEditor() {
		var view = viewOf(activeView);
		if (!view) {
			el.editor.innerHTML =
				'<div class="watermark">' +
				'<div class="watermark__title">Temco Platform</div>' +
				'<div class="watermark__keys">' +
				'<span>Show Command Palette</span><span><kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>P</kbd></span>' +
				'<span>Quick Open</span><span><kbd>Ctrl</kbd> <kbd>P</kbd></span>' +
				'<span>Toggle AI Bar</span><span><kbd>Ctrl</kbd> <kbd>Alt</kbd> <kbd>B</kbd></span>' +
				'</div></div>';
			return;
		}
		var module = M.views[activeView];
		if (!module) {
			el.editor.innerHTML = '<div class="view"><div class="view__inner">' + ui.empty('This surface is not in the mock yet', 'The module owns it; the layout asks the question, not the content.') + '</div></div>';
			return;
		}
		el.editor.innerHTML = module.render();
		el.editor.scrollTop = 0;
		if (module.onMount) {
			module.onMount(el.editor);
		}
		document.title = view.label + ' — Temco Platform';
	}

	function renderChatContext() {
		var view = viewOf(activeView);
		el.chatContext.textContent = view ? view.label : 'No page';
	}

	function renderAll() {
		renderActivityBar();
		renderSidebar();
		renderTabs();
		renderBreadcrumbs();
		renderEditor();
		renderChatContext();
		persist();
	}

	/* ------------------------------------------------------------------ navigation */

	function openView(viewId, options) {
		options = options || {};
		var view = viewOf(viewId);
		if (!view) {
			toast('There is no surface called ' + viewId + '.');
			return;
		}
		if (tabs.indexOf(viewId) < 0) {
			tabs.push(viewId);
		}
		activeView = viewId;
		moduleId = view.moduleId;

		/* A tab bar that grows without bound stops being a tab bar. The oldest surface that is not
		   the one you just opened makes room. */
		if (tabs.length > 12) {
			for (var index = 0; index < tabs.length; index++) {
				if (tabs[index] !== activeView) {
					tabs.splice(index, 1);
					break;
				}
			}
		}

		if (!options.keepFocus) {
			el.editor.focus && el.editor.focus();
		}
		if (window.location.hash !== '#/' + viewId) {
			window.location.hash = '#/' + viewId;
		}
		renderAll();
		if (options.reveal && !sidebarVisible) {
			toggleSidebar(true);
		}
	}

	function openModule(id) {
		var module = moduleOf(id);
		if (!module) {
			return;
		}
		for (var index = tabs.length - 1; index >= 0; index--) {
			var view = viewOf(tabs[index]);
			if (view && view.moduleId === id) {
				openView(tabs[index]);
				return;
			}
		}
		openView(module.defaultView);
	}

	function closeTab(viewId) {
		var index = tabs.indexOf(viewId);
		if (index < 0) {
			return;
		}
		tabs.splice(index, 1);
		if (activeView === viewId) {
			if (tabs.length) {
				openView(tabs[Math.min(index, tabs.length - 1)]);
				return;
			}
			activeView = null;
			renderAll();
			return;
		}
		renderAll();
	}

	/* Remove a tab without changing what is in front — a finished flow hands over to its result. */
	function dropTab(viewId) {
		var index = tabs.indexOf(viewId);
		if (index >= 0) {
			tabs.splice(index, 1);
		}
	}

	/* ------------------------------------------------------------------ panel */

	function renderPanel() {
		var html = '';
		if (panelTab === 'problems') {
			html = data.problems.map(function (problem) {
				return (
					'<div class="panel__row">' +
					ui.icon(problem.severity === 'err' ? 'error' : 'warning') +
					'<span class="cell-strong">' + ui.esc(problem.where) + '</span>' +
					'<span class="panel__where">' + ui.esc(problem.message) + '</span>' +
					'</div>'
				);
			}).join('');
		} else if (panelTab === 'output') {
			html = '<div class="panel__terminal">' + ui.esc(data.output.join('\n')) + '</div>';
		} else if (panelTab === 'terminal') {
			html =
				'<div class="panel__terminal">' +
				ui.esc('Temco Platform · pwsh 7.4\n') +
				'<span style="color:var(--ok)">PS C:\\QN\\temcocontrols\\temco-platform&gt;</span> npm run check-temco\n' +
				ui.esc('7 modules, no dependency loops, every menu id declared.\n') +
				'<span style="color:var(--ok)">PS C:\\QN\\temcocontrols\\temco-platform&gt;</span> <span class="panel__muted">▌</span>' +
				'</div>';
		} else {
			html =
				'<div class="panel__row">' + ui.icon('globe') + '<span class="cell-mono">8080</span><span class="panel__where">docfx preview · authoring only</span></div>' +
				'<div class="panel__row">' + ui.icon('globe') + '<span class="cell-mono">47808</span><span class="panel__where">BACnet/IP · listening</span></div>' +
				'<div class="panel__row">' + ui.icon('globe') + '<span class="cell-mono">502</span><span class="panel__where">Modbus TCP · gateway</span></div>';
		}
		el.panelBody.innerHTML = html;

		Array.prototype.forEach.call(el.panelTabs, function (button) {
			button.classList.toggle('is-active', button.getAttribute('data-panel') === panelTab);
		});
	}

	function showPanel(tab) {
		if (tab) {
			panelTab = tab;
		}
		panelVisible = true;
		el.panel.classList.remove('is-hidden');
		renderPanel();
		persist();
	}

	/* ------------------------------------------------------------------ chat */

	function pushChat(who, text, citations, isUser) {
		chat.push({ who: who, text: text, citations: citations || [], isUser: !!isUser });
		renderChat();
	}

	function renderChat() {
		el.chat.innerHTML = chat.map(function (message) {
			return (
				'<div class="chat__message' + (message.isUser ? ' chat__message--user' : '') + '">' +
				'<div class="chat__who">' + ui.icon(message.isUser ? 'account' : 'sparkle', 'icon--sm') + ui.esc(message.who) + '</div>' +
				'<div class="chat__bubble"><p>' + ui.esc(message.text) + '</p>' +
				(message.citations.length
					? '<div class="chat__cites">' + message.citations.map(function (cite) {
						return '<button type="button" class="chat__cite" data-action="open-citation">' + ui.esc(cite) + '</button>';
					}).join('') + '</div>'
					: '') +
				'</div></div>'
			);
		}).join('');
		el.chat.scrollTop = el.chat.scrollHeight;
	}

	function answer(prompt) {
		var text = prompt.toLowerCase();
		if (text.indexOf('build') >= 0 || text.indexOf('site') >= 0) {
			return { text: 'The website and the PDF are built; the help compiler is at 612 of 1,254 topics. Two structural errors in API Reference block the publish, both in the Problems panel.', citations: ['docs/builds', 'api-reference/data-points.md'] };
		}
		if (text.indexOf('device') >= 0 || text.indexOf('firmware') >= 0) {
			return { text: '31 of 34 controllers answer. T3-22I · Lab Wing has been silent for two hours and runs 2.12.1, three releases behind; 6 other devices can take 2.14.3 without leaving this window.', citations: ['devices/all', 'firmware 2.14.3'] };
		}
		if (text.indexOf('review') >= 0 || text.indexOf('draft') >= 0 || text.indexOf('page') >= 0) {
			return { text: 'Three drafts are waiting, all in API Reference. The Data Points API draft rewrites the scaling paragraph; nothing is written until you accept the diff in Review Center.', citations: ['docs/review', 'api-reference/data-points.md'] };
		}
		return { text: 'I can read the page you have open, its area and the sources it came from. Ask for a draft, a gap list, or a summary — every answer names what it used.', citations: ['Current page'] };
	}

	function sendChat(text) {
		if (!text || chatBusy) {
			return;
		}
		pushChat(data.user.name, text, [], true);
		chatBusy = true;
		window.setTimeout(function () {
			var reply = answer(text);
			pushChat('Temco AI', reply.text, reply.citations, false);
			chatBusy = false;
			if (!auxVisible) {
				setAux(true);
			}
		}, 420);
	}

	function setAux(visible) {
		auxVisible = visible;
		el.auxbar.classList.toggle('is-hidden', !visible);
		persist();
	}

	/* ------------------------------------------------------------------ toasts */

	function toast(message) {
		var node = document.createElement('div');
		node.className = 'toast';
		node.innerHTML = ui.icon('check') + '<div class="toast__text">' + ui.esc(message) + '</div>';
		el.toasts.appendChild(node);
		window.setTimeout(function () {
			node.remove();
		}, 3400);
	}

	/* ------------------------------------------------------------------ palette */

	function commandList() {
		return [
			{ label: 'View: Toggle Primary Side Bar', keys: 'Ctrl+B', run: function () { toggleSidebar(); } },
			{ label: 'View: Toggle Panel', keys: 'Ctrl+J', run: function () { togglePanel(); } },
			{ label: 'View: Toggle AI Bar', keys: 'Ctrl+Alt+B', run: function () { toggleAux(); } },
			{ label: 'View: Toggle Breadcrumbs', run: function () { toggleBreadcrumbs(); } },
			{ label: 'Preferences: Color Theme', run: function () { toggleTheme(); } },
			{ label: 'Temco: New Documentation Project', run: function () { toast('A project needs a name, a version and an owner. The form is not part of this mock.'); } },
			{ label: 'Temco: Read All Sources', run: function () { showPanel('output'); toast('Reading ' + M.data.sources.length + ' sources…'); } },
			{ label: 'Temco: Build Everything', run: function () { showPanel('output'); toast('Build queued: website, PDF, help file, indexes.'); } },
			{ label: 'Temco: Publish Release 13.0', run: function () { showPanel('problems'); toast('Two errors must be fixed before 13.0 can publish.'); } },
			{ label: 'Temco: Open Review Center', run: function () { openView('docs/review'); } },
			{ label: 'Developer: Reload Window', run: function () { window.location.reload(); } }
		];
	}

	function openPalette(mode) {
		paletteMode = mode;
		paletteIndex = 0;
		el.palette.hidden = false;
		el.paletteInput.value = mode === 'views' ? '' : '';
		el.paletteInput.placeholder = mode === 'views' ? 'Go to surface' : 'Type a command';
		filterPalette('');
		el.paletteInput.focus();
	}

	function closePalette() {
		el.palette.hidden = true;
		paletteMode = null;
	}

	function filterPalette(query) {
		var needle = query.trim().toLowerCase();
		if (paletteMode === 'views') {
			paletteItems = Object.keys(M.viewIndex).map(function (id) {
				var view = M.viewIndex[id];
				return { label: view.label, where: view.moduleLabel, run: function () { openView(id); } };
			}).filter(function (item) {
				return !needle || (item.label + ' ' + item.where).toLowerCase().indexOf(needle) >= 0;
			});
		} else {
			paletteItems = commandList().filter(function (item) {
				return !needle || item.label.toLowerCase().indexOf(needle) >= 0;
			});
		}
		if (paletteIndex >= paletteItems.length) {
			paletteIndex = 0;
		}
		el.paletteList.innerHTML = paletteItems.length
			? paletteItems.map(function (item, index) {
				return (
					'<button type="button" class="quickinput__item' + (index === paletteIndex ? ' is-active' : '') + '" data-palette-index="' + index + '">' +
					ui.icon(paletteMode === 'views' ? 'document' : 'chevron-right') +
					'<span class="quickinput__text">' + ui.esc(item.label) + '</span>' +
					(item.keys ? '<span class="quickinput__where">' + ui.esc(item.keys) + '</span>' : '') +
					(item.where ? '<span class="quickinput__where">' + ui.esc(item.where) + '</span>' : '') +
					'</button>'
				);
			}).join('')
			: '<div class="quickinput__empty">No matching result.</div>';
	}

	function runPaletteItem(index) {
		var item = paletteItems[index];
		if (!item) {
			return;
		}
		closePalette();
		item.run();
	}

	/* ------------------------------------------------------------------ menus */

	/*
	 * Menus are verbs, not features. A module contributes items into these shared titles; it never
	 * gets a menu of its own, or the bar becomes the activity bar. `Tools` is the one title that
	 * groups by module — a submenu once a module has three or more actions, otherwise a flat item
	 * carrying the module's word (`I/O Studio: Auto-Map Points`).
	 */
	var menus = {
		File: [
			{ label: 'New Project…', action: 'new-project' },
			{ label: 'Open Workspace…', action: 'open-workspace' },
			{ label: 'Add Source…', action: 'add-source' },
			{ separator: true },
			{ label: 'Save All', keys: 'Ctrl+K S', action: 'save-all' },
			{ separator: true },
			{ label: 'Close Tab', keys: 'Ctrl+W', run: function () { if (activeView) { closeTab(activeView); } } },
			{ label: 'Close Window', run: function () { toast('The window stays open in the mock.'); } }
		],
		Edit: [
			{ label: 'Undo', keys: 'Ctrl+Z', action: 'undo' },
			{ label: 'Redo', keys: 'Ctrl+Y', action: 'redo' },
			{ separator: true },
			{ label: 'Find', keys: 'Ctrl+F', action: 'find' },
			{ label: 'Replace', keys: 'Ctrl+H', action: 'replace' },
			{ separator: true },
			{ label: 'Copy Path', action: 'copy-path' }
		],
		View: [
			{ label: 'Command Palette…', keys: 'Ctrl+Shift+P', run: function () { openPalette('commands'); } },
			{ label: 'Quick Open…', keys: 'Ctrl+P', run: function () { openPalette('views'); } },
			{ separator: true },
			{ label: 'Toggle Primary Side Bar', keys: 'Ctrl+B', run: function () { toggleSidebar(); } },
			{ label: 'Toggle Panel', keys: 'Ctrl+J', run: function () { togglePanel(); } },
			{ label: 'Toggle AI Bar', keys: 'Ctrl+Alt+B', run: function () { toggleAux(); } },
			{ label: 'Toggle Breadcrumbs', run: function () { toggleBreadcrumbs(); } },
			{ separator: true },
			{ label: 'Problems', run: function () { showPanel('problems'); } },
			{ label: 'Output', run: function () { showPanel('output'); } },
			{ label: 'Terminal', run: function () { showPanel('terminal'); } },
			{ label: 'Ports', run: function () { showPanel('ports'); } },
			{ separator: true },
			{ label: 'Color Theme', run: function () { toggleTheme(); } }
		],
		Go: [
			{ label: 'Dashboard', run: function () { openModule('dashboard'); } },
			{ label: 'Workspaces', run: function () { openModule('workspaces'); } },
			{ label: 'Documentation', run: function () { openModule('docs'); } },
			{ label: 'AI Hub', run: function () { openModule('ai'); } },
			{ label: 'Temco Learn', run: function () { openModule('learn'); } },
			{ separator: true },
			{ label: 'Devices', run: function () { openModule('devices'); } },
			{ label: 'I/O Studio', run: function () { openModule('io'); } },
			{ label: 'BACnet Studio', run: function () { openModule('bacnet'); } },
			{ label: 'Network', run: function () { openModule('network'); } },
			{ label: 'SQL Studio', run: function () { openModule('sql'); } },
			{ separator: true },
			{ label: 'Go to Surface…', keys: 'Ctrl+P', run: function () { openPalette('views'); } },
			{ label: 'Settings', run: function () { openModule('settings'); } }
		],
		Run: [
			{ label: 'Build Documentation', action: 'build-site' },
			{ label: 'Build Offline Help', action: 'build-help' },
			{ separator: true },
			{ label: 'Run Query', action: 'run-query' },
			{ separator: true },
			{ label: 'Discover Devices', action: 'discover-devices' },
			{ label: 'Start Capture', action: 'new-capture' },
			{ separator: true },
			{ label: 'Stop Running Task', action: 'build-cancel', disabled: true, hint: 'Nothing running' }
		],
		Tools: [
			{
				label: 'Documentation', children: [
					{ label: 'Read All Sources', action: 'read-all' },
					{ label: 'Validate Structure', action: 'validate-docs' },
					{ label: 'Build Website', action: 'build-site' },
					{ label: 'Build Offline Help', action: 'build-help' },
					{ label: 'Publish Release…', action: 'publish-release' }
				]
			},
			{
				label: 'Devices', children: [
					{ label: 'Discover Devices', action: 'discover-devices' },
					{ label: 'Stage Firmware…', action: 'stage-firmware' },
					{ label: 'Back Up All', action: 'backup-all' }
				]
			},
			{ label: 'I/O Studio: Auto-Map Points', action: 'auto-map' },
			{ label: 'Network: Scan Segment', action: 'net-scan' },
			{
				label: 'AI', children: [
					{ label: 'Load Model…', action: 'load-model' },
					{ label: 'Rebuild Index', action: 'rebuild-index' },
					{ label: 'Open Actions', run: function () { openView('ai/actions'); } }
				]
			},
			{ separator: true },
			{ label: 'Developer: Open Settings JSON', action: 'open-settings-json' }
		],
		Help: [
			{ label: 'Documentation', action: 'help-docs' },
			{ label: 'Keyboard Shortcuts', action: 'help-keys' },
			{ separator: true },
			{ label: 'Show Logs', action: 'show-logs' },
			{ label: 'Report an Issue', action: 'report-issue' },
			{ separator: true },
			{ label: 'About Temco Platform', action: 'about' }
		]
	};

	function buildMenu(items) {
		var menu = document.createElement('div');
		menu.className = 'menu';
		menu.__items = items;
		menu.innerHTML = items.map(function (item, index) {
			if (item.separator) {
				return '<div class="menu__separator"></div>';
			}
			var cls = 'menu__item' + (item.disabled ? ' menu__item--disabled' : '');
			var trailing = '';
			if (item.children) {
				trailing = ui.icon('chevron-right', 'icon--sm');
			} else if (item.disabled && item.hint) {
				trailing = '<span class="menu__hint">' + ui.esc(item.hint) + '</span>';
			} else if (item.keys) {
				trailing = '<span class="menu__keys">' + ui.esc(item.keys) + '</span>';
			}
			return (
				'<button type="button" class="' + cls + '" data-menu-index="' + index + '"' + (item.disabled ? ' aria-disabled="true"' : '') + '>' +
				'<span class="menu__label">' + ui.esc(item.label) + '</span>' +
				trailing +
				'</button>'
			);
		}).join('');
		return menu;
	}

	function openMenu(name, anchor) {
		closeMenu();
		var items = menus[name];
		if (!items) {
			return;
		}
		var menu = buildMenu(items);
		menu.setAttribute('data-menu-name', name);
		document.body.appendChild(menu);
		var rect = anchor.getBoundingClientRect();
		menu.style.left = rect.left + 'px';
		menu.style.top = rect.bottom + 2 + 'px';
		var menuRect = menu.getBoundingClientRect();
		if (menuRect.right > window.innerWidth - 4) {
			menu.style.left = Math.max(4, window.innerWidth - menuRect.width - 4) + 'px';
		}
		anchor.setAttribute('aria-expanded', 'true');
		el.openMenus = [menu];
		el.menuOpenedAt = Date.now();
	}

	function openSubmenu(parentMenu, itemEl, items, index) {
		if (parentMenu.__openFor === index) {
			return;
		}
		parentMenu.__openFor = index;
		var depth = el.openMenus.indexOf(parentMenu);
		el.openMenus.slice(depth + 1).forEach(function (node) { node.remove(); });
		el.openMenus = el.openMenus.slice(0, depth + 1);

		var sub = buildMenu(items);
		document.body.appendChild(sub);
		var itemRect = itemEl.getBoundingClientRect();
		var parentRect = parentMenu.getBoundingClientRect();
		sub.style.left = itemRect.right - 2 + 'px';
		sub.style.top = itemRect.top - 4 + 'px';
		var subRect = sub.getBoundingClientRect();
		if (subRect.right > window.innerWidth - 4) {
			sub.style.left = Math.max(4, parentRect.left - subRect.width + 2) + 'px';
		}
		if (subRect.bottom > window.innerHeight - 4) {
			sub.style.top = Math.max(4, window.innerHeight - subRect.height - 4) + 'px';
		}
		el.openMenus.push(sub);
	}

	function closeMenu() {
		(el.openMenus || []).forEach(function (menu) { menu.remove(); });
		el.openMenus = [];
		Array.prototype.forEach.call(document.querySelectorAll('.menubar__button'), function (button) {
			button.setAttribute('aria-expanded', 'false');
		});
	}

	/* ------------------------------------------------------------------ toggles */

	function toggleSidebar(force) {
		sidebarVisible = force === undefined ? !sidebarVisible : force;
		el.sidebar.classList.toggle('is-hidden', !sidebarVisible);
		persist();
	}

	function togglePanel(force) {
		panelVisible = force === undefined ? !panelVisible : force;
		el.panel.classList.toggle('is-hidden', !panelVisible);
		persist();
	}

	function toggleAux() {
		setAux(!auxVisible);
	}

	function toggleBreadcrumbs() {
		breadcrumbsVisible = !breadcrumbsVisible;
		M.state = M.state || {};
		M.state.breadcrumbs = breadcrumbsVisible;
		renderBreadcrumbs();
		persist();
		toast(breadcrumbsVisible ? 'Breadcrumbs on. The bar names the path above the editor.' : 'Breadcrumbs off — the side bar and the tab already name where you are.');
	}

	function toggleTheme() {
		setTheme(theme === 'dark' ? 'light' : 'dark');
	}

	function setTheme(value) {
		theme = value === 'light' ? 'light' : 'dark';
		document.documentElement.setAttribute('data-theme', theme);
		persist();
	}

	/* ------------------------------------------------------------------ actions */

	function handleAction(name, target) {
		switch (name) {
			case 'open-command-palette':
				openPalette('commands');
				return;
			case 'toggle-sidebar':
				toggleSidebar();
				return;
			case 'toggle-panel':
				togglePanel();
				return;
			case 'toggle-aux':
				toggleAux();
				return;
			case 'toggle-breadcrumbs':
				toggleBreadcrumbs();
				return;
			case 'theme':
				toggleTheme();
				return;
			case 'theme-dark':
				setTheme('dark');
				toast('Dark theme applied.');
				return;
			case 'theme-light':
				setTheme('light');
				toast('Light theme applied.');
				return;
			case 'panel-problems':
				showPanel('problems');
				return;
			case 'panel-output':
				showPanel('output');
				return;
			case 'panel-terminal':
				showPanel('terminal');
				return;
			case 'panel-ports':
				showPanel('ports');
				return;
			case 'new-project':
				openView('flow/new-project');
				return;
			case 'add-source':
				openView('flow/add-source');
				return;
			case 'publish-release':
				openView('flow/publish');
				return;
			case 'stage-firmware':
				openView('flow/stage-firmware');
				return;
			case 'new-page':
				openView('flow/new-page');
				return;
			case 'new-workspace':
				openView('flow/new-workspace');
				return;
			case 'open-workspace':
				openView('flow/open-workspace');
				return;
			/* An in-page selection, not a new surface: the Knowledge page keeps which area is open, and
			   the reader keeps their place instead of being thrown back to the top of the page. */
			case 'open-area': {
				M.state = M.state || {};
				M.state.area = target.getAttribute('data-area');
				var readingAt = el.editor.scrollTop;
				renderAll();
				el.editor.scrollTop = readingAt;
				return;
			}
			case 'flow-next':
				M.flow.next(activeView, el.editor);
				renderAll();
				return;
			case 'flow-back':
				M.flow.back(activeView, el.editor);
				renderAll();
				return;
			case 'flow-step':
				M.flow.step(activeView, Number(target.getAttribute('data-step')), el.editor);
				renderAll();
				return;
			case 'check-all': {
				var group = target.closest('.checklist-group');
				if (group) {
					Array.prototype.forEach.call(group.querySelectorAll('input[type="checkbox"]'), function (box) {
						box.checked = true;
					});
					M.flow.refresh(activeView, el.editor);
					renderAll();
				}
				return;
			}
			case 'flow-finish': {
				var finished = M.flow.finish(activeView, el.editor);
				if (finished) {
					dropTab(activeView);
					openView(finished.open);
					toast(finished.toast);
				} else {
					renderAll();
				}
				return;
			}
			case 'flow-cancel':
				M.flow.cancel(activeView);
				dropTab(activeView);
				if (tabs.length) {
					openView(tabs[tabs.length - 1]);
				} else {
					activeView = null;
					renderAll();
				}
				return;
			case 'build-site':
			case 'build-all':
			case 'build-missing':
			case 'build-target':
			case 'compile-program':
			case 'backup-all':
				showPanel('output');
				toast('Queued. The mock shows the panel, not the work.');
				return;
			case 'learn-nav':
			case 'toc':
			case 'filter-all':
			case 'filter-docs':
			case 'filter-devices':
			case 'filter-ai':
				if (target && target.parentElement) {
					Array.prototype.forEach.call(target.parentElement.children, function (sibling) {
						sibling.classList.toggle('is-active', sibling === target);
						if (sibling.hasAttribute('aria-pressed')) {
							sibling.setAttribute('aria-pressed', sibling === target ? 'true' : 'false');
						}
					});
				}
				return;
			case 'open-citation':
				toast('Citations open the page they name; in the mock they only announce it.');
				return;
			/* The page has a composer of its own; it answers like the AI bar does, in one line. */
			case 'send-chat': {
				var composer = target ? target.closest('.chat__composer') : null;
				var box = composer ? composer.querySelector('textarea') : null;
				var asked = box ? box.value.trim() : '';
				if (!asked) {
					toast('Type a question first.');
					return;
				}
				box.value = '';
				toast('Asked: “' + asked + '” · the answer arrives in this thread.');
				return;
			}
			case 'about':
				toast('Temco Platform 1.143.0 · layout mock · not a build.');
				return;
			default:
				if (name && name.indexOf('toast-') === 0) {
					return;
				}
				toast('“' + (target ? target.textContent.trim() : name) + '” is a layout placeholder — the mock stops here.');
		}
	}

	/* ------------------------------------------------------------------ wiring */

	function wire() {
		document.addEventListener('click', function (event) {
			var menuItem = event.target.closest('[data-menu-index]');
			if (menuItem) {
				var menu = menuItem.closest('.menu');
				var item = menu && menu.__items ? menu.__items[Number(menuItem.getAttribute('data-menu-index'))] : null;
				if (item && item.children) {
					openSubmenu(menu, menuItem, item.children, Number(menuItem.getAttribute('data-menu-index')));
					return;
				}
				if (item && item.disabled) {
					toast(item.hint || item.label + ' is not available.');
					return;
				}
				closeMenu();
				if (item && item.run) {
					item.run();
				} else if (item) {
					handleAction(item.action, menuItem);
				}
				return;
			}

			var menuButton = event.target.closest('[data-menu]');
			if (menuButton) {
				var name = menuButton.getAttribute('data-menu');
				var isOpen = el.openMenus && el.openMenus.length > 0 && el.openMenus[0].getAttribute('data-menu-name') === name;
				if (isOpen) {
					closeMenu();
				} else {
					openMenu(name, menuButton);
				}
				return;
			}

			if (!event.target.closest('.menu')) {
				closeMenu();
			}

			var paletteRow = event.target.closest('[data-palette-index]');
			if (paletteRow) {
				runPaletteItem(Number(paletteRow.getAttribute('data-palette-index')));
				return;
			}

			if (event.target === el.palette) {
				closePalette();
				return;
			}

			var moduleButton = event.target.closest('[data-module]');
			if (moduleButton) {
				openModule(moduleButton.getAttribute('data-module'));
				return;
			}

			var closeButton = event.target.closest('[data-close-tab]');
			if (closeButton) {
				event.stopPropagation();
				closeTab(closeButton.getAttribute('data-close-tab'));
				return;
			}

			var tab = event.target.closest('[data-tab]');
			if (tab) {
				openView(tab.getAttribute('data-tab'));
				return;
			}

			/* A segmented control shows the value that is set. Pressing one sets it and says so. */
			var segment = event.target.closest('.segmented[data-setting] button');
			if (segment) {
				var group = segment.parentElement;
				var setting = group.getAttribute('data-setting');
				var value = segment.textContent.trim();
				Array.prototype.forEach.call(group.querySelectorAll('button'), function (button) {
					button.setAttribute('aria-pressed', button === segment ? 'true' : 'false');
				});
				/* The theme setting is the one that changes the window it is set in. */
				if (setting === 'Theme' && (value === 'Dark' || value === 'Light')) {
					setTheme(value.toLowerCase());
					toast('Theme set to ' + value + '.');
					return;
				}
				if (setting === 'Theme') {
					toast('Theme set to System — the mock keeps the dark shell, which is what this machine reports.');
					return;
				}
				toast(setting + ' set to ' + value + '.');
				return;
			}

			var actionTarget = event.target.closest('[data-action]');
			if (actionTarget) {
				var action = actionTarget.getAttribute('data-action');
				if (action === 'theme') {
					handleAction(action, actionTarget);
					return;
				}
				if (actionTarget.hasAttribute('data-prompt')) {
					sendChat(actionTarget.getAttribute('data-prompt'));
					return;
				}
				handleAction(action, actionTarget);
				return;
			}

			var promptTarget = event.target.closest('[data-prompt]');
			if (promptTarget) {
				sendChat(promptTarget.getAttribute('data-prompt'));
				return;
			}

			var toastTarget = event.target.closest('[data-toast]');
			if (toastTarget) {
				toast(toastTarget.getAttribute('data-toast'));
				return;
			}

			var openTarget = event.target.closest('[data-open]');
			if (openTarget) {
				openView(openTarget.getAttribute('data-open'));
				return;
			}
		});

		/* A setting that is a switch says what it now is; the mock changes the box, not a stored value. */
		document.addEventListener('change', function (event) {
			var box = event.target.closest('input[data-setting]');
			if (box) {
				toast(box.getAttribute('data-setting') + (box.checked ? ' turned on.' : ' turned off.'));
			}
		});

		document.addEventListener('keydown', function (event) {
			var ctrl = event.ctrlKey || event.metaKey;

			if (!el.palette.hidden) {
				if (event.key === 'Escape') {
					event.preventDefault();
					closePalette();
					return;
				}
				if (event.key === 'ArrowDown') {
					event.preventDefault();
					paletteIndex = Math.min(paletteIndex + 1, paletteItems.length - 1);
					filterPalette(el.paletteInput.value);
					return;
				}
				if (event.key === 'ArrowUp') {
					event.preventDefault();
					paletteIndex = Math.max(paletteIndex - 1, 0);
					filterPalette(el.paletteInput.value);
					return;
				}
				if (event.key === 'Enter') {
					event.preventDefault();
					runPaletteItem(paletteIndex);
					return;
				}
			}

			if (ctrl && event.shiftKey && (event.key === 'P' || event.key === 'p')) {
				event.preventDefault();
				openPalette('commands');
				return;
			}
			if (ctrl && !event.shiftKey && !event.altKey && (event.key === 'p' || event.key === 'P')) {
				event.preventDefault();
				openPalette('views');
				return;
			}
			if (ctrl && event.altKey && (event.key === 'b' || event.key === 'B')) {
				event.preventDefault();
				toggleAux();
				return;
			}
			if (ctrl && (event.key === 'b' || event.key === 'B')) {
				event.preventDefault();
				toggleSidebar();
				return;
			}
			if (ctrl && (event.key === 'j' || event.key === 'J')) {
				event.preventDefault();
				togglePanel();
				return;
			}
			if (event.key === 'Escape') {
				closeMenu();
			}
		});

		el.paletteInput.addEventListener('input', function () {
			paletteIndex = 0;
			filterPalette(el.paletteInput.value);
		});

		/* The repository search filters rows in place: it is a view concern, not flow state. */
		document.addEventListener('input', function (event) {
			var input = event.target.closest('[data-filter]');
			if (!input) {
				return;
			}
			var list = document.querySelector('[data-filter-list="' + input.getAttribute('data-filter') + '"]');
			if (!list) {
				return;
			}
			var needle = input.value.trim().toLowerCase();
			Array.prototype.forEach.call(list.querySelectorAll('.checklist__row'), function (row) {
				row.hidden = !!needle && row.textContent.toLowerCase().indexOf(needle) < 0;
			});
		});

		/* A submenu opens when the pointer reaches its parent item and closes when it leaves the
		   branch, the way a desktop menu bar behaves. */
		document.addEventListener('mouseover', function (event) {
			var menuItem = event.target.closest('[data-menu-index]');
			if (!menuItem || !el.openMenus || !el.openMenus.length) {
				return;
			}
			/* A menu that just appeared under a resting pointer must not open a submenu by itself. */
			if (Date.now() - (el.menuOpenedAt || 0) < 180) {
				return;
			}
			var menu = menuItem.closest('.menu');
			if (!menu || !menu.__items) {
				return;
			}
			var index = Number(menuItem.getAttribute('data-menu-index'));
			var item = menu.__items[index];
			if (item && item.children) {
				openSubmenu(menu, menuItem, item.children, index);
				return;
			}
			if (item && menu.__openFor !== undefined) {
				var depth = el.openMenus.indexOf(menu);
				el.openMenus.slice(depth + 1).forEach(function (node) { node.remove(); });
				el.openMenus = el.openMenus.slice(0, depth + 1);
				menu.__openFor = undefined;
			}
		});

		el.chatForm.addEventListener('submit', function (event) {
			event.preventDefault();
			var text = el.chatInput.value.trim();
			if (!text) {
				return;
			}
			el.chatInput.value = '';
			sendChat(text);
		});

		el.chatInput.addEventListener('keydown', function (event) {
			if (event.key === 'Enter' && !event.shiftKey) {
				event.preventDefault();
				el.chatForm.dispatchEvent(new Event('submit', { cancelable: true }));
			}
		});

		Array.prototype.forEach.call(el.panelTabs, function (button) {
			button.addEventListener('click', function () {
				showPanel(button.getAttribute('data-panel'));
			});
		});

		window.addEventListener('hashchange', function () {
			var id = window.location.hash.replace(/^#\//, '');
			if (id && id !== activeView) {
				openView(id);
			}
		});

		window.addEventListener('resize', function () {
			if (window.innerWidth < 1000 && auxVisible) {
				setAux(false);
			}
			if (window.innerWidth < 780 && sidebarVisible) {
				toggleSidebar(false);
			}
		});
	}

	/* ------------------------------------------------------------------ boot */

	function boot() {
		el.activitybar = document.getElementById('activitybar');
		el.sidebar = document.getElementById('sidebar');
		el.sidebarTitle = document.getElementById('sidebar-title');
		el.sidebarBody = document.getElementById('sidebar-body');
		el.tabs = document.getElementById('tabs');
		el.breadcrumbs = document.getElementById('breadcrumbs');
		el.editor = document.getElementById('editor');
		el.panel = document.getElementById('panel');
		el.panelBody = document.getElementById('panel-body');
		el.panelTabs = document.querySelectorAll('[data-panel]');
		el.auxbar = document.getElementById('auxbar');
		el.chat = document.getElementById('chat');
		el.chatForm = document.getElementById('chat-form');
		el.chatInput = document.getElementById('chat-input');
		el.chatContext = document.getElementById('chat-context');
		el.palette = document.getElementById('palette');
		el.paletteInput = document.getElementById('palette-input');
		el.paletteList = document.getElementById('palette-list');
		el.toasts = document.getElementById('toasts');

		var saved = storageGet();
		if (saved) {
			setTheme(saved.theme);
			sidebarVisible = saved.sidebarVisible !== false;
			auxVisible = saved.auxVisible !== false;
			panelVisible = saved.panelVisible !== false;
			breadcrumbsVisible = saved.breadcrumbsVisible === true;
			panelTab = saved.panelTab || 'problems';
			tabs = Array.isArray(saved.tabs) ? saved.tabs.filter(viewOf) : [];
		} else if (window.innerWidth < 1180) {
			/* A narrow window is not the layout being designed; start with the AI bar closed so the
			   editor keeps its width. The title bar can bring it back. */
			auxVisible = window.innerWidth >= 900;
		}

		M.state = M.state || {};
		M.state.breadcrumbs = breadcrumbsVisible;

		/* A window too narrow for three columns hides the ones that do not fit, the way the real
		   workbench does; the title bar still toggles them. */
		if (window.innerWidth < 1000) {
			auxVisible = false;
		}
		if (window.innerWidth < 780) {
			sidebarVisible = false;
		}

		var fromHash = window.location.hash.replace(/^#\//, '');
		if (fromHash && viewOf(fromHash)) {
			activeView = fromHash;
		} else if (saved && saved.activeView && viewOf(saved.activeView)) {
			activeView = saved.activeView;
		}

		if (!tabs.length && activeView) {
			tabs = [activeView];
		}
		if (tabs.indexOf(activeView) < 0 && tabs.length) {
			activeView = tabs[tabs.length - 1];
		}
		moduleId = (viewOf(activeView) || {}).moduleId || 'dashboard';

		el.sidebar.classList.toggle('is-hidden', !sidebarVisible);
		el.auxbar.classList.toggle('is-hidden', !auxVisible);
		el.panel.classList.toggle('is-hidden', !panelVisible);
		renderPanel();

		chat = [
			{ who: 'Temco AI', text: 'I can read the page you have open, its area and the sources behind it. Ask for a summary, a draft, or the gaps in an area.', citations: [], isUser: false }
		];
		renderChat();

		wire();
		renderAll();

		if (window.location.hash !== '#/' + activeView) {
			window.location.hash = '#/' + activeView;
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', boot);
	} else {
		boot();
	}
})(window.TemcoMock = window.TemcoMock || { views: {} });
