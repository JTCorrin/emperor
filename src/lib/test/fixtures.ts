import type { LibraryStatus, PingResponse } from '$lib/api/schemas';

export function pingFixture(overrides: Partial<PingResponse> = {}): PingResponse {
	return {
		ok: true,
		...overrides
	};
}

export function libraryStatusFixture(overrides: Partial<LibraryStatus> = {}): LibraryStatus {
	return {
		scanning: false,
		has_library: true,
		library_dir: '/music',
		last_scan_unix: 1_710_000_000,
		last_scan_ok: true,
		last_error: '',
		track_count: 10,
		image_count: 2,
		artist_count: 3,
		album_count: 4,
		...overrides
	};
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
		...init
	});
}

export function errorResponse(status: number, code: string): Response {
	return jsonResponse({ error: code }, { status });
}

export type StubRoute = {
	url: string | RegExp;
	response: Response | (() => Response | Promise<Response>);
};

export function createFetchStub(routes: StubRoute[]): typeof fetch {
	return async (input, init) => {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

		if (init?.signal?.aborted) {
			throw new DOMException('Aborted', 'AbortError');
		}

		for (const route of routes) {
			const matches =
				typeof route.url === 'string'
					? url === route.url || url.startsWith(route.url)
					: route.url.test(url);
			if (!matches) continue;
			return typeof route.response === 'function' ? await route.response() : route.response;
		}

		return new Response(JSON.stringify({ error: 'not_found' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		});
	};
}
