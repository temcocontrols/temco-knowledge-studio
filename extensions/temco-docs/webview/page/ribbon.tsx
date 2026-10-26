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
	MoreHorizontal24Regular,
	Search24Regular,
	Settings24Regular,
	TextBold24Regular,
	TextItalic24Regular,
	TextQuote24Regular,
	TextStrikethrough24Regular,
	TextUnderline24Regular,
} from '@fluentui/react-icons';

import { LinkPopover, ListMenu, StyleMenu } from '../shared/menus';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { Mark, PageActions, PageState } from './document';

/** The tabs, in the order a document application puts them. */
export type Tab = 'home' | 'insert' | 'view';

const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
	{ id: 'home', label: 'Home' },
	{ id: 'insert', label: 'Insert' },
	{ id: 'view', label: 'View' },
];

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
function Tool({ label, glyph, run, active, disabled, shortcut }: ToolProps): React.ReactElement {
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

/** One entry in the style gallery: the text it makes, set the way it makes it. */
function Style({ label, sample, level, active, run }: { label: string; sample: string; level?: number; active: boolean; run: () => unknown }): React.ReactElement {
	return (
		<button
			type="button"
			className={`page-surface__style${active ? ' is-on' : ''}`}
			aria-label={label}
			aria-pressed={active}
			title={label}
			data-level={level ?? 0}
			onMouseDown={(event) => event.preventDefault()}
			onClick={run}
		>
			{sample}
		</button>
	);
}

export interface RibbonProps {
	state: PageState;
	actions: PageActions;
	tab: Tab;
	onTab: (tab: Tab) => void;
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
 * The `full` threshold is the width at which the gallery genuinely fits beside the other groups — measured, not guessed:
 * History ~76 + Text ~200 + Style 108 + Lists 108 + Blocks ~110 + gallery ~400, plus the dividers and padding, is about
 * 1030. Below that the bar wrapped onto a second row, which is why the gallery folds into the Style menu instead.
 */
export type Density = 'full' | 'compact' | 'narrow';

export function densityFor(width: number): Density {
	if (width < 720) {
		return 'narrow';
	}
	return width < 1180 ? 'compact' : 'full';
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

const MARKS: ReadonlyArray<{ mark: Mark; label: string; glyph: React.ReactElement; shortcut: string }> = [
	{ mark: 'bold', label: 'Bold', glyph: <TextBold24Regular />, shortcut: 'Ctrl+B' },
	{ mark: 'italic', label: 'Italic', glyph: <TextItalic24Regular />, shortcut: 'Ctrl+I' },
	{ mark: 'underline', label: 'Underline', glyph: <TextUnderline24Regular />, shortcut: 'Ctrl+U' },
	{ mark: 'strike', label: 'Strikethrough', glyph: <TextStrikethrough24Regular />, shortcut: 'Ctrl+Shift+X' },
	{ mark: 'code', label: 'Inline code', glyph: <Code24Regular />, shortcut: 'Ctrl+E' },
	{ mark: 'highlight', label: 'Highlight', glyph: <ColorBackground24Regular />, shortcut: 'Ctrl+Shift+H' },
];

const GALLERY: ReadonlyArray<{ level: number; label: string }> = [
	{ level: 0, label: 'Normal' },
	{ level: 1, label: 'Heading 1' },
	{ level: 2, label: 'Heading 2' },
	{ level: 3, label: 'Heading 3' },
];

/** The block commands, declared once: the group draws them, and the `⋯` menu offers the same ones when they do not fit. */
const BLOCKS: ReadonlyArray<{ key: string; label: string; glyph: React.ReactElement; shortcut?: string; run: (actions: PageActions) => void }> = [
	{ key: 'quote', label: 'Block quote', glyph: <TextQuote24Regular />, shortcut: 'Ctrl+Shift+B', run: actions => actions.toggleQuote() },
	{ key: 'code', label: 'Code block', glyph: <Code24Regular />, shortcut: 'Ctrl+Alt+C', run: actions => actions.toggleCodeBlock() },
	{ key: 'rule', label: 'Horizontal rule', glyph: <span className="page-surface__word">—</span>, run: actions => actions.horizontalRule() },
];

/** What a `⋯` shows: the commands the current width had to hide. */
function MoreMenu({ density, actions }: { density: Density; actions: PageActions }): React.ReactElement | null {
	if (density === 'full') {
		return null;
	}
	return (
		<DropdownMenu.Root>
			<DropdownMenu.Trigger asChild>
				<button type="button" className="btn btn--sm btn--ghost" aria-label="More" title="More" onMouseDown={event => event.preventDefault()}>
					<MoreHorizontal24Regular />
				</button>
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content className="menu" sideOffset={4} align="end">
					{BLOCKS.map(block => (
						<DropdownMenu.Item key={block.key} className="menu__item" onSelect={() => block.run(actions)}>
							<span>{block.label}</span>
							{block.shortcut === undefined ? null : <span className="menu__hint">{block.shortcut}</span>}
						</DropdownMenu.Item>
					))}
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	);
}

export function PageRibbon(props: RibbonProps): React.ReactElement {
	const { state, actions, tab, onTab, reading } = props;
	const { ref, density } = useDensity();
	// Read mode has no editing tabs to offer; the only thing it can do is leave.
	const tabs = reading ? TABS.filter(entry => entry.id === 'view') : TABS;
	const shown = reading ? 'view' : tab;

	/** Left/Right/Home/End, the way a tab list is expected to answer — and focus follows the selection. */
	const onTabKey = (event: React.KeyboardEvent<HTMLDivElement>): void => {
		if (tabs.length < 2) {
			return;
		}
		const at = tabs.findIndex(entry => entry.id === shown);
		const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
		const jump = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
		if (step === 0 && jump < 0) {
			return;
		}
		event.preventDefault();
		const next = jump >= 0 ? tabs[jump] : tabs[(at + step + tabs.length) % tabs.length];
		onTab(next.id);
		document.getElementById(`ribbon-tab-${next.id}`)?.focus();
	};

	return (
		<div className={`ribbon${density === 'full' ? '' : ' is-compact'}`} ref={ref} data-density={density}>
			<div className="ribbon__tabs" role="tablist" aria-label="Ribbon" onKeyDown={event => onTabKey(event)}>
				{tabs.map(entry => (
					<button
						key={entry.id}
						type="button"
						role="tab"
						id={`ribbon-tab-${entry.id}`}
						aria-controls={`ribbon-panel-${entry.id}`}
						className="ribbon__tab"
						aria-selected={shown === entry.id}
						// Only the chosen tab is in the tab order: the arrow keys move between tabs, Tab leaves the bar.
						tabIndex={shown === entry.id ? 0 : -1}
						onClick={() => onTab(entry.id)}
					>
						{entry.label}
					</button>
				))}
				{reading ? <span className="ribbon__mode">Reading</span> : null}
			</div>

			{shown === 'home'
				? (
					<div className="ribbon__panel" role="tabpanel" id={`ribbon-panel-${shown}`} aria-labelledby={`ribbon-tab-${shown}`} aria-label="Writing">
						<div className="ribbon__group">
							<Tool label="Undo" glyph={<ArrowUndo24Regular />} shortcut="Ctrl+Z" disabled={!state.canUndo} run={actions.undo} />
							<Tool label="Redo" glyph={<ArrowClockwise24Regular />} shortcut="Ctrl+Y" disabled={!state.canRedo} run={actions.redo} />
						</div>
						<div className="ribbon__group">
							{MARKS.map(entry => (
								<Tool
									key={entry.mark}
									label={entry.label}
									glyph={entry.glyph}
									shortcut={entry.shortcut}
									active={state.marks[entry.mark]}
									run={() => actions.toggleMark(entry.mark)}
								/>
							))}
						</div>
						<div className="ribbon__group">
							<StyleMenu state={state} actions={actions} />
						</div>
						<div className="ribbon__group">
							<ListMenu state={state} actions={actions} />
						</div>
						{density === 'full'
							? (
								<div className="ribbon__group">
									{BLOCKS.map(block => (
										<Tool key={block.key} label={block.label} glyph={block.glyph} shortcut={block.shortcut} run={() => block.run(actions)} />
									))}
								</div>
							)
							: null}
						{/* The gallery a document application puts beside the font box: each entry is the text it makes, at the
						    size it makes it, so a style is chosen by sight rather than by the word "Heading 3". Below `full` it
						    is not drawn: the Style menu beside it offers the same blocks, so nothing is lost. */}
						<div className="ribbon__group page-surface__styles">
							{GALLERY.map(entry => (
								<Style
									key={entry.level}
									label={entry.label}
									sample={entry.label}
									level={entry.level}
									active={state.block === entry.level}
									run={() => actions.setBlock(entry.level)}
								/>
							))}
						</div>
						<MoreMenu density={density} actions={actions} />
					</div>
				)
				: shown === 'insert'
					? (
						<div className="ribbon__panel" role="tabpanel" id={`ribbon-panel-${shown}`} aria-labelledby={`ribbon-tab-${shown}`} aria-label="Insert">
							<div className="ribbon__group">
								<LinkPopover state={state} actions={actions} />
								<Tool label="Link to page" glyph={<DocumentLink24Regular />} run={() => props.onHostAction('linkPage')} />
							</div>
							<div className="ribbon__group">
								<Tool label="Picture" glyph={<Image24Regular />} run={() => props.onHostAction('image')} />
								<Tool label="Screenshot" glyph={<Camera24Regular />} run={() => props.onHostAction('capture')} />
								<Tool
									label="Annotate the picture"
									glyph={<DrawShape24Regular />}
									disabled={!state.onImage}
									run={props.onAnnotate}
								/>
							</div>
							<div className="ribbon__group">
								<Tool label="Table" glyph={<span className="page-surface__word">▦</span>} run={actions.insertTable} />
								<Tool label="Horizontal rule" glyph={<span className="page-surface__word">—</span>} run={actions.horizontalRule} />
							</div>
						</div>
					)
					: (
						<div className="ribbon__panel" role="tabpanel" id={`ribbon-panel-${shown}`} aria-labelledby={`ribbon-tab-${shown}`} aria-label="View">
							<div className="ribbon__group">
								<Tool label="Find" glyph={<Search24Regular />} shortcut="Ctrl+F" active={props.finding} run={props.onFind} />
								<Tool label="Outline" glyph={<List24Regular />} active={props.outlining} run={props.onOutline} />
							</div>
							<div className="ribbon__group">
								{/* Reading a page is not editing one: the same surface, a second engine behind it, and no caret. */}
								<Tool
									label={reading ? 'Edit the page' : 'Read the page'}
									glyph={<BookOpen24Regular />}
									active={reading}
									run={props.onReading}
								/>
							</div>
							<div className="ribbon__group">
								<Tool label="Preview the page" glyph={<Eye24Regular />} shortcut="Ctrl+Alt+P" run={() => props.onHostAction('preview')} />
								<Tool label="Diff with HEAD" glyph={<BranchCompare24Regular />} shortcut="Ctrl+Alt+D" run={() => props.onHostAction('diff')} />
								<Tool label="Open the source" glyph={<Code24Regular />} run={() => props.onHostAction('source')} />
								<Tool label="Page properties" glyph={<Settings24Regular />} run={() => props.onHostAction('properties')} />
							</div>
						</div>
					)}
		</div>
	);
}
