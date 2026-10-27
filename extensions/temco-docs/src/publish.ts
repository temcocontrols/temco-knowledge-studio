// Publishing a project's site to GitHub Pages.
//
// The site is built here, inside the editor, because the generator reads the documentation registry — which only exists in
// this extension. So publishing is a git operation, not a CI one: a build is committed to a `gh-pages` branch with a plain
// push. Never a forced one: if the branch carries work this build does not know about, that is a fact to report, not
// something to erase.

import { execFile } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { git } from './git';
import { PagesTarget, pagesTarget } from './pages';
import { DocsRoot } from './registry';
import { generateSite } from './site';

/** The branch GitHub Pages serves, and the only branch this command ever writes. */
const BRANCH = 'gh-pages';

export function registerPublishCommands(
	context: vscode.ExtensionContext,
	roots: () => readonly DocsRoot[],
	output: vscode.OutputChannel
): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('temcoDocs.publishSite', async () => {
			const root = await pick(roots());
			if (root === undefined) {
				return;
			}
			const target = await pagesTarget(root.folder.uri);
			if (target === undefined) {
				void vscode.window.showWarningMessage(
					'Temco Docs: this folder is not a git repository with a GitHub `origin`, so there is nowhere to publish to.'
				);
				return;
			}

			await vscode.window.withProgress(
				{ location: vscode.ProgressLocation.Notification, title: 'Publishing the documentation site' },
				async progress => {
					progress.report({ message: 'building' });
					const site = await generateSite(root, { project: root.folder.name, base: target.base });
					if (site.pages === 0) {
						void vscode.window.showWarningMessage(
							`Temco Docs: ${root.folder.name} has no pages marked for publishing, so there is nothing to publish.`
						);
						return;
					}
					for (const warning of site.warnings) {
						output.appendLine(`[publish] ${warning}`);
					}

					progress.report({ message: 'committing' });
					const failure = await publish(target, site.destination, output);
					if (failure !== undefined) {
						output.appendLine(`[publish] ${failure}`);
						void vscode.window.showErrorMessage(`Temco Docs: nothing was published — ${failure}`);
						return;
					}

					progress.report({ message: 'switching Pages on' });
					const pages = await enablePages(target);
					output.appendLine(`[publish] ${site.pages} page(s) → ${target.owner}/${target.repo}@${BRANCH}`);
					output.appendLine(`[publish] ${target.base}`);
					void vscode.window.showInformationMessage(
						pages
							? `Temco Docs: published. GitHub Pages is on — ${target.base} can take a minute to update.`
							: `Temco Docs: published to the ${BRANCH} branch. Turn Pages on once: Settings → Pages → Source: branch “${BRANCH}”, folder “/”.`
					);
				}
			);
		})
	);
}

/**
 * Commit the built site to the publishing branch and push it.
 *
 * The commit is made in a throwaway repository whose only parent is the branch's current tip, so the push is a normal
 * fast-forward and the project's own working tree is never touched — no stash, no checkout, no branch left switched.
 * Returns why it stopped, or undefined when the push went through.
 *
 * Exported for `check-publish.mts`, which runs it against a real bare repository: this is the one part of the module that
 * writes to a branch somebody else may have pushed to, so "it compiles" is not evidence enough.
 */
export async function publish(target: PagesTarget, site: vscode.Uri, output: vscode.OutputChannel): Promise<string | undefined> {
	// The remote's URL, not the local path: the push has to land on GitHub, not on a branch of the local repository.
	const url = (await git(target.root, ['remote', 'get-url', 'origin']).catch(() => '')).trim();
	if (url === '') {
		return 'the repository has no `origin` remote';
	}
	const author = await identity(target.root);
	const work = vscode.Uri.joinPath(vscode.Uri.file(os.tmpdir()), `temco-docs-${Date.now().toString(36)}`);

	try {
		await vscode.workspace.fs.createDirectory(work);
		const cwd = work.fsPath;
		await git(cwd, ['init', '--quiet']);

		// The branch as it exists on GitHub, when it does: its tip becomes the parent of this build's commit, which is
		// what makes the push a fast-forward. A branch that does not exist yet starts from an orphan.
		const exists = await git(cwd, ['fetch', '--quiet', url, `${BRANCH}:${BRANCH}`]).then(
			() => true,
			() => false
		);
		if (exists) {
			await git(cwd, ['checkout', '--quiet', BRANCH]);
			for (const [name] of await vscode.workspace.fs.readDirectory(work)) {
				if (name !== '.git') {
					await vscode.workspace.fs.delete(vscode.Uri.joinPath(work, name), { recursive: true, useTrash: false });
				}
			}
		} else {
			await git(cwd, ['checkout', '--quiet', '--orphan', BRANCH]);
		}

		await copy(site, work);
		await git(cwd, ['add', '--all']);
		await git(cwd, [
			'-c',
			`user.name=${author.name}`,
			'-c',
			`user.email=${author.email}`,
			'commit',
			'--quiet',
			'--message',
			`Publish the documentation site (${new Date().toISOString().slice(0, 16).replace('T', ' ')})`
		]);
		output.appendLine(`[publish] committing in ${cwd}`);
		await git(cwd, ['push', '--quiet', url, `${BRANCH}:${BRANCH}`]);
		return undefined;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		// A rejected push means the branch has commits this build does not; the reader is told rather than overruled.
		return /rejected|non-fast-forward/iu.test(message) ? `the ${BRANCH} branch has changes that are not in this build` : message;
	} finally {
		await vscode.workspace.fs.delete(work, { recursive: true, useTrash: false }).then(undefined, () => undefined);
	}
}

/** Who the commit is by: the project's own git identity, so the branch reads as the person who published. */
async function identity(root: string): Promise<{ name: string; email: string }> {
	const name = (await git(root, ['config', 'user.name']).catch(() => '')).trim();
	const email = (await git(root, ['config', 'user.email']).catch(() => '')).trim();
	return {
		name: name === '' ? 'Temco Docs' : name,
		email: email === '' ? 'temco-docs@users.noreply.github.com' : email
	};
}

/** Every file under `from`, written to the same relative place under `to`. */
async function copy(from: vscode.Uri, to: vscode.Uri): Promise<void> {
	await vscode.workspace.fs.createDirectory(to);
	for (const [name, kind] of await vscode.workspace.fs.readDirectory(from)) {
		const source = vscode.Uri.joinPath(from, name);
		const target = vscode.Uri.joinPath(to, name);
		if (kind === vscode.FileType.Directory) {
			await copy(source, target);
		} else if (kind === vscode.FileType.File) {
			await vscode.workspace.fs.copy(source, target, { overwrite: true });
		}
	}
}

/**
 * Point Pages at the publishing branch.
 *
 * `gh` is optional: when it is not installed, or not signed in, the caller prints the two clicks in Settings instead of
 * pretending the site is live. Returns whether Pages was configured here.
 */
async function enablePages(target: PagesTarget): Promise<boolean> {
	const args = [
		'api',
		'-X',
		'POST',
		`repos/${target.owner}/${target.repo}/pages`,
		'-f',
		`source[branch]=${BRANCH}`,
		'-f',
		'source[path]=/'
	];
	const run = (command: readonly string[]) =>
		new Promise<void>((resolve, reject) => {
			execFile('gh', [...command], { windowsHide: true }, error => (error === null ? resolve() : reject(error)));
		});
	try {
		await run(args);
		return true;
	} catch {
		// Already on: the update is the same request with PUT, and a repository that had Pages configured before this
		// build is the common case, not an error.
		try {
			await run(['api', '-X', 'PUT', ...args.slice(3)]);
			return true;
		} catch {
			return false;
		}
	}
}

async function pick(roots: readonly DocsRoot[]): Promise<DocsRoot | undefined> {
	if (roots.length === 0) {
		void vscode.window.showWarningMessage('Temco Docs: no documentation folder is open in this workspace.');
		return undefined;
	}
	if (roots.length === 1) {
		return roots[0];
	}
	const chosen = await vscode.window.showQuickPick(
		roots.map(root => ({ label: root.folder.name, description: path.basename(root.rootUri.fsPath), root })),
		{ placeHolder: 'Publish the site for which documentation folder?' }
	);
	return chosen?.root;
}
