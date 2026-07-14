import { expect, test, type Page, type Route } from '@playwright/test';
import { MEDIA_SERVER_BASE_URL, gotoConnected } from './helpers';

const baseUrl = MEDIA_SERVER_BASE_URL;

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
	album_id: 1,
	cover_id: 55,
	overridden_fields: [] as string[]
};

const trackPage = { items: [track], total: 1, limit: 20, offset: 0 };

async function fulfillJson(route: Route, status: number, body: unknown) {
	await route.fulfill({
		status,
		contentType: 'application/json',
		body: JSON.stringify(body)
	});
}

async function stubMediaServer(page: Page) {
	await page.route(
		(url) => String(url).startsWith(baseUrl),
		async (route) => {
			const path = new URL(route.request().url()).pathname;

			if (path === '/api/ping') {
				return fulfillJson(route, 200, pingFixture);
			}
			if (path === '/api/library/status') {
				return fulfillJson(route, 200, libraryStatusFixture);
			}
			if (
				path === '/api/discover/recently-played' ||
				path === '/api/discover/random' ||
				path === '/api/discover/recent' ||
				path === '/api/favourites'
			) {
				return fulfillJson(route, 200, trackPage);
			}
			if (path === '/api/playlists') {
				return fulfillJson(route, 200, { items: [], total: 0, limit: 20, offset: 0 });
			}
			if (path === '/api/history') {
				return fulfillJson(route, 400, { error: 'no_user_db' });
			}
			if (path.startsWith('/stream/')) {
				return route.fulfill({
					status: 200,
					contentType: 'audio/mpeg',
					body: Buffer.from([])
				});
			}

			await route.fallback();
		}
	);
}

test.describe('playback survives navigation', () => {
	test('plays a discover track and keeps the player across tabs', async ({ page }) => {
		await stubMediaServer(page);
		await gotoConnected(page, '/');

		await expect(page.getByRole('heading', { name: 'Discover' })).toBeVisible({ timeout: 15_000 });
		await page
			.getByRole('button', { name: /Fixture Track/ })
			.first()
			.click();

		await expect(page.getByLabel('Now playing')).toContainText('Fixture Track');
		await expect(page.getByLabel('Now playing')).toContainText('Fixture Artist');

		await page
			.getByRole('navigation', { name: 'Primary' })
			.getByRole('link', { name: 'Songs' })
			.click();
		await expect(page.getByRole('heading', { name: 'Songs' })).toBeVisible();
		await expect(page.getByLabel('Now playing')).toContainText('Fixture Track');
		await expect(page.getByRole('button', { name: /Play|Pause/ })).toBeVisible();
	});
});
