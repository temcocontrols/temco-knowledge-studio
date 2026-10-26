// The attachment record, as data rather than as I/O.
//
// `attachments.ts` owns the file and the folder; this owns what the file *means*. The split is what makes design §22.4
// testable at all: the rule that decides which pictures are stale is a pure function over a record, so it can be driven
// through a table of cases without a workspace, an editor or a filesystem (`npm run check-record`).
//
// The shape, beside a page in `media/attachments.json`:
//
//   { "version": 1,
//     "images": {
//       "01-device-list.png": { "caption": "Device list after a reset", "appliesTo": "13.0", "added": "2026-10-24" }
//     } }

/** What is known about one image. Every field is optional: a picture added before any of this existed is still one. */
export interface Attachment {
	/** Doubles as the alt text, which is what makes "every image has words" one field rather than two. */
	caption?: string;
	/** The documentation version the picture depicts. Absent when no version report exists yet. */
	appliesTo?: string;
	added?: string;
}

export interface AttachmentFile {
	version: number;
	images: Record<string, Attachment>;
}

export function emptyRecord(): AttachmentFile {
	return { version: 1, images: {} };
}

/**
 * A record read from text, tolerantly.
 *
 * A file that is absent, empty or not JSON is an empty record rather than an error: every page written before this
 * existed has none, and a page with no record must behave exactly as it did before the record was introduced.
 */
export function parseRecord(text: string): AttachmentFile {
	if (text.trim() === '') {
		return emptyRecord();
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return emptyRecord();
	}
	if (parsed === null || typeof parsed !== 'object') {
		return emptyRecord();
	}
	const file = parsed as Partial<AttachmentFile>;
	if (file.images === null || typeof file.images !== 'object') {
		return emptyRecord();
	}
	return { version: typeof file.version === 'number' ? file.version : 1, images: file.images };
}

export function serialiseRecord(file: AttachmentFile): string {
	return `${JSON.stringify(file, null, 2)}\n`;
}

/** The record with one image added, or replaced. Returns a new object: the caller decides when to write. */
export function withImage(
	file: AttachmentFile,
	name: string,
	details: { caption?: string; appliesTo?: string; added?: string }
): AttachmentFile {
	const caption = details.caption?.trim() ?? '';
	return {
		version: file.version,
		images: {
			...file.images,
			[name]: {
				caption: caption === '' ? undefined : caption,
				appliesTo: details.appliesTo,
				added: details.added,
			},
		},
	};
}

/** The record with an image's words changed and nothing else about it touched. */
export function withCaption(file: AttachmentFile, name: string, caption: string): AttachmentFile {
	const trimmed = caption.trim();
	return {
		version: file.version,
		images: {
			...file.images,
			[name]: { ...(file.images[name] ?? {}), caption: trimmed === '' ? undefined : trimmed },
		},
	};
}

/**
 * The images a newer version has left behind: those that depict a version the documentation no longer describes.
 *
 * An image with no `appliesTo` is **not** called stale, because "we do not know" is not the same claim as "this is old".
 * Silence must not turn into a false accusation against every page written before the record existed.
 */
export function staleImages(
	images: Record<string, Attachment>,
	current: string | undefined
): { name: string; appliesTo: string }[] {
	if (current === undefined) {
		return [];
	}
	return Object.entries(images)
		.filter(([, record]) => typeof record?.appliesTo === 'string' && record.appliesTo !== '' && record.appliesTo !== current)
		.map(([name, record]) => ({ name, appliesTo: String(record.appliesTo) }))
		.sort((left, right) => left.name.localeCompare(right.name));
}
