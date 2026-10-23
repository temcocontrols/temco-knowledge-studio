// Importing a Word document as a page.
//
// Two open-source tools and no services: `mammoth` reads the `.docx` into semantic HTML, and `turndown` turns that HTML
// into Markdown. What comes out is a *starting point* — Word's styling (fonts, colours, spacing, text boxes) has no
// Markdown equivalent and is dropped rather than faked, which is why the file is written as a new page beside the
// document rather than silently replacing anything.
//
// The paid Tiptap DOCX extensions do more, and they were considered: import runs on Tiptap's cloud with a JWT, and both
// extensions need a subscription and a private registry. This is what can be done without either.

import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as vscode from 'vscode';

const run = promisify(execFile);

/** A `.docx` beside the page, converted, and where it went. */
export interface ImportedDocument {
	readonly source: string;
	readonly target: vscode.Uri;
	readonly warnings: readonly string[];
}

export function registerDocxCommand(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('temcoDocs.importDocx', (target?: unknown) => importDocx(context, target))
	);
}

/**
 * Asks for a `.docx`, converts it, and writes a Markdown page beside it.
 *
 * The page is named after the document, and an existing file is never overwritten: the next free name is used, so a
 * conversion can be repeated while comparing two attempts.
 */
async function importDocx(context: vscode.ExtensionContext, target?: unknown): Promise<void> {
	const folder = folderOf(target);
	const picked = await vscode.window.showOpenDialog({
		canSelectMany: false,
		openLabel: 'Import',
		defaultUri: folder,
		filters: { 'Word documents': ['docx'], 'All files': ['*'] },
	});
	const source = picked?.[0];
	if (source === undefined) {
		return;
	}

	const destination = await vscode.window.showSaveDialog({
		saveLabel: 'Write the page',
		defaultUri: vscode.Uri.joinPath(vscode.Uri.file(path.dirname(source.fsPath)), `${path.basename(source.fsPath, path.extname(source.fsPath))}.md`),
		filters: { Markdown: ['md'] },
	});
	if (destination === undefined) {
		return;
	}

	try {
		const imported = await convert(source, destination, context);
		const opened = await vscode.workspace.openTextDocument(imported.target);
		await vscode.window.showTextDocument(opened, { preview: false });

		const detail = imported.warnings.length === 0 ? undefined : imported.warnings.slice(0, 6).join('\n');
		void vscode.window.showInformationMessage(
			`Temco Docs: ${path.basename(source.fsPath)} imported as ${path.basename(imported.target.fsPath)}. ` +
				`Word styling is not carried over — check the headings and tables before publishing.`,
			{ modal: false, detail }
		);
	} catch (error) {
		void vscode.window.showErrorMessage(
			`Temco Docs: the Word document could not be converted — ${
				error instanceof Error ? error.message : String(error)
			}`
		);
	}
}

/** The `.docx` → HTML → Markdown pipeline, run in a child process so the extension host never blocks on it. */
async function convert(source: vscode.Uri, target: vscode.Uri, context: vscode.ExtensionContext): Promise<ImportedDocument> {
	// The compiled converter, not a script beside the sources: `scripts/**` is excluded from the packaged extension.
	const script = vscode.Uri.joinPath(context.extensionUri, 'out', 'docxConvert.js');
	const executable = process.execPath;
	const { stdout } = await run(
		executable,
		[script.fsPath, source.fsPath, target.fsPath],
		// A large document can take a while; the default is too short for a 200-page manual.
		{ maxBuffer: 64 * 1024 * 1024, timeout: 120_000, windowsHide: true }
	);

	let parsed: { warnings?: string[] } = {};
	try {
		parsed = JSON.parse(stdout.trim().split('\n').pop() ?? '{}');
	} catch {
		// A converter that printed something unexpected still wrote the file; the warnings are a bonus.
	}

	return { source: source.fsPath, target, warnings: parsed.warnings ?? [] };
}

/** The folder to open the picker in: the page's, if a page is in front. */
function folderOf(target: unknown): vscode.Uri | undefined {
	if (target instanceof vscode.Uri) {
		return vscode.Uri.file(path.dirname(target.fsPath));
	}
	const document = vscode.window.activeTextEditor?.document;
	return document === undefined ? undefined : vscode.Uri.file(path.dirname(document.uri.fsPath));
}
