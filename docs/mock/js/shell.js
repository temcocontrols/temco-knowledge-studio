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
		storageSet({ theme: theme, moduleId: moduleId, activeView: activeView, tabs: tabs, sidebarVisible: sidebarVisible, auxVisible: auxVisible, panelVisible: panelVisible, panelTab: panelTab });
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
			html += '<div class="tree__section">' + ui.esc(section.label) + '</div>';
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
	}

	function renderBreadcrumbs() {
		var view = viewOf(activeView);
		if (!view) {
			el.breadcrumbs.innerHTML = '';
			return;
		}
		el.breadcrumbs.innerHTML =
			'<span class="breadcrumbs__item">' + ui.esc(view.moduleLabel) + '</span>' +
			ui.icon('chevron-right', 'icon--sm') +
			'<span class="breadcrumbs__item">' + ui.esc(view.sectionLabel) + '</span>' +
			ui.icon('chevron-right', 'icon--sm') +
			'<span class="breadcrumbs__item is-current">' + ui.esc(view.label) + '</span>';
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
			{ label: 'Preferences: Color Theme', run: function () { toggleTheme(); } },
			{ label: 'Temco: New Documentation Project', run: function () { toast('A project needs a name, a version and an owner. The form is not part of this mock.'); } },
			{ label: 'Temco: Read All Sources', run: function () { showPanel('output'); toast('Reading 38 sources…'); } },
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

	var menus = {
		File: [
			{ label: 'New Documentation Project', action: 'new-project' },
			{ label: 'Add Source…', action: 'add-source' },
			{ label: 'Open Workspace…', action: 'open-workspace' },
			{ separator: true },
			{ label: 'Save All', keys: 'Ctrl+K S', action: 'save-all' },
			{ separator: true },
			{ label: 'Close Tab', keys: 'Ctrl+W', run: function () { if (activeView) { closeTab(activeView); } } }
		],
		Edit: [
			{ label: 'Undo', keys: 'Ctrl+Z', action: 'undo' },
			{ label: 'Redo', keys: 'Ctrl+Y', action: 'redo' },
			{ separator: true },
			{ label: 'Find', keys: 'Ctrl+F', action: 'find' },
			{ label: 'Replace', keys: 'Ctrl+H', action: 'replace' }
		],
		View: [
			{ label: 'Command Palette…', keys: 'Ctrl+Shift+P', run: function () { openPalette('commands'); } },
			{ label: 'Quick Open…', keys: 'Ctrl+P', run: function () { openPalette('views'); } },
			{ separator: true },
			{ label: 'Toggle Primary Side Bar', keys: 'Ctrl+B', run: function () { toggleSidebar(); } },
			{ label: 'Toggle Panel', keys: 'Ctrl+J', run: function () { togglePanel(); } },
			{ label: 'Toggle AI Bar', keys: 'Ctrl+Alt+B', run: function () { toggleAux(); } },
			{ separator: true },
			{ label: 'Color Theme', run: function () { toggleTheme(); } }
		],
		Go: [
			{ label: 'Dashboard', run: function () { openModule('dashboard'); } },
			{ label: 'Documentation', run: function () { openModule('docs'); } },
			{ label: 'Devices', run: function () { openModule('devices'); } },
			{ label: 'I/O Studio', run: function () { openModule('io'); } },
			{ label: 'Temco Learn', run: function () { openModule('learn'); } }
		],
		Tools: [
			{ label: 'Read All Sources', action: 'read-all' },
			{ label: 'Build the Site', action: 'build-site' },
			{ label: 'Build the Offline Help', action: 'build-help' },
			{ separator: true },
			{ label: 'Publish Release…', action: 'publish-release' },
			{ separator: true },
			{ label: 'Open Review Center', run: function () { openView('docs/review'); } }
		],
		Help: [
			{ label: 'Documentation', action: 'help-docs' },
			{ label: 'Keyboard Shortcuts', action: 'help-keys' },
			{ separator: true },
			{ label: 'About Temco Platform', action: 'about' }
		]
	};

	function openMenu(name, anchor) {
		closeMenu();
		var items = menus[name];
		if (!items) {
			return;
		}
		var menu = document.createElement('div');
		menu.className = 'menu';
		menu.setAttribute('data-menu-name', name);
		menu.innerHTML = items.map(function (item, index) {
			if (item.separator) {
				return '<div class="menu__separator"></div>';
			}
			return (
				'<button type="button" class="menu__item" data-menu-index="' + index + '">' +
				'<span class="menu__label">' + ui.esc(item.label) + '</span>' +
				(item.keys ? '<span class="menu__keys">' + ui.esc(item.keys) + '</span>' : '') +
				'</button>'
			);
		}).join('');
		document.body.appendChild(menu);
		var rect = anchor.getBoundingClientRect();
		menu.style.left = rect.left + 'px';
		menu.style.top = rect.bottom + 2 + 'px';
		anchor.setAttribute('aria-expanded', 'true');
		el.currentMenu = menu;
		el.currentMenuItems = items;
	}

	function closeMenu() {
		if (el.currentMenu) {
			el.currentMenu.remove();
			el.currentMenu = null;
			Array.prototype.forEach.call(document.querySelectorAll('.menubar__button'), function (button) {
				button.setAttribute('aria-expanded', 'false');
			});
		}
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
			case 'build-site':
			case 'build-all':
			case 'build-missing':
			case 'build-target':
			case 'compile-program':
			case 'stage-firmware':
			case 'backup-all':
				showPanel('output');
				toast('Queued. The mock shows the panel, not the work.');
				return;
			case 'publish-release':
				showPanel('problems');
				toast('Publish blocked: 2 structural errors in API Reference.');
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
			if (menuItem && el.currentMenuItems) {
				var item = el.currentMenuItems[Number(menuItem.getAttribute('data-menu-index'))];
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
				if (el.currentMenu && el.currentMenu.getAttribute('data-menu-name') === name) {
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
			panelTab = saved.panelTab || 'problems';
			tabs = Array.isArray(saved.tabs) ? saved.tabs.filter(viewOf) : [];
		} else if (window.innerWidth < 1180) {
			/* A narrow window is not the layout being designed; start with the AI bar closed so the
			   editor keeps its width. The title bar can bring it back. */
			auxVisible = window.innerWidth >= 900;
		}

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
