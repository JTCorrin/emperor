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
	artist_count: 1,
	album_count: 1
};

const artist = {
	id: 3,
	name: 'Browse Artist',
	album_count: 1,
	track_count: 1
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

const emptyPage = { items: [], total: 0, limit: 50, offset: 0 };
const artistPage = { items: [artist], total: 1, limit: 50, offset: 0 };
const albumPage = { items: [album], total: 1, limit: 50, offset: 0 };

async function fulfillJson(route: Route, status: number, body: unknown) {
	await route.fulfill({
		status,
		contentType: 'application/json',
		body: JSON.stringify(body)
	});
}

async function stubApis(page: Page) {
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
			if (path === '/api/playlists') {
				return fulfillJson(route, 200, emptyPage);
			}
			if (path === '/api/artists/3') {
				return fulfillJson(route, 200, artist);
			}
			if (path === '/api/artists/3/albums') {
				return fulfillJson(route, 200, albumPage);
			}
			if (path === '/api/search') {
				const q = new URL(route.request().url()).searchParams.get('q') ?? '';
				return fulfillJson(route, 200, {
					q,
					fuzzy: false,
					tracks: emptyPage,
					artists: artistPage,
					albums: emptyPage
				});
			}

			await route.fallback();
		}
	);
}

test.describe('contextual back navigation', () => {
	test('search → artist shows Back to Search', async ({ page }) => {
		await stubApis(page);
		await gotoConnected(page, '/');

		await page.goto('/search?q=browse');
		await expect(page.getByText('Results for “browse”')).toBeVisible({ timeout: 15_000 });
		await expect(page.getByRole('button', { name: /Browse Artist/ })).toBeVisible();

		await page.getByRole('button', { name: /Browse Artist/ }).click();
		await expect(page).toHaveURL(/\/artists\/3/);
		await expect(page.getByRole('heading', { name: 'Browse Artist' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Back to Search' })).toBeVisible();

		await page.getByRole('link', { name: 'Back to Search' }).click();
		await expect(page).toHaveURL(/\/search\?q=browse/);
		await expect(page.getByText('Results for “browse”')).toBeVisible();
	});
});
