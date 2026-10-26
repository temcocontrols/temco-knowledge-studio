// One implementation of every Markdown formatting action.
//
// There are two editors in this extension and they must produce the *same bytes*: Monaco, behind the
// `temcoDocs.format.*` commands, and Temco Page's editor. A second copy of "what bold means" would drift
// the first time either side was touched, so the action lives here as a pure transform over a document string and a
// pair of offsets, and each editor only adapts its own idea of a selection to it.
//
// Deliberately no `vscode` import, and no DOM: a transform takes text and offsets and returns text and offsets, which
// is also what makes it testable without either editor (`npm run check-docs` drives a table of cases through it).

/** A document and the selection in it, as offsets into that document. */
export interface EditState {
	text: string;
	start: number;
	end: number;
}

/** The same document after the action, and where the selection belongs in it. */
export interface EditResult extends EditState { }

/** The heading levels the toolbar offers: a page's own title is the `#`. */
export const HEADINGS = [2, 3, 4];

/** Enough languages to cover the code in these pages, and no pretence of being a list of all of them. */
export const LANGUAGES = [
	'text',
	'bash',
	'powershell',
	'json',
	'yaml',
	'javascript',
	'typescript',
	'csharp',
	'cpp',
	'rust',
	'python',
	'sql',
	'ini',
	'mermaid',
	'plantuml',
];

/** The five DocFX renders, with the words its own documentation uses for them. */
export const CALLOUTS = [
	{ label: 'Note', detail: 'information to notice even when skimming' },
	{ label: 'Tip', detail: 'optional information that helps a reader succeed' },
	{ label: 'Important', detail: 'essential information' },
	{ label: 'Caution', detail: 'a negative consequence of an action' },
	{ label: 'Warning', detail: 'a dangerous consequence of an action' },
];

export const TABLE = ['|  |  |', '| --- | --- |', '|  |  |'].join('\n');
export const RULE = '---';

const FENCE = '```';
const ANY_HEADING = /^#{1,6} /;

function lineStart(text: string, offset: number): number {
	const at = text.lastIndexOf('\n', Math.max(0, offset - 1));
	return at === -1 ? 0 : at + 1;
}

function lineEnd(text: string, offset: number): number {
	const at = text.indexOf('\n', offset);
	return at === -1 ? text.length : at;
}

/**
 * The block of lines a selection touches, or the one line the caret is on.
 *
 * A block action is marks at the start of lines, so one selection becomes several list items — which is what selecting
 * three lines and pressing the list button means. Dragging to the start of the next line selects that line too as far
 * as the editor is concerned, and nobody who selected three lines meant four.
 */
function blockOf(state: EditState): { start: number; end: number; lines: string[] } {
	let end = state.end;
	if (end > state.start && end === lineStart(state.text, end)) {
		end -= 1;
	}
	const start = lineStart(state.text, state.start);
	const last = lineEnd(state.text, end);
	return { start, end: last, lines: state.text.slice(start, last).split('\n') };
}

/** Wraps the selection, or unwraps it — the toggle every editor's bold button is. */
export function toggleWrap(state: EditState, prefix: string, suffix = prefix): EditResult {
	const { text, start, end } = state;

	if (start === end) {
		// Nothing selected: the pair goes in and the caret goes between the halves, so the next word typed is the
		// bold one. That is what a person pressing the button with no selection is asking for.
		const inside = start + prefix.length;
		return { text: text.slice(0, start) + prefix + suffix + text.slice(start), start: inside, end: inside };
	}

	const selected = text.slice(start, end);
	if (selected.length >= prefix.length + suffix.length && selected.startsWith(prefix) && selected.endsWith(suffix)) {
		return {
			text: text.slice(0, start) + selected.slice(prefix.length, selected.length - suffix.length) + text.slice(end),
			start,
			end: end - prefix.length - suffix.length,
		};
	}

	// The cursor is inside a pair — `**bold**` with the word selected — so the marks are the thing to remove.
	if (text.slice(Math.max(0, start - prefix.length), start) === prefix && text.slice(end, end + suffix.length) === suffix) {
		return {
			text: text.slice(0, start - prefix.length) + selected + text.slice(end + suffix.length),
			start: start - prefix.length,
			end: end - prefix.length,
		};
	}

	return {
		text: text.slice(0, start) + prefix + selected + suffix + text.slice(end),
		start: start + prefix.length,
		end: end + prefix.length,
	};
}

/** Adds or removes a mark at the start of every selected line: the list, quote and task buttons. */
export function toggleLineMark(
	state: EditState,
	mark: (index: number) => string,
	pattern: RegExp
): EditResult {
	const block = blockOf(state);
	// Every line already carries it, so the button means "take it off" — press it twice and nothing has changed.
	const every = block.lines.every((line) => pattern.test(line));
	const body = block.lines
		.map((line, index) => (every ? line.replace(pattern, '') : mark(index) + line.replace(pattern, '')))
		.join('\n');
	return {
		text: state.text.slice(0, block.start) + body + state.text.slice(block.end),
		start: block.start,
		end: block.start + body.length,
	};
}

/** A heading at one level, or back to body text when the lines already carry that level. */
export function setHeading(state: EditState, level: number): EditResult {
	const mark = `${'#'.repeat(level)} `;
	const block = blockOf(state);
	const every = block.lines.every((line) => line.startsWith(mark));
	const body = block.lines.map((line) => (every ? line.replace(ANY_HEADING, '') : mark + line.replace(ANY_HEADING, ''))).join('\n');
	return {
		text: state.text.slice(0, block.start) + body + state.text.slice(block.end),
		start: block.start,
		end: block.start + body.length,
	};
}

/**
 * A block on its own line: a table, a rule, an image.
 *
 * The blank line is not decoration. `text` followed by `---` is a level-2 heading in Markdown, and a table glued to
 * the paragraph above it is a paragraph — so the one thing a block action must get right is the gap.
 */
export function insertBlock(state: EditState, block: string): EditResult {
	const { text } = state;
	const start = lineStart(text, state.start);
	const end = lineEnd(text, state.start);
	const blank = text.slice(start, end).trim() === '';
	const above = start === 0 ? '' : text.slice(lineStart(text, start - 1), start - 1);
	const gap = above.trim().length > 0;

	if (blank) {
		const insertion = `${gap ? '\n' : ''}${block}`;
		const at = start + insertion.length;
		return { text: text.slice(0, start) + insertion + text.slice(start), start: at, end: at };
	}
	const insertion = `\n\n${block}`;
	const at = end + insertion.length;
	return { text: text.slice(0, end) + insertion + text.slice(end), start: at, end: at };
}

export function insertCodeBlock(state: EditState, language: string): EditResult {
	const { text, start, end } = state;
	const open = language === 'text' || language === '' ? FENCE : FENCE + language;
	const selected = text.slice(start, end);

	if (selected.trim() === '') {
		// A fence owns its lines: mid-line it would glue the closing fence to the text after the cursor.
		const lead = start === lineStart(text, start) ? '' : '\n';
		const insertion = `${lead}${open}\n\n${FENCE}`;
		const inside = start + lead.length + open.length + 1;
		return { text: text.slice(0, start) + insertion + text.slice(start), start: inside, end: inside };
	}

	const body = selected.endsWith('\n') ? selected : `${selected}\n`;
	const lead = start === lineStart(text, start) ? '' : '\n';
	const insertion = `${lead}${open}\n${body}${FENCE}`;
	return {
		text: text.slice(0, start) + insertion + text.slice(end),
		start: start + insertion.length,
		end: start + insertion.length,
	};
}

export function insertCallout(state: EditState, label: string): EditResult {
	const { text, start, end } = state;
	const marker = `> [!${label.toUpperCase()}]`;
	const selected = text.slice(start, end);

	if (selected.trim() === '') {
		// `> [!NOTE]` is an alert only at the start of a line, so the marker gets one of its own.
		const lead = start === lineStart(text, start) ? '' : '\n';
		const insertion = `${lead}${marker}\n> `;
		const at = start + insertion.length;
		return { text: text.slice(0, start) + insertion + text.slice(start), start: at, end: at };
	}

	const body = selected
		.split('\n')
		.map((line) => (line.trim() === '' ? '>' : `> ${line}`))
		.join('\n');
	const insertion = `${marker}\n${body}`;
	return {
		text: text.slice(0, start) + insertion + text.slice(end),
		start: start + insertion.length,
		end: start + insertion.length,
	};
}

/** `[label](address)` over the selection, or the address as its own label when nothing is selected. */
export function insertLink(state: EditState, address: string, label?: string): EditResult {
	const { text, start, end } = state;
	const selected = text.slice(start, end);
	const shown = label ?? (selected.trim() === '' ? address : selected);
	const insertion = `[${shown}](${address})`;
	return {
		text: text.slice(0, start) + insertion + text.slice(end),
		start: start + insertion.length,
		end: start + insertion.length,
	};
}

/**
 * An image as its own paragraph, with the caption doubling as the alt text.
 *
 * One string on purpose: the preview renders it as `<figcaption>` and a screen reader reads it as the description, so
 * "every image has words" is satisfied by the same words rather than by two fields that can disagree. The caret lands
 * after the figure, where the sentence that explains the screenshot goes.
 */
export function insertImage(state: EditState, caption: string, address: string): EditResult {
	const alt = caption.replace(/[[\]]/g, '').trim();
	return insertBlock(state, `![${alt}](${address})`);
}

/** The page's own headings, read from its text, so it is right while a page is being written. */
export function headingsOf(text: string): { level: number; text: string; line: number }[] {
	const headings: { level: number; text: string; line: number }[] = [];
	let fenced = false;
	const lines = text.split('\n');
	for (let line = 0; line < lines.length; line += 1) {
		// A fence's contents are code: `#` in there is a comment, not a heading.
		if (/^\s*(```|~~~)/.test(lines[line])) {
			fenced = !fenced;
			continue;
		}
		if (fenced) {
			continue;
		}
		const heading = /^(#{1,6})\s+(.*)$/.exec(lines[line]);
		if (heading !== null) {
			headings.push({ level: heading[1].length, text: heading[2].trim(), line });
		}
	}
	return headings;
}

/** The offset of a line's first character. */
export function offsetOfLine(text: string, line: number): number {
	let offset = 0;
	for (let index = 0; index < line; index += 1) {
		const next = text.indexOf('\n', offset);
		if (next === -1) {
			return text.length;
		}
		offset = next + 1;
	}
	return offset;
}

const LIST_MARK = /^(\s*)([-*+]|\d+[.)])(\s+)(\[[ xX]\]\s+)?/;

/**
 * Enter inside a list continues it; Enter on an empty item ends it.
 *
 * The alternative — every item typed from scratch — is the single most repeated thing a person does in a page of
 * instructions, and it is the one place where a plain `<textarea>` is visibly worse than the editor it replaced.
 */
export function continueList(state: EditState): EditResult {
	const start = lineStart(state.text, state.start);
	const line = state.text.slice(start, lineEnd(state.text, state.start));
	const marker = LIST_MARK.exec(line);

	if (marker === null) {
		// Not a list: an ordinary newline, with any leading whitespace carried over so a nested list stays nested.
		const indent = /^\s*/.exec(line)?.[0] ?? '';
		const insertion = `\n${indent}`;
		const at = state.start + insertion.length;
		return {
			text: state.text.slice(0, state.start) + insertion + state.text.slice(state.end),
			start: at,
			end: at,
		};
	}

	const [, indent, bullet, space, task] = marker;
	const body = line.slice(marker[0].length);

	if (body.trim() === '') {
		// An empty item is the way out: the marker goes, and the line stays where it is.
		const cleared = `${indent}\n`;
		const from = start;
		const to = lineEnd(state.text, state.start);
		const at = start + indent.length;
		return {
			text: state.text.slice(0, from) + cleared + state.text.slice(to + 1),
			start: at,
			end: at,
		};
	}

	const next = /^\d+[.)]$/.test(bullet)
		? `${String(Number.parseInt(bullet, 10) + 1)}${bullet.slice(-1)}`
		: bullet;
	const insertion = `\n${indent}${next}${space}${task ?? ''}`;
	const at = state.start + insertion.length;
	return {
		text: state.text.slice(0, state.start) + insertion + state.text.slice(state.end),
		start: at,
		end: at,
	};
}

/** Moves every selected line in or out by one step — `Tab` and `Shift+Tab` on a list. */
export function indentLines(state: EditState, outwards: boolean): EditResult {
	const block = blockOf(state);
	const step = '  ';
	const body = block.lines
		.map((line) => (outwards ? step + line : line.replace(/^ {1,2}/, '')))
		.join('\n');
	return {
		text: state.text.slice(0, block.start) + body + state.text.slice(block.end),
		start: block.start,
		end: block.start + body.length,
	};
}

/** One place a search matched, as offsets into the document. */
export interface Match {
	start: number;
	end: number;
}

/**
 * Every place a query matches, literally or as a pattern.
 *
 * A pattern that does not compile returns an error rather than falling back to a literal search: quietly searching for
 * `(` when the person typed `(` as a pattern would look like the page has no such text.
 */
export function findMatches(
	text: string,
	query: string,
	pattern: boolean
): { matches: Match[]; error?: string } {
	if (query === '') {
		return { matches: [] };
	}
	const expression = pattern ? compile(query) : undefined;
	if (pattern && expression === undefined) {
		return { matches: [], error: 'That pattern is not valid.' };
	}
	if (expression !== undefined) {
		const matches: Match[] = [];
		expression.lastIndex = 0;
		for (let found = expression.exec(text); found !== null && matches.length < 10000; found = expression.exec(text)) {
			if (found[0] === '') {
				expression.lastIndex += 1;
				continue;
			}
			matches.push({ start: found.index, end: found.index + found[0].length });
		}
		return { matches };
	}
	const matches: Match[] = [];
	const needle = query.toLowerCase();
	const haystack = text.toLowerCase();
	for (let at = haystack.indexOf(needle); at !== -1 && matches.length < 10000; at = haystack.indexOf(needle, at + needle.length)) {
		matches.push({ start: at, end: at + needle.length });
	}
	return { matches };
}

function compile(source: string): RegExp | undefined {
	try {
		return new RegExp(source, 'gi');
	} catch {
		return undefined;
	}
}

/** Every match replaced at once, in one pass, so a replacement cannot be searched again. */
export function replaceAll(
	text: string,
	matches: readonly Match[],
	replacement: string
): EditResult {
	if (matches.length === 0) {
		return { text, start: 0, end: 0 };
	}
	let result = '';
	let cursor = 0;
	for (const match of matches) {
		result += text.slice(cursor, match.start) + replacement;
		cursor = match.end;
	}
	result += text.slice(cursor);
	const first = matches[0].start;
	return { text: result, start: first + replacement.length, end: first + replacement.length };
}
