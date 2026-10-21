// What a command argument means.
//
// A command can be run from three places, and only one of them passes what the command would like: the palette
// passes nothing, a view's title bar passes nothing, and a row's menu passes *the row* — a tree item, or an
// object of our own, or an object whose own `command.args` names the thing. So a command that needs a slug reads
// its argument this way, in one place, and every module whose rows pass slugs gets the same answer.
//
// It is deliberately tolerant and deliberately tiny: nothing here decides *which* slug, only where a slug could
// have been written down.

/** The slug a command argument names, whether it is a slug, a row, or a row's own command argument. */
export function rowSlug(target: unknown): string | undefined {
	if (typeof target === 'string') {
		return target.length > 0 ? target : undefined;
	}
	if (target !== null && typeof target === 'object') {
		const direct = (target as { slug?: unknown }).slug;
		if (typeof direct === 'string' && direct.length > 0) {
			return direct;
		}
		// A tree item carries its arguments as `command.arguments`; a page row as `command.args`.
		const command = (target as { command?: { args?: unknown[]; arguments?: unknown[] } }).command;
		const first = command?.args?.[0] ?? command?.arguments?.[0];
		if (typeof first === 'string' && first.length > 0) {
			return first;
		}
	}
	return undefined;
}
