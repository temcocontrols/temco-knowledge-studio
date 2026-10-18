// The sample the SQL Studio pages are drawn from, and the query state their buttons change.
//
// The registry's areas are the mock's (`docs/mock/js/data.js`: `knowledge`) — the same eight the Documentation module
// draws its Coverage page from, which is the point of the Query Editor: it reads the numbers one page counts. The
// connections, tables, columns, saved queries and history are already in `data.ts`, because those are what the studio
// is *about* rather than what one page happens to show.
//
// Mutable for the same reason the other studios' samples are: with no database engine in this build, a Run has to
// change what the register says. It changes only what can honestly change — the statement's timestamp, its history
// row, and the result the area table supports.

export interface AreaRow {
	area: string;
	pages: number;
	reviewed: number;
	stale: number;
	desc: string;
}

/** The eight knowledge areas. Totals: 1,254 pages, 913 reviewed, 89 stale — the numbers the build's reports quote. */
export const KNOWLEDGE: AreaRow[] = [
	{ area: 'Overview', pages: 24, reviewed: 24, stale: 0, desc: 'What the platform is, in one sitting' },
	{ area: 'Getting Started', pages: 56, reviewed: 47, stale: 3, desc: 'Install, connect, and a first point that answers' },
	{ area: 'Architecture', pages: 92, reviewed: 82, stale: 3, desc: 'How the controller, the points and the schedules fit' },
	{ area: 'API Reference', pages: 402, reviewed: 194, stale: 45, desc: 'Endpoints, schemas and the scale factor of every type' },
	{ area: 'Hardware', pages: 208, reviewed: 186, stale: 6, desc: 'Controllers, terminals, power and wiring diagrams' },
	{ area: 'Protocols', pages: 268, reviewed: 196, stale: 25, desc: 'Modbus, BACnet and MSTP, with worked examples' },
	{ area: 'Troubleshooting', pages: 148, reviewed: 128, stale: 7, desc: 'The failures people actually call about' },
	{ area: 'Release Notes', pages: 56, reviewed: 56, stale: 0, desc: 'What changed, version by version' }
];

/** The stale count per area, newest problem first — what `Stale pages by area` returns. */
export function staleByArea(): AreaRow[] {
	return [...KNOWLEDGE].sort((left, right) => right.stale - left.stale);
}

/** The statement the editor is showing, and what the last run of it said. */
export let queryStatement = "SELECT a.name AS area, count(*) AS stale\nFROM pages p JOIN areas a ON a.id = p.area_id\nWHERE p.state = 'stale'\nGROUP BY a.name\nORDER BY stale DESC;";
export let queryRun = 'ran 4 minutes ago';

export function setStatement(sql: string): void {
	queryStatement = sql;
}

export function recordRun(when: string): void {
	queryRun = `ran ${when}`;
}

/**
 * Whether a statement writes.
 *
 * The connection it runs against is read-only, so this is not a safety check — it is the honest answer to "what will
 * happen", said before the run rather than after the refusal.
 */
export function isWrite(statement: string): boolean {
	return /^\s*(UPDATE|INSERT|DELETE|DROP|ALTER|CREATE|REPLACE)\b/i.test(statement);
}

/** The tables a statement names, so Explain can say what it would touch without a planner. */
export function referencedTables(statement: string): string[] {
	const names = new Set<string>();
	for (const match of statement.matchAll(/\b(?:FROM|JOIN)\s+([A-Za-z_][A-Za-z0-9_]*)/gi)) {
		names.add(match[1]);
	}
	return [...names];
}
