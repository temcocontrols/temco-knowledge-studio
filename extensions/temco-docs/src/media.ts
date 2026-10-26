// Screenshots are a stage, not a button: capture the screen or paste what is already on the clipboard, and the
// file lands in the page's own `media/` before the reference to it means anything.
//
// **Why PowerShell.** The extension API reads the clipboard's *text* and not its image, and this application is
// Windows. `System.Windows.Forms.Clipboard` is the one supported reader that needs no native module, no core
// change and nothing installed — it sees what Win+Shift+S, PrintScreen, Snipping Tool and every other capture
// tool leave behind, which is exactly what "paste from the application" has to mean here.
//
// The rules are the design package's, not ours to invent (`docs/temco-learn/design/15-online-editor.md`,
// `14-governance.md`):
//
//   * the file goes into the page's own `media/`, named `NN-area-slug.png`;
//   * the destination is derived from the page, never supplied by the person;
//   * PNG for a screen, at least 1600 px wide, at most 2 MB;
//   * the type is sniffed from the bytes, never trusted from the file's name.
//
// A capture with no page in front is neither lost nor guessed at: it goes to the capture inbox
// (`<root>/.temco/captures/`) and waits in **Needs You** until somebody says which page it belongs to. The inbox
// is deliberately outside every `media/` folder, so the site only ever holds what a page actually shows.
//
// What this does not do is annotate. Marking up the image needs the callout decision
// (`docs/temco-platform/ui/authoring-flow.md`); a screen that lands where the page already expects it is useful
// without it, and nothing here has to be undone when annotation arrives.

import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { currentVersion, extensionOf, landImage, MAX_BYTES, staleAcross } from './attachments';
import { DocsRoot, PageEntry, collectPages } from './registry';
import { slugOf } from './store';

/** Where a screen waits when no page is in front. Below the folder the pages live in, never inside `media/`. */
const INBOX = ['.temco', 'captures'];

/** How long a capture waits for the snip: long enough to frame a dialog, short enough to give up. */
const CAPTURE_WAIT_MS = 60_000;

/** What the commands need from the module: the roots, the page a command means, and the one redraw signal. */
export interface MediaDeps {
	roots: () => readonly DocsRoot[];
	/** The page a screenshot belongs to: the row the person just clicked, or the page they are writing in. */
	targetPage: () => PageEntry | undefined;
	redraw: () => void;
	output: vscode.OutputChannel;
}

/** One screen waiting in the inbox, with the folder it belongs to. */
export interface Capture {
	uri: vscode.Uri;
	root: DocsRoot;
}

/** How a PowerShell run ended: `0` succeeded, `-1` was stopped by the person, anything else is the script's own exit code. */
interface PsResult {
	code: number;
	stderr: string;
}

export function registerMediaCommands(context: vscode.ExtensionContext, deps: MediaDeps): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('temcoDocs.pasteImage', () => paste(deps)),
		vscode.commands.registerCommand('temcoDocs.captureImage', () => capture(deps)),
		vscode.commands.registerCommand('temcoDocs.chooseImage', () => choose(deps)),
		vscode.commands.registerCommand('temcoDocs.staleScreenshots', () => reportStale(deps)),
		vscode.commands.registerCommand('temcoDocs.attachCapture', (file?: unknown) =>
			attach(deps, typeof file === 'string' ? file : undefined)
		)
	);
}

/**
 * The screenshots a newer version has left behind, as a document that can be read, kept or sent.
 *
 * Design §22.4, S3: a stale screenshot is a **warning, not a block** — publishing one is allowed, and this report is
 * the record of which ones were known about. Nothing is written and nothing is refused.
 */
async function reportStale(deps: MediaDeps): Promise<void> {
	const roots = deps.roots();
	const stale = await staleAcross(roots);
	const date = new Date().toISOString().slice(0, 10);
	const lines: string[] = [`# Screenshots a newer version has left behind — ${date}`, ''];

	if (stale.length === 0) {
		lines.push(
			'Every picture beside a page either depicts the version the documentation describes, or does not say which',
			'version it depicts. Nothing to retake.',
			'',
			'_A picture with no recorded version is not called stale: "we do not know" is a different claim from "this is old"._'
		);
	} else {
		const described = [...new Set(stale.map((row) => row.current))].sort();
		lines.push(
			`The documentation describes **${described.join('**, **')}**. These ${stale.length} pictures were taken of`,
			'something else, and they still look true.',
			'',
			'| Page | Image | Shows | Documentation |',
			'| --- | --- | --- | --- |',
			...stale.map((row) => `| ${row.page} | ${row.name} | ${row.appliesTo} | ${row.current} |`),
			'',
			'_Stale is a warning, not a block. Publishing one of these is allowed, and this report is what records it._'
		);
	}

	lines.push('', '---', '', 'Made by Temco Docs from the folders that were open. Nothing was written or sent.');

	// An untitled document, so producing a report never writes anything anywhere: saving it is the reader's act.
	const document = await vscode.workspace.openTextDocument({ content: lines.join('\n'), language: 'markdown' });
	await vscode.window.showTextDocument(document, { preview: false });
	void vscode.window.showInformationMessage(
		stale.length === 0
			? 'Temco Docs: no screenshot claims a version the documentation no longer describes.'
			: `Temco Docs: ${stale.length} screenshot${stale.length === 1 ? '' : 's'} a newer version has left behind.`
	);
}

/** Every screen in the inbox, oldest path first, so **Needs You** lists them without inventing an order. */
export async function capturesOf(roots: readonly DocsRoot[]): Promise<Capture[]> {
	const all: Capture[] = [];
	for (const root of roots) {
		const directory = vscode.Uri.joinPath(root.folder.uri, ...INBOX);
		let entries: [string, vscode.FileType][] = [];
		try {
			entries = await vscode.workspace.fs.readDirectory(directory);
		} catch {
			// No inbox yet is not a fault: it appears with the first capture that has nowhere to go.
			continue;
		}
		for (const [name, type] of entries) {
			if (type === vscode.FileType.File && /\.(png|jpe?g|webp|gif|svg)$/i.test(name)) {
				all.push({ uri: vscode.Uri.joinPath(directory, name), root });
			}
		}
	}
	return all.sort((one, other) => one.uri.fsPath.localeCompare(other.uri.fsPath));
}

/** The image already on the clipboard: Ctrl+Alt+V. */
async function paste(deps: MediaDeps): Promise<void> {
	if (process.platform !== 'win32') {
		void vscode.window.showInformationMessage(
			'Temco Docs: reading the clipboard’s image is Windows-only. Use *Insert an Image File…* on this platform.'
		);
		return;
	}
	const file = tempFile();
	const result = await runPowerShell(pasteScript(file), 20_000, undefined);
	if (result.code !== 0) {
		explainClipboard(result, deps);
		return;
	}
	await land(deps, await readAndRemove(file), 'the clipboard');
}

/** Why nothing landed — one message per outcome, each naming the act that fixes it. */
function explainClipboard(result: PsResult, deps: MediaDeps): void {
	if (result.code === 2) {
		void vscode.window.showInformationMessage(
			'Temco Docs: there is no screenshot on the clipboard. Copy one first (Win+Shift+S), or use *Capture a Screenshot*.'
		);
		return;
	}
	if (result.code === 3) {
		void vscode.window.showInformationMessage(
			'Temco Docs: Windows would not hand over the clipboard image. Copy it again, or use *Insert an Image File…*.'
		);
		return;
	}
	if (result.code === 4) {
		void vscode.window.showInformationMessage(
			'Temco Docs: the clipboard holds files, but none of them is an image.'
		);
		return;
	}
	// Everything else is the shell itself: keep the reason, because "it did not work" cannot be acted on.
	deps.output.appendLine(`[media] the clipboard read failed (exit ${result.code}): ${firstLine(result.stderr)}`);
	deps.output.show(true);
	void vscode.window.showErrorMessage(
		'Temco Docs: reading the clipboard failed. The Temco Docs output has the PowerShell error.'
	);
}

/** The screen is being made right now: Ctrl+Alt+S opens the snip overlay and waits for what it puts on the clipboard. */
async function capture(deps: MediaDeps): Promise<void> {
	if (process.platform !== 'win32') {
		void vscode.window.showInformationMessage(
			'Temco Docs: capture uses the Windows snip overlay. Take the screen with the system tool and use *Paste Screenshot*.'
		);
		return;
	}
	const file = tempFile();
	// `ms-screenclip:` is the shell's own alias for the snip overlay. `explorer.exe` opens it the way the Run box
	// does; `env.openExternal` is left out of it because a protocol that is not http is not guaranteed to survive it.
	execFile('explorer.exe', ['ms-screenclip:'], { windowsHide: true }, () => {
		// It opens, or the wait below says no screenshot arrived. Either way, nothing to report from here.
	});
	const result = await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: 'Temco Docs: waiting for the screenshot — take the snip, or press Esc here to stop',
			cancellable: true,
		},
		(_progress, token) => runPowerShell(captureScript(file), CAPTURE_WAIT_MS + 5_000, token)
	);
	if (result.code === -1) {
		return;
	}
	if (result.code === 4) {
		void vscode.window.showInformationMessage(
			'Temco Docs: no screenshot arrived — nothing new reached the clipboard.'
		);
		return;
	}
	if (result.code !== 0) {
		explainClipboard(result, deps);
		return;
	}
	await land(deps, await readAndRemove(file), 'the screen');
}

/** A file the person picked: the one path that works on every platform, and the fallback for everything else. */
async function choose(deps: MediaDeps): Promise<void> {
	const chosen = await vscode.window.showOpenDialog({
		canSelectMany: false,
		openLabel: 'Insert the Image',
		filters: { Images: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'] },
	});
	const file = chosen?.[0];
	if (file === undefined) {
		return;
	}
	const bytes = await vscode.workspace.fs.readFile(file);
	await land(deps, bytes, 'the file picker', path.extname(file.fsPath).slice(1).toLowerCase());
}

/** Put one screen where it belongs: the page in front, or the inbox when there is no page in front. */
async function land(deps: MediaDeps, bytes: Uint8Array, source: string, fallback: string = 'png'): Promise<void> {
	if (bytes.byteLength === 0) {
		void vscode.window.showWarningMessage('Temco Docs: the clipboard held no image.');
		return;
	}
	if (bytes.byteLength > MAX_BYTES) {
		void vscode.window.showWarningMessage(
			`Temco Docs: that screen is ${megabytes(bytes)} MB, over the 2 MB a page image may have. Nothing was written.`
		);
		return;
	}

	const page = deps.targetPage();
	if (page === undefined) {
		await deliver(deps, bytes, extensionOf(bytes, fallback));
		return;
	}
	if (!page.exists) {
		void vscode.window.showWarningMessage(
			`Temco Docs: ${page.id} is declared by the registry and has no file yet. Create the page first — then the screenshot has somewhere to go.`
		);
		return;
	}

	// One landing path for every insert: the same naming, the same record, the same width warning as Temco Page.
	const landed = await landImage({
		pageFsPath: page.uri.fsPath,
		slug: slugOf(page.title) || slugOf(page.id) || 'screen',
		bytes,
		fallbackExtension: fallback,
		caption: page.title,
		appliesTo: await currentVersion(deps.roots()),
	});
	if ('error' in landed) {
		void vscode.window.showWarningMessage(`Temco Docs: ${landed.error}. Nothing was written.`);
		return;
	}
	if (landed.warning !== undefined) {
		void vscode.window.showWarningMessage(`Temco Docs: ${landed.warning}`);
	}
	await insertReference(page, `![${landed.alt}](${landed.relative})`);
	deps.output.appendLine(`[media] ${source} → ${landed.relative} on ${page.id}`);
}

/** No page in front: the screen waits in the inbox, and **Needs You** is where it gets a page. */
async function deliver(deps: MediaDeps, bytes: Uint8Array, extension: string): Promise<void> {
	const root = deps.roots()[0];
	if (root === undefined) {
		void vscode.window.showWarningMessage(
			'Temco Docs: no documentation folder is being worked on, so there is nowhere to put the screen.'
		);
		return;
	}
	const directory = vscode.Uri.joinPath(root.folder.uri, ...INBOX);
	await vscode.workspace.fs.createDirectory(directory);
	const name = `${stamp()}.${extension}`;
	await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(directory, name), bytes);
	deps.redraw();
	void vscode.window.showInformationMessage(
		`Temco Docs: ${name} is waiting in Needs You. Attach it to a page and it lands in that page’s media/.`
	);
}

/** Move one screen from the inbox into a page the person names, and put the reference where they are writing. */
async function attach(deps: MediaDeps, file: string | undefined): Promise<void> {
	const from = file ?? (await pickCapture(deps));
	if (from === undefined) {
		return;
	}
	const pages = deps
		.roots()
		.flatMap((root) => collectPages(root))
		.filter((page) => page.exists);
	if (pages.length === 0) {
		void vscode.window.showInformationMessage('Temco Docs: no page is available to take the screen.');
		return;
	}
	const picked = await vscode.window.showQuickPick(
		pages.map((page) => ({
			label: page.title,
			description: `${page.area}${page.chapter === '' ? '' : ` › ${page.chapter}`}`,
			page,
		})),
		{ title: 'Attach the screenshot to a page', matchOnDescription: true }
	);
	if (picked === undefined) {
		return;
	}

	const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(from));
	const page = picked.page;
	const landed = await landImage({
		pageFsPath: page.uri.fsPath,
		slug: slugOf(page.title) || slugOf(page.id) || 'screen',
		bytes,
		fallbackExtension: 'png',
		caption: page.title,
		appliesTo: await currentVersion(deps.roots()),
	});
	if ('error' in landed) {
		void vscode.window.showWarningMessage(`Temco Docs: ${landed.error}. Nothing was written.`);
		return;
	}
	if (landed.warning !== undefined) {
		void vscode.window.showWarningMessage(`Temco Docs: ${landed.warning}`);
	}
	try {
		fs.unlinkSync(from);
	} catch {
		// It is out of the inbox either way: the copy in `media/` is the one the page points at.
	}
	await insertReference(page, `![${landed.alt}](${landed.relative})`);
	deps.redraw();
}

/** The inbox row a command was started from, when it was started from the palette instead. */
async function pickCapture(deps: MediaDeps): Promise<string | undefined> {
	const captures = await capturesOf(deps.roots());
	if (captures.length === 0) {
		void vscode.window.showInformationMessage('Temco Docs: the capture inbox is empty.');
		return undefined;
	}
	const picked = await vscode.window.showQuickPick(
		captures.map((capture) => ({ label: path.basename(capture.uri.fsPath), detail: capture.uri.fsPath })),
		{ title: 'Attach which screenshot?' }
	);
	return picked?.detail;
}

/** Insert the reference where the person is writing; if the page was not open, put it at the end of the page. */
async function insertReference(page: PageEntry, reference: string): Promise<void> {
	const open = vscode.window.visibleTextEditors.filter(
		(editor) => editor.document.uri.toString() === page.uri.toString()
	)[0];
	if (open !== undefined) {
		await insertBlock(open, reference);
		return;
	}
	const document = await vscode.workspace.openTextDocument(page.uri);
	const editor = await vscode.window.showTextDocument(document, { preview: false });
	const end = document.lineAt(document.lineCount - 1).range.end;
	await editor.edit((builder) => builder.insert(end, `\n\n${reference}\n`));
}

/**
 * A screenshot is a block, not a word: inline in a sentence it reflows the sentence.
 *
 * So it goes on its own paragraph after the line the cursor is on, and the cursor follows it — the next thing a
 * person writes is the sentence that explains the screen.
 */
async function insertBlock(editor: vscode.TextEditor, text: string): Promise<void> {
	const document = editor.document;
	const line = document.lineAt(editor.selection.active.line);
	if (line.text.trim().length === 0) {
		await editor.edit((builder) => builder.insert(editor.selection.active, text));
		return;
	}
	await editor.edit((builder) => builder.insert(line.range.end, `\n\n${text}`));
	const imageLine = Math.min(line.lineNumber + 2, document.lineCount - 1);
	const after = new vscode.Position(imageLine, document.lineAt(imageLine).text.length);
	editor.selection = new vscode.Selection(after, after);
}



function megabytes(bytes: Uint8Array): string {
	return (bytes.byteLength / (1024 * 1024)).toFixed(1);
}

/** A capture's name in the inbox: sortable, unique to the second, and nothing a person has to read. */
function stamp(): string {
	return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function tempFile(): string {
	const directory = path.join(os.tmpdir(), 'temco-docs');
	fs.mkdirSync(directory, { recursive: true });
	return path.join(directory, `capture-${Date.now()}.png`);
}

async function readAndRemove(file: string): Promise<Uint8Array> {
	try {
		return await vscode.workspace.fs.readFile(vscode.Uri.file(file));
	} finally {
		try {
			fs.unlinkSync(file);
		} catch {
			// The temp folder is the operating system's: losing one file there is not a failure worth reporting.
		}
	}
}

/**
 * Run one PowerShell script and report how it ended.
 *
 * `0` is the script's own success, `-1` means the person stopped waiting, and every other number is the script's
 * own exit code — which is what lets the messages say *why* nothing happened instead of "it did not work".
 *
 * Arguments are passed as an array, never through a shell, so the script's own quotes are the script's own — the
 * mangling that PowerShell causes when it parses a command line from inside another shell does not apply.
 */
function runPowerShell(script: string, timeout: number, token: vscode.CancellationToken | undefined): Promise<PsResult> {
	return new Promise<PsResult>((resolve) => {
		let settled = false;
		const finish = (result: PsResult): void => {
			if (!settled) {
				settled = true;
				resolve(result);
			}
		};
		const child = execFile(
			'powershell.exe',
			['-NoProfile', '-NonInteractive', '-STA', '-Command', script],
			{ windowsHide: true, timeout },
			(error, _stdout, stderr) => {
				if (error === null) {
					finish({ code: 0, stderr: '' });
					return;
				}
				const code = typeof (error as { code?: unknown }).code === 'number'
					? (error as { code: number }).code
					: 1;
				finish({ code, stderr: String(stderr ?? '') || error.message });
			}
		);
		const subscription = token?.onCancellationRequested(() => {
			child.kill();
			finish({ code: -1, stderr: 'stopped by the person' });
		});
		child.on('close', () => subscription?.dispose());
	});
}

function firstLine(text: string): string {
	return text.split(/\r?\n/).filter((line) => line.trim().length > 0)[0] ?? text;
}

/** A single-quoted PowerShell string: the only escape that matters is the quote itself. */
function psLiteral(text: string): string {
	return `'${text.replace(/'/g, "''")}'`;
}

/**
 * What is on the clipboard now, saved at `file`.
 *
 * Two sources, because capture tools disagree: a **bitmap** (Win+Shift+S, PrintScreen, Snipping Tool) and a
 * **file** copied in Explorer (Greenshot and ShareX can both be set to do that). Exit codes are what the caller
 * turns into a sentence: 2 nothing usable, 3 an image that would not save, 4 files but no image among them.
 */
function pasteScript(file: string): string {
	return [
		'Add-Type -AssemblyName System.Windows.Forms;',
		'Add-Type -AssemblyName System.Drawing;',
		'$file = ' + psLiteral(file) + ';',
		'if ([System.Windows.Forms.Clipboard]::ContainsImage()) {',
		'  $image = [System.Windows.Forms.Clipboard]::GetImage();',
		'  if ($null -eq $image) { exit 3 };',
		'  $image.Save($file, [System.Drawing.Imaging.ImageFormat]::Png);',
		'  $image.Dispose();',
		'  exit 0;',
		'}',
		'if ([System.Windows.Forms.Clipboard]::ContainsFileDropList()) {',
		'  foreach ($item in [System.Windows.Forms.Clipboard]::GetFileDropList()) {',
		'    if ($item -match "\\.(png|jpe?g|gif|webp|bmp)$") {',
		'      Copy-Item -LiteralPath $item -Destination $file -Force;',
		'      exit 0;',
		'    }',
		'  }',
		'  exit 4;',
		'}',
		'exit 2;',
	].join('\n');
}

/**
 * Wait for a *new* image on the clipboard, then save it.
 *
 * The comparison is the point: the snip overlay takes a moment to appear, and a person may already have a picture
 * on the clipboard from the last shot. Saving the first image it sees would hand them the wrong screen, so the
 * script hashes what is there before the snip and again every half second, and only takes one that changed.
 */
function captureScript(file: string): string {
	return [
		'Add-Type -AssemblyName System.Windows.Forms;',
		'Add-Type -AssemblyName System.Drawing;',
		'function Signature($image) {',
		'  if ($null -eq $image) { return "" }',
		'  $stream = New-Object System.IO.MemoryStream;',
		'  $image.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png);',
		'  $sha = [System.Security.Cryptography.SHA256]::Create();',
		'  return [Convert]::ToBase64String($sha.ComputeHash($stream.ToArray()));',
		'}',
		'$before = Signature ([System.Windows.Forms.Clipboard]::GetImage());',
		'for ($i = 0; $i -lt 120; $i++) {',
		'  Start-Sleep -Milliseconds 500;',
		'  $image = [System.Windows.Forms.Clipboard]::GetImage();',
		'  if ($null -ne $image) {',
		'    $now = Signature $image;',
		'    if ($now -ne $before) {',
		`      $image.Save(${psLiteral(file)}, [System.Drawing.Imaging.ImageFormat]::Png);`,
		'      $image.Dispose();',
		'      exit 0;',
		'    }',
		'    $image.Dispose();',
		'  }',
		'}',
		'exit 4;',
	].join('\n');
}
