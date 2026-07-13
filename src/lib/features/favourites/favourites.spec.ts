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

const baseUrl = 'http://127.0.0.1:8080';

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

	it('loads all favourite pages beyond the server page limit', async () => {
		const first = Array.from({ length: 200 }, (_, index) => trackFixture({ id: index + 1 }));
		const controller = new FavouritesController({
			getBaseUrl: () => baseUrl,
			getHasUserDb: () => true,
			createClient: createMediaServerClient,
			fetch: async (input) => {
				const offset = Number(new URL(String(input)).searchParams.get('offset'));
				return jsonResponse(
					trackPageFixture(offset === 0 ? first : [trackFixture({ id: 201 })], {
						total: 201,
						limit: 200,
						offset
					})
				);
			}
		});

		await controller.load();

		expect(controller.ids).toHaveLength(201);
		expect(controller.ids.at(-1)).toBe(201);
	});

	it('maps a server no_user_db response to unavailable', async () => {
		const controller = new FavouritesController({
			getBaseUrl: () => baseUrl,
			getHasUserDb: () => null,
			createClient: createMediaServerClient,
			fetch: createFetchStub([
				{ url: `${baseUrl}/api/favourites`, response: errorResponse(400, 'no_user_db') }
			])
		});

		await controller.load();

		expect(controller.status).toBe('unavailable');
		expect(controller.errorMessage).toBeNull();
	});

	it('prevents duplicate concurrent toggles for the same track', async () => {
		let resolveResponse: ((response: Response) => void) | undefined;
		const pendingResponse = new Promise<Response>((resolve) => {
			resolveResponse = resolve;
		});
		const track = trackFixture({ id: 9 });
		const controller = new FavouritesController({
			getBaseUrl: () => baseUrl,
			getHasUserDb: () => true,
			createClient: createMediaServerClient,
			fetch: async () => pendingResponse
		});

		const first = controller.toggle(track);
		await expect(controller.toggle(track)).resolves.toBe(false);
		expect(controller.isPending(track.id)).toBe(true);
		resolveResponse?.(new Response(null, { status: 204 }));
		await expect(first).resolves.toBe(true);
	});
});
