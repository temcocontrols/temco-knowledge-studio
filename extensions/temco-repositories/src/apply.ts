/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Temco Controls. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// *Apply to the source* — a change that lands in a clone's working tree as an uncommitted patch.
//
// A draft is written beside the page it is for, and somebody has to decide where it lands. When the page lives in a
// clone the catalog knows, the answer is not "write the file": it is a patch through `git apply`, so the clone's own
// history decides — `git status` shows it, `git diff` explains it, and one Undo puts it back. The alternative, writing
// over the file, would leave a person with no record of what changed and nothing to reverse.
//
// The rules this file exists to hold:
//
//   **the dialog comes first** — nothing reaches a working tree until a person answers a modal question that says,
//   in the same sentence, where it goes and that it will not be committed;
//
//   **never a project's tree in passing** — a file outside every clone is refused here rather than written, because
//   that file belongs to the window the person is looking at, and the editor's own undo is the right handle for it;
//
//   **Undo is part of the act** — the patch that was applied is the patch that is reversed, so Undo cannot guess.

import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as pathModule from 'path';
import * as vscode from 'vscode';
import { Catalog } from './store';

/** What the write decided, as the caller has to know it: applied, refused, or not this module's business. */
export type ApplyOutcome =
	| { state: 'applied' }
	| { state: 'cancelled' }
	| { state: 'failed'; note: string }
	/** The file is in no clone this catalog holds: the caller should use its own edit, with its own dialog. */
	| { state: 'outside' };

/** A clone the catalog has, and whether a file sits inside it. */
interface Home {
	slug: string;
	name: string;
	root: string;
	/** The file's path relative to the clone root, with forward slashes — what a patch names. */
	relative: string;
}

/** `git`, in one clone, answering with its stderr when it refuses. */
function git(cwd: string, args: readonly string[]): Promise<{ ok: boolean; output: string }> {
	return new Promise((resolve) => {
		execFile('git', ['-C', cwd, ...args], { timeout: 20_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
			resolve({ ok: error === null, output: `${stdout ?? ''}${stderr ?? ''}`.trim() });
		});
	});
}

/**
 * The clone a file belongs to, if any.
 *
 * Longest root wins: a documentation folder can sit inside a checkout, and the innermost clone is the one whose
 * `git status` a person would look at.
 */
async function homeOf(context: vscode.ExtensionContext, file: string): Promise<Home | undefined> {
	let catalog: Catalog | undefined;
	try {
		catalog = await Catalog.open(context);
		const homes: Home[] = [];
		for (const row of catalog.sources()) {
			if (row.kind !== 'git') {
				continue;
			}
			const detail = catalog.source(row.slug);
			if (detail?.path === undefined) {
				continue;
			}
			const relative = pathModule.relative(detail.path, file);
			if (relative.length === 0 || relative.startsWith('..') || pathModule.isAbsolute(relative)) {
				continue;
			}
			homes.push({ slug: row.slug, name: row.name, root: detail.path, relative: relative.split(pathModule.sep).join('/') });
		}
		homes.sort((a, b) => b.root.length - a.root.length);
		return homes[0];
	} catch {
		return undefined;
	} finally {
		catalog?.close();
	}
}

/**
 * A whole-file patch: every line removed, every line added.
 *
 * Deliberately not a diff of the smallest change: what a draft replaces is the page, so what a reviewer should see in
 * `git diff` is the page. `--recount` lets git recompute the hunk's line counts, so a miscount here is a non-event.
 *
 * Two details are what make it apply cleanly: the removed side says so when the file had no final newline, and the
 * added side is already in the file's own line endings — see `applyToSource`.
 */
function patchFor(relative: string, before: string, after: string): string {
	const lines = (text: string): string[] => {
		const split = text.split('\n');
		// A file that ends with a newline splits to a last empty string; it is not a line of the file.
		if (split.length > 0 && split[split.length - 1] === '') {
			split.pop();
		}
		return split;
	};
	const removed = lines(before);
	const added = lines(after);
	const endsWithNewline = before.endsWith('\n');
	const removals = removed.map((line, index) =>
		// Git's own marker for "the last line of this file is not newline-terminated".
		!endsWithNewline && index === removed.length - 1 ? `-${line}\n\\ No newline at end of file` : `-${line}`
	);
	const body = [...removals, ...added.map((line) => `+${line}`)].join('\n');
	return `diff --git a/${relative} b/${relative}\n--- a/${relative}\n+++ b/${relative}\n@@ -1,${removed.length} +1,${added.length} @@\n${body}\n`;
}

/** Writes the patch to a temp file and hands it to `git apply`, forward or reversed. */
async function applyPatch(root: string, patch: string, reverse: boolean): Promise<{ ok: boolean; note?: string }> {
	const file = pathModule.join(os.tmpdir(), `temco-${Date.now()}-${Math.floor(Math.random() * 1e6)}.patch`);
	try {
		await fs.writeFile(file, patch, 'utf8');
		// `core.autocrlf=false` on the command line, because the patch already speaks the file's own line endings:
		// letting git convert them again would either double them or land a file nobody drafted.
		const result = await git(root, ['-c', 'core.autocrlf=false', 'apply', '--recount', '--whitespace=nowarn', ...(reverse ? ['-R'] : []), file]);
		return result.ok ? { ok: true } : { ok: false, note: result.output.length === 0 ? 'git apply refused the patch' : result.output };
	} finally {
		await fs.rm(file, { force: true });
	}
}

/**
 * Applies a draft to the clone that holds `file`, behind a modal question, and offers the reverse.
 *
 * Returns `{ state: 'outside' }` when the file is in no clone: the caller owns that edit and its own dialog.
 */
export async function applyToSource(
	context: vscode.ExtensionContext,
	file: string,
	text: string
): Promise<ApplyOutcome> {
	const home = await homeOf(context, file);
	if (home === undefined) {
		return { state: 'outside' };
	}

	let before: string;
	try {
		before = await fs.readFile(file, 'utf8');
	} catch (error) {
		const note = `${home.relative} could not be read (${messageOf(error)})`;
		void vscode.window.showWarningMessage(`Temco Repositories: ${note}.`);
		return { state: 'failed', note };
	}
	// The draft is a page, so a page ends with a newline; the patch says so rather than leaving the file's last line
	// changed without anybody asking for it. It is also written in the file's own line endings, so a CRLF page stays
	// CRLF and a reviewer's diff is the prose, not every line at once.
	const endsWithNewline = text.endsWith('\n') ? text : `${text}\n`;
	const after = before.includes('\r\n') ? endsWithNewline.replace(/\r?\n/g, '\r\n') : endsWithNewline;
	if (before === after) {
		void vscode.window.showInformationMessage(`${home.relative} already reads like that — nothing was written.`);
		return { state: 'cancelled' };
	}

	const answer = await vscode.window.showWarningMessage(
		`Write this change into ${home.name}?`,
		{
			modal: true,
			detail:
				`It goes into the working tree of ${home.root} as an uncommitted patch to ${home.relative}. ` +
				'Nothing is committed, and Undo puts the file back exactly as it was.'
		},
		'Apply'
	);
	if (answer !== 'Apply') {
		return { state: 'cancelled' };
	}

	const patch = patchFor(home.relative, before, after);
	const applied = await applyPatch(home.root, patch, false);
	if (!applied.ok) {
		const note = `git refused the patch to ${home.relative}: ${applied.note ?? ''}`.trim();
		void vscode.window.showWarningMessage(`Temco Repositories: ${note}. Nothing was changed.`);
		return { state: 'failed', note };
	}

	const notice = await vscode.window.showInformationMessage(
		`Applied to ${home.name}: ${home.relative} — not committed.`,
		'Undo'
	);
	if (notice === 'Undo') {
		const reversed = await applyPatch(home.root, patch, true);
		if (reversed.ok) {
			void vscode.window.showInformationMessage(`${home.relative} is back to how it was.`);
		} else {
			void vscode.window.showWarningMessage(
				`The patch could not be reversed: ${reversed.note ?? 'git refused it'}. The change is still in the working tree.`
			);
		}
	}
	return { state: 'applied' };
}

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
