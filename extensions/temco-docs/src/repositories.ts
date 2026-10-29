// What this module reads of the repositories module.
//
// The repositories module owns the organisation and the local copies of it, and reading a source. This module
// needs exactly three things from it: the code files a source carries, the text of the files a person ticked for
// a draft, and whether a source has a local copy. The first two are used by the page that creates a page — the
// material a new page is written from — and nothing else.
//
// Why the shapes are written out: an extension cannot import another extension's sources. The definition is
// `extensions/temco-repositories/src/repository.ts` and `extensions/temco-repositories/src/extension.ts`.
// Repositories is a declared dependency, so it is activated before this module's entry runs.

import * as vscode from 'vscode';

/** The repositories module, by the id its manifest declares. */
const REPOSITORIES_EXTENSION_ID = 'temcocontrols.temco-repositories';

/** A file a page could be written from: its path, and roughly what it costs to read. */
export interface CodeFile {
	path: string;
	size: number;
}

/** Several files' text, within a budget: what a draft is given, and what was left out. */
export interface Material {
	text: string;
	included: string[];
	skipped: string[];
	characters: number;
}

/** A source, as the catalog records it — enough to find its files, on disk or through the API. */
export interface RepositorySource {
	name: string;
	path?: string;
	remoteUrl?: string;
	branch?: string;
	defaultBranch?: string;
}

/** One script of the repository's own documentation work that this application is willing to run. */
export interface OfferedScript {
	id: string;
	label: string;
	detail: string;
}

/** One thread of a repository's forum, as its issues carry it. */
export interface Thread {
	number: number;
	title: string;
	body: string;
	author: string;
	createdAt: string;
	updatedAt: string;
	state: string;
	labels: string[];
	comments: number;
	url: string;
	/** Days since it was opened. */
	days: number;
}

/** A repository's threads, and why the list might be short or empty. */
export interface ThreadsAnswer {
	repository?: string;
	threads: Thread[];
	note?: string;
	/** The next page's address, when there is one. */
	next?: string;
}

/** The repositories module's exports — the copy of `extensions/temco-repositories/src/extension.ts`. */
interface TemcoRepositoriesApi {
	onDidChange(listener: () => void): vscode.Disposable;
	codeFiles(source: RepositorySource): Promise<{ files: CodeFile[]; note?: string }>;
	readMaterials(source: RepositorySource, files: readonly string[], limit?: number): Promise<Material>;
	threads(source: RepositorySource, label: string, after?: string): Promise<ThreadsAnswer>;
	readonly offeredScripts: readonly OfferedScript[];
}

/** The repositories module's exports. */
export function repositories(): TemcoRepositoriesApi {
	const extension = vscode.extensions.getExtension<TemcoRepositoriesApi>(REPOSITORIES_EXTENSION_ID);
	if (extension === undefined || !extension.isActive) {
		throw new Error('The Temco Repositories module is not available.');
	}
	return extension.exports;
}

/** The repository's own documentation scripts: a vocabulary, not a runner. */
export const OFFERED_SCRIPTS: readonly OfferedScript[] = repositories().offeredScripts;

/** The code files a source carries, relative to its own root — on disk, or through the API. */
export function codeFiles(source: RepositorySource): Promise<{ files: CodeFile[]; note?: string }> {
	return repositories().codeFiles(source);
}

/** The text of the files a person ticked, within one budget. */
export function readMaterials(
	source: RepositorySource,
	files: readonly string[],
	limit?: number
): Promise<Material> {
	return repositories().readMaterials(source, files, limit);
}

/** The labeled issues of a source's repository — the forum's threads. Read only: nothing is labelled or commented. */
export function threads(source: RepositorySource, label: string, after?: string): Promise<ThreadsAnswer> {
	return repositories().threads(source, label, after);
}
