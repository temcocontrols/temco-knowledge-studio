// The workbench module's entry point — the application's own surfaces.
//
// Three of them, and none of them is about one module's work:
//
//   * **the Library** — the index: what projects, sources, repositories and pages exist, and what wants doing;
//   * **the dashboard** — the application itself, what it is made of and what to do first;
//   * **the needs page** — everything one list that wants a person, from every module.
//
// It is also where the application *starts*: which tab opens, and which sidebar section comes forward when the
// project being worked on changes. Both are layout decisions, so they are made here rather than in a module that
// happens to own a view.
//
// Nothing here writes anything, and nothing here is a domain: the Library reads its rows from the store and the
// documentation module, and every row's action is that module's own command.

import * as vscode from 'vscode';
import { roots, onDidChange, refresh as reread } from './docs';
import { HomePanel } from './home';
import { NeedsPage } from './needsPage';
import { selection } from './store';
import { LIBRARY_VIEW_ID, registerSectionViews } from './views';

export function activate(context: vscode.ExtensionContext): void {
	// The Library: what there is, and what wants doing — one row per thing, each with its module's own actions.
	const library = registerSectionViews(context, selection, () => roots());
	// The dashboard: the application's own page, and the one surface that is not about a folder.
	const home = new HomePanel(context, selection, () => roots());
	// The page behind the Library's *Needs attention* row: what wants a person, said in full.
	const needs = new NeedsPage(context, () => roots());

	context.subscriptions.push(
		vscode.commands.registerCommand('temcoWorkbench.home', () => home.open()),
		vscode.commands.registerCommand('temcoWorkbench.openNeeds', () => needs.open()),
		// The three surfaces follow the documentation module's one signal: it re-read the sets, so each of them says
		// something new. The Library's own refresh button asks for that re-read and lets the signal do the rest.
		onDidChange(() => {
			home.refresh();
			library.refresh();
			needs.refresh();
		})
	);

	// Which sidebar section comes forward: choosing a project brings the Workspace, clearing one brings the
	// Library. `started` keeps the boot out of it — with one project it selects itself on activation, and that is
	// not the person choosing anything.
	let started = false;
	context.subscriptions.push(
		selection.onDidChange(async () => {
			if (started) {
				await vscode.commands.executeCommand(
					selection.project() === undefined ? `${LIBRARY_VIEW_ID}.focus` : 'temcoDocs.pages.focus'
				);
			}
		})
	);

	// Then the tab: what `temcoWorkbench.start.open` names, falling through rather than opening an empty editor.
	void reread().then(() => {
		started = true;
		return openStart(home);
	});
}

export function deactivate(): void {
	// Nothing to unwind: the pages are webviews the window closes, and every command is registered on the
	// extension's own context.
}

/**
 * The tab the platform opens when it starts. `temcoWorkbench.start.open` decides, and nothing else.
 *
 * The order is the order a person works in: **the project you are on** — its dashboard, which says what is in it
 * and what next — then **the page you were last on**, because that is the work you left, then **the home page**.
 * A preference that cannot be honoured falls through instead of showing an empty editor, so `project` with no
 * project opens the page you left, and `page` whose file is gone opens the project's dashboard. Only `none`
 * opens no tab at all.
 */
async function openStart(home: HomePanel): Promise<void> {
	const mode = vscode.workspace.getConfiguration('temcoWorkbench').get<string>('start.open', 'project');
	if (mode === 'none') {
		return;
	}

	const project = selection.project();
	if (mode === 'project' && project !== undefined) {
		await vscode.commands.executeCommand('temcoProjects.openProject', project);
		return;
	}
	if (mode !== 'home' && (await openRememberedPage())) {
		return;
	}
	if (mode === 'page' && project !== undefined) {
		await vscode.commands.executeCommand('temcoProjects.openProject', project);
		return;
	}
	home.open();
}

/**
 * The page the selected project remembers, opened when the file is still there.
 *
 * The remembered path can be gone — a branch switched, a page moved — and opening it anyway would report a fault
 * before saying hello. Answers whether it opened one, so the caller can fall through to the next step.
 */
async function openRememberedPage(): Promise<boolean> {
	const page = selection.page();
	if (page?.path === undefined) {
		return false;
	}
	try {
		await vscode.workspace.fs.stat(vscode.Uri.file(page.path));
	} catch {
		return false;
	}
	await vscode.commands.executeCommand('temcoRepositories.openFile', {
		path: page.path,
		id: page.id,
		title: page.title,
	});
	return true;
}
