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
import { registerReadCommands } from './read';
import { CodeFile, Material, RepositorySource, codeFiles, readMaterials } from './repository';
import { RepositoriesPage } from './repositoriesPage';
import { OFFERED_SCRIPTS, OfferedScript } from './scripts';
import { registerSourcesView } from './sourcesView';
import { selection } from './store';
import { registerWorkareaCommands } from './workarea';

/** What this module offers the rest of the platform. */
export interface TemcoRepositoriesApi {
	/** Fires when the catalog changed in a way another surface shows: a source added, read, or forgotten. */
	onDidChange(listener: () => void): vscode.Disposable;
	/** The code files a source carries, relative to its own root — on disk, or through the API. */
	codeFiles(source: RepositorySource): Promise<{ files: CodeFile[]; note?: string }>;
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
	context.subscriptions.push(
		{ dispose: () => repositories.dispose() },
		vscode.commands.registerCommand('temcoRepositories.page', () => repositories.open())
	);

	// Reading a source, and the token that reaches one.
	registerReadCommands(context, selection, output, refresh);
	// The working area: cloning a source so its files can be read, and pulling it when it has moved on.
	registerWorkareaCommands(context, selection, output, refresh);

	// The panel: what the platform records, with the actions each row offers. It refreshes on the same signal every
	// other surface does, so a read started from a command shows up here as soon as it finishes.
	registerSourcesView(context, changed.event);

	return {
		onDidChange: (listener: () => void) => changed.event(listener),
		codeFiles: (source) => codeFiles(context, source),
		readMaterials: (source, files, limit) => readMaterials(context, source, files, limit),
		offeredScripts: OFFERED_SCRIPTS,
	};
}

export function deactivate(): void {
	// Nothing to unwind: every command is registered on the extension's own context, and the output channel with
	// it. A git process that was already running finishes on its own; nothing is left holding the window open.
}
