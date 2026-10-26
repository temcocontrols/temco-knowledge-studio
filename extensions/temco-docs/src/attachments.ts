// Where an image lands, and what is recorded about it.
//
// Two insert paths write images into a page's `media/`: the Monaco commands in `media.ts`, and Temco Editor's
// capture and paste. They must agree on the name, the size limit and the record written beside the file, so all three
// live here once rather than twice — the second copy is what would drift.
//
// The sidecar is design §22.4. A screenshot is a photograph of a version, and when the next firmware ships every
// picture of the old one becomes a lie that still looks true. `appliesTo` is the version the documentation described
// when the image was inserted, so a later release can name the pictures that need retaking without anyone remembering.

import * as path from 'path';
import * as vscode from 'vscode';
import {
	parseRecord,
	serialiseRecord,
	staleImages,
	withCaption,
	withImage,
	type AttachmentFile,
} from './attachmentRecord';
import { DocsRoot, collectPages } from './registry';
import { firstVersionReport } from './versionReport';

/** The 2 MB a page image may have, and the width below which a stretched screenshot goes soft. */
export const MAX_BYTES = 2 * 1024 * 1024;
export const MIN_WIDTH = 1600;

const RECORD = 'attachments.json';

/** A page's own `media/`, beside the file that shows it. */
export function mediaFolder(pageFsPath: string): vscode.Uri {
	return vscode.Uri.joinPath(vscode.Uri.file(path.dirname(pageFsPath)), 'media');
}

/**
 * The record beside a page's images.
 *
 * A missing or unreadable file is an empty record, not an error: every page written before this existed has none, and a
 * page with no record must behave exactly as it did before the record was introduced.
 */
export async function readAttachments(media: vscode.Uri): Promise<AttachmentFile> {
	try {
		const bytes = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(media, RECORD));
		return parseRecord(Buffer.from(bytes).toString('utf8'));
	} catch {
		return { version: 1, images: {} };
	}
}

async function writeAttachments(media: vscode.Uri, file: AttachmentFile): Promise<void> {
	await vscode.workspace.fs.writeFile(
		vscode.Uri.joinPath(media, RECORD),
		Buffer.from(serialiseRecord(file), 'utf8')
	);
}

/** The next `NN-slug.ext`: the number continues the folder's own sequence, the slug is the page's. */
export async function nextName(media: vscode.Uri, slug: string, extension: string): Promise<string> {
	let highest = 0;
	for (const name of await listNames(media)) {
		const match = /^(\d+)-/.exec(name);
		if (match) {
			highest = Math.max(highest, Number(match[1]));
		}
	}
	return `${String(highest + 1).padStart(2, '0')}-${slug || 'screen'}.${extension}`;
}

async function listNames(directory: vscode.Uri): Promise<string[]> {
	try {
		const entries = await vscode.workspace.fs.readDirectory(directory);
		return entries.filter(([, type]) => type === vscode.FileType.File).map(([name]) => name);
	} catch {
		return [];
	}
}

/** The type, from the bytes. Sniffed, never trusted from the name — which is why a `.bmp` is stored as what it is. */
export function extensionOf(bytes: Uint8Array, fallback: string): string {
	if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
		return 'png';
	}
	if (bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
		return 'jpg';
	}
	if (bytes.length > 4 && String.fromCharCode(...bytes.slice(0, 4)) === 'GIF8') {
		return 'gif';
	}
	if (bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
		&& String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') {
		return 'webp';
	}
	const head = Buffer.from(bytes.slice(0, 512)).toString('utf8');
	if (head.includes('<svg')) {
		return 'svg';
	}
	return fallback || 'png';
}

/** A PNG's width, from its IHDR — the only thing needed from the bytes, so no image library is involved. */
export function pngWidth(bytes: Uint8Array): number | undefined {
	if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) {
		return undefined;
	}
	return ((bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]) >>> 0;
}

/** The version the documentation describes right now, from the report the release workflow writes. */
export async function currentVersion(roots: readonly DocsRoot[]): Promise<string | undefined> {
	const report = await firstVersionReport(roots);
	return report?.report.version;
}

export interface LandOptions {
	pageFsPath: string;
	/** The page's title or id, for the file name. */
	slug: string;
	bytes: Uint8Array;
	fallbackExtension?: string;
	caption: string;
	/** What the picture depicts. `undefined` when no version is known, which is recorded as unknown rather than guessed. */
	appliesTo?: string;
}

export interface Landed {
	/** What the Markdown holds: relative to the page, which is what the build resolves. */
	relative: string;
	alt: string;
	/** A sentence to show the person if the image is fine but not ideal. */
	warning?: string;
}

/**
 * Puts one image beside its page and records what it is.
 *
 * Nothing here touches the document: the caller inserts the reference, so the same file can be written for a paste, a
 * capture, or a picture picked from disk without three copies of the insertion rule.
 */
export async function landImage(options: LandOptions): Promise<Landed | { error: string }> {
	if (options.bytes.byteLength === 0) {
		return { error: 'the image was empty' };
	}
	if (options.bytes.byteLength > MAX_BYTES) {
		const megabytes = (options.bytes.byteLength / (1024 * 1024)).toFixed(1);
		return { error: `that screen is ${megabytes} MB, over the 2 MB a page image may have` };
	}

	const media = mediaFolder(options.pageFsPath);
	await vscode.workspace.fs.createDirectory(media);
	const name = await nextName(media, options.slug, extensionOf(options.bytes, options.fallbackExtension ?? 'png'));
	await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(media, name), options.bytes);

	const caption = options.caption.trim();
	const file = await readAttachments(media);
	await writeAttachments(media, withImage(file, name, {
		caption,
		appliesTo: options.appliesTo,
		added: new Date().toISOString().slice(0, 10),
	}));

	const width = pngWidth(options.bytes);
	return {
		relative: `media/${name}`,
		alt: caption === '' ? options.slug : caption,
		warning: width !== undefined && width < MIN_WIDTH
			? `${name} is ${width} px wide. A page stretches an image to the content width, so ${MIN_WIDTH} px or wider keeps it sharp.`
			: undefined,
	};
}

/**
 * Records the words for an image that landed without them.
 *
 * A picture picked from disk arrives with no caption, and the surface asks for one afterwards. Keeping this separate from
 * `landImage` means the answer can never move the file — only the sentence about it.
 */
export async function setCaption(pageFsPath: string, name: string, caption: string): Promise<void> {
	const media = mediaFolder(pageFsPath);
	const file = await readAttachments(media);
	await writeAttachments(media, withCaption(file, name, caption));
}

/** Every page's stale images across the sets being read, for the report a publish asks for. */
export async function staleAcross(
	roots: readonly DocsRoot[]
): Promise<{ page: string; name: string; appliesTo: string; current: string }[]> {
	const found: { page: string; name: string; appliesTo: string; current: string }[] = [];
	for (const root of roots) {
		const current = await currentVersion([root]);
		if (current === undefined) {
			continue;
		}
		for (const page of collectPages(root)) {
			if (!page.exists) {
				continue;
			}
			const media = mediaFolder(page.uri.fsPath);
			const file = await readAttachments(media);
			for (const stale of staleImages(file.images, current)) {
				found.push({ page: page.id, name: stale.name, appliesTo: stale.appliesTo, current });
			}
		}
	}
	return found;
}
