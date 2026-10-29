// Running git, once.
//
// Three things in this module ask git a question — where the folder publishes to, what has changed since the last
// publish, and what the last publish was. They all need the same care: a bounded buffer, no console window on Windows,
// and stderr kept for the message a person reads, so the helper lives here rather than three times over.

import { execFile } from 'child_process';

/** The largest output a git command may produce before it is treated as a failure rather than a message. */
const LIMIT = 32 * 1024 * 1024;

/** Run git in `cwd` and answer its standard output; reject with git's own words when it fails. */
export function git(cwd: string, args: readonly string[]): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		execFile('git', ['-C', cwd, ...args], { maxBuffer: LIMIT, windowsHide: true }, (error, stdout, stderr) => {
			if (error !== null) {
				const detail = stderr.trim();
				reject(new Error(detail.length > 0 ? detail : error.message));
				return;
			}
			resolve(stdout);
		});
	});
}
