// The three buttons that belong to this extension rather than to the Tiptap template: preview, diff, source.
//
// They are ordinary template buttons in a trailing group, so they look and behave like the rest of the bar. Each posts
// one message and does nothing else — the extension decides what a preview or a diff means.

import { Button } from '@/components/tiptap-ui-primitive/button';
import { ToolbarGroup } from '@/components/tiptap-ui-primitive/toolbar';
import { post } from './document';

/** One icon, drawn plainly: these three are the only shapes the template does not already ship. */
function Icon({ path }: { path: string }) {
	return (
		<svg
			viewBox="0 0 24 24"
			xmlns="http://www.w3.org/2000/svg"
			className="tiptap-button-icon"
			aria-hidden="true"
		>
			<path fill="currentColor" d={path} />
		</svg>
	);
}

const PREVIEW =
	'M12 5C6.2 5 1.9 11.1 1.9 11.6a.9.9 0 0 0 0 .8C1.9 12.9 6.2 19 12 19s10.1-6.1 10.1-6.6a.9.9 0 0 0 0-.8C22.1 11.1 17.8 5 12 5zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z';
const DIFF = 'M4 3h7v18H4zm9 0h7v18h-7zM5.5 6h4v1.5h-4zm0 4h4v1.5h-4zm9-4h4v1.5h-4zm0 4h4v1.5h-4z';
const SOURCE =
	'M9.2 4.6 2.8 12l6.4 7.4 1.4-1.2L5.4 12l5.2-6.2zm5.6 0-1.4 1.2 5.2 6.2-5.2 6.2 1.4 1.2L21.2 12z';

const ACTIONS = [
	{ key: 'preview', label: 'Preview the page', path: PREVIEW },
	{ key: 'diff', label: 'Diff with HEAD', path: DIFF },
	{ key: 'source', label: 'Back to the source editor', path: SOURCE },
] as const;

export function DocumentActions() {
	return (
		<ToolbarGroup>
			{ACTIONS.map((action) => (
				<Button
					key={action.key}
					type="button"
					variant="ghost"
					data-style="ghost"
					tooltip={action.label}
					aria-label={action.label}
					className="tiptap-button tiptap-docaction"
					onClick={() => post('action', { action: action.key })}
				>
					<Icon path={action.path} />
				</Button>
			))}
		</ToolbarGroup>
	);
}
