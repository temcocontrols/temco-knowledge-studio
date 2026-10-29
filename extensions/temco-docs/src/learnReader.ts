// The reader: a published documentation set, laid out the way MSDN and Microsoft Learn lay one out.
//
// This is the half of "documentation" that is not authoring. The authoring surface is inside VS Code; what a reader
// gets is this page — a bar with the product, its version and a search box; the navigation on the left; the article in
// the middle with a breadcrumb above it and previous/next below; and the article's own headings on the right, so a long
// page can be crossed without scrolling it.
//
// It is one self-contained file on purpose:
//
//   * the model is embedded as JSON, so it works from a folder, from a loopback server, and from a CHM alike — no fetch,
//     no build step, no second file to keep in step;
//   * the article is the page the generator already wrote, in a frame, so DocFX, MkDocs or Docusaurus keep rendering
//     their own Markdown and we do not re-implement a Markdown renderer or re-parse somebody's HTML;
//   * the headings on the right are read from that frame while the two are same-origin. Over `http` they always are
//     (that is what `siteServer` is for); from `file://` a browser refuses, and the panel then simply says nothing.
//
// Pure: no `vscode`, no filesystem. `scripts/check-learn.mts` renders it and reads the result.

/** One page of a published set. */
export interface ReaderPage {
	/** Relative to the folder the reader is written into. */
	href: string;
	title: string;
}

export interface ReaderModel {
	/** The product's title, as the portal shows it. */
	product: string;
	version: string;
	/** Newest first. */
	versions: string[];
	pages: readonly ReaderPage[];
}

function escape(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/** `&` and `<` are enough for a JSON payload inside a script block; `</script>` is the one thing that must not appear. */
function payload(model: ReaderModel): string {
	return JSON.stringify({
		product: model.product,
		version: model.version,
		versions: model.versions,
		pages: model.pages.map((page) => ({ href: page.href, title: page.title })),
	}).replace(/</g, '\\u003c');
}

/**
 * The reader for one published version.
 *
 * Every decision that could be wrong is visible in the markup below: the navigation is server-written (so it works with
 * scripting off), the article is a frame, the right-hand panel starts empty because it is filled from the article.
 */
export function readerPage(model: ReaderModel): string {
	const nav = model.pages
		.map(
			(page, index) =>
				`<li><a class="nav__link${index === 0 ? ' is-active' : ''}" href="${escape(page.href)}" data-index="${String(index)}">${escape(page.title)}</a></li>`
		)
		.join('\n        ');
	const versions = model.versions
		.map((version) => `<option value="${escape(version)}"${version === model.version ? ' selected' : ''}>${escape(version)}</option>`)
		.join('');
	const first = model.pages[0];

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(model.product)} — ${escape(model.version)} — Temco Learn</title>
<style>
	:root {
		--bg: #ffffff; --bg-soft: #f6f7f9; --bg-nav: #fafbfc; --fg: #1b1b1b; --fg-soft: #4b5563; --fg-faint: #6b7280;
		--line: #e3e6ea; --line-strong: #cfd4da; --accent: #0b61a4; --accent-soft: #e8f1fa; --shadow: 0 1px 2px rgba(16,24,40,.06);
	}
	@media (prefers-color-scheme: dark) {
		:root {
			--bg: #1b1b1b; --bg-soft: #141414; --bg-nav: #171717; --fg: #e6e6e6; --fg-soft: #b4b4b4; --fg-faint: #8f8f8f;
			--line: #2c2c2c; --line-strong: #3a3a3a; --accent: #6cb6ff; --accent-soft: #1c2b3a; --shadow: none;
		}
	}
	* { box-sizing: border-box; }
	html, body { height: 100%; margin: 0; }
	body { font: 14px/1.6 "Segoe UI", system-ui, sans-serif; color: var(--fg); background: var(--bg); }

	/* ---- the bar ------------------------------------------------------------------------------------- */
	.bar { display: flex; align-items: center; gap: 14px; height: 48px; padding: 0 18px; border-bottom: 1px solid var(--line); background: var(--bg); position: sticky; top: 0; z-index: 5; }
	.brand { font-weight: 600; font-size: 15px; white-space: nowrap; }
	.brand a { color: inherit; text-decoration: none; }
	.product { color: var(--fg-soft); padding-left: 14px; border-left: 1px solid var(--line); white-space: nowrap; }
	.spacer { flex: 1; }
	.search { width: min(320px, 34vw); height: 30px; padding: 0 10px; border: 1px solid var(--line-strong); border-radius: 4px; background: var(--bg); color: var(--fg); font: inherit; }
	.search:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
	.version { height: 30px; padding: 0 8px; border: 1px solid var(--line-strong); border-radius: 4px; background: var(--bg); color: var(--fg); font: inherit; }

	/* ---- the three columns --------------------------------------------------------------------------- */
	.cols { display: grid; grid-template-columns: 260px minmax(0, 1fr) 240px; height: calc(100% - 48px - 34px); }
	.nav { border-right: 1px solid var(--line); background: var(--bg-nav); overflow: auto; padding: 14px 0 28px; }
	.nav__head { padding: 0 16px 8px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--fg-faint); }
	.nav ul { list-style: none; margin: 0; padding: 0; }
	.nav__link { display: block; padding: 5px 16px 5px 18px; color: var(--fg-soft); text-decoration: none; border-left: 3px solid transparent; font-size: 13px; }
	.nav__link:hover { background: var(--accent-soft); color: var(--fg); }
	.nav__link.is-active { border-left-color: var(--accent); background: var(--accent-soft); color: var(--fg); font-weight: 600; }
	.nav__empty { padding: 8px 16px; color: var(--fg-faint); font-size: 13px; }

	.main { display: flex; flex-direction: column; min-width: 0; }
	.crumbs { padding: 10px 22px; border-bottom: 1px solid var(--line); color: var(--fg-faint); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.crumbs b { color: var(--fg-soft); font-weight: 600; }
	.page { flex: 1; border: 0; width: 100%; background: var(--bg); }
	.pager { display: flex; gap: 12px; padding: 10px 22px; border-top: 1px solid var(--line); font-size: 13px; }
	.pager a { color: var(--accent); text-decoration: none; }
	.pager a[disabled] { color: var(--fg-faint); pointer-events: none; }
	.pager .spacer { flex: 1; }

	.toc { border-left: 1px solid var(--line); overflow: auto; padding: 18px 16px; }
	.toc__head { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--fg-faint); margin-bottom: 8px; }
	.toc ul { list-style: none; margin: 0; padding: 0; }
	.toc li { margin: 0 0 2px; }
	.toc a { display: block; padding: 3px 0 3px 8px; border-left: 2px solid var(--line); color: var(--fg-soft); text-decoration: none; font-size: 12.5px; line-height: 1.45; }
	.toc a:hover { border-left-color: var(--accent); color: var(--fg); }
	.toc .lvl-3 a { padding-left: 20px; }
	.toc__empty { color: var(--fg-faint); font-size: 12.5px; }
	.toc__foot { margin-top: 18px; padding-top: 12px; border-top: 1px solid var(--line); font-size: 12px; color: var(--fg-faint); }

	/* ---- the foot ------------------------------------------------------------------------------------ */
	.foot { display: flex; align-items: center; gap: 12px; height: 34px; padding: 0 18px; border-top: 1px solid var(--line); background: var(--bg-soft); color: var(--fg-faint); font-size: 12px; }
	.foot .spacer { flex: 1; }

	@media (max-width: 1100px) { .cols { grid-template-columns: 220px minmax(0, 1fr); } .toc { display: none; } }
	@media (max-width: 760px) { .cols { grid-template-columns: minmax(0, 1fr); } .nav { display: none; } }
</style>
</head>
<body>
<header class="bar">
	<div class="brand"><a href="./">Temco Learn</a></div>
	<div class="product" id="product">${escape(model.product)}</div>
	<span class="spacer"></span>
	<label for="version" class="sr-only" hidden>Version</label>
	${model.versions.length > 1 ? `<select class="version" id="version" aria-label="Version">${versions}</select>` : ''}
	<input class="search" id="search" type="search" placeholder="Search this version…" aria-label="Search the documentation">
</header>

<div class="cols">
	<nav class="nav" aria-label="Documentation">
		<div class="nav__head">${escape(model.product)} · ${escape(model.version)}</div>
		<ul id="toc-list">
        ${nav.length > 0 ? nav : '<li class="nav__empty">This version has no pages yet.</li>'}
		</ul>
	</nav>

	<main class="main">
		<div class="crumbs" id="crumbs"><b>${escape(model.product)}</b>${first === undefined ? '' : ` › ${escape(first.title)}`}</div>
		<iframe class="page" id="page" title="Page" src="${first === undefined ? 'about:blank' : escape(first.href)}"></iframe>
		<div class="pager">
			<a id="prev" href="#" disabled>‹ Previous</a>
			<span class="spacer"></span>
			<a id="next" href="#" disabled>Next ›</a>
		</div>
	</main>

	<aside class="toc" aria-label="In this article">
		<div class="toc__head">In this article</div>
		<ul id="headings"><li class="toc__empty">—</li></ul>
		<div class="toc__foot" id="foot">
			<div>${escape(model.product)} · ${escape(model.version)}</div>
			<div>Temco Learn</div>
		</div>
	</aside>
</div>

<footer class="foot">
	<span>${escape(model.product)} ${escape(model.version)}</span>
	<span class="spacer"></span>
	<span id="count">${String(model.pages.length)} page${model.pages.length === 1 ? '' : 's'}</span>
</footer>

<script>
(function () {
	var model = ${payload(model)};
	var frame = document.getElementById('page');
	var crumbs = document.getElementById('crumbs');
	var headings = document.getElementById('headings');
	var prev = document.getElementById('prev');
	var next = document.getElementById('next');
	var search = document.getElementById('search');
	var at = 0;

	function fillToc() {
		var items = [];
		try {
			// Same origin only: the frame is a generated page from the same folder. A browser refuses this from file://,
			// and then the panel stays empty rather than guessing.
			var doc = frame.contentDocument;
			if (doc) {
				var found = doc.querySelectorAll('h2[id], h3[id]');
				for (var i = 0; i < found.length; i++) {
					var node = found[i];
					items.push({ id: node.id, text: node.textContent || '', level: node.tagName === 'H3' ? 3 : 2 });
				}
			}
		} catch (error) { items = []; }
		if (items.length === 0) {
			headings.innerHTML = '<li class="toc__empty">—</li>';
			return;
		}
		headings.innerHTML = items.map(function (item) {
			return '<li class="' + (item.level === 3 ? 'lvl-3' : 'lvl-2') + '"><a href="#" data-id="' + item.id.replace(/"/g, '') + '">' + item.text.replace(/</g, '&lt;') + '</a></li>';
		}).join('');
	}

	headings.addEventListener('click', function (event) {
		var link = event.target.closest('a[data-id]');
		if (!link) { return; }
		event.preventDefault();
		try { frame.contentWindow.location.hash = link.getAttribute('data-id'); } catch (error) { /* cross-origin */ }
	});

	function show(index, push) {
		if (index < 0 || index >= model.pages.length) { return; }
		at = index;
		var page = model.pages[index];
		frame.src = page.href;
		crumbs.innerHTML = '<b>' + model.product.replace(/</g, '&lt;') + '</b> › ' + page.title.replace(/</g, '&lt;');
		var links = document.querySelectorAll('.nav__link');
		for (var i = 0; i < links.length; i++) {
			links[i].classList.toggle('is-active', i === index);
			if (i === index && links[i].scrollIntoView) { links[i].scrollIntoView({ block: 'nearest' }); }
		}
		prev.textContent = index > 0 ? '‹ ' + model.pages[index - 1].title : '‹ Previous';
		prev.href = index > 0 ? model.pages[index - 1].href : '#';
		prev.disabled = index === 0;
		next.textContent = index + 1 < model.pages.length ? model.pages[index + 1].title + ' ›' : 'Next ›';
		next.href = index + 1 < model.pages.length ? model.pages[index + 1].href : '#';
		next.disabled = index + 1 >= model.pages.length;
		if (push) { history.replaceState(null, '', '#' + encodeURIComponent(page.href)); }
		document.title = page.title + ' — ' + model.product + ' — Temco Learn';
	}

	document.getElementById('toc-list').addEventListener('click', function (event) {
		var link = event.target.closest('a[data-index]');
		if (!link) { return; }
		event.preventDefault();
		show(Number(link.getAttribute('data-index')), true);
	});

	frame.addEventListener('load', fillToc);

	prev.addEventListener('click', function (event) { event.preventDefault(); show(at - 1, true); });
	next.addEventListener('click', function (event) { event.preventDefault(); show(at + 1, true); });

	search.addEventListener('input', function () {
		var needle = search.value.toLowerCase();
		var links = document.querySelectorAll('#toc-list li');
		for (var i = 0; i < links.length; i++) {
			var link = links[i].querySelector('a');
			if (!link) { continue; }
			links[i].style.display = link.textContent.toLowerCase().indexOf(needle) === -1 ? 'none' : '';
		}
	});

	// One version is not a choice: the picker is only drawn when there is somewhere to go.
	var picker = document.getElementById('version');
	if (picker) {
		picker.addEventListener('change', function (event) {
			location.href = '../' + encodeURIComponent(event.target.value) + '/temco-reader.html';
		});
	}

	// A deep link is the hash, so a page can be sent to somebody.
	var wanted = decodeURIComponent(location.hash.replace(/^#/, ''));
	if (wanted) {
		for (var i = 0; i < model.pages.length; i++) {
			if (model.pages[i].href === wanted) { show(i, false); break; }
		}
	} else if (model.pages.length > 0) {
		show(0, false);
	}
})();
</script>
</body>
</html>
`;
}
