import { describe, expect, it } from 'vitest';
import { createMediaServerClient } from '$lib/api/client';
import { PaginatedListController } from '$lib/features/browse/paginatedList.svelte';
import {
	createFetchStub,
	errorResponse,
	jsonResponse,
	trackFixture,
	trackPageFixture
} from '$lib/test/fixtures';

const baseUrl = 'http://192.168.5.111:8080';

describe('PaginatedListController', () => {
	it('loads the first page and appends on loadMore', async () => {
		const first = trackPageFixture([trackFixture({ id: 1, title: 'One' })], {
			total: 2,
			limit: 1,
			offset: 0
		});
		const second = trackPageFixture([trackFixture({ id: 2, title: 'Two' })], {
			total: 2,
			limit: 1,
			offset: 1
		});

		const controller = new PaginatedListController({
			getBaseUrl: () => baseUrl,
			pageSize: 1,
			createClient: createMediaServerClient,
			fetch: createFetchStub([
				{
					url: `${baseUrl}/api/tracks`,
					response: () => {
						// First call offset 0, second offset 1 — stub can't see query easily;
						// use call counting instead via closure below.
						return jsonResponse(first);
					}
				}
			]),
			fetchPage: async (client, query) => {
				if (query.offset === 0) return first;
				return second;
			}
		});

		await controller.load();
		expect(controller.status).toBe('ready');
		expect(controller.items).toHaveLength(1);
		expect(controller.hasMore).toBe(true);

		await controller.loadMore();
		expect(controller.items.map((t) => t.title)).toEqual(['One', 'Two']);
		expect(controller.hasMore).toBe(false);
	});

	it('maps load errors without wiping a later successful state incorrectly', async () => {
		const controller = new PaginatedListController({
			getBaseUrl: () => baseUrl,
			createClient: createMediaServerClient,
			fetch: createFetchStub([
				{ url: `${baseUrl}/api/tracks`, response: errorResponse(500, 'encode_failed') }
			]),
			fetchPage: (client, query) => client.getTracks(query)
		});

		await controller.load();
		expect(controller.status).toBe('error');
		expect(controller.items).toHaveLength(0);
	});
});
