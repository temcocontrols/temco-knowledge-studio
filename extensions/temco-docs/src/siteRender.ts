// The published site, as text.
//
// Everything here is a function of strings — the registry's pages in, a site's files out — so the rules that a reader
// actually feels (a URL that does not change, a link between two pages that resolves, a picture dragged to half width
// that is half width on the web too) are checkable without a file system, a browser or an editor. `site.ts` is the half
// that reads and writes; this is the half worth arguing about.

import { Marked } from 'marked';

/** One page, as the generator sees it: what the registry says, and the Markdown as it is in the file. */
export interface SiteEntry {
	/** `area/chapter/page` — the registry key, which is also the path under `docs/` without the extension. */
	id: string;
	title: string;
	area: string;
	markdown: string;
}

export interface SiteArea {
	title: string;
	entries: readonly SiteEntry[];
}

export interface SiteModel {
	project: string;
	version?: string;
	areas: readonly SiteArea[];
}

/** A width carried in a picture's title: `![caption](media/a.png "w=480")`. */
const WIDTH_IN_TITLE = /title="w=(\d+%?)"/u;

const marked = new Marked({ gfm: true });

/**
 * One path segment, made safe for a URL.
 *
 * Lower case, letters and digits, one dash between words: a page's address is decided once and then quoted in chats,
 * tickets and the products's own help, so it may not change because a title gained an accent or a space.
 */
export function slug(segment: string): string {
	return segment
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/gu, '-')
		.replace(/^-+|-+$/gu, '');
}

/** The URL of a page, as the site writes it: `01-getting-started/commissioning/wiring.html`. */
export function slugPath(id: string): string {
	return id
		.split('/')
		.filter(part => part !== '')
		.map(slug)
		.filter(part => part !== '')
		.join('/');
}

/** Every page's address, keyed by the page's id. */
export function addresses(ids: readonly string[]): Map<string, string> {
	const found = new Map<string, string>();
	const taken = new Set<string>();
	for (const id of ids) {
		const base = slugPath(id);
		let candidate = base;
		let counter = 2;
		// Two titles can slug to one address; the second gets `-2` rather than silently replacing the first.
		while (taken.has(candidate)) {
			candidate = `${base}-${counter}`;
			counter += 1;
		}
		taken.add(candidate);
		found.set(id, candidate);
	}
	return found;
}

/** How many folders deep a page's address is: what `../` has to climb to reach the site's root. */
export function depthOf(address: string): number {
	return address.split('/').length - 1;
}

/**
 * A picture's width, from the title that carries it.
 *
 * The editor keeps a resized picture's width in the Markdown title (`engine/tiptap/image.ts`), because Markdown has no
 * syntax for one. A browser ignores a title for layout, so without this the drag would only be visible inside the editor.
 */
export function withPictureWidths(html: string): string {
	return html.replace(/<img\b[^>]*>/gu, tag => {
		const width = WIDTH_IN_TITLE.exec(tag)?.[1];
		if (width === undefined) {
			return tag;
		}
		const bare = `${tag.replace(WIDTH_IN_TITLE, '').replace(/\s+/gu, ' ').replace(/\s+>/u, '>')}`;
		return `${bare.slice(0, -1)} width="${width}">`;
	});
}

/**
 * A link to another page, pointed at the other page's address.
 *
 * The editor writes `.md` links, because that is what the file is; a site that served them as `.md` would hand the reader
 * a download. Every relative Markdown link is resolved against the page it is on, looked up in the address table, and
 * written as a relative `.html` address — so the same page works at `/`, under a project path, and from a `file://` open.
 */
export function rewriteLinks(html: string, fromId: string, where: ReadonlyMap<string, string>): string {
	const from = slugPath(fromId);
	return html.replace(/href="([^"]*)"/gu, (whole, href: string) => {
		if (!href.toLowerCase().endsWith('.md') || /^[a-z]+:/iu.test(href)) {
			return whole;
		}
		const target = resolve(fromId, href);
		const address = target === undefined ? undefined : where.get(target);
		if (address === undefined) {
			return whole;
		}
		return `href="${relative(from, address)}"`;
	});
}

/**
 * A URL relative to the page being written: climb out of the folders the two do not share, then descend.
 *
 * Pages in the same folder end up with a bare name (`two.html`), which is what a reader copying a link out of the
 * address bar expects to see, and the climb is computed rather than maximised so it stays readable.
 */
function relative(from: string, to: string): string {
	const fromParts = from.split('/').slice(0, -1);
	const toParts = to.split('/');
	const address = toParts.pop() ?? '';
	let shared = 0;
	while (shared < fromParts.length && shared < toParts.length && fromParts[shared] === toParts[shared]) {
		shared += 1;
	}
	const climb = '../'.repeat(fromParts.length - shared);
	return `${climb}${[...toParts.slice(shared), address].join('/')}.html`;
}

/** The id an `href` on `fromId` points at, if it points inside the registry. */
function resolve(fromId: string, href: string): string | undefined {
	const parts = fromId.split('/');
	parts.pop();
	for (const step of href.split('/')) {
		if (step === '' || step === '.') {
			continue;
		}
		if (step === '..') {
			parts.pop();
			continue;
		}
		parts.push(step);
	}
	const joined = parts.join('/');
	return joined.toLowerCase().endsWith('.md') ? joined.slice(0, -3) : joined;
}

/** The Markdown of one page, as the article of the site. */
export function renderArticle(entry: SiteEntry, where: ReadonlyMap<string, string>): string {
	const html = withPictureWidths(String(marked.parse(entry.markdown)));
	return rewriteLinks(html, entry.id, where);
}

export interface Neighbours {
	previous?: { title: string; address: string };
	next?: { title: string; address: string };
}

/**
 * One page of the site.
 *
 * The head is the reader's: the title first, then the project, so a tab strip of ten pages from one project is still
 * readable. The body is the article and nothing else — the site is the documentation, not an application around it.
 */
export function renderPage(options: {
	entry: SiteEntry;
	model: SiteModel;
	address: string;
	where: ReadonlyMap<string, string>;
	neighbours: Neighbours;
	built: string;
}): string {
	const { entry, model, address, where, neighbours, built } = options;
	const up = '../'.repeat(depthOf(address));
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(entry.title)} · ${escapeHtml(model.project)}</title>
<link rel="stylesheet" href="${up}assets/site.css">
</head>
<body>
<header class="bar">
	<a class="bar__home" href="${up}index.html">${escapeHtml(model.project)}</a>
	${model.version === undefined ? '' : `<span class="bar__version">v${escapeHtml(model.version)}</span>`}
	<span class="bar__area">${escapeHtml(entry.area)}</span>
</header>
<main class="page">
	<article class="doc">
${renderArticle(entry, where)}
	</article>
	<nav class="step">
		${neighbours.previous === undefined ? '<span></span>' : `<a href="${up}${neighbours.previous.address}">← ${escapeHtml(neighbours.previous.title)}</a>`}
		${neighbours.next === undefined ? '<span></span>' : `<a href="${up}${neighbours.next.address}">${escapeHtml(neighbours.next.title)} →</a>`}
	</nav>
	<footer class="foot">${escapeHtml(model.project)}${model.version === undefined ? '' : ` v${escapeHtml(model.version)}`} · built ${escapeHtml(built)}</footer>
</main>
</body>
</html>`;
}

/** The site's front door: the areas, and every page under the one it belongs to. */
export function renderIndex(model: SiteModel, where: ReadonlyMap<string, string>): string {
	const areas = model.areas
		.map(area => {
			const pages = area.entries
				.map(entry => `\t\t\t<li><a href="${where.get(entry.id) ?? ''}.html">${escapeHtml(entry.title)}</a></li>`)
				.join('\n');
			return `\t\t<section class="area">\n\t\t\t<h2>${escapeHtml(area.title)}</h2>\n\t\t\t<ul>\n${pages}\n\t\t\t</ul>\n\t\t</section>`;
		})
		.join('\n');
	const count = model.areas.reduce((total, area) => total + area.entries.length, 0);
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(model.project)}</title>
<link rel="stylesheet" href="assets/site.css">
</head>
<body>
<header class="bar">
	<span class="bar__home">${escapeHtml(model.project)}</span>
	${model.version === undefined ? '' : `<span class="bar__version">v${escapeHtml(model.version)}</span>`}
</header>
<main class="index">
	<h1>${escapeHtml(model.project)}</h1>
	<p class="index__count">${count} page${count === 1 ? '' : 's'}</p>
${areas}
</main>
</body>
</html>`;
}

/** Every page the site publishes, so a crawler can find them without following the index. */
export function renderSitemap(base: string, pages: readonly { address: string }[], built: string): string {
	const urls = pages
		.map(page => `\t<url><loc>${escapeHtml(new URL(`${page.address}.html`, base).toString())}</loc><lastmod>${built}</lastmod></url>`)
		.join('\n');
	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

/**
 * The one stylesheet the site ships.
 *
 * Plain CSS, no framework: this file is what a reader loads on every page, and a documentation site's job is to render
 * text quickly. The colours are the light theme's — a published page is read in a browser, not inside the editor, so it
 * does not follow the editor's theme.
 */
export function renderStylesheet(): string {
	return `:root {
	--fg: #1f2328;
	--fg-soft: #59636e;
	--bg: #ffffff;
	--bg-soft: #f6f8fa;
	--border: #d1d9e0;
	--accent: #0078d4;
	--radius: 6px;
	--mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
}
* { box-sizing: border-box; }
body {
	margin: 0;
	background: var(--bg);
	color: var(--fg);
	font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
}
.bar {
	display: flex;
	align-items: baseline;
	gap: 12px;
	padding: 10px 24px;
	border-bottom: 1px solid var(--border);
	background: var(--bg-soft);
	font-size: 13px;
}
.bar__home { font-weight: 600; color: var(--fg); text-decoration: none; }
.bar__version { color: var(--accent); font-variant-numeric: tabular-nums; }
.bar__area { margin-left: auto; color: var(--fg-soft); }
.page { max-width: 820px; margin: 0 auto; padding: 32px 24px 64px; }
.doc { overflow-wrap: anywhere; }
.doc > :first-child { margin-top: 0; }
.doc > :last-child { margin-bottom: 0; }
.index { max-width: 820px; margin: 0 auto; padding: 40px 24px 64px; }
h1 { font-size: 30px; line-height: 1.25; margin: 0 0 8px; }
h2 { font-size: 20px; margin: 32px 0 8px; }
h3 { font-size: 17px; margin: 24px 0 6px; }
h4 { font-size: 15px; margin: 20px 0 6px; }
p, ul, ol, blockquote, table, pre { margin: 0 0 16px; }
a { color: var(--accent); }
ul, ol { padding-left: 26px; }
li { margin: 0 0 4px; }
blockquote { margin-left: 0; padding: 4px 16px; border-left: 3px solid var(--border); color: var(--fg-soft); }
code { font-family: var(--mono); font-size: 0.9em; background: var(--bg-soft); padding: 1px 5px; border-radius: 4px; }
pre { background: var(--bg-soft); padding: 14px 16px; border-radius: var(--radius); overflow: auto; }
pre code { background: none; padding: 0; }
table { border-collapse: collapse; width: 100%; font-size: 15px; }
th, td { border: 1px solid var(--border); padding: 6px 10px; text-align: left; vertical-align: top; }
th { background: var(--bg-soft); }
img { max-width: 100%; height: auto; border-radius: 4px; }
hr { border: 0; border-top: 1px solid var(--border); margin: 24px 0; }
ul[data-type='taskList'] { list-style: none; padding-left: 4px; }
.index__count { color: var(--fg-soft); margin: 0 0 8px; }
.area ul { padding-left: 20px; }
.step { display: flex; justify-content: space-between; gap: 16px; margin-top: 40px; padding-top: 16px; border-top: 1px solid var(--border); font-size: 14px; }
.foot { margin-top: 32px; color: var(--fg-soft); font-size: 12px; }
`;
}

/** Text a browser reads as text. */
export function escapeHtml(text: string): string {
	return text
		.replace(/&/gu, '&amp;')
		.replace(/</gu, '&lt;')
		.replace(/>/gu, '&gt;')
		.replace(/"/gu, '&quot;');
}

/**
 * One page, alone.
 *
 * The stylesheet is inlined and the caller has already turned every picture into a `data:` URI, so the result is one file
 * that shows the page on a machine that has never seen this project — a support engineer's inbox, a chat, a USB stick.
 * Nothing outside the file is referenced; a reader can tell it worked by unplugging the network.
 */
export function renderStandalone(options: { entry: SiteEntry; model: SiteModel; body: string; built: string }): string {
	const { entry, model, body, built } = options;
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(entry.title)} · ${escapeHtml(model.project)}</title>
<style>
${renderStylesheet()}</style>
</head>
<body>
<header class="bar">
	<span class="bar__home">${escapeHtml(model.project)}</span>
	${model.version === undefined ? '' : `<span class="bar__version">v${escapeHtml(model.version)}</span>`}
	<span class="bar__area">${escapeHtml(entry.area)}</span>
</header>
<main class="page">
	<article class="doc">
${body}
	</article>
	<footer class="foot">${escapeHtml(model.project)}${model.version === undefined ? '' : ` v${escapeHtml(model.version)}`} · exported ${escapeHtml(built)}</footer>
</main>
</body>
</html>`;
}
