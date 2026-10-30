// AI Models — what this profile loads, how much it may read, and what it is allowed to touch.
//
// The five choices are this profile's register: the AI module in this build has no model runtime, so nothing is loaded or
// unloaded by changing them. The page says so rather than letting a row imply a model that is not there.

import { Checkbox, Dropdown, Option, Radio, RadioGroup } from '@fluentui/react-components';
import { ArrowSyncRegular, BrainCircuitRegular, BookmarkRegular, DocumentRegular, ShieldLockRegular } from '@fluentui/react-icons';
import { Action, Callout, Entries, Entry, Facts, Foot, Hero, ICON, Page, Section } from '../chrome';
import { AiState, Ask } from '../state';

interface Props {
	state: AiState;
	ask: (message: Ask) => void;
}

const MODELS = [
	{ value: 'qwen2.5-3b-instruct', label: 'qwen2.5-3b-instruct' },
	{ value: 'phi-3-mini-4k', label: 'phi-3-mini-4k' },
	{ value: 'temco-docs-1.4b', label: 'temco-docs-1.4b' }
];

const DRAFTS = [
	{ value: 'Review Center', label: 'Review Center' },
	{ value: 'Review Center, auto-reject after 7 days', label: 'Review Center, auto-reject after 7 days' }
];

export function Ai({ state, ask }: Props): React.ReactElement {
	const set = (key: string, value: unknown): void => ask({ type: 'setting', key, value });
	const chat = MODELS.find((model) => model.value === state.chatModel)?.label ?? state.chatModel;

	return (
		<Page>
			<Hero
				title="AI Models"
				mark={<BrainCircuitRegular fontSize={17} />}
				desc="What this profile loads, how much it may read, and what it is allowed to touch. The AI Hub shows what is loaded right now; this page decides what loads next."
				note={<span className="az-note__text">{`${chat} · ${state.contextWindow} read at once${state.offlineOnly ? ' · offline only' : ''}`}</span>}
				actions={<Action label="Open Models" glyph={<ArrowSyncRegular fontSize={ICON} />} onClick={() => ask({ type: 'command', command: 'temcoAi.localModels' })} />}
			/>

			<Section title="Answering" desc="The model behind the AI panel and behind every Draft action — 3 settings.">
				<Entries>
					<Entry
						glyph={<BrainCircuitRegular fontSize={15} />}
						title="Chat model"
						desc="Both run on this machine; nothing here calls a service."
						control={
							<Dropdown
								size="small"
								aria-label="Chat model"
								value={chat}
								selectedOptions={[state.chatModel]}
								onOptionSelect={(_event, data) => {
									if (data.optionValue !== undefined) {
										set('chatModel', data.optionValue);
									}
								}}
							>
								{MODELS.map((model) => (
									<Option key={model.value} value={model.value}>
										{model.label}
									</Option>
								))}
							</Dropdown>
						}
					/>
					<Entry
						glyph={<DocumentRegular fontSize={15} />}
						title="Context window"
						desc="How much of a page, its area and the sources behind it the model may read at once."
						control={
							<RadioGroup
								layout="horizontal"
								aria-label="Context window"
								value={state.contextWindow}
								onChange={(_event, data) => set('contextWindow', data.value)}
							>
								<Radio value="8k" label="8k" />
								<Radio value="16k" label="16k" />
								<Radio value="32k" label="32k" />
							</RadioGroup>
						}
					/>
					<Entry
						glyph={<BookmarkRegular fontSize={15} />}
						title="Always cite"
						desc="An answer without a citation is refused, not merely discouraged."
						control={
							<Checkbox
								aria-label="Require citations"
								checked={state.requireCitations}
								onChange={(_event, data) => set('requireCitations', data.checked)}
							/>
						}
					/>
				</Entries>
			</Section>

			<Section title="Retrieval" desc="How the knowledge index is built and queried — 1 setting.">
				<Entries>
					<Entry
						glyph={<BookmarkRegular fontSize={15} />}
						title="Embedding model"
						desc="Builds and queries the knowledge index. Changing it re-indexes every page this profile holds."
						control={
							<Dropdown
								size="small"
								aria-label="Embedding model"
								value={state.embeddingModel}
								selectedOptions={[state.embeddingModel]}
								onOptionSelect={(_event, data) => {
									if (data.optionValue !== undefined) {
										set('embeddingModel', data.optionValue);
									}
								}}
							>
								<Option value="nomic-embed-text">nomic-embed-text</Option>
							</Dropdown>
						}
					/>
				</Entries>
			</Section>

			<Section title="Drafts and Network" desc="Where a generated change waits, and whether anything may leave this machine — 2 settings.">
				<Entries>
					<Entry
						glyph={<DocumentRegular fontSize={15} />}
						title="Drafts"
						desc="Where an AI change goes before it is written to a page. Nothing reaches a reader without passing Review Center."
						control={
							<Dropdown
								size="small"
								aria-label="Drafts"
								value={state.drafts}
								selectedOptions={[state.drafts]}
								onOptionSelect={(_event, data) => {
									if (data.optionValue !== undefined) {
										set('drafts', data.optionValue);
									}
								}}
							>
								{DRAFTS.map((draft) => (
									<Option key={draft.value} value={draft.value}>
										{draft.label}
									</Option>
								))}
							</Dropdown>
						}
					/>
					<Entry
						glyph={<ShieldLockRegular fontSize={15} />}
						title="Offline only"
						desc="Refuse every action that would call a network service."
						control={
							<Checkbox
								aria-label="Keep prompts on this machine"
								checked={state.offlineOnly}
								onChange={(_event, data) => set('offlineOnly', data.checked)}
							/>
						}
					/>
				</Entries>
			</Section>

			<Section title="This Profile" desc="What the four rows above add up to, read back from the register.">
				<Facts
					items={[
						{ title: 'Model', value: state.chatModel, mono: true },
						{ title: 'Context', value: state.contextWindow },
						{ title: 'Citations', value: state.requireCitations ? 'required' : 'not required' },
						{ title: 'Network calls', value: state.offlineOnly ? 'none — offline only' : 'allowed by the profile' }
					]}
				/>
				<Foot>
					<Action label="Open the AI Hub" kind="link" glyph={<BrainCircuitRegular fontSize={ICON} />} onClick={() => ask({ type: 'command', command: 'temcoAi.localModels' })} />
				</Foot>
			</Section>

			<Callout
				title="These five choices are kept, not loaded"
				desc="The AI module in this build has no model runtime, so nothing is loaded or unloaded by changing them — the register records the choice, and the AI Hub shows what is actually there."
			/>
		</Page>
	);
}
