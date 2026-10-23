// The buttons the template does not ship, in one group each.
//
// Three things this documentation writes constantly and the Simple Editor template has no control for: a table, a DocFX
// callout, and a formula. They are ordinary template buttons, so they inherit the bar's styling and keyboard reach.
//
// Each one inserts a *node*, not Markdown text, and the official serializer turns that node back into the syntax the
// build reads — which is why a callout inserted here is a real `> [!NOTE]` in the file and a table is GFM pipes.

import type { Editor } from '@tiptap/react';
import { useTiptapEditor } from '@/hooks/use-tiptap-editor';
import { Button } from '@/components/tiptap-ui-primitive/button';

const ICONS = {
	table: 'M3 4h18v16H3zm2 2v3h6V6zm8 0v3h6V6zM5 11v3h6v-3zm8 0v3h6v-3zM5 16v2h6v-2zm8 0v2h6v-2z',
	note: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2zm0-8h-2V7h2z',
	tip: 'M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2zM9.5 18.5h5V20h-5z',
	warning: 'M12 2 1 21h22zm1 15h-2v2h2zm0-7h-2v5h2z',
	math: 'M4 5h16v2.5h-9.2l4.3 5.4-4.6 5.6H20V21H4v-2.5h3.2l4.4-5.4-4.1-5.1H4z',
	blockMath: 'M3 4h18v3H3zm0 6.5h18v3H3zM3 17h18v3H3z',
	outline: 'M3 5h4v2H3zm6 0h12v2H9zM3 11h4v2H3zm6 0h12v2H9zM3 17h4v2H3zm6 0h12v2H9z',
} as const;

function Icon({ path }: { path: string }) {
	return (
		<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="tiptap-button-icon" aria-hidden="true">
			<path fill="currentColor" d={path} />
		</svg>
	);
}

/** One of the DocFX renders: `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`. */
function callout(editor: Editor | null, kind: 'NOTE' | 'TIP' | 'WARNING'): void {
	const label = kind.charAt(0) + kind.slice(1).toLowerCase();
	editor
		?.chain()
		.focus()
		.insertContent({
			type: 'blockquote',
			content: [{ type: 'paragraph', content: [{ type: 'text', text: `[!${kind}] ${label} — ` }] }],
		})
		.run();
}

/** A formula, from a prompt. `$…$` inline, `$$…$$` on its own line. */
function formula(editor: Editor | null, block: boolean): void {
	const latex = window.prompt(block ? 'LaTeX block — written as $$…$$' : 'LaTeX — written as $…$', '');
	if (latex === null || latex.trim().length === 0) {
		return;
	}
	editor
		?.chain()
		.focus()
		.insertContent({ type: block ? 'blockMath' : 'inlineMath', attrs: { latex: latex.trim() } })
		.run();
}

/** The parts, as separate exports so the template's bar can place them where it wants them. */
export function TableButton() {
	const { editor } = useTiptapEditor();
	return (
		<Button
			type="button"
			variant="ghost"
			data-style="ghost"
			tooltip="Insert a table"
			aria-label="Insert a table"
			onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
		>
			<Icon path={ICONS.table} />
		</Button>
	);
}

export function CalloutButtons() {
	const { editor } = useTiptapEditor();
	return (
		<>
			<Button type="button" variant="ghost" data-style="ghost" tooltip="Note — > [!NOTE]" aria-label="Note callout" onClick={() => callout(editor, 'NOTE')}>
				<Icon path={ICONS.note} />
			</Button>
			<Button type="button" variant="ghost" data-style="ghost" tooltip="Tip — > [!TIP]" aria-label="Tip callout" onClick={() => callout(editor, 'TIP')}>
				<Icon path={ICONS.tip} />
			</Button>
			<Button type="button" variant="ghost" data-style="ghost" tooltip="Warning — > [!WARNING]" aria-label="Warning callout" onClick={() => callout(editor, 'WARNING')}>
				<Icon path={ICONS.warning} />
			</Button>
		</>
	);
}

export function MathButtons() {
	const { editor } = useTiptapEditor();
	return (
		<>
			<Button type="button" variant="ghost" data-style="ghost" tooltip="Inline maths — $…$" aria-label="Inline maths" onClick={() => formula(editor, false)}>
				<Icon path={ICONS.math} />
			</Button>
			<Button type="button" variant="ghost" data-style="ghost" tooltip="Maths block — $$…$$" aria-label="Maths block" onClick={() => formula(editor, true)}>
				<Icon path={ICONS.blockMath} />
			</Button>
		</>
	);
}

export function OutlineToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
	return (
		<Button
			type="button"
			variant="ghost"
			data-style="ghost"
			data-active-state={open ? 'on' : 'off'}
			tooltip="Outline panel"
			aria-label="Outline panel"
			aria-pressed={open}
			onClick={onToggle}
		>
			<Icon path={ICONS.outline} />
		</Button>
	);
}
