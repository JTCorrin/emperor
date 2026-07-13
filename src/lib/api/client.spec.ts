import { describe, expect, it } from 'vitest';
import { createMediaServerClient, MediaServerRequestError } from '$lib/api/client';
import {
	createFetchStub,
	errorResponse,
	jsonResponse,
	libraryStatusFixture,
	pingFixture
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
