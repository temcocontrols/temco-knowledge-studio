// Overview — the module's own page, and never a page of the website.
//
// The website is what a reader opens; it carries nothing about running it. This page is ours, drawn with the application's
// own page vocabulary (`temco-ui`: the Fluent kit seeded from Azure blue), and it answers, in this order: what is this
// module, what do I do next, how does a page get to a reader, which projects are on the website, what did the builds
// write, and where is it published. No figures row: a number without a sentence around it was the thing nobody could
// read.

import * as vscode from 'vscode';
import { ProjectArtifacts, isDownloadable, isPreviewable } from './artifacts';
import { latestOf, sectionTitle, siteFolder, SiteProject } from './site';
import { Snapshot } from './snapshot';
import { ago } from './state';
import { callout, commandScript, entryRow, escapeHtml, hero, icon, optionCards, page, pageColumn, runCommand, section } from './ui';

export const OVERVIEW_VIEW_TYPE = 'temcoLearn.overview';

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
		opened.webview.html = page(html(state), { title: 'Temco Learn', script: commandScript });
	}
}

const plural = (count: number, one: string, many?: string): string =>
	`${count} ${count === 1 ? one : many === undefined ? `${one}s` : many}`;

/** The commands a page of this module may draw: a typo is a compile error, not a dead button. */
type PageCommand =
	| 'temcoLearn.preview'
	| 'temcoLearn.assemble'
	| 'temcoLearn.publish'
	| 'temcoLearn.openPublished'
	| 'temcoLearn.previewArtifact'
	| 'temcoLearn.downloadArtifact'
	| 'temcoLearn.revealArtifact'
	| 'temcoDocs.builds';

/** A button in the application's own dress, carrying the command it runs. */
function button(label: string, command: PageCommand, options: { args?: unknown; kind?: 'primary' | 'link'; mark?: string } = {}): string {
	const cls = `az-btn${options.kind === 'primary' ? ' az-btn--primary' : options.kind === 'link' ? ' az-btn--link' : ''}`;
	const args = options.args === undefined ? '' : ` data-args="${escapeHtml(JSON.stringify(options.args))}"`;
	const mark = options.mark === undefined ? '' : icon(options.mark);
	return `<button type="button" class="${cls}" data-command="${command}"${args}>${mark}<span>${escapeHtml(label)}</span></button>`;
}

/** `4.2 MB` — the number a person compares. */
function bytes(size: number | undefined): string {
	if (size === undefined) {
		return '';
	}
	if (size < 1024) {
		return `${String(size)} B`;
	}
	if (size < 1024 * 1024) {
		return `${(size / 1024).toFixed(0)} KB`;
	}
	return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/** What a row calls each kind of output. */
const KIND: Record<string, string> = {
	site: 'Website',
	chm: 'offline help',
	pdf: 'pdf',
	page: 'a single page',
	zip: 'site zip',
	docx: 'Word'
};

/** How many pages a project holds, over every version it has. */
function pagesOf(project: SiteProject): number {
	return project.versions.reduce((total, version) => total + version.pages.length, 0);
}

/** The builds newer than what the website holds: those are the ones worth adding. */
function waiting(state: Snapshot): Snapshot['builds'] {
	return state.builds.filter((build) => {
		const project = state.site.projects.find((entry) => entry.id === build.id);
		if (project === undefined) {
			return true;
		}
		const newest = project.versions[0]?.builtAt;
		return newest === undefined || build.at > Date.parse(newest);
	});
}

/** The title block: what this module is, in three sentences, and the two ways in. */
function head(state: Snapshot): string {
	const published = state.published;
	const note =
		published.commit === undefined
			? { text: 'Never published — the website is not on the internet yet', mark: 'clock' }
			: { text: `Last publish ${published.commit} · ${ago(published.at)}`, mark: 'clock', link: { command: 'temcoLearn.openPublished' } };
	return hero({
		eyebrow: 'Temco Learn',
		mark: 'book',
		title: 'Overview',
		desc: 'Temco Learn publishes the documentation website. Every project that writes a documentation build — T3000, BACnet, the SDK — can be put on that website as one of its versions, and the website is what a reader opens. This page says what is on it now, what has been built and not added, and where it is live.',
		descWide: true,
		note,
		actions: [
			{ label: 'Preview the Website', command: 'temcoLearn.preview', mark: 'globe', kind: 'primary' },
			{ label: 'Publish', command: 'temcoLearn.publish', mark: 'upload' }
		]
	});
}

/** The one callout: what to do next, or that there is nothing to do. */
function needsYou(state: Snapshot): string {
	const builds = waiting(state).length;
	const changes = state.published.pending;
	const parts: string[] = [];
	const actions: string[] = [];
	if (builds > 0) {
		parts.push(`${plural(builds, 'build')} on disk ${builds === 1 ? 'is' : 'are'} not on the website`);
		actions.push(button('Add the builds', 'temcoLearn.assemble', { kind: 'primary' }));
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

/** The flow, as three numbered steps with what each one actually does. */
function flow(state: Snapshot): string {
	const builds = waiting(state).length;
	const changes = state.published.pending;
	const steps = optionCards([
		{
			tag: '1',
			mark: 'play',
			title: 'Build a project',
			desc: 'In Temco Docs. Its pages become finished files — a site, an offline help file, often a pdf and a zip.',
			ticks: ['writes dist/site', 'writes the .chm', 'writes the pdf, the zip, Word'],
			label: 'Open Temco Docs',
			command: 'temcoDocs.builds'
		},
		{
			tag: '2',
			mark: 'plus',
			title: 'Add it to the website',
			desc: 'The build becomes a version of a project on the website. The version is the one thing only you know.',
			ticks: ['asks only the version', 'copies the pages in', 'lists them under the project'],
			label: builds === 0 ? 'Add a build' : `Add · ${plural(builds, 'build')} waiting`,
			command: 'temcoLearn.assemble',
			pick: builds > 0
		},
		{
			tag: '3',
			mark: 'upload',
			title: 'Publish the website',
			desc: 'The website, as it is now, goes on the internet. Readers see it a minute later.',
			ticks: ['commits the folder', 'pushes the gh-pages branch', 'prints the address'],
			label: changes === 0 ? 'Publish' : `Publish · ${plural(changes, 'change')}`,
			command: 'temcoLearn.publish'
		}
	]);
	return [
		section({ title: 'The way a page gets to a reader', desc: 'Three steps, in this order.' }),
		steps
	].join('\n');
}

/** The projects a reader can open today, and the way into each one's versions. */
function projects(state: Snapshot): string {
	const rows = state.site.projects.map((project) => {
		const built = project.builtAt === undefined ? [] : [`built ${ago(project.builtAt)}`];
		const meta = [
			sectionTitle(project.section),
			plural(project.versions.length, 'version'),
			`newest ${latestOf(project) ?? 'none'}`,
			plural(pagesOf(project), 'page'),
			...built
		];
		return entryRow({
			title: project.title,
			meta: meta.join(' · '),
			mark: 'book',
			command: 'temcoLearn.preview',
			args: { page: `project.html?id=${encodeURIComponent(project.id)}` },
			go: 'All versions'
		});
	});
	return [
		section({
			title: 'Projects on the website',
			desc: 'Each project keeps its versions; a version is one build, kept so an older release can still be read.',
			actions: button('Open the website', 'temcoLearn.preview')
		}),
		rows.length === 0
			? entryRow({ title: 'Nothing is on the website yet', meta: 'Build a project in Temco Docs, then add the build here.', mark: 'info' })
			: rows.join('\n')
	].join('\n');
}

/** One project's build output: every file it wrote, and the two things you can do with them. */
function producedRow(project: ProjectArtifacts): string {
	const parts = project.artifacts.map((artifact) => {
		const size = bytes(artifact.size);
		return `${KIND[artifact.kind] ?? artifact.label}${size === '' ? '' : ` ${size}`}`;
	});
	const siteArtifact = project.artifacts.find((artifact) => artifact.kind === 'site');
	const look = project.artifacts.find(isPreviewable);
	const file = project.artifacts.filter(isDownloadable)[0];
	const actions = [
		look === undefined ? '' : button('Look at it', 'temcoLearn.previewArtifact', { args: look.file, kind: 'link' }),
		file === undefined
			? button('Show in folder', 'temcoLearn.revealArtifact', { args: siteArtifact?.file ?? project.folder, kind: 'link' })
			: button('Save a copy', 'temcoLearn.downloadArtifact', { args: file.file, kind: 'link' })
	].filter((action) => action !== '').join('<span style="display:inline-block;width:18px"></span>');
	return `<div class="az-entry"><span class="az-entry__icon">${icon('package')}</span><div class="az-entry__main"><span class="az-entry__title">${escapeHtml(project.title)}</span><span class="az-entry__meta">${escapeHtml(parts.join(' · '))}</span></div><span class="az-entry__go">${actions}</span></div>`;
}

/** What every project's last build wrote. */
function produced(state: Snapshot): string {
	return [
		section({
			title: 'What each build wrote',
			desc: 'A build writes more than a website: an offline help file, a pdf, a zip of the site, a Word document.'
		}),
		state.artifacts.length === 0
			? entryRow({ title: 'No build output was found', meta: 'Build a project in Temco Docs, and what it writes appears here.', mark: 'info' })
			: state.artifacts.map(producedRow).join('\n')
	].join('\n');
}

/** Where the website is published, and what the last publish was. */
function where(state: Snapshot): string {
	const published = state.published;
	const at = published.commit === undefined ? 'never published' : `last publish ${published.commit} · ${ago(published.at)}`;
	return [
		section({ title: 'Where it goes' }),
		entryRow({
			title: published.base ?? 'No address yet',
			meta:
				published.base === undefined
					? `The site folder (${siteFolder()}) points at no GitHub repository, so there is nowhere to publish to.`
					: `${published.where ?? 'a GitHub repository'} · branch gh-pages · ${at}`,
			mark: 'repo',
			command: published.base === undefined ? 'temcoLearn.publish' : 'temcoLearn.openPublished',
			go: published.base === undefined ? 'Publish' : 'Open in browser'
		})
	].join('\n');
}

/** The page: what it is, what to do, how it works, what is on it, what was built, and where it goes. */
export function html(state: Snapshot): string {
	return [head(state), needsYou(state), flow(state), projects(state), produced(state), where(state)].join('\n');
}
