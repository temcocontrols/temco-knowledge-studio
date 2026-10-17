/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Temco Controls. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* The device side of the platform: Devices, I/O Studio, BACnet Studio, Network, SQL Studio.

   Each module answers one question and says what it cannot do: a device page is a register of
   controllers, an I/O page is a value the device owns, a BACnet page is what answered on the wire,
   a network page is what the segment shows, and SQL Studio is the documentation registry seen as
   rows. Counts are read from `data` rather than typed, so a page cannot claim a fleet the register
   does not hold. */

(function (M) {
	'use strict';

	var ui = M.ui;
	var data = M.data;

	function n(count, one, many) {
		return count + ' ' + (count === 1 ? one : many);
	}

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

	function deviceTone(device) {
		return device.status === 'Offline' ? 'err' : device.status === 'Warning' ? 'warn' : 'ok';
	}

	/* The alarms register is the only place an alarm count comes from, so a device cannot show a
	   number its own alarm rows do not support. */
	function alarmCount(deviceName) {
		return data.alarms.filter(function (alarm) {
			return alarm.device === deviceName && alarm.state !== 'Cleared';
		}).length;
	}

	function deviceRow(device) {
		var alarms = alarmCount(device.name);
		return (
			'<div class="record-row">' +
			ui.toneMark('chip', deviceTone(device)) +
			'<div class="record-row__main">' +
			'<div class="record-row__title"><span class="record-row__name">' + ui.esc(device.name) + '</span>' +
			(device.product ? '<span class="tag">' + ui.esc(device.product) + '</span>' : '') +
			'</div>' +
			'<div class="record-row__meta">' +
			'<span class="cell-mono">SN ' + device.serial + '</span>' +
			'<span class="cell-mono">' + ui.esc(device.ip) + '</span>' +
			'<span>firmware ' + ui.esc(device.firmware) + '</span>' +
			'<span>' + n(device.points, 'point', 'points') + '</span>' +
			'<span>' + ui.esc(device.last) + '</span>' +
			'</div>' +
			'</div>' +
			(alarms ? '<div class="record-row__state">' + ui.badge(n(alarms, 'alarm', 'alarms'), 'warn') + '</div>' : '<div class="record-row__state"></div>') +
			'<div class="record-row__state">' + ui.badge(device.status, deviceTone(device)) + '</div>' +
			'</div>'
		);
	}

	/* ------------------------------------------------------------------ devices */

	M.views['devices/all'] = {
		title: 'Devices',
		render: function () {
			var offline = data.devices.filter(function (device) { return device.status === 'Offline'; });
			var degraded = data.devices.filter(function (device) { return device.status === 'Warning'; });
			var answering = data.devices.filter(function (device) { return device.status === 'Online'; });
			var current = data.firmware.filter(function (release) { return release.state === 'Current'; })[0];
			var onCurrent = current ? data.devices.filter(function (device) { return device.firmware === current.version; }).length : 0;
			var active = data.alarms.filter(function (alarm) { return alarm.state === 'Active'; }).length;
			var worst = offline[0];

			var body =
				ui.pageHead({
					title: 'Devices',
					icon: 'chip',
					desc: 'Every controller this workspace can reach, with the firmware it runs and the points it exposes. The device keeps its own database; the platform keeps a copy only when a backup or a trend log is read.',
					actions:
						ui.button('Discover', { kind: 'primary', icon: 'search', action: 'discover-devices' }) +
						ui.button('Add by Address', { icon: 'plus', action: 'add-device' })
				}) +
				(worst
					? ui.hero({
						tone: 'warn',
						eyebrow: 'Fleet',
						title: worst.name + ' has not answered for ' + worst.last.replace(' ago', ''),
						desc: 'Last known firmware ' + ui.esc(worst.firmware) + ', ' + n(alarmCount(worst.name), 'active condition', 'active conditions') + '. The other ' + n(answering.length, 'controller answers', 'controllers answer') + ' normally.',
						actions:
							ui.button('Diagnose ' + worst.product, { kind: 'primary', icon: 'activity', action: 'diagnose' }) +
							ui.button('Open network tools', { icon: 'globe', open: 'network/diagnostics' })
					})
					: '') +
				'<div class="mt-24">' +
				ui.tiles([
					{ value: String(data.devices.length), label: 'Controllers' },
					{ value: String(answering.length), label: 'Answering' },
					{ value: String(offline.length), label: 'Not answering' },
					{ value: String(degraded.length), label: 'Reporting a fault' },
					{ value: onCurrent + ' of ' + data.devices.length, label: 'On ' + (current ? current.version : '—') },
					{ value: String(active), label: 'Active alarms' }
				]) +
				'</div>' +
				(offline.length || degraded.length
					? ui.group({
						label: 'Needs Attention',
						count: n(offline.length + degraded.length, 'controller', 'controllers'),
						note: 'A controller that stops answering keeps its last known state in the platform, which is why the row still has a firmware and a point count.',
						body: offline.concat(degraded).map(deviceRow).join('')
					})
					: '') +
				ui.group({
					label: 'Answering',
					count: n(answering.length, 'controller', 'controllers'),
					note: 'Their clock, their programs and their points are read from the device; nothing on this page is a local copy of a value.',
					body: answering.map(deviceRow).join('')
				});

			return ui.view(body);
		}
	};

	M.views['devices/firmware'] = {
		title: 'Firmware',
		render: function () {
			var current = data.firmware.filter(function (release) { return release.state === 'Current'; })[0];
			var behind = data.devices.filter(function (device) { return current && device.firmware !== current.version; });
			var staged = data.firmware.filter(function (release) { return release.state === 'Not staged'; })[0];

			var body =
				ui.pageHead({
					title: 'Firmware',
					icon: 'package',
					desc: 'Releases the platform knows about, and which controllers run them. Staging writes an image to the device; it does not flash anything until the device is told to restart.',
					actions:
						ui.button('Stage Update', { kind: 'primary', icon: 'download', action: 'stage-firmware' }) +
						ui.button('Check for Releases', { icon: 'refresh', action: 'check-firmware' })
				}) +
				ui.group({
					label: 'Releases',
					count: n(data.firmware.length, 'release', 'releases'),
					note: 'A release is a file the platform holds; how many controllers run it is a fact about the fleet, not about the file.',
					body: data.firmware.map(function (release) {
						return (
							'<div class="record-row">' +
							ui.toneMark('package', release.tone) +
							'<div class="record-row__main">' +
							'<div class="record-row__title">' +
							'<span class="record-row__name cell-mono">' + ui.esc(release.version) + '</span>' +
							'<span class="tag">' + ui.esc(release.channel) + '</span>' +
							(release === current ? '<span class="cell-muted">this is what the fleet should run</span>' : '') +
							'</div>' +
							'<div class="record-row__meta">' +
							'<span>' + n(release.devices, 'controller', 'controllers') + '</span>' +
							'<span class="cell-mono">' + ui.esc(release.size) + '</span>' +
							'<span>released ' + ui.esc(release.released) + '</span>' +
							'</div>' +
							'</div>' +
							'<div class="record-row__state">' + ui.badge(release.state, release.tone) + '</div>' +
							'</div>'
						);
					}).join('')
				}) +
				(behind.length
					? ui.group({
						label: 'Behind',
						count: n(behind.length, 'controller', 'controllers'),
						note: 'These run something other than ' + ui.esc(current ? current.version : 'the current release') + '. A controller that is offline cannot be updated until it answers again.',
						body: behind.map(function (device) {
							return (
								'<div class="record-row">' +
								ui.toneMark('chip', deviceTone(device)) +
								'<div class="record-row__main">' +
								'<div class="record-row__title"><span class="record-row__name">' + ui.esc(device.name) + '</span></div>' +
								'<div class="record-row__meta">' +
								'<span class="cell-mono">' + ui.esc(device.firmware) + ' → ' + ui.esc(current ? current.version : '—') + '</span>' +
								'<span>' + ui.esc(device.status) + '</span>' +
								'<span>' + ui.esc(device.last) + '</span>' +
								'</div>' +
								'</div>' +
								'<div class="record-row__state"></div>' +
								ui.button('Stage', { small: true, kind: 'ghost', action: 'stage-firmware' }) +
								'</div>'
							);
						}).join('')
					})
					: '') +
				'<div class="mt-24">' +
				ui.callout(
					staged
						? '<b>' + ui.esc(staged.version) + ' is a ' + ui.esc(staged.channel.toLowerCase()) + '.</b> Staging it on a production controller is refused unless the workspace is switched to the Preview channel in Settings.'
						: 'A staged image survives a power cut; the controller boots the old firmware until the new one is confirmed.',
					{ kind: 'warn' }
				) +
				'</div>';

			return ui.view(body);
		}
	};

	M.views['devices/health'] = {
		title: 'Health & Alarms',
		render: function () {
			var active = data.alarms.filter(function (alarm) { return alarm.state === 'Active'; });
			var acknowledged = data.alarms.filter(function (alarm) { return alarm.state === 'Acknowledged'; });
			var cleared = data.alarms.filter(function (alarm) { return alarm.state === 'Cleared'; });
			var high = active.filter(function (alarm) { return alarm.priority === 'High'; }).length;

			var alarmRow = function (alarm) {
				var tone = alarm.priority === 'High' ? 'err' : alarm.priority === 'Medium' ? 'warn' : 'info';
				return (
					'<div class="record-row' + (alarm.state === 'Active' ? '' : ' record-row--static') + '">' +
					ui.toneMark('alert', tone) +
					'<div class="record-row__main">' +
					'<div class="record-row__title"><span class="record-row__name">' + ui.esc(alarm.message) + '</span></div>' +
					'<div class="record-row__meta">' +
					'<span>' + ui.esc(alarm.device) + '</span>' +
					'<span class="cell-mono">' + ui.esc(alarm.time) + '</span>' +
					'<span>' + ui.esc(alarm.priority) + ' priority</span>' +
					'</div>' +
					'</div>' +
					'<div class="record-row__state">' + ui.badge(alarm.state, alarm.tone) + '</div>' +
					(alarm.state === 'Active'
						? ui.button('Acknowledge', { small: true, action: 'ack' })
						: '<span class="cell-muted">' + (alarm.state === 'Acknowledged' ? 'seen by a person' : 'cleared on the device') + '</span>') +
					'</div>'
				);
			};

			var body =
				ui.pageHead({
					title: 'Health & Alarms',
					icon: 'alert',
					desc: 'What the fleet reports right now, newest first. Acknowledging does not clear a condition — it records that a person has seen it, and the device keeps reporting until the cause is gone.',
					actions: ui.button('Acknowledge All', { icon: 'check', action: 'ack-all' })
				}) +
				ui.tiles([
					{ value: String(active.length), label: 'Active' },
					{ value: String(high), label: 'High priority' },
					{ value: String(acknowledged.length), label: 'Acknowledged' },
					{ value: String(cleared.length), label: 'Cleared today' }
				]) +
				(active.length
					? ui.group({
						label: 'Active',
						count: n(active.length, 'condition', 'conditions'),
						note: 'Each of these is still true on the device. The row disappears when the device says it is not.',
						body: active.map(alarmRow).join('')
					})
					: '') +
				(acknowledged.length
					? ui.group({ label: 'Acknowledged', count: n(acknowledged.length, 'condition', 'conditions'), body: acknowledged.map(alarmRow).join('') })
					: '') +
				(cleared.length
					? ui.group({ label: 'Cleared Today', count: n(cleared.length, 'condition', 'conditions'), body: cleared.map(alarmRow).join('') })
					: '');

			return ui.view(body);
		}
	};

	M.views['devices/schedules'] = {
		title: 'Schedules',
		render: function () {
			var rows = [
				{ device: 'T3-BB · AHU-1', name: 'Weekday occupancy', next: 'Tomorrow 06:00', state: 'Enabled', tone: 'ok', entries: 10 },
				{ device: 'T3-BB · AHU-1', name: 'Weekend setback', next: 'Saturday 00:00', state: 'Enabled', tone: 'ok', entries: 4 },
				{ device: 'T3-LB · Lighting', name: 'Exterior lighting', next: 'Today 18:30', state: 'Overridden', tone: 'warn', entries: 14 },
				{ device: 'T3-NC · Chiller', name: 'Condenser purge', next: 'Today 22:00', state: 'Enabled', tone: 'ok', entries: 6 },
				{ device: 'T3-8R · Boiler Room', name: 'Holiday lockout', next: '—', state: 'Disabled', tone: 'neutral', entries: 2 }
			];
			var overridden = rows.filter(function (row) { return row.state === 'Overridden'; });

			var body =
				ui.pageHead({
					title: 'Schedules',
					icon: 'clock',
					desc: 'Schedules the fleet holds, and when each one runs next. Editing one writes it to the device, not to a local copy — a schedule that has not reached the device has not changed.',
					actions: ui.button('New Schedule', { kind: 'primary', icon: 'plus', action: 'new-schedule' })
				}) +
				ui.group({
					label: 'Schedule Objects',
					count: n(rows.length, 'schedule', 'schedules') + (overridden.length ? ' · ' + n(overridden.length, 'override', 'overrides') : ''),
					note: 'Times are the controller\'s own clock, which drifts if it is not synchronised after a power cut.',
					body: rows.map(function (row) {
						return (
							'<div class="record-row">' +
							ui.toneMark('clock', row.tone) +
							'<div class="record-row__main">' +
							'<div class="record-row__title"><span class="record-row__name">' + ui.esc(row.name) + '</span></div>' +
							'<div class="record-row__meta">' +
							'<span>' + ui.esc(row.device) + '</span>' +
							'<span>' + n(row.entries, 'entry', 'entries') + '</span>' +
							'<span>next ' + ui.esc(row.next) + '</span>' +
							'</div>' +
							'</div>' +
							'<div class="record-row__state">' + ui.badge(row.state, row.tone) + '</div>' +
							ui.button('Edit', { small: true, kind: 'ghost', action: 'edit-schedule' }) +
							'</div>'
						);
					}).join('')
				}) +
				ui.group({
					label: 'Weekday Occupancy · T3-BB',
					count: '5 days',
					body:
						'<div class="record-row record-row--static">' +
						ui.toneMark('list') +
						'<div class="record-row__main">' +
						'<div class="record-row__title"><span class="record-row__name cell-mono">Mon – Wed 06:00 → 18:00</span></div>' +
						'<div class="record-row__meta"><span>occupied</span><span>six entries</span></div>' +
						'</div>' +
						'<div class="record-row__state"></div>' +
						'<div class="record-row__state"></div>' +
						'</div>' +
						'<div class="record-row record-row--static">' +
						ui.toneMark('list') +
						'<div class="record-row__main">' +
						'<div class="record-row__title"><span class="record-row__name cell-mono">Thu 06:00 → 20:00</span></div>' +
						'<div class="record-row__meta"><span>late meeting</span><span>temporary override</span></div>' +
						'</div>' +
						'<div class="record-row__state">' + ui.badge('Overridden', 'warn') + '</div>' +
						'<div class="record-row__state"></div>' +
						'</div>' +
						'<div class="record-row record-row--static">' +
						ui.toneMark('list') +
						'<div class="record-row__main">' +
						'<div class="record-row__title"><span class="record-row__name cell-mono">Fri 06:00 → 17:00</span></div>' +
						'<div class="record-row__meta"><span>occupied</span><span>six entries</span></div>' +
						'</div>' +
						'<div class="record-row__state"></div>' +
						'<div class="record-row__state"></div>' +
						'</div>'
				});

			return ui.view(body);
		}
	};

	M.views['devices/trends'] = {
		title: 'Trend Logs',
		render: function () {
			var logs = [
				{ name: 'AHU-1 Temperatures', device: 'T3-BB · AHU-1', samples: 1882, interval: '15 min', used: 64, read: '8 minutes ago', state: 'Read', tone: 'ok' },
				{ name: 'Valve Position', device: 'T3-BB · AHU-1', samples: 1882, interval: '15 min', used: 64, read: '8 minutes ago', state: 'Read', tone: 'ok' },
				{ name: 'Boiler Runtime', device: 'T3-8R · Boiler Room', samples: 940, interval: '1 h', used: 31, read: 'yesterday', state: 'Read', tone: 'ok' },
				{ name: 'Lab Environment', device: 'T3-22I · Lab Wing', samples: 402, interval: '30 min', used: 92, read: '2 hours ago', state: 'Buffer full', tone: 'warn' }
			];
			var samples = logs.reduce(function (total, log) { return total + log.samples; }, 0);

			var body =
				ui.pageHead({
					title: 'Trend Logs',
					icon: 'chart',
					desc: 'Samples the controllers kept. A trend log lives on its device until it is read; reading one copies it into the platform, and the device keeps sampling either way.',
					actions: ui.button('Read All', { kind: 'primary', icon: 'download', action: 'read-trends' })
				}) +
				'<div class="grid grid--3">' +
				ui.card({ title: 'AHU-1 Temperatures', icon: 'chart', desc: 'Supply 18.4 °C · Return 22.1 °C', body: sparkline([18.1, 18.3, 18.2, 18.5, 18.9, 18.6, 18.4, 18.4, 18.2, 18.1, 18.3, 18.4]) + '<div class="cell-muted" style="font-size:11px;margin-top:6px">last 12 samples · 15 min interval</div>' }) +
				ui.card({ title: 'Valve Position', icon: 'activity', desc: 'AO1 · 38.5 %', body: sparkline([12, 14, 18, 22, 31, 35, 33, 36, 38, 39, 38, 38.5], 'ok') + '<div class="cell-muted" style="font-size:11px;margin-top:6px">last 12 samples · 15 min interval</div>' }) +
				ui.card({ title: 'Humidity · Lab Wing', icon: 'activity', desc: 'AI3 · 46.8 %RH', body: sparkline([52, 51, 49, 48, 47, 47, 46, 46, 47, 47, 46.8, 46.8], 'warn') + '<div class="cell-muted" style="font-size:11px;margin-top:6px">device offline since 10:38</div>' }) +
				'</div>' +
				ui.group({
					label: 'On the Fleet',
					count: n(logs.length, 'log', 'logs') + ' · ' + samples.toLocaleString('en-US') + ' samples',
					note: 'A buffer at 90 % or more is a log nobody has read in a while: the device overwrites its oldest samples to keep sampling.',
					body: logs.map(function (log) {
						return (
							'<div class="record-row">' +
							ui.toneMark('chart', log.tone) +
							'<div class="record-row__main">' +
							'<div class="record-row__title"><span class="record-row__name">' + ui.esc(log.name) + '</span></div>' +
							'<div class="record-row__meta">' +
							'<span>' + ui.esc(log.device) + '</span>' +
							'<span>' + log.samples.toLocaleString('en-US') + ' samples</span>' +
							'<span class="cell-mono">' + ui.esc(log.interval) + '</span>' +
							'<span>read ' + ui.esc(log.read) + '</span>' +
							'</div>' +
							'</div>' +
							'<div class="record-row__state"><div style="min-width:90px">' + ui.bar(log.used, log.used > 85 ? 'warn' : 'ok') + '</div></div>' +
							ui.button('Read', { small: true, kind: 'ghost', action: 'open-trend' }) +
							'</div>'
						);
					}).join('')
				});

			return ui.view(body);
		}
	};

	M.views['devices/backups'] = {
		title: 'Backups',
		render: function () {
			var backups = [
				{ device: 'T3-BB · AHU-1', when: '2026-10-17 06:00', size: '418 KB', firmware: '2.14.3', kind: 'scheduled', tone: 'ok' },
				{ device: 'T3-8R · Boiler Room', when: '2026-10-17 06:00', size: '206 KB', firmware: '2.14.3', kind: 'scheduled', tone: 'ok' },
				{ device: 'T3-NC · Chiller', when: '2026-10-16 06:00', size: '312 KB', firmware: '2.14.1', kind: 'scheduled', tone: 'ok' },
				{ device: 'T3-22I · Lab Wing', when: '2026-10-03 06:00', size: '148 KB', firmware: '2.12.1', kind: 'last successful copy · device offline', tone: 'warn' }
			];

			var body =
				ui.pageHead({
					title: 'Backups',
					icon: 'download',
					desc: 'A backup is the controller\'s own database, copied out. Restoring writes it back and restarts the device, which is why the platform keeps a rollback copy first.',
					actions: ui.button('Back Up All', { kind: 'primary', icon: 'download', action: 'backup-all' })
				}) +
				ui.group({
					label: 'Copies',
					count: n(backups.length, 'backup', 'backups'),
					note: 'Newest first, one row per controller. A controller that has not answered since October 3 has nothing younger to offer.',
					body: backups.map(function (backup) {
						var stale = backup.tone === 'warn';
						return (
							'<div class="record-row' + (stale ? ' record-row--static' : '') + '">' +
							ui.toneMark('package', backup.tone) +
							'<div class="record-row__main">' +
							'<div class="record-row__title"><span class="record-row__name">' + ui.esc(backup.device) + '</span></div>' +
							'<div class="record-row__meta">' +
							'<span class="cell-mono">' + ui.esc(backup.when) + '</span>' +
							'<span class="cell-mono">' + ui.esc(backup.size) + '</span>' +
							'<span>firmware ' + ui.esc(backup.firmware) + '</span>' +
							'<span>' + ui.esc(backup.kind) + '</span>' +
							'</div>' +
							'</div>' +
							'<div class="record-row__state">' + (stale ? ui.badge('Oldest', 'warn') : '') + '</div>' +
							(stale ? '<span class="cell-muted">nothing to restore from</span>' : ui.button('Restore', { small: true, kind: 'ghost', action: 'restore-backup' })) +
							'</div>'
						);
					}).join('')
				}) +
				'<div class="mt-16">' +
				ui.callout('Restoring is a write to the device and restarts it. The platform copies the current database aside before it writes, and that copy is what a second restore would use.', { kind: 'warn' }) +
				'</div>';

			return ui.view(body);
		}
	};

	/* ------------------------------------------------------------------ i/o studio */

	M.views['io/points'] = {
		title: 'Point Browser',
		render: function () {
			var groups = [
				{ label: 'Analog Input', types: ['AI'] },
				{ label: 'Analog Output', types: ['AO'] },
				{ label: 'Digital', types: ['DI', 'DO'] }
			];

			var body =
				ui.pageHead({
					title: 'Point Browser',
					icon: 'list',
					desc: 'Every point on the selected controller, with its live value. Writing one is a command to the device at a priority — it is not a local override the platform keeps.',
					actions:
						ui.button('Add Point', { kind: 'primary', icon: 'plus', action: 'add-point' }) +
						ui.button('Export CSV', { icon: 'download', action: 'export-points' })
				}) +
				'<div class="toolbar">' +
				'<input class="input" type="search" placeholder="Filter points" aria-label="Filter points">' +
				ui.segmented('Point type', ['All', 'AI', 'AO', 'DI', 'DO'], 'All') +
				'<span class="toolbar__spacer"></span>' +
				'<span class="cell-muted" style="font-size:12px">T3-BB · AHU-1 · ' + n(data.points.length, 'point', 'points') + '</span>' +
				'</div>' +
				groups.map(function (group) {
					var points = data.points.filter(function (point) { return group.types.indexOf(point.type) >= 0; });
					if (!points.length) {
						return '';
					}
					return ui.group({
						label: group.label,
						count: n(points.length, 'point', 'points'),
						body: points.map(function (point) {
							return (
								'<div class="record-row">' +
								ui.toneMark(point.type === 'DI' || point.type === 'DO' ? 'activity' : 'chart', point.state === 'warn' ? 'warn' : '') +
								'<div class="record-row__main">' +
								'<div class="record-row__title">' +
								'<span class="record-row__name"><span class="cell-mono">' + ui.esc(point.id) + '</span> · ' + ui.esc(point.label) + '</span>' +
								(point.state === 'warn' ? ui.badge('Fault', 'warn') : '') +
								'</div>' +
								'<div class="record-row__meta">' +
								'<span class="tag">' + ui.esc(point.type) + '</span>' +
								'<span>range ' + ui.esc(point.range) + '</span>' +
								'<span>' + ui.esc(point.trend) + '</span>' +
								'</div>' +
								'</div>' +
								'<div class="record-row__state cell-mono cell-strong">' + ui.esc(point.value) + '</div>' +
								'<div class="record-row__state cell-muted">' + ui.esc(point.unit) + '</div>' +
								'</div>'
							);
						}).join('')
					});
				}).join('') +
				'<div class="mt-24 grid grid--2">' +
				ui.card({
					title: 'Write a Value',
					cls: 'card--plain',
					desc: 'AO1 · Valve Position. A write is held at the priority you pick; priority 8 is an operator override, and the schedule takes the point back at its next event.',
					body:
						'<div class="settings-rows">' +
						ui.formRow('Value', 'Percent, 0 – 100.', '<input class="input" value="38.5" aria-label="Value">') +
						ui.formRow('Priority', 'Lower numbers win.', '<select class="select" aria-label="Priority"><option>8 · operator</option><option>10 · local</option><option>16 · default</option></select>') +
						'</div>',
					foot: ui.button('Write', { small: true, kind: 'primary', action: 'write-point' }) + '<span>writes to the device</span>'
				}) +
				ui.card({
					title: 'Selected Point',
					cls: 'card--plain',
					desc: 'Where the value comes from, and what reads it.',
					body:
						'<dl class="kv">' +
						'<dt>Object</dt><dd class="cell-mono">AV-103</dd>' +
						'<dt>Units</dt><dd>percent</dd>' +
						'<dt>Scale</dt><dd class="cell-mono">×1.0 + 0</dd>' +
						'<dt>COV</dt><dd>enabled · 0.5 %</dd>' +
						'<dt>Trend</dt><dd>15 min · 1,882 samples</dd>' +
						'</dl>'
				}) +
				'</div>';

			return ui.view(body);
		}
	};

	M.views['io/mapping'] = {
		title: 'Mapping',
		render: function () {
			var mapped = data.mappings.filter(function (mapping) { return mapping.state === 'Mapped'; }).length;
			var review = data.mappings.filter(function (mapping) { return mapping.state === 'Needs review'; }).length;
			var unmapped = data.mappings.filter(function (mapping) { return mapping.state === 'Unmapped'; }).length;

			var body =
				ui.pageHead({
					title: 'Mapping',
					icon: 'link',
					desc: 'How a physical point becomes a named value the rest of the platform reads. An unmapped point is invisible to programs and to trends.',
					actions: ui.button('Auto-Map', { kind: 'primary', icon: 'sparkle', action: 'auto-map' })
				}) +
				ui.tiles([
					{ value: String(data.mappings.length), label: 'Points' },
					{ value: String(mapped), label: 'Mapped' },
					{ value: String(review), label: 'Needs review' },
					{ value: String(unmapped), label: 'Unmapped' }
				]) +
				ui.group({
					label: 'Mappings',
					count: n(data.mappings.length, 'row', 'rows'),
					note: 'The source is the controller\'s own point id; the target is the platform value a program names.',
					body: data.mappings.map(function (mapping) {
						return (
							'<div class="record-row">' +
							ui.toneMark('link', mapping.tone) +
							'<div class="record-row__main">' +
							'<div class="record-row__title">' +
							'<span class="record-row__name cell-mono">' + ui.esc(mapping.source) + '</span>' +
							ui.icon('arrow-right', 'icon--sm') +
							'<span class="cell-mono">' + ui.esc(mapping.target) + '</span>' +
							'</div>' +
							'<div class="record-row__meta"><span>scale ' + ui.esc(mapping.scale) + '</span></div>' +
							'</div>' +
							'<div class="record-row__state">' + ui.badge(mapping.state, mapping.tone) + '</div>' +
							ui.button('Edit', { small: true, kind: 'ghost', action: 'edit-mapping' }) +
							'</div>'
						);
					}).join('')
				}) +
				'<div class="mt-24">' +
				ui.card({
					title: 'AI Suggestion',
					icon: 'sparkle',
					cls: 'card--plain',
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
			var programs = [
				{ name: 'AHU-1 Supply Control', state: 'Running', tone: 'ok', note: 'compiled 09:12 · device T3-BB' },
				{ name: 'AHU-1 Schedule Override', state: 'Idle', tone: 'neutral', note: 'compiled 09:12' },
				{ name: 'Alarm Routing', state: 'Needs compile', tone: 'warn', note: 'changed 2 days ago' }
			];

			var body =
				ui.pageHead({
					title: 'Logic',
					icon: 'code',
					desc: 'Programs on the device, shown as their source. Compiling writes the program; it does not run until the device restarts, and a program that has not compiled is not running.',
					actions:
						ui.button('New Program', { kind: 'primary', icon: 'plus', action: 'new-program' }) +
						ui.button('Compile', { icon: 'play', action: 'compile-program' })
				}) +
				ui.rule({ label: 'AHU-1 Supply Control', count: 'compiled · running', actions: ui.badge('No errors', 'ok') }) +
				'<div class="mt-16">' +
				'<pre class="code" style="max-height:360px">' +
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
				'</pre>' +
				'</div>' +
				ui.group({
					label: 'Programs',
					count: n(programs.length, 'program', 'programs'),
					body: programs.map(function (program) {
						return (
							'<div class="record-row">' +
							ui.toneMark('code', program.tone) +
							'<div class="record-row__main">' +
							'<div class="record-row__title"><span class="record-row__name">' + ui.esc(program.name) + '</span></div>' +
							'<div class="record-row__meta"><span>' + ui.esc(program.note) + '</span></div>' +
							'</div>' +
							'<div class="record-row__state">' + ui.badge(program.state, program.tone) + '</div>' +
							ui.button('Open', { small: true, kind: 'ghost', action: 'edit-program' }) +
							'</div>'
						);
					}).join('')
				}) +
				ui.group({
					label: 'Diagnostics',
					count: '1 warning',
					body:
						'<div class="record-row record-row--static">' +
						ui.toneMark('check', 'ok') +
						'<div class="record-row__main">' +
						'<div class="record-row__title"><span class="record-row__name">No compile errors</span></div>' +
						'<div class="record-row__meta"><span>last compile 09:12</span></div>' +
						'</div>' +
						'<div class="record-row__state"></div>' +
						'<div class="record-row__state"></div>' +
						'</div>' +
						'<div class="record-row record-row--static">' +
						ui.toneMark('warning', 'warn') +
						'<div class="record-row__main">' +
						'<div class="record-row__title"><span class="record-row__name">One branch can never run</span></div>' +
						'<div class="record-row__meta"><span>line 24</span><span>DI1 is never FAULT on this device</span></div>' +
						'</div>' +
						'<div class="record-row__state">' + ui.badge('Warning', 'warn') + '</div>' +
						'<div class="record-row__state"></div>' +
						'</div>'
				});

			return ui.view(body);
		}
	};

	M.views['io/live'] = {
		title: 'Live Values',
		render: function () {
			var subscribed = [
				{ name: 'T3-BB · AHU-1', points: 96, state: 'Live', tone: 'ok' },
				{ name: 'T3-8R · Boiler Room', points: 48, state: 'Live', tone: 'ok' },
				{ name: 'T3-22I · Lab Wing', points: 22, state: 'No answer', tone: 'err' }
			];

			var body =
				ui.pageHead({
					title: 'Live Values',
					icon: 'activity',
					desc: 'A subscription, not a poll: values arrive when the device sends them. Closing the tab ends the subscription, which is why nothing here is kept.',
					actions: ui.button('Pause', { icon: 'close', action: 'pause-live' })
				}) +
				ui.group({
					label: 'Subscribed Values',
					count: n(data.points.length, 'point', 'points'),
					body: data.points.map(function (point) {
						var numeric = parseFloat(point.value);
						var level = isNaN(numeric) ? null : point.range.indexOf('0 – 100') >= 0 ? numeric : Math.min(100, (numeric / 50) * 100);
						return (
							'<div class="record-row record-row--static">' +
							ui.toneMark('activity', point.state === 'warn' ? 'warn' : '') +
							'<div class="record-row__main">' +
							'<div class="record-row__title">' +
							'<span class="record-row__name"><span class="cell-mono">' + ui.esc(point.id) + '</span> · ' + ui.esc(point.label) + '</span>' +
							'</div>' +
							'<div class="record-row__meta"><span>' + ui.esc(point.trend) + '</span><span>updated just now</span></div>' +
							'</div>' +
							'<div class="record-row__state">' +
							(level === null ? '<span class="cell-muted">—</span>' : '<div style="min-width:120px">' + ui.bar(level, level > 80 ? 'warn' : 'ok') + '</div>') +
							'</div>' +
							'<div class="record-row__state cell-mono cell-strong">' + ui.esc(point.value) + ' <span class="cell-muted">' + ui.esc(point.unit) + '</span></div>' +
							'</div>'
						);
					}).join('')
				}) +
				ui.group({
					label: 'Subscribed Devices',
					count: n(subscribed.length, 'device', 'devices'),
					note: 'A subscription ends with the tab, so a controller is not polled by a window nobody is looking at.',
					body: subscribed.map(function (device) {
						return (
							'<div class="record-row record-row--static">' +
							ui.toneMark('chip', device.tone) +
							'<div class="record-row__main">' +
							'<div class="record-row__title"><span class="record-row__name">' + ui.esc(device.name) + '</span></div>' +
							'<div class="record-row__meta"><span>' + n(device.points, 'point', 'points') + '</span><span>change of value</span></div>' +
							'</div>' +
							'<div class="record-row__state">' + ui.badge(device.state, device.tone) + '</div>' +
							'<div class="record-row__state"></div>' +
							'</div>'
						);
					}).join('')
				});

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
					desc: 'The same point over time. Two series are overlaid to compare what a program asked for with what the equipment did.',
					actions: ui.button('Add Series', { icon: 'plus', action: 'add-series' })
				}) +
				ui.card({
					title: 'AHU-1 · Supply Air Temperature vs Setpoint',
					cls: 'card--plain',
					desc: '15-minute samples · last 3 hours · firmware 2.14.3',
					body:
						'<div style="display:flex;gap:16px;align-items:flex-end;padding:10px 0;overflow:auto">' +
						'<div style="color:var(--accent)">' + sparkline([18.1, 18.3, 18.2, 18.5, 18.9, 18.6, 18.4, 18.4, 18.2, 18.1, 18.3, 18.4]) + '</div>' +
						'<div style="color:var(--fg-subtle)">' + sparkline([18.0, 18.0, 18.0, 18.0, 18.0, 18.0, 18.0, 18.0, 18.0, 18.0, 18.0, 18.0]) + '</div>' +
						'</div>' +
						'<div class="facts">' +
						'<span><span class="dot dot--accent"></span> Supply air 18.4 °C</span>' +
						'<span>Setpoint 18.0 °C</span>' +
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
			var answering = data.hosts.filter(function (host) { return host.state === 'Online'; });
			var foreign = data.hosts.filter(function (host) { return host.vendor !== 'Temco'; });
			var bacnetIp = data.hosts.filter(function (host) { return host.protocol === 'BACnet/IP'; });

			var body =
				ui.pageHead({
					title: 'BACnet Discovery',
					icon: 'search',
					desc: 'Who answers on the network, and what they say they are. Discovery is read-only: a Who-Is writes nothing to a device, and a device that does not answer is still in the fleet.',
					actions:
						ui.button('Start Scan', { kind: 'primary', icon: 'search', action: 'bacnet-scan' }) +
						ui.button('Who-Is Range', { icon: 'filter', action: 'whois-range' })
				}) +
				'<div class="toolbar">' +
				'<input class="input" value="192.168.10.0/24" aria-label="Range">' +
				'<select class="select" aria-label="Protocol"><option>BACnet/IP</option><option>BACnet MS/TP</option><option>BACnet/SC</option></select>' +
				'<span class="toolbar__spacer"></span>' +
				'<span class="cell-muted" style="font-size:12px">' + n(data.hosts.length, 'host', 'hosts') + ' · scanned 4 minutes ago</span>' +
				'</div>' +
				ui.tiles([
					{ value: String(data.hosts.length), label: 'Answered' },
					{ value: String(answering.length), label: 'Online' },
					{ value: String(foreign.length), label: 'Third-party' },
					{ value: String(bacnetIp.length), label: 'BACnet/IP' }
				]) +
				ui.group({
					label: 'Devices On The Wire',
					count: n(data.hosts.length, 'host', 'hosts'),
					note: 'The instance number is what BACnet addresses the device by; the IP is only how this segment reaches it.',
					body: data.hosts.map(function (host) {
						return (
							'<div class="record-row">' +
							ui.toneMark('globe', host.tone) +
							'<div class="record-row__main">' +
							'<div class="record-row__title">' +
							'<span class="record-row__name">' + ui.esc(host.name) + '</span>' +
							'<span class="tag">' + ui.esc(host.protocol) + '</span>' +
							(host.vendor !== 'Temco' ? ui.badge('Third-party', 'neutral') : '') +
							'</div>' +
							'<div class="record-row__meta">' +
							'<span class="cell-mono">' + ui.esc(host.ip) + '</span>' +
							'<span class="cell-mono">' + ui.esc(host.mac) + '</span>' +
							'<span>' + ui.esc(host.vendor) + '</span>' +
							'</div>' +
							'</div>' +
							'<div class="record-row__state">' + ui.badge(host.state, host.tone) + '</div>' +
							(host.protocol === 'BACnet/IP' ? ui.button('Objects', { small: true, kind: 'ghost', open: 'bacnet/objects' }) : '<span class="cell-muted">no objects</span>') +
							'</div>'
						);
					}).join('')
				}) +
				'<div class="mt-16">' +
				ui.callout('1,204 objects were read across the answering devices, 88 of them writable. Reading an object does not keep a copy: the value is asked for again the next time a page needs it.') +
				'</div>';

			return ui.view(body);
		}
	};

	M.views['bacnet/objects'] = {
		title: 'Object Browser',
		render: function () {
			var fault = data.bacnetObjects.filter(function (object) { return object.flags === 'Fault'; });

			var body =
				ui.pageHead({
					title: 'Object Browser',
					icon: 'list',
					desc: 'The objects one device exposes, read over BACnet. A value written here goes to the device; the platform keeps no copy of it.',
					actions:
						ui.button('Read All', { icon: 'refresh', action: 'read-objects' }) +
						ui.button('Export', { icon: 'download', action: 'export-objects' })
				}) +
				ui.group({
					label: 'Objects · T3-BB · AHU-1',
					count: n(data.bacnetObjects.length, 'object', 'objects') + (fault.length ? ' · ' + n(fault.length, 'fault', 'faults') : ''),
					body: data.bacnetObjects.map(function (object) {
						return (
							'<div class="record-row">' +
							ui.toneMark('server', object.flags === 'Fault' ? 'warn' : '') +
							'<div class="record-row__main">' +
							'<div class="record-row__title">' +
							'<span class="record-row__name cell-mono">' + ui.esc(object.instance) + '</span>' +
							'<span>' + ui.esc(object.name) + '</span>' +
							'</div>' +
							'<div class="record-row__meta">' +
							'<span>' + ui.esc(object.type) + '</span>' +
							'<span class="cell-mono">' + ui.esc(object.units) + '</span>' +
							'</div>' +
							'</div>' +
							'<div class="record-row__state cell-mono">' + ui.esc(object.value) + '</div>' +
							(object.flags === 'Fault' ? ui.badge('Fault', 'warn') : '<span class="cell-muted">no-fault</span>') +
							'</div>'
						);
					}).join('')
				}) +
				'<div class="mt-24 grid grid--2">' +
				ui.card({
					title: 'AV-101 · Supply Air Temp',
					cls: 'card--plain',
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
				ui.card({
					title: 'BV-31 · Filter Alarm',
					cls: 'card--plain',
					desc: 'The one object on this device that reports a fault.',
					body:
						'<dl class="kv">' +
						'<dt>Object id</dt><dd class="cell-mono">binary-value, 31</dd>' +
						'<dt>Present value</dt><dd class="cell-mono">inactive</dd>' +
						'<dt>Status flags</dt><dd class="cell-mono">fault</dd>' +
						'<dt>Writable</dt><dd>yes — priority 8</dd>' +
						'</dl>',
					foot: ui.badge('Fault', 'warn') + '<span>a fault here can mean the input is open circuit</span>'
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
					desc: 'Event notifications as the devices sent them, with the acknowledgement the platform owes the device. Acknowledging answers the device; it does not clear the condition.',
					actions: ui.button('Acknowledge All', { icon: 'check', action: 'ack-all' })
				}) +
				ui.group({
					label: 'Event Log',
					count: n(data.alarms.length, 'event', 'events'),
					note: 'One row per notification received, newest first — this is the wire, not a summary.',
					body: data.alarms.map(function (alarm) {
						var tone = alarm.priority === 'High' ? 'err' : alarm.priority === 'Medium' ? 'warn' : 'info';
						return (
							'<div class="record-row' + (alarm.state === 'Active' ? '' : ' record-row--static') + '">' +
							ui.toneMark('alert', tone) +
							'<div class="record-row__main">' +
							'<div class="record-row__title"><span class="record-row__name">' + ui.esc(alarm.message) + '</span></div>' +
							'<div class="record-row__meta">' +
							'<span class="cell-mono">' + ui.esc(alarm.time) + '</span>' +
							'<span>' + ui.esc(alarm.device) + '</span>' +
							'<span>' + ui.esc(alarm.priority) + ' priority</span>' +
							'</div>' +
							'</div>' +
							'<div class="record-row__state">' + ui.badge(alarm.state, alarm.tone) + '</div>' +
							(alarm.state === 'Active' ? ui.button('Acknowledge', { small: true, action: 'ack' }) : '<span class="cell-muted">—</span>') +
							'</div>'
						);
					}).join('')
				}) +
				'<div class="mt-16">' +
				ui.callout('An event notification carries the state the device had when it sent it. If the platform was not listening, that event is gone — the device does not resend it.') +
				'</div>';

			return ui.view(body);
		}
	};

	M.views['bacnet/trendlogs'] = {
		title: 'Trend Logs',
		render: function () {
			var logs = [
				{ name: 'AHU-1 Temperatures', object: 'trend-log, 4', samples: 1882, used: 64, read: '8 minutes ago' },
				{ name: 'Valve Position', object: 'trend-log, 5', samples: 1882, used: 64, read: '8 minutes ago' },
				{ name: 'Boiler Runtime', object: 'trend-log, 12', samples: 940, used: 31, read: 'yesterday' },
				{ name: 'Lab Environment', object: 'trend-log, 2', samples: 402, used: 92, read: '2 hours ago' }
			];

			var body =
				ui.pageHead({
					title: 'BACnet Trend Logs',
					icon: 'chart',
					desc: 'Trend logs the devices hold. Reading one transfers its buffer over BACnet; the device keeps sampling either way, so a late read is a late copy, not a lost one.',
					actions: ui.button('Read Buffer', { kind: 'primary', icon: 'download', action: 'read-buffer' })
				}) +
				ui.group({
					label: 'Log Objects',
					count: n(logs.length, 'log', 'logs'),
					body: logs.map(function (log) {
						return (
							'<div class="record-row">' +
							ui.toneMark('chart', log.used > 85 ? 'warn' : '') +
							'<div class="record-row__main">' +
							'<div class="record-row__title">' +
							'<span class="record-row__name">' + ui.esc(log.name) + '</span>' +
							'<span class="cell-mono cell-muted">' + ui.esc(log.object) + '</span>' +
							'</div>' +
							'<div class="record-row__meta">' +
							'<span>' + log.samples.toLocaleString('en-US') + ' samples</span>' +
							'<span>' + (log.used > 85 ? 'buffer nearly full' : 'buffer ' + log.used + ' %') + '</span>' +
							'<span>last read ' + ui.esc(log.read) + '</span>' +
							'</div>' +
							'</div>' +
							'<div class="record-row__state"><div style="min-width:90px">' + ui.bar(log.used, log.used > 85 ? 'warn' : 'ok') + '</div></div>' +
							ui.button('Open', { small: true, kind: 'ghost', action: 'open-trend' }) +
							'</div>'
						);
					}).join('')
				});

			return ui.view(body);
		}
	};

	M.views['bacnet/schedules'] = {
		title: 'Schedules',
		render: function () {
			var schedules = [
				{ object: 'SCH-1', name: 'Weekday Schedule', device: 'T3-BB · AHU-1', entries: 10, next: 'Tomorrow 06:00', state: 'Active', tone: 'ok' },
				{ object: 'SCH-2', name: 'Weekend Setback', device: 'T3-BB · AHU-1', entries: 4, next: 'Saturday 00:00', state: 'Active', tone: 'ok' },
				{ object: 'SCH-7', name: 'Exterior Lighting', device: 'T3-LB · Lighting', entries: 14, next: 'Today 18:30', state: 'Overridden', tone: 'warn' }
			];

			var body =
				ui.pageHead({
					title: 'BACnet Schedules',
					icon: 'clock',
					desc: 'Schedule objects on the network, with the weekly entries the device holds. The entries live in the device; this list is what it reported.',
					actions: ui.button('New Schedule', { kind: 'primary', icon: 'plus', action: 'new-schedule' })
				}) +
				ui.group({
					label: 'Schedule Objects',
					count: n(schedules.length, 'object', 'objects'),
					body: schedules.map(function (schedule) {
						return (
							'<div class="record-row">' +
							ui.toneMark('clock', schedule.tone) +
							'<div class="record-row__main">' +
							'<div class="record-row__title">' +
							'<span class="record-row__name">' + ui.esc(schedule.name) + '</span>' +
							'<span class="cell-mono cell-muted">' + ui.esc(schedule.object) + '</span>' +
							'</div>' +
							'<div class="record-row__meta">' +
							'<span>' + ui.esc(schedule.device) + '</span>' +
							'<span>' + n(schedule.entries, 'entry', 'entries') + '</span>' +
							'<span>next ' + ui.esc(schedule.next) + '</span>' +
							'</div>' +
							'</div>' +
							'<div class="record-row__state">' + ui.badge(schedule.state, schedule.tone) + '</div>' +
							'<div class="record-row__state"></div>' +
							'</div>'
						);
					}).join('')
				});

			return ui.view(body);
		}
	};

	/* ------------------------------------------------------------------ network */

	M.views['network/discovery'] = {
		title: 'Discovery',
		render: function () {
			var answering = data.hosts.filter(function (host) { return host.state === 'Online'; });
			var foreign = data.hosts.filter(function (host) { return host.vendor !== 'Temco'; });
			var silent = data.hosts.filter(function (host) { return host.protocol === '—'; });

			var body =
				ui.pageHead({
					title: 'Network Discovery',
					icon: 'globe',
					desc: 'Every host the platform can see on the local segment, whatever protocol it speaks. A host that answers ARP is not necessarily a device: a workstation shows up here too.',
					actions: ui.button('Scan Segment', { kind: 'primary', icon: 'search', action: 'net-scan' })
				}) +
				'<div class="toolbar">' +
				'<input class="input" value="192.168.10.0/24" aria-label="Range">' +
				ui.button('ARP Lookup', { small: true, icon: 'search', action: 'arp-lookup' }) +
				'<span class="toolbar__spacer"></span>' +
				'<span class="cell-muted" style="font-size:12px">' + n(data.hosts.length, 'host', 'hosts') + ' · ' + n(data.hosts.length - answering.length, 'unreachable', 'unreachable') + '</span>' +
				'</div>' +
				ui.tiles([
					{ value: String(data.hosts.length), label: 'Hosts' },
					{ value: String(answering.length), label: 'Answering' },
					{ value: String(foreign.length), label: 'Not Temco' },
					{ value: String(silent.length), label: 'No protocol' }
				]) +
				ui.group({
					label: 'Hosts',
					count: n(data.hosts.length, 'address', 'addresses'),
					note: 'The vendor comes from the MAC prefix, so it is a guess about the hardware and not a claim about the device.',
					body: data.hosts.map(function (host) {
						return (
							'<div class="record-row">' +
							ui.toneMark('server', host.tone) +
							'<div class="record-row__main">' +
							'<div class="record-row__title">' +
							'<span class="record-row__name">' + ui.esc(host.name) + '</span>' +
							'<span class="tag">' + ui.esc(host.protocol) + '</span>' +
							(host.vendor !== 'Temco' ? ui.badge('Third-party', 'neutral') : '') +
							'</div>' +
							'<div class="record-row__meta">' +
							'<span class="cell-mono">' + ui.esc(host.ip) + '</span>' +
							'<span class="cell-mono">' + ui.esc(host.mac) + '</span>' +
							'<span>' + ui.esc(host.vendor) + '</span>' +
							'</div>' +
							'</div>' +
							'<div class="record-row__state">' + ui.badge(host.state, host.tone) + '</div>' +
							'<div class="record-row__state"></div>' +
							'</div>'
						);
					}).join('')
				});

			return ui.view(body);
		}
	};

	M.views['network/modbus'] = {
		title: 'Modbus Scanner',
		render: function () {
			var registers = [
				{ unit: 1, register: '40001', name: 'Supply air temp × 10', value: '184', type: 'INT16', state: 'OK', tone: 'ok' },
				{ unit: 1, register: '40002', name: 'Return air temp × 10', value: '221', type: 'INT16', state: 'OK', tone: 'ok' },
				{ unit: 1, register: '40010', name: 'Valve position', value: '385', type: 'INT16', state: 'OK', tone: 'ok' },
				{ unit: 2, register: '40001', name: 'Boiler flow', value: '—', type: 'INT16', state: 'Timeout', tone: 'warn' },
				{ unit: 7, register: '00001', name: 'Filter alarm', value: '1', type: 'COIL', state: 'OK', tone: 'ok' }
			];
			var units = registers.map(function (register) { return register.unit; }).filter(function (unit, index, all) { return all.indexOf(unit) === index; });

			var body =
				ui.pageHead({
					title: 'Modbus Scanner',
					icon: 'list',
					desc: 'Unit ids and register ranges on the Modbus side of the gateway. Reading a register is safe; writing one is a device command, and a write to a timed-out unit fails silently on the wire.',
					actions: ui.button('Scan Units', { kind: 'primary', icon: 'search', action: 'scan-units' })
				}) +
				'<div class="toolbar">' +
				'<input class="input" value="192.168.10.50:502" aria-label="Endpoint">' +
				'<select class="select" aria-label="Register type"><option>Holding registers</option><option>Input registers</option><option>Coils</option></select>' +
				'<span class="toolbar__spacer"></span>' +
				'<span class="cell-muted" style="font-size:12px">units 1–247 · ' + n(units.length, 'unit answered', 'units answered') + '</span>' +
				'</div>' +
				ui.group({
					label: 'Registers',
					count: n(registers.length, 'register', 'registers'),
					body: registers.map(function (register) {
						return (
							'<div class="record-row">' +
							ui.toneMark('server', register.tone) +
							'<div class="record-row__main">' +
							'<div class="record-row__title">' +
							'<span class="record-row__name cell-mono">' + ui.esc(register.register) + '</span>' +
							'<span>' + ui.esc(register.name) + '</span>' +
							'<span class="tag">unit ' + register.unit + '</span>' +
							'</div>' +
							'<div class="record-row__meta">' +
							'<span>' + ui.esc(register.type) + '</span>' +
							(register.state === 'Timeout' ? '<span>no answer — unit 2 is on the MS/TP trunk</span>' : '<span>scaled as ×10</span>') +
							'</div>' +
							'</div>' +
							'<div class="record-row__state cell-mono cell-strong">' + ui.esc(register.value) + '</div>' +
							'<div class="record-row__state">' + ui.badge(register.state, register.tone) + '</div>' +
							'</div>'
						);
					}).join('')
				});

			return ui.view(body);
		}
	};

	M.views['network/diagnostics'] = {
		title: 'Diagnostics',
		render: function () {
			var answering = data.hosts.filter(function (host) { return host.state === 'Online'; });
			var down = data.hosts.filter(function (host) { return host.state !== 'Online'; });

			var body =
				ui.pageHead({
					title: 'Diagnostics',
					icon: 'activity',
					desc: 'Reachability, latency and packet loss for the hosts the workspace depends on. A ping that times out is the start of a diagnosis, not the diagnosis.',
					actions: ui.button('Run All', { kind: 'primary', icon: 'play', action: 'run-diagnostics' })
				}) +
				ui.tiles([
					{ value: String(answering.length) + ' of ' + data.hosts.length, label: 'Hosts answering' },
					{ value: String(down.length), label: 'Timeouts' },
					{ value: '4 ms', label: 'Median latency' },
					{ value: '0.2 %', label: 'Packet loss' }
				]) +
				'<div class="mt-24">' +
				ui.rule({ label: 'Ping · ' + (down[0] ? down[0].ip : '—'), count: down[0] ? '4 of 4 lost' : 'no failures', actions: ui.button('Copy Report', { small: true, kind: 'ghost', action: 'copy-report' }) }) +
				'<div class="mt-16">' +
				'<pre class="code">' +
				ui.esc(
					'Pinging ' + (down[0] ? down[0].ip : '192.168.10.31') + ' with 32 bytes of data:\n' +
					'Request timed out.\n' +
					'Request timed out.\n' +
					'Request timed out.\n' +
					'Request timed out.\n' +
					'\n' +
					'Ping statistics for ' + (down[0] ? down[0].ip : '192.168.10.31') + ':\n' +
					'    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss),'
				) +
				'</pre>' +
				'</div>' +
				'</div>' +
				ui.group({
					label: 'Hosts',
					count: n(data.hosts.length, 'host', 'hosts'),
					note: 'A controller that answers ping but not BACnet is a different problem from one that answers neither.',
					body: data.hosts.map(function (host) {
						return (
							'<div class="record-row record-row--static">' +
							ui.toneMark('server', host.tone) +
							'<div class="record-row__main">' +
							'<div class="record-row__title"><span class="record-row__name cell-mono">' + ui.esc(host.ip) + '</span><span>' + ui.esc(host.name) + '</span></div>' +
							'<div class="record-row__meta"><span>' + ui.esc(host.protocol) + '</span><span>' + ui.esc(host.vendor) + '</span></div>' +
							'</div>' +
							'<div class="record-row__state cell-mono cell-muted">' + (host.state === 'Online' ? '2–6 ms' : '—') + '</div>' +
							'<div class="record-row__state">' + ui.badge(host.state === 'Online' ? 'Answered' : 'Timed out', host.tone) + '</div>' +
							'</div>'
						);
					}).join('')
				});

			return ui.view(body);
		}
	};

	M.views['network/captures'] = {
		title: 'Captures',
		render: function () {
			var captures = [
				{ name: 'bacnet-whois-2026-10-17.pcapng', detail: '2,408 packets · filter "udp port 47808" · 1.2 MB', state: 'Closed', tone: 'neutral' },
				{ name: 'modbus-timeouts.pcapng', detail: '118 packets · filter "tcp port 502 and ip.addr == 192.168.10.50" · 84 KB', state: 'Closed', tone: 'neutral' },
				{ name: 'Live capture · all traffic', detail: 'recording · 14,882 packets · filter "not port 3389"', state: 'Recording', tone: 'info' }
			];

			var body =
				ui.pageHead({
					title: 'Captures',
					icon: 'download',
					desc: 'Packet captures taken from this machine or a mirrored port, kept with the filter that produced them — a capture without its filter is a file nobody can repeat.',
					actions: ui.button('New Capture', { kind: 'primary', icon: 'plus', action: 'new-capture' })
				}) +
				ui.group({
					label: 'Captures',
					count: n(captures.length, 'capture', 'captures'),
					body: captures.map(function (capture) {
						return (
							'<div class="record-row">' +
							ui.toneMark(capture.state === 'Recording' ? 'activity' : 'download', capture.tone) +
							'<div class="record-row__main">' +
							'<div class="record-row__title"><span class="record-row__name cell-mono">' + ui.esc(capture.name) + '</span></div>' +
							'<div class="record-row__meta"><span>' + ui.esc(capture.detail) + '</span></div>' +
							'</div>' +
							'<div class="record-row__state">' + ui.badge(capture.state, capture.tone) + '</div>' +
							(capture.state === 'Recording'
								? ui.button('Stop', { small: true, action: 'stop-capture' })
								: ui.button('Open', { small: true, kind: 'ghost', action: 'open-capture' })) +
							'</div>'
						);
					}).join('')
				}) +
				'<div class="mt-16">' +
				ui.callout('A capture is written to the workspace folder and is never committed. Deleting the row deletes the file.') +
				'</div>';

			return ui.view(body);
		}
	};

	/* ------------------------------------------------------------------ sql studio */

	/* The registry query this module opens with: the stale count per area, which is a number every
	   other page of the mock already quotes. */
	function staleByArea() {
		return data.knowledge.map(function (area) {
			return { area: area.area, stale: area.stale, pages: area.pages, reviewed: area.reviewed };
		}).sort(function (a, b) { return b.stale - a.stale; });
	}

	function sqlBlock(sql) {
		var escaped = ui.esc(sql);
		var marked = escaped.replace(/\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|LEFT JOIN|JOIN|ON|AS|DESC|LIMIT|count)\b/g, '<span class="tok-key">$1</span>');
		return '<pre class="code">' + marked + '</pre>';
	}

	var staleQuery = data.sqlQueries[0];

	M.views['sql/query'] = {
		title: 'Query Editor',
		render: function () {
			var rows = staleByArea();
			var total = rows.reduce(function (sum, row) { return sum + row.stale; }, 0);
			var history = data.sqlHistory.slice(0, 3);

			var body =
				ui.pageHead({
					title: 'Query Editor',
					icon: 'code',
					desc: 'The documentation registry, asked in SQL. Writes are refused by the connection, not by the editor — the editor shows what the connection allows before you run anything.',
					actions:
						ui.button('Run', { kind: 'primary', icon: 'play', action: 'run-query' }) +
						ui.button('Explain', { icon: 'list', action: 'explain-query' })
				}) +
				ui.rule({ label: staleQuery.name, plain: true, count: 'Temco Docs · read-only · ran ' + staleQuery.run, actions: ui.button('Save', { small: true, kind: 'ghost', action: 'save-query' }) }) +
				'<div class="mt-16">' + sqlBlock(staleQuery.sql) + '</div>' +
				ui.group({
					label: 'Result',
					count: n(rows.length, 'row', 'rows') + ' · ' + staleQuery.ms + ' ms',
					note: 'The same ' + total.toLocaleString('en-US') + ' stale pages the Coverage page counts, read from the registry rather than from a report.',
					body: rows.map(function (row) {
						return (
							'<div class="record-row record-row--static">' +
							ui.toneMark('chart', row.stale > 20 ? 'warn' : '') +
							'<div class="record-row__main">' +
							'<div class="record-row__title"><span class="record-row__name">' + ui.esc(row.area) + '</span></div>' +
							'<div class="record-row__meta">' +
							'<span>' + n(row.pages, 'page', 'pages') + '</span>' +
							'<span>' + row.reviewed + ' reviewed</span>' +
							'</div>' +
							'</div>' +
							'<div class="record-row__state cell-mono cell-strong">' + row.stale + '</div>' +
							'<div class="record-row__state cell-muted">stale</div>' +
							'</div>'
						);
					}).join('')
				}) +
				ui.group({
					label: 'Recent',
					count: n(data.sqlHistory.length, 'statement', 'statements'),
					actions: ui.button('History', { small: true, kind: 'ghost', open: 'sql/history' }),
					body: history.map(function (entry) {
						return (
							'<div class="record-row' + (entry.state === 'ok' ? '' : ' record-row--static') + '">' +
							ui.toneMark(entry.state === 'ok' ? 'check' : 'error', entry.state === 'ok' ? 'ok' : 'err') +
							'<div class="record-row__main">' +
							'<div class="record-row__title"><span class="record-row__name cell-mono">' + ui.esc(entry.statement) + '</span></div>' +
							'<div class="record-row__meta">' +
							'<span>' + ui.esc(entry.time) + '</span>' +
							'<span>' + (entry.state === 'ok' ? n(entry.rows, 'row', 'rows') + ' · ' + entry.ms + ' ms' : 'refused · the connection is read-only') + '</span>' +
							'</div>' +
							'</div>' +
							'<div class="record-row__state">' + ui.badge(entry.state === 'ok' ? 'Ran' : 'Refused', entry.state === 'ok' ? 'ok' : 'err') + '</div>' +
							'<div class="record-row__state"></div>' +
							'</div>'
						);
					}).join('')
				});

			return ui.view(body);
		}
	};

	M.views['sql/connections'] = {
		title: 'Connections',
		render: function () {
			var live = data.connections.filter(function (connection) { return connection.state === 'Connected'; });
			var idle = data.connections.filter(function (connection) { return connection.state !== 'Connected'; });

			var connectionRow = function (connection) {
				return (
					'<div class="record-row">' +
					ui.toneMark('database', connection.tone) +
					'<div class="record-row__main">' +
					'<div class="record-row__title">' +
					'<span class="record-row__name">' + ui.esc(connection.name) + '</span>' +
					'<span class="tag">' + ui.esc(connection.kind) + '</span>' +
					'</div>' +
					'<div class="record-row__meta">' +
					'<span class="cell-mono">' + ui.esc(connection.host) + '</span>' +
					'<span class="cell-mono">' + ui.esc(connection.database) + '</span>' +
					'<span>' + ui.esc(connection.access) + '</span>' +
					'<span>' + ui.esc(connection.role) + '</span>' +
					'</div>' +
					'</div>' +
					'<div class="record-row__state">' + ui.badge(connection.state, connection.tone) + '</div>' +
					ui.button('Test', { small: true, kind: 'ghost', action: 'test-connection' }) +
					'</div>'
				);
			};

			var body =
				ui.pageHead({
					title: 'Connections',
					icon: 'database',
					desc: 'The documentation registry, and the copies of it other things read. This is not a general SQL client: the studio is pointed at one database because that is the one this window is about.',
					actions: ui.button('New Connection', { kind: 'primary', icon: 'plus', action: 'new-connection' })
				}) +
				ui.group({
					label: 'In Use',
					count: n(live.length, 'connection', 'connections'),
					note: 'The Query Editor runs against the first one. A snapshot is what the last build read, and it is read-only on purpose.',
					body: live.map(connectionRow).join('')
				}) +
				ui.group({
					label: 'Idle',
					count: n(idle.length, 'connection', 'connections'),
					body: idle.map(connectionRow).join('')
				}) +
				'<div class="mt-16">' +
				ui.callout('Passwords live in the operating system\'s credential store, never in a project file, and the registry file itself is never edited from outside the platform — a page is changed by a write, not by an UPDATE.') +
				'</div>';

			return ui.view(body);
		}
	};

	M.views['sql/schema'] = {
		title: 'Schema',
		render: function () {
			var rows = data.sqlTables.reduce(function (sum, table) { return sum + table.rows; }, 0);
			var largest = data.sqlTables.slice().sort(function (a, b) { return b.rows - a.rows; })[0];

			var body =
				ui.pageHead({
					title: 'Schema',
					icon: 'list',
					desc: 'The shape of temco_docs: nine tables, and the columns `pages` is read through. The registry is a database before it is a set of pages.',
					actions: ui.button('Refresh', { icon: 'refresh', action: 'refresh-schema' })
				}) +
				ui.tiles([
					{ value: String(data.sqlTables.length), label: 'Tables' },
					{ value: rows.toLocaleString('en-US'), label: 'Rows' },
					{ value: largest.name, label: 'Largest table' },
					{ value: 'SQLite', label: 'Engine' }
				]) +
				'<div class="grid grid--2 mt-24">' +
				ui.group({
					label: 'Tables',
					count: n(data.sqlTables.length, 'table', 'tables'),
					body: data.sqlTables.map(function (table) {
						return (
							'<div class="record-row record-row--static">' +
							ui.toneMark('list', table.name === 'pages' ? 'accent' : '') +
							'<div class="record-row__main">' +
							'<div class="record-row__title"><span class="record-row__name cell-mono">' + ui.esc(table.name) + '</span></div>' +
							'<div class="record-row__meta"><span>' + table.rows.toLocaleString('en-US') + ' rows</span><span>' + ui.esc(table.note) + '</span></div>' +
							'</div>' +
							'<div class="record-row__state cell-mono cell-muted">' + ui.esc(table.key) + '</div>' +
							'<div class="record-row__state"></div>' +
							'</div>'
						);
					}).join('')
				}) +
				ui.group({
					label: 'pages',
					count: n(data.sqlColumns.length, 'column', 'columns'),
					note: 'Everything on this site is a read through this table.',
					body: data.sqlColumns.map(function (column) {
						return (
							'<div class="record-row record-row--static">' +
							ui.toneMark('code') +
							'<div class="record-row__main">' +
							'<div class="record-row__title">' +
							'<span class="record-row__name cell-mono">' + ui.esc(column.name) + '</span>' +
							'<span class="tag">' + ui.esc(column.type) + '</span>' +
							(column.nullable === 'yes' ? '' : '<span class="cell-muted">not null</span>') +
							'</div>' +
							'<div class="record-row__meta"><span>' + ui.esc(column.note) + '</span></div>' +
							'</div>' +
							'<div class="record-row__state"></div>' +
							'<div class="record-row__state"></div>' +
							'</div>'
						);
					}).join('')
				}) +
				'</div>';

			return ui.view(body);
		}
	};

	M.views['sql/saved'] = {
		title: 'Saved Queries',
		render: function () {
			var body =
				ui.pageHead({
					title: 'Saved Queries',
					icon: 'book',
					desc: 'The questions worth asking more than once, kept with the statement that answers them. Each one is a check the build runs, written out.',
					actions: ui.button('New Query', { kind: 'primary', icon: 'plus', action: 'new-query' })
				}) +
				ui.group({
					label: 'Queries',
					count: n(data.sqlQueries.length, 'query', 'queries'),
					body: data.sqlQueries.map(function (query) {
						return (
							'<div class="record-row">' +
							ui.toneMark('code', query.rows ? 'warn' : 'ok') +
							'<div class="record-row__main">' +
							'<div class="record-row__title"><span class="record-row__name">' + ui.esc(query.name) + '</span></div>' +
							'<div class="record-row__meta">' +
							'<span>' + n(query.rows, 'row', 'rows') + '</span>' +
							'<span class="cell-mono">' + query.ms + ' ms</span>' +
							'<span>ran ' + ui.esc(query.run) + '</span>' +
							'</div>' +
							'</div>' +
							'<div class="record-row__state">' + (query.rows ? ui.badge(String(query.rows) + ' to look at', 'warn') : ui.badge('Clean', 'ok')) + '</div>' +
							ui.button('Run', { small: true, kind: 'ghost', action: 'run-query' }) +
							'</div>'
						);
					}).join('')
				}) +
				'<div class="mt-16">' +
				ui.callout('A saved query is a file under <code>.temco/queries/</code>, so it can be reviewed and diffed like a page. Running one never writes.') +
				'</div>';

			return ui.view(body);
		}
	};

	M.views['sql/history'] = {
		title: 'History',
		render: function () {
			var refused = data.sqlHistory.filter(function (entry) { return entry.state !== 'ok'; }).length;

			var body =
				ui.pageHead({
					title: 'Query History',
					icon: 'clock',
					desc: 'What was run against the registry in this window, in order. It is kept per profile and never synced, because a statement can name a page nobody else should see.',
					actions: ui.button('Clear History', { icon: 'close', action: 'clear-history' })
				}) +
				ui.group({
					label: 'Ran In This Window',
					count: n(data.sqlHistory.length, 'statement', 'statements') + (refused ? ' · ' + n(refused, 'refused', 'refused') : ''),
					note: 'A refused statement is kept too: what the connection would not do is part of the record.',
					body: data.sqlHistory.map(function (entry) {
						var ok = entry.state === 'ok';
						return (
							'<div class="record-row record-row--static">' +
							ui.toneMark(ok ? 'check' : 'error', ok ? 'ok' : 'err') +
							'<div class="record-row__main">' +
							'<div class="record-row__title"><span class="record-row__name cell-mono">' + ui.esc(entry.statement) + '</span></div>' +
							'<div class="record-row__meta">' +
							'<span class="cell-mono">' + ui.esc(entry.time) + '</span>' +
							'<span>' + (ok ? n(entry.rows, 'row', 'rows') + ' · ' + entry.ms + ' ms' : 'refused · read-only connection') + '</span>' +
							'</div>' +
							'</div>' +
							'<div class="record-row__state">' + ui.badge(ok ? 'Ran' : 'Refused', ok ? 'ok' : 'err') + '</div>' +
							(ok ? ui.button('Re-run', { small: true, kind: 'ghost', action: 'run-query' }) : '<span class="cell-muted">—</span>') +
							'</div>'
						);
					}).join('')
				});

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
					desc: 'A report is a query with a shape: the numbers the platform already shows, read from the registry. Running one writes nothing; exporting one writes a file next to the workspace.',
					actions: ui.button('New Report', { kind: 'primary', icon: 'plus', action: 'new-report' })
				}) +
				ui.group({
					label: 'Reports',
					count: n(data.reports.length, 'report', 'reports'),
					body: data.reports.map(function (report) {
						return (
							'<div class="record-row">' +
							ui.toneMark('chart') +
							'<div class="record-row__main">' +
							'<div class="record-row__title"><span class="record-row__name">' + ui.esc(report.name) + '</span></div>' +
							'<div class="record-row__meta"><span>' + ui.esc(report.desc) + '</span><span>updated ' + ui.esc(report.updated) + '</span></div>' +
							'</div>' +
							'<div class="record-row__state"></div>' +
							(report.view
								? ui.button('Open page', { small: true, kind: 'ghost', open: report.view })
								: ui.button('Run', { small: true, kind: 'ghost', action: 'run-report' })) +
							'</div>'
						);
					}).join('')
				}) +
				'<div class="mt-16">' +
				ui.callout('Reports point at the page that owns the number. A report that disagreed with its page would be a second answer to the same question.') +
				'</div>';

			return ui.view(body);
		}
	};
})(window.TemcoMock = window.TemcoMock || { views: {} });
