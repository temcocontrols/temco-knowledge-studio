// What this module reads of the documentation module.
//
// The documentation module is a *different extension*: it is not imported, it is asked. Everything here is the
// contract between the two — the shapes this module needs, spelled out rather than imported, because an
// extension cannot import another extension's sources. Where the module used to reach across its own folder for
// `roots`, `collectPages`, `pageForUri`, `pageColumn` and the selection, it now reaches across this file, and
// the call sites say exactly what they always said.
//
// The dependency runs one way and is declared: this module requires `temcocontrols.temco-docs`, so that module is
// activated first and its exports are there when `activate()` runs. Nothing in the documentation module requires
// this one — it calls this module by command, if it is installed at all.

import * as vscode from 'vscode';

/** The documentation module, by the id its manifest declares. */
export const DOCS_EXTENSION_ID = 'temcocontrols.temco-docs';

/** The page the documentation module remembers, beside the project it belongs to. */
export interface RememberedPage {
  project: string;
  id: string;
  title: string;
  path?: string;
}

/** Something wrong with the shape of the documentation set, not with the prose. */
export interface Issue {
  severity: 'error' | 'warning';
  message: string;
}

/** What the generator knows about a page: its history, its headings, and the code globs it is judged against. */
export interface Provenance {
  git: { author?: string; sha?: string; date?: string } | null;
  updated: string | null;
  stale: boolean;
  headings: string[];
  code: string[];
}

/** One page of a documentation set, as the registry describes it. */
export interface PageEntry {
  id: string;
  title: string;
  area: string;
  chapter: string;
  order: number;
  audience: string;
  ship: boolean;
  owner: string;
  reviewed: string | null;
  tags: string[];
  keywords: string[];
  uri: vscode.Uri;
  exists: boolean;
  issues: Issue[];
  provenance?: Provenance;
  origin?: 'workspace' | 'catalog';
}

/** The counts a set, an area or a chapter carries. */
export interface Counts {
  pages: number;
  issues: number;
  errors: number;
  warnings: number;
  neverReviewed: number;
  unshipped: number;
}

/** A chapter of an area, and the pages in it. */
export interface ChapterGroup {
  chapter: string;
  pages: PageEntry[];
}

/** One area of a documentation set: what a page's id starts with. */
export interface AreaGroup extends Counts {
  area: string;
  title: string;
  audience: string;
  noindex: boolean;
  chapters: ChapterGroup[];
}

/** One documentation set: a folder with a registry, read here or recorded from a source. */
export interface DocsRoot extends Counts {
  folder: vscode.WorkspaceFolder;
  rootUri: vscode.Uri;
  registryUri: vscode.Uri;
  areas: AreaGroup[];
  problems: Issue[];
  origin?: 'workspace' | 'catalog';
}

/** Which project is being worked on, and which page of it was last opened. */
export interface Selection {
  onDidChange(listener: () => void): vscode.Disposable;
  project(): string | undefined;
  page(): RememberedPage | undefined;
}

/** What the documentation module publishes: the model the documentation surfaces read, and its one signal. */
export interface TemcoDocsApi {
  /** The documentation sets being read. */
  roots(): readonly DocsRoot[];
  /** Every page of a set, in reading order. */
  collectPages(root: DocsRoot): PageEntry[];
  /** The page a file belongs to, in any of the sets. */
  pageForUri(roots: readonly DocsRoot[], uri: vscode.Uri): PageEntry | undefined;
  /** The project and page the window is on — the one piece of state the AI panel shares with the rest. */
  selection: Selection;
  /** The editor column a documentation surface opens in. */
  pageColumn(): vscode.ViewColumn;
  /** Fires when the sets are re-read: a page added, a project selected, a registry changed. */
  onDidChange(listener: () => void): vscode.Disposable;
}

/**
 * The documentation module's exports.
 *
 * It is a declared dependency, so it has been activated by the time this module's `activate()` runs and there is
 * nothing to await. A missing module is not a state to recover from — it is a broken install, and it says so.
 */
export function docs(): TemcoDocsApi {
  const module = vscode.extensions.getExtension<TemcoDocsApi>(DOCS_EXTENSION_ID);
  if (module === undefined || !module.isActive) {
    throw new Error('The Temco Docs module is not available.');
  }
  return module.exports;
}

/** {@link TemcoDocsApi.collectPages}, for the code that used to import it from the neighbouring folder. */
export function collectPages(root: DocsRoot): PageEntry[] {
  return docs().collectPages(root);
}

/** {@link TemcoDocsApi.pageForUri}, for the code that used to import it from the neighbouring folder. */
export function pageForUri(roots: readonly DocsRoot[], uri: vscode.Uri): PageEntry | undefined {
  return docs().pageForUri(roots, uri);
}

/** {@link TemcoDocsApi.pageColumn}, for the code that used to import it from the neighbouring folder. */
export function pageColumn(): vscode.ViewColumn {
  return docs().pageColumn();
}
