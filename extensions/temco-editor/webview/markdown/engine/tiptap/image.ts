// The picture, and the one thing a Markdown file cannot say: how wide it is.
//
// Tiptap's own `Image`, extended twice.
//
// `resize` is the engine's block-level drag — the handles that appear on a selected picture — and it writes the size into
// the node's `width`/`height` attributes. A size that lives only in the node would be a lie: the next save would drop it.
// Markdown has no syntax for a width, so it rides in the title, which does survive:
//
//     ![The cabinet](media/cabinet.png "w=480")
//
// `marked` reads that title back (`parseHTML` turns it into the attribute) and `src/markdown.ts` writes it out again, so a
// resized picture keeps its width in the file. Percentages are the widths the selection menu offers; pixels are what a
// drag produces.

import Image from '@tiptap/extension-image';

/** The width a title carries: `w=480` or `w=50%`. */
export const WIDTH_IN_TITLE = /^w=(\d+%?)$/;

export const ImageWithSize = Image.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			width: {
				default: null,
				// The title first: it is what the file carries. `width` next, for HTML that arrived from somewhere else.
				parseHTML: (element: HTMLElement): string | null => {
					const carried = WIDTH_IN_TITLE.exec(element.getAttribute('title') ?? '')?.[1];
					return carried ?? element.getAttribute('width');
				},
				renderHTML: (attributes: Record<string, unknown>): Record<string, unknown> =>
					attributes.width === null || attributes.width === undefined ? {} : { width: attributes.width },
			},
		};
	},
});
