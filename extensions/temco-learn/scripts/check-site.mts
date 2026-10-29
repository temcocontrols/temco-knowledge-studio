// The site's folder rules, checked against real files.
//
// Every case here is something a reader would notice and a developer would not: a version that lists a page its build
// does not hold, a page list in the wrong order, an older build over a newer one, a project title taken from the folder
// instead of from the build. `site.ts` is pure folder work, so these are a throwaway tree and the files it writes —
// no editor, no browser, no network.

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface SiteModule {
	installSite(folder: string, app: string): Promise<string>;
	readSite(root: string): Promise<{ projects: { id: string; title: string; section: string; versions: { version: string; pages: { href: string; title: string }[] }[] }[] }>;
	writeSite(root: string, site: unknown): Promise<void>;
	addVersion(options: {
		root: string;
		app: string;
		id: string;
		title: string;
		section?: string;
		version: string;
		built: string;
	}): Promise<{ project: { title: string }; version: string; pages: number; destination: string }>;
	latestOf(project: { versions: { version: string }[] }): string | undefined;
	projectNameOf(build: string): Promise<string | undefined>;
	slugOf(title: string): string;
	compareVersions(one: string, other: string): number;
}

const source = fileURLToPath(new URL('../src/site.ts', import.meta.url));
const built = fileURLToPath(new URL('../out/site.js', import.meta.url));
const app = fileURLToPath(new URL('../site', import.meta.url));

try {
	assert.ok(statSync(built).mtimeMs >= statSync(source).mtimeMs, 'out/site.js is older than src/site.ts');
} catch (error) {
	console.log(`Cannot run: ${(error as Error).message}`);
	console.log('Compile first:  npm run compile');
	process.exit(1);
}

// `site.ts` reads two settings through `vscode`; nothing checked here reads one, but loading the module does need the
// import to resolve, so it is answered with a stub rather than a running editor.
const load = Module._load;
Module._load = function (request: string, parent: unknown, isMain: boolean) {
	if (request === 'vscode') {
		return { workspace: { getConfiguration: () => ({ get: () => undefined }) } };
	}
	return load.call(this as unknown as NodeModule, request, parent, isMain);
};

const site = createRequire(import.meta.url)(built) as SiteModule;

/** A build as the generator writes one: an index that lists the pages, and the pages themselves. */
function build(folder: string, project: string, pages: readonly string[]): string {
	mkdirSync(folder, { recursive: true });
	const links = pages.map((href) => `<li><a href="${href}">${href}</a></li>`).join('\n');
	writeFileSync(join(folder, 'index.html'), `<!doctype html><html><head><title>${project}</title></head><body><ul>${links}</ul></body></html>`);
	for (const href of pages) {
		const file = join(folder, ...href.split('/'));
		mkdirSync(join(file, '..'), { recursive: true });
		const name = href.replace(/\.html?$/i, '').split('/').pop() ?? href;
		writeFileSync(file, `<!doctype html><html><head><title>${name} · ${project}</title></head><body><h2 id="top">Top</h2></body></html>`);
	}
	return folder;
}

const cases: { name: string; run: () => Promise<void> }[] = [];
const test = (name: string, run: () => Promise<void>) => cases.push({ name, run });

/** A fresh site folder and a fresh build, removed whatever the case does with them. */
function fresh(): { root: string; keep: string; wide: string } {
	const base = mkdtempSync(join(tmpdir(), 'temco-learn-'));
	return {
		root: join(base, 'site'),
		keep: base,
		wide: build(join(base, 't3000', 'dist', 'site'), 'T3000', ['guides/intro.html', 'guides/setup.html', 'faq.html'])
	};
}

test('installing the app copies every page and the script, and starts an empty site', async () => {
	const space = fresh();
	try {
		await site.installSite(space.root, app);
		for (const file of ['index.html', 'project.html', 'reader.html', join('assets', 'site.js'), join('assets', 'site.css')]) {
			assert.ok(existsSync(join(space.root, file)), `${file} was not copied into the site`);
		}
		const data = JSON.parse(readFileSync(join(space.root, 'projects.json'), 'utf8')) as { projects: unknown[] };
		assert.deepEqual(data.projects, []);
	} finally {
		rmSync(space.keep, { recursive: true, force: true });
	}
});

test('the script installed into the site is the one that was built, and the site asks for no map', async () => {
	const space = fresh();
	try {
		await site.installSite(space.root, app);
		const installed = readFileSync(join(space.root, 'assets', 'site.js'), 'utf8');
		const compiled = readFileSync(fileURLToPath(new URL('../out/siteApp.js', import.meta.url)), 'utf8');
		assert.ok(installed.startsWith(compiled.slice(0, 400)), 'the installed script is not the built one');
		assert.doesNotMatch(installed, /sourceMappingURL/u, 'the site would ask for a source map it does not hold');
	} finally {
		rmSync(space.keep, { recursive: true, force: true });
	}
});

test('installing the app again keeps the data the site already holds', async () => {
	const space = fresh();
	try {
		await site.installSite(space.root, app);
		const before = '{"projects":[{"id":"t3000","title":"T3000","versions":[]}]}';
		writeFileSync(join(space.root, 'projects.json'), before);
		await site.installSite(space.root, app);
		assert.equal(readFileSync(join(space.root, 'projects.json'), 'utf8'), before, 'the site’s data was overwritten');
	} finally {
		rmSync(space.keep, { recursive: true, force: true });
	}
});

test('a build is copied in as it was, and its pages are listed in the build order', async () => {
	const space = fresh();
	try {
		await site.addVersion({ root: space.root, app, id: 't3000', title: 'T3000', version: '13.0', built: space.wide });
		assert.ok(existsSync(join(space.root, 't3000', '13.0', 'index.html')), 'the build was not copied in');
		const data = await site.readSite(space.root);
		assert.deepEqual(
			data.projects[0].versions[0].pages.map((page) => page.href),
			['guides/intro.html', 'guides/setup.html', 'faq.html']
		);
		assert.deepEqual(
			data.projects[0].versions[0].pages.map((page) => page.title),
			['intro', 'setup', 'faq']
		);
	} finally {
		rmSync(space.keep, { recursive: true, force: true });
	}
});

test('the build index is a page list, so it is not one of the pages', async () => {
	const space = fresh();
	try {
		await site.addVersion({ root: space.root, app, id: 't3000', title: 'T3000', version: '13.0', built: space.wide });
		const data = await site.readSite(space.root);
		assert.equal(
			data.projects[0].versions[0].pages.some((page) => page.href === 'index.html'),
			false,
			'the build index was listed as a document'
		);
	} finally {
		rmSync(space.keep, { recursive: true, force: true });
	}
});

test('a second version lists above the first, and the newest is the latest', async () => {
	const space = fresh();
	try {
		await site.addVersion({ root: space.root, app, id: 't3000', title: 'T3000', version: '9.0', built: space.wide });
		await site.addVersion({ root: space.root, app, id: 't3000', title: 'T3000', version: '13.0', built: space.wide });
		const data = await site.readSite(space.root);
		assert.deepEqual(data.projects[0].versions.map((version) => version.version), ['13.0', '9.0']);
		assert.equal(site.latestOf(data.projects[0] as never), '13.0');
	} finally {
		rmSync(space.keep, { recursive: true, force: true });
	}
});

test('adding the same version twice replaces it instead of duplicating it', async () => {
	const space = fresh();
	try {
		await site.addVersion({ root: space.root, app, id: 't3000', title: 'T3000', version: '13.0', built: space.wide });
		await site.addVersion({ root: space.root, app, id: 't3000', title: 'T3000', version: '13.0', built: space.wide });
		const data = await site.readSite(space.root);
		assert.deepEqual(data.projects[0].versions.map((version) => version.version), ['13.0']);
	} finally {
		rmSync(space.keep, { recursive: true, force: true });
	}
});

test('a second project is listed by its title, and keeps the section it had', async () => {
	const space = fresh();
	try {
		await site.addVersion({ root: space.root, app, id: 't3000', title: 'T3000', section: 'products', version: '13.0', built: space.wide });
		// A rebuild of the same project arrives without a section, and must not move the project back to the default.
		await site.addVersion({ root: space.root, app, id: 't3000', title: 'T3000', version: '14.0', built: space.wide });
		await site.addVersion({ root: space.root, app, id: 'bacnet', title: 'BACnet', version: '4.2', built: space.wide });
		const data = await site.readSite(space.root);
		assert.deepEqual(data.projects.map((project) => project.title), ['BACnet', 'T3000']);
		assert.equal(data.projects[1].section, 'products');
	} finally {
		rmSync(space.keep, { recursive: true, force: true });
	}
});

test('a hand-written data file is repaired rather than fatal', async () => {
	const space = fresh();
	try {
		mkdirSync(space.root, { recursive: true });
		writeFileSync(
			join(space.root, 'projects.json'),
			JSON.stringify({
				projects: [
					{ id: 't3000', versions: [{ version: '9.0' }, { version: '13.0', pages: [{ href: 'a.html' }] }] },
					{ title: 'no id' },
					{ id: 'empty', title: 'Empty' }
				]
			})
		);
		const data = await site.readSite(space.root);
		assert.deepEqual(data.projects.map((project) => project.id), ['empty', 't3000']);
		assert.equal(data.projects[1].title, 't3000', 'a project with no title falls back to its folder');
		assert.deepEqual(data.projects[1].versions.map((version) => version.version), ['13.0', '9.0']);
		assert.equal(data.projects[1].versions[0].pages[0].title, 'a.html', 'a page with no title falls back to its address');
		assert.equal(data.projects[1].section, 'documentation');
	} finally {
		rmSync(space.keep, { recursive: true, force: true });
	}
});

test("a build names its project, and the folder does not", async () => {
	const space = fresh();
	try {
		assert.equal(await site.projectNameOf(space.wide), 'T3000');
		assert.equal(await site.projectNameOf(join(space.keep, 'nowhere')), undefined);
	} finally {
		rmSync(space.keep, { recursive: true, force: true });
	}
});

test('a title becomes a lowercase folder name, and versions compare as numbers', () => {
	assert.equal(site.slugOf('T3000 Controller'), 't3000-controller');
	assert.equal(site.slugOf('  BACnet  '), 'bacnet');
	assert.deepEqual(['9.0', '13.0', '10.1'].sort(site.compareVersions), ['13.0', '10.1', '9.0']);
});

let failed = 0;
for (const { name, run } of cases) {
	try {
		await run();
		console.log(`  ok  ${name}`);
	} catch (error) {
		failed += 1;
		console.error(`FAIL  ${name}`);
		console.error(error instanceof Error ? error.message : error);
	}
}
console.log(`\n${cases.length - failed}/${cases.length} site cases passed`);
process.exit(failed === 0 ? 0 : 1);
