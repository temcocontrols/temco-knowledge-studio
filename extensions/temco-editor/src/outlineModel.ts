// The outline of a page, as data: a tree, a filter, and the row the caret is in.
//
// It lives beside the other pure modules because it is the half of the outline that has nothing to do with a webview: the
// rail draws it, the document feeds it, and `scripts/check-outline.mts` proves the rules without a browser. It knows a
// heading only as `{ level, text, at }` — which is what any engine behind the seam can produce.

export interface HeadingAt {
	level: number;
	text: string;
	/** What a surface jumps to: a document position for a rich page, a line for a text one. */
	at: number;
}

export interface OutlineNode {
	/**
	 * Stable while other things are edited: the level, the text, and which duplicate of that text it is.
	 *
	 * A position would change under every keystroke above it, and a folded branch would spring open while typing — which is
	 * the one thing a folded branch must not do.
	 */
	key: string;
	heading: HeadingAt;
	/** 1-based depth in the tree. Not the heading level: a `###` that follows a `#` is a child, not a grandchild. */
	depth: number;
	children: OutlineNode[];
}

export interface OutlineRow {
	key: string;
	heading: HeadingAt;
	depth: number;
	hasChildren: boolean;
	expanded: boolean;
}

/**
 * The headings, nested.
 *
 * A heading hangs off the nearest heading before it with a *lower* level, however many levels are skipped: documents skip
 * levels all the time, and a `###` under a `#` that was refused would be a heading the outline cannot show.
 */
export function treeOf(headings: readonly HeadingAt[]): OutlineNode[] {
	const roots: OutlineNode[] = [];
	const ancestors: OutlineNode[] = [];
	const duplicates = new Map<string, number>();
	for (const heading of headings) {
		const text = `${heading.level}/${heading.text}`;
		const seen = duplicates.get(text) ?? 0;
		duplicates.set(text, seen + 1);
		const node: OutlineNode = { key: seen === 0 ? text : `${text}#${seen}`, heading, depth: 1, children: [] };
		while (ancestors.length > 0 && ancestors[ancestors.length - 1].heading.level >= heading.level) {
			ancestors.pop();
		}
		const parent = ancestors[ancestors.length - 1];
		if (parent === undefined) {
			roots.push(node);
		} else {
			node.depth = parent.depth + 1;
			parent.children.push(node);
		}
		ancestors.push(node);
	}
	return roots;
}

/** The rows as the rail draws them: depth-first, and the children of a folded branch are not among them. */
export function visibleRows(nodes: readonly OutlineNode[], collapsed: ReadonlySet<string>): OutlineRow[] {
	const rows: OutlineRow[] = [];
	const walk = (list: readonly OutlineNode[]): void => {
		for (const node of list) {
			const hasChildren = node.children.length > 0;
			const expanded = hasChildren && !collapsed.has(node.key);
			rows.push({ key: node.key, heading: node.heading, depth: node.depth, hasChildren, expanded });
			if (expanded) {
				walk(node.children);
			}
		}
	};
	walk(nodes);
	return rows;
}

/** What answers the query: a row is kept when it matches, and so is every row above it that leads to a match. */
export function filterTree(nodes: readonly OutlineNode[], query: string): OutlineNode[] {
	const needle = query.trim().toLowerCase();
	if (needle === '') {
		return [...nodes];
	}
	const keep = (list: readonly OutlineNode[]): OutlineNode[] => {
		const kept: OutlineNode[] = [];
		for (const node of list) {
			const children = keep(node.children);
			if (children.length > 0 || node.heading.text.toLowerCase().includes(needle)) {
				kept.push({ key: node.key, heading: node.heading, depth: node.depth, children });
			}
		}
		return kept;
	};
	return keep(nodes);
}

/** The heading whose section the caret is in: the nearest one at or before it, and nothing above the first heading. */
export function currentSectionAt(headings: readonly HeadingAt[], cursor: number): HeadingAt | undefined {
	let found: HeadingAt | undefined;
	for (const heading of headings) {
		if (heading.at > cursor) {
			break;
		}
		found = heading;
	}
	return found;
}

/** The row that stands for a position, so a heading's `at` can be turned back into the row to mark as current. */
export function keyAt(nodes: readonly OutlineNode[], at: number): string | undefined {
	for (const node of nodes) {
		if (node.heading.at === at) {
			return node.key;
		}
		const under = keyAt(node.children, at);
		if (under !== undefined) {
			return under;
		}
	}
	return undefined;
}

/** A page with fewer headings than this has no table of contents, only a list of the two things it says. */
export const OUTLINE_WHEN = 3;
