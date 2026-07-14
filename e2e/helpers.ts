import { expect, type Page } from '@playwright/test';

/** Must match playwright webServer PUBLIC_MEDIA_SERVER_URL / DEFAULT_DEV_BASE_URL. */
export const MEDIA_SERVER_BASE_URL = 'http://192.168.5.111:8080';

export async function waitForAutoConnect(page: Page) {
	await expect(page.getByTestId('offline-banner')).toHaveCount(0, { timeout: 15_000 });
}

export async function gotoConnected(page: Page, path = '/') {
	await page.goto(path);
	await waitForAutoConnect(page);
}
