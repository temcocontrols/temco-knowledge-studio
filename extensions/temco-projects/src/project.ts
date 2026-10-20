// The project commands — and nothing else.
//
// The work happens on a page (`src/projectPage.ts`): the popups this replaces asked one field at a time and
// could not show a source list at all. These commands only decide **which** project the page opens for, so
// there is one form to maintain instead of a wizard and an editor that drift apart.

import * as vscode from 'vscode';
import { ProjectFlowPage } from './projectFlow';
import { ProjectPage } from './projectPage';
import { ProjectHub } from './projectHub';
import { AddSourcePage } from './sourceFlow';
import { Catalog, CatalogUnavailable, Selection, slugOf } from './store';
import { focusLibrary, rowSlug } from './ui';

/** A slug, or the sidebar row that stands for a project — the two things a command argument can be. */
type ProjectArgument = string | object | undefined;

//

export function registerProjectCommands(
  context: vscode.ExtensionContext,
  selection: Selection,
  refresh: () => void
): void {
  // The hub is built first and told what to call afterwards, because the callback it needs is the one that tells
  // the hub about a removal — a loop, unless the reference is filled in after both exist.
  let notify: (removed?: string) => void = () => void 0;
  const hub = new ProjectHub(context, selection, (removed) => notify(removed));
  const page = new ProjectPage(context, selection, (removed) => notify(removed));
  // New Project is the mock's `flow/new-project`: a four-step wizard rather than the edit form opened empty.
  const flow = new ProjectFlowPage(context, selection, () => notify());
  context.subscriptions.push(flow);
  // Add Source is the mock's `flow/add-source`: three steps, and the same store call the dialog made.
  const source = new AddSourcePage(context);
  context.subscriptions.push(source);

  /** Anything about a project changed: the Library's project rows re-read, and a project's own page says so. */
  notify = (removed?: string): void => {
    if (removed !== undefined) {
      hub.notifyRemoved(removed);
    }
    refresh();
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('temcoProjects.newProject', () => void flow.open()),
    vscode.commands.registerCommand('temcoProjects.removeProject', (target?: ProjectArgument) =>
      removeProject(context, selection, notify, rowSlug(target))
    ),
    // Adding a source is the mock's own flow: kind, location, read. A source is recorded once and cited by any
    // number of projects, so the flow is about the source itself rather than about the project it is added to.
    vscode.commands.registerCommand('temcoProjects.addSource', () => source.open()),
    // Two doors on purpose: the hub is what a project *is*, the page is what it is *made of*. Opening the
    // editor for every look at a project would make reading its pages and editing its fields the same act.
    vscode.commands.registerCommand('temcoProjects.openProject', (target?: ProjectArgument) =>
      withProject(context, (chosen) => hub.open(chosen), rowSlug(target))
    ),
    vscode.commands.registerCommand('temcoProjects.editProject', (target?: ProjectArgument) =>
      withProject(context, (chosen) => page.openEdit(chosen), rowSlug(target))
    ),
    // What the whole application reads: the Workspace view, the counts, the faults and the AI's context.
    vscode.commands.registerCommand('temcoProjects.selectProject', (target?: ProjectArgument) =>
      selectProject(context, selection, rowSlug(target))
    ),
    vscode.commands.registerCommand('temcoProjects.clearProject', () => selection.select(undefined))
  );
}

/**
 * Removes a project.
 *
 * Sources are kept: they are recorded once and cited by any number of projects, so forgetting one because the
 * project that used it has gone would quietly take a page away from every other project that cites it.
 */
async function removeProject(
  context: vscode.ExtensionContext,
  selection: Selection,
  notify: (removed?: string) => void,
  slug?: string
): Promise<void> {
  const projects = await listDocuments(context);
  if (projects.length === 0) {
    void vscode.window.showInformationMessage('Temco Projects: there are no projects to remove.');
    return;
  }

  const chosen =
    slug !== undefined
      ? projects.find((project) => project.slug === slug)
      : await pickProject(projects, undefined, 'Remove which project?');
  if (!chosen) {
    return;
  }

  const answer = await vscode.window.showWarningMessage(
    `Remove “${chosen.name}”?`,
    {
      modal: true,
      detail:
        'The project, how it is built and the artifacts recorded against it are forgotten. Its sources are ' +
        'kept, and nothing is changed or deleted at a source.',
    },
    'Remove'
  );
  if (answer !== 'Remove') {
    return;
  }

  let catalog: Catalog | undefined;
  try {
    catalog = await Catalog.open(context);
    catalog.deleteDocument(chosen.slug);
  } catch (error) {
    const message = error instanceof CatalogUnavailable ? error.message : String(error);
    void vscode.window.showErrorMessage(`Temco Projects: ${message}`);
    return;
  } finally {
    catalog?.close();
  }

  // A project being worked on cannot be removed and still be what everything reads.
  if (selection.project() === chosen.slug) {
    await selection.select(undefined);
  }
  notify(chosen.slug);
  void vscode.window.showInformationMessage(`Temco Projects: “${chosen.name}” is removed.`);
  // Land where the removal happened, in the one useful sense: the list of what is left. The page about the
  // project that has just gone is not a page — it closes itself, and the Library takes its place.
  await focusLibrary();
}

/**
 * Points the application at a project.
 *
 * Said out loud, once, because the Workspace view changes what it is showing: a view that silently answers a
 * different question is worse than an empty one.
 */
async function selectProject(
  context: vscode.ExtensionContext,
  selection: Selection,
  slug?: string
): Promise<void> {
  const projects = await listDocuments(context);
  if (projects.length === 0) {
    await vscode.commands.executeCommand('temcoProjects.newProject');
    return;
  }

  const current = selection.project();
  const chosen =
    slug !== undefined
      ? projects.find((project) => project.slug === slug)
      : await pickProject(projects, current, 'Work on which project?');
  if (!chosen) {
    return;
  }

  await selection.select(chosen.slug);
  if (current !== chosen.slug) {
    void vscode.window.showInformationMessage(
      `Temco Projects: the Workspace view now follows ${chosen.name}.`
    );
  }
}

async function pickProject(
  projects: { name: string; slug: string; description: string }[],
  current: string | undefined,
  title: string
): Promise<{ name: string; slug: string; description: string } | undefined> {
  return await vscode.window.showQuickPick(
    projects.map((project) => ({
      label: project.slug === current ? `$(pass-filled) ${project.name}` : project.name,
      detail: project.description,
      slug: project.slug,
      name: project.name,
      description: project.slug === current ? 'the project being worked on' : project.description,
    })),
    { title }
  );
}

/**
 * Opens a project, asking which one only when it has to.
 *
 * Reached from the Library, the palette and the dashboard, all of which want a project to already exist — so
 * with none, it offers to create one instead of failing.
 */
async function withProject(
  context: vscode.ExtensionContext,
  open: (slug: string) => void,
  slug?: string
): Promise<void> {
  if (slug !== undefined && slug.length > 0) {
    open(slug);
    return;
  }

  const documents = await listDocuments(context);
  if (documents.length === 0) {
    const answer = await vscode.window.showWarningMessage(
      'Temco Projects: there are no projects yet.',
      'Create a project'
    );
    if (answer === 'Create a project') {
      await vscode.commands.executeCommand('temcoProjects.newProject');
    }
    return;
  }
  if (documents.length === 1) {
    open(documents[0].slug);
    return;
  }

  const chosen = await vscode.window.showQuickPick(
    documents.map((document) => ({ label: document.name, detail: document.description, slug: document.slug })),
    { title: 'Which project?' }
  );
  if (chosen) {
    open(chosen.slug);
  }
}

/** The catalog's projects, in the shape the picker wants. One {@link Catalog} per call, closed again. */
async function listDocuments(
  context: vscode.ExtensionContext
): Promise<{ name: string; slug: string; description: string }[]> {
  let catalog: Catalog | undefined;
  try {
    catalog = await Catalog.open(context);
    return catalog.documents().map((document) => ({
      name: document.name,
      slug: slugOf(document.name),
      description: [
        document.version ? `v${document.version}` : undefined,
        `${document.sources} source${document.sources === 1 ? '' : 's'}`,
        document.builtAt ? 'built' : 'never built',
      ]
        .filter((part): part is string => part !== undefined)
        .join(' · '),
    }));
  } catch (error) {
    const message = error instanceof CatalogUnavailable ? error.message : String(error);
    void vscode.window.showErrorMessage(`Temco Projects: ${message}`);
    return [];
  } finally {
    catalog?.close();
  }
}
