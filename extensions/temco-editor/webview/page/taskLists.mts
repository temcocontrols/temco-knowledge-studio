// Task lists that survive the file, in both directions.
//
// A page writes `- [x] done`. `marked` reads that as `<ul><li><input type="checkbox" checked> done</li></ul>`, but
// Tiptap's own task list is `ul[data-type="taskList"] > li[data-type="taskItem"]` — two different shapes. Without the
// rules below the checkbox is dropped on the way in (the page opened as a plain bullet list) and again on the way out
// (`src/markdown.ts` reads it back). Both shapes are accepted here; the editor still renders its own one.
//
// The parse rules are priority 52: above `ul` (bullet list, 50), `li` (list item, 50) and above Tiptap's own 51. A
// `getAttrs` that returns `false` makes ProseMirror try the next rule, so a list without checkboxes stays a bullet list.
//
// The `checked` attribute is parsed in `addAttributes`, not in `getAttrs`: Tiptap merges an extension's attribute parsers
// *over* the result of a rule's `getAttrs`, so a value returned from the rule would be replaced by the default parser —
// which only knows `data-checked` and reads `false` for the shape `marked` writes.

import { TaskItem, TaskList } from '@tiptap/extension-list';

/**
 * The checkbox that belongs to *this* list item.
 *
 * `querySelector` finds a nested list's checkbox too, so the item is only claimed when the closest `li` of the input is
 * the item itself — otherwise a bullet list wrapping a task list would be read as a task list.
 */
function ownCheckbox(element: HTMLElement): HTMLInputElement | null {
	const checkbox = element.querySelector<HTMLInputElement>('input[type="checkbox"]');
	if (checkbox === null) {
		return null;
	}
	return checkbox.closest('li') === element ? checkbox : null;
}

/** Whether any of this list's own items carries a checkbox. */
function anyCheckbox(element: HTMLElement): boolean {
	for (const child of Array.from(element.children)) {
		if (child.nodeName === 'LI' && ownCheckbox(child as HTMLElement) !== null) {
			return true;
		}
	}
	return false;
}

export const TaskListWithCheckboxes = TaskList.extend({
	parseHTML() {
		return [
			...(this.parent?.() ?? []),
			{
				tag: 'ul',
				priority: 52,
				getAttrs: element => (anyCheckbox(element as HTMLElement) ? {} : false),
			},
		];
	},
});

export const TaskItemWithCheckboxes = TaskItem.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			checked: {
				default: false,
				keepOnSplit: false,
				parseHTML: element => {
					const dataChecked = element.getAttribute('data-checked');
					if (dataChecked !== null) {
						return dataChecked === '' || dataChecked === 'true';
					}
					// The shape a Markdown parser writes: the tick is the input's attribute, not the item's.
					return ownCheckbox(element as HTMLElement)?.hasAttribute('checked') ?? false;
				},
				renderHTML: attributes => ({ 'data-checked': attributes.checked }),
			},
		};
	},

	parseHTML() {
		return [
			...(this.parent?.() ?? []),
			{
				tag: 'li',
				priority: 52,
				getAttrs: element => (ownCheckbox(element as HTMLElement) === null ? false : {}),
				// `marked` leaves the words directly in the item, with no wrapper element to descend into.
				contentElement: element => element as HTMLElement,
			},
		];
	},
});
