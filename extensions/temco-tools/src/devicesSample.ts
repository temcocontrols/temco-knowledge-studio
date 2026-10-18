// The sample the Devices surfaces are drawn from, and the register the buttons act on.
//
// The controllers themselves are the mock's (`docs/mock/js/data.js`: `devices`, `firmware`, `alarms`), carried into
// `data.ts`; the rows that only the device pages use — schedules with their next run, trend logs with their buffer,
// one backup per controller — are the mock's `views.industrial.js`, carried here.
//
// Everything is **mutable on purpose**. Nothing in this build holds a socket to a controller, so a button that
// acknowledged an alarm and then showed the alarm still active would be a lie twice over: once about the write and
// once about the page. The buttons change this register, the page re-reads it, and each page's callout says the
// register is a copy rather than the device.

import { Device } from './data';

export interface ScheduleRow {
	device: string;
	name: string;
	next: string;
	state: 'Enabled' | 'Overridden' | 'Disabled';
	tone: 'ok' | 'warn' | 'neutral';
	entries: number;
}

export const SCHEDULE_ROWS: ScheduleRow[] = [
	{ device: 'T3-BB · AHU-1', name: 'Weekday occupancy', next: 'Tomorrow 06:00', state: 'Enabled', tone: 'ok', entries: 10 },
	{ device: 'T3-BB · AHU-1', name: 'Weekend setback', next: 'Saturday 00:00', state: 'Enabled', tone: 'ok', entries: 4 },
	{ device: 'T3-LB · Lighting', name: 'Exterior lighting', next: 'Today 18:30', state: 'Overridden', tone: 'warn', entries: 14 },
	{ device: 'T3-NC · Chiller', name: 'Condenser purge', next: 'Today 22:00', state: 'Enabled', tone: 'ok', entries: 6 },
	{ device: 'T3-8R · Boiler Room', name: 'Holiday lockout', next: '—', state: 'Disabled', tone: 'neutral', entries: 2 }
];

export interface ScheduleEntry {
	window: string;
	note: string;
	state?: string;
	tone?: 'warn';
}

export const SCHEDULE_ENTRIES: ScheduleEntry[] = [
	{ window: 'Mon – Wed 06:00 → 18:00', note: 'occupied · six entries' },
	{ window: 'Thu 06:00 → 20:00', note: 'late meeting · temporary override', state: 'Overridden', tone: 'warn' },
	{ window: 'Fri 06:00 → 17:00', note: 'occupied · six entries' }
];

export interface TrendLog {
	name: string;
	device: string;
	samples: number;
	interval: string;
	/** How full the controller's buffer is, as a percentage. */
	used: number;
	read: string;
	state: 'Read' | 'Buffer full';
	tone: 'ok' | 'warn';
}

export const TREND_LOGS: TrendLog[] = [
	{ name: 'AHU-1 Temperatures', device: 'T3-BB · AHU-1', samples: 1882, interval: '15 min', used: 64, read: '8 minutes ago', state: 'Read', tone: 'ok' },
	{ name: 'Valve Position', device: 'T3-BB · AHU-1', samples: 1882, interval: '15 min', used: 64, read: '8 minutes ago', state: 'Read', tone: 'ok' },
	{ name: 'Boiler Runtime', device: 'T3-8R · Boiler Room', samples: 940, interval: '1 h', used: 31, read: 'yesterday', state: 'Read', tone: 'ok' },
	{ name: 'Lab Environment', device: 'T3-22I · Lab Wing', samples: 402, interval: '30 min', used: 92, read: '2 hours ago', state: 'Buffer full', tone: 'warn' }
];

export interface TrendCard {
	title: string;
	mark: string;
	desc: string;
	values: number[];
	tone: 'accent' | 'ok' | 'warn';
	note: string;
}

/** The three charts above the log list: the last twelve samples of a point, as the device kept them. */
export const TREND_CARDS: TrendCard[] = [
	{ title: 'AHU-1 Temperatures', mark: 'chart', desc: 'Supply 18.4 °C · Return 22.1 °C', values: [18.1, 18.3, 18.2, 18.5, 18.9, 18.6, 18.4, 18.4, 18.2, 18.1, 18.3, 18.4], tone: 'accent', note: 'last 12 samples · 15 min interval' },
	{ title: 'Valve Position', mark: 'activity', desc: 'AO1 · 38.5 %', values: [12, 14, 18, 22, 31, 35, 33, 36, 38, 39, 38, 38.5], tone: 'ok', note: 'last 12 samples · 15 min interval' },
	{ title: 'Humidity · Lab Wing', mark: 'activity', desc: 'AI3 · 46.8 %RH', values: [52, 51, 49, 48, 47, 47, 46, 46, 47, 47, 46.8, 46.8], tone: 'warn', note: 'device offline since 10:38' }
];

export interface BackupRow {
	device: string;
	when: string;
	size: string;
	firmware: string;
	kind: string;
	tone: 'ok' | 'warn';
	/** A controller that has not answered since its last copy has nothing younger to offer. */
	stale?: boolean;
}

export const DEVICE_BACKUPS: BackupRow[] = [
	{ device: 'T3-BB · AHU-1', when: '2026-10-17 06:00', size: '418 KB', firmware: '2.14.3', kind: 'scheduled', tone: 'ok' },
	{ device: 'T3-8R · Boiler Room', when: '2026-10-17 06:00', size: '206 KB', firmware: '2.14.3', kind: 'scheduled', tone: 'ok' },
	{ device: 'T3-NC · Chiller', when: '2026-10-16 06:00', size: '312 KB', firmware: '2.14.1', kind: 'scheduled', tone: 'ok' },
	{ device: 'T3-22I · Lab Wing', when: '2026-10-03 06:00', size: '148 KB', firmware: '2.12.1', kind: 'last successful copy · device offline', tone: 'warn', stale: true }
];

/** The tone a controller's own state gives its row. */
export function deviceTone(device: Device): 'ok' | 'warn' | 'err' {
	return device.status === 'Offline' ? 'err' : device.status === 'Warning' ? 'warn' : 'ok';
}

/** A timestamp the pages can print: the register has no clock of its own, so the window's is the one used. */
export function now(): string {
	const at = new Date();
	const pad = (value: number): string => String(value).padStart(2, '0');
	return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}
