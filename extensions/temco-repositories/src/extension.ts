// The repositories module's entry point.
//
// It owns the organisation and the local copies of it: the list of repositories, the token that reaches them,
// cloning one branch with full history into the working area, pulling it, removing it, and reading a source —
// from a folder on this machine or over the API — into the platform's memory.
//
// Two things are deliberately *not* here:
//
//   * the pages of documentation a source carries. A read records what the registry declares; the registry's own
//     shape, its checks and everything a person reads belong to `temco-docs`.
//   * the surfaces that show sources. The Library's rows are the workbench's; this module publishes what a
//     surface needs (`onDidChange`, the code files of a source, the material for a draft) and opens its own page.
//
// Nothing is ever written to a repository and nothing is ever pushed: the working area is a separate folder, and
// every clone, pull and removal starts from a command a person ran.

import * as vscode from 'vscode';
import * as path from 'node:path';
import { registerReadCommands } from './read';
import { tokenOf } from './read';
import { CodeFile, Material, RepositorySource, codeFiles, readMaterials, sourceTree } from './repository';
import { RepositoryDetailPage } from './repositoryPage';
import { RepositoriesPage } from './repositoriesPage';
import { RepositorySettingsPage } from './settingsPage';
import { OFFERED_SCRIPTS, OfferedScript } from './scripts';
import { registerSourcesView } from './sourcesView';
import { Catalog, selection, slugOf } from './store';
import { registerWorkareaCommands } from './workarea';
import { cloneFolder, hasClone } from './workarea';

/** What this module offers the rest of the platform. */
export interface TemcoRepositoriesApi {
	/** Fires when the catalog changed in a way another surface shows: a source added, read, or forgotten. */
	onDidChange(listener: () => void): vscode.Disposable;
	/** The code files a source carries, relative to its own root — on disk, or through the API. */
	codeFiles(source: RepositorySource): Promise<{ files: CodeFile[]; note?: string }>;
	/** Every file a source carries — documentation as well as code — for a project starting from a repository. */
	tree(source: RepositorySource): Promise<{ files: CodeFile[]; note?: string } | { error: string }>;
	/** The text of the files a person ticked, within one budget. */
	readMaterials(source: RepositorySource, files: readonly string[], limit?: number): Promise<Material>;
	/** The repository's own documentation scripts: a vocabulary, not a runner. */
	readonly offeredScripts: readonly OfferedScript[];
}

export function activate(context: vscode.ExtensionContext): TemcoRepositoriesApi {
	const output = vscode.window.createOutputChannel('Temco Repositories');
	// One signal for the surfaces that show sources: a read finished, a clone arrived, a source was forgotten.
	const changed = new vscode.EventEmitter<void>();
	context.subscriptions.push(output, changed);
	const refresh = (): void => changed.fire();

	// The page that lists the organisation: what is there, what has been read, and what has a local copy.
	const repositories = new RepositoriesPage(context, selection, refresh);
	// One repository, opened from a row or from the panel: its facts, its local copy, and what is inside it.
	const detail = new RepositoryDetailPage(context, selection, refresh);
	// What decides both: the enterprise the page opens on, where a download lands, and the token.
	const settings = new RepositorySettingsPage(context, refresh);
	context.subscriptions.push(
		{ dispose: () => repositories.dispose() },
		{ dispose: () => detail.dispose() },
		{ dispose: () => settings.dispose() },
		vscode.commands.registerCommand('temcoRepositories.page', () => repositories.open()),
		vscode.commands.registerCommand('temcoRepositories.settings', () => settings.open()),
		// The panel's enterprise rows: read that list again, or forget it. A row is one click away from its list,
		// which is what the page is for.
		vscode.commands.registerCommand('temcoRepositories.rowReadOrg', (target?: unknown) => {
			const name = rowName(target);
			if (name.length > 0) {
				repositories.open(slugOf(name));
			}
		}),
		vscode.commands.registerCommand('temcoRepositories.rowForgetOrg', (target?: unknown) =>
			void rowForget(context, refresh, target)
		),
		// A file in the panel's tree: the local copy when there is one, GitHub when there is not. Its own id —
		// `temcoRepositories.openFile` is the documentation page opener in `read.ts`.
		vscode.commands.registerCommand('temcoRepositories.openRepositoryFile', (name?: unknown, file?: unknown) =>
			void openRepositoryFile(context, selection, name, file)
		),
		vscode.commands.registerCommand('temcoRepositories.repository', (name?: string, organisation?: string) => {
			if (typeof name === 'string' && name.length > 0) {
				detail.open(name, organisation);
			}
		})
	);

	// Reading a source, and the token that reaches one.
	registerReadCommands(context, selection, output, refresh);
	// The working area: cloning a source so its files can be read, and pulling it when it has moved on.
	registerWorkareaCommands(context, selection, output, refresh);

	// Where downloads go, chosen rather than typed: the setting is one path, and a folder dialog is how a person
	// answers it. The settings page is the other half — this is the shortcut from the page that uses the path.
	context.subscriptions.push(
		vscode.commands.registerCommand('temcoRepositories.pickWorkspaceFolder', async () => {
			const picked = await vscode.window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				openLabel: 'Keep local copies here',
				title: 'Where should local copies and drafts be kept?'
			});
			const folder = picked?.[0];
			if (folder === undefined) {
				return;
			}
			await vscode.workspace
				.getConfiguration('temcoRepositories')
				.update('workspaceFolder', folder.fsPath, vscode.ConfigurationTarget.Global);
			refresh();
		})
	);

	// The panel: what the platform records, with the actions each row offers. It refreshes on the same signal every
	// other surface does, so a read started from a command shows up here as soon as it finishes.
	registerSourcesView(context, changed.event);

	// The two acts a repository row offers before anything about it is a project: fetch its local copy, or begin a
	// project from it. Both take the tree item, because that is what a menu hands a command.
	context.subscriptions.push(
		vscode.commands.registerCommand('temcoRepositories.rowFetch', (target?: unknown) =>
			void rowFetch(context, refresh, target)
		),
		vscode.commands.registerCommand('temcoRepositories.rowProject', (target?: unknown) =>
			void rowProject(context, target)
		),
		// Where a rate limit comes from, answered before it is hit: the allowance GitHub reports for this machine's
		// address, with the token attached if there is one.
		vscode.commands.registerCommand('temcoRepositories.testToken', () => void testToken(context))
	);

	return {
		onDidChange: (listener: () => void) => changed.event(listener),
		codeFiles: (source) => codeFiles(context, source),
		tree: (source) => sourceTree(context, source),
		readMaterials: (source, files, limit) => readMaterials(context, source, files, limit),
		offeredScripts: OFFERED_SCRIPTS,
	};
}

export function deactivate(): void {
	// Nothing to unwind: every command is registered on the extension's own context, and the output channel with
	// it. A git process that was already running finishes on its own; nothing is left holding the window open.
}

/** A panel row's repository name — the tree item's label, or a string when the command is run from the palette. */
function rowName(target: unknown): string {
	if (typeof target === 'string') {
		return target;
	}
	const label = (target as { label?: unknown } | undefined)?.label;
	if (typeof label === 'string') {
		return label;
	}
	const nested = (label as { label?: unknown } | undefined)?.label;
	return typeof nested === 'string' ? nested : '';
}

/** Where a repository's list put it: the two addresses an act needs, from whichever organisation holds it. */
async function rowCoordinates(
	context: vscode.ExtensionContext,
	name: string
): Promise<{ cloneUrl?: string; defaultBranch?: string; fullName?: string }> {
	let catalog: Catalog | undefined;
	try {
		catalog = await Catalog.open(context);
		for (const organisation of catalog.organisations()) {
			const row = catalog.repositoriesOf(organisation.slug).find((entry) => entry.name === name);
			if (row !== undefined) {
				return { cloneUrl: row.cloneUrl, defaultBranch: row.defaultBranch, fullName: row.fullName };
			}
		}
		return {};
	} catch {
		return {};
	} finally {
		catalog?.close();
	}
}

/**
 * Open one file of a repository, from where it actually exists.
 *
 * The local copy is the real file and opens as the editor's own text document; without one, GitHub's blob page is the
 * honest place to send a person — on the branch the platform would read, so the page shows the revision being read.
 */
async function openRepositoryFile(
	context: vscode.ExtensionContext,
	selection: { project(): string | undefined },
	name?: unknown,
	file?: unknown
): Promise<void> {
	if (typeof name !== 'string' || typeof file !== 'string' || name.length === 0 || file.length === 0) {
		return;
	}
	const project = selection.project();
	if (project !== undefined && (await hasClone(project, name))) {
		const target = path.join(cloneFolder(project, name), ...file.split('/'));
		try {
			await vscode.window.showTextDocument(vscode.Uri.file(target));
			return;
		} catch {
			// An old listing and the copy can disagree; the browser still has the file.
		}
	}
	const coordinates = await rowCoordinates(context, name);
	const branch = coordinates.defaultBranch ?? 'main';
	const repository = coordinates.fullName ?? name;
	const address =
		`https://github.com/${repository}/blob/${encodeURIComponent(branch)}/` +
		file.split('/').map((part) => encodeURIComponent(part)).join('/');
	await vscode.env.openExternal(vscode.Uri.parse(address));
}

/** Fetch a row's local copy, recording it as a source first: a clone belongs to a source. */
async function rowFetch(
	context: vscode.ExtensionContext,
	refresh: () => void,
	target: unknown
): Promise<void> {
	const name = rowName(target);
	if (name.length === 0) {
		return;
	}
	const coordinates = await rowCoordinates(context, name);
	let catalog: Catalog | undefined;
	try {
		catalog = await Catalog.open(context);
		catalog.addSource({
			kind: 'git',
			name,
			slug: slugOf(name),
			remoteUrl: coordinates.cloneUrl,
			defaultBranch: coordinates.defaultBranch,
		});
	} catch {
		// The clone reports its own refusal; this only records the coordinates.
	} finally {
		catalog?.close();
	}
	refresh();
	await vscode.commands.executeCommand('temcoRepositories.fetchSource', slugOf(name));
}

/** Begin a project from a row: the flow opens pinned to it, and picks its files there. */
async function rowProject(context: vscode.ExtensionContext, target: unknown): Promise<void> {
	const name = rowName(target);
	if (name.length === 0) {
		return;
	}
	const coordinates = await rowCoordinates(context, name);
	try {
		await vscode.commands.executeCommand(
			'temcoProjects.newProjectFromRepository',
			name,
			coordinates.cloneUrl,
			coordinates.defaultBranch
		);
	} catch {
		void vscode.window.showInformationMessage(
			'Temco Repositories: the projects module is not installed, so there is nothing to create a project with.'
		);
	}
}

/** Forgets an enterprise and its held list. A source it named is untouched: that is a project's business. */
async function rowForget(context: vscode.ExtensionContext, refresh: () => void, target: unknown): Promise<void> {
	const name = rowName(target);
	if (name.length === 0) {
		return;
	}
	let catalog: Catalog | undefined;
	try {
		catalog = await Catalog.open(context);
		catalog.removeOrganisation(slugOf(name));
	} catch {
		// Nothing to forget.
	} finally {
		catalog?.close();
	}
	refresh();
}

/** Whether the stored token is accepted, and what allowance is left — the two things a refusal is made of. */async function testToken(context: vscode.ExtensionContext): Promise<void> {
const token = await tokenOf(context);
let response: Response;
try {
response = await fetch('https://api.github.com/rate_limit', {
headers: {
'user-agent': 'temco-platform',
accept: 'application/vnd.github+json',
...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
},
});
} catch (error) {
void vscode.window.showWarningMessage(
`Temco Repositories: GitHub could not be reached (${error instanceof Error ? error.message : String(error)}).`
);
return;
}
if (!response.ok) {
void vscode.window.showWarningMessage(
`Temco Repositories: GitHub answered ${response.status} for the rate limit, so the ${token === undefined ? 'anonymous' : 'stored'} token does not work.`
);
return;
}
const body = (await response.json()) as {
resources?: { core?: { remaining?: number; limit?: number; reset?: number } };
};
const core = body.resources?.core;
const remaining = core?.remaining ?? 0;
const limit = core?.limit ?? 0;
const reset = core?.reset ?? 0;
const when = reset > 0 ? ` It resets at ${new Date(reset * 1000).toLocaleTimeString()}.` : '';
void vscode.window.showInformationMessage(
`Temco Repositories: ${remaining} of ${limit} requests left ${token === undefined ? 'anonymously — no token is stored' : 'with the stored token'}.${when}`
);
}