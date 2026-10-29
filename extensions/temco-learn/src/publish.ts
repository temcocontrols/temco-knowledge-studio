// Publishing the site: one folder, one commit, one push.
//
// The site folder is a checkout of the repository GitHub Pages serves (`temcocontrols/docs`), and the folder *is* the
// site — `index.html` at its root, one folder per product beside it. So publishing is a git operation and nothing else:
// commit what changed, and push `HEAD` at `gh-pages`.
//
// Never a forced push. If the branch carries work this checkout does not know about, that is a fact to report — the
// commit is in the repository either way, and the next publish will be a fast-forward.

import { execFile } from 'child_process';
import * as vscode from 'vscode';

/** The branch GitHub Pages serves for a project repository. */
const BRANCH = 'gh-pages';

/** The largest output a git command may produce before it is treated as a failure rather than a message. */
const LIMIT = 32 * 1024 * 1024;

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

/** Where the folder publishes to, and what to call it. */
export interface PublishingTarget {
	root: string;
	owner: string;
	repo: string;
	/** The site's front page, with a trailing slash. */
	base: string;
}

/**
 * The GitHub repository a folder belongs to, and the address its Pages site is served at.
 *
 * Two shapes exist: `owner.github.io` is served from the domain root, every other repository from a folder named after
 * it. The address is what the reader is told when the push succeeds, so it is derived here and nowhere else.
 */
export async function publishingTarget(root: string): Promise<PublishingTarget | undefined> {
	try {
		const top = (await git(root, ['rev-parse', '--show-toplevel'])).trim();
		const url = (await git(top, ['remote', 'get-url', 'origin'])).trim();
		const match = /github\.com[:/]+([^/]+)\/([^/]+?)(?:\.git)?$/iu.exec(url);
		if (match === null) {
			return undefined;
		}
		const owner = match[1];
		const repo = match[2];
		const base =
			repo.toLowerCase() === `${owner.toLowerCase()}.github.io`
				? `https://${owner.toLowerCase()}.github.io/`
				: `https://${owner.toLowerCase()}.github.io/${repo}/`;
		return { root: top, owner, repo, base };
	} catch {
		// Not a repository, no `origin`, or no `git` on the path: publishing is simply not configured yet.
		return undefined;
	}
}

/** What a publish did, so the caller can say it in one sentence. */
export interface Published {
	base: string;
	commit: string;
	files: number;
	/** True when the working tree had nothing new, so the push carried an earlier commit. */
	unchanged: boolean;
}

/**
 * Commit the site folder and push it at `gh-pages`.
 *
 * The commit message names the date rather than a version: the folder holds several products, each with its own
 * versions, and a message that claims one of them would be wrong about the others.
 */
export async function publishSite(root: string, output: vscode.OutputChannel): Promise<Published> {
	const target = await publishingTarget(root);
	if (target === undefined) {
		throw new Error('this folder is not a git repository with a GitHub `origin`, so there is nowhere to publish to');
	}

	const changed = (await git(target.root, ['status', '--porcelain'])).trim();
	let commit = '';
	if (changed === '') {
		commit = (await git(target.root, ['rev-parse', '--short', 'HEAD']).catch(() => '')).trim();
	} else {
		output.appendLine(`[publish] ${changed.split('\n').length} path(s) to commit`);
		await git(target.root, ['add', '--all']);
		await git(target.root, ['-c', 'user.name=Temco Learn', '-c', 'user.email=learn@temcocontrols.com', 'commit', '-m', `docs: publish the site (${new Date().toISOString().slice(0, 10)})`]);
		commit = (await git(target.root, ['rev-parse', '--short', 'HEAD'])).trim();
	}

	output.appendLine(`[publish] pushing ${commit} to ${target.owner}/${target.repo}@${BRANCH}`);
	await git(target.root, ['push', 'origin', `HEAD:${BRANCH}`]);

	return { base: target.base, commit, files: changed === '' ? 0 : changed.split('\n').length, unchanged: changed === '' };
}
