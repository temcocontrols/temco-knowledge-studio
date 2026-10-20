// Temco Docs 鈥?activation.
//
// The extension is a reader, of the **project being worked on**: it finds each of that project's sources, shows
// their pages in the Workspace view, and reports structural problems where they can be fixed. The project is the
// front door 鈥?the Library lists what there is, choosing one loads the Workspace, and with none chosen nothing is
// read, so the view can never answer about a folder nobody named. Nothing is written to a page without an
// explicit command, and nothing is published from here at all.

import * as path from 'path';
import * as vscode from 'vscode';
import { ai, aiInstalled } from './aiModule';
import { TemcoDocsApi } from './api';
import { registerBuildCommands, registerScriptCommands, scriptsIn } from './builds';
import { publishDiagnostics } from './diagnostics';
import { registerFeedbackCommands } from './feedback';
import { registerFormatCommands } from './format';
import { registerImportCommand } from './importer';
import { DocsPages } from './docsPages';
import { NewPagePage } from './newPagePage';
import { OverviewPage } from './overview';
import { AREA_CHAPTER, KINDS, PageDeps, PageOperations, registerPageCommands, writePage } from './pageOps';
import { PageProperties } from './pageProperties';
import { projects } from './projects';
import { registerReportCommands } from './report';
import { registerRowCommands } from './rowOps';
import { registerScaffoldCommands } from './scaffold';
import { registerSectionViews, SidebarModel, WorkingEntry } from './sections';
import { PublishedSite } from './siteServer';
import { Catalog, DraftRow, Selection, selection, slugOf } from './store';
import { fileColumn, pageColumn } from './surface';
import { DocsRoot, DeclaredPage, RegistryError, collectPages, countStale, fileExists, folderForPath, loadDocsRoot, pageForUri, registryUriFor, rootFromDeclared, totals } from './registry';
import { DocsNode, DocsTreeProvider, TreeNote, pageFromNode } from './tree';

const OUTPUT_NAME = 'Temco Docs';
const VIEW_ID = 'temcoDocs.pages';

/**
 * Copy a build's files into the publish folder, keeping each path as it was under the folder they share.
 *
 * The shared folder is what makes a site a site: `dist/docs/a/b.html` lands as `<destination>/a/b.html`, so the
 * links the generator wrote between pages still resolve.
 */
async function copyArtifacts(files: readonly string[], destination: string): Promise<number> {
  const root = sharedFolder(files);
  let copied = 0;
  for (const file of files) {
    const target = path.join(destination, path.relative(root, file));
    try {
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(target)));
      await vscode.workspace.fs.copy(vscode.Uri.file(file), vscode.Uri.file(target), { overwrite: true });
      copied += 1;
    } catch {
      // A file that cannot be copied is left out; the count says how many made it, and what did is on disk.
    }
  }
  return copied;
}

/** The deepest folder every one of these files sits under, by path segment. */
function sharedFolder(files: readonly string[]): string {
  const folders = files.map((file) => path.dirname(file).split(/[\\/]/));
  const first = folders[0];
  let length = first.length;
  for (const parts of folders.slice(1)) {
    let index = 0;
    while (index < length && index < parts.length && parts[index].toLowerCase() === first[index].toLowerCase()) {
      index += 1;
    }
    length = index;
  }
  return first.slice(0, length).join(path.sep);
}

/** A published folder: the site if it has an index, the folder otherwise. */
async function openPublished(destination: string): Promise<void> {
  const index = path.join(destination, 'index.html');
  if (await fileExists(vscode.Uri.file(index))) {
    await vscode.env.openExternal(vscode.Uri.file(index));
    return;
  }
  await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(destination));
}

/** The newest published version of the project the window is on — what "the site" means without a name. */
async function newestPublished(context: vscode.ExtensionContext): Promise<string | undefined> {
  let catalog: Catalog | undefined;
  try {
    catalog = await Catalog.open(context);
    const documents = catalog.documents();
    const project = selection.project() ?? (documents.length === 1 ? documents[0].slug : undefined);
    return project === undefined ? undefined : catalog.releases(project)[0]?.destination;
  } catch {
    return undefined;
  } finally {
    catalog?.close();
  }
}

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
  // It reads the registries this window is reading, so a page it lists is the file a build would read.
  const docsPages = new DocsPages(context, () => roots);
  context.subscriptions.push(docsPages);
  // A published release, served on loopback while somebody looks at it. One per window: one address in the bar.
  const site = new PublishedSite();
  context.subscriptions.push(site);
  // The documentation itself, as a page: counts, areas, what is behind its source, and the checks.
  const overviewPage = new OverviewPage(context, () => roots);
  context.subscriptions.push(overviewPage);
  const pageDeps: PageDeps = {
    roots: () => roots,
    output,
    project: () => selection.project(),
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

  // The side bar's groups, as the mock draws them: Projects, Sources, Areas, Pipeline and the Working Set of the
  // pages opened in this window. The Docs Explorer is the tree of pages, registered above.
  //
  // The groups read the module rather than a copy of it: the projects the catalog holds, the areas of the project
  // being worked on, and the pages this window has shown. `sidebar` is filled in below, before the first read.
  const working: WorkingEntry[] = [];
  let projectRows: { name: string; current: boolean }[] = [];
  let sidebar: { refresh(): void } | undefined;
  const sidebarModel: SidebarModel = {
    projects: () => projectRows,
    areas: () => {
      // One row per area across the project's sources, the area of the open page first. A page names its area in
      // the first segment of its id, which is the same key the registry uses.
      const open = selection.page()?.id.split('/')[0];
      const seen = new Map<string, { area: string; title: string; pages: number; current: boolean }>();
      for (const root of roots) {
        for (const area of root.areas) {
          const row = seen.get(area.area);
          if (row) {
            row.pages += area.pages;
          } else {
            seen.set(area.area, { area: area.area, title: area.title, pages: area.pages, current: area.area === open });
          }
        }
      }
      return [...seen.values()].sort(
        (one, other) => Number(other.current) - Number(one.current) || one.title.localeCompare(other.title)
      );
    },
    working: () => working,
    counts: () => ({
      // A source that is a folder here is a repository with a working tree; the rest are what a read recorded.
      repositories: roots.filter((root) => root.origin !== 'catalog').length,
      sources: roots.length,
      review: roots.reduce((total, root) => total + root.neverReviewed, 0),
    }),
  };
  sidebar = registerSectionViews(context, sidebarModel);

  // The Working Set, the mock's `M.state.working`: the pages this window has shown, newest first, six at most.
  //
  // It follows the *editor* rather than one command, because a page can be opened from the tree, from the
  // Documents list, from the working set itself or from a file in the Explorer — the mock lists all of those, and
  // a list that filled only from one of them would be a different feature.
  const rememberWorking = (uri: vscode.Uri): void => {
    if (uri.scheme !== 'file') {
      return;
    }
    const page = pageForUri(roots, uri);
    if (page === undefined) {
      return;
    }
    const entry: WorkingEntry = { area: page.id.split('/')[0], title: page.title, id: page.id, path: uri.fsPath };
    const at = working.findIndex((item) => item.id === entry.id);
    if (at >= 0) {
      working.splice(at, 1);
    }
    working.unshift(entry);
    working.splice(6);
    sidebar?.refresh();
  };

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor !== undefined) {
        rememberWorking(editor.document.uri);
      }
    }),
    // Closing a page takes it off the list, which is what the mock does when its tab is closed.
    vscode.workspace.onDidCloseTextDocument((document) => {
      const at = working.findIndex((item) => item.path === document.uri.fsPath);
      if (at >= 0) {
        working.splice(at, 1);
        sidebar?.refresh();
      }
    })
  );

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
    // The projects the side bar lists, the one being worked on first.
    projectRows = await readProjects(context, selection.project());
    sidebar?.refresh();
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

  /** One draft, read fresh: settling is an act on the database, never on a page that showed a stale copy. */
  const draftById = async (id: unknown): Promise<DraftRow | undefined> => {
    const draftId = typeof id === 'number' ? id : Number(id);
    if (!Number.isFinite(draftId)) {
      return undefined;
    }
    let catalog: Catalog | undefined;
    try {
      catalog = await Catalog.open(context);
      return catalog.draft(draftId);
    } catch {
      return undefined;
    } finally {
      catalog?.close();
    }
  };

  /** Settling one draft: accepted when its page was written, discarded when a person said no. */
  const settleDraft = async (draft: DraftRow, state: 'accepted' | 'discarded'): Promise<void> => {
    let catalog: Catalog | undefined;
    try {
      catalog = await Catalog.open(context);
      catalog.setDraftState(draft.id, state);
    } catch {
      // A catalog that cannot be written leaves the draft waiting, which is where it was.
    } finally {
      catalog?.close();
    }
  };

  /**
   * Revise a page that already exists.
   *
   * The wizard creates pages and refuses a title that is already taken — correctly, because it would write a
   * second file. A revision is the other act: the same id, the page as it stands for material, and the answer kept
   * as a draft the Review Center settles. Accepting it overwrites the page, which is exactly what a revision is.
   */
  const revisePage = async (target?: { id?: unknown; title?: unknown }): Promise<void> => {
    // The root matters as well as the page: accepting the draft writes a file, and a file belongs to the source
    // the page is read from. Without that name `writePage` would have to guess, and guessing writes to the wrong
    // repository.
    const owned = roots
      .map((root) => ({
        root,
        page: collectPages(root).find(
          (entry) =>
            entry.id === target?.id ||
            (typeof target?.title === 'string' && entry.title === target.title)
        ),
      }))
      .find((candidate) => candidate.page !== undefined);
    const page = owned?.page;
    if (page === undefined) {
      void vscode.window.showWarningMessage(
        'Temco Docs: no page with that name is in a registry this window is reading.'
      );
      return;
    }
    if (!page.exists) {
      void vscode.window.showWarningMessage(
        `Temco Docs: “${page.title}” has no file yet, so there is nothing to revise — create it instead.`
      );
      return;
    }
    const assistant = await ai();
    if (assistant === undefined || assistant.modelLabel() === undefined) {
      void vscode.window.showWarningMessage(
        'Temco Docs: no local model is chosen, so there is nothing to draft with. Choose one on the AI page.'
      );
      return;
    }
    const note = await vscode.window.showInputBox({
      prompt: `What changed in “${page.title}”?`,
      placeHolder: 'the code moved on · firmware 2.14 changed the scale factor · a step is missing',
    });
    if (note === undefined) {
      return;
    }

    const current = new TextDecoder().decode(await vscode.workspace.fs.readFile(page.uri));
    const kind = KINDS.find((candidate) => candidate.label === 'Article') ?? KINDS[0];
    let written = '';
    try {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Drafting a change to ${page.title}` },
        () =>
          assistant.draft({
            title: page.title,
            kind: kind.label,
            headings: kind.headings,
            path: page.uri.fsPath,
            area: page.area,
            material: `# ${page.title}\n\nWhat has changed: ${note}\n\n${current}`,
            onToken: (text) => {
              written += text;
            },
          })
      );
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Temco Docs: the draft failed — ${error instanceof Error ? error.message : String(error)}`
      );
      return;
    }
    if (written.trim().length === 0) {
      void vscode.window.showWarningMessage('Temco Docs: the model returned nothing, so no draft was kept.');
      return;
    }

    let catalog: Catalog | undefined;
    let kept = false;
    try {
      catalog = await Catalog.open(context);
      const documents = catalog.documents();
      const project = selection.project() ?? (documents.length === 1 ? documents[0].slug : undefined);
      if (project !== undefined) {
        catalog.saveDraft({
          documentSlug: project,
          pageId: page.id,
          title: page.title,
          kind: 'Revision',
          body: written,
          source: owned?.root.folder.name,
        });
        kept = true;
      }
    } catch {
      kept = false;
    } finally {
      catalog?.close();
    }
    if (kept) {
      docsPages.review();
    } else {
      void vscode.window.showWarningMessage(
        'Temco Docs: the draft was written but could not be kept — no project is selected.'
      );
    }
  };

  /**
   * Publish what the last build produced.
   *
   * The files are copied, never moved and never uploaded: a Learn site here is a folder of static files plus the
   * destination recorded in the catalog, which is what "published" can honestly mean without an account to
   * publish to. The CHM and the PDF need nothing more than this — they are already files a reader can have.
   */
  const publishRelease = async (): Promise<void> => {
    let catalog: Catalog | undefined;
    try {
      catalog = await Catalog.open(context);
      const documents = catalog.documents();
      const project = selection.project() ?? (documents.length === 1 ? documents[0].slug : undefined);
      if (project === undefined) {
        void vscode.window.showWarningMessage('Temco Docs: no project is selected, so there is nothing to publish.');
        return;
      }
      const artifacts = catalog.documentArtifacts(project);
      const site = artifacts.filter((artifact) => artifact.kind === 'site');
      const chosen = site.length > 0 ? site : artifacts;
      if (chosen.length === 0) {
        void vscode.window.showWarningMessage('Temco Docs: nothing has been built yet. Build the site, then publish it.');
        return;
      }
      const version = catalog.document(project)?.version ?? 'unversioned';
      const destination = vscode.Uri.joinPath(context.globalStorageUri, 'published', project, version);
      const copied = await copyArtifacts(chosen.map((artifact) => artifact.path), destination.fsPath);
      if (copied === 0) {
        void vscode.window.showWarningMessage('Temco Docs: the artifacts could not be copied, so nothing was published.');
        return;
      }
      catalog.publishRelease(project, {
        version,
        destination: destination.fsPath,
        files: copied,
        buildId: catalog.builds(project)[0]?.id,
      });
      const answer = await vscode.window.showInformationMessage(
        `Temco Docs: ${version} published — ${copied} file(s) in ${vscode.workspace.asRelativePath(destination)}.`,
        'Open the Site',
        'Show the Folder'
      );
      if (answer === 'Open the Site') {
        await openPublished(destination.fsPath);
      } else if (answer === 'Show the Folder') {
        await vscode.commands.executeCommand('revealFileInOS', destination);
      }
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Temco Docs: publishing failed — ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      catalog?.close();
    }
  };

  // The page properties: the registry fields of the page in front, in one form. It writes through
  // `RegistryEdit`, so the repository's generator keeps every value it sets.
  const pageProperties = new PageProperties(() => roots, () => void refresh());

  context.subscriptions.push(
    pageProperties,
    vscode.commands.registerCommand('temcoDocs.pageProperties', () => void pageProperties.open()),
    // Importing a document set: the conversion the project wizard calls after it has a destination.
    registerImportCommand(),
    vscode.commands.registerCommand('temcoDocs.showStatus', report),
    vscode.commands.registerCommand('temcoDocs.validate', report),
    vscode.commands.registerCommand('temcoDocs.refresh', refresh),
    // The Documentation container's surfaces, rebuilt from the mock: projects, repositories, sources,
    // documents, a page, a source, review, builds and releases.
    vscode.commands.registerCommand('temcoDocs.projects', () => docsPages.projects()),
    vscode.commands.registerCommand('temcoDocs.repository', (name?: unknown) => docsPages.repository(typeof name === 'string' ? name : undefined)),
    vscode.commands.registerCommand('temcoDocs.sources', () => docsPages.sources()),
    vscode.commands.registerCommand('temcoDocs.documents', (area?: unknown) => docsPages.documents(typeof area === 'string' ? area : undefined)),
    // The side bar's project row, which is the mock's `tree-project`: *become* that project, then show the
    // projects page. It does not open a project's own editor — the side bar says where you are, the page says
    // what is there. A selection that fails (a project removed between the draw and the click) still opens the
    // page, because the page is where the list of what exists lives.
    vscode.commands.registerCommand('temcoDocs.selectProject', async (slug?: unknown) => {
      if (typeof slug === 'string') {
        try {
          await vscode.commands.executeCommand('temcoProjects.selectProject', slug);
        } catch {
          // The projects module is not installed in this window; the page still opens.
        }
      }
      docsPages.projects();
    }),
    vscode.commands.registerCommand('temcoDocs.page', (title?: unknown, area?: unknown) => docsPages.pageOf(typeof title === 'string' ? title : undefined, typeof area === 'string' ? area : undefined)),
    vscode.commands.registerCommand('temcoDocs.source', (repo?: unknown) => docsPages.source(typeof repo === 'string' ? repo : undefined)),
    vscode.commands.registerCommand('temcoDocs.review', () => docsPages.review()),
    // Settling a draft: accepting writes the page it proposed, discarding wastes the text. Both act on one row and
    // both redraw the queue, because what is left is what a person needs to see.
    vscode.commands.registerCommand('temcoDocs.acceptDraft', async (id?: unknown) => {
      const draft = await draftById(id);
      if (draft === undefined) {
        void vscode.window.showInformationMessage('Temco Docs: that draft is no longer waiting.');
        docsPages.review();
        return;
      }
      // The draft is the whole proposal — id, title and body — so accepting needs nothing else, and the page is
      // written exactly as the reviewer read it. `writePage` is what asks before replacing an existing file.
      const parts = draft.pageId.split('/').filter((part) => part.length > 0);
      const written = await writePage(pageDeps, {
        source: draft.source,
        area: parts[0],
        chapter: parts.length > 2 ? parts[1] : AREA_CHAPTER,
        slug: parts[parts.length - 1],
        title: draft.title,
        kind: draft.kind,
        body: draft.body,
      });
      if (written !== undefined) {
        await settleDraft(draft, 'accepted');
        // A page that now exists is a page the tree, the counts and every list have to know about. Without this the
        // queue empties and the workspace still shows the page as missing.
        await refresh();
      }
      docsPages.review();
    }),
    vscode.commands.registerCommand('temcoDocs.discardDraft', async (id?: unknown) => {
      const draft = await draftById(id);
      if (draft === undefined) {
        void vscode.window.showInformationMessage('Temco Docs: that draft is no longer waiting.');
        docsPages.review();
        return;
      }
      const answer = await vscode.window.showWarningMessage(
        `Discard the draft “${draft.title}”? The text is not kept.`,
        { modal: true },
        'Discard'
      );
      if (answer !== 'Discard') {
        return;
      }
      await settleDraft(draft, 'discarded');
      docsPages.review();
    }),
    // A draft written elsewhere — the AI panel drafts against the open page — is recorded here, because this
    // module owns the queue: one place decides what is waiting, and one place settles it.
    vscode.commands.registerCommand('temcoDocs.recordDraft', async (draft?: unknown) => {
      const input = draft as
        | { pageId?: unknown; title?: unknown; body?: unknown; source?: unknown; kind?: unknown }
        | undefined;
      if (input === undefined || typeof input.body !== 'string' || input.body.trim().length === 0) {
        return;
      }
      let catalog: Catalog | undefined;
      try {
        catalog = await Catalog.open(context);
        const documents = catalog.documents();
        const project = selection.project() ?? (documents.length === 1 ? documents[0].slug : undefined);
        if (project === undefined) {
          return;
        }
        catalog.saveDraft({
          documentSlug: project,
          pageId: typeof input.pageId === 'string' && input.pageId.length > 0 ? input.pageId : 'unplaced',
          title: typeof input.title === 'string' && input.title.length > 0 ? input.title : 'Untitled draft',
          kind: typeof input.kind === 'string' ? input.kind : 'Draft',
          body: input.body,
          source: typeof input.source === 'string' ? input.source : undefined,
        });
        vscode.window.setStatusBarMessage('Temco Docs: the draft is waiting in the Review Center.', 5000);
        // Redrawn only if it is already on screen: recording a draft must never open a page nobody asked for.
        if (docsPages.isOpen('review')) {
          docsPages.review();
        }
      } catch {
        // A catalog that cannot be written leaves the draft where it was: in the editor, in front of a person.
      } finally {
        catalog?.close();
      }
    }),
    // The page was written by somebody else — the AI panel applies its own diff — so only the queue is settled.
    vscode.commands.registerCommand('temcoDocs.settlePage', async (pageId?: unknown) => {
      if (typeof pageId !== 'string' || pageId.length === 0) {
        return;
      }
      let catalog: Catalog | undefined;
      try {
        catalog = await Catalog.open(context);
        const documents = catalog.documents();
        const project = selection.project() ?? (documents.length === 1 ? documents[0].slug : undefined);
        if (project !== undefined) {
          catalog.settleDrafts(project, pageId, 'accepted');
        }
      } catch {
        // Nothing to settle: the draft stays waiting, which is what a queue is for.
      } finally {
        catalog?.close();
      }
    }),
    vscode.commands.registerCommand('temcoDocs.builds', () => docsPages.builds()),
    vscode.commands.registerCommand('temcoDocs.releases', () => docsPages.releases()),
    // Publishing hands files to a reader: copied into a folder the platform owns, recorded, then opened.
    vscode.commands.registerCommand('temcoDocs.publishRelease', () => publishRelease()),
    vscode.commands.registerCommand('temcoDocs.revisePage', (target?: unknown) =>
      revisePage(target as { id?: unknown; title?: unknown } | undefined)
    ),
    vscode.commands.registerCommand('temcoDocs.openPublished', async (destination?: unknown) => {
      if (typeof destination === 'string' && destination.length > 0) {
        await openPublished(destination);
      }
    }),
    // Serving, rather than opening a file: a generator's links and directory indexes only resolve over a host.
    vscode.commands.registerCommand('temcoDocs.servePublished', async (destination?: unknown) => {
      const where = typeof destination === 'string' && destination.length > 0
        ? destination
        : await newestPublished(context);
      if (where === undefined) {
        void vscode.window.showWarningMessage(
          'Temco Docs: nothing has been published yet, so there is no site to serve. Build and publish one first.'
        );
        return;
      }
      try {
        const url = await site.serve(where);
        const answer = await vscode.window.showInformationMessage(
          `Temco Docs: serving ${where} at ${url}`,
          'Open in Browser',
          'Stop Serving'
        );
        if (answer === 'Open in Browser') {
          await vscode.env.openExternal(vscode.Uri.parse(url));
        } else if (answer === 'Stop Serving') {
          site.stop();
        }
      } catch (error) {
        void vscode.window.showErrorMessage(
          `Temco Docs: the site could not be served — ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }),
    vscode.commands.registerCommand('temcoDocs.stopServing', () => site.stop()),
    // An artifact is a file the build wrote, so opening one is opening a file — not a copy the platform keeps.
    vscode.commands.registerCommand('temcoDocs.openArtifact', async (file?: unknown) => {
      if (typeof file !== 'string' || file.length === 0) {
        return;
      }
      await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(file));
    }),
    // A page is a file too: the page view shows it read-only, and this is the way into editing it.
    vscode.commands.registerCommand('temcoDocs.openFile', async (file?: unknown) => {
      if (typeof file !== 'string' || file.length === 0) {
        return;
      }
      await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(file), fileColumn());
    }),
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

/**
 * The projects the side bar lists, the one being worked on first.
 *
 * The mock's Projects group shows the current project and hides the rest behind "… N more"; this is the list it
 * counts. A catalog that cannot be opened yields an empty list rather than an error: the side bar is a way in, not
 * the record of what exists.
 */
async function readProjects(
  context: vscode.ExtensionContext,
  current: string | undefined
): Promise<{ name: string; current: boolean }[]> {
  let catalog: Catalog | undefined;
  try {
    catalog = await Catalog.open(context);
    return catalog
      .documents()
      .map((row) => ({ name: row.name, current: slugOf(row.name) === current }))
      .sort((one, other) => Number(other.current) - Number(one.current) || one.name.localeCompare(other.name));
  } catch {
    return [];
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

