// The sample the Network surfaces are drawn from, and the scan state their buttons change.
//
// The hosts and the Modbus units are the mock's (`docs/mock/js/data.js`: `hosts`, `modbus`), carried into `data.ts`;
// the register rows and the capture rows are the mock's `views.industrial.js`, carried here because only these pages
// read them.
//
// Mutable for the same reason the other studios' samples are: this build has no ARP table, no Modbus master and no
// capture device, so a "scan" changes what the register says and the pages say that is what happened.

export interface ModbusRegister {
	unit: number;
	register: string;
	name: string;
	value: string;
	type: string;
	state: 'OK' | 'Timeout';
	tone: 'ok' | 'warn';
}

export const MODBUS_REGISTERS: ModbusRegister[] = [
	{ unit: 1, register: '40001', name: 'Supply air temp × 10', value: '184', type: 'INT16', state: 'OK', tone: 'ok' },
	{ unit: 1, register: '40002', name: 'Return air temp × 10', value: '221', type: 'INT16', state: 'OK', tone: 'ok' },
	{ unit: 1, register: '40010', name: 'Valve position', value: '385', type: 'INT16', state: 'OK', tone: 'ok' },
	{ unit: 2, register: '40001', name: 'Boiler flow', value: '—', type: 'INT16', state: 'Timeout', tone: 'warn' },
	{ unit: 7, register: '00001', name: 'Filter alarm', value: '1', type: 'COIL', state: 'OK', tone: 'ok' }
];

export interface CaptureRow {
	name: string;
	detail: string;
	state: 'Closed' | 'Recording';
	tone: 'neutral' | 'info';
	/** The filter, kept beside the file: a capture without it is a file nobody can repeat. */
	filter: string;
}

export const NETWORK_CAPTURES: CaptureRow[] = [
	{ name: 'bacnet-whois-2026-10-17.pcapng', detail: '2,408 packets · filter "udp port 47808" · 1.2 MB', state: 'Closed', tone: 'neutral', filter: 'udp port 47808' },
	{ name: 'modbus-timeouts.pcapng', detail: '118 packets · filter "tcp port 502 and ip.addr == 192.168.10.50" · 84 KB', state: 'Closed', tone: 'neutral', filter: 'tcp port 502 and ip.addr == 192.168.10.50' },
	{ name: 'Live capture · all traffic', detail: 'recording · 14,882 packets · filter "not port 3389"', state: 'Recording', tone: 'info', filter: 'not port 3389' }
];

/** The segment the Discovery toolbar shows, and when it was last walked. */
export let segmentRange = '192.168.10.0/24';
export let segmentScan = 'scanned 4 minutes ago';

export function recordSegmentScan(range: string): void {
	segmentRange = range;
	segmentScan = 'scanned just now';
}

/** The Modbus endpoint and the last unit sweep. */
export let modbusEndpoint = '192.168.10.50:502';
export let modbusScan = 'last sweep 4 minutes ago';

export function recordModbusScan(endpoint: string): void {
	modbusEndpoint = endpoint;
	modbusScan = 'last sweep just now';
}

/** When Diagnostics last ran — the tiles and the ping block are only as old as this. */
export let diagnosticsRun = 'last run 4 minutes ago';

export function recordDiagnosticsRun(): void {
	diagnosticsRun = 'last run just now';
}

/** What a ping measured, as the register has it: an answering host has a latency, a silent one has none. */
export function latency(state: string): string {
	return state === 'Online' ? '2–6 ms' : '—';
}
