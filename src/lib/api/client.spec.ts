import { describe, expect, it } from 'vitest';
import { createMediaServerClient, MediaServerRequestError } from '$lib/api/client';
import {
	createFetchStub,
	errorResponse,
	jsonResponse,
	libraryStatusFixture,
	pingFixture,
	playlistFixture,
	playlistPageFixture,
	albumFixture,
	albumPageFixture,
	artistFixture,
	artistPageFixture,
	historyItemFixture,
	historyPageFixture,
	searchResponseFixture,
	trackFixture,
	trackPageFixture
} from '$lib/test/fixtures';

const baseUrl = 'http://127.0.0.1:8080';

describe('createMediaServerClient', () => {
	it('pings a healthy server', async () => {
		const client = createMediaServerClient({
			baseUrl,
			fetch: createFetchStub([
				{ url: `${baseUrl}/api/ping`, response: jsonResponse(pingFixture()) }
			])
		});

		await expect(client.ping()).resolves.toEqual({ ok: true });
		expect(client.baseUrl).toBe(baseUrl);
	});

	it('returns validated library status', async () => {
		const status = libraryStatusFixture({ track_count: 8080 });
		const client = createMediaServerClient({
			baseUrl,
			fetch: createFetchStub([
				{ url: `${baseUrl}/api/library/status`, response: jsonResponse(status) }
			])
		});

		await expect(client.getLibraryStatus()).resolves.toEqual(status);
	});

	it('returns discover random tracks', async () => {
		const page = trackPageFixture([trackFixture({ id: 9, title: 'Random' })]);
		const client = createMediaServerClient({
			baseUrl,
			fetch: createFetchStub([
				{ url: `${baseUrl}/api/discover/random`, response: jsonResponse(page) }
			])
		});

		await expect(client.getDiscoverRandom({ limit: 10 })).resolves.toEqual(page);
	});

	it('returns recent, recently played, playlists, and favourites', async () => {
		const tracks = trackPageFixture([trackFixture({ id: 3 })]);
		const playlists = playlistPageFixture([playlistFixture({ id: 8, name: 'Drive' })]);
		const client = createMediaServerClient({
			baseUrl,
			fetch: createFetchStub([
				{ url: `${baseUrl}/api/discover/recent`, response: jsonResponse(tracks) },
				{ url: `${baseUrl}/api/discover/recently-played`, response: jsonResponse(tracks) },
				{ url: `${baseUrl}/api/playlists`, response: jsonResponse(playlists) },
				{ url: `${baseUrl}/api/favourites`, response: jsonResponse(tracks) }
			])
		});

		await expect(client.getDiscoverRecent()).resolves.toEqual(tracks);
		await expect(client.getRecentlyPlayed()).resolves.toEqual(tracks);
		await expect(client.getPlaylists()).resolves.toEqual(playlists);
		await expect(client.getFavourites()).resolves.toEqual(tracks);
	});

	it('returns tracks, artists, albums, detail, and search', async () => {
		const tracks = trackPageFixture([trackFixture({ id: 11, title: 'Browse Track' })]);
		const artists = artistPageFixture([artistFixture({ id: 2, name: 'Browse Artist' })]);
		const albums = albumPageFixture([albumFixture({ id: 4, name: 'Browse Album' })]);
		const artist = artistFixture({ id: 2, name: 'Browse Artist' });
		const album = albumFixture({ id: 4, name: 'Browse Album' });
		const search = searchResponseFixture({
			q: 'browse',
			tracks,
			artists,
			albums
		});
		const client = createMediaServerClient({
			baseUrl,
			fetch: createFetchStub([
				{ url: `${baseUrl}/api/tracks`, response: jsonResponse(tracks) },
				{ url: `${baseUrl}/api/artists`, response: jsonResponse(artists) },
				{ url: `${baseUrl}/api/artists/2`, response: jsonResponse(artist) },
				{ url: `${baseUrl}/api/artists/2/albums`, response: jsonResponse(albums) },
				{ url: `${baseUrl}/api/albums`, response: jsonResponse(albums) },
				{ url: `${baseUrl}/api/albums/4`, response: jsonResponse(album) },
				{ url: `${baseUrl}/api/albums/4/tracks`, response: jsonResponse(tracks) },
				{ url: `${baseUrl}/api/search`, response: jsonResponse(search) }
			])
		});

		await expect(client.getTracks({ limit: 50 })).resolves.toEqual(tracks);
		await expect(client.getArtists()).resolves.toEqual(artists);
		await expect(client.getArtist(2)).resolves.toEqual(artist);
		await expect(client.getArtistAlbums(2)).resolves.toEqual(albums);
		await expect(client.getAlbums()).resolves.toEqual(albums);
		await expect(client.getAlbum(4)).resolves.toEqual(album);
		await expect(client.getAlbumTracks(4)).resolves.toEqual(tracks);
		await expect(client.search({ q: 'browse', limit: 20 })).resolves.toEqual(search);
	});

	it('maps 404 on missing album', async () => {
		const client = createMediaServerClient({
			baseUrl,
			fetch: createFetchStub([
				{ url: `${baseUrl}/api/albums/999`, response: errorResponse(404, 'not_found') }
			])
		});

		await expect(client.getAlbum(999)).rejects.toMatchObject({
			error: { kind: 'http', status: 404 }
		});
	});

	it('maps no_user_db on favourites', async () => {
		const client = createMediaServerClient({
			baseUrl,
			fetch: createFetchStub([
				{ url: `${baseUrl}/api/favourites`, response: errorResponse(400, 'no_user_db') }
			])
		});

		await expect(client.getFavourites()).rejects.toMatchObject({
			error: { kind: 'no_user_db' }
		});
	});

	it('creates, updates, deletes playlists and replaces tracks', async () => {
		const created = playlistFixture({ id: 5, name: 'Road' });
		const renamed = playlistFixture({ id: 5, name: 'Highway' });
		const tracks = trackPageFixture([trackFixture({ id: 11 })]);
		const history = historyPageFixture([historyItemFixture()]);
		let createBody: string | null = null;
		let putBody: string | null = null;

		const client = createMediaServerClient({
			baseUrl,
			fetch: async (input, init) => {
				const url = String(input);
				const method = init?.method ?? 'GET';
				if (url === `${baseUrl}/api/playlists` && method === 'POST') {
					createBody = String(init?.body);
					return jsonResponse(created, { status: 201 });
				}
				if (url === `${baseUrl}/api/playlists/5` && method === 'GET') {
					return jsonResponse(created);
				}
				if (url === `${baseUrl}/api/playlists/5` && method === 'PATCH') {
					return jsonResponse(renamed);
				}
				if (url === `${baseUrl}/api/playlists/5` && method === 'DELETE') {
					return jsonResponse({ ok: true });
				}
				if (url.split('?')[0] === `${baseUrl}/api/playlists/5/tracks` && method === 'GET') {
					return jsonResponse(tracks);
				}
				if (url === `${baseUrl}/api/playlists/5/tracks` && method === 'PUT') {
					putBody = String(init?.body);
					return jsonResponse({}, { status: 200 });
				}
				if (url === `${baseUrl}/api/favourites/11` && method === 'PUT') {
					return jsonResponse({}, { status: 200 });
				}
				if (url === `${baseUrl}/api/favourites/11` && method === 'DELETE') {
					return jsonResponse({}, { status: 200 });
				}
				if (url.split('?')[0] === `${baseUrl}/api/history` && method === 'GET') {
					return jsonResponse(history);
				}
				return errorResponse(404, 'not_found');
			}
		});

		await expect(client.createPlaylist('Road')).resolves.toEqual(created);
		expect(createBody).toBe(JSON.stringify({ name: 'Road' }));
		await expect(client.getPlaylist(5)).resolves.toEqual(created);
		await expect(client.updatePlaylist(5, 'Highway')).resolves.toEqual(renamed);
		await expect(client.getPlaylistTracks(5)).resolves.toEqual(tracks);
		await expect(client.setPlaylistTracks(5, [11, 12])).resolves.toBeUndefined();
		expect(putBody).toBe(JSON.stringify({ track_ids: [11, 12] }));
		await expect(client.deletePlaylist(5)).resolves.toBeUndefined();
		await expect(client.addFavourite(11)).resolves.toBeUndefined();
		await expect(client.removeFavourite(11)).resolves.toBeUndefined();
		await expect(client.getHistory({ limit: 20 })).resolves.toEqual(history);
	});

	it('maps no_user_db on playlist create', async () => {
		const client = createMediaServerClient({
			baseUrl,
			fetch: createFetchStub([
				{ url: `${baseUrl}/api/playlists`, response: errorResponse(400, 'no_user_db') }
			])
		});

		await expect(client.createPlaylist('X')).rejects.toMatchObject({
			error: { kind: 'no_user_db' }
		});
	});

	it('maps 409 on playlist track replace conflict', async () => {
		const client = createMediaServerClient({
			baseUrl,
			fetch: createFetchStub([
				{
					url: `${baseUrl}/api/playlists/1/tracks`,
					response: errorResponse(409, 'conflict')
				}
			])
		});

		await expect(client.setPlaylistTracks(1, [1])).rejects.toMatchObject({
			error: { kind: 'http', status: 409 }
		});
	});

	it('gets a track and patches metadata', async () => {
		const track = trackFixture({ id: 11, title: 'Original' });
		const updated = trackFixture({ id: 11, title: 'Corrected', overridden_fields: ['title'] });
		let patchBody: string | null = null;
		const client = createMediaServerClient({
			baseUrl,
			fetch: async (input, init) => {
				const url = String(input);
				const method = init?.method ?? 'GET';
				if (url === `${baseUrl}/api/tracks/11` && method === 'GET') {
					return jsonResponse(track);
				}
				if (url === `${baseUrl}/api/tracks/11` && method === 'PATCH') {
					patchBody = String(init?.body);
					return jsonResponse(updated);
				}
				return errorResponse(404, 'not_found');
			}
		});

		await expect(client.getTrack(11)).resolves.toEqual(track);
		await expect(client.updateTrack(11, { title: 'Corrected', genre: null })).resolves.toEqual(
			updated
		);
		expect(patchBody).toBe(JSON.stringify({ title: 'Corrected', genre: null }));
	});

	it('patches album metadata and starts library scans', async () => {
		let albumBody: string | null = null;
		let scanUrl: string | null = null;
		const client = createMediaServerClient({
			baseUrl,
			fetch: async (input, init) => {
				const url = String(input);
				const method = init?.method ?? 'GET';
				if (url === `${baseUrl}/api/albums/4` && method === 'PATCH') {
					albumBody = String(init?.body);
					return jsonResponse({ updated_track_count: 3 });
				}
				if (url.split('?')[0] === `${baseUrl}/api/library/scan` && method === 'POST') {
					scanUrl = url;
					return new Response('', { status: 202 });
				}
				return errorResponse(404, 'not_found');
			}
		});

		await expect(client.updateAlbum(4, { name: 'Renamed', release_date: null })).resolves.toEqual({
			updated_track_count: 3
		});
		expect(albumBody).toBe(JSON.stringify({ name: 'Renamed', release_date: null }));
		await expect(client.startLibraryScan()).resolves.toBeUndefined();
		expect(scanUrl).toBe(`${baseUrl}/api/library/scan`);
		await expect(client.startLibraryScan({ force: true })).resolves.toBeUndefined();
		expect(scanUrl).toBe(`${baseUrl}/api/library/scan?force=1`);
	});

	it('uploads album cover with raw image body', async () => {
		const bytes = new Uint8Array([0xff, 0xd8, 0xff]);
		let contentType: string | null = null;
		let bodyBytes: ArrayBuffer | null = null;
		const client = createMediaServerClient({
			baseUrl,
			fetch: async (input, init) => {
				expect(String(input)).toBe(`${baseUrl}/api/albums/7/cover`);
				expect(init?.method).toBe('PUT');
				contentType = new Headers(init?.headers).get('Content-Type');
				const body = init?.body;
				if (body instanceof Blob) {
					bodyBytes = await body.arrayBuffer();
				}
				return jsonResponse(
					{ ok: true, path: 'Artist/Album/cover.jpg', scan: 'started' },
					{ status: 202 }
				);
			}
		});

		await expect(
			client.uploadAlbumCover(7, new Blob([bytes], { type: 'image/jpeg' }), 'image/jpeg')
		).resolves.toEqual({
			ok: true,
			path: 'Artist/Album/cover.jpg',
			scan: 'started'
		});
		expect(contentType).toBe('image/jpeg');
		expect(bodyBytes).toEqual(bytes.buffer);
	});

	it('maps 409 when a library scan is already running', async () => {
		const client = createMediaServerClient({
			baseUrl,
			fetch: createFetchStub([
				{
					url: `${baseUrl}/api/library/scan`,
					response: errorResponse(409, 'scan_in_progress')
				}
			])
		});

		await expect(client.startLibraryScan()).rejects.toMatchObject({
			error: { kind: 'http', status: 409, code: 'scan_in_progress' }
		});
	});

	it('records history for a track id', async () => {
		let body: string | null = null;
		const client = createMediaServerClient({
			baseUrl,
			fetch: async (input, init) => {
				expect(String(input)).toBe(`${baseUrl}/api/history`);
				expect(init?.method).toBe('POST');
				body = String(init?.body);
				return jsonResponse({}, { status: 200 });
			}
		});

		await expect(client.recordHistory(42)).resolves.toBeUndefined();
		expect(body).toBe(JSON.stringify({ track_id: 42 }));
	});

	it('maps no_user_db on history without crashing the client shape', async () => {
		const client = createMediaServerClient({
			baseUrl,
			fetch: createFetchStub([
				{ url: `${baseUrl}/api/history`, response: errorResponse(400, 'no_user_db') }
			])
		});

		await expect(client.recordHistory(1)).rejects.toMatchObject({
			error: { kind: 'no_user_db', code: 'no_user_db', status: 400 }
		});
	});

	it('normalizes no_user_db responses', async () => {
		const client = createMediaServerClient({
			baseUrl,
			fetch: createFetchStub([
				{ url: `${baseUrl}/api/ping`, response: errorResponse(400, 'no_user_db') }
			])
		});

		await expect(client.ping()).rejects.toMatchObject({
			error: { kind: 'no_user_db', code: 'no_user_db', status: 400 }
		});
	});

	it('rejects malformed JSON bodies', async () => {
		const client = createMediaServerClient({
			baseUrl,
			fetch: createFetchStub([
				{
					url: `${baseUrl}/api/ping`,
					response: () =>
						new Response('{not-json', {
							status: 200,
							headers: { 'Content-Type': 'application/json' }
						})
				}
			])
		});

		await expect(client.ping()).rejects.toBeInstanceOf(MediaServerRequestError);
		await expect(client.ping()).rejects.toMatchObject({ error: { kind: 'schema' } });
	});

	it('rejects responses that fail schema validation', async () => {
		const client = createMediaServerClient({
			baseUrl,
			fetch: createFetchStub([
				{ url: `${baseUrl}/api/ping`, response: jsonResponse({ ok: false }) }
			])
		});

		await expect(client.ping()).rejects.toMatchObject({ error: { kind: 'schema' } });
	});

	it('maps network failures', async () => {
		const client = createMediaServerClient({
			baseUrl,
			fetch: async () => {
				throw new TypeError('Failed to fetch');
			}
		});

		await expect(client.ping()).rejects.toMatchObject({ error: { kind: 'network' } });
	});

	it('maps aborted requests separately from network failures', async () => {
		const abort = new AbortController();
		abort.abort();
		const client = createMediaServerClient({
			baseUrl,
			fetch: async (_input, init) => {
				expect(init?.signal?.aborted).toBe(true);
				throw new DOMException('Aborted', 'AbortError');
			}
		});

		await expect(client.ping(abort.signal)).rejects.toMatchObject({ error: { kind: 'aborted' } });
	});

	it('maps non-OK HTTP responses', async () => {
		const client = createMediaServerClient({
			baseUrl,
			fetch: createFetchStub([
				{ url: `${baseUrl}/api/library/status`, response: errorResponse(500, 'encode_failed') }
			])
		});

		await expect(client.getLibraryStatus()).rejects.toMatchObject({
			error: { kind: 'http', status: 500, code: 'encode_failed' }
		});
	});
});
