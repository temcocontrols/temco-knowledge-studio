// What the site folder already is, as a repository.
//
// The panel says one sentence about publishing — where it goes, what the last publish was, and whether anything is
// waiting — and none of it is stored: git already knows. Reading it rather than remembering it means two machines (or
// a clone somebody else made) never disagree about what has been published.

import { publishingTarget } from './publish';
import { git } from './git';

/** The site folder's publishing state, as git reports it. Every field is absent until it is true. */
export interface PublishedState {
	/** `owner/repo`, when the folder points at a GitHub repository. */
	where: string | undefined;
	/** The address GitHub Pages serves, when the folder points at a GitHub repository. */
	base: string | undefined;
	/** The short hash of the last commit in this clone. */
	commit: string | undefined;
	/** When that commit was made, ISO 8601. */
	at: string | undefined;
	/** How many paths have changed since that commit. */
	pending: number;
}

/** `just now`, `2 hours ago`, `yesterday` — the words a person uses, from an ISO date. */
export function ago(iso: string | undefined): string {
	const then = Date.parse(String(iso));
	if (Number.isNaN(then)) {
		return 'at an unknown time';
	}
	const minutes = Math.floor((Date.now() - then) / 60000);
	if (minutes < 1) {
		return 'just now';
	}
	if (minutes < 60) {
		return `${String(minutes)} min ago`;
	}
	const hours = Math.floor(minutes / 60);
	if (hours < 24) {
		return hours === 1 ? '1 hour ago' : `${String(hours)} hours ago`;
	}
	const days = Math.floor(hours / 24);
	return days === 1 ? 'yesterday' : `${String(days)} days ago`;
}

/** Read the state of the folder: not a repository, a repository with no commits, and the usual case all land here. */
export async function readPublishedState(root: string): Promise<PublishedState> {
	const target = await publishingTarget(root);
	const changed = await git(root, ['status', '--porcelain']).catch(() => '');
	const commit = (await git(root, ['rev-parse', '--short', 'HEAD']).catch(() => '')).trim();
	const at = (await git(root, ['log', '-1', '--format=%cI']).catch(() => '')).trim();
	const paths = changed
		.split(/\r?\n/u)
		.map((line) => line.trim())
		.filter((line) => line !== '');
	return {
		where: target === undefined ? undefined : `${target.owner}/${target.repo}`,
		base: target?.base,
		commit: commit === '' ? undefined : commit,
		at: at === '' ? undefined : at,
		pending: paths.length
	};
}
