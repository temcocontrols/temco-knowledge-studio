// What this module knows about the AI module.
//
// The AI is a *different extension* and this one does not require it: an install without it is a smaller install,
// not a broken one. The project hub shows what the AI has to work with — which runtime, which model, how many are
// available — and when the module is not installed it says exactly that.
//
// The AI is asked for once per use (`activate()` is called here rather than being declared as a dependency), so a
// module installed while the window is open starts working without a reload.

import * as vscode from 'vscode';

/** The AI module, by the id its manifest declares. */
const AI_EXTENSION_ID = 'temcocontrols.temco-ai';

/** One of the module's installed artifacts: a runtime or a model. */
interface AiArtifact {
	id: string;
}

/** The module's runtime, model and server, as its own status reports them. */
interface AiStatus {
	runtime?: AiArtifact;
	model?: AiArtifact;
	running?: { baseUrl: string };
}

/** What the project hub shows: the module's situation, flattened into strings a page can print. */
export interface AiFacts {
	runtime?: string;
	model?: string;
	running?: string;
	promptVersion: string;
	known: number;
}

/** The AI module's exports — the copy of `extensions/temco-ai/src/extension.ts`. */
interface TemcoAiApi {
	status(): AiStatus;
	facts(): { promptVersion: string; known: number };
}

/** {@link TemcoAiApi.status}, flattened for a page that only prints it, or `undefined` when it is not there. */
export async function aiFacts(): Promise<AiFacts | undefined> {
	const extension = vscode.extensions.getExtension<TemcoAiApi>(AI_EXTENSION_ID);
	if (extension === undefined) {
		return undefined;
	}
	const api = extension.isActive ? extension.exports : await extension.activate();
	const status = api.status();
	return {
		runtime: status.runtime?.id,
		model: status.model?.id,
		running: status.running?.baseUrl,
		...api.facts(),
	};
}
