// The Settings bundle's entry point: one provider, one page, one state from the host.
//
// Five pages share this bundle, and the state says which one it is for. The page asks for its state when it mounts and draws
// whatever arrives; every write goes back as a message and comes home as a new state, so there is exactly one place that
// decides what a setting is worth: the extension host.
//
// The kit's stylesheet is imported first, deliberately: the wash, the section rule, the entry row and the buttons are the
// same rules the platform's other pages are drawn by, so these pages are that language rather than a similar one.

import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FluentProvider } from '@fluentui/react-components';
import '../../../temco-ui/media/page.css';
import { Ai } from './pages/Ai';
import { Branding } from './pages/Branding';
import { General } from './pages/General';
import { Modules } from './pages/Modules';
import { Publishing } from './pages/Publishing';
import { Ask, SettingsState } from './state';
import { pageTheme } from './theme';
import './settings.css';

interface Host {
	postMessage(message: Ask): void;
}

declare function acquireVsCodeApi(): Host;

const host = acquireVsCodeApi();
const ask = (message: Ask): void => host.postMessage(message);

function Body({ state }: { state: SettingsState }): React.ReactElement | null {
	switch (state.page) {
		case 'general':
			return state.general === undefined ? null : <General state={state.general} ask={ask} />;
		case 'modules':
			return state.modules === undefined ? null : <Modules state={state.modules} ask={ask} />;
		case 'branding':
			return state.branding === undefined ? null : <Branding state={state.branding} ask={ask} />;
		case 'ai':
			return state.ai === undefined ? null : <Ai state={state.ai} ask={ask} />;
		case 'publishing':
			return state.publishing === undefined ? null : <Publishing state={state.publishing} ask={ask} />;
		default:
			return null;
	}
}

function App(): React.ReactElement | null {
	const [state, setState] = useState<SettingsState | undefined>(undefined);

	useEffect(() => {
		const receive = (event: MessageEvent<{ type?: string; state?: SettingsState }>): void => {
			if (event.data?.type === 'state' && event.data.state !== undefined) {
				setState(event.data.state);
			}
		};
		window.addEventListener('message', receive);
		host.postMessage({ type: 'ready' });
		return () => window.removeEventListener('message', receive);
	}, []);

	if (state === undefined) {
		return null;
	}
	return (
		<FluentProvider theme={pageTheme()}>
			<Body state={state} />
		</FluentProvider>
	);
}

const holder = document.getElementById('root');
if (holder !== null) {
	createRoot(holder).render(
		<StrictMode>
			<App />
		</StrictMode>
	);
}
