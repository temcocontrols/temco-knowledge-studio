// The Temco Learn site, as text.
//
// This is the reader-facing half of the platform: what somebody who is not authoring sees. It is pure — products in,
// pages out — so the decisions a visitor notices (a section that exists, a card that leads to a version that exists, a
// page that says what is missing instead of pretending) are checkable without a browser or a file system
// (`scripts/check-site.mts`). `site.ts` is the half that reads and writes folders, and `site/site.css` is the look.
//
// The layout is Microsoft Learn's: a bar with the brand, the sections as tabs and a search field; one wash band under
// the title; then cards one level deeper — home → product → version → page.

/** One section of the site: a tab in the bar, and a page of its own. */
export interface Section {
	/** The page that lists the section: `index.html` for the first, `<id>.html` for the rest. */
	id: string;
	title: string;
	desc: string;
	/** What the section says while it holds no product, and where that content comes from when it does. */
	empty: string;
}

/**
 * The six sections, in the order Microsoft Learn puts them.
 *
 * Every one is drawn even when it holds nothing: the tabs are the site's table of contents, and a reader looking for
 * training should find the shelf and be told why it is empty, rather than be left wondering whether the site has one.
 */
export const SECTIONS: readonly Section[] = [
	{
		id: 'documentation',
		title: 'Documentation',
		desc: 'Guides, references and release notes for every Temco product, one folder per version.',
		empty: 'No product has been published yet. A product appears here as soon as one of its builds is added to the site.'
	},
	{
		id: 'training',
		title: 'Training & Labs',
		desc: 'Ordered reading for a job, and labs you can work through on a real controller.',
		empty: 'No training has been published yet. A path is a reading order over existing pages, so it can only be listed once those pages exist.'
	},
	{
		id: 'tests',
		title: 'Tests',
		desc: 'Commissioning checks, what each one proves, and how to run it.',
		empty: 'No test has been published yet. These pages are written from the same documentation set, under a tests area.'
	},
	{
		id: 'products',
		title: 'Products',
		desc: 'What each Temco Controls product is, what it answers, and which documentation belongs to it.',
		empty: 'No product overview has been published yet. A product page is written from the same registry as its documentation.'
	},
	{
		id: 'qa',
		title: 'Q&A',
		desc: 'Questions from installers and engineers, answered by the people who build the products.',
		empty: 'Questions live in the Temco forum rather than here: a question needs an answer, an author and a date, and a forum is where those belong. <a href="https://forums.temcocontrols.com/" rel="noopener">Open the Temco forum</a>.'
	},
	{
		id: 'topics',
		title: 'Topics',
		desc: 'Subjects that cross products: networking, protocols, security, alarms.',
		empty: 'No topic has been written yet. A topic gathers the pages from several products that answer one question.'
	}
];

export type SectionId = typeof SECTIONS[number]['id'];

/** One product, as the site lists it: the folder it lives in, and the versions under it. */
export interface SiteProduct {
	/** The folder name — `t3000` — which is also its address. */
	id: string;
	title: string;
	/** One line under the title. A manifest without one shows the title alone rather than a placeholder sentence. */
	summary?: string;
	section: string;
	latest: string;
	versions: readonly string[];
	/** When the newest version was written, ISO. Absent on a manifest from before the site recorded it. */
	builtAt?: string;
}

/** The page a section is written to, relative to the site root. */
export function sectionHref(section: Section): string {
	return SECTIONS[0] === section ? 'index.html' : `${section.id}.html`;
}

/** The product page, relative to the site root. */
export function productHref(product: SiteProduct): string {
	return `${encodeURIComponent(product.id)}/`;
}

/** The reader for one version of one product, relative to the site root. */
export function readerHref(product: SiteProduct, version: string): string {
	return `${encodeURIComponent(product.id)}/${encodeURIComponent(version)}/temco-reader.html`;
}

export function escape(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function plural(count: number, one: string, many = `${one}s`): string {
	return `${String(count)} ${count === 1 ? one : many}`;
}

/** `just now`, `2 hours ago`, `yesterday` — the words a reader uses, from an ISO date. */
export function since(iso: string | undefined): string {
	if (iso === undefined) {
		return 'not recorded';
	}
	const then = Date.parse(iso);
	if (Number.isNaN(then)) {
		return 'not recorded';
	}
	const minutes = Math.floor((Date.now() - then) / 60_000);
	if (minutes < 1) {
		return 'just now';
	}
	if (minutes < 60) {
		return `${String(minutes)} min ago`;
	}
	const hours = Math.floor(minutes / 60);
	if (hours < 24) {
		return hours === 1 ? '1 hour ago' : `${String(hours)} hours ago`;
	}
	const days = Math.floor(hours / 24);
	return days === 1 ? 'yesterday' : `${String(days)} days ago`;
}

/** The search box: filters the cards and rows already on the page, because the site has no index to query yet. */
function searchBox(): string {
	return `<label class="search"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M10.68 11.74a6 6 0 1 1 1.06-1.06l3.04 3.04a.75.75 0 1 1-1.06 1.06l-3.04-3.04ZM11.5 6.5a5 5 0 1 0-10 0 5 5 0 0 0 10 0Z"/></svg><input id="q" type="search" placeholder="Search this page…" aria-label="Search this page"></label>`;
}

const FILTER = `(function () {
	const box = document.getElementById('q');
	if (!box) { return; }
	const items = Array.from(document.querySelectorAll('[data-name]'));
	box.addEventListener('input', () => {
		const needle = box.value.trim().toLowerCase();
		let shown = 0;
		for (const item of items) {
			const hit = needle === '' || String(item.getAttribute('data-name')).toLowerCase().indexOf(needle) !== -1;
			item.hidden = !hit;
			if (hit) { shown += 1; }
		}
		if (needle !== '' && shown === 0) { box.setAttribute('aria-label', 'Search this page — nothing matches'); }
	});
})();`;

/** The bar's tabs: the sections, and which one is being read. */
function tabs(section: Section, root: string): string {
	return SECTIONS.map(
		(entry) =>
			`<a class="tab${entry.id === section.id ? ' is-current' : ''}" href="${root}${sectionHref(entry)}"${entry.id === section.id ? ' aria-current="page"' : ''}>${escape(entry.title)}</a>`
	).join('');
}

/** The document around a page: bar, body, foot. The only difference between pages is the body. */
function document(options: { section: Section; title: string; body: string; root: string; search?: boolean }): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(options.title)} · Temco Learn</title>
<link rel="stylesheet" href="${options.root}assets/site.css">
</head>
<body>
<header class="bar">
	<div class="bar__inner">
		<a class="bar__brand" href="${options.root}index.html"><span class="bar__mark">T</span><span>Temco Learn</span></a>
		<nav class="tabs" aria-label="Sections">${tabs(options.section, options.root)}</nav>
	</div>
</header>
<div class="wrap">
${options.body}
</div>
<footer class="foot">
	<span>Temco Learn · Temco Controls</span>
	<span class="spacer"></span>
	<a href="https://forums.temcocontrols.com/" rel="noopener">Forum</a>
	<a href="https://github.com/temcocontrols" rel="noopener">GitHub</a>
</footer>
${options.search === true ? `<script>${FILTER}</script>` : ''}
</body>
</html>`;
}

/** The monogram in a card: the first letter of the product's name. */
function chip(product: SiteProduct): string {
	return `<span class="card__chip" aria-hidden="true">${escape(product.title.slice(0, 1).toUpperCase())}</span>`;
}

/** One product, as a card: what it is, and the version a reader starts on. */
function card(product: SiteProduct): string {
	return `<a class="card" href="${productHref(product)}" data-name="${escape(product.title)} ${escape(product.summary ?? '')}">
			${chip(product)}
			<span class="card__title">${escape(product.title)}</span>
			${product.summary === undefined ? '' : `<span class="card__desc">${escape(product.summary)}</span>`}
			<span class="card__meta">Latest ${escape(product.latest)} · ${plural(product.versions.length, 'version')}</span>
		</a>`;
}

/** One line in "Recently updated": a product and its newest version. */
function recent(product: SiteProduct): string {
	return `<a class="row" href="${readerHref(product, product.latest)}" data-name="${escape(product.title)}">
			<span class="row__title">${escape(product.title)}</span>
			<span class="row__version">${escape(product.latest)}</span>
			<span class="row__meta">built ${escape(since(product.builtAt))}</span>
			<span class="row__go">Read →</span>
		</a>`;
}

/**
 * One section of the site.
 *
 * Documentation is the site's front door, so it also carries "Recently updated": the newest version of each product,
 * which is the one thing a returning reader wants and the only thing the folder can honestly say is new.
 */
export function sectionPage(options: { section: Section; products: readonly SiteProduct[] }): string {
	const held = options.products.filter((product) => product.section === options.section.id);
	const newest = [...held].sort((one, other) => String(other.builtAt).localeCompare(String(one.builtAt))).slice(0, 5);
	const recentBlock = newest.length === 0
		? ''
		: `	<div class="section-head"><h2>Recently updated</h2></div>
	<div class="rows">
		${newest.map(recent).join('\n\t\t')}
	</div>
`;
	const body = `	<header class="hero">
		${options.section.id === SECTIONS[0].id ? '<p class="hero__eyebrow">Temco Learn</p>' : ''}
		<h1 class="hero__title">${escape(options.section.title)}</h1>
		<p class="hero__desc">${escape(options.section.desc)}</p>
		${searchBox()}
	</header>
	${held.length === 0
		? `<p class="empty">${options.section.empty}</p>`
		: `	<div class="section-head"><h2>Products</h2><span class="more">${plural(held.length, 'product')}</span></div>
	<div class="grid">
		${held.map(card).join('\n\t\t')}
	</div>
${recentBlock}`}`;
	return document({ section: options.section, title: options.section.title, body, root: '', search: true });
}

/** One product: what it is, and every version of it. The reader is one click further on. */
export function productPage(options: { product: SiteProduct; sections: readonly Section[] }): string {
	const section = options.sections.find((entry) => entry.id === options.product.section) ?? SECTIONS[0];
	const versions = options.product.versions
		.map((version) => {
			const latest = version === options.product.latest;
			return `<a class="row" href="${encodeURIComponent(version)}/temco-reader.html" data-name="${escape(version)}">
			<span class="row__version">${escape(version)}</span>
			${latest ? '<span class="row__tag">latest</span>' : ''}
			${latest && options.product.builtAt !== undefined ? `<span class="row__meta">built ${escape(since(options.product.builtAt))}</span>` : ''}
			<span class="row__go">Read →</span>
		</a>`;
		})
		.join('\n\t\t');
	const body = `	<header class="hero">
		<p class="crumbs"><a href="../index.html">Documentation</a> › ${escape(options.product.title)}</p>
		<h1 class="hero__title">${escape(options.product.title)}</h1>
		${options.product.summary === undefined ? '' : `<p class="hero__desc">${escape(options.product.summary)}</p>`}
	</header>
	<div class="section-head"><h2>${plural(options.product.versions.length, 'version')}</h2></div>
	<div class="rows">
		${versions}
	</div>`;
	return document({ section, title: options.product.title, body, root: '../' });
}
