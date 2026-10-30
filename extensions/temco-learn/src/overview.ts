// Overview — the module's own page, and never a page of the website.
//
// The website is what a reader opens; it carries nothing about running it. This page is ours, drawn with the application's
// page vocabulary (`temco-ui`: the Fluent kit seeded from Azure blue). It opens by saying what the module is and what to do
// next, then shows the three places the work lands — the projects on the website, what the builds wrote, and where it is
// published — as rows, with the acts along the bottom edge of each part rather than floating at the right of its heading.

import * as path from 'path';
import * as vscode from 'vscode';
import { formatSize, ProjectArtifacts } from './artifacts';
import { latestOf, sectionTitle, shortName, workRoot } from './site';
import { siteRepo } from './siteRepo';
import { Snapshot } from './snapshot';
import { ago } from './state';
import { callout, commandScript, entryRow, escapeHtml, hero, icon, page, pageColumn, runCommand, section } from './ui';

export const OVERVIEW_VIEW_TYPE = 'temcoLearn.overview';

/** The page's own rules, on top of the vocabulary: a short brand bar before a section title, four cards in a row, and
 *  the acts of a section along its bottom edge instead of at the right of its heading. */
export const PAGE_STYLE = `
.az-section__title { position: relative; padding-left: 10px; }
.az-section__title::before { content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 2px; height: 12px; border-radius: 1px; background: var(--az-blue, #0078d4); }
.az-options { grid-template-columns: repeat(auto-fit, minmax(215px, 1fr)); }
.az-block__note { margin: var(--sp-2) 0 0; color: var(--ink-3); font-size: 11.5px; line-height: 16px; }
.az-block__foot { display: flex; flex-wrap: wrap; gap: var(--sp-5); margin: var(--sp-3) 0 0; padding-top: var(--sp-2); border-top: 1px solid var(--border); }
.az-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: var(--sp-4); padding: var(--sp-3) var(--sp-4); border: 1px solid var(--hairline); border-radius: var(--r-2); background: var(--surface-card); }
.az-fact { min-width: 0; }
.az-fact__title { display: flex; align-items: center; gap: var(--sp-1); color: var(--ink-2); font-size: 12px; line-height: 16px; }
.az-fact__title .icon { width: 14px; height: 14px; color: var(--az-blue); }
.az-fact__value { display: block; margin-top: 2px; color: var(--ink-1); font-size: 12.5px; line-height: 17px; overflow-wrap: break-word; }
.az-fact__value--mono { font-family: var(--font-mono); }
.az-facts + .az-entries { margin-top: var(--sp-2); }
`;

export class OverviewPage implements vscode.Disposable {
	private opened: vscode.WebviewPanel | undefined;

	constructor(private readonly read: () => Promise<Snapshot>) { }

	/** Opens the page, or brings it forward if it is already open. */
	open(): void {
		if (this.opened !== undefined) {
			this.opened.reveal(pageColumn());
			void this.render();
			return;
		}
		this.opened = vscode.window.createWebviewPanel(OVERVIEW_VIEW_TYPE, 'Temco Learn', pageColumn(), {
			enableScripts: true,
			localResourceRoots: []
		});
		this.opened.iconPath = new vscode.ThemeIcon('cloud-upload');
		this.opened.onDidDispose(() => {
			this.opened = undefined;
		});
		this.opened.webview.onDidReceiveMessage(runCommand);
		void this.render();
	}

	/** Re-renders if the page is open: an add, a build or a publish all land here. */
	refresh(): void {
		void this.render();
	}

	dispose(): void {
		this.opened?.dispose();
	}

	private async render(): Promise<void> {
		const opened = this.opened;
		if (opened === undefined) {
			return;
		}
		const state = await this.read();
		opened.webview.html = page(html(state), { title: 'Temco Learn', script: commandScript, extraCss: PAGE_STYLE });
	}
}

const plural = (count: number, one: string, many?: string): string =>
	`${count} ${count === 1 ? one : many === undefined ? `${one}s` : many}`;

/** The commands a page of this module may draw: a typo is a compile error, not a dead button. */
type PageCommand =
	| 'temcoLearn.site.preview'
	| 'temcoLearn.site.folder'
	| 'temcoLearn.previewArtifact'
	| 'temcoLearn.downloadArtifact'
	| 'temcoLearn.addBuilds'
	| 'temcoLearn.publish'
	| 'temcoLearn.openPublished'
	| 'temcoLearn.revealArtifact'
	| 'temcoDocs.builds';

/** A button in the application's own dress, carrying the command it runs. */
function button(label: string, command: PageCommand, options: { args?: unknown; kind?: 'primary' | 'link' } = {}): string {
	const cls = `az-btn${options.kind === 'primary' ? ' az-btn--primary' : options.kind === 'link' ? ' az-btn--link' : ''}`;
	const args = options.args === undefined ? '' : ` data-args="${escapeHtml(JSON.stringify(options.args))}"`;
	return `<button type="button" class="${cls}" data-command="${command}"${args}><span>${escapeHtml(label)}</span></button>`;
}

/** An act written as a link at the end of a card or a section heading: the glyph, the words, the arrow. */
function link(label: string, command: PageCommand, options: { args?: unknown; mark?: string } = {}): string {
	const mark = options.mark === undefined ? '' : icon(options.mark);
	const data = options.args === undefined ? '' : ` data-args="${escapeHtml(JSON.stringify(options.args))}"`;
	return `<button type="button" class="az-btn az-btn--link" data-command="${command}"${data}>${mark}<span>${escapeHtml(label)}</span>${icon('chevron-right', 'icon--sm')}</button>`;
}

/** Where one project's build wrote: its `dist` when there is a site there, and the project's own folder otherwise. */
function folderOf(project: ProjectArtifacts): string {
	const site = project.artifacts.find((artifact) => artifact.kind === 'site');
	return site === undefined ? project.folder : path.dirname(site.file);
}

/** How many pages the website holds, over every project and version. */
function pagesOf(state: Snapshot): number {
	return state.site.projects.reduce(
		(total, project) => total + project.versions.reduce((count, version) => count + version.pages.length, 0),
		0
	);
}

/** The sections that hold something, named the way the tabs are: "Documentation and Training & Labs". */
function heldSections(state: Snapshot): string {
	const titles = [...new Set(state.site.projects.map((project) => sectionTitle(project.section)))];
	return titles.length <= 1 ? titles.join('') : `${titles.slice(0, -1).join(', ')} and ${titles[titles.length - 1]}`;
}

/** The builds newer than what the website holds: those are the ones worth adding. */
function waiting(state: Snapshot): Snapshot['builds'] {
	return state.builds.filter((build) => {
		const project = state.site.projects.find((entry) => entry.id === build.id);
		if (project === undefined) {
			return true;
		}
		const newestVersion = project.versions[0]?.builtAt;
		return newestVersion === undefined || build.at > Date.parse(newestVersion);
	});
}

/** The title block: what this module is, in sentences counted from the snapshot, and the two ways in. */
function head(state: Snapshot): string {
	const projects = state.site.projects.length;
	const versions = state.site.projects.reduce((total, project) => total + project.versions.length, 0);
	const pages = pagesOf(state);
	const published = state.published;
	const desc =
		projects === 0
			? "Temco Learn is the documentation website. It is built from its own repository — Markdown pages under six sections, one folder per project and version — and this module runs, builds, previews and publishes that repository. Nothing is on the site yet: add a build, or write a page in it."
			: `Temco Learn is the documentation website. It is built from its own repository — Markdown pages under six sections, one folder per project and version — and this module runs, builds, previews and publishes that repository. It holds ${plural(projects, 'project')}, ${plural(versions, 'version')} and ${plural(pages, 'page')} today; this page says what is on it, what is waiting, and where it is published.`;
	const note =
		published.commit === undefined
			? { text: 'Never published — the website is not on the internet yet', mark: 'clock' }
			: { text: `Last publish ${published.commit} · ${ago(published.at)}`, mark: 'clock', link: { command: 'temcoLearn.openPublished' } };
	return hero({
		eyebrow: 'Temco Learn',
		mark: 'book',
		title: 'Overview',
		desc,
		descWide: true,
		note,
		actions: [
			{ label: 'Preview the Website', command: 'temcoLearn.site.preview', mark: 'globe', kind: 'primary' },
			{ label: 'Publish', command: 'temcoLearn.publish', mark: 'upload' }
		]
	});
}

/** The one callout: what to do next, or that there is nothing to do, or that nothing exists yet. */
function needsYou(state: Snapshot): string {
	const builds = waiting(state).length;
	const changes = state.published.pending;
	const parts: string[] = [];
	const actions: string[] = [];
	if (builds > 0) {
		parts.push(`${plural(builds, 'build')} on disk ${builds === 1 ? 'is' : 'are'} not on the website`);
		actions.push(button('Add the builds', 'temcoLearn.addBuilds', { kind: 'primary' }));
	}
	if (changes > 0) {
		parts.push(`${plural(changes, 'change')} ${changes === 1 ? 'is' : 'are'} not published`);
		actions.push(button('Publish', 'temcoLearn.publish', { kind: builds > 0 ? undefined : 'primary' }));
	}
	if (parts.length > 0) {
		return callout({ title: 'What needs doing', desc: `${parts.join(' · ')}.`, mark: 'warning', actions: actions.join('') });
	}
	if (state.site.projects.length === 0 && state.artifacts.length === 0) {
		return callout({
			title: 'Nothing has been built yet',
			desc: 'Build a project in Temco Docs, then add the build here — the website only ever shows what has been added.',
			mark: 'info',
			actions: button('Open Temco Docs', 'temcoDocs.builds', { kind: 'primary' })
		});
	}
	return callout({
		title: 'Nothing needs doing',
		desc: 'Every build on disk is on the website, and the website is published.',
		mark: 'check'
	});
}

/** One step of the workflow: a number, a name, one line, and the link that starts it. */
function stepCard(tag: string, mark: string, title: string, desc: string, action: string): string {
	return `<section class="az-option"><div class="az-option__top"><span class="az-option__icon">${icon(mark)}</span><div><span class="az-option__tag">${escapeHtml(tag)}</span><h2 class="az-option__title">${escapeHtml(title)}</h2></div></div><p class="az-option__desc">${escapeHtml(desc)}</p><div class="az-option__actions">${action}</div></section>`;
}

/** The workflow: four steps, one line each, each ending in the act that performs it. */
function workflow(state: Snapshot): string {
	const builds = waiting(state).length;
	const changes = state.published.pending;
	const files = state.artifacts.length === 0;
	const cards = [
		stepCard(
			'1',
			'play',
			'Build',
			'Temco Docs turns the pages into a site, an offline help file, a pdf and a zip.',
			link('Open Temco Docs', 'temcoDocs.builds', { mark: 'external' })
		),
		stepCard(
			'2',
			'plus',
			'Add',
			'A build becomes a version of a project on the website.',
			link(builds === 0 ? 'Choose a build' : `Choose a build · ${plural(builds, 'waiting')}`, 'temcoLearn.addBuilds', { mark: 'plus' })
		),
		stepCard(
			'3',
			'upload',
			'Publish',
			'The website goes on the internet for readers.',
			link(changes === 0 ? 'Publish' : `Publish · ${plural(changes, 'change')}`, 'temcoLearn.publish', { mark: 'upload' })
		),
		stepCard(
			'4',
			'download',
			'Download',
			'Take the build away: the offline help, the pdf, the zip.',
			files
				? link('Build a project', 'temcoDocs.builds', { mark: 'play' })
				: link('Show in the folder', 'temcoLearn.revealArtifact', { args: workRoot(), mark: 'folder' })
		)
	];
	return [
		section({ title: 'Publishing workflow', desc: 'Four steps, from a project\'s pages to a file a reader can take away.' }),
		`<div class="az-options">${cards.join('')}</div>`
	].join('\n');
}

/** A band of facts on one line: the three things a person compares at a glance, each a title over its value. */
function factsBand(cells: readonly { title: string; value: string; mark: string; mono?: boolean }[]): string {
	return `<div class="az-facts">${cells
		.map(
			(cell) =>
				`<div class="az-fact"><span class="az-fact__title">${icon(cell.mark, 'icon--sm')}${escapeHtml(cell.title)}</span><span class="az-fact__value${
					cell.mono === true ? ' az-fact__value--mono' : ''
				}">${escapeHtml(cell.value)}</span></div>`
		)
		.join('')}</div>`;
}

/**
 * One part of the page: its heading, the facts it states on one line, the rows it lists, and its acts along the bottom
 * edge — never at the right of the heading.
 */
function block(options: { title: string; desc: string; facts?: string; rows?: readonly string[]; acts: string; note?: string }): string {
	const rows = options.rows ?? [];
	return [
		section({ title: options.title, desc: options.desc }),
		options.facts ?? '',
		rows.length === 0 ? '' : `<div class="az-entries">${rows.join('')}</div>`,
		options.note === undefined ? '' : `<p class="az-block__note">${escapeHtml(options.note)}</p>`,
		`<div class="az-block__foot">${options.acts}</div>`
	]
		.filter((part) => part !== '')
		.join('\n');
}

/** A fact a section states about itself: it carries no act, because the section's acts are along its bottom edge. */
function fact(title: string, meta: string, mark: string): string {
	return entryRow({ title, meta, mark });
}

/** What is on the website: one row per project, opening that project's page on the website. */
function published(state: Snapshot): string {
	const projects = state.site.projects;
	if (projects.length === 0) {
		return block({
			title: 'Published projects',
			desc: 'Nothing is published yet. A project appears here as soon as one of its builds is added to the website.',
			acts: link('Open Temco Docs', 'temcoDocs.builds', { mark: 'external' })
		});
	}
	const versions = projects.reduce((total, project) => total + project.versions.length, 0);
	const desc = `${plural(projects.length, 'project')} ${projects.length === 1 ? 'is' : 'are'} published in ${heldSections(
		state
	)}, ${plural(versions, 'version')} and ${plural(pagesOf(state), 'page')} between them. Every version a project keeps stays readable.`;
	const rows = projects.map((project) => {
		const pages = project.versions.reduce((total, version) => total + version.pages.length, 0);
		const newest = latestOf(project);
		return entryRow({
			title: shortName(project.title),
			meta: [plural(project.versions.length, 'version'), plural(pages, 'page'), newest === undefined ? 'not built yet' : `newest ${newest}`].join(' · '),
			mark: 'book',
			command: 'temcoLearn.site.preview',
			args: { project: project.id },
			go: ''
		});
	});
	return block({
		title: 'Published projects',
		desc,
		rows,
		acts: link('Open the website', 'temcoLearn.site.preview', { mark: 'globe' }),
		note: 'A row opens that project on the website.'
	});
}

/** What the builds wrote: one row per project, jumping to the folder that build wrote into. */
function outputs(state: Snapshot): string {
	const projects = state.artifacts;
	const files = projects.reduce((total, project) => total + project.artifacts.length, 0);
	if (files === 0) {
		return block({
			title: 'Build outputs',
			desc: "No build output was found. Build a project in Temco Docs, and what it writes stays in that project's dist folder.",
			acts: link('Build a project', 'temcoDocs.builds', { mark: 'play' })
		});
	}
	const desc = `A build writes a site, an offline help file, a pdf, a zip of the site and often a Word document — ${plural(
		files,
		'file'
	)} across ${plural(projects.length, 'project')}, each in that project's own dist folder.`;
	const rows = projects.map((project) => {
		const bytes = project.artifacts.reduce((total, artifact) => total + (artifact.size ?? 0), 0);
		const folder = folderOf(project);
		return entryRow({
			title: shortName(project.title),
			meta: [plural(project.artifacts.length, 'file'), bytes === 0 ? '' : formatSize(bytes), folder].filter((part) => part !== '').join(' · '),
			mark: 'folder',
			command: 'temcoLearn.revealArtifact',
			args: folder,
			go: ''
		});
	});
	return block({
		title: 'Build outputs',
		desc,
		rows,
		acts: link('Show in the folder', 'temcoLearn.revealArtifact', { args: workRoot(), mark: 'folder' }),
		note: "A row opens that project's build folder."
	});
}

/** Where the website is published: the address, the branch and the last publish on one line, then what is waiting. */
function publication(state: Snapshot): string {
	const published = state.published;
	if (published.base === undefined) {
		return block({
			title: 'Publication',
			desc: `The clone (${siteRepo()}) has no GitHub origin, so there is nothing to publish at yet. A publish pushes the site's own repository; it never makes one, because an empty history pushed at a real site is worse than a refusal.`,
			facts: factsBand([
				{ title: 'Address', value: 'none yet', mark: 'globe' },
				{ title: 'Branch', value: 'main', mark: 'repo' },
				{ title: 'Last publish', value: 'never', mark: 'clock' }
			]),
			acts: link('Publish', 'temcoLearn.publish', { mark: 'upload' })
		});
	}
	const at = published.commit === undefined ? 'never' : `${published.commit}, ${ago(published.at)}`;
	const waiting =
		published.pending === 0 ? 'nothing — the website matches the last publish' : `${plural(published.pending, 'change')} waiting to be published`;
	return block({
		title: 'Publication',
		desc: `Publishing commits the clone and pushes it at main to ${published.where}. GitHub Actions then builds the site from that commit and hands the result to Pages, so the built site is never what is committed — and the address never changes. Nothing is forced: every publish is one commit on top of the last, and an earlier one can be restored.`,
		facts: factsBand([
			{ title: 'Address', value: published.base, mark: 'globe', mono: true },
			{ title: 'Branch', value: 'main · built and served by GitHub Actions', mark: 'repo' },
			{ title: 'Last publish', value: at, mark: 'clock' }
		]),
		rows: [fact('Waiting', waiting, 'sync')],
		acts: [link('Open in browser', 'temcoLearn.openPublished', { mark: 'external' }), link('Publish', 'temcoLearn.publish', { mark: 'upload' })].join(''),
		note: `The site is the clone at ${siteRepo()}. The preview runs that same clone, so what reads here is what gets published.`
	});
}
/** The page: what it is, what to do, the workflow, what is published, what a build writes, and where it goes. */
export function html(state: Snapshot): string {
	return [head(state), needsYou(state), workflow(state), published(state), outputs(state), publication(state)].join('\n');
}