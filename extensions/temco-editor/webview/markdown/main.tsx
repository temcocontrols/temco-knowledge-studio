// The mount: how a page gets here, how it leaves, and the few things around the bar that are not the bar.
//
// It knows no Tiptap and no command names. It knows the host protocol (`ready`, `set`, `change`, the five actions), it
// holds the surface's own state, and it draws the document, the find bar and the outline rail. The engine is behind
// `engine/tiptap`; the surface's own vocabulary is `./contract`; the bar is behind `./ribbon`.
//
// The file is the source of truth: what arrives is Markdown, what leaves is Markdown, and the round trip is
// `src/markdown.ts` with `scripts/check-page.mts` as its proof.

import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { FluentProvider } from '@fluentui/react-components';

import './chrome.css';
import '../shared/surface-controls.css';
import './surface.css';
import { AnnotateDialog } from '../shared/annotate';
import { FindBar } from '../shared/find';
import { OutlineList } from '../shared/outline';
import { fluentTheme } from '../shared/theme';
import { Dismiss16Regular } from '@fluentui/react-icons';
import { OUTLINE_WHEN, type HeadingAt } from '../../src/outlineModel';
import { toHtml, toMarkdown } from '../../src/markdown';
import type { Match, PageActions, PageState } from './contract';
import { actionsFor, headingsIn, matchesIn, stateOf, usePageDocument } from './engine/tiptap';
import { staticNode } from './reading';
import { PageRibbon } from './ribbon';

interface Host {
	postMessage(message: unknown): void;
	/** The webview's own storage: what the surface remembers about itself, never about the file. */
	getState?(): unknown;
	setState?(state: unknown): void;
}

declare function acquireVsCodeApi(): Host;

const host = acquireVsCodeApi();

/**
 * What this surface remembers about itself between being hidden and shown again. Never the document.
 *
 * `outline: undefined` is the difference between "never asked" and "asked, and closed": a page with a table of contents
 * opens its rail the first time, and stays shut for someone who closed it.
 */
const saved = (host.getState?.() ?? {}) as { outline?: boolean; collapsed?: string[]; width?: number };

/** The narrowest and widest the rail may be dragged to, and the step the arrow keys move it by. */
const RAIL_MIN = 180;
const RAIL_MAX = 560;
const RAIL_STEP = 16;

/** How long an edit rests before the whole page is sent. Long enough to batch typing, short enough to feel saved. */
const SETTLE_MS = 400;

/**
 * The document can arrive before there is an editor to put it in: the host answers `ready` at once, and Tiptap creates
 * its editor on its own schedule. The answer is held here until the surface can accept it — dropping it opens a blank
 * page, which a person cannot tell apart from an empty file.
 *
 * The same queue carries the three things the host sends that are not the document: a picture that has landed beside the
 * page, a screenshot waiting for the words that describe it, and a link to another page.
 */
type Inbound =
	| { kind: 'set'; text: string }
	| { kind: 'image'; src: string; alt: string; askForCaption: boolean }
	| { kind: 'captureReady' }
	| { kind: 'pageLink'; title: string; address: string }
	| { kind: 'fontSize'; value: number };

const queue: Inbound[] = [];
const hands = new Set<(message: Inbound) => void>();

/** What the host said, in the one shape this file has to know about. Unknown messages are dropped, not guessed at. */
function read(message: unknown): Inbound | undefined {
	const data = message as { type?: unknown; text?: unknown; src?: unknown; alt?: unknown; askForCaption?: unknown; title?: unknown; address?: unknown; value?: unknown };
	if (data === null || typeof data !== 'object') {
		return undefined;
	}
	if (data.type === 'set' && typeof data.text === 'string') {
		return { kind: 'set', text: data.text };
	}
	// The page's size is a setting: one variable, set below, so the reader keeps their place when it changes.
	if (data.type === 'fontSize' && typeof data.value === 'number') {
		return { kind: 'fontSize', value: data.value };
	}
	if (data.type === 'image' && typeof data.src === 'string') {
		return {
			kind: 'image',
			src: data.src,
			alt: typeof data.alt === 'string' ? data.alt : '',
			askForCaption: data.askForCaption === true,
		};
	}
	if (data.type === 'captureReady') {
		return { kind: 'captureReady' };
	}
	if (data.type === 'pageLink' && typeof data.address === 'string') {
		return { kind: 'pageLink', title: typeof data.title === 'string' ? data.title : data.address, address: data.address };
	}
	return undefined;
}

window.addEventListener('message', event => {
	const message = read(event.data);
	if (message === undefined) {
		return;
	}
	// A size change is not the document: it is answered here, whatever the editor is doing.
	if (message.kind === 'fontSize') {
		document.documentElement.style.setProperty('--page-font-size', `${message.value}px`);
		return;
	}
	// Every hand hears it; a hand stays registered, because the next `set` is another edit.
	if (hands.size === 0) {
		queue.push(message);
		return;
	}
	for (const hand of [...hands]) {
		hand(message);
	}
});

/** The state a page has before the engine has said anything: nothing marked, nothing to undo. */
const EMPTY: PageState = {
	block: 0,
	marks: { bold: false, italic: false, underline: false, strike: false, code: false, highlight: false },
	lists: { bullet: false, ordered: false, task: false },
	inTable: false,
	onImage: false,
	link: undefined,
	canUndo: false,
	canRedo: false,
	words: 0,
	cursor: 0,
};

function Surface(): React.ReactElement {
	const [state, setState] = React.useState<PageState>(EMPTY);
	const [settled, setSettled] = React.useState(true);
	const [zoom, setZoom] = React.useState(100);
	const [finding, setFinding] = React.useState(false);
	const [query, setQuery] = React.useState('');
	const [found, setFound] = React.useState<Match[]>([]);
	const [at, setAt] = React.useState(0);
	// The rail, and what it remembers. The page owns the fold state so that hiding and showing the tab keeps it.
	const [outlining, setOutlining] = React.useState(saved.outline ?? false);
	const [folded, setFolded] = React.useState<readonly string[]>(saved.collapsed ?? []);
	const [railWidth, setRailWidth] = React.useState(saved.width ?? 300);
	const [headings, setHeadings] = React.useState<HeadingAt[]>([]);
	const [annotating, setAnnotating] = React.useState<string | undefined>(undefined);
	const [ask, setAsk] = React.useState<{ title: string; accept: (answer: string) => void } | undefined>(undefined);
	const [draft, setDraft] = React.useState('');
	/**
	 * Read mode: the same page through a second engine that cannot edit (`reading.tsx`). The markup is captured on the way
	 * in, so leaving the mode gets the editor back exactly where it was.
	 */
	const [reading, setReading] = React.useState(false);
	const [staticHtml, setStaticHtml] = React.useState('');

	const sending = React.useRef('');
	const applying = React.useRef(false);
	const timer = React.useRef<number | undefined>(undefined);
	/** The image a landed annotation replaces, so the picture is annotated rather than duplicated beside it. */
	const replacing = React.useRef<number | null>(null);

	/**
	 * The question a command asks before it edits. A webview frame is sandboxed without modals, so `window.prompt`
	 * returns `null` there and the command would silently do nothing.
	 */
	const askFor = React.useCallback((title: string, value: string, accept: (answer: string) => void): void => {
		setDraft(value);
		setAsk({ title, accept });
	}, []);
	const acceptAsk = (answer: string): void => {
		const asked = ask;
		setAsk(undefined);
		asked?.accept(answer);
	};

	const onChange = React.useCallback((editor: Parameters<typeof stateOf>[0]): void => {
		setState(stateOf(editor));
		if (applying.current) {
			return;
		}
		setSettled(false);
		const html = editor.getHTML();
		window.clearTimeout(timer.current);
		timer.current = window.setTimeout(() => {
			const markdown = toMarkdown(html);
			if (markdown !== sending.current) {
				sending.current = markdown;
				host.postMessage({ type: 'change', text: markdown });
			}
			setSettled(true);
		}, SETTLE_MS);
	}, []);

	const onPasteImage = React.useCallback((file: File): void => {
		const reader = new FileReader();
		reader.onload = () => {
			const data = String(reader.result).split(',')[1];
			if (data === undefined || data === '') {
				return;
			}
			askFor('What does the screenshot show?', '', caption => {
				host.postMessage({ type: 'action', action: 'pastedImage', name: file.name || 'paste.png', data, caption });
			});
		};
		reader.readAsDataURL(file);
	}, [askFor]);

	const editor = usePageDocument({ onChange, onPasteImage });
	// One facade per editor instance: it is a dependency of the message effect, so a new object on every render would take
	// the host's hand off the conversation and put it back on the next one.
	const actions: PageActions | undefined = React.useMemo(
		() => (editor === null ? undefined : actionsFor(editor)),
		[editor]
	);

	// The document arrived, or the host handed us something that lands on it.
	React.useEffect(() => {
		if (editor === null || actions === undefined) {
			return undefined;
		}
		const apply = (text: string): void => {
			if (text === sending.current) {
				return;
			}
			applying.current = true;
			sending.current = text;
			actions.load(toHtml(text));
			applying.current = false;
			setState(stateOf(editor));
			setSettled(true);
		};
		const handle = (message: Inbound): void => {
			if (message.kind === 'set') {
				apply(message.text);
				return;
			}
			if (message.kind === 'image') {
				const swapping = replacing.current;
				replacing.current = null;
				const place = (words: string): void => {
					const alt = words || message.alt;
					if (swapping !== null && actions.replaceImage(swapping, message.src, alt)) {
						return;
					}
					actions.insertImage(message.src, alt);
				};
				if (!message.askForCaption) {
					place(message.alt);
					return;
				}
				askFor('What does the picture show?', '', words => {
					place(words);
					host.postMessage({ type: 'action', action: 'caption', src: message.src, caption: words });
				});
				return;
			}
			if (message.kind === 'pageLink') {
				actions.insertLinkText(message.title, message.address);
				return;
			}
			// A screenshot is taken before its caption is asked for, so the screen behind the window is the one
			// photographed. It lands as soon as the words are given.
			askFor('What does the screenshot show?', '', caption => {
				host.postMessage({ type: 'action', action: 'commitCapture', caption });
			});
		};
		for (const message of queue.splice(0)) {
			handle(message);
		}
		hands.add(handle);
		host.postMessage({ type: 'ready' });
		return () => {
			hands.delete(handle);
		};
	}, [editor, actions, askFor]);

	// The outline and the match count are read from the document as it changes, so neither can fall behind the page.
	// `transaction` rather than `update`: a document replaced from outside is applied with `emitUpdate: false`, and an
	// outline that only listened to typing would still describe the page as it was.
	React.useEffect(() => {
		if (editor === null) {
			return undefined;
		}
		setHeadings(headingsIn(editor));
		setFound(matchesIn(editor, query));
		const refresh = (payload: { transaction: { docChanged: boolean } }): void => {
			if (!payload.transaction.docChanged) {
				return;
			}
			setHeadings(headingsIn(editor));
			setFound(matchesIn(editor, query));
		};
		editor.on('transaction', refresh);
		// The caret moves without the document changing, and "which section am I in" is a question about the caret.
		const moved = (): void => setState(stateOf(editor));
		editor.on('selectionUpdate', moved);
		return () => {
			editor.off('transaction', refresh);
			editor.off('selectionUpdate', moved);
		};
	}, [editor, query]);

	/**
	 * The rail is a preference, not a document property: whether it is open, what is folded in it and how wide it is are
	 * remembered in the webview's own state, never written to the file.
	 */
	const remember = (next: { outline: boolean; collapsed: readonly string[]; width: number }): void => {
		host.setState?.(next);
	};

	const setOutline = React.useCallback((open: boolean): void => {
		setOutlining(open);
		remember({ outline: open, collapsed: folded, width: railWidth });
	}, [folded, railWidth]);

	const fold = (key: string): void => {
		const next = folded.includes(key) ? folded.filter(entry => entry !== key) : [...folded, key];
		setFolded(next);
		remember({ outline: outlining, collapsed: next, width: railWidth });
	};

	/** How wide the rail may be: clamped here so the drag, the arrow keys and a restored value all obey the same limits. */
	const widthWithin = (width: number): number => Math.min(Math.max(Math.round(width), RAIL_MIN), RAIL_MAX);

	/**
	 * The width during a drag.
	 *
	 * A pointerup can arrive in the same batch as the last pointermove, so the handler's own `railWidth` may be one event
	 * behind; the ref is what the drag and its release both read.
	 */
	const liveWidth = React.useRef(railWidth);
	const drag = React.useRef<{ at: number; from: number } | undefined>(undefined);

	const resizeTo = (width: number): void => {
		liveWidth.current = widthWithin(width);
		setRailWidth(liveWidth.current);
	};

	// A table of contents is only furniture until there is a page to navigate: the rail opens itself once, for a page that
	// has three or more headings, and never again for someone who closed it.
	const asked = React.useRef(saved.outline !== undefined);
	React.useEffect(() => {
		if (asked.current || headings.length < OUTLINE_WHEN) {
			return;
		}
		asked.current = true;
		setOutlining(true);
	}, [headings.length]);

	/**
	 * The keys that are about the shell rather than the document: `Ctrl+F` for find, `Ctrl+Alt+O` for the rail, `Escape`
	 * to close find.
	 *
	 * They are handled here rather than as host commands because both are the webview's own state — a command would have to
	 * be published, bound and posted back to do what this does directly. `Ctrl+F` has no fallback in a custom editor: there
	 * is no text editor for VS Code's own find to open on, so without this the bar taught a key that did nothing.
	 */
	React.useEffect(() => {
		const onKey = (event: KeyboardEvent): void => {
			if (event.ctrlKey && event.altKey && !event.shiftKey && event.code === 'KeyO') {
				event.preventDefault();
				setOutline(!outlining);
				return;
			}
			if (event.ctrlKey && !event.altKey && !event.shiftKey && event.code === 'KeyF') {
				event.preventDefault();
				if (finding) {
					// Already open: the key re-selects the query rather than doing nothing.
					document.querySelector<HTMLInputElement>('.find__query')?.select();
					return;
				}
				setFinding(true);
				return;
			}
			// Escape closes find, but not while a question is on screen — that dialog owns its own Escape.
			if (event.key === 'Escape' && finding && ask === undefined) {
				event.preventDefault();
				setFinding(false);
				setQuery('');
				setFound([]);
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [outlining, setOutline, finding, ask]);

	if (editor === null || actions === undefined) {
		return <div className="page-surface page-surface--empty">Opening the page…</div>;
	}

	const gotoMatch = (backwards: boolean): void => {
		if (found.length === 0) {
			return;
		}
		const next = (at + (backwards ? found.length - 1 : 1)) % found.length;
		setAt(next);
		const range = found[next];
		actions.goto(range.from, range.to);
	};

	/**
	 * A jump from the outline.
	 *
	 * In Read mode there is no editor to put a caret in, so the jump is a scroll to the same heading in the markup — the
	 * headings are in document order in both, which is what makes the index line up.
	 */
	const gotoHeading = (position: number): void => {
		if (!reading) {
			actions.goto(position + 1);
			return;
		}
		const index = headings.findIndex(heading => heading.at === position);
		document.querySelectorAll('.page-surface__doc--reading :is(h1, h2, h3, h4)')[index]?.scrollIntoView({ block: 'start', behavior: 'smooth' });
	};

	const startAnnotating = (): void => {
		const src = editor.getAttributes('image').src;
		if (typeof src !== 'string' || src === '') {
			return;
		}
		replacing.current = actions.selectionStart();
		setAnnotating(src);
	};

	/** Read mode: freeze what is on the page, and hand the shell an engine that can only show it. */
	const toggleReading = (): void => {
		if (!reading) {
			setStaticHtml(actions.content());
			setReading(true);
			return;
		}
		setReading(false);
	};

	return (
		<div className="page-surface">
			<PageRibbon
				state={state}
				actions={actions}
				finding={finding}
				outlining={outlining}
				reading={reading}
				onReading={toggleReading}
				onFind={() => setFinding(value => !value)}
				onOutline={() => setOutlining(value => !value)}
				onHostAction={action => host.postMessage({ type: 'action', action })}
				onAnnotate={startAnnotating}
			/>

			{finding
				? (
					<div className="page-surface__find">
						<FindBar
							query={query}
							position={found.length === 0 ? 0 : at + 1}
							total={found.length}
							onQuery={value => {
								setQuery(value);
								setAt(0);
							}}
							onNext={gotoMatch}
							onClose={() => {
								setFinding(false);
								setQuery('');
								setFound([]);
							}}
						/>
					</div>
				)
				: null}

			<div className="page-surface__body">
				<div className="page-surface__canvas">
					<div className="page-surface__paper" style={{ zoom: zoom / 100 }}>
						{reading ? staticNode(staticHtml) : actions.node()}
					</div>
				</div>
				{outlining
					? (
						<aside
							className="page-surface__outline"
							aria-label="Page outline"
							style={{ flexBasis: railWidth, width: railWidth, minWidth: railWidth, maxWidth: railWidth }}
						>
							{/* A real handle, not a hint: the rail is on the left, so dragging the edge right makes it wider and dragging it
							    left gives the page the room back. The arrow keys move it too, so a keyboard can set the width without a
							    mouse. */}
							<div
								className="page-surface__outline-grip"
								role="separator"
								aria-orientation="vertical"
								aria-label="Resize the outline"
								aria-valuemin={RAIL_MIN}
								aria-valuemax={RAIL_MAX}
								aria-valuenow={railWidth}
								tabIndex={0}
								title="Drag to resize the outline"
								onPointerDown={event => {
									event.preventDefault();
									event.currentTarget.setPointerCapture(event.pointerId);
									drag.current = { at: event.clientX, from: liveWidth.current };
								}}
								onPointerMove={event => {
									const held = drag.current;
									if (held === undefined) {
										return;
									}
									resizeTo(held.from + (event.clientX - held.at));
								}}
								onPointerUp={event => {
									if (drag.current === undefined) {
										return;
									}
									drag.current = undefined;
									event.currentTarget.releasePointerCapture(event.pointerId);
									remember({ outline: outlining, collapsed: folded, width: liveWidth.current });
								}}
								onKeyDown={event => {
									const step = event.key === 'ArrowRight' ? RAIL_STEP : event.key === 'ArrowLeft' ? -RAIL_STEP : 0;
									if (step === 0) {
										return;
									}
									event.preventDefault();
									resizeTo(liveWidth.current + step);
									remember({ outline: outlining, collapsed: folded, width: liveWidth.current });
								}}
							/>
							<div className="page-surface__outline-head">
								<span className="page-surface__outline-title">Outline</span>
								<span className="page-surface__outline-count">{headings.length}</span>
								<button
									type="button"
									className="btn btn--sm btn--ghost btn--icon page-surface__outline-close"
									aria-label="Close the outline"
									title="Close the outline (Ctrl+Alt+O)"
									onClick={() => setOutline(false)}
								>
									<Dismiss16Regular />
								</button>
							</div>
							<OutlineList
								headings={headings}
								// Read mode has no caret, so there is no section to mark as current.
								cursor={reading ? undefined : state.cursor}
								collapsed={new Set(folded)}
								onCollapse={fold}
								onGo={gotoHeading}
							/>
						</aside>
					)
					: null}
			</div>

			<div className="md-editor__status">
				<span>{state.words} words</span>
				<span className={settled ? 'badge badge--ok' : 'badge badge--warn'}>
					{settled ? 'saved in the document' : 'writing…'}
				</span>
				<span className="statusbar__spacer" />
				{state.inTable
					? (
						<span className="page-surface__table">
							<button type="button" className="btn btn--sm btn--ghost" aria-label="Add row" onClick={actions.addRow}>Add row</button>
							<button type="button" className="btn btn--sm btn--ghost" aria-label="Add column" onClick={actions.addColumn}>Add column</button>
							<button type="button" className="btn btn--sm btn--ghost" aria-label="Delete row" onClick={actions.deleteRow}>Delete row</button>
							<button type="button" className="btn btn--sm btn--ghost" aria-label="Delete column" onClick={actions.deleteColumn}>Delete column</button>
							<button type="button" className="btn btn--sm btn--ghost" aria-label="Delete table" onClick={actions.deleteTable}>Delete table</button>
						</span>
					)
					: null}
				<span className="page-surface__zoom">
					<button type="button" className="btn btn--sm btn--ghost" aria-label="Zoom out" onClick={() => setZoom(value => Math.max(70, value - 10))}>−</button>
					<span className="page-surface__zoom-value" aria-live="polite">{zoom}%</span>
					<button type="button" className="btn btn--sm btn--ghost" aria-label="Zoom in" onClick={() => setZoom(value => Math.min(160, value + 10))}>+</button>
				</span>
			</div>

			{annotating !== undefined
				? (
					<AnnotateDialog
						open
						src={annotating}
						caption=""
						onClose={() => {
							replacing.current = null;
							setAnnotating(undefined);
						}}
						onInsert={(png: string) => {
							setAnnotating(undefined);
							const data = png.split(',')[1];
							if (data !== undefined && data !== '') {
								host.postMessage({ type: 'action', action: 'pastedImage', name: 'annotated.png', data, caption: draft });
							}
						}}
					/>
				)
				: null}

			{ask !== undefined
				? (
					<div className="page-surface__ask" role="dialog" aria-modal="true" aria-label={ask.title}>
						<div className="page-surface__ask-box">
							<div className="page-surface__ask-title">{ask.title}</div>
							<input
								className="input"
								value={draft}
								aria-label={ask.title}
								autoFocus
								onChange={event => setDraft(event.target.value)}
								onKeyDown={event => {
									if (event.key === 'Enter') {
										event.preventDefault();
										acceptAsk(draft);
									}
									if (event.key === 'Escape') {
										event.preventDefault();
										setAsk(undefined);
									}
								}}
							/>
							<div className="page-surface__ask-actions">
								<button type="button" className="btn btn--sm" onClick={() => setAsk(undefined)}>Cancel</button>
								<button type="button" className="btn btn--sm btn--primary" onClick={() => acceptAsk(draft)}>Use these words</button>
							</div>
						</div>
					</div>
				)
				: null}
		</div>
	);
}

const root = document.getElementById('root');
if (root !== null) {
	// Only the annotator is Fluent, and Fluent components read their palette from a provider. `.page-fluent` undoes the
	// provider's own background so the page keeps the editor's, and gives the box the height `#root` has.
	createRoot(root).render(
		<FluentProvider className="page-fluent" theme={fluentTheme()}>
			<Surface />
		</FluentProvider>
	);
}
