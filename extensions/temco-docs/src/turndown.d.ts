// Minimal typing for `turndown`, which ships none upstream.
//
// Only the three members this extension uses are declared. The `replacement` callback receives an HTML element, and
// only `querySelectorAll` and `textContent` are touched — this file declares exactly that rather than pulling the whole
// DOM lib into the extension host, where a `document` global must not exist.
declare module 'turndown' {
	export interface TurndownNode {
		textContent: string | null;
		querySelectorAll(selector: string): ArrayLike<TurndownNode>;
	}

	export interface TurndownRule {
		filter: string;
		replacement: (content: string, node: TurndownNode) => string;
	}

	export interface TurndownOptions {
		headingStyle?: 'setext' | 'atx';
		codeBlockStyle?: 'indented' | 'fenced';
		bulletListMarker?: '-' | '+' | '*';
		emDelimiter?: '_' | '*';
		strongDelimiter?: '__' | '**';
	}

	export default class TurndownService {
		constructor(options?: TurndownOptions);
		addRule(key: string, rule: TurndownRule): this;
		turndown(html: string): string;
	}
}
