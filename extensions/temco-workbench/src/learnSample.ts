// The sample the Temco Learn surfaces are drawn from.
//
// The mock's (`docs/mock/js/data.js`: `learnProducts`, `learnPaths`, `downloads`), carried over as-is: the
// published site is a build artifact of the documentation registry, and these are the design's rows for it.

export interface Product {
	id: string;
	name: string;
	desc: string;
	version: string;
	pages: number;
}

export const PRODUCTS: Product[] = [
	{ id: 't3000', name: 'T3000', desc: 'The controller platform: hardware, points, programs and the web UI', version: '13.0', pages: 1254 },
	{ id: 'bacnet', name: 'BACnet', desc: 'Protocol reference, object model and conformance', version: '4.2', pages: 186 },
	{ id: 'devices', name: 'Devices', desc: 'Every T3 controller, its wiring and its specifications', version: '2.14', pages: 94 },
	{ id: 'sdk', name: 'SDK', desc: 'Build on the platform: APIs, schemas and samples', version: '1.4', pages: 80 }
];

export interface Path {
	name: string;
	level: string;
	steps: number;
	minutes: number;
	desc: string;
	outline: string[];
}

export const PATHS: Path[] = [
	{ name: 'Commission a T3 controller', level: 'Beginner', steps: 6, minutes: 55, desc: 'From unboxing to a device that answers on the network.', outline: ['Mount and wire the controller', 'Set the IP and add it to the platform', 'Name the first points'] },
	{ name: 'Design a control strategy', level: 'Intermediate', steps: 9, minutes: 130, desc: 'Points, programs, schedules and the logic behind them.', outline: ['Choose point types and scaling', 'Write the program', 'Schedule the setpoints'] },
	{ name: 'Write a BACnet integration', level: 'Advanced', steps: 11, minutes: 210, desc: 'Objects, services, alarms and trend logs across vendors.', outline: ['Map objects to points', 'Read a foreign device', 'Route alarms to the platform'] }
];

export interface Download {
	name: string;
	version: string;
	format: string;
	size: string;
	date: string;
	state: string;
	tone: string;
}

export const DOWNLOADS: Download[] = [
	{ name: 'T3000 Documentation', version: '13.0', format: 'PDF', size: '6.2 MB', date: 'Today', state: 'Ready', tone: 'ok' },
	{ name: 'T3000 Documentation', version: '13.0', format: 'CHM', size: '—', date: 'Today', state: 'Building', tone: 'info' },
	{ name: 'T3000 Documentation', version: '12.9', format: 'PDF', size: '6.0 MB', date: '12 Sep', state: 'Ready', tone: 'ok' },
	{ name: 'T3000 Documentation', version: '12.9', format: 'ZIP', size: '18.2 MB', date: '12 Sep', state: 'Ready', tone: 'ok' },
	{ name: 'T3-BACnet Reference', version: '4.2', format: 'PDF', size: '1.8 MB', date: '2 days ago', state: 'Ready', tone: 'ok' }
];

/** The areas the T3000 product page lists — the same eight the registry holds. */
export const AREAS = [
	{ area: 'Overview', pages: 24, stale: 0, desc: 'What the platform is, in one sitting' },
	{ area: 'Getting Started', pages: 56, stale: 3, desc: 'Install, connect, and a first point that answers' },
	{ area: 'Architecture', pages: 92, stale: 3, desc: 'How the controller, the points and the schedules fit' },
	{ area: 'API Reference', pages: 402, stale: 45, desc: 'Endpoints, schemas and the scale factor of every type' },
	{ area: 'Hardware', pages: 208, stale: 6, desc: 'Controllers, terminals, power and wiring diagrams' },
	{ area: 'Protocols', pages: 268, stale: 25, desc: 'Modbus, BACnet and MSTP, with worked examples' },
	{ area: 'Troubleshooting', pages: 148, stale: 7, desc: 'The failures people actually call about' },
	{ area: 'Release Notes', pages: 56, stale: 0, desc: 'What changed, version by version' }
];

/** What the site says about the two versions a reader can pick between. */
export const LIVE = { version: '12.9', date: '12 Sep' };
export const BUILDING = { version: '13.0' };
