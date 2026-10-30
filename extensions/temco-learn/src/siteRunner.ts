// The site's own processes.
//
// Two ways of running the site, and both of them belong to the repository's own scripts: `serve` shows the built site at
// 1011, `client-dev` runs Vite at 3003. This module starts them, says what they are doing, and stops them — it never
// builds a second way of serving anything, because a preview that is not the real site is the thing this replaces.
//
// A server that is starting is not a server that is up, so `start` waits for the address to answer before it says
// running: a frame pointed at a port with nothing behind it is the grey page this avoids.

import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import * as vscode from 'vscode';
import { DEV_URL, PREVIEW_URL, repoReady, siteRepo } from './siteRepo';

/** The two ways of running the site. */
export type SiteMode = 'preview' | 'development';

/** What the server is doing. */
export type SiteState = 'stopped' | 'starting' | 'running' | 'failed';

export interface SiteStatus {
	state: SiteState;
	mode?: SiteMode;
	/** The address the site answers at while it is running. */
	url?: string;
	/** Why it is not running, when it is not. */
	reason?: string;
}

/** Where a line of the server's own output goes. */
export type Log = (line: string) => void;

const SCRIPT: Record<SiteMode, string> = { preview: 'serve', development: 'client-dev' };

const ADDRESS: Record<SiteMode, string> = { preview: PREVIEW_URL, development: DEV_URL };

/** The words a person reads for each state, in the panel and in the preview's own bar. */
export function describe(status: SiteStatus): string {
	switch (status.state) {
		case 'running':
			return `${status.mode === 'development' ? 'developing' : 'running'} · ${String(new URL(status.url ?? PREVIEW_URL).port)}`;
		case 'starting':
			return 'starting…';
		case 'failed':
			return 'failed';
		default:
			return 'stopped';
	}
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Whether something answers at `url`. Any answer counts: a redirect still means the server is up. */
function answers(url: string): Promise<boolean> {
	return new Promise((resolve) => {
		const asked = http.get(url, { timeout: 1500 }, (response) => {
			response.resume();
			resolve(true);
		});
		asked.on('timeout', () => {
			asked.destroy();
			resolve(false);
		});
		asked.on('error', () => resolve(false));
	});
}

/** Stop a process and everything it started, and wait for it: `npm` is a shell whose children hold the port. */
function end(pid: number): Promise<void> {
	return new Promise((resolve) => {
		try {
			if (process.platform === 'win32') {
				const kill = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true });
				kill.on('exit', () => resolve());
				kill.on('error', () => resolve());
			} else {
				process.kill(-pid, 'SIGTERM');
				resolve();
			}
		} catch {
			// A process that is already gone is the outcome that was wanted.
			resolve();
		}
	});
}

/**
 * One site server at a time.
 *
 * Two servers on two ports of the same checkout is not a thing a person means to do, so starting the other way of
 * running the site ends the first.
 */
export class SiteRunner implements vscode.Disposable {
	private child: ChildProcess | undefined;
	private current: SiteStatus = { state: 'stopped' };
	private leaving = false;
	private readonly changed = new vscode.EventEmitter<SiteStatus>();

	readonly onDidChange = this.changed.event;

	constructor(private readonly read: () => string = siteRepo) { }

	get status(): SiteStatus {
		return this.current;
	}

	get running(): boolean {
		return this.current.state === 'running' || this.current.state === 'starting';
	}

	/**
	 * Start one way of running the site, and wait until it answers.
	 *
	 * A preview needs something to preview, so a `dist` that was never built is built first rather than served as an
	 * empty folder.
	 */
	async start(mode: SiteMode, log: Log): Promise<SiteStatus> {
		if (this.running && this.current.mode === mode) {
			return this.current;
		}
		if (this.running) {
			await this.stop();
		}
		const repo = this.read();
		if (!repoReady(repo)) {
			return this.fail(`The site repository is not at ${repo}. Choose the folder in the Overview page.`);
		}
		this.set({ state: 'starting', mode });
		if (mode === 'preview' && !fs.existsSync(path.join(repo, 'dist', 'index.html'))) {
			log('[site] dist/ was not there — building the site first.');
			const built = await this.run('build', log);
			if (built !== 0) {
				return this.fail('The site could not be built; the log says why.');
			}
		}

		const child = spawn('npm run ' + SCRIPT[mode], {
			cwd: repo,
			shell: true,
			windowsHide: true,
			detached: process.platform !== 'win32',
			env: process.env
		});
		this.child = child;
		child.stdout?.on('data', (chunk: Buffer) => log(String(chunk).trimEnd()));
		child.stderr?.on('data', (chunk: Buffer) => log(String(chunk).trimEnd()));
		child.on('error', (error: Error) => {
			if (this.child === child) {
				this.child = undefined;
				this.fail(`The server could not be started — ${error.message}`);
			}
		});
		child.on('exit', (code) => {
			if (this.child !== child) {
				return;
			}
			this.child = undefined;
			if (!this.leaving && this.current.state !== 'stopped') {
				this.fail(`The server stopped by itself${code === null ? '' : ` (exit ${String(code)})`} — the log says why.`);
			}
		});

		const url = ADDRESS[mode];
		log(`[site] ${SCRIPT[mode]} is starting at ${url}`);
		const ready = await this.wait(url, mode === 'preview' ? 90000 : 180000, () => this.child === child);
		if (!ready) {
			await this.stop();
			return this.fail(`The site did not answer at ${url}. The log says what the server said.`);
		}
		this.set({ state: 'running', mode, url });
		return this.current;
	}

	/** Stop whatever is running. Nothing is left behind: the port is free afterwards, or `npm` did not own it. */
	async stop(): Promise<void> {
		const child = this.child;
		const pid = child?.pid;
		const url = this.current.url ?? (this.current.mode === 'development' ? DEV_URL : PREVIEW_URL);
		this.child = undefined;
		this.leaving = true;
		this.set({ state: 'stopped' });
		if (pid !== undefined) {
			await end(pid);
			// The port is the proof, not the process: `npm` hands the server to a child that can outlive the kill.
			const until = Date.now() + 5000;
			while (Date.now() < until && (await answers(url))) {
				await sleep(250);
			}
		}
		this.leaving = false;
	}

	/** Run one of the repository's scripts to completion: `build`, `catalog`, or `install`. The exit code is the answer. */
	async run(script: string, log: Log): Promise<number> {
		const repo = this.read();
		const command = script === 'install' ? 'npm install' : 'npm run ' + script;
		return new Promise((resolve) => {
			const child = spawn(command, { cwd: repo, shell: true, windowsHide: true, env: process.env });
			child.stdout?.on('data', (chunk: Buffer) => log(String(chunk).trimEnd()));
			child.stderr?.on('data', (chunk: Buffer) => log(String(chunk).trimEnd()));
			child.on('error', (error: Error) => {
				log(`[site] ${script} could not run — ${error.message}`);
				resolve(-1);
			});
			child.on('exit', (code) => resolve(code ?? -1));
		});
	}

	dispose(): void {
		void this.stop();
		this.changed.dispose();
	}

	private async wait(url: string, ms: number, alive: () => boolean): Promise<boolean> {
		const until = Date.now() + ms;
		while (Date.now() < until) {
			if (!alive()) {
				return false;
			}
			if (await answers(url)) {
				return true;
			}
			await sleep(400);
		}
		return false;
	}

	private fail(reason: string): SiteStatus {
		this.set({ state: 'failed', mode: this.current.mode, reason });
		return this.current;
	}

	private set(status: SiteStatus): void {
		this.current = status;
		this.changed.fire(status);
	}
}
