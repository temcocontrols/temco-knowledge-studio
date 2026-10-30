// The General page's entry point: one provider, one page, one state from the host.
//
// The page asks for its state when it mounts and draws whatever arrives. Every write goes back as a message and comes home
// as a new state, so there is exactly one place that decides what a setting is worth: the extension host.
//
// The kit's stylesheet is imported first, deliberately: the wash, the section rule, the entry row and the buttons are the
// same rules the platform's other pages are drawn by, so this page is that language rather than a similar one.

import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FluentProvider } from '@fluentui/react-components';
import '../../../temco-ui/media/page.css';
import { General } from './General';
import { Ask, GeneralState } from './state';
import { pageTheme } from './theme';
import './settings.css';

interface Host {
	postMessage(message: Ask): void;
}

declare function acquireVsCodeApi(): Host;

const host = acquireVsCodeApi();

function App(): React.ReactElement | null {
	const [state, setState] = useState<GeneralState | undefined>(undefined);

	useEffect(() => {
		const receive = (event: MessageEvent<{ type?: string; state?: GeneralState }>): void => {
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
			<General state={state} ask={(message) => host.postMessage(message)} />
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
