// A published site, served over HTTP from this machine.
//
// Why a server rather than opening `index.html`: what a generator writes is a folder of relative links, directory
// indexes and — in some templates — fetches. `file://` resolves none of those the way a host does, so the honest
// way to look at a release is to serve it. Loopback only, on a port the kernel picks: publishing a version is a
// copy of files, and it must not open a socket on any other interface.
//
// Nothing is written and nothing is cached: a request reads the file from disk each time, so a rebuilt release is
// a reload away rather than a restart.

import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import * as vscode from 'vscode';

/** What a file is, by extension. A type the map does not know is served as bytes rather than guessed at. */
const MIME: { [extension: string]: string } = {
	'.html': 'text/html; charset=utf-8',
	'.htm': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.map': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.ico': 'image/x-icon',
	'.webp': 'image/webp',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.txt': 'text/plain; charset=utf-8',
	'.md': 'text/markdown; charset=utf-8',
	'.xml': 'application/xml; charset=utf-8',
	'.pdf': 'application/pdf',
	'.chm': 'application/octet-stream',
	'.zip': 'application/zip',
};

/**
 * One published folder, on one port.
 *
 * A second `serve` replaces the first: two sites on two ports is a question nobody asked, and the status bar has
 * room for one address.
 */
export class Server implements vscode.Disposable {
	private server: http.Server | undefined;
	/** The folder being served, when one is. */
	private serving: string | undefined;
	private readonly status: vscode.StatusBarItem;

	constructor() {
		this.status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 90);
		this.status.command = 'temcoDocs.stopServing';
		this.status.name = 'Temco Learn';
	}

	/** What is being served, when something is. */
	get root(): string | undefined {
		return this.serving;
	}

	/** Start serving a folder and return where it can be opened. Throws when the port cannot be taken. */
	async serve(destination: string): Promise<string> {
		this.stop();
		const root = path.resolve(destination);
		if (!fs.existsSync(root)) {
			throw new Error(`${root} is not on this machine`);
		}

		const server = http.createServer((request, response) => respond(root, request, response));
		await new Promise<void>((resolve, reject) => {
			server.once('error', reject);
			server.listen(0, '127.0.0.1', () => resolve());
		});

		const address = server.address();
		const port = typeof address === 'object' && address !== null ? address.port : 0;
		this.server = server;
		this.serving = root;
		this.status.text = `$(globe) Learn :${port}`;
		this.status.tooltip = `Serving ${root}\nClick to stop.`;
		this.status.show();
		return `http://127.0.0.1:${port}/`;
	}

	stop(): void {
		this.server?.close();
		this.server = undefined;
		this.serving = undefined;
		this.status.hide();
	}

	dispose(): void {
		this.stop();
		this.status.dispose();
	}
}

/** One request: a file under the root, or a 404 that says which path was asked for. */
function respond(root: string, request: http.IncomingMessage, response: http.ServerResponse): void {
	let requested: string;
	try {
		requested = decodeURIComponent((request.url ?? '/').split('?')[0]);
	} catch {
		notFound(response, 'that path cannot be read');
		return;
	}

	// `.` keeps the join relative, and the prefix check is what stops `..` from walking out of the release.
	const resolved = path.resolve(root, `.${requested}`);
	if (resolved !== root && !resolved.startsWith(root + path.sep)) {
		notFound(response, requested);
		return;
	}

	let file = resolved;
	try {
		if (fs.statSync(file).isDirectory()) {
			file = path.join(file, 'index.html');
		}
	} catch {
		notFound(response, requested);
		return;
	}

	fs.readFile(file, (error, data) => {
		if (error) {
			notFound(response, requested);
			return;
		}
		response.writeHead(200, {
			'content-type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
			'cache-control': 'no-store',
			'content-length': data.length,
		});
		response.end(data);
	});
}

function notFound(response: http.ServerResponse, requested: string): void {
	const body = `<!DOCTYPE html><meta charset="utf-8"><title>Not found</title><body style="font:14px system-ui;padding:32px"><h1>404</h1><p><code>${escape(requested)}</code> is not in this release.</p><p>It may belong to a newer build: rebuilding and publishing again replaces this copy.</p>`;
	response.writeHead(404, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
	response.end(body);
}

function escape(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
