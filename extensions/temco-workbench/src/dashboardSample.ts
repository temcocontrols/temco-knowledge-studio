// The dashboard's sample.
//
// The mock's Dashboard is about the platform as a whole — every module's numbers in one place — and this application
// does not yet have one query that returns them. Until it does, the page reads this table: the mock's own numbers,
// carried over so the layout can be judged. It lives in one file, so the day the numbers come from the modules this
// file is deleted and nothing on the page changes.

export const KPIS = [
	{ label: 'Pages', value: '1,254', note: '8 areas · 13.0 in flight' },
	{ label: 'Sources', value: '7', note: '4 repositories · 3 libraries' },
	{ label: 'Devices', value: '31 / 34', note: '3 not answering' },
	{ label: 'Waiting review', value: '17', note: '6 owned by Derek' }
];

export const PIPELINE = [
	{ n: '01', name: 'Sources', meta: '7 read', view: 'temcoRepositories.page' },
	{ n: '02', name: 'Documents', meta: '1,254 pages', view: 'temcoDocs.overview' },
	{ n: '03', name: 'Review', meta: '17 waiting', view: 'temcoDocs.stalenessReport' },
	{ n: '04', name: 'Build', meta: '4 targets', view: 'temcoDocs.buildSite' },
	{ n: '05', name: 'Publish', meta: '13.0 ready', view: 'temcoDocs.buildHelp' }
];

export interface Event {
	module: string;
	icon: string;
	tone: 'ok' | 'warn' | 'err' | 'info';
	title: string;
	sub: string;
	when: string;
}

export const ACTIVITY_TODAY: Event[] = [
	{ module: 'Documentation', icon: 'upload', tone: 'ok', title: 'Build 13.0 finished the site, the PDF and the search index', sub: 't3000 · 1,254 pages · 4 minutes', when: '12:41' },
	{ module: 'Documentation', icon: 'check', tone: 'ok', title: '48 pages approved in API Reference', sub: 'reviewed by Mei', when: '11:58' },
	{ module: 'Devices', icon: 'chip', tone: 'warn', title: 'T3-22I stopped answering', sub: 'Lab Wing · last seen 10:38', when: '10:38' },
	{ module: 'Documentation', icon: 'repo', tone: 'info', title: 't3000webview read at 4de5eda', sub: '138 pages · 3 new', when: '09:21' },
	{ module: 'AI', icon: 'sparkle', tone: 'info', title: 'Draft accepted on “Data Points API”', sub: '2 citations', when: '08:55' }
];

export const ACTIVITY_YESTERDAY: Event[] = [
	{ module: 'Documentation', icon: 'upload', tone: 'ok', title: 'Release 12.9 archived', sub: 't3000 · kept for pinned links', when: '17:20' },
	{ module: 'Devices', icon: 'package', tone: 'info', title: 'Firmware 2.14.3 staged for 6 devices', sub: 'Fleet', when: '10:15' },
	{ module: 'Devices', icon: 'download', tone: 'info', title: 'Firmware 2.15.0-rc2 downloaded', sub: 'Preview channel · 3.9 MB', when: '09:04' },
	{ module: 'Documentation', icon: 'link', tone: 'warn', title: 'SharePoint source needs re-authorisation', sub: 'Field Notes · expired 8 days ago', when: '08:32' }
];

export const ACTIVITY_WEEK: Event[] = [
	{ module: 'Documentation', icon: 'repo', tone: 'info', title: 'Source bacnet-stack read', sub: '52 pages found', when: 'Tue' },
	{ module: 'Documentation', icon: 'check', tone: 'ok', title: '48 pages reviewed by Mei', sub: 'api-reference', when: 'Mon' },
	{ module: 'Documentation', icon: 'package', tone: 'info', title: 'Project T3-8R Hardware Guide created', sub: 'from the Hardware template', when: 'Sun' }
];

export const NEEDS = [
	{ title: 'Two pages claim order 20 in Protocol', issue: 'duplicate order_key · build refused', tone: 'err' as const },
	{ title: 'Data Points API is behind its source', issue: 'a commit touched the code it describes', tone: 'warn' as const },
	{ title: '4 pages have no owner', issue: 'nobody is told when they go stale', tone: 'info' as const },
	{ title: '3 links point at pages that no longer exist', issue: 'internal link check', tone: 'warn' as const }
];

export const COVERAGE = [
	{ area: 'Hardware', pages: 216, reviewed: 88, stale: 21 },
	{ area: 'Firmware', pages: 198, reviewed: 74, stale: 18 },
	{ area: 'Protocol', pages: 174, reviewed: 65, stale: 14 },
	{ area: 'Getting Started', pages: 142, reviewed: 92, stale: 11 },
	{ area: 'API Reference', pages: 168, reviewed: 58, stale: 9 },
	{ area: 'Troubleshooting', pages: 132, reviewed: 61, stale: 8 },
	{ area: 'Release Notes', pages: 118, reviewed: 80, stale: 5 },
	{ area: 'Glossary', pages: 106, reviewed: 45, stale: 3 }
];

export const CHECKS = [
	{ name: 'Duplicate order keys', found: 2, tone: 'err' as const, detail: 'two pages claim 20 in Protocol' },
	{ name: 'Page without an owner', found: 4, tone: 'warn' as const, detail: 'nobody is told when they go stale' },
	{ name: 'Internal links', found: 12, tone: 'warn' as const, detail: '12 of 1,266 links point at a page that is gone' },
	{ name: 'Never reviewed', found: 341, tone: 'info' as const, detail: 'the bulk of the set — counted, not listed' },
	{ name: 'Shipped pages', found: 1198, tone: 'ok' as const, detail: '56 pages are drafts' }
];
