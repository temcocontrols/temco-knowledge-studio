// The one bundler step this extension has.
//
// `tsc` produces the extension host code in `out/`; it cannot produce a webview bundle, because a surface is browser code
// with npm dependencies. This builds each surface into `out/webview/`, beside the extension host code and inside the one
// directory this repository already treats as build output:
//
//   out/webview/grid/    Univer's spreadsheet, for a CSV in Grid mode
//
// The page editor's bundle is not built here: that surface lives in `extensions/temco-editor`, which builds its own.
//
// Run by `npm run build-webview`, and again by `vscode:prepublish` so a packaged extension always carries fresh
// bundles. The output is *not* committed: `out/` is ignored by git, and a committed `.js` would be rejected by the
// repository's `local/code-no-new-javascript-files` rule. Build it once when working from a source tree.
//
// Every bundle is `iife` on purpose: a webview has no module loader, and there is no CDN to fall back on.
import { rm, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = fileURLToPath(new URL('..', import.meta.url));

/** Where `src/webview.ts` and `src/gridEditor.ts` look for their bundles. Keep them in step. */
const output = join(here, 'out', 'webview');

/** The surfaces, by the folder each writes into. */
const SURFACES = [
	{ name: 'grid', entry: join(here, 'webview', 'grid.ts') },
];

const shared = {
	bundle: true,
	minify: true,
	format: 'iife',
	platform: 'browser',
	target: ['chrome120'],
	sourcemap: false,
	logLevel: 'warning',
	define: { 'process.env.NODE_ENV': '"production"' },
	// Fonts and images a bundled theme references. They land beside the bundle and are loaded by relative URL.
	loader: {
		'.woff2': 'file',
		'.woff': 'file',
		'.ttf': 'file',
		'.eot': 'file',
		'.svg': 'file',
		'.png': 'file',
	},
	assetNames: 'assets/[name]-[hash]',
	chunkNames: '[name]-[hash]',
	legalComments: 'none',
};

/** Bytes under a folder, for the one line of output worth printing. */
async function weigh(folder) {
	let total = 0;
	for (const entry of await readdir(folder, { withFileTypes: true })) {
		const path = join(folder, entry.name);
		total += entry.isDirectory() ? await weigh(path) : (await stat(path)).size;
	}
	return total;
}

for (const surface of SURFACES) {
	const outdir = join(output, surface.name);
	await rm(outdir, { recursive: true, force: true });
	await build({
		...shared,
		entryPoints: { [surface.name]: surface.entry },
		outdir,
	});
	const kib = Math.round((await weigh(outdir)) / 1024);
	console.log(`out/webview/${surface.name}: ${kib} KB`);
}
