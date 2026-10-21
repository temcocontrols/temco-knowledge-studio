// The organisations this window asks GitHub about, and the repositories they hold, as a page.
//
// This is the platform's front door for repositories: the default enterprise is written on first use, a person
// adds their own enterprise or a single repository's address, and the selected one's repositories are listed —
// held in the catalog, so a refused read costs a warning rather than an empty page.
//
// The Library's *Sources* row lists what has already been read. This is the step before it: what an enterprise has,
// which of them the project being worked on already cites, and the buttons that **start** a repository (add it as
// a source of that project and read its registry) or fetch a local copy of it.
//
// Nothing here writes to a repository. A source is a row in the catalog on this machine, and reading one is
// `read.ts`'s job — the same command the Library uses, so the output and the notes are the same too.

import * as vscode from 'vscode';
import { Catalog, OrganisationRow, RepositoryCacheRow, Selection, slugOf } from './store';
import { REPOSITORIES_VIEW_TYPE } from './surface';
import { page, pageColumn } from './ui';
import { listRepositories } from './repository';
import { cloneSize, hasClone } from './workarea';

/** The enterprise the platform ships its own documentation from — written as the first organisation. */
const DEFAULT_ORGANISATION = 'temcocontrols';

interface RepositoriesMessage {
  type?: string;
  name?: string;
  url?: string;
  text?: string;
  /** A command the page asks for by id — the token prompt, so a refusal can be answered where it is read. */
  command?: string;
  /** The act a selection asks for — the same acts a single row offers, applied to every name. */
  action?: 'start' | 'fetch' | 'pull' | 'removeClone' | 'project';
  names?: string[];
  /** The organisation whose list is wanted — the strip at the top of the page. */
  slug?: string;
}

/** The organisation the page opens on: a setting, with the default the platform was built for. */
function defaultOrganisation(): string {
  const configured = vscode.workspace.getConfiguration('temcoRepositories').get<string>('organisation');
  return configured !== undefined && configured.trim().length > 0 ? configured.trim() : DEFAULT_ORGANISATION;
}

/**
 * What a typed name means.
 *
 * One field adds either of the two things a person actually has: the name of an enterprise or an account, or the
 * address of one repository. The shape decides — an address has an owner *and* a repository in it — so nobody has
 * to pick a kind before typing.
 */
function typedName(text: string): { kind: 'organisation' | 'repository'; name: string; url?: string } | undefined {
  const clean = text.trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/^github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/[\/]+$/, '');
  if (clean.length === 0 || /\s/.test(clean)) {
    return undefined;
  }
  const parts = clean.split('/').filter((part) => part.length > 0);
  if (parts.length === 1) {
    return { kind: 'organisation', name: parts[0] };
  }
  if (parts.length === 2) {
    const [owner, repository] = parts;
    return { kind: 'repository', name: `${owner}/${repository}`, url: `https://github.com/${owner}/${repository}` };
  }
  return undefined;
}

export class RepositoriesPage {
  private panel: vscode.WebviewPanel | undefined;
  /** The list the selected organisation last answered with, so a click does not mean a second round trip. */
  private listed: RepositoryCacheRow[] = [];
  /** The organisation the page is showing — what `start`, `fetch` and `pull` act on. */
  private showing: string | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly selection: Selection,
    private readonly refresh: () => void
  ) { }

  /** Opens the page, or brings it forward if it is already open. One instance, always. */
  open(): void {
    if (this.panel) {
      this.panel.reveal(pageColumn());
      void this.render();
      return;
    }
    this.panel = vscode.window.createWebviewPanel(REPOSITORIES_VIEW_TYPE, 'Repositories', pageColumn(), {
      enableScripts: true,
      localResourceRoots: [],
    });
    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
    this.panel.webview.onDidReceiveMessage((message: RepositoriesMessage) => void this.receive(message));
    void this.render();
  }

  dispose(): void {
    this.panel?.dispose();
  }

  private async render(): Promise<void> {
    const panel = this.panel;
    if (!panel) {
      return;
    }
    panel.webview.html = html();
    await this.send();
  }

  /**
   * The page, in two messages: what is held now, then what GitHub answers.
   *
   * The held list goes out first so the page paints at once — a dashboard that waits for the network is a blank
   * screen on a rate-limited machine. The read follows and replaces it; a refusal follows as the same list with
   * the reason attached.
   */
  private async send(slug?: string): Promise<void> {
    const panel = this.panel;
    if (!panel) {
      return;
    }
    const project = this.selection.project();
    const cited = project === undefined ? [] : await this.cited(project);

    let catalog: Catalog | undefined;
    try {
      catalog = await Catalog.open(this.context);
    } catch (error) {
      await panel.webview.postMessage({
        type: 'seed',
        error: `The platform database could not be opened, so there is no list to show. ${error instanceof Error ? error.message : String(error)}`,
      });
      return;
    }

    try {
      // The default enterprise is written on first use: the front door is never an empty form.
      if (catalog.organisations().length === 0) {
        catalog.addOrganisation({
          kind: 'organisation',
          name: defaultOrganisation(),
          slug: slugOf(defaultOrganisation()),
        });
      }
      const organisations = catalog.organisations();
      const org = organisations.find((row) => row.slug === (slug ?? this.showing)) ?? organisations[0];
      this.showing = org.slug;
      this.listed = catalog.repositoriesOf(org.slug);
      await panel.webview.postMessage(await this.seed(organisations, org, this.listed, cited, project));

      // One repository named by its address is its own answer; an enterprise has to be asked.
      if (org.kind === 'repository') {
        return;
      }
      const result = await listRepositories(this.context, org.name);
      if ('error' in result) {
        catalog.recordOrganisationRead(org.slug, 'refused');
        await panel.webview.postMessage({
          ...(await this.seed(catalog.organisations(), org, this.listed, cited, project)),
          warning: result.error,
        });
        return;
      }
      this.listed = result.repositories;
      catalog.replaceRepositories(org.slug, result.repositories);
      catalog.recordOrganisationRead(org.slug, 'read');
      const renamed = catalog.organisations().find((row) => row.slug === org.slug) ?? org;
      await panel.webview.postMessage({
        ...(await this.seed(catalog.organisations(), renamed, this.listed, cited, project)),
        truncated: result.truncated,
      });
    } finally {
      catalog.close();
    }
  }

  /** Everything the page draws for one organisation: the strip, its list, the clones, and who cites what. */
  private async seed(
    organisations: readonly OrganisationRow[],
    org: OrganisationRow,
    repositories: readonly RepositoryCacheRow[],
    cited: readonly string[],
    project: string | undefined
  ): Promise<Record<string, unknown>> {
    return {
      type: 'seed',
      org: org.slug,
      organisations,
      project,
      cited,
      takenAt: org.lastRead,
      state: org.state,
      copies: await this.clones(repositories, project),
      repositories,
    };
  }

  /** Which of the rows already have a local copy, so the page offers *Fetch* or *Pull* rather than both. */
  private async clones(
    rows: readonly RepositoryCacheRow[],
    project: string | undefined
  ): Promise<Record<string, string | undefined>> {
    const copies: Record<string, string | undefined> = {};
    if (project === undefined) {
      return copies;
    }
    for (const row of rows) {
      if (await hasClone(project, row.name)) {
        copies[row.name] = (await cloneSize(project, row.name)) ?? '';
      }
    }
    return copies;
  }

  /** What the project being worked on already cites, by name — the names are what a repository is matched on. */
  private async cited(project: string): Promise<string[]> {
    let catalog: Catalog | undefined;
    try {
      catalog = await Catalog.open(this.context);
      return catalog.documentSources(project).map((source) => source.name);
    } catch {
      return [];
    } finally {
      catalog?.close();
    }
  }

  private async receive(message: RepositoriesMessage): Promise<void> {
    switch (message.type) {
      case 'start':
        await this.start(message.name ?? '');
        return;
      case 'fetch':
        // Fetching a repository that was never started makes it a source first: a clone belongs to a source.
        await this.cite(message.name ?? '');
        await vscode.commands.executeCommand('temcoRepositories.fetchSource', slugOf(message.name ?? ''));
        await this.send();
        return;
      case 'pull':
        await vscode.commands.executeCommand('temcoRepositories.pullSource', slugOf(message.name ?? ''));
        await this.send();
        return;
      case 'open':
        if (message.url !== undefined) {
          await vscode.env.openExternal(vscode.Uri.parse(message.url));
        }
        return;
      case 'project': {
        // A project started *from* a repository: the projects module records it as the project's source itself, so
        // this only hands over the row's own facts.
        const row = this.listed.find((candidate) => candidate.name === (message.name ?? ''));
        try {
          await vscode.commands.executeCommand(
            'temcoProjects.newProjectFromRepository',
            message.name,
            row?.cloneUrl,
            row?.defaultBranch
          );
        } catch {
          void vscode.window.showInformationMessage(
            'Temco Repositories: the projects module is not installed, so there is nothing to create a project with.'
          );
        }
        return;
      }
      case 'openClone':
        await vscode.commands.executeCommand('temcoRepositories.openClone', slugOf(message.name ?? ''));
        return;
      case 'removeClone':
        await vscode.commands.executeCommand('temcoRepositories.removeClone', slugOf(message.name ?? ''));
        await this.send();
        return;
      case 'bulk':
        await this.bulk(message.action, message.names ?? []);
        return;
      case 'copy':
        await vscode.env.clipboard.writeText(message.text ?? '');
        return;
      case 'read':
        // Choosing another organisation in the strip: its held list is drawn at once, then asked for again.
        await this.send(message.slug);
        return;
      case 'add':
        await this.addOrganisation(message.text ?? '');
        return;
      case 'forget':
        await this.forgetOrganisation(message.slug ?? '');
        return;
      case 'reload':
        await this.send();
        return;
      case 'command':
        if (typeof message.command === 'string') {
          await vscode.commands.executeCommand(message.command);
          await this.send();
        }
        return;
      default:
        return;
    }
  }

  /**
   * Adds an enterprise, an account, or one repository — whichever the typed text turns out to be.
   *
   * A single repository is written as its own organisation of kind `repository`, with the one row its address
   * already answers: there is no list to ask for, so it works offline and costs no allowance.
   */
  private async addOrganisation(text: string): Promise<void> {
    const typed = typedName(text);
    if (typed === undefined) {
      await this.panel?.webview.postMessage({
        type: 'refused',
        error: 'Type an enterprise or account name such as temcocontrols, or one repository address such as github.com/temcocontrols/t3000webview.',
      });
      return;
    }
    const slug = slugOf(typed.name);
    let catalog: Catalog | undefined;
    try {
      catalog = await Catalog.open(this.context);
      catalog.addOrganisation({ kind: typed.kind, name: typed.name, slug, url: typed.url });
      if (typed.kind === 'repository') {
        const [owner, repository] = typed.name.split('/');
        catalog.replaceRepositories(slug, [
          {
            name: repository,
            fullName: typed.name,
            isPrivate: false,
            webUrl: `https://github.com/${owner}/${repository}`,
            cloneUrl: `https://github.com/${owner}/${repository}.git`,
          },
        ]);
        catalog.recordOrganisationRead(slug, 'named');
      }
    } catch (error) {
      await this.panel?.webview.postMessage({
        type: 'refused',
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    } finally {
      catalog?.close();
    }
    this.refresh();
    await this.send(slug);
  }

  /** Forgets an organisation and its held list. A source it named is untouched: that is a project's business. */
  private async forgetOrganisation(slug: string): Promise<void> {
    if (slug.length === 0) {
      return;
    }
    let catalog: Catalog | undefined;
    try {
      catalog = await Catalog.open(this.context);
      catalog.removeOrganisation(slug);
    } catch {
      // Nothing to forget.
    } finally {
      catalog?.close();
    }
    if (this.showing === slug) {
      this.showing = undefined;
    }
    this.refresh();
    await this.send();
  }

  /**
   * The acts a row offers, applied to a selection. Sequential on purpose: a clone and a read both talk to the
   * same disk and the same API, and the person asked for one list of work rather than a race between them.
   */
  private async bulk(action: RepositoriesMessage['action'], names: string[]): Promise<void> {
    if (action === undefined || names.length === 0) {
      return;
    }
    // Starting needs a project; the single-row act already says so, so it is said once rather than per name.
    if (action === 'start' && this.selection.project() === undefined) {
      await this.start(names[0]);
      return;
    }
    for (const name of names) {
      switch (action) {
        case 'start':
          await this.start(name);
          break;
        case 'fetch':
          // Fetching a repository that was never started makes it a source first: a clone belongs to a source.
          await this.cite(name);
          await vscode.commands.executeCommand('temcoRepositories.fetchSource', slugOf(name));
          break;
        case 'pull':
          await vscode.commands.executeCommand('temcoRepositories.pullSource', slugOf(name));
          break;
        case 'removeClone':
          await vscode.commands.executeCommand('temcoRepositories.removeClone', slugOf(name));
          break;
        case 'project':
          // Absent from the selection bar on purpose: a selection is what to *do to* these repositories, and a
          // project is one repository's own beginning.
          break;
      }
    }
    this.refresh();
    await this.send();
  }

  /** Records a repository as a source of the project being worked on, without reading it. */
  private async cite(name: string): Promise<void> {
    const row = this.listed.find((candidate) => candidate.name === name);
    const project = this.selection.project();
    if (row === undefined || project === undefined) {
      return;
    }
    let catalog: Catalog | undefined;
    try {
      catalog = await Catalog.open(this.context);
      const slug = slugOf(row.name);
      catalog.addSource({
        kind: 'git',
        name: row.name,
        slug,
        remoteUrl: row.cloneUrl,
        defaultBranch: row.defaultBranch,
      });
      const cited = catalog.documentSourceSlugs(project);
      catalog.setDocumentSources(project, [...new Set([...cited, slug])]);
    } catch {
      // The commands that follow report their own refusals; this only records the coordinates.
    } finally {
      catalog?.close();
    }
  }

  /**
   * Start a repository: cite it in the project being worked on, then read it.
   *
   * The cite is what makes it part of the project; the read is what puts its pages in the Workspace view. Both
   * are the acts the hub already performs, reached from the other end — a list instead of a form.
   */
  private async start(name: string): Promise<void> {
    const row = this.listed.find((candidate) => candidate.name === name);
    const project = this.selection.project();
    if (row === undefined) {
      return;
    }
    if (project === undefined) {
      void vscode.window.showInformationMessage(
        'Temco Repositories: a source belongs to a project being worked on. Choose one first — the Library’s Projects row.',
        'Projects'
      ).then((answer) => {
        if (answer === 'Projects') {
          void vscode.commands.executeCommand('temcoDocs.openProjects');
        }
      });
      return;
    }

    let catalog: Catalog | undefined;
    try {
      catalog = await Catalog.open(this.context);
      const slug = slugOf(row.name);
      catalog.addSource({
        kind: 'git',
        name: row.name,
        slug,
        remoteUrl: row.cloneUrl,
        defaultBranch: row.defaultBranch,
      });
      // The whole list, not the addition: this only ever adds, but the act is "this project cites these".
      const cited = catalog.documentSourceSlugs(project);
      catalog.setDocumentSources(project, [...new Set([...cited, slug])]);
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Temco Repositories: ${error instanceof Error ? error.message : String(error)}`
      );
      return;
    } finally {
      catalog?.close();
    }

    this.refresh();
    await this.send();
    // The read reports itself in the output channel, so nothing is said here about what it found.
    await vscode.commands.executeCommand('temcoRepositories.readSource', slugOf(row.name));
  }
}

function html(): string {
  const style = `
    /* A dashboard, not a document: the strip of enterprises comes first, the list is the body, the help is the
       foot. No boxes anywhere — a fill, a hairline and spacing carry the hierarchy. */
    .strip { display: flex; gap: .4em; flex-wrap: wrap; align-items: center; margin: 1em 0 0; }

    /* An enterprise is a chip: its name, how many it holds, and a way to forget it. The selected one is filled
       with the accent tint rather than outlined, so the strip reads as one control and not as a table. */
    .org { display: inline-flex; align-items: baseline; gap: .45em; padding: .38em .7em;
           border: 0; border-radius: var(--radius); background: var(--bg-inset); color: var(--fg);
           font: inherit; font-size: var(--fs-sm); cursor: pointer; }
    .org:hover { background: var(--bg-hover); }
    .org.is-on { background: color-mix(in srgb, var(--accent) 18%, var(--bg-inset)); color: var(--fg-strong); font-weight: 600; }
    .org__n { color: var(--fg-muted); font-size: var(--fs-xs); font-variant-numeric: tabular-nums; }
    .org__x { color: var(--fg-subtle); padding: 0 .1em; }
    .org__x:hover { color: var(--err); }

    .adder { display: flex; gap: .5em; flex-wrap: wrap; align-items: center; margin: .8em 0 0; }
    .adder[hidden] { display: none; }
    .adder .input { flex: 1 1 22em; max-width: 46em; }
    .adder__note { flex-basis: 100%; margin: 0; color: var(--fg-subtle); font-size: var(--fs-xs); }

    .stats { display: flex; gap: .45em; flex-wrap: wrap; margin: .9em 0 0; color: var(--fg-muted); font-size: var(--fs-sm); }
    .stats b { color: var(--fg-strong); font-weight: 600; }

    .toolbar { display: flex; gap: .6em; align-items: center; flex-wrap: wrap; margin: 1em 0 .2em; }
    .toolbar input { flex: 1 1 18em; min-width: 10em; }

    /* A selection bar is an answer to a tick, not a permanent second toolbar. */
    .selection { display: flex; gap: .6em; align-items: center; flex-wrap: wrap; margin: .7em 0 0; }
    .selection .count { font-weight: 600; }
    .selection[hidden] { display: none; }

    .rows { margin: .6em 0 0; }

    /* A row, not a card: no border, no radius, no fill until it is hovered or selected. */
    .row { display: grid; grid-template-columns: 1.4em minmax(0, 1fr) auto; gap: 0 .7em;
           align-items: start; padding: .65em .4em; border-bottom: 1px solid var(--border); }
    .row:last-child { border-bottom: 0; }
    .row:hover { background: var(--bg-hover); }
    .row.is-selected { background: color-mix(in srgb, var(--accent) 8%, transparent); }
    .row input[type=checkbox] { margin: .3em 0 0; }
    .row .top { display: flex; gap: .7em; align-items: baseline; flex-wrap: wrap; }
    .row .name { font-weight: 600; color: var(--fg-strong); }
    .row .cited { color: var(--ok); font-size: var(--fs-sm); white-space: nowrap; }
    .row .facts { color: var(--fg-muted); font-size: var(--fs-sm); }
    .row .desc { margin: .1em 0 0; color: var(--fg-muted); font-size: var(--fs-sm); overflow-wrap: anywhere; }
    .row .do { display: flex; gap: .35em; flex-wrap: wrap; justify-content: flex-end; }

    .warn { border-radius: var(--radius); padding: .8em 1em; background: var(--bg-inset); margin: 1em 0; }
    .warn p { margin: 0; color: var(--fg); }
    .warn .do { display: flex; gap: .5em; margin: .7em 0 0; }
    .empty { color: var(--fg-muted); padding: 1em 0; }

    /* How the page works, numbered: five acts, in the order a person performs them. */
    .how { margin: 2em 0 0; max-width: 82ch; }
    .how h2 { font-size: var(--fs-ui); font-weight: 600; color: var(--fg-strong); margin: 0 0 .5em; }
    .how ol { margin: 0; padding-left: 1.3em; display: flex; flex-direction: column; gap: .5em;
              color: var(--fg-muted); font-size: var(--fs-sm); line-height: 1.55; }
    .how li::marker { color: var(--accent); font-weight: 600; }
    .how b { color: var(--fg); font-weight: 600; }
    .how .settings { margin: .9em 0 0; font-size: var(--fs-xs); color: var(--fg-subtle); }
  `;

  const body = `
  <div class="page-head">
    <div class="page-head__main">
      <h1 class="page-head__title" id="title">Repositories</h1>
      <p class="page-head__desc" id="lede">Reading the organisation from GitHub…</p>
    </div>
    <div class="page-head__actions">
      <button type="button" class="btn" id="add-toggle">Add an enterprise</button>
      <button type="button" class="btn btn--primary" id="reload">Read GitHub again</button>
    </div>
  </div>

  <form class="adder" hidden id="adder">
    <input class="input" id="adder-text" aria-label="Enterprise or repository"
      placeholder="temcocontrols — or one repository: github.com/temcocontrols/t3000webview">
    <button type="submit" class="btn btn--primary" id="adder-add">Add</button>
    <button type="button" class="btn btn--ghost" id="adder-cancel">Cancel</button>
    <p class="adder__note">An enterprise or an account is listed with everything it publishes. A repository address is
      listed on its own — no list to read, so it works without GitHub answering.</p>
  </form>

  <div class="strip" id="strip"></div>
  <div class="stats" id="stats"></div>
  <div id="error"></div>

  <div class="toolbar" hidden id="bar">
    <input class="input" type="search" id="filter" placeholder="Filter by name, description or language" aria-label="Filter">
    <span id="count" class="cell-muted"></span>
  </div>

  <div class="selection" hidden id="selection">
    <span class="count" id="selection-count">0 selected</span>
    <button type="button" class="btn btn--sm btn--primary" id="bulk-start">Start</button>
    <button type="button" class="btn btn--sm" id="bulk-fetch">Fetch the local copy</button>
    <button type="button" class="btn btn--sm" id="bulk-pull">Pull</button>
    <button type="button" class="btn btn--sm" id="bulk-remove">Remove the local copy</button>
    <button type="button" class="btn btn--sm btn--ghost" id="bulk-clear">Clear</button>
  </div>

  <div class="rows" id="list"></div>

  <section class="how">
    <h2>How this page works</h2>
    <ol>
      <li><b>Add an enterprise</b> — <code>temcocontrols</code> is already here — or one repository's address. What an
        enterprise holds is kept in the platform database, so this page still lists it when GitHub will not answer.</li>
      <li><b>Start</b> adds the repository as a source of the project being worked on, then reads its own
        <code>docs/help/registry.json</code> over the API. Nothing is cloned, and nothing is written to the
        repository.</li>
      <li><b>Project</b> opens a new project <em>from</em> this repository: it is cited as the source, its own
        documentation and classes are listed to pick from, and the AI can draft the first page from what you picked.</li>
      <li><b>Fetch the local copy</b> clones one branch, with full history, into the working area. That copy is what
        lets a draft, the AI and its citations read the files and the history behind them.</li>
      <li><b>Pull</b> freshens that copy when the repository has moved on. <b>Remove the local copy</b> deletes the
        copy only — the repository is never written to and never pushed to.</li>
      <li>A private repository needs a token: <b>Set a GitHub Token</b>, from the warning above or the palette.</li>
    </ol>
    <p class="settings">Default enterprise <code>temcoRepositories.organisation</code> · working area
      <code>temcoRepositories.workspaceFolder</code></p>
  </section>
  `;

  return page(body, { title: 'Temco Repositories', extraCss: style, script: CLIENT });
}

const CLIENT = `
const vscode = acquireVsCodeApi();
const $ = (id) => document.getElementById(id);
let organisations = [];
let current;
let repositories = [];
let cited = [];
let copies = {};
let takenAt;
let state;
const selected = new Set();

$('reload').addEventListener('click', () => vscode.postMessage({ type: 'reload' }));
$('filter').addEventListener('input', () => draw());
$('add-toggle').addEventListener('click', () => {
  $('adder').hidden = !$('adder').hidden;
  if (!$('adder').hidden) { $('adder-text').focus(); }
});
$('adder-cancel').addEventListener('click', () => {
  $('adder').hidden = true;
  $('adder-text').value = '';
  refusal('');
});
$('adder').addEventListener('submit', (event) => {
  event.preventDefault();
  const typed = $('adder-text').value.trim();
  if (typed.length === 0) { refusal('Type an enterprise name, or one repository address.'); return; }
  refusal('');
  vscode.postMessage({ type: 'add', text: typed });
  $('adder-text').value = '';
  $('adder').hidden = true;
});
$('bulk-clear').addEventListener('click', () => { selected.clear(); draw(); });
for (const pair of [['bulk-start', 'start'], ['bulk-fetch', 'fetch'], ['bulk-pull', 'pull'], ['bulk-remove', 'removeClone']]) {
  $(pair[0]).addEventListener('click', () => {
    if (selected.size === 0) { return; }
    vscode.postMessage({ type: 'bulk', action: pair[1], names: Array.from(selected) });
    selected.clear();
    draw();
  });
}

window.addEventListener('message', (event) => {
  const message = event.data;
  if (message.type === 'refused') { refusal(message.error); return; }
  if (message.type !== 'seed') { return; }

  if (message.error) {
    $('lede').textContent = 'The platform database could not be read.';
    $('error').replaceChildren(banner(message.error));
    $('bar').hidden = true;
    $('selection').hidden = true;
    $('strip').replaceChildren();
    $('stats').replaceChildren();
    $('list').replaceChildren();
    return;
  }

  const changed = message.org !== current;
  organisations = message.organisations || [];
  current = message.org;
  repositories = message.repositories || [];
  cited = message.cited || [];
  copies = message.copies || {};
  takenAt = message.takenAt;
  state = message.state;
  // A row that no longer exists cannot stay selected, and a list from another organisation starts clean.
  if (changed) { selected.clear(); }
  for (const name of Array.from(selected)) {
    if (!repositories.some((repo) => repo.name === name)) { selected.delete(name); }
  }

  $('error').replaceChildren(...(message.warning ? [banner(message.warning)] : []));
  $('bar').hidden = false;
  drawStrip();
  drawStats();
  $('lede').textContent = lede(message);
  draw();
});

/** One line that says where this list came from, and whether its answer is fresh. */
function lede(message) {
  const org = organisations.find((row) => row.slug === current);
  if (org === undefined) { return 'No organisation is recorded yet.'; }
  const head = org.kind === 'repository'
    ? 'One repository, named by its address'
    : 'Repositories of ' + org.name + ' — most recently pushed first';
  const when = message.takenAt ? ' · read ' + readAt(message.takenAt) : '';
  const truncated = message.truncated ? ' · the first 100' : '';
  const project = message.project ? ' · starting one adds it to ' + message.project : ' · no project is being worked on yet';
  return head + when + truncated + project;
}

/** The enterprises as chips: one is shown, the rest are one click away, and each can be forgotten. */
function drawStrip() {
  const nodes = organisations.map((org) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'org' + (org.slug === current ? ' is-on' : '');
    chip.title = org.kind === 'repository'
      ? 'One repository, added by its address'
      : (org.kind === 'account' ? 'A personal account on GitHub' : 'An enterprise or organisation on GitHub');
    chip.append(text('span', '', org.name), text('span', 'org__n', String(org.repositories)));
    chip.addEventListener('click', () => {
      if (org.slug !== current) { vscode.postMessage({ type: 'read', slug: org.slug }); }
    });
    // Forgetting is offered only when there is something else to show: the page is never left with no list.
    if (organisations.length > 1) {
      const forget = text('span', 'org__x', '×');
      forget.title = 'Forget this organisation — the sources it named are untouched';
      forget.addEventListener('click', (event) => {
        event.stopPropagation();
        vscode.postMessage({ type: 'forget', slug: org.slug });
      });
      chip.append(forget);
    }
    return chip;
  });
  $('strip').replaceChildren(...nodes);
}

/** What is here, in numbers, so the strip does not have to be read to be understood. */
function drawStats() {
  const started = repositories.filter((repo) => cited.includes(repo.name)).length;
  const clones = Object.keys(copies).length;
  const parts = [
    pair(String(repositories.length), repositories.length === 1 ? 'repository' : 'repositories'),
    pair(String(started), 'started'),
    pair(String(clones), clones === 1 ? 'local copy' : 'local copies')
  ];
  if (state === 'refused') {
    parts.push(text('span', '', 'held from ' + (takenAt ? readAt(takenAt) : 'an earlier read')));
  } else if (state === 'named') {
    parts.push(text('span', '', 'from the address'));
  }
  $('stats').replaceChildren(...join(parts));
}

function draw() {
  const needle = $('filter').value.trim().toLowerCase();
  const shown = repositories.filter((repo) =>
    needle.length === 0 ||
    (repo.name + ' ' + (repo.description || '') + ' ' + (repo.language || '')).toLowerCase().includes(needle));

  $('selection').hidden = selected.size === 0;
  $('selection-count').textContent = selected.size + (selected.size === 1 ? ' repository selected' : ' repositories selected');
  $('count').textContent = shown.length === repositories.length ? '' : shown.length + ' of ' + repositories.length;

  if (shown.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = repositories.length === 0
      ? (state === 'refused'
        ? 'Nothing is held for this organisation yet, and GitHub would not answer. Try again when the allowance resets.'
        : 'This organisation has no repositories this token can see.')
      : 'No repository matches that filter.';
    $('list').replaceChildren(empty);
    return;
  }

  $('list').replaceChildren(...shown.map((repo) => row(repo)));
}

function row(repo) {
  const isCited = cited.includes(repo.name);
  const cloned = Object.prototype.hasOwnProperty.call(copies, repo.name);

  const line = document.createElement('div');
  line.className = 'row' + (selected.has(repo.name) ? ' is-selected' : '');

  const tick = document.createElement('input');
  tick.type = 'checkbox';
  tick.checked = selected.has(repo.name);
  tick.setAttribute('aria-label', 'Select ' + repo.name);
  tick.addEventListener('change', () => {
    if (tick.checked) { selected.add(repo.name); } else { selected.delete(repo.name); }
    draw();
  });

  const main = document.createElement('div');
  const top = document.createElement('div');
  top.className = 'top';
  top.append(text('span', 'name', repo.name));
  if (isCited) { top.append(text('span', 'cited', 'source of this project')); }
  const facts = [repo.language || '', repo.pushedAt ? 'pushed ' + shortDate(repo.pushedAt) : '', repo.isPrivate ? 'private' : '']
    .filter(Boolean).join(' · ');
  if (facts.length > 0) { top.append(text('span', 'facts', facts)); }
  main.append(top, text('p', 'desc', repo.description || 'No description.'));

  const do_ = document.createElement('div');
  do_.className = 'do';
  const start = button('btn btn--sm btn--primary', isCited ? 'Start again' : 'Start', () =>
    vscode.postMessage({ type: 'start', name: repo.name }));
  const project = button('btn btn--sm', 'Project', () =>
    vscode.postMessage({ type: 'project', name: repo.name }));
  project.title = 'Create a project from this repository — its files, then an AI draft';
  const open = button('btn btn--sm btn--ghost', 'Open', () => {
    if (repo.webUrl) { vscode.postMessage({ type: 'open', url: repo.webUrl }); }
  });
  open.title = 'Open the repository on GitHub';
  const local = button('btn btn--sm', cloned ? 'Pull' : 'Fetch the local copy', () =>
    vscode.postMessage({ type: cloned ? 'pull' : 'fetch', name: repo.name }));
  do_.append(start, project, open, local);
  if (cloned) {
    const drop = button('btn btn--sm btn--ghost', 'Remove copy', () =>
      vscode.postMessage({ type: 'removeClone', name: repo.name }));
    drop.title = 'Remove the local copy — the repository is left untouched';
    do_.append(drop);
  }

  line.append(tick, main, do_);
  return line;
}

/** The refusal, in a box that can be answered where it is read. */
function banner(message) {
  const box = document.createElement('div');
  box.className = 'warn';
  box.append(text('p', '', message));
  const do_ = document.createElement('div');
  do_.className = 'do';
  do_.append(
    button('btn btn--sm', 'Set a GitHub token', () =>
      vscode.postMessage({ type: 'command', command: 'temcoRepositories.setToken' })),
    button('btn btn--sm', 'Read GitHub again', () => vscode.postMessage({ type: 'reload' })));
  box.append(do_);
  return box;
}

/** A refusal about the adder, said under the strip rather than somewhere else on the page. */
function refusal(message) {
  if (!message) { $('error').replaceChildren(); return; }
  $('error').replaceChildren(banner(message));
}

function text(tag, className, content) {
  const node = document.createElement(tag);
  if (className) { node.className = className; }
  node.textContent = content;
  return node;
}

function button(className, label, onClick) {
  const node = text('button', className, label);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

function pair(value, label) {
  const node = document.createElement('span');
  node.append(text('b', '', value), document.createTextNode(' ' + label));
  return node;
}

/** Dots between the numbers, so the line reads as one sentence rather than a row of stray words. */
function join(parts) {
  const nodes = [];
  parts.forEach(function (part, index) {
    if (index > 0) { nodes.push(text('span', '', '·')); }
    nodes.push(part);
  });
  return nodes;
}

/** When a list was read, in words that survive a missing or unreadable stamp. */
function readAt(stamp) {
  const date = new Date(stamp);
  return isNaN(date.getTime()) ? 'at an earlier time' : 'at ' + date.toLocaleString();
}

/** A pushed date as a day, without the time of day: the list is sorted by it, and nobody reads the minutes. */
function shortDate(stamp) {
  const date = new Date(stamp);
  return isNaN(date.getTime()) ? stamp : date.toLocaleDateString();
}
`;
