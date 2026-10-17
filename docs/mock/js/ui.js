/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Temco Controls. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*
 * The vocabulary a view is written in. Every builder returns a string so a view is one readable
 * template; anything that needs behaviour uses a `data-*` attribute that `shell.js` delegates.
 */

(function (M) {
	'use strict';

	var ui = {};

	ui.esc = function (value) {
		return String(value === undefined || value === null ? '' : value).replace(/[&<>"']/g, function (c) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
		});
	};

	ui.icon = function (name, cls) {
		/* The sprite draws in a 24-unit box; without a viewBox the browser uses CSS pixels instead
		   and clips the glyph to the top-left corner of whatever size the class asks for. */
		return '<svg viewBox="0 0 24 24" class="icon ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
	};

	ui.badge = function (text, kind) {
		return '<span class="badge' + (kind && kind !== 'neutral' ? ' badge--' + kind : '') + '">' + ui.esc(text) + '</span>';
	};

	/**
	 * The word a tone becomes when it has to be *read* rather than seen. A tinted mark alone is a
	 * colour, and colour is not a status for anyone who cannot see it.
	 */
	ui.status = function (tone) {
		var words = {
			ok: ['Done', 'ok'],
			warn: ['Attention', 'warn'],
			accent: ['In Progress', 'info'],
			info: ['Info', 'info']
		};
		var pair = words[tone] || ['Note', 'neutral'];
		return ui.badge(pair[0], pair[1]);
	};

	ui.dot = function (kind) {
		return '<span class="dot' + (kind ? ' dot--' + kind : '') + '"></span>';
	};

	/**
	 * A state you can see before you read it: one icon inside a tinted circle. The same mark is used
	 * by the activity feed and by the review queue, so a colour means one thing everywhere.
	 */
	ui.toneMark = function (icon, tone) {
		return '<span class="tone-mark' + (tone ? ' tone-mark--' + tone : '') + '">' + ui.icon(icon, 'icon--sm') + '</span>';
	};

	/**
	 * The rule above a group, on its own: a label, a hairline that fills the row, how many things
	 * the group holds, what you can do to the whole of it, and one sentence saying what it is.
	 *
	 * Sections that do not hold a record list — settings rows, a form, a code block — use this and
	 * put their own content under it; `ui.group` is this rule plus a record list.
	 *
	 * `plain` keeps the label in its own capitalisation instead of the upper-case category style —
	 * use it when the label is a name (a product and its version) rather than a category.
	 */
	ui.rule = function (options) {
		return (
			'<div class="group-head">' +
			'<span class="group-head__label' + (options.plain ? ' group-head__label--plain' : '') + '">' + ui.esc(options.label) + '</span>' +
			'<span class="group-head__rule"></span>' +
			(options.count ? '<span class="group-head__count">' + ui.esc(options.count) + '</span>' : '') +
			(options.actions ? '<span class="group-head__actions">' + options.actions + '</span>' : '') +
			'</div>' +
			(options.note ? '<p class="group-note">' + options.note + '</p>' : '')
		);
	};

	/**
	 * A group inside a page: a rule, and the rows under it.
	 */
	ui.group = function (options) {
		return ui.rule(options) + '<div class="record-list">' + (options.body || '') + '</div>';
	};

	ui.pageHead = function (options) {
		var actions = options.actions || '';
		return (
			'<div class="page-head">' +
			'<div class="page-head__main">' +
			(options.eyebrow ? '<div class="eyebrow">' + ui.esc(options.eyebrow) + '</div>' : '') +
			'<h1 class="page-head__title">' + (options.icon ? ui.icon(options.icon) : '') + ui.esc(options.title) + '</h1>' +
			(options.desc ? '<p class="page-head__desc">' + options.desc + '</p>' : '') +
			'</div>' +
			(actions ? '<div class="page-head__actions">' + actions + '</div>' : '') +
			'</div>'
		);
	};

	ui.button = function (label, options) {
		options = options || {};
		var attrs = '';
		if (options.action) {
			attrs += ' data-action="' + ui.esc(options.action) + '"';
		}
		if (options.open) {
			attrs += ' data-open="' + ui.esc(options.open) + '"';
		}
		if (options.toast) {
			attrs += ' data-toast="' + ui.esc(options.toast) + '"';
		}
		if (options.prompt) {
			attrs += ' data-prompt="' + ui.esc(options.prompt) + '"';
		}
		if (options.title) {
			attrs += ' title="' + ui.esc(options.title) + '"';
		}
		/* Anything the caller needs to say about the button itself — which row it belongs to, for
		   instance — as long as it is already-escaped markup. */
		if (options.attrs) {
			attrs += ' ' + options.attrs;
		}
		var cls = 'btn' + (options.kind ? ' btn--' + options.kind : '') + (options.small ? ' btn--sm' : '');
		return (
			'<button type="button" class="' + cls + '"' + attrs + '>' +
			(options.icon ? ui.icon(options.icon) : '') +
			'<span>' + ui.esc(label) + '</span>' +
			'</button>'
		);
	};

	ui.card = function (options) {
		var body = options.body || '';
		var cls = 'card' + (options.flush ? ' card--flush' : '') + (options.interactive ? ' card--interactive' : '') + (options.cls ? ' ' + options.cls : '');
		var open = options.open ? ' data-open="' + ui.esc(options.open) + '"' : '';
		var head = '';
		if (options.title || options.actions) {
			head =
				'<div class="card__head">' +
				(options.icon ? '<span class="card__icon">' + ui.icon(options.icon) + '</span>' : '') +
				'<div class="card__title">' + ui.esc(options.title || '') + '</div>' +
				(options.actions ? '<div class="card__actions">' + options.actions + '</div>' : '') +
				'</div>';
		}
		return (
			'<div class="' + cls + '"' + open + '>' +
			head +
			(options.desc ? '<p class="card__desc">' + options.desc + '</p>' : '') +
			'<div class="card__body">' + body + '</div>' +
			(options.foot ? '<div class="card__foot">' + options.foot + '</div>' : '') +
			'</div>'
		);
	};

	/**
	 * The one panel per surface that carries a state and a decision. `tone` picks the tint:
	 * accent for something in motion, warn for something blocking, ok for something finished.
	 * Use it once per surface — a second one turns the signal into decoration.
	 */
	ui.hero = function (options) {
		var tone = options.tone || 'accent';
		return (
			'<div class="hero-panel' + (tone !== 'accent' ? ' hero-panel--' + tone : '') + '">' +
			(options.eyebrow ? '<div class="eyebrow">' + ui.esc(options.eyebrow) + '</div>' : '') +
			'<div class="hero-panel__title">' + ui.esc(options.title) + '</div>' +
			(options.desc ? '<p class="hero-panel__desc">' + options.desc + '</p>' : '') +
			(options.actions ? '<div class="hero-panel__actions">' + options.actions + '</div>' : '') +
			'</div>'
		);
	};

	ui.kpis = function (items) {
		return (
			'<div class="grid grid--4">' +
			items.map(function (item) {
				return (
					'<div class="kpi">' +
					'<div class="kpi__label">' + ui.esc(item.label) + '</div>' +
					'<div class="kpi__value">' + ui.esc(item.value) + '</div>' +
					'<div class="kpi__meta">' +
					(item.delta ? '<span class="kpi__delta' + (item.down ? ' kpi__delta--down' : '') + '">' + ui.esc(item.delta) + '</span>' : '') +
					(item.meta ? '<span>' + ui.esc(item.meta) + '</span>' : '') +
					'</div>' +
					'</div>'
				);
			}).join('') +
			'</div>'
		);
	};

	ui.table = function (options) {
		var columns = options.columns;
		var rows = options.rows || [];
		var head = '<tr>' + columns.map(function (column) {
			return '<th' + (column.align ? ' style="text-align:' + column.align + '"' : '') + '>' + ui.esc(column.label) + '</th>';
		}).join('') + '</tr>';

		var body;
		if (!rows.length) {
			body = '<tr><td class="table__empty" colspan="' + columns.length + '">' + ui.esc(options.empty || 'Nothing here yet.') + '</td></tr>';
		} else {
			body = rows.map(function (row, index) {
				var cells = columns.map(function (column) {
					var value = column.render ? column.render(row, index) : ui.esc(row[column.key]);
					return '<td' + (column.cls ? ' class="' + column.cls + '"' : '') + (column.align ? ' style="text-align:' + column.align + '"' : '') + '>' + value + '</td>';
				}).join('');
				/* A row can be a link: `rowAction` returns the attributes that make it one. */
				var attrs = options.rowAction ? options.rowAction(row, index) : '';
				return '<tr' + (row.selected ? ' class="is-selected"' : '') + attrs + '>' + cells + '</tr>';
			}).join('');
		}

		return (
			'<div class="table-wrap' + (options.plain ? ' table-wrap--plain' : '') + '">' +
			'<table class="table' + (options.compact ? ' table--compact' : '') + '">' +
			'<thead>' + head + '</thead>' +
			'<tbody>' + body + '</tbody>' +
			'</table></div>'
		);
	};

	ui.bar = function (pct, kind) {
		return '<span class="bar"><span class="bar__fill' + (kind ? ' bar__fill--' + kind : '') + '" style="width:' + Math.max(0, Math.min(100, pct)) + '%"></span></span>';
	};

	ui.barRow = function (pct, label, kind) {
		return (
			'<div class="bar-row">' +
			ui.bar(pct, kind) +
			'<span class="bar-row__value">' + ui.esc(label !== undefined ? label : pct + '%') + '</span>' +
			'</div>'
		);
	};

	ui.pipeline = function (stages) {
		return (
			'<div class="pipeline">' +
			stages.map(function (stage) {
				return (
					'<button type="button" class="pipeline__stage' + (stage.current ? ' is-current' : '') + '" data-open="' + ui.esc(stage.view) + '">' +
					'<span class="pipeline__n">' + ui.esc(stage.n) + '</span>' +
					'<span class="pipeline__name">' + ui.esc(stage.name) + '</span>' +
					'<span class="pipeline__meta">' + ui.esc(stage.meta) + '</span>' +
					'</button>'
				);
			}).join('') +
			'</div>'
		);
	};

	ui.list = function (items) {
		return (
			'<div class="list">' +
			items.map(function (item) {
				var attrs = '';
				if (item.open) {
					attrs += ' data-open="' + ui.esc(item.open) + '"';
				}
				if (item.action) {
					attrs += ' data-action="' + ui.esc(item.action) + '"';
				}
				return (
					'<div class="list__item"' + attrs + (item.open || item.action ? ' style="cursor:pointer"' : '') + '>' +
					(item.icon ? '<span class="' + (item.tone ? 'cell-strong' : '') + '">' + ui.icon(item.icon) + '</span>' : '') +
					'<div class="list__main">' +
					'<div class="list__title">' + ui.esc(item.title) + '</div>' +
					(item.sub ? '<div class="list__sub">' + item.sub + '</div>' : '') +
					'</div>' +
					(item.meta ? '<div class="list__meta">' + item.meta + '</div>' : '') +
					'</div>'
				);
			}).join('') +
			'</div>'
		);
	};

	ui.callout = function (text, options) {
		options = options || {};
		var kind = options.kind === 'warn' || options.kind === 'ok' ? options.kind : '';
		var icon = options.icon || (kind === 'warn' ? 'alert' : kind === 'ok' ? 'check' : 'info');
		return '<div class="callout' + (kind ? ' callout--' + kind : '') + '">' + ui.icon(icon) + '<div>' + text + '</div></div>';
	};

	ui.empty = function (title, body) {
		return (
			'<div class="empty">' +
			ui.icon('info', 'icon--lg') +
			'<div class="empty__title">' + ui.esc(title) + '</div>' +
			(body ? '<div>' + body + '</div>' : '') +
			'</div>'
		);
	};

	ui.tiles = function (items) {
		return (
			'<div class="tiles">' +
			items.map(function (item) {
				return (
					'<div class="tile">' +
					'<span class="tile__value">' + ui.esc(item.value) + '</span>' +
					'<span class="tile__label">' + ui.esc(item.label) + '</span>' +
					'</div>'
				);
			}).join('') +
			'</div>'
		);
	};

	/**
	 * One setting: what it is, what it does, and the control that holds its value. The description
	 * takes the wide column and the control sits at the right, so a two-line explanation never
	 * squeezes the control into a narrow column.
	 *
	 * `tag` names something the reader needs before changing the value — that it can be overridden
	 * per workspace, or that it waits for a restart.
	 */
	ui.formRow = function (label, desc, control, options) {
		options = options || {};
		return (
			'<div class="form-row">' +
			'<div class="form-row__main">' +
			'<div class="form-row__label">' + ui.esc(label) +
			(options.tag ? '<span class="tag">' + ui.esc(options.tag) + '</span>' : '') +
			'</div>' +
			(desc ? '<div class="form-row__desc">' + ui.esc(desc) + '</div>' : '') +
			'</div>' +
			'<div class="form-row__control">' + control + '</div>' +
			'</div>'
		);
	};

	/**
	 * A choice shown as the value set rather than as a menu that hides it. `name` is what the
	 * platform calls the setting, and is what the click reports back.
	 */
	ui.segmented = function (name, choices, value) {
		return (
			'<div class="segmented" data-setting="' + ui.esc(name) + '">' +
			choices.map(function (choice) {
				return '<button type="button" aria-pressed="' + (choice === value ? 'true' : 'false') + '">' + ui.esc(choice) + '</button>';
			}).join('') +
			'</div>'
		);
	};

	ui.view = function (body, options) {
		options = options || {};
		var cls = options.full ? 'view__inner view__inner--full' : options.wide ? 'view__inner view__inner--wide' : options.narrow ? 'view__inner view__inner--narrow' : 'view__inner';
		return '<div class="view">' + '<div class="' + cls + '">' + body + '</div>' + '</div>';
	};

	/* A `data-open` button rendered like a link, for tables. */
	ui.link = function (label, view) {
		return '<button type="button" class="btn btn--ghost btn--sm" data-open="' + ui.esc(view) + '">' + ui.esc(label) + '</button>';
	};

	M.ui = ui;
})(window.TemcoMock = window.TemcoMock || { views: {} });
