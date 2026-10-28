// Operating on a page: creating one, naming it, moving it, retiring it.
//
// The Workspace view is a *view* of the registry, so everything here is one of two kinds of act, and the
// difference matters to whoever reviews the diff:
//
//   * a **file** is written — a new page. The repository's own generator then finds it, derives its `area`,
//     `chapter` and `order` from its path and its title from its first `#`, and adds the entry. That is why
//     nothing here writes an entry for a page that did not exist: it does not have to.
//   * a **value** is changed in `docs/help/registry.json` — a title, an order, a chapter, a retirement. These
//     are the fields a person curated, the generator keeps them (`existing values win`), and each write names
//     the value it replaces in the confirmation before it happens.
//
// Two things this deliberately never does.
//
// **It never moves a page's file as a side effect.** `05-content-and-registry.md` rule 1: a page's id *is* its path,
// and the app's routes, the MCP input and every inbound link are built on it. So a move is only ever a *named* act —
// *Rename…*, a *Cut* pasted somewhere else — and every one of them writes the old id into the entry's `aliases` so
// the old address keeps resolving. A drag inside the tree re-files a page by writing its `chapter` and leaves the file
// where it is; only an explicit move pastes a file.
//
// **It never renumbers a chapter.** Placing a page between two others by rewriting every `order` in the chapter
// is the generator's own job (it hands out 10, 20, 30… to whatever nobody curated); a two-page swap is what a
// move means here, so the diff is two numbers.
//
// *Delete* exists, and it is told apart from retirement in words every time it is offered: retirement is a registry
// act — `deprecated` and the replacement — and the file stays where it is so the generated redirect keeps old links
// working (`14-governance.md`, *Deprecation and retirement*).

import * as path from 'path';
import * as vscode from 'vscode';
import { runScript, scriptsIn } from './builds';
import { ClipEntry, clipboard, setClipboard } from './clipboard';
import { DocsRoot, PageEntry, ROOT_CHAPTER, collectPages, contentUri, fileExists } from './registry';
import { RegistryEdit, describeChange } from './registryEdit';
import { Catalog, slugOf } from './store';
import { fileColumn } from './surface';
import { DocsNode, pageFromNode } from './tree';

/** The MIME a dragged page carries: the page id. */
const PAGE_MIME = 'application/vnd.code.tree.temcoDocs.page';
/** The MIME a dragged folder carries: where it sits, because a folder is a place rather than a page. */
const FOLDER_MIME = 'application/vnd.code.tree.temcoDocs.folder';

export interface Kind {
  label: string;
  detail: string;
  /** The headings a page of this kind starts with — and nothing else. An invented sentence is a sentence to delete. */
  headings: string[];
}

/** The kinds, in the order a page offers them. Exported so the New page page shows this list and no other. */
export const KINDS: Kind[] = [
  { label: 'Article', detail: 'what it is · how it is set up · what to read next', headings: ['Overview', 'Configuration', 'Related pages'] },
  { label: 'Task', detail: 'a job a reader has to finish', headings: ['Before you start', 'Steps', 'If it does not work'] },
  { label: 'Reference', detail: 'fields, registers, commands — tables', headings: ['Fields', 'Notes'] },
  { label: 'Troubleshooting', detail: 'one symptom, one cause, one fix', headings: ['Symptom', 'Cause', 'Fix'] },
  { label: 'Release note', detail: 'what changed in a build', headings: ['What is new', 'Fixed', 'Known issues'] },
];

/** The chapter that is the area folder itself — what a page directly in an area belongs to. */
export const AREA_CHAPTER = ROOT_CHAPTER;
export interface PageDeps {
  roots: () => readonly DocsRoot[];
  output: vscode.OutputChannel;
  /** The project being worked on: a draft belongs to it, and the Review Center lists it by that name. */
  project: () => string | undefined;
  /** Re-read the views: every act here changes either a file the view lists or a value it shows. */
  redraw: () => void;
  /**
   * The row the person has selected in the Workspace view.
   *
   * A command can be started where nothing names a row — the view's own toolbar, or the palette — and there the
   * row they have selected is the one they mean. A reader rather than a node, so this module never holds the
   * tree view itself.
   */
  selected: () => DocsNode | undefined;
  /**
   * Open the page that creates a page.
   *
   * Creating one needs a name, and a name is not asked for in a tree: the page shows every field at once, can
   * draft the body, and writes only what a person has read. A callback rather than an import, so that this
   * module and the page do not depend on each other.
   */
  newPagePage: (seed: NewPageSeed) => void;
  /**
   * Put the panel on a row that was just made: expand whatever hides it, select it, and give it the keyboard.
   *
   * An act that writes a folder *has* to do this — the row appears under a folder the person may have collapsed, and
   * a folder that exists and cannot be seen is indistinguishable from one that was never made.
   */
  reveal: (place: { rootUri: string; area: string; chapter: string }) => void;
}

/** Where a new page is going, in the names the form shows: the source, the area, the chapter and the kind. */
export interface NewPageSeed {
  /** A source's folder name, as the tree shows it. */
  source?: string;
  area?: string;
  chapter?: string;
  kind?: string;
  /**
   * The shape of the file: `document` (the template's headings), `markdown` (the title, and a body to write) or
   * `empty` (the title and nothing else). Not a registry value — it only decides the text the file starts with.
   */
  pageType?: string;
  /** True when the act was *New chapter*: the page opens ready to make a folder and its first page. */
  chapterMode?: boolean;
  /** True when the page should ask the model what this source is missing as soon as it opens. */
  analyse?: boolean;
}

/** One page to write, complete. */
export interface NewPageSpec extends NewPageSeed {
  title: string;
  /** The file name without `.md`. Empty or invalid means "derive it from the title", which is what a form posts. */
  slug?: string;
  /** What to write under the title — a draft the person read. Nothing means the kind's headings alone. */
  body?: string;
  /** True for the title-only input in the tree: the file is written without the modal confirmation. */
  quick?: boolean;
}

interface Place {
  root: DocsRoot;
  area: string;
  chapter: string;
}

export class PageOperations implements vscode.TreeDragAndDropController<DocsNode> {
  readonly dragMimeTypes = [PAGE_MIME, FOLDER_MIME];
  readonly dropMimeTypes = [PAGE_MIME, FOLDER_MIME];

  constructor(private readonly deps: PageDeps) { }

  handleDrag(source: readonly DocsNode[], data: vscode.DataTransfer): void {
    const pages = source.flatMap((node) =>
      node.kind === 'page' && node.page.exists && node.root.origin !== 'catalog' ? [node.page.id] : []
    );
    if (pages.length > 0) {
      data.set(PAGE_MIME, new vscode.DataTransferItem(pages.join('\n')));
      return;
    }
    // A folder drags too, because moving one into another area is an ordinary act — and the only thing a folder
    // needs carried is the place it sits in; its name is its own.
    const folder = source.find((node) => node.kind === 'chapter' && node.root.origin !== 'catalog');
    if (folder?.kind === 'chapter') {
      data.set(
        FOLDER_MIME,
        new vscode.DataTransferItem(
          JSON.stringify({
            rootUri: folder.root.rootUri.toString(),
            area: folder.area.area,
            chapter: folder.chapter.chapter,
          })
        )
      );
    }
  }

  /**
   * Dropping a page on a chapter moves it there; dropping it on a page puts it in that page's place; dropping a folder
   * on an area moves the folder into that area.
   *
   * The page's own drop is a registry write and is confirmed first — the one place where dragging something in a tree
   * changes a value in a product repository, so it says what it will write before it writes it. A folder moves on
   * disk, which changes the id of every page inside it, and that is confirmed the same way.
   */
  async handleDrop(target: DocsNode | undefined, data: vscode.DataTransfer): Promise<void> {
    const folderItem = data.get(FOLDER_MIME);
    if (folderItem !== undefined) {
      const carried = JSON.parse(await folderItem.asString()) as { rootUri: string; area: string; chapter: string };
      await this.dropFolder(target, carried);
      return;
    }
    const item = data.get(PAGE_MIME);
    if (item === undefined || target === undefined) {
      return;
    }
    const ids = (await item.asString()).split('\n').filter((id) => id.length > 0);
    for (const id of ids) {
      await this.dropPage(target, id);
    }
  }

  private async dropPage(target: DocsNode, id: string): Promise<void> {
    const found = findPage(this.deps.roots(), id);
    if (!found) {
      return;
    }
    const { root, page } = found;
    if (root.origin === 'catalog' || !page.exists) {
      void vscode.window.showInformationMessage(
        'Temco Docs: this page was read from a source rather than found on this machine, so it cannot be moved from here.'
      );
      return;
    }
    const edit = await RegistryEdit.open(root.registryUri);
    if (!edit || edit.entry(page.id) === undefined) {
      void vscode.window.showInformationMessage(
        `Temco Docs: the registry has no entry for “${page.title}” yet. Run the repository's own ` +
        'generator (Regenerate the index), and it will have one.'
      );
      return;
    }

    if (target.kind === 'page') {
      await dropOnPage(this.deps, edit, page, target.page);
      return;
    }
    const place = placeOf(target);
    if (!place) {
      void vscode.window.showInformationMessage('Temco Docs: drop a page on an area, a folder, or another page.');
      return;
    }
    await moveToChapter(this.deps, edit, page, place.area, place.chapter);
  }

  /** A folder dropped on an area moves there — the same act *Cut* and *Paste* perform, with the folder as the row. */
  private async dropFolder(
    target: DocsNode | undefined,
    carried: { rootUri: string; area: string; chapter: string }
  ): Promise<void> {
    const root = this.deps.roots().find((candidate) => candidate.rootUri.toString() === carried.rootUri);
    // A folder moves into an area: an area row, or the project row that stands for the only one.
    const into = target?.kind === 'area'
      ? target
      : target?.kind === 'project' && target.place !== undefined
        ? { root: target.place.root, area: target.place.area }
        : undefined;
    if (root === undefined || into === undefined || into.root.rootUri.toString() !== carried.rootUri) {
      void vscode.window.showInformationMessage('Temco Docs: drop a folder on an area — that is what a folder moves into.');
      return;
    }
    if (into.area.area === carried.area) {
      void vscode.window.showInformationMessage(
        `Temco Docs: “${carried.chapter}” is already in ${into.area.title}.`
      );
      return;
    }
    await carryEntries(
      this.deps,
      root,
      {
        uri: contentUri(root.rootUri, carried.area, carried.chapter),
        folder: true,
        rootUri: carried.rootUri,
      },
      contentUri(root.rootUri, into.area.area),
      true
    );
  }
}

/**
 * A folder in the documentation tree, made the way Explorer makes one: a name, a directory, and a row at once.
 *
 * A chapter is a folder, and until now it arrived with its first page — which meant "add a folder" wrote prose
 * nobody had asked for. The directory is made empty, the tree shows it on the next refresh as a **loose** row,
 * and the pages put inside it are ordinary pages that the generator will register.
 */
/**
 * A folder in the documentation tree, made the way Explorer makes one: it appears, then you name it.
 *
 * Explorer can put the new row straight into an edit field, because it owns its tree; an extension cannot — no API
 * creates a row in edit mode. So the two halves are swapped: the folder is created **at once** with a name that is
 * only a placeholder, the row is in the tree before the message closes, and naming it is F2 on that row (which
 * prefills the current name, exactly what the old dialog did — only now it is optional and after the fact).
 */
async function createFolder(context: vscode.ExtensionContext, deps: PageDeps, node: DocsNode | undefined): Promise<void> {
  const place = areaOf(node ?? deps.selected(), deps.roots()) ?? await citeAFolder(context, deps);
  if (place === undefined) {
    return;
  }

  // A name nobody typed still has to be unique: new-folder, new-folder-2, …
  const parent = place.parent.length === 0 ? [] : place.parent.split('/');
  let suggestion = 'new-folder';
  for (let suffix = 2; await fileExists(contentUri(place.root.rootUri, place.area, ...parent, suggestion)) && suffix < 100; suffix++) {
    suggestion = `new-folder-${suffix}`;
  }

  // The name comes first and the folder second. The title names the folder it goes **into**, because the panel is a
  // tree of several folders and "a new one" is not an answer to where it went.
  const into = [place.area, ...parent].join(' / ');
  const typed = await vscode.window.showInputBox({
    title: `New folder in “${into}”`,
    prompt: 'A folder inside this one. Pages and folders can be put in it.',
    value: suggestion,
    valueSelection: [0, suggestion.length],
    validateInput: (value) => nameProblem(value),
  });
  if (typed === undefined) {
    return;
  }
  const name = typed.trim();
  const folder = contentUri(place.root.rootUri, place.area, ...parent, name);
  if (await fileExists(folder)) {
    void vscode.window.showWarningMessage(`Temco Docs: ${name} already exists in ${into}.`);
    return;
  }

  await vscode.workspace.fs.createDirectory(folder);
  // The read is awaited rather than fired: the reveal below is a promise about a row that only exists after it.
  await vscode.commands.executeCommand('temcoDocs.refresh');
  deps.reveal({
    rootUri: place.root.folder.uri.toString(),
    area: place.area,
    chapter: [...parent, name].join('/'),
  });
}

/**
 * Removing a folder — the file system act, and the registry act that follows it.
 *
 * A folder the registry does not name is deleted and nothing else happens: no entry exists, so nothing has to be
 * forgotten. A registered chapter is different — its pages have entries, and an entry whose file is gone is a page
 * that cannot exist — so the source's own generator is run afterwards, or, in a source that has none, the entries
 * are removed here one by one.
 *
 * The folder goes to the Recycle Bin rather than into nothing: this is the one act in this module that takes work
 * away, so it asks first and it can be undone from outside.
 */
async function removeFolder(deps: PageDeps, node: DocsNode | undefined): Promise<void> {
  const row = targeted(deps, node);
  if (row?.kind !== 'chapter') {
    void vscode.window.showInformationMessage(
      'Temco Docs: this removes one folder — pick a folder inside an area in the Documentation panel first.'
    );
    return;
  }
  if (row.root.origin === 'catalog') {
    void vscode.window.showInformationMessage(
      `Temco Docs: “${row.chapter.chapter}” was read from a source that is not on this machine, so there is nothing here to remove.`
    );
    return;
  }
  const folder = contentUri(row.root.rootUri, row.area.area, ...row.segments);
  const files = await markdownUnder(folder);
  const registered = row.loose ? 0 : row.chapter.pages.length;
  const answer = await vscode.window.showWarningMessage(
    `Remove the folder “${row.chapter.chapter}”?`,
    {
      modal: true,
      detail: [
        `${folder.fsPath} moves to the Recycle Bin, with ${files} page${files === 1 ? '' : 's'} in it.`,
        registered > 0
          ? `${registered} of those page${registered === 1 ? ' is' : 's are'} registered, and the registry is updated after it.`
          : '',
        'To keep a page reachable at its old address, retire it instead — a removed page leaves a link with nothing behind it.',
      ].filter((line) => line.length > 0).join('\n'),
    },
    'Remove',
    'Cancel'
  );
  if (answer !== 'Remove') {
    return;
  }

  await vscode.workspace.fs.delete(folder, { recursive: true, useTrash: true });
  if (registered > 0) {
    if (scriptsIn([row.root]).has('docs:registry')) {
      await runScript(deps.roots(), deps.output, 'docs:registry');
    } else {
      const edit = await RegistryEdit.open(row.root.registryUri);
      if (edit !== undefined) {
        let written = false;
        for (const page of row.chapter.pages) {
          written = edit.remove(page.id) || written;
        }
        if (written) {
          await edit.save();
        }
      }
    }
  }
  deps.redraw();
}

/**
 * Removing a page — its file, and the entry that names it.
 *
 * Both halves go in one step, because a file without an entry is a file no tree lists, and an entry without a file is
 * a page that cannot exist. The confirmation says the difference out loud: *Retire* is what keeps a page's address
 * working, and removal is what does not.
 */
async function removeFile(deps: PageDeps, node: DocsNode | undefined): Promise<void> {
  const row = targeted(deps, node);
  const page = pageFromNode(row)?.page;
  if (row?.kind !== 'page' || page === undefined) {
    void vscode.window.showInformationMessage(
      'Temco Docs: this removes one page — pick a page in the Documentation panel first.'
    );
    return;
  }
  // The root the file lives in. A page the registry does not name — which is every page until a generator runs —
  // has no entry to look up by id, and it is still a file to delete: the path answers it, not the registry.
  const found = findPage(deps.roots(), page.id);
  const root = found?.root ?? deps.roots().find((candidate) => {
    const base = `${candidate.rootUri.fsPath.toLowerCase()}${path.sep}`;
    return page.uri.fsPath.toLowerCase().startsWith(base);
  });
  if (root === undefined) {
    void vscode.window.showInformationMessage(
      'Temco Docs: that page is not inside a folder this window is reading, so there is nothing here to remove.'
    );
    return;
  }
  if (root.origin === 'catalog') {
    void vscode.window.showInformationMessage(
      `Temco Docs: “${page.title}” was read from a source that is not on this machine, so there is nothing here to remove.`
    );
    return;
  }
  const onDisk = await fileExists(page.uri);
  const answer = await vscode.window.showWarningMessage(
    `Delete “${page.title}”?`,
    {
      modal: true,
      detail: [
        onDisk ? `${page.uri.fsPath} moves to the Recycle Bin.` : 'Its file is already gone.',
        row.loose
          ? 'It has no registry entry yet, so nothing else changes.'
          : `Its entry in ${path.basename(root.registryUri.fsPath)} is removed with it.`,
        onDisk ? 'To keep its address working, retire it instead — a retired page keeps its redirect.' : '',
      ].filter((line) => line.length > 0).join('\n'),
    },
    'Delete',
    'Cancel'
  );
  if (answer !== 'Delete') {
    return;
  }

  if (onDisk) {
    await vscode.workspace.fs.delete(page.uri, { recursive: false, useTrash: true });
  }
  if (!row.loose) {
    const edit = await RegistryEdit.open(root.registryUri);
    const removed = edit !== undefined && edit.remove(page.id);
    if (edit !== undefined && removed) {
      await edit.save();
    }
  }
  deps.redraw();
}

/** How many Markdown pages a folder holds, at any depth — what a removal is about to take. */
async function markdownUnder(uri: vscode.Uri): Promise<number> {
  return (await markdownFilesUnder(uri)).length;
}

/** Every Markdown page under a folder, at any depth — what a move has to carry with it. */
async function markdownFilesUnder(uri: vscode.Uri): Promise<vscode.Uri[]> {
  let entries: [string, vscode.FileType][] = [];
  try {
    entries = await vscode.workspace.fs.readDirectory(uri);
  } catch {
    return [];
  }
  const files: vscode.Uri[] = [];
  for (const [name, kind] of entries) {
    const child = vscode.Uri.joinPath(uri, name);
    if (kind === vscode.FileType.Directory) {
      files.push(...await markdownFilesUnder(child));
    } else if (/\.md$/i.test(name)) {
      files.push(child);
    }
  }
  return files;
}

/**
 * Renaming a folder in the tree — one act, two sizes.
 *
 * A folder the registry does not name is a directory move and nothing else: no id exists yet, so nothing can break.
 * A registered chapter is the heavier act, and the one people actually ask for: the page id **is** the path, so
 * moving the folder changes the id of every page inside it. It is allowed here — as a named act — and it carries the
 * three things that make it safe: the curated values move with the pages, every old id is written into the new
 * entry's `aliases` so inbound links still resolve, and the confirmation says how many ids will change first.
 */
async function renameFolder(deps: PageDeps, node: DocsNode | undefined): Promise<void> {
  const row = targeted(deps, node);
  const chapter = row?.kind === 'chapter' ? row : undefined;
  if (chapter === undefined) {
    void vscode.window.showInformationMessage(
      'Temco Docs: this renames one folder — pick a folder inside an area in the Documentation panel first.'
    );
    return;
  }
  if (chapter.root.origin === 'catalog') {
    void vscode.window.showInformationMessage(
      `Temco Docs: “${chapter.chapter.chapter}” was read from a source that is not on this machine, so there is ` +
      'nothing here to rename.'
    );
    return;
  }

  const { root, area } = chapter;
  const current = chapter.chapter.chapter;
  const pages = chapter.loose ? [] : chapter.chapter.pages;
  const typed = await vscode.window.showInputBox({
    title: `Rename the folder “${current}”`,
    prompt: pages.length === 0
      ? 'A directory move. Nothing in the registry names this folder yet, so no page id changes.'
      : `${pages.length} page${pages.length === 1 ? '' : 's'} move with it — their ids change, and each old id is ` +
        'kept as an alias so links still resolve.',
    value: current,
    valueSelection: [0, current.length],
    validateInput: (value) => nameProblem(value),
  });
  if (typed === undefined) {
    return;
  }
  const next = typed.trim();
  if (next === current) {
    return;
  }
  const from = contentUri(root.rootUri, area.area, ...chapter.segments);
  const to = contentUri(root.rootUri, area.area, ...chapter.segments.slice(0, -1), next);
  if (await fileExists(to)) {
    void vscode.window.showWarningMessage(`Temco Docs: ${next} already exists in ${area.title}.`);
    return;
  }

  // The registry is read *before* anything moves: it is the only place these pages' curated values are written down,
  // and after the move the ids that name them no longer exist.
  const edit = pages.length === 0 ? undefined : await RegistryEdit.open(root.registryUri);
  if (pages.length > 0 && edit === undefined) {
    return;
  }
  const moves = pages.map((page) => ({
    from: page.id,
    to: `${area.area}/${next}/${page.id.split('/').pop() ?? ''}`,
  }));

  const answer = await vscode.window.showWarningMessage(
    `Rename “${current}” to “${next}”?`,
    {
      modal: true,
      detail: [
        `${from.fsPath} → ${to.fsPath}`,
        moves.length === 0
          ? 'No page id changes: nothing in the registry names this folder yet.'
          : `${moves.length} page id${moves.length === 1 ? '' : 's'} change, and each old one is kept as an alias: ` +
            moves.map((move) => move.from).join(', '),
      ].join('\n'),
    },
    'Rename',
    'Cancel'
  );
  if (answer !== 'Rename') {
    return;
  }

  await vscode.workspace.fs.rename(from, to, { overwrite: false });

  let aliased = 0;
  if (edit !== undefined) {
    for (const move of moves) {
      const old = edit.entry(move.from);
      if (old === undefined) {
        continue;
      }
      // Everything the registry curates travels: title, order, owner, audience, ship, tags, keywords. Only the two
      // parts that are the *path* are rewritten, plus the alias that keeps the old address alive.
      const fields: Record<string, unknown> = { ...old, chapter: next };
      const kept = Array.isArray(fields['aliases']) ? fields['aliases'].map(String) : [];
      if (!kept.includes(move.from)) {
        kept.push(move.from);
      }
      fields['aliases'] = kept;
      edit.remove(move.from);
      if (edit.addPage(move.to, fields)) {
        aliased += 1;
      }
    }
    await edit.save();
  }

  deps.redraw();
  void vscode.window.showInformationMessage(
    moves.length === 0
      ? `Temco Docs: the folder is “${next}” now.`
      : `Temco Docs: the folder is “${next}” now, and ${aliased} page id${aliased === 1 ? ' is' : 's are'} ` +
        'aliased to where they came from.'
  );
}

/**
 * A project with no documentation folder yet, made usable in one step — the way Explorer always has a folder to
 * make another one in.
 *
 * The application reads *the project's sources*, so with none cited there is no `docs/` to write into: that is why
 * the first New Folder used to end in a message. Here it asks for the folder, records it as a source of the project,
 * cites it, re-reads, and hands back its first area — so the folder is created in the same click.
 */
async function citeAFolder(
  context: vscode.ExtensionContext,
  deps: PageDeps
): Promise<{ root: DocsRoot; area: string; parent: string } | undefined> {
  const project = deps.project();
  if (project === undefined) {
    void vscode.window.showWarningMessage(
      'Temco Docs: no project is being worked on. Choose one on the Dashboard, then add a folder.'
    );
    return undefined;
  }
  const picked = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Use This Documentation Folder',
    title: 'Which folder holds the documentation (the one with docs/help/registry.json)?',
  });
  const folder = picked?.[0];
  if (folder === undefined) {
    return undefined;
  }
  const registry = vscode.Uri.joinPath(folder, 'docs', 'help', 'registry.json');
  if (!(await fileExists(registry))) {
    // A folder with no registry has no area, and an area is what a folder is created inside. Making the smallest
    // valid one here is what turns "pick a folder" into "you can start": docs/help/registry.json, one area named
    // after the folder, and the area's directory. The repository's own generator owns everything after that.
    const answer = await vscode.window.showWarningMessage(
      `${folder.fsPath} holds no documentation yet. Create docs/help/registry.json here, with one area, so pages ` +
      'can be written into it?',
      { modal: true },
      'Create the Documentation Folder'
    );
    if (answer !== 'Create the Documentation Folder') {
      return undefined;
    }
    const areaName = slugOf(path.basename(folder.fsPath)) || 'docs';
    try {
      await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(folder, 'docs', 'help'));
      await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(folder, 'docs', areaName));
      const registry = { version: 1, areas: { [areaName]: { title: path.basename(folder.fsPath) } }, pages: {} };
      await vscode.workspace.fs.writeFile(
        vscode.Uri.joinPath(folder, 'docs', 'help', 'registry.json'),
        Buffer.from(`${JSON.stringify(registry, null, 2)}\n`, 'utf8')
      );
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Temco Docs: the documentation folder could not be created — ${error instanceof Error ? error.message : String(error)}`
      );
      return undefined;
    }
  }

  const name = path.basename(folder.fsPath);
  const slug = slugOf(name);
  let catalog: Catalog | undefined;
  try {
    catalog = await Catalog.open(context);
    const existing = sourceAt(catalog, folder.fsPath);
    const cite = existing ?? slug;
    if (existing === undefined) {
      try {
        catalog.addSource({
          kind: 'folder',
          name,
          slug,
          path: folder.fsPath,
          docsRoot: 'docs',
        });
      } catch {
        // Already known: the row was recorded by an earlier visit, and citing it is what this call is for.
      }
    }
    catalog.attachSource(project, cite);
  } catch (error) {
    void vscode.window.showErrorMessage(
      `Temco Docs: the folder could not be cited — ${error instanceof Error ? error.message : String(error)}`
    );
    return undefined;
  } finally {
    catalog?.close();
  }

  // The command waits for the read, so the roots below are the ones the new source produced.
  await vscode.commands.executeCommand('temcoDocs.refresh');
  const root = deps.roots().find(
    (candidate) => candidate.folder.uri.fsPath.toLowerCase() === folder.fsPath.toLowerCase()
  );
  const area = root?.areas[0];
  if (root === undefined || area === undefined) {
    void vscode.window.showWarningMessage(
      `Temco Docs: ${name} is cited, but its registry declares no area yet — nothing can be created inside it ` +
      'until docs/help/registry.json names one.'
    );
    return undefined;
  }
  return { root, area: area.area, parent: '' };
}

/**
 * The source that already points at this folder, if one is recorded.
 *
 * A source is a row about a place; two rows about the same place are two roots in the tree, which is how the same
 * folder was drawn twice. Anywhere this module is about to record a folder it asks this first and cites the row that
 * is already there.
 */
export function sourceAt(catalog: Catalog, folder: string): string | undefined {
  const wanted = path.resolve(folder).toLowerCase();
  for (const row of catalog.sources()) {
    const detail = catalog.source(row.slug);
    if (detail?.path !== undefined && path.resolve(detail.path).toLowerCase() === wanted) {
      return row.slug;
    }
  }
  return undefined;
}

/** Why a folder name cannot be used — the same rule a page's file name follows. */
function nameProblem(value: string): string | undefined {
  const name = value.trim();
  if (name.length === 0) {
    return 'A folder needs a name.';
  }
  if (/[\\/:*?"<>|\s]/.test(name)) {
    return 'No spaces or \\ / : * ? " < > | — a folder name is a segment of a page id.';
  }
  return undefined;
}

/** The area a row belongs to: what a new folder is created inside. */
function areaOf(node: DocsNode | undefined, roots: readonly DocsRoot[]): { root: DocsRoot; area: string; parent: string } | undefined {
  if (node?.kind === 'area') {
    return { root: node.root, area: node.area.area, parent: '' };
  }
  if (node?.kind === 'chapter') {
    // A folder made while a folder is selected goes **inside** it, the way Explorer nests them.
    return { root: node.root, area: node.area.area, parent: node.segments.join('/') };
  }
  if (node?.kind === 'page') {
    const segments = node.page.id.split('/').slice(1, -1).filter((segment) => segment.length > 0);
    return { root: node.root, area: node.page.area, parent: segments.join('/') };
  }
  const root = roots.find((candidate) => candidate.areas.length > 0);
  const area = root?.areas[0];
  return root === undefined || area === undefined ? undefined : { root, area: area.area, parent: '' };
}

/**
 * Rename a page's **file**, which is also its id — Explorer's F2, on the thing a path is.
 *
 * `05-content-and-registry.md` rule 1 allows this only as a *named act with an `aliases` entry*: the page id is the
 * path, so every inbound link, the app's own routes and the MCP input are built on the old one. The old id is
 * therefore written into the new entry's `aliases` before the generator is believed, and a *registered* page in a
 * project with no generator is refused: without one there is no entry to carry the alias, and a rename would orphan
 * the links. A page the registry does not name yet has nothing to orphan, so it renames its file anywhere.
 *
 * The **title** is not touched. It is prose; this is a path.
 */
async function renameFile(deps: PageDeps, node: DocsNode | undefined): Promise<void> {
  // A folder row takes the same key: F2 is "rename what is selected", whichever kind of row that is. The command
  // arrives without a node when it comes from the keyboard, so the selection has to be resolved first.
  const subject = node ?? deps.selected();
  if (subject?.kind === 'chapter' && subject.loose) {
    await renameFolder(deps, subject);
    return;
  }
  const pageNode = pageFromNode(subject);
  const page = pageNode?.page;
  const loose = pageNode?.loose === true;
  if (pageNode === undefined || page === undefined) {
    void vscode.window.showInformationMessage('Temco Docs: select the page whose file you want to rename.');
    return;
  }
  if (!page.exists) {
    void vscode.window.showWarningMessage(`Temco Docs: “${page.title}” has no file yet, so there is nothing to rename.`);
    return;
  }
  const root = deps.roots().find((candidate) => page.uri.fsPath.startsWith(candidate.rootUri.fsPath));
  if (root === undefined) {
    void vscode.window.showWarningMessage('Temco Docs: that page is not inside a folder this window is reading.');
    return;
  }
  const current = path.basename(page.uri.fsPath, path.extname(page.uri.fsPath));
  const typed = await vscode.window.showInputBox({
    title: `Rename the file of “${page.title}”`,
    prompt: loose
      ? 'The file name, without .md. It is also the page id the generator will read.'
      : 'The file name, without .md. It is also the page id — the old one is kept as an alias.',
    value: current,
    valueSelection: [0, current.length],
    validateInput: (value) => {
      const name = value.trim();
      if (name.length === 0) {
        return 'A page needs a file name.';
      }
      if (/[\\/:*?"<>|]/.test(name)) {
        return 'A file name cannot contain \\ / : * ? " < > |';
      }
      if (name === current) {
        return 'That is the current name.';
      }
      return undefined;
    },
  });
  if (typed === undefined) {
    return;
  }
  const slug = typed.trim();
  if (slug === current) {
    return;
  }
  const target = vscode.Uri.joinPath(vscode.Uri.file(path.dirname(page.uri.fsPath)), `${slug}.md`);
  if (await fileExists(target)) {
    void vscode.window.showWarningMessage(`Temco Docs: ${slug}.md already exists beside this page.`);
    return;
  }

  await vscode.workspace.fs.rename(page.uri, target, { overwrite: false });
  const base = contentUri(root.rootUri).fsPath;
  const newId = path.relative(base, target.fsPath).replace(/\\/g, '/').replace(/\.md$/i, '');

  if (loose) {
    // Nothing names this file yet, so there is no entry to carry: the path *is* the page id, and the tree reads the
    // new one from disk on the next refresh.
    deps.redraw();
    void vscode.window.showInformationMessage(`Temco Docs: the file is ${slug}.md now.`);
    return;
  }

  // A registered page keeps what a person curated: the entry is moved to the new id by hand, because the id is the
  // path and the old entry would otherwise be left pointing at a file that is no longer there. No generator script
  // is needed for this — the registry is a record we maintain, not a program we depend on.
  const edit = await RegistryEdit.open(root.registryUri);
  let carried = false;
  if (edit !== undefined) {
    const old = edit.entry(page.id);
    if (old !== undefined) {
      edit.remove(page.id);
      const segments = newId.split('/');
      for (const [field, value] of Object.entries(old)) {
        if (field === 'area' || field === 'chapter' || field === 'aliases') {
          continue;
        }
        edit.set(newId, field, value);
      }
      // The two fields that describe the place are written from the new place, never carried from the old one.
      edit.set(newId, 'area', segments[0]);
      edit.set(newId, 'chapter', segments[1] ?? segments[0]);
      edit.set(newId, 'aliases', [...((old['aliases'] as string[] | undefined) ?? []), page.id]);
      await edit.save();
      carried = true;
    }
  }
  deps.redraw();

  void vscode.window.showInformationMessage(
    carried
      ? `Temco Docs: ${slug}.md is the page now, and ${page.id} is kept as an alias so old links still resolve.`
      : `Temco Docs: the file is ${slug}.md now. Its registry entry could not be moved — run the project's ` +
        'generator, or rename the entry by hand.'
  );
}

export function registerPageCommands(context: vscode.ExtensionContext, deps: PageDeps): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('temcoDocs.newPage', (node?: DocsNode) =>
      startNewPage(deps, node, {})
    ),
    vscode.commands.registerCommand('temcoDocs.newChapter', (node?: DocsNode) =>
      createFolder(context, deps, node)
    ),
    // The kinds, one command each. A menu entry cannot carry an argument, so the submenu in `package.json` is the
    // list of kinds and each entry names the command that already knows its own. They are written out rather than
    // built in a loop so that `scripts/check-commands.mjs` sees every id like it sees the others. Each one opens
    // the same page with its kind already chosen.
    vscode.commands.registerCommand('temcoDocs.newPage.article', (node?: DocsNode) =>
      startNewPage(deps, node, { kind: 'Article' })
    ),
    vscode.commands.registerCommand('temcoDocs.newPage.task', (node?: DocsNode) =>
      startNewPage(deps, node, { kind: 'Task' })
    ),
    vscode.commands.registerCommand('temcoDocs.newPage.reference', (node?: DocsNode) =>
      startNewPage(deps, node, { kind: 'Reference' })
    ),
    vscode.commands.registerCommand('temcoDocs.newPage.troubleshooting', (node?: DocsNode) =>
      startNewPage(deps, node, { kind: 'Troubleshooting' })
    ),
    vscode.commands.registerCommand('temcoDocs.newPage.releaseNote', (node?: DocsNode) =>
      startNewPage(deps, node, { kind: 'Release note' })
    ),
    vscode.commands.registerCommand('temcoDocs.renamePage', (node?: DocsNode) => renamePage(deps, node)),
    // Explorer's own three names, because that is what a file tree is read with: *Rename…* and *Delete* are one act
    // each, whichever kind of row is selected, and *Cut*, *Copy* and *Paste* carry a row to another folder.
    vscode.commands.registerCommand('temcoDocs.rename', (node?: DocsNode) => renameRow(deps, node)),
    vscode.commands.registerCommand('temcoDocs.delete', (node?: DocsNode) => deleteRow(deps, node)),
    vscode.commands.registerCommand('temcoDocs.cut', (node?: DocsNode) => carry(deps, node, true)),
    vscode.commands.registerCommand('temcoDocs.copy', (node?: DocsNode) => carry(deps, node, false)),
    vscode.commands.registerCommand('temcoDocs.paste', (node?: DocsNode) => paste(deps, node)),
    vscode.commands.registerCommand('temcoDocs.movePageUp', (node?: DocsNode) => movePage(deps, node, -1)),
    vscode.commands.registerCommand('temcoDocs.movePageDown', (node?: DocsNode) => movePage(deps, node, 1)),
    vscode.commands.registerCommand('temcoDocs.retirePage', (node?: DocsNode) => retirePage(deps, node))
  );
}

/**
 * The row a command means.
 *
 * It arrives with a row when it was started from the tree — the row's own icon, or the selection the view's
 * toolbar carries — and with nothing when it was started from the palette. There, the selected row is the one
 * they mean. Anything else is handed on unchanged, and an act that cannot tell which row it is about says so
 * rather than guessing: every write still names the file it will touch in its own confirmation.
 */
function targeted(deps: PageDeps, node?: DocsNode): DocsNode | undefined {
  return node ?? deps.selected();
}

/**
 * *Rename…* — one command for the thing a path is, whichever row it is.
 *
 * A file tree asks one question of F2 ("rename what is selected"), so the tree answers it with one entry: a page
 * renames its file, a folder renames itself. They are different acts behind the name — a page's file name is its id,
 * a folder's is the chapter every page inside it is filed under — and each says what it will move before it moves it.
 */
async function renameRow(deps: PageDeps, node: DocsNode | undefined): Promise<void> {
  const row = targeted(deps, node);
  if (row?.kind === 'chapter') {
    await renameFolder(deps, row);
    return;
  }
  await renameFile(deps, row);
}

/** *Delete* — the same one entry, over the two acts that take a row away. */
async function deleteRow(deps: PageDeps, node: DocsNode | undefined): Promise<void> {
  const row = targeted(deps, node);
  if (row?.kind === 'chapter') {
    await removeFolder(deps, row);
    return;
  }
  await removeFile(deps, row);
}

// ------------------------------------------------------------------ cutting, copying, pasting

/** What a *Cut* or a *Copy* carries about one row, or nothing when the row is not a file on this machine. */
function clipEntryOf(row: DocsNode): ClipEntry | undefined {
  if (row.kind === 'page') {
    if (!row.page.exists || row.page.uri.scheme !== 'file' || row.root.origin === 'catalog') {
      return undefined;
    }
    return { uri: row.page.uri, folder: false, id: row.page.id, rootUri: row.root.rootUri.toString() };
  }
  if (row.kind === 'chapter') {
    if (row.root.origin === 'catalog') {
      return undefined;
    }
    return {
      uri: contentUri(row.root.rootUri, row.area.area, ...row.segments),
      folder: true,
      rootUri: row.root.rootUri.toString(),
    };
  }
  return undefined;
}

/**
 * *Cut* and *Copy*: the act that carries a row somewhere else, without writing anything yet.
 *
 * Nothing is remembered between windows and nothing is written to the system clipboard — a tree row is not text, and
 * deciding what a pasted row means needs the source it came from. What *does* happen at once is the visible half: the
 * row is dimmed while it is cut, so the person can see what is on its way out.
 */
async function carry(deps: PageDeps, node: DocsNode | undefined, moving: boolean): Promise<void> {
  const row = targeted(deps, node);
  const entry = row === undefined ? undefined : clipEntryOf(row);
  if (entry === undefined) {
    void vscode.window.showInformationMessage(
      `Temco Docs: ${moving ? 'Cut' : 'Copy'} works on a page or a folder on this machine — ` +
      'pick one in the Documentation panel first.'
    );
    return;
  }

  await setClipboard([entry], moving);
  // The tree paints a cut row dim, so it has to be re-read for the act to be visible before anything is pasted.
  deps.redraw();
  vscode.window.setStatusBarMessage(
    moving
      ? `Temco Docs: “${labelOf(entry)}” is ready to move — Paste it on a folder.`
      : `Temco Docs: “${labelOf(entry)}” copied — Paste it on a folder.`,
    5000
  );
}

/**
 * *Paste*: what was cut or copied arrives in the folder of the selected row.
 *
 * A page is a file, and a folder is a folder, so the file system is the thing that moves: a copy leaves a second page
 * beside the original (`-copy`, then `-copy-2`), a cut carries the page — and every page id is the path, so a moved
 * page arrives under a new id, with the old one written into its `aliases` so inbound links still resolve. Both are
 * named in the confirmation before either happens.
 */
async function paste(deps: PageDeps, node: DocsNode | undefined): Promise<void> {
  const { entries, moving } = clipboard();
  const entry = entries[0];
  if (entry === undefined) {
    void vscode.window.showInformationMessage(
      'Temco Docs: there is nothing to paste — Cut or Copy a page or a folder first.'
    );
    return;
  }

  const row = targeted(deps, node);
  const place = row === undefined ? undefined : placeOf(row);
  if (place === undefined) {
    void vscode.window.showInformationMessage(
      'Temco Docs: paste goes into a folder — select an area, a folder or a page in the Documentation panel first.'
    );
    return;
  }
  if (place.root.rootUri.toString() !== entry.rootUri) {
    void vscode.window.showWarningMessage(
      'Temco Docs: that row belongs to another source — a paste stays inside one repository.'
    );
    return;
  }
  if (!writable(place.root)) {
    return;
  }

  const folder = contentUri(
    place.root.rootUri,
    place.area,
    ...(place.chapter === ROOT_CHAPTER ? [] : [place.chapter])
  );
  await carryEntries(deps, place.root, entry, folder, moving);
}

/**
 * The one act that *Paste* and a drop both end in: a page or a folder arrives in another folder.
 *
 * It is the only place in this module that copies or moves a file, so it is also the only place that has to keep the
 * registry true afterwards: a copy is a page the registry does not name yet (the generator names it, or, without one,
 * this writes the entry), and a move is a page whose id changed with its path (the curated values travel and every old
 * id is kept as an alias).
 */
async function carryEntries(
  deps: PageDeps,
  root: DocsRoot,
  entry: ClipEntry,
  folder: vscode.Uri,
  moving: boolean
): Promise<void> {
  const name = path.basename(entry.uri.fsPath);
  // A move into the folder a thing is already in would be a no-op; a copy into it is how a second page is made
  // beside the first, so only the move is refused here.
  if (moving && path.dirname(entry.uri.fsPath).toLowerCase() === folder.fsPath.toLowerCase()) {
    void vscode.window.showInformationMessage(`Temco Docs: “${name}” is already there.`);
    return;
  }
  const destination = await freeName(folder, name, moving);
  if (destination === undefined) {
    void vscode.window.showWarningMessage(
      `Temco Docs: “${name}” is already in that folder, and a move never replaces one. Nothing was moved or copied.`
    );
    return;
  }

  const files = entry.folder ? await markdownFilesUnder(entry.uri) : [entry.uri];
  const relocations = files.map((file) => ({
    from: file,
    to: entry.folder ? childOf(entry.uri, file, destination) : destination,
  }));
  const where = vscode.workspace.asRelativePath(path.dirname(destination.fsPath));

  const answer = await vscode.window.showWarningMessage(
    `${moving ? 'Move' : 'Copy'} “${name}” into ${where}?`,
    {
      modal: true,
      detail: [
        `${entry.uri.fsPath} → ${destination.fsPath}`,
        moving
          ? relocations.length === 0
            ? 'No page id changes: the folder holds no page yet.'
            : `${relocations.length} page id${relocations.length === 1 ? '' : 's'} change with the path, and each ` +
              'old one is kept as an alias so links still resolve.'
          : 'The copied page is a new page: it is named once the registry is regenerated.',
      ].join('\n'),
    },
    moving ? 'Move' : 'Copy',
    'Cancel'
  );
  if (answer !== (moving ? 'Move' : 'Copy')) {
    return;
  }

  // Read before anything moves: after the move the ids that name these pages no longer exist anywhere.
  const edit = moving && relocations.length > 0 ? await RegistryEdit.open(root.registryUri) : undefined;
  if (moving && relocations.length > 0 && edit === undefined) {
    return;
  }

  try {
    if (moving) {
      await vscode.workspace.fs.rename(entry.uri, destination, { overwrite: false });
    } else {
      await vscode.workspace.fs.copy(entry.uri, destination, { overwrite: false });
    }
  } catch (error) {
    void vscode.window.showErrorMessage(
      `Temco Docs: ${path.basename(destination.fsPath)} could not be written — ` +
      `${error instanceof Error ? error.message : String(error)}`
    );
    return;
  }

  let aliased = 0;
  if (moving && edit !== undefined) {
    for (const relocation of relocations) {
      const place = placeOfFile(root, relocation.to);
      const old = place === undefined ? undefined : edit.entry(idOf(root, relocation.from));
      if (place === undefined || old === undefined) {
        continue;
      }
      // Everything the registry curates travels — title, order, owner, audience, tags — and only the two parts that
      // are the *path* are rewritten, plus the alias that keeps the old address alive.
      const fields: Record<string, unknown> = { ...old, area: place.area, chapter: place.chapter };
      const kept = Array.isArray(fields['aliases']) ? fields['aliases'].map(String) : [];
      const previous = idOf(root, relocation.from);
      if (!kept.includes(previous)) {
        kept.push(previous);
      }
      fields['aliases'] = kept;
      edit.remove(previous);
      if (edit.addPage(idOf(root, relocation.to), fields)) {
        aliased += 1;
      }
    }
    await edit.save();
  } else if (!moving) {
    if (scriptsIn([root]).has('docs:registry')) {
      await runScript(deps.roots(), deps.output, 'docs:registry');
    } else {
      await registerCopies(root, relocations.map((relocation) => relocation.to));
    }
  }

  // A move is finished with once it has been pasted; a copy is not, so it can be pasted again.
  if (moving) {
    await setClipboard([], false);
  }
  deps.redraw();

  void vscode.window.showInformationMessage(
    moving
      ? `Temco Docs: “${name}” is in ${where} now` +
        (aliased > 0 ? `, and ${aliased} old page id${aliased === 1 ? ' is' : 's are'} kept as an alias.` : '.')
      : `Temco Docs: “${path.basename(destination.fsPath)}” is copied into ${where}.`
  );
}

// ------------------------------------------------------------------ creating

/**
 * *New page…*, *New chapter…* and the kind entries all end here: they open the page that creates one.
 *
 * Nothing asks for a name in the tree. A name is typed in a form that can show the file it will produce, offer
 * the kinds side by side, and draft the body from material a person chose — and the tree has room for none of
 * that. What the tree *does* contribute is where the page is going: the row that was clicked, or the row the
 * view has selected.
 */
async function startNewPage(deps: PageDeps, node: DocsNode | undefined, seed: NewPageSeed): Promise<void> {
  const where: NewPageSeed = { ...whereOf(targeted(deps, node)), ...seed };
  // With several sources open and nothing selected there is no place to infer; the form can ask for one.
  if (where.source === undefined && deps.roots().length > 1) {
    deps.newPagePage(where);
    return;
  }
  const root = deps.roots().find((candidate) => candidate.folder.name === where.source) ?? deps.roots()[0];
  const area = where.area ?? root?.areas[0]?.area;
  const chapter = where.chapter ?? ROOT_CHAPTER;
  if (root === undefined || area === undefined) {
    void vscode.window.showInformationMessage('Temco Docs: there is no area to put a page in yet. Create a folder first.');
    return;
  }
  const kind = KINDS.find((candidate) => candidate.label === where.kind) ?? KINDS[0];
  // The New Page page, with the place already chosen — not an input box. The form is where a page is made: it can
  // show the kind, the file it will write and the body it starts from, and the location question is already
  // answered, so opening it does not ask where.
  deps.newPagePage({
    source: root.folder.name,
    area,
    chapter: chapter === ROOT_CHAPTER ? undefined : chapter,
    kind: kind.label,
    pageType: 'document',
  });
}

/** Where a row sits, in the names the form shows. A row that stands for no place contributes nothing. */
function whereOf(row: DocsNode | undefined): NewPageSeed {
  switch (row?.kind) {
    case 'page': {
      // A page's folder is everything above its file: a new sibling belongs in that folder, not in the area.
      const above = row.page.id.split('/').slice(1, -1).filter((segment) => segment.length > 0);
      return {
        source: row.root.folder.name,
        area: row.page.area,
        chapter: above.length === 0 ? undefined : above.join('/'),
      };
    }
    case 'chapter':
      return { source: row.root.folder.name, area: row.area.area, chapter: row.segments.join('/') };
    case 'area':
      return { source: row.root.folder.name, area: row.area.area };
    case 'folder':
      return { source: row.root.folder.name };
    default:
      return {};
  }
}

/**
 * The one write that makes a page: a file at `docs/<area>/[<chapter>/]<name>.md`.
 *
 * Called by the New page page, with everything the person filled in and read. The confirmation names the file
 * and says which parts of it the generator will derive, so a write never happens without saying what it is —
 * and a file that is already there is reported rather than overwritten.
 *
 * The body is written as given: it is a draft the person has already seen, or nothing, in which case the kind's
 * headings alone are written. Either way the first line is `# <title>`, because that is where the repository's
 * generator takes a new page's title from.
 */
export async function writePage(deps: PageDeps, spec: NewPageSpec): Promise<{ relative: string } | undefined> {
  const root =
    deps.roots().find((candidate) => candidate.folder.name === spec.source) ??
    (deps.roots().length === 1 ? deps.roots()[0] : undefined);
  if (root === undefined) {
    void vscode.window.showInformationMessage(
      'Temco Docs: no source on this machine is being read, so there is nothing to create a page in. ' +
      'A source read over the API has no working tree.'
    );
    return undefined;
  }
  if (!writable(root)) {
    return undefined;
  }

  const title = spec.title.trim();
  if (title.length === 0) {
    void vscode.window.showWarningMessage('Temco Docs: a page needs a title.');
    return undefined;
  }
  const area = spec.area ?? root.areas[0]?.area;
  if (area === undefined || area.length === 0) {
    void vscode.window.showWarningMessage('Temco Docs: a page belongs in an area, and this source has none.');
    return undefined;
  }
  const chapter = spec.chapter ?? ROOT_CHAPTER;
  const slug = spec.slug !== undefined && validSlug(spec.slug) ? spec.slug : slugify(title);
  const kind = KINDS.find((candidate) => candidate.label === spec.kind) ?? KINDS[0];

  const uri = pageUri(root, area, chapter, slug);
  const relative = vscode.workspace.asRelativePath(uri);
  if (await exists(uri)) {
    void vscode.window.showWarningMessage(`Temco Docs: there is already a file at ${relative}. Nothing was written.`);
    return undefined;
  }

  const drafted = spec.body !== undefined && spec.body.trim().length > 0;
  const pageType = spec.pageType ?? 'document';
  const starts = pageType === 'document'
    ? `It starts as “# ${title}” and the ${kind.label.toLowerCase()} headings — no prose. `
    : pageType === 'markdown'
      ? `It starts as “# ${title}” with an empty body to write into. `
      : `It starts as “# ${title}” and nothing else. `;
  if (spec.quick !== true) {
    const answer = await vscode.window.showWarningMessage(
      `Write the new page to ${relative}?`,
      {
        modal: true,
        detail:
          (drafted ? 'It carries the draft you read. ' : starts) +
          'The repository’s own generator then gives it its registry entry: its area and chapter from that path, ' +
          'its title from that heading, and a place at the end of the chapter.',
      },
      'Write the page'
    );
    if (answer !== 'Write the page') {
      return undefined;
    }
  }

  const text = drafted ? withTitle(spec.body ?? '', title) : skeleton(title, kind, pageType);
  await ensureFolder(vscode.Uri.joinPath(uri, '..'));
  await vscode.workspace.fs.writeFile(uri, Buffer.from(text, 'utf8'));
  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document, { preview: false, viewColumn: fileColumn() });
  // The page is written and open. What comes next is the Documentation list, where its row now exists — that is the
  // panel this product is worked from, and pulling the right panel forward as well would mean two panels competing
  // for one window while the page itself is already in front.
  void vscode.commands.executeCommand('temcoDocs.pages.focus').then(undefined, () => undefined);
  deps.redraw();

  // The entry is what makes it a page rather than a file: index.json, the table of contents, the CHM manifest and
  // the tree are all built from the registry. A project that carries a generator runs it. A project that does not —
  // one started from a template or an import — would dead-end here, so the window writes the entry itself.
  if (scriptsIn([root]).has('docs:registry')) {
    const run = await vscode.window.showInformationMessage(
      `Temco Docs: ${relative} is written. It becomes a page when the registry names it.`,
      'Run the generator'
    );
    if (run === 'Run the generator') {
      await runScript(deps.roots(), deps.output, 'docs:registry');
      deps.redraw();
    }
    return { relative };
  }

  const id = chapter === ROOT_CHAPTER ? `${area}/${slug}` : `${area}/${chapter}/${slug}`;
  const added = await addEntry(root, id, title, area, chapter);
  deps.redraw();
  void vscode.window.showInformationMessage(
    added
      ? `Temco Docs: ${relative} is written, and the registry now names it — this project has no ` +
      '`docs:registry` script, so the window wrote the entry.'
      : `Temco Docs: ${relative} is written. The registry could not be updated, so the page is not listed yet.`
  );
  return { relative };
}

/**
 * The registry entry for a page whose project carries no generator — placed at the end of its chapter, which is
 * exactly where the generator would have put it.
 */
async function addEntry(root: DocsRoot, id: string, title: string, area: string, chapter: string): Promise<boolean> {
  const edit = await RegistryEdit.open(root.registryUri);
  if (edit === undefined) {
    return false;
  }
  const siblings = edit.chapterPages(area, chapter || ROOT_CHAPTER);
  const order = siblings.length === 0 ? 10 : Math.max(...siblings.map((sibling) => sibling.order)) + 10;
  if (!edit.addPage(id, { title, area, chapter: chapter || ROOT_CHAPTER, order, ship: true })) {
    return false;
  }
  await edit.save();
  return true;
}

/**
 * The text a draft becomes: the first line is `# <title>`, whatever the model wrote above it.
 *
 * The generator reads a new page's title from that heading, so a draft that opens with anything else would
 * produce an untitled page. Exported because the New page page shows the same text it will write.
 */
export function withTitle(body: string, title: string): string {
  const trimmed = body.trim();
  return /^#\s+\S/.test(trimmed) ? `${trimmed}\n` : `# ${title}\n\n${trimmed}\n`;
}

/**
 * The skeleton: the first `#` because the generator reads a new page's title from it, then whatever the type adds.
 *
 * A `document` continues with the template's headings; `markdown` leaves one empty paragraph to write into;
 * `empty` stops at the title. Nothing is invented beyond that — the headings come from the template, and the rest
 * of the file is the person's.
 */
function skeleton(title: string, kind: Kind, pageType = 'document'): string {
  const lines = [`# ${title}`, ''];
  if (pageType === 'document') {
    for (const heading of kind.headings) {
      lines.push(`## ${heading}`, '');
    }
  }
  return lines.join('\n');
}

// ------------------------------------------------------------------ renaming

/**
 * The title, which is a registry value — never the file.
 *
 * The page id is the path, and the app's routes, the MCP input and inbound links are built on it
 * (`05-content-and-registry.md`, *Page ids and aliases*), so a page is not renamed by moving its file. What a person means by
 * "rename" is what the page is *called*, and that is one string in the registry.
 *
 * When the page's own first heading carries the same words, it is changed too — the generator takes a page's
 * default title from that heading, and leaving the two disagreeing would leave two answers to one question.
 * Both are named in the confirmation.
 */
async function renamePage(deps: PageDeps, node?: DocsNode): Promise<void> {
  const found = requirePage(deps, node);
  if (!found) {
    return;
  }
  const { root, page } = found;

  const title = await vscode.window.showInputBox({
    title: 'The page title',
    value: page.title,
    prompt: 'The registry keeps this value, so the next generator run will not replace it.',
    validateInput: (value) => (value.trim().length > 0 ? undefined : 'A page needs a title.'),
  });
  if (title === undefined || title.trim() === page.title) {
    return;
  }

  const edit = await RegistryEdit.open(root.registryUri);
  if (!edit) {
    return;
  }
  if (edit.entry(page.id) === undefined) {
    void vscode.window.showInformationMessage(
      `Temco Docs: the registry has no entry for “${page.title}” yet. Run the repository's own generator first.`
    );
    return;
  }
  edit.set(page.id, 'title', title.trim());

  const heading = page.exists ? await firstHeading(page.uri) : undefined;
  const withHeading = heading !== undefined && heading === page.title;
  const lines = edit.changed.map(describeChange);
  if (withHeading && page.uri.scheme === 'file') {
    lines.push(`${vscode.workspace.asRelativePath(page.uri)}  first heading  “${page.title}” → “${title.trim()}”`);
  }

  const answer = await vscode.window.showWarningMessage(
    `Rename “${page.title}” to “${title.trim()}”?`,
    { modal: true, detail: 'It writes to the registry. The file is not moved: the page id is its path, and links point at it.' },
    ...(lines.length > 0 ? ['Write'] : []),
    'Cancel'
  );
  if (answer !== 'Write') {
    return;
  }

  await edit.save();
  if (withHeading && page.uri.scheme === 'file') {
    await replaceFirstHeading(page, title.trim());
  }
  deps.redraw();
}

// ------------------------------------------------------------------ moving

async function movePage(deps: PageDeps, node: DocsNode | undefined, delta: number): Promise<void> {
  const found = requirePage(deps, node);
  if (!found) {
    return;
  }
  const { root, page } = found;
  const edit = await RegistryEdit.open(root.registryUri);
  if (!edit) {
    return;
  }

  const siblings = edit.chapterPages(page.area, page.chapter);
  const at = siblings.findIndex((sibling) => sibling.id === page.id);
  if (at < 0) {
    void vscode.window.showInformationMessage(
      `Temco Docs: “${page.title}” is not in chapter “${page.chapter}” of the registry yet. Run the generator first.`
    );
    return;
  }
  const other = siblings[at + delta];
  if (!other) {
    void vscode.window.showInformationMessage(
      `Temco Docs: “${page.title}” is already ${delta < 0 ? 'first' : 'last'} in “${page.chapter}”.`
    );
    return;
  }

  edit.set(page.id, 'order', other.order);
  edit.set(other.id, 'order', siblings[at].order);
  if (edit.changed.length === 0) {
    void vscode.window.showInformationMessage(
      `Temco Docs: “${page.title}” and “${nameOf(root, other.id)}” share the same order value, so there is nothing to swap.`
    );
    return;
  }

  const answer = await vscode.window.showWarningMessage(
    `Move “${page.title}” ${delta < 0 ? 'above' : 'below'} “${nameOf(root, other.id)}”?`,
    {
      modal: true,
      detail: `It writes two numbers in docs/help/registry.json:\n${edit.changed.map(describeChange).join('\n')}`,
    },
    'Move',
    'Cancel'
  );
  if (answer !== 'Move') {
    return;
  }
  await edit.save();
  deps.redraw();
}

/** Dropping a page on another page: the same chapter swaps the two places, another chapter is also a move across. */
async function dropOnPage(
  deps: PageDeps,
  edit: RegistryEdit,
  page: PageEntry,
  target: PageEntry
): Promise<void> {
  if (target.id === page.id) {
    return;
  }
  if (target.area === page.area && target.chapter === page.chapter) {
    edit.set(page.id, 'order', target.order);
    edit.set(target.id, 'order', page.order);
    if (edit.changed.length === 0) {
      void vscode.window.showInformationMessage(
        `Temco Docs: “${page.title}” and “${target.title}” are already in that order.`
      );
      return;
    }
    const answer = await vscode.window.showWarningMessage(
      `Swap “${page.title}” and “${target.title}”?`,
      { modal: true, detail: `It writes two numbers in docs/help/registry.json:\n${edit.changed.map(describeChange).join('\n')}` },
      'Swap',
      'Cancel'
    );
    if (answer !== 'Swap') {
      return;
    }
  } else {
    edit.set(page.id, 'chapter', target.chapter);
    edit.set(page.id, 'order', target.order + 1);
    const answer = await vscode.window.showWarningMessage(
      `Move “${page.title}” from “${page.chapter}” into “${target.chapter}”, after “${target.title}”?`,
      {
        modal: true,
        detail:
          '**chapter** is structure: `15-online-editor.md`, *Safety rules*, rule 4 marks it as the docs owner’s to change, so this ' +
          `one deserves a line in the pull request.\nIt writes to docs/help/registry.json:\n${edit.changed.map(describeChange).join('\n')}`,
      },
      'Move',
      'Cancel'
    );
    if (answer !== 'Move') {
      return;
    }
  }
  await edit.save();
  deps.redraw();
}

async function moveToChapter(
  deps: PageDeps,
  edit: RegistryEdit,
  page: PageEntry,
  area: string,
  chapter: string
): Promise<void> {
  if (page.area === area && page.chapter === chapter) {
    void vscode.window.showInformationMessage(`Temco Docs: “${page.title}” is already in “${chapter}”.`);
    return;
  }
  const siblings = edit.chapterPages(area, chapter);
  const last = siblings.length > 0 ? siblings[siblings.length - 1].order : 0;
  edit.set(page.id, 'chapter', chapter);
  edit.set(page.id, 'order', last + 10);

  const answer = await vscode.window.showWarningMessage(
    `Move “${page.title}” from “${page.chapter}” into “${chapter}”?`,
    {
      modal: true,
      detail:
        '**chapter** is structure: `15-online-editor.md`, *Safety rules*, rule 4 marks it as the docs owner’s to change, so this one ' +
        `deserves a line in the pull request.\nIt writes to docs/help/registry.json:\n${edit.changed
          .map(describeChange)
          .join('\n')}`,
    },
    'Move',
    'Cancel'
  );
  if (answer !== 'Move') {
    return;
  }
  await edit.save();
  deps.redraw();
}

// ------------------------------------------------------------------ retiring

/**
 * Retirement, which is not deletion.
 *
 * `14-governance.md`, *Deprecation and retirement*: a page that is no longer supported is *retired* — the registry says so and names what
 * replaces it — and its address keeps resolving through a redirect stub the repository's own pipeline
 * generates. So nothing here removes a file, and nothing here decides that a page is finished with: it records
 * the decision a person just made, and says what it wrote.
 */
async function retirePage(deps: PageDeps, node?: DocsNode): Promise<void> {
  const found = requirePage(deps, node);
  if (!found) {
    return;
  }
  const { root, page } = found;
  const edit = await RegistryEdit.open(root.registryUri);
  if (!edit || edit.entry(page.id) === undefined) {
    void vscode.window.showInformationMessage(
      `Temco Docs: the registry has no entry for “${page.title}” yet. Run the repository's own generator first.`
    );
    return;
  }

  const replacement = await vscode.window.showQuickPick(
    [
      { label: 'Nothing replaces it yet', description: 'the registry records that too', id: null },
      ...collectPages(root)
        .filter((candidate) => candidate.id !== page.id && candidate.exists)
        .map((candidate) => ({ label: candidate.title, description: candidate.id, id: candidate.id })),
    ],
    { title: `What replaces “${page.title}”?`, placeHolder: 'A retired page has to name a replacement, or say there is none' }
  );
  if (!replacement) {
    return;
  }

  edit.set(page.id, 'deprecated', true);
  edit.set(page.id, 'superseded_by', replacement.id);
  const answer = await vscode.window.showWarningMessage(
    `Retire “${page.title}”?`,
    {
      modal: true,
      detail:
        'The file stays where it is and its address keeps working: the redirect for a retired page is generated ' +
        'by the repository’s own pipeline. What is written:\n' +
        edit.changed.map(describeChange).join('\n'),
    },
    'Retire',
    'Cancel'
  );
  if (answer !== 'Retire') {
    return;
  }
  await edit.save();
  deps.redraw();
}

// ------------------------------------------------------------------ helpers

function placeOf(node: DocsNode): Place | undefined {
  if (node.kind === 'project') {
    // The project row stands for its only area: a page dropped on it goes to the top of that area.
    return node.place === undefined
      ? undefined
      : { root: node.place.root, area: node.place.area.area, chapter: ROOT_CHAPTER };
  }
  if (node.kind === 'chapter') {
    return { root: node.root, area: node.area.area, chapter: node.segments.join('/') };
  }
  if (node.kind === 'area') {
    return { root: node.root, area: node.area.area, chapter: ROOT_CHAPTER };
  }
  if (node.kind === 'page') {
    // A page's folder is everything above its file, which for a nested folder is more than one segment.
    const segments = node.page.id.split('/').slice(1, -1).filter((segment) => segment.length > 0);
    return {
      root: node.root,
      area: node.page.area,
      chapter: segments.length === 0 ? ROOT_CHAPTER : segments.join('/'),
    };
  }
  return undefined;
}

/** The name a person gave a carried row: the folder's own, or the page file's without its extension. */
function labelOf(entry: ClipEntry): string {
  return entry.folder
    ? path.basename(entry.uri.fsPath)
    : path.basename(entry.uri.fsPath, path.extname(entry.uri.fsPath));
}

/**
 * A name nothing in this folder carries yet.
 *
 * A copy is allowed to arrive beside its original — that is what copying is for — so a taken name becomes `-copy`,
 * then `-copy-2`, and so on. A move is not: a destination that is already there is a different page, and replacing it
 * is not what dragging a row means.
 */
async function freeName(folder: vscode.Uri, name: string, moving: boolean): Promise<vscode.Uri | undefined> {
  const direct = vscode.Uri.joinPath(folder, name);
  if (!(await fileExists(direct))) {
    return direct;
  }
  if (moving) {
    return undefined;
  }
  const extension = path.extname(name);
  const stem = name.slice(0, name.length - extension.length);
  for (let suffix = 1; suffix < 100; suffix++) {
    const candidate = vscode.Uri.joinPath(
      folder,
      `${stem}-copy${suffix === 1 ? '' : `-${suffix}`}${extension}`
    );
    if (!(await fileExists(candidate))) {
      return candidate;
    }
  }
  return undefined;
}

/** Where a file lands when its folder is carried to `destination`: the same place inside it, one name deeper. */
function childOf(folder: vscode.Uri, file: vscode.Uri, destination: vscode.Uri): vscode.Uri {
  const relative = path.relative(folder.fsPath, file.fsPath).split(path.sep);
  return vscode.Uri.joinPath(destination, ...relative);
}

/** The id a page's file already has, or will have once it is written: its path under `docs/`, without `.md`. */
function idOf(root: DocsRoot, file: vscode.Uri): string {
  return path
    .relative(contentUri(root.rootUri).fsPath, file.fsPath)
    .replace(/\\/g, '/')
    .replace(/\.md$/i, '');
}

/** The place a page's file sits in, in the registry's words — the same two segments the generator reads. */
function placeOfFile(root: DocsRoot, file: vscode.Uri): { area: string; chapter: string } | undefined {
  const parts = idOf(root, file).split('/');
  if (parts.length < 2) {
    return undefined;
  }
  return { area: parts[0], chapter: parts.length > 2 ? parts[1] : ROOT_CHAPTER };
}

/**
 * The registry entries for pages that were just copied, in a project that carries no generator.
 *
 * A project with one runs it instead and this is never called: the generator derives an entry from the file. Where
 * there is none, the copy would be a file no tree lists — so the entry is written here, at the end of the chapter,
 * which is where the generator would have put it.
 */
async function registerCopies(root: DocsRoot, files: readonly vscode.Uri[]): Promise<number> {
  const edit = await RegistryEdit.open(root.registryUri);
  if (edit === undefined) {
    return 0;
  }
  let added = 0;
  for (const file of files) {
    const place = placeOfFile(root, file);
    const id = idOf(root, file);
    if (place === undefined || edit.entry(id) !== undefined) {
      continue;
    }
    const title = (await firstHeading(file)) ?? path.basename(file.fsPath, path.extname(file.fsPath));
    const siblings = edit.chapterPages(place.area, place.chapter);
    const order = siblings.length === 0 ? 10 : Math.max(...siblings.map((sibling) => sibling.order)) + 10;
    if (edit.addPage(id, { title, area: place.area, chapter: place.chapter, order, ship: true })) {
      added += 1;
    }
  }
  await edit.save();
  return added;
}

function requirePage(
  deps: PageDeps,
  node: DocsNode | undefined
): { root: DocsRoot; page: PageEntry } | undefined {
  const row = targeted(deps, node);
  if (row?.kind !== 'page') {
    void vscode.window.showInformationMessage(
      'Temco Docs: this acts on one page — pick one in the Workspace view first.'
    );
    return undefined;
  }
  const found = findPage(deps.roots(), row.page.id);
  if (!found) {
    return undefined;
  }
  if (found.root.origin === 'catalog') {
    void vscode.window.showInformationMessage(
      `Temco Docs: “${found.page.title}” was read from a source rather than found on this machine, so there is nothing here to change.`
    );
    return undefined;
  }
  return found;
}

/**
 * Whether a source can be written into at all.
 *
 * A source read over the API is a record of what was read, not a folder: its uri has no file system behind it,
 * so a page there has to be created in the repository itself rather than appear to succeed and then fail.
 */
function writable(root: DocsRoot): boolean {
  if (root.origin !== 'catalog') {
    return true;
  }
  void vscode.window.showInformationMessage(
    `Temco Docs: ${root.folder.name} was read from a source rather than found on this machine, so there is no folder here to write a page into.`
  );
  return false;
}

function findPage(roots: readonly DocsRoot[], id: string): { root: DocsRoot; page: PageEntry } | undefined {
  for (const root of roots) {
    const page = collectPages(root).find((candidate) => candidate.id === id);
    if (page) {
      return { root, page };
    }
  }
  return undefined;
}

function pageUri(root: DocsRoot, area: string, chapter: string, slug: string): vscode.Uri {
  // The file name carries its extension: joined as separate segments it would become `trend-logs/.md`, which is
  // a folder with a file named `.md` in it — a mistake worth one comment, since it reads as harmless.
  const parts = chapter === ROOT_CHAPTER
    ? [`${slug}.md`]
    : [...chapter.split('/').filter((segment) => segment.length > 0 && segment !== '.'), `${slug}.md`];
  return vscode.Uri.joinPath(root.rootUri, 'docs', area, ...parts);
}

function nameOf(root: DocsRoot, id: string): string {
  return collectPages(root).find((page) => page.id === id)?.title ?? id;
}

async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

async function ensureFolder(uri: vscode.Uri): Promise<void> {
  try {
    await vscode.workspace.fs.createDirectory(uri);
  } catch {
    // Already there is the ordinary case; a folder that cannot be made fails loudly on the write instead.
  }
}

/** A filename from a title: lower case, hyphens, nothing that needs escaping in a URL. */
function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug.length > 0 ? slug : 'page';
}

function validSlug(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(value);
}

/** The page's own `#` heading, which is where the generator takes a new page's title from. */
async function firstHeading(uri: vscode.Uri): Promise<string | undefined> {
  try {
    const text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
    return /^#\s+(.+?)\s*$/m.exec(text)?.[1]?.trim();
  } catch {
    return undefined;
  }
}

/** Replaces the page's first `#` heading, keeping the rest of the file as it is. */
async function replaceFirstHeading(page: PageEntry, title: string): Promise<void> {
  try {
    const text = Buffer.from(await vscode.workspace.fs.readFile(page.uri)).toString('utf8');
    const next = text.replace(/^#\s+(.+?)\s*$/m, `# ${title}`);
    if (next !== text) {
      await vscode.workspace.fs.writeFile(page.uri, Buffer.from(next, 'utf8'));
    }
  } catch (error) {
    void vscode.window.showWarningMessage(
      `Temco Docs: the registry was updated, but the page's own heading was not. (${String(error)})`
    );
  }
}
