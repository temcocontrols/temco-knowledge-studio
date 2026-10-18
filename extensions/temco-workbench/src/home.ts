// The dashboard — the application's own window.
//
//   TOP    identity, and how the application works, in four steps
//   MAIN   one scrolling column: what we have now, how to start now, and what the application can do
//
// A single column, because the rail proved to be a second place to look for the same facts. Nothing here is
// specific to a product: the documents and sources come from the catalog, the folders from what is open, and
// the organisation is a setting rather than a name in the code.

import * as vscode from 'vscode';
import { DocsRoot, collectPages, countStale, totals } from './docs';

import { Catalog, CatalogUnavailable, Selection, slugOf } from './store';
import { HOME_VIEW_TYPE } from './surface';
import { icon, page, pageColumn, toneMark } from './ui';

interface Feature {
  name: string;
  state: 'working';
  detail: string;
}

/** Every feature, and whether it is built. The list is the page's centre, so it is kept honest. */
const FEATURES: Feature[] = [
  {
    name: 'Content view',
    state: 'working',
    detail:
      "Every open project's registry as areas → chapters → pages, the faults marked in the file that has to be fixed, and a Gaps node that gathers them.",
  },
  {
    name: 'Local AI',
    state: 'working',
    detail:
      'An offline model: ask about the open page, Draft update as a diff you accept, Ask the area for an answer that cites real pages. Needs a model downloaded once.',
  },
  {
    name: 'Builds',
    state: 'working',
    detail:
      "The open project's own scripts, invoked as tasks and judged by the artifact they leave behind — never by an exit code, and never by deploying.",
  },
  {
    name: 'Documentation Owed',
    state: 'working',
    detail:
      'What needs attention, grouped by the owner who owes it, with counts rather than lists for pages that were merely never reviewed.',
  },
  {
    name: 'The Catalog',
    state: 'working',
    detail:
      'The application’s memory: one SQLite database on this machine for sources, documents, builds and what changed. Never in a repository, never committed.',
  },
  {
    name: 'Projects',
    state: 'working',
    detail:
      'Create a project — the thing you manage and version — and give it sources: a repository at a branch you choose, a folder on this machine, or an archive.',
  },
  {
    name: 'Start a Registry',
    state: 'working',
    detail:
      'Creates the smallest valid registry in a folder you have open, on a confirmation, and leaves filling it to that project’s own generator.',
  },
];

const STEPS: [string, string][] = [
  ['Read', 'a source where it lives — a repository at a branch you choose, a folder, an archive'],
  ['Remember', 'what it found goes into one local catalog: what exists, what changed, what is owed'],
  ['Build', 'a project cites its sources, declares its outputs, and leaves an artifact: CHM, PDF, site'],
  ['Review', 'the model drafts, a person approves — nothing is published on its own'],
];

export class HomePanel {
  private panel: vscode.WebviewPanel | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly selection: Selection,
    private readonly roots: () => readonly DocsRoot[]
  ) { }

  /** Opens the page, or brings it forward if it is already open. One instance, always. */
  open(): void {
    if (this.panel) {
      this.panel.reveal(pageColumn());
      this.render();
      return;
    }
    this.panel = vscode.window.createWebviewPanel(HOME_VIEW_TYPE, 'Temco Docs', pageColumn(), {
      enableScripts: false,
      // A link is how this page runs a command: `command:` needs the host's permission, and it is the one thing
      // the page asks for.
      enableCommandUris: true,
      localResourceRoots: [],
    });
    this.panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'docs.svg');
    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
    this.render();
  }

  /** Re-renders if the page is open. Called by the refresh path, so the page follows the workspace. */
  refresh(): void {
    if (this.panel) {
      this.render();
    }
  }

  private render(): void {
    const panel = this.panel;
    if (!panel) {
      return;
    }
    void this.compose().then(
      (html) => {
        if (this.panel === panel) {
          panel.webview.html = html;
        }
      },
      (error: unknown) => {
        if (this.panel === panel) {
          panel.webview.html = page(
            `<h1 class="page-head__title">Temco Docs</h1><p class="bad">The dashboard could not be rendered: ${escapeHtml(
              String(error)
            )}</p>`,
            { title: 'Temco Docs' }
          );
        }
      }
    );
  }

  private async compose(): Promise<string> {
    const roots = this.roots();
    const sums = totals(roots);

    let catalog: Catalog | undefined;
    let unavailable: string | undefined;
    try {
      catalog = await Catalog.open(this.context);
    } catch (error) {
      unavailable = error instanceof CatalogUnavailable ? error.message : String(error);
    }

    const counts = catalog?.counts() ?? [];
    const recorded = counts.reduce((total, [, n]) => total + n, 0);
    const unseen = catalog?.unseenEvents() ?? 0;
    const documents = catalog?.documents() ?? [];
    const sources = catalog?.sources() ?? [];
    const catalogPath = catalog?.file.fsPath ?? '';
    const schema = catalog?.schemaVersion() ?? 0;
    catalog?.close();

    const settings = vscode.workspace.getConfiguration('temcoRepositories');
    const organisation = (settings.get<string>('organisation', 'temcocontrols') || 'temcocontrols').trim();

    const working = FEATURES.filter((feature) => feature.state === 'working');

    /** One feature, as a card on the page's own grid. */
    const card = (feature: Feature): string =>
      `<div class="card">
	<div class="card__head"><div class="card__title">${escapeHtml(feature.name)}</div><div class="card__actions"><span class="badge badge--ok">working</span></div></div>
	<p class="card__desc">${escapeHtml(feature.detail)}</p>
</div>`;

    /** One fact with its label, for the strip under the head. */
    const fact = (label: string, value: string): string =>
      `<div><div class="settings-strip__label">${escapeHtml(label)}</div><div class="settings-strip__value">${value}</div></div>`;

    /** A source being read: its name, what it contributed, and the worst thing wrong with it. */
    const sourceRow = (root: DocsRoot): string => {
      const stale = countStale(collectPages(root));
      const facts = [
        `${root.pages} pages`,
        `${root.errors} errors`,
        `${root.warnings} warnings`,
        `${root.neverReviewed} never reviewed`
      ];
      if (stale > 0) {
        facts.push(`${stale} stale`);
      }
      const state = root.errors > 0
        ? '<span class="badge badge--err">errors</span>'
        : root.warnings > 0
          ? '<span class="badge badge--warn">warnings</span>'
          : '<span class="badge badge--ok">clean</span>';
      return `<div class="record-row record-row--static">
	${toneMark('folder', root.errors > 0 ? 'err' : root.warnings > 0 ? 'warn' : undefined)}
	<div class="record-row__main">
		<div class="record-row__title"><span class="record-row__name">${escapeHtml(root.folder.name)}</span></div>
		<div class="record-row__meta">${facts.map((entry, index) => `<span>${escapeHtml(entry)}${index < facts.length - 1 ? ' ·' : ''}</span>`).join(' ')}</div>
	</div>
	<div class="record-row__state">${state}</div>
	<span class="record-row__go"></span>
</div>`;
    };

    /** One of the four things to do first, as a row that runs it. */
    const stepRow = (mark: string, title: string, note: string, command: string): string =>
      `<div class="record-row" data-command="${command}">
	${toneMark(mark, 'accent')}
	<div class="record-row__main">
		<div class="record-row__title"><span class="record-row__name">${escapeHtml(title)}</span></div>
		<div class="record-row__meta"><span>${escapeHtml(note)}</span></div>
	</div>
	<div class="record-row__state"></div>
	<span class="record-row__go">›</span>
</div>`;

    // What is being read, and what it is read *from*: with a project selected the answer is the project's
    // sources, not the window's folders — the same one world the Workspace view shows.
    const project = this.selection.project();
    const projectName = project === undefined ? undefined : documents.find((row) => slugOf(row.name) === project)?.name;
    // With no project being worked on nothing is read at all, so the page says so rather than counting folders
    // it is not reading.
    const reading =
      projectName ??
      (roots.length === 0
        ? 'nothing — no project is being worked on'
        : roots.length === 1
          ? roots[0].folder.name
          : `${roots.length} sources`);

    const body = `
<div class="page-head">
	<div class="page-head__main">
		<h1 class="page-head__title">${icon('document')}Temco Docs</h1>
		<p class="page-head__desc">Reads every project’s documentation where it already lives, keeps what it finds in one local catalog, and builds the documents that ship.</p>
	</div>
	<div class="page-head__actions">
		<a class="btn btn--primary" href="command:temcoProjects.newProject"><span>Create a Project</span></a>
		<a class="btn" href="command:temcoWorkbench.openNeeds"><span>What Needs Doing</span></a>
	</div>
</div>

<div class="settings-strip settings-strip--wide">
	${fact('Working on', escapeHtml(reading))}
	${fact('Pages', String(sums.pages))}
	${fact('Projects', String(documents.length))}
	${fact('Sources', String(sources.length))}
	${fact('Issues', String(sums.issues))}
	${fact('Unseen changes', String(unseen))}
</div>

<div class="mt-24">
	<div class="group-head">
		<span class="group-head__label">How It Works</span>
		<span class="group-head__rule"></span>
		<span class="group-head__count">four steps</span>
	</div>
	<div class="grid grid--4 mt-16">
		${STEPS.map(([label, detail]) => `<div class="card"><div class="card__head"><div class="card__title">${escapeHtml(label)}</div></div><p class="card__desc">${escapeHtml(detail)}</p></div>`).join('')}
	</div>
</div>

<div class="mt-24">
	<div class="group-head">
		<span class="group-head__label">Sources Being Read</span>
		<span class="group-head__rule"></span>
		<span class="group-head__count">${roots.length === 1 ? '1 source' : `${roots.length} sources`}</span>
	</div>
	${roots.length === 0
        ? `<p class="group-note">${escapeHtml(
          projectName !== undefined
            ? `${projectName} has no source that can be read yet — add one from the Library or the project's own page, then read it.`
            : 'Nothing is being read: no project is being worked on. Pick one in the Library — the Workspace view follows the project, never the folders this window happens to have open.'
        )}</p>`
        : `<div class="record-list">${roots.map(sourceRow).join('')}</div>`
      }
	<p class="group-note">Kept in one SQLite database on this machine — never in a repository, never committed, ${counts.length} tables at schema ${schema}${unavailable === undefined ? '' : `: ${escapeHtml(unavailable)}`}.${recorded === 0 ? ' Empty so far.' : ''} <span class="cell-mono">${escapeHtml(catalogPath)}</span></p>
</div>

<div class="mt-24">
	<div class="group-head">
		<span class="group-head__label">How to Start Now</span>
		<span class="group-head__rule"></span>
		<span class="group-head__count">nothing has to be built first</span>
	</div>
	<div class="record-list">
		${stepRow('plus', 'Create a project', 'name it, give it a version and an owner — the + on the Library title bar', 'temcoProjects.newProject')}
		${stepRow('repo', 'Give it a source', 'a repository at a branch you choose, a folder on this machine, or an archive', 'temcoProjects.addSource')}
		${stepRow('play', 'Read it, then build it', 'a read fills the catalog; a build leaves a CHM, a PDF or a site', 'temcoProjects.buildProject')}
	</div>
	<p class="group-note">Nothing has to exist first. A project can be created before its sources are settled: the application records what it found and says what is still missing. Where the documentation lives is <span class="cell-mono">github.com/${escapeHtml(organisation)}</span> — next to the code, in each project's own <span class="cell-mono">docs/</span> folder.</p>
</div>

<div class="mt-24">
	<div class="group-head">
		<span class="group-head__label">What This Application Can Do</span>
		<span class="group-head__rule"></span>
		<span class="group-head__count">${working.length} features</span>
	</div>
	<div class="grid grid--3 mt-16">${working.map(card).join('')}</div>
</div>`;

    return page(body, { title: 'Temco Docs' });
  }
}

/** Folder names and page text come from the workspace, so everything interpolated is escaped. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
