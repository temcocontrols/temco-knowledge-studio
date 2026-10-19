// The catalog as a database a person can look at.
//
// This is not a second driver for the same file: the store hands its own open handle in, so the rules the store
// keeps — WAL, foreign keys, one window, one file — hold for these statements too. What it adds is *reach*: the
// ability to ask a question the platform never asked, and the maintenance acts a development database needs.
//
// Two rules are load-bearing here:
//
//   * **One statement per run.** `prepare` takes exactly one, and a page that silently ran half a paste would be
//     worse than one that refused it.
//   * **Writing is opt-in.** Everything that is not a read throws unless the caller says `write: true`, which in
//     the UI is a checkbox a person ticks. The platform's memory is not a scratch pad, and `DELETE FROM sources`
//     typed into a query box should not be one keystroke away.

import { statSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import { SCHEMA, SCHEMA_VERSION } from './schema';

/** One column, as SQLite reports it. */
export interface ColumnFact {
  name: string;
  type: string;
  notNull: boolean;
  primaryKey: boolean;
  /** The `DEFAULT` the column was declared with, when it has one. */
  defaultValue?: string;
}

/** One table: its shape, its indexes, its own `CREATE` statement, and how many rows it holds. */
export interface TableFact {
  name: string;
  /** What `sqlite_master` holds — the table exactly as it was written. */
  sql: string;
  columns: ColumnFact[];
  indexes: string[];
  rows: number;
}

/** What one statement returned. */
export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  /** Rows a writing statement changed. */
  changes?: number;
  ms: number;
  /** True when the answer was longer than the page could show. */
  truncated: boolean;
  readOnly: boolean;
}

/** One page of one table. */
export interface TableRows {
  columns: string[];
  rows: unknown[][];
  total: number;
}

/** The statements that only read. Everything else is a write, whatever it looks like. */
const READING = /^\s*(select|with|pragma|explain|values)\b/i;

/** One row limit for an answer that could be the whole database. */
export const DEFAULT_LIMIT = 500;

export function runQuery(
  db: DatabaseSync,
  sql: string,
  options: { write?: boolean; limit?: number } = {}
): QueryResult {
  const statement = sql.trim().replace(/;\s*$/, '');
  if (statement.length === 0) {
    throw new Error('there is no statement to run.');
  }
  if (statement.includes(';')) {
    throw new Error('one statement at a time — run them separately.');
  }

  const readOnly = READING.test(statement);
  if (!readOnly && options.write !== true) {
    throw new Error(
      'that statement changes the database. Tick “allow writes” below the editor if that is what you mean.'
    );
  }

  const started = Date.now();
  const prepared = db.prepare(statement);
  if (!readOnly) {
    const run = prepared.run();
    return {
      columns: [],
      rows: [],
      changes: Number(run.changes ?? 0),
      ms: Date.now() - started,
      truncated: false,
      readOnly: false,
    };
  }

  const all = prepared.all() as Record<string, unknown>[];
  const columns = all.length > 0 ? Object.keys(all[0]) : [];
  const limit = options.limit ?? DEFAULT_LIMIT;
  return {
    columns,
    rows: all.slice(0, limit).map((row) => columns.map((name) => row[name])),
    ms: Date.now() - started,
    truncated: all.length > limit,
    readOnly: true,
  };
}

/** Every user table, in the order SQLite lists them, with what a browser needs to draw one. */
export function tablesOf(db: DatabaseSync): TableFact[] {
  const names = db
    .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as { name?: unknown; sql?: unknown }[];

  return names.map(({ name, sql }) => {
    const table = String(name ?? '');
    const columns = db.prepare(`PRAGMA table_info(${quote(table)})`).all() as Record<string, unknown>[];
    const indexes = db.prepare(`PRAGMA index_list(${quote(table)})`).all() as Record<string, unknown>[];
    const counted = db.prepare(`SELECT COUNT(*) AS n FROM ${quote(table)}`).get() as { n?: unknown } | undefined;
    return {
      name: table,
      sql: String(sql ?? ''),
      columns: columns.map((column) => ({
        name: String(column.name ?? ''),
        type: String(column.type ?? ''),
        notNull: Number(column.notnull ?? 0) === 1,
        primaryKey: Number(column.pk ?? 0) > 0,
        defaultValue:
          column.dflt_value === null || column.dflt_value === undefined
            ? undefined
            : String(column.dflt_value),
      })),
      indexes: indexes.map((index) => String(index.name ?? '')),
      rows: Number(counted?.n ?? 0),
    };
  });
}

/** One page of one table, by name — the name is quoted rather than trusted. */
export function rowsOf(db: DatabaseSync, table: string, limit: number, offset: number): TableRows {
  const counted = db.prepare(`SELECT COUNT(*) AS n FROM ${quote(table)}`).get() as { n?: unknown } | undefined;
  const page = db
    .prepare(`SELECT * FROM ${quote(table)} LIMIT ? OFFSET ?`)
    .all(Math.max(0, limit), Math.max(0, offset)) as Record<string, unknown>[];
  const columns = page.length > 0 ? Object.keys(page[0]) : [];
  return {
    columns,
    rows: page.map((row) => columns.map((name) => row[name])),
    total: Number(counted?.n ?? 0),
  };
}

/**
 * The two maintenance acts and the two housekeeping ones.
 *
 * `clear` empties every table and keeps the schema; `reset` drops the schema and writes it again from this
 * build's own definition. Both are development acts, and the caller is expected to have confirmed them in words.
 */
export function maintain(db: DatabaseSync, action: 'vacuum' | 'checkpoint' | 'clear' | 'reset'): string {
  if (action === 'vacuum') {
    db.exec('VACUUM;');
    return 'the file was rebuilt and its free pages returned to the disk';
  }
  if (action === 'checkpoint') {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    return 'the write-ahead log was folded into the file';
  }
  if (action === 'clear') {
    const tables = tableNames(db);
    // Foreign keys off around the deletes: emptying parent and child in one transaction is the point, and the
    // pragma cannot be changed inside a transaction, so the sequence is explicit.
    db.exec('PRAGMA foreign_keys = OFF;');
    try {
      db.exec('BEGIN;');
      for (const table of tables) {
        db.exec(`DELETE FROM ${quote(table)};`);
      }
      db.exec('COMMIT;');
    } catch (error) {
      db.exec('ROLLBACK;');
      throw error;
    } finally {
      db.exec('PRAGMA foreign_keys = ON;');
    }
    setSchemaVersion(db);
    return `${tables.length} table${tables.length === 1 ? '' : 's'} emptied — the schema is untouched`;
  }

  // reset: drop what this build knows about, then let the schema recreate it, then stamp the version.
  const tables = tableNames(db);
  db.exec('PRAGMA foreign_keys = OFF;');
  try {
    db.exec('BEGIN;');
    for (const table of tables) {
      db.exec(`DROP TABLE IF EXISTS ${quote(table)};`);
    }
    db.exec('COMMIT;');
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  } finally {
    db.exec('PRAGMA foreign_keys = ON;');
  }
  db.exec(SCHEMA);
  setSchemaVersion(db);
  return `the database was reset to the shape this build expects (schema ${SCHEMA_VERSION})`;
}

/** Every table a person owns — not the engine's own bookkeeping. */
function tableNames(db: DatabaseSync): string[] {
  const names = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as { name?: unknown }[];
  return names.map(({ name }) => String(name ?? ''));
}

function setSchemaVersion(db: DatabaseSync): void {
  db.prepare('DELETE FROM meta WHERE key = ?').run('schema_version');
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('schema_version', String(SCHEMA_VERSION));
}

/**
 * SQLite's own answer to "is this file sound": `quick_check` reads the pages without the index cross-references
 * that make `integrity_check` slow on a large file, which is the right trade for a button a person presses.
 */
export function integrityOf(db: DatabaseSync): string {
  const row = db.prepare('PRAGMA quick_check').get() as Record<string, unknown> | undefined;
  const answer = row === undefined ? 'no answer' : Object.values(row)[0];
  return answer === undefined || answer === null ? 'no answer' : String(answer);
}

/** The bytes a file takes, or `undefined` when it is not there. */
export function sizeOf(file: string): number | undefined {
  try {
    return statSync(file).size;
  } catch {
    return undefined;
  }
}

/** An identifier, quoted. Table names come from `sqlite_master`, and are quoted anyway. */
function quote(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}