// The one bundler step this module has.
//
// `tsc` produces the extension host code in `out/`; it cannot produce the project view, because that view is browser code
// with npm dependencies (React and Fluent UI). This builds it into `out/webview/preview/` — beside the extension host code,
// inside the one directory this repository already treats as build output:
//
//   out/webview/preview/preview.js    the page a reader gets, bundled
//   out/webview/preview/preview.css   what Fluent does not draw
//
// The output is *not* committed: `out/` is ignored by git, and a committed `.js` would be rejected by the repository's
// `code-no-new-javascript-files` rule. `src/site.ts` throws if the bundle is missing, so a source tree that never ran this
// step says so instead of serving an unstyled page.
import { rm, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = fileURLToPath(new URL('..', import.meta.url));

/** Where `src/site.ts` looks for the bundle: `out/webview/preview/preview.js`. Keep the two in step. */
const assets = 'preview';
const outdir = join(here, 'out', 'webview', assets);

/** Bytes under a folder, for the one line of output worth printing. */
async function weigh(folder: string): Promise<number> {
	let total = 0;
	for (const entry of await readdir(folder, { withFileTypes: true })) {
		const path = join(folder, entry.name);
		total += entry.isDirectory() ? await weigh(path) : (await stat(path)).size;
	}
	return total;
}

await rm(outdir, { recursive: true, force: true });
await build({
	entryPoints: { [assets]: join(here, 'webview', assets, 'main.tsx') },
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
	legalComments: 'none'
});

// A bundle without its stylesheet opens as an unstyled page, which reads as a broken site rather than a missing file.
for (const required of [`${assets}.js`, `${assets}.css`]) {
	if (!(await stat(join(outdir, required)).catch(() => null))) {
		throw new Error(`out/webview/${assets}/${required} was not written — does the entry import its stylesheet?`);
	}
}
console.log(`out/webview/${assets}: ${Math.round((await weigh(outdir)) / 1024)} KB`);
