// Git, as this module needs it: one command, its standard output, and a rejection that keeps the message a person has to
// read. Nothing here interprets git's answers — the callers do, because they know what they asked for.

import { execFile } from 'child_process';

/** A commit's diff can be large; the limit is generous enough that it is never the reason a read fails. */
export const GIT_LIMIT = 32 * 1024 * 1024;

export function git(cwd: string, args: readonly string[]): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		execFile('git', ['-C', cwd, ...args], { maxBuffer: GIT_LIMIT, windowsHide: true }, (error, stdout, stderr) => {
			if (error !== null) {
				const detail = stderr.trim();
				reject(new Error(detail.length > 0 ? detail : error.message));
				return;
			}
			resolve(stdout);
		});
	});
}
