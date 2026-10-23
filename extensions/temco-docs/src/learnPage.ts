// The Temco Learn portal page, as a pure function.
//
// Split out of `learnPortal.ts` so it can be tested without an extension host and without a folder: what a manifest
// *means* and what the page *says* are decisions, and decisions are worth a fixture. Reading the folder and writing the
// file stay in `learnPortal.ts`, where the `vscode` API is.

/** One published product, as a reader site needs to list it. */
export interface Product {
	id: string;
	title: string;
	latest: string;
	versions: string[];
}

/**
 * A published product from its folder name and its `manifest.json`, or `undefined` when the manifest says nothing that
 * can be linked to.
 *
 * The publisher has written three shapes over time: `latest` and `versions`, a single `version`, and `versions` alone
 * with the newest first. All three are read, in that order of preference, because a manifest already on disk is not
 * rewritten by an upgrade.
 */
export function toProduct(folder: string, manifest: unknown): Product | undefined {
	if (manifest === null || typeof manifest !== 'object') {
		return undefined;
	}
	const record = manifest as { title?: unknown; latest?: unknown; version?: unknown; versions?: unknown };
	const versions = Array.isArray(record.versions)
		? record.versions.filter((value): value is string => typeof value === 'string')
		: [];
	const latest =
		typeof record.latest === 'string'
			? record.latest
			: typeof record.version === 'string'
				? record.version
				: versions[0];
	if (latest === undefined || latest === '') {
		return undefined;
	}
	return {
		id: folder,
		title: typeof record.title === 'string' && record.title !== '' ? record.title : folder,
		latest,
		versions: versions.length > 0 ? versions : [latest],
	};
}

/** Text that came from a manifest, escaped for a page. */
function escape(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/** The portal page: every published product, its newest version, and a link to every version. */
export function portalPage(products: readonly Product[]): string {
	const cards = products
		.map(
			(product) => `<section class="card">
  <h2>${escape(product.title)}</h2>
  <p class="meta">Latest <b>${escape(product.latest)}</b></p>
  <p><a class="open" href="${encodeURIComponent(product.id)}/${encodeURIComponent(product.latest)}/">Read the documentation</a></p>
  <p class="meta">Versions: ${product.versions
		.map(
			(version) =>
				`<a href="${encodeURIComponent(product.id)}/${encodeURIComponent(version)}/">${escape(version)}</a>`
		)
		.join(' · ')}</p>
</section>`
		)
		.join('\n');
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
