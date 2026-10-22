// The Temco Learn reader, in its smallest honest form: a portal page over the product packages.
//
// Each published product has `manifest.json` ({id, title, version, latest, versions}) and one folder per version.
// This reads those manifests and writes `index.html` at the top of the published folder, so serving that folder
// gives a reader the product list, each product's newest version, and a link to every version published.

import * as vscode from 'vscode';
import { escapeHtml as esc } from './ui';

interface Product {
	id: string;
	title: string;
	latest: string;
	versions: string[];
}

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
			const manifest = JSON.parse(Buffer.from(raw).toString('utf8')) as Partial<Product> & { version?: string };
			const versions = Array.isArray(manifest.versions)
				? manifest.versions.filter((value): value is string => typeof value === 'string')
				: [];
			const latest = manifest.latest ?? manifest.version ?? versions[0];
			if (latest !== undefined) {
				products.push({ id: name, title: manifest.title ?? name, latest, versions: versions.length > 0 ? versions : [latest] });
			}
		} catch {
			// Not a product package: no manifest, or one that is not JSON.
		}
	}
	return products.sort((a, b) => a.title.localeCompare(b.title));
}

function page(products: readonly Product[]): string {
	const cards = products.map((product) => `<section class="card">
  <h2>${esc(product.title)}</h2>
  <p class="meta">Latest <b>${esc(product.latest)}</b></p>
  <p><a class="open" href="${encodeURIComponent(product.id)}/${encodeURIComponent(product.latest)}/">Read the documentation</a></p>
  <p class="meta">Versions: ${product.versions.map((version) =>
		`<a href="${encodeURIComponent(product.id)}/${encodeURIComponent(version)}/">${esc(version)}</a>`).join(' · ')}</p>
</section>`).join('\n');
	return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Temco Learn</title>
<style>
body { font-family: Segoe UI, system-ui, sans-serif; margin: 0; color: #1b1b1b; background: #f5f6f8; }
header { background: #0b3d5c; color: #fff; padding: 28px 40px; }
header h1 { margin: 0; font-size: 24px; font-weight: 600; }
main { max-width: 960px; margin: 24px auto; padding: 0 24px; display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
.card { background: #fff; border: 1px solid #dcdfe4; border-radius: 4px; padding: 16px 20px; }
.card h2 { margin: 0 0 6px; font-size: 18px; }
.meta { color: #5b6470; font-size: 13px; }
a { color: #0b61a4; }
.open { font-weight: 600; }
</style></head><body>
<header><h1>Temco Learn</h1></header>
<main>${cards.length > 0 ? cards : '<p>No product has been published yet.</p>'}</main>
</body></html>
`;
}

/** Rewrites the portal page, so the product list always matches what has been published. */
export async function writePortal(publishedRoot: vscode.Uri): Promise<void> {
	const products = await readProducts(publishedRoot);
	await vscode.workspace.fs.writeFile(
		vscode.Uri.joinPath(publishedRoot, 'index.html'),
		Buffer.from(page(products), 'utf8')
	);
}
