import { expect, test, type Page, type Route } from '@playwright/test';
import { MEDIA_SERVER_BASE_URL, gotoConnected, waitForAutoConnect } from './helpers';

const baseUrl = MEDIA_SERVER_BASE_URL;
const CAA = 'https://coverartarchive.org';

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
			const request = route.request();
			const url = new URL(request.url());
			const path = url.pathname;
			const method = request.method();

			if (path === '/api/ping') return fulfillJson(route, 200, pingFixture);
			if (path === '/api/library/status') return fulfillJson(route, 200, libraryStatus);
			if (path === '/api/playlists') {
				return fulfillJson(route, 200, { items: [], total: 0, limit: 1, offset: 0 });
			}
			if (path === '/api/albums/7' && method === 'GET') {
				return fulfillJson(route, 200, album);
			}
			if (path === '/api/albums/7' && method === 'PATCH') {
				return fulfillJson(route, 200, { updated_track_count: 1 });
			}
			if (path === '/api/albums/7/cover' && method === 'PUT') {
				album = { ...album, cover_id: 55 };
				return fulfillJson(route, 200, {
					ok: true,
					path: 'Artist/Album/cover.jpg',
					cover_id: 55
				});
			}
			if (path === '/api/albums/7/tracks') {
				return fulfillJson(route, 200, {
					items: [track],
					total: 1,
					limit: 50,
					offset: 0
				});
			}
			if (path === '/api/tracks/42' && method === 'PATCH') {
				return fulfillJson(route, 200, track);
			}
			if (path.startsWith('/stream/') || path.startsWith('/cover/')) {
				return route.fulfill({
					status: 200,
					contentType: path.startsWith('/cover/') ? 'image/jpeg' : 'audio/mpeg',
					body: Buffer.from([])
				});
			}

			await route.fallback();
		}
	);
}

/** Never hit live MusicBrainz / CAA. */
async function stubMusicBrainz(page: Page) {
	await page.route('https://musicbrainz.org/**', async (route) => {
		const url = new URL(route.request().url());
		if (url.pathname.includes('/recording')) {
			return fulfillJson(route, 200, {
				recordings: [
					{
						id: 'rec-mb',
						title: 'Corrected Title',
						'artist-credit': [{ name: 'Corrected Artist' }],
						releases: [
							{
								id: 'rel-mb',
								title: 'Corrected Album',
								date: '2020-01-02',
								media: [{ position: 1, track: [{ position: 4 }] }]
							}
						],
						tags: [{ name: 'indie', count: 3 }]
					}
				]
			});
		}
		if (url.pathname.includes('/release')) {
			return fulfillJson(route, 200, {
				releases: [
					{
						id: 'rel-mb',
						title: 'Corrected Album',
						date: '2020',
						'artist-credit': [{ name: 'Corrected Artist' }],
						tags: [{ name: 'indie', count: 2 }]
					}
				]
			});
		}
		return fulfillJson(route, 404, { error: 'not_found' });
	});

	await page.route(`${CAA}/**`, async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'image/jpeg',
			body: Buffer.from([0xff, 0xd8, 0xff, 0xd9])
		});
	});
}

test.describe('MusicBrainz settings and lookup', () => {
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
	});

	async function clearMbSettings(page: Page) {
		await page.evaluate(() => {
			localStorage.removeItem('emperor:musicbrainz-contact');
			localStorage.removeItem('emperor:musicbrainz-apply-cover');
		});
	}

	test('Connect links to Settings; contact gates Lookup', async ({ page }) => {
		await stubMediaServer(page);
		await stubMusicBrainz(page);
		await gotoConnected(page, '/connect');
		await clearMbSettings(page);

		await page.getByRole('link', { name: 'Settings' }).click();
		await expect(page).toHaveURL(/\/settings\/?$/);
		await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

		await page.getByLabel('MusicBrainz contact').fill('ci@example.com');
		await page.getByRole('button', { name: 'Save settings' }).click();
		await expect(page.getByRole('status')).toContainText(/saved locally/i);

		await page.goto('/albums/7');
		await page.getByRole('button', { name: 'Edit album' }).click();
		await expect(page.getByRole('button', { name: 'Lookup MusicBrainz' })).toBeVisible();
		await page.getByRole('button', { name: 'Lookup MusicBrainz' }).click();
		await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Corrected Album');
		await expect(page.getByLabel('Artist', { exact: true })).toHaveValue('Corrected Artist');

		await page.getByRole('button', { name: 'Apply cover' }).click();
		await expect(page.getByRole('status')).toContainText(/cover applied/i);
		await expect(page.getByRole('img', { name: /cover art for browse album/i })).toHaveAttribute(
			'src',
			`${baseUrl}/cover/55?v=1`
		);
	});

	test('without contact, metadata dialog deep-links to Settings', async ({ page }) => {
		await stubMediaServer(page);
		await stubMusicBrainz(page);
		await gotoConnected(page, '/albums/7');
		await clearMbSettings(page);
		await page.reload();
		await waitForAutoConnect(page);
		await page.getByRole('button', { name: 'Edit album' }).click();
		await expect(
			page.getByRole('link', { name: 'Set MusicBrainz contact in Settings' })
		).toBeVisible();
		await page.getByRole('link', { name: 'Set MusicBrainz contact in Settings' }).click();
		await expect(page).toHaveURL(/\/settings\/?$/);
	});
});
