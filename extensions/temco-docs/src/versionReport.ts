// The release report a product repository's workflow writes, and this application reads.
//
// It is a **contract**, not a second opinion: the workflow knows which code moved and which pages claim it, and this
// application never recomputes that. When the file is absent — which is the normal state until a release runs — every
// surface behaves exactly as it did before, so the report is an addition rather than a dependency.
//
//   docs/help/version-report.json
//   { "version": "13.1",
//     "changed": [ { "page": "t3000/data-points/scaling", "code": ["src/point.h"] } ],
//     "retake":  [ { "page": "t3000/data-points/scaling", "note": "taken on 2.9" } ] }

import * as vscode from 'vscode';
import { DocsRoot } from './registry';

/** One page a version touched, and the code that moved under it. */
export interface VersionChange {
	page?: string;
	title?: string;
	code?: string[];
}

/** One screenshot that is older than the version the page now describes. */
export interface RetakeRow {
	page?: string;
	title?: string;
	note?: string;
}

export interface VersionReport {
	version?: string;
	changed?: VersionChange[];
	retake?: RetakeRow[];
}

const REPORT = ['docs', 'help', 'version-report.json'];

/**
 * The report for one set, or `undefined`.
 *
 * A file that is absent or unreadable yields `undefined` rather than a warning: the workflow may not have run yet,
 * and a missing courtesy is not a fault in the documentation.
 */
export async function readVersionReport(root: DocsRoot | undefined): Promise<VersionReport | undefined> {
	if (root === undefined) {
		return undefined;
	}
	try {
		const bytes = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(root.rootUri, ...REPORT));
		const data: unknown = JSON.parse(Buffer.from(bytes).toString('utf8'));
		return data !== null && typeof data === 'object' ? (data as VersionReport) : undefined;
	} catch {
		return undefined;
	}
}

/** The first report among the sets being read — the workflow writes one per repository that has one. */
export async function firstVersionReport(roots: readonly DocsRoot[]): Promise<{ root: DocsRoot; report: VersionReport } | undefined> {
	for (const root of roots) {
		const report = await readVersionReport(root);
		if (report !== undefined) {
			return { root, report };
		}
	}
	return undefined;
}
