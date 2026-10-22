// What is on disk and not in the registry yet.
//
// The tree is a view of the registry, which is why a page written a second ago had no row: it becomes a page when
// the repository's generator names it. That is correct and it is also useless while a person is working — Explorer
// shows the file it just made. So the folders and pages the registry does not name are read from disk and drawn as
// **loose** rows: the row is there at once, it says it is not registered, and running the generator turns it into an
// ordinary one.
//
// Nothing here writes, and nothing here is added to the counts: a loose row is not a page yet, and a count that
// included it would disagree with every number a build produces.

import * as vscode from 'vscode';
import { DocsRoot, contentUri } from './registry';

/** A chapter folder that exists and is not in the registry. */
export interface LooseFolder {
	area: string;
	chapter: string;
	/** The folder itself — what a rename moves and what a terminal opens at. */
	uri: vscode.Uri;
}

/** A Markdown file inside a chapter that the registry does not name. */
export interface LooseFile {
	area: string;
	chapter: string;
	/** The file name without `.md`, which is the id the generator will give it. */
	name: string;
	title: string;
	uri: vscode.Uri;
}

export interface Loose {
	folders: LooseFolder[];
	files: LooseFile[];
}

const EMPTY: Loose = { folders: [], files: [] };

/**
 * Everything an area folder holds that its registry does not.
 *
 * Only areas the registry already names are scanned: an area is not something this application discovers, it is
 * something the registry declares, and inventing one from a folder would be a second answer to "what is a page".
 */
export async function looseEntries(root: DocsRoot): Promise<Loose> {
	if (root.origin === 'catalog') {
		// A source with no local copy has no disk to read.
		return EMPTY;
	}
	const folders: LooseFolder[] = [];
	const files: LooseFile[] = [];

	for (const area of root.areas) {
		const areaFolder = contentUri(root.rootUri, area.area);
		let entries: [string, vscode.FileType][] = [];
		try {
			entries = await vscode.workspace.fs.readDirectory(areaFolder);
		} catch {
			continue;
		}

		const registered = new Set(area.chapters.map((chapter) => chapter.chapter));
		for (const [name, type] of entries) {
			if (type !== vscode.FileType.Directory) {
				continue;
			}
			if (!registered.has(name)) {
				folders.push({ area: area.area, chapter: name, uri: vscode.Uri.joinPath(areaFolder, name) });
			}
		}

		// Loose files are read for both registered and loose chapters: a page added to an existing chapter is the
		// commonest case of all.
		const chapters = [
			...area.chapters.map((chapter) => chapter.chapter),
			...folders.filter((folder) => folder.area === area.area).map((folder) => folder.chapter),
		];
		for (const chapter of chapters) {
			const chapterFolder = contentUri(root.rootUri, area.area, chapter);
			let chapterEntries: [string, vscode.FileType][] = [];
			try {
				chapterEntries = await vscode.workspace.fs.readDirectory(chapterFolder);
			} catch {
				continue;
			}
			const named = new Set(
				(area.chapters.find((entry) => entry.chapter === chapter)?.pages ?? []).map((page) =>
					page.uri.fsPath.replace(/\\/g, '/').split('/').pop()?.replace(/\.md$/i, '')
				)
			);
			for (const [file, kind] of chapterEntries) {
				if (kind !== vscode.FileType.File || !/\.md$/i.test(file)) {
					continue;
				}
				const name = file.replace(/\.md$/i, '');
				if (named.has(name)) {
					continue;
				}
				const uri = vscode.Uri.joinPath(chapterFolder, file);
				files.push({ area: area.area, chapter, name, title: await titleOf(uri, name), uri });
			}
		}
	}

	return { folders, files };
}

/** The page's first `#` heading, or its file name — the same rule the generator uses for a title. */
async function titleOf(uri: vscode.Uri, fallback: string): Promise<string> {
	try {
		const text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
		const heading = text.split(/\r?\n/).find((line) => /^#\s+\S/.test(line));
		return heading === undefined ? fallback : heading.replace(/^#\s+/, '').trim();
	} catch {
		return fallback;
	}
}

/** The loose rows of every set, keyed by the folder they belong to. */
export async function looseByRoot(roots: readonly DocsRoot[]): Promise<Map<string, Loose>> {
	const all = new Map<string, Loose>();
	for (const root of roots) {
		all.set(root.folder.uri.toString(), await looseEntries(root));
	}
	return all;
}
