// A picture of the screen, taken where the screen is.
//
// `getDisplayMedia` is not dependable inside a webview — the frame is not granted display capture in every build — so the
// capture happens outside the browser: a small platform command writes a PNG to a temporary file and the bytes come back.
// Kept apart from `bridge.ts` because nothing here knows about a document, a panel or a page: it takes a picture and it
// returns it.

import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

const run = promisify(execFile);

/**
 * A PNG of the primary screen.
 *
 * `undefined` when this platform has no way to take one — the caller says so in words, because a button that quietly does
 * nothing is the failure a person cannot report.
 */
export async function screenshotPng(): Promise<Uint8Array | undefined> {
	const file = path.join(os.tmpdir(), `temco-capture-${Date.now()}.png`);
	try {
		if (process.platform === 'win32') {
			// The path is single-quoted inside a PowerShell string, so a quote in it is doubled rather than escaping.
			const target = file.replace(/'/g, "''");
			const script = [
				'Add-Type -AssemblyName System.Windows.Forms,System.Drawing',
				'$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds',
				'$bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height',
				'$g = [System.Drawing.Graphics]::FromImage($bmp)',
				'$g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)',
				`$bmp.Save('${target}', [System.Drawing.Imaging.ImageFormat]::Png)`,
				'$g.Dispose(); $bmp.Dispose()',
			].join('; ');
			await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 20000 });
		} else if (process.platform === 'darwin') {
			await run('screencapture', ['-x', file], { timeout: 20000 });
		} else {
			return undefined;
		}
		return await fs.readFile(file);
	} finally {
		await fs.rm(file, { force: true }).catch(() => undefined);
	}
}
