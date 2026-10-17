/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Temco Controls. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* Help: the five surfaces behind the Help menu. They answer questions about the window itself —
   which keys do what, where the logs are, what to send with a bug, and what this build is — so
   they are pages rather than alerts: a shortcut can be read while the thing it opens is open. */

(function (M) {
	'use strict';

	var ui = M.ui;
	var data = M.data;

	function keyChips(keys) {
		return keys.map(function (key) { return '<kbd>' + ui.esc(key) + '</kbd>'; }).join(' ');
	}

	M.views['help/home'] = {
		title: 'Help',
		render: function () {
			var link = function (icon, title, note, open) {
				return (
					'<div class="record-row" data-open="' + open + '">' +
					ui.toneMark(icon, 'accent') +
					'<div class="record-row__main">' +
					'<div class="record-row__title"><span class="record-row__name">' + ui.esc(title) + '</span></div>' +
					'<div class="record-row__meta"><span>' + ui.esc(note) + '</span></div>' +
					'</div>' +
					'<div class="record-row__state"></div>' +
					ui.icon('chevron-right', 'icon--sm') +
					'</div>'
				);
			};

			var body =
				ui.pageHead({
					title: 'Help',
					icon: 'info',
					desc: 'What this window is, how to drive it, and what to send when it goes wrong. Everything here works with no network: the same pages are in the offline help file.',
					actions: ui.button('Report an Issue', { kind: 'primary', icon: 'alert', open: 'help/issue' })
				}) +
				'<div class="learn-hero__search mt-24" style="max-width:none">' + ui.icon('search') + '<span>Search the help, the documentation and the shortcuts…</span><span class="cell-mono" style="margin-left:auto">Ctrl+K</span></div>' +
				ui.group({
					label: 'Start Here',
					count: '4 pages',
					note: 'The documentation is a project like any other: its pages are in the Documents tree, and the site they build is Temco Learn.',
					body:
						link('graduation', 'Getting started with T3000', 'install, connect, and a first point that answers', 'learn/t3000') +
						link('key', 'Keyboard shortcuts', 'the keys this window binds, by group', 'help/keys') +
						link('output', 'Where the logs are', 'four files, what each one holds, and how to read one', 'help/logs') +
						link('upload', 'What changed in 13.0', 'the release notes for the version in this workspace', 'docs/releases')
				}) +
				ui.group({
					label: 'This Window',
					count: '5 facts',
					note: 'Worth quoting in a bug report — the Report page collects them for you.',
					body:
						'<div class="record-row record-row--static">' + ui.toneMark('package') +
						'<div class="record-row__main"><div class="record-row__title"><span class="record-row__name">Version</span></div>' +
						'<div class="record-row__meta"><span class="cell-mono">1.143.0</span> · <span>stable</span> · <span>commit a5b5009</span></div></div>' +
						'<div class="record-row__state"></div><div class="record-row__state"></div></div>' +
						'<div class="record-row record-row--static">' + ui.toneMark('layers') +
						'<div class="record-row__main"><div class="record-row__title"><span class="record-row__name">Profile</span></div>' +
						'<div class="record-row__meta"><span>Default</span> · <span class="cell-mono">~/.temco/settings.json</span></div></div>' +
						'<div class="record-row__state"></div><div class="record-row__state"></div></div>' +
						'<div class="record-row record-row--static">' + ui.toneMark('building') +
						'<div class="record-row__main"><div class="record-row__title"><span class="record-row__name">Workspace</span></div>' +
						'<div class="record-row__meta"><span>T3000</span> · <span class="cell-mono">~/Temco/t3000</span></div></div>' +
						'<div class="record-row__state"></div><div class="record-row__state"></div></div>'
				}) +
				'<div class="mt-16">' +
				ui.callout('This window is a layout mock: the pages describe the product, and nothing here sends anything anywhere.') +
				'</div>';

			return ui.view(body);
		}
	};

	M.views['help/keys'] = {
		title: 'Keyboard Shortcuts',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Keyboard Shortcuts',
					icon: 'key',
					desc: 'Every key this window binds. A command without a key can still be run from the command palette, which also lists the ones below.',
					actions: ui.button('Command Palette', { icon: 'terminal', action: 'open-palette' })
				}) +
				data.shortcuts.map(function (group) {
					return ui.group({
						label: group.group,
						count: group.items.length + ' shortcuts',
						body: group.items.map(function (item) {
							return (
								'<div class="record-row record-row--static">' +
								ui.toneMark('key') +
								'<div class="record-row__main">' +
								'<div class="record-row__title"><span class="record-row__name">' + ui.esc(item.label) + '</span></div>' +
								'<div class="record-row__meta"><span>' + ui.esc(item.note || '') + '</span></div>' +
								'</div>' +
								'<div class="record-row__state" style="display:flex;gap:4px">' + keyChips(item.keys) + '</div>' +
								'<div class="record-row__state"></div>' +
								'</div>'
							);
						}).join('')
					});
				}).join('') +
				'<div class="mt-16">' +
				ui.callout('A shortcut fires the same command the palette lists, so a key that does not work is a command that is not registered — not a key that is missing.') +
				'</div>';

			return ui.view(body);
		}
	};

	M.views['help/logs'] = {
		title: 'Logs',
		render: function () {
			var tail = [
				'[12:04:11] main       window ready · profile Default · workspace T3000',
				'[12:04:12] renderer   workbench mounted · 9 modules registered',
				'[12:04:18] docs       registry loaded: 8 areas, 45 folders, 1,254 pages',
				'[12:05:02] modules    temco-docs activated in 84 ms',
				'[12:05:02] modules    temco-ai activated in 412 ms',
				'[12:06:31] agents     runtime qwen2.5-3b-instruct loaded (2.1 GB)',
				'[12:06:44] warning    temco-repositories: 1 repository is not cloned',
				'[12:08:53] docs       build 13.0.482 · chm 612 of 1,254 topics',
				'[12:09:10] net        T3-22I (192.168.10.31) did not answer Who-Is'
			];

			var body =
				ui.pageHead({
					title: 'Logs',
					icon: 'output',
					desc: 'Four files, one per process. A log line names the process that wrote it, so a report can be read back without the window in front of you.',
					actions:
						ui.button('Open Log Folder', { kind: 'primary', icon: 'folder', action: 'open-log-folder' }) +
						ui.button('Copy Path', { icon: 'code', action: 'copy-log-path' })
				}) +
				ui.group({
					label: 'Files',
					count: data.logFiles.length + ' files',
					body: data.logFiles.map(function (file) {
						return (
							'<div class="record-row' + (file.tone === 'neutral' ? ' record-row--static' : '') + '">' +
							ui.toneMark('output', file.tone) +
							'<div class="record-row__main">' +
							'<div class="record-row__title"><span class="record-row__name cell-mono">' + ui.esc(file.name) + '</span></div>' +
							'<div class="record-row__meta"><span>' + ui.esc(file.note) + '</span> · <span class="cell-mono">' + ui.esc(file.size) + '</span> · <span>written ' + ui.esc(file.updated) + '</span></div>' +
							'</div>' +
							'<div class="record-row__state">' + ui.badge(file.tone === 'warn' ? '1 warning' : file.tone === 'neutral' ? 'empty' : 'quiet', file.tone) + '</div>' +
							ui.button('Open', { small: true, kind: 'ghost', action: 'open-log-file' }) +
							'</div>'
						);
					}).join('')
				}) +
				ui.rule({ label: 'main.log', plain: true, count: 'last 9 lines', actions: ui.button('Reveal', { small: true, kind: 'ghost', action: 'open-log-file' }) }) +
				'<div class="mt-16">' +
				'<pre class="code">' + tail.map(ui.esc).join('\n') + '</pre>' +
				'</div>' +
				'<div class="mt-16">' +
				ui.callout('Logs are written to the profile folder, never to the workspace, so a log survives switching workspaces and never lands in a commit.') +
				'</div>';

			return ui.view(body, { wide: true });
		}
	};

	M.views['help/issue'] = {
		title: 'Report an Issue',
		render: function () {
			var include = [
				{ name: 'Version and commit', detail: '1.143.0 · a5b5009', on: true },
				{ name: 'The last 200 log lines', detail: 'main.log and renderer.log', on: true },
				{ name: 'Workspace settings', detail: '2 overrides in ~/Temco/t3000', on: true },
				{ name: 'A screen recording', detail: 'not available in the mock', on: false }
			];

			var body =
				ui.pageHead({
					title: 'Report an Issue',
					icon: 'alert',
					desc: 'A report that can be reproduced is a report that gets fixed. This page collects the facts you would otherwise be asked for, and leaves out anything private.',
					actions: ui.button('Open on GitHub', { kind: 'primary', icon: 'external', action: 'open-issue' })
				}) +
				'<div class="settings-rows">' +
				ui.formRow('Title', 'What went wrong, in one line.', '<input class="input" value="" placeholder="Publishing 13.0 stops at 62 %" aria-label="Issue title">') +
				ui.formRow('What happened', 'The steps that led there, and what you expected instead.', '<input class="input" value="" placeholder="Steps to reproduce" aria-label="Steps">') +
				ui.formRow('Where', 'The surface you were on when it happened.', '<input class="input" value="Documentation › Build Center" aria-label="Where">') +
				'</div>' +
				ui.group({
					label: 'What Goes With It',
					count: include.filter(function (item) { return item.on; }).length + ' of ' + include.length,
					note: 'Nothing here contains page text, a prompt or a password. A log line names the process and the surface, not the content.',
					body: include.map(function (item) {
						return (
							'<div class="record-row record-row--static">' +
							ui.toneMark(item.on ? 'check' : 'close', item.on ? 'ok' : '') +
							'<div class="record-row__main">' +
							'<div class="record-row__title"><span class="record-row__name">' + ui.esc(item.name) + '</span></div>' +
							'<div class="record-row__meta"><span>' + ui.esc(item.detail) + '</span></div>' +
							'</div>' +
							'<div class="record-row__state"></div>' +
							ui.button('Copy', { small: true, kind: 'ghost', action: 'copy-diagnostics' }) +
							'</div>'
						);
					}).join('')
				}) +
				'<div class="mt-16">' +
				ui.callout('The platform sends no telemetry. A report reaches us when you send it, and not before.', { kind: 'ok' }) +
				'</div>';

			return ui.view(body, { wide: true });
		}
	};

	M.views['help/about'] = {
		title: 'About',
		render: function () {
			var active = data.modules.filter(function (module) { return module.state === 'Active'; }).length;
			var reserved = data.modules.length - active;

			var body =
				ui.pageHead({
					title: 'About',
					icon: 'info',
					desc: 'Temco Platform 1.143.0 — the window, the modules that ship with it, and the versions of what it depends on.',
					actions: ui.button('Check for Updates', { icon: 'refresh', action: 'check-updates' })
				}) +
				ui.tiles([
					{ value: '1.143.0', label: 'Version' },
					{ value: 'a5b5009', label: 'Commit' },
					{ value: String(active), label: 'Active modules' },
					{ value: String(reserved), label: 'Reserved' }
				]) +
				ui.group({
					label: 'Build',
					count: '4 facts',
					body:
						'<div class="record-row record-row--static">' + ui.toneMark('branch') +
						'<div class="record-row__main"><div class="record-row__title"><span class="record-row__name">Electron 32 · Chromium 128</span></div>' +
						'<div class="record-row__meta"><span>the desktop shell and the renderer</span></div></div><div class="record-row__state"></div><div class="record-row__state"></div></div>' +
						'<div class="record-row record-row--static">' + ui.toneMark('package') +
						'<div class="record-row__main"><div class="record-row__title"><span class="record-row__name">Node 20.18</span></div>' +
						'<div class="record-row__meta"><span>the module host and the build</span></div></div><div class="record-row__state"></div><div class="record-row__state"></div></div>' +
						'<div class="record-row record-row--static">' + ui.toneMark('sparkle') +
						'<div class="record-row__main"><div class="record-row__title"><span class="record-row__name">Local AI runtime 0.9</span></div>' +
						'<div class="record-row__meta"><span>qwen2.5-3b-instruct, 2.1 GB</span></div></div><div class="record-row__state"></div><div class="record-row__state"></div></div>' +
						'<div class="record-row record-row--static">' + ui.toneMark('document') +
						'<div class="record-row__main"><div class="record-row__title"><span class="record-row__name">Third-party notices</span></div>' +
						'<div class="record-row__meta"><span>every dependency and its licence, shipped with the build</span></div></div>' +
						ui.button('Open', { small: true, kind: 'ghost', action: 'open-notices' }) + '</div>'
				}) +
				ui.group({
					label: 'Modules',
					count: active + ' active · ' + reserved + ' reserved',
					note: 'A module ships with the platform and is never installed or updated on its own.',
					body: data.modules.map(function (module) {
						return (
							'<div class="record-row' + (module.surface ? '' : ' record-row--static') + '"' + (module.surface ? ' data-open="' + module.surface + '"' : '') + '>' +
							ui.toneMark('package', module.state === 'Active' ? 'ok' : '') +
							'<div class="record-row__main">' +
							'<div class="record-row__title"><span class="record-row__name">' + ui.esc(module.name) + '</span></div>' +
							'<div class="record-row__meta"><span class="cell-mono">' + ui.esc(module.id) + '</span> · <span>' + ui.esc(module.owns) + '</span></div>' +
							'</div>' +
							'<div class="record-row__state">' + ui.badge(module.state, module.state === 'Active' ? 'ok' : 'neutral') + '</div>' +
							'<div class="record-row__state"></div>' +
							'</div>'
						);
					}).join('')
				}) +
				'<div class="mt-16">' +
				ui.callout('This window is a layout mock, not a build: the surfaces describe the product, and the versions above are what a build would report.') +
				'</div>';

			return ui.view(body, { wide: true });
		}
	};
})(window.TemcoMock = window.TemcoMock || { views: {} });
