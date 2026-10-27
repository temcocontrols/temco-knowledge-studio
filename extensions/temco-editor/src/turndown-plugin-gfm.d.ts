// `turndown-plugin-gfm` ships no types and has no `@types` package, so the one export this module uses is declared here.

declare module 'turndown-plugin-gfm' {
	export const gfm: (service: unknown) => void;
	export const tables: (service: unknown) => void;
	export const strikethrough: (service: unknown) => void;
	export const taskListItems: (service: unknown) => void;
}
