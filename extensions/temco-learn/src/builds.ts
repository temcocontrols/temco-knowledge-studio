// The builds a project has already written, found rather than asked for.
//
// `temco-docs` builds a project into `<project>/dist/site`; this module puts one of those folders on the site. A build
// that is sitting on disk not on the site is a fact worth showing — it is the difference between "Add to Site" meaning
// something and "Add to Site" being a button that either works or complains.

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { projectNameOf, slugOf, workRoot } from './site';

export interface Build {
	/** The folder that holds `index.html`: what gets copied into the site. */
	folder: string;
	/** The name the build gives itself in its own index, or the folder it was found in. */
	title: string;
	/** The project id it would be added under. */
	id: string;
	/** When the build was last written. */
	at: number;
}

/** Every build on disk, newest first, from the workspace folders and the working area. */
export async function findBuilds(): Promise<Build[]> {
	const roots = new Set<string>([...(vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath), workRoot()]);
	const found: Build[] = [];
	for (const root of roots) {
		for (const folder of [
			path.join(root, 'dist', 'site'),
			...(await subfolders(root)).map((name) => path.join(root, name, 'dist', 'site'))
		]) {
			if (!fs.existsSync(path.join(folder, 'index.html'))) {
				continue;
			}
			const fallback = path.basename(path.dirname(path.dirname(folder)));
			const title = (await projectNameOf(folder)) ?? fallback;
			found.push({ folder, title, id: slugOf(title), at: fs.statSync(folder).mtimeMs });
		}
	}
	return found.sort((one, other) => other.at - one.at);
}

async function subfolders(root: string): Promise<string[]> {
	try {
		return (await fs.promises.readdir(root, { withFileTypes: true }))
			.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
			.map((entry) => entry.name);
	} catch {
		return [];
	}
}
