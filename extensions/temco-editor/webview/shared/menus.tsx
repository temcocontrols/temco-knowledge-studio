// The controls a document application asks for by name, drawn in the product's own vocabulary.
//
// These follow the shape of Tiptap's official UI Components (a style menu, a list menu, a link popover) because that is
// the shape a writer already knows; what they do not do is bring its look. They take the engine seam — a state snapshot
// and a set of named operations — so they know nothing about Tiptap, ProseMirror or a document position.

import * as React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Popover from '@radix-ui/react-popover';
import { Checkmark16Regular, ChevronDown16Regular, Dismiss16Regular, Link16Regular } from '@fluentui/react-icons';
import type { PageActions, PageState } from '../markdown/contract';

/** The block types a Markdown page can hold, which is the whole list — no quote, no custom style. */
const BLOCKS: ReadonlyArray<{ level: number; label: string; sample: string }> = [
	{ level: 0, label: 'Text', sample: 'Text' },
	{ level: 1, label: 'Heading 1', sample: 'Heading 1' },
	{ level: 2, label: 'Heading 2', sample: 'Heading 2' },
	{ level: 3, label: 'Heading 3', sample: 'Heading 3' },
	{ level: 4, label: 'Heading 4', sample: 'Heading 4' },
];

const nameOf = (level: number): string => BLOCKS.find(block => block.level === level)?.label ?? 'Text';

/**
 * A heading, as the bar draws it: a drawn `H` with the level beside it, and a paragraph mark for body text.
 *
 * The old trigger said "Heading 2" in words, which is 92 px of a toolbar to say what `H2` says in 22 — and the bar is
 * a row of glyphs, so one text chip among them was the control the eye stopped on. The words are still there: in the
 * accessible name, in the tooltip, and in the menu itself.
 */
function styleMark(level: number): React.ReactElement {
	if (level === 0) {
		return (
			<span className="menu__mark" aria-hidden="true">
				<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M2.5 4h11v1h-11zM2.5 7.5h11v1h-11zM2.5 11h7v1h-7z" /></svg>
			</span>
		);
	}
	return (
		<span className="menu__mark" aria-hidden="true">
			<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M3 3h2v4h6V3h2v10h-2V9H5v4H3z" /></svg>
			<span className="menu__mark__level">{level}</span>
		</span>
	);
}

/** The three list glyphs, on the workbench's own 16-unit grid, so the trigger reads at the size of every other control. */
const LIST_GLYPHS = {
	bullet: '<path fill-rule="evenodd" clip-rule="evenodd" d="M2 3H1v1h1V3zm0 3H1v1h1V6zM1 9h1v1H1V9zm1 3H1v1h1v-1zm2-9h11v1H4V3zm11 3H4v1h11V6zM4 9h11v1H4V9zm11 3H4v1h11v-1z"/>',
	ordered: '<path fill-rule="evenodd" clip-rule="evenodd" d="M2.287 2.326L2.692 2h.677v3h-.708V2.792l-.374.281v-.747zM5 3h10v1H5V3zm0 4h10v1H5V7zm10 4H5v1h10v-1zM3.742 7.626l.029-.039.065-.09a.84.84 0 0 0 .156-.507c0-.12-.02-.24-.057-.354a.848.848 0 0 0-.492-.529 1.123 1.123 0 0 0-.452-.082 1.094 1.094 0 0 0-.458.087.867.867 0 0 0-.479.522A1.038 1.038 0 0 0 2 6.957v.05h.81v-.05a.3.3 0 0 1 .046-.157.174.174 0 0 1 .057-.054.19.19 0 0 1 .172 0 .188.188 0 0 1 .056.06.24.24 0 0 1 .031.081.445.445 0 0 1-.036.29 1.309 1.309 0 0 1-.12.182l-1 1.138-.012.013v.54h1.988v-.7h-.9l.65-.724zm-.037 3.817c.046.032.086.07.12.114a.841.841 0 0 1 .167.55c0 .107-.017.213-.05.314a.792.792 0 0 1-.487.5 1.288 1.288 0 0 1-.48.079c-.115 0-.23-.016-.341-.049a.94.94 0 0 1-.258-.123.751.751 0 0 1-.182-.177 1.063 1.063 0 0 1-.116-.2A1.038 1.038 0 0 1 2 12.078v-.049h.814v.049c0 .027.003.055.009.082a.207.207 0 0 0 .03.074.14.14 0 0 0 .053.052.2.2 0 0 0 .157.008.159.159 0 0 0 .056-.039.22.22 0 0 0 .042-.075.417.417 0 0 0 .017-.126.483.483 0 0 0-.022-.163.2.2 0 0 0-.051-.08.138.138 0 0 0-.06-.029.537.537 0 0 0-.077-.007h-.161v-.645h.168a.241.241 0 0 0 .069-.011.164.164 0 0 0 .065-.034.175.175 0 0 0 .048-.067.286.286 0 0 0 .021-.121.28.28 0 0 0-.016-.1.166.166 0 0 0-.097-.099.2.2 0 0 0-.156.007.164.164 0 0 0-.055.053.344.344 0 0 0-.04.156v.049H2v-.049a.987.987 0 0 1 .18-.544.8.8 0 0 1 .179-.186.87.87 0 0 1 .262-.133c.114-.036.234-.053.354-.051.116-.001.231.01.344.036.092.021.18.055.263.1a.757.757 0 0 1 .32.318.73.73 0 0 1 .09.347.81.81 0 0 1-.167.528.562.562 0 0 1-.12.114z"/>',
	task: '<path fill-rule="evenodd" clip-rule="evenodd" d="M3.75 4.48h-.71L2 3.43l.71-.7.69.68L4.81 2l.71.71-1.77 1.77zM6.99 3h8v1h-8V3zm0 3h8v1h-8V6zm8 3h-8v1h8V9zm-8 3h8v1h-8v-1zM3.04 7.48h.71l1.77-1.77-.71-.7L3.4 6.42l-.69-.69-.71.71 1.04 1.04zm.71 3.01h-.71L2 9.45l.71-.71.69.69 1.41-1.42.71.71-1.77 1.77zm-.71 3.01h.71l1.77-1.77-.71-.71-1.41 1.42-.69-.69-.71.7 1.04 1.05z"/>',
};

function listGlyph(kind: 'bullet' | 'ordered' | 'task'): React.ReactElement {
	return (
		<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"
			dangerouslySetInnerHTML={{ __html: LIST_GLYPHS[kind] }} />
	);
}

export function StyleMenu({ state, actions }: { state: PageState; actions: PageActions }): React.ReactElement {
	return (
		<DropdownMenu.Root>
			<DropdownMenu.Trigger asChild>
				<button type="button" className="menu__trigger menu__trigger--icon" aria-label={`Paragraph style — ${nameOf(state.block)}`} title={`Paragraph style — ${nameOf(state.block)}`}>
					{styleMark(state.block)}
					<span className="menu__caret" aria-hidden="true"><ChevronDown16Regular /></span>
				</button>
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content className="menu menu--tight" sideOffset={4} align="start">
					{BLOCKS.map(block => (
						<DropdownMenu.Item key={block.level} className="menu__item" onSelect={() => actions.setBlock(block.level)}>
							<span className="menu__item__icon">{block.level === 0 ? '¶' : `H${block.level}`}</span>
							<span className={`menu__sample menu__sample--${block.level}`}>{block.sample}</span>
							{state.block === block.level ? <Checkmark16Regular /> : null}
						</DropdownMenu.Item>
					))}
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	);
}

/** Bullet, numbered and task lists — the three a Markdown page has. */
export function ListMenu({ state, actions }: { state: PageState; actions: PageActions }): React.ReactElement {
	const lists: ReadonlyArray<{ label: string; kind: 'bullet' | 'ordered' | 'task'; active: boolean }> = [
		{ label: 'Bullet list', kind: 'bullet', active: state.lists.bullet },
		{ label: 'Numbered list', kind: 'ordered', active: state.lists.ordered },
		{ label: 'Task list', kind: 'task', active: state.lists.task },
	];
	const active = lists.find(list => list.active)?.kind ?? 'bullet';
	return (
		<DropdownMenu.Root>
			<DropdownMenu.Trigger asChild>
				<button type="button" className="menu__trigger menu__trigger--icon" aria-label={`Lists — ${name}`} title={`Lists — ${name}`}>
					{listGlyph(active)}
					<span className="menu__caret" aria-hidden="true"><ChevronDown16Regular /></span>
				</button>
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content className="menu menu--tight" sideOffset={4} align="start">
					{lists.map(list => (
						<DropdownMenu.Item key={list.label} className="menu__item" onSelect={() => actions.toggleList(list.kind)}>
							<span className="menu__item__icon">{listGlyph(list.kind)}</span>
							<span>{list.label}</span>
							{list.active ? <Checkmark16Regular /> : null}
						</DropdownMenu.Item>
					))}
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	);
}

/**
 * The link editor, as a popover on the button that makes links.
 *
 * There is no "open in browser" here on purpose: a webview cannot open an external address by itself, and a button that
 * says it will and then does nothing is worse than no button.
 */
export function LinkPopover({ state, actions }: { state: PageState; actions: PageActions }): React.ReactElement {
	const [open, setOpen] = React.useState(false);
	const [address, setAddress] = React.useState('');

	React.useEffect(() => {
		if (open) {
			setAddress(state.link ?? 'https://');
		}
	}, [open, state.link]);

	const apply = (): void => {
		if (address.trim() === '') {
			actions.unsetLink();
		} else {
			actions.setLink(address.trim());
		}
		setOpen(false);
	};

	return (
		<Popover.Root open={open} onOpenChange={setOpen}>
			<Popover.Trigger asChild>
				<button
					type="button"
					className={`btn btn--sm btn--ghost${state.link !== undefined ? ' is-on' : ''}`}
					aria-label="Link"
					title="Link"
				>
					<Link16Regular />
				</button>
			</Popover.Trigger>
			<Popover.Portal>
				<Popover.Content className="popover" sideOffset={6} align="start" aria-label="The link address">
					<input
						className="input input--sm popover__field"
						value={address}
						autoFocus
						aria-label="The link address"
						placeholder="https://"
						onChange={event => setAddress(event.target.value)}
						onKeyDown={event => {
							if (event.key === 'Enter') {
								event.preventDefault();
								apply();
							}
						}}
					/>
					<div className="popover__actions">
						<button
							type="button"
							className="btn btn--sm btn--ghost"
							aria-label="Remove the link"
							title="Remove the link"
							onClick={() => {
								actions.unsetLink();
								setOpen(false);
							}}
						>
							<Dismiss16Regular />
						</button>
						<button type="button" className="btn btn--sm btn--primary" onClick={apply}>Apply</button>
					</div>
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	);
}