// Minimal typing for `turndown`, which ships none upstream.
//
// Only the members this module uses are declared, so the extension host is not typed against the DOM — a `document`
// global must not exist there.

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
