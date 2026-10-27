// The status-bar line: what this window's documentation is, in the one place a person looks without being asked.
//
// The line is a pure function of the facts, so the arithmetic of "which project, how many pages, is anything wrong" is
// checkable without an editor — and the phrasing is checked, because a status bar that says "0 issues" is noise while
// "3 issues" is a reason to click.
//
// What it does not carry: the version and the last build. Those live in the Project strip (`panelView.ts`), which reads the
// catalog when it renders; putting them here would mean opening the catalog on every file save, and a status bar is not
// worth a database read per keystroke.

export interface StatusFacts {
	/** The project being worked on, when one is selected. */
	project?: string;
	sources: number;
	pages: number;
	issues: number;
	neverReviewed: number;
	/** Registry files that could not be read: an error, not a warning. */
	unreadable: number;
	owed: number;
}

export interface StatusLine {
	text: string;
	tooltip: string;
}

/** The longest a project name may run in the text before it is shortened: the bar is shared with everything else. */
const NAME_LIMIT = 26;

/** Counts, phrased the way a person says them: "no pages yet" is not "0 pages". */
export function count(value: number, one: string, many: string): string {
	return value === 0 ? `no ${many}` : `${value} ${value === 1 ? one : many}`;
}

export function shorten(name: string, limit = NAME_LIMIT): string {
	return name.length <= limit ? name : `${name.slice(0, limit - 1).trimEnd()}…`;
}

/**
 * The line, or nothing.
 *
 * Nothing at all is returned when there is no documentation in the window: an item that reads "0 pages" is a permanent
 * accusation about a project that may simply not have been started yet.
 */
export function statusLine(facts: StatusFacts): StatusLine | undefined {
	if (facts.pages === 0 && facts.unreadable === 0) {
		return undefined;
	}
	const head = facts.project === undefined
		? `$(book) ${count(facts.pages, 'page', 'pages')}`
		: `$(book) ${shorten(facts.project)} · ${count(facts.pages, 'page', 'pages')}`;
	// One icon at a time, and the icon is the whole message: an error outranks a warning, a warning outranks silence.
	const mark = facts.unreadable > 0
		? ` · $(error) ${facts.unreadable}`
		: facts.issues > 0
			? ` · $(warning) ${facts.issues}`
			: '';
	return {
		text: `${head}${mark}`,
		tooltip: tooltipOf(facts)
	};
}

function tooltipOf(facts: StatusFacts): string {
	const lines: string[] = [];
	if (facts.project !== undefined) {
		lines.push(facts.project);
	}
	lines.push([
		count(facts.pages, 'page', 'pages'),
		count(facts.issues, 'issue', 'issues'),
		`${facts.neverReviewed} never reviewed`
	].join(' · '));
	lines.push([
		count(facts.sources, 'source', 'sources'),
		facts.owed === 0 ? 'nothing waiting for you' : `${facts.owed} waiting for you`
	].join(' · '));
	if (facts.unreadable > 0) {
		lines.push(`${facts.unreadable} registry ${facts.unreadable === 1 ? 'file' : 'files'} could not be read`);
	}
	lines.push('Click to run Validate.');
	return lines.join('\n');
}
