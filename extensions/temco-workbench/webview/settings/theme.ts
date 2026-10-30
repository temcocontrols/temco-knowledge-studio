// Fluent's neutral theme, seeded with Microsoft Azure's brand.
//
// Nothing is invented: Fluent supplies every token and every control's look, Azure supplies the blue, Segoe supplies the
// face. Two themes are the same tokens in light and dark, so switching one never moves a thing.

import { webDarkTheme, webLightTheme, type Theme } from '@fluentui/react-components';

const AZURE = '#0078d4';

function seeded(theme: Theme): Theme {
	return {
		...theme,
		// The page's own text is set in the editor's face (the kit's `--font-ui`), so the controls are too: a settings row
		// whose label and whose switch are set in two faces reads as two applications.
		fontFamilyBase: 'var(--vscode-font-family), "Segoe UI", system-ui, sans-serif',
		colorBrandBackground: AZURE,
		colorBrandBackgroundHover: '#106ebe',
		colorBrandBackgroundPressed: '#005a9e',
		colorBrandBackgroundSelected: '#005a9e',
		colorBrandForeground1: AZURE,
		colorBrandForeground2: '#106ebe',
		colorBrandForegroundLink: '#0067b8',
		colorBrandForegroundLinkHover: '#005a9e',
		colorCompoundBrandBackground: AZURE,
		colorCompoundBrandBackgroundHover: '#106ebe',
		colorCompoundBrandStroke: AZURE,
		// The controls sit in 12–13px prose, so their own type ramp is one step down from Fluent's default.
		fontSizeBase100: '10px',
		lineHeightBase100: '12px',
		fontSizeBase200: '11px',
		lineHeightBase200: '14px',
		fontSizeBase300: '12px',
		lineHeightBase300: '16px'
	};
}

const light = seeded(webLightTheme);
const dark = seeded(webDarkTheme);

/**
 * The theme for the frame the page is in.
 *
 * VS Code tells a webview its theme as a class on `body` — that is the whole of what the frame is given — so that class
 * is what this reads. A high-contrast frame follows the editor's own side of the contrast pair rather than Azure: the
 * reader asked the system for contrast, not for a brand.
 */
export function pageTheme(): Theme {
	const classes = document.body.classList;
	const highContrast = classes.contains('vscode-high-contrast') || classes.contains('vscode-high-contrast-light');
	if (highContrast) {
		return classes.contains('vscode-high-contrast-light') ? light : dark;
	}
	return classes.contains('vscode-light') ? light : dark;
}
