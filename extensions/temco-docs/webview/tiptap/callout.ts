// A DocFX callout is a blockquote whose first text is `[!NOTE]`, `[!TIP]` or `[!WARNING]`.
//
// The marker is content — the documentation build reads it — so it stays in the file and is only *decorated* here: the
// blockquote gets the kind's class and the marker itself is hidden, so the page reads like the published alert while the
// Markdown keeps the text the build needs. Nothing is written, so opening and closing a page is byte-identical.

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const KINDS = 'NOTE|TIP|WARNING';

export const CalloutLook = Extension.create({
	name: 'calloutLook',

	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey('temcoCallouts'),
				props: {
					decorations(state) {
						const found: Decoration[] = [];
						state.doc.descendants((node, position) => {
							if (node.type.name !== 'blockquote' || node.childCount === 0) {
								return;
							}
							const first = node.child(0);
							const lead = first.textBetween(0, Math.min(first.content.size, 16), ' ');
							const match = new RegExp(`^\\[!(${KINDS})\\]`).exec(lead);
							if (match === null) {
								return;
							}
							const kind = match[1].toLowerCase();
							found.push(
								Decoration.node(position, position + node.nodeSize, {
									class: 'callout',
									'data-callout': kind,
								})
							);
							// The marker sits at the start of the first paragraph; hide it, keep the text after it.
							const start = position + 2;
							found.push(Decoration.inline(start, start + match[0].length, { class: 'callout__marker' }));
						});
						return DecorationSet.create(state.doc, found);
					},
				},
			}),
		];
	},
});
