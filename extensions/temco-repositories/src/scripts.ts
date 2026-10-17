// The repository's own documentation scripts.
//
// A vocabulary rather than a runner: what a repository can be asked to do about its own documentation, and what
// each one is for. It lives with the repository's business because that is whose scripts they are — the runner
// stays in the documentation module (`builds.ts`), because it is driven by *the registries being read*, which is
// that module's model: one folder at a time, the folder that carries the script.
//
// A project reads this list to know which of them its own sources actually have; the documentation module reads
// it to say which of them a folder carries. The definitions are the product repositories' own `package.json`
// scripts, and this application never reimplements any of them.
//
// An allowlist rather than a parameter, because the caller on the other side of a webview must not be able to
// name *any* npm script: `build:help` deploys into a product installation, and `docs:clean` rewrites page prose
// rather than reporting on it. Invoking the generator is in a different class: it writes the files it exists to
// write, in its own format, and this application never reimplements any of it.

/** One script of the repository's own documentation work that this application is willing to run. */
export interface OfferedScript {
	id: string;
	label: string;
	detail: string;
}

export const OFFERED_SCRIPTS: readonly OfferedScript[] = [
	{
		id: 'docs:registry',
		label: 'Regenerate the index',
		detail: 'the generator: index.json · page-meta.json · the navbar · toc.yml · docfx.json · _admin',
	},
	{
		id: 'docs:verify',
		label: 'Run the gates',
		detail: 'registry:check + the blocking audit + the media check — what a pull request has to pass',
	},
	{
		id: 'docs:media:check',
		label: 'The media audit',
		detail: 'image names, reading order, size, duplicates, and files no page references',
	},
	{
		id: 'docs:owed',
		label: 'Documentation owed',
		detail: 'the product repository own gate — a claimed feature changed and its page did not',
	},
];
