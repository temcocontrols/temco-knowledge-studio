// Importing an existing document set into the repository's own shape.
//
// Dr.Explain's front door imports Word, RTF, HTML, an HTML folder and CHM. Here the idea is the same and the
// destination is stricter: everything lands as the product repository's contract — Markdown under `docs/`, the
// registry at `docs/help/registry.json` — so the repository's generator, the site build and the CHM build pick it
// up with no second content store and nothing to keep in step.
//
// Three rules, and they are why this is safe to run against a real project:
//
//   * **Nothing is written over anything.** An import into a folder whose `docs/help/registry.json` already exists
//     is refused outright; an import is a beginning, not a merge.
//   * **A page's place is derived from where it came from**, never invented: the first folder is the area, the
//     second the chapter, the file name the slug, and `order` is 10, 20, 30 in the order the material was found.
//   * **What cannot be converted is said out loud.** A missing pandoc, a CHM decompiler that is not there, a file
//     whose text cannot be read — each is reported, never silently dropped.

import { execFile } from 'node:child_process';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { slugOf } from './store';

export type ImportKind = 'html' | 'markdown' | 'word' | 'chm';

export interface ImportRequest {
	kind: ImportKind;
	/** The file or folder the material is in. */
	source: string;
	/** The folder the repository shape is written into — the project's own folder. */
	destination: string;
}

export interface ImportResult {
	/** How many pages were written. */
	pages: number;
	/** What was deliberately not converted, one line each. */
	skipped: string[];
}

export interface ImportFailure {
	error: string;
}

/** Folders an import never walks into: build output and dependencies are not documentation. */
const SKIP = new Set(['node_modules', '.git', '.vs', 'out', 'dist', 'target', '.venv', '.idea']);

const HTML_EXTENSIONS = ['.html', '.htm', '.xhtml', '.txt'];
const MARKDOWN_EXTENSIONS = ['.md', '.markdown'];

/** The extensions each kind of material is read from. */
const READABLE: Readonly<Record<ImportKind, readonly string[]>> = {
	html: HTML_EXTENSIONS,
	markdown: MARKDOWN_EXTENSIONS,
	word: ['.docx', '.doc', '.rtf', '.odt'],
	chm: ['.chm']
};

/**
 * Converts and writes a document set. Throws with a sentence a person can act on when it refuses.
 *
 * The command wrapper turns the throw into `{ error }`, because a webview has no exception to catch.
 */
export async function runImport(request: ImportRequest): Promise<ImportResult> {
	const source = vscode.Uri.file(request.source);
	const destination = vscode.Uri.file(request.destination);

	if (!(await exists(source))) {
		throw new Error(`${source.fsPath} is not there.`);
	}
	if (READABLE[request.kind] === undefined) {
		throw new Error(`“${request.kind}” is not a kind of material this build imports.`);
	}

	// One refusal that covers every kind: an import is a beginning, not a merge.
	const registry = vscode.Uri.joinPath(destination, 'docs', 'help', 'registry.json');
	if (await exists(registry)) {
		throw new Error(
			`${vscode.workspace.asRelativePath(registry)} already exists, so nothing was imported. Choose an empty folder.`
		);
	}

	const skipped: string[] = [];

	// Every kind ends as Markdown read from one folder: HTML converted here, Word and CHM converted into `.md` and
	// Markdown first. `root` is the folder page places are derived from, so a CHM's own structure survives.
	let root = source;
	let files: vscode.Uri[];
	let read: 'html' | 'markdown';

	if (request.kind === 'chm') {
		root = await decompile(source);
		files = await collect(root, HTML_EXTENSIONS, skipped);
		read = 'html';
	} else if (request.kind === 'word') {
		root = await pandoc(source, skipped);
		files = await collect(root, MARKDOWN_EXTENSIONS, skipped);
		read = 'markdown';
	} else if (request.kind === 'markdown') {
		files = await collect(source, MARKDOWN_EXTENSIONS, skipped);
		read = 'markdown';
	} else {
		files = await collect(source, HTML_EXTENSIONS, skipped);
		read = 'html';
	}

	if (files.length === 0) {
		throw new Error(
			`no ${READABLE[request.kind].join(' / ')} files were found in ${source.fsPath}.`
		);
	}

	const pages: { id: string; title: string; area: string; chapter: string; order: number; text: string }[] = [];
	const order = new Map<string, number>();

	for (const file of files) {
		const relative = path.relative(root.fsPath, file.fsPath);
		const { area, chapter } = placeOf(relative);
		const slug = slugOf(path.basename(file.fsPath, path.extname(file.fsPath))) || 'page';
		const key = `${area}/${chapter}`;
		const next = (order.get(key) ?? 0) + 10;
		order.set(key, next);

		let body: string;
		try {
			const text = decode(Buffer.from(await vscode.workspace.fs.readFile(file)));
			body = read === 'html' ? htmlToMarkdown(text) : text.replace(/\r\n/g, '\n').trim();
		} catch (error) {
			skipped.push(`${relative} — ${error instanceof Error ? error.message : String(error)}`);
			continue;
		}

		// A body always starts with the page's one `#` heading: the repository's generator reads the title from it.
		const title = headingOf(body) ?? titleCase(path.basename(file.fsPath, path.extname(file.fsPath)));
		const text = `# ${title}\n${body.replace(/^#\s+.*$/m, '').trim().length > 0 ? `\n${body.replace(/^#\s+.*$/m, '').trim()}\n` : ''}`;
		pages.push({ id: `${area}/${chapter ? `${chapter}/` : ''}${slug}`, title, area, chapter, order: next, text });
	}

	if (pages.length === 0) {
		throw new Error('nothing in that folder could be converted into a page.');
	}

	for (const page of pages) {
		const target = vscode.Uri.joinPath(destination, 'docs', page.area, page.chapter, `${page.id.split('/').pop() ?? 'page'}.md`);
		await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(target, '..'));
		await vscode.workspace.fs.writeFile(target, Buffer.from(page.text, 'utf8'));
	}

	const areas: Record<string, { title: string }> = {};
	const entries: Record<string, { title: string; area: string; chapter: string; order: number; ship: boolean }> = {};
	for (const page of pages) {
		areas[page.area] = { title: titleCase(page.area) };
		entries[page.id] = {
			title: page.title,
			area: page.area,
			chapter: page.chapter || '(root)',
			order: page.order,
			ship: true
		};
	}

	await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(destination, 'docs', 'help'));
	await vscode.workspace.fs.writeFile(
		registry,
		Buffer.from(`${JSON.stringify({ version: 1, areas, pages: entries }, null, 2)}\n`, 'utf8')
	);

	return { pages: pages.length, skipped };
}

/** Registers the command the project wizard (and the palette) calls. */
export function registerImportCommand(): vscode.Disposable {
	return vscode.commands.registerCommand('temcoDocs.import', async (request?: unknown): Promise<ImportResult | ImportFailure> => {
		if (!isRequest(request)) {
			return { error: 'An import needs a kind, a source and a destination.' };
		}
		try {
			return await runImport(request);
		} catch (error) {
			return { error: error instanceof Error ? error.message : String(error) };
		}
	});
}

export function isImportFailure(value: unknown): value is ImportFailure {
	return value !== null && typeof value === 'object' && typeof (value as ImportFailure).error === 'string';
}

function isRequest(value: unknown): value is ImportRequest {
	if (value === null || typeof value !== 'object') {
		return false;
	}
	const request = value as Partial<ImportRequest>;
	return (
		typeof request.kind === 'string' &&
		['html', 'markdown', 'word', 'chm'].includes(request.kind) &&
		typeof request.source === 'string' &&
		request.source.length > 0 &&
		typeof request.destination === 'string' &&
		request.destination.length > 0
	);
}

async function exists(uri: vscode.Uri): Promise<boolean> {
	try {
		await vscode.workspace.fs.stat(uri);
		return true;
	} catch {
		return false;
	}
}

async function isFolder(uri: vscode.Uri): Promise<boolean> {
	try {
		return (await vscode.workspace.fs.stat(uri)).type === vscode.FileType.Directory;
	} catch {
		return false;
	}
}

/** Every readable file under a folder, in a stable order, with the ones a person should know about reported. */
async function collect(folder: vscode.Uri, extensions: readonly string[], skipped: string[]): Promise<vscode.Uri[]> {
	if (!(await isFolder(folder))) {
		// A single file is a folder of one — the standalone HTML case needs no separate path.
		return extensions.includes(path.extname(folder.fsPath).toLowerCase()) ? [folder] : [];
	}

	const found: vscode.Uri[] = [];
	const walk = async (directory: vscode.Uri): Promise<void> => {
		let entries: [string, vscode.FileType][];
		try {
			entries = await vscode.workspace.fs.readDirectory(directory);
		} catch (error) {
			skipped.push(`${vscode.workspace.asRelativePath(directory)} — cannot be read (${String(error)})`);
			return;
		}
		for (const [name, type] of entries.sort(([left], [right]) => left.localeCompare(right))) {
			if (name.startsWith('.')) {
				continue;
			}
			const child = vscode.Uri.joinPath(directory, name);
			if (type === vscode.FileType.Directory) {
				if (!SKIP.has(name.toLowerCase())) {
					await walk(child);
				}
			} else if (extensions.includes(path.extname(name).toLowerCase())) {
				found.push(child);
			}
		}
	};
	await walk(folder);
	return found.sort((left, right) => left.fsPath.localeCompare(right.fsPath));
}

/**
 * The area and chapter a file came from: the first folder is the area, the second the chapter.
 *
 * This is the one place a page's place is decided, and it only ever reads the path — material with no folders
 * lands in `overview`, the area the starter template uses.
 */
function placeOf(relative: string): { area: string; chapter: string } {
	const parts = relative.split(/[\\/]/);
	parts.pop();
	const area = slugOf(parts[0] ?? '') || 'overview';
	const chapter = slugOf(parts[1] ?? '');
	return { area, chapter };
}

/**
 * A file's text, with the one fallback that matters: an HTML help page written for Windows is often not UTF-8,
 * and a page of replacement characters is worse than one read as the legacy encoding it probably is.
 */
function decode(raw: Buffer): string {
	const utf8 = raw.toString('utf8');
	if (!utf8.includes('\uFFFD')) {
		return utf8;
	}
	try {
		return new TextDecoder('windows-1252').decode(raw);
	} catch {
		return utf8;
	}
}

/** The `# heading` a Markdown body already has, when it has one. */
function headingOf(markdown: string): string | undefined {
	return /^#\s+(.+)$/m.exec(markdown)?.[1]?.trim();
}

function titleCase(text: string): string {
	const words = text
		.replace(/[-_]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return words.length === 0 ? 'Overview' : words.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

// --------------------------------------------------------------------------------------------------- HTML

/** One HTML page as Markdown: the blocks a help page is made of, and nothing invented. */
export function htmlToMarkdown(html: string): string {
	let text = html
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/<(script|style|head|noscript|iframe)[\s\S]*?<\/\1>/gi, '');

	text = text.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_match, level: string, inner: string) =>
		`\n\n${'#'.repeat(Number(level))} ${inline(inner)}\n\n`);
	text = text.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_match, inner: string) =>
		`\n\n\`\`\`\n${unescape(strip(inner)).trim()}\n\`\`\`\n\n`);
	text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_match, inner: string) =>
		'`' + unescape(strip(inner)).trim() + '`');
	text = text.replace(/<table[\s\S]*?<\/table>/gi, (table: string) => `\n\n${tableToMarkdown(table)}\n\n`);
	text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_match, inner: string) => `\n- ${inline(inner)}`);
	text = text.replace(/<\/?(ul|ol|dl)[^>]*>/gi, '\n');
	text = text.replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*>/gi, (_match, alt: string, src: string) =>
		`![${alt}](${src})`);
	text = text.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, (_match, src: string) => `![](${src})`);
	text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_match, href: string, inner: string) =>
		`[${inline(inner)}](${localHref(href)})`);
	text = text.replace(/<br\s*\/?>/gi, '  \n');
	text = text.replace(/<(p|div|section|article|header|footer|tr|blockquote)[^>]*>/gi, '\n\n');
	text = text.replace(/<\/(p|div|section|article|header|footer|tr|blockquote)>/gi, '\n\n');
	text = strip(text);

	return unescape(text)
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

/** Text inside one inline element: tags gone, entities decoded, whitespace collapsed to one line. */
function inline(html: string): string {
	return unescape(strip(html)).replace(/\s+/g, ' ').trim();
}

function strip(html: string): string {
	return html.replace(/<[^>]+>/g, '');
}

/** A link to a sibling help page points at the Markdown that replaces it, not at an `.html` file that will not be there. */
function localHref(href: string): string {
	if (/^(https?:|mailto:|#|\/)/i.test(href)) {
		return href;
	}
	return href.replace(/\.html?$/i, '.md');
}

/** A `<table>` as a GitHub-flavoured table; the first row is the header, which is what a help table means. */
function tableToMarkdown(table: string): string {
	const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
		[...(row[1] ?? '').matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((cell) => inline(cell[1] ?? ''))
	);
	if (rows.length === 0) {
		return '';
	}
	const width = Math.max(...rows.map((row) => row.length));
	const line = (cells: readonly string[]): string =>
		`| ${Array.from({ length: width }, (_, index) => cells[index] ?? '').join(' | ')} |`;
	return [line(rows[0]), `|${' --- |'.repeat(width)}`, ...rows.slice(1).map(line)].join('\n');
}

function unescape(text: string): string {
	return text
		.replace(/&nbsp;/gi, ' ')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;|&apos;/gi, "'")
		.replace(/&amp;/gi, '&')
		.replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
		.replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(parseInt(code, 16)));
}

// ----------------------------------------------------------------------------------------- Word, RTF, CHM

/**
 * Word, RTF and ODT files, as Markdown, through `pandoc`.
 *
 * Pandoc is the one dependency an import has. When it is not installed the import says so and writes nothing —
 * a half-converted manual is worse than a clear "install pandoc".
 */
async function pandoc(source: vscode.Uri, skipped: string[]): Promise<vscode.Uri> {
	await requireTool('pandoc', 'Word, RTF and ODT');
	const files = await collect(source, READABLE.word, skipped);
	const into = tempFolder('pandoc');
	await vscode.workspace.fs.createDirectory(into);

	for (const file of files) {
		const target = vscode.Uri.joinPath(into, `${slugOf(path.basename(file.fsPath, path.extname(file.fsPath))) || 'page'}.md`);
		try {
			const markdown = await exec('pandoc', [file.fsPath, '-t', 'gfm', '--wrap=none']);
			await vscode.workspace.fs.writeFile(target, Buffer.from(markdown, 'utf8'));
		} catch (error) {
			skipped.push(`${path.basename(file.fsPath)} — ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	return into;
}

/**
 * A compiled help file, decompiled with the Windows help compiler's own `-decompile` switch, then read as HTML.
 *
 * `hh.exe` detaches, so the folder is watched until its file count stops growing. On any other platform the CHM
 * is refused in words rather than half-read: nothing cross-platform reads the format reliably.
 */
async function decompile(source: vscode.Uri): Promise<vscode.Uri> {
	if (process.platform !== 'win32') {
		throw new Error('CHM is a Windows format: `hh.exe -decompile` is what reads it, and this platform has no `hh.exe`.');
	}
	const into = tempFolder('chm');
	await vscode.workspace.fs.createDirectory(into);
	try {
		await exec('hh.exe', ['-decompile', into.fsPath, source.fsPath]);
	} catch (error) {
		throw new Error(
			`\`hh.exe\` could not read ${path.basename(source.fsPath)} — ${error instanceof Error ? error.message : String(error)}`
		);
	}

	let previous = -1;
	let stable = 0;
	for (let attempt = 0; attempt < 120 && stable < 4; attempt++) {
		await delay(250);
		const count = await countFiles(into);
		stable = count === previous ? stable + 1 : 0;
		previous = count;
	}
	if (previous <= 0) {
		throw new Error(`${path.basename(source.fsPath)} produced no pages — the file may not be a compiled help file.`);
	}
	return into;
}

function tempFolder(tag: string): vscode.Uri {
	return vscode.Uri.file(path.join(os.tmpdir(), `temco-import-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`));
}

async function countFiles(folder: vscode.Uri): Promise<number> {
	try {
		const entries = await vscode.workspace.fs.readDirectory(folder);
		return entries.filter(([name, type]) => type === vscode.FileType.File && HTML_EXTENSIONS.includes(path.extname(name).toLowerCase())).length;
	} catch {
		return 0;
	}
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Says "install it" rather than failing later with a stack trace nobody can act on. */
async function requireTool(tool: string, what: string): Promise<void> {
	try {
		await exec(tool, ['--version']);
	} catch {
		throw new Error(`\`${tool}\` is not installed or not on the PATH, and it is what reads ${what}. Install it, then import again.`);
	}
}

function exec(command: string, args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile(command, args, { windowsHide: true, maxBuffer: 32 * 1024 * 1024 }, (error, stdout) => {
			if (error) {
				reject(error);
				return;
			}
			resolve(String(stdout));
		});
	});
}
