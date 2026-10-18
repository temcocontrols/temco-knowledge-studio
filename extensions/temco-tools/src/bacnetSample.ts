// The sample the BACnet Studio surfaces are drawn from, and the scan state their buttons change.
//
// The hosts, the objects and the event log are the mock's (`docs/mock/js/data.js`: `hosts`, `bacnetObjects`,
// `alarms`), already carried into `data.ts`; the rows that only these pages use — the log objects with their buffer,
// and the schedule objects with their next run — are the mock's `views.industrial.js`.
//
// Mutable for the reason the other studios are: this build has no BACnet stack, so a page that "read" an object and
// still showed a stale value would be wrong twice. What the buttons change is the register; the pages say so.

export interface BacnetTrendLog {
	name: string;
	/** The object id on the device, as BACnet addresses it. */
	object: string;
	samples: number;
	/** How full the device's buffer is, as a percentage. */
	used: number;
	read: string;
}

export const BACNET_TREND_LOGS: BacnetTrendLog[] = [
	{ name: 'AHU-1 Temperatures', object: 'trend-log, 4', samples: 1882, used: 64, read: '8 minutes ago' },
	{ name: 'Valve Position', object: 'trend-log, 5', samples: 1882, used: 64, read: '8 minutes ago' },
	{ name: 'Boiler Runtime', object: 'trend-log, 12', samples: 940, used: 31, read: 'yesterday' },
	{ name: 'Lab Environment', object: 'trend-log, 2', samples: 402, used: 92, read: '2 hours ago' }
];

export interface BacnetSchedule {
	object: string;
	name: string;
	device: string;
	entries: number;
	next: string;
	state: 'Active' | 'Overridden' | 'Disabled';
	tone: 'ok' | 'warn' | 'neutral';
}

export const BACNET_SCHEDULES: BacnetSchedule[] = [
	{ object: 'SCH-1', name: 'Weekday Schedule', device: 'T3-BB · AHU-1', entries: 10, next: 'Tomorrow 06:00', state: 'Active', tone: 'ok' },
	{ object: 'SCH-2', name: 'Weekend Setback', device: 'T3-BB · AHU-1', entries: 4, next: 'Saturday 00:00', state: 'Active', tone: 'ok' },
	{ object: 'SCH-7', name: 'Exterior Lighting', device: 'T3-LB · Lighting', entries: 14, next: 'Today 18:30', state: 'Overridden', tone: 'warn' }
];

/** What the last Who-Is covered, and when — the toolbar line, and the sentence the scan says afterwards. */
export let scanRange = '192.168.10.0/24';
export let lastScan = 'scanned 4 minutes ago';

export function recordScan(range: string): void {
	scanRange = range;
	lastScan = 'scanned just now';
}

/** The controller whose objects the Object Browser is showing; Discovery's row buttons move it. */
export let objectDevice = 'T3-BB · AHU-1';

export function setObjectDevice(name: string): void {
	objectDevice = name;
}

/** The last object read, so the page can say when it happened instead of pretending it is live. */
export let objectsReadAt = 'read 4 minutes ago';

export function recordObjectRead(): void {
	objectsReadAt = 'read just now';
}
