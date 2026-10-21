// The working area: our own folder, outside every repository.
//
// A source is cloned here so that its **files** can be read. A page is written from code, and code that exists
// only behind an API is one file per call, no history, and no working tree for a build. The clone is a copy we
// own: **nothing is ever written to the origin, and nothing is ever pushed.**
//
//   <root>/<project>/<source>/     the clone — one branch, full history
//   <root>/<project>/work/         what we make: drafts, notes. Files, not state.
//
// `<root>` is the `temcoRepositories.workspaceFolder` setting, or `~/Temco`, visible on purpose so it can
// be looked at, moved and deleted with the file manager. The catalog stays the single index of what was read; it
// is SQLite in the extension's own storage and is never duplicated here.
//
// Cloning is **never automatic**. A first read says that a local copy would help and offers one; from then on the
// act is a menu entry or a page button, and every one of them names the folder it will write to first.
//
// One branch and full history, not `--depth 1`: the branch is the one the read uses, and the history is what a
// draft reads and what a stale check needs. A shallow clone would break both.

import { execFile } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { Catalog, Selection, slugOf } from './store';

/** How long a git command may take. A clone of a large repository is slow; an hour is not an answer either. */
const GIT_TIMEOUT_MS = 30 * 60 * 1000;

/** The root of the working area: the setting, or a visible folder in the user's home. */
export function workRoot(): string {
  const configured = vscode.workspace.getConfiguration('temcoRepositories').get<string>('workspaceFolder');
  return configured !== undefined && configured.trim().length > 0
    ? expandHome(configured.trim())
    : path.join(os.homedir(), 'Temco');
}

/** The folder one project owns: its clones and what we make from them. */
export function projectFolder(project: string): string {
  return path.join(workRoot(), slugOf(project));
}

/** The folder one source is cloned into. */
export function cloneFolder(project: string, source: string): string {
  return path.join(projectFolder(project), slugOf(source));
}

/** Whether a clone is really there — a folder with a `.git` in it, not an empty directory. */
export async function hasClone(project: string, source: string): Promise<boolean> {
  try {
    await fs.stat(path.join(cloneFolder(project, source), '.git'));
    return true;
  } catch {
    return false;
  }
}

/** What git says the clone costs, which is the number a person cares about before removing it. */
export async function cloneSize(project: string, source: string): Promise<string | undefined> {
  const result = await git(['count-objects', '-vH'], cloneFolder(project, source));
  const match = /size-pack:\s*([\d.]+\s*\w+)/.exec(result.output);
  return match?.[1];
}

export function registerWorkareaCommands(
  context: vscode.ExtensionContext,
  selection: Selection,
  output: vscode.OutputChannel,
  refresh: () => void
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('temcoRepositories.fetchSource', (target?: unknown) =>
      fetchSource(context, selection, output, refresh, slugOfTarget(target))
    ),
    // The same clone, asked for by something that needs the *files* rather than the person: a draft, an analysis. It
    // returns the folder instead of reporting, and still asks before it writes anything to the machine.
    vscode.commands.registerCommand('temcoRepositories.ensureClone', (target?: unknown) =>
      ensureClone(context, selection, output, refresh, slugOfTarget(target))
    ),
    vscode.commands.registerCommand('temcoRepositories.pullSource', (target?: unknown) =>
      pullSource(context, selection, output, refresh, slugOfTarget(target))
    ),
    vscode.commands.registerCommand('temcoRepositories.openClone', (target?: unknown) =>
      openClone(context, selection, slugOfTarget(target))
    ),
    vscode.commands.registerCommand('temcoRepositories.removeClone', (target?: unknown) =>
      removeClone(context, selection, refresh, slugOfTarget(target))
    ),
    // Kept for the palette entry that existed before the folder dialog: one command does the work, the other names it.
    vscode.commands.registerCommand('temcoRepositories.changeWorkspaceFolder', () =>
      vscode.commands.executeCommand('temcoRepositories.pickWorkspaceFolder')
    ),
    vscode.commands.registerCommand('temcoRepositories.openWorkFolder', () => openProjectFolder(selection))
  );
}

/**
 * Fetch a source: clone it into the project's folder in the working area.
 *
 * After the clone the catalog records **where** the copy is, so the source is read from disk from then on — the
 * same read, with the working tree behind it: the registry and its checks, the code files, and the history.
 */
async function fetchSource(
  context: vscode.ExtensionContext,
  selection: Selection,
  output: vscode.OutputChannel,
  refresh: () => void,
  wanted?: string
): Promise<void> {
  const project = selection.project();
  const source = await sourceOf(context, wanted);
  if (source === undefined) {
    return;
  }
  if (project === undefined) {
    void vscode.window.showInformationMessage(
      'Temco Repositories: the working area belongs to the project being worked on. Choose one first.',
      'Projects'
    ).then((answer) => {
      if (answer === 'Projects') {
        void vscode.commands.executeCommand('temcoDocs.projects');
      }
    });
    return;
  }
  if (source.remoteUrl === undefined || source.remoteUrl.length === 0) {
    void vscode.window.showInformationMessage(
      `Temco Repositories: ${source.name} is a folder on this machine, so it needs no clone.`
    );
    return;
  }

  const folder = cloneFolder(project, source.name);
  if (await hasClone(project, source.name)) {
    void vscode.window.showInformationMessage(`Temco Repositories: ${source.name} already has a local copy.`, 'Pull it').then(
      (answer) => {
        if (answer === 'Pull it') {
          void vscode.commands.executeCommand('temcoRepositories.pullSource', wanted);
        }
      }
    );
    return;
  }

  const answer = await vscode.window.showWarningMessage(
    `Clone ${source.name} into ${folder}?`,
    {
      modal: true,
      detail:
        `One branch (${source.branch ?? source.defaultBranch ?? 'the default'}), full history — the history is what a draft reads ` +
        'and what the stale check needs. Nothing is ever written to the repository, and nothing is pushed.',
    },
    'Clone it'
  );
  if (answer !== 'Clone it') {
    return;
  }

  await fs.mkdir(path.dirname(folder), { recursive: true });
  const args = ['clone', '--single-branch', ...(source.branch ? ['--branch', source.branch] : []), source.remoteUrl, folder];
  const result = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Temco Repositories: cloning ${source.name}` },
    () => git(args, undefined, output)
  );
  if (!result.ok) {
    void vscode.window.showErrorMessage(`Temco Repositories: ${source.name} could not be cloned. ${firstLine(result.output)}`);
    return;
  }

  await withCatalog(context, (catalog) => catalog.setSourcePath(source.slug, folder));
  output.appendLine(`[work] ${source.name} cloned into ${folder}`);
  refresh();
  void vscode.window.showInformationMessage(
    `Temco Repositories: ${source.name} has a local copy. Read it again to work from the files.`,
    'Read it'
  ).then((choice) => {
    if (choice === 'Read it') {
      void vscode.commands.executeCommand('temcoRepositories.readSource', source.slug);
    }
  });
}

/**
 * The folder to read a source's **files** from, cloning it if there is no copy yet.
 *
 * A person asking for a draft or an analysis is asking for code to be read; a source read over the API has no
 * working tree, so the answer is a clone in the working area. The person is still asked first — the platform
 * never writes a repository to the disk without a yes — but the dialog is the one question in the middle of the
 * act they started, not a detour to another page.
 */
async function ensureClone(
  context: vscode.ExtensionContext,
  selection: Selection,
  output: vscode.OutputChannel,
  refresh: () => void,
  wanted?: string
): Promise<{ path?: string; error?: string }> {
  const project = selection.project();
  const source = await sourceOf(context, wanted);
  if (source === undefined) {
    return { error: 'That source is not in the catalog.' };
  }
  if (project === undefined) {
    return { error: 'No project is being worked on, so there is no working area to clone into.' };
  }
  if (source.path !== undefined && source.remoteUrl === undefined) {
    // A folder on this machine is already the code.
    return { path: source.path };
  }
  if (source.remoteUrl === undefined || source.remoteUrl.length === 0) {
    return { error: `${source.name} has no repository URL and no folder, so there is no code to read.` };
  }

  const folder = cloneFolder(project, source.name);
  if (await hasClone(project, source.name)) {
    return { path: folder };
  }

  const answer = await vscode.window.showWarningMessage(
    `Clone ${source.name} into ${folder}?`,
    {
      modal: true,
      detail:
        'The code is read from the local copy: one branch, full history, and nothing is ever pushed back. ' +
        'Without it there are no files to draft from.',
    },
    'Clone it'
  );
  if (answer !== 'Clone it') {
    return { error: 'No local copy, so there are no files to read.' };
  }

  await fs.mkdir(path.dirname(folder), { recursive: true });
  const args = ['clone', '--single-branch', ...(source.branch ? ['--branch', source.branch] : []), source.remoteUrl, folder];
  const result = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Temco Repositories: cloning ${source.name}` },
    () => git(args, undefined, output)
  );
  if (!result.ok) {
    return { error: `${source.name} could not be cloned. ${firstLine(result.output)}` };
  }

  await withCatalog(context, (catalog) => catalog.setSourcePath(source.slug, folder));
  output.appendLine(`[work] ${source.name} cloned into ${folder}`);
  refresh();
  return { path: folder };
}

/** Pull a source's local copy, and read it again: the counts a list shows are about a revision. */async function pullSource(
  context: vscode.ExtensionContext,
  selection: Selection,
  output: vscode.OutputChannel,
  refresh: () => void,
  wanted?: string
): Promise<void> {
  const project = selection.project();
  const source = await sourceOf(context, wanted);
  if (source === undefined || project === undefined) {
    return;
  }
  const folder = cloneFolder(project, source.name);
  if (!(await hasClone(project, source.name))) {
    void vscode.window.showInformationMessage(
      `Temco Repositories: ${source.name} has no local copy yet.`,
      'Fetch it'
    ).then((answer) => {
      if (answer === 'Fetch it') {
        void vscode.commands.executeCommand('temcoRepositories.fetchSource', wanted);
      }
    });
    return;
  }

  // `--ff-only`: a local copy is a copy. Nothing here resolves a merge, and nothing here commits.
  const result = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Temco Repositories: pulling ${source.name}` },
    () => git(['pull', '--ff-only'], folder, output)
  );
  if (!result.ok) {
    void vscode.window.showErrorMessage(
      `Temco Repositories: ${source.name} could not be pulled. ${firstLine(result.output)}`
    );
    return;
  }
  refresh();
  void vscode.window.showInformationMessage(
    `Temco Repositories: ${source.name} is up to date with its branch.`,
    'Read it again'
  ).then((choice) => {
    if (choice === 'Read it again') {
      void vscode.commands.executeCommand('temcoRepositories.readSource', source.slug);
    }
  });
}

/** Show a local copy in the file manager — the ordinary way to look at what was cloned. */
async function openClone(context: vscode.ExtensionContext, selection: Selection, wanted?: string): Promise<void> {
  const project = selection.project();
  const source = await sourceOf(context, wanted);
  if (source === undefined || project === undefined) {
    return;
  }
  const folder = cloneFolder(project, source.name);
  if (!(await hasClone(project, source.name))) {
    void vscode.window.showInformationMessage(`Temco Repositories: ${source.name} has no local copy.`);
    return;
  }
  await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(folder));
}

/** Remove a local copy: the folder only. The repository, the catalog row and the project are untouched. */
async function removeClone(
  context: vscode.ExtensionContext,
  selection: Selection,
  refresh: () => void,
  wanted?: string
): Promise<void> {
  const project = selection.project();
  const source = await sourceOf(context, wanted);
  if (source === undefined || project === undefined) {
    return;
  }
  const folder = cloneFolder(project, source.name);
  if (!(await hasClone(project, source.name))) {
    void vscode.window.showInformationMessage(`Temco Repositories: ${source.name} has no local copy.`);
    return;
  }
  const size = await cloneSize(project, source.name);
  const answer = await vscode.window.showWarningMessage(
    `Remove the local copy of ${source.name}?`,
    {
      modal: true,
      detail:
        `${folder}${size ? ` (${size})` : ''} is deleted from this machine. The repository is not touched, ` +
        'and the source stays in the catalog — it is read over the API again until a copy is fetched.',
    },
    'Remove it'
  );
  if (answer !== 'Remove it') {
    return;
  }

  await fs.rm(folder, { recursive: true, force: true });
  await withCatalog(context, (catalog) => catalog.setSourcePath(source.slug, undefined));
  refresh();
}

/** Show the project's own folder: where its clones and what we make from them live. */
async function openProjectFolder(selection: Selection): Promise<void> {
  const project = selection.project();
  if (project === undefined) {
    void vscode.window.showInformationMessage('Temco Repositories: no project is being worked on.');
    return;
  }
  const folder = projectFolder(project);
  await fs.mkdir(folder, { recursive: true });
  await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(folder));
}

// ------------------------------------------------------------------ helpers

/** A source's coordinates, by slug. A menu entry hands us a slug; the palette hands us nothing. */
async function sourceOf(
  context: vscode.ExtensionContext,
  wanted?: string
): Promise<{ slug: string; name: string; remoteUrl?: string; branch?: string; defaultBranch?: string; path?: string } | undefined> {
  let catalog: Catalog | undefined;
  try {
    catalog = await Catalog.open(context);
    const rows = catalog.sources();
    const slug = wanted !== undefined && catalog.source(wanted) !== undefined ? wanted : rows[0]?.slug;
    if (slug === undefined) {
      void vscode.window.showInformationMessage('Temco Repositories: no source has been recorded yet.');
      return undefined;
    }
    const detail = catalog.source(slug);
    return detail === undefined
      ? undefined
      : {
          slug,
          name: detail.name,
          remoteUrl: detail.remoteUrl,
          branch: detail.branch,
          defaultBranch: detail.defaultBranch,
          path: detail.path,
        };
  } catch (error) {
    void vscode.window.showErrorMessage(
      `Temco Repositories: ${error instanceof Error ? error.message : String(error)}`
    );
    return undefined;
  } finally {
    catalog?.close();
  }
}

async function withCatalog(
  context: vscode.ExtensionContext,
  run: (catalog: Catalog) => void
): Promise<void> {
  let catalog: Catalog | undefined;
  try {
    catalog = await Catalog.open(context);
    run(catalog);
  } catch {
    // Recording where the copy is, is not worth a second error on top of the one that already happened.
  } finally {
    catalog?.close();
  }
}

/**
 * Run git and report it.
 *
 * `git` has to be on the machine — the same bargain as `gh` for the token and the platform's own `tar` for
 * unpacking. It is run as a child process, never through a shell, so no repository name can become a command.
 */
async function git(
  args: readonly string[],
  cwd: string | undefined,
  output?: vscode.OutputChannel
): Promise<{ ok: boolean; output: string }> {
  const line = `git ${args.join(' ')}${cwd ? `   (in ${cwd})` : ''}`;
  output?.appendLine(`[work] ${line}`);
  return new Promise((resolve) => {
    execFile(
      'git',
      [...args],
      { cwd, timeout: GIT_TIMEOUT_MS, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const text = `${stdout ?? ''}${stderr ?? ''}`.trim();
        if (text.length > 0) {
          output?.appendLine(text);
        }
        if (error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
          resolve({ ok: false, output: 'git was not found on this machine. Install git and try again.' });
          return;
        }
        resolve({ ok: error === null, output: text });
      }
    );
  });
}

function firstLine(text: string): string {
  const line = text.split('\n').map((one) => one.trim()).filter((one) => one.length > 0).pop();
  return line ?? 'See the Temco Repositories output for what git said.';
}

/** A menu entry hands us a slug; a row hands us something with one. Both leave as a slug or nothing. */
function slugOfTarget(target: unknown): string | undefined {
  if (typeof target === 'string' && target.length > 0) {
    return target;
  }
  if (target !== null && typeof target === 'object') {
    const slug = (target as { slug?: unknown }).slug;
    if (typeof slug === 'string' && slug.length > 0) {
      return slug;
    }
  }
  return undefined;
}

function expandHome(value: string): string {
  if (value === '~') {
    return os.homedir();
  }
  return value.startsWith('~/') || value.startsWith('~\\')
    ? path.join(os.homedir(), value.slice(2))
    : value;
}
