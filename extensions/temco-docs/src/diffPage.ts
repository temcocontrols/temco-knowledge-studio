// The page against its last commit, in the editor's own diff.
//
// This is the tab that keeps the review honest: it is not a picture of what changed, it is `vscode.diff` showing the
// file git has and the file in front, so the hunks here are the hunks the pull request will carry.
//
// The right-hand side is the editor's buffer, not the file on disk, so an unsaved change is part of the diff — which
// is what a person pressing *Diff* while writing expects. Nothing is written and nothing is staged.

import { execFile } from 'child_process';
import { createHash } from 'crypto';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

/** Largest file this will ask git for, so a stray binary cannot be read into memory and shown as text. */
const LIMIT = 32 * 1024 * 1024;

/** The head snapshots written for open diffs, so each one can be removed when its tab closes. */
const snapshots = new Set<string>();

export function registerDiffCommand(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('temcoDocs.diffPage', (target?: unknown) => diff(target, context)),
		vscode.workspace.onDidCloseTextDocument((document) => {
			if (!snapshots.delete(document.uri.toString())) {
				return;
			}
			void vscode.workspace.fs.delete(document.uri);
		})
	);
}

/**
 * Opens the diff for the file in front — or for the row it was invoked from.
 *
 * Every failure is a sentence about why there is no diff rather than an empty tab: no workspace, no repository, a
 * file that HEAD has never seen.
 */
async function diff(target: unknown, context: vscode.ExtensionContext): Promise<void> {
	const uri = uriOf(target);
	if (uri === undefined) {
		void vscode.window.showInformationMessage(
			'Temco Docs: open a page first — a diff compares the file in front with its last commit.'
		);
		return;
	}
	const head = await committed(uri);
	if (head === undefined) {
		return;
	}
	const left = await snapshot(head, uri, context);
	if (left === undefined) {
		void vscode.window.showErrorMessage('Temco Docs: the last commit could not be written to a temporary file.');
		return;
	}
	snapshots.add(left.toString());
	await vscode.commands.executeCommand(
		'vscode.diff',
		left,
		uri,
		`${path.basename(uri.fsPath)} ↔ HEAD`,
		{ preview: true, preserveFocus: false }
	);
}

/** The URI the command was aimed at: a row, a URI, or whatever editor is in front. */
function uriOf(target: unknown): vscode.Uri | undefined {
	if (target instanceof vscode.Uri) {
		return target;
	}
	if (typeof target === 'object' && target !== null) {
		const candidate = (target as { uri?: unknown }).uri;
		if (candidate instanceof vscode.Uri) {
			return candidate;
		}
	}
	const document = vscode.window.activeTextEditor?.document;
	return document === undefined || document.uri.scheme !== 'file' ? undefined : document.uri;
}

/** What HEAD holds for this file, or a sentence saying why there is nothing to compare. */
async function committed(uri: vscode.Uri): Promise<string | undefined> {
	if (uri.scheme !== 'file') {
		void vscode.window.showInformationMessage('Temco Docs: only a file on disk can be compared with a commit.');
		return undefined;
	}
	const folder = vscode.workspace.getWorkspaceFolder(uri);
	if (folder === undefined) {
		void vscode.window.showInformationMessage(
			'Temco Docs: this file is outside the workspace, so there is no repository to compare it with.'
		);
		return undefined;
	}

	let root = '';
	try {
		root = (await git(folder.uri.fsPath, ['rev-parse', '--show-toplevel'])).trim();
	} catch (error) {
		void vscode.window.showInformationMessage(
			`Temco Docs: this folder is not a git repository, so there is nothing to compare it with. ${
				error instanceof Error ? error.message : String(error)
			}`
		);
		return undefined;
	}

	const relative = path.relative(root, uri.fsPath).split(path.sep).join('/');
	try {
		return await git(root, ['show', `HEAD:${relative}`]);
	} catch {
		void vscode.window.showInformationMessage(
			`Temco Docs: ${path.basename(uri.fsPath)} is not in HEAD yet, so the whole page is the change.`
		);
		return undefined;
	}
}

/** HEAD's text written where the diff editor can read it, under the extension's own storage. */
async function snapshot(content: string, uri: vscode.Uri, context: vscode.ExtensionContext): Promise<vscode.Uri | undefined> {
	const base = context.storageUri ?? context.globalStorageUri ?? vscode.Uri.file(os.tmpdir());
	const key = createHash('sha1').update(uri.toString()).digest('hex').slice(0, 12);
	const folder = vscode.Uri.joinPath(base, 'head', key);
	try {
		await vscode.workspace.fs.createDirectory(folder);
		const target = vscode.Uri.joinPath(folder, path.basename(uri.fsPath));
		await vscode.workspace.fs.writeFile(target, Buffer.from(content, 'utf8'));
		return target;
	} catch {
		return undefined;
	}
}

/** One git command, its standard output, and a rejection that keeps the message people need to read. */
function git(cwd: string, args: readonly string[]): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		execFile('git', ['-C', cwd, ...args], { maxBuffer: LIMIT, windowsHide: true }, (error, stdout, stderr) => {
			if (error !== null) {
				const detail = stderr.trim();
				reject(new Error(detail.length > 0 ? detail : error.message));
				return;
			}
			resolve(stdout);
		});
	});
}
