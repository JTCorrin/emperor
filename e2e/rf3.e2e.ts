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
	track_count: 10,
	image_count: 2,
	artist_count: 1,
	album_count: 1
};

const track = {
	id: 42,
	kind: 'audio' as const,
	path: 'Artist/Album/track.mp3',
	filename: 'track.mp3',
	artist: 'Cover Artist',
	album: 'Cover Album',
	title: 'Cover Track',
	release_date: null,
	genre: null,
	track_number: 1,
	disc_number: 1,
	album_id: 7,
	cover_id: 55,
	overridden_fields: [] as string[]
};

const album = {
	id: 7,
	name: 'Cover Album',
	artist: 'Cover Artist',
	artist_id: 3,
	track_count: 1,
	release_date: null,
	genre: null,
	cover_id: 55 as number | null
};

const playlist = {
	id: 2,
	name: 'Road Mix',
	track_count: 0,
	created_unix: 1_710_000_000,
	updated_unix: 1_710_000_000
};

let playlistTrackIds: number[] = [];

async function fulfillJson(route: Route, status: number, body: unknown) {
	await route.fulfill({
		status,
		contentType: 'application/json',
		body: JSON.stringify(body)
	});
}

async function stubApis(page: Page, options: { userDb?: boolean } = { userDb: true }) {
	await page.route(
		(url) => String(url).startsWith(baseUrl),
		async (route) => {
			const request = route.request();
			const path = new URL(request.url()).pathname;
			const method = request.method();

			if (path === '/api/ping') return fulfillJson(route, 200, pingFixture);
			if (path === '/api/library/status') return fulfillJson(route, 200, libraryStatusFixture);

			if (path === '/api/playlists' && method === 'GET') {
				if (options.userDb === false) {
					return fulfillJson(route, 400, { error: 'no_user_db' });
				}
				return fulfillJson(route, 200, {
					items: [playlist],
					total: 1,
					limit: 200,
					offset: 0
				});
			}
			if (path === '/api/playlists/2/tracks' && method === 'GET') {
				const items = playlistTrackIds.map((id) =>
					id === track.id ? track : { ...track, id, title: `Track ${id}` }
				);
				return fulfillJson(route, 200, {
					items,
					total: items.length,
					limit: 200,
					offset: 0
				});
			}
			if (path === '/api/playlists/2/tracks' && method === 'PUT') {
				const body = request.postDataJSON() as { track_ids: number[] };
				playlistTrackIds = body.track_ids;
				playlist.track_count = playlistTrackIds.length;
				return fulfillJson(route, 200, {});
			}
			if (path === '/api/playlists/2' && method === 'GET') {
				return fulfillJson(route, 200, playlist);
			}
			if (path === '/api/tracks') {
				return fulfillJson(route, 200, {
					items: [track],
					total: 1,
					limit: 50,
					offset: 0
				});
			}
			if (path === '/api/search') {
				return fulfillJson(route, 200, {
					q: 'Cover',
					fuzzy: false,
					tracks: { items: [track], total: 1, limit: 50, offset: 0 },
					artists: { items: [], total: 0, limit: 50, offset: 0 },
					albums: { items: [album], total: 1, limit: 50, offset: 0 }
				});
			}
			if (path === '/api/favourites') {
				return fulfillJson(route, 200, { items: [], total: 0, limit: 50, offset: 0 });
			}
			if (path === '/api/discover/random' || path === '/api/discover/recent') {
				return fulfillJson(route, 200, {
					items: [track],
					total: 1,
					limit: 20,
					offset: 0
				});
			}
			if (path === '/api/discover/recently-played') {
				return fulfillJson(route, 200, {
					items: [track],
					total: 1,
					limit: 20,
					offset: 0
				});
			}
			if (path.startsWith('/cover/')) {
				return route.fulfill({
					status: 200,
					contentType: 'image/jpeg',
					body: Buffer.from([0xff, 0xd8, 0xff, 0xd9])
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

test.describe('RF3 add to playlist and player covers', () => {
	test.beforeEach(() => {
		playlistTrackIds = [];
		playlist.track_count = 0;
	});

	test('adds a track from Songs into a playlist', async ({ page }) => {
		await stubApis(page);
		await gotoConnected(page, '/songs');

		await page.getByRole('button', { name: 'Add Cover Track to playlist' }).click();
		await expect(page.getByRole('heading', { name: 'Add to playlist' })).toBeVisible();
		await page.getByRole('button', { name: /Road Mix/ }).click();
		await expect(page.getByRole('heading', { name: 'Add to playlist' })).toHaveCount(0);

		await page.goto('/playlists/2');
		await expect(page.getByText('Cover Track', { exact: true })).toBeVisible({
			timeout: 15_000
		});
	});

	test('shows album cover in the sticky player after play', async ({ page }) => {
		await stubApis(page);
		await gotoConnected(page, '/songs');

		await page
			.getByRole('button', { name: /Cover Track/ })
			.first()
			.click();
		await expect(page.getByLabel('Now playing')).toBeVisible();
		await expect(page.getByLabel('Now playing').locator('img')).toBeVisible({ timeout: 15_000 });
	});

	test('adds from now playing more menu', async ({ page }) => {
		await stubApis(page);
		await gotoConnected(page, '/songs');

		await page
			.getByRole('button', { name: /Cover Track/ })
			.first()
			.click();
		await page.getByRole('button', { name: 'Expand player: Cover Track' }).click();
		await page.getByRole('button', { name: 'More actions' }).click();
		await page.getByRole('menuitem', { name: 'Add to playlist' }).click();
		await expect(page.getByRole('heading', { name: 'Add to playlist' })).toBeVisible();
		await page.getByRole('button', { name: /Road Mix/ }).click();
		await expect(page.getByRole('heading', { name: 'Add to playlist' })).toHaveCount(0);
	});

	test('hides add affordances without user db', async ({ page }) => {
		await stubApis(page, { userDb: false });
		await gotoConnected(page, '/songs');

		await expect(page.getByRole('button', { name: 'Add Cover Track to playlist' })).toHaveCount(0);
	});
});
