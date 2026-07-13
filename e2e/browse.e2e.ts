import { expect, test, type Page, type Route } from '@playwright/test';

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
	id: 42,
	kind: 'audio' as const,
	path: 'Artist/Album/track.mp3',
	filename: 'track.mp3',
	artist: 'Browse Artist',
	album: 'Browse Album',
	title: 'Browse Track',
	release_date: null,
	genre: null,
	track_number: 1,
	disc_number: 1,
	overridden_fields: [] as string[]
};

const album = {
	id: 7,
	name: 'Browse Album',
	artist: 'Browse Artist',
	artist_id: 3,
	track_count: 1,
	release_date: '2024',
	genre: null,
	cover_id: null as number | null
};

const artist = {
	id: 3,
	name: 'Browse Artist',
	album_count: 1,
	track_count: 1
};

const trackPage = { items: [track], total: 1, limit: 50, offset: 0 };
const albumPage = { items: [album], total: 1, limit: 50, offset: 0 };
const artistPage = { items: [artist], total: 1, limit: 50, offset: 0 };

async function fulfillJson(route: Route, status: number, body: unknown) {
	await route.fulfill({
		status,
		contentType: 'application/json',
		body: JSON.stringify(body)
	});
}

async function stubBrowseApis(page: Page) {
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
			if (path === '/api/albums') {
				return fulfillJson(route, 200, albumPage);
			}
			if (path === '/api/albums/7') {
				return fulfillJson(route, 200, album);
			}
			if (path === '/api/albums/7/tracks') {
				return fulfillJson(route, 200, trackPage);
			}
			if (path === '/api/artists') {
				return fulfillJson(route, 200, artistPage);
			}
			if (path === '/api/artists/3') {
				return fulfillJson(route, 200, artist);
			}
			if (path === '/api/artists/3/albums') {
				return fulfillJson(route, 200, albumPage);
			}
			if (path === '/api/tracks') {
				return fulfillJson(route, 200, trackPage);
			}
			if (path === '/api/search') {
				return fulfillJson(route, 200, {
					q: 'browse',
					fuzzy: false,
					tracks: trackPage,
					artists: artistPage,
					albums: albumPage
				});
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

async function connect(page: Page) {
	await page.goto('/connect');
	await page.getByLabel('Media server URL').fill(baseUrl);
	await page.getByRole('button', { name: 'Connect' }).click();
	await expect(page.getByText('Connected', { exact: true })).toBeVisible();
}

test.describe('browse and search', () => {
	test('opens an album from the grid and plays a track', async ({ page }) => {
		await stubBrowseApis(page);
		await connect(page);

		await page.goto('/albums');
		await expect(page.getByText('Connected', { exact: true })).toBeVisible({ timeout: 15_000 });
		await expect(page.getByRole('button', { name: /Browse Album/ })).toBeVisible({
			timeout: 15_000
		});
		await page.getByRole('button', { name: /Browse Album/ }).click();

		await expect(page.getByRole('heading', { name: 'Browse Album' })).toBeVisible();
		await page.getByRole('button', { name: /Browse Track/ }).click();
		await expect(page.getByLabel('Now playing')).toContainText('Browse Track');
	});

	test('shows search results for a linkable query', async ({ page }) => {
		await stubBrowseApis(page);
		await connect(page);

		await page.goto('/search?q=browse');
		await expect(page.getByText('Connected', { exact: true })).toBeVisible({ timeout: 15_000 });
		await expect(page.getByText('Results for “browse”')).toBeVisible({ timeout: 15_000 });
		await expect(page.getByRole('button', { name: /Browse Track/ })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Artists' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Albums' })).toBeVisible();
	});

	test('keeps podcasts unavailable messaging', async ({ page }) => {
		await page.goto('/podcasts');
		await expect(page.getByRole('heading', { name: 'Podcasts' })).toBeVisible();
		await expect(page.getByRole('status')).toContainText(/unavailable/i);
	});
});
