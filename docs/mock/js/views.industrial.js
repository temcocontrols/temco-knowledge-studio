/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Temco Controls. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* The device side of the platform: Devices, I/O Studio, BACnet Studio, Network, SQL Studio. */

(function (M) {
	'use strict';

	var ui = M.ui;
	var data = M.data;

	function sparkline(values, tone) {
		var width = 120;
		var height = 30;
		var min = Math.min.apply(null, values);
		var max = Math.max.apply(null, values);
		var span = max - min || 1;
		var points = values.map(function (value, index) {
			var x = (index * width) / (values.length - 1);
			var y = height - ((value - min) / span) * (height - 4) - 2;
			return x.toFixed(1) + ',' + y.toFixed(1);
		}).join(' ');
		return (
			'<svg width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '" style="color:var(--' + (tone || 'accent') + ')">' +
			'<polyline points="' + points + '" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></polyline>' +
			'</svg>'
		);
	}

	function statusDot(status) {
		var tone = status === 'Online' ? 'ok' : status === 'Warning' ? 'warn' : status === 'Offline' || status === 'Unreachable' ? 'err' : 'none';
		return '<span class="status-dot">' + ui.dot(tone) + ui.esc(status) + '</span>';
	}

	/* ------------------------------------------------------------------ devices */

	M.views['devices/all'] = {
		title: 'Devices',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Devices',
					icon: 'chip',
					desc: 'Every controller this workspace can reach, with the firmware it runs and the points it exposes.',
					actions:
						ui.button('Discover', { kind: 'primary', icon: 'search', action: 'discover-devices' }) +
						ui.button('Add by Address', { icon: 'plus', action: 'add-device' })
				}) +
				ui.hero({
					tone: 'warn',
					eyebrow: 'Fleet',
					title: 'T3-22I · Lab Wing has not answered for 2 hours',
					desc: 'Last known firmware 2.12.1 — three releases behind — with 2 active alarms on the device. The other 31 controllers are answering normally.',
					actions:
						ui.button('Diagnose device', { kind: 'primary', icon: 'activity', action: 'diagnose' }) +
						ui.button('Restore last backup', { icon: 'download', action: 'restore-backup' })
				}) +
				'<div class="mt-24">' +
				ui.tiles([
					{ value: '34', label: 'Devices' },
					{ value: '31', label: 'Online' },
					{ value: '3', label: 'Not answering' },
					{ value: '2.14.3', label: 'Current firmware' },
					{ value: '4', label: 'Active alarms' }
				]) +
				'</div>' +
				'<div class="mt-24">' +
				ui.table({
					columns: [
						{ label: 'Device', render: function (row) { return '<span class="cell-strong">' + ui.esc(row.name) + '</span><div class="cell-muted cell-mono" style="font-size:11px">SN ' + row.serial + '</div>'; } },
						{ label: 'Product', render: function (row) { return '<span class="tag">' + ui.esc(row.product) + '</span>'; } },
						{ label: 'Address', render: function (row) { return '<span class="cell-mono">' + ui.esc(row.ip) + '</span>'; } },
						{ label: 'Status', render: function (row) { return statusDot(row.status); } },
						{ label: 'Firmware', render: function (row) { return '<span class="cell-mono">' + ui.esc(row.firmware) + '</span>'; } },
						{ label: 'Points', align: 'right', render: function (row) { return '<span class="cell-mono">' + row.points + '</span>'; } },
						{ label: 'Alarms', align: 'right', render: function (row) {
							return row.alarms ? ui.badge(String(row.alarms), 'warn') : '<span class="cell-muted">—</span>';
						} },
						{ label: 'Last Contact', render: function (row) { return '<span class="cell-muted">' + ui.esc(row.last) + '</span>'; } }
					],
					rows: data.devices
				}) +
				'</div>' +
				'<div class="mt-24 grid grid--2">' +
				ui.card({ title: 'Fleet Firmware', icon: 'package', desc: '21 of 34 devices run the current stable release. 6 can be updated without leaving this window.', actions: ui.button('Open', { small: true, open: 'devices/firmware' }), body: ui.barRow(62, '62%', 'warn') }) +
				ui.card({ title: 'Schedules', icon: 'clock', desc: '48 schedules across the fleet; 3 were overridden by hand this week.', actions: ui.button('Open', { small: true, open: 'devices/schedules' }), body: '<span class="cell-muted" style="font-size:12px">Next run in 14 minutes</span>' }) +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['devices/firmware'] = {
		title: 'Firmware',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Firmware',
					icon: 'package',
					desc: 'Releases the platform knows about, and which devices run them. Staging writes an image; it does not flash anything until the device is told to restart.',
					actions:
						ui.button('Stage Update', { kind: 'primary', icon: 'download', action: 'stage-firmware' }) +
						ui.button('Check for Releases', { icon: 'refresh', action: 'check-firmware' })
				}) +
				ui.table({
					columns: [
						{ label: 'Version', render: function (row) { return '<span class="cell-strong cell-mono">' + ui.esc(row.version) + '</span>'; } },
						{ label: 'Channel', render: function (row) { return '<span class="tag">' + ui.esc(row.channel) + '</span>'; } },
						{ label: 'Devices', align: 'right', render: function (row) { return '<span class="cell-mono">' + row.devices + '</span>'; } },
						{ label: 'Size', render: function (row) { return '<span class="cell-mono cell-muted">' + ui.esc(row.size) + '</span>'; } },
						{ label: 'Released', render: function (row) { return '<span class="cell-muted">' + ui.esc(row.released) + '</span>'; } },
						{ label: 'State', render: function (row) { return ui.badge(row.state, row.tone); } },
						{ label: '', align: 'right', render: function () { return ui.button('Details', { small: true, kind: 'ghost', action: 'firmware-details' }); } }
					],
					rows: data.firmware
				}) +
				'<div class="mt-24">' +
				ui.callout('<b>2.15.0-rc2 is a preview.</b> Staging it on a production controller is refused unless the workspace is switched to the Preview channel in Settings.', { kind: 'warn' }) +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['devices/health'] = {
		title: 'Health & Alarms',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Health & Alarms',
					icon: 'alert',
					desc: 'What is wrong right now, newest first. Acknowledging an alarm does not clear it — it records that a person has seen it.',
					actions: ui.button('Acknowledge All', { icon: 'check', action: 'ack-all' })
				}) +
				ui.tiles([
					{ value: '4', label: 'Active' },
					{ value: '1', label: 'High priority' },
					{ value: '2', label: 'Acknowledged' },
					{ value: '18', label: 'Cleared today' }
				]) +
				'<div class="mt-24">' +
				ui.table({
					columns: [
						{ label: 'Time', render: function (row) { return '<span class="cell-mono">' + ui.esc(row.time) + '</span>'; } },
						{ label: 'Device', render: function (row) { return '<span class="cell-strong">' + ui.esc(row.device) + '</span>'; } },
						{ label: 'Message', render: function (row) { return ui.esc(row.message); } },
						{ label: 'Priority', render: function (row) { return ui.badge(row.priority, row.priority === 'High' ? 'err' : row.priority === 'Medium' ? 'warn' : 'neutral'); } },
						{ label: 'State', render: function (row) { return ui.badge(row.state, row.tone); } },
						{ label: '', align: 'right', render: function (row) {
							return row.state === 'Active' ? ui.button('Acknowledge', { small: true, action: 'ack' }) : ui.button('Details', { small: true, kind: 'ghost', action: 'alarm-details' });
						} }
					],
					rows: data.alarms
				}) +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['devices/schedules'] = {
		title: 'Schedules',
		render: function () {
			var rows = [
				{ device: 'T3-BB · AHU-1', name: 'Weekday occupancy', next: 'Tomorrow 06:00', state: 'Enabled', tone: 'ok' },
				{ device: 'T3-BB · AHU-1', name: 'Weekend setback', next: 'Saturday 00:00', state: 'Enabled', tone: 'ok' },
				{ device: 'T3-LB · Lighting', name: 'Exterior lighting', next: 'Today 18:30', state: 'Overridden', tone: 'warn' },
				{ device: 'T3-NC · Chiller', name: 'Condenser purge', next: 'Today 22:00', state: 'Enabled', tone: 'ok' },
				{ device: 'T3-8R · Boiler Room', name: 'Holiday lockout', next: '—', state: 'Disabled', tone: 'neutral' }
			];
			var body =
				ui.pageHead({
					title: 'Schedules',
					icon: 'clock',
					desc: 'Schedules the fleet holds, and when each one runs next. Editing one writes it to the device, not to a local copy.',
					actions: ui.button('New Schedule', { kind: 'primary', icon: 'plus', action: 'new-schedule' })
				}) +
				ui.table({
					columns: [
						{ label: 'Device', render: function (row) { return '<span class="cell-muted">' + ui.esc(row.device) + '</span>'; } },
						{ label: 'Schedule', render: function (row) { return '<span class="cell-strong">' + ui.esc(row.name) + '</span>'; } },
						{ label: 'Next Run', render: function (row) { return '<span class="cell-mono">' + ui.esc(row.next) + '</span>'; } },
						{ label: 'State', render: function (row) { return ui.badge(row.state, row.tone); } },
						{ label: '', align: 'right', render: function () { return ui.button('Edit', { small: true, kind: 'ghost', action: 'edit-schedule' }); } }
					],
					rows: rows
				}) +
				'<div class="mt-24">' +
				ui.card({
					title: 'Weekday Occupancy · T3-BB',
					desc: 'Six events, Monday to Friday. Times are the controller\'s local clock.',
					body:
						'<div class="table-wrap"><table class="table table--compact"><thead><tr>' +
						'<th>Day</th><th>Occupied</th><th>Unoccupied</th><th>Override</th></tr></thead><tbody>' +
						'<tr><td>Monday</td><td class="cell-mono">06:00</td><td class="cell-mono">18:00</td><td class="cell-muted">—</td></tr>' +
						'<tr><td>Tuesday</td><td class="cell-mono">06:00</td><td class="cell-mono">18:00</td><td class="cell-muted">—</td></tr>' +
						'<tr><td>Wednesday</td><td class="cell-mono">06:00</td><td class="cell-mono">18:00</td><td class="cell-muted">—</td></tr>' +
						'<tr><td>Thursday</td><td class="cell-mono">06:00</td><td class="cell-mono">20:00</td><td class="cell-muted">late meeting</td></tr>' +
						'<tr><td>Friday</td><td class="cell-mono">06:00</td><td class="cell-mono">17:00</td><td class="cell-muted">—</td></tr>' +
						'</tbody></table></div>'
				}) +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['devices/trends'] = {
		title: 'Trend Logs',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Trend Logs',
					icon: 'chart',
					desc: 'Samples the controllers kept. A trend log lives on its device until it is read; reading one copies it into the platform database.',
					actions: ui.button('Read All', { icon: 'download', action: 'read-trends' })
				}) +
				'<div class="grid grid--3">' +
				ui.card({ title: 'AHU-1 Temperatures', icon: 'chart', desc: 'Supply 18.4 °C · Return 22.1 °C', body: sparkline([18.1, 18.3, 18.2, 18.5, 18.9, 18.6, 18.4, 18.4, 18.2, 18.1, 18.3, 18.4]) + '<div class="cell-muted" style="font-size:11px;margin-top:6px">last 12 samples · 15 min interval</div>', foot: ui.button('Open', { small: true, kind: 'ghost', action: 'open-trend' }) }) +
				ui.card({ title: 'Valve Position', icon: 'activity', desc: 'AO1 · 38.5 %', body: sparkline([12, 14, 18, 22, 31, 35, 33, 36, 38, 39, 38, 38.5], 'ok') + '<div class="cell-muted" style="font-size:11px;margin-top:6px">last 12 samples · 15 min interval</div>', foot: ui.button('Open', { small: true, kind: 'ghost', action: 'open-trend' }) }) +
				ui.card({ title: 'Humidity · Lab Wing', icon: 'activity', desc: 'AI3 · 46.8 %RH', body: sparkline([52, 51, 49, 48, 47, 47, 46, 46, 47, 47, 46.8, 46.8], 'warn') + '<div class="cell-muted" style="font-size:11px;margin-top:6px">device offline since 10:38</div>', foot: ui.button('Open', { small: true, kind: 'ghost', action: 'open-trend' }) }) +
				'</div>' +
				'<div class="mt-24">' +
				ui.table({
					columns: [
						{ label: 'Log', render: function (row) { return '<span class="cell-strong">' + ui.esc(row.name) + '</span>'; } },
						{ label: 'Device', render: function (row) { return '<span class="cell-muted">' + ui.esc(row.device) + '</span>'; } },
						{ label: 'Samples', align: 'right', render: function (row) { return '<span class="cell-mono">' + row.samples.toLocaleString() + '</span>'; } },
						{ label: 'Interval', render: function (row) { return '<span class="cell-mono cell-muted">' + ui.esc(row.interval) + '</span>'; } },
						{ label: 'Capacity', render: function (row) { return '<div style="min-width:140px">' + ui.bar(row.used, row.used > 85 ? 'warn' : 'ok') + '</div>'; } },
						{ label: 'Last Read', render: function (row) { return '<span class="cell-muted">' + ui.esc(row.read) + '</span>'; } }
					],
					rows: [
						{ name: 'AHU-1 Temperatures', device: 'T3-BB · AHU-1', samples: 1882, interval: '15 min', used: 64, read: '8 minutes ago' },
						{ name: 'Valve Position', device: 'T3-BB · AHU-1', samples: 1882, interval: '15 min', used: 64, read: '8 minutes ago' },
						{ name: 'Boiler Runtime', device: 'T3-8R · Boiler Room', samples: 940, interval: '1 h', used: 31, read: 'yesterday' },
						{ name: 'Lab Environment', device: 'T3-22I · Lab Wing', samples: 402, interval: '30 min', used: 92, read: '2 hours ago' }
					]
				}) +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['devices/backups'] = {
		title: 'Backups',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Backups',
					icon: 'download',
					desc: 'A backup is the controller\'s own database, copied out. Restoring writes it back and restarts the device.',
					actions: ui.button('Back Up All', { kind: 'primary', icon: 'download', action: 'backup-all' })
				}) +
				ui.list([
					{ icon: 'package', title: 'T3-BB · AHU-1 — 2026-10-17 06:00', sub: '<span class="cell-muted">418 KB · scheduled · firmware 2.14.3</span>', meta: ui.button('Restore', { small: true, kind: 'ghost', action: 'restore-backup' }) },
					{ icon: 'package', title: 'T3-8R · Boiler Room — 2026-10-17 06:00', sub: '<span class="cell-muted">206 KB · scheduled · firmware 2.14.3</span>', meta: ui.button('Restore', { small: true, kind: 'ghost', action: 'restore-backup' }) },
					{ icon: 'package', title: 'T3-NC · Chiller — 2026-10-16 06:00', sub: '<span class="cell-muted">312 KB · scheduled · firmware 2.14.1</span>', meta: ui.button('Restore', { small: true, kind: 'ghost', action: 'restore-backup' }) },
					{ icon: 'alert', title: 'T3-22I · Lab Wing — 2026-10-03 06:00', sub: '<span class="cell-muted">148 KB · last successful copy · device offline</span>', meta: ui.badge('Oldest', 'warn') }
				]) +
				'<div class="mt-24">' +
				ui.callout('Restoring is a write to the device and restarts it. The platform keeps the current database as a rollback copy before it writes.', { kind: 'warn' }) +
				'</div>';
			return ui.view(body);
		}
	};

	/* ------------------------------------------------------------------ i/o studio */

	M.views['io/points'] = {
		title: 'Point Browser',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Point Browser',
					icon: 'list',
					desc: 'Every point on the selected device, with its live value. Writing a value is a command to the device — it is not a local override.',
					actions:
						ui.button('Add Point', { kind: 'primary', icon: 'plus', action: 'add-point' }) +
						ui.button('Export CSV', { icon: 'download', action: 'export-points' })
				}) +
				'<div class="toolbar">' +
				'<input class="input" type="search" placeholder="Filter points" aria-label="Filter points">' +
				'<div class="segmented" role="group" aria-label="Point type">' +
				'<button type="button" aria-pressed="true">All</button>' +
				'<button type="button" aria-pressed="false">AI</button>' +
				'<button type="button" aria-pressed="false">AO</button>' +
				'<button type="button" aria-pressed="false">DI</button>' +
				'<button type="button" aria-pressed="false">DO</button>' +
				'</div>' +
				'<span class="toolbar__spacer"></span>' +
				'<span class="cell-muted" style="font-size:12px">T3-BB · AHU-1 · 96 points</span>' +
				'</div>' +
				'<div class="split">' +
				'<div class="stack">' +
				ui.table({
					columns: [
						{ label: 'Id', render: function (row) { return '<span class="cell-mono cell-strong">' + ui.esc(row.id) + '</span>'; } },
						{ label: 'Label', render: function (row) { return ui.esc(row.label); } },
						{ label: 'Type', render: function (row) { return '<span class="tag">' + ui.esc(row.type) + '</span>'; } },
						{ label: 'Value', align: 'right', render: function (row) {
							return '<span class="cell-mono cell-strong">' + ui.esc(row.value) + '</span> <span class="cell-muted">' + ui.esc(row.unit) + '</span>';
						} },
						{ label: 'Range', render: function (row) { return '<span class="cell-muted cell-mono">' + ui.esc(row.range) + '</span>'; } },
						{ label: 'Flags', render: function (row) {
							return row.state === 'warn' ? ui.badge('Fault', 'warn') : '<span class="cell-muted">—</span>';
						} }
					],
					rows: data.points
				}) +
				'</div>' +
				'<div class="stack">' +
				ui.card({
					title: 'Write Value',
					desc: 'AO1 · Valve Position',
					body:
						'<div class="field">' +
						'<label for="write-value">Value (%)</label>' +
						'<input class="input" id="write-value" value="38.5">' +
						'</div>' +
						'<div class="field" style="margin-top:12px">' +
						'<label for="write-priority">Priority</label>' +
						'<select class="select" id="write-priority"><option>8 · manual operator</option><option>10 · local</option><option>16 · default</option></select>' +
						'</div>',
					foot: ui.button('Write', { small: true, kind: 'primary', action: 'write-point' }) + '<span>writes to the device</span>'
				}) +
				ui.card({
					title: 'Point Details',
					body:
						'<dl class="kv">' +
						'<dt>Object</dt><dd class="cell-mono">AV-103</dd>' +
						'<dt>Units</dt><dd>percent</dd>' +
						'<dt>Scale</dt><dd class="cell-mono">×1.0 + 0</dd>' +
						'<dt>COV</dt><dd>enabled · 0.5 %</dd>' +
						'<dt>Trend</dt><dd>15 min · 1,882 samples</dd>' +
						'</dl>'
				}) +
				'</div>' +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['io/mapping'] = {
		title: 'Mapping',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Mapping',
					icon: 'link',
					desc: 'How a physical point becomes a named value the rest of the platform reads. An unmapped point is invisible to programs and trends.',
					actions: ui.button('Auto-Map', { kind: 'primary', icon: 'sparkle', action: 'auto-map' })
				}) +
				ui.table({
					columns: [
						{ label: 'Source Point', render: function (row) { return '<span class="cell-mono cell-strong">' + ui.esc(row.source) + '</span>'; } },
						{ label: '', render: function () { return ui.icon('arrow-right'); } },
						{ label: 'Platform Value', render: function (row) { return '<span class="cell-mono">' + ui.esc(row.target) + '</span>'; } },
						{ label: 'Scale', render: function (row) { return '<span class="cell-muted cell-mono">' + ui.esc(row.scale) + '</span>'; } },
						{ label: 'State', render: function (row) { return ui.badge(row.state, row.tone); } },
						{ label: '', align: 'right', render: function () { return ui.button('Edit', { small: true, kind: 'ghost', action: 'edit-mapping' }); } }
					],
					rows: data.mappings
				}) +
				'<div class="mt-24 split">' +
				ui.card({
					title: 'Coverage',
					body:
						'<div class="progress-list">' +
						'<div><div class="progress-list__label"><b>Mapped</b><span>4 of 7</span></div>' + ui.bar(57, 'warn') + '</div>' +
						'<div><div class="progress-list__label"><b>Unmapped analog</b><span>1</span></div>' + ui.bar(14, 'warn') + '</div>' +
						'<div><div class="progress-list__label"><b>Digital</b><span>2 of 2</span></div>' + ui.bar(100, 'ok') + '</div>' +
						'</div>'
				}) +
				ui.card({
					title: 'AI Suggestion',
					icon: 'sparkle',
					desc: 'Humidity on this controller has no mapping. The last three projects mapped it to <b>AV-104 · RH</b> with the same scaling.',
					foot: ui.button('Apply', { small: true, kind: 'primary', action: 'apply-mapping' }) + ui.button('Ignore', { small: true, kind: 'ghost', action: 'ignore-mapping' })
				}) +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['io/logic'] = {
		title: 'Logic',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Logic',
					icon: 'code',
					desc: 'Programs on the device, shown as their source. Compiling writes the program; it does not run it until the device restarts.',
					actions:
						ui.button('New Program', { kind: 'primary', icon: 'plus', action: 'new-program' }) +
						ui.button('Compile', { icon: 'play', action: 'compile-program' })
				}) +
				'<div class="split">' +
				ui.card({
					title: 'AHU-1 Supply Control',
					actions: ui.badge('Compiled', 'ok'),
					flush: true,
					body:
						'<pre class="code" style="border:0;border-radius:0;max-height:340px">' +
						ui.esc(
							'// AHU-1 supply air control\n' +
							'// compiled 2026-10-17 09:12 · device T3-BB (SN 2371)\n' +
							'\n' +
							'VAR\n' +
							'  setpoint  : AV-101;   // 21.0 °C\n' +
							'  supply    : AV-102;\n' +
							'  valve     : AO1;\n' +
							'  fan       : AO2;\n' +
							'END_VAR\n' +
							'\n' +
							'// PI loop, 30 s\n' +
							'valve := PID(supply, setpoint, Kp := 2.4, Ki := 0.12);\n' +
							'valve := LIMIT(valve, 0.0, 100.0);\n' +
							'\n' +
							'IF DI1 = FAULT THEN\n' +
							'  fan   := 0.0;\n' +
							'  valve := 0.0;\n' +
							'  ALARM(31);\n' +
							'END_IF'
						) +
						'</pre>'
				}) +
				'<div class="stack">' +
				ui.card({
					title: 'Programs',
					body: ui.list([
						{ icon: 'code', title: 'AHU-1 Supply Control', sub: '<span class="cell-muted">compiled · running</span>', meta: ui.badge('Running', 'ok') },
						{ icon: 'code', title: 'AHU-1 Schedule Override', sub: '<span class="cell-muted">compiled · idle</span>', meta: ui.badge('Idle', 'neutral') },
						{ icon: 'code', title: 'Alarm Routing', sub: '<span class="cell-muted">changed 2 days ago</span>', meta: ui.badge('Compile', 'warn') }
					])
				}) +
				ui.card({
					title: 'Diagnostics',
					body:
						'<div class="list">' +
						'<div class="list__item"><div class="list__main"><div class="list__title">No compile errors</div><div class="list__sub">last compile 09:12</div></div></div>' +
						'<div class="list__item"><div class="list__main"><div class="list__title">1 unreachable branch</div><div class="list__sub">line 24 · DI1 is never FAULT on this device</div></div><div class="list__meta">' + ui.badge('1', 'warn') + '</div></div>' +
						'</div>'
				}) +
				'</div>' +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['io/live'] = {
		title: 'Live Values',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Live Values',
					icon: 'activity',
					desc: 'A subscription, not a poll: values update as the device sends them. Close the tab and the subscription ends.',
					actions: ui.button('Pause', { icon: 'close', action: 'pause-live' })
				}) +
				'<div class="split">' +
				ui.table({
					columns: [
						{ label: 'Point', render: function (row) { return '<span class="cell-mono cell-strong">' + ui.esc(row.id) + '</span> <span class="cell-muted">' + ui.esc(row.label) + '</span>'; } },
						{ label: 'Value', align: 'right', render: function (row) {
							var pct = parseFloat(row.value);
							if (isNaN(pct)) {
								return '<span class="cell-mono cell-strong">' + ui.esc(row.value) + '</span>';
							}
							return '<span class="cell-mono cell-strong">' + ui.esc(row.value) + '</span> <span class="cell-muted">' + ui.esc(row.unit) + '</span>';
						} },
						{ label: 'Level', render: function (row) {
							var pct = parseFloat(row.value);
							if (isNaN(pct)) {
								return '<span class="cell-muted">—</span>';
							}
							var scale = row.range.indexOf('0 – 100') >= 0 ? pct : Math.min(100, (pct / 50) * 100);
							return '<div style="min-width:120px">' + ui.bar(scale, scale > 80 ? 'warn' : 'ok') + '</div>';
						} },
						{ label: 'Updated', render: function () { return '<span class="cell-muted">just now</span>'; } }
					],
					rows: data.points
				}) +
				ui.card({
					title: 'Subscribed Devices',
					body: ui.list([
						{ icon: 'chip', title: 'T3-BB · AHU-1', sub: '<span class="cell-muted">96 points · COV</span>', meta: ui.badge('Live', 'ok') },
						{ icon: 'chip', title: 'T3-8R · Boiler Room', sub: '<span class="cell-muted">48 points · COV</span>', meta: ui.badge('Live', 'ok') },
						{ icon: 'chip', title: 'T3-22I · Lab Wing', sub: '<span class="cell-muted">22 points · no answer</span>', meta: ui.badge('Offline', 'err') }
					]),
					foot: '<span>subscriptions close with the tab</span>'
				}) +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['io/trends'] = {
		title: 'Trends',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Trends',
					icon: 'chart',
					desc: 'The same point over time. Two curves are overlaid to compare a setpoint with what the equipment actually did.',
					actions: ui.button('Add Series', { icon: 'plus', action: 'add-series' })
				}) +
				ui.card({
					title: 'AHU-1 · Supply Air Temperature vs Setpoint',
					desc: '15-minute samples · last 3 hours · firmware 2.14.3',
					body:
						'<div style="display:flex;gap:16px;align-items:flex-end;padding:10px 0;overflow:auto">' +
						'<div style="color:var(--accent)">' + sparkline([18.1, 18.3, 18.2, 18.5, 18.9, 18.6, 18.4, 18.4, 18.2, 18.1, 18.3, 18.4]) + '</div>' +
						'<div style="color:var(--fg-subtle)">' + sparkline([18.0, 18.0, 18.0, 18.0, 18.0, 18.0, 18.0, 18.0, 18.0, 18.0, 18.0, 18.0]) + '</div>' +
						'</div>' +
						'<div class="row" style="gap:16px;font-size:12px;color:var(--fg-muted);margin-top:8px">' +
						'<span><span class="dot dot--accent"></span> Supply air 18.4 °C</span>' +
						'<span><span class="dot"></span> Setpoint 18.0 °C</span>' +
						'<span>mean 18.4 · min 18.1 · max 18.9</span>' +
						'</div>'
				});
			return ui.view(body);
		}
	};

	/* ------------------------------------------------------------------ BACnet */

	M.views['bacnet/discovery'] = {
		title: 'Discovery',
		render: function () {
			var body =
				ui.pageHead({
					title: 'BACnet Discovery',
					icon: 'search',
					desc: 'Who answers on the network, and what they say they are. Discovery is read-only; nothing is written to a device.',
					actions:
						ui.button('Start Scan', { kind: 'primary', icon: 'search', action: 'bacnet-scan' }) +
						ui.button('Who-Is Range', { icon: 'filter', action: 'whois-range' })
				}) +
				'<div class="toolbar">' +
				'<input class="input" value="192.168.10.0/24" aria-label="Range">' +
				'<select class="select"><option>BACnet/IP</option><option>BACnet MS/TP</option><option>BACnet/SC</option></select>' +
				'<span class="toolbar__spacer"></span>' +
				'<span class="cell-muted" style="font-size:12px">5 devices · scanned 4 minutes ago</span>' +
				'</div>' +
				ui.table({
					columns: [
						{ label: 'Device', render: function (row) { return '<span class="cell-strong">' + ui.esc(row.name) + '</span>'; } },
						{ label: 'Instance', render: function (row) { return '<span class="cell-mono">' + (1000 + Math.round(Number(row.ip.split('.')[3]))) + '</span>'; } },
						{ label: 'Address', render: function (row) { return '<span class="cell-mono">' + ui.esc(row.ip) + '</span>'; } },
						{ label: 'Vendor', render: function (row) { return '<span class="cell-muted">' + ui.esc(row.vendor) + '</span>'; } },
						{ label: 'Protocol', render: function (row) { return '<span class="tag">' + ui.esc(row.protocol) + '</span>'; } },
						{ label: 'State', render: function (row) { return ui.badge(row.state, row.tone); } },
						{ label: '', align: 'right', render: function () { return ui.button('Objects', { small: true, open: 'bacnet/objects' }); } }
					],
					rows: data.hosts
				}) +
				'<div class="mt-24 grid grid--3">' +
				ui.card({ title: 'Objects Read', icon: 'list', desc: '1,204 objects across the answering devices, 88 of them writable.', body: ui.barRow(100, '100%', 'ok') }) +
				ui.card({ title: 'Unreachable', icon: 'alert', desc: 'T3-22I has not answered Who-Is for 2 hours. It is still in the fleet.', body: '<span class="cell-muted" style="font-size:12px">last answer 10:38</span>' }) +
				ui.card({ title: 'Foreign Devices', icon: 'globe', desc: '1 non-Temco device answered: a Modbus gateway bridging to MS/TP.', body: '<span class="cell-muted" style="font-size:12px">192.168.10.50</span>' }) +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['bacnet/objects'] = {
		title: 'Object Browser',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Object Browser',
					icon: 'list',
					desc: 'The objects one device exposes. A value written here goes to the device; the platform keeps no copy.',
					actions:
						ui.button('Read All', { icon: 'refresh', action: 'read-objects' }) +
						ui.button('Export', { icon: 'download', action: 'export-objects' })
				}) +
				'<div class="split">' +
				ui.table({
					columns: [
						{ label: 'Instance', render: function (row) { return '<span class="cell-mono cell-strong">' + ui.esc(row.instance) + '</span>'; } },
						{ label: 'Type', render: function (row) { return '<span class="cell-muted">' + ui.esc(row.type) + '</span>'; } },
						{ label: 'Name', render: function (row) { return ui.esc(row.name); } },
						{ label: 'Units', render: function (row) { return '<span class="cell-muted cell-mono">' + ui.esc(row.units) + '</span>'; } },
						{ label: 'Value', align: 'right', render: function (row) { return '<span class="cell-mono">' + ui.esc(row.value) + '</span>'; } },
						{ label: 'Flags', render: function (row) {
							return row.flags === 'Fault' ? ui.badge('Fault', 'warn') : '<span class="cell-muted">—</span>';
						} }
					],
					rows: data.bacnetObjects
				}) +
				ui.card({
					title: 'AV-101 · Supply Air Temp',
					body:
						'<dl class="kv">' +
						'<dt>Object id</dt><dd class="cell-mono">analog-value, 101</dd>' +
						'<dt>Present value</dt><dd class="cell-mono">18.4 °C</dd>' +
						'<dt>COV increment</dt><dd class="cell-mono">0.5</dd>' +
						'<dt>Priority array</dt><dd class="cell-mono">— — — — — — — — — — — — 18.4 — — —</dd>' +
						'<dt>Reliability</dt><dd>no-fault-detected</dd>' +
						'</dl>',
					foot: ui.button('Write Value', { small: true, action: 'write-object' }) + ui.button('Trend', { small: true, kind: 'ghost', open: 'bacnet/trendlogs' })
				}) +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['bacnet/alarms'] = {
		title: 'Alarms',
		render: function () {
			var body =
				ui.pageHead({
					title: 'BACnet Alarms',
					icon: 'alert',
					desc: 'Event notifications the devices sent, as they arrived. Acknowledging one answers the device.',
					actions: ui.button('Acknowledge All', { icon: 'check', action: 'ack-all' })
				}) +
				ui.table({
					columns: [
						{ label: 'Time', render: function (row) { return '<span class="cell-mono">' + ui.esc(row.time) + '</span>'; } },
						{ label: 'Device', render: function (row) { return '<span class="cell-strong">' + ui.esc(row.device) + '</span>'; } },
						{ label: 'Message', render: function (row) { return ui.esc(row.message); } },
						{ label: 'Priority', render: function (row) { return ui.badge(row.priority, row.priority === 'High' ? 'err' : row.priority === 'Medium' ? 'warn' : 'neutral'); } },
						{ label: 'State', render: function (row) { return ui.badge(row.state, row.tone); } },
						{ label: '', align: 'right', render: function (row) {
							return row.state === 'Active' ? ui.button('Acknowledge', { small: true, action: 'ack' }) : '';
						} }
					],
					rows: data.alarms
				});
			return ui.view(body);
		}
	};

	M.views['bacnet/trendlogs'] = {
		title: 'Trend Logs',
		render: function () {
			var body =
				ui.pageHead({
					title: 'BACnet Trend Logs',
					icon: 'chart',
					desc: 'Trend logs the devices hold. Reading one transfers its buffer; the device keeps sampling either way.',
					actions: ui.button('Read Buffer', { kind: 'primary', icon: 'download', action: 'read-buffer' })
				}) +
				ui.table({
					columns: [
						{ label: 'Log', render: function (row) { return '<span class="cell-strong">' + ui.esc(row.name) + '</span>'; } },
						{ label: 'Object', render: function (row) { return '<span class="cell-mono cell-muted">' + ui.esc(row.object) + '</span>'; } },
						{ label: 'Samples', align: 'right', render: function (row) { return '<span class="cell-mono">' + row.samples.toLocaleString() + '</span>'; } },
						{ label: 'Buffer', render: function (row) { return '<div style="min-width:140px">' + ui.bar(row.used, row.used > 85 ? 'warn' : 'ok') + '</div>'; } },
						{ label: 'Last Read', render: function (row) { return '<span class="cell-muted">' + ui.esc(row.read) + '</span>'; } },
						{ label: '', align: 'right', render: function () { return ui.button('Open', { small: true, kind: 'ghost', action: 'open-trend' }); } }
					],
					rows: [
						{ name: 'AHU-1 Temperatures', object: 'trend-log, 4', samples: 1882, used: 64, read: '8 minutes ago' },
						{ name: 'Valve Position', object: 'trend-log, 5', samples: 1882, used: 64, read: '8 minutes ago' },
						{ name: 'Boiler Runtime', object: 'trend-log, 12', samples: 940, used: 31, read: 'yesterday' },
						{ name: 'Lab Environment', object: 'trend-log, 2', samples: 402, used: 92, read: '2 hours ago' }
					]
				});
			return ui.view(body);
		}
	};

	M.views['bacnet/schedules'] = {
		title: 'Schedules',
		render: function () {
			var body =
				ui.pageHead({
					title: 'BACnet Schedules',
					icon: 'clock',
					desc: 'Schedule objects on the network, with the weekly entries the device holds.',
					actions: ui.button('New Schedule', { kind: 'primary', icon: 'plus', action: 'new-schedule' })
				}) +
				ui.table({
					columns: [
						{ label: 'Object', render: function (row) { return '<span class="cell-mono cell-strong">' + ui.esc(row.object) + '</span>'; } },
						{ label: 'Name', render: function (row) { return ui.esc(row.name); } },
						{ label: 'Device', render: function (row) { return '<span class="cell-muted">' + ui.esc(row.device) + '</span>'; } },
						{ label: 'Entries', align: 'right', render: function (row) { return '<span class="cell-mono">' + row.entries + '</span>'; } },
						{ label: 'Next', render: function (row) { return '<span class="cell-mono">' + ui.esc(row.next) + '</span>'; } },
						{ label: 'State', render: function (row) { return ui.badge(row.state, row.tone); } }
					],
					rows: [
						{ object: 'SCH-1', name: 'Weekday Schedule', device: 'T3-BB · AHU-1', entries: 10, next: 'Tomorrow 06:00', state: 'Active', tone: 'ok' },
						{ object: 'SCH-2', name: 'Weekend Setback', device: 'T3-BB · AHU-1', entries: 4, next: 'Saturday 00:00', state: 'Active', tone: 'ok' },
						{ object: 'SCH-7', name: 'Exterior Lighting', device: 'T3-LB · Lighting', entries: 14, next: 'Today 18:30', state: 'Overridden', tone: 'warn' }
					]
				});
			return ui.view(body);
		}
	};

	/* ------------------------------------------------------------------ network */

	M.views['network/discovery'] = {
		title: 'Discovery',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Network Discovery',
					icon: 'globe',
					desc: 'Every host the platform can see on the local segment, whatever protocol it speaks.',
					actions: ui.button('Scan Segment', { kind: 'primary', icon: 'search', action: 'net-scan' })
				}) +
				'<div class="toolbar">' +
				'<input class="input" value="192.168.10.0/24" aria-label="Range">' +
				'<button class="btn btn--sm" data-action="arp-lookup">' + ui.icon('search') + '<span>ARP Lookup</span></button>' +
				'<span class="toolbar__spacer"></span>' +
				'<span class="cell-muted" style="font-size:12px">5 hosts · 1 unreachable</span>' +
				'</div>' +
				ui.table({
					columns: [
						{ label: 'Address', render: function (row) { return '<span class="cell-mono cell-strong">' + ui.esc(row.ip) + '</span>'; } },
						{ label: 'Name', render: function (row) { return ui.esc(row.name); } },
						{ label: 'MAC', render: function (row) { return '<span class="cell-mono cell-muted">' + ui.esc(row.mac) + '</span>'; } },
						{ label: 'Vendor', render: function (row) { return '<span class="cell-muted">' + ui.esc(row.vendor) + '</span>'; } },
						{ label: 'Protocol', render: function (row) { return '<span class="tag">' + ui.esc(row.protocol) + '</span>'; } },
						{ label: 'State', render: function (row) { return ui.badge(row.state, row.tone); } }
					],
					rows: data.hosts
				});
			return ui.view(body);
		}
	};

	M.views['network/modbus'] = {
		title: 'Modbus Scanner',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Modbus Scanner',
					icon: 'list',
					desc: 'Unit ids and register ranges on the Modbus side of the gateway. Reading is safe; writing a register is a device command.',
					actions: ui.button('Scan Units', { kind: 'primary', icon: 'search', action: 'scan-units' })
				}) +
				'<div class="toolbar">' +
				'<input class="input" value="192.168.10.50:502" aria-label="Endpoint">' +
				'<select class="select"><option>Holding registers</option><option>Input registers</option><option>Coils</option></select>' +
				'<span class="toolbar__spacer"></span>' +
				'<span class="cell-muted" style="font-size:12px">units 1–247 · 3 answered</span>' +
				'</div>' +
				ui.table({
					columns: [
						{ label: 'Unit', align: 'right', render: function (row) { return '<span class="cell-mono">' + row.unit + '</span>'; } },
						{ label: 'Register', render: function (row) { return '<span class="cell-mono cell-strong">' + ui.esc(row.register) + '</span>'; } },
						{ label: 'Name', render: function (row) { return ui.esc(row.name); } },
						{ label: 'Value', align: 'right', render: function (row) { return '<span class="cell-mono">' + ui.esc(row.value) + '</span>'; } },
						{ label: 'Type', render: function (row) { return '<span class="tag">' + ui.esc(row.type) + '</span>'; } },
						{ label: 'State', render: function (row) { return ui.badge(row.state, row.tone); } }
					],
					rows: [
						{ unit: 1, register: '40001', name: 'Supply air temp × 10', value: '184', type: 'INT16', state: 'OK', tone: 'ok' },
						{ unit: 1, register: '40002', name: 'Return air temp × 10', value: '221', type: 'INT16', state: 'OK', tone: 'ok' },
						{ unit: 1, register: '40010', name: 'Valve position', value: '385', type: 'INT16', state: 'OK', tone: 'ok' },
						{ unit: 2, register: '40001', name: 'Boiler flow', value: '—', type: 'INT16', state: 'Timeout', tone: 'warn' },
						{ unit: 7, register: '00001', name: 'Filter alarm', value: '1', type: 'COIL', state: 'OK', tone: 'ok' }
					]
				});
			return ui.view(body);
		}
	};

	M.views['network/diagnostics'] = {
		title: 'Diagnostics',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Diagnostics',
					icon: 'activity',
					desc: 'Reachability, latency and packet loss for the hosts the workspace depends on.',
					actions: ui.button('Run All', { kind: 'primary', icon: 'play', action: 'run-diagnostics' })
				}) +
				ui.tiles([
					{ value: '31', label: 'Hosts answering' },
					{ value: '3', label: 'Timeouts' },
					{ value: '4 ms', label: 'Median latency' },
					{ value: '0.2%', label: 'Packet loss' }
				]) +
				'<div class="mt-24 split">' +
				ui.card({
					title: 'Ping · 192.168.10.31',
					flush: true,
					body:
						'<pre class="code" style="border:0;border-radius:0">' +
						ui.esc(
							'Pinging 192.168.10.31 with 32 bytes of data:\n' +
							'Request timed out.\n' +
							'Request timed out.\n' +
							'Request timed out.\n' +
							'Request timed out.\n' +
							'\n' +
							'Ping statistics for 192.168.10.31:\n' +
							'    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss),'
						) +
						'</pre>'
				}) +
				ui.card({
					title: 'Last Run',
					body:
						'<dl class="kv">' +
						'<dt>Started</dt><dd>12:41:08</dd>' +
						'<dt>Duration</dt><dd class="cell-mono">3.2 s</dd>' +
						'<dt>Hosts</dt><dd>34</dd>' +
						'<dt>Failures</dt><dd>T3-22I · 192.168.10.31</dd>' +
						'</dl>',
					foot: ui.button('Copy Report', { small: true, kind: 'ghost', action: 'copy-report' })
				}) +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['network/captures'] = {
		title: 'Captures',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Captures',
					icon: 'download',
					desc: 'Packet captures taken from this machine or a device\'s mirrored port, kept with the filter that produced them.',
					actions: ui.button('New Capture', { kind: 'primary', icon: 'plus', action: 'new-capture' })
				}) +
				ui.list([
					{ icon: 'download', title: 'bacnet-whois-2026-10-17.pcapng', sub: '<span class="cell-muted">2,408 packets · filter "udp port 47808" · 1.2 MB</span>', meta: ui.badge('Closed', 'neutral') },
					{ icon: 'download', title: 'modbus-timeouts.pcapng', sub: '<span class="cell-muted">118 packets · filter "tcp port 502 and ip.addr == 192.168.10.50" · 84 KB</span>', meta: ui.badge('Closed', 'neutral') },
					{ icon: 'activity', title: 'Live capture · all traffic', sub: '<span class="cell-muted">recording · 14,882 packets</span>', meta: ui.badge('Recording', 'info') }
				]) +
				'<div class="mt-24">' +
				ui.callout('A capture is written to the workspace folder and is never committed. Deleting the row deletes the file.') +
				'</div>';
			return ui.view(body);
		}
	};

	/* ------------------------------------------------------------------ sql studio */

	M.views['sql/query'] = {
		title: 'Query Editor',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Query Editor',
					icon: 'code',
					desc: 'Read-only by default. The connection decides what a statement may do, and the editor shows it before you run anything.',
					actions:
						ui.button('Run', { kind: 'primary', icon: 'play', action: 'run-query' }) +
						ui.button('Explain', { icon: 'list', action: 'explain-query' })
				}) +
				'<div class="split">' +
				'<div class="stack">' +
				ui.card({
					flush: true,
					body:
						'<pre class="code" style="border:0;border-radius:0">' +
						'<span class="tok-comment">-- devices not on the current firmware</span>\n' +
						'<span class="tok-key">SELECT</span> id, name, product, firmware, online\n' +
						'<span class="tok-key">FROM</span> devices\n' +
						'<span class="tok-key">WHERE</span> firmware &lt;&gt; <span class="tok-str">\'2.14.3\'</span>\n' +
						'<span class="tok-key">ORDER BY</span> firmware <span class="tok-key">DESC</span>;'
						.replace(/\n/g, '<br>') +
						'</pre>'
				}) +
				ui.table({
					compact: true,
					columns: [
						{ label: 'id', render: function (row) { return '<span class="cell-mono">' + row.id + '</span>'; } },
						{ label: 'name', render: function (row) { return ui.esc(row.name); } },
						{ label: 'product', render: function (row) { return '<span class="tag">' + ui.esc(row.product) + '</span>'; } },
						{ label: 'firmware', render: function (row) { return '<span class="cell-mono">' + ui.esc(row.firmware) + '</span>'; } },
						{ label: 'online', render: function (row) { return ui.badge(row.online === '1' ? 'Online' : 'Offline', row.online === '1' ? 'ok' : 'err'); } }
					],
					rows: data.queryRows
				}) +
				'<div class="row" style="font-size:12px;color:var(--fg-muted)"><span>5 rows · 12 ms</span><span>·</span><span>MSSQL · Production</span><span>·</span><span>read-only</span></div>' +
				'</div>' +
				'<div class="stack">' +
				ui.card({
					title: 'Connection',
					body:
						'<dl class="kv">' +
						'<dt>Server</dt><dd class="cell-mono">t3-sql01\\prod</dd>' +
						'<dt>Database</dt><dd class="cell-mono">T3000</dd>' +
						'<dt>Access</dt><dd>Read-only</dd>' +
						'<dt>Timeout</dt><dd class="cell-mono">30 s</dd>' +
						'</dl>',
					foot: ui.button('Change', { small: true, kind: 'ghost', open: 'sql/connections' })
				}) +
				ui.card({
					title: 'Saved Queries',
					body: ui.list([
						{ icon: 'code', title: 'Firmware drift', meta: ui.badge('12 ms', 'ok') },
						{ icon: 'code', title: 'Alarms last 7 days', meta: ui.badge('86 ms', 'ok') },
						{ icon: 'code', title: 'Unmapped points', meta: ui.badge('draft', 'neutral') }
					])
				}) +
				'</div>' +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['sql/connections'] = {
		title: 'Connections',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Connections',
					icon: 'database',
					desc: 'The databases the products use. These are not the platform\'s own store — that file is never edited from here.',
					actions: ui.button('New Connection', { kind: 'primary', icon: 'plus', action: 'new-connection' })
				}) +
				ui.table({
					columns: [
						{ label: 'Name', render: function (row) { return '<span class="cell-strong">' + ui.esc(row.name) + '</span>'; } },
						{ label: 'Kind', render: function (row) { return '<span class="tag">' + ui.esc(row.kind) + '</span>'; } },
						{ label: 'Host', render: function (row) { return '<span class="cell-mono cell-muted">' + ui.esc(row.host) + '</span>'; } },
						{ label: 'Database', render: function (row) { return '<span class="cell-mono">' + ui.esc(row.database) + '</span>'; } },
						{ label: 'State', render: function (row) { return ui.badge(row.state, row.tone); } },
						{ label: '', align: 'right', render: function () { return ui.button('Test', { small: true, kind: 'ghost', action: 'test-connection' }); } }
					],
					rows: data.connections
				}) +
				'<div class="mt-24">' +
				ui.callout('Passwords live in the operating system\'s credential store, never in a project file. A connection can be shared with a workspace without sharing its credentials.') +
				'</div>';
			return ui.view(body);
		}
	};

	M.views['sql/reports'] = {
		title: 'Reports',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Reports',
					icon: 'chart',
					desc: 'A report is a query with a shape. Running one writes nothing; exporting one writes a file next to the workspace.',
					actions: ui.button('New Report', { kind: 'primary', icon: 'plus', action: 'new-report' })
				}) +
				ui.list(data.reports.map(function (report) {
					return { icon: 'chart', title: report.name, sub: '<span class="cell-muted">' + ui.esc(report.desc) + '</span>', meta: '<span class="cell-muted" style="font-size:11px">' + ui.esc(report.updated) + '</span>' + ui.button('Run', { small: true, action: 'run-report' }) };
				}));
			return ui.view(body);
		}
	};
})(window.TemcoMock = window.TemcoMock || { views: {} });
