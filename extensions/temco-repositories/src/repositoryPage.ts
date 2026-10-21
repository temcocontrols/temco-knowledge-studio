// One repository, as a page: what it is, what the platform already holds of it, and what is inside it.
//
// The dashboard lists an enterprise's repositories; this is what a row opens. It answers the three questions a row
// cannot — is this already a source, is there a local copy to read files and history from, and **what files are in
// it** — and it is where a project actually starts: pick files here, then create a project from them.
//
// Nothing is written to a repository. "Fetch the local copy" clones one branch into the working area, which is what
// lets the file list and the material for a draft be read from disk rather than from the API; without a copy the
// same list is read over the API, which is slower and spends GitHub's allowance.

import * as vscode from 'vscode';
import { sourceTree, CodeFile, RepositorySource } from './repository';
import { Catalog, RepositoryCacheRow, Selection, slugOf } from './store';
import { page, pageColumn } from './ui';
import { cloneSize, hasClone } from './workarea';

export const REPOSITORY_DETAIL_VIEW_TYPE = 'temcoRepositories.repositoryDetail';

interface DetailMessage {
  type?: string;
  url?: string;
  text?: string;
  files?: string[];
}

/** What the page is told once, and again after every act: the row, its state in this window, and the project. */
interface DetailState {
  name: string;
  organisation?: string;
  row?: RepositoryCacheRow;
  isSource: boolean;
  branch?: string;
  localCopy: boolean;
  copySize?: string;
  cited: boolean;
  project?: string;
  error?: string;
}

/** A file of the repository under `docs/`, in one of the shapes a page is written in. */
function isDocumentation(file: string): boolean {
  const lower = file.toLowerCase();
  if (!/\.(md|markdown|html|htm|json)$/.test(lower)) {
    return false;
  }
  return /(^|\/)docs\//.test(lower) || lower.endsWith('registry.json');
}

export class RepositoryDetailPage {
  private panel: vscode.WebviewPanel | undefined;
  private name = '';
  private organisation: string | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly selection: Selection,
    private readonly refresh: () => void
  ) { }

  open(name: string, organisation?: string): void {
    this.name = name;
    this.organisation = organisation;
    if (this.panel) {
      this.panel.title = name;
      this.panel.reveal(pageColumn());
      void this.render();
      return;
    }
    this.panel = vscode.window.createWebviewPanel(REPOSITORY_DETAIL_VIEW_TYPE, name, pageColumn(), {
      enableScripts: true,
      localResourceRoots: [],
    });
    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
    this.panel.webview.onDidReceiveMessage((message: DetailMessage) => void this.receive(message));
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
    panel.webview.html = html(this.name);
    await this.send();
  }

  /** The row, the source and the local copy — one message, so the page never draws half a repository. */
  private async send(): Promise<void> {
    const panel = this.panel;
    if (!panel) {
      return;
    }
    const project = this.selection.project();
    const state: DetailState = { name: this.name, isSource: false, localCopy: false, cited: false, project };

    let catalog: Catalog | undefined;
    try {
      catalog = await Catalog.open(this.context);
      const organisations = catalog.organisations();
      const org =
        organisations.find((candidate) => candidate.slug === this.organisation) ??
        organisations.find((candidate) => catalog?.repositoriesOf(candidate.slug).some((row) => row.name === this.name));
      state.organisation = org?.slug;
      state.row = org === undefined ? undefined : catalog.repositoriesOf(org.slug).find((row) => row.name === this.name);
      const source = catalog.source(slugOf(this.name));
      state.isSource = source !== undefined;
      state.branch = source?.branch;
      if (project !== undefined) {
        state.cited = catalog.documentSources(project).some((row) => row.name === this.name);
        state.localCopy = await hasClone(project, this.name);
        state.copySize = state.localCopy ? (await cloneSize(project, this.name)) ?? '' : undefined;
      }
    } catch (error) {
      state.error = error instanceof Error ? error.message : String(error);
    } finally {
      catalog?.close();
    }

    await panel.webview.postMessage({ type: 'state', ...state });
  }

  /** The files inside the repository, grouped: documentation first, then classes and source. */
  private async sendFiles(ticked: readonly string[]): Promise<void> {
    const panel = this.panel;
    if (!panel) {
      return;
    }
    let catalog: Catalog | undefined;
    let source: RepositorySource | undefined;
    try {
      catalog = await Catalog.open(this.context);
      const record = catalog.source(slugOf(this.name));
      const org = catalog.organisations().find((candidate) => candidate.slug === this.organisation) ??
        catalog.organisations().find((candidate) => catalog?.repositoriesOf(candidate.slug).some((row) => row.name === this.name));
      const row = org === undefined ? undefined : catalog.repositoriesOf(org.slug).find((entry) => entry.name === this.name);
      source = {
        name: this.name,
        path: record?.path,
        remoteUrl: record?.remoteUrl ?? row?.cloneUrl,
        branch: record?.branch,
        defaultBranch: record?.defaultBranch ?? row?.defaultBranch,
      };
    } catch (error) {
      await panel.webview.postMessage({ type: 'files', error: error instanceof Error ? error.message : String(error) });
      return;
    } finally {
      catalog?.close();
    }

    if (source === undefined) {
      await panel.webview.postMessage({ type: 'files', error: 'This repository is no longer listed by any organisation.' });
      return;
    }
    const listed = await sourceTree(this.context, source);
    if ('error' in listed) {
      await panel.webview.postMessage({ type: 'files', error: listed.error });
      return;
    }
    const files = listed.files.map((file: CodeFile) => ({
      path: file.path,
      size: file.size,
      category: isDocumentation(file.path) ? 'docs' : 'code',
      ticked: ticked.includes(file.path),
    }));
    await panel.webview.postMessage({ type: 'files', files, note: listed.note });
  }

  private async receive(message: DetailMessage): Promise<void> {
    switch (message.type) {
      case 'state':
        await this.send();
        return;
      case 'files':
        await this.sendFiles(message.files ?? []);
        return;
      case 'open':
        if (message.url !== undefined) {
          await vscode.env.openExternal(vscode.Uri.parse(message.url));
        }
        return;
      case 'copy':
        if (message.text !== undefined) {
          await vscode.env.clipboard.writeText(message.text);
          void vscode.window.showInformationMessage(`Temco Repositories: ${message.text} is on the clipboard.`);
        }
        return;
      case 'fetch':
        // Fetching a repository that was never started makes it a source first: a clone belongs to a source.
        await this.start();
        await vscode.commands.executeCommand('temcoRepositories.fetchSource', slugOf(this.name));
        this.refresh();
        await this.send();
        return;
      case 'pull':
        await vscode.commands.executeCommand('temcoRepositories.pullSource', slugOf(this.name));
        this.refresh();
        await this.send();
        return;
      case 'removeClone':
        await vscode.commands.executeCommand('temcoRepositories.removeClone', slugOf(this.name));
        this.refresh();
        await this.send();
        return;
      case 'start':
        await this.start();
        await this.send();
        return;
      case 'project': {
        const coordinates = await this.coordinates();
        try {
          await vscode.commands.executeCommand(
            'temcoProjects.newProjectFromRepository',
            coordinates.name,
            coordinates.cloneUrl,
            coordinates.branch,
            message.files ?? []
          );
        } catch {
          void vscode.window.showInformationMessage(
            'Temco Repositories: the projects module is not installed, so there is nothing to create a project with.'
          );
        }
        return;
      }
      case 'command':
        // A command the page asks for by id — the token prompt, so a refusal can be answered where it is read.
        if (typeof (message as { command?: string }).command === 'string') {
          await vscode.commands.executeCommand((message as { command?: string }).command as string);
          await this.send();
        }
        return;
      default:
        return;
    }
  }

  /** The row's own facts, as the projects module needs them to open pinned to this repository. */
  private async coordinates(): Promise<{ name: string; cloneUrl?: string; branch?: string }> {
    let catalog: Catalog | undefined;
    try {
      catalog = await Catalog.open(this.context);
      const organisations = catalog.organisations();
      const org = organisations.find((candidate) => candidate.slug === this.organisation) ??
        organisations.find((candidate) => catalog?.repositoriesOf(candidate.slug).some((row) => row.name === this.name));
      const row = org === undefined ? undefined : catalog.repositoriesOf(org.slug).find((entry) => entry.name === this.name);
      const record = catalog.source(slugOf(this.name));
      return {
        name: this.name,
        cloneUrl: record?.remoteUrl ?? row?.cloneUrl,
        branch: record?.defaultBranch ?? row?.defaultBranch,
      };
    } catch {
      return { name: this.name };
    } finally {
      catalog?.close();
    }
  }

  /** Records the repository as a source of the project being worked on — the same act as *Start* on the dashboard. */
  private async start(): Promise<void> {
    const project = this.selection.project();
    if (project === undefined) {
      void vscode.window.showInformationMessage(
        'Temco Repositories: a source belongs to a project being worked on. Choose one first — the Library’s Projects row.',
        'Projects'
      ).then((answer) => {
        if (answer === 'Projects') {
          void vscode.commands.executeCommand('temcoDocs.projects');
        }
      });
      return;
    }
    const coordinates = await this.coordinates();
    let catalog: Catalog | undefined;
    try {
      catalog = await Catalog.open(this.context);
      const slug = slugOf(this.name);
      catalog.addSource({
        kind: 'git',
        name: this.name,
        slug,
        remoteUrl: coordinates.cloneUrl,
        defaultBranch: coordinates.branch,
      });
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
  }
}

function html(name: string): string {
  const style = `
    /* The same vocabulary as the dashboard: fills and spacing, a hairline between rows, no boxes. */
    .toolbar { display: flex; gap: .5em; align-items: center; flex-wrap: wrap; margin: 1.1em 0 .2em; }
    .toolbar .input { flex: 1 1 18em; min-width: 10em; }

    .strip { display: flex; gap: .4em; flex-wrap: wrap; align-items: center; margin: .9em 0 0; }
    .fact { display: inline-flex; align-items: baseline; gap: .35em; padding: .28em .6em; border-radius: var(--radius);
            background: var(--bg-inset); color: var(--fg); font-size: var(--fs-sm); }
    .fact b { color: var(--fg-strong); font-weight: 600; }
    .fact--ok { background: color-mix(in srgb, var(--ok) 16%, transparent); }
    .fact--warn { background: color-mix(in srgb, var(--warn) 18%, transparent); }

    .rows { margin: .6em 0 0; }
    .row { display: grid; grid-template-columns: 1.4em minmax(0, 1fr) auto; gap: 0 .7em; align-items: start;
           padding: .55em .4em; border-bottom: 1px solid var(--border); }
    .row:last-child { border-bottom: 0; }
    .row:hover { background: var(--bg-hover); }
    .row .name { color: var(--fg); font-size: var(--fs-sm); overflow-wrap: anywhere; }
    .row .facts { color: var(--fg-muted); font-size: var(--fs-xs); white-space: nowrap; }

    /* The warning is a tinted surface, not a bordered box: it has to be recognisable across the room. */
    .warn { border-radius: var(--radius); padding: .8em 1em; margin: 1em 0;
            background: color-mix(in srgb, var(--warn) 22%, var(--bg-inset)); color: var(--fg); }
    .warn p { margin: 0; }
    .warn .do { display: flex; gap: .5em; margin: .7em 0 0; }
    .empty { color: var(--fg-muted); padding: .9em 0; }

    .acts { display: flex; gap: .5em; flex-wrap: wrap; align-items: center; margin: 1.2em 0 0; }
    .foot { display: flex; gap: .6em; flex-wrap: wrap; align-items: center; margin: 1.4em 0 0;
            padding-top: 1em; border-top: 1px solid var(--border); }
    .foot__summary { color: var(--fg-muted); font-size: var(--fs-sm); }
  `;

  const body = `
  <div class="page-head">
    <div class="page-head__main">
      <div class="eyebrow">Repository</div>
      <h1 class="page-head__title" id="title">${name}</h1>
      <p class="page-head__desc" id="lede">Reading what the platform holds of it…</p>
    </div>
    <div class="page-head__actions">
      <button type="button" class="btn btn--ghost" id="copy-url">Copy the clone URL</button>
      <button type="button" class="btn btn--ghost" id="open-github">Open on GitHub</button>
      <button type="button" class="btn" id="reload">Refresh</button>
    </div>
  </div>

  <div class="strip" id="facts"></div>
  <div id="error"></div>

  <div class="acts">
    <button type="button" class="btn" id="fetch">Download</button>
    <button type="button" class="btn btn--ghost" id="pull" hidden>Pull</button>
    <button type="button" class="btn btn--ghost" id="remove-copy" hidden>Remove the local copy</button>
    <button type="button" class="btn btn--ghost" id="start" hidden>Start — add it to the project</button>
  </div>

  <div class="split__section-title mt-16">What is inside it</div>
  <p class="split__section-note" id="files-note">Reading the file list…</p>
  <div class="toolbar" id="bar" hidden>
    <input class="input" type="search" id="filter" placeholder="Filter by path" aria-label="Filter files">
    <button type="button" class="btn btn--sm" id="all">Select all</button>
    <button type="button" class="btn btn--sm" id="none">Clear</button>
  </div>
  <div id="files-error"></div>
  <div class="rows" id="files"></div>

  <div class="foot">
    <span class="foot__summary" id="summary">No file selected.</span>
    <span class="page-head__spacer" style="flex:1"></span>
    <button type="button" class="btn btn--primary" id="project">Create a project from these files</button>
  </div>
  `;

  return page(body, { title: name, extraCss: style, script: CLIENT });
}

const CLIENT = `
const vscode = acquireVsCodeApi();
const $ = (id) => document.getElementById(id);
let state = {};
let files = [];
let note = '';

$('reload').addEventListener('click', () => vscode.postMessage({ type: 'state' }));
$('open-github').addEventListener('click', () => {
  if (state.row && state.row.webUrl) { vscode.postMessage({ type: 'open', url: state.row.webUrl }); }
});
$('copy-url').addEventListener('click', () => {
  if (state.row && state.row.cloneUrl) { vscode.postMessage({ type: 'copy', text: state.row.cloneUrl }); }
});
$('fetch').addEventListener('click', () => vscode.postMessage({ type: 'fetch' }));
$('pull').addEventListener('click', () => vscode.postMessage({ type: 'pull' }));
$('remove-copy').addEventListener('click', () => vscode.postMessage({ type: 'removeClone' }));
$('start').addEventListener('click', () => vscode.postMessage({ type: 'start' }));
$('project').addEventListener('click', () => vscode.postMessage({ type: 'project', files: ticked() }));
$('all').addEventListener('click', () => { setAll(true); });
$('none').addEventListener('click', () => { setAll(false); });
$('filter').addEventListener('input', () => draw());

window.addEventListener('message', (event) => {
  const message = event.data || {};
  if (message.type === 'state') {
    state = message;
    if (message.error) { $('error').replaceChildren(banner(message.error)); return; }
    $('error').replaceChildren();
    if (message.row) { $('title').textContent = message.row.name; }
    drawFacts();
    drawActions();
    // The file list is asked for again after every act: a fetched copy changes where the files come from.
    vscode.postMessage({ type: 'files', files: ticked() });
    return;
  }
  if (message.type !== 'files') { return; }
  if (message.error) {
    $('files-error').replaceChildren(banner(message.error));
    $('files').replaceChildren();
    $('bar').hidden = true;
    $('files-note').textContent = 'The list could not be read.';
    drawSummary();
    return;
  }
  $('files-error').replaceChildren();
  files = message.files || [];
  note = message.note || '';
  $('bar').hidden = files.length === 0;
  $('files-note').textContent = (state.localCopy
    ? 'Read from the local copy in the working area.'
    : 'Read over the GitHub API, because there is no local copy. Downloading one makes this faster and gives the history behind each file.')
    + (note ? ' ' + note + '.' : '');
  draw();
});

/** What the platform holds of this repository, in one tinted line each. */
function drawFacts() {
  const parts = [];
  if (state.row) {
    if (state.row.language) { parts.push(fact(state.row.language)); }
    if (state.row.pushedAt) { parts.push(fact('pushed ' + shortDate(state.row.pushedAt))); }
    parts.push(fact(state.row.isPrivate ? 'private' : 'public'));
  }
  if (state.cited) { parts.push(fact('source of this project', 'fact--ok')); }
  else if (state.isSource) { parts.push(fact('recorded, not cited by this project')); }
  else { parts.push(fact('not started', 'fact--warn')); }
  if (state.localCopy) {
    parts.push(fact('local copy' + (state.copySize ? ' · ' + state.copySize : ''), 'fact--ok'));
  } else {
    parts.push(fact('no local copy', 'fact--warn'));
  }
  $('facts').replaceChildren(...parts);
  $('lede').textContent = (state.organisation ? state.organisation + ' · ' : '')
    + (state.row && state.row.description ? state.row.description : 'No description.')
    + (state.project ? ' · project ' + state.project : ' · no project is being worked on');
}

/** The acts the state allows: fetch or pull, start when it is not cited, and never both of a pair. */
function drawActions() {
  $('fetch').hidden = Boolean(state.localCopy);
  $('pull').hidden = !state.localCopy;
  $('remove-copy').hidden = !state.localCopy;
  $('start').hidden = Boolean(state.cited);
}

function draw() {
  const needle = $('filter').value.trim().toLowerCase();
  const shown = files.filter((file) => needle.length === 0 || file.path.toLowerCase().includes(needle));
  if (shown.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = files.length === 0 ? 'This repository has no file to show.' : 'No file matches that filter.';
    $('files').replaceChildren(empty);
    drawSummary();
    return;
  }
  $('files').replaceChildren(...shown.map((file) => {
    const line = document.createElement('div');
    line.className = 'row';
    const tick = document.createElement('input');
    tick.type = 'checkbox';
    tick.checked = Boolean(file.ticked);
    tick.setAttribute('aria-label', 'Select ' + file.path);
    tick.addEventListener('change', () => { file.ticked = tick.checked; drawSummary(); });
    const path = document.createElement('span');
    path.className = 'name';
    path.textContent = file.path;
    const size = document.createElement('span');
    size.className = 'facts';
    size.textContent = (file.category === 'docs' ? 'doc · ' : '') + kilo(file.size);
    line.append(tick, path, size);
    return line;
  }));
  drawSummary();
}

function ticked() {
  return files.filter((file) => file.ticked).map((file) => file.path);
}

function setAll(value) {
  const needle = $('filter').value.trim().toLowerCase();
  files.forEach((file) => {
    if (needle.length === 0 || file.path.toLowerCase().includes(needle)) { file.ticked = value; }
  });
  draw();
}

function drawSummary() {
  const chosen = files.filter((file) => file.ticked);
  const bytes = chosen.reduce((total, file) => total + file.size, 0);
  $('summary').textContent = chosen.length === 0
    ? 'No file selected — a project can start with none, and its files are picked again there.'
    : chosen.length + (chosen.length === 1 ? ' file · ' : ' files · ') + kilo(bytes);
  $('project').textContent = chosen.length === 0
    ? 'Create a project from this repository'
    : 'Create a project from these ' + chosen.length + (chosen.length === 1 ? ' file' : ' files');
}

function fact(text, className) {
  const node = document.createElement('span');
  node.className = 'fact' + (className ? ' ' + className : '');
  node.textContent = text;
  return node;
}

function banner(text) {
  const box = document.createElement('div');
  box.className = 'warn';
  const said = document.createElement('p');
  said.textContent = text;
  const do_ = document.createElement('div');
  do_.className = 'do';
  const token = document.createElement('button');
  token.type = 'button';
  token.className = 'btn btn--sm';
  token.textContent = 'Set a GitHub token';
  token.addEventListener('click', () => vscode.postMessage({ type: 'command', command: 'temcoRepositories.setToken' }));
  const again = document.createElement('button');
  again.type = 'button';
  again.className = 'btn btn--sm';
  again.textContent = 'Try again';
  again.addEventListener('click', () => vscode.postMessage({ type: 'files', files: [] }));
  do_.append(token, again);
  box.append(said, do_);
  return box;
}

function kilo(bytes) {
  return bytes >= 1024 ? (bytes / 1024).toFixed(1) + ' KB' : bytes + ' B';
}

function shortDate(stamp) {
  const date = new Date(stamp);
  return isNaN(date.getTime()) ? stamp : date.toLocaleDateString();
}
`;
