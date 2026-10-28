// The shared page components: a title block, three option cards, a number row, one callout, a section, cards, a code
// sample, the questions at the bottom, and the floating action.
//
// Why these are components and not strings each module writes: a front page is the first thing a person sees of the
// application, and every one of these appears on more than one page. Three copies of a callout drift apart in a week —
// a different radius, a different button order, one of them forgetting the icon. So the markup is decided here, once,
// and the rules it depends on live in `media/page.css` under the same `az-*` names, which
// `scripts/check-components.mts` holds the two to.
//
// The look is Fluent 2's numbers with Azure's brand: a 40/52 title over a brand-tinted wash, three option cards of equal
// height each ending in a button, a number row, one tinted callout, and the questions underneath. Nothing here imports
// `vscode`, and nothing here imports another file: a component a plain node script cannot import is a component nothing
// can check.

/** Text from the workspace, a model or a person: everything interpolated into a page goes through this. */
export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/** One glyph from the page's sprite, at the size the class asks for. */
export function icon(name: string, cls?: string): string {
	return `<svg viewBox="0 0 24 24" class="icon${cls ? ` ${cls}` : ''}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}

/** A state you can see before you read it: one icon inside a tinted circle. */
export function toneMark(name: string, tone?: 'ok' | 'warn' | 'err' | 'info' | 'accent'): string {
	return `<span class="tone-mark${tone ? ` tone-mark--${tone}` : ''}">${icon(name, 'icon--sm')}</span>`;
}

/** One act the title block offers. `primary` is the brand-filled button; `link` is a word, not a box. */
export interface HeroAction {
	label: string;
	command: string;
	args?: unknown;
	mark?: string;
	kind?: 'primary' | 'link';
}

/**
 * The field under the title.
 *
 * It is a button, not an `<input>`: a page may run a command and may not search the workbench itself, and a text box
 * that silently did nothing would be worse than one that says what it does.
 */
export interface HeroSearch {
	label: string;
	command: string;
	/** The keybinding, shown on the right of the field. */
	hint?: string;
}

export interface HeroOptions {
	/** `Temco Platform › Documentation`, above the title. */
	crumbs?: string;
	/** A line above the title, when there is no breadcrumb. */
	eyebrow?: string;
	title: string;
	desc?: string;
	/**
	 * The description takes the full width instead of a reading measure.
	 *
	 * A page's introduction is normally held at 78 characters, which is what a paragraph that is read wants. A front
	 * page's introduction is a summary rather than prose, so it runs the width of the column it sits in.
	 */
	descWide?: boolean;
	search?: HeroSearch;
	actions?: readonly HeroAction[];
	/** The front page's title is 40/52; every other page's is 32/40. */
	hero?: boolean;
}

/** Buttons, rendered the one way this application renders them. */
function buttons(actions: readonly HeroAction[]): string {
	return actions.map(action => {
		const cls = `az-btn${action.kind === 'primary' ? ' az-btn--primary' : action.kind === 'link' ? ' az-btn--link' : ''}`;
		const args = action.args === undefined ? '' : ` data-args="${escapeHtml(JSON.stringify(action.args))}"`;
		const mark = action.mark === undefined ? '' : icon(action.mark);
		return `<button type="button" class="${cls}" data-command="${escapeHtml(action.command)}"${args}>${mark}<span>${escapeHtml(action.label)}</span></button>`;
	}).join('');
}

/**
 * The title block: a brand-tinted wash, the breadcrumb, the page's only `h1`, one line of why, the field and the ways in.
 *
 * The wash is the single piece of decoration on a page — `.az-wash` fades the brand tint into the page rather than
 * painting a band across it, which is what the Azure purchase-options page does and what a saturated hero does not.
 */
export function hero(options: HeroOptions): string {
	const crumbs = options.crumbs !== undefined
		? `<p class="az-crumbs">${escapeHtml(options.crumbs)}</p>`
		: options.eyebrow === undefined ? '' : `<p class="az-crumbs">${escapeHtml(options.eyebrow)}</p>`;
	const desc = options.desc === undefined ? '' : `<p class="az-intro${options.descWide === true ? ' az-intro--wide' : ''}">${escapeHtml(options.desc)}</p>`;
	const search = options.search === undefined
		? ''
		: `<button type="button" class="az-field" data-command="${escapeHtml(options.search.command)}" title="${escapeHtml(options.search.label)}">${icon('search')}<span class="az-field__label">${escapeHtml(options.search.label)}</span>${options.search.hint === undefined ? '' : `<kbd class="az-field__hint">${escapeHtml(options.search.hint)}</kbd>`}</button>`;
	const actions = options.actions === undefined || options.actions.length === 0 ? '' : buttons(options.actions);
	const row = search === '' && actions === '' ? '' : `<div class="az-row">${search}${actions}</div>`;
	const size = options.hero === true ? ' az-title--hero' : '';
	return `<div class="az-wash"><header class="az-lead">${crumbs}<h1 class="az-title${size}">${escapeHtml(options.title)}</h1>${desc}${row}</header></div>`;
}

/** One figure in the number row. */
export interface NumberItem {
	value: string;
	label: string;
}

/** The row of figures: what this page is about, in numbers, in one box. */
export function numbers(items: readonly NumberItem[]): string {
	return `<div class="az-numbers">${items.map(item => `<div class="az-number"><p class="az-number__value">${escapeHtml(item.value)}</p><p class="az-number__label">${escapeHtml(item.label)}</p></div>`).join('')}</div>`;
}

/** One option card: an icon, a name, what it is for, three ticks, and the button that starts it. */
export interface OptionCard {
	title: string;
	desc: string;
	/** The small brand label above the title, e.g. `Recommended`. */
	tag?: string;
	mark?: string;
	ticks: readonly string[];
	/** The words on the button. */
	label: string;
	command: string;
	args?: unknown;
	/** Drawn on the brand tint with a brand stroke. One card, never two. */
	pick?: boolean;
}

/** Three options side by side — the shape the front page is built on. */
export function optionCards(items: readonly OptionCard[]): string {
	return `<div class="az-options">${items.map(item => {
		const args = item.args === undefined ? '' : ` data-args="${escapeHtml(JSON.stringify(item.args))}"`;
		const iconHtml = item.mark === undefined ? '' : `<span class="az-option__icon">${icon(item.mark)}</span>`;
		const tag = item.tag === undefined ? '' : `<span class="az-option__tag">${escapeHtml(item.tag)}</span>`;
		const ticks = item.ticks.map(tick => `<li class="az-option__tick">${icon('check')}<span>${escapeHtml(tick)}</span></li>`).join('');
		const cls = item.pick === true ? ' az-btn--primary' : '';
		return `<section class="az-option${item.pick === true ? ' az-option--pick' : ''}"><div class="az-option__top">${iconHtml}<div>${tag}<h2 class="az-option__title">${escapeHtml(item.title)}</h2></div></div><p class="az-option__desc">${escapeHtml(item.desc)}</p><ul class="az-option__ticks">${ticks}</ul><div class="az-option__actions"><button type="button" class="az-btn${cls}" data-command="${escapeHtml(item.command)}"${args}><span>${escapeHtml(item.label)}</span></button></div></section>`;
	}).join('')}</div>`;
}

/** The one tinted callout a page is allowed: an icon, a sentence, and the thing to do about it. */
export interface CalloutOptions {
	title: string;
	desc: string;
	mark?: string;
	/** Pre-rendered buttons. */
	actions?: string;
}

export function callout(options: CalloutOptions): string {
	const mark = options.mark === undefined ? 'info' : options.mark;
	return `<aside class="az-callout"><div class="az-callout__main"><span class="az-callout__icon">${icon(mark)}</span><div><p class="az-callout__title">${escapeHtml(options.title)}</p><p class="az-callout__desc">${escapeHtml(options.desc)}</p></div></div>${options.actions === undefined ? '' : `<div class="az-callout__actions">${options.actions}</div>`}</aside>`;
}

export interface SectionOptions {
	title: string;
	desc?: string;
	/** Pre-rendered buttons or links, drawn at the right-hand end of the heading. */
	actions?: string;
}

/** A section heading: the `h2` a page's parts are told apart by. */
export function section(options: SectionOptions): string {
	return `<div class="az-section"><div class="az-section__text"><h2 class="az-section__title">${escapeHtml(options.title)}</h2>${options.desc === undefined ? '' : `<p class="az-section__desc">${escapeHtml(options.desc)}</p>`}</div>${options.actions === undefined ? '' : `<div class="az-section__actions">${options.actions}</div>`}</div>`;
}

/** One card in a row of cards: an icon, a name, why it is worth opening, and the way in. */
export interface FeatureCard {
	title: string;
	desc: string;
	mark?: string;
	command?: string;
	args?: unknown;
	/** The words on the way in, when the card is one. */
	go?: string;
}

/** A row of cards that are ways in. A card without a command is drawn as a plain card, not as a dead button. */
export function cards(items: readonly FeatureCard[], options: { dense?: boolean } = {}): string {
	return `<div class="az-cards${options.dense === true ? ' az-cards--dense' : ''}">${items.map(item => {
		const plain = item.command === undefined;
		const args = item.args === undefined ? '' : ` data-args="${escapeHtml(JSON.stringify(item.args))}"`;
		const attr = plain ? '' : ` data-command="${escapeHtml(item.command as string)}"${args}`;
		return `<div class="az-card${plain ? '' : ' az-card--action'}"${attr}>${item.mark === undefined ? '' : `<span class="az-card__icon">${icon(item.mark)}</span>`}<div class="az-card__title">${escapeHtml(item.title)}</div><p class="az-card__desc">${escapeHtml(item.desc)}</p>${plain ? '' : `<span class="az-card__go">${escapeHtml(item.go ?? 'Open')}${icon('chevron-right', 'icon--sm')}</span>`}</div>`;
	}).join('')}</div>`;
}

/** One line of a code card, and the tone the tokens on it are drawn in. */
export interface CodeLine {
	text: string;
	/** Where to colour something: `[start, end, tone]`, in the line's own characters. */
	tokens?: readonly [number, number, 'keyword' | 'string' | 'name' | 'comment'][];
}

export interface CodeOptions {
	/** The language named in the bar, e.g. `TypeScript`. */
	language: string;
	lines: readonly CodeLine[];
}

/**
 * A code card: the sample a developer came for.
 *
 * The line numbers are drawn, not written into the text, so copying the sample copies the sample. Every line is
 * escaped; colour comes from `tokens`, which is what keeps this component free of a highlighter.
 */
export function code(options: CodeOptions): string {
	const rows = options.lines.map((line, index) => {
		let html = '';
		let at = 0;
		for (const [start, end, tone] of line.tokens ?? []) {
			html += escapeHtml(line.text.slice(at, start));
			html += `<span class="tok-${tone}">${escapeHtml(line.text.slice(start, end))}</span>`;
			at = end;
		}
		html += escapeHtml(line.text.slice(at));
		return `<span class="az-code__line"><span class="az-code__n">${index + 1}</span><span>${html}</span></span>`;
	}).join('');
	return `<div class="az-code"><div class="az-code__bar"><span>${escapeHtml(options.language)}</span><span class="az-code__language">${icon('code', 'icon--sm')}</span></div><pre class="az-code__body">${rows}</pre></div>`;
}

/** One question and its answer, closed until asked. */
export interface Question {
	ask: string;
	answer: string;
}

/** The questions at the bottom of a page: rows that open, not a dialog. */
export function questions(items: readonly Question[]): string {
	const rows = items.map(item => `<details class="az-q"><summary class="az-q__ask">${icon('chevron-right', 'icon--sm')}<span>${escapeHtml(item.ask)}</span></summary><p class="az-q__answer">${escapeHtml(item.answer)}</p></details>`).join('');
	return `<div class="az-questions">${rows}</div>`;
}

/** The way to the AI, fixed where a reader's hand already is. */
export function floatAction(options: { label: string; command: string; mark?: string }): string {
	return `<button type="button" class="az-float" data-command="${escapeHtml(options.command)}">${options.mark === undefined ? '' : icon(options.mark)}<span>${escapeHtml(options.label)}</span></button>`;
}
