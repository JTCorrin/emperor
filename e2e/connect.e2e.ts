import { expect, test } from '@playwright/test';
import { MEDIA_SERVER_BASE_URL, gotoConnected, waitForAutoConnect } from './helpers';

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

test.describe('auto-connect journey', () => {
	test('boots connected against intercepted media-server responses', async ({ page }) => {
		const baseUrl = MEDIA_SERVER_BASE_URL;

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
		await page.route(`${baseUrl}/api/playlists**`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ items: [], total: 0, limit: 1, offset: 0 })
			});
		});

		await gotoConnected(page, '/');
		await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
		await expect(page.getByTestId('offline-banner')).toHaveCount(0);
	});

	test('shows offline banner when the probe fails and recovers on retry', async ({ page }) => {
		const baseUrl = MEDIA_SERVER_BASE_URL;
		let shouldFail = true;

		await page.route(`${baseUrl}/api/ping`, async (route) => {
			if (shouldFail) {
				await route.abort('failed');
				return;
			}
			await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
		});
		await page.route(`${baseUrl}/api/library/status`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(libraryStatusFixture)
			});
		});
		await page.route(`${baseUrl}/api/playlists**`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ items: [], total: 0, limit: 1, offset: 0 })
			});
		});

		await page.goto('/');
		await expect(page.getByTestId('offline-banner')).toBeVisible({ timeout: 15_000 });
		await expect(page.getByText('Offline', { exact: true })).toBeVisible();

		shouldFail = false;
		await page.getByRole('button', { name: 'Retry' }).click();
		await waitForAutoConnect(page);
	});

	test('shows library status on /connect without a URL form', async ({ page }) => {
		const baseUrl = MEDIA_SERVER_BASE_URL;
		await page.route(
			(url) => String(url).startsWith(baseUrl),
			async (route) => {
				const path = new URL(route.request().url()).pathname;
				if (path === '/api/ping') {
					return route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify(pingFixture)
					});
				}
				if (path === '/api/library/status') {
					return route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify(libraryStatusFixture)
					});
				}
				if (path === '/api/playlists') {
					return route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({ items: [], total: 0, limit: 1, offset: 0 })
					});
				}
				await route.fallback();
			}
		);

		await gotoConnected(page, '/connect');
		await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
		await expect(page.getByText('Connected', { exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Scan' })).toBeVisible();
		await expect(page.getByLabel('Media server URL')).toHaveCount(0);
	});
});
