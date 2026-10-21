// The repositories module's settings, as a page.
//
// Two settings decide what the dashboard does before anything else can: which enterprise it opens on, and where a
// download lands. Both are plain VS Code settings — this page exists because a person should not have to know that,
// and because the same page is where the GitHub token is set and cleared.
//
// Every write goes through `configuration.update(..., Global)`: the same place the settings JSON writes to, so the two
// surfaces can never disagree.

import * as vscode from 'vscode';
import { tokenOf } from './read';
import { page, pageColumn } from './ui';
import { workRoot } from './workarea';

export const REPOSITORY_SETTINGS_VIEW_TYPE = 'temcoRepositories.settings';

interface SettingsMessage {
  type?: string;
  organisation?: string;
  workspaceFolder?: string;
}

/** The section every one of these settings lives in. */
const SECTION = 'temcoRepositories';

export class RepositorySettingsPage {
  private panel: vscode.WebviewPanel | undefined;

  constructor(private readonly context: vscode.ExtensionContext, private readonly refresh: () => void) { }

  open(): void {
    if (this.panel) {
      this.panel.reveal(pageColumn());
      void this.send();
      return;
    }
    this.panel = vscode.window.createWebviewPanel(REPOSITORY_SETTINGS_VIEW_TYPE, 'Repository Settings', pageColumn(), {
      enableScripts: true,
      localResourceRoots: [],
    });
    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
    this.panel.webview.onDidReceiveMessage((message: SettingsMessage) => void this.receive(message));
    this.panel.webview.html = html();
    void this.send();
  }

  dispose(): void {
    this.panel?.dispose();
  }

  private async send(): Promise<void> {
    const panel = this.panel;
    if (!panel) {
      return;
    }
    const configuration = vscode.workspace.getConfiguration(SECTION);
    const token = await tokenOf(this.context);
    await panel.webview.postMessage({
      type: 'state',
      organisation: configuration.get<string>('organisation') ?? '',
      workspaceFolder: configuration.get<string>('workspaceFolder') ?? '',
      where: workRoot(),
      hasToken: token !== undefined,
    });
  }

  private async receive(message: SettingsMessage): Promise<void> {
    const configuration = vscode.workspace.getConfiguration(SECTION);
    switch (message.type) {
      case 'save':
        await configuration.update('organisation', (message.organisation ?? '').trim(), vscode.ConfigurationTarget.Global);
        await configuration.update(
          'workspaceFolder',
          (message.workspaceFolder ?? '').trim(),
          vscode.ConfigurationTarget.Global
        );
        this.refresh();
        await this.send();
        return;
      case 'pick':
        await vscode.commands.executeCommand('temcoRepositories.pickWorkspaceFolder');
        this.refresh();
        await this.send();
        return;
      case 'token':
        await vscode.commands.executeCommand('temcoRepositories.setToken');
        await this.send();
        return;
      case 'test':
        await vscode.commands.executeCommand('temcoRepositories.testToken');
        return;
      case 'json':
        await vscode.commands.executeCommand('workbench.action.openSettings', SECTION);
        return;
      default:
        return;
    }
  }
}

function html(): string {
  const style = `
    .form-wide { max-width: none; }
    .form-wide .field > .input { width: 100%; max-width: 46em; }
    .row-actions { display: flex; gap: .5em; align-items: center; flex-wrap: wrap; }
    .note { color: var(--fg-muted); font-size: var(--fs-sm); margin: .2em 0 0; }
    .footer { display: flex; gap: .6em; align-items: center; flex-wrap: wrap; margin: 1.4em 0 0;
              padding-top: 1em; border-top: 1px solid var(--border); }
    .footer__state { color: var(--fg-muted); font-size: var(--fs-sm); }
  `;

  const body = `
  <div class="page-head">
    <div class="page-head__main">
      <div class="eyebrow">Repositories</div>
      <h1 class="page-head__title">Repository settings</h1>
      <p class="page-head__desc">Which enterprise the page opens on, where a download lands, and the token that reaches
        a private repository.</p>
    </div>
    <div class="page-head__actions">
      <button type="button" class="btn btn--ghost" id="json">Open the settings JSON</button>
    </div>
  </div>

  <div class="split__section">
    <div class="split__section-title">Default enterprise</div>
    <p class="split__section-note">The list the Repositories page opens on. <code>temcocontrols</code> is the one the
      platform ships its own documentation from; any organisation or account works.</p>
    <div class="form form-wide">
      <div class="field">
        <label>Organisation</label>
        <input class="input" id="organisation" spellcheck="false" placeholder="temcocontrols">
        <div class="field__hint">Written to <code>temcoRepositories.organisation</code>.</div>
      </div>
    </div>
  </div>

  <div class="split__section">
    <div class="split__section-title">Downloads and drafts</div>
    <p class="split__section-note">Every local copy is cloned here, and a draft written from a repository is written
      here. It is deliberately outside every repository: nothing is ever written to a source, and nothing is pushed.</p>
    <div class="form form-wide">
      <div class="field">
        <label>Folder</label>
        <input class="input" id="workspaceFolder" spellcheck="false" placeholder="~/Temco">
        <div class="row-actions" style="margin-top:8px">
          <button type="button" class="btn btn--sm" id="pick">Choose a folder…</button>
          <span class="note" id="where"></span>
        </div>
        <div class="field__hint">Written to <code>temcoRepositories.workspaceFolder</code>. Empty means
          <code>~/Temco</code>.</div>
      </div>
    </div>
  </div>

  <div class="split__section">
    <div class="split__section-title">GitHub token</div>
    <p class="split__section-note">A private repository needs one, and so does the anonymous allowance running out
      early. The token is kept in the editor's secret storage, never in a file.</p>
    <div class="row-actions">
      <button type="button" class="btn btn--sm" id="token">Set a GitHub token</button>
      <button type="button" class="btn btn--sm btn--ghost" id="test">Test it</button>
      <span class="note" id="token-state"></span>
    </div>
  </div>

  <div class="footer">
    <span class="footer__state" id="state"></span>
    <span style="flex:1"></span>
    <button type="button" class="btn btn--primary" id="save">Save</button>
  </div>
  `;

  return page(body, { title: 'Repository Settings', extraCss: style, script: CLIENT });
}

const CLIENT = `
const vscode = acquireVsCodeApi();
const $ = (id) => document.getElementById(id);
let state = {};

$('pick').addEventListener('click', () => vscode.postMessage({ type: 'pick' }));
$('token').addEventListener('click', () => vscode.postMessage({ type: 'token' }));
$('test').addEventListener('click', () => vscode.postMessage({ type: 'test' }));
$('json').addEventListener('click', () => vscode.postMessage({ type: 'json' }));
$('save').addEventListener('click', () => {
  vscode.postMessage({
    type: 'save',
    organisation: $('organisation').value,
    workspaceFolder: $('workspaceFolder').value
  });
});

window.addEventListener('message', (event) => {
  const message = event.data || {};
  if (message.type !== 'state') { return; }
  state = message;
  // The fields follow the settings, unless a person is typing in one: "Choose a folder…" writes the setting at once,
  // so the input has to catch up with an answer the dialog produced.
  if (document.activeElement !== $('organisation')) {
    $('organisation').value = message.organisation || '';
  }
  if (document.activeElement !== $('workspaceFolder')) {
    $('workspaceFolder').value = message.workspaceFolder || '';
  }
  $('where').textContent = 'Local copies land in ' + message.where;
  $('token-state').textContent = message.hasToken
    ? 'A token is stored. Setting a new one replaces it; leaving the box empty clears it.'
    : 'No token is stored — the list is read anonymously.';
  $('state').textContent = 'Saved to your user settings, not to the workspace.';
});
`;
