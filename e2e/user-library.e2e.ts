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
	artist: 'Lib Artist',
	album: 'Lib Album',
	title: 'Lib Track',
	release_date: null,
	genre: null,
	track_number: 1,
	disc_number: 1,
	overridden_fields: [] as string[]
};

const playlist = {
	id: 9,
	name: 'Drive Mix',
	track_count: 1,
	created_unix: 1_710_000_000,
	updated_unix: 1_710_000_100
};

const trackPage = { items: [track], total: 1, limit: 50, offset: 0 };
const playlistPage = { items: [playlist], total: 1, limit: 50, offset: 0 };
const historyPage = {
	items: [{ track, played_unix: 1_710_000_500 }],
	total: 1,
	limit: 50,
	offset: 0
};

async function fulfillJson(route: Route, status: number, body: unknown) {
	await route.fulfill({
		status,
		contentType: 'application/json',
		body: JSON.stringify(body)
	});
}

async function stubUserDbApis(page: Page, opts: { userDb: boolean }) {
	let playlists = [...playlistPage.items];
	let favourites = [] as (typeof track)[];

	await page.route(
		(url) => String(url).startsWith(baseUrl),
		async (route) => {
			const req = route.request();
			const path = new URL(req.url()).pathname;
			const method = req.method();

			if (path === '/api/ping') {
				return fulfillJson(route, 200, pingFixture);
			}
			if (path === '/api/library/status') {
				return fulfillJson(route, 200, libraryStatusFixture);
			}
			if (!opts.userDb) {
				if (
					path.startsWith('/api/playlists') ||
					path.startsWith('/api/favourites') ||
					path.startsWith('/api/history') ||
					path === '/api/discover/recently-played'
				) {
					return fulfillJson(route, 400, { error: 'no_user_db' });
				}
			}
			if (path === '/api/playlists' && method === 'GET') {
				return fulfillJson(route, 200, {
					items: playlists,
					total: playlists.length,
					limit: 50,
					offset: 0
				});
			}
			if (path === '/api/playlists' && method === 'POST') {
				const body = JSON.parse(req.postData() ?? '{}') as { name?: string };
				const created = {
					...playlist,
					id: 99,
					name: body.name ?? 'Untitled',
					track_count: 0
				};
				playlists = [created, ...playlists];
				return fulfillJson(route, 201, created);
			}
			if (path === '/api/playlists/9' || path === '/api/playlists/99') {
				const id = Number(path.split('/').pop());
				const found = playlists.find((p) => p.id === id) ?? { ...playlist, id };
				if (method === 'GET') return fulfillJson(route, 200, found);
				if (method === 'DELETE') {
					playlists = playlists.filter((p) => p.id !== id);
					return fulfillJson(route, 200, { ok: true });
				}
			}
			if (path === '/api/playlists/9/tracks' || path === '/api/playlists/99/tracks') {
				if (method === 'GET') return fulfillJson(route, 200, trackPage);
				if (method === 'PUT') return fulfillJson(route, 200, {});
			}
			if (path === '/api/favourites' && method === 'GET') {
				return fulfillJson(route, 200, {
					items: favourites,
					total: favourites.length,
					limit: 200,
					offset: 0
				});
			}
			if (path === '/api/favourites/42' && method === 'PUT') {
				favourites = [track];
				return fulfillJson(route, 200, {});
			}
			if (path === '/api/favourites/42' && method === 'DELETE') {
				favourites = [];
				return fulfillJson(route, 200, {});
			}
			if (path === '/api/history' && method === 'GET') {
				return fulfillJson(route, 200, historyPage);
			}
			if (path === '/api/history' && method === 'POST') {
				return fulfillJson(route, 200, {});
			}
			if (path === '/api/tracks') {
				return fulfillJson(route, 200, trackPage);
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

test.describe('user library', () => {
	test('creates a playlist, opens detail, and plays a track', async ({ page }) => {
		await stubUserDbApis(page, { userDb: true });
		await connect(page);

		await page.goto('/playlists');
		await expect(page.getByRole('heading', { name: 'Playlists' })).toBeVisible();
		await page.getByRole('button', { name: 'Create playlist' }).click();
		await expect(page.getByRole('dialog')).toBeVisible();
		await page.getByLabel('Name').fill('Night Drive');
		await page.getByRole('button', { name: 'Create', exact: true }).click();

		await expect(page.locator('#rename-playlist')).toHaveValue('Night Drive', { timeout: 15_000 });
		await expect(page.getByRole('button', { name: /Lib Track Lib Artist/ })).toBeVisible({
			timeout: 15_000
		});
		await page.getByRole('button', { name: /Lib Track Lib Artist/ }).click();
		await expect(page.getByLabel('Now playing')).toContainText('Lib Track');
	});

	test('toggles a favourite from Songs', async ({ page }) => {
		await stubUserDbApis(page, { userDb: true });
		await connect(page);

		await page.goto('/songs');
		await expect(page.getByRole('button', { name: /Lib Track Lib Artist/ })).toBeVisible({
			timeout: 15_000
		});
		await page.getByRole('button', { name: /Add Lib Track to favourites/ }).click();
		await expect(
			page.getByRole('button', { name: /Remove Lib Track from favourites/ })
		).toBeVisible();
	});

	test('explains missing user db on playlists without breaking Songs', async ({ page }) => {
		await stubUserDbApis(page, { userDb: false });
		await connect(page);

		await page.goto('/playlists');
		await expect(page.getByText(/need a media-server user database/i)).toBeVisible();

		await page.goto('/songs');
		await expect(page.getByRole('heading', { name: 'Songs' })).toBeVisible();
		await expect(page.getByRole('button', { name: /Lib Track Lib Artist/ })).toBeVisible({
			timeout: 15_000
		});
	});

	test('renders history timestamps', async ({ page }) => {
		await stubUserDbApis(page, { userDb: true });
		await connect(page);

		await page.goto('/history');
		await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
		await expect(page.getByRole('button', { name: /Lib Track Lib Artist/ })).toBeVisible({
			timeout: 15_000
		});
	});
});
