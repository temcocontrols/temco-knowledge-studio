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
