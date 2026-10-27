// The mount: the host protocol, the page, the status strip, Read mode, and the two questions the surface asks.
//
// It knows the protocol and nothing of Tiptap; the engine is behind `editor.tsx`. The file is the source of truth in
// both directions: what arrives is Markdown and what leaves is Markdown, converted by `src/markdown.ts` — the same
// conversion the shipped `Temco Editor` saves with, so both editors write the same bytes for the same document.
//
// The second serialiser (`@tiptap/markdown`) is shown, never saved. It is the other half of the comparison: what the
// file would become if the module adopted Tiptap's own dialect.

import * as React from 'react';
import { createRoot } from 'react-dom/client';
import './surface.css';
import { toHtml, toMarkdown } from '../../src/markdown';
import { EMPTY, alternativeMarkdown, PageDocument, stateOf, usePrototypeDocument, type DocState } from './editor';

interface Host {
	postMessage(message: unknown): void;
}

declare function acquireVsCodeApi(): Host;

const host = acquireVsCodeApi();

/** How long an edit rests before the whole page is sent. Long enough to batch typing, short enough to feel saved. */
const SETTLE_MS = 400;

/** The document can arrive before there is an editor to put it in, so the answer waits here. */
type Inbound = { kind: 'set'; text: string; path: string };

/** What the two serialisers say about the page as it stands. */
interface Serializers {
	/** `src/markdown.ts` — the contract, and what the file is written with. */
	contract: string;
	/** `@tiptap/markdown` — Tiptap's own dialect, for comparison. */
	alternative: string;
}

const queue: Inbound[] = [];
const hands = new Set<(message: Inbound) => void>();

function read(message: unknown): Inbound | undefined {
	const data = message as { type?: unknown; text?: unknown; path?: unknown };
	if (data === null || typeof data !== 'object') {
		return undefined;
	}
	if (data.type === 'set' && typeof data.text === 'string') {
		return { kind: 'set', text: data.text, path: typeof data.path === 'string' ? data.path : '' };
	}
	return undefined;
}

window.addEventListener('message', event => {
	const message = read(event.data);
	if (message === undefined) {
		return;
	}
	if (hands.size === 0) {
		queue.push(message);
		return;
	}
	for (const hand of [...hands]) {
		hand(message);
	}
});

function Surface(): React.ReactElement {
	const [state, setState] = React.useState<DocState>(EMPTY);
	const [settled, setSettled] = React.useState(true);
	const [where, setWhere] = React.useState('');
	const [reading, setReading] = React.useState(false);
	const [serializers, setSerializers] = React.useState<Serializers | undefined>(undefined);
	const [comparing, setComparing] = React.useState(false);
	const [ask, setAsk] = React.useState<{ title: string; accept: (answer: string) => void } | undefined>(undefined);
	const [draft, setDraft] = React.useState('');

	const sending = React.useRef('');
	const applying = React.useRef(false);
	const timer = React.useRef<number | undefined>(undefined);

	/**
	 * The question a command asks before it edits.
	 *
	 * A webview frame is sandboxed without modals, so `window.prompt` returns `null` there and the command would silently
	 * do nothing. The surface draws the question itself.
	 */
	const onAsk = React.useCallback((title: string, value: string, accept: (answer: string) => void): void => {
		setDraft(value);
		setAsk({ title, accept });
	}, []);

	const acceptAsk = (answer: string): void => {
		const asked = ask;
		setAsk(undefined);
		asked?.accept(answer);
	};

	/** Both serialisers, read together: the panel is only honest if it describes the page as it is now. */
	const describe = React.useCallback((editor: Parameters<typeof stateOf>[0]): void => {
		const html = editor.getHTML();
		setSerializers({ contract: toMarkdown(html), alternative: alternativeMarkdown(editor) });
	}, []);

	const onChange = React.useCallback((editor: Parameters<typeof stateOf>[0]): void => {
		setState(stateOf(editor));
		if (applying.current) {
			return;
		}
		setSettled(false);
		describe(editor);
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
	}, [describe]);

	const editor = usePrototypeDocument({ onChange });

	React.useEffect(() => {
		if (editor === null) {
			return undefined;
		}
		const apply = (text: string): void => {
			if (text === sending.current) {
				return;
			}
			applying.current = true;
			sending.current = text;
			editor.commands.setContent(toHtml(text), { emitUpdate: false });
			applying.current = false;
			setState(stateOf(editor));
			setSettled(true);
			describe(editor);
		};
		const handle = (message: Inbound): void => {
			setWhere(message.path);
			apply(message.text);
		};
		for (const message of queue.splice(0)) {
			handle(message);
		}
		hands.add(handle);
		host.postMessage({ type: 'ready' });
		return () => {
			hands.delete(handle);
		};
	}, [editor, describe]);

	// The caret moves without the document changing, and every mark's on/off state is a question about the caret.
	React.useEffect(() => {
		if (editor === null) {
			return undefined;
		}
		const update = (): void => setState(stateOf(editor));
		editor.on('selectionUpdate', update);
		editor.on('transaction', update);
		return () => {
			editor.off('selectionUpdate', update);
			editor.off('transaction', update);
		};
	}, [editor]);

	if (editor === null) {
		return <div className="doc-surface doc-surface--empty">Opening the page…</div>;
	}

	const agree = serializers === undefined ? true : serializers.contract === serializers.alternative;

	return (
		<div className="doc-surface">
			<div className="doc-surface__head">
				<span className="doc-surface__where">{where}</span>
				<button
					type="button"
					className="doc-surface__link"
					aria-pressed={reading}
					title={reading ? 'Back to editing' : 'Read the page with no editing controls'}
					onClick={() => setReading(value => !value)}
				>
					{reading ? 'Edit the page' : 'Read the page'}
				</button>
				<span className="doc-surface__mode">Temco Editor Prototype · Tiptap 3.32</span>
			</div>

			<PageDocument
				editor={editor}
				state={state}
				onAsk={onAsk}
				reading={reading ? { html: editor.getHTML() } : false}
			/>

			<div className="doc-surface__status">
				<span>{state.words} words</span>
				<span className="doc-surface__dot" aria-hidden="true">·</span>
				<span>{state.characters} characters</span>
				<span className="doc-surface__dot" aria-hidden="true">·</span>
				<span
					className={agree ? 'badge badge--ok' : 'badge badge--warn'}
					title={agree
						? 'the two serialisers produce the same bytes for this page'
						: '@tiptap/markdown would write this page differently'}
				>
					{agree ? 'serialisers agree' : 'serialisers differ'}
				</span>
				<button
					type="button"
					className="doc-surface__link"
					disabled={serializers === undefined}
					onClick={() => setComparing(true)}
				>
					Compare serialisers
				</button>
				<span className="doc-surface__spacer" />
				<span className={settled ? 'badge badge--ok' : 'badge badge--warn'}>
					{settled ? 'saved in the document' : 'writing…'}
				</span>
			</div>

			{comparing && serializers !== undefined
				? (
					<div className="doc-surface__ask" role="dialog" aria-modal="true" aria-label="Compare the serialisers">
						<div className="doc-surface__ask-box doc-surface__ask-box--wide">
							<div className="doc-surface__ask-title">What this page would be, written two ways</div>
							<div className="doc-surface__compare">
								<section>
									<h4>marked + turndown <span>the contract — this is what is saved</span></h4>
									<pre className="doc-surface__code">{serializers.contract}</pre>
								</section>
								<section>
									<h4>@tiptap/markdown <span>Tiptap 3.32 — shown only, never saved</span></h4>
									<pre className="doc-surface__code">{serializers.alternative}</pre>
								</section>
							</div>
							<div className="doc-surface__ask-actions">
								<button type="button" className="doc-surface__btn doc-surface__btn--primary" onClick={() => setComparing(false)}>Close</button>
							</div>
						</div>
					</div>
				)
				: null}

			{ask !== undefined
				? (
					<div className="doc-surface__ask" role="dialog" aria-modal="true" aria-label={ask.title}>
						<div className="doc-surface__ask-box">
							<div className="doc-surface__ask-title">{ask.title}</div>
							<input
								className="doc-surface__input"
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
							<div className="doc-surface__ask-actions">
								<button type="button" className="doc-surface__btn" onClick={() => setAsk(undefined)}>Cancel</button>
								<button type="button" className="doc-surface__btn doc-surface__btn--primary" onClick={() => acceptAsk(draft)}>Use it</button>
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
