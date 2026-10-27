// The bar: the whole of what a page is written with, and nothing about how a page is stored.
//
// It is handed a snapshot of the caret (`PageState`) and a set of named operations (`PageActions`), so it knows no engine,
// no command string and no document position. That is what lets the bar be re-skinned without touching Tiptap, and Tiptap
// be replaced without touching a single button here.
//
// A control whose result Markdown cannot carry — alignment, colour, a font, spacing — is not here: a button whose effect
// disappears on save is a lie.

import * as React from 'react';
import {
	ArrowClockwise24Regular,
	ArrowUndo24Regular,
	BookOpen24Regular,
	BranchCompare24Regular,
	Camera24Regular,
	Code24Regular,
	ColorBackground24Regular,
	DocumentLink24Regular,
	DrawShape24Regular,
	Eye24Regular,
	Image24Regular,
	List24Regular,
	LineHorizontal124Regular,
	MoreHorizontal24Regular,
	Search24Regular,
	Settings24Regular,
	Table24Regular,
	TextBold24Regular,
	TextItalic24Regular,
	TextQuote24Regular,
	TextStrikethrough24Regular,
	TextUnderline24Regular,
} from '@fluentui/react-icons';

import { LinkPopover, ListMenu, StyleMenu } from '../shared/menus';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { Mark, PageActions, PageState } from './contract';

interface ToolProps {
	label: string;
	glyph: React.ReactElement;
	run: () => unknown;
	active?: boolean;
	disabled?: boolean;
	/** The key that does the same thing, shown in the tooltip so the bar teaches the keyboard. */
	shortcut?: string;
}

/** One toolbar control: a glyph, a name a screen reader can read, its shortcut, and the state it is in. */
export function Tool({ label, glyph, run, active, disabled, shortcut }: ToolProps): React.ReactElement {
	const title = shortcut === undefined ? label : `${label} (${shortcut})`;
	return (
		<button
			type="button"
			// `btn--icon` and not `btn`: a text button in the same row keeps its own width, which is what stopped
			// "Preview", "Diff with HEAD" and "Open source" drawing on top of each other.
			className={`btn btn--sm btn--ghost btn--icon${active === true ? ' is-on' : ''}`}
			aria-label={label}
			aria-pressed={active}
			aria-keyshortcuts={shortcut}
			title={title}
			disabled={disabled === true}
			// A toolbar must not steal the selection the command is about to act on.
			onMouseDown={(event) => event.preventDefault()}
			onClick={run}
		>
			{glyph}
		</button>
	);
}

export interface RibbonProps {
	state: PageState;
	actions: PageActions;
	finding: boolean;
	outlining: boolean;
	reading: boolean;
	onReading: () => void;
	onFind: () => void;
	onOutline: () => void;
	/** The host's own actions: preview, diff, source, properties, a picture, a capture, a link to another page. */
	onHostAction: (action: 'preview' | 'diff' | 'source' | 'properties' | 'image' | 'capture' | 'linkPage') => void;
	/** Enabled only when a picture is selected: annotating replaces it rather than adding a second one. */
	onAnnotate: () => void;
}

/**
 * How much of the bar fits. A narrow editor gets a denser bar rather than a clipped one.
 *
 * Measured, not guessed, at 30 px a control: history 83 + the marks 215 + the style menu 128 + the list menu 128 + the
 * block group 149 + the insert group 182, plus the five hairlines and the panel's padding, is about 905 — so `full` starts
 * a little above that. A compact bar keeps nine controls and folds five into `⋯`, which needs about 715.
 */
export type Density = 'full' | 'compact';

export function densityFor(width: number): Density {
	return width < 940 ? 'compact' : 'full';
}

/**
 * The width of the bar, followed as the editor is resized.
 *
 * `ResizeObserver` rather than a window listener: an editor can be narrowed by a split, by dragging a sidebar or by opening
 * a second editor beside it, and none of those is a window resize.
 */
function useDensity(): { ref: React.RefObject<HTMLDivElement | null>; density: Density } {
	const ref = React.useRef<HTMLDivElement | null>(null);
	const [density, setDensity] = React.useState<Density>('full');
	React.useEffect(() => {
		const element = ref.current;
		if (element === null) {
			return undefined;
		}
		const observer = new ResizeObserver(entries => {
			const width = entries[0]?.contentRect.width ?? element.clientWidth;
			setDensity(densityFor(width));
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, []);
	return { ref, density };
}

/** The six marks a page can hold, in the order every editor puts them — the bar's first group and the whole selection menu. */
export const MARKS: ReadonlyArray<{ mark: Mark; label: string; glyph: React.ReactElement; shortcut: string }> = [
	{ mark: 'bold', label: 'Bold', glyph: <TextBold24Regular />, shortcut: 'Ctrl+B' },
	{ mark: 'italic', label: 'Italic', glyph: <TextItalic24Regular />, shortcut: 'Ctrl+I' },
	{ mark: 'underline', label: 'Underline', glyph: <TextUnderline24Regular />, shortcut: 'Ctrl+U' },
	{ mark: 'strike', label: 'Strikethrough', glyph: <TextStrikethrough24Regular />, shortcut: 'Ctrl+Shift+X' },
	{ mark: 'code', label: 'Inline code', glyph: <Code24Regular />, shortcut: 'Ctrl+E' },
	{ mark: 'highlight', label: 'Highlight', glyph: <ColorBackground24Regular />, shortcut: 'Ctrl+Shift+H' },
];

/** One control on the bar. */
interface Item {
	key: string;
	label: string;
	glyph: React.ReactElement;
	shortcut?: string;
	run: () => unknown;
	/** 1 is drawn while there is room; 2 is folded into `⋯` as soon as the bar is compact. */
	tier: 1 | 2;
	active?: boolean;
	disabled?: boolean;
}

/** A group of controls under one hairline, with the control that is not a plain button (the link editor, a menu) first. */
interface GroupSpec {
	id: string;
	lead?: React.ReactElement;
	items: readonly Item[];
	/** `end` pushes the group to the right edge — the rail toggle lives there, away from the writing controls. */
	align?: 'end';
}

function Group({ lead, items, align }: { lead?: React.ReactElement; items: readonly Item[]; align?: 'end' }): React.ReactElement | null {
	if (lead === undefined && items.length === 0) {
		return null;
	}
	return (
		<div className={`ribbon__group${align === 'end' ? ' ribbon__group--end' : ''}`}>
			{lead}
			{items.map(item => (
				<Tool
					key={item.key}
					label={item.label}
					glyph={item.glyph}
					shortcut={item.shortcut}
					active={item.active}
					disabled={item.disabled}
					run={item.run}
				/>
			))}
		</div>
	);
}

/**
 * What the bar draws at this width, and what it hands to `⋯`.
 *
 * Each group declares its controls once, with a tier, so the overflow menu is not a second copy that has to be kept in
 * step by hand: a compact bar is the same table with the tier-2 rows taken out.
 */
function split(items: readonly Item[], density: Density): { drawn: readonly Item[]; folded: readonly Item[] } {
	if (density === 'full') {
		return { drawn: items, folded: [] };
	}
	return { drawn: items.filter(item => item.tier === 1), folded: items.filter(item => item.tier === 2) };
}

/** What a `⋯` shows: the controls the current width had to hide. */
function MoreMenu({ items }: { items: readonly Item[] }): React.ReactElement {
	return (
		<DropdownMenu.Root>
			<DropdownMenu.Trigger asChild>
				<button type="button" className="btn btn--sm btn--ghost" aria-label="More" title="More" onMouseDown={event => event.preventDefault()}>
					<MoreHorizontal24Regular />
				</button>
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content className="menu" sideOffset={4} align="end">
					{items.map(item => (
						<DropdownMenu.Item key={item.key} className="menu__item" disabled={item.disabled === true} onSelect={() => item.run()}>
							<span>{item.label}</span>
							{item.shortcut === undefined ? null : <span className="menu__hint">{item.shortcut}</span>}
						</DropdownMenu.Item>
					))}
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	);
}

/**
 * The bar draws what it has room for and hands the rest to `⋯`.
 *
 * There is one row, as in the engine's own demos: writing on the left in the order a writer reaches for it, and what
 * reads the page or hands it to another surface pushed to the far right.
 */
export function PageRibbon(props: RibbonProps): React.ReactElement {
	const { state, actions, reading } = props;
	const { ref, density } = useDensity();

	// Everything that writes the page, in the order a writer reaches for it: undo, the block style, the lists, the marks,
	// the blocks, and what is inserted rather than typed. One row, the way the engine's own demos draw it.
	const writing: GroupSpec[] = [
		{
			id: 'history',
			items: [
				{ key: 'undo', label: 'Undo', glyph: <ArrowUndo24Regular />, shortcut: 'Ctrl+Z', tier: 1, disabled: !state.canUndo, run: actions.undo },
				{ key: 'redo', label: 'Redo', glyph: <ArrowClockwise24Regular />, shortcut: 'Ctrl+Y', tier: 1, disabled: !state.canRedo, run: actions.redo },
			],
		},
		{ id: 'style', lead: <StyleMenu state={state} actions={actions} />, items: [] },
		{ id: 'lists', lead: <ListMenu state={state} actions={actions} />, items: [] },
		{
			id: 'text',
			items: MARKS.map(entry => ({
				key: entry.mark,
				label: entry.label,
				glyph: entry.glyph,
				shortcut: entry.shortcut,
				tier: 1,
				active: state.marks[entry.mark],
				run: () => actions.toggleMark(entry.mark),
			})),
		},
		{
			id: 'blocks',
			items: [
				{ key: 'quote', label: 'Block quote', glyph: <TextQuote24Regular />, shortcut: 'Ctrl+Shift+B', tier: 1, run: actions.toggleQuote },
				{ key: 'codeBlock', label: 'Code block', glyph: <Code24Regular />, shortcut: 'Ctrl+Alt+C', tier: 1, run: actions.toggleCodeBlock },
				{ key: 'rule', label: 'Horizontal rule', glyph: <LineHorizontal124Regular />, tier: 2, run: actions.horizontalRule },
				{ key: 'table', label: 'Table', glyph: <Table24Regular />, tier: 2, run: actions.insertTable },
			],
		},
		{
			id: 'insert',
			lead: <LinkPopover state={state} actions={actions} />,
			items: [
				{ key: 'picture', label: 'Picture', glyph: <Image24Regular />, tier: 1, run: () => props.onHostAction('image') },
				{ key: 'screenshot', label: 'Screenshot', glyph: <Camera24Regular />, tier: 2, run: () => props.onHostAction('capture') },
				{ key: 'annotate', label: 'Annotate the picture', glyph: <DrawShape24Regular />, tier: 2, disabled: !state.onImage, run: props.onAnnotate },
				{ key: 'linkPage', label: 'Link to page', glyph: <DocumentLink24Regular />, tier: 2, run: () => props.onHostAction('linkPage') },
			],
		},
	];

	// What reads the page or hands it to another surface, pushed to the far right and away from the writing controls.
	const viewing: GroupSpec = {
		id: 'view',
		align: 'end',
		items: [
			{ key: 'find', label: 'Find', glyph: <Search24Regular />, shortcut: 'Ctrl+F', tier: 1, active: props.finding, run: props.onFind },
			{ key: 'outline', label: 'Outline', glyph: <List24Regular />, shortcut: 'Ctrl+Alt+O', tier: 1, active: props.outlining, run: props.onOutline },
			// Reading a page is not editing one: the same surface, no caret, and the writing groups are not drawn.
			{ key: 'read', label: reading ? 'Edit the page' : 'Read the page', glyph: <BookOpen24Regular />, tier: 1, active: reading, run: props.onReading },
			{ key: 'preview', label: 'Preview the page', glyph: <Eye24Regular />, shortcut: 'Ctrl+Alt+P', tier: 2, run: () => props.onHostAction('preview') },
			{ key: 'diff', label: 'Diff with HEAD', glyph: <BranchCompare24Regular />, shortcut: 'Ctrl+Alt+D', tier: 2, run: () => props.onHostAction('diff') },
			{ key: 'source', label: 'Open the source', glyph: <Code24Regular />, tier: 2, run: () => props.onHostAction('source') },
			{ key: 'properties', label: 'Page properties', glyph: <Settings24Regular />, tier: 2, run: () => props.onHostAction('properties') },
		],
	};

	// Read mode keeps every viewing control, however narrow the tab is: there are only seven, and a `⋯` next to a chip
	// that says "Reading" would be the only way to leave the mode.
	const drawnOf = (group: GroupSpec): readonly Item[] =>
		reading && group.id === 'view' ? group.items : split(group.items, density).drawn;
	const foldedOf = (group: GroupSpec): readonly Item[] =>
		reading && group.id === 'view' ? [] : split(group.items, density).folded;

	const groups = reading ? [viewing] : [...writing, viewing];
	const folded = groups.flatMap(foldedOf);

	return (
		<div className={`ribbon${density === 'full' ? '' : ' is-compact'}`} ref={ref} data-density={density}>
			<div className="ribbon__panel" role="toolbar" aria-label={reading ? 'Reading' : 'Writing'}>
				{reading ? <span className="ribbon__mode">Reading</span> : null}
				{groups.filter(group => group.align !== 'end').map(group => (
					<Group key={group.id} lead={group.lead} items={drawnOf(group)} />
				))}
				{folded.length === 0 ? null : <MoreMenu items={folded} />}
				{groups.filter(group => group.align === 'end').map(group => (
					<Group key={group.id} align="end" lead={group.lead} items={drawnOf(group)} />
				))}
			</div>
		</div>
	);
}
