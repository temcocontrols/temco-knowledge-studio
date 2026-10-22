// Page properties — the registry fields a person curates, for the page in front.
//
// They are the **Properties** tab of the right panel, beside the draft: one place that is about the page you are
// looking at. The write is `docs/help/registry.json` through `RegistryEdit`, the same write the rest of the module
// uses, so nothing here re-implements that file and the repository's generator keeps every value written here.
//
// What it does not offer is as deliberate as what it does: header, footer and page numbering belong to the printed
// profile, not to a topic, and a body is edited in the editor rather than in a form.

import * as vscode from 'vscode';
import { DocsRoot, PageEntry, collectPages } from './registry';
import { RegistryEdit } from './registryEdit';
import { escapeHtml as esc } from './ui';

export interface Field {
	key: string;
	label: string;
	hint: string;
	kind: 'text' | 'number' | 'check' | 'list';
}

/** The registry's own names, so nothing has to be translated on the way to disk. */
export const FIELDS: Field[] = [
	{ key: 'title', label: 'Title', hint: 'What the topic is called in the tree and at the top of the page.', kind: 'text' },
	{ key: 'owner', label: 'Owner', hint: 'Who answers for this page.', kind: 'text' },
	{ key: 'audience', label: 'Audience', hint: 'Who it is written for.', kind: 'text' },
	{ key: 'order', label: 'Order', hint: 'Position inside its chapter. The generator hands out 10, 20, 30 to whatever nobody curated.', kind: 'number' },
	{ key: 'ship', label: 'Ships', hint: 'The export condition: a page that does not ship is in neither the site nor the offline help.', kind: 'check' },
	{ key: 'keywords', label: 'Keywords', hint: 'Index entries, separated by commas — what a reader searches for.', kind: 'list' },
	{ key: 'tags', label: 'Tags', hint: 'Search facets, separated by commas.', kind: 'list' },
	{ key: 'help_ids', label: 'Help context IDs', hint: 'The IDs the application asks for when a person presses Help. Separated by commas.', kind: 'list' }
];

/** The page whose file is in front, and the root it belongs to. */
interface Located {
	root: DocsRoot;
	entry: PageEntry;
}


/** The registry entry of the page whose file is `uri`, and the root it came from. */
export function locate(roots: readonly DocsRoot[], uri: vscode.Uri): Located | undefined {
	const wanted = uri.toString();
	for (const root of roots) {
		const entry = collectPages(root).find((page) => page.uri.toString() === wanted);
		if (entry !== undefined) {
			return { root, entry };
		}
	}
	return undefined;
}

/**
 * What the form starts with: the curated entry where it has a value, and what the tree already knows where it
 * does not — so an empty field means "not curated", never "not known".
 */
export function read(edit: RegistryEdit, entry: PageEntry): Record<string, string | number | boolean> {
	const raw = edit.entry(entry.id) ?? {};
	const text = (key: string, fallback: string): string => {
		const value = raw[key];
		return typeof value === 'string' ? value : fallback;
	};
	const list = (key: string, fallback: readonly string[]): string => {
		const value = raw[key];
		return Array.isArray(value) ? value.map((item) => String(item)).join(', ') : fallback.join(', ');
	};

	return {
		title: text('title', entry.title),
		owner: text('owner', entry.owner),
		audience: text('audience', entry.audience),
		order: typeof raw['order'] === 'number' ? raw['order'] : entry.order,
		ship: typeof raw['ship'] === 'boolean' ? raw['ship'] : entry.ship,
		keywords: list('keywords', entry.keywords),
		tags: list('tags', entry.tags),
		help_ids: list('help_ids', [])
	};
}

/** One posted value, in the shape the registry holds it. An empty field is removed rather than written as `""`. */
export function normalise(field: Field, posted: unknown): unknown {
	if (field.kind === 'check') {
		return posted === true;
	}
	if (field.kind === 'number') {
		const number = Number(posted);
		return Number.isFinite(number) ? number : undefined;
	}
	if (field.kind === 'list') {
		const items = String(posted ?? '')
			.split(',')
			.map((item) => item.trim())
			.filter((item) => item.length > 0);
		return items.length > 0 ? items : undefined;
	}
	const text = String(posted ?? '').trim();
	return text.length > 0 ? text : undefined;
}

export const control = (field: Field, value: string | number | boolean): string => {
	const id = `prop-${field.key}`;
	if (field.kind === 'check') {
		return `<label class="check"><input type="checkbox" id="${id}" data-field="${field.key}"${value === true ? ' checked' : ''}><span>Include this page in the built output</span></label>`;
	}
	if (field.kind === 'number') {
		return `<input class="input" id="${id}" type="number" data-field="${field.key}" value="${esc(String(value))}">`;
	}
	return `<input class="input" id="${id}" data-field="${field.key}" value="${esc(String(value))}">`;
};
