// The bar teaches shortcuts, and a shortcut that does nothing is worse than no tooltip: a writer presses it, nothing
// happens, and they stop trusting the next hint too. That is exactly what had happened (`Ctrl+F` for find, `Ctrl+Shift+X`
// for strikethrough) and it is invisible in every other kind of test.
//
// So every `shortcut: '…'` in the ribbon must be traceable to something that really binds it, and this check is the trace:
//
//   engine    a `Mod-…` keymap in the Tiptap extension we register, or in `document.tsx`
//   host      a `keybindings` entry in `package.json`
//   shell     a key the webview handles itself (`main.tsx`) — not discoverable, so it is listed here by hand
//
// Pure Node: it reads files, it does not run a webview. Run with `npm run check-shortcuts`.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (relative: string): string => fileURLToPath(new URL(`../${relative}`, import.meta.url));
const read = (relative: string): string => readFileSync(here(relative), 'utf8');

/**
 * The packages whose keymaps we inherit, in the order `document.tsx` registers them.
 *
 * `StarterKit` carries bold, italic, strike, code, blockquote, the horizontal rule and undo/redo, and each of those lives in
 * its own installed package, so the keymap is read from the package rather than from the kit. Adding an extension means
 * adding it here — and if one is missing, this check says so instead of quietly passing.
 */
const ENGINE_PACKAGES = [
	'@tiptap/starter-kit',
	'@tiptap/extensions',
	'@tiptap/extension-bold',
	'@tiptap/extension-italic',
	'@tiptap/extension-strike',
	'@tiptap/extension-code',
	'@tiptap/extension-blockquote',
	'@tiptap/extension-code-block',
	'@tiptap/extension-underline',
	'@tiptap/extension-highlight',
	'@tiptap/extension-link',
];

/** Keys the shell owns. Kept here because a `window` listener cannot be discovered from the outside. */
const SHELL: Record<string, string> = {
	'mod+f': 'webview/page/main.tsx — the find bar',
	'mod+alt+o': 'webview/page/main.tsx — the outline rail',
};

/**
 * One spelling for a key, whichever way it was written.
 *
 * Tiptap writes `Mod-Shift-x`, VS Code writes `ctrl+alt+p`, the ribbon writes `Ctrl+Alt+P`. All three mean the same thing,
 * so they all become `mod+shift+x`: modifiers in a fixed order, then the key, lower-case.
 */
function canonical(parts: readonly string[]): string | undefined {
	const modifiers = new Set<string>();
	let key: string | undefined;
	for (const raw of parts) {
		const part = raw.trim().toLowerCase();
		if (part === '') {
			return undefined;
		}
		if (part === 'ctrl' || part === 'cmd' || part === 'meta' || part === 'mod' || part === 'command') {
			modifiers.add('mod');
		} else if (part === 'alt' || part === 'option') {
			modifiers.add('alt');
		} else if (part === 'shift') {
			modifiers.add('shift');
		} else if (key === undefined) {
			key = part;
		} else {
			return undefined;
		}
	}
	if (key === undefined) {
		return undefined;
	}
	return [...['mod', 'alt', 'shift'].filter(name => modifiers.has(name)), key].join('+');
}

const fromParts = (text: string): string | undefined => canonical(text.split('+'));

// --- what the bar promises ------------------------------------------------------------------------
const ribbon = read('webview/page/ribbon.tsx');
const advertised = new Map<string, string>();
for (const match of ribbon.matchAll(/shortcut: '([^']+)'/gu)) {
	const key = fromParts(match[1]);
	assert.ok(key !== undefined, `the ribbon advertises a shortcut this check cannot read: "${match[1]}"`);
	advertised.set(key, match[1]);
}
assert.ok(advertised.size >= 10, `expected the bar to advertise its shortcuts, found ${advertised.size}`);

// --- what actually binds them ---------------------------------------------------------------------
const bound = new Map<string, string>();

for (const name of ENGINE_PACKAGES) {
	const path = `node_modules/${name}/dist/index.js`;
	if (!existsSync(here(path))) {
		console.log(`note: cannot read ${name} — its keymaps are not verified`);
		continue;
	}
	for (const match of read(path).matchAll(/'?(Mod(?:-[A-Za-z0-9]+)+)'?/gu)) {
		const key = canonical(match[1].split('-'));
		if (key !== undefined && !bound.has(key)) {
			bound.set(key, name);
		}
	}
}

// Our own keymaps, written in the engine seam rather than taken from a package.
for (const match of read('webview/page/document.tsx').matchAll(/'(Mod(?:-[A-Za-z0-9]+)+)'/gu)) {
	const key = canonical(match[1].split('-'));
	if (key !== undefined) {
		bound.set(key, 'webview/page/document.tsx');
	}
}

// The host's own keybindings, which only reach the surface because they are contributed with a `when` on this editor.
const manifest = JSON.parse(read('package.json')) as {
	contributes?: { keybindings?: ReadonlyArray<{ key?: string; mac?: string }> };
};
for (const entry of manifest.contributes?.keybindings ?? []) {
	const key = entry.key === undefined ? undefined : fromParts(entry.key);
	if (key !== undefined) {
		bound.set(key, 'package.json');
	}
}

for (const [key, where] of Object.entries(SHELL)) {
	bound.set(key, where);
}

// --- the verdict ----------------------------------------------------------------------------------
const missing: string[] = [];
for (const [key, written] of advertised) {
	if (!bound.has(key)) {
		missing.push(`${written} (${key})`);
	}
}
assert.deepEqual(missing, [], `the ribbon teaches keys nothing binds:\n  ${missing.join('\n  ')}`);

// A bound key nobody advertises is not a defect — the engine binds more than the bar shows (`Mod-Shift-s`, for one).
const unused = [...bound.keys()].filter(key => !advertised.has(key));
const from = (name: string): number => [...bound.values()].filter(source => source === name).length;

console.log(
	`check-shortcuts: ${advertised.size}/${advertised.size} advertised keys are bound — ` +
	`${bound.size} bindings known (packages ${from('@tiptap/starter-kit') + from('@tiptap/extensions') + [...bound.values()].filter(s => s.startsWith('@tiptap/extension-')).length}, ` +
	`package.json ${from('package.json')}, shell ${Object.keys(SHELL).length}, document.tsx ${[...bound.values()].filter(s => s.includes('document.tsx')).length})`
);
if (unused.length > 0) {
	console.log(`  also bound, not shown in the bar: ${unused.join(', ')}`);
}
