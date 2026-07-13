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
	searchResponseFixture,
	trackFixture,
	trackPageFixture
} from '$lib/test/fixtures';

const baseUrl = 'http://192.168.5.111:8080';

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
