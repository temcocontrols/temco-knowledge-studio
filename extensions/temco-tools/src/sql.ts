// SQL Studio — the six surfaces behind the container, rebuilt from the mock.
//
// Source: `docs/mock/js/views.industrial.js` (`sql/query`, `sql/connections`, `sql/schema`, `sql/saved`,
// `sql/history`, `sql/reports`) and the mock's side bar, which splits them into **Workbench** and **Docs Database**
// (`docs/mock/js/data.js`).
//
// This is the studio that is pointed at one database — the documentation registry — because that is the database this
// window is about. The result table on the Query Editor is computed from the area table (`sqlSample.ts`), not typed
// out, so the row count and the 89 stale pages are the same arithmetic the Coverage page does.
//
// **A write is refused by the connection, not by the editor.** Run reads the statement first and says which of the two
// happened; a refused statement is kept in the history, because what the connection would not do is part of the
// record.

import * as vscode from 'vscode';
import { CONNECTIONS, REPORTS, SQL_COLUMNS, SQL_HISTORY, SQL_QUERIES, SQL_TABLES } from './data';
import {
	isWrite, queryRun, queryStatement, recordRun, referencedTables, setStatement, staleByArea
} from './sqlSample';
import { PageMessage, commandScript, esc, icon, page, pageColumn, toneMark } from './ui';

/** One surface of the SQL container: the row, the command, and the page it draws. */
export interface SqlPage {
	id: string;
	label: string;
	note: string;
	mark: string;
	command: string;
	viewType: string;
	group: 'workbench' | 'docs';
}

export const SQL_PAGES: SqlPage[] = [
	{ id: 'query', label: 'Query Editor', note: 'the registry, asked in SQL', mark: 'code', command: 'temcoTools.sql.query', viewType: 'temcoTools.sql.query', group: 'workbench' },
	{ id: 'connections', label: 'Connections', note: 'the registry, and the copies other things read', mark: 'database', command: 'temcoTools.sql.connections', viewType: 'temcoTools.sql.connections', group: 'workbench' },
	{ id: 'history', label: 'History', note: 'what was run in this window, in order', mark: 'clock', command: 'temcoTools.sql.history', viewType: 'temcoTools.sql.history', group: 'workbench' },
	{ id: 'schema', label: 'Schema', note: 'the shape of temco_docs', mark: 'list', command: 'temcoTools.sql.schema', viewType: 'temcoTools.sql.schema', group: 'docs' },
	{ id: 'saved', label: 'Saved Queries', note: 'the questions worth asking more than once', mark: 'book', command: 'temcoTools.sql.saved', viewType: 'temcoTools.sql.saved', group: 'docs' },
	{ id: 'reports', label: 'Reports', note: 'a query with a shape, pointing at the page that owns it', mark: 'graph', command: 'temcoTools.sql.reports', viewType: 'temcoTools.sql.reports', group: 'docs' }
];

/** The page that owns each report's number — a report never answers the same question twice. */
const REPORT_COMMANDS: { [name: string]: string } = {
	'Coverage by area': 'temcoWorkbench.health',
	'Release readiness': 'temcoDocs.releases',
	'What each source contributed': 'temcoDocs.sources'
};

/* ------------------------------------------------------------------ page vocabulary */

const button = (label: string, command: string, options: { kind?: 'primary' | 'ghost'; mark?: string; args?: unknown; small?: boolean } = {}): string =>
	`<button type="button" class="btn${options.small ? ' btn--sm' : ''}${options.kind ? ` btn--${options.kind}` : ''}" data-command="${command}"${options.args === undefined ? '' : ` data-args="${esc(JSON.stringify(options.args))}"`}>${options.mark ? icon(options.mark) : ''}<span>${esc(label)}</span></button>`;

const badge = (text: string, tone?: string): string =>
	`<span class="badge${tone && tone !== 'neutral' ? ` badge--${tone}` : ''}">${esc(text)}</span>`;

const pageHead = (options: { title: string; mark: string; desc: string; actions: string }): string =>
	`<div class="page-head"><div class="page-head__main"><h1 class="page-head__title">${icon(options.mark)}${esc(options.title)}</h1><p class="page-head__desc">${esc(options.desc)}</p></div><div class="page-head__actions">${options.actions}</div></div>`;

const rule = (options: { label: string; count?: string; note?: string; actions?: string; plain?: boolean }): string =>
	`<div class="group-head"><span class="group-head__label${options.plain ? ' group-head__label--plain' : ''}">${esc(options.label)}</span><span class="group-head__rule"></span>${options.count ? `<span class="group-head__count">${esc(options.count)}</span>` : ''}${options.actions ? `<span class="group-head__actions">${options.actions}</span>` : ''}</div>${options.note ? `<p class="group-note">${esc(options.note)}</p>` : ''}`;

const group = (options: { label: string; count?: string; note?: string; actions?: string; body: string }): string =>
	`${rule(options)}<div class="record-list">${options.body}</div>`;

const tiles = (items: { value: string; label: string }[]): string =>
	`<div class="tiles">${items.map((item) => `<div class="tile"><span class="tile__value">${esc(item.value)}</span><span class="tile__label">${esc(item.label)}</span></div>`).join('')}</div>`;

const callout = (html: string, kind: 'warn' | 'ok' | 'info' = 'info'): string =>
	`<div class="callout${kind === 'info' ? '' : ` callout--${kind}`}">${icon(kind === 'warn' ? 'alert' : kind === 'ok' ? 'check' : 'info')}<div>${html}</div></div>`;

const n = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

/** A statement in the page's code block, with the SQL keywords marked by the page's own token classes. */
function sqlBlock(sql: string): string {
	const marked = esc(sql).replace(/\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|LEFT JOIN|JOIN|ON|AS|DESC|LIMIT|count|EXPLAIN)\b/g, '<span class="tok-key">$1</span>');
	return `<pre class="code">${marked}</pre>`;
}

/* ------------------------------------------------------------------ the six pages */

/** *Query Editor* — the mock's `sql/query`. */
function queryBody(): string {
	const rows = staleByArea();
	const total = rows.reduce((sum, row) => sum + row.stale, 0);
	const history = SQL_HISTORY.slice(0, 3);

	return `${pageHead({
		title: 'Query Editor',
		mark: 'code',
		desc: 'The documentation registry, asked in SQL. Writes are refused by the connection, not by the editor — the editor shows what the connection allows before you run anything.',
		actions: button('Run', 'temcoTools.sql.run', { kind: 'primary', mark: 'play' }) + button('Explain', 'temcoTools.sql.explain', { mark: 'list' })
	})}
${rule({ label: 'Stale pages by area', plain: true, count: `Temco Docs · read-only · ${queryRun}`, actions: button('Save', 'temcoTools.sql.saveQuery', { small: true, kind: 'ghost' }) })}
<div class="mt-16">${sqlBlock(queryStatement)}</div>
<div class="mt-24">${group({
		label: 'Result',
		count: `${n(rows.length, 'row', 'rows')} · ${SQL_QUERIES[0].ms} ms`,
		note: `The same ${total.toLocaleString('en-US')} stale pages the Coverage page counts, read from the registry rather than from a report.`,
		body: rows.map((row) => `<div class="record-row record-row--static">
	${toneMark('chart', row.stale > 20 ? 'warn' : undefined)}
	<div class="record-row__main">
		<div class="record-row__title"><span class="record-row__name">${esc(row.area)}</span></div>
		<div class="record-row__meta"><span>${n(row.pages, 'page', 'pages')}</span><span>${row.reviewed} reviewed</span></div>
	</div>
	<div class="record-row__state cell-mono cell-strong">${row.stale}</div>
	<div class="record-row__state cell-muted">stale</div>
</div>`).join('')
	})}</div>
<div class="mt-24">${group({
		label: 'Recent',
		count: n(SQL_HISTORY.length, 'statement', 'statements'),
		actions: button('History', 'temcoTools.sql.history', { small: true, kind: 'ghost' }),
		body: history.map((entry) => {
			const ok = entry.state === 'ok';
			return `<div class="record-row${ok ? '' : ' record-row--static'}">
	${toneMark(ok ? 'check' : 'error', ok ? 'ok' : 'err')}
	<div class="record-row__main">
		<div class="record-row__title"><span class="record-row__name cell-mono">${esc(entry.statement)}</span></div>
		<div class="record-row__meta"><span>${esc(entry.time)}</span><span>${ok ? `${n(entry.rows, 'row', 'rows')} · ${entry.ms} ms` : 'refused · the connection is read-only'}</span></div>
	</div>
	<div class="record-row__state">${badge(ok ? 'Ran' : 'Refused', ok ? 'ok' : 'err')}</div>
	<div class="record-row__state"></div>
</div>`;
		}).join('')
	})}</div>`;
}

/** *Connections* — the mock's `sql/connections`. */
function connectionsBody(): string {
	const live = CONNECTIONS.filter((connection) => connection.state === 'Connected');
	const idle = CONNECTIONS.filter((connection) => connection.state !== 'Connected');

	const row = (connection: typeof CONNECTIONS[number]): string => `<div class="record-row">
	${toneMark('database', connection.tone)}
	<div class="record-row__main">
		<div class="record-row__title"><span class="record-row__name">${esc(connection.name)}</span><span class="tag">${esc(connection.kind)}</span></div>
		<div class="record-row__meta"><span class="cell-mono">${esc(connection.host)}</span><span class="cell-mono">${esc(connection.database)}</span><span>${esc(connection.access)}</span><span>${esc(connection.role)}</span></div>
	</div>
	<div class="record-row__state">${badge(connection.state, connection.tone)}</div>
	${button('Test', 'temcoTools.sql.testConnection', { small: true, kind: 'ghost', args: [connection.name] })}
</div>`;

	return `${pageHead({
		title: 'Connections',
		mark: 'database',
		desc: 'The documentation registry, and the copies of it other things read. This is not a general SQL client: the studio is pointed at one database because that is the one this window is about.',
		actions: button('New Connection', 'temcoTools.sql.newConnection', { kind: 'primary', mark: 'plus' })
	})}
${group({
		label: 'In Use',
		count: n(live.length, 'connection', 'connections'),
		note: 'The Query Editor runs against the first one. A snapshot is what the last build read, and it is read-only on purpose.',
		body: live.map(row).join('')
	})}
<div class="mt-24">${group({ label: 'Idle', count: n(idle.length, 'connection', 'connections'), body: idle.map(row).join('') })}</div>
<div class="mt-16">${callout('Passwords live in the operating system’s credential store, never in a project file, and the registry file itself is never edited from outside the platform — a page is changed by a write, not by an UPDATE.')}</div>`;
}

/** *Schema* — the mock's `sql/schema`. */
function schemaBody(): string {
	const rows = SQL_TABLES.reduce((sum, table) => sum + table.rows, 0);
	const largest = [...SQL_TABLES].sort((left, right) => right.rows - left.rows)[0];

	return `${pageHead({
		title: 'Schema',
		mark: 'list',
		desc: `The shape of temco_docs: ${SQL_TABLES.length} tables, and the columns \`pages\` is read through. The registry is a database before it is a set of pages.`,
		actions: button('Refresh', 'temcoTools.sql.refreshSchema', { mark: 'refresh' })
	})}
<div class="mt-16">${tiles([
		{ value: String(SQL_TABLES.length), label: 'Tables' },
		{ value: rows.toLocaleString('en-US'), label: 'Rows' },
		{ value: largest ? largest.name : '—', label: 'Largest table' },
		{ value: 'SQLite', label: 'Engine' }
	])}</div>
<div class="grid grid--2 mt-24">
	<div>${group({
		label: 'Tables',
		count: n(SQL_TABLES.length, 'table', 'tables'),
		body: SQL_TABLES.map((table) => `<div class="record-row record-row--static">
	${toneMark('list', table.name === 'pages' ? 'accent' : undefined)}
	<div class="record-row__main">
		<div class="record-row__title"><span class="record-row__name cell-mono">${esc(table.name)}</span></div>
		<div class="record-row__meta"><span>${table.rows.toLocaleString('en-US')} rows</span><span>${esc(table.note)}</span></div>
	</div>
	<div class="record-row__state cell-mono cell-muted">${esc(table.key)}</div>
	<div class="record-row__state"></div>
</div>`).join('')
	})}</div>
	<div>${group({
		label: 'pages',
		count: n(SQL_COLUMNS.length, 'column', 'columns'),
		note: 'Everything on this site is a read through this table.',
		body: SQL_COLUMNS.map((column) => `<div class="record-row record-row--static">
	${toneMark('code')}
	<div class="record-row__main">
		<div class="record-row__title"><span class="record-row__name cell-mono">${esc(column.name)}</span><span class="tag">${esc(column.type)}</span>${column.nullable === 'yes' ? '' : '<span class="cell-muted">not null</span>'}</div>
		<div class="record-row__meta"><span>${esc(column.note)}</span></div>
	</div>
	<div class="record-row__state"></div>
	<div class="record-row__state"></div>
</div>`).join('')
	})}</div>
</div>`;
}

/** *Saved Queries* — the mock's `sql/saved`. */
function savedBody(): string {
	return `${pageHead({
		title: 'Saved Queries',
		mark: 'book',
		desc: 'The questions worth asking more than once, kept with the statement that answers them. Each one is a check the build runs, written out.',
		actions: button('New Query', 'temcoTools.sql.newSavedQuery', { kind: 'primary', mark: 'plus' })
	})}
${group({
		label: 'Queries',
		count: n(SQL_QUERIES.length, 'query', 'queries'),
		body: SQL_QUERIES.map((query) => `<div class="record-row">
	${toneMark('code', query.rows ? 'warn' : 'ok')}
	<div class="record-row__main">
		<div class="record-row__title"><span class="record-row__name">${esc(query.name)}</span></div>
		<div class="record-row__meta"><span>${n(query.rows, 'row', 'rows')}</span><span class="cell-mono">${query.ms} ms</span><span>ran ${esc(query.run)}</span></div>
	</div>
	<div class="record-row__state">${query.rows ? badge(`${query.rows} to look at`, 'warn') : badge('Clean', 'ok')}</div>
	${button('Run', 'temcoTools.sql.runSaved', { small: true, kind: 'ghost', args: [query.name] })}
</div>`).join('')
	})}
<div class="mt-16">${callout('A saved query is a file under <code>.temco/queries/</code>, so it can be reviewed and diffed like a page. Running one never writes.')}</div>
<div class="mt-16">${callout('This build keeps the saved queries in the studio’s register: adding one changes this list, not a file on disk.')}</div>`;
}

/** *History* — the mock's `sql/history`. */
function historyBody(): string {
	const refused = SQL_HISTORY.filter((entry) => entry.state !== 'ok').length;

	return `${pageHead({
		title: 'Query History',
		mark: 'clock',
		desc: 'What was run against the registry in this window, in order. It is kept per profile and never synced, because a statement can name a page nobody else should see.',
		actions: button('Clear History', 'temcoTools.sql.clearHistory', { mark: 'close' })
	})}
${group({
		label: 'Ran In This Window',
		count: n(SQL_HISTORY.length, 'statement', 'statements') + (refused ? ` · ${n(refused, 'refused', 'refused')}` : ''),
		note: 'A refused statement is kept too: what the connection would not do is part of the record.',
		body: SQL_HISTORY.map((entry, index) => {
			const ok = entry.state === 'ok';
			return `<div class="record-row record-row--static">
	${toneMark(ok ? 'check' : 'error', ok ? 'ok' : 'err')}
	<div class="record-row__main">
		<div class="record-row__title"><span class="record-row__name cell-mono">${esc(entry.statement)}</span></div>
		<div class="record-row__meta"><span class="cell-mono">${esc(entry.time)}</span><span>${ok ? `${n(entry.rows, 'row', 'rows')} · ${entry.ms} ms` : 'refused · read-only connection'}</span></div>
	</div>
	<div class="record-row__state">${badge(ok ? 'Ran' : 'Refused', ok ? 'ok' : 'err')}</div>
	${ok ? button('Re-run', 'temcoTools.sql.runHistory', { small: true, kind: 'ghost', args: [index] }) : '<span class="cell-muted">—</span>'}
</div>`;
		}).join('')
	})}`;
}

/** *Reports* — the mock's `sql/reports`. */
function reportsBody(): string {
	return `${pageHead({
		title: 'Reports',
		mark: 'chart',
		desc: 'A report is a query with a shape: the numbers the platform already shows, read from the registry. Running one writes nothing; exporting one writes a file next to the workspace.',
		actions: button('New Report', 'temcoTools.sql.newReport', { kind: 'primary', mark: 'plus' })
	})}
${group({
		label: 'Reports',
		count: n(REPORTS.length, 'report', 'reports'),
		body: REPORTS.map((report) => `<div class="record-row">
	${toneMark('chart')}
	<div class="record-row__main">
		<div class="record-row__title"><span class="record-row__name">${esc(report.name)}</span></div>
		<div class="record-row__meta"><span>${esc(report.desc)}</span><span>updated ${esc(report.updated)}</span></div>
	</div>
	<div class="record-row__state"></div>
	${REPORT_COMMANDS[report.name]
				? button('Open page', REPORT_COMMANDS[report.name], { small: true, kind: 'ghost' })
				: button('Run', 'temcoTools.sql.runReport', { small: true, kind: 'ghost', args: [report.name] })}
</div>`).join('')
	})}
<div class="mt-16">${callout('Reports point at the page that owns the number. A report that disagreed with its page would be a second answer to the same question.')}</div>`;
}

const BODIES: { [id: string]: () => string } = {
	query: queryBody,
	connections: connectionsBody,
	schema: schemaBody,
	saved: savedBody,
	history: historyBody,
	reports: reportsBody
};

/** The six pages, one panel each, kept open so a second visit reveals the tab rather than stacking another. */
export class SqlPages {
	private readonly panels = new Map<string, vscode.WebviewPanel>();

	constructor(private readonly context: vscode.ExtensionContext) { }

	open(id: string): void {
		const definition = SQL_PAGES.find((entry) => entry.id === id);
		const body = BODIES[id];
		if (!definition || !body) {
			return;
		}
		const existing = this.panels.get(id);
		if (existing) {
			existing.reveal(pageColumn());
			existing.webview.html = this.document(definition, body);
			return;
		}
		const panel = vscode.window.createWebviewPanel(definition.viewType, definition.label, pageColumn(), {
			enableScripts: true,
			localResourceRoots: []
		});
		panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'sql.svg');
		panel.webview.html = this.document(definition, body);
		panel.webview.onDidReceiveMessage((message: PageMessage) => {
			if (message.type !== 'command' || typeof message.command !== 'string') {
				return;
			}
			// `data-args` arrives as one array; a command wants them spread.
			const args = Array.isArray(message.args) ? message.args : message.args === undefined ? [] : [message.args];
			void vscode.commands.executeCommand(message.command, ...args);
		});
		this.panels.set(id, panel);
		panel.onDidDispose(() => this.panels.delete(id));
	}

	refresh(): void {
		for (const [id, panel] of this.panels) {
			const definition = SQL_PAGES.find((entry) => entry.id === id);
			const body = BODIES[id];
			if (definition && body) {
				panel.webview.html = this.document(definition, body);
			}
		}
	}

	dispose(): void {
		for (const panel of this.panels.values()) {
			panel.dispose();
		}
		this.panels.clear();
	}

	private document(definition: SqlPage, body: () => string): string {
		return page(body(), { title: definition.label, script: commandScript });
	}
}

/* ------------------------------------------------------------------ what a button does */

/** The clock the history rows print: the window's own, because the register has none. */
function time(): string {
	const at = new Date();
	return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
}

/** One line for the history: the statement, shortened the way the page prints it. */
function historyLine(statement: string): string {
	return statement.replace(/\s+/g, ' ').trim();
}

/**
 * Runs one statement, and answers what happened.
 *
 * The registry table is real to this build (`sqlSample.ts`), the engine is not: a statement that writes is refused the
 * way the read-only connection would refuse it, a statement that reads is recorded and its timestamp moves. Nothing
 * claims to have read a row it did not.
 */
async function runStatement(statement: string, changed: () => void): Promise<void> {
	const rows = staleByArea().length;
	if (isWrite(statement)) {
		SQL_HISTORY.unshift({ time: time(), statement: historyLine(statement), rows: 0, ms: 0, state: 'err' });
		changed();
		await vscode.window.showWarningMessage(
			'Temco SQL: the statement was refused — the connection is read-only. A page is changed by a write in the Documentation module, not by an UPDATE here.'
		);
		return;
	}
	SQL_HISTORY.unshift({ time: time(), statement: historyLine(statement), rows, ms: SQL_QUERIES[0].ms, state: 'ok' });
	recordRun('just now');
	changed();
	await vscode.window.showInformationMessage(
		`Temco SQL: ${n(rows, 'row', 'rows')} in ${SQL_QUERIES[0].ms} ms. The result is read from the registry table this build holds, not from a database engine.`
	);
}

export function registerSql(context: vscode.ExtensionContext): { pages: SqlPages; disposables: vscode.Disposable[] } {
	const pages = new SqlPages(context);
	const changed = (): void => pages.refresh();

	const commands: vscode.Disposable[] = [
		...SQL_PAGES.map((definition) => vscode.commands.registerCommand(definition.command, () => pages.open(definition.id))),

		// ---- Query Editor
		vscode.commands.registerCommand('temcoTools.sql.run', () => runStatement(queryStatement, changed)),

		vscode.commands.registerCommand('temcoTools.sql.explain', async () => {
			const tables = referencedTables(queryStatement);
			await vscode.window.showInformationMessage('Temco SQL: what this statement touches', {
				detail: [
					`Reads from: ${tables.length ? tables.join(', ') : 'no table this build can name'}`,
					'Writes: none — the connection is read-only.',
					'There is no query planner in this build, so this is the statement’s own structure rather than a plan.'
				].join('\n')
			});
		}),

		vscode.commands.registerCommand('temcoTools.sql.saveQuery', async () => {
			const name = await vscode.window.showInputBox({
				title: 'Save a Query',
				prompt: 'A name for the statement the editor is showing',
				placeHolder: 'Stale pages by area'
			});
			if (name === undefined || name.trim().length === 0) {
				return;
			}
			SQL_QUERIES.push({ name: name.trim(), rows: staleByArea().length, ms: SQL_QUERIES[0].ms, run: 'just now', sql: queryStatement });
			changed();
			await vscode.window.showInformationMessage(
				`Temco SQL: “${name.trim()}” saved to the studio’s register. The file under .temco/queries/ is not written by this build.`
			);
		}),

		// ---- Connections
		vscode.commands.registerCommand('temcoTools.sql.testConnection', async (name?: unknown) => {
			const connection = CONNECTIONS.find((entry) => entry.name === String(name));
			if (!connection) {
				return;
			}
			await vscode.window.showInformationMessage(`Temco SQL: ${connection.name}`, {
				detail: [
					`${connection.kind} · ${connection.host} · ${connection.database}`,
					`${connection.state} · ${connection.access}`,
					connection.state === 'Connected'
						? 'The Query Editor runs against this one.'
						: 'Idle: it is a copy, and a copy is read-only on purpose.'
				].join('\n')
			});
		}),

		vscode.commands.registerCommand('temcoTools.sql.newConnection', async () => {
			const host = await vscode.window.showInputBox({
				title: 'New Connection',
				prompt: 'Where the database lives — a path, or host:port for a server',
				placeHolder: '~/Temco/t3000/.temco/docs.copy.db'
			});
			if (host === undefined || host.trim().length === 0) {
				return;
			}
			CONNECTIONS.push({
				name: `Connection ${CONNECTIONS.length + 1}`,
				kind: host.includes(':') ? 'PostgreSQL' : 'SQLite',
				host: host.trim(),
				database: 'temco_docs',
				state: 'Idle',
				tone: 'warn',
				access: 'Read-only',
				role: 'Added in this window'
			});
			changed();
			await vscode.window.showInformationMessage(
				`Temco SQL: a read-only connection to ${host.trim()} added, idle. Nothing was opened — this build has no driver.`
			);
		}),

		// ---- Schema
		vscode.commands.registerCommand('temcoTools.sql.refreshSchema', async () => {
			changed();
			const rows = SQL_TABLES.reduce((sum, table) => sum + table.rows, 0);
			await vscode.window.showInformationMessage(
				`Temco SQL: ${n(SQL_TABLES.length, 'table', 'tables')}, ${rows.toLocaleString('en-US')} rows, ${n(SQL_COLUMNS.length, 'column', 'columns')} in pages. Read from the register, not from an open database.`
			);
		}),

		// ---- Saved Queries
		vscode.commands.registerCommand('temcoTools.sql.newSavedQuery', async () => {
			const name = await vscode.window.showInputBox({
				title: 'New Query',
				prompt: 'A name for a saved query; the statement is the one the editor is showing',
				placeHolder: 'Pages with no owner'
			});
			if (name === undefined || name.trim().length === 0) {
				return;
			}
			SQL_QUERIES.push({ name: name.trim(), rows: 0, ms: 0, run: 'never', sql: queryStatement });
			changed();
			await vscode.window.showInformationMessage(`Temco SQL: “${name.trim()}” saved. It has not been run yet, so it carries no count.`);
		}),

		vscode.commands.registerCommand('temcoTools.sql.runSaved', async (name?: unknown) => {
			const query = SQL_QUERIES.find((entry) => entry.name === String(name));
			if (!query) {
				return;
			}
			setStatement(query.sql);
			pages.open('query');
			await runStatement(query.sql, changed);
		}),

		// ---- History
		vscode.commands.registerCommand('temcoTools.sql.runHistory', async (index?: unknown) => {
			const entry = SQL_HISTORY[Number(index)];
			if (!entry) {
				return;
			}
			setStatement(entry.statement);
			pages.open('query');
			await runStatement(entry.statement, changed);
		}),

		vscode.commands.registerCommand('temcoTools.sql.clearHistory', async () => {
			const cleared = SQL_HISTORY.length;
			if (cleared === 0) {
				await vscode.window.showInformationMessage('Temco SQL: the history is empty.');
				return;
			}
			SQL_HISTORY.length = 0;
			changed();
			await vscode.window.showInformationMessage(`Temco SQL: ${n(cleared, 'statement', 'statements')} cleared from this window’s history.`);
		}),

		// ---- Reports
		vscode.commands.registerCommand('temcoTools.sql.newReport', async () => {
			const name = await vscode.window.showInputBox({
				title: 'New Report',
				prompt: 'A name for the report',
				placeHolder: 'Pages with no owner'
			});
			if (name === undefined || name.trim().length === 0) {
				return;
			}
			REPORTS.push({ name: name.trim(), desc: 'A saved shape over the registry', updated: 'just now' });
			changed();
			await vscode.window.showInformationMessage(
				`Temco SQL: “${name.trim()}” added. A new report has no page behind it yet, so it runs rather than opening one.`
			);
		}),

		vscode.commands.registerCommand('temcoTools.sql.runReport', async (name?: unknown) => {
			const report = REPORTS.find((entry) => entry.name === String(name));
			if (!report) {
				return;
			}
			await vscode.window.showInformationMessage(`Temco SQL: ${report.name}`, {
				detail: [
					report.desc,
					`Updated ${report.updated}.`,
					'A report is run from the page that owns its number; this build has no query engine to run it here.'
				].join('\n')
			});
		})
	];

	return { pages, disposables: commands };
}
