// Which project the window is working on — one piece of state, in one place, owned by the store.
//
// Everything that used to be about "the folder you have open" is about this: the Workspace and Library views,
// the counts, the faults, the AI's context. It lives in `workspaceState` rather than `globalState` because a
// project belongs to the window you are working in: the same machine can have two windows on two products, and
// one of them answering about the other's pages would be a bug, not a feature.
//
// A page is remembered beside the project for the same reason: with the project selected you are usually looking
// at a *page* of it, and the AI and the hub should both be able to point at it without a text editor being open.
//
// It is one instance for the whole window, published by this module: two modules that each made their own would
// each read the same storage and never hear the other's change, and the views would disagree about the project.

import * as vscode from 'vscode';

const KEY_PROJECT = 'temcoStore.selectedProject';
const KEY_PAGE = 'temcoStore.selectedPage';

/** The page the platform last opened from the selected project. */
export interface RememberedPage {
	project: string;
	id: string;
	title: string;
	path?: string;
}

export class Selection implements vscode.Disposable {
	private readonly changed = new vscode.EventEmitter<void>();
	/** Fires when the selected project changes — the one signal the views and the AI listen to. */
	readonly onDidChange = this.changed.event;

	constructor(private readonly context: vscode.ExtensionContext) { }

	dispose(): void {
		this.changed.dispose();
	}

	/** The slug of the project being worked on, or `undefined` when the application is just reading folders. */
	project(): string | undefined {
		const slug = this.context.workspaceState.get<string>(KEY_PROJECT);
		return slug !== undefined && slug.length > 0 ? slug : undefined;
	}

	async select(slug: string | undefined): Promise<void> {
		await this.context.workspaceState.update(KEY_PROJECT, slug ?? '');
		this.changed.fire();
	}

	/** The page of the selected project the platform last opened, if it remembers one. */
	page(): RememberedPage | undefined {
		const page = this.context.workspaceState.get<RememberedPage>(KEY_PAGE);
		if (!page || page.project !== this.project()) {
			return undefined;
		}
		return page;
	}

	async rememberPage(page: RememberedPage | undefined): Promise<void> {
		await this.context.workspaceState.update(KEY_PAGE, page);
	}
}
