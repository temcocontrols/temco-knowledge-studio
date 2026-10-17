// What this module reads of the repositories module.
//
// One thing: the repository's own documentation scripts, as a vocabulary. The needs page says which of them the
// folders being read carry, and that list is the repository module's — whose scripts they are.
//
// Why the shape is written out: an extension cannot import another extension's sources. The definition is
// `extensions/temco-repositories/src/scripts.ts` and `extensions/temco-repositories/src/extension.ts`.
// Repositories is a declared dependency, so it is activated before this module's entry runs.

import * as vscode from 'vscode';

/** The repositories module, by the id its manifest declares. */
const REPOSITORIES_EXTENSION_ID = 'temcocontrols.temco-repositories';

/** One script of the repository's own documentation work that this application is willing to run. */
export interface OfferedScript {
	id: string;
	label: string;
	detail: string;
}

/** The repositories module's exports — the copy of `extensions/temco-repositories/src/extension.ts`. */
interface TemcoRepositoriesApi {
	readonly offeredScripts: readonly OfferedScript[];
}

const extension = vscode.extensions.getExtension<TemcoRepositoriesApi>(REPOSITORIES_EXTENSION_ID);
if (extension === undefined || !extension.isActive) {
	throw new Error('The Temco Repositories module is not available.');
}

/** The repository's own documentation scripts: a vocabulary, not a runner. */
export const OFFERED_SCRIPTS: readonly OfferedScript[] = extension.exports.offeredScripts;
