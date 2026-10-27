// The commands have to agree with the manifest, and no id may be registered twice.
//
// A duplicate throws where the *later* one is registered — somewhere in the middle of `activate()` — so everything below
// it silently never happens, and the symptom never points at the mistake. A command declared in `package.json` but never
// registered is the other half: a palette entry and a menu item that do nothing when picked.
//
// Run by `npm run check-commands`, and by the platform build through `check-temco-commands`. No dependencies: it reads
// the sources and the manifest as text.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, '');

/** Every `.ts` file under a directory, depth first. */
function sourcesIn(directory: string): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			found.push(...sourcesIn(path));
		} else if (entry.name.endsWith('.ts')) {
			found.push(path);
		}
	}
	return found;
}

/** Where each command id is registered, by file and line. */
const registrations = new Map<string, string[]>();
for (const file of sourcesIn(join(root, 'src'))) {
	const lines = readFileSync(file, 'utf8').split('\n');
	lines.forEach((line, index) => {
		for (const match of line.matchAll(/registerCommand\(\s*'([^']+)'/g)) {
			const where = `${relative(root, file).replace(/\\/g, '/')}:${index + 1}`;
			registrations.set(match[1], [...(registrations.get(match[1]) ?? []), where]);
		}
	});
}

const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
	contributes?: { commands?: { command?: string }[] };
};

const declared = new Set(
	(manifest.contributes?.commands ?? [])
		.map(entry => entry.command)
		.filter((id): id is string => typeof id === 'string')
);

const problems: string[] = [];

for (const [id, places] of registrations) {
	if (places.length > 1) {
		problems.push(`${id} is registered ${places.length} times: ${places.join(', ')}`);
	}
}

for (const id of declared) {
	if (!registrations.has(id)) {
		problems.push(`${id} is declared in package.json but never registered`);
	}
}

for (const id of registrations.keys()) {
	if (!declared.has(id)) {
		problems.push(`${id} is registered but not declared in package.json`);
	}
}

if (problems.length > 0) {
	console.error('temco-editor: the commands and the manifest disagree:');
	for (const problem of problems) {
		console.error(`  ${problem}`);
	}
	process.exit(1);
}

console.log(`temco-editor: ${declared.size} commands, declared and registered once each.`);
