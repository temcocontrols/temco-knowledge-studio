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
import { cutUris } from './clipboard';
import { Loose, LooseFile } from './loose';
import {
  AreaGroup,
  ChapterGroup,
  DocsRoot,
  PageEntry,
  Provenance,
  ROOT_CHAPTER,
  collectPages,
  contentUri,
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
  /** A folder on disk the registry does not name yet: shown at once, and renamed by a file move. */
  constructor(readonly root: DocsRoot, readonly area: AreaGroup, readonly chapter: ChapterGroup, readonly loose = false) { }
}

class PageNode {
  readonly kind = 'page';
  constructor(readonly root: DocsRoot, readonly page: PageEntry, readonly loose = false) { }
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
  /** Folders and files on disk the registry does not name, by root — filled by the module's own refresh. */
  private loose = new Map<string, Loose>();

  setRoots(roots: DocsRoot[], notes: TreeNote[] = [], loose: Map<string, Loose> = new Map()): void {
    // One place is one row. The module already reads each folder once, but this is the surface that paints, and a
    // caller that hands the same folder twice — two reads racing at startup, one path with a separator it lost —
    // must still draw one tree. That doubling is the whole of "the list is correct until something reloads".
    const seen = new Set<string>();
    this.roots = roots.filter((root) => {
      const key = root.folder.uri.toString().replace(/[\\/]+$/, '').toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
    this.notes = notes;
    this.loose = loose;
    this.changed.fire();
  }

  refresh(): void {
    this.changed.fire();
  }

  /**
   * The row for a place the module has just written — what lets *New folder* put the tree on the folder it made.
   *
   * A loose folder has no page yet, so it is not in the registry and not in any cached read: the node is built here
   * from the place alone, and the identity travels by the row's `id` (see `getTreeItem`), not by this object.
   */
  placeNode(rootUri: string, area: string, chapter: string): DocsNode | undefined {
    const root = this.roots.find((candidate) => candidate.folder.uri.toString() === rootUri);
    const group = root?.areas.find((candidate) => candidate.area === area);
    if (root === undefined || group === undefined) {
      return undefined;
    }
    const known = group.chapters.find((candidate) => candidate.chapter === chapter);
    return known === undefined
      ? new ChapterNode(root, group, { chapter, pages: [] }, true)
      : new ChapterNode(root, group, known);
  }

  /**
   * The row a row sits under — what `reveal` walks, and it is a fold back up the same shape `getChildren` unfolds.
   *
   * Nothing is remembered between refreshes: every node carries its own place, so its parent can be rebuilt from it.
   */
  getParent(node: DocsNode): DocsNode | undefined {
    switch (node.kind) {
      case 'folder':
      case 'note':
        return undefined;
      case 'area':
        return node.top ? undefined : new FolderNode(node.root);
      case 'chapter':
        return new AreaNode(node.root, node.area, this.areasAreTop(node.root));
      case 'page': {
        const area = node.root.areas.find((candidate) => candidate.area === node.page.area);
        if (area === undefined) {
          return new FolderNode(node.root);
        }
        const chapter = area.chapters.find((candidate) => candidate.chapter === node.page.chapter);
        return chapter === undefined
          ? new ChapterNode(node.root, area, { chapter: node.page.chapter, pages: [] }, true)
          : new ChapterNode(node.root, area, chapter);
      }
      case 'issue':
        return new PageNode(node.root, node.page);
    }
  }

  /** Whether this root's areas are the view's own top level — the one case where an area has no folder above it. */
  private areasAreTop(root: DocsRoot): boolean {
    return this.roots.length === 1 && this.roots[0].folder.uri.toString() === root.folder.uri.toString();
  }

  getTreeItem(node: DocsNode): vscode.TreeItem {
    switch (node.kind) {
      case 'folder':
        return folderItem(node);
      case 'area':
        return areaItem(node, this.hasLooseFolders(node.root, node.area.area));
      case 'chapter':
        return chapterItem(node, this.hasLooseFiles(node.root, node.area.area, node.chapter.chapter));
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

  /** Whether a folder on disk sits in this area and the registry does not name it: the row must open for it. */
  private hasLooseFolders(root: DocsRoot, area: string): boolean {
    return (this.loose.get(root.folder.uri.toString())?.folders ?? []).some((folder) => folder.area === area);
  }

  /** Whether a page on disk sits in this chapter and the registry does not name it. */
  private hasLooseFiles(root: DocsRoot, area: string, chapter: string): boolean {
    return (this.loose.get(root.folder.uri.toString())?.files ?? []).some(
      (file) => file.area === area && file.chapter === chapter
    );
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
      case 'area': {
        const key = node.root.folder.uri.toString();
        const loose = (this.loose.get(key)?.folders ?? []).filter((folder) => folder.area === node.area.area);
        return [
          ...node.area.chapters.map((chapter) => new ChapterNode(node.root, node.area, chapter)),
          ...loose.map((folder) => new ChapterNode(
            node.root,
            node.area,
            { chapter: folder.chapter, pages: [] },
            true
          )),
        ];
      }
      case 'chapter': {
        const key = node.root.folder.uri.toString();
        const loose = (this.loose.get(key)?.files ?? []).filter(
          (file) => file.area === node.area.area && file.chapter === node.chapter.chapter
        );
        return [
          ...node.chapter.pages.map((page) => new PageNode(node.root, page)),
          ...loose.map((file) => new PageNode(node.root, loosePage(node.area.area, file), true)),
        ];
      }
      case 'page':
        return node.page.issues.map((_, index) => new IssueNode(node.root, node.page, index));
      default:
        return [];
    }
  }
}

/** The page a loose file will be once the generator names it — the same id rule, and nothing claimed beyond it. */
function loosePage(area: string, file: LooseFile): PageEntry {
  const id = [area, file.chapter === ROOT_CHAPTER ? '' : file.chapter, file.name].filter((part) => part.length > 0).join('/');
  return {
    id,
    title: file.title,
    area,
    chapter: file.chapter,
    order: 0,
    audience: '',
    ship: true,
    owner: '',
    reviewed: null,
    tags: [],
    keywords: [],
    uri: file.uri,
    exists: true,
    issues: [],
  };
}

function folderItem(node: FolderNode): vscode.TreeItem {
  const item = new vscode.TreeItem(
    node.root.folder.name,
    node.root.areas.length > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None
  );
  const { root } = node;
  const recorded = root.origin === 'catalog';
  item.id = `docs|folder|${root.folder.uri.toString()}`;
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

function areaItem(node: AreaNode, hasLoose = false): vscode.TreeItem {
  const { area } = node;
  const item = new vscode.TreeItem(
    area.title,
    area.chapters.length > 0 || hasLoose
      ? node.top
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None
  );
  item.description = String(area.pages);
  item.id = `docs|area|${node.root.folder.uri.toString()}|${area.area}`;
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

function chapterItem(node: ChapterNode, hasLoose = false): vscode.TreeItem {
  const item = new vscode.TreeItem(
    node.chapter.chapter,
    node.chapter.pages.length > 0 || node.loose || hasLoose
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None
  );
  item.description = node.loose ? undefined : String(node.chapter.pages.length);
  item.id = `docs|chapter|${node.root.folder.uri.toString()}|${node.area.area}|${node.chapter.chapter}`;
  // One folder looks like one folder. A folder the registry does not name yet is still a folder, so it carries the
  // same icon as the registered ones and says nothing beside its name: "not registered" on every second row is a
  // wall of the same word, and the tooltip is where that belongs.
  item.iconPath = new vscode.ThemeIcon('folder');
  // A folder that was cut is on its way somewhere else, and Explorer's way of saying so is to dim it.
  if (cutUris().has(contentUri(node.root.rootUri, node.area.area, node.chapter.chapter).toString())) {
    item.iconPath = new vscode.ThemeIcon('folder', new vscode.ThemeColor('disabledForeground'));
  }
  item.tooltip = node.loose
    ? 'A folder on disk that the registry does not name yet. Run the generator to register the pages inside it.'
    : undefined;
  item.contextValue = node.loose ? 'looseChapter' : 'chapter';
  // Double-click renames it, the way a folder in Explorer does. A registered chapter renames its pages with it, so
  // the act confirms what it will move before it moves anything — see `renameFolder` in `pageOps.ts`.
  item.command = { command: 'temcoDocs.rename', title: 'Rename…' };
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
  item.id = `docs|page|${node.root.folder.uri.toString()}|${page.id}`;

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
  item.contextValue = node.loose ? 'loosePage' : page.exists ? 'page' : 'missingPage';
  if (node.loose) {
    // A page on disk is a page: the same file icon, dimmed, and its tooltip says what the registry does not know yet.
    item.iconPath = new vscode.ThemeIcon('file', new vscode.ThemeColor('descriptionForeground'));
    item.tooltip = 'A page on disk that the registry does not name yet. Run the generator to register it.';
  }
  // A page that was cut is on its way somewhere else: Explorer dims it until it lands.
  if (cutUris().has(page.uri.toString())) {
    item.iconPath = new vscode.ThemeIcon('file', new vscode.ThemeColor('disabledForeground'));
  }
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
  item.id = `docs|issue|${node.root.folder.uri.toString()}|${node.page.id}|${node.index}`;
  item.iconPath = new vscode.ThemeIcon(
    issue.severity === 'error' ? 'error' : 'warning',
    new vscode.ThemeColor(issue.severity === 'error' ? 'problemsErrorIcon.foreground' : 'problemsWarningIcon.foreground')
  );
  item.contextValue = 'issue';
  return item;
}
