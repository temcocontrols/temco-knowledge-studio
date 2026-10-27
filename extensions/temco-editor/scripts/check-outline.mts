// The outline is the page's table of contents, and its three rules are the kind that fail quietly: a skipped heading level,
// a folded branch that springs open, a caret in a section the rail does not mark. None of them throws, and none of them is
// visible in a screenshot. So they are here, on the pure model (`src/outlineModel.ts`), with no browser involved.
//
// The extension is CommonJS (`main` is `out/extension.js`), so the module under test is the compiled one, and a stale
// `out/` would quietly test yesterday's code. So the check refuses to run when the source is newer.
//
// Run with `npm run check-outline`, after `tsc -p .`.

import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

interface HeadingAt {
	level: number;
	text: string;
	at: number;
}

interface OutlineNode {
	key: string;
	heading: HeadingAt;
	depth: number;
	children: OutlineNode[];
}

interface OutlineRow {
	key: string;
	heading: HeadingAt;
	depth: number;
	hasChildren: boolean;
	expanded: boolean;
}

interface ModelModule {
	treeOf(headings: readonly HeadingAt[]): OutlineNode[];
	visibleRows(nodes: readonly OutlineNode[], collapsed: ReadonlySet<string>): OutlineRow[];
	filterTree(nodes: readonly OutlineNode[], query: string): OutlineNode[];
	currentSectionAt(headings: readonly HeadingAt[], cursor: number): HeadingAt | undefined;
	keyAt(nodes: readonly OutlineNode[], at: number): string | undefined;
	OUTLINE_WHEN: number;
}

const require_ = createRequire(import.meta.url);
const source = fileURLToPath(new URL('../src/outlineModel.ts', import.meta.url));
const built = fileURLToPath(new URL('../out/outlineModel.js', import.meta.url));
try {
	assert.ok(statSync(built).mtimeMs >= statSync(source).mtimeMs, 'out/outlineModel.js is older than src/outlineModel.ts');
} catch (error) {
	console.log(`Cannot run: ${(error as Error).message}`);
	console.log('Compile first:  tsc -p .');
	process.exit(1);
}

const model = require_('../out/outlineModel.js') as ModelModule;

let checks = 0;
function ok(condition: boolean, what: string): void {
	assert.ok(condition, what);
	checks++;
}

/** A page: an `h1`, an `h2` with an `h3` under it, then a second `h2`. */
const PAGE: HeadingAt[] = [
	{ level: 1, text: 'Overview', at: 0 },
	{ level: 2, text: 'Install', at: 40 },
	{ level: 3, text: 'On Windows', at: 60 },
	{ level: 2, text: 'Configure', at: 120 },
];

// --- the tree -------------------------------------------------------------------------------------
{
	const tree = model.treeOf(PAGE);
	ok(tree.length === 1, 'one root: the h1');
	ok(tree[0].children.length === 2, 'the two h2s are its children');
	ok(tree[0].children[0].children.length === 1, 'the h3 hangs off the h2 above it');
	ok(tree[0].children[0].children[0].depth === 3, 'the h3 is at depth 3');
	ok(tree[0].children[1].children.length === 0, 'Configure has no children');
}

// --- a skipped level is still a child ---------------------------------------------------------------
{
	const skipped = model.treeOf([
		{ level: 1, text: 'A', at: 0 },
		{ level: 3, text: 'C', at: 10 },
	]);
	ok(skipped.length === 1 && skipped[0].children.length === 1, 'h3 after h1 is a child, not a lost heading');
	ok(skipped[0].children[0].depth === 2, 'depth counts the tree, not the level');

	const orphan = model.treeOf([{ level: 2, text: 'B', at: 0 }, { level: 3, text: 'C', at: 10 }]);
	ok(orphan.length === 1 && orphan[0].depth === 1, 'a page that starts at h2 still has a root');
}

// --- keys survive editing elsewhere, and duplicates stay distinct ------------------------------------
{
	const tree = model.treeOf(PAGE);
	const first = tree[0].key;
	const shifted = model.treeOf(PAGE.map(heading => ({ ...heading, at: heading.at + 500 })));
	ok(shifted[0].key === first, 'moving every heading down the page does not change a key');

	const twice = model.treeOf([
		{ level: 2, text: 'Notes', at: 0 },
		{ level: 2, text: 'Notes', at: 10 },
	]);
	ok(twice[0].key !== twice[1].key, 'two headings with the same words are two rows');
}

// --- folded branches, and the rows that are drawn -----------------------------------------------------
{
	const tree = model.treeOf(PAGE);
	const root = tree[0];
	const open = model.visibleRows(tree, new Set());
	ok(open.length === 4, 'everything is drawn when nothing is folded');
	ok(open[0].expanded && open[0].hasChildren, 'the root is an expanded branch');

	const folded = model.visibleRows(tree, new Set([root.key]));
	ok(folded.length === 1, 'a folded root hides its whole subtree');
	ok(!folded[0].expanded, 'and says so');
}

// --- the filter keeps the branch that leads to a match -----------------------------------------------
{
	const tree = model.treeOf(PAGE);
	const hit = model.filterTree(tree, 'windows');
	ok(hit.length === 1, 'the match keeps its root');
	ok(hit[0].children.length === 1, 'and its parent h2');
	ok(hit[0].children[0].children[0].heading.text === 'On Windows', 'and the match itself');

	ok(model.filterTree(tree, 'install').length === 1, 'a match on a parent keeps the parent');
	ok(model.filterTree(tree, 'nothing here').length === 0, 'no match, no rows');
	ok(model.filterTree(tree, '  ').length === 1, 'an empty filter changes nothing');
	ok(model.filterTree(tree, 'WINDOWS').length === 1, 'the filter is case-insensitive');
}

// --- where the caret is ------------------------------------------------------------------------------
{
	ok(model.currentSectionAt(PAGE, 0)?.text === 'Overview', 'the caret on a heading is in that heading');
	ok(model.currentSectionAt(PAGE, 39)?.text === 'Overview', 'and in the section above the next one');
	ok(model.currentSectionAt(PAGE, 40)?.text === 'Install', 'the next heading starts its own section');
	ok(model.currentSectionAt(PAGE, 200)?.text === 'Configure', 'the last section runs to the end of the page');
	ok(model.currentSectionAt(PAGE, -1) === undefined, 'above the first heading there is no section');

	const tree = model.treeOf(PAGE);
	ok(model.keyAt(tree, 60) === tree[0].children[0].children[0].key, 'a heading position maps back to its row');
	ok(model.keyAt(tree, 61) === undefined, 'a position inside a section is not the heading');
}

// --- the rail's own rule ------------------------------------------------------------------------------
ok(model.OUTLINE_WHEN === 3, 'a page needs three headings to earn a rail');

console.log(`check-outline: ${checks}/${checks} checks passed`);
