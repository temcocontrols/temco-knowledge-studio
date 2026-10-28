// The UI module's entry point.
//
// It is the application's shared UI conventions, and it has no surface of its own: no command, no view, no
// setting — only the rules that every module's pages and rows depend on, published so that each of them is
// decided once instead of once per module: where a page opens, what a command argument means, what a page looks
// like (`media/page.css`), the components a page is built from, and how a page runs a command (a message, never a link).

import * as vscode from 'vscode';
import { fileColumn, pageColumn } from './columns';
import { CalloutOptions, CodeOptions, EntryRowOptions, FeatureCard, HeroOptions, NumberItem, OptionCard, Question, SectionOptions, callout, cards, code, entryRow, floatAction, hero, icon, numbers, optionCards, questions, section, toneMark } from './components';
import { COMMAND_SCRIPT, PageMessage, PageOptions, escapeHtml, page, runPageCommand } from './page';
import { rowSlug } from './rows';

/** What this module offers the rest of the platform. */
export interface TemcoUiApi {
	/** The editor column every page of ours opens in. */
	pageColumn(): vscode.ViewColumn;
	/** The editor column for something that is not a page of ours. */
	fileColumn(): vscode.ViewColumn;
	/** The slug a command argument names, whether it is a slug, a row, or a row's own command argument. */
	rowSlug(target: unknown): string | undefined;
	/** A document around `body`, carrying the shared page vocabulary. */
	page(body: string, options?: PageOptions): string;
	/** Text that came from anywhere but this module, escaped for a page. */
	escapeHtml(text: string): string;
	/** One glyph from the page's sprite. */
	icon(name: string, cls?: string): string;
	/** One glyph in a tinted circle: a state you can see before you read it. */
	toneMark(name: string, tone?: 'ok' | 'warn' | 'err' | 'info' | 'accent'): string;
	/** The title block: a brand-tinted wash, the breadcrumb, the page's only h1, the field and the ways in. */
	hero(options: HeroOptions): string;
	/** The row of figures under a title. */
	numbers(items: readonly NumberItem[]): string;
	/** Three options side by side, each ending in a button. */
	optionCards(items: readonly OptionCard[]): string;
	/** The one tinted callout a page is allowed. */
	callout(options: CalloutOptions): string;
	/** The questions at the bottom of a page. */
	questions(items: readonly Question[]): string;
	/** A section heading: the `h2` a page's parts are told apart by. */
	section(options: SectionOptions): string;
	/** A row of cards that are ways in. */
	cards(items: readonly FeatureCard[], options?: { dense?: boolean }): string;
	/** One entry lying on its side: the mark, the thing itself, and the way in at its right-hand end. */
	entryRow(options: EntryRowOptions): string;
	/** A code card, with drawn line numbers and four tones of syntax. */
	code(options: CodeOptions): string;
	/** The floating action in the corner of the page. */
	floatAction(options: { label: string; command: string; mark?: string }): string;
	/** The script a page runs to post `data-command` clicks back to its module. */
	commandScript: string;
	/** Runs one of those messages. The module's `onDidReceiveMessage` calls this. */
	runCommand(message: PageMessage): void;
}

export function activate(context: vscode.ExtensionContext): TemcoUiApi {
	return {
		pageColumn,
		fileColumn,
		rowSlug,
		page: (body, options) => page(context, body, options),
		escapeHtml,
		icon,
		toneMark,
		hero,
		numbers,
		optionCards,
		callout,
		questions,
		section,
		cards,
		entryRow,
		code,
		floatAction,
		commandScript: COMMAND_SCRIPT,
		runCommand: runPageCommand
	};
}

export function deactivate(): void {
	// Nothing to unwind: this module owns pure rules, one stylesheet and no state.
}
