// Temco Docs 鈥?activation.
//
// The extension is a reader, of the **project being worked on**: it finds each of that project's sources, shows
// their pages in the Workspace view, and reports structural problems where they can be fixed. The project is the
// front door 鈥?the Library lists what there is, choosing one loads the Workspace, and with none chosen nothing is
// read, so the view can never answer about a folder nobody named. Nothing is written to a page without an
// explicit command, and nothing is published from here at all.

import * as vscode from 'vscode';
import { aiInstalled } from './aiModule';
import { TemcoDocsApi } from './api';
import { registerBuildCommands, registerScriptCommands, scriptsIn } from './builds';
import { publishDiagnostics } from './diagnostics';
import { registerFeedbackCommands } from './feedback';
import { registerFormatCommands } from './format';
import { DocsPages } from './docsPages';
import { NewPagePage } from './newPagePage';
import { OverviewPage } from './overview';
import { PageDeps, PageOperations, registerPageCommands } from './pageOps';
import { projects } from './projects';
import { registerReportCommands } from './report';
import { registerRowCommands } from './rowOps';
import { registerScaffoldCommands } from './scaffold';
import { registerSectionViews } from './sections';
import { Catalog, Selection, selection, slugOf } from './store';
import { fileColumn, pageColumn } from './surface';
import { DocsRoot, DeclaredPage, RegistryError, collectPages, countStale, folderForPath, loadDocsRoot, pageForUri, registryUriFor, rootFromDeclared, totals } from './registry';
import { DocsNode, DocsTreeProvider, TreeNote, pageFromNode } from './tree';

const OUTPUT_NAME = 'Temco Docs';
const VIEW_ID = 'temcoDocs.pages';

interface BrokenRegistry {
  uri: vscode.Uri;
  message: string;
}

export function activate(context: vscode.ExtensionContext): TemcoDocsApi {
  const output = vscode.window.createOutputChannel(OUTPUT_NAME);
  const diagnostics = vscode.languages.createDiagnosticCollection('temcoDocs');
  const provider = new DocsTreeProvider();
  // The selection is the store's: one instance for the window, published by the module that owns the state that
  // outlives this extension. This module reads it and, through the commands, sets it.
  // One signal for the whole platform: the sets were re-read. The AI module's panel listens to it; nothing
  // inside this module does, because everything here is refreshed directly.
  const changed = new vscode.EventEmitter<void>();
  context.subscriptions.push(changed);

  // Filled in once `refresh` exists: a page operation writes, and a write is not visible until the views have
  // been re-read. Passing a holder rather than the function keeps the tree's construction independent of it.
  let redraw = (): void => { };
  // The same holder trick, for the same reason: a page act can be started from the view's toolbar or from the
  // palette, where nothing names a row, and there the row the person has selected is the one they mean.
  let selectedRow = (): DocsNode | undefined => undefined;
  // And once more for the page that creates a page: every act that makes one opens it, and the page writes
  // through the same dependencies the tree's own commands use 鈥?so there is one write, not two.
  let newPagePage: NewPagePage | undefined = undefined;
  // One guide per window: opening it again reveals the tab rather than stacking a second copy of the same page.
  const docsPages = new DocsPages(context);
  context.subscriptions.push(docsPages);
  // The documentation itself, as a page: counts, areas, what is behind its source, and the checks.
  const overviewPage = new OverviewPage(context, () => roots);
  context.subscriptions.push(overviewPage);
  const pageDeps: PageDeps = {
    roots: () => roots,
    output,
    redraw: () => redraw(),
    selected: () => selectedRow(),
    newPagePage: (seed) => newPagePage?.open(seed),
  };
  const pageOps = new PageOperations(pageDeps);

  const treeView = vscode.window.createTreeView(VIEW_ID, {
    treeDataProvider: provider,
    showCollapseAll: true,
    // A chapter is somewhere a page can be put, and the drop is a registry write 鈥?see `src/pageOps.ts`.
    dragAndDropController: pageOps,
  });
  selectedRow = () => treeView.selection[0];

  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  status.command = 'temcoDocs.validate';
  context.subscriptions.push(output, diagnostics, treeView, status);

  let roots: DocsRoot[] = [];
  /**
   * Whether the single project has been allowed to select itself yet 鈥?once per window, at the first read.
   *
   * It must not be allowed again: with one project, *Stop working on it* would be impossible, because clearing
   * the selection would re-make it on the very next refresh, and the view would never go away.
   */
  let picked = false;

  // The tree is this module's own view. The Library, the dashboard and the needs page are the workbench's, and
  // they read this module's model through the API at the bottom of `activate()`.

  // The page behind the *Documentation Owed* row, and the form that creates a page.

  // The side bar's groups, as the mock draws them: Projects, Sources, Areas, Pipeline, How-To — the Docs Explorer
  // is the tree of pages, and is registered above with the rest of the view.
  registerSectionViews(context);

  const refresh = async (): Promise<void> => {
    const broken: BrokenRegistry[] = [];
    roots = [];

    // The catalog is read before anything else, for the two facts the rest of this depends on: **which project
    // is being worked on** 鈥?with exactly one recorded there is nothing to choose between, so it chooses itself
    // 鈥?and **whether there is one at all**, which is what the Workspace view's empty state has to say.
    const projects = await chooseProject(context, selection, !picked);
    picked = true;

    // **One world.** The project being worked on decides what is read: each of its sources, whether or not the
    // folder is open in this window, and what a read recorded for the sources that are not here at all. With
    // nothing selected nothing is read 鈥?the Workspace view is about the project, and a tree built from whatever
    // happens to be open would be a second, unrelated answer to the same question.
    const selected = selection.project();
    const read: { folder: vscode.WorkspaceFolder; source?: ReadableSource }[] = [];
    const recorded: DocsRoot[] = [];
    let projectName: string | undefined;

    if (selected !== undefined) {
      const project = await projectSources(context, selected);
      if (project.missing) {
        // The project was removed while it was the one being worked on. Clear the selection and let the next
        // run read nothing, rather than showing a view about something that is not there.
        await selection.select(undefined);
        return;
      }
      projectName = project.name;
      for (const source of project.sources) {
        if (source.path !== undefined) {
          read.push({ folder: folderForPath(source.path, source.name), source });
        } else if (source.pages.length > 0) {
          recorded.push(rootFromDeclared(source.name, source.pages));
        }
      }
    }

    for (const { folder, source } of read) {
      try {
        const root = await loadDocsRoot(folder);
        if (root) {
          roots.push(root);
        } else if (source !== undefined && source.pages.length > 0) {
          // A source with no registry is not a hole: what the read recorded is what the view shows.
          recorded.push(rootFromDeclared(source.name, source.pages));
        }
      } catch (error) {
        broken.push({
          uri: registryUriFor(folder),
          message: error instanceof RegistryError ? error.message : messageOf(error),
        });
      }
    }
    roots.push(...recorded);

    // Why the list is empty, said *in* the list, so the view is never a blank pane and the row carries the one
    // act that fills it. `viewsWelcome` was tried first and dropped: its `when` clause is resolved at the view's
    // first paint, which is before the refresh has read anything, so it kept saying "nothing recorded yet" over a
    // catalog that had five projects in it.
    const notes: TreeNote[] = [];
    if (roots.length === 0) {
      notes.push(
        selected !== undefined
          ? {
            label: `${projectName ?? selected} has nothing to show`,
            detail: 'its sources have not been read, or they hold no pages',
            command: { command: 'temcoProjects.openProject', args: [selected] },
          }
          : (projects ?? 0) > 0
            ? {
              label: 'No project is being worked on',
              detail: 'choose one in the Library',
              command: { command: 'temcoDocs.section.projects.focus' },
            }
            : {
              label: 'No project yet',
              detail: 'a project is what you manage 鈥?create one, then give it a source',
              command: { command: 'temcoProjects.newProject' },
            }
      );
    }
    for (const { message } of broken) {
      notes.push({ label: 'A source could not be read', detail: message });
    }

    provider.setRoots(roots, notes);
    // The view says which project it is showing: it answers about a project, never about the window, and a view
    // that silently answers a different question is worse than an empty one.
    treeView.description = projectName
      ? `${projectName} 路 ${totals(roots).pages} pages`
      : undefined;
    publishDiagnostics(diagnostics, roots);
    for (const { uri, message } of broken) {
      diagnostics.set(uri, [
        new vscode.Diagnostic(new vscode.Range(0, 0, 0, 0), message, vscode.DiagnosticSeverity.Error),
      ]);
    }
    updateStatus(status, roots, broken);
    // The AI module's panel and the workbench's three surfaces are the surfaces this module does not own: they
    // are told, by the one signal.
    overviewPage.refresh();
    changed.fire();
  };

  const report = async (): Promise<void> => {
    await refresh();
    const sums = totals(roots);
    output.appendLine('');
    output.appendLine(`Temco Docs ${String(context.extension.packageJSON.version ?? '')}`.trim());
    output.appendLine(`Repositories with a registry: ${roots.length}`);

    for (const root of roots) {
      const stale = countStale(collectPages(root));
      output.appendLine(
        `  ${root.folder.name}: ${root.pages} pages 路 ${root.errors} errors 路 ${root.warnings} warnings 路 ` +
        `${root.neverReviewed} never reviewed 路 ${root.unshipped} not shipped${stale > 0 ? ` 路 ${stale} stale` : ''}`
      );
      for (const problem of root.problems) {
        output.appendLine(`    ${problem.severity}: ${problem.message}`);
      }
      for (const page of collectPages(root).filter((entry) => entry.issues.length > 0)) {
        output.appendLine(`    ${page.id}`);
        for (const issue of page.issues) {
          output.appendLine(`      ${issue.severity}: ${issue.message}`);
        }
      }
    }

    output.show(true);

    if (sums.issues === 0) {
      void vscode.window.showInformationMessage(`Temco Docs: ${sums.pages} pages, no structural problems.`);
      return;
    }
    const answer = await vscode.window.showWarningMessage(
      `Temco Docs: ${sums.pages} pages, ${sums.errors} errors and ${sums.warnings} warnings.`,
      'Show Problems'
    );
    if (answer === 'Show Problems') {
      void vscode.commands.executeCommand('workbench.actions.view.problems');
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('temcoDocs.showStatus', report),
    vscode.commands.registerCommand('temcoDocs.validate', report),
    vscode.commands.registerCommand('temcoDocs.refresh', refresh),
    // The guide: five steps that run the commands the rest of the platform already owns.
    vscode.commands.registerCommand('temcoDocs.howTo', () => docsPages.howTo()),
    // The Documentation container's surfaces, rebuilt from the mock: projects, repositories, sources,
    // documents, a page, a source, review, builds and releases.
    vscode.commands.registerCommand('temcoDocs.projects', () => docsPages.projects()),
    vscode.commands.registerCommand('temcoDocs.repositories', () => docsPages.repositories()),
    vscode.commands.registerCommand('temcoDocs.repository', (name?: unknown) => docsPages.repository(typeof name === 'string' ? name : undefined)),
    vscode.commands.registerCommand('temcoDocs.sources', () => docsPages.sources()),
    vscode.commands.registerCommand('temcoDocs.documents', (area?: unknown) => docsPages.documents(typeof area === 'string' ? area : undefined)),
    vscode.commands.registerCommand('temcoDocs.page', (title?: unknown, area?: unknown) => docsPages.pageOf(typeof title === 'string' ? title : undefined, typeof area === 'string' ? area : undefined)),
    vscode.commands.registerCommand('temcoDocs.source', (repo?: unknown) => docsPages.source(typeof repo === 'string' ? repo : undefined)),
    vscode.commands.registerCommand('temcoDocs.review', () => docsPages.review()),
    vscode.commands.registerCommand('temcoDocs.builds', () => docsPages.builds()),
    vscode.commands.registerCommand('temcoDocs.releases', () => docsPages.releases()),
    // What is being read, in one page: the tree answers where a page is, this answers what it all is.
    vscode.commands.registerCommand('temcoDocs.overview', () => overviewPage.open()),

    vscode.commands.registerCommand('temcoDocs.openRegistry', async (node?: DocsNode) => {
      const uri = rootOf(node ?? selectedRow(), roots)?.registryUri;
      if (!uri) {
        void vscode.window.showInformationMessage('Temco Docs: no registry in this workspace.');
        return;
      }
      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(document, { preview: false, viewColumn: fileColumn() });
    }),

    vscode.commands.registerCommand('temcoDocs.openPage', async (node?: DocsNode) => {
      const page = pageFromNode(node ?? selectedRow());
      if (!page) {
        return;
      }
      if (!page.page.exists) {
        const answer = await vscode.window.showWarningMessage(
          `No file for "${page.page.title}".`,
          'Create Page',
          'Open Registry'
        );
        if (answer === 'Create Page') {
          await createPage(page.page.uri, page.page.title);
        } else if (answer === 'Open Registry') {
          await vscode.commands.executeCommand('temcoDocs.openRegistry', node ?? selectedRow());
        }
        await refresh();
        return;
      }
      const document = await vscode.workspace.openTextDocument(page.page.uri);
      // Beside the dashboard rather than in its place: a page must never look as if the dashboard swallowed it.
      await vscode.window.showTextDocument(document, {
        preview: false,
        viewColumn: fileColumn(),
      });
      // The page you were on is what the AI answers about when no editor is in front.
      const project = selection.project();
      if (project !== undefined && page.page.uri.scheme === 'file') {
        await selection.rememberPage({
          project,
          id: page.page.id,
          title: page.page.title,
          path: page.page.uri.fsPath,
        });
      }
    }),

    // The home page lists the folders this editor has open, so it still has to hear about a change to them;
    // nothing the Workspace view reads depends on them any more.
    vscode.workspace.onDidChangeWorkspaceFolders(() => void refresh())
  );

  // Three files change what the view shows: the registry 鈥?the shape of the tree 鈥?and the two generated
  // neighbours, which carry the provenance and headings the items display. Everything else, including
  // saving a page, does not refresh: the tree describes structure, not prose.
  for (const pattern of [
    '**/docs/help/registry.json',
    '**/docs/help/index.json',
    '**/docs/help/page-meta.json',
  ]) {
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    context.subscriptions.push(
      watcher,
      watcher.onDidChange(() => void refresh()),
      watcher.onDidCreate(() => void refresh()),
      watcher.onDidDelete(() => void refresh())
    );
  }

  // What the other modules may look for. The AI module tests this before it offers a row or a menu entry, so an
  // install without it never shows a door that does not open.
  void vscode.commands.executeCommand('setContext', 'temcoDocs.aiInstalled', aiInstalled());
  registerBuildCommands(context, () => roots, output);
  // The repository's own maintenance scripts 鈥?the generator, the gates, the media audit, the owed check.
  registerScriptCommands(context, () => roots, output, () => void refresh());
  registerReportCommands(context, () => roots);
  registerScaffoldCommands(context);
  registerFeedbackCommands(context, () => roots);
  // The Library's project rows are read from the catalog, so a project created, edited or removed in the
  // projects module has to bring them back: its own signal, listened to here.
  context.subscriptions.push(projects().onDidChange(() => void refresh()));
  // Reading a source and the working area that holds a clone of one are the repositories module's: its own
  // activation registers them, and its own page shows what came of them. This module names it in its own
  // `extensionDependencies`, so its commands are there whenever a row here points at one.
  // The Markdown toolbar: it edits the page in front, and reads the registry only to offer a link to a real
  // page 鈥?the one write-side surface in this extension that writes nothing.
  registerFormatCommands(context, () => roots);
  // Operating on a page: creating one, naming it, moving it, retiring it. The selected row stands in for the
  // row a command was started without 鈥?the view's toolbar and the palette are the two that do that.
  registerPageCommands(context, pageDeps);
  // and where a row is: opening it, revealing it, a terminal at its folder, its path on the clipboard.
  registerRowCommands(context, { selected: () => selectedRow() });
  // The page that creates a page 鈥?the other page that exists because a name is asked for in a form. The
  // organisation's own page is `temcoRepositories.page`, and it belongs to that module.
  newPagePage = new NewPagePage(context, () => roots, pageDeps);
  context.subscriptions.push(
    // *Analyse the source鈥? from a row: the form knows the source by the name the tree shows it under, while a
    // row carries its slug, so the catalog is asked which name that slug is.
    vscode.commands.registerCommand('temcoDocs.analyseSource', async (target?: unknown) => {
      const slug = typeof target === 'string' ? target : (target as { slug?: string } | undefined)?.slug;
      if (slug === undefined) {
        return;
      }
      let catalog: Catalog | undefined;
      try {
        catalog = await Catalog.open(context);
        const source = catalog.source(slug);
        if (source !== undefined) {
          newPagePage?.open({ source: source.name, analyse: true });
        }
      } catch {
        // Nothing to analyse: the page itself says when a source has no files to read.
      } finally {
        catalog?.close();
      }
    }),
    { dispose: () => newPagePage?.dispose() }
  );
  redraw = () => void refresh();

  context.subscriptions.push(
    // The one write this extension makes to a page: the empty file for a page the registry already declares.
    // It arrives two ways 鈥?the row in the tree that has no file behind it, and a page that names the path 鈥?and
    // both end in the same single write. Handling only the second is why the row's own *Create* did nothing.
    vscode.commands.registerCommand(
      'temcoDocs.createPage',
      async (target?: DocsNode | { path?: string; title?: string }) => {
        // Named by a webview (a path), by a row (a node) 鈥?or by neither, and then it is the selected row.
        const named = target as { path?: string; title?: string } | undefined;
        const node =
          pageFromNode(target as DocsNode | undefined) ??
          (typeof named?.path === 'string' ? undefined : pageFromNode(selectedRow()));
        const path = node?.page.uri.fsPath ?? named?.path;
        const title = node?.page.title ?? named?.title;
        if (path === undefined || path.length === 0) {
          return;
        }
        await createPage(vscode.Uri.file(path), title ?? 'Page');
        await refresh();
      }
    )
  );

  // The boot: re-read once, then leave the layout alone. Which tab opens, and which sidebar section comes
  // forward when the project changes, are the workbench's decisions 鈥?it owns the Library and the dashboard.
  void refresh();

  // What this module publishes 鈥?see `src/api.ts`. It is the model, published rather than lent: the AI module
  // and the workbench read the sets, the pages and the selection through these, so no two modules can disagree
  // about what the documentation is. Nothing here writes, and nothing here activates anything.
  return {
    roots: () => roots,
    collectPages,
    countStale,
    totals,
    pageForUri,
    scriptsIn,
    selection,
    pageColumn,
    refresh,
    onDidChange: (listener: () => void) => changed.event(listener),
  };
}

export function deactivate(): void {
  // Nothing to unwind: the pages are webviews the window closes, and the module's own state is in the
  // workspace's storage. The AI module stops its own server when it is deactivated.
}

/** One source of a project, in the two shapes the Workspace view can read: a folder path, or recorded pages. */
interface ReadableSource {
  slug: string;
  name: string;
  path?: string;
  pages: DeclaredPage[];
}

/**
 * What the selected project is made of, as the Workspace view needs it.
 *
 * One catalog open for the whole question, then closed: the pages are read here and carried by the tree's nodes,
 * so expanding a source later never goes back to the database. A catalog that cannot be opened returns nothing
 * rather than throwing 鈥?it is reported where it is used (the Library, a read), not by an empty tree.
 */
async function projectSources(
  context: vscode.ExtensionContext,
  slug: string
): Promise<{ name: string; sources: ReadableSource[]; missing: boolean }> {
  let catalog: Catalog | undefined;
  try {
    catalog = await Catalog.open(context);
  } catch {
    return { name: slug, sources: [], missing: false };
  }

  try {
    const detail = catalog.document(slug);
    if (!detail) {
      return { name: slug, sources: [], missing: true };
    }
    const cited = new Set(detail.sources.map((source) => source.name));
    const sources: ReadableSource[] = [];

    for (const row of catalog.sources()) {
      if (!cited.has(row.name)) {
        continue;
      }
      const source = catalog.source(row.slug);
      if (!source) {
        continue;
      }
      sources.push({
        slug: row.slug,
        name: source.name,
        path: source.path,
        pages: catalog
          .pagesFor(source.id)
          .map((page) => ({ id: page.id, title: page.title, owner: page.owner })),
      });
    }
    return { name: detail.name, sources, missing: false };
  } finally {
    catalog.close();
  }
}

/**
 * The catalog's project list, read at the top of every refresh.
 *
 * It answers the two questions the rest of the refresh depends on: **whether any project exists at all**, which
 * is what the Workspace view's empty state has to say, and 鈥?allowed once, on the first read of a window 鈥?
 * **which project is being worked on**: with exactly one recorded there is nothing to choose between, so it
 * selects itself and the Workspace is ready behind the Library. With two or more nothing is guessed, because
 * guessing would show a workspace about something nobody named.
 *
 * `maySelect` is false after that first read, and it has to be: choosing on every refresh would make *Stop
 * working on it* impossible with a single project, since clearing the selection would re-make it on the next
 * read and the view would never go away. Returns how many projects there are, or `undefined` when the catalog
 * could not be opened at all 鈥?the empty state has to tell the two apart.
 */
async function chooseProject(
  context: vscode.ExtensionContext,
  selection: Selection,
  maySelect: boolean
): Promise<number | undefined> {
  let catalog: Catalog | undefined;
  try {
    catalog = await Catalog.open(context);
    const documents = catalog.documents();
    if (maySelect && selection.project() === undefined && documents.length === 1) {
      await selection.select(slugOf(documents[0].name));
    }
    return documents.length;
  } catch {
    // A catalog that cannot be opened is reported where it is used 鈥?the Library, a read 鈥?and activation must
    // not depend on it. Selecting nothing leaves the Workspace view saying there is nothing to show.
    return undefined;
  } finally {
    catalog?.close();
  }
}

/** A new page starts as a title and nothing else 鈥?the structure lives in the registry, not in front matter. */
async function createPage(uri: vscode.Uri, title: string): Promise<void> {
  const content = Buffer.from(`# ${title}\n\n`, 'utf8');
  await vscode.workspace.fs.writeFile(uri, content);
  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document, { preview: false, viewColumn: fileColumn() });
}

function rootOf(node: DocsNode | undefined, roots: readonly DocsRoot[]): DocsRoot | undefined {
  const candidate = node as { root?: DocsRoot } | undefined;
  if (candidate && Object.hasOwn(candidate, 'root')) {
    return candidate.root;
  }
  return roots[0];
}

function updateStatus(
  status: vscode.StatusBarItem,
  roots: readonly DocsRoot[],
  broken: readonly BrokenRegistry[]
): void {
  const sums = totals(roots);
  if (sums.pages === 0 && broken.length === 0) {
    status.hide();
    return;
  }
  const issuePart = sums.issues > 0 ? ` 路 ${sums.issues} issues` : '';
  const brokenPart = broken.length > 0 ? ` 路 ${broken.length} unreadable` : '';
  status.text = `$(book) ${sums.pages} pages${issuePart}${brokenPart} 路 ${sums.neverReviewed} never reviewed`;
  status.tooltip = 'Temco Docs: validate the documentation set';
  status.show();
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

