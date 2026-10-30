// The Azure reading theme: Fluent's neutral theme, seeded with Microsoft Azure's brand.
//
// Microsoft Learn reads as Fluent with Azure's blue (#0078d4) on a white page in a Segoe face, so the theme is Fluent's
// own neutral theme with the brand tokens replaced rather than a palette invented here.

import { webDarkTheme, webLightTheme, type Theme } from '@fluentui/react-theme';

const AZURE = '#0078d4';
const AZURE_HOVER = '#106ebe';
const AZURE_PRESSED = '#005a9e';

/** The face Microsoft Learn sets its body text in, falling back to whatever the machine has. */
export const FONT_FAMILY = "'Segoe UI Variable Text', 'Segoe UI', system-ui, -apple-system, sans-serif";

/** One Fluent theme with Azure's brand, so components pick the brand up from the provider rather than from each call. */
function seeded(theme: Theme): Theme {
	return {
		...theme,
		fontFamilyBase: FONT_FAMILY,
		colorBrandBackground: AZURE,
		colorBrandBackgroundHover: AZURE_HOVER,
		colorBrandBackgroundPressed: AZURE_PRESSED,
		colorBrandBackgroundSelected: AZURE_PRESSED,
		colorBrandForeground1: AZURE,
		colorBrandForeground2: AZURE_HOVER,
		colorBrandForegroundLink: AZURE_HOVER,
		colorBrandForegroundLinkHover: AZURE_PRESSED,
		colorCompoundBrandBackground: AZURE,
		colorCompoundBrandBackgroundHover: AZURE_HOVER,
		colorCompoundBrandStroke: AZURE,
		colorNeutralForeground1: '#1b1b1f'
	};
}

export const azureLight = seeded(webLightTheme);
export const azureDark = seeded(webDarkTheme);

/** The theme the reader's own colour scheme asks for. */
export const forScheme = (): Theme =>
	window.matchMedia !== undefined && window.matchMedia('(prefers-color-scheme: dark)').matches ? azureDark : azureLight;
