// Publishing the site: one folder, one commit, one push.
//
// The site folder *is* the site — the app at its root, one folder per project beside it — and the repository that
// GitHub Pages serves is that folder (`temcocontrols/docs`). So publishing is a git operation and nothing else: commit
// what changed, and push `HEAD` at `gh-pages`.
//
// The first publish arranges what a first publish always needs: a repository in the folder, and the remote the account
// serves Pages from. Nothing is cloned, because the folder already holds the site — a clone would have to be merged
// into it, and the site folder is the truth here rather than a copy of one.
//
// Never a forced push. If the branch carries work this clone does not know about, that is a fact to report — the
// commit is in the repository either way, and the next publish will be a fast-forward.

import * as vscode from 'vscode';
import { git } from './git';

/** The branch GitHub Pages serves for a project repository. */
const BRANCH = 'gh-pages';

/** Where the site belongs when the folder is not a repository yet: the account Pages serves it from. */
const REMOTE = 'https://github.com/temcocontrols/docs.git';

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
 * The site folder as a publishing clone: a repository with an `origin`.
 *
 * A folder that is already a repository is left alone — its remote is the account's decision, not this module's. A
 * folder that is not gets one, because the alternative is a publish that fails with "there is nowhere to publish to"
 * on the one machine that has never published before.
 */
export async function ensureRepo(root: string, output: vscode.OutputChannel): Promise<void> {
	try {
		await git(root, ['rev-parse', '--git-dir']);
	} catch {
		output.appendLine('[publish] the site folder was not a repository; starting one');
		await git(root, ['init']);
	}
	try {
		await git(root, ['remote', 'get-url', 'origin']);
	} catch {
		output.appendLine(`[publish] no origin; publishing to ${REMOTE}`);
		await git(root, ['remote', 'add', 'origin', REMOTE]);
	}
}

/**
 * Commit the site folder and push it at `gh-pages`.
 *
 * The commit message names the date rather than a version: the folder holds several projects, each with its own
 * versions, and a message that claims one of them would be wrong about the others.
 */
export async function publishSite(root: string, output: vscode.OutputChannel): Promise<Published> {
	await ensureRepo(root, output);
	const target = await publishingTarget(root);
	if (target === undefined) {
		throw new Error('this folder has no GitHub `origin`, so there is nowhere to publish to');
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
