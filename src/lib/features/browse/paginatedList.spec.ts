import { describe, expect, it } from 'vitest';
import { createMediaServerClient, MediaServerRequestError } from '$lib/api/client';
import { abortedError } from '$lib/api/errors';
import { PaginatedListController } from '$lib/features/browse/paginatedList.svelte';
import { createFetchStub, jsonResponse, trackFixture, trackPageFixture } from '$lib/test/fixtures';

const baseUrl = 'http://127.0.0.1:8080';

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

	it('preserves a successful state when a later refresh fails', async () => {
		let calls = 0;
		const first = trackPageFixture([trackFixture({ id: 1 })]);
		const controller = new PaginatedListController({
			getBaseUrl: () => baseUrl,
			createClient: createMediaServerClient,
			fetch: createFetchStub([]),
			fetchPage: async () => {
				calls += 1;
				if (calls === 1) return first;
				throw new Error('refresh failed');
			}
		});

		await controller.load();
		await controller.load();

		expect(controller.status).toBe('ready');
		expect(controller.items).toEqual(first.items);
		expect(controller.errorMessage).toBe('refresh failed');
	});

	it('exits loading state when a request is aborted', async () => {
		const controller = new PaginatedListController({
			getBaseUrl: () => baseUrl,
			createClient: createMediaServerClient,
			fetch: createFetchStub([]),
			fetchPage: async () => {
				throw new MediaServerRequestError(abortedError());
			}
		});

		await controller.load();

		expect(controller.status).toBe('idle');
		expect(controller.loadingMore).toBe(false);
	});
});
