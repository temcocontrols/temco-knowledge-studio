// What the last publish said, kept in the window that ran it.
//
// A push that does something surprising — a rejection, a branch that moved, a commit with no changes — explains itself in
// the lines git printed, and those lines otherwise scroll past in the output channel. The page keeps them, bounded, so a
// person can read the last attempt where the decision to publish again is made.

/** The most lines a window keeps: enough for one publish, not enough to grow without bound. */
const KEPT = 400;

export class PublishLog {
	private readonly lines: string[] = [];
	private at: string | undefined;

	/** Record one line a publish printed. */
	append(line: string): void {
		this.lines.push(line);
		this.at = new Date().toISOString();
		if (this.lines.length > KEPT) {
			this.lines.splice(0, this.lines.length - KEPT);
		}
	}

	/** The lines, and when the newest one was written. */
	read(): { lines: readonly string[]; at: string | undefined } {
		return { lines: [...this.lines], at: this.at };
	}
}
