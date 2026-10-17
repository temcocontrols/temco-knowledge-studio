// What this module knows about the AI module.
//
// The Library shows one row about the AI, and only when that module is installed. It is asked here rather than
// assumed: the AI is optional, this module never requires it, and an install without it shows no row and no dead
// door.

import * as vscode from 'vscode';

/** The AI module, by the id its manifest declares. */
const AI_EXTENSION_ID = 'temcocontrols.temco-ai';

/** Whether the AI module is installed at all. Cheap, and it activates nothing. */
export function aiInstalled(): boolean {
	return vscode.extensions.getExtension(AI_EXTENSION_ID) !== undefined;
}
