import { describe, expect, it, vi } from 'vitest';
import { createMediaServerClient } from '$lib/api/client';
import { ConnectionController } from '$lib/state/connection.svelte';
import {
	createFetchStub,
	errorResponse,
	jsonResponse,
	libraryStatusFixture,
	pingFixture,
	playlistPageFixture
} from '$lib/test/fixtures';

describe('ConnectionController', () => {
	it('connects and stores library status without persisting a URL', async () => {
		const baseUrl = 'http://127.0.0.1:8080';
		const controller = new ConnectionController({
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
	});

	it('sets hasUserDb false when playlists probe returns no_user_db', async () => {
		const baseUrl = 'http://127.0.0.1:8080';
		const controller = new ConnectionController({
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
			fetch: async () => {
				throw new TypeError('Failed to fetch');
			}
		});

		await expect(controller.connect('http://127.0.0.1:8080')).resolves.toBe(false);
		expect(controller.status).toBe('error');
		expect(controller.error?.kind).toBe('network');
	});

	it('reports invalid base URLs as validation errors', async () => {
		const controller = new ConnectionController({
			fetch: createFetchStub([])
		});

		await expect(controller.connect('javascript:alert(1)')).resolves.toBe(false);
		expect(controller.error?.kind).toBe('validation');
	});

	it('rechecks an existing base URL', async () => {
		const baseUrl = 'http://127.0.0.1:8080';
		const controller = new ConnectionController({
			fetch: async (input) => {
				const url = String(input).split('?')[0];
				if (url === `${baseUrl}/api/ping`) return jsonResponse(pingFixture());
				if (url === `${baseUrl}/api/library/status`) {
					return jsonResponse(libraryStatusFixture());
				}
				if (url === `${baseUrl}/api/playlists`) {
					return jsonResponse(playlistPageFixture([]));
				}
				return errorResponse(404, 'not_found');
			}
		});

		await expect(controller.connect(baseUrl)).resolves.toBe(true);
		await expect(controller.recheck()).resolves.toBe(true);
		expect(controller.status).toBe('connected');
	});

	it('recheck returns false when no base URL is set', async () => {
		const controller = new ConnectionController({ fetch: vi.fn() });
		await expect(controller.recheck()).resolves.toBe(false);
	});

	it('reset clears connection state', async () => {
		const baseUrl = 'http://127.0.0.1:8080';
		const controller = new ConnectionController({
			fetch: createFetchStub([
				{ url: `${baseUrl}/api/ping`, response: jsonResponse(pingFixture()) },
				{ url: `${baseUrl}/api/library/status`, response: jsonResponse(libraryStatusFixture()) },
				{ url: `${baseUrl}/api/playlists`, response: jsonResponse(playlistPageFixture([])) }
			])
		});

		await expect(controller.connect(baseUrl)).resolves.toBe(true);
		controller.reset();

		expect(controller.baseUrl).toBeNull();
		expect(controller.status).toBe('idle');
	});

	it('starts a scan on 202 and maps 409 to a busy message', async () => {
		const baseUrl = 'http://127.0.0.1:8080';
		let scanCount = 0;
		const controller = new ConnectionController({
			scanPollIntervalMs: 50,
			fetch: async (input, init) => {
				const url = String(input);
				const method = init?.method ?? 'GET';
				if (url === `${baseUrl}/api/ping`) return jsonResponse(pingFixture());
				if (url === `${baseUrl}/api/library/status`) {
					return jsonResponse(
						libraryStatusFixture({
							scanning: scanCount > 0,
							track_count: 42
						})
					);
				}
				if (url.split('?')[0] === `${baseUrl}/api/playlists`) {
					return jsonResponse(playlistPageFixture([]));
				}
				if (url.split('?')[0] === `${baseUrl}/api/library/scan` && method === 'POST') {
					scanCount += 1;
					if (scanCount === 1) {
						return new Response('', { status: 202 });
					}
					return errorResponse(409, 'scan_in_progress');
				}
				return errorResponse(404, 'not_found');
			}
		});

		await expect(controller.connect(baseUrl)).resolves.toBe(true);
		await expect(controller.startScan()).resolves.toBe(true);
		expect(controller.scanError).toBeNull();
		expect(controller.libraryStatus?.scanning).toBe(true);

		await expect(controller.startScan()).resolves.toBe(false);
		expect(controller.scanError).toBe('A library scan is already in progress.');
	});

	it('stops scan polling on reset', async () => {
		const baseUrl = 'http://127.0.0.1:8080';
		let statusHits = 0;
		const controller = new ConnectionController({
			scanPollIntervalMs: 20,
			fetch: async (input) => {
				const url = String(input);
				if (url === `${baseUrl}/api/ping`) return jsonResponse(pingFixture());
				if (url === `${baseUrl}/api/library/status`) {
					statusHits += 1;
					return jsonResponse(libraryStatusFixture({ scanning: true }));
				}
				if (url.split('?')[0] === `${baseUrl}/api/playlists`) {
					return jsonResponse(playlistPageFixture([]));
				}
				return errorResponse(404, 'not_found');
			}
		});

		await expect(controller.connect(baseUrl)).resolves.toBe(true);
		const hitsAfterConnect = statusHits;
		await new Promise((resolve) => setTimeout(resolve, 70));
		expect(statusHits).toBeGreaterThan(hitsAfterConnect);
		controller.reset();
		const hitsAfterReset = statusHits;
		await new Promise((resolve) => setTimeout(resolve, 70));
		expect(statusHits).toBe(hitsAfterReset);
	});
});
