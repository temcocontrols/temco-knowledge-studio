// The one theme a webview can be told about, and the one place Fluent needs it.
//
// The annotator is built from Fluent components, and a Fluent component looks its colours up in a provider: with none it
// falls back to Fluent's own light theme, so the dialog is a white island in a dark editor. VS Code states the theme as a
// class on `body` — that is the whole of what a webview frame is given — so that class is what this reads.

import { teamsHighContrastTheme, webDarkTheme, webLightTheme, type Theme } from '@fluentui/react-components';

export function fluentTheme(): Theme {
	const classes = document.body.classList;
	if (classes.contains('vscode-high-contrast') || classes.contains('vscode-high-contrast-light')) {
		return teamsHighContrastTheme;
	}
	return classes.contains('vscode-dark') ? webDarkTheme : webLightTheme;
}
