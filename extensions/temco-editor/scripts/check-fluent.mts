// The Fluent boundary, checked rather than remembered.
//
// Design §7.1 says one package owns Fluent and every other surface imports that package, so there is one Fluent version in
// a bundle and one place to swap it. The design's answer is `extensions/temco-ui`. Today `temco-ui` is a compiled
// extension with no React runtime of its own, and there is exactly one Fluent surface, so the rule is enforced where it
// can be enforced for free: the folders that draw a page (webview/markdown and webview/shared) are the only ones allowed
// to import Fluent, and this script fails the build when any other file does. Everything else here is extension host code,
// and a Fluent import there would be a second design language.
// When a second surface needs Fluent, the list below gains a folder *and* the provider moves into `temco-ui` — that is the
// moment the extraction pays for itself, and this check is what will point at it.

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('..', import.meta.url));
const allowed = [join('webview', 'markdown'), join('webview', 'shared')];
const roots = ['src', 'webview', 'scripts'];
const extensions = ['.ts', '.tsx', '.mts'];

const failures: string[] = [];

async function walk(directory: string): Promise<string[]> {
	let entries;
	try {
		entries = await readdir(directory, { withFileTypes: true });
	} catch {
		return [];
	}
	const files: string[] = [];
	for (const entry of entries) {
		const full = join(directory, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === 'node_modules' || entry.name === 'out') {
				continue;
			}
			files.push(...(await walk(full)));
		} else if (extensions.some((suffix) => entry.name.endsWith(suffix))) {
			files.push(full);
		}
	}
	return files;
}

for (const root of roots) {
	for (const file of await walk(join(here, root))) {
		const source = await readFile(file, 'utf8');
		const importPattern = /(?:from|import)\s*\(?\s*['"]@fluentui\//;
		if (!importPattern.test(source)) {
			continue;
		}
		const folder = relative(here, file);
		if (allowed.some((prefix) => folder.startsWith(prefix))) {
			continue;
		}
		const line = source.split('\n').findIndex((text) => importPattern.test(text)) + 1;
		failures.push(`${folder}:${line}`);
	}
}

if (failures.length > 0) {
	console.error('Fluent is imported outside an allowed surface:');
	for (const failure of failures) {
		console.error(`  ${failure}`);
	}
	console.error(`Allowed: ${allowed.join(', ')}. Move the code into the allowed surface, or move the provider into extensions/temco-ui and widen this list.`);
	process.exit(1);
}

console.log(`Fluent boundary OK — only ${allowed.join(', ')} imports @fluentui.`);
