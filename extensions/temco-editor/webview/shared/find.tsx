// Find, in the surface itself.
//
// The browser's own find cannot see an editor's document on every platform, and it cannot replace. The bar is shared by
// every surface: what differs is where the matches are, which each surface tells it. Replacement is optional, because a
// rich document makes "replace this text" mean something different from a Markdown source — a surface that cannot do it
// truthfully hides the controls rather than faking them.

import * as React from 'react';
import { ArrowDown16Regular, ArrowUp16Regular, Dismiss16Regular } from '@fluentui/react-icons';

export interface FindProps {
	query: string;
	/** Where the selection is in the matches, 1-based, or 0 when there is nothing to show. */
	position: number;
	total: number;
	error?: string;
	onQuery: (value: string) => void;
	onNext: (backwards: boolean) => void;
	onClose: () => void;
	replacement?: string;
	pattern?: boolean;
	onReplacement?: (value: string) => void;
	onPattern?: (value: boolean) => void;
	onReplaceAll?: () => void;
}

export function FindBar(props: FindProps): React.ReactElement {
	const replaces = props.onReplaceAll !== undefined;
	return (
		<div className="find" role="search">
			<input
				className="input input--sm find__query"
				value={props.query}
				autoFocus
				aria-label="Find"
				placeholder="Find"
				onChange={(event) => props.onQuery(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === 'Enter') {
						event.preventDefault();
						props.onNext(event.shiftKey);
					}
					if (event.key === 'Escape') {
						event.preventDefault();
						props.onClose();
					}
				}}
			/>
			<span className="find__count" aria-live="polite">
				{props.error ?? (props.query === '' ? '' : `${props.position} / ${props.total}`)}
			</span>
			<button type="button" className="btn btn--sm btn--ghost" aria-label="Previous match" title="Previous match" onClick={() => props.onNext(true)}>
					<ArrowUp16Regular />
			</button>
			<button type="button" className="btn btn--sm btn--ghost" aria-label="Next match" title="Next match" onClick={() => props.onNext(false)}>
					<ArrowDown16Regular />
			</button>
			{replaces
				? (
					<>
						<label className="find__pattern">
							<input type="checkbox" checked={props.pattern === true} onChange={(event) => props.onPattern?.(event.target.checked)} />
							Pattern
						</label>
						<input
							className="input input--sm find__replace"
							value={props.replacement ?? ''}
							aria-label="Replace with"
							placeholder="Replace with"
							onChange={(event) => props.onReplacement?.(event.target.value)}
						/>
						<button type="button" className="btn btn--sm" onClick={props.onReplaceAll} disabled={props.total === 0}>
							Replace all
						</button>
					</>
				)
				: null}
			<button type="button" className="btn btn--sm btn--ghost" aria-label="Close find" title="Close find" onClick={props.onClose}>
					<Dismiss16Regular />
			</button>
		</div>
	);
}