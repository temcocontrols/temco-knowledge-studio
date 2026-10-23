// The Page pane: where a page is, what is in it, and how long it is.
//
// The Outline is the page's own headings, nested the way the file nests them, and each row is a jump — the one
// navigation a long page actually needs. It follows the editor in front rather than a selection made somewhere else,
// because the question it answers is always "where am I in *this* page".
//
// The word count beside it is the only thing VS Code does not already show: line, column, encoding and end-of-line
// are the status bar's own business, so nothing here repeats them.

import * as vscode from 'vscode';

/** How often a heading list is allowed to be rebuilt while somebody is typing. */
const REDRAW_MS = 250;

/** One heading, with the headings under it. */
export interface Heading {
	readonly text: string;
	readonly level: number;
	/** Zero-based line, which is what the editor takes. */
	readonly line: number;
	readonly children: Heading[];
}

/** A Markdown file on disk is the only thing an outline can describe. */
function isMarkdown(document: vscode.TextDocument): boolean {
	return document.languageId === 'markdown' && document.uri.scheme === 'file';
}

/**
 * The headings of a page.
 *
 * Fenced blocks are skipped, because a `#` inside a code sample is a comment and not a heading — the same rule the
 * build applies when it reads a page.
 */
export function headingsOf(text: string): Heading[] {
	const roots: Heading[] = [];
	const stack: Heading[] = [];
	let fenced = false;

	text.split(/\r?\n/).forEach((line, index) => {
		if (/^\s*(?:```|~~~)/.test(line)) {
			fenced = !fenced;
			return;
		}
		if (fenced) {
			return;
		}
		const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
		if (match === null) {
			return;
		}
		const heading: Heading = { text: match[2], level: match[1].length, line: index, children: [] };
		while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
			stack.pop();
		}
		const parent = stack[stack.length - 1];
		if (parent === undefined) {
			roots.push(heading);
		} else {
			parent.children.push(heading);
		}
		stack.push(heading);
	});

	return roots;
}

/** The outline as the tree view reads it. */
class Outline implements vscode.TreeDataProvider<Heading> {
	private readonly changed = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.changed.event;

	private roots: Heading[] = [];
	private note: string | undefined;

	/** Rebuilds from the editor in front. */
	refresh(): void {
		const document = vscode.window.activeTextEditor?.document;
		if (document === undefined || !isMarkdown(document)) {
			this.roots = [];
			this.note = 'No Markdown page is in front. Open one from Pages and its headings appear here.';
		} else {
			this.roots = headingsOf(document.getText());
			this.note = this.roots.length === 0 ? 'This page has no headings yet.' : undefined;
		}
		this.changed.fire();
	}

	getChildren(element?: Heading): Heading[] {
		if (element !== undefined) {
			return element.children;
		}
		return this.roots;
	}

	getTreeItem(element: Heading): vscode.TreeItem {
		const item = new vscode.TreeItem(
			element.text,
			element.children.length === 0 ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Expanded
		);
		item.description = `H${element.level}`;
		item.tooltip = `${element.text} — line ${element.line + 1}`;
		item.contextValue = 'temcoDocs.heading';
		item.command = { command: 'temcoDocs.outline.reveal', title: 'Go to the Heading', arguments: [element.line] };
		return item;
	}

	/** The sentence a tree shows instead of nothing, so an empty pane still explains itself. */
	get noteText(): string | undefined {
		return this.note;
	}

	hasHeadings(): boolean {
		return this.roots.length > 0;
	}
}

/**
 * Builds the pane and its word count.
 *
 * Both follow the editor in front: the outline redraws when the page or its text changes, and the count follows the
 * same signal so the two never describe different pages.
 */
export function registerPagePane(context: vscode.ExtensionContext): void {
	const outline = new Outline();
	const tree = vscode.window.createTreeView('temcoDocs.outline', { treeDataProvider: outline, showCollapseAll: true });

	const count = vscode.window.createStatusBarItem('temcoDocs.words', vscode.StatusBarAlignment.Right, 100);
	count.name = 'Temco Docs — page length';
	count.command = 'temcoDocs.outline';

	let timer: ReturnType<typeof setTimeout> | undefined;
	const schedule = (): void => {
		if (timer !== undefined) {
			clearTimeout(timer);
		}
		timer = setTimeout(() => {
			timer = undefined;
			redraw();
		}, REDRAW_MS);
	};

	const redraw = (): void => {
		outline.refresh();
		const document = vscode.window.activeTextEditor?.document;
		if (document === undefined || !isMarkdown(document)) {
			count.hide();
			return;
		}
		const words = document
			.getText()
			.replace(/^\s*(?:```|~~~)[\s\S]*?^\s*(?:```|~~~)/gm, ' ')
			.replace(/[#>*`_|~-]+/g, ' ')
			.split(/\s+/)
			.filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
		const minutes = Math.max(1, Math.round(words / 200));
		count.text = `$(book) ${words.toLocaleString()} ${words === 1 ? 'word' : 'words'}`;
		count.tooltip = `About ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} to read · ${outline.hasHeadings() ? 'Outline in the Page pane' : 'No headings yet'}`;
		count.show();
	};

	context.subscriptions.push(
		tree,
		count,
		{
			dispose: () => {
				if (timer !== undefined) {
					clearTimeout(timer);
				}
			},
		},
		vscode.window.onDidChangeActiveTextEditor(() => redraw()),
		vscode.workspace.onDidChangeTextDocument((event) => {
			if (event.document === vscode.window.activeTextEditor?.document) {
				schedule();
			}
		}),
		vscode.workspace.onDidSaveTextDocument((document) => {
			if (document === vscode.window.activeTextEditor?.document) {
				redraw();
			}
		}),
		vscode.commands.registerCommand('temcoDocs.outline', () => {
			void vscode.commands.executeCommand('workbench.view.extension.temcoDraft').then(
				() => vscode.commands.executeCommand('temcoDocs.outline.focus'),
				() => vscode.commands.executeCommand('temcoDocs.outline.focus')
			);
		}),
		vscode.commands.registerCommand('temcoDocs.outline.reveal', (line?: unknown) => {
			const editor = vscode.window.activeTextEditor;
			if (editor === undefined || typeof line !== 'number') {
				return;
			}
			const position = new vscode.Position(Math.min(Math.max(line, 0), Math.max(editor.document.lineCount - 1, 0)), 0);
			editor.selection = new vscode.Selection(position, position);
			editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.AtTop);
			void vscode.window.showTextDocument(editor.document, { viewColumn: editor.viewColumn, preserveFocus: false });
		})
	);

	redraw();
}
