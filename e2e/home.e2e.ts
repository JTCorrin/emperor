import { expect, test, type Page, type Route } from '@playwright/test';

const baseUrl = 'http://127.0.0.1:8080';

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
	id: 42,
	kind: 'audio' as const,
	path: 'Artist/Album/track.mp3',
	filename: 'track.mp3',
	artist: 'Shelf Artist',
	album: 'Shelf Album',
	title: 'Shelf Track',
	release_date: null,
	genre: null,
	track_number: 1,
	disc_number: 1,
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

async function stubHomeApis(page: Page) {
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
			if (path === '/api/discover/recently-played') {
				return fulfillJson(route, 400, { error: 'no_user_db' });
			}
			if (path === '/api/discover/random' || path === '/api/discover/recent') {
				return fulfillJson(route, 200, trackPage);
			}
			if (path === '/api/playlists' || path === '/api/favourites') {
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

test.describe('home shelves', () => {
	test('shows discover tracks, plays from a shelf, and keeps catalog shelves when user-db is missing', async ({
		page
	}) => {
		await stubHomeApis(page);

		await page.goto('/connect');
		await page.getByLabel('Media server URL').fill(baseUrl);
		await page.getByRole('button', { name: 'Connect' }).click();
		await expect(page.getByText('Connected', { exact: true })).toBeVisible();

		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
		await expect(page.getByText('Connected', { exact: true })).toBeVisible({ timeout: 15_000 });
		await expect(page.getByRole('heading', { name: 'Discover' })).toBeVisible({ timeout: 15_000 });
		await expect(page.getByRole('button', { name: /Shelf Track/ }).first()).toBeVisible();
		await expect(
			page.getByText('Recently played needs a media-server user database.')
		).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Recently Added' })).toBeVisible();

		await page
			.getByRole('button', { name: /Shelf Track/ })
			.first()
			.click();
		await expect(page.getByLabel('Now playing')).toContainText('Shelf Track');
	});
});
