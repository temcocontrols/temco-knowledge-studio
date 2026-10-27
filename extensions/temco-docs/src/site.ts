// The published site, on disk.
//
// The half of the generator that touches the file system: read the registry's pages, render them with `siteRender.ts`,
// and write them next to the `media/` folders they refer to, so a relative picture keeps resolving. Nothing here decides
// what a page looks like — that is the other half — which is why this file is short.

import * as path from 'path';
import * as vscode from 'vscode';
import { DocsRoot, PageEntry, collectPages } from './registry';
import {
	SiteArea,
	SiteEntry,
	addresses,
	renderIndex,
	renderPage,
	renderSitemap,
	renderStylesheet
} from './siteRender';

export interface SiteResult {
	destination: vscode.Uri;
	pages: number;
	files: number;
	warnings: string[];
}

/** The folder the generator writes when the caller does not say: `<repo>/dist/site`, which is also what Pages serves. */
export function siteDestination(root: DocsRoot): vscode.Uri {
	return vscode.Uri.joinPath(root.folder.uri, 'dist', 'site');
}

/**
 * Render the documentation as a site.
 *
 * A page is written to the folder its own `media/` lives in — `<address>.html` beside `<address>.md` would be, one folder
 * down for each `area/chapter` — so every relative picture and every relative file the page mentions keeps resolving
 * without rewriting it. Pages whose registry entry says `ship: false` are not published.
 */
export async function generateSite(
	root: DocsRoot,
	options: { project: string; version?: string; destination?: vscode.Uri; base?: string; onStep?: (step: string) => void } = { project: '' }
): Promise<SiteResult> {
	const step = options.onStep ?? (() => undefined);
	const destination = options.destination ?? siteDestination(root);
	const warnings: string[] = [];
	const pages = collectPages(root).filter(page => page.exists && page.ship);
	const where = addresses(pages.map(page => page.id));
	const built = new Date().toISOString().slice(0, 10);
	/** The registry entry and the text read from its file, together: the page is written from both. */
	const read: { page: PageEntry; entry: SiteEntry }[] = [];

	step(`Resolve: ${pages.length} page(s) to publish, ${where.size} address(es)`);
	for (const page of pages) {
		let markdown: string;
		try {
			markdown = new TextDecoder().decode(await vscode.workspace.fs.readFile(page.uri));
		} catch {
			warnings.push(`${page.id}: could not be read`);
			continue;
		}
		read.push({ page, entry: { id: page.id, title: page.title, area: page.area, markdown } });
	}

	const entries = read.map(held => held.entry);
	const model = {
		project: options.project === '' ? root.folder.name : options.project,
		version: options.version,
		areas: areaGroups(root, entries)
	};

	let files = 0;
	const written = new Set<string>();
	await vscode.workspace.fs.createDirectory(destination);
	step('Render: writing each page beside its own media/');

	for (const { page, entry } of read) {
		const address = where.get(entry.id);
		if (address === undefined) {
			continue;
		}
		const html = renderPage({
			entry,
			model,
			address,
			where,
			neighbours: neighboursOf(entry, entries, where),
			built
		});
		files += await write(destination, `${address}.html`, html, written);
		files += await copyMedia(root, page, address, destination);
	}

	files += await write(destination, 'index.html', renderIndex(model, where), written);
	step('Assets: one stylesheet, one index');
	files += await write(destination, 'assets/site.css', renderStylesheet(), written);
	if (options.base === undefined) {
		// A sitemap's locations have to be absolute URLs, and guessing the public address would put wrong URLs in a file
		// meant to be read by crawlers. Deploy knows the address; until then, the site is served without one.
		warnings.push('no public URL is known, so sitemap.xml was not written');
		step('Sitemap: skipped, because no public address is known');
	} else {
		const addresses_written = [...where.values()].map(address => ({ address }));
		files += await write(destination, 'sitemap.xml', renderSitemap(options.base, addresses_written, built), written);
		step(`Sitemap: ${addresses_written.length} address(es) under ${options.base}`);
	}
	// GitHub Pages runs Jekyll unless told not to, and Jekyll drops files whose name starts with an underscore.
	files += await write(destination, '.nojekyll', '', written);

	return { destination, pages: entries.length, files, warnings };
}

/**
 * The areas, in the order the registry lists them, holding only the pages that were actually read.
 *
 * An area the registry does not name still gets a heading — a page that exists should not vanish from the index because
 * its folder was not registered — but it goes last, where an unnamed area belongs.
 */
function areaGroups(root: DocsRoot, entries: readonly SiteEntry[]): SiteArea[] {
	const areas: SiteArea[] = [];
	const placed = new Set<string>();
	for (const group of root.areas) {
		const held = entries.filter(entry => entry.area === group.area);
		placed.add(group.area);
		if (held.length > 0) {
			areas.push({ title: group.title, entries: held });
		}
	}
	for (const entry of entries) {
		if (!placed.has(entry.area)) {
			placed.add(entry.area);
			areas.push({ title: entry.area, entries: entries.filter(held => held.area === entry.area) });
		}
	}
	return areas;
}

/**
 * The pages before and after this one, following the documentation's own order.
 *
 * Read in order, the book has a next page; that is the whole navigation, because a reader who lands on a page from a
 * search result needs to know what to read next, not a menu of every page in the project.
 */
function neighboursOf(entry: SiteEntry, ordered: readonly SiteEntry[], where: ReadonlyMap<string, string>): { previous?: { title: string; address: string }; next?: { title: string; address: string } } {
	const index = ordered.findIndex(held => held.id === entry.id);
	const describe = (held: SiteEntry | undefined) => {
		const address = held === undefined ? undefined : where.get(held.id);
		return held === undefined || address === undefined ? undefined : { title: held.title, address };
	};
	return { previous: describe(index > 0 ? ordered[index - 1] : undefined), next: describe(ordered[index + 1]) };
}

/**
 * A page's `media/` folder, copied to where the page now lives.
 *
 * A page's pictures sit beside it in `media/`, and the site keeps that arrangement, so the same relative reference works
 * in the file, in the editor and on the web. The whole folder is copied rather than the files this page mentions: a
 * neighbouring page in the same folder shares it, and reading the Markdown for references is a guess that ages badly.
 *
 * The source is the page's real folder — a folder on disk may be called `01_Getting Started`, and only the address is
 * slugged — while the target follows the page's address.
 */
async function copyMedia(root: DocsRoot, entry: PageEntry, address: string, destination: vscode.Uri): Promise<number> {
	const folder = path.relative(root.rootUri.fsPath, path.dirname(entry.uri.fsPath)).split(path.sep).join('/');
	const from = folder === '' || folder === '.'
		? vscode.Uri.joinPath(root.rootUri, 'media')
		: vscode.Uri.joinPath(root.rootUri, ...folder.split('/'), 'media');
	const relative = path.posix.dirname(address);
	const to = relative === '.' || relative === ''
		? vscode.Uri.joinPath(destination, 'media')
		: vscode.Uri.joinPath(destination, ...relative.split('/'), 'media');
	try {
		return await copyTree(from, to);
	} catch {
		// Most pages have no pictures; a missing folder is the normal case, not a problem to report.
		return 0;
	}
}

async function copyTree(from: vscode.Uri, to: vscode.Uri): Promise<number> {
	let files = 0;
	await vscode.workspace.fs.createDirectory(to);
	for (const [name, kind] of await vscode.workspace.fs.readDirectory(from)) {
		const source = vscode.Uri.joinPath(from, name);
		const target = vscode.Uri.joinPath(to, name);
		if (kind === vscode.FileType.Directory) {
			files += await copyTree(source, target);
		} else if (kind === vscode.FileType.File) {
			await vscode.workspace.fs.copy(source, target, { overwrite: true });
			files += 1;
		}
	}
	return files;
}

async function write(destination: vscode.Uri, relative: string, content: string, written: Set<string>): Promise<number> {
	if (written.has(relative)) {
		return 0;
	}
	written.add(relative);
	const target = vscode.Uri.joinPath(destination, ...relative.split('/'));
	await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(target, '..'));
	await vscode.workspace.fs.writeFile(target, new TextEncoder().encode(content));
	return 1;
}
