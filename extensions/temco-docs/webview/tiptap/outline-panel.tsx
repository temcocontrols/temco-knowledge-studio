// The outline panel: the page's headings, beside the page.
//
// It lives inside the editor tab rather than in the sidebar, because an outline describes *this document*, not the tree
// of files. Three behaviours make it worth the width:
//
//   * clicking a heading moves the caret there and scrolls it into view;
//   * the row for the section you are reading highlights as the caret moves (scroll-spy, driven by editor state rather
//     than by the scroll position, so it stays right when the text is taller than the window);
//   * it collapses to a rail of dots, one per `#`/`##`, so a narrow window keeps a sense of the page for 3rem.
//
// Nothing here writes to the document: it is a view over `editor.state.doc`.

import { useMemo, useState } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';

/** One heading in the page. */
interface Heading {
	readonly level: number;
	readonly text: string;
	/** Document position of the heading's first character — what a click selects. */
	readonly position: number;
	/** Nesting depth, so `###` under `##` indents rather than starting a new top-level row. */
	readonly depth: number;
}

/** The headings of the document, in order, with their nesting resolved. */
function headingsOf(editor: Editor | null): Heading[] {
	if (editor === null) {
		return [];
	}
	const found: { level: number; text: string; position: number }[] = [];
	editor.state.doc.descendants((node, position) => {
		if (node.type.name === 'heading') {
			found.push({ level: Number(node.attrs.level ?? 1), text: node.textContent, position: position + 1 });
		}
		return undefined;
	});

	// Depth is relative to the headings actually present: a page that starts at `##` should not be indented.
	let shallowest = 6;
	let previous = 0;
	return found.map((heading) => {
		shallowest = Math.min(shallowest, heading.level);
		previous = heading.level;
		void previous;
		const depth = Math.min(Math.max(heading.level - shallowest, 0), 3);
		return { ...heading, depth };
	});
}

/** Which heading the caret is inside, or -1 before the first one. */
function activeIndex(headings: readonly Heading[], caret: number): number {
	let found = -1;
	for (let index = 0; index < headings.length; index++) {
		if (headings[index].position <= caret) {
			found = index;
		}
	}
	return found;
}

export interface OutlinePanelProps {
	editor: Editor | null;
	open: boolean;
	onClose: () => void;
}

export function OutlinePanel({ editor, open, onClose }: OutlinePanelProps) {
	const [rail, setRail] = useState(false);

	const headings = useEditorState({
		editor,
		selector: ({ editor: current }) => headingsOf(current),
	}) ?? [];

	const caret = useEditorState({
		editor,
		selector: ({ editor: current }) => current?.state.selection.head ?? 0,
	}) ?? 0;

	const active = useMemo(() => activeIndex(headings, caret), [headings, caret]);
	const words = useEditorState({
		editor,
		selector: ({ editor: current }) => {
			const text = current?.state.doc.textBetween(0, current.state.doc.content.size, ' ', ' ') ?? '';
			return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
		},
	}) ?? 0;

	if (!open) {
		return null;
	}

	const go = (position: number): void => {
		editor?.chain().focus().setTextSelection(position).scrollIntoView().run();
	};

	if (rail) {
		return (
			<nav className="temco-outline temco-outline--rail" aria-label="Outline">
				<button
					type="button"
					className="temco-outline__toggle"
					title="Widen the outline"
					aria-label="Widen the outline"
					onClick={() => setRail(false)}
				>
					›
				</button>
				{headings.map((heading, index) => (
					<button
						key={`${heading.position}-${index}`}
						type="button"
						className={`temco-outline__dot${index === active ? ' is-active' : ''}${heading.level <= 2 ? ' is-major' : ''}`}
						title={heading.text}
						aria-label={heading.text}
						onClick={() => go(heading.position)}
					/>
				))}
			</nav>
		);
	}

	return (
		<nav className="temco-outline" aria-label="Outline">
			<div className="temco-outline__head">
				<span className="temco-outline__title">Outline</span>
				<button
					type="button"
					className="temco-outline__toggle"
					title="Narrow the outline"
					aria-label="Narrow the outline"
					onClick={() => setRail(true)}
				>
					‹
				</button>
				<button
					type="button"
					className="temco-outline__toggle"
					title="Hide the outline"
					aria-label="Hide the outline"
					onClick={onClose}
				>
					✕
				</button>
			</div>

			<div className="temco-outline__list">
				{headings.length === 0 ? (
					<p className="temco-outline__note">This page has no headings yet.</p>
				) : (
					headings.map((heading, index) => (
						<button
							key={`${heading.position}-${index}`}
							type="button"
							className={`temco-outline__row temco-outline__row--h${heading.level}${index === active ? ' is-active' : ''}`}
							style={{ paddingLeft: `${0.55 + heading.depth * 0.7}rem` }}
							title={heading.text}
							onClick={() => go(heading.position)}
						>
							{heading.text}
						</button>
					))
				)}
			</div>

			<div className="temco-outline__foot">
				{words.toLocaleString()} {words === 1 ? 'word' : 'words'} · {Math.max(1, Math.round(words / 200))} min
			</div>
		</nav>
	);
}
