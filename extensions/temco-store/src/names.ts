// The names the store is keyed by.
//
// A slug is what every table here uses as a key for a thing a person named — a project, a source. It is derived
// once, in one place, because a name typed in a form, a folder a repository was cloned into and a row in the
// database have to agree about the same project, and a second copy of this rule is a second answer.

/** A name as the database keys it: lower case, runs of anything else become one dash, no dashes on the ends. */
export function slugOf(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}
