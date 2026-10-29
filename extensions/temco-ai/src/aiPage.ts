// The AI page: the AI as something you own and configure, not a popup you dismiss.
//
// Four facts a person needs before trusting an answer — which runtime, which model, whether the server is up,
// and what instructions it was given — plus what can be downloaded, and a box to try it. The *Models and
// Runtime* quick pick still exists for keyboard use; this is the same information with room to stand back.
//
// It is a page about the AI in general, not about one project. A project's AI tab is where the AI meets that
// project's pages; this is where the AI itself is set up, and both point at each other.

import * as vscode from 'vscode';
import { MODELS, RUNTIMES, entryById, formatBytes, runtimeFor } from './ai/catalog';
import { install, installedArtifacts, modelRoot, uninstall } from './ai/install';
import { bestModel, describeMachine, fitsModel, machine } from './ai/machine';
import { PROMPT_VERSION } from './ai/prompts';
import { aiStatus, showAiLog, startAiServer, stopAiServer } from './ai/runtime';
import { pageColumn } from './docs';
import { hero, page, runCommand, section } from './ui';
import { AI_PAGE_VIEW_TYPE } from './surface';

/** Somewhere on the page a caller can ask to be put: the list of what can be downloaded. */
export type AiSection = 'downloads';

interface AiPageMessage {
  type: 'ready' | 'download' | 'remove' | 'start' | 'stop' | 'folder' | 'log' | 'models' | 'apply' | 'command';
  id?: string;
  model?: string;
  runtime?: string;
  /** The command a `data-command` button on the page names. */
  command?: string;
  args?: unknown;
}

export class AiPage {
  private panel: vscode.WebviewPanel | undefined;
  private busy = '';
  /** Where to put the reader once the page has its data — `undefined` leaves them at the top. */
  private wanted: AiSection | undefined;

  constructor(private readonly context: vscode.ExtensionContext) { }

  /**
   * Opens the page, or brings it forward.
   *
   * A caller that already knows what the reader came for passes it — "choose a model" means the downloads, not
   * the top of a page about the AI in general.
   */
  open(section?: AiSection): void {
    this.wanted = section;
    if (this.panel) {
      this.panel.reveal(pageColumn());
      void this.seed();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      AI_PAGE_VIEW_TYPE,
      'The AI',
      pageColumn(),
      { enableScripts: true, localResourceRoots: [] }
    );
    this.panel.webview.html = html();
    this.panel.webview.onDidReceiveMessage((message: AiPageMessage) => void this.receive(message));
    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  private async receive(message: AiPageMessage): Promise<void> {
    switch (message.type) {
      case 'ready':
        await this.seed();
        return;
      case 'download':
        await this.download(message.id ?? '');
        return;
      case 'remove': {
        const id = message.id ?? '';
        if (installedArtifacts(this.context).some((artifact) => artifact.id === id)) {
          uninstall(this.context, id);
        }
        await this.seed();
        return;
      }
      case 'start':
        this.busy = 'starting';
        await this.seed();
        try {
          const info = await startAiServer(this.context);
          void vscode.window.showInformationMessage(`Temco AI: the local AI is on ${info.baseUrl}.`);
        } catch (error) {
          void vscode.window.showErrorMessage(`Temco AI: ${String(error)}`);
        }
        this.busy = '';
        await this.seed();
        return;
      case 'stop':
        stopAiServer();
        await this.seed();
        return;
      case 'folder':
        await vscode.env.openExternal(vscode.Uri.file(modelRoot(this.context)));
        return;
      case 'log':
        showAiLog();
        return;
      case 'command':
        // The page's own two ways out are commands, not messages: the kit's bridge names them, and this runs them.
        runCommand(message);
        return;
      case 'models':
        await vscode.commands.executeCommand('temcoAi.models');
        await this.seed();
        return;
      case 'apply': {
        const configuration = vscode.workspace.getConfiguration('temcoAi');
        await configuration.update('model', message.model ?? '', vscode.ConfigurationTarget.Global);
        await configuration.update('runtime', message.runtime ?? '', vscode.ConfigurationTarget.Global);
        await this.seed();
        return;
      }
    }
  }

  private async download(id: string): Promise<void> {
    const entry = entryById(id);
    if (!entry) {
      return;
    }

    this.busy = id;
    await this.seed();
    try {
      await install(this.context, entry);
      // Installing and choosing are separate acts, but a first install with nothing chosen would leave the
      // server unable to start for no reason. Choose it only when the choice is still empty.
      const key = entry.kind === 'runtime' ? 'runtime' : 'model';
      const configuration = vscode.workspace.getConfiguration('temcoAi');
      if (configuration.get<string>(key, '').length === 0) {
        await configuration.update(key, entry.id, vscode.ConfigurationTarget.Global);
      }
      void vscode.window.showInformationMessage(`Temco AI: ${entry.label} is installed.`);
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error);
      const answer = await vscode.window.showWarningMessage(`Temco AI: ${message}`, 'Open Settings');
      if (answer === 'Open Settings') {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'temcoAi.allowUnpinned');
      }
    }
    this.busy = '';
    await this.seed();
  }

  /** Whether the catalogue pins checksums for this kind at all — the wording of a refusal depends on it. */

  private async seed(): Promise<void> {
    if (!this.panel) {
      return;
    }
    const configuration = vscode.workspace.getConfiguration('temcoAi');
    const status = aiStatus(this.context);
    const installed = installedArtifacts(this.context);
    const have = new Set(installed.map((artifact) => artifact.id));

    const describe = (entry: (typeof RUNTIMES)[number]) => {
      const artifact = installed.find((one) => one.id === entry.id);
      return {
        id: entry.id,
        label: entry.label,
        licence: entry.licence,
        size: entry.bytes > 0 ? formatBytes(entry.bytes) : 'size not pinned',
        notes: entry.notes,
        pinned: entry.sha256.length > 0,
        needs: entry.needs,
        platform: [entry.platform, entry.architecture].filter(Boolean).join(' '),
        installed: have.has(entry.id),
        path: artifact?.path,
        installedAt: artifact?.installedAt,
        busy: this.busy === entry.id,
        suggested: entry.id === this.suggestions()[entry.kind],
        fit: entry.kind === 'model' ? fitsModel(entry, this.machine).why : undefined,
      };
    };

    const target = this.wanted;
    this.wanted = undefined;
    await this.panel.webview.postMessage({
      type: 'ai',
      facts: {
        runtime: status.runtime ? entryById(status.runtime.id)?.label ?? status.runtime.id : undefined,
        model: status.model ? entryById(status.model.id)?.label ?? status.model.id : undefined,
        running: status.running ? `${status.running.baseUrl} (${status.running.label})` : undefined,
        promptVersion: PROMPT_VERSION,
        root: modelRoot(this.context),
        machine: describeMachine(this.machine),
        suggested: this.suggestions(),
        busy: this.busy === 'starting' ? 'starting the server' : undefined,
      },
      chosen: {
        runtime: configuration.get<string>('runtime', ''),
        model: configuration.get<string>('model', ''),
      },
      installed: installed.map((artifact) => ({
        id: artifact.id,
        label: entryById(artifact.id)?.label ?? artifact.id,
        kind: artifact.kind,
        path: artifact.path,
        bytes: formatBytes(artifact.bytes),
        at: artifact.installedAt.slice(0, 16).replace('T', ' '),
      })),
      runtimes: RUNTIMES.map(describe),
      models: MODELS.map(describe),
    });

    // After the data, never before: the page has to have something to scroll to.
    if (target !== undefined) {
      await this.panel.webview.postMessage({ type: 'scroll', to: target });
    }
  }

  /** This machine, read once for each pass over the catalog list. */
  private get machine() {
    return machine();
  }

  /**
   * What to mark as the fit for this machine: the one runtime built for it, and the largest model it can hold.
   *
   * Both are answers about *this* computer, so they are read here rather than in the page: `process` and `os`
   * are the extension host's, and a webview that guessed at them would be guessing at the user's own machine.
   */
  private suggestions(): { runtime?: string; model?: string } {
    const here = this.machine;
    return {
      runtime: runtimeFor(here.platform, here.architecture)?.id,
      model: bestModel(here)?.id,
    };
  }
}

function html(): string {
  // Three blocks, in the order a person needs them: what the server is, what it can run, what it can think with.
  // Everything is drawn in the application's page vocabulary; the only rules here are the three shapes the kit has
  // no component for — the figures of the server card, the two selects inside it, and a flat list row.
  const style = `
    .ai-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(15em, 100%), 1fr));
                gap: .6em 2em; margin: .9em 0 0; max-width: 60em; }
    .ai-facts > div { min-width: 0; }
    .ai-facts dt { color: var(--vscode-descriptionForeground); font-size: .85em; }
    .ai-facts dd { margin: .15em 0 0; overflow-wrap: anywhere; }
    .ai-facts .wide { grid-column: 1 / -1; }
    .ai-facts .wide dd { font-family: var(--vscode-editor-font-family); font-size: .9em;
                         white-space: nowrap; overflow-x: auto; overflow-wrap: normal; }
    .ai-pick { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(18em, 100%), 1fr));
               gap: .8em 2em; max-width: 60em; margin: .9em 0 0; }
    .ai-pick label { display: block; color: var(--vscode-descriptionForeground); margin-bottom: .25em; }
    .ai-pick select { width: 100%; min-width: 0; }
    /* A list row, not a card: the same entry the kit draws, with its border and its fill taken away. */
    .ai-row { display: flex; align-items: center; gap: .5em; margin-top: .35em; }
    .ai-row .az-entry { flex: 1 1 auto; min-width: 0; border: 0; background: transparent; padding-left: 0; }
    .ai-row > .badge, .ai-row > button { flex: 0 0 auto; }
    .ai-row:first-of-type { margin-top: .25em; }
    /* The other platforms: out of the way until they are asked for. */
    .ai-more { margin-top: .5em; }
    .ai-more > summary { color: var(--vscode-descriptionForeground); font-size: .9em; cursor: pointer; padding: .2em 0; }
    .ai-hidden { display: none !important; }
    .ai-foot { color: var(--vscode-descriptionForeground); margin: 2.4em 0 0; max-width: 60em;
               border-top: 1px solid var(--vscode-panel-border); padding-top: 1em; }
  `;

  const body = `${hero({
    title: 'The AI',
    mark: 'sparkle',
    desc: 'A model on this machine, answering about your own pages. It runs on loopback, starts when it is needed, and nothing is sent anywhere.',
    descWide: true,
    actions: [
      { label: 'Show the panel', command: 'temcoAi.openPanel', mark: 'panel', kind: 'primary' as const },
      { label: 'Put it back in the right side bar', command: 'temcoAi.dockRight', mark: 'sidebar', kind: 'link' as const }
    ]
  })}
<div class="mt-24" id="status"></div>
<div id="downloads">
  <div class="mt-24">${section({ title: 'Runtimes', desc: 'The engine that does the work, compiled per platform — the build marked suggested is the one for this machine.' })}</div>
  <div id="runtimes"></div>
  <div class="mt-24">${section({ title: 'Models', desc: 'What the engine reads. Permissive licences only; each shows its licence and what it needs before it is downloaded.' })}</div>
  <div id="models"></div>
  <div class="mt-24 ai-hidden" id="alsoWrap">${section({ title: 'Also in the folder', desc: 'Files in the model folder that this list does not know about — installed elsewhere, or left by an older version.' })}<div id="also"></div></div>
</div>
<p class="ai-foot" id="foot"></p>
`;

  return page(body, { title: 'The AI', extraCss: style, script: CLIENT });
}

const CLIENT = `
const vscode = acquireVsCodeApi();
const $ = (id) => document.getElementById(id);
let selection = { runtime: '', model: '' };

// A button carrying data-command names a real command — the kit's bridge, which every page of ours uses. The rest of
// the page speaks the small message protocol below, because a download is not a command.
document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-command]');
  if (!target) { return; }
  event.preventDefault();
  const args = target.dataset.args;
  vscode.postMessage({
    type: 'command',
    command: target.dataset.command,
    args: args === undefined ? undefined : JSON.parse(args),
  });
});

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) { node.className = cls; }
  if (text !== undefined) { node.textContent = text; }
  return node;
}

/** One glyph from the page's sprite, so this page draws the same marks as every other. */
function mark(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '#i-' + name);
  svg.append(use);
  return svg;
}

function button(text, kind, onClick, disabled) {
  const cls = kind === 'primary' ? 'az-btn az-btn--sm az-btn--primary'
    : kind === 'link' ? 'az-btn az-btn--sm az-btn--link'
      : 'az-btn az-btn--sm';
  const node = el('button', cls);
  node.type = 'button';
  node.append(el('span', null, text));
  node.disabled = Boolean(disabled);
  node.addEventListener('click', onClick);
  return node;
}

function badge(text, tone, title) {
  const node = el('span', 'badge' + (tone ? ' badge--' + tone : ''), text);
  if (title) { node.title = title; }
  return node;
}

/** One entry lying on its side, as the kit draws it: the mark, the name, and the lines about it. */
function entry(markName, title, lines) {
  const row = el('div', 'az-entry');
  const icon = el('span', 'az-entry__icon');
  icon.append(mark(markName));
  const main = el('div', 'az-entry__main');
  main.append(el('span', 'az-entry__title', title));
  for (const line of lines.filter(Boolean)) { main.append(el('span', 'az-entry__meta', line)); }
  row.append(icon, main);
  return row;
}

/** The entry, then whatever belongs at its right-hand end. */
function rowOf(parts) {
  const row = el('div', 'ai-row');
  row.append(...parts);
  return row;
}

function fact(label, value, wide) {
  const div = el('div', wide ? 'wide' : null);
  div.append(el('dt', null, label), el('dd', null, value));
  return div;
}

/** Which of the installed things the server starts with — asked here, because it is what the server is. */
function pick(labelText, entries, key) {
  const wrap = el('div');
  const label = el('label', null, labelText);
  label.setAttribute('for', 'pick-' + key);
  const select = el('select');
  select.id = 'pick-' + key;
  const none = el('option', null, '— not chosen —');
  none.value = '';
  select.append(none);
  for (const item of entries) {
    if (!item.installed) { continue; }
    const option = el('option', null, item.label);
    option.value = item.id;
    option.selected = item.id === selection[key];
    select.append(option);
  }
  if (select.options.length === 1) {
    const option = el('option', null, 'nothing installed yet');
    option.disabled = true;
    select.append(option);
  }
  // Both are always sent: the settings are two keys, and the server needs both to start.
  select.addEventListener('change', () => {
    selection[key] = select.value;
    vscode.postMessage({ type: 'apply', runtime: selection.runtime, model: selection.model });
  });
  wrap.append(label, select);
  return wrap;
}

/** The server, in one card: what it would start with, what it is doing, and the four things to do about it. */
function renderServer(data) {
  const facts = data.facts;
  selection = { runtime: data.chosen.runtime, model: data.chosen.model };

  const card = el('div', 'card card--plain');
  const head = el('div', 'card__head');
  const icon = el('span', 'card__icon');
  icon.append(mark('server'));
  head.append(icon, el('div', 'card__title', 'The server'));
  const actions = el('div', 'card__actions');
  actions.append(
    facts.busy
      ? badge('starting…', 'warn')
      : facts.running ? badge('running', 'ok') : badge('not running')
  );
  head.append(actions);
  card.append(head);

  const picks = el('div', 'ai-pick');
  picks.append(pick('Runtime', data.runtimes, 'runtime'), pick('Model', data.models, 'model'));
  card.append(picks);

  const list = el('dl', 'ai-facts');
  list.append(
    fact('Instructions', facts.promptVersion),
    fact('Listening on', facts.running || 'nothing yet'),
    fact('This machine', facts.machine || 'it could not be read'),
    fact('Where they live', facts.root, true)
  );
  card.append(list);

  const row = el('div', 'az-row');
  const controls = [
    facts.running
      ? button('Stop the server', null, () => vscode.postMessage({ type: 'stop' }))
      : button(
        facts.busy ? 'Starting…' : 'Start the server',
        'primary',
        () => vscode.postMessage({ type: 'start' }),
        Boolean(facts.busy) || !facts.model || !facts.runtime
      ),
    button('Show the log', null, () => vscode.postMessage({ type: 'log' })),
    button('Open the model folder', null, () => vscode.postMessage({ type: 'folder' }))
  ];
  if (!facts.running) {
    controls.push(button('Pick from a list…', 'link', () => vscode.postMessage({ type: 'models' })));
  }
  row.append(...controls);
  card.append(row);

  $('status').replaceChildren(card);
}

/** One thing that can be downloaded, or one that is already here: what it is, what it needs, and the one control. */
function renderEntry(item) {
  const parts = [item.licence, item.size];
  if (item.platform) { parts.push(item.platform); }
  if (item.needs) { parts.push(item.needs); }
  if (item.fit && item.suggested) { parts.push(item.fit); }

  const lines = [parts.join(' · ')];
  if (item.fit && !item.suggested) { lines.push(item.fit); }
  if (item.path) { lines.push('Installed: ' + item.path); }

  const trailing = [];
  if (item.suggested && !item.installed) {
    trailing.push(badge('suggested', 'ok', 'the build for this machine'));
  }
  if (!item.pinned) {
    trailing.push(badge('checksum not pinned', 'warn', 'the download is checked against the recorded size and hash when there is one'));
  }
  if (item.installed) {
    trailing.push(badge('installed', 'info'));
    trailing.push(button('Remove', null, () => vscode.postMessage({ type: 'remove', id: item.id })));
  } else {
    trailing.push(
      button(
        item.busy ? 'Downloading…' : 'Download',
        item.suggested ? 'primary' : null,
        () => vscode.postMessage({ type: 'download', id: item.id }),
        item.busy
      )
    );
  }

  return rowOf([entry(item.kind === 'runtime' ? 'server' : 'package', item.label, lines), ...trailing]);
}

/** The runtimes: this machine's build first, the other platforms folded away. */
function renderRuntimes(data) {
  const mine = data.runtimes.filter((item) => item.suggested || item.installed);
  const others = data.runtimes.filter((item) => !item.suggested && !item.installed);
  const host = $('runtimes');
  host.replaceChildren();

  if (mine.length === 0) {
    // Nothing matched this machine: the list is then just the list, rather than an empty first line.
    host.append(...data.runtimes.map(renderEntry));
    return;
  }
  host.append(...mine.map(renderEntry));
  if (others.length > 0) {
    const more = el('details', 'ai-more');
    const summary = el('summary', null, others.length === 1 ? 'Another platform' : 'Other platforms (' + others.length + ')');
    more.append(summary);
    const body = el('div');
    body.append(...others.map(renderEntry));
    more.append(body);
    host.append(more);
  }
}

/** The models: the one for this machine first, then the rest of the ladder. */
function renderModels(data) {
  const ordered = data.models.slice().sort((a, b) => Number(b.suggested) - Number(a.suggested));
  $('models').replaceChildren(...ordered.map(renderEntry));
}

/** Anything on disk this list cannot name — kept visible, because a file that is there is a fact. */
function renderAlso(data) {
  const known = new Set([...data.runtimes, ...data.models].map((item) => item.id));
  const unknown = data.installed.filter((artifact) => !known.has(artifact.id));
  $('alsoWrap').classList.toggle('ai-hidden', unknown.length === 0);
  $('also').replaceChildren(
    ...unknown.map((artifact) =>
      rowOf([
        entry(
          artifact.kind === 'runtime' ? 'server' : 'package',
          artifact.label,
          [artifact.kind + ' · ' + artifact.bytes + ' · added ' + artifact.at, artifact.path]
        ),
        button('Remove', null, () => vscode.postMessage({ type: 'remove', id: artifact.id }))
      ])
    )
  );
}

function render(data) {
  renderServer(data);
  renderRuntimes(data);
  renderModels(data);
  renderAlso(data);
  $('foot').textContent =
    'Removing one deletes that file and nothing else: the settings keep the choice, and the server says it is ' +
    'missing until another is installed.';
}

window.addEventListener('message', (event) => {
  if (event.data.type === 'ai') {
    render(event.data);
  }
  if (event.data.type === 'scroll') {
    // Asked for a section: the page is long and "choose a model" means the downloads, not the top.
    const target = document.getElementById(event.data.to);
    if (target) { target.scrollIntoView({ block: 'start' }); }
  }
});

vscode.postMessage({ type: 'ready' });
`;
