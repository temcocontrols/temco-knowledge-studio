/* Temco Learn — the site's own script.
 *
 * Three pages, one script. `index.html` lists a section of the site, `project.html` lists one project's versions, and
 * `reader.html` reads one version. All three read `projects.json`, which sits beside them, so the site is these files
 * and nothing else: no per-product page to regenerate, no per-version reader to write, and a published site is the same
 * bytes a preview shows.
 *
 * It is written as a TypeScript *script* — no imports, no exports — because it is not loaded as a module: it compiles to
 * `out/siteApp.js`, and installSite copies that file into the site folder as `assets/site.js`. The folder a reader gets
 * stays plain HTML and one classic script.
 *
 * The two things that need the browser are here because they cannot be done anywhere else: the search field filters
 * what is already on the page, and the reader's "In this article" is read from the article's own frame.
 */

'use strict';

interface SitePage {
	href: string;
	title: string;
}

interface SiteVersion {
	version: string;
	builtAt?: string;
	pages?: SitePage[];
}

interface SiteProject {
	id: string;
	title: string;
	summary?: string;
	section?: string;
	builtAt?: string;
	latest?: string;
	versions?: SiteVersion[];
}

interface Section {
	id: string;
	title: string;
	desc: string;
	empty: string;
}

/**
 * The six sections, in the order Microsoft Learn puts them.
 *
 * Every one is drawn even when it holds nothing: the tabs are the site's table of contents, and a reader looking for
 * training should find the shelf and be told why it is empty. `empty` is the site's own text — the one place markup is
 * allowed through — because Q&A points at the forum rather than pretending it will fill up.
 */
const SECTIONS: Section[] = [
	{
		id: 'documentation',
		title: 'Documentation',
		desc: 'Guides, references and release notes for every Temco product, one folder per version.',
		empty: 'No project has been added yet. A project appears here as soon as one of its builds is added to the site.'
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
		empty: 'No product overview has been published yet. A product page is written from the same pages its documentation is.'
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
		empty: 'No topic has been written yet. A topic gathers the pages from several projects that answer one question.'
	}
];

/** How many projects "Recently updated" lists. */
const RECENT = 5;

/* ---- text ---------------------------------------------------------------------------------------------------- */

const escapeHtml = (value: unknown): string =>
	String(value === undefined || value === null ? '' : value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');

const plural = (count: number, one: string, many?: string): string =>
	`${count} ${count === 1 ? one : many === undefined ? `${one}s` : many}`;

/** `just now`, `2 hours ago`, `yesterday` — the words a reader uses, from an ISO date. */
function since(iso: string | undefined): string {
	const then = Date.parse(String(iso));
	if (Number.isNaN(then)) {
		return 'not recorded';
	}
	const minutes = Math.floor((Date.now() - then) / 60000);
	if (minutes < 1) {
		return 'just now';
	}
	if (minutes < 60) {
		return `${minutes} min ago`;
	}
	const hours = Math.floor(minutes / 60);
	if (hours < 24) {
		return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
	}
	const days = Math.floor(hours / 24);
	return days === 1 ? 'yesterday' : `${days} days ago`;
}

/* ---- addresses ----------------------------------------------------------------------------------------------- */

const param = (name: string): string | null => new URLSearchParams(location.search).get(name);

/** A page with its query, omitting what was not given: `unknown` is written as no parameter, never as the word. */
function link(page: string, params?: Record<string, string | null | undefined>): string {
	const given = params ?? {};
	const query = Object.keys(given)
		.filter((key) => given[key] !== undefined && given[key] !== null && given[key] !== '')
		.map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(given[key]))}`)
		.join('&');
	return query === '' ? page : `${page}?${query}`;
}

const sectionLink = (section: Section): string =>
	link('index.html', section.id === SECTIONS[0].id ? {} : { section: section.id });
const projectLink = (project: SiteProject): string => link('project.html', { id: project.id });
const readerLink = (project: SiteProject, version: string | undefined, page?: string): string =>
	link('reader.html', { id: project.id, version, page });

/* ---- the site's data ----------------------------------------------------------------------------------------- */

/**
 * The projects on the site.
 *
 * A site with no `projects.json` yet — a folder that exists because Preview was opened — is an empty site rather than a
 * broken one, which is why a missing or unreadable file is an empty list and not an error the visitor has to read.
 */
async function readProjects(): Promise<SiteProject[]> {
	try {
		const response = await fetch('projects.json', { cache: 'no-store' });
		if (!response.ok) {
			return [];
		}
		const data = (await response.json()) as { projects?: unknown };
		return Array.isArray(data.projects) ? (data.projects as SiteProject[]) : [];
	} catch {
		return [];
	}
}

const latestOf = (project: SiteProject): string | undefined =>
	project.latest ?? (project.versions ?? [])[0]?.version;
const sectionOf = (project: SiteProject): Section =>
	SECTIONS.find((entry) => entry.id === project.section) ?? SECTIONS[0];

/** The element a page promised. `check-app` holds every id this script asks for against the pages that carry it. */
const need = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

/** The bar's tabs: the sections, and which one is being read. */
function drawTabs(current: string): void {
	const nav = document.getElementById('tabs');
	if (nav === null) {
		return;
	}
	nav.innerHTML = SECTIONS.map(
		(section) =>
			`<a class="tab${section.id === current ? ' is-current' : ''}" href="${sectionLink(section)}"${section.id === current ? ' aria-current="page"' : ''}>${escapeHtml(section.title)}</a>`
	).join('');
}

const SEARCH_ICON =
	'<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M10.68 11.74a6 6 0 1 1 1.06-1.06l3.04 3.04a.75.75 0 1 1-1.06 1.06l-3.04-3.04ZM11.5 6.5a5 5 0 1 0-10 0 5 5 0 0 0 10 0Z"/></svg>';

const searchBox = (): string =>
	`<label class="search">${SEARCH_ICON}<input id="q" type="search" placeholder="Search this page…" aria-label="Search this page"></label>`;

/** The search field filters what the page already holds: the site has no index to query, and needs none. */
function attachFilter(root: HTMLElement): void {
	const box = document.getElementById('q') as HTMLInputElement | null;
	if (box === null) {
		return;
	}
	const items = Array.from(root.querySelectorAll<HTMLElement>('[data-name]'));
	box.addEventListener('input', () => {
		const needle = box.value.trim().toLowerCase();
		let shown = 0;
		for (const item of items) {
			const hit = needle === '' || String(item.getAttribute('data-name')).toLowerCase().indexOf(needle) !== -1;
			item.hidden = !hit;
			if (hit) {
				shown += 1;
			}
		}
		box.setAttribute(
			'aria-label',
			needle !== '' && shown === 0 ? 'Search this page — nothing matches' : 'Search this page'
		);
	});
}

/* ---- the section page ---------------------------------------------------------------------------------------- */

function card(project: SiteProject): string {
	const summary =
		project.summary === undefined || project.summary === ''
			? ''
			: `<span class="card__desc">${escapeHtml(project.summary)}</span>`;
	return `<a class="card" href="${projectLink(project)}" data-name="${escapeHtml(project.title)} ${escapeHtml(project.summary ?? '')}">
			<span class="card__chip" aria-hidden="true">${escapeHtml(project.title.slice(0, 1).toUpperCase())}</span>
			<span class="card__title">${escapeHtml(project.title)}</span>
			${summary}
			<span class="card__meta">Latest ${escapeHtml(latestOf(project))} · ${plural((project.versions ?? []).length, 'version')}</span>
		</a>`;
}

function recentRow(project: SiteProject): string {
	const version = latestOf(project);
	return `<a class="row" href="${readerLink(project, version)}" data-name="${escapeHtml(project.title)}">
			<span class="row__title">${escapeHtml(project.title)}</span>
			<span class="row__version">${escapeHtml(version)}</span>
			<span class="row__meta">built ${escapeHtml(since(project.builtAt))}</span>
			<span class="row__go">Read →</span>
		</a>`;
}

function drawSection(projects: SiteProject[]): void {
	const asked = SECTIONS.find((entry) => entry.id === param('section')) ?? SECTIONS[0];
	drawTabs(asked.id);
	document.title = `${asked.title} · Temco Learn`;

	const held = projects.filter((project) => project.section === asked.id);
	const newest = [...held]
		.sort((one, other) => String(other.builtAt ?? '').localeCompare(String(one.builtAt ?? '')))
		.slice(0, RECENT);
	const wrap = need<HTMLElement>('wrap');

	wrap.innerHTML = `	<header class="hero">
		<p class="hero__eyebrow">Temco Learn</p>
		<h1 class="hero__title">${escapeHtml(asked.title)}</h1>
		<p class="hero__desc">${escapeHtml(asked.desc)}</p>
		${searchBox()}
	</header>
${
	held.length === 0
		? `	<p class="empty">${asked.empty}</p>`
		: `	<div class="section-head"><h2>Projects</h2><span class="more">${plural(held.length, 'project')}</span></div>
	<div class="grid">
		${held.map(card).join('\n\t\t')}
	</div>
${
	newest.length === 0
		? ''
		: `	<div class="section-head"><h2>Recently updated</h2></div>
	<div class="rows">
		${newest.map(recentRow).join('\n\t\t')}
	</div>
`
}`
}`;

	attachFilter(wrap);
}

/* ---- one project --------------------------------------------------------------------------------------------- */

function drawProject(projects: SiteProject[]): void {
	const project = projects.find((entry) => entry.id === param('id'));
	const wrap = need<HTMLElement>('wrap');

	if (project === undefined) {
		drawTabs('documentation');
		document.title = 'Not on the site · Temco Learn';
		wrap.innerHTML = `<p class="empty">This project is not on the site. <a href="index.html">Back to Documentation</a>.</p>`;
		return;
	}

	const section = sectionOf(project);
	drawTabs(section.id);
	document.title = `${project.title} · Temco Learn`;

	const versions = (project.versions ?? [])
		.map((entry) => {
			const latest = entry.version === latestOf(project);
			return `<a class="row" href="${readerLink(project, entry.version)}" data-name="${escapeHtml(entry.version)}">
			<span class="row__version">${escapeHtml(entry.version)}</span>
			${latest ? '<span class="row__tag">latest</span>' : ''}
			${latest && entry.builtAt !== undefined ? `<span class="row__meta">built ${escapeHtml(since(entry.builtAt))}</span>` : ''}
			<span class="row__go">Read →</span>
		</a>`;
		})
		.join('\n\t\t');

	wrap.innerHTML = `	<header class="hero">
		<p class="crumbs"><a href="${sectionLink(section)}">${escapeHtml(section.title)}</a> › ${escapeHtml(project.title)}</p>
		<h1 class="hero__title">${escapeHtml(project.title)}</h1>
		${project.summary === undefined || project.summary === '' ? '' : `<p class="hero__desc">${escapeHtml(project.summary)}</p>`}
	</header>
	<div class="section-head"><h2>${plural((project.versions ?? []).length, 'version')}</h2></div>
	<div class="rows">
		${versions}
	</div>`;

	attachFilter(wrap);
}

/* ---- the reader ---------------------------------------------------------------------------------------------- */

interface Heading {
	id: string;
	text: string;
	level: number;
}

function drawReader(projects: SiteProject[]): void {
	const found = projects.find((entry) => entry.id === param('id'));
	const frame = need<HTMLIFrameElement>('page');
	const navList = need<HTMLUListElement>('nav-list');
	const crumbs = need<HTMLElement>('crumbs');
	const headings = need<HTMLUListElement>('headings');
	const foot = need<HTMLElement>('foot');
	const navHead = need<HTMLElement>('nav-head');
	const count = need<HTMLElement>('count');
	const product = need<HTMLElement>('product');
	const picker = need<HTMLSelectElement>('version');
	const prev = need<HTMLAnchorElement>('prev');
	const next = need<HTMLAnchorElement>('next');
	const search = need<HTMLInputElement>('search');

	if (found === undefined) {
		document.title = 'Not on the site · Temco Learn';
		navHead.textContent = 'Temco Learn';
		navList.innerHTML = '<li class="r-nav__empty">This project is not on the site.</li>';
		crumbs.innerHTML = '<a href="index.html">Back to Documentation</a>';
		return;
	}
	const project: SiteProject = found;

	const versions = project.versions ?? [];
	const version = versions.find((entry) => entry.version === param('version')) ?? versions[0];
	const pages = version === undefined ? [] : version.pages ?? [];

	document.title = `${project.title} — ${version === undefined ? '' : `${version.version} — `}Temco Learn`;
	product.textContent = project.title;
	navHead.textContent = version === undefined ? project.title : `${project.title} · ${version.version}`;
	foot.innerHTML = `<div>${escapeHtml(project.title)}${version === undefined ? '' : ` · ${escapeHtml(version.version)}`}</div><div>Temco Learn</div>`;
	count.textContent = plural(pages.length, 'page');

	navList.innerHTML =
		pages.length === 0
			? '<li class="r-nav__empty">This version has no pages yet.</li>'
			: pages
					.map(
						(page, index) =>
							`<li><a class="r-nav__link" href="${escapeHtml(page.href)}" data-index="${index}">${escapeHtml(page.title)}</a></li>`
					)
					.join('');

	// One version is not a choice: the picker is only shown when there is somewhere to go.
	if (versions.length > 1) {
		picker.hidden = false;
		picker.innerHTML = versions
			.map(
				(entry) =>
					`<option value="${escapeHtml(entry.version)}"${version !== undefined && entry.version === version.version ? ' selected' : ''}>${escapeHtml(entry.version)}</option>`
			)
			.join('');
		picker.addEventListener('change', () => {
			location.href = readerLink(project, picker.value);
		});
	}

	const folder = `${encodeURIComponent(project.id)}/${encodeURIComponent(version === undefined ? '' : version.version)}/`;
	let at = 0;

	function fillToc(): void {
		let found: Heading[] = [];
		try {
			// Same origin only: the frame is a page from the same folder. A browser refuses this from `file://`, and then
			// the panel stays empty rather than guessing at what the article holds.
			const doc = frame.contentDocument;
			if (doc !== null) {
				found = Array.from(doc.querySelectorAll<HTMLElement>('h2[id], h3[id]')).map((node) => ({
					id: node.id,
					text: node.textContent ?? '',
					level: node.tagName === 'H3' ? 3 : 2
				}));
			}
		} catch {
			found = [];
		}
		headings.innerHTML =
			found.length === 0
				? '<li class="r-toc__empty">—</li>'
				: found
						.map(
							(item) =>
								`<li class="lvl-${item.level}"><a href="#" data-id="${escapeHtml(item.id)}">${escapeHtml(item.text)}</a></li>`
						)
						.join('');
	}

	headings.addEventListener('click', (event) => {
		const anchor = (event.target as Element | null)?.closest('a[data-id]') ?? null;
		if (anchor === null) {
			return;
		}
		event.preventDefault();
		try {
			const frameWindow = frame.contentWindow;
			if (frameWindow !== null) {
				frameWindow.location.hash = anchor.getAttribute('data-id') ?? '';
			}
		} catch {
			// A frame from another origin cannot be scrolled from here.
		}
	});

	function show(index: number, remember: boolean): void {
		if (index < 0 || index >= pages.length) {
			return;
		}
		at = index;
		const page = pages[index];
		frame.src = folder + page.href;
		if (version !== undefined) {
			crumbs.innerHTML = `<b>${escapeHtml(project.title)}</b> › ${escapeHtml(page.title)}`;
		}
		for (const entry of navList.querySelectorAll<HTMLElement>('.r-nav__link')) {
			const mine = Number(entry.getAttribute('data-index')) === index;
			entry.classList.toggle('is-active', mine);
			if (mine) {
				entry.scrollIntoView({ block: 'nearest' });
			}
		}
		const before = pages[index - 1];
		const after = pages[index + 1];
		prev.textContent = before === undefined ? '‹ Previous' : `‹ ${before.title}`;
		prev.setAttribute('href', '#');
		prev.setAttribute('aria-disabled', before === undefined ? 'true' : 'false');
		next.textContent = after === undefined ? 'Next ›' : `${after.title} ›`;
		next.setAttribute('href', '#');
		next.setAttribute('aria-disabled', after === undefined ? 'true' : 'false');
		document.title = `${page.title} — ${project.title} — Temco Learn`;
		if (remember && version !== undefined) {
			history.replaceState(null, '', readerLink(project, version.version, page.href));
		}
	}

	navList.addEventListener('click', (event) => {
		const anchor = (event.target as Element | null)?.closest('a[data-index]') ?? null;
		if (anchor === null) {
			return;
		}
		event.preventDefault();
		show(Number(anchor.getAttribute('data-index')), true);
	});

	frame.addEventListener('load', fillToc);

	prev.addEventListener('click', (event) => {
		event.preventDefault();
		show(at - 1, true);
	});
	next.addEventListener('click', (event) => {
		event.preventDefault();
		show(at + 1, true);
	});

	search.addEventListener('input', () => {
		const needle = search.value.toLowerCase();
		for (const item of navList.querySelectorAll<HTMLElement>('li')) {
			const anchor = item.querySelector('a');
			item.hidden = anchor !== null && needle !== '' && (anchor.textContent ?? '').toLowerCase().indexOf(needle) === -1;
		}
	});

	// A page can be sent to somebody: the address carries the page, so a reload lands where it was.
	const wanted = pages.findIndex((page) => page.href === param('page'));
	if (pages.length > 0) {
		show(wanted === -1 ? 0 : wanted, false);
	}
}

/* ---- start --------------------------------------------------------------------------------------------------- */

(async () => {
	const projects = await readProjects();
	switch (document.body?.dataset.page) {
		case 'project':
			drawProject(projects);
			break;
		case 'reader':
			drawReader(projects);
			break;
		default:
			drawSection(projects);
	}
})();
