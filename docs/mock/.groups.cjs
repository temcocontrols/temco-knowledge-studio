const { chromium } = require('c:/QN/temcocontrols/temco-platform/node_modules/playwright');

const base = 'file:///C:/QN/temcocontrols/temco-platform/docs/mock/index.html#/';

(async () => {
	const browser = await chromium.launch();
	const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
	const errors = [];
	page.on('pageerror', error => errors.push(String(error)));

	for (const view of ['settings/general', 'settings/modules', 'settings/publishing']) {
		await page.goto(base + view);
		await page.waitForTimeout(300);
		console.log(view, JSON.stringify(await page.evaluate(() => ({
			sections: Array.from(document.querySelectorAll('.tree__section')).map(node => node.textContent.trim()),
			items: Array.from(document.querySelectorAll('.tree__item')).map(node => node.textContent.trim()),
			active: document.querySelector('.tree__item.is-active') ? document.querySelector('.tree__item.is-active').textContent.trim() : null
		}))));
	}

	/* With two groups the section becomes a real level again: check the crumb when the bar is on. */
	await page.keyboard.press('Control+Shift+P');
	await page.waitForTimeout(200);
	await page.fill('#palette-input', 'breadcrumbs');
	await page.waitForTimeout(120);
	await page.keyboard.press('Enter');
	await page.waitForTimeout(250);
	console.log('crumb', await page.evaluate(() => document.querySelector('.breadcrumbs').innerText.replace(/\n/g, ' > ')));

	await page.screenshot({ path: 'C:/Users/Double/AppData/Local/Temp/settings-groups.png' });
	console.log('errors', JSON.stringify(errors));
	await browser.close();
})();
