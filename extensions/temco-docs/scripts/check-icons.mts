// Every icon a page asks for must exist in the sprite.
//
// `icon('cloud-upload')` renders `<use href="#i-cloud-upload">`, and a missing symbol is not an error anywhere: the SVG is
// emitted, the browser finds nothing, and the button keeps its label with an invisible gap where the glyph should be. No
// compiler, no lint and no runtime warning catches it — only looking at every button does. This looks at all of them.
//
// The sprite belongs to `temco-ui`, so the check reads that module's `icons.svg` and the call sites here.

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, '');
const spritePath = join(root, '..', 'temco-ui', 'media', 'icons.svg');

assert.ok(existsSync(spritePath), `the icon sprite is missing: ${spritePath}`);
const sprite = readFileSync(spritePath, 'utf8');
const known = new Set([...sprite.matchAll(/id="i-([A-Za-z-]+)"/gu)].map(match => match[1]));
assert.ok(known.size > 20, `only ${known.size} icons found in the sprite — is it the right file?`);

/** Every `.ts` under a directory, depth first. */
function sources(directory: string): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			found.push(...sources(path));
		} else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
			found.push(path);
		}
	}
	return found;
}

// The three ways a page names a glyph: `mark:` on a list row or a button, `icon(…)` inline, `toneMark(…)` for a state.
const asked = [
	/['"`]?mark['"`]?:\s*'([A-Za-z-]+)'/gu,
	/\bicon\(\s*'([A-Za-z-]+)'/gu,
	/\btoneMark\(\s*'([A-Za-z-]+)'/gu
];

const missing: string[] = [];
let looked = 0;
for (const file of sources(join(root, 'src'))) {
	const text = readFileSync(file, 'utf8');
	text.split(/\r?\n/u).forEach((line, index) => {
		for (const pattern of asked) {
			for (const match of line.matchAll(pattern)) {
				looked += 1;
				if (!known.has(match[1])) {
					missing.push(`${relative(root, file).replace(/\\/gu, '/')}:${index + 1}  ${match[1]}`);
				}
			}
		}
	});
}

if (missing.length > 0) {
	console.error(
		`These icons are asked for but not in the sprite, so the button renders with an empty gap:\n\n` +
			missing.map(entry => `  ${entry}`).join('\n') +
			`\n\nUse one of: ${[...known].sort().join(' ')}`
	);
	process.exit(1);
}

console.log(`${looked} icon references, all present in the sprite (${known.size} icons).`);
