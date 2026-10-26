// The Temco Learn reader, in its smallest honest form: a portal page over the product packages.
//
// Each published product has `manifest.json` ({id, title, version, latest, versions}) and one folder per version.
// This reads those manifests and writes `index.html` at the top of the published folder, so serving that folder
// gives a reader the product list, each product's newest version, and a link to every version published.
//
// What a manifest means and what the page says are `learnPage.ts`, which has no `vscode` import and is covered by
// `scripts/check-learn.mts`. This file is only the folder and the file.

import * as vscode from 'vscode';
import { portalPage, toProduct, type Product } from './learnPage';
import { readerPage, type ReaderPage } from './learnReader';

/** The products under `publishedRoot`, read from their manifests; a folder without a readable one is skipped. */
async function readProducts(publishedRoot: vscode.Uri): Promise<Product[]> {
	const products: Product[] = [];
	let entries: [string, vscode.FileType][] = [];
	try {
		entries = await vscode.workspace.fs.readDirectory(publishedRoot);
	} catch {
		return products;
	}
	for (const [name, type] of entries) {
		if (type !== vscode.FileType.Directory) {
			continue;
		}
		try {
			const raw = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(publishedRoot, name, 'manifest.json'));
			const product = toProduct(name, JSON.parse(Buffer.from(raw).toString('utf8')));
			if (product !== undefined) {
				products.push(product);
			}
		} catch {
			// Not a product package: no manifest, or one that is not JSON.
		}
	}
	return products.sort((a, b) => a.title.localeCompare(b.title));
}

/** Rewrites the portal page, so the product list always matches what has been published. */
export async function writePortal(publishedRoot: vscode.Uri): Promise<void> {
	const products = await readProducts(publishedRoot);
	await vscode.workspace.fs.writeFile(
		vscode.Uri.joinPath(publishedRoot, 'index.html'),
		Buffer.from(portalPage(products), 'utf8')
	);
}

/** The HTML a generated site is made of, as (relative href, title) pairs, depth first and in name order. */
async function pagesOf(folder: vscode.Uri, prefix = ''): Promise<ReaderPage[]> {
	let entries: [string, vscode.FileType][] = [];
	try {
		entries = await vscode.workspace.fs.readDirectory(folder);
	} catch {
		return [];
	}
	const pages: ReaderPage[] = [];
	for (const [name, type] of entries.sort((a, b) => a[0].localeCompare(b[0]))) {
		if (type === vscode.FileType.Directory) {
			pages.push(...await pagesOf(vscode.Uri.joinPath(folder, name), `${prefix}${name}/`));
			continue;
		}
		// The reader itself, and the generator's own table of contents, are not documentation pages.
		if (!name.toLowerCase().endsWith('.html') || name === READER_FILE || name === 'toc.html') {
			continue;
		}
		const href = `${prefix}${name}`;
		pages.push({ href, title: await titleOf(vscode.Uri.joinPath(folder, name), name) });
	}
	// `index.html` is the site's home, so it is read first whatever the alphabet says.
	return pages.sort((a, b) => (a.href === 'index.html' ? -1 : b.href === 'index.html' ? 1 : 0));
}

/** A page's `<title>`, or its file name when it has none. Only the first few kilobytes are read: a `<title>` is early. */
async function titleOf(uri: vscode.Uri, name: string): Promise<string> {
	try {
		const raw = await vscode.workspace.fs.readFile(uri);
		const head = Buffer.from(raw).subarray(0, 4096).toString('utf8');
		const found = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head);
		const title = found?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
		return title === '' ? name.replace(/\.html$/i, '').replace(/[_-]+/g, ' ') : title;
	} catch {
		return name.replace(/\.html$/i, '');
	}
}

/** The name the reader is written under: beside the site, never over it. */
const READER_FILE = 'temco-reader.html';

/**
 * Writes the reader for one published version, beside the files the generator produced.
 *
 * The sidebar comes from the pages that are actually in the folder — not from a second list that could disagree with
 * them — which is why no doc set has to be told about the reader. `<product>` and `<version>` are the last two parts of
 * the destination, which is the shape every release folder already has.
 */
export async function writeReader(destination: vscode.Uri): Promise<vscode.Uri> {
	const parts = destination.path.split('/').filter((part) => part !== '');
	const version = parts[parts.length - 1] ?? '';
	const product = parts[parts.length - 2] ?? 'Documentation';
	const pages = await pagesOf(destination);
	let versions: string[] = [version];
	try {
		const siblings = await vscode.workspace.fs.readDirectory(vscode.Uri.joinPath(destination, '..'));
		versions = siblings
			.filter(([, type]) => type === vscode.FileType.Directory)
			.map(([name]) => name)
			.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
	} catch {
		// A destination with no siblings is a version on its own; the picker then offers only itself.
	}
	const page = readerPage({ product, version, versions, pages });
	const target = vscode.Uri.joinPath(destination, READER_FILE);
	await vscode.workspace.fs.writeFile(target, Buffer.from(page, 'utf8'));
	return target;
}
