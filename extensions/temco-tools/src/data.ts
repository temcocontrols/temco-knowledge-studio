// The sample the tool pages are drawn from.
//
// The modules that will own these pages do not have a backend yet (they are reserved: no device socket, no BACnet
// stack, no SQL driver). So that the surfaces exist and can be judged — and so the day a backend lands it has a
// shape to fill rather than a design to invent — the pages read this table. It is the mock's sample, carried over
// verbatim, and every page says which of its numbers came from here.

export interface Device {
	serial: number;
	name: string;
	product: string;
	ip: string;
	status: 'Online' | 'Offline' | 'Warning';
	firmware: string;
	points: number;
	alarms: number;
	last: string;
}

export interface Point {
	id: string;
	label: string;
	type: string;
	unit: string;
	value: string;
	range: string;
	state: 'ok' | 'warn';
}

export interface Alarm {
	time: string;
	device: string;
	message: string;
	priority: string;
	state: string;
	tone: 'err' | 'warn' | 'ok' | 'neutral';
}

export interface Host {
	ip: string;
	mac: string;
	name: string;
	vendor: string;
	protocol: string;
	state: string;
	tone: 'ok' | 'err';
}

export const DEVICES: Device[] = [
	{ serial: 2371, name: 'T3-BB · AHU-1', product: 'T3-BB', ip: '192.168.10.21', status: 'Online', firmware: '2.14.3', points: 96, alarms: 1, last: 'just now' },
	{ serial: 2372, name: 'T3-8R · Boiler Room', product: 'T3-8R', ip: '192.168.10.22', status: 'Online', firmware: '2.14.3', points: 48, alarms: 0, last: '8 s ago' },
	{ serial: 2388, name: 'T3-22I · Lab Wing', product: 'T3-22I', ip: '192.168.10.31', status: 'Offline', firmware: '2.12.1', points: 22, alarms: 2, last: '2 h ago' },
	{ serial: 2401, name: 'T3-NC · Chiller', product: 'T3-NC', ip: '192.168.10.35', status: 'Online', firmware: '2.14.1', points: 64, alarms: 0, last: '12 s ago' },
	{ serial: 2402, name: 'T3-LB · Lighting', product: 'T3-LB', ip: '192.168.10.41', status: 'Online', firmware: '2.14.3', points: 40, alarms: 1, last: '3 s ago' },
	{ serial: 2410, name: 'T3-EXP · Floor 2', product: 'T3-EXP', ip: '192.168.10.42', status: 'Warning', firmware: '2.13.7', points: 32, alarms: 1, last: '45 s ago' }
];

export const FIRMWARE = [
	{ version: '2.14.3', channel: 'Stable', devices: 21, size: '3.8 MB', released: '2 weeks ago', state: 'Current', tone: 'ok' as const },
	{ version: '2.14.1', channel: 'Stable', devices: 6, size: '3.8 MB', released: '1 month ago', state: 'Update available', tone: 'warn' as const },
	{ version: '2.15.0-rc2', channel: 'Preview', devices: 0, size: '3.9 MB', released: '3 days ago', state: 'Not staged', tone: 'neutral' as const }
];

export const POINTS: Point[] = [
	{ id: 'AI1', label: 'Supply Air Temp', type: 'AI', unit: '°C', value: '18.4', range: '0 – 50', state: 'ok' },
	{ id: 'AI2', label: 'Return Air Temp', type: 'AI', unit: '°C', value: '22.1', range: '0 – 50', state: 'ok' },
	{ id: 'AI3', label: 'Humidity', type: 'AI', unit: '%RH', value: '46.8', range: '0 – 100', state: 'ok' },
	{ id: 'AO1', label: 'Valve Position', type: 'AO', unit: '%', value: '38.5', range: '0 – 100', state: 'ok' },
	{ id: 'AO2', label: 'Fan Speed', type: 'AO', unit: '%', value: '62.0', range: '0 – 100', state: 'ok' },
	{ id: 'DI1', label: 'Filter Status', type: 'DI', unit: '—', value: 'Normal', range: 'Open / Closed', state: 'warn' },
	{ id: 'DO1', label: 'Alarm Relay', type: 'DO', unit: '—', value: 'Off', range: 'On / Off', state: 'ok' }
];

export interface Mapping {
	source: string;
	target: string;
	scale: string;
	state: 'Mapped' | 'Needs review' | 'Unmapped';
	tone: 'ok' | 'warn' | 'neutral';
}

export const MAPPINGS: Mapping[] = [
	{ source: 'AI1 · Supply Air Temp', target: 'AV-101 · SAT', scale: '×1.0 + 0', state: 'Mapped', tone: 'ok' },
	{ source: 'AI2 · Return Air Temp', target: 'AV-102 · RAT', scale: '×1.0 + 0', state: 'Mapped', tone: 'ok' },
	{ source: 'AO1 · Valve Position', target: 'BO-11 · Heat Valve', scale: '×1.0 + 0', state: 'Mapped', tone: 'ok' },
	{ source: 'DI1 · Filter Status', target: 'BV-31 · Filter Alarm', scale: '—', state: 'Needs review', tone: 'warn' },
	{ source: 'AI3 · Humidity', target: '—', scale: '—', state: 'Unmapped', tone: 'neutral' }
];

export const BACNET_OBJECTS = [
	{ instance: 'AV-101', type: 'Analog Value', name: 'Supply Air Temp', units: '°C', value: '18.4', flags: '—' },
	{ instance: 'AV-102', type: 'Analog Value', name: 'Return Air Temp', units: '°C', value: '22.1', flags: '—' },
	{ instance: 'AV-103', type: 'Analog Value', name: 'Valve Position', units: '%', value: '38.5', flags: '—' },
	{ instance: 'BV-31', type: 'Binary Value', name: 'Filter Alarm', units: '—', value: 'Inactive', flags: 'Fault' },
	{ instance: 'MSV-7', type: 'Multi-state Value', name: 'Occupancy Mode', units: '—', value: 'Occupied', flags: '—' },
	{ instance: 'SCH-1', type: 'Schedule', name: 'Weekday Schedule', units: '—', value: 'Active', flags: '—' },
	{ instance: 'TL-4', type: 'Trend Log', name: 'AHU-1 Temperatures', units: '°C', value: '1,882 samples', flags: '—' }
];

export const ALARMS: Alarm[] = [
	{ time: '12:41', device: 'T3-22I · Lab Wing', message: 'Device not responding (2 h)', priority: 'High', state: 'Active', tone: 'err' },
	{ time: '11:58', device: 'T3-EXP · Floor 2', message: 'Sensor fault · AI3 open circuit', priority: 'Medium', state: 'Active', tone: 'warn' },
	{ time: '10:12', device: 'T3-BB · AHU-1', message: 'Filter differential above limit', priority: 'Low', state: 'Acknowledged', tone: 'neutral' },
	{ time: '09:04', device: 'T3-LB · Lighting', message: 'Schedule override applied', priority: 'Low', state: 'Cleared', tone: 'ok' }
];

export const HOSTS: Host[] = [
	{ ip: '192.168.10.21', mac: '00:0C:5A:11:22:33', name: 'T3-BB', vendor: 'Temco', protocol: 'BACnet/IP', state: 'Online', tone: 'ok' },
	{ ip: '192.168.10.22', mac: '00:0C:5A:11:22:34', name: 'T3-8R', vendor: 'Temco', protocol: 'BACnet/IP', state: 'Online', tone: 'ok' },
	{ ip: '192.168.10.31', mac: '00:0C:5A:11:22:41', name: 'T3-22I', vendor: 'Temco', protocol: 'BACnet/IP', state: 'Unreachable', tone: 'err' },
	{ ip: '192.168.10.50', mac: '00:1D:9C:44:11:02', name: 'Modbus Gateway', vendor: 'Moxa', protocol: 'Modbus TCP', state: 'Online', tone: 'ok' },
	{ ip: '192.168.10.77', mac: 'A4:BB:6D:01:9F:12', name: 'Workstation', vendor: 'Dell', protocol: '—', state: 'Online', tone: 'ok' }
];

export const MODBUS = [
	{ unit: 1, name: 'Gateway · Meter block', function: '03 Holding', registers: '40001 – 40040', state: 'Answered', tone: 'ok' as const },
	{ unit: 2, name: 'Gateway · Status', function: '04 Input', registers: '30001 – 30008', state: 'Answered', tone: 'ok' as const },
	{ unit: 9, name: '—', function: '03 Holding', registers: '40001 – 40010', state: 'Timeout', tone: 'err' as const }
];

