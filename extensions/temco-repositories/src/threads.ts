/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Temco Controls. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// *Threads* — the issues a documentation set is argued about in, read from the repository that holds it.
//
// `docs/temco-learn/design/09-feedback-subscriptions-notifications.md` settled that a feedback row arrives through the
// issue form carrying a label, and left where a row comes *from* open. This is the smallest read that makes a forum
// real rather than a mock: the issues carrying that label, with the facts a triager decides on — who wrote it, how
// long it has waited, what it says, and whether anybody has answered.
//
// Read-only, deliberately. No label is applied and no comment is posted: a write needs a token with write scope and a
// person's decision, and this module holds neither. What triage *decides* is recorded by the docs module, next to the
// page the thread names.

import * as vscode from 'vscode';
import { coordinatesOf, tokenOf } from './read';

/** One thread, as the forum lists it and the triage page reads it. */
export interface Thread {
	number: number;
	title: string;
	body: string;
	author: string;
	createdAt: string;
	updatedAt: string;
	/** `open` or `closed`, as the issue itself reports it. */
	state: string;
	labels: string[];
	comments: number;
	url: string;
	/** Days since it was opened: the one figure that says whether it has waited too long. */
	days: number;
}

/** The list, and the reason it might be short or empty. */
export interface ThreadsAnswer {
	/** The repository the threads came from, as `owner/repo`. */
	repository?: string;
	threads: Thread[];
	/** Why there is nothing to show, when it is worth saying: no remote, no token, a rate limit, a refusal. */
	note?: string;
}

/** The fields of an issue this module reads. Anything else GitHub sends is ignored rather than guessed at. */
interface IssueJson {
	number?: number;
	title?: string;
	body?: string | null;
	state?: string;
	comments?: number;
	html_url?: string;
	created_at?: string;
	updated_at?: string;
	labels?: ({ name?: string } | string)[];
	user?: { login?: string };
	pull_request?: unknown;
}

/**
 * The labeled issues of one repository, newest activity first.
 *
 * The endpoint returns pull requests as issues; they are dropped, because a review is not a thread a reader opened.
 */
export async function threads(
	context: vscode.ExtensionContext,
	source: { name: string; remoteUrl?: string; branch?: string },
	label: string
): Promise<ThreadsAnswer> {
	if (source.remoteUrl === undefined || source.remoteUrl.trim().length === 0) {
		return { threads: [], note: `${source.name} has no GitHub address, so there is no forum to read` };
	}
	const coordinates = coordinatesOf(source.remoteUrl);
	if (coordinates === undefined) {
		return { threads: [], note: `${source.name} is not a GitHub repository the issues API can read` };
	}
	const repository = `${coordinates.owner}/${coordinates.repo}`;
	const token = await tokenOf(context);
	// Open and closed together: a triager needs to see what a decision looks like after it was made, not only a backlog.
	const url = `https://api.github.com/repos/${repository}/issues?state=all&labels=${encodeURIComponent(label)}&sort=updated&direction=desc&per_page=50`;

	let response: Response;
	try {
		response = await fetch(url, {
			headers: {
				'user-agent': 'temco-platform',
				accept: 'application/vnd.github+json',
				...(token === undefined ? {} : { authorization: `Bearer ${token}` })
			}
		});
	} catch (error) {
		return { repository, threads: [], note: `GitHub could not be reached (${messageOf(error)})` };
	}

	if (response.status === 404) {
		return { repository, threads: [], note: `${repository} has no issues this token can read` };
	}
	if (response.status === 401 || response.status === 403) {
		return {
			repository,
			threads: [],
			note: `GitHub refused the read — ${token === undefined ? 'no token is stored, so this is the anonymous allowance' : 'the stored token was not accepted'}`
		};
	}
	if (!response.ok) {
		return { repository, threads: [], note: `GitHub answered ${response.status} ${response.statusText}` };
	}

	let issues: IssueJson[];
	try {
		issues = (await response.json()) as IssueJson[];
	} catch (error) {
		return { repository, threads: [], note: `GitHub's answer could not be read (${messageOf(error)})` };
	}
	if (!Array.isArray(issues)) {
		return { repository, threads: [], note: 'GitHub returned no list for the issues' };
	}

	const rows = issues.filter((issue) => issue.pull_request === undefined).map(toThread);
	if (rows.length === 0) {
		return { repository, threads: [], note: `nothing in ${repository} carries the ${label} label yet` };
	}
	return { repository, threads: rows };
}

function toThread(issue: IssueJson): Thread {
	const created = typeof issue.created_at === 'string' ? issue.created_at : '';
	const days = created.length === 0 ? 0 : Math.max(0, Math.round((Date.now() - Date.parse(created)) / 86_400_000));
	return {
		number: Number(issue.number ?? 0),
		title: String(issue.title ?? ''),
		body: String(issue.body ?? ''),
		author: String(issue.user?.login ?? 'someone'),
		createdAt: created,
		updatedAt: typeof issue.updated_at === 'string' ? issue.updated_at : created,
		state: String(issue.state ?? 'open'),
		labels: (issue.labels ?? []).map((label) => (typeof label === 'string' ? label : String(label.name ?? ''))).filter((name) => name.length > 0),
		comments: Number(issue.comments ?? 0),
		url: String(issue.html_url ?? ''),
		days: Number.isNaN(days) ? 0 : days
	};
}

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
