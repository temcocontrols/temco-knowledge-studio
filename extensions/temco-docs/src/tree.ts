// The Docs Explorer — the pages the registry holds, arranged the way a reader walks them.
//
// Rebuilt to the mock's content tree (`docs/mock/js/shell.js`, `renderDocTree`): an area is a folder, a chapter is
// a folder inside it, and a page is a leaf with its title and nothing else. A folder carries one number — how many
// pages are under it — because that is the only thing the panel adds to the names.
//
// What the mock does not have, and this panel keeps, is the state: a page's tooltip still says its id, owner,
// audience, provenance and last change, its icon is still tinted when the page has a problem, and a page with
// structural problems still folds out those problems as children. The difference is that a clean tree is now what
// a person sees first.

import * as vscode from 'vscode';
import {
  AreaGroup,
  ChapterGroup,
  DocsRoot,
  PageEntry,
  Provenance,
  collectPages,
  countStale,
} from './registry';

class FolderNode {
  readonly kind = 'folder';
  constructor(readonly root: DocsRoot) { }
}

class AreaNode {
  readonly kind = 'area';
  /**
   * True when this area is the view's own top level — with one repository open its areas are, and they open by
   * themselves so the pages are one click away instead of three. Anything deeper waits to be asked.
   */
  constructor(readonly root: DocsRoot, readonly area: AreaGroup, readonly top = false) { }
}

class ChapterNode {
  readonly kind = 'chapter';
  constructor(readonly root: DocsRoot, readonly area: AreaGroup, readonly chapter: ChapterGroup) { }
}

class PageNode {
  readonly kind = 'page';
  constructor(readonly root: DocsRoot, readonly page: PageEntry) { }
}

class IssueNode {
  readonly kind = 'issue';
  constructor(readonly root: DocsRoot, readonly page: PageEntry, readonly index: number) { }
}

/**
 * A row that exists because there is nothing else to show: why the list is empty, and the one act that fills it.
 *
 * These are rows rather than a `viewsWelcome`, which was tried and dropped — a welcome's `when` clause is
 * resolved when the view is first painted, before the refresh has read anything, so it kept announcing "nothing
 * recorded yet" over a catalog that held five projects.
 */
export interface TreeNote {
  label: string;
  detail: string;
  command?: { command: string; args?: unknown[] };
}

class NoteNode {
  readonly kind = 'note';
  constructor(readonly note: TreeNote) { }
}

export type DocsNode =
  | FolderNode
  | AreaNode
  | ChapterNode
  | PageNode
  | IssueNode
  | NoteNode;

export function pageFromNode(node: DocsNode | undefined): PageNode | undefined {
  return node?.kind === 'page' ? node : undefined;
}

export class DocsTreeProvider implements vscode.TreeDataProvider<DocsNode> {
  private readonly changed = new vscode.EventEmitter<DocsNode | undefined | void>();
  readonly onDidChangeTreeData = this.changed.event;

  private roots: DocsRoot[] = [];
  private notes: TreeNote[] = [];

  setRoots(roots: DocsRoot[], notes: TreeNote[] = []): void {
    this.roots = roots;
    this.notes = notes;
    this.changed.fire();
  }

  refresh(): void {
    this.changed.fire();
  }

  getTreeItem(node: DocsNode): vscode.TreeItem {
    switch (node.kind) {
      case 'folder':
        return folderItem(node);
      case 'area':
        return areaItem(node);
      case 'chapter':
        return chapterItem(node);
      case 'page':
        return pageItem(node);
      case 'issue':
        return issueItem(node);
      case 'note': {
        const item = new vscode.TreeItem(node.note.label, vscode.TreeItemCollapsibleState.None);
        item.description = node.note.detail;
        item.tooltip = `${node.note.label} — ${node.note.detail}`;
        item.iconPath = new vscode.ThemeIcon(node.note.command ? 'arrow-right' : 'info');
        if (node.note.command) {
          item.command = {
            command: node.note.command.command,
            title: node.note.label,
            arguments: node.note.command.args ?? [],
          };
        }
        return item;
      }
    }
  }

  getChildren(node?: DocsNode): DocsNode[] {
    if (!node) {
      const roots = this.roots;
      // One source puts its areas at the top, the way the mock's tree starts at the areas. More than one keeps a
      // row per source: with two repositories open, a page named "Install" belongs to one of them. A single source
      // with no areas has nothing to lift — a repository read over the API that recorded no pages — so it keeps its
      // own row rather than leaving the view blank.
      const rows = roots.length === 0
        ? []
        : roots.length === 1 && roots[0].areas.length > 0
          ? roots[0].areas.map((area) => new AreaNode(roots[0], area, true))
          : roots.map((root) => new FolderNode(root));
      // Whatever the sources could not say for themselves: a source with no local copy, a registry that failed.
      return [...rows, ...this.notes.map((note) => new NoteNode(note))];
    }

    switch (node.kind) {
      case 'folder':
        return node.root.areas.map((area) => new AreaNode(node.root, area));
      case 'area':
        return node.area.chapters.map((chapter) => new ChapterNode(node.root, node.area, chapter));
      case 'chapter':
        return node.chapter.pages.map((page) => new PageNode(node.root, page));
      case 'page':
        return node.page.issues.map((_, index) => new IssueNode(node.root, node.page, index));
      default:
        return [];
    }
  }
}

function folderItem(node: FolderNode): vscode.TreeItem {
  const item = new vscode.TreeItem(
    node.root.folder.name,
    node.root.areas.length > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None
  );
  const { root } = node;
  const recorded = root.origin === 'catalog';
  item.description = String(root.pages);
  const stale = countStale(collectPages(root));
  item.tooltip = new vscode.MarkdownString(
    [
      `**${root.folder.name}**`,
      '',
      recorded
        ? `${root.pages} pages as the read recorded them. The checks need a folder on this machine, so none ` +
        'has been run on this source.'
        : `${root.pages} pages · ${root.issues} issues · ${root.neverReviewed} never reviewed` +
        (stale > 0 ? ` · ${stale} stale` : ''),
    ].join('\n')
  );
  item.iconPath = new vscode.ThemeIcon('folder');
  item.contextValue = recorded ? 'source' : 'folder';
  return item;
}

function areaItem(node: AreaNode): vscode.TreeItem {
  const { area } = node;
  const item = new vscode.TreeItem(
    area.title,
    area.chapters.length > 0
      ? node.top
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None
  );
  item.description = String(area.pages);
  const stale = countStale(node.area.chapters.flatMap((chapter) => chapter.pages));
  item.tooltip = new vscode.MarkdownString(
    [
      `**${area.title}**`,
      '',
      [
        area.audience ? `audience: ${area.audience}` : '',
        area.noindex ? 'excluded from the published site' : '',
        `${area.pages} pages`,
        node.root.origin === 'catalog' ? '' : `${area.neverReviewed} never reviewed`,
        area.unshipped ? `${area.unshipped} not shipped` : '',
        stale > 0 ? `${stale} stale` : '',
      ]
        .filter(Boolean)
        .join(' · '),
    ].join('\n')
  );
  item.iconPath = new vscode.ThemeIcon('folder');
  item.contextValue = 'area';
  return item;
}

function chapterItem(node: ChapterNode): vscode.TreeItem {
  const item = new vscode.TreeItem(
    node.chapter.chapter,
    node.chapter.pages.length > 0
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None
  );
  item.description = String(node.chapter.pages.length);
  item.iconPath = new vscode.ThemeIcon('folder');
  item.contextValue = 'chapter';
  return item;
}

function pageItem(node: PageNode): vscode.TreeItem {
  const { page } = node;
  const recorded = page.origin === 'catalog';
  const stale = page.provenance?.stale === true;
  const item = new vscode.TreeItem(
    page.title,
    page.issues.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
  );
  item.id = `${node.root.folder.name}:${page.id}`;

  if (recorded) {
    // Nothing was checked and nothing was reviewed, so the row says what it is: a page a read told us about.
    item.tooltip = new vscode.MarkdownString(
      [
        `**${page.title}**`,
        '',
        `id: \`${page.id}\``,
        `owner: ${page.owner || '—'}`,
        '',
        `Read from ${node.root.folder.name}, which is not a folder on this machine — so the page's file, its ` +
        'headings, its staleness and its structural checks are all unknown. Reading a clone of the source is ' +
        'what makes them known.',
      ].join('\n')
    );
    item.iconPath = new vscode.ThemeIcon('cloud', new vscode.ThemeColor('descriptionForeground'));
    item.contextValue = 'catalogPage';
    return item;
  }

  item.tooltip = new vscode.MarkdownString(
    [
      `**${page.title}**`,
      '',
      `id: \`${page.id}\``,
      `owner: ${page.owner || '—'} · audience: ${page.audience}`,
      `ship: ${page.ship ? 'yes' : 'no'} · reviewed: ${page.reviewed ?? 'never'}`,
      ...provenanceLines(page.provenance),
      '',
      page.issues.length === 0
        ? '_No structural problem._'
        : page.issues.map((issue) => `- ${issue.severity === 'error' ? '$(error)' : '$(warning)'} ${issue.message}`).join('\n'),
    ].join('\n')
  );
  // A page looks like what it is — a Markdown document, because every page is one — and its state is said in
  // colour rather than by swapping the icon, so no row stops looking like the page it stands for. Two states do
  // get their own shape, because the shape *is* the message: a declared page with no file, and the generator's
  // stale verdict.
  const colour = !page.exists ? 'problemsErrorIcon.foreground'
    : page.issues.some((issue) => issue.severity === 'error') ? 'problemsErrorIcon.foreground'
      : page.issues.length > 0 ? 'problemsWarningIcon.foreground'
        : undefined;
  item.iconPath = !page.exists
    ? new vscode.ThemeIcon('new-file', new vscode.ThemeColor('problemsErrorIcon.foreground'))
    : stale
      ? new vscode.ThemeIcon('history', new vscode.ThemeColor('descriptionForeground'))
      : colour !== undefined
        ? new vscode.ThemeIcon('file', new vscode.ThemeColor(colour))
        : new vscode.ThemeIcon('file');
  item.contextValue = page.exists ? 'page' : 'missingPage';
  item.command = {
    command: 'temcoDocs.openPage',
    title: 'Open Page',
    arguments: [node],
  };
  return item;
}

/** The lines a page tooltip adds once the generator's provenance is known — none when it is not. */
function provenanceLines(provenance: Provenance | undefined): string[] {
  if (!provenance) {
    return [];
  }
  const lines: string[] = [];
  const changed = provenance.updated ?? provenance.git?.date;
  if (changed) {
    const by = provenance.git?.author ? ` by ${provenance.git.author}` : '';
    const sha = provenance.git?.sha ? ` (${provenance.git.sha})` : '';
    lines.push(`last change: ${changed}${by}${sha}`);
  } else if (provenance.git?.sha) {
    lines.push(`last change: ${provenance.git.sha}`);
  }
  if (provenance.stale) {
    lines.push('**stale**: a commit touched code this page claims, after its last review');
  }
  const shown = provenance.headings.slice(0, 8);
  if (shown.length > 0) {
    const more = provenance.headings.length - shown.length;
    lines.push(`headings: ${shown.join(' · ')}${more > 0 ? ` · +${more} more` : ''}`);
  }
  return lines;
}

function issueItem(node: IssueNode): vscode.TreeItem {
  const issue = node.page.issues[node.index];
  const item = new vscode.TreeItem(issue.message, vscode.TreeItemCollapsibleState.None);
  item.iconPath = new vscode.ThemeIcon(
    issue.severity === 'error' ? 'error' : 'warning',
    new vscode.ThemeColor(issue.severity === 'error' ? 'problemsErrorIcon.foreground' : 'problemsWarningIcon.foreground')
  );
  item.contextValue = 'issue';
  return item;
}
