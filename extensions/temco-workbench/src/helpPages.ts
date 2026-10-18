// Help — the six surfaces behind the Help container.
//
// Rebuilt from the mock (`docs/mock/js/views.help.js`: `help/welcome`, `help/home`, `help/keys`, `help/logs`,
// `help/issue`, `help/about`). They answer questions about the window itself — which keys do what, where the logs
// are, what to send with a bug, and what this build is — so they are pages rather than dialogs: a shortcut can be
// read while the thing it opens is open.
//
// Two of them were carved out of their modules: Welcome was its own page and Help was one page with everything on
// it. The mock gives six, each with one question to answer, and the counts in the group heads only mean something
// once they are separate.

import * as vscode from 'vscode';
import { ISSUE_INCLUDES, LOG_FILES, LOG_TAIL, SHORTCUTS } from './helpSample';
import { commandScript, escapeHtml as esc, icon, page, pageColumn, runCommand, toneMark } from './ui';

export const HELP_WELCOME_VIEW_TYPE = 'temcoWorkbench.help.welcome';
export const HELP_HOME_VIEW_TYPE = 'temcoWorkbench.help.home';
export const HELP_KEYS_VIEW_TYPE = 'temcoWorkbench.help.keys';
export const HELP_LOGS_VIEW_TYPE = 'temcoWorkbench.help.logs';
export const HELP_ISSUE_VIEW_TYPE = 'temcoWorkbench.help.issue';
export const HELP_ABOUT_VIEW_TYPE = 'temcoWorkbench.help.about';

/** The setting the welcome page's checkbox writes. */
const START_OPEN = 'start.open';

interface ActionOptions {
	kind?: 'primary' | 'ghost';
	mark?: string;
	small?: boolean;
}

const button = (label: string, command: string, options: ActionOptions = {}): string =>
	`<button type="button" class="btn${options.small ? ' btn--sm' : ''}${options.kind ? ` btn--${options.kind}` : ''}" data-command="${command}">${options.mark ? icon(options.mark) : ''}<span>${esc(label)}</span></button>`;

const badge = (text: string, tone?: string): string =>
	`<span class="badge${tone && tone !== 'neutral' ? ` badge--${tone}` : ''}">${esc(text)}</span>`;

const pageHead = (options: { title: string; mark: string; desc: string; actions?: string }): string =>
	`<div class="page-head"><div class="page-head__main"><h1 class="page-head__title">${icon(options.mark)}${esc(options.title)}</h1><p class="page-head__desc">${options.desc}</p></div>${options.actions ? `<div class="page-head__actions">${options.actions}</div>` : ''}</div>`;

const rule = (options: { label: string; count?: string; note?: string; actions?: string }): string =>
	`<div class="group-head"><span class="group-head__label">${esc(options.label)}</span><span class="group-head__rule"></span>${options.count ? `<span class="group-head__count">${esc(options.count)}</span>` : ''}${options.actions ? `<span class="group-head__actions">${options.actions}</span>` : ''}</div>${options.note ? `<p class="group-note">${options.note}</p>` : ''}`;

const callout = (html: string, kind?: 'warn' | 'ok'): string =>
	`<div class="callout${kind ? ` callout--${kind}` : ''}">${icon(kind === 'warn' ? 'alert' : 'info')}<div>${html}</div></div>`;

const tiles = (entries: { value: string; label: string }[]): string =>
	`<div class="tiles">${entries.map((entry) => `<div class="tile"><div class="tile__value">${esc(entry.value)}</div><div class="tile__label">${esc(entry.label)}</div></div>`).join('')}</div>`;

/** A row that is one action: the glyph, the sentence, and the chevron. */
const actionRow = (mark: string, title: string, note: string, command: string): string =>
	`<div class="record-row" data-command="${command}">
	${toneMark(mark, 'accent')}
	<div class="record-row__main">
		<div class="record-row__title"><span class="record-row__name">${esc(title)}</span></div>
		<div class="record-row__meta"><span>${esc(note)}</span></div>
	</div>
	<div class="record-row__state"></div>
	<span class="record-row__go">›</span>
</div>`;

/** A row that states a fact: no action, so no chevron. */
const factRow = (mark: string, title: string, meta: string, state = '', actions = ''): string =>
	`<div class="record-row record-row--static">
	${toneMark(mark)}
	<div class="record-row__main">
		<div class="record-row__title"><span class="record-row__name">${title}</span></div>
		<div class="record-row__meta">${meta}</div>
	</div>
	<div class="record-row__state">${state}</div>
	${actions || '<div class="record-row__state"></div>'}
</div>`;

const kbd = (keys: string[]): string => keys.map((key) => `<kbd>${esc(key)}</kbd>`).join(' ');

/** The six Help surfaces, one panel each. */
export class HelpPages {
	private readonly panels = new Map<string, vscode.WebviewPanel>();

	constructor(private readonly context: vscode.ExtensionContext) { }

	welcome(): void {
		this.open('welcome', HELP_WELCOME_VIEW_TYPE, 'Welcome', welcomeBody(), true);
	}

	home(): void {
		this.open('home', HELP_HOME_VIEW_TYPE, 'Help', homeBody());
	}

	keys(): void {
		this.open('keys', HELP_KEYS_VIEW_TYPE, 'Keyboard Shortcuts', keysBody());
	}

	logs(): void {
		this.open('logs', HELP_LOGS_VIEW_TYPE, 'Logs', logsBody(), true);
	}

	issue(): void {
		this.open('issue', HELP_ISSUE_VIEW_TYPE, 'Report an Issue', issueBody(), true);
	}

	about(): void {
		this.open('about', HELP_ABOUT_VIEW_TYPE, 'About', aboutBody(), true);
	}

	/** Re-renders Welcome if it is open — its one checkbox is a setting, and the setting can change elsewhere. */
	refresh(): void {
		const panel = this.panels.get('welcome');
		if (panel) {
			panel.webview.html = page(welcomeBody(), { title: 'Welcome', script: commandScript, extraCss: '.view__inner { max-width: 1400px; }' });
		}
	}

	dispose(): void {
		for (const panel of this.panels.values()) {
			panel.dispose();
		}
		this.panels.clear();
	}

	private open(key: string, viewType: string, title: string, body: string, wide = false): void {
		const html = page(body, {
			title,
			script: commandScript,
			extraCss: wide ? '.view__inner { max-width: 1400px; }' : undefined
		});
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
		panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'help.svg');
		panel.webview.html = html;
		panel.webview.onDidReceiveMessage(runCommand);
		this.panels.set(key, panel);
		panel.onDidDispose(() => this.panels.delete(key));
	}
}

/** True when this window opens the welcome page at startup. */
export function opensAtStartup(): boolean {
	return vscode.workspace.getConfiguration('temcoWorkbench').get<string>(START_OPEN, 'welcome') === 'welcome';
}

/** A walkthrough: how many of its steps are done, and the bar that says so without arithmetic. */
function walkthrough(title: string, note: string, done: number, total: number, command: string): string {
	const percent = Math.round((done / total) * 100);
	return `<div class="card card--plain">
	<div class="card__head"><div class="card__title">${esc(title)}</div><div class="card__actions">${button('Open', command, { small: true, kind: 'ghost' })}</div></div>
	<p class="card__desc">${esc(note)}</p>
	<div class="facts" style="margin-top:0"><span>${done} of ${total} steps</span></div>
	<div class="mt-16"><span class="bar"><span class="bar__fill${done === total ? ' bar__fill--ok' : ''}" style="width:${percent}%"></span></span></div>
</div>`;
}

/** *Welcome* — the mock's `help/welcome`. */
function welcomeBody(): string {
	const checked = opensAtStartup() ? ' checked' : '';

	return `<div class="learn-hero learn-hero--flush">
	<div class="learn-hero__inner">
		<div class="row" style="gap:10px;margin-bottom:10px">${badge('Temco Platform', 'accent')}<span class="cell-muted" style="font-size:12px">${esc(vscode.version)} · this profile</span></div>
		<h1 class="learn-hero__title">Documentation, read and written in one window</h1>
		<p class="learn-hero__desc">A project holds the pages of a product, the sources they are written from, and the artifacts a build produces. Start with what you came to do.</p>
	</div>
</div>
<div class="mt-24">
	${rule({ label: 'Start', count: '6 ways in' })}
	${actionRow('plus', 'Create a documentation project', 'a name, a version, and the sources it reads', 'temcoProjects.newProject')}
	${actionRow('repo', 'Read a source', 'a repository, a document, a folder or a connected library', 'temcoProjects.addSource')}
	${actionRow('document', 'Open the content tree', 'every area, folder and page this workspace holds', 'temcoDocs.documents')}
	${actionRow('graduation', 'See how Documentation works', 'five steps from a repository to a published page', 'temcoDocs.howTo')}
	${actionRow('chip', 'Bring in a controller', 'discover one on the segment, or add it by address', 'workbench.view.extension.temcoDevices')}
	${actionRow('sparkle', 'Ask the AI about this workspace', 'answers cite the pages and sources they used', 'temcoAi.chat')}
</div>
<div class="mt-24">
	${rule({ label: 'Walkthroughs', count: '3 guides' })}
	<div class="grid grid--3 mt-16">
		${walkthrough('Set up a workspace', 'The folder, the sources it reads, and the devices it can reach.', 2, 4, 'temcoWorkbench.newWorkspace')}
		${walkthrough('Write and review a page', 'From a source read to a reviewed page in an area.', 1, 5, 'temcoDocs.documents')}
		${walkthrough('Publish a version', 'Build every artifact, then freeze the version for readers.', 3, 4, 'temcoDocs.releases')}
	</div>
</div>
<div class="mt-24 row" style="gap:16px;align-items:center;font-size:13px;color:var(--fg-muted)">
	<label class="check"><input type="checkbox" data-command="temcoWorkbench.toggleWelcomeStartup"${checked}><span>Show the welcome page at startup</span></label>
	<span class="toolbar__spacer"></span>
	${button('Keyboard Shortcuts', 'temcoWorkbench.help.keys', { small: true, kind: 'ghost' })}
	${button('Release Notes', 'temcoDocs.releases', { small: true, kind: 'ghost' })}
</div>`;
}

/** *Help* — the mock's `help/home`. */
function homeBody(): string {
	const folder = vscode.workspace.workspaceFolders?.[0];
	const workspaceName = folder ? folder.name : 'no folder open';
	const workspacePath = folder ? folder.uri.fsPath : '—';

	return `${pageHead({
		title: 'Help',
		mark: 'info',
		desc: 'What this window is, how to drive it, and what to send when it goes wrong. Everything here works with no network: the same pages are in the offline help file.',
		actions: button('Report an Issue', 'temcoWorkbench.help.issue', { kind: 'primary', mark: 'alert' })
	})}
<div class="learn-hero__search mt-24" style="max-width:none" data-command="workbench.action.quickOpen">${icon('search')}<span>Search the help, the documentation and the shortcuts…</span><span class="cell-mono" style="margin-left:auto">Ctrl+K</span></div>
<div class="mt-24">
	${rule({ label: 'Start Here', count: '4 pages', note: 'The documentation is a project like any other: its pages are in the Documents tree, and the site they build is Temco Learn.' })}
	${actionRow('graduation', 'Getting started with T3000', 'install, connect, and a first point that answers', 'temcoWorkbench.learn.t3000')}
	${actionRow('key', 'Keyboard shortcuts', 'the keys this window binds, by group', 'temcoWorkbench.help.keys')}
	${actionRow('output', 'Where the logs are', 'four files, what each one holds, and how to read one', 'temcoWorkbench.help.logs')}
	${actionRow('upload', 'What changed in 13.0', 'the release notes for the version in this workspace', 'temcoDocs.releases')}
</div>
<div class="mt-24">
	${rule({ label: 'This Window', count: '3 facts', note: 'Worth quoting in a bug report — the Report page collects them for you.' })}
	${factRow('package', 'Version', `<span class="cell-mono">${esc(vscode.version)}</span> · <span>${esc(vscode.env.appName)}</span>`)}
	${factRow('layers', 'Profile', '<span>Default</span> · <span class="cell-mono">settings.json</span>')}
	${factRow('building', 'Workspace', `<span>${esc(workspaceName)}</span> · <span class="cell-mono">${esc(workspacePath)}</span>`)}
</div>
<div class="mt-16">${callout('Everything on this page is read from the build you are running — the version, the profile and the workspace are the window’s own facts, not a sample.')}</div>`;
}

/** *Keyboard Shortcuts* — the mock's `help/keys`. */
function keysBody(): string {
	return `${pageHead({
		title: 'Keyboard Shortcuts',
		mark: 'key',
		desc: 'Every key this window binds. A command without a key can still be run from the command palette, which also lists the ones below.',
		actions: button('Command Palette', 'workbench.action.quickOpen', { mark: 'terminal' })
	})}
${SHORTCUTS.map((group) => `<div class="mt-24">
	${rule({ label: group.group, count: `${group.items.length} shortcuts` })}
	${group.items.map((item) => factRow('key', esc(item.label), `<span>${esc(item.note ?? '')}</span>`, `<span style="display:flex;gap:4px">${kbd(item.keys)}</span>`)).join('')}
</div>`).join('')}
<div class="mt-16">${callout('A shortcut fires the same command the palette lists, so a key that does not work is a command that is not registered — not a key that is missing.')}</div>`;
}

/** *Logs* — the mock's `help/logs`. */
function logsBody(): string {
	return `${pageHead({
		title: 'Logs',
		mark: 'output',
		desc: 'Four files, one per process. A log line names the process that wrote it, so a report can be read back without the window in front of you.',
		actions: button('Open Log Folder', 'workbench.action.openLogsFolder', { kind: 'primary', mark: 'folder' }) + button('Copy Path', 'temcoWorkbench.copyLogPath', { mark: 'code' })
	})}
<div class="mt-24">
	${rule({ label: 'Files', count: `${LOG_FILES.length} files` })}
	${LOG_FILES.map((file) => factRow(
		'output',
		`<span class="cell-mono">${esc(file.name)}</span>`,
		`<span>${esc(file.note)}</span> · <span class="cell-mono">${esc(file.size)}</span> · <span>written ${esc(file.updated)}</span>`,
		badge(file.tone === 'warn' ? '1 warning' : file.tone === 'neutral' ? 'empty' : 'quiet', file.tone),
		button('Open', 'workbench.action.openLogFile', { small: true, kind: 'ghost' })
	)).join('')}
</div>
<div class="mt-24">
	${rule({ label: 'main.log', count: 'last 9 lines', actions: button('Reveal', 'workbench.action.openLogsFolder', { small: true, kind: 'ghost' }) })}
	<div class="mt-16"><pre class="code">${LOG_TAIL.map((line) => esc(line)).join('\n')}</pre></div>
</div>
<div class="mt-16">${callout('Logs are written to the profile folder, never to the workspace, so a log survives switching workspaces and never lands in a commit.')}</div>`;
}

/** *Report an Issue* — the mock's `help/issue`. */
function issueBody(): string {
	const counted = ISSUE_INCLUDES.filter((item) => item.on).length;

	return `${pageHead({
		title: 'Report an Issue',
		mark: 'alert',
		desc: 'A report that can be reproduced is a report that gets fixed. This page collects the facts you would otherwise be asked for, and leaves out anything private.',
		actions: button('Open on GitHub', 'workbench.action.openIssueReporter', { kind: 'primary', mark: 'external' })
	})}
<div class="settings-rows">
	<div class="form-row"><div class="form-row__main"><div class="form-row__label">Title</div><div class="form-row__desc">What went wrong, in one line.</div></div><div class="form-row__control"><input class="input" placeholder="Publishing 13.0 stops at 62 %" aria-label="Issue title"></div></div>
	<div class="form-row"><div class="form-row__main"><div class="form-row__label">What happened</div><div class="form-row__desc">The steps that led there, and what you expected instead.</div></div><div class="form-row__control"><input class="input" placeholder="Steps to reproduce" aria-label="Steps"></div></div>
	<div class="form-row"><div class="form-row__main"><div class="form-row__label">Where</div><div class="form-row__desc">The surface you were on when it happened.</div></div><div class="form-row__control"><input class="input" value="Documentation › Build Center" aria-label="Where"></div></div>
</div>
<div class="mt-24">
	${rule({ label: 'What Goes With It', count: `${counted} of ${ISSUE_INCLUDES.length}`, note: 'Nothing here contains page text, a prompt or a password. A log line names the process and the surface, not the content.' })}
	${ISSUE_INCLUDES.map((item) => factRow(
		item.on ? 'check' : 'close',
		esc(item.name),
		`<span>${esc(item.detail)}</span>`,
		'',
		button('Copy', 'temcoWorkbench.copyDiagnostics', { small: true, kind: 'ghost' })
	)).join('')}
</div>
<div class="mt-16">${callout('The platform sends no telemetry. A report reaches us when you send it, and not before.', 'ok')}</div>`;
}

/** *About* — the mock's `help/about`. */
function aboutBody(): string {
	const modules = vscode.extensions.all.filter((extension) => extension.packageJSON.publisher === 'temcocontrols');
	const active = modules.filter((extension) => extension.isActive).length;
	const reserved = modules.length - active;

	return `${pageHead({
		title: 'About',
		mark: 'info',
		desc: `${esc(vscode.env.appName)} ${esc(vscode.version)} — the window, the modules that ship with it, and the versions of what it depends on.`,
		actions: button('Check for Updates', 'update.check', { mark: 'refresh' })
	})}
<div class="mt-16">${tiles([
		{ value: vscode.version, label: 'Version' },
		{ value: `${modules.length}`, label: 'Modules' },
		{ value: `${active}`, label: 'Active modules' },
		{ value: `${reserved}`, label: 'Not activated' }
	])}</div>
<div class="mt-24">
	${rule({ label: 'Build', count: '4 facts' })}
	${factRow('branch', 'Electron · Chromium', '<span>the desktop shell and the renderer</span>')}
	${factRow('package', 'Node', '<span>the module host and the build</span>')}
	${factRow('sparkle', 'Local AI runtime', '<span>the model loaded by the AI Hub</span>')}
	${factRow('document', 'Third-party notices', '<span>every dependency and its licence, shipped with the build</span>', '', button('Open', 'workbench.action.openLicenseUrl', { small: true, kind: 'ghost' }))}
</div>
<div class="mt-24">
	${rule({ label: 'Modules', count: `${modules.length} installed`, note: 'A module ships with the platform and is never installed or updated on its own.' })}
	${modules.map((extension) => {
		const name = String(extension.packageJSON.displayName ?? extension.packageJSON.name ?? extension.id);
		return factRow('package', esc(name), `<span class="cell-mono">${esc(extension.id)}</span> · <span>v${esc(String(extension.packageJSON.version ?? '—'))}</span>`, badge(extension.isActive ? 'Active' : 'Idle', extension.isActive ? 'ok' : 'neutral'));
	}).join('')}
</div>`;
}
