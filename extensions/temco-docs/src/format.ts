// The Markdown toolbar: the buttons the design package's editor calls for, on the editor that is already here.
//
// `15-online-editor.md`, *The screen*, lists the toolbar its editor needs — emphasis, blocks, a link to a real page, an
// outline — and says plainly that the core it chose ships none of it, so the toolbar is written by hand. On the
// website that is true. Here it is smaller: VS Code **is** Monaco plus an application shell, so the editing
// core, find and replace, folding, the breadcrumb outline and the problem markers already exist, and the
// toolbar is the only missing piece. VS Code ships no Markdown formatting commands either — there is no
// `toggleBold` to defer to — so these are ours to provide.
//
// Every action edits the document in front: the buffer a person is typing in, undoable with Ctrl+Z. Nothing
// here writes a file, opens a tab, or touches the registry. A page that is not a file on disk — one read from a
// source, a diff — is told so rather than left with a button that does nothing.
//
// Two things are deliberately absent.
//
// **No keybindings.** `Ctrl+B` hides the side bar everywhere else, and this extension has to keep working in an
// ordinary VS Code, so nothing here claims a chord. Every action is a command named `temcoDocs.format.*`,
// so a person who wants the chords can bind them; the quick pick and the editor menus give everyone else the
// buttons.
//
// **No image insertion yet.** An image is the one action here that would have to *write* into a source
// repository — the file has to land in the page's own `media/` before the reference to it means anything — and
// that is a rule change rather than a button. It waits for that decision instead of arriving with it.

import * as path from 'path';
import * as vscode from 'vscode';
import {
  CALLOUTS,
  HEADINGS,
  LANGUAGES,
  RULE,
  TABLE,
  headingsOf,
  insertBlock,
  insertCallout,
  insertCodeBlock,
  insertLink,
  setHeading,
  toggleLineMark,
  toggleWrap,
  type EditResult,
  type EditState,
} from './markdownEdits';
import { DocsRoot, collectPages } from './registry';

interface Action {
  command: string;
  label: string;
  /** What the button puts in the page, shown beside the label in the picker. */
  detail: string;
  run: (editor: vscode.TextEditor) => Promise<void>;
}

export function registerFormatCommands(
  context: vscode.ExtensionContext,
  roots: () => readonly DocsRoot[]
): void {
  const actions: Action[] = [
    {
      command: 'temcoDocs.format.bold',
      label: 'Bold',
      detail: '**…**',
      run: (editor) => apply(editor, (state) => toggleWrap(state, '**')),
    },
    {
      command: 'temcoDocs.format.italic',
      label: 'Italic',
      detail: '*…*',
      run: (editor) => apply(editor, (state) => toggleWrap(state, '*')),
    },
    {
      command: 'temcoDocs.format.code',
      label: 'Inline code',
      detail: '`…`',
      run: (editor) => apply(editor, (state) => toggleWrap(state, '`')),
    },
    { command: 'temcoDocs.format.heading', label: 'Heading', detail: '## · ### · ####', run: chooseHeading },
    {
      command: 'temcoDocs.format.bullet',
      label: 'Bullet list',
      detail: '- item',
      run: (editor) => apply(editor, (state) => toggleLineMark(state, () => '- ', /^[-*+] /)),
    },
    {
      command: 'temcoDocs.format.numbered',
      label: 'Numbered list',
      detail: '1. 2. 3.',
      run: (editor) => apply(editor, (state) => toggleLineMark(state, (index) => `${index + 1}. `, /^\d+[.)] /)),
    },
    {
      command: 'temcoDocs.format.task',
      label: 'Task list',
      detail: '- [ ] item',
      run: (editor) => apply(editor, (state) => toggleLineMark(state, () => '- [ ] ', /^[-*+] \[[ xX]\] /)),
    },
    {
      command: 'temcoDocs.format.quote',
      label: 'Block quote',
      detail: '> text',
      run: (editor) => apply(editor, (state) => toggleLineMark(state, () => '> ', /^> ?/)),
    },
    { command: 'temcoDocs.format.codeBlock', label: 'Code block', detail: 'a fence with a language', run: insertCodeBlockAction },
    { command: 'temcoDocs.format.table', label: 'Table', detail: 'two columns', run: (editor) => apply(editor, (state) => insertBlock(state, TABLE)) },
    { command: 'temcoDocs.format.rule', label: 'Horizontal rule', detail: '---', run: (editor) => apply(editor, (state) => insertBlock(state, RULE)) },
    { command: 'temcoDocs.format.callout', label: 'Callout', detail: '> [!NOTE]', run: insertCalloutAction },
    { command: 'temcoDocs.format.link', label: 'Link', detail: '[text](address)', run: insertLinkAction },
    {
      command: 'temcoDocs.format.linkPage',
      label: 'Link to a page',
      detail: 'a real page, as a relative .md link',
      run: (editor) => linkToPage(editor, roots()),
    },
    { command: 'temcoDocs.format.outline', label: 'Go to a heading', detail: 'this page’s outline', run: goToHeading },
  ];

  context.subscriptions.push(
    ...actions.map((action) =>
      vscode.commands.registerCommand(action.command, () => withEditor(action.run))
    ),
    // The toolbar's own entry point: one button that names every action, for the keyboard and for the palette.
    vscode.commands.registerCommand('temcoDocs.format.pick', () => pick(actions))
  );
}

/**
 * The editor an action runs on.
 *
 * Two refusals, both in words, because both are ordinary cases rather than errors: nothing open, and a page
 * that is a read of a source rather than a file — the same distinction the Workspace view draws.
 */
async function withEditor(run: (editor: vscode.TextEditor) => Promise<void>): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined) {
    void vscode.window.showInformationMessage('Temco Docs: put the cursor in a page first — these buttons edit the file in front.');
    return;
  }
  if (editor.document.uri.scheme !== 'file') {
    void vscode.window.showInformationMessage('Temco Docs: this page is not a file on disk, so it cannot be edited here.');
    return;
  }
  await run(editor);
}

/** One button, every action: what the title bar and the palette offer. */
async function pick(actions: readonly Action[]): Promise<void> {
  const picked = await vscode.window.showQuickPick(
    actions.map((action) => ({ label: action.label, description: action.detail, action })),
    {
      title: 'Temco Docs: format the page',
      placeHolder: 'Every action here is also its own command, and its own button in the editor’s menus',
    }
  );
  if (picked !== undefined) {
    await withEditor(picked.action.run);
  }
}

/**
 * Runs one transform on the editor in front.
 *
 * The transform itself lives in `markdownEdits.ts`, because Temco Page applies the same ones to a
 * `<textarea>` and two copies of "what bold means" would drift. All this adds is the editor: it reads the selection as
 * offsets, and writes back **only the span that actually changed** — so one bold word is one small edit, and `Ctrl+Z`,
 * folding and any other cursor see what they would have seen had the person typed the marks.
 */
async function apply(editor: vscode.TextEditor, transform: (state: EditState) => EditResult): Promise<void> {
  const document = editor.document;
  const text = document.getText();
  const selection = editor.selection;
  const next = transform({
    text,
    start: document.offsetAt(selection.start),
    end: document.offsetAt(selection.end),
  });

  if (next.text !== text) {
    const span = changedSpan(text, next.text);
    const range = new vscode.Range(document.positionAt(span.start), document.positionAt(span.end));
    await editor.edit((builder) => builder.replace(range, next.text.slice(span.start, span.end)));
  }
  editor.selection = new vscode.Selection(document.positionAt(next.start), document.positionAt(next.end));
}

/** The one region two versions of a document disagree about: the common head and tail are not part of the edit. */
function changedSpan(before: string, after: string): { start: number; end: number } {
  const shortest = Math.min(before.length, after.length);
  let start = 0;
  while (start < shortest && before[start] === after[start]) {
    start += 1;
  }
  let tail = 0;
  while (tail < shortest - start && before[before.length - 1 - tail] === after[after.length - 1 - tail]) {
    tail += 1;
  }
  return { start, end: before.length - tail };
}

async function chooseHeading(editor: vscode.TextEditor): Promise<void> {
  const level = await vscode.window.showQuickPick(
    HEADINGS.map((candidate) => ({
      label: `${'#'.repeat(candidate)} Heading ${String(candidate)}`,
      description: candidate === 2 ? 'the usual level under a page title' : 'a level below it',
      level: candidate,
    })),
    { title: 'Heading level', placeHolder: 'Pressing the same level again removes it' }
  );
  if (level === undefined) {
    return;
  }
  await apply(editor, (state) => setHeading(state, level.level));
}

async function insertCodeBlockAction(editor: vscode.TextEditor): Promise<void> {
  const language = await vscode.window.showQuickPick(LANGUAGES, {
    title: 'The code block’s language',
    placeHolder: 'text — the fence is what makes it a block; the word is what colours it',
  });
  if (language === undefined) {
    return;
  }
  await apply(editor, (state) => insertCodeBlock(state, language));
}

async function insertCalloutAction(editor: vscode.TextEditor): Promise<void> {
  const kind = await vscode.window.showQuickPick(CALLOUTS, {
    title: 'The callout',
    placeHolder: 'These are the five DocFX renders as coloured blocks',
  });
  if (kind === undefined) {
    return;
  }
  await apply(editor, (state) => insertCallout(state, kind.label));
}

async function insertLinkAction(editor: vscode.TextEditor): Promise<void> {
  // A copied address is the common case, so it is offered rather than asked for again.
  const clipboard = (await vscode.env.clipboard.readText()).trim();
  const absolute = /^https?:\/\/\S+$/.test(clipboard);
  const address = await vscode.window.showInputBox({
    title: 'Link',
    prompt: 'An address on the web — a link to a page in this documentation uses Link to a page instead.',
    value: absolute ? clipboard : '',
    placeHolder: 'https://…',
  });
  if (address === undefined || address.trim() === '') {
    return;
  }
  await apply(editor, (state) => insertLink(state, address.trim()));
}

/**
 * A link to a page that exists, which is the one link worth inserting by hand.
 *
 * `05-content-and-registry.md` fixes the form: a **relative `.md` link**, resolved and warned on by the build,
 * with `~/` for a root-relative one. So the picker offers the pages the registry declares — the same list the
 * Workspace view shows — and inserts a relative path that the gate can resolve. A page in another source is
 * refused rather than linked, because no relative path reaches it.
 */
async function linkToPage(editor: vscode.TextEditor, roots: readonly DocsRoot[]): Promise<void> {
  const from = editor.document.uri;
  const root = roots.find((candidate) => within(candidate.rootUri, from));
  if (root === undefined) {
    void vscode.window.showInformationMessage('Temco Docs: this file is not inside a page tree that is being read, so there is nothing to link to.');
    return;
  }

  const pages = collectPages(root).filter((page) => page.exists && page.uri.fsPath !== from.fsPath);
  if (pages.length === 0) {
    void vscode.window.showInformationMessage(`Temco Docs: ${root.folder.name} declares no other page with a file to link to.`);
    return;
  }

  const picked = await vscode.window.showQuickPick(
    pages.map((page) => ({ label: page.title, description: page.id, page })),
    {
      title: `Link to a page in ${root.folder.name}`,
      placeHolder: 'Type part of a title, or a path',
      matchOnDescription: true,
    }
  );
  if (picked === undefined) {
    return;
  }

  const selected = editor.document.getText(editor.selection).trim();
  const link = path.relative(path.dirname(from.fsPath), picked.page.uri.fsPath).split(path.sep).join('/');
  await apply(editor, (state) => insertLink(state, link, selected === '' ? picked.page.title : selected));
}

function within(root: vscode.Uri, file: vscode.Uri): boolean {
  if (root.scheme !== file.scheme) {
    return false;
  }
  const relative = path.relative(root.fsPath, file.fsPath);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function goToHeading(editor: vscode.TextEditor): Promise<void> {
  const headings = headingsOf(editor.document.getText());
  if (headings.length === 0) {
    void vscode.window.showInformationMessage('Temco Docs: this page declares no headings yet.');
    return;
  }
  const picked = await vscode.window.showQuickPick(
    headings.map((heading) => ({
      label: `${'  '.repeat(heading.level - 1)}${heading.text}`,
      description: `${'#'.repeat(heading.level)} · line ${String(heading.line + 1)}`,
      heading,
    })),
    { title: 'Go to a heading' }
  );
  if (picked === undefined) {
    return;
  }
  const at = new vscode.Position(picked.heading.line, 0);
  editor.selection = new vscode.Selection(at, at);
  editor.revealRange(new vscode.Range(at, at), vscode.TextEditorRevealType.AtTop);
}
