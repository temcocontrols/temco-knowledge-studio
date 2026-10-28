// The shared components render what they claim, escape what people type, and are styled by rules that exist.
//
// Failures this catches, all of which look fine on screen until they do not:
//
//   * **a class no rule draws.** `az-option__tick` spelled `az-option__ticks` in the component renders as plain text:
//     no error, no console message, just a card that quietly lost its check marks. `media/page.css` is the only place
//     these names exist, so the two are compared here.
//   * **an interpolation that is not escaped.** Every value a page shows can come from a folder, a model or a person.
//   * **a code card that edits the sample.** Line numbers and colour are drawn, never written into the text: the gate
//     parses the rendered card back into plain text and compares it with the source lines.
//   * **the design drifting.** One wash, no other gradient, the brand colour, and surfaces taken from the theme — the
//     four rules the page language is built on.
//
// Run by `npm run check-temco` from the repository root, and by `npm run check-components` in this module.

import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, '');
const css = readFileSync(join(root, 'media', 'page.css'), 'utf8');

/**
 * The components, imported as the ES module they are written as.
 *
 * The module loads by copying it somewhere `"type": "module"` holds: this package is CommonJS for the extension host,
 * so a bare import of `src/components.ts` would be compiled as CommonJS and fail on its own `export` keywords.
 */
const staging = mkdtempSync(join(tmpdir(), 'temco-ui-components-'));
let components: typeof import('../src/components.ts');
try {
	writeFileSync(join(staging, 'package.json'), '{ "type": "module" }', 'utf8');
	copyFileSync(join(root, 'src', 'components.ts'), join(staging, 'components.ts'));
	components = await import(pathToFileURL(join(staging, 'components.ts')).href);
} finally {
	rmSync(staging, { recursive: true, force: true });
}

const { actionBar, callout, cards, checkCards, choiceCards, code, entryRow, escapeHtml, floatAction, formFields, hero, numbers, optionCards, questions, section } = components;

const failures: string[] = [];
const check = (condition: boolean, message: string): void => {
	if (!condition) {
		failures.push(message);
	}
};

/** Every `class="…"` token a rendered fragment asks for, in order, once each. */
function classesIn(html: string): string[] {
	const found = new Set<string>();
	for (const match of html.matchAll(/class="([^"]+)"/g)) {
		for (const token of match[1].split(/\s+/)) {
			if (token.length > 0) {
				found.add(token);
			}
		}
	}
	return [...found];
}

const dangerous = '<script>alert(1)</script> & "quoted"';

const rendered = [
	hero({
		crumbs: dangerous,
		title: dangerous,
		mark: 'dashboard',
		desc: dangerous,
		stats: [{ value: dangerous, label: dangerous }],
		search: { label: dangerous, command: dangerous, hint: dangerous },
		actions: [
			{ label: dangerous, command: dangerous, mark: 'plus', kind: 'primary' },
			{ label: 'A link', command: 'a.b', kind: 'link' }
		],
		hero: true
	}),
	numbers([{ value: dangerous, label: dangerous }]),
	optionCards([{
		title: dangerous,
		desc: dangerous,
		tag: dangerous,
		mark: 'plus',
		ticks: [dangerous, dangerous],
		label: dangerous,
		command: dangerous,
		pick: true
	}]),
	callout({ title: dangerous, desc: dangerous, actions: '<button class="btn">kept</button>' }),
	questions([{ ask: dangerous, answer: dangerous }]),
	section({ title: dangerous, desc: dangerous, actions: '<button class="btn">kept</button>' }),
	cards([{ mark: 'plus', title: dangerous, desc: dangerous, command: dangerous, go: dangerous }]),
	cards([{ title: dangerous, desc: dangerous, command: dangerous }], { dense: true }),
	cards([{ title: dangerous, desc: dangerous, note: dangerous, progress: 0.4, command: dangerous }]),
	entryRow({ mark: 'plus', title: dangerous, meta: dangerous, command: dangerous, go: dangerous }),
	choiceCards({ items: [{ value: dangerous, title: dangerous, desc: dangerous, mark: 'plus', tag: dangerous }], selected: dangerous }),
	formFields([{ label: dangerous, control: '<input class="az-input" value="kept">', hint: dangerous }]),
	checkCards({ field: 'targets', items: [{ value: dangerous, label: dangerous, note: dangerous, mark: 'plus' }], ticked: [dangerous] }),
	actionBar({ summary: dangerous, summaryId: 'foot-summary', actions: '<button class="az-btn">kept</button>' }),
	code({ language: dangerous, lines: [{ text: dangerous }] }),
	floatAction({ label: dangerous, command: dangerous, mark: 'sparkle' })
].join('\n');

// Escaping: nothing a person typed may reach the document as markup.
check(!rendered.includes('<script>'), 'every component must escape a value containing <script>');
check(rendered.includes('&lt;script&gt;'), 'an escaped value must appear as &lt;script&gt;');
check(!rendered.includes('alert(1)"'), 'a quote in a value must not close an attribute early');
check(rendered.includes('&amp;'), 'an ampersand must be escaped');
check(escapeHtml('<a href="x">&</a>') === '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;', 'escapeHtml must escape < > & and "');

// The title block: a wash, a breadcrumb, one h1 in the size asked for, the field, and the two kinds of button.
const lead = hero({
	crumbs: 'A › B',
	title: 'Documentation',
	desc: 'why',
	search: { label: 'Find a page', command: 'workbench.action.quickOpen', hint: 'Ctrl P' },
	actions: [{ label: 'Go', command: 'c.d', kind: 'primary' }],
	hero: true
});
check(lead.startsWith('<div class="az-wash">'), 'the title block must sit on the wash');
check(lead.includes('<h1 class="az-title az-title--hero">Documentation</h1>'), 'the front page must use the 40/52 title');
check(hero({ title: 'T' }).includes('<h1 class="az-title">T</h1>'), 'another page must use the 32/40 title');
check(hero({ title: 'T', mark: 'dashboard' }).includes('class="az-title__mark"'), 'a title with a mark must draw the chip');
check(hero({ title: 'T', eyebrow: 'Project' }).includes('class="az-crumbs az-crumbs--eyebrow"'), 'an eyebrow must be drawn as one');
check(hero({ title: 'T', panel: true }).includes('class="az-wash az-wash--panel"'), 'a panel must be the wash, inset');
check(hero({ title: 'T', stats: [{ value: '3', label: 'projects' }] }).includes('class="az-lead__stats"'), 'a panel must be able to carry its own figures');
check(!hero({ title: 'T' }).includes('az-lead__stats'), 'a panel with no figures must not leave an empty foot');
check(lead.includes('class="az-crumbs"'), 'a breadcrumb must be drawn above the title');
check(lead.includes('class="az-field"'), 'a search must render the field');
check(lead.includes('data-command="workbench.action.quickOpen"'), 'the field must open the command it names');
check(lead.includes('class="az-field__hint"'), 'the field must show the keybinding it opens');
check(lead.includes('class="az-btn az-btn--primary"'), 'a primary action must be the brand-filled button');
check(hero({ title: 'T', actions: [{ label: 'x', command: 'y', kind: 'link' }] }).includes('az-btn--link'), 'a link action must be a word, not a box');

// A hero with nothing to say renders nothing: an omitted option leaves no empty element behind.
const bare = hero({ title: 'Only a title' });
for (const part of ['az-crumbs', 'az-intro', 'az-field', 'az-row']) {
	check(!bare.includes(part), `a hero without that option must not render ${part}`);
}

// The three option cards: equal parts, ticks, one button each, and the picked one marked.
const options = optionCards([
	{ title: 'A', desc: 'a', ticks: ['t'], label: 'Go', command: 'x.a' },
	{ title: 'B', desc: 'b', ticks: ['t'], label: 'Go', command: 'x.b', pick: true, tag: 'Recommended' }
]);
check((options.match(/class="az-option"/g) ?? []).length === 1, 'a card without pick must be plain');
check(options.includes('class="az-option az-option--pick"'), 'the picked card must be marked');
check(options.includes('class="az-option__tag"'), 'the picked card must be able to carry a tag');
check((options.match(/az-option__tick/g) ?? []).length === 4, 'every tick of every card must be drawn');
check((options.match(/class="az-option__actions"/g) ?? []).length === 2, 'every card ends in an action row');
check(options.includes('class="az-btn az-btn--primary"'), 'the picked card\'s button must be the filled one');
check(!options.includes('alert(1)'), 'option text must be escaped');

// A card that counts its steps: the note and the bar are drawn only when the page can attest to them.
const guided = cards([{ title: 'T', desc: 'd', note: '2 of 5 steps', progress: 0.4 }]);
check(guided.includes('class="az-card__note"'), 'a card with a note must draw it');
check(guided.includes('class="az-card__bar"') && guided.includes('width:40%'), 'a card with progress must draw the share it was given');
check(!cards([{ title: 'T', desc: 'd' }]).includes('az-card__bar'), 'a card without progress must not draw a bar');
check(cards([{ mark: 'plus', title: 'T', desc: 'd' }]).includes('class="az-card__head"'), 'a card must put its mark and its title on one line');

// An entry lies on its side: the mark, the thing, and the way in at its right-hand end.
const entry = entryRow({ mark: 'plus', title: 'T', meta: 'm', command: 'c.d' });
check(entry.includes('class="az-entry__icon"') && entry.includes('class="az-entry__go"'), 'an entry must draw its mark and its way in');
check(!entryRow({ title: 'T' }).includes('az-entry__go'), 'an entry with no command must not draw a way in');

// A choice is a card that states which of them is on, and carries the value the page posts.
const choiceHtml = choiceCards({
	items: [{ value: 'a', title: 'A', desc: 'a' }, { value: 'b', title: 'B', desc: 'b' }],
	selected: 'b'
});
check((choiceHtml.match(/"az-choice is-on"/g) ?? []).length === 1, 'only the chosen choice may be drawn as on');
check(choiceHtml.includes('data-type="b"') && choiceHtml.includes('aria-selected="true"'), 'a choice must carry its value and its state');
check(choiceCards({ items: [{ value: 'a', title: 'A', desc: 'a' }], attribute: 'data-kind' }).includes('data-kind="a"'), 'a choice must be able to name the attribute it writes its value in');

// A form row is a label, the control it was given, and the hint under it; a wide one spans both columns.
const formHtml = formFields([
	{ label: 'Name', control: '<input class="az-input">', hint: 'a note' },
	{ label: 'Wide', control: '<select></select>', wide: true }
]);
check((formHtml.match(/class="az-form__field"/g) ?? []).length === 1, 'a field must be one column unless it says otherwise');
check(formHtml.includes('class="az-form__field az-form__field--wide"'), 'a wide field must span the row');

// A tick card opens on the ticks it was given, and posts its own field.
const checksHtml = checkCards({ field: 'targets', items: [{ value: 'web', label: 'Web', note: 'the site' }], ticked: ['web'] });
check(checksHtml.includes('data-field="targets"') && checksHtml.includes('checked'), 'a tick card must post its field and open ticked');
check(!checkCards({ field: 'targets', items: [{ value: 'web', label: 'Web', note: 'the site' }] }).includes('checked'), 'an unticked card must not open ticked');

// The foot of a form names the line the page writes, and holds the buttons it was given.
const footHtml = actionBar({ summaryId: 'foot-summary', actions: '<button class="az-btn">ok</button>' });
check(footHtml.includes('id="foot-summary"') && footHtml.includes('class="az-actions__buttons"'), 'the foot must name its summary and hold its buttons');

// The number row and the callout.
check(numbers([{ value: '1', label: 'l' }]).includes('class="az-number__value"'), 'a figure must render its value');
check(callout({ title: 'T', desc: 'd' }).includes('az-callout__icon'), 'a callout must carry an icon');
check(!callout({ title: 'T', desc: 'd' }).includes('az-callout__actions'), 'a callout with no action must not render an empty row');

// The questions: rows that open, with the answer escaped.
const asked = questions([{ ask: 'Why?', answer: '<b>because</b>' }]);
check(asked.includes('<details class="az-q">'), 'a question must be a row that opens, not a dialog');
check(asked.includes('&lt;b&gt;because&lt;/b&gt;'), 'an answer must be escaped');

// The code card: numbers drawn, sample intact, colour only on the ranges asked for.
const source = ['const x = 1;', '', "y = 'z';"];
const sample = code({
	language: 'TypeScript',
	lines: [
		{ text: source[0], tokens: [[0, 5, 'keyword']] },
		{ text: source[1] },
		{ text: source[2], tokens: [[4, 7, 'string']] }
	]
});
check(sample.includes('class="az-code__n">1<'), 'the first line must be numbered 1');
check(sample.includes('class="az-code__n">3<'), 'the third line must be numbered 3');
check(sample.includes('TypeScript'), 'the bar must name the language');
check(sample.includes('<span class="tok-keyword">const</span>'), 'a token range must be coloured with the tone asked for');
check(sample.includes(`<span class="tok-string">'z'</span>`), 'a string token must be coloured with the tone asked for');

/** What a person gets if they copy the sample out of the card. */
const copied = [...sample.matchAll(/class="az-code__line"><span class="az-code__n">\d+<\/span><span>(.*?)<\/span><\/span>/g)]
	.map((match) => match[1]
		.replace(/<[^>]+>/g, '')
		.replace(/&quot;/g, '"')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&'));
check(JSON.stringify(copied) === JSON.stringify(source), `the lines must read back as the sample, copy included: ${JSON.stringify(copied)}`);

// Every class the components emit is drawn by a rule in the stylesheet.
const missing = [...new Set(rendered.split('\n').flatMap(classesIn))]
	.filter((token) => token.startsWith('az-') || token.startsWith('btn') || token.startsWith('tok-'))
	.filter((token) => !new RegExp(`\\.${token}(?![\\w-])`).test(css));
check(missing.length === 0, `these classes are rendered but no rule in media/page.css draws them: ${missing.join(', ')}`);

// The page language: the Azure portal's palette and the portal's type scale, and the four rules.
const layer = css.slice(css.indexOf("the Azure portal's page language"));
check(/--az-blue:\s*#0078d4/i.test(css), 'the brand must be the portal blue #0078d4');
check(/--az-blue-hover:\s*#106ebe/i.test(css), 'the hover must be the portal hover #106ebe');
check(/--az-blue-selected:\s*#e1f3ff/i.test(css), 'the selected tint must be the portal #e1f3ff');
check(/--ink-1:\s*#1f2327/i.test(css), 'the text must be the portal ink #1f2327, never pure black');
check(/--surface-page:\s*#faf9f8/i.test(css), 'the page must be the portal #faf9f8');
check(/--hairline:\s*#edebe9/i.test(css), 'the hairline must be the portal #edebe9');
check(/\.az-title--hero\s*\{[^}]*font-size:\s*26px/.test(css), 'the front-page title must be 26px, the portal scale');
check(/\.az-title\s*\{[^}]*font-size:\s*24px/.test(css), 'every other title must be 24px');
check(/\.az-section__title\s*\{[^}]*font-size:\s*16px/.test(css), 'a section title must be 16px');
check(/\.az-option__title\s*\{[^}]*font-size:\s*14px/.test(css), 'an option title must be 14px');
check(/\.az-intro\s*\{[^}]*font-size:\s*13px/.test(css), 'the intro line must be 13px');
check(/\.az-option__desc\s*\{[^}]*font-size:\s*13px/.test(css), 'body copy must be 13px');

// Exactly one wash, and no other gradient anywhere in the layer. It is named once, so the band and the inset panel
// cannot drift into two different washes.
const gradients = [...layer.matchAll(/(linear|radial|conic)-gradient/g)].map((match) => match[1]);
check(gradients.length === 1 && gradients[0] === 'linear', `the layer may paint exactly one gradient (the wash); found: ${gradients.join(', ') || 'none'}`);
check(/--az-wash-gradient:\s*linear-gradient\(180deg, var\(--az-wash\) 0%, transparent 100%\)/.test(css), 'the one gradient must be the wash, the portal tint to transparent');
check(/\.az-wash\s*\{[^}]*background:\s*var\(--az-wash-gradient\)/.test(css), 'the band must paint that one gradient');

// The theme owns surfaces and text; the portal owns the brand and the scale.
for (const [rule, background, reason] of [
	['.az-option', 'var\\(--surface-card\\)', 'an option card'],
	['.az-numbers', 'var\\(--surface-card\\)', 'the number row'],
	['.az-card', 'var\\(--surface-card\\)', 'a card'],
	['.az-callout', 'var\\(--az-blue-selected\\)', 'the callout']
] as [string, string, string][]) {
	const pattern = new RegExp(`${rule.replace('.', '\\.')}\\s*\\{[^}]*background:\\s*${background}`);
	check(pattern.test(css), `${reason} must take its background from the theme tokens`);
}
check(/\.az-btn--primary\s*\{[^}]*background:\s*var\(--az-blue\)/.test(css), 'the filled button must be the portal blue');
check(/\.az-btn\s*\{[^}]*font-size:\s*12px[^}]*font-weight:\s*400/.test(css), 'a button must be 12px and un-bolded');
check(/\.az-btn\s*\{[^}]*height:\s*28px/.test(css), 'a button must be 28px high');

if (failures.length > 0) {
	console.error(`The shared components and the stylesheet disagree:\n${failures.map((failure) => `  - ${failure}`).join('\n')}`);
	process.exit(1);
}

console.log(`14 components, ${[...new Set(rendered.split('\n').flatMap(classesIn))].length} classes drawn, one wash, sample copies back intact.`);
