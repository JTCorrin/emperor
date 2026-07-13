import { describe, expect, it } from 'vitest';
import { createMediaServerClient } from '$lib/api/client';
import { HomeShelvesController } from '$lib/features/home/homeShelves.svelte';
import {
	createFetchStub,
	errorResponse,
	jsonResponse,
	playlistPageFixture,
	trackFixture,
	trackPageFixture
} from '$lib/test/fixtures';

const baseUrl = 'http://127.0.0.1:8080';

describe('HomeShelvesController', () => {
	it('loads shelves independently and keeps catalog shelves when user-db is unavailable', async () => {
		const tracks = trackPageFixture([
			trackFixture({ id: 1, title: 'Discover Track' }),
			trackFixture({ id: 2, title: 'Recent Track' })
		]);
		const controller = new HomeShelvesController({
			getBaseUrl: () => baseUrl,
			fetch: createFetchStub([
				{ url: `${baseUrl}/api/discover/random`, response: jsonResponse(tracks) },
				{ url: `${baseUrl}/api/discover/recent`, response: jsonResponse(tracks) },
				{
					url: `${baseUrl}/api/discover/recently-played`,
					response: errorResponse(400, 'no_user_db')
				},
				{ url: `${baseUrl}/api/playlists`, response: errorResponse(400, 'no_user_db') },
				{ url: `${baseUrl}/api/favourites`, response: errorResponse(400, 'no_user_db') }
			]),
			createClient: createMediaServerClient
		});

		await controller.load();

		expect(controller.shelves.discover.status).toBe('ready');
		expect(controller.shelves.recent.status).toBe('ready');
		expect(controller.shelves.recentlyPlayed.status).toBe('unavailable');
		expect(controller.shelves.playlists.status).toBe('unavailable');
		expect(controller.shelves.favourites.status).toBe('unavailable');
	});

	it('keeps healthy shelves ready when one catalog shelf fails', async () => {
		const tracks = trackPageFixture([trackFixture({ id: 1 })]);
		const controller = new HomeShelvesController({
			getBaseUrl: () => baseUrl,
			fetch: createFetchStub([
				{ url: `${baseUrl}/api/discover/random`, response: errorResponse(500, 'failed') },
				{ url: `${baseUrl}/api/discover/recent`, response: jsonResponse(tracks) },
				{ url: `${baseUrl}/api/discover/recently-played`, response: jsonResponse(tracks) },
				{ url: `${baseUrl}/api/playlists`, response: jsonResponse(playlistPageFixture([])) },
				{ url: `${baseUrl}/api/favourites`, response: jsonResponse(tracks) }
			]),
			createClient: createMediaServerClient
		});

		await controller.load();

		expect(controller.shelves.discover.status).toBe('error');
		expect(controller.shelves.recent.status).toBe('ready');
		expect(controller.shelves.favourites.status).toBe('ready');
	});

	it('deduplicates recently played tracks while preserving recency order', async () => {
		const first = trackFixture({ id: 1, title: 'First' });
		const tracks = trackPageFixture([first, trackFixture({ id: 1, title: 'Duplicate' })]);
		const controller = new HomeShelvesController({
			getBaseUrl: () => baseUrl,
			fetch: createFetchStub([
				{ url: `${baseUrl}/api/discover/random`, response: jsonResponse(trackPageFixture([])) },
				{ url: `${baseUrl}/api/discover/recent`, response: jsonResponse(trackPageFixture([])) },
				{ url: `${baseUrl}/api/discover/recently-played`, response: jsonResponse(tracks) },
				{ url: `${baseUrl}/api/playlists`, response: jsonResponse(playlistPageFixture([])) },
				{ url: `${baseUrl}/api/favourites`, response: jsonResponse(trackPageFixture([])) }
			]),
			createClient: createMediaServerClient
		});

		await controller.load();

		expect(controller.shelves.recentlyPlayed.items).toEqual([first]);
	});

	it('preserves ready shelf items while marking non-ready shelves as loading on refresh', async () => {
		const first = trackPageFixture([trackFixture({ id: 1, title: 'First' })]);
		const second = trackPageFixture([trackFixture({ id: 9, title: 'Second' })]);
		let discoverCalls = 0;

		const controller = new HomeShelvesController({
			getBaseUrl: () => baseUrl,
			fetch: createFetchStub([
				{
					url: `${baseUrl}/api/discover/random`,
					response: () => {
						discoverCalls += 1;
						return jsonResponse(discoverCalls === 1 ? first : second);
					}
				},
				{ url: `${baseUrl}/api/discover/recent`, response: jsonResponse(first) },
				{ url: `${baseUrl}/api/discover/recently-played`, response: jsonResponse(first) },
				{ url: `${baseUrl}/api/playlists`, response: jsonResponse(playlistPageFixture([])) },
				{ url: `${baseUrl}/api/favourites`, response: jsonResponse(first) }
			]),
			createClient: createMediaServerClient
		});

		await controller.load();
		expect(controller.shelves.discover.items[0]?.title).toBe('First');
		expect(controller.shelves.discover.status).toBe('ready');

		await controller.refresh();
		expect(controller.shelves.discover.items[0]?.title).toBe('Second');
		expect(discoverCalls).toBe(2);
	});
});
