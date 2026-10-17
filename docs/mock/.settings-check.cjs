const { chromium } = require('c:/QN/temcocontrols/temco-platform/node_modules/playwright');

const base = 'file:///C:/QN/temcocontrols/temco-platform/docs/mock/index.html#/';

function toastText() {
	return Array.from(document.querySelectorAll('.toast, #toast, .toasts > *'))
		.map(node => node.textContent.trim())
		.filter(Boolean);
}

(async () => {
	const browser = await chromium.launch();
	const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
	const errors = [];
	page.on('pageerror', error => errors.push(String(error)));

	await page.goto(base + 'settings/general');
	await page.waitForTimeout(300);
	await page.click('.segmented[data-setting="Theme"] button:nth-child(3)');
	await page.waitForTimeout(150);
	console.log('theme now', await page.evaluate(() => document.documentElement.getAttribute('data-theme')));
	await page.screenshot({ path: 'C:/Users/Double/AppData/Local/Temp/set4-general-light.png' });
	console.log('theme toast', JSON.stringify(await page.evaluate(toastText)));
	console.log('pressed', JSON.stringify(await page.evaluate(() =>
		Array.from(document.querySelectorAll('.segmented[data-setting="Theme"] button')).map(b => b.textContent.trim() + ':' + b.getAttribute('aria-pressed')))));

	await page.goto(base + 'settings/publishing');
	await page.waitForTimeout(300);
	const boxes = await page.$$('input[data-setting]');
	await boxes[4].click();
	await page.waitForTimeout(150);
	console.log('artifact toast', JSON.stringify(await page.evaluate(toastText)));

	await page.goto(base + 'settings/branding');
	await page.waitForTimeout(300);
	await page.click('[data-action="theme-light"]');
	await page.waitForTimeout(150);
	console.log('theme applied', await page.evaluate(() => document.documentElement.getAttribute('data-theme')), JSON.stringify(await page.evaluate(toastText)));

	console.log('errors', JSON.stringify(errors));
	await browser.close();
})();
