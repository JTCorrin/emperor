import { expect, test, type Page, type Route } from '@playwright/test';
import { MEDIA_SERVER_BASE_URL, gotoConnected } from './helpers';

const baseUrl = MEDIA_SERVER_BASE_URL;

const pingFixture = { ok: true as const };

let libraryStatus = {
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

let track = {
	id: 42,
	kind: 'audio' as const,
	path: 'Artist/Album/track.mp3',
	filename: 'track.mp3',
	artist: 'Browse Artist',
	album: 'Browse Album',
	title: 'Browse Track',
	release_date: null as string | null,
	genre: null as string | null,
	track_number: 1,
	disc_number: 1,
	album_id: 7 as number | null,
	cover_id: null as number | null,
	overridden_fields: [] as string[]
};

let album = {
	id: 7,
	name: 'Browse Album',
	artist: 'Browse Artist',
	artist_id: 3,
	track_count: 1,
	release_date: '2024' as string | null,
	genre: null as string | null,
	cover_id: null as number | null
};

async function fulfillJson(route: Route, status: number, body: unknown) {
	await route.fulfill({
		status,
		contentType: 'application/json',
		body: JSON.stringify(body)
	});
}

async function stubMetadataApis(page: Page, options: { scanBusy?: boolean } = {}) {
	await page.route(
		(url) => String(url).startsWith(baseUrl),
		async (route) => {
			const request = route.request();
			const url = new URL(request.url());
			const path = url.pathname;
			const method = request.method();

			if (path === '/api/ping') {
				return fulfillJson(route, 200, pingFixture);
			}
			if (path === '/api/library/status') {
				return fulfillJson(route, 200, libraryStatus);
			}
			if (path === '/api/library/scan' && method === 'POST') {
				if (options.scanBusy) {
					return fulfillJson(route, 409, { error: 'scan_in_progress' });
				}
				libraryStatus = { ...libraryStatus, scanning: true };
				return route.fulfill({ status: 202, body: '' });
			}
			if (path === '/api/playlists') {
				return fulfillJson(route, 200, { items: [], total: 0, limit: 1, offset: 0 });
			}
			if (path === '/api/tracks' && method === 'GET') {
				return fulfillJson(route, 200, {
					items: [track],
					total: 1,
					limit: 50,
					offset: 0
				});
			}
			if (path === '/api/tracks/42' && method === 'GET') {
				return fulfillJson(route, 200, track);
			}
			if (path === '/api/tracks/42' && method === 'PATCH') {
				const body = request.postDataJSON() as Record<string, unknown>;
				track = {
					...track,
					...(typeof body.title === 'string' ? { title: body.title } : {}),
					overridden_fields: Object.keys(body)
				};
				return fulfillJson(route, 200, track);
			}
			if (path === '/api/albums' && method === 'GET') {
				return fulfillJson(route, 200, {
					items: [album],
					total: 1,
					limit: 50,
					offset: 0
				});
			}
			if (path === '/api/albums/7' && method === 'GET') {
				if (album.name === 'Regroup Me') {
					return fulfillJson(route, 404, { error: 'not_found' });
				}
				return fulfillJson(route, 200, album);
			}
			if (path === '/api/albums/7' && method === 'PATCH') {
				const body = request.postDataJSON() as Record<string, unknown>;
				album = {
					...album,
					...(typeof body.name === 'string' ? { name: body.name } : {})
				};
				return fulfillJson(route, 200, { updated_track_count: 1 });
			}
			if (path === '/api/albums/7/tracks') {
				return fulfillJson(route, 200, {
					items: [track],
					total: 1,
					limit: 50,
					offset: 0
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

test.describe('metadata and library management', () => {
	test.beforeEach(() => {
		libraryStatus = {
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
		track = {
			id: 42,
			kind: 'audio',
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
			cover_id: null,
			overridden_fields: []
		};
		album = {
			id: 7,
			name: 'Browse Album',
			artist: 'Browse Artist',
			artist_id: 3,
			track_count: 1,
			release_date: '2024',
			genre: null,
			cover_id: null
		};
	});

	test('edits a track title from album detail', async ({ page }) => {
		await stubMetadataApis(page);
		await connect(page);

		await page.goto('/albums/7');
		await expect(page.getByRole('heading', { name: 'Browse Album' })).toBeVisible();
		await page.getByRole('button', { name: 'Edit Browse Track' }).click();
		await page.getByLabel('Title', { exact: true }).fill('Corrected Title');
		await page.getByRole('button', { name: 'Save' }).click();

		await expect(page.getByRole('button', { name: 'Edit Corrected Title' })).toBeVisible();
	});

	test('redirects safely when album edit regroups the id', async ({ page }) => {
		await stubMetadataApis(page);
		await connect(page);
		await page.goto('/albums/7');
		await page.getByRole('button', { name: 'Edit album' }).click();
		await page.getByLabel('Name', { exact: true }).fill('Regroup Me');
		await page.getByRole('button', { name: 'Save' }).click();

		await expect(page).toHaveURL(/\/albums\/?$/);
		await expect(page.getByRole('status')).toContainText(/regrouped/i);
		await expect(page.getByRole('heading', { name: 'Albums' })).toBeVisible();
	});

	test('starts a library scan and shows Scanning status', async ({ page }) => {
		await stubMetadataApis(page);
		await connect(page);
		await page.goto('/connect');

		await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
		await page.getByRole('button', { name: 'Rescan', exact: true }).click();
		await expect(page.getByText(/Scanning…/)).toBeVisible();
		await expect(page.getByText('Yes').first()).toBeVisible();
	});

	test('shows busy copy when scan returns 409', async ({ page }) => {
		await stubMetadataApis(page, { scanBusy: true });
		await connect(page);
		await page.goto('/connect');

		await page.getByRole('button', { name: 'Rescan', exact: true }).click();
		await expect(page.getByRole('alert')).toContainText(/already in progress/i);
	});

	test('keeps Songs usable with edit affordance', async ({ page }) => {
		await stubMetadataApis(page);
		await connect(page);
		await page.goto('/songs');
		await expect(page.getByRole('heading', { name: 'Songs' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Edit Browse Track' })).toBeVisible();
		await page
			.getByRole('button', { name: /Browse Track/ })
			.first()
			.click();
		await expect(page.getByText('Browse Track').first()).toBeVisible();
	});
});
