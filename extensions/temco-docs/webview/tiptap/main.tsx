// The bridge between the VS Code document and the official Tiptap Simple Editor template.
//
// The template (`tiptap-template/`) is the one installed by `npx @tiptap/cli add simple-editor` — 161 files of MIT
// React components, node views and SCSS, used as they ship. This file is the only glue:
//
//   * it mounts `<SimpleEditor />` into the webview,
//   * it tells the SCSS which colour scheme the window is using, because VS Code sets `vscode-dark` / `vscode-light`
//     on `<body>` rather than the `.dark` class the template expects.
//
// Nothing about the template's appearance or behaviour is reimplemented here. When Tiptap update the template, replacing
// the folder and keeping this file is the whole upgrade. The document bridge itself lives in `simple-editor.tsx`, which
// is the template's own entry component adapted for a Markdown file.

import { createRoot } from 'react-dom/client';
import { SimpleEditor } from './simple-editor';
import './entry.scss';

const root = document.getElementById('root');

/** The template styles light and dark with a `.dark` class on `<body>`; VS Code declares it with its own classes. */
function syncScheme(): void {
	const dark =
		document.body.classList.contains('vscode-dark') ||
		document.body.classList.contains('vscode-high-contrast');
	document.body.classList.toggle('dark', dark);
}

if (root !== null) {
	syncScheme();
	new MutationObserver(syncScheme).observe(document.body, { attributes: true, attributeFilter: ['class'] });
	createRoot(root).render(<SimpleEditor />);
}
