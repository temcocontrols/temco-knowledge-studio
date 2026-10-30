// What the page is told, and what it says back.
//
// The page never reads a setting: the extension host reads the configuration and posts one state, and every control
// writes a key and waits for the next state. A page that made up a value would be a form whose checkboxes spring back.

export type ThemeChoice = 'System' | 'Dark' | 'Light';
export type ChannelChoice = 'Stable' | 'Preview';

/** Everything the General page draws, in one object. */
export interface GeneralState {
	theme: ThemeChoice;
	start: string;
	breadcrumbs: boolean;
	telemetry: boolean;
	workingFolder: string;
	channel: ChannelChoice;
	/** When the register was last written, as a sentence. */
	lastChanged: string;
	/** How many rows write a real editor setting, out of how many there are. Honest, rather than a sentence to trust. */
	realSettings: number;
	totalSettings: number;
}

/** The startup views the manifest declares, in the order a person meets them. */
export const START_OPTIONS: { value: string; label: string }[] = [
	{ value: 'welcome', label: 'Welcome' },
	{ value: 'project', label: 'The project' },
	{ value: 'page', label: 'The last page' },
	{ value: 'home', label: 'Overview' },
	{ value: 'none', label: 'Nothing' }
];

/** What this page asks the host to do. Narrow on purpose: three kinds of message and no fourth. */
export type Ask =
	| { type: 'ready' }
	| { type: 'setting'; key: string; value: unknown }
	| { type: 'pick-folder' }
	| { type: 'command'; command: string };
