// The controls a document application asks for by name, drawn in the product's own vocabulary.
//
// These follow the shape of Tiptap's official UI Components (a style menu, a list menu, a link popover) because that is
// the shape a writer already knows; what they do not do is bring its look. They take the engine seam — a state snapshot
// and a set of named operations — so they know nothing about Tiptap, ProseMirror or a document position.

import * as React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Popover from '@radix-ui/react-popover';
import { Checkmark24Regular, ChevronDown16Regular, Dismiss24Regular, Link24Regular } from '@fluentui/react-icons';
import type { PageActions, PageState } from '../page/document';

/** The block types a Markdown page can hold, which is the whole list — no quote, no custom style. */
const BLOCKS: ReadonlyArray<{ level: number; label: string; sample: string }> = [
	{ level: 0, label: 'Text', sample: 'Text' },
	{ level: 1, label: 'Heading 1', sample: 'Heading 1' },
	{ level: 2, label: 'Heading 2', sample: 'Heading 2' },
	{ level: 3, label: 'Heading 3', sample: 'Heading 3' },
	{ level: 4, label: 'Heading 4', sample: 'Heading 4' },
];

const nameOf = (level: number): string => BLOCKS.find(block => block.level === level)?.label ?? 'Text';

export function StyleMenu({ state, actions }: { state: PageState; actions: PageActions }): React.ReactElement {
	return (
		<DropdownMenu.Root>
			<DropdownMenu.Trigger asChild>
				<button type="button" className="menu__trigger" aria-label="Paragraph style" title="Paragraph style">
					<span className="menu__value">{nameOf(state.block)}</span>
					<span className="menu__caret" aria-hidden="true"><ChevronDown16Regular /></span>
				</button>
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content className="menu" sideOffset={4} align="start">
					{BLOCKS.map(block => (
						<DropdownMenu.Item key={block.level} className="menu__item" onSelect={() => actions.setBlock(block.level)}>
							<span className={`menu__sample menu__sample--${block.level}`}>{block.sample}</span>
							{state.block === block.level ? <Checkmark24Regular /> : null}
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
	const name = lists.find(list => list.active)?.label ?? 'Lists';
	return (
		<DropdownMenu.Root>
			<DropdownMenu.Trigger asChild>
				<button type="button" className="menu__trigger" aria-label="Lists" title="Lists">
					<span className="menu__value">{name}</span>
					<span className="menu__caret" aria-hidden="true"><ChevronDown16Regular /></span>
				</button>
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content className="menu" sideOffset={4} align="start">
					{lists.map(list => (
						<DropdownMenu.Item key={list.label} className="menu__item" onSelect={() => actions.toggleList(list.kind)}>
							<span>{list.label}</span>
							{list.active ? <Checkmark24Regular /> : null}
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
					<Link24Regular />
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
							<Dismiss24Regular />
						</button>
						<button type="button" className="btn btn--sm btn--primary" onClick={apply}>Apply</button>
					</div>
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	);
}