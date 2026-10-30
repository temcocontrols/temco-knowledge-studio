// The site, on disk.
//
// One folder is the site, and everything in it is either the app or a project's build:
//
//   ~/Temco/site/                 the site folder — a subfolder of the working area, made on first use
//     index.html                  a section of the site ┐
//     project.html                one project          ├ the app: copied from this module's `site/` folder, unchanged
//     reader.html                 one version          ┘
//     assets/site.css  assets/reader.css  assets/site.js
//     projects.json               what the app reads: the projects, their versions, and each version's pages
//     t3000/13.0/                 a build, copied in as it was
//
// The app is the module's own files copied in, not markup generated here: a published site is then the same bytes a
// preview shows, and adding a project is a copy plus one entry in `projects.json` — no page to regenerate, and no
// second renderer to keep in step with the first.
//
// `~/Temco` is the working area `temco-repositories` owns (`temcoRepositories.workspaceFolder`, or the user's home
// folder). One working area, one owner: this module reads the same setting rather than inventing a second place.

import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { promisify } from 'util';

/** The folder under the working area that holds the site. Lowercase, like every folder under it. */
const SITE_FOLDER = 'site';

/** The one file in the site that is data rather than the app. */
const PROJECTS_FILE = 'projects.json';

/** The section a project is listed under until somebody says otherwise. */
const DEFAULT_SECTION = 'documentation';

/**
 * The six sections, in the order the site draws its tabs.
 *
 * The site's own script carries the same list, because a published page cannot ask this module anything; this copy is
 * what the panel and the Overview page name a project's section with.
 */
export const SECTIONS: readonly { id: string; title: string }[] = [
	{ id: 'documentation', title: 'Documentation' },
	{ id: 'training', title: 'Training & Labs' },
	{ id: 'tests', title: 'Tests' },
	{ id: 'products', title: 'Products' },
	{ id: 'qa', title: 'Q&A' },
	{ id: 'topics', title: 'Topics' }
];

/** The title a reader sees for a section id, or Documentation when the id is missing or unknown. */
export function sectionTitle(id: string | undefined): string {
	return SECTIONS.find((section) => section.id === id)?.title ?? SECTIONS[0].title;
}

/** One page of one version, as the reader lists it: relative to the version's folder. */
export interface SitePage {
	href: string;
	title: string;
}

/** One version of one project: the build that was copied in, and the pages it holds. */
export interface SiteVersion {
	version: string;
	/** When it was added to the site, ISO. */
	builtAt?: string;
	pages: SitePage[];
}

/** One project: a folder of the site, and every version of it. */
export interface SiteProject {
	/** The folder name — `t3000` — which is also its address. */
	id: string;
	title: string;
	summary?: string;
	section: string;
	/** Newest first, which is what `versions[0].version` is. */
	versions: SiteVersion[];
	builtAt?: string;
}

/** Everything the app reads. Written on every change, so the folder is the database and this is its index. */
export interface Site {
	generatedAt?: string;
	projects: SiteProject[];
}

/** The newest version of a project, or nothing when it holds none. */
export function latestOf(project: SiteProject): string | undefined {
	return project.versions[0]?.version;
}

/** The working area: the setting `temco-repositories` owns, or a visible folder in the user's home. */
export function workRoot(): string {
	const configured = vscode.workspace.getConfiguration('temcoRepositories').get<string>('workspaceFolder');
	return typeof configured === 'string' && configured.trim().length > 0
		? expandHome(configured.trim())
		: path.join(os.homedir(), 'Temco');
}

/** `~` written by hand means the home folder. */
function expandHome(value: string): string {
	if (value === '~') {
		return os.homedir();
	}
	return value.startsWith('~/') || value.startsWith('~\\')
		? path.join(os.homedir(), value.slice(2))
		: value;
}

/** The site folder. Never a question: it is the working area's `site`, unless the setting names another. */
export function siteFolder(): string {
	const configured = vscode.workspace.getConfiguration('temcoLearn').get<string>('site');
	return typeof configured === 'string' && configured.trim().length > 0
		? expandHome(configured.trim())
		: path.join(workRoot(), SITE_FOLDER);
}

/** The module's own `site/` folder: the app that gets copied into the site folder. */
export function appFolder(context: vscode.ExtensionContext): string {
	return path.join(context.extensionUri.fsPath, 'site');
}

/**
 * Where the site's script is built.
 *
 * The script is TypeScript (`src/siteApp.ts`) and JavaScript only once compiled, because the repository keeps no
 * JavaScript of its own. It compiles to the module's `out/`, so the site folder gets `assets/site.js` from there.
 */
/**
 * Build the project view when it is missing.
 *
 * A source tree has the bundler (`scripts/build-webview.mts` and the module's `node_modules`); a packaged extension does
 * not, and does not need it, because packaging built the bundle already. So this is best-effort: a tree that cannot build
 * it says so through the caller's message rather than pretending the page will work.
 */
async function buildProjectView(module: string): Promise<void> {
	const script = path.join(module, 'scripts', 'build-webview.mts');
	if (!fs.existsSync(script)) {
		return;
	}
	try {
		await promisify(execFile)(process.execPath, ['--experimental-strip-types', script], { cwd: module, timeout: 180_000 });
	} catch {
		// The caller reports the missing bundle, which is the fact that matters.
	}
}

export function appScript(app: string): string {
	return path.join(path.dirname(app), 'out', 'siteApp.js');
}

/**
 * Make the site folder hold the app.
 *
 * Copied on every use rather than once, because the app is this module's and the site is a folder a person may have
 * carried to another machine: the preview must show the code that is installed, not whatever was copied last month.
 * The one file that survives the copy is `projects.json` — that is the site's data, and the module has no copy of it.
 */
export async function installSite(folder: string, app: string): Promise<string> {
	await fs.promises.mkdir(folder, { recursive: true });
	await copyTree(app, folder);

	const script = appScript(app);
	if (!fs.existsSync(script)) {
		throw new Error(`The site's script has not been built: ${script} is missing. Build the module, then try again.`);
	}
	await fs.promises.mkdir(path.join(folder, 'assets'), { recursive: true });
	const code = await fs.promises.readFile(script, 'utf8');
	// The built file ends with a source map reference that the site has no map for: a published site carries no map.
	await fs.promises.writeFile(path.join(folder, 'assets', 'site.js'), code.replace(/\r?\n\/\/# sourceMappingURL=.*$/, '\n'), 'utf8');

	// The project view is a bundled React app (React and Fluent UI cannot be a hand-written script), built by
	// `scripts/build-webview.mts` into `out/webview/preview/`. A missing bundle is a build that never ran this step, and
	// the page would open blank — so it is said here, once, rather than discovered in a browser.
	// `out/` is build output, and `compile-extension` cleans it: a source tree compiled after the bundle was built has no
	// bundle. It is built once here; a tree without the bundler gets a message instead of a page.
	const module = path.dirname(app);
	const view = path.join(module, 'out', 'webview', 'preview');
	if (!fs.existsSync(path.join(view, 'preview.js'))) {
		await buildProjectView(module);
	}
	for (const asset of ['preview.js', 'preview.css']) {
		const built = path.join(view, asset);
		if (!fs.existsSync(built)) {
			throw new Error(
				`The project view has not been built: ${built} is missing. Run \`npm run build-webview\` in extensions/temco-learn, then try again.`
			);
		}
		await fs.promises.writeFile(path.join(folder, 'assets', asset), await fs.promises.readFile(built));
	}

	if (!fs.existsSync(path.join(folder, PROJECTS_FILE))) {
		await writeSite(folder, { projects: [] });
	}
	return folder;
}

/** Every file under `source`, copied to the same place under `target`, overwriting. */
async function copyTree(source: string, target: string): Promise<void> {
	for (const entry of await fs.promises.readdir(source, { withFileTypes: true })) {
		if (entry.name === PROJECTS_FILE) {
			continue;
		}
		const from = path.join(source, entry.name);
		const to = path.join(target, entry.name);
		if (entry.isDirectory()) {
			await fs.promises.mkdir(to, { recursive: true });
			await copyTree(from, to);
		} else if (entry.isFile()) {
			await fs.promises.copyFile(from, to);
		}
	}
}

/** The site as a file, read tolerantly: a hand-edited or half-written entry is repaired rather than fatal. */
export async function readSite(root: string): Promise<Site> {
	let held: unknown;
	try {
		held = JSON.parse(await fs.promises.readFile(path.join(root, PROJECTS_FILE), 'utf8'));
	} catch {
		return { projects: [] };
	}
	const data = held as { generatedAt?: unknown; projects?: unknown };
	const projects: SiteProject[] = [];
	if (Array.isArray(data.projects)) {
		for (const entry of data.projects) {
			const project = toProject(entry);
			if (project !== undefined) {
				projects.push(project);
			}
		}
	}
	return {
		generatedAt: typeof data.generatedAt === 'string' ? data.generatedAt : undefined,
		projects: projects.sort((one, other) => one.title.localeCompare(other.title))
	};
}

function toProject(entry: unknown): SiteProject | undefined {
	const held = entry as { id?: unknown; title?: unknown; summary?: unknown; section?: unknown; versions?: unknown; builtAt?: unknown };
	const id = typeof held.id === 'string' && held.id !== '' ? held.id : undefined;
	if (id === undefined) {
		return undefined;
	}
	const versions: SiteVersion[] = [];
	if (Array.isArray(held.versions)) {
		for (const value of held.versions) {
			const version = toVersion(value);
			if (version !== undefined) {
				versions.push(version);
			}
		}
	}
	versions.sort((one, other) => compareVersions(one.version, other.version));
	return {
		id,
		title: typeof held.title === 'string' && held.title !== '' ? held.title : id,
		summary: typeof held.summary === 'string' && held.summary !== '' ? held.summary : undefined,
		section: typeof held.section === 'string' && held.section !== '' ? held.section : DEFAULT_SECTION,
		versions,
		builtAt: typeof held.builtAt === 'string' && held.builtAt !== '' ? held.builtAt : versions[0]?.builtAt
	};
}

function toVersion(entry: unknown): SiteVersion | undefined {
	const held = entry as { version?: unknown; builtAt?: unknown; pages?: unknown };
	const version = typeof held.version === 'string' && held.version !== '' ? held.version : undefined;
	if (version === undefined) {
		return undefined;
	}
	const pages: SitePage[] = [];
	if (Array.isArray(held.pages)) {
		for (const value of held.pages) {
			const page = value as { href?: unknown; title?: unknown };
			if (typeof page.href === 'string' && page.href !== '') {
				pages.push({ href: page.href, title: typeof page.title === 'string' && page.title !== '' ? page.title : page.href });
			}
		}
	}
	return { version, builtAt: typeof held.builtAt === 'string' ? held.builtAt : undefined, pages };
}

/** Write the site's data file: the only thing on disk that the app cannot work out for itself. */
export async function writeSite(root: string, site: Site): Promise<void> {
	const data: Site = { generatedAt: new Date().toISOString(), projects: site.projects };
	await fs.promises.mkdir(root, { recursive: true });
	await fs.promises.writeFile(path.join(root, PROJECTS_FILE), `${JSON.stringify(data, undefined, 2)}\n`, 'utf8');
}

/** What adding a build produced, so the caller can say it in one sentence. */
export interface Added {
	project: SiteProject;
	version: string;
	pages: number;
	destination: string;
}

/**
 * Put one build into the site as `<project>/<version>/`.
 *
 * The build is copied as it stands — the pages are the generator's, and rewriting them here would be a second renderer.
 * Adding the same version twice replaces it, because rebuilding a version and adding it again is the ordinary way to
 * fix a page, not a mistake to refuse.
 */
export async function addVersion(options: {
	root: string;
	/** The module's `site/` folder, installed first so the site is never data without an app to read it. */
	app: string;
	id: string;
	title: string;
	summary?: string;
	/** Absent keeps whatever the project already had. */
	section?: string;
	version: string;
	/** The folder a build wrote. */
	built: string;
}): Promise<Added> {
	await installSite(options.root, options.app);

	const destination = path.join(options.root, options.id, options.version);
	await fs.promises.mkdir(path.dirname(destination), { recursive: true });
	await fs.promises.rm(destination, { recursive: true, force: true });
	await fs.promises.cp(options.built, destination, { recursive: true });

	const entry: SiteVersion = {
		version: options.version,
		builtAt: new Date().toISOString(),
		pages: await htmlPages(destination)
	};

	const site = await readSite(options.root);
	let project = site.projects.find((held) => held.id === options.id);
	if (project === undefined) {
		project = {
			id: options.id,
			title: options.title,
			summary: options.summary,
			section: options.section ?? DEFAULT_SECTION,
			versions: [entry],
			builtAt: entry.builtAt
		};
		site.projects.push(project);
	} else {
		project.title = options.title;
		project.summary = options.summary ?? project.summary;
		project.section = options.section ?? project.section;
		project.versions = [entry, ...project.versions.filter((held) => held.version !== options.version)].sort((one, other) =>
			compareVersions(one.version, other.version)
		);
		project.builtAt = entry.builtAt;
	}
	site.projects.sort((one, other) => one.title.localeCompare(other.title));
	await writeSite(options.root, site);

	return { project, version: options.version, pages: entry.pages.length, destination };
}

/** Every page in the folder, in the build's own reading order, without the build's index in the list. */
export async function htmlPages(root: string, under = ''): Promise<SitePage[]> {
	const order = await readingOrderOf(root);
	const readingOrder = (href: string): number => {
		const at = order.indexOf(href);
		return at === -1 ? order.length : at;
	};
	const found: SitePage[] = [];
	for (const entry of await fs.promises.readdir(path.join(root, under), { withFileTypes: true })) {
		const relative = under === '' ? entry.name : `${under}/${entry.name}`;
		if (entry.isDirectory()) {
			found.push(...(await htmlPages(root, relative)));
			continue;
		}
		if (!/\.html?$/i.test(entry.name)) {
			continue;
		}
		// The build's own index is a page list; the reader is that list, so it is not a document of the set.
		if (under === '' && entry.name.toLowerCase() === 'index.html') {
			continue;
		}
		found.push({ href: relative, title: (await titleOf(path.join(root, ...relative.split('/')))) ?? titleFromHref(relative) });
	}
	return found.sort((one, other) => readingOrder(one.href) - readingOrder(other.href) || one.href.localeCompare(other.href));
}

/** The order the build's own index lists its pages in: the documentation's reading order, which the reader keeps. */
async function readingOrderOf(root: string): Promise<string[]> {
	try {
		const html = await fs.promises.readFile(path.join(root, 'index.html'), 'utf8');
		return [...html.matchAll(/href="([^"#?]+\.html?)"/gi)].map((match) => match[1]);
	} catch {
		return [];
	}
}

/** The project's name, as the build itself spells it: the title of the index page it wrote. */
export async function projectNameOf(build: string): Promise<string | undefined> {
	try {
		const html = await fs.promises.readFile(path.join(build, 'index.html'), 'utf8');
		const held = /<title>([\s\S]*?)<\/title>/i.exec(html)?.[1];
		if (held === undefined) {
			return undefined;
		}
		// A page's title carries its own name and the project's (`Page · Project`); the index carries the project alone.
		const text = unescapeText(held).trim();
		const parts = text.split(' · ');
		const name = (parts.length > 1 ? parts[parts.length - 1] : text).trim();
		return name === '' ? undefined : name;
	} catch {
		return undefined;
	}
}

/** The page's own title, without the ` · Project` suffix the generator adds. */
async function titleOf(file: string): Promise<string | undefined> {
	try {
		const html = await fs.promises.readFile(file, 'utf8');
		const held = /<title>([\s\S]*?)<\/title>/i.exec(html)?.[1];
		const text = held === undefined ? '' : unescapeText(held).split(' · ')[0].trim();
		return text === '' ? undefined : text;
	} catch {
		return undefined;
	}
}

function titleFromHref(href: string): string {
	const stem = href.replace(/\.html?$/i, '').split('/').pop() ?? href;
	return stem === 'index' ? 'Overview' : stem.replace(/[-_]+/g, ' ');
}

function unescapeText(text: string): string {
	return text
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&');
}

/**
 * The name a row writes for a project: its title without the "docs" a build's own page title usually ends with.
 *
 * The title comes from the build's `index.html` (`Test1 docs`) and is what the site is keyed by, so it is never rewritten —
 * only the words a person reads are shortened.
 */
export function shortName(title: string): string {
	return title.replace(/\s+docs?$/iu, '').trim() || title;
}
/** A folder name from a title: lowercase, and nothing that needs escaping in an address. */
export function slugOf(title: string): string {
	const slug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return slug === '' ? 'project' : slug;
}

/** `13.0` after `12.9`: the numbers compared as numbers, so `9` does not sort after `10`. */export function compareVersions(one: string, other: string): number {
	const left = one.split(/[.\-+]/).map((part) => Number.parseInt(part, 10));
	const right = other.split(/[.\-+]/).map((part) => Number.parseInt(part, 10));
	for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
		const a = left[index];
		const b = right[index];
		if (Number.isNaN(a) || Number.isNaN(b)) {
			return other.localeCompare(one);
		}
		if (a !== b) {
			return b - a;
		}
	}
	return 0;
}
