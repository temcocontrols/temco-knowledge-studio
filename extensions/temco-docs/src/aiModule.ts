// What this module knows about the AI module.
//
// The AI is a *different extension*, and this one does not require it: an install without it is a smaller
// install, not a broken one. So every use of it is asked for at the moment it is needed, and every use has an
// answer for "it is not here".
//
// Two ways in, and they are chosen the same way the rest of the platform chooses one:
//
//   * a **command** (`temcoAi.page`, and the model list beside it) for opening something. VS Code activates the
//     module for its own command, so this needs no API at all.
//   * its **exports** for the two things that are work rather than navigation: drafting a body and analysing a
//     source, both of which the new-page page asks for and neither of which is a page to open. Those calls are
//     declared as an interface here, because an extension cannot import another extension's sources.

import * as vscode from 'vscode';

/** The AI module, by the id its manifest declares. */
const AI_EXTENSION_ID = 'temcocontrols.temco-ai';

/** One analysis: a source, its files, the pages it already has, and the note the person added. */
export interface AiAnalyseRequest {
	name: string;
	files: readonly string[];
	pages: readonly string[];
	note: string;
}

/** One draft: the form's answers, where the text is to be written, and where it is to appear. */
export interface AiDraftRequest {
	title: string;
	kind: string;
	headings: readonly string[];
	path: string;
	area: string;
	material: string;
	onToken?(text: string): void;
}

/** The AI module's exports — the copy of `extensions/temco-ai/src/extension.ts`. */
interface TemcoAiApi {
	modelLabel(): string | undefined;
	analyse(request: AiAnalyseRequest): Promise<string>;
	draft(request: AiDraftRequest): Promise<void>;
}

/** Whether the AI module is installed at all. Cheap, and it activates nothing. */
export function aiInstalled(): boolean {
	return vscode.extensions.getExtension(AI_EXTENSION_ID) !== undefined;
}

/**
 * The AI module's exports, activating it if this is the first call.
 *
 * `undefined` when the module is not installed. It is asked for once per use rather than held: a module that is
 * installed while the window is open starts working without a reload.
 */
export async function ai(): Promise<TemcoAiApi | undefined> {
	const extension = vscode.extensions.getExtension<TemcoAiApi>(AI_EXTENSION_ID);
	if (extension === undefined) {
		return undefined;
	}
	return extension.isActive ? extension.exports : await extension.activate();
}
