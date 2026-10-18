// What this module knows about the projects module.
//
// One thing, and it is a signal rather than a call: the Documentation surfaces re-read when a project is created,
// edited or removed. Everything else this module does with a project it does by command (`temcoProjects.openProject`,
// `temcoProjects.newProject`, and `temcoDocs.section.projects.focus` to show the list) — a row opens a page, and
// opening a page is the projects module's own command.
//
// The projects module is a declared dependency, so it is activated before this module's entry runs.

import * as vscode from 'vscode';

/** The projects module, by the id its manifest declares. */
const PROJECTS_EXTENSION_ID = 'temcocontrols.temco-projects';

/** The projects module's exports — the copy of `extensions/temco-projects/src/extension.ts`. */
interface TemcoProjectsApi {
	onDidChange(listener: () => void): vscode.Disposable;
}

/** The projects module's exports. */
export function projects(): TemcoProjectsApi {
	const extension = vscode.extensions.getExtension<TemcoProjectsApi>(PROJECTS_EXTENSION_ID);
	if (extension === undefined || !extension.isActive) {
		throw new Error('The Temco Projects module is not available.');
	}
	return extension.exports;
}
