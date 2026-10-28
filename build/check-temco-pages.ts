/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Every button a page draws must lead somewhere.
//
// A page is HTML: `<button data-command="temcoDocs.buildSite">`, a card's `command: 'temcoProjects.addSource'`, a row's
// `data-command`. Nothing checks those strings. A renamed command leaves a button that looks alive, posts a message, and
// does nothing at all — no error, no console message, no failed build. It is the most expensive kind of typo, because
// the only way to find it is to click every button on every page.
//
// So this walks the page builders of every module, collects every command name any of them can draw, and holds the
// list against the commands the platform declares (its manifests) and registers (`registerCommand`). Commands the
// workbench itself owns — `workbench.*`, `vscode.*`, `revealFileInOS`, `openExternal` — are allowed through by prefix,
// because they are not ours to declare.
//
// Run by `npm run check-temco` from the repository root.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, '');
const modules = join(root, 'extensions');

/** Commands the editor owns rather than this platform. */
const BUILT_IN = [
	/^workbench\./,
	/^vscode\./,
	/^revealFileInOS$/,
	/^openExternal$/,
	/^setContext$/,
	/^editor\.action\./
];

/** Every `.ts` under a directory, depth first. */
function sources(directory: string): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			if (entry.name !== 'node_modules' && entry.name !== 'out') {
				found.push(...sources(path));
			}
		} else if (entry.name.endsWith('.ts')) {
			found.push(path);
		}
	}
	return found;
}

interface Where {
	id: string;
	at: string;
}

/** The commands the platform declares in a manifest, and the ones it registers in code. */
const declared = new Set<string>();
const drawn: Where[] = [];
const manifests: string[] = [];

/** Every view id, because VS Code registers `<viewId>.focus` for each contributed view by itself. */
const views = new Set<string>();

for (const module of readdirSync(modules, { withFileTypes: true })) {
	if (!module.isDirectory() || !module.name.startsWith('temco-')) {
		continue;
	}
	const directory = join(modules, module.name);
	const manifestPath = join(directory, 'package.json');
	let manifest: { contributes?: { commands?: { command?: string }[]; views?: { [where: string]: { id?: string }[] } } } | undefined;
	try {
		manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
		manifests.push(manifestPath);
	} catch {
		manifest = undefined;
	}
	for (const command of manifest?.contributes?.commands ?? []) {
		if (typeof command.command === 'string') {
			declared.add(command.command);
		}
	}
	for (const list of Object.values(manifest?.contributes?.views ?? {})) {
		for (const view of list) {
			if (typeof view.id === 'string') {
				views.add(view.id);
			}
		}
	}

	const sourceDirectory = join(directory, 'src');
	let files: string[] = [];
	try {
		files = sources(sourceDirectory);
	} catch {
		continue;
	}
	for (const file of files) {
		const lines = readFileSync(file, 'utf8').split('\n');
		lines.forEach((line, index) => {
			const where = `${relative(root, file).replace(/\\/g, '/')}:${index + 1}`;
			// A command the module registers is a command the module has.
			for (const match of line.matchAll(/registerCommand\(\s*'([^']+)'/g)) {
				declared.add(match[1]);
			}
			// A command a page can draw: the `data-command` attribute, or the same thing built as a string.
			for (const match of line.matchAll(/data-command="([^"$]+)"/g)) {
				drawn.push({ id: match[1], at: where });
			}
			for (const match of line.matchAll(/data-command=\\"([^"$\\]+)\\"/g)) {
				drawn.push({ id: match[1], at: where });
			}
		});
	}
}

/** 	emcoDocs.pages.focus is VS Code's own command for a contributed view: it exists without being declared. */
const isViewFocus = (id: string): boolean => id.endsWith('.focus') && views.has(id.slice(0, -'.focus'.length));

const unknown = drawn.filter((entry) => !declared.has(entry.id) && !isViewFocus(entry.id) && !BUILT_IN.some((pattern) => pattern.test(entry.id)));
const byCommand = new Map<string, string[]>();
for (const entry of unknown) {
	byCommand.set(entry.id, [...(byCommand.get(entry.id) ?? []), entry.at]);
}

const print = (message: string): void => console.log(message);

print(`${manifests.length} manifests, ${declared.size} declared commands, ${drawn.length} command attributes drawn.`);

if (byCommand.size > 0) {
	console.error('\nThese buttons name a command nothing declares or registers — clicking them would do nothing:');
	for (const [id, places] of byCommand) {
		console.error(`  ${id}\n    drawn at ${places.join('\n    drawn at ')}`);
	}
	process.exit(1);
}

print('every command a page draws is declared or registered.');
