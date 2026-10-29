// Temco Learn — the site, from the inside.
//
// Authoring lives in `temco-docs`: it owns the registry, the editor and the build. This module owns what a reader gets:
// the site folder in the working area, the app copied into it, the data that says what is on it, the preview inside the
// editor, and the commit that publishes it. One direction only — this module calls `temcoDocs.buildSite` when it needs
// a build; `temco-docs` never calls back.

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Preview } from './preview';
import { publishSite } from './publish';
import { Server } from './server';
import { addVersion, appFolder, installSite, projectNameOf, readSite, siteFolder, slugOf, workRoot } from './site';
import { SiteTree, VIEW_ID } from './tree';

export function activate(context: vscode.ExtensionContext): void {
	const server = new Server();
	const preview = new Preview();
	const tree = new SiteTree(() => readSite(siteFolder()));
	const view = vscode.window.createTreeView(VIEW_ID, { treeDataProvider: tree, showCollapseAll: false });
	const output = vscode.window.createOutputChannel('Temco Learn');

	/** The site folder with the app in it, ready to serve. Made on first use — it is a folder, not a question. */
	const prepare = async (): Promise<string> => installSite(siteFolder(), appFolder(context));

	/** Serve the site and show it here: the one loop this module exists for. */
	const open = async (page = 'index.html'): Promise<void> => {
		try {
			const root = await prepare();
			const base = await server.serve(root);
			preview.show(`${base}${page}`, 'Temco Learn', { onClose: () => server.stop() });
			tree.refresh();
		} catch (error) {
			void vscode.window.showErrorMessage(
				`Temco Learn: the site could not be served — ${error instanceof Error ? error.message : String(error)}`
			);
		}
	};

	/**
	 * Add a build to the site.
	 *
	 * Three of the four answers are facts on disk: which build is newest, the project's name in the build's own index,
	 * and the section it is already listed under. The version is the one thing a person knows and the folder cannot, so
	 * it is the only question asked.
	 */
	const add = async (): Promise<void> => {
		const builds = await buildFolders();
		if (builds.length === 0) {
			void vscode.window.showWarningMessage(
				'Temco Learn: there is no build to add. Run Build first — a site project is a folder with an index.html in it.'
			);
			return;
		}
		const chosen =
			builds.length === 1
				? builds[0]
				: await vscode.window.showQuickPick(
						builds.map((folder) => ({
							label: path.basename(path.dirname(path.dirname(folder))),
							description: folder,
							folder
						})),
						{ title: 'Add a build to the site', placeHolder: 'Which build?' }
					).then((picked) => picked?.folder);
		if (chosen === undefined) {
			return;
		}

		const folderName = path.basename(path.dirname(path.dirname(chosen)));
		const title = (await projectNameOf(chosen)) ?? folderName;
		const id = slugOf(title);
		const site = await readSite(siteFolder());
		const existing = site.projects.find((project) => project.id === id);
		const version = await vscode.window.showInputBox({
			title: `Add ${title} to the site`,
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

		const root = await prepare();
		try {
			const added = await addVersion({
				root,
				app: appFolder(context),
				id,
				title,
				section: existing?.section,
				version: version.trim(),
				built: chosen
			});
			tree.refresh();
			const answer = await vscode.window.showInformationMessage(
				`Temco Learn: ${title} ${added.version} is on the site — ${String(added.pages)} page(s).`,
				'Preview'
			);
			if (answer === 'Preview') {
				await open(
					`reader.html?id=${encodeURIComponent(id)}&version=${encodeURIComponent(added.version)}`
				);
			}
		} catch (error) {
			void vscode.window.showErrorMessage(
				`Temco Learn: the build could not be added — ${error instanceof Error ? error.message : String(error)}`
			);
		}
	};

	context.subscriptions.push(
		server,
		preview,
		tree,
		view,
		output,

		vscode.commands.registerCommand('temcoLearn.preview', async (args?: { page?: string }) => {
			await open(args?.page ?? 'index.html');
		}),

		// A build belongs to the authoring module: the site never builds anything itself.
		vscode.commands.registerCommand('temcoLearn.build', async () => {
			await vscode.commands.executeCommand('temcoDocs.buildSite');
			tree.refresh();
		}),

		vscode.commands.registerCommand('temcoLearn.assemble', add),

		vscode.commands.registerCommand('temcoLearn.refresh', async () => {
			await prepare().catch(() => undefined);
			tree.refresh();
		}),

		vscode.commands.registerCommand('temcoLearn.open', async () => {
			const url = preview.current;
			if (url !== undefined) {
				await vscode.env.openExternal(vscode.Uri.parse(url));
			}
		}),

		// The whole site, published: the folder is the repository, and the push is all there is to it.
		vscode.commands.registerCommand('temcoLearn.publish', async () => {
			try {
				const root = await prepare();
				const published = await vscode.window.withProgress(
					{ location: vscode.ProgressLocation.Notification, title: 'Publishing the Temco Learn site' },
					async () => publishSite(root, output)
				);
				output.show(true);
				const answer = await vscode.window.showInformationMessage(
					published.unchanged
						? `Temco Learn: nothing had changed — ${published.commit} is already on gh-pages. The site is at ${published.base}`
						: `Temco Learn: published ${String(published.files)} path(s) as ${published.commit}. ${published.base} can take a minute to update.`,
					'Open the Site'
				);
				if (answer === 'Open the Site') {
					await vscode.env.openExternal(vscode.Uri.parse(published.base));
				}
			} catch (error) {
				void vscode.window.showErrorMessage(
					`Temco Learn: nothing was published — ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}),

		vscode.commands.registerCommand('temcoLearn.stop', () => {
			server.stop();
		})
	);
}

/** Every folder a build could have written: `<project>/dist/site` beside a workspace folder and in the working area. */
async function buildFolders(): Promise<string[]> {
	const roots = new Set<string>([
		...(vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath),
		workRoot()
	]);
	const found: { folder: string; at: number }[] = [];
	for (const root of roots) {
		for (const candidate of [
			path.join(root, 'dist', 'site'),
			...(await subfolders(root)).map((name) => path.join(root, name, 'dist', 'site'))
		]) {
			if (!fs.existsSync(path.join(candidate, 'index.html'))) {
				continue;
			}
			found.push({ folder: candidate, at: fs.statSync(candidate).mtimeMs });
		}
	}
	return found.sort((one, other) => other.at - one.at).map((entry) => entry.folder);
}

async function subfolders(root: string): Promise<string[]> {
	try {
		return (await fs.promises.readdir(root, { withFileTypes: true }))
			.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
			.map((entry) => entry.name);
	} catch {
		return [];
	}
}

export function deactivate(): void {
	// Everything above is a subscription on the context.
}
