// The tool surfaces, drawn from the mock's pages.
//
// One renderer per studio, one section per surface. The section a tree row names is the one opened when the page
// arrives; the rest stay folded, so "Firmware" from the side bar lands on Firmware without a second page for every
// row.
//
// The vocabulary is `temco-ui`'s (`page.css`), the same one the guide and the welcome page use: a page head, group
// rules, record rows, tables and badges — no private styles here.

import { icon } from './ui';
import {
	ALARMS, BACNET_OBJECTS, BACKUPS, CAPTURES, CONNECTIONS, DEVICES, FIRMWARE, HOSTS, MAPPINGS, MODBUS, POINTS,
	REPORTS, SCHEDULES, SQL_COLUMNS, SQL_HISTORY, SQL_QUERIES, SQL_TABLES, TRENDS
} from './data';

/** Everything interpolated into a page goes through this: the sample is ours, but a device name never is. */
export function esc(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function badge(text: string, tone?: string): string {
	return `<span class="badge${tone ? ` badge--${tone}` : ''}">${esc(text)}</span>`;
}

function table(headers: string[], rows: string[][], plain = true): string {
	const head = headers.map((cell) => `<th>${esc(cell)}</th>`).join('');
	const body = rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('');
	return `<div class="table-wrap${plain ? ' table-wrap--plain' : ''}"><table class="table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

export interface Surface {
	id: string;
	label: string;
	count: string;
	/** The glyph the side bar gives the row, as the mock's side bar does: one mark per surface. */
	mark: string;
	body: string;
}

/** One surface, folded unless the side bar asked for it. */
function section(surface: Surface, open: string | undefined): string {
	return `<details class="studio"${surface.id === open ? ' open' : ''}>
	<summary><span class="group-head"><span class="group-head__label">${esc(surface.label)}</span><span class="group-head__rule"></span><span class="group-head__count">${esc(surface.count)}</span></span></summary>
	${surface.body}
</details>`;
}

/** The page: a head, the surface the tree asked for, and the rest of the studio behind it. */
export function studioPage(title: string, desc: string, surfaces: Surface[], open: string | undefined, actions: string, mark: string): string {
	return `<div class="page-head">
	<div class="page-head__main">
		<h1 class="page-head__title">${icon(mark)}${esc(title)}</h1>
		<p class="page-head__desc">${desc}</p>
	</div>
	<div class="page-head__actions">${actions}</div>
</div>
${surfaces.map((surface) => section(surface, open)).join('')}`;
}

/** A run of actions that all go to one studio — the buttons under its head. */
export function commandButton(label: string, command: string, args?: unknown[], kind?: 'primary' | 'ghost'): string {
	const attrs = args === undefined ? '' : ` data-args="${esc(JSON.stringify(args))}"`;
	return `<button type="button" class="btn${kind ? ` btn--${kind}` : ''}" data-command="${command}"${attrs}><span>${esc(label)}</span></button>`;
}

/* ------------------------------------------------------------------ Devices */

export const DEVICE_SURFACES: Surface[] = [
	{
		id: 'devices', label: 'Devices', count: `${DEVICES.length} on the segment`, mark: 'circuit-board',
		body: table(['Device', 'Serial', 'IP', 'Firmware', 'Points', 'Alarms', 'Seen'], DEVICES.map((device) => [
			`<span class="cell-strong">${esc(device.name)}</span>`,
			`<span class="cell-mono">${device.serial}</span>`,
			`<span class="cell-mono">${esc(device.ip)}</span>`,
			`<span class="cell-mono">${esc(device.firmware)}</span>`,
			String(device.points),
			device.alarms > 0 ? badge(`${device.alarms} active`, 'warn') : badge('none', 'ok'),
			`<span class="cell-muted">${esc(device.last)}</span>`
		]))
	},
	{
		id: 'firmware', label: 'Firmware', count: `${FIRMWARE.length} builds`, mark: 'package',
		body: table(['Version', 'Channel', 'Devices', 'Size', 'Released', 'State'], FIRMWARE.map((entry) => [
			`<span class="cell-mono cell-strong">${esc(entry.version)}</span>`,
			esc(entry.channel),
			String(entry.devices),
			esc(entry.size),
			`<span class="cell-muted">${esc(entry.released)}</span>`,
			badge(entry.state, entry.tone === 'neutral' ? undefined : entry.tone)
		]))
	},
	{
		id: 'health', label: 'Health & Alarms', count: `${ALARMS.filter((alarm) => alarm.state === 'Active').length} active`, mark: 'warning',
		body: table(['Time', 'Device', 'Message', 'Priority', 'State'], ALARMS.map((alarm) => [
			`<span class="cell-mono">${esc(alarm.time)}</span>`,
			esc(alarm.device),
			esc(alarm.message),
			esc(alarm.priority),
			badge(alarm.state, alarm.tone === 'neutral' ? undefined : alarm.tone)
		]))
	},
	{
		id: 'schedules', label: 'Schedules', count: `${SCHEDULES.length} programs`, mark: 'clock',
		body: table(['Schedule', 'Device', 'Exceptions', 'State'], SCHEDULES.map((entry) => [
			`<span class="cell-strong">${esc(entry.name)}</span>`,
			esc(entry.device),
			String(entry.exceptions),
			badge(entry.state, entry.tone === 'neutral' ? undefined : entry.tone)
		]))
	},
	{
		id: 'trends', label: 'Trend Logs', count: `${TRENDS.length} logs`, mark: 'graph',
		body: table(['Log', 'Samples', 'Interval', 'Since', 'State'], TRENDS.map((entry) => [
			`<span class="cell-strong">${esc(entry.name)}</span>`,
			entry.samples.toLocaleString('en-US'),
			esc(entry.interval),
			esc(entry.since),
			badge(entry.state, 'ok')
		]))
	},
	{
		id: 'backups', label: 'Backups', count: `${BACKUPS.length} runs`, mark: 'cloud-download',
		body: table(['Run', 'Devices', 'Size', 'Taken', 'State'], BACKUPS.map((entry) => [
			`<span class="cell-strong">${esc(entry.name)}</span>`,
			esc(entry.device),
			esc(entry.size),
			`<span class="cell-muted">${esc(entry.took)}</span>`,
			badge(entry.state, entry.tone)
		]))
	}
];

/* ---------------------------------------------------------------- I/O Studio */

export const IO_SURFACES: Surface[] = [
	{
		id: 'points', label: 'Point Browser', count: `${POINTS.length} points`, mark: 'list-unordered',
		body: table(['Point', 'Label', 'Type', 'Value', 'Range', 'State'], POINTS.map((point) => [
			`<span class="cell-mono cell-strong">${esc(point.id)}</span>`,
			esc(point.label),
			esc(point.type),
			`<span class="cell-mono">${esc(point.value)} ${esc(point.unit)}</span>`,
			`<span class="cell-muted">${esc(point.range)}</span>`,
			badge(point.state === 'ok' ? 'Normal' : 'Check', point.state)
		]))
	},
	{
		id: 'mapping', label: 'Mapping', count: `${MAPPINGS.filter((entry) => entry.state === 'Mapped').length} of ${MAPPINGS.length} mapped`, mark: 'link',
		body: table(['Source', 'Target', 'Scale', 'State'], MAPPINGS.map((entry) => [
			esc(entry.source),
			`<span class="cell-mono">${esc(entry.target)}</span>`,
			`<span class="cell-muted">${esc(entry.scale)}</span>`,
			badge(entry.state, entry.tone === 'neutral' ? undefined : entry.tone)
		]))
	},
	{
		id: 'logic', label: 'Logic', count: '3 blocks', mark: 'code',
		body: table(['Block', 'Reads', 'Writes', 'State'], [
			['Supply air reset', 'AI1 · AI2', 'AO2 · Fan Speed', badge('Running', 'ok')],
			['Filter alarm', 'DI1 · Filter Status', 'DO1 · Alarm Relay', badge('Running', 'ok')],
			['Night setback', 'SCH-1 · Weekday', 'AO1 · Valve Position', badge('Idle')]
		])
	},
	{
		id: 'live', label: 'Live Values', count: 'updates every 2 s', mark: 'pulse',
		body: table(['Point', 'Now', 'Unit', 'Updated'], POINTS.slice(0, 5).map((point) => [
			`<span class="cell-mono cell-strong">${esc(point.id)}</span>`,
			`<span class="cell-mono">${esc(point.value)}</span>`,
			esc(point.unit),
			'<span class="cell-muted">just now</span>'
		]))
	},
	{
		id: 'trends', label: 'Trends', count: `${TRENDS.length} series`, mark: 'graph',
		body: table(['Series', 'Samples', 'Interval', 'Since'], TRENDS.map((entry) => [
			`<span class="cell-strong">${esc(entry.name)}</span>`,
			entry.samples.toLocaleString('en-US'),
			esc(entry.interval),
			esc(entry.since)
		]))
	}
];

/* ------------------------------------------------------------- BACnet Studio */

export const BACNET_SURFACES: Surface[] = [
	{
		id: 'discovery', label: 'Discovery', count: `${HOSTS.filter((host) => host.protocol === 'BACnet/IP').length} devices`, mark: 'search',
		body: table(['IP', 'Name', 'Vendor', 'Protocol', 'State'], HOSTS.map((host) => [
			`<span class="cell-mono">${esc(host.ip)}</span>`,
			`<span class="cell-strong">${esc(host.name)}</span>`,
			esc(host.vendor),
			esc(host.protocol),
			badge(host.state, host.tone)
		]))
	},
	{
		id: 'objects', label: 'Object Browser', count: `${BACNET_OBJECTS.length} objects`, mark: 'list-unordered',
		body: table(['Instance', 'Type', 'Name', 'Units', 'Value', 'Flags'], BACNET_OBJECTS.map((entry) => [
			`<span class="cell-mono cell-strong">${esc(entry.instance)}</span>`,
			esc(entry.type),
			esc(entry.name),
			esc(entry.units),
			`<span class="cell-mono">${esc(entry.value)}</span>`,
			entry.flags === '—' ? '<span class="cell-muted">—</span>' : badge(entry.flags, 'warn')
		]))
	},
	{
		id: 'alarms', label: 'Alarms', count: `${ALARMS.length} events`, mark: 'warning',
		body: table(['Time', 'Device', 'Message', 'State'], ALARMS.map((alarm) => [
			`<span class="cell-mono">${esc(alarm.time)}</span>`,
			esc(alarm.device),
			esc(alarm.message),
			badge(alarm.state, alarm.tone === 'neutral' ? undefined : alarm.tone)
		]))
	},
	{
		id: 'trends', label: 'Trend Logs', count: `${TRENDS.length} logs`, mark: 'graph',
		body: table(['Log', 'Samples', 'Interval'], TRENDS.map((entry) => [
			`<span class="cell-strong">${esc(entry.name)}</span>`,
			entry.samples.toLocaleString('en-US'),
			esc(entry.interval)
		]))
	},
	{
		id: 'schedules', label: 'Schedules', count: `${SCHEDULES.length} programs`, mark: 'clock',
		body: table(['Schedule', 'Device', 'State'], SCHEDULES.map((entry) => [
			`<span class="cell-strong">${esc(entry.name)}</span>`,
			esc(entry.device),
			badge(entry.state, entry.tone === 'neutral' ? undefined : entry.tone)
		]))
	}
];

/* ------------------------------------------------------------------ Network */

export const NETWORK_SURFACES: Surface[] = [
	{
		id: 'discovery', label: 'Discovery', count: `${HOSTS.length} hosts`, mark: 'search',
		body: table(['IP', 'MAC', 'Name', 'Vendor', 'Protocol', 'State'], HOSTS.map((host) => [
			`<span class="cell-mono">${esc(host.ip)}</span>`,
			`<span class="cell-mono cell-muted">${esc(host.mac)}</span>`,
			`<span class="cell-strong">${esc(host.name)}</span>`,
			esc(host.vendor),
			esc(host.protocol),
			badge(host.state, host.tone)
		]))
	},
	{
		id: 'modbus', label: 'Modbus Scanner', count: `${MODBUS.length} units probed`, mark: 'list-unordered',
		body: table(['Unit', 'Name', 'Function', 'Registers', 'State'], MODBUS.map((entry) => [
			`<span class="cell-mono">${entry.unit}</span>`,
			esc(entry.name),
			esc(entry.function),
			`<span class="cell-mono">${esc(entry.registers)}</span>`,
			badge(entry.state, entry.tone)
		]))
	},
	{
		id: 'diagnostics', label: 'Diagnostics', count: 'one host at a time', mark: 'pulse',
		body: `<pre class="code">PING 192.168.10.31 (192.168.10.31): 56 data bytes
Request timeout for icmp_seq 0
Request timeout for icmp_seq 1
--- 192.168.10.31 ping statistics ---
3 packets transmitted, 0 packets received, 100.0% packet loss</pre>
<p class="group-note">A host that answers ping but not BACnet is a different problem from one that answers neither, so the two
checks are reported apart.</p>`
	},
	{
		id: 'captures', label: 'Captures', count: `${CAPTURES.length} files`, mark: 'cloud-download',
		body: table(['Capture', 'Packets', 'Size', 'Taken', 'Note'], CAPTURES.map((entry) => [
			`<span class="cell-mono cell-strong">${esc(entry.name)}</span>`,
			String(entry.packets),
			esc(entry.size),
			`<span class="cell-muted">${esc(entry.took)}</span>`,
			`<span class="cell-muted">${esc(entry.note)}</span>`
		]))
	}
];

/* --------------------------------------------------------------- SQL Studio */

export const SQL_SURFACES: Surface[] = [
	{
		id: 'query', label: 'Query Editor', count: `${SQL_QUERIES[0].rows} rows · ${SQL_QUERIES[0].ms} ms`, mark: 'code',
		body: `<pre class="code">${esc(SQL_QUERIES[0].sql)}</pre>
${table(['Area', 'Stale pages'], [['Hardware', '21'], ['Firmware', '18'], ['Protocol', '14'], ['Getting Started', '11'], ['API Reference', '9'], ['Troubleshooting', '8'], ['Release Notes', '5'], ['Glossary', '3']])}`
	},
	{
		id: 'connections', label: 'Connections', count: `${CONNECTIONS.length} configured`, mark: 'database',
		body: table(['Name', 'Kind', 'Host', 'Database', 'Access', 'State'], CONNECTIONS.map((entry) => [
			`<span class="cell-strong">${esc(entry.name)}</span>`,
			esc(entry.kind),
			`<span class="cell-mono cell-muted">${esc(entry.host)}</span>`,
			`<span class="cell-mono">${esc(entry.database)}</span>`,
			esc(entry.access),
			badge(entry.state, entry.tone)
		]))
	},
	{
		id: 'history', label: 'History', count: `${SQL_HISTORY.length} statements`, mark: 'history',
		body: table(['Time', 'Statement', 'Rows', 'ms', 'State'], SQL_HISTORY.map((entry) => [
			`<span class="cell-mono">${esc(entry.time)}</span>`,
			`<span class="cell-mono">${esc(entry.statement)}</span>`,
			String(entry.rows),
			String(entry.ms),
			badge(entry.state === 'ok' ? 'ran' : 'refused', entry.state)
		]))
	},
	{
		id: 'schema', label: 'Schema', count: `${SQL_TABLES.length} tables`, mark: 'list-unordered',
		body: `${table(['Table', 'Rows', 'Key', 'Note'], SQL_TABLES.map((entry) => [
			`<span class="cell-mono cell-strong">${esc(entry.name)}</span>`,
			entry.rows.toLocaleString('en-US'),
			`<span class="cell-mono">${esc(entry.key)}</span>`,
			`<span class="cell-muted">${esc(entry.note)}</span>`
		]))}
<p class="group-note">The columns of <span class="cell-mono">pages</span>, the table everything else joins to.</p>
${table(['Column', 'Type', 'Null', 'Note'], SQL_COLUMNS.map((entry) => [
			`<span class="cell-mono cell-strong">${esc(entry.name)}</span>`,
			`<span class="cell-mono">${esc(entry.type)}</span>`,
			esc(entry.nullable),
			`<span class="cell-muted">${esc(entry.note)}</span>`
		]))}`
	},
	{
		id: 'saved', label: 'Saved Queries', count: `${SQL_QUERIES.length} checks`, mark: 'book',
		body: table(['Query', 'Rows', 'ms', 'Last run'], SQL_QUERIES.map((entry) => [
			`<span class="cell-strong">${esc(entry.name)}</span>`,
			String(entry.rows),
			String(entry.ms),
			`<span class="cell-muted">${esc(entry.run)}</span>`
		]))
	},
	{
		id: 'reports', label: 'Reports', count: `${REPORTS.length} saved`, mark: 'graph',
		body: table(['Report', 'What it says', 'Updated'], REPORTS.map((entry) => [
			`<span class="cell-strong">${esc(entry.name)}</span>`,
			`<span class="cell-muted">${esc(entry.desc)}</span>`,
			esc(entry.updated)
		]))
	}
];
