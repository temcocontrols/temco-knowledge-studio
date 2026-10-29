// The site, on disk.
//
// One folder is the site: `index.html` and one `<section>.html` per section at the top, then a folder per product, and a
// folder per version inside it. Adding a build is a copy and two files — the pages are the build's own, unchanged.
//
//   <site>/
//     index.html            Documentation
//     training.html         … one per section
//     t3000/
//       manifest.json       title, summary, section, latest, versions
//       index.html          the product page
//       13.0/
//         temco-reader.html the reader for this version
//         … the pages a build wrote, as they were
//
// Published, that folder is the whole site: GitHub Pages serves it as it stands.

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { SECTIONS, SiteProduct, productPage, sectionPage, sectionHref } from './portal';
import { readerPage } from './reader';

/** Where the site folder is remembered, when it was chosen rather than configured. */
const SITE_KEY = 'temcoLearn.site';

/** The folder the site lives in: the setting, then the last folder chosen, then nothing. */
export function siteRoot(context: vscode.ExtensionContext): string | undefined {
	const configured = vscode.workspace.getConfiguration().get<string>('temcoLearn.site');
	if (typeof configured === 'string' && configured.trim() !== '') {
		return configured;
	}
	const remembered = context.globalState.get<string>(SITE_KEY);
	return typeof remembered === 'string' && remembered.trim() !== '' ? remembered : undefined;
}

export async function rememberSite(context: vscode.ExtensionContext, folder: string): Promise<void> {
	await context.globalState.update(SITE_KEY, folder);
}

/** One product's manifest, as it is written: what the portal needs, and nothing it cannot use. */
interface Manifest {
	title?: unknown;
	summary?: unknown;
	section?: unknown;
	latest?: unknown;
	version?: unknown;
	versions?: unknown;
	builtAt?: unknown;
}

/**
 * Every product under the site root, read from the folders and their manifests.
 *
 * A folder with no readable manifest is skipped rather than guessed at: an entry the portal cannot link to is worse than
 * an entry that is not there. The three manifest shapes the publisher has written over time are all read.
 */
export async function readProducts(root: string): Promise<SiteProduct[]> {
	let entries: fs.Dirent[];
	try {
		entries = await fs.promises.readdir(root, { withFileTypes: true });
	} catch {
		return [];
	}
	const products: SiteProduct[] = [];
	for (const entry of entries) {
		if (!entry.isDirectory() || entry.name.startsWith('.')) {
			continue;
		}
		let manifest: Manifest;
		try {
			manifest = JSON.parse(await fs.promises.readFile(path.join(root, entry.name, 'manifest.json'), 'utf8')) as Manifest;
		} catch {
			continue;
		}
		const product = toProduct(entry.name, manifest);
		if (product !== undefined) {
			products.push(product);
		}
	}
	return products.sort((one, other) => one.title.localeCompare(other.title));
}

function toProduct(id: string, manifest: Manifest): SiteProduct | undefined {
	const versions = Array.isArray(manifest.versions)
		? manifest.versions.filter((value): value is string => typeof value === 'string')
		: [];
	const latest =
		typeof manifest.latest === 'string' ? manifest.latest : typeof manifest.version === 'string' ? manifest.version : versions[0];
	if (latest === undefined || latest === '') {
		return undefined;
	}
	return {
		id,
		title: typeof manifest.title === 'string' && manifest.title !== '' ? manifest.title : id,
		summary: typeof manifest.summary === 'string' && manifest.summary !== '' ? manifest.summary : undefined,
		section: typeof manifest.section === 'string' && manifest.section !== '' ? manifest.section : SECTIONS[0].id,
		latest,
		versions: versions.length > 0 ? versions : [latest],
		builtAt: typeof manifest.builtAt === 'string' && manifest.builtAt !== '' ? manifest.builtAt : undefined
	};
}

/**
 * Write the pages that hold the products: the six sections, and one page per product.
 *
 * Written from the manifests on every change, so there is no third copy of the truth to keep in step — the folder is
 * the database, and these are its indexes.
 */
export async function writePages(root: string, assets?: string): Promise<number> {
	const products = await readProducts(root);
	if (assets !== undefined) {
		await copyAssets(assets, path.join(root, 'assets'));
	}
	let written = 0;
	for (const section of SECTIONS) {
		await fs.promises.writeFile(path.join(root, sectionHref(section)), sectionPage({ section, products }), 'utf8');
		written += 1;
	}
	for (const product of products) {
		const folder = path.join(root, product.id);
		await fs.promises.mkdir(folder, { recursive: true });
		await fs.promises.writeFile(path.join(folder, 'index.html'), productPage({ product, sections: SECTIONS }), 'utf8');
		written += 1;
	}
	return written;
}

/** What adding a build produced, so the caller can say it in one sentence. */
export interface Added {
	product: SiteProduct;
	version: string;
	pages: number;
	destination: string;
}

/** The site's own files — `site.css` and whatever else sits beside it — copied into a folder that serves them. */
async function copyAssets(assets: string, target: string): Promise<void> {
	await fs.promises.mkdir(target, { recursive: true });
	for (const entry of await fs.promises.readdir(assets, { withFileTypes: true })) {
		if (entry.isFile()) {
			await fs.promises.copyFile(path.join(assets, entry.name), path.join(target, entry.name));
		}
	}
}

/**
 * Put one build into the site as `<product>/<version>/`.
 *
 * The build is copied as it stands — the pages are the generator's, and rewriting them here would be a second
 * renderer. The one file this adds is the reader, because the reader is the site's, not the generator's: it needs the
 * page list of this version and the list of versions beside it, which only the site knows.
 */
export async function addBuild(options: {
	root: string;
	/** The module's `site/` folder: the stylesheet the pages are written against. */
	assets?: string;
	id: string;
	title: string;
	summary?: string;
	section: string;
	version: string;
	built: string;
}): Promise<Added> {
	const destination = path.join(options.root, options.id, options.version);
	const existing = await readProducts(options.root);
	const before = existing.find((product) => product.id === options.id);
	// Newest first: `compareVersions` sorts descending, so the head of the list is what "latest" means.
	const versions = [...new Set([options.version, ...(before?.versions ?? [])])].sort(compareVersions);
	const latest = versions[0] ?? options.version;

	await fs.promises.mkdir(path.dirname(destination), { recursive: true });
	await fs.promises.rm(destination, { recursive: true, force: true });
	await fs.promises.cp(options.built, destination, { recursive: true });

	const pages = await htmlPages(destination);
	await fs.promises.writeFile(
		path.join(destination, 'temco-reader.html'),
		readerPage({ product: options.title, version: options.version, versions, pages }),
		'utf8'
	);
	// The site's stylesheet, at the root: the section and product pages are written against it. A version keeps the
	// build's own `assets/`, because its pages were rendered against that one.
	if (options.assets !== undefined) {
		await copyAssets(options.assets, path.join(options.root, 'assets'));
	}

	const builtAt = new Date().toISOString();
	const manifest = {
		title: options.title,
		summary: options.summary,
		section: options.section,
		latest,
		versions,
		builtAt
	};
	await fs.promises.writeFile(
		path.join(options.root, options.id, 'manifest.json'),
		`${JSON.stringify(manifest, undefined, 2)}\n`,
		'utf8'
	);

	await writePages(options.root, options.assets);

	return {
		product: { id: options.id, title: options.title, summary: options.summary, section: options.section, latest, versions, builtAt },
		version: options.version,
		pages: pages.length,
		destination
	};
}

/** Every page in the folder, as the reader lists it: the build's own order, without the build's index in the list. */
async function htmlPages(root: string, under = ''): Promise<{ href: string; title: string }[]> {
	const order = await readingOrderOf(root);
	const readingOrder = (href: string): number => {
		const at = order.indexOf(href);
		return at === -1 ? order.length : at;
	};
	const found: { href: string; title: string }[] = [];
	const entries = await fs.promises.readdir(path.join(root, under), { withFileTypes: true });
	for (const entry of entries) {
		const relative = under === '' ? entry.name : `${under}/${entry.name}`;
		if (entry.isDirectory()) {
			found.push(...(await htmlPages(root, relative)));
			continue;
		}
		if (!/\.html?$/i.test(entry.name) || entry.name.toLowerCase() === 'temco-reader.html') {
			continue;
		}
		// The build's own index is a page list; the reader is that list, so it is not a document of the set.
		if (under === '' && entry.name.toLowerCase() === 'index.html') {
			continue;
		}
		found.push({ href: relative, title: await titleOf(path.join(root, ...relative.split('/'))) ?? titleFromHref(relative) });
	}
	// The build's own index is a page list in reading order; the reader shows that list, so the order comes from it.
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

/** `13.0` after `12.9`: the numbers compared as numbers, so `9` does not sort after `10`. */
export function compareVersions(one: string, other: string): number {
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
