// Where a project is published.
//
// A sitemap needs absolute addresses, and a reader needs to know which URL their page will be at; both come from the same
// fact, which is the repository's GitHub remote. Reading it is cheap and local — no network, no account — and when there is
// no remote the answer is "unknown" rather than a guess, because a wrong sitemap is worse than none.

import * as vscode from 'vscode';
import { git } from './git';

export interface PagesTarget {
	/** The repository's root folder. */
	root: string;
	owner: string;
	repo: string;
	/** The site's front page, with a trailing slash. */
	base: string;
	/** The branch the page is being written on, which a push trigger follows. */
	branch: string;
}

/**
 * The GitHub Pages address a folder would publish to.
 *
 * Two shapes exist: `owner.github.io` is served from the domain root, every other repository from a folder named after it.
 * Getting this wrong puts every page of the site one segment off, so it is decided here and only here.
 */
export async function pagesTarget(folder: vscode.Uri): Promise<PagesTarget | undefined> {
	try {
		const root = (await git(folder.fsPath, ['rev-parse', '--show-toplevel'])).trim();
		const url = (await git(root, ['remote', 'get-url', 'origin'])).trim();
		const match = /github\.com[:/]+([^/]+)\/([^/]+?)(?:\.git)?$/iu.exec(url);
		if (match === null) {
			return undefined;
		}
		const owner = match[1];
		const repo = match[2];
		const branch = (await git(root, ['rev-parse', '--abbrev-ref', 'HEAD']).catch(() => '')).trim();
		const base = repo.toLowerCase() === `${owner.toLowerCase()}.github.io`
			? `https://${owner.toLowerCase()}.github.io/`
			: `https://${owner.toLowerCase()}.github.io/${repo}/`;
		return { root, owner, repo, base, branch: branch === '' || branch === 'HEAD' ? 'main' : branch };
	} catch {
		// Not a repository, no `origin`, or no `git` on the PATH: publishing is simply not configured yet.
		return undefined;
	}
}
