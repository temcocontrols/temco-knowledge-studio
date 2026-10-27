// Reading: the same page, with no engine at all.
//
// This file exists to prove the seam. Read mode needs exactly one thing the editor cannot give it: markup that cannot be
// typed into. `staticNode` is that, and it is why the arrangement is real rather than a demonstration — a page being read
// should not be a page being one keystroke from changing. In Read mode the document is plain markup, so there is nothing to
// focus, nothing to type into, and no undo history to get lost in — the arrangement every document application calls Read
// Mode. The ribbon is the same component, showing only its View tab, so there is no second bar to keep in step.
//
// The markup is the editor's own `getHTML()`, produced by our schema, so it needs no sanitising beyond that: nothing here
// accepts HTML from a file or from the network.

import * as React from 'react';

/** The document as markup, in the same box the editor would use — so the typography and the measure do not change. */
export function staticNode(html: string): React.ReactElement {
	return <div className="page-surface__doc page-surface__doc--reading" dangerouslySetInnerHTML={{ __html: html }} />;
}
