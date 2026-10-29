// Temco Learn — the site, from the inside.
//
// Authoring lives in `temco-docs`: it owns the registry, the editor and the build. This module owns what a reader gets:
// the site folder in the working area, the app copied into it, the data that says what is on it, the preview inside the
// editor, and the commit that publishes it. One direction only — this module calls `temcoDocs.buildSite` when it needs
// a build; `temco-docs` never calls back.
//
// Every answer this module gives lands in the preview's own strip, next to the site it is about. Nothing is announced in
// a notification: a person who pressed Add or Publish is already looking at the preview, and a corner message that
// disappears is not where a version number belongs.

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { findArtifacts } from './artifacts';
import { Build, findBuilds } from './builds';
import { OverviewPage } from './overview';
import { Preview } from './preview';
import { publishSite } from './publish';
import { Server } from './server';
import { addVersion, appFolder, installSite, readSite, siteFolder } from './site';
import { Snapshot } from './snapshot';
import { readPublishedState } from './state';
import { BrowseTree, DownloadTree, OverviewTree, Reads, TodoTree, VIEWS } from './tree';

const plural = (count: number, one: string, many?: string): string =>
	`${count} ${count === 1 ? one : many === undefined ? `${one}s` : many}`;

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export function activate(context: vscode.ExtensionContext): void {
	const server = new Server();
	const preview = new Preview();
	const output = vscode.window.createOutputChannel('Temco Learn');
	const readSnapshot = async (): Promise<Snapshot> => {
		const root = siteFolder();
		return {
			site: await readSite(root),
			builds: await findBuilds(),
			artifacts: await findArtifacts(),
			published: await readPublishedState(root)
		};
	};
	const reads = new Reads(readSnapshot);
	const overview = new OverviewPage(readSnapshot);
	const overviewTree = new OverviewTree();
	const browseTree = new BrowseTree(reads);
	const downloadTree = new DownloadTree(reads);
	const todoTree = new TodoTree(reads);
	// One view per group: VS Code draws the header, the separator and the collapse state, which is the grouping a
	// person already knows from the Explorer.
	const todoView = vscode.window.createTreeView(VIEWS.todo, { treeDataProvider: todoTree });
	const views = [
		vscode.window.createTreeView(VIEWS.overview, { treeDataProvider: overviewTree }),
		vscode.window.createTreeView(VIEWS.browse, { treeDataProvider: browseTree }),
		vscode.window.createTreeView(VIEWS.download, { treeDataProvider: downloadTree }),
		todoView
	];

	/** Both surfaces read the same facts, so both are re-read together: a panel and a page that disagree is a bug. */
	const refresh = (): void => {
		reads.forget();
		overviewTree.refresh();
		browseTree.refresh();
		downloadTree.refresh();
		todoTree.refresh();
		overview.refresh();
	};

	/** The site folder with the app in it, ready to serve. Made on first use — it is a folder, not a question. */
	const prepare = async (): Promise<string> => installSite(siteFolder(), appFolder(context));

	const showLog = { label: 'Show the log', run: () => output.show(true) };

	/** The file a row names, whether it arrived as a path or as the row itself. */
	const fileOf = (target: unknown): string | undefined => {
		if (typeof target === 'string') {
			return target;
		}
		const file = (target as { file?: unknown } | undefined)?.file;
		return typeof file === 'string' ? file : undefined;
	};

	/** Look at what a build wrote: a folder is the website itself, served here; a file opens in whatever reads it. */
	const previewArtifact = async (file: string | undefined): Promise<void> => {
		if (file === undefined) {
			return;
		}
		try {
			const stats = await fs.promises.stat(file);
			if (stats.isDirectory()) {
				const base = await server.serve(file);
				preview.show(`${base}index.html`, `Temco Learn — ${path.basename(file)}`, { onClose: () => server.stop() });
				return;
			}
			await vscode.env.openExternal(vscode.Uri.file(file));
		} catch (error) {
			output.appendLine(`[preview] ${reason(error)}`);
			preview.note('error', `That file could not be opened — ${reason(error)}`, showLog);
		}
	};

	/** Take a copy of what a build wrote, where the person asks for it. */
	const saveCopy = async (file: string | undefined): Promise<void> => {
		if (file === undefined) {
			return;
		}
		const name = path.basename(file);
		const chosen = await vscode.window.showSaveDialog({ saveLabel: 'Save a Copy', defaultUri: vscode.Uri.file(path.join(process.env.USERPROFILE ?? '', name)) });
		if (chosen === undefined) {
			return;
		}
		try {
			await fs.promises.copyFile(file, chosen.fsPath);
			preview.note('info', `Saved ${name} to ${chosen.fsPath}.`);
		} catch (error) {
			output.appendLine(`[save] ${reason(error)}`);
			preview.note('error', `${name} could not be saved — ${reason(error)}`, showLog);
		}
	};

	/** Show the file where it lives, which is what "download" means in a desktop application. */
	const reveal = async (file: string | undefined): Promise<void> => {
		if (file !== undefined) {
			await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(file));
		}
	};

	/** Serve the site and show it here: the one loop this module exists for. */
	const open = async (page = 'index.html'): Promise<void> => {
		try {
			const root = await prepare();
			const base = await server.serve(root);
			preview.show(`${base}${page}`, 'Temco Learn', { onClose: () => server.stop() });
			refresh();
		} catch (error) {
			output.appendLine(`[serve] ${reason(error)}`);
			preview.note('error', `The site could not be served — ${reason(error)}`, showLog);
		}
	};

	/**
	 * Add a build to the site.
	 *
	 * Three of the four answers are facts on disk: which build is newest, the project's name in the build's own index,
	 * and the section it is already listed under. The version is the one thing a person knows and the folder cannot, so
	 * it is the only question asked.
	 */
	const add = async (folder?: string): Promise<void> => {
		const builds = await findBuilds();
		if (builds.length === 0) {
			preview.note(
				'warn',
				'Nothing to add: no build was found. Build a project first — a build is a folder with an index.html in it.',
				{ label: 'Build', run: () => vscode.commands.executeCommand('temcoDocs.buildSite') }
			);
			return;
		}
		const chosen =
			folder === undefined
				? builds.length === 1
					? builds[0]
					: await pickBuild(builds)
				: builds.find((build) => build.folder === folder);
		if (chosen === undefined) {
			if (folder !== undefined) {
				preview.note('warn', 'That build is no longer on disk. Refresh the panel and pick another one.');
			}
			return;
		}

		const site = await readSite(siteFolder());
		const existing = site.projects.find((project) => project.id === chosen.id);
		const version = await vscode.window.showInputBox({
			title: `Add ${chosen.title} to the site`,
			prompt: 'The version this build is',
			value: existing?.versions[0]?.version ?? '1.0',
			validateInput: (value) =>
				/^[0-9A-Za-z][0-9A-Za-z._+-]*$/.test(value.trim())
					? undefined
					: 'A version is letters, digits and . _ + - (it becomes a folder name).'
		});
		if (version === undefined || version.trim() === '') {
			return;
		}

		try {
			const root = await prepare();
			const added = await addVersion({
				root,
				app: appFolder(context),
				id: chosen.id,
				title: chosen.title,
				section: existing?.section,
				version: version.trim(),
				built: chosen.folder
			});
			refresh();
			preview.note(
				'info',
				`${chosen.title} ${added.version} is on the site — ${plural(added.pages, 'page')}. Nothing is published until you publish.`
			);
			await open(`reader.html?id=${encodeURIComponent(chosen.id)}&version=${encodeURIComponent(added.version)}`);
		} catch (error) {
			output.appendLine(`[add] ${reason(error)}`);
			preview.note('error', `The build could not be added — ${reason(error)}`, showLog);
		}
	};

	/** Commit the folder and push it at `gh-pages`, saying how it went in the strip. */
	const publish = async (): Promise<void> => {
		preview.note('progress', 'Publishing the site…');
		try {
			const root = await prepare();
			const published = await publishSite(root, output);
			refresh();
			const openSite = { label: 'Open the Site', run: () => vscode.env.openExternal(vscode.Uri.parse(published.base)) };
			preview.note(
				'info',
				published.unchanged
					? `Nothing had changed — ${published.commit ?? 'the last commit'} is already on ${published.base}.`
					: `Published ${plural(published.files, 'path')} as ${published.commit} · ${published.base} (a minute to appear).`,
				openSite
			);
		} catch (error) {
			output.appendLine(`[publish] ${reason(error)}`);
			preview.note('error', `Nothing was published — ${reason(error)}`, showLog);
		}
	};

	context.subscriptions.push(
		server,
		preview,
		overview,
		...views,
		output,

		// The module's own page: what it is for, the three steps, and where the website goes. Never the website itself.
		vscode.commands.registerCommand('temcoLearn.overview', () => {
			overview.open();
		}),

		vscode.commands.registerCommand('temcoLearn.preview', async (args?: { page?: string }) => {
			await open(args?.page ?? 'index.html');
		}),

		// A build belongs to the authoring module, so this opens the Build Center rather than inventing a second one.
		vscode.commands.registerCommand('temcoLearn.build', async () => {
			await vscode.commands.executeCommand('temcoDocs.builds');
		}),

		vscode.commands.registerCommand('temcoLearn.addBuild', async (folder?: unknown) => {
			await add(typeof folder === 'string' ? folder : undefined);
		}),

		// Adding a build never asks which one in a picker: the panel lists them, and a row there adds it. The view is
		// brought forward with the waiting group open, so the act the page promised is one click away.
		vscode.commands.registerCommand('temcoLearn.addBuilds', async () => {
			await vscode.commands.executeCommand(`${VIEWS.todo}.focus`);
			const waiting = (await todoTree.getChildren()).find((entry) => entry.id === 'temcoLearn.todo.builds');
			if (waiting !== undefined) {
				await todoView.reveal(waiting, { expand: true, select: false, focus: false });
			}
		}),

		vscode.commands.registerCommand('temcoLearn.assemble', async () => {
			await add();
		}),

		vscode.commands.registerCommand('temcoLearn.publish', publish),

		vscode.commands.registerCommand('temcoLearn.openPublished', async () => {
			const published = await readPublishedState(siteFolder());
			if (published.base === undefined) {
				preview.note('warn', 'There is no published address yet: the site folder points at no GitHub repository.', {
					label: 'Publish',
					run: publish
				});
				return;
			}
			await vscode.env.openExternal(vscode.Uri.parse(published.base));
		}),

		vscode.commands.registerCommand('temcoLearn.refresh', async () => {
			await prepare().catch(() => undefined);
			refresh();
		}),

		vscode.commands.registerCommand('temcoLearn.open', async () => {
			const url = preview.current;
			if (url !== undefined) {
				await vscode.env.openExternal(vscode.Uri.parse(url));
			}
		}),

		vscode.commands.registerCommand('temcoLearn.previewArtifact', (target?: unknown) => previewArtifact(fileOf(target))),

		vscode.commands.registerCommand('temcoLearn.downloadArtifact', async (target?: unknown) => {
			await saveCopy(fileOf(target));
		}),

		vscode.commands.registerCommand('temcoLearn.revealArtifact', async (target?: unknown) => {
			await reveal(fileOf(target));
		}),

		vscode.commands.registerCommand('temcoLearn.stop', () => {
			server.stop();
		})
	);
}

/** Which build, when the panel's own rows did not say: the same two facts the rows show, in a picker. */
async function pickBuild(builds: readonly Build[]): Promise<Build | undefined> {
	const picked = await vscode.window.showQuickPick(
		builds.map((build) => ({ label: build.title, description: build.folder, build })),
		{ title: 'Add a build to the site', placeHolder: 'Which build?' }
	);
	return picked?.build;
}

export function deactivate(): void {
	// Everything above is a subscription on the context.
}
