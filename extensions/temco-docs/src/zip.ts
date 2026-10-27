// Export: getting the documentation out of the platform and into someone else's hands.
//
// Three shapes, because three different readers exist: a **site zip** for a colleague who wants the finished website, a
// **single HTML file** for a page that has to survive being e-mailed, and a **Markdown bundle** for a writer who wants the
// sources somewhere else. All of it is local and offline.
//
// The zip writer is here rather than in a dependency: a documentation export is a handful of files, the format's store
// and deflate methods are the whole job, and an archive that any operating system can open is worth twenty lines of CRC32.

import { deflateRawSync } from 'zlib';

/** One file inside an archive. `name` is the path a reader sees after extracting it. */
export interface ZippedFile {
	name: string;
	data: Uint8Array;
}

const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let index = 0; index < 256; index++) {
		let value = index;
		for (let bit = 0; bit < 8; bit++) {
			value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
		}
		table[index] = value >>> 0;
	}
	return table;
})();

/** The checksum a zip entry carries, so a truncated or corrupted archive is detected by the reader instead of by the user. */
export function crc32(data: Uint8Array): number {
	let crc = 0xffffffff;
	for (let index = 0; index < data.length; index++) {
		crc = CRC_TABLE[(crc ^ data[index]) & 0xff] ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

/** MS-DOS date and time, which is what a zip header stores: seconds are two-second steps, years start at 1980. */
function dosStamp(when: Date): { time: number; date: number } {
	return {
		time: (when.getHours() << 11) | (when.getMinutes() << 5) | Math.floor(when.getSeconds() / 2),
		date: ((when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate()
	};
}

/**
 * A zip archive of the given files.
 *
 * Every entry is deflated unless deflating made it bigger (already-compressed pictures), the names are flagged UTF-8, and
 * the central directory is written last — the layout every unzip implementation, including Windows Explorer, expects.
 */
export function zip(files: readonly ZippedFile[], when: Date = new Date()): Buffer {
	const stamp = dosStamp(when);
	const locals: Buffer[] = [];
	const central: Buffer[] = [];
	let offset = 0;

	for (const file of files) {
		const name = Buffer.from(file.name.split('\\').join('/'), 'utf8');
		const raw = Buffer.from(file.data);
		const deflated = deflateRawSync(raw, { level: 9 });
		const compressed = deflated.length < raw.length;
		const body = compressed ? deflated : raw;
		const crc = crc32(raw);

		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(20, 4);
		local.writeUInt16LE(0x0800, 6);
		local.writeUInt16LE(compressed ? 8 : 0, 8);
		local.writeUInt16LE(stamp.time, 10);
		local.writeUInt16LE(stamp.date, 12);
		local.writeUInt32LE(crc, 14);
		local.writeUInt32LE(body.length, 18);
		local.writeUInt32LE(raw.length, 22);
		local.writeUInt16LE(name.length, 26);
		local.writeUInt16LE(0, 28);
		locals.push(local, name, body);

		const entry = Buffer.alloc(46);
		entry.writeUInt32LE(0x02014b50, 0);
		entry.writeUInt16LE(20, 4);
		entry.writeUInt16LE(20, 6);
		entry.writeUInt16LE(0x0800, 8);
		entry.writeUInt16LE(compressed ? 8 : 0, 10);
		entry.writeUInt16LE(stamp.time, 12);
		entry.writeUInt16LE(stamp.date, 14);
		entry.writeUInt32LE(crc, 16);
		entry.writeUInt32LE(body.length, 20);
		entry.writeUInt32LE(raw.length, 24);
		entry.writeUInt16LE(name.length, 28);
		entry.writeUInt16LE(0, 30);
		entry.writeUInt16LE(0, 32);
		entry.writeUInt16LE(0, 34);
		entry.writeUInt16LE(0, 36);
		entry.writeUInt32LE(0, 38);
		entry.writeUInt32LE(offset, 42);
		central.push(entry, name);

		offset += local.length + name.length + body.length;
	}

	const directory = Buffer.concat(central);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(0, 4);
	end.writeUInt16LE(0, 6);
	end.writeUInt16LE(files.length, 8);
	end.writeUInt16LE(files.length, 10);
	end.writeUInt32LE(directory.length, 12);
	end.writeUInt32LE(offset, 16);
	end.writeUInt16LE(0, 20);

	return Buffer.concat([...locals, directory, end]);
}
