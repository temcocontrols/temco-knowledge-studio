// The register behind the Settings pages.
//
// Two kinds of row live on those pages, and they are kept apart on purpose:
//
//   * **a real editor setting** — the theme, the startup view, breadcrumbs, telemetry. These are written through
//     `vscode.workspace.getConfiguration`, so the rest of the window obeys them at once. They are not stored here;
//     this file only remembers that they exist.
//   * **a platform preference this build has no home for** — the working folder, the update channel, the identity, the
//     models, the publish target. With no settings contribution behind them, the page keeps them so a control does
//     what it says; the day a manifest declares one, its row moves to the first kind and the page does not change.
//
// Mutable by design: a form whose checkbox springs back is worse than no checkbox.

export type UpdateChannel = 'Stable' | 'Preview';
export type ContextWindow = '8k' | '16k' | '32k';

export interface SettingsRegister {
	/** Where repositories are cloned and captures are written. Carries the mock's Workspace tag. */
	workingFolder: string;
	updateChannel: UpdateChannel;
	/** The identity the shell draws. */
	productName: string;
	accent: string;
	welcomePage: string;
	/** The AI profile: what loads next, and what it may touch. */
	chatModel: string;
	contextWindow: ContextWindow;
	requireCitations: boolean;
	embeddingModel: string;
	drafts: string;
	offlineOnly: boolean;
	/** Where a release goes, and what it publishes. */
	site: string;
	path: string;
	channel: UpdateChannel;
	artifacts: Record<string, boolean>;
	/** What the last Test Connection said. */
	publishProbe: string;
	/** The strip's last line: when a person last changed something here. */
	lastChanged: string;
}

export const DEFAULTS: SettingsRegister = {
	workingFolder: '~/Temco',
	updateChannel: 'Stable',
	productName: 'Temco Platform',
	accent: '#0078d4',
	welcomePage: 'Temco Platform',
	chatModel: 'qwen2.5-3b-instruct',
	contextWindow: '32k',
	requireCitations: true,
	embeddingModel: 'nomic-embed-text',
	drafts: 'Review Center',
	offlineOnly: true,
	site: 'https://learn.temcocontrols.com',
	path: '/t3000/{version}/',
	channel: 'Stable',
	artifacts: {
		Website: true,
		PDF: true,
		'Offline help (CHM)': true,
		'Search index': true,
		'AI index': false
	},
	publishProbe: 'connected · last publish 12 Sep · 6.2 MB',
	lastChanged: '2 days ago'
};

/** The live register. Copied from the defaults once, so a reset cannot mutate the defaults themselves. */
const current: SettingsRegister = { ...DEFAULTS, artifacts: { ...DEFAULTS.artifacts } };

/** The register, read-only for callers that only draw it. */
export function values(): SettingsRegister {
	return current;
}

/** Writes one value and marks the register as changed. */
export function set<K extends keyof SettingsRegister>(key: K, value: SettingsRegister[K]): void {
	current[key] = value;
	current.lastChanged = 'just now';
}

/** Writes one artifact's checkbox. */
export function setArtifact(name: string, on: boolean): void {
	if (!(name in current.artifacts)) {
		return;
	}
	current.artifacts[name] = on;
	current.lastChanged = 'just now';
}

/** Puts the listed keys back to their defaults — what each page's own Reset does. */
export function resetKeys(keys: readonly (keyof SettingsRegister)[]): void {
	for (const key of keys) {
		if (key === 'artifacts') {
			current.artifacts = { ...DEFAULTS.artifacts };
		} else if (key !== 'lastChanged') {
			// The cast is the price of writing one of several keys of a mixed-value object; it is the same write
			// `set` does, without the per-key generics a loop cannot carry.
			(current as unknown as Record<string, unknown>)[key] = DEFAULTS[key];
		}
	}
	current.lastChanged = 'just now';
}

/** How many artifacts would be published. */
export function publishedArtifacts(): number {
	return Object.values(current.artifacts).filter(Boolean).length;
}
