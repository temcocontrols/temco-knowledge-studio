// A surface's own outline, as a jump list.
//
// The text editor has had this since the Page pane existed (`src/outline.ts`); the surfaces that replaced it needed the
// same list, so it is one component with one shape. The headings come from the surface — a Markdown source counts lines,
// a rich document counts positions — so the jump target is called `at` and means "whatever this surface jumps to".
//
// It is a list rather than a tree: headings are already indented by their level, and a tree of one-item branches would be
// a worse way to say the same thing.

import * as React from 'react';

export interface Heading {
	level: number;
	text: string;
	/** What the surface jumps to: a line for a text surface, a document position for a rich one. */
	at: number;
}

export interface OutlineProps {
	headings: readonly Heading[];
	onGo: (at: number) => void;
}

export function OutlineList(props: OutlineProps): React.ReactElement {
	if (props.headings.length === 0) {
		return <p className="outline__empty">This page has no headings yet. The first <code>#</code> makes one.</p>;
	}
	return (
		<ul className="outline" role="tree" aria-label="Page outline">
			{props.headings.map((heading) => (
				<li key={`${heading.at}-${heading.text}`} className="outline__row" role="treeitem">
					<button
						type="button"
						className="outline__go"
						style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}
						onClick={() => props.onGo(heading.at)}
					>
						<span className="outline__level">{'#'.repeat(heading.level)}</span>
						<span className="outline__text">{heading.text}</span>
					</button>
				</li>
			))}
		</ul>
	);
}