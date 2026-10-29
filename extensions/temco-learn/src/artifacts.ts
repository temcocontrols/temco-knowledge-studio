// What a build actually wrote.
//
// A build is not one thing: `temco-docs` writes the site, an offline help file (`.chm`), often a `.pdf`, a zip of the
// site, a Word document, and single pages. This module used to know only about the site, so everything else a person had
// built was invisible. This reads the folders a build writes into — `<project>/dist`, the project's own root, and a
// `HelpDocs` folder beside it — and reports what is there, per project, with nothing invented: a project with no `.chm`
// simply has no `.chm` row.

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { projectNameOf, slugOf, workRoot } from './site';

export type ArtifactKind = 'site' | 'chm' | 'pdf' | 'zip' | 'docx' | 'page';

export interface Artifact {
	kind: ArtifactKind;
	/** The file on disk, or the folder when the artifact is the site itself. */
	file: string;
	/** What a row calls it: `the website`, `offline help`, `a single page`, `the whole site`, `Word`. */
	label: string;
	/** What opens it: the editor's own preview, the OS viewer, or the browser. */
	opens: 'editor' | 'external' | undefined;
	/** Bytes, when the artifact is a file rather than a folder. */
	size: number | undefined;
	/** When the build wrote it. */
	at: number;
}

export interface ProjectArtifacts {
	title: string;
	id: string;
	/** The project's own folder, where a build runs. */
	folder: string;
	artifacts: Artifact[];
	/** The newest thing the build wrote, ISO — what a row means by "built". */
	builtAt: string | undefined;
}

/** The words a row uses for each kind, and how it opens. */
const KIND: Record<ArtifactKind, { label: string; opens: Artifact['opens'] }> = {
	site: { label: 'the website', opens: 'editor' },
	chm: { label: 'offline help', opens: 'external' },
	pdf: { label: 'pdf', opens: 'external' },
	page: { label: 'a single page', opens: 'external' },
	zip: { label: 'an archive', opens: undefined },
	docx: { label: 'Word', opens: undefined }
};

/** The kinds you can look at, in the order a person looks: the site first. */
const LOOKING: readonly ArtifactKind[] = ['site', 'chm', 'pdf', 'page'];

/** The kinds you can take away: files, never the site folder. */
const TAKING: readonly ArtifactKind[] = ['zip', 'docx', 'chm', 'pdf'];

/** True when a row for this artifact belongs under Preview. */
export function isPreviewable(artifact: Artifact): boolean {
	return LOOKING.includes(artifact.kind);
}

/** True when a row for this artifact belongs under Download. */
export function isDownloadable(artifact: Artifact): boolean {
	return TAKING.includes(artifact.kind);
}

/** `4.2 MB` — the number a person compares, wherever a file's size is shown. */export function formatSize(bytes: number | undefined): string {
	if (bytes === undefined) {
		return '';
	}
	if (bytes < 1024) {
		return `${String(bytes)} B`;
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(0)} KB`;
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** What a row, a page or a tree calls the artifact: `Website` for the site folder, the file's name otherwise. */
export function nameOf(artifact: Artifact): string {
	return artifact.kind === 'site' ? 'Website' : path.basename(artifact.file);
}

/** The projects a build could have run in: the working area and every workspace folder, plus their subfolders. */
export async function findArtifacts(): Promise<ProjectArtifacts[]> {
	const roots = new Set<string>([
		...(vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath),
		workRoot()
	]);
	const found: ProjectArtifacts[] = [];
	const seen = new Set<string>();
	for (const root of roots) {
		for (const folder of [root, ...(await subfolders(root)).map((name) => path.join(root, name))]) {
			const key = path.resolve(folder).toLowerCase();
			if (seen.has(key)) {
				continue;
			}
			seen.add(key);
			// The working area itself is a project only when it holds a build of its own: otherwise the "HelpDocs" it may
			// hold beside its projects would make the area look like one more project.
			const project = folder === root && !exists(path.join(root, 'dist')) ? undefined : await readProject(folder);
			if (project !== undefined) {
				found.push(project);
			}
		}
	}
	return found.sort((one, other) => other.builtAt?.localeCompare(one.builtAt ?? '') ?? 0);
}

/** Everything one project has on disk, or nothing when it has no build output at all. */
async function readProject(folder: string): Promise<ProjectArtifacts | undefined> {
	const dist = path.join(folder, 'dist');
	const site = ['docs', 'site'].map((name) => path.join(dist, name)).find((candidate) => exists(path.join(candidate, 'index.html')));
	const artifacts: Artifact[] = [];

	if (site !== undefined) {
		artifacts.push({ kind: 'site', file: site, label: KIND.site.label, opens: KIND.site.opens, size: undefined, at: modified(site) });
	}

	// The files a build leaves: `dist/` for the exports, the project root and a `HelpDocs` folder inside it or beside it,
	// for a help build that drops its output next to the repository rather than in it.
	const shared = path.join(folder, '..', 'HelpDocs');
	const places = [dist, folder, path.join(folder, 'HelpDocs'), shared];
	for (const place of places) {
		for (const file of await files(place)) {
			const kind = kindOf(file);
			if (kind === undefined || kind === 'site') {
				continue;
			}
			// A `HelpDocs` folder beside several projects is shared: a file there belongs to the project it is named after.
			if (place === shared && !names(file, folder)) {
				continue;
			}
			// The site's own pages are not "a single page"; only loose pages outside the site folder are.
			if (kind === 'page' && site !== undefined && path.resolve(file).startsWith(path.resolve(site) + path.sep)) {
				continue;
			}
			artifacts.push({ kind, file, label: KIND[kind].label, opens: KIND[kind].opens, size: sizeOf(file), at: modified(file) });
		}
	}

	if (artifacts.length === 0) {
		return undefined;
	}
	artifacts.sort((one, other) => LOOKING.indexOf(one.kind) - LOOKING.indexOf(other.kind) || other.at - one.at);
	const newest = artifacts.reduce((latest, artifact) => Math.max(latest, artifact.at), 0);
	const title = (site === undefined ? undefined : await projectNameOf(site)) ?? path.basename(folder);
	return { title, id: slugOf(title), folder, artifacts, builtAt: newest === 0 ? undefined : new Date(newest).toISOString() };
}

/** The kind a file name says it is, or nothing when it is not a build output this module knows. */
function kindOf(file: string): ArtifactKind | undefined {
	const extension = path.extname(file).toLowerCase();
	switch (extension) {
		case '.chm':
			return 'chm';
		case '.pdf':
			return 'pdf';
		case '.zip':
			return 'zip';
		case '.docx':
			return 'docx';
		case '.html':
		case '.htm':
			return 'page';
		default:
			return undefined;
	}
}

/** The files directly in a folder. Never recursive: a build writes to the top of `dist/`, and walking a tree here would
 *  cost more than the panel is worth. */
async function files(folder: string): Promise<string[]> {
	try {
		return (await fs.promises.readdir(folder, { withFileTypes: true }))
			.filter((entry) => entry.isFile())
			.map((entry) => path.join(folder, entry.name));
	} catch {
		return [];
	}
}

/** True when a file's name names the project: `T3000.chm` in a shared `HelpDocs` folder is T3000's. */
function names(file: string, folder: string): boolean {
	const project = path.basename(folder).toLowerCase();
	const stem = path.basename(file, path.extname(file)).toLowerCase();
	return stem.includes(project);
}

async function subfolders(root: string): Promise<string[]> {
	try {
		return (await fs.promises.readdir(root, { withFileTypes: true }))
			.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name.toLowerCase() !== 'helpdocs')
			.map((entry) => entry.name);
	} catch {
		return [];
	}
}

function exists(target: string): boolean {
	try {
		fs.statSync(target);
		return true;
	} catch {
		return false;
	}
}

function modified(target: string): number {
	try {
		return fs.statSync(target).mtimeMs;
	} catch {
		return 0;
	}
}

function sizeOf(file: string): number | undefined {
	try {
		return fs.statSync(file).size;
	} catch {
		return undefined;
	}
}
