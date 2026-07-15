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
	album_id: 7,
	cover_id: null as number | null,
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
			if (path === '/api/playlists') {
				return fulfillJson(route, 200, { items: [], total: 0, limit: 1, offset: 0 });
			}
			if (path === '/api/favourites') {
				return fulfillJson(route, 200, { items: [], total: 0, limit: 50, offset: 0 });
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
				const q = new URL(route.request().url()).searchParams.get('q') ?? '';
				return fulfillJson(route, 200, {
					q,
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
	await gotoConnected(page, '/');
}

test.describe('browse and search', () => {
	test('opens an album from the grid and plays a track', async ({ page }) => {
		await stubBrowseApis(page);
		await connect(page);

		await page.goto('/albums');
		await expect(page.getByRole('button', { name: /Browse Album/ })).toBeVisible({
			timeout: 15_000
		});
		await page.getByRole('button', { name: /Browse Album/ }).click();

		await expect(page.getByRole('heading', { name: 'Browse Album' })).toBeVisible();
		await page
			.getByRole('button', { name: /Browse Track/ })
			.first()
			.click();
		await expect(page.getByLabel('Now playing')).toContainText('Browse Track');
	});

	test('shows search results for a linkable query and plays a track', async ({ page }) => {
		await stubBrowseApis(page);
		await connect(page);

		await page.goto('/search?q=browse');
		await expect(page.getByText('Results for “browse”')).toBeVisible({ timeout: 15_000 });
		await expect(page.getByRole('button', { name: /Browse Track/ }).first()).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Artists' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Albums' })).toBeVisible();
		await page
			.getByRole('button', { name: /Browse Track/ })
			.first()
			.click();
		await expect(page.getByLabel('Now playing')).toContainText('Browse Track');
	});

	test('opens artist from the sticky player via search resolve', async ({ page }) => {
		await stubBrowseApis(page);
		await connect(page);

		await page.goto('/albums/7');
		await page
			.getByRole('button', { name: /Browse Track/ })
			.first()
			.click();
		await expect(page.getByLabel('Now playing')).toContainText('Browse Track');
		await page.getByRole('button', { name: 'Open artist Browse Artist' }).click();
		await expect(page).toHaveURL(/\/artists\/3/);
		await expect(page.getByRole('heading', { name: 'Browse Artist' })).toBeVisible();
	});

	test('keeps navigation and the player usable on a narrow phone', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 700 });
		await stubBrowseApis(page);
		await connect(page);

		const logo = page.getByRole('img', { name: 'Emperor' });
		const search = page.getByRole('search');
		const navigation = page.getByRole('navigation', { name: 'Primary' });
		await expect(logo).toBeVisible();
		await expect(search).toBeVisible();
		await expect(navigation.getByRole('link')).toHaveCount(4);
		await expect(navigation.getByRole('link', { name: 'Podcasts' })).toHaveCount(0);

		const [logoBox, searchBox] = await Promise.all([logo.boundingBox(), search.boundingBox()]);
		expect(logoBox).not.toBeNull();
		expect(searchBox).not.toBeNull();
		expect(searchBox!.y).toBeGreaterThanOrEqual(logoBox!.y + logoBox!.height);

		expect(await navigation.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
			true
		);
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= document.documentElement.clientWidth
			)
		).toBe(true);

		await page.goto('/albums/7');
		await page
			.getByRole('button', { name: /Browse Track/ })
			.first()
			.click();

		const player = page.getByLabel('Now playing');
		await expect(player).toBeVisible();
		for (const name of [
			'Shuffle off',
			'Previous track',
			'Next track',
			'Repeat off',
			'Add Browse Track to favourites',
			'More actions'
		]) {
			const control = page.getByRole('button', { name, exact: true });
			await expect(control).toBeVisible();
			const box = await control.boundingBox();
			expect(box).not.toBeNull();
			expect(box!.x).toBeGreaterThanOrEqual(0);
			expect(box!.x + box!.width).toBeLessThanOrEqual(320);
		}
		const playPause = page.getByRole('button', { name: /^(Play|Pause)$/ });
		await expect(playPause).toBeVisible();
		const playPauseBox = await playPause.boundingBox();
		expect(playPauseBox).not.toBeNull();
		expect(playPauseBox!.x).toBeGreaterThanOrEqual(0);
		expect(playPauseBox!.x + playPauseBox!.width).toBeLessThanOrEqual(320);

		await expect(page.getByRole('slider', { name: 'Seek' })).toBeVisible();
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= document.documentElement.clientWidth
			)
		).toBe(true);
		expect(
			await page.locator('main').evaluate((main) => {
				const playerWrapper = document.querySelector('[aria-label="Now playing"]')?.parentElement;
				if (!playerWrapper) return false;
				return (
					Number.parseFloat(getComputedStyle(main).paddingBottom) >= playerWrapper.clientHeight
				);
			})
		).toBe(true);

		await page.getByRole('button', { name: 'More actions' }).click();
		const menu = page.getByRole('menu');
		await expect(menu).toBeVisible();
		const menuBox = await menu.boundingBox();
		expect(menuBox).not.toBeNull();
		expect(menuBox!.x).toBeGreaterThanOrEqual(0);
		expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(320);
	});
});
