// Translating a page, without translating what must not be translated.
//
// A page is Markdown: prose, and things that only look like prose. A model or a service that rewrites the whole file
// destroys the parts that make it a page — a fenced sample becomes translated "code", a link's URL is helpfully
// localized into something that 404s, an inline `codeSpan` loses its identity, an image path stops resolving. So
// the file is cut into segments, only the prose segments are sent, and the segments are put back together in the
// order they came: the document's structure is decided here, and the service only ever sees sentences.
//
// What this deliberately does not do: it does not translate a page into a language the registry does not know about,
// and it never writes over the page it read. A translation is a sibling file, and the person decides what happens to
// it after that.
//
// The service is Azure AI Translator (`api.cognitive.microsofttranslator.com`, the same family of endpoints the
// Azure portal sells), called with a subscription key. The key is a secret, never a setting: `secrets.ts` in the
// extension keeps it in the OS keychain. Everything below takes the transport as an argument, so the behaviour this
// file is responsible for — cutting, reassembling, reporting — is testable without a network.

/** A piece of a page: either prose to be translated, or something preserved exactly as it is. */
export interface Segment {
	/** True when this segment is sent to the service; false when it is put back untouched. */
	translate: boolean;
	text: string;
}

/** One accepted language, by the tag the service and the file name both use. */
export interface Language {
	tag: string;
	/** The name a person picks from, in the language being shown. */
	label: string;
}

/** The languages offered. Deliberately short: every one of them is a market the product is sold into. */
export const LANGUAGES: readonly Language[] = [
	{ tag: 'zh-Hans', label: 'Chinese (Simplified)' },
	{ tag: 'zh-Hant', label: 'Chinese (Traditional)' },
	{ tag: 'ja', label: 'Japanese' },
	{ tag: 'ko', label: 'Korean' },
	{ tag: 'de', label: 'German' },
	{ tag: 'fr', label: 'French' },
	{ tag: 'es', label: 'Spanish' },
	{ tag: 'pt', label: 'Portuguese' },
	{ tag: 'it', label: 'Italian' },
	{ tag: 'ru', label: 'Russian' },
	{ tag: 'ar', label: 'Arabic' }
];

/** The language a person picked, or undefined when the tag is not one this build offers. */
export function languageOf(tag: string): Language | undefined {
	return LANGUAGES.find((language) => language.tag.toLowerCase() === tag.toLowerCase());
}

/**
 * The page, cut into segments.
 *
 * The invariant is that **concatenating the segments reproduces the page exactly** — so a segment carries its own
 * punctuation and its own newline, and reassembly never guesses at a separator. What is preserved: front matter, code
 * fences, table rules, inline code, image paths, link targets, HTML, and the marker at the start of a line (a
 * heading's `#`, a list's `-`, a quote's `>`). What is sent: the words.
 */
export function segmentsOf(markdown: string): Segment[] {
	const segments: Segment[] = [];
	const lines = markdown.split('\n');
	let fence: string | undefined;
	let frontMatter: string | undefined;

	const keep = (text: string): void => {
		segments.push({ translate: false, text });
	};
	/** Adds a line's segments, with the newline the split removed. */
	const addLine = (line: string, pieces: Segment[]): void => {
		if (pieces.length === 0) {
			keep(line);
		} else {
			segments.push(...pieces);
		}
		keep('\n');
	};

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index];
		const last = index === lines.length - 1;

		// Front matter: the block between the first `---` and the next one is metadata, not prose.
		if (frontMatter !== undefined) {
			if (line.trim() === frontMatter) {
				frontMatter = undefined;
			}
			last ? keep(line) : addLine(line, []);
			continue;
		}
		if (index === 0 && (line.trim() === '---' || line.trim() === '+++')) {
			frontMatter = line.trim();
			last ? keep(line) : addLine(line, []);
			continue;
		}

		// A fence, and everything inside it.
		const open = /^\s*(```+|~~~+)/.exec(line);
		if (fence !== undefined) {
			if (open !== null && open[1][0] === fence[0] && open[1].length >= fence.length) {
				fence = undefined;
			}
			last ? keep(line) : addLine(line, []);
			continue;
		}
		if (open !== null) {
			fence = open[1];
			last ? keep(line) : addLine(line, []);
			continue;
		}

		if (last) {
			segments.push(...inlineCuts(line));
			continue;
		}
		addLine(line, inlineCuts(line));
	}
	return segments;
}

/** Text with nothing to say: a blank line, a table rule, an HTML block, a rule, a link definition. */
function isMarkupOnly(line: string): boolean {
	const trimmed = line.trim();
	if (trimmed === '') {
		return true;
	}
	if (/^\|?[\s:|-]+\|?$/.test(trimmed) && trimmed.includes('-')) {
		return true;
	}
	if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
		return true;
	}
	if (/^!\[[^\]]*\]\([^)]*\)$/.test(trimmed)) {
		return true;
	}
	if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
		return true;
	}
	return /^\[[^\]]+\]:\s*\S+$/.test(lastLine(trimmed));
}

function lastLine(text: string): string {
	const at = text.lastIndexOf('\n');
	return at < 0 ? text : text.slice(at + 1);
}

/**
 * One line, cut into the parts a translator may see and the parts it may not.
 *
 * The line's *marker* stays: `## `, `- `, `1. `, `> `, a task box, and a table's pipes. So does every URL, every
 * inline code span and every image. A link keeps its brackets and its target and sends only its label — the words a
 * person reads are translated, the address they follow is not.
 */
function inlineCuts(line: string): Segment[] {
	if (isMarkupOnly(line)) {
		return [{ translate: false, text: line }];
	}

	const cuts: Segment[] = [];
	const push = (translate: boolean, text: string): void => {
		if (text === '') {
			return;
		}
		const previous = cuts[cuts.length - 1];
		if (previous !== undefined && previous.translate === translate) {
			previous.text += text;
			return;
		}
		cuts.push({ translate, text });
	};

	// A table row: the pipes are the table, the cells are prose.
	const trimmed = line.trim();
	if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 1) {
		const lead = line.length - line.trimStart().length;
		push(false, line.slice(0, lead));
		const cells = line.trim().split('|');
		cells.forEach((cell, index) => {
			if (index > 0) {
				push(false, '|');
			}
			push(true, cell);
		});
		return cuts;
	}

	// The marker at the start of the line.
	const marker = /^(\s*(?:>\s*)*(?:#{1,6}\s+|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)?)/.exec(line);
	const offset = marker === null ? 0 : marker[1].length;
	push(false, line.slice(0, offset));

	let index = offset;
	let buffer = '';
	const flush = (): void => {
		push(true, buffer);
		buffer = '';
	};

	while (index < line.length) {
		const rest = line.slice(index);
		const span = /^`[^`]+`/.exec(rest);
		if (span !== null) {
			flush();
			push(false, span[0]);
			index += span[0].length;
			continue;
		}
		const image = /^!\[[^\]]*\]\([^)]*\)/.exec(rest);
		if (image !== null) {
			flush();
			push(false, image[0]);
			index += image[0].length;
			continue;
		}
		const link = /^\[([^\]]*)\]\(([^)]*)\)/.exec(rest);
		if (link !== null) {
			flush();
			push(false, '[');
			push(true, link[1]);
			push(false, `](${link[2]})`);
			index += link[0].length;
			continue;
		}
		const tag = /^<[^>]+>/.exec(rest);
		if (tag !== null) {
			flush();
			push(false, tag[0]);
			index += tag[0].length;
			continue;
		}
		const url = /^https?:\/\/\S+/.exec(rest);
		if (url !== null) {
			flush();
			push(false, url[0]);
			index += url[0].length;
			continue;
		}
		buffer += line[index];
		index++;
	}
	flush();
	return cuts;
}

/** The page, with the preserved segments put back around the translated ones. */
export function reassemble(segments: readonly Segment[], translated: readonly string[]): string {
	let index = 0;
	return segments
		.map((segment) => {
			if (!segment.translate) {
				return segment.text;
			}
			const replacement = translated[index];
			index++;
			// A shorter answer than the segments means the service dropped one. The original is used rather than an
			// empty string, so a partial reply never punches a hole in the page.
			return replacement === undefined ? segment.text : replacement;
		})
		.join('');
}

/** What a translation needs to reach the service. */
export interface TranslatorOptions {
	/** The resource's endpoint, e.g. `https://api.cognitive.microsofttranslator.com`. */
	endpoint: string;
	/** The subscription key. Kept in the OS keychain, never in settings. */
	key: string;
	/** The resource's region, when it is regional rather than global. */
	region?: string;
	/** The language tag to translate into. */
	to: string;
	/** How long to wait, in milliseconds. */
	timeout?: number;
	/** The transport, so a check can answer instead of the network. */
	transport?: Transport;
}

/** One request, as a transport sees it. */
export interface TransportRequest {
	url: string;
	headers: { [name: string]: string };
	body: string;
	timeout: number;
}

/** What a transport answers: the HTTP status and the parsed body, or a message when it never got that far. */
export interface TransportResponse {
	status: number;
	body?: unknown;
	error?: string;
}

export type Transport = (request: TransportRequest) => Promise<TransportResponse>;

/** The real transport: one POST, with a deadline. */
export const httpsTransport: Transport = async (request) => {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), request.timeout);
	try {
		const response = await fetch(request.url, {
			method: 'POST',
			headers: request.headers,
			body: request.body,
			signal: controller.signal
		});
		const body: unknown = await response.json().catch(() => undefined);
		return { status: response.status, body };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { status: 0, error: controller.signal.aborted ? `timeout after ${request.timeout} ms` : message };
	} finally {
		clearTimeout(timer);
	}
};

/** What happened, in the words a person reads. */
export interface TranslationResult {
	text?: string;
	/** How many segments were sent. */
	sent: number;
	/** Why it did not happen, when it did not. */
	error?: string;
}

/**
 * Translates a page's Markdown.
 *
 * The failure messages are written for a person setting this up for the first time: a 401 is a bad key, a 403 is a
 * key without the resource, a 429 is the free tier's rate limit — none of those are "translation failed".
 */
export async function translateMarkdown(
	markdown: string,
	options: TranslatorOptions
): Promise<TranslationResult> {
	const segments = segmentsOf(markdown);
	const prose = segments.filter((segment) => segment.translate);
	if (prose.length === 0) {
		return { sent: 0, error: 'There is no prose on this page — only code, images and markup.' };
	}
	const send = options.transport ?? httpsTransport;
	const url = `${options.endpoint.replace(/\/+$/, '')}/translate?api-version=3.0&to=${encodeURIComponent(options.to)}`;
	const headers: { [name: string]: string } = {
		'Content-Type': 'application/json',
		'Ocp-Apim-Subscription-Key': options.key
	};
	if (options.region !== undefined && options.region !== '') {
		headers['Ocp-Apim-Subscription-Region'] = options.region;
	}
	const response = await send({
		url,
		headers,
		body: JSON.stringify(prose.map((segment) => ({ Text: segment.text }))),
		timeout: options.timeout ?? 30_000
	});

	if (response.error !== undefined) {
		return { sent: prose.length, error: `The translation service was not reached — ${response.error}.` };
	}
	if (response.status === 401) {
		return { sent: prose.length, error: 'The translator key was refused (401). Set it again: Temco Docs: Set the Translator Key.' };
	}
	if (response.status === 403) {
		return { sent: prose.length, error: 'The key is not allowed to translate (403). Check the resource\'s region and that it is a Translator resource.' };
	}
	if (response.status === 429) {
		return { sent: prose.length, error: 'The translation service is rate-limiting this key (429). Wait a minute, or use a paid tier.' };
	}
	if (response.status !== 200) {
		return { sent: prose.length, error: `The translation service answered ${response.status}.` };
	}

	const answers = Array.isArray(response.body) ? response.body : [];
	const translated: string[] = [];
	for (let index = 0; index < prose.length; index++) {
		const answer = answers[index] as { translations?: { text?: string }[] } | undefined;
		const text = answer?.translations?.[0]?.text;
		if (typeof text !== 'string') {
			return { sent: prose.length, error: 'The translation service answered without text — nothing was written.' };
		}
		translated.push(text);
	}
	return { text: reassemble(segments, translated), sent: prose.length };
}

/**
 * The file a translation is written to.
 *
 * `docs/guide/setup.md` into German is `docs/guide/setup.de.md` — beside the page, so every relative image and link in
 * it keeps working, which is the whole reason not to put translations in a folder of their own.
 */
export function translatedPath(pagePath: string, tag: string): string {
	const dot = pagePath.lastIndexOf('.');
	if (dot < 0) {
		return `${pagePath}.${tag}`;
	}
	return `${pagePath.slice(0, dot)}.${tag}${pagePath.slice(dot)}`;
}
