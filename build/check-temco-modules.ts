/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// The module guard: three mistakes that no compiler and no lint can see, and that each cost a whole editor
// session.
//
//   1. **A circle in the dependency graph.** `extensionDependencies` that run in both directions disable *every*
//      extension in the circle: VS Code reports the loop and activates none of them, so the application comes up
//      with a sidebar that says nothing and a command palette missing most of its entries. The provider must be
//      the one that is required — a consumer that is also a provider has to be split, or the second direction
//      has to be a command (see `docs/temco-platform/modules/README.md`, "How two modules may talk").
//
//   2. **A menu entry for a command nobody declares.** A view's menu, a welcome page's link, a submenu: a
//      declared id that no manifest carries is a button that does nothing, or a menu that never appears. Menus
//      may point at *another* module's command — that is the whole point of a menu — so the question is only
//      whether *some* module declares it.
//
//   3. **A source binding the loader has already taken.** The extension host evaluates each compiled file
//      through the CommonJS wrapper — `exports, require, module, __filename, __dirname` — and a module-level
//      `const module = …` in an extension file is reported by the running editor as
//      `SyntaxError: Identifier 'module' has already been declared`, thrown from Node's `wrapSafe` at the
//      declaration. Observed at `out/store.js:49`, which killed `temco-repositories` activation and, through
//      it, every module that depends on it. A plain `node` run of the same file accepts it, so only the
//      editor reproduces this; a binding inside a function is harmless, a module-level one is fatal.
//
// Run by the platform build (`npm run compile` → `check-temco`). No dependencies: it reads the manifests as text.
//
// It looks at ids with a `temco` prefix only: everything else in a menu is VS Code's own (`workbench.action.*`,
// `revealFileInOS`, a built-in view id), and this guard has no business guessing which of those exist.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, '');

interface Manifest {
	name?: string;
	publisher?: string;
	extensionDependencies?: string[];
	contributes?: {
		commands?: { command?: string }[];
		submenus?: { id?: string }[];
		viewsContainers?: Record<string, { id?: string }[]>;
		views?: Record<string, { id?: string }[]>;
		menus?: Record<string, { command?: string; submenu?: string; view?: string }[]>;
		viewsWelcome?: { view?: string; contents?: string }[];
	};
}

/** Every module folder: a `temco-*` directory with a manifest. A folder without one is reserved, not a module. */
const folders = readdirSync(join(root, 'extensions'))
	.filter((entry) => entry.startsWith('temco-') && existsSync(join(root, 'extensions', entry, 'package.json')))
	.sort();

const manifests = new Map<string, Manifest>();
for (const folder of folders) {
	manifests.set(
		folder,
		JSON.parse(readFileSync(join(root, 'extensions', folder, 'package.json'), 'utf8')) as Manifest
	);
}

/** The module a full extension id names, so a dependency can be checked against the folders that exist. */
function folderOf(extensionId: string): string | undefined {
	return folders.find((folder) => {
		const manifest = manifests.get(folder);
		return `${manifest?.publisher}.${manifest?.name}` === extensionId;
	});
}

/** Everything every module declares, by kind. */
const declared = { command: new Set<string>(), submenu: new Set<string>(), view: new Set<string>() };
for (const [folder, manifest] of manifests) {
	for (const entry of manifest.contributes?.commands ?? []) {
		if (entry.command) {
			declared.command.add(entry.command);
		}
	}
	for (const entry of manifest.contributes?.submenus ?? []) {
		if (entry.id) {
			declared.submenu.add(entry.id);
		}
	}
	for (const list of Object.values(manifest.contributes?.views ?? {})) {
		for (const view of list) {
			if (view.id) {
				declared.view.add(view.id);
			}
		}
	}
	void folder;
}

const problems: string[] = [];

// 1. The dependency graph.
const graph = new Map<string, string[]>();
for (const [folder, manifest] of manifests) {
	const deps: string[] = [];
	for (const id of manifest.extensionDependencies ?? []) {
		const target = folderOf(id);
		if (target === undefined) {
			problems.push(`${folder} requires ${id}, which is not one of the modules.`);
			continue;
		}
		deps.push(target);
	}
	graph.set(folder, deps);
}

/** The path from `start` back to itself, if there is one — depth first, and the first one found is reported. */
function cycleFrom(start: string): string[] | undefined {
	const walk = (node: string, path: string[]): string[] | undefined => {
		for (const next of graph.get(node) ?? []) {
			if (next === start) {
				return [start, ...path, start];
			}
			if (path.includes(next)) {
				continue;
			}
			const found = walk(next, [...path, next]);
			if (found) {
				return found;
			}
		}
		return undefined;
	};
	return walk(start, []);
}

const reported = new Set<string>();
for (const folder of folders) {
	const cycle = cycleFrom(folder);
	if (!cycle) {
		continue;
	}
	// A circle is reported once, from its alphabetically first member, so a two-way edge is one line and not two.
	const key = [...cycle].slice(0, -1).sort().join(' ');
	if (reported.has(key)) {
		continue;
	}
	reported.add(key);
	problems.push(
		`dependency loop: ${cycle.join(' → ')}\n` +
		'    VS Code disables every extension in a loop. The provider is the one that is required; the other\n' +
		'    direction has to be a command, not a dependency.'
	);
}

// 2. What the menus offer, against what the modules declare.
for (const [folder, manifest] of manifests) {
	const contributes = manifest.contributes ?? {};
	const check = (kind: 'command' | 'submenu' | 'view', id: string | undefined, where: string): void => {
		if (!id || !id.startsWith('temco') || declared[kind].has(id)) {
			return;
		}
		problems.push(`${folder}: ${where} names the ${kind} \`${id}\`, which no module declares.`);
	};

	for (const [menu, entries] of Object.entries(contributes.menus ?? {})) {
		for (const entry of entries) {
			check('command', entry.command, `menus.${menu}`);
			check('submenu', entry.submenu, `menus.${menu}`);
			check('view', entry.view, `menus.${menu}`);
		}
	}
	for (const welcome of contributes.viewsWelcome ?? []) {
		check('view', welcome.view, 'viewsWelcome');
		// A welcome's prose carries links: `[Create a project](command:temcoProjects.newProject)`.
		for (const match of (welcome.contents ?? '').matchAll(/command:([A-Za-z0-9_.-]+)/g)) {
			check('command', match[1], `the welcome text of ${welcome.view ?? 'a view'}`);
		}
	}
}

// 3. A view pointed at a container that no manifest declares.
//
// A view is declared *under a container id*, and the container is what puts an icon in the activity bar. When the two
// disagree — a typo, or a container removed in a redesign while its views stayed — the workbench does not complain: the
// view is simply never shown, and no menu, no panel and no error message mentions it. Moving a module's views into
// another module's container is a supported thing to do (that is how Docs carries the repositories list), which makes
// this mistake easy to introduce deliberately and impossible to notice.
const containers = new Map<string, string>();
for (const [folder, manifest] of manifests) {
	for (const list of Object.values(manifest.contributes?.viewsContainers ?? {})) {
		for (const container of list) {
			if (!container.id) {
				continue;
			}
			const owner = containers.get(container.id);
			if (owner !== undefined && owner !== folder) {
				problems.push(
					`${folder} and ${owner} both declare the container "${container.id}".\n` +
					'    The workbench keeps one of them, so half the container\'s views vanish with no message. Give the\n' +
					'    second one its own id, or move its views under the first.'
				);
				continue;
			}
			containers.set(container.id, folder);
		}
	}
}

for (const [folder, manifest] of manifests) {
	for (const containerId of Object.keys(manifest.contributes?.views ?? {})) {
		if (!containers.has(containerId)) {
			problems.push(
				`${folder} contributes views under the container "${containerId}", which no module declares.\n` +
				'    A view whose container does not exist is never shown — no icon, no panel, no error. Declare the\n' +
				'    container in `contributes.viewsContainers`, or point these views at one that exists.'
			);
		}
	}
}

// 4. A source binding that the module wrapper has already taken.
//
// Only `const`/`let`/`class` collide with a parameter of the wrapper function — a `var` or a function
// declaration may share a parameter's name — so this checks those, plus an `import * as module` alias, which
// the compiler turns into one of them.
const wrapperNames = ['module', 'exports', 'require', '__filename', '__dirname'];
const alternation = wrapperNames.join('|');
const lexical = new RegExp(`^(?:export\\s+)?(?:const|let|class)\\s+(${alternation})\\b`);
const alias = new RegExp(`^import\\s+\\*\\s+as\\s+(${alternation})\\b`);

for (const folder of folders) {
	const source = join(root, 'extensions', folder, 'src');
	if (!existsSync(source)) {
		continue;
	}
	for (const entry of readdirSync(source, { recursive: true, encoding: 'utf8' })) {
		if (!entry.endsWith('.ts') || entry.endsWith('.d.ts')) {
			continue;
		}
		const lines = readFileSync(join(source, entry), 'utf8').split(/\r?\n/);
		lines.forEach((line, index) => {
			const found = lexical.exec(line) ?? alias.exec(line);
			if (!found) {
				return;
			}
			problems.push(
				`${folder}/src/${entry.replace(/\\/g, '/')}:${index + 1} declares a top-level \`${found[1]}\`.\n` +
				'    The compiled entry is CommonJS, so the module wrapper has already bound that name, and the file\n' +
				'    throws "Identifier \'…\' has already been declared" before it runs. Rename the binding — a name\n' +
				'    inside a function is fine, only a module-level one is fatal.'
			);
		});
	}
}

if (problems.length > 0) {
	console.error(`The Temco modules do not agree with each other:\n\n${problems.map((p) => `  ${p}`).join('\n\n')}`);
	process.exit(1);
}

console.log(`${folders.length} modules, no dependency loops, every menu id declared, every view in a declared container, no name taken by the module wrapper.`);
