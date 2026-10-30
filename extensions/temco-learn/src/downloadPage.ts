// Downloads — the page behind "No file to take", and behind the Download view's title bar.
//
// A build writes five things, and a folder with none of them is not a fault: it is a project nobody has built yet. This
// page says what a build writes, where each kind lands, and — when the workspace has files — which ones.

import * as vscode from 'vscode';
import { Artifact, formatSize, nameOf, ProjectArtifacts } from './artifacts';
import { workRoot } from './site';
import { callout, cards, commandScript, entryRow, escapeHtml, hero, icon, page, pageColumn, runCommand, section } from './ui';

export const DOWNLOAD_VIEW_TYPE = 'temcoLearn.downloads';

/** Everything the page says: the files found, and where a build puts them. */
export interface DownloadFacts {
	projects: readonly ProjectArtifacts[];
	root: string;
}

export class DownloadPage implements vscode.Disposable {
	private opened: vscode.WebviewPanel | undefined;

	constructor(private readonly read: () => Promise<DownloadFacts>) { }

	open(): void {
		if (this.opened !== undefined) {
			this.opened.reveal(pageColumn());
			void this.render();
			return;
		}
		this.opened = vscode.window.createWebviewPanel(DOWNLOAD_VIEW_TYPE, 'Downloads', pageColumn(), {
			enableScripts: true,
			localResourceRoots: []
		});
		this.opened.iconPath = new vscode.ThemeIcon('cloud-download');
		this.opened.onDidDispose(() => {
			this.opened = undefined;
		});
		this.opened.webview.onDidReceiveMessage(runCommand);
		void this.render();
	}

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
		opened.webview.html = page(html(await this.read()), { title: 'Downloads', script: commandScript });
	}
}

const plural = (count: number, one: string): string => `${count} ${count === 1 ? one : `${one}s`}`;

/** The five things a build writes, and where each one lands. */
function kinds(): string {
	return cards([
		{
			title: 'The website',
			desc: 'A folder of pages — the same one the preview serves, and the one a version on the site is made from.',
			mark: 'globe'
		},
		{ title: 'Offline help', desc: 'A .chm a person can open on a machine with no network, beside the project or in HelpDocs.', mark: 'book' },
		{ title: 'A pdf', desc: 'The same pages as one file, for printing and for sending to somebody.', mark: 'document' },
		{ title: 'An archive', desc: 'A zip of the site, which is what usually gets attached to a release.', mark: 'package' },
		{ title: 'A Word document', desc: 'The export a reviewer marks up, when the project asks for one.', mark: 'file' }
	]);
}

/** The places a build writes into: the project, its dist, and the shared help folder. */
function places(root: string): string {
	const cell = (title: string, value: string, mark: string): string =>
		`<div class="az-fact"><span class="az-fact__title">${icon(mark, 'icon--sm')}${escapeHtml(title)}</span><span class="az-fact__value az-fact__value--mono">${escapeHtml(
			value
		)}</span></div>`;
	return `<div class="az-facts">${cell('Working area', root, 'folder')}${cell('What a build writes', "<project>/dist", 'repo')}${cell(
		'Offline help',
		'HelpDocs, beside the project',
		'book'
	)}</div>`;
}

export function html(state: DownloadFacts): string {
	const files = state.projects.reduce((total, project) => total + project.artifacts.length, 0);
	const rows = state.projects.flatMap((project) => project.artifacts.map((artifact: Artifact) => entryRow({ title: nameOf(artifact), meta: formatSize(artifact.size) || project.title, mark: artifact.kind === 'site' ? 'globe' : 'document', command: 'temcoLearn.downloadArtifact', args: artifact.file, go: 'Save a copy' })));

	const empty = callout({
		title: 'No file to take yet',
		desc: 'Nothing in the working area looks like a build output. Build a project in Temco Docs — the files appear here the moment the build finishes, without anything being added to the site.',
		mark: 'info',
		actions: '<button type="button" class="az-btn az-btn--primary" data-command="temcoDocs.builds"><span>Open Temco Docs</span></button>'
	});

	return [
		hero({
			eyebrow: 'Temco Learn',
			mark: 'download',
			title: 'Downloads',
			desc: `A build writes more than a website: ${plural(files, 'file')} across ${plural(state.projects.length, 'project')} are on this machine now. This page says what a build writes, where it lands, and which files are there.`,
			descWide: true
		}),
		files === 0 ? empty : '',
		section({ title: 'What a build writes' }),
		kinds(),
		section({ title: 'Where it lands' }),
		places(state.root),
		files === 0 ? '' : section({ title: 'The files on this machine', desc: 'Save a copy puts one wherever you choose.' }),
		rows.length === 0 ? '' : `<div class="az-entries">${rows.join('')}</div>`,
		`<div class="az-block__foot"><button type="button" class="az-btn az-btn--link" data-command="temcoLearn.revealArtifact" data-args="${escapeHtml(
			JSON.stringify(workRoot())
		)}">${icon('folder')}<span>Show in the folder</span>${icon('chevron-right', 'icon--sm')}</button></div>`
	]
		.filter((part) => part !== '')
		.join('\n');
}
