/*---------------------------------------------------------------------------------------------
 *  Temco Platform - the shell.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createStyleSheet } from '../../vs/base/browser/domStylesheets.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../vs/workbench/common/contributions.js';

/**
 * The product's mark, wherever the workbench draws its own.
 *
 * VS Code paints the application logo as a `background-image` in its own stylesheets — the title-bar
 * corner, the Welcome page tab and watermark, the banner, the update tooltip, both onboarding pages and
 * the sessions badge. There is no contribution point for any of it, so the choices are to edit those
 * stylesheets (which breaks the fork's rule that `src/vs` is untouched beyond its two entry-point
 * lines) or to install one stylesheet of our own that points the same selectors at our asset.
 *
 * This is the second: a single sheet, added after the workbench has loaded, whose declarations win at
 * equal specificity because they come later. The image itself is Temco's own, in `resources/` where the
 * fork keeps its images, and it is resolved through `FileAccess` so it works in a development run and
 * in a packaged build alike.
 */
class TemcoBranding {

	static readonly ID = 'temco.branding';

	constructor() {
		// The mark is 2 KB of vector, so it travels inside the stylesheet. That keeps it out of any
		// resource path the renderer would otherwise have to resolve, and keeps `src/vs` untouched.
		const logo = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjkzNzUuNCAxNTUyLjQyIDk2MC45IDk0OC4wOSIgd2lkdGg9IjEyOCIgaGVpZ2h0PSIxMjYuMyIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsPSJUMzAwMCI+DQoJPGRlZnM+DQoJCTxsaW5lYXJHcmFkaWVudCBpZD0idGVtY29UaWxlIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgeDE9Ijk4NTYuMzUiIHkxPSIyNDgxLjk1IiB4Mj0iOTg1Ni4zNSIgeTI9IjE1NzAuOTYiPg0KCQkJPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjMjI0RTdBIi8+DQoJCQk8c3RvcCBvZmZzZXQ9IjAuOTQxMTc2IiBzdG9wLWNvbG9yPSIjOTBBNkJDIi8+DQoJCQk8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNGRUZFRkUiLz4NCgkJPC9saW5lYXJHcmFkaWVudD4NCgk8L2RlZnM+DQoJPHJlY3QgeD0iOTM3NS40IiB5PSIxNTUyLjQyIiB3aWR0aD0iOTYwLjkiIGhlaWdodD0iOTQ4LjA5IiByeD0iMTM1LjMxIiByeT0iMTM1LjMxIiBmaWxsPSIjMjI0RTdBIi8+DQoJPHBhdGggZmlsbD0idXJsKCN0ZW1jb1RpbGUpIiBkPSJNOTUyMS43NCAxNTcwLjk2bDY2OS4yIDBjNzQuNzgsMCAxMzUuOTYsNjEuMTggMTM1Ljk2LDEzNS45NmwwIDYzOS4wOGMwLDc0Ljc4IC02MS4xOCwxMzUuOTYgLTEzNS45NiwxMzUuOTZsLTY2OS4yIDBjLTc0Ljc4LDAgLTEzNS45NiwtNjEuMTggLTEzNS45NiwtMTM1Ljk2bDAgLTYzOS4wOGMwLC03NC43OCA2MS4xOCwtMTM1Ljk2IDEzNS45NiwtMTM1Ljk2eiIvPg0KCTxwb2x5Z29uIGZpbGw9IiNmZmZmZmYiIHBvaW50cz0iOTgxMy40MywyMTUyLjg4IDk4MTIuMiwxODEwLjMyIDk2NTIuNSwxODExLjA4IDk2NTIuMDQsMTY4MS42MSAxMDA5Mi4yNCwxNjc5LjUzIDEwMDkyLjY5LDE4MDkgOTkzMi4yMSwxODA5Ljc2IDk5MzMuNDMsMjE1Mi4zMiIvPg0KCTxwYXRoIGZpbGw9IiNmZmZmZmYiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLXdpZHRoPSI3LjYyIiBkPSJNMTAxOTUuMTIgMTkzOC41OGwwLjUxIDIuNCAwLjI3IDAgNzcuMjEgMTYuNThjMi44NywzNC40NSAyLjksNjMuNjggMC42NCwxMDAuNzFsLTc4LjA0IDE1Ljk1IC0wLjI0IDBjLTIuNjIsMTIuNDkgLTUuOTQsMjQuNzEgLTkuOTIsMzYuNjJsMC43NyAwLjQ1IDU4LjM0IDUzLjJjLTE0Ljg2LDMxLjIxIC0yOS41Nyw1Ni40OCAtNTAuMTcsODcuMzRsLTc1LjQ1IC0yNS41NCAtMC43NCAtMC40M2MtOC41Niw5LjQ5IC0xNy42NywxOC40NiAtMjcuMjgsMjYuODlsMS4xMiAxLjk0IDI1LjU1IDczLjA2Yy0zMi44MiwyMi45NyAtNTMuNjEsMzQuODUgLTg1Ljc4LDQ5LjMxbC01MS41NyAtNTcuMTYgLTEuNjIgLTIuNzhjLTEzLjExLDQuMzUgLTI2LjU4LDcuOSAtNDAuMzcsMTAuNTdsLTAuMDEgMi40MSAtMTQuNzIgNzUuOTljLTM5Ljk0LDMuMzIgLTYzLjg4LDMuMTEgLTk4Ljk1LC0wLjYxbC0xNS43NiAtNzUuMzQgMCAtMy4zNmMtMTIuNDIsLTIuNTkgLTI0LjU4LC01Ljg5IC0zNi40NCwtOS44NmwtMS4yNCAyLjE1IC01MC4yOSA1OC44NWMtMzYuMzYsLTE2LjgyIC01Ny4wOCwtMjguODEgLTg1Ljc3LC00OS4zNGwyMy40NyAtNzMuMzIgMS42NyAtMi45NGMtMTAuNDMsLTkuMTggLTIwLjI4LC0xOS4wMyAtMjkuNDcsLTI5LjQ2bC0yLjE1IDEuMjMgLTczLjA4IDI1LjVjLTIyLjk1LC0zMi44NSAtMzQuODIsLTUzLjY0IC00OS4yMywtODUuODRsNTcuMiAtNTEuNTEgMi42NCAtMS41M2MtNC4yLC0xMi41OCAtNy42NywtMjUuNSAtMTAuMzMsLTM4LjcxbC0xLjk0IDAgLTc2LjAyIC0xNC40OGMtMy40NCwtMzkuOTMgLTMuMzEsLTYzLjg3IDAuMzIsLTk4Ljk3bDc1LjI5IC0xNS45NyAyLjMgLTAuMDEgMC44MyAtMy45OSA3Mi43MSAwYy02LjI5LDIyLjIxIC05LjY3LDQ1LjY2IC05LjY3LDY5LjkgMCwxNDEuMjEgMTE0LjQ4LDI1NS42OCAyNTUuNjksMjU1LjY4IDE0MS4yMSwwIDI1NS42OSwtMTE0LjQ3IDI1NS42OSwtMjU1LjY4IDAsLTI0LjI0IC0zLjM3LC00Ny42OSAtOS42NywtNjkuOWw3My43IDB6Ii8+DQo8L3N2Zz4NCg==';

		// The selectors are VS Code's own; only the image changes, so every other declaration of theirs
		// (size, position, repetition, mask) keeps applying.
		const rules: [selector: string, declaration: string][] = [
			['.monaco-workbench .part.titlebar > .titlebar-container > .titlebar-left > .window-appicon:not(.codicon)', `background-image: url("${logo}");`],
			['.monaco-workbench .part.banner .icon-container.custom-icon', `background-image: url("${logo}");`],
			['.update-tooltip .product-logo', `background-image: url("${logo}");`],
			['.file-icons-enabled .show-file-icons .vscode_getting_started_page-name-file-icon.file-icon::before', `background-image: url("${logo}");`],
			['.onboarding-a-signin-brand-icon', `background-image: url("${logo}");`],
			['.file-icons-enabled .show-file-icons .vs_code_editor_walkthrough\\.md-name-file-icon.md-ext-file-icon.ext-file-icon.markdown-lang-file-icon.file-icon::before', `background-image: url("${logo}");`],
			['.monaco-workbench .open-in-vscode-titlebar-widget[data-product-quality="insider"] > .open-in-vscode-titlebar-widget-icon, .monaco-workbench .open-in-vscode-titlebar-widget[data-product-quality="exploration"] > .open-in-vscode-titlebar-widget-icon', `background-image: url("${logo}");`],
		];

		const sheet = createStyleSheet();
		sheet.textContent = rules.map(([selector, declaration]) => `${selector} { ${declaration} }`).join('\n');
	}
}

registerWorkbenchContribution2(TemcoBranding.ID, TemcoBranding, WorkbenchPhase.BlockStartup);
