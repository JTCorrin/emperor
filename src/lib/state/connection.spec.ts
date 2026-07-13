import { describe, expect, it, vi } from 'vitest';
import { createMediaServerClient } from '$lib/api/client';
import { CONNECTION_STORAGE_KEY, ConnectionController } from '$lib/state/connection.svelte';
import {
	createFetchStub,
	errorResponse,
	jsonResponse,
	libraryStatusFixture,
	pingFixture,
	playlistPageFixture
} from '$lib/test/fixtures';

function memoryStorage(initial: Record<string, string> = {}) {
	const store = new Map(Object.entries(initial));
	return {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => {
			store.set(key, value);
		},
		removeItem: (key: string) => {
			store.delete(key);
		},
		dump: () => Object.fromEntries(store)
	};
}

describe('ConnectionController', () => {
	it('connects, persists the base URL, and stores library status', async () => {
		const storage = memoryStorage();
		const baseUrl = 'http://192.168.5.111:8080';
		const controller = new ConnectionController({
			storage,
			fetch: createFetchStub([
				{ url: `${baseUrl}/api/ping`, response: jsonResponse(pingFixture()) },
				{
					url: `${baseUrl}/api/library/status`,
					response: jsonResponse(libraryStatusFixture({ track_count: 42 }))
				},
				{ url: `${baseUrl}/api/playlists`, response: jsonResponse(playlistPageFixture([])) }
			]),
			createClient: createMediaServerClient
		});

		await expect(controller.connect(`${baseUrl}/`)).resolves.toBe(true);
		expect(controller.status).toBe('connected');
		expect(controller.baseUrl).toBe(baseUrl);
		expect(controller.libraryStatus?.track_count).toBe(42);
		expect(controller.hasUserDb).toBe(true);
		expect(storage.dump()[CONNECTION_STORAGE_KEY]).toBe(baseUrl);
	});

	it('sets hasUserDb false when playlists probe returns no_user_db', async () => {
		const baseUrl = 'http://192.168.5.111:8080';
		const controller = new ConnectionController({
			storage: memoryStorage(),
			fetch: createFetchStub([
				{ url: `${baseUrl}/api/ping`, response: jsonResponse(pingFixture()) },
				{ url: `${baseUrl}/api/library/status`, response: jsonResponse(libraryStatusFixture()) },
				{ url: `${baseUrl}/api/playlists`, response: errorResponse(400, 'no_user_db') }
			]),
			createClient: createMediaServerClient
		});

		await expect(controller.connect(baseUrl)).resolves.toBe(true);
		expect(controller.status).toBe('connected');
		expect(controller.hasUserDb).toBe(false);
	});

	it('records a recoverable error when the probe fails', async () => {
		const controller = new ConnectionController({
			storage: memoryStorage(),
			fetch: async () => {
				throw new TypeError('Failed to fetch');
			}
		});

		await expect(controller.connect('http://192.168.5.111:8080')).resolves.toBe(false);
		expect(controller.status).toBe('error');
		expect(controller.error?.kind).toBe('network');
	});

	it('restores a saved URL and can recheck it', async () => {
		const baseUrl = 'http://192.168.5.111:8080';
		const storage = memoryStorage({ [CONNECTION_STORAGE_KEY]: baseUrl });
		const fetchStub = createFetchStub([
			{ url: `${baseUrl}/api/ping`, response: jsonResponse(pingFixture()) },
			{ url: `${baseUrl}/api/library/status`, response: jsonResponse(libraryStatusFixture()) },
			{ url: `${baseUrl}/api/playlists`, response: jsonResponse(playlistPageFixture([])) }
		]);
		const controller = new ConnectionController({
			storage,
			fetch: fetchStub
		});

		expect(controller.restore()).toBe(baseUrl);
		expect(controller.status).toBe('disconnected');

		await expect(controller.recheck()).resolves.toBe(true);
		expect(controller.status).toBe('connected');
	});

	it('disconnect clears persisted state', async () => {
		const baseUrl = 'http://192.168.5.111:8080';
		const storage = memoryStorage({ [CONNECTION_STORAGE_KEY]: baseUrl });
		const controller = new ConnectionController({
			storage,
			fetch: vi.fn()
		});

		controller.restore();
		controller.disconnect();

		expect(controller.baseUrl).toBeNull();
		expect(controller.status).toBe('idle');
		expect(storage.dump()).toEqual({});
	});
});
