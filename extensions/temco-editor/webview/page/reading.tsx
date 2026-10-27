// Reading: the same page, with no editor behind it.
//
// In Read mode the document is the markup the editor last produced — no caret, no drag handle, no selection menu, and
// nothing to type into. It is not a different renderer: the markup is the editor's own `getHTML()`, so what is read is
// what will be written, and the typography does not change between the two modes.

import * as React from 'react';

export function StaticPage({ html }: { html: string }): React.ReactElement {
	return (
		<div
			className="doc-surface__doc doc-surface__doc--reading"
			aria-readonly="true"
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
}
