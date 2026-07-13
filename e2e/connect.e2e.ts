import { expect, test } from '@playwright/test';

const pingFixture = { ok: true as const };
const libraryStatusFixture = {
	scanning: false,
	has_library: true,
	library_dir: '/music',
	last_scan_unix: 1_710_000_000,
	last_scan_ok: true,
	last_error: '',
	track_count: 8080,
	image_count: 2,
	artist_count: 3,
	album_count: 4
};

test.describe('connect journey', () => {
	test('connects successfully against intercepted media-server responses', async ({ page }) => {
		const baseUrl = 'http://192.168.5.111:8080';

		await page.route(`${baseUrl}/api/ping`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(pingFixture)
			});
		});
		await page.route(`${baseUrl}/api/library/status`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(libraryStatusFixture)
			});
		});

		await page.goto('/connect');
		await page.getByLabel('Media server URL').fill(baseUrl);
		await page.getByRole('button', { name: 'Connect' }).click();

		await expect(page.getByText('Connected', { exact: true })).toBeVisible();
		await expect(page.getByText(/8080 tracks/)).toBeVisible();
		await expect(page.getByRole('status')).toContainText(`Connected to ${baseUrl}`);
	});

	test('shows an error when the probe fails', async ({ page }) => {
		const baseUrl = 'http://192.168.5.111:8080';

		await page.route(`${baseUrl}/api/ping`, async (route) => {
			await route.abort('failed');
		});

		await page.goto('/connect');
		await page.getByLabel('Media server URL').fill(baseUrl);
		await page.getByRole('button', { name: 'Connect' }).click();

		await expect(page.getByRole('alert')).toContainText(/Could not reach the media server/i);
		await expect(page.getByText('Connection error')).toBeVisible();
	});
});
