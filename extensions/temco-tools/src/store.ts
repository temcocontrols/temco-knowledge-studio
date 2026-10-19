// What this module reads of the store.
//
// The store is a *different extension* and the platform's own memory: it owns the one database file, the schema
// and the selection. An extension cannot import another extension's sources, so this file is the copy of
// `extensions/temco-store/src/api.ts` and the shapes the studio reads — the definition is there, and a change
// there is a change here.

import * as vscode from 'vscode';

/** The store module, by the id its manifest declares. */
const STORE_EXTENSION_ID = 'temcocontrols.temco-store';

/** What one statement returned. */
export interface SqlResult {
	columns: string[];
	rows: unknown[][];
	changes?: number;
	ms: number;
	truncated: boolean;
	readOnly: boolean;
}

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

/** The platform's database, as the studio uses it — the copy of `Catalog` in the store. */
export interface Catalog {
	/** Where the file is. */
	readonly file: vscode.Uri;
	schemaVersion(): number;
	counts(): [string, number][];
	/** One statement. Read-only unless `write` is set. */
	query(sql: string, options?: { write?: boolean; limit?: number }): SqlResult;
	/** Every table with its columns, indexes and row count. */
	tables(): TableFact[];
	/** One page of one table. */
	rows(table: string, limit?: number, offset?: number): { columns: string[]; rows: unknown[][]; total: number };
	/** Vacuum, checkpoint, empty every table, or drop the schema and write it again. */
	maintain(action: 'vacuum' | 'checkpoint' | 'clear' | 'reset'): string;
	/** The schema version *this build* expects — what a stored version is compared against. */
	expectedSchemaVersion(): number;
	/** SQLite's own verdict on the file, from `quick_check`. */
	integrity(): string;
	/** Bytes each part takes: the file, and the write-ahead log beside it. */
	sizes(): { file?: number; wal?: number };
	close(): void;
}

/** The store's exports — the copy of `extensions/temco-store/src/api.ts`. */
interface StoreApi {
	available(): boolean;
	catalog(): Promise<Catalog>;
}

const extension = vscode.extensions.getExtension<StoreApi>(STORE_EXTENSION_ID);
if (extension === undefined || !extension.isActive) {
	throw new Error('The Temco Store module is not available.');
}

const store = extension.exports;

/**
 * The platform's database, opened with the *store's* storage.
 *
 * The argument is accepted and ignored: a caller's own `globalStorageUri` is a different, empty database beside its
 * own code.
 */
export const Catalog = {
	open: (_context?: vscode.ExtensionContext): Promise<Catalog> => store.catalog(),
};
