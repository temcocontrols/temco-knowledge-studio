// Export, on disk: the three shapes a reader outside this platform can be given.
//
// Each one is a folder or a file the person can point at later — nothing is "published" and nothing leaves the machine. The
// work is deciding what to include, not rendering: `site.ts` already knows how to build the site, and `siteRender.ts`
// already knows what a page looks like.

import * as path from 'path';
import * as vscode from 'vscode';
import { DocsRoot, PageEntry, collectPages } from './registry';
import { addresses, renderArticle, renderStandalone, slugPath } from './siteRender';
import { DocxPicture, docx, pngSize } from './docxWrite';
import { generateSite } from './site';
import { ZippedFile, zip } from './zip';

export interface ExportResult {
	file: vscode.Uri;
	files: number;
	bytes: number;
}

export function registerExportCommands(
	context: vscode.ExtensionContext,
	roots: () => readonly DocsRoot[],
	output: vscode.OutputChannel
): void {
	/**
	 * One export command: pick the folder, then run. Registered with a literal id at each call site below — the duplicate
	 * check in `check-commands.mts` reads the source, so a helper that took the id as a variable would hide it.
	 */
	const run = async (work: (root: DocsRoot, target?: unknown) => Promise<void>, target?: unknown): Promise<void> => {
		const root = await pickRoot(roots());
		if (root !== undefined) {
			await work(root, target);
		}
	};

	context.subscriptions.push(
		vscode.commands.registerCommand('temcoDocs.exportSite', async () => {
			await run(async root => finished(await exportSite(root), 'site'));
		}),
		vscode.commands.registerCommand('temcoDocs.exportPage', async (target?: unknown) => {
			await run(async (root, on) => {
				const page = await pickPage(root, on);
				if (page !== undefined) {
					await finished(await exportPage(root, page), `page “${page.title}”`);
				}
			}, target);
		}),
		vscode.commands.registerCommand('temcoDocs.exportMarkdown', async () => {
			await run(async root => finished(await exportMarkdown(root), 'Markdown bundle'));
		}),
		// A Word document of one page: the shape a reviewer who does not use Markdown asks for.
		vscode.commands.registerCommand('temcoDocs.exportDocx', async (target?: unknown) => {
			await run(async (root, on) => {
				const page = await pickPage(root, on);
				if (page !== undefined) {
					await finished(await exportDocx(root, page), `Word document of “${page.title}”`);
				}
			}, target);
		})
	);

	async function finished(result: ExportResult | undefined, what: string): Promise<void> {
		if (result === undefined) {
			return;
		}
		const relative = vscode.workspace.asRelativePath(result.file);
		output.appendLine(`[export] ${what}: ${result.files} file(s), ${kilo(result.bytes)} → ${result.file.fsPath}`);
		const open = await vscode.window.showInformationMessage(
			`Temco Docs: the ${what} is at ${relative}.`,
			'Show in Folder'
		);
		if (open !== undefined) {
			await vscode.commands.executeCommand('revealFileInOS', result.file);
		}
	}
}

/** The built site, zipped. Building first is deliberate: the archive is what a reader would see, not a second rendering. */
export async function exportSite(root: DocsRoot): Promise<ExportResult | undefined> {
	const site = await generateSite(root, { project: root.folder.name });
	if (site.pages === 0) {
		void vscode.window.showWarningMessage(`Temco Docs: ${root.folder.name} has no pages to export.`);
		return undefined;
	}
	const files: ZippedFile[] = [];
	for (const [name, uri] of await tree(site.destination)) {
		files.push({ name, data: await vscode.workspace.fs.readFile(uri) });
	}
	return write(root, `${slugPath(root.folder.name)}-site`, files);
}

/**
 * One page as a single file.
 *
 * A page's pictures become `data:` URIs, and the stylesheet is inlined, so the file has no neighbours to lose. A page
 * whose pictures are enormous will be enormous; that is the honest trade for a file that always opens.
 */
export async function exportPage(root: DocsRoot, page: PageEntry): Promise<ExportResult | undefined> {
	const markdown = new TextDecoder().decode(await vscode.workspace.fs.readFile(page.uri));
	const where = addresses([page.id]);
	const entry = { id: page.id, title: page.title, area: page.area, markdown };
	const html = renderArticle(entry, where);
	const embedded = await embedPictures(html, page);
	const document = renderStandalone({
		entry,
		model: { project: root.folder.name, areas: [] },
		body: embedded,
		built: new Date().toISOString().slice(0, 10)
	});
	// A page export is one file, so it is written as one file — not wrapped in an archive a reader has to open first.
	return writeOne(root, `${slugPath(page.id)}-${new Date().toISOString().slice(0, 10)}.html`, Buffer.from(document, 'utf8'));
}

/** The pages and the pictures they refer to, as a folder tree another Markdown tool can open. */
export async function exportMarkdown(root: DocsRoot): Promise<ExportResult | undefined> {
	const pages = collectPages(root).filter(page => page.exists);
	if (pages.length === 0) {
		void vscode.window.showWarningMessage(`Temco Docs: ${root.folder.name} has no pages to export.`);
		return undefined;
	}
	const files: ZippedFile[] = [];
	const seen = new Set<string>();
	for (const page of pages) {
		const relative = path.relative(root.rootUri.fsPath, page.uri.fsPath).split(path.sep).join('/');
		files.push({ name: relative, data: await vscode.workspace.fs.readFile(page.uri) });
		const folder = path.posix.dirname(relative);
		if (!seen.has(folder)) {
			seen.add(folder);
			// Once per folder, not once per page: pages in one chapter share a `media/`, and a zip should not carry it twice.
			for (const [name, uri] of await tree(vscode.Uri.joinPath(root.rootUri, ...folder.split('/'), 'media')).catch(() => [])) {
				files.push({ name: `${folder === '.' ? '' : `${folder}/`}media/${name}`, data: await vscode.workspace.fs.readFile(uri) });
			}
		}
	}
	try {
		const registry = await vscode.workspace.fs.readFile(root.registryUri);
		files.push({
			name: path.relative(root.rootUri.fsPath, root.registryUri.fsPath).split(path.sep).join('/'),
			data: registry
		});
	} catch {
		// A project without a registry file still has pages worth taking.
	}
	return write(root, `${slugPath(root.folder.name)}-markdown`, files);
}

/** One page as a Word document, with its pictures embedded. */
export async function exportDocx(root: DocsRoot, page: PageEntry): Promise<ExportResult | undefined> {
	const markdown = new TextDecoder().decode(await vscode.workspace.fs.readFile(page.uri));
	const pictures: DocxPicture[] = [];
	// The Markdown says which pictures it has; read those, and let a missing file fall back to its caption.
	for (const match of markdown.matchAll(/!\[[^\]]*\]\(\s*([^)\s]+)/gu)) {
		const source = match[1];
		if (/^[a-z]+:/iu.test(source) || pictures.some(entry => entry.src === source)) {
			continue;
		}
		try {
			const file = vscode.Uri.joinPath(page.uri, '..', ...decodeURI(source).split('/'));
			const data = await vscode.workspace.fs.readFile(file);
			const size = pngSize(data);
			pictures.push({ src: source, data, width: size?.width ?? 0, height: size?.height ?? 0 });
		} catch {
			// A picture that is not there does not stop the document; the caption stays where it was.
		}
	}
	const document = docx({ title: page.title, markdown, pictures });
	return writeOne(root, `${slugPath(page.id)}-${new Date().toISOString().slice(0, 10)}.docx`, document);
}

/** Every file under a folder, as `relative path → uri`. A folder that does not exist is simply empty. */
async function tree(from: vscode.Uri, prefix = ''): Promise<[string, vscode.Uri][]> {
	const found: [string, vscode.Uri][] = [];
	let entries: [string, vscode.FileType][];
	try {
		entries = await vscode.workspace.fs.readDirectory(from);
	} catch {
		return found;
	}
	for (const [name, kind] of entries) {
		const uri = vscode.Uri.joinPath(from, name);
		const relative = prefix === '' ? name : `${prefix}/${name}`;
		if (kind === vscode.FileType.Directory) {
			found.push(...(await tree(uri, relative)));
		} else if (kind === vscode.FileType.File) {
			found.push([relative, uri]);
		}
	}
	return found;
}

/**
 * A page's pictures, carried inside the HTML.
 *
 * Only relative references are touched: a picture on a web server is left pointing at the web server, because copying a
 * stranger's image into a file is not ours to do.
 */
async function embedPictures(html: string, page: PageEntry): Promise<string> {
	const sources = [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/gu)].map(match => match[1]);
	const unique = [...new Set(sources)].filter(source => !/^(?:[a-z]+:|\/\/|#)/iu.test(source));
	let body = html;
	for (const source of unique) {
		try {
			const file = vscode.Uri.joinPath(page.uri, '..', ...decodeURI(source).split('/'));
			const bytes = await vscode.workspace.fs.readFile(file);
			body = body.split(`src="${source}"`).join(`src="${dataUri(source, bytes)}"`);
		} catch {
			// A picture that is not there stays a broken link, which is what the page says too.
		}
	}
	return body;
}

/** A picture as a `data:` URI, typed by its extension. */
export function dataUri(name: string, bytes: Uint8Array): string {
	const extension = path.extname(name).toLowerCase();
	const type = extension === '.png' ? 'image/png'
		: extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg'
			: extension === '.gif' ? 'image/gif'
				: extension === '.svg' ? 'image/svg+xml'
					: extension === '.webp' ? 'image/webp'
						: 'application/octet-stream';
	return `data:${type};base64,${Buffer.from(bytes).toString('base64')}`;
}

/** The archive, written beside the project so it is easy to find and easy to delete. */
async function write(root: DocsRoot, base: string, files: readonly ZippedFile[]): Promise<ExportResult> {
	const archive = zip(files);
	return writeOne(root, `${base}-${new Date().toISOString().slice(0, 10)}.zip`, archive, files.length);
}

/** One file in the project's `dist/`, with the folder made first so the write cannot fail on a fresh project. */
async function writeOne(root: DocsRoot, name: string, content: Uint8Array, files = 1): Promise<ExportResult> {
	const target = vscode.Uri.joinPath(root.folder.uri, 'dist', name);
	await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(root.folder.uri, 'dist'));
	await vscode.workspace.fs.writeFile(target, content);
	return { file: target, files, bytes: content.length };
}

function kilo(bytes: number): string {
	return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function pickRoot(roots: readonly DocsRoot[]): Promise<DocsRoot | undefined> {
	if (roots.length === 1) {
		return roots[0];
	}
	if (roots.length === 0) {
		void vscode.window.showWarningMessage('Temco Docs: no documentation folder is open in this workspace.');
		return undefined;
	}
	const chosen = await vscode.window.showQuickPick(
		roots.map(root => ({ label: root.folder.name, description: path.basename(root.rootUri.fsPath), root })),
		{ placeHolder: 'Export from which documentation folder?' }
	);
	return chosen?.root;
}

/** The page a command was invoked on, or one the person picks. */
async function pickPage(root: DocsRoot, target: unknown): Promise<PageEntry | undefined> {
	const pages = collectPages(root).filter(page => page.exists);
	const wanted = (target as { id?: unknown } | undefined)?.id;
	if (typeof wanted === 'string') {
		const found = pages.find(page => page.id === wanted);
		if (found !== undefined) {
			return found;
		}
	}
	const chosen = await vscode.window.showQuickPick(
		pages.map(page => ({ label: page.title, description: page.id, page })),
		{ placeHolder: 'Export which page?' }
	);
	return chosen?.page;
}
