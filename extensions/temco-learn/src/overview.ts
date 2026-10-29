// Overview — the module's own page, and never a page of the website.
//
// The website is what a reader opens; it carries nothing about running it. This page is ours, drawn with the application's
// page vocabulary (`temco-ui`: the Fluent kit seeded from Azure blue), and it has one rule the earlier drafts broke: **it
// describes, and the panel lists**. A list of projects or files on a page goes stale, grows without bound, and repeats the
// panel — so each section here is a sentence with the live counts and one link to the place that does hold the list.

import * as path from 'path';
import * as vscode from 'vscode';
import { ProjectArtifacts } from './artifacts';
import { latestOf, sectionTitle, siteFolder } from './site';
import { Snapshot } from './snapshot';
import { ago } from './state';
import { callout, commandScript, escapeHtml, hero, icon, page, pageColumn, runCommand, section } from './ui';

export const OVERVIEW_VIEW_TYPE = 'temcoLearn.overview';

/** The page's own rules, on top of the vocabulary: the brand bar before a section title, and four cards in a row. */
export const PAGE_STYLE = `
.az-section__title { border-left: 3px solid var(--az-blue, #0078d4); padding-left: 8px; }
.az-options { grid-template-columns: repeat(auto-fit, minmax(215px, 1fr)); }
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
	| 'temcoLearn.preview'
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

/** The most recently published project, when there is one — a page describes, so it may name a date but never a list. */
function newest(state: Snapshot): ProjectArtifacts | undefined {
	return state.artifacts[0];
}

/** The folder a person opens when they want the files themselves: the newest build's `dist`, or the site folder. */
function filesFolder(state: Snapshot): string {
	const project = newest(state);
	if (project === undefined) {
		return siteFolder();
	}
	const site = project.artifacts.find((artifact) => artifact.kind === 'site');
	return site === undefined ? project.folder : path.dirname(site.file);
}

/** `temcocontrols.github.io/docs` — the address without the scheme and the trailing slash. */
function hostOf(base: string): string {
	return base.replace(/^https?:\/\//u, '').replace(/\/$/u, '');
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
			? 'Temco Learn publishes the documentation website. Every project that produces a documentation build can be put on it as one of its versions. Nothing is published yet. This page says what is published, what is waiting, and where it lives.'
			: `Temco Learn publishes the documentation website. Every project that produces a documentation build can be put on it as one of its versions — ${plural(projects, 'project')} ${projects === 1 ? 'is' : 'are'} published today, ${plural(versions, 'version')} and ${plural(pages, 'page')} between them. This page says what is published, what is waiting, and where it lives.`;
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
			{ label: 'Preview the Website', command: 'temcoLearn.preview', mark: 'globe', kind: 'primary' },
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
				: link('Show in the folder', 'temcoLearn.revealArtifact', { args: filesFolder(state), mark: 'folder' })
		)
	];
	return [
		section({ title: 'Publishing workflow', desc: 'Four steps, from a project\'s pages to a file a reader can take away.' }),
		`<div class="az-options">${cards.join('')}</div>`
	].join('\n');
}

/** What is published today, in a sentence — the list of projects is the panel's job. */
function published(state: Snapshot): string {
	const projects = state.site.projects.length;
	if (projects === 0) {
		return section({
			title: 'Published projects',
			desc: 'Nothing is published yet. Build a project in Temco Docs, add the build here, then publish the website.',
			actions: link('Open Temco Docs', 'temcoDocs.builds')
		});
	}
	const newestVersion = state.site.projects
		.map((project) => ({ version: latestOf(project), at: project.builtAt }))
		.filter((entry) => entry.version !== undefined)
		.sort((one, other) => String(other.at ?? '').localeCompare(String(one.at ?? '')))[0];
	const built = newestVersion?.at === undefined ? '' : ` The newest version is ${newestVersion.version}, built ${ago(newestVersion.at)}.`;
	const desc = `${plural(projects, 'project')} ${projects === 1 ? 'is' : 'are'} published in ${heldSections(state)}, ${plural(
		state.site.projects.reduce((total, project) => total + project.versions.length, 0),
		'version'
	)} and ${plural(pagesOf(state), 'page')} between them.${built} Every version a project has stays readable.`;
	return section({ title: 'Published projects', desc, actions: link('Open the website', 'temcoLearn.preview') });
}

/** What a build writes, in a sentence — the files themselves are the panel's Download view. */
function outputs(state: Snapshot): string {
	const newestBuild = newest(state);
	const count = newestBuild === undefined ? 0 : newestBuild.artifacts.length;
	const desc =
		newestBuild === undefined
			? 'No build output was found. Build a project in Temco Docs, and what it writes stays in that project\'s dist folder.'
			: `A build writes a site, an offline help file, a pdf, a zip of the site and often a Word document — the newest build wrote ${plural(count, 'file')}. They stay in the project\'s dist folder.`;
	return section({
		title: 'Build outputs',
		desc,
		actions:
			newestBuild === undefined
				? link('Build a project', 'temcoDocs.builds')
				: link('Show in the folder', 'temcoLearn.revealArtifact', { args: filesFolder(state) })
	});
}

/** Where the website is published, in a sentence, with the way to open it. */
function publication(state: Snapshot): string {
	const published = state.published;
	if (published.base === undefined) {
		return section({
			title: 'Publication',
			desc: `The site folder (${siteFolder()}) points at no GitHub repository, so there is nowhere to publish to yet.`,
			actions: link('Publish', 'temcoLearn.publish')
		});
	}
	const at = published.commit === undefined ? 'never published' : `last publish ${published.commit}, ${ago(published.at)}`;
	return section({
		title: 'Publication',
		desc: `${hostOf(published.base)} · branch gh-pages · ${at}.`,
		actions: link('Open in browser', 'temcoLearn.openPublished')
	});
}

/** The page: what it is, what to do, the workflow, what is published, what a build writes, and where it goes. */
export function html(state: Snapshot): string {
	return [head(state), needsYou(state), workflow(state), published(state), outputs(state), publication(state)].join('\n');
}
