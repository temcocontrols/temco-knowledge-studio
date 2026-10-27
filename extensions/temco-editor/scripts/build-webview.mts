// The one bundler step this extension has.
//
// `tsc` produces the extension host code in `out/`; it cannot produce a webview bundle, because the surface is browser
// code with npm dependencies. This builds it into `out/webview/page/` — beside the extension host code, inside the one
// directory this repository already treats as build output. The output is *not* committed: a committed `.js` would be
// rejected by the `local/code-no-new-javascript-files` rule.
//
// The bundle is `iife` on purpose: a webview has no module loader, and there is no CDN to fall back on.
import { rm, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = fileURLToPath(new URL('..', import.meta.url));

/** Where `src/bridge.ts` looks for the bundle. Keep the two in step. */
const output = join(here, 'out', 'webview');

/** Bytes under a folder, for the one line of output worth printing. */
async function weigh(folder: string): Promise<number> {
	let total = 0;
	for (const entry of await readdir(folder, { withFileTypes: true })) {
		const path = join(folder, entry.name);
		total += entry.isDirectory() ? await weigh(path) : (await stat(path)).size;
	}
	return total;
}

const outdir = join(output, 'page');
await rm(outdir, { recursive: true, force: true });
await build({
	entryPoints: { page: join(here, 'webview', 'page', 'main.tsx') },
	outdir,
	bundle: true,
	minify: true,
	format: 'iife',
	platform: 'browser',
	target: ['chrome120'],
	sourcemap: false,
	logLevel: 'warning',
	jsx: 'automatic',
	define: { 'process.env.NODE_ENV': '"production"' },
	loader: {
		'.woff2': 'file',
		'.woff': 'file',
		'.ttf': 'file',
		'.svg': 'file',
		'.png': 'file',
	},
	assetNames: 'assets/[name]-[hash]',
	chunkNames: '[name]-[hash]',
	legalComments: 'none',
});

const kib = Math.round((await weigh(outdir)) / 1024);
// `bridge.ts` asks the webview for `page.js` and `page.css` by name; a bundle without its stylesheet opens as an
// unstyled page, which looks like a broken surface rather than a missing file.
for (const required of ['page.js', 'page.css']) {
	if (!(await stat(join(outdir, required)).catch(() => null))) {
		throw new Error(`out/webview/page/${required} was not written — does the entry import its stylesheet?`);
	}
}
console.log(`out/webview/page: ${kib} KB`);
