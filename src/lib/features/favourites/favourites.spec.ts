import { describe, expect, it } from 'vitest';
import { createMediaServerClient } from '$lib/api/client';
import { FavouritesController } from '$lib/features/favourites/favourites.svelte';
import {
	createFetchStub,
	errorResponse,
	jsonResponse,
	trackFixture,
	trackPageFixture
} from '$lib/test/fixtures';

const baseUrl = 'http://192.168.5.111:8080';

describe('FavouritesController', () => {
	it('loads favourite ids and toggles optimistically', async () => {
		const track = trackFixture({ id: 9, title: 'Fav' });
		let favourited = true;
		const controller = new FavouritesController({
			getBaseUrl: () => baseUrl,
			getHasUserDb: () => true,
			createClient: createMediaServerClient,
			fetch: async (input, init) => {
				const url = String(input);
				const method = init?.method ?? 'GET';
				if (url.split('?')[0] === `${baseUrl}/api/favourites` && method === 'GET') {
					return jsonResponse(
						trackPageFixture(favourited ? [track] : [], { total: favourited ? 1 : 0 })
					);
				}
				if (url === `${baseUrl}/api/favourites/9` && method === 'DELETE') {
					favourited = false;
					return jsonResponse({});
				}
				if (url === `${baseUrl}/api/favourites/9` && method === 'PUT') {
					favourited = true;
					return jsonResponse({});
				}
				return errorResponse(404, 'not_found');
			}
		});

		await controller.load();
		expect(controller.isFavourite(9)).toBe(true);

		await expect(controller.toggle(track)).resolves.toBe(true);
		expect(controller.isFavourite(9)).toBe(false);
	});

	it('rolls back when toggle fails', async () => {
		const track = trackFixture({ id: 3 });
		const controller = new FavouritesController({
			getBaseUrl: () => baseUrl,
			getHasUserDb: () => true,
			createClient: createMediaServerClient,
			fetch: createFetchStub([
				{
					url: `${baseUrl}/api/favourites`,
					response: jsonResponse(trackPageFixture([]))
				},
				{ url: `${baseUrl}/api/favourites/3`, response: errorResponse(500, 'encode_failed') }
			])
		});

		await controller.load();
		expect(controller.isFavourite(3)).toBe(false);
		await expect(controller.toggle(track)).resolves.toBe(false);
		expect(controller.isFavourite(3)).toBe(false);
		expect(controller.errorMessage).toBeTruthy();
	});

	it('marks unavailable when hasUserDb is false', async () => {
		const controller = new FavouritesController({
			getBaseUrl: () => baseUrl,
			getHasUserDb: () => false,
			createClient: createMediaServerClient,
			fetch: createFetchStub([])
		});

		await controller.load();
		expect(controller.status).toBe('unavailable');
	});
});
