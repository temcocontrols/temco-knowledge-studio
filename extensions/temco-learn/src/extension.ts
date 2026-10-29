// Temco Learn — the site, from the inside.
//
// Authoring lives in `temco-docs`: it owns the registry, the editor and the build. This module owns what a reader gets:
// the folder the site lives in, the pages that hold its products, the reader for each version, the preview inside the
// editor, and the commit that publishes it. One direction only — this module calls `temcoDocs.buildSite` when it needs
// a build; `temco-docs` never calls back.

import * as path from 'path';
import * as vscode from 'vscode';
import { SECTIONS } from './portal';
import { Preview } from './preview';
import { publishSite } from './publish';
import { Server } from './server';
import { addBuild, readProducts, rememberSite, siteRoot, writePages } from './site';
import { SiteTree, VIEW_ID } from './tree';

export function activate(context: vscode.ExtensionContext): void {
	const server = new Server();
	const preview = new Preview();
	const tree = new SiteTree(() => siteRoot(context));
	const view = vscode.window.createTreeView(VIEW_ID, { treeDataProvider: tree, showCollapseAll: true });
	/** The module's own `site/` folder: the stylesheet every page is written against. */
	const assets = path.join(context.extensionUri.fsPath, 'site');

	/** The site folder, or a message that says what is missing. */
	const rootOrWarn = (): string | undefined => {
		const root = siteRoot(context);
		if (root === undefined) {
			void vscode.window.showWarningMessage(
				'Temco Learn: no site folder is set. Choose the folder that holds the published site (the `docs` repository).',
				'Choose Folder'
			).then((answer) => {
				if (answer === 'Choose Folder') {
					void vscode.commands.executeCommand('temcoLearn.chooseSite');
				}
			});
		}
		return root;
	};

	context.subscriptions.push(
		server,
		preview,
		tree,
		view,

		vscode.commands.registerCommand('temcoLearn.chooseSite', async () => {
			const picked = await vscode.window.showOpenDialog({
				canSelectFolders: true,
				canSelectFiles: false,
				canSelectMany: false,
				openLabel: 'Use as the site folder',
				title: 'The folder that holds the published site'
			});
			const folder = picked?.[0];
			if (folder === undefined) {
				return;
			}
			await rememberSite(context, folder.fsPath);
			tree.refresh();
			void vscode.window.showInformationMessage(`Temco Learn: the site is ${folder.fsPath}.`);
		}),

		// Preview is the loop the whole module exists for: serve the folder, then look at it here.
		vscode.commands.registerCommand('temcoLearn.preview', async (args?: { page?: string }) => {
			const root = rootOrWarn();
			if (root === undefined) {
				return;
			}
			try {
				const base = await server.serve(root);
				const page = args?.page ?? 'index.html';
				preview.show(`${base}${page}`, 'Temco Learn', { onClose: () => server.stop() });
			} catch (error) {
				void vscode.window.showErrorMessage(
					`Temco Learn: the site could not be served — ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}),

		vscode.commands.registerCommand('temcoLearn.open', async (args?: { url?: string }) => {
			const url = args?.url ?? preview.current;
			if (url !== undefined) {
				await vscode.env.openExternal(vscode.Uri.parse(url));
			}
		}),

		vscode.commands.registerCommand('temcoLearn.refresh', async () => {
			const root = siteRoot(context);
			if (root !== undefined) {
				await writePages(root, assets);
			}
			tree.refresh();
		}),

		// Adding a build is the whole publishing model in one place: a folder, a name, a version, a section.
		vscode.commands.registerCommand('temcoLearn.assemble', async () => {
			const root = rootOrWarn();
			if (root === undefined) {
				return;
			}
			const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
			const built = await vscode.window.showInputBox({
				title: 'Add a build to the site',
				prompt: 'The folder a build wrote — the one with index.html in it',
				value: workspace === undefined ? '' : path.join(workspace, 'dist', 'site')
			});
			if (built === undefined || built.trim() === '') {
				return;
			}
			const fallback = workspace === undefined ? '' : path.basename(workspace).toLowerCase().replace(/[^a-z0-9]+/g, '-');
			const id = await vscode.window.showInputBox({
				title: 'Add a build to the site',
				prompt: 'The product folder — its address, e.g. t3000',
				value: fallback
			});
			if (id === undefined || id.trim() === '') {
				return;
			}
			const title = await vscode.window.showInputBox({
				title: 'Add a build to the site',
				prompt: 'The product name, as a reader sees it',
				value: id
			});
			if (title === undefined) {
				return;
			}
			const version = await vscode.window.showInputBox({
				title: 'Add a build to the site',
				prompt: 'The version this build is',
				value: '1.0'
			});
			if (version === undefined || version.trim() === '') {
				return;
			}
			const section = await vscode.window.showQuickPick(
				SECTIONS.map((entry) => ({ label: entry.title, id: entry.id })),
				{ title: 'Add a build to the site', placeHolder: 'Which section lists this product?' }
			);
			if (section === undefined) {
				return;
			}
			try {
				const added = await addBuild({
					root,
					assets,
					id: id.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
					title: title.trim() === '' ? id.trim() : title.trim(),
					section: section.id,
					version: version.trim(),
					built: built.trim()
				});
				tree.refresh();
				const answer = await vscode.window.showInformationMessage(
					`Temco Learn: ${added.product.title} ${added.version} is on the site — ${added.pages} page(s).`,
					'Preview'
				);
				if (answer === 'Preview') {
					await vscode.commands.executeCommand('temcoLearn.preview', {
						page: `${encodeURIComponent(added.product.id)}/${encodeURIComponent(added.version)}/temco-reader.html`
					});
				}
			} catch (error) {
				void vscode.window.showErrorMessage(
					`Temco Learn: the build could not be added — ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}),

		// A build is a command away: the site never builds anything itself.
		vscode.commands.registerCommand('temcoLearn.build', async () => {
			await vscode.commands.executeCommand('temcoDocs.buildSite');
			const root = siteRoot(context);
			if (root !== undefined) {
				const products = await readProducts(root);
				if (products.length > 0) {
					await writePages(root, assets);
				}
			}
			tree.refresh();
		}),

		// The whole site, published: commit the folder and push it at the branch Pages serves.
		vscode.commands.registerCommand('temcoLearn.publish', async () => {
			const root = rootOrWarn();
			if (root === undefined) {
				return;
			}
			const output = vscode.window.createOutputChannel('Temco Learn');
			context.subscriptions.push(output);
			try {
				const published = await vscode.window.withProgress(
					{ location: vscode.ProgressLocation.Notification, title: 'Publishing the Temco Learn site' },
					async (progress) => {
						progress.report({ message: 'writing the pages' });
						await writePages(root, assets);
						progress.report({ message: 'committing and pushing' });
						return publishSite(root, output);
					}
				);
				output.show(true);
				const answer = await vscode.window.showInformationMessage(
					published.unchanged
						? `Temco Learn: nothing had changed — ${published.commit} is already on gh-pages. The site is at ${published.base}`
						: `Temco Learn: published ${published.files} path(s) as ${published.commit}. ${published.base} can take a minute to update.`,
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

export function deactivate(): void {
	// Everything above is a subscription on the context.
}
