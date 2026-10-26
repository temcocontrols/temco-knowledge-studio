// The mount: how a page gets here, how it leaves, and the few things around the bar that are not the bar.
//
// It knows no Tiptap and no command names. It knows the host protocol (`ready`, `set`, `change`, the five actions), it
// holds the tab that is open, and it draws the document, the find bar and the outline rail. The engine is behind
// `document.tsx`; the bar is behind `ribbon.tsx`.
//
// The file is the source of truth: what arrives is Markdown, what leaves is Markdown, and the round trip is
// `src/pageMarkdown.ts` with `scripts/check-page.mts` as its proof.

import * as React from 'react';
import { createRoot } from 'react-dom/client';

import '../../../temco-ui/media/page.css';
import '../shared/surface-controls.css';
import './page-surface.css';
import { AnnotateDialog } from '../shared/annotate';
import { FindBar } from '../shared/find';
import { OutlineList } from '../shared/outline';
import { toHtml, toMarkdown } from '../../src/pageMarkdown';
import { actionsFor, headingsIn, matchesIn, stateOf, usePageDocument, type Match, type PageActions, type PageState } from './document';
import { staticNode } from './reading';
import { PageRibbon, type Tab } from './ribbon';

interface Host {
	postMessage(message: unknown): void;
}

declare function acquireVsCodeApi(): Host;

const host = acquireVsCodeApi();

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
	| { kind: 'pageLink'; title: string; address: string };

const queue: Inbound[] = [];
const hands = new Set<(message: Inbound) => void>();

/** What the host said, in the one shape this file has to know about. Unknown messages are dropped, not guessed at. */
function read(message: unknown): Inbound | undefined {
	const data = message as { type?: unknown; text?: unknown; src?: unknown; alt?: unknown; askForCaption?: unknown; title?: unknown; address?: unknown };
	if (data === null || typeof data !== 'object') {
		return undefined;
	}
	if (data.type === 'set' && typeof data.text === 'string') {
		return { kind: 'set', text: data.text };
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
};

function Surface(): React.ReactElement {
	const [state, setState] = React.useState<PageState>(EMPTY);
	const [settled, setSettled] = React.useState(true);
	const [tab, setTab] = React.useState<Tab>('home');
	const [zoom, setZoom] = React.useState(100);
	const [finding, setFinding] = React.useState(false);
	const [query, setQuery] = React.useState('');
	const [found, setFound] = React.useState<Match[]>([]);
	const [at, setAt] = React.useState(0);
	const [outlining, setOutlining] = React.useState(false);
	const [headings, setHeadings] = React.useState<Array<{ level: number; text: string; at: number }>>([]);
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
		return () => {
			editor.off('transaction', refresh);
		};
	}, [editor, query]);

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
				tab={tab}
				onTab={setTab}
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
						<aside className="page-surface__outline" aria-label="Page outline">
							<OutlineList headings={headings} onGo={position => actions.goto(position + 1)} />
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
	createRoot(root).render(<Surface />);
}
