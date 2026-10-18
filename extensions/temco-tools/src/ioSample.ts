// The sample the I/O Studio surfaces are drawn from, and the state their buttons change.
//
// The points and the mappings are the mock's (`docs/mock/js/data.js`: `points`, `mappings`), already carried into
// `data.ts`; the three rows only these pages use — the programs on the device with their source, the values a live
// subscription is showing, and the series a trend overlays — are the mock's `views.industrial.js`.
//
// As with Devices, everything here is **mutable**: there is no connection to a controller in this build, so a write
// that changed nothing would leave a page insisting on a value the person had just replaced. The pages re-read this
// table, and each one says at the foot that it is the register rather than the device.

export type ProgramState = 'Running' | 'Idle' | 'Needs compile';

export interface Program {
	name: string;
	state: ProgramState;
	tone: 'ok' | 'neutral' | 'warn';
	note: string;
	/** The listing the Logic page shows when this program is the one open. */
	source: string;
}

export const PROGRAMS: Program[] = [
	{
		name: 'AHU-1 Supply Control',
		state: 'Running',
		tone: 'ok',
		note: 'compiled 09:12 · device T3-BB',
		source: [
			'// AHU-1 supply air control',
			'// compiled 2026-10-17 09:12 · device T3-BB (SN 2371)',
			'',
			'VAR',
			'  setpoint  : AV-101;   // 21.0 °C',
			'  supply    : AV-102;',
			'  valve     : AO1;',
			'  fan       : AO2;',
			'END_VAR',
			'',
			'// PI loop, 30 s',
			'valve := PID(supply, setpoint, Kp := 2.4, Ki := 0.12);',
			'valve := LIMIT(valve, 0.0, 100.0);',
			'',
			'IF DI1 = FAULT THEN',
			'  fan   := 0.0;',
			'  valve := 0.0;',
			'  ALARM(31);',
			'END_IF'
		].join('\n')
	},
	{
		name: 'AHU-1 Schedule Override',
		state: 'Idle',
		tone: 'neutral',
		note: 'compiled 09:12',
		source: [
			'// AHU-1 schedule override',
			'// compiled 2026-10-17 09:12 · device T3-BB (SN 2371)',
			'',
			'IF MSV-7 = OCCUPIED THEN',
			'  AV-103 := 21.0;',
			'ELSE',
			'  AV-103 := 17.0;',
			'END_IF'
		].join('\n')
	},
	{
		name: 'Alarm Routing',
		state: 'Needs compile',
		tone: 'warn',
		note: 'changed 2 days ago',
		source: [
			'// Alarm routing',
			'// not compiled since it was changed',
			'',
			'IF BV-31 = ACTIVE THEN',
			'  ROUTE(31, "maintenance");',
			'END_IF'
		].join('\n')
	}
];

/** The program whose listing is shown when Logic opens. `edit-program` moves it. */
export let selectedProgram = 0;

export function selectProgram(name: string): boolean {
	const index = PROGRAMS.findIndex((program) => program.name === name);
	if (index < 0) {
		return false;
	}
	selectedProgram = index;
	return true;
}

export interface LiveSubscriber {
	name: string;
	points: number;
	state: 'Live' | 'No answer';
	tone: 'ok' | 'err';
}

export const LIVE_SUBSCRIBED: LiveSubscriber[] = [
	{ name: 'T3-BB · AHU-1', points: 96, state: 'Live', tone: 'ok' },
	{ name: 'T3-8R · Boiler Room', points: 48, state: 'Live', tone: 'ok' },
	{ name: 'T3-22I · Lab Wing', points: 22, state: 'No answer', tone: 'err' }
];

/** A live page that is paused stops updating; the subscription itself ends when the tab closes. */
export let livePaused = false;

export function setLivePaused(paused: boolean): void {
	livePaused = paused;
}

export interface TrendSeries {
	label: string;
	values: number[];
	tone: 'accent' | 'ok' | 'warn' | 'subtle';
	/** A series the person added is one they can only remove by closing the tab: nothing is saved. */
	added?: boolean;
}

export const TREND_TITLE = 'AHU-1 · Supply Air Temperature vs Setpoint';
export const TREND_NOTE = '15-minute samples · last 3 hours · firmware 2.14.3';

export const TREND_SERIES: TrendSeries[] = [
	{ label: 'Supply air 18.4 °C', values: [18.1, 18.3, 18.2, 18.5, 18.9, 18.6, 18.4, 18.4, 18.2, 18.1, 18.3, 18.4], tone: 'accent' },
	{ label: 'Setpoint 18.0 °C', values: [18.0, 18.0, 18.0, 18.0, 18.0, 18.0, 18.0, 18.0, 18.0, 18.0, 18.0, 18.0], tone: 'subtle' }
];

/** What "Add Series" offers on this controller, and nothing invented: the points that have a trend. */
export const SERIES_CANDIDATES: TrendSeries[] = [
	{ label: 'Valve position 38.5 %', values: [12, 14, 18, 22, 31, 35, 33, 36, 38, 39, 38, 38.5], tone: 'ok', added: true },
	{ label: 'Fan speed 62.0 %', values: [58, 60, 61, 62, 61, 62, 62, 63, 62, 62, 61, 62], tone: 'warn', added: true }
];

/** Which candidate a second Add Series would bring in. */
export function nextSeries(): TrendSeries | undefined {
	return SERIES_CANDIDATES.find((candidate) => !TREND_SERIES.some((series) => series.label === candidate.label));
}
