import { expect, test } from '@playwright/test';

const baseUrl = 'http://192.168.5.111:8080';

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

const track = {
	id: 11,
	kind: 'audio' as const,
	path: 'Artist/Album/track11.mp3',
	filename: 'track11.mp3',
	artist: 'Fixture Artist',
	album: 'Fixture Album',
	title: 'Fixture Track',
	release_date: null,
	genre: null,
	track_number: 1,
	disc_number: 1,
	overridden_fields: [] as string[]
};

async function stubMediaServer(page: import('@playwright/test').Page) {
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
	await page.route(`${baseUrl}/api/discover/random**`, async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				items: [track],
				total: 1,
				limit: 25,
				offset: 0
			})
		});
	});
	await page.route(`${baseUrl}/api/history`, async (route) => {
		await route.fulfill({
			status: 400,
			contentType: 'application/json',
			body: JSON.stringify({ error: 'no_user_db' })
		});
	});
	await page.route(`${baseUrl}/stream/**`, async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'audio/mpeg',
			body: Buffer.from([])
		});
	});
}

test.describe('playback survives navigation', () => {
	test('plays a random track and keeps the player across tabs', async ({ page }) => {
		await stubMediaServer(page);

		await page.goto('/connect');
		await page.getByLabel('Media server URL').fill(baseUrl);
		await page.getByRole('button', { name: 'Connect' }).click();
		await expect(page.getByText('Connected', { exact: true })).toBeVisible();

		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Play random' })).toBeVisible();
		await page.getByRole('button', { name: 'Play random' }).click();

		await expect(page.getByLabel('Now playing')).toContainText('Fixture Track');
		await expect(page.getByLabel('Now playing')).toContainText('Fixture Artist');

		await page.getByRole('link', { name: 'Songs' }).click();
		await expect(page.getByRole('heading', { name: 'Songs' })).toBeVisible();
		await expect(page.getByLabel('Now playing')).toContainText('Fixture Track');
		await expect(page.getByRole('button', { name: /Play|Pause/ })).toBeVisible();
	});
});
