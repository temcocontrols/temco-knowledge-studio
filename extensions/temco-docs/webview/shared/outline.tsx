// A surface's outline: the page's headings, as a tree you can walk, fold, filter and jump from.
//
// It is a tree and not the flat list it was, because a document is one: `##` under `#` is a child, and a child is
// something you fold away while working on its sibling. The rows are `treeitem`s in the WAI-ARIA sense, which is a promise
// about the keyboard — so the arrow keys, Home, End and Enter are all here, only one row is ever in the tab order, and the
// chevron is decoration: folding is `←`/`→`, which is how a tree is folded.
//
// The model is `src/outlineModel.ts`, which knows nothing about React, so `scripts/check-outline.mts` can prove the nesting,
// the filter and the current-section rule without a browser. This file only draws its answer.

import * as React from 'react';
import { ChevronDown16Regular, ChevronRight16Regular } from '@fluentui/react-icons';
import {
	currentSectionAt,
	filterTree,
	keyAt,
	treeOf,
	visibleRows,
	type HeadingAt,
} from '../../src/outlineModel';

export interface OutlineProps {
	headings: readonly HeadingAt[];
	/** Where the caret is, so the section it is in can be drawn as the current one. */
	cursor?: number;
	/** The keys of the folded branches. The page owns this, because the page remembers it. */
	collapsed: ReadonlySet<string>;
	onCollapse: (key: string) => void;
	onGo: (at: number) => void;
}

const NOTHING: ReadonlySet<string> = new Set();

export function OutlineList({ headings, cursor, collapsed, onCollapse, onGo }: OutlineProps): React.ReactElement {
	const [query, setQuery] = React.useState('');
	const [active, setActive] = React.useState(0);

	const { rows, current } = React.useMemo(() => {
		const tree = treeOf(headings);
		const searching = query.trim() !== '';
		// A filter is a question, and an answer under a folded branch is not an answer: while filtering, nothing is folded.
		const drawn = visibleRows(searching ? filterTree(tree, query) : tree, searching ? NOTHING : collapsed);
		const section = cursor === undefined ? undefined : currentSectionAt(headings, cursor);
		return { rows: drawn, current: section === undefined ? undefined : keyAt(tree, section.at) };
	}, [headings, cursor, collapsed, query]);

	if (headings.length === 0) {
		return (
			<p className="outline__empty">
				No headings yet. Give a line a style with the <strong>Text</strong> menu — Heading 1 to Heading 4 — and it
				appears here.
			</p>
		);
	}

	/** The row the keyboard is on. Clamped, because a filter can shorten the list under it. */
	const seated = Math.min(Math.max(active, 0), Math.max(rows.length - 1, 0));

	const move = (to: number): void => {
		if (rows.length === 0) {
			return;
		}
		const next = Math.min(Math.max(to, 0), rows.length - 1);
		setActive(next);
		document.getElementById(`outline-row-${next}`)?.focus();
	};

	const onKeyDown = (event: React.KeyboardEvent<HTMLUListElement>): void => {
		const row = rows[seated];
		if (row === undefined) {
			return;
		}
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				move(seated + 1);
				return;
			case 'ArrowUp':
				event.preventDefault();
				move(seated - 1);
				return;
			case 'Home':
				event.preventDefault();
				move(0);
				return;
			case 'End':
				event.preventDefault();
				move(rows.length - 1);
				return;
			case 'ArrowRight':
				event.preventDefault();
				if (row.hasChildren && !row.expanded) {
					onCollapse(row.key);
				} else if (row.hasChildren) {
					move(seated + 1);
				}
				return;
			case 'ArrowLeft': {
				event.preventDefault();
				if (row.hasChildren && row.expanded) {
					onCollapse(row.key);
					return;
				}
				for (let above = seated - 1; above >= 0; above--) {
					if (rows[above].depth < row.depth) {
						move(above);
						return;
					}
				}
				return;
			}
			case 'Enter':
				event.preventDefault();
				onGo(row.heading.at);
				return;
			default:
				return;
		}
	};

	return (
		<div className="outline">
			<input
				className="input input--sm outline__filter"
				type="search"
				value={query}
				placeholder="Filter headings"
				aria-label="Filter headings"
				onChange={event => {
					setQuery(event.target.value);
					setActive(0);
				}}
			/>
			{rows.length === 0
				? <p className="outline__empty">No heading matches “{query.trim()}”.</p>
				: (
					<ul className="outline__tree" role="tree" aria-label="Page outline" onKeyDown={onKeyDown}>
						{rows.map((row, index) => (
							<li
								key={row.key}
								id={`outline-row-${index}`}
								className={`outline__row${row.key === current ? ' is-current' : ''}`}
								role="treeitem"
								aria-level={row.depth}
								aria-expanded={row.hasChildren ? row.expanded : undefined}
								aria-current={row.key === current ? 'true' : undefined}
								data-depth={row.depth}
								tabIndex={index === seated ? 0 : -1}
								style={{ paddingLeft: `${(row.depth - 1) * 10 + 3}px` }}
								onFocus={() => setActive(index)}
								onClick={() => {
									setActive(index);
									onGo(row.heading.at);
								}}
							>
								{row.hasChildren
									? (
										<span
											className="outline__twisty"
											aria-hidden="true"
											onClick={event => {
												event.stopPropagation();
												onCollapse(row.key);
											}}
										>
											{row.expanded ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
										</span>
									)
									: <span className="outline__twisty" aria-hidden="true" />}
								<span className="outline__text">{row.heading.text.trim() === '' ? 'Untitled heading' : row.heading.text}</span>
							</li>
						))}
					</ul>
				)}
		</div>
	);
}