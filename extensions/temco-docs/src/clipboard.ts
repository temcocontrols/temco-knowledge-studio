// What *Cut* and *Copy* put down, and what *Paste* picks up.
//
// The window's clipboard carries text, and a tree of files needs something else: the rows themselves — which file or
// folder, which source it belongs to, and whether the act was a move. So the module keeps its own, and publishes the
// two facts the rest of the window needs: whether there is anything to paste (the `when` clause that hides *Paste*
// when there is not) and which rows were cut, so the tree can draw them the way Explorer does — dimmed, waiting.
//
// It lives in its own file rather than in `pageOps.ts` because two modules read it: the commands that set it, and the
// tree that paints it.

import * as vscode from 'vscode';

/** One row a *Cut* or a *Copy* carried: the file or folder it stands for, and the source it belongs to. */
export interface ClipEntry {
  uri: vscode.Uri;
  /** True for a folder row, false for a page. */
  folder: boolean;
  /** The page's id, when a page is what was carried — a move keeps it alive as an alias. */
  id?: string;
  /** The source's root, as a string: a paste never crosses repositories. */
  rootUri: string;
}

/** The context key `package.json` reads, so *Paste* is offered only while there is something to paste. */
export const HAS_CLIPBOARD = 'temcoDocs.hasClipboard';

let entries: readonly ClipEntry[] = [];
let moving = false;
let cut: ReadonlySet<string> = new Set();

/** What was carried, and whether picking it up removed it from where it was. */
export function clipboard(): { entries: readonly ClipEntry[]; moving: boolean } {
  return { entries, moving };
}

/** The places that were cut: the rows the tree dims until they are pasted, or replaced by another cut. */
export function cutUris(): ReadonlySet<string> {
  return cut;
}

/** Puts something down — or, with nothing, empties the clipboard after a move has been pasted. */
export async function setClipboard(next: readonly ClipEntry[], isMove: boolean): Promise<void> {
  entries = next;
  moving = isMove;
  cut = isMove ? new Set(next.map((entry) => entry.uri.toString())) : new Set();
  await vscode.commands.executeCommand('setContext', HAS_CLIPBOARD, next.length > 0);
}
