import { describe, expect, it } from 'vitest';
import { createMediaServerClient } from '$lib/api/client';
import { SearchResultsController } from '$lib/features/search/searchResults.svelte';
import {
	albumFixture,
	albumPageFixture,
	artistFixture,
	artistPageFixture,
	createFetchStub,
	errorResponse,
	jsonResponse,
	searchResponseFixture,
	trackFixture,
	trackPageFixture
} from '$lib/test/fixtures';

const baseUrl = 'http://127.0.0.1:8080';

describe('SearchResultsController', () => {
	it('loads tracks, artists, and albums for a query', async () => {
		const response = searchResponseFixture({
			q: 'jade',
			tracks: trackPageFixture([trackFixture({ id: 9, title: 'Adolescence' })]),
			artists: artistPageFixture([artistFixture({ id: 136, name: 'ASM' })]),
			albums: albumPageFixture([albumFixture({ id: 355, name: 'The Jade Amulet' })])
		});
		const controller = new SearchResultsController({
			getBaseUrl: () => baseUrl,
			createClient: createMediaServerClient,
			fetch: createFetchStub([{ url: `${baseUrl}/api/search`, response: jsonResponse(response) }])
		});

		await controller.search('jade');
		expect(controller.state.tracks.status).toBe('ready');
		expect(controller.state.artists.items[0]?.name).toBe('ASM');
		expect(controller.state.albums.items[0]?.name).toBe('The Jade Amulet');
	});

	it('discards stale results when a newer search completes first', async () => {
		let resolveSlow: ((value: Response) => void) | undefined;
		const slow = new Promise<Response>((resolve) => {
			resolveSlow = resolve;
		});

		const fast = searchResponseFixture({
			q: 'fast',
			tracks: trackPageFixture([trackFixture({ id: 2, title: 'Fast Hit' })])
		});
		const slowBody = searchResponseFixture({
			q: 'slow',
			tracks: trackPageFixture([trackFixture({ id: 1, title: 'Slow Hit' })])
		});

		let calls = 0;
		const controller = new SearchResultsController({
			getBaseUrl: () => baseUrl,
			createClient: createMediaServerClient,
			fetch: async (input) => {
				calls += 1;
				const url = String(input);
				expect(url.startsWith(`${baseUrl}/api/search`)).toBe(true);
				if (calls === 1) {
					return slow;
				}
				return jsonResponse(fast);
			}
		});

		const first = controller.search('slow');
		await controller.search('fast');
		resolveSlow?.(jsonResponse(slowBody));
		await first;

		expect(controller.state.query).toBe('fast');
		expect(controller.state.tracks.items[0]?.title).toBe('Fast Hit');
	});

	it('clears results for an empty query without fetching', async () => {
		let fetched = false;
		const controller = new SearchResultsController({
			getBaseUrl: () => baseUrl,
			createClient: createMediaServerClient,
			fetch: async () => {
				fetched = true;
				return jsonResponse(searchResponseFixture());
			}
		});

		await controller.search('   ');
		expect(fetched).toBe(false);
		expect(controller.state.query).toBe('');
		expect(controller.state.tracks.status).toBe('idle');
	});

	it('shows a focused error when searching without a connection', async () => {
		const controller = new SearchResultsController({
			getBaseUrl: () => null,
			fetch: createFetchStub([])
		});

		await controller.search('jade');

		expect(controller.state.tracks.status).toBe('error');
		expect(controller.state.tracks.errorMessage).toBe('Not connected to a media server.');
	});

	it('maps request failures across result sections', async () => {
		const controller = new SearchResultsController({
			getBaseUrl: () => baseUrl,
			createClient: createMediaServerClient,
			fetch: createFetchStub([
				{ url: `${baseUrl}/api/search`, response: errorResponse(500, 'search_failed') }
			])
		});

		await controller.search('jade');

		expect(controller.state.tracks.status).toBe('error');
		expect(controller.state.artists.status).toBe('error');
		expect(controller.state.albums.status).toBe('error');
	});
});
