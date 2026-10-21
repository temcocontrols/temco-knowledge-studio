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
	/** A draft of a page's body, streamed to `onToken` as it is written. */
	draft(request: {
		title: string;
		kind: string;
		headings: readonly string[];
		path: string;
		area: string;
		material: string;
		onToken?(text: string): void;
	}): Promise<void>;
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

/** What a draft of a project's first page needs: the project's name, and the material a person chose. */
export interface ProjectDraftRequest {
	title: string;
	material: string;
}

/**
 * A project's first page, drafted from the files a person ticked.
 *
 * The AI module is asked for one page — the overview — and the answer is *returned*, not written: a draft that
 * writes to disk before the project exists would be a file nobody owns. `undefined` means the module is not
 * installed, which the form says rather than treating as a failure.
 */
export async function draftProjectPage(
	request: ProjectDraftRequest,
	onToken?: (text: string) => void
): Promise<{ text: string } | { error: string } | undefined> {
	const extension = vscode.extensions.getExtension<TemcoAiApi>(AI_EXTENSION_ID);
	if (extension === undefined) {
		return undefined;
	}
	const api = extension.isActive ? extension.exports : await extension.activate();
	let text = '';
	try {
		await api.draft({
			title: request.title,
			kind: 'overview',
			headings: [],
			path: 'docs/help/overview.md',
			area: 'Overview',
			material: request.material,
			onToken: (part: string) => {
				text += part;
				onToken?.(part);
			},
		});
	} catch (error) {
		return { error: error instanceof Error ? error.message : String(error) };
	}
	return { text };
}
