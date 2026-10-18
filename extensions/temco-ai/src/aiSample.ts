// The sample the AI Hub surfaces are drawn from.
//
// The mock's (`docs/mock/js/data.js`: `aiModels`, `aiActions`, `citations`), carried over as-is. The pages are the
// design's; the runtime this module actually runs is asked for at `aiStatus()` and shown in the AI bar.

export interface AiModel {
	name: string;
	kind: string;
	size: string;
	state: string;
	tone: string;
	ctx: string;
}

export const MODELS: AiModel[] = [
	{ name: 'qwen2.5-3b-instruct', kind: 'Chat', size: '1.9 GB', state: 'Loaded', tone: 'ok', ctx: '32k' },
	{ name: 'nomic-embed-text', kind: 'Embedding', size: '274 MB', state: 'Loaded', tone: 'ok', ctx: '8k' },
	{ name: 'phi-3-mini-4k', kind: 'Chat', size: '2.2 GB', state: 'Not loaded', tone: 'neutral', ctx: '4k' },
	{ name: 'temco-docs-1.4b', kind: 'Chat · fine-tune', size: '840 MB', state: 'Not loaded', tone: 'neutral', ctx: '16k' }
];

export interface AiAction {
	name: string;
	desc: string;
	state: string;
	tone: string;
}

export const ACTIONS: AiAction[] = [
	{ name: 'Draft a page update', desc: 'Rewrites the open page against the registry and its sources', state: 'Enabled', tone: 'ok' },
	{ name: 'Ask this area', desc: 'Answers from the whole area, with citations', state: 'Enabled', tone: 'ok' },
	{ name: 'Find knowledge gaps', desc: 'Lists topics the sources mention but no page covers', state: 'Enabled', tone: 'ok' },
	{ name: 'Generate release notes', desc: 'Summarises commits since the last release', state: 'Needs a model', tone: 'warn' },
	{ name: 'Summarise a device log', desc: 'Reads trend and alarm history for one device', state: 'Enabled', tone: 'ok' }
];

export interface Citation {
	title: string;
	where: string;
	kind: string;
	usedIn: string;
}

export const CITATIONS: Citation[] = [
	{ title: 'Data Points API', where: 't3000 › api-reference › data-points', kind: 'page', usedIn: 'Answer · 26 m ago' },
	{ title: 'Point object', where: 'bacnet-stack › src/bacnet/point.h', kind: 'source', usedIn: 'Draft · 1 h ago' },
	{ title: 'T3000 User Manual.pdf', where: 'page 148 · §7.3', kind: 'document', usedIn: 'Answer · 26 m ago' },
	{ title: 'Trend Log Retention', where: 't3000 › trends › retention', kind: 'page', usedIn: 'Suggestion · 3 h ago' }
];
