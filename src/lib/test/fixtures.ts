import type {
	HistoryItem,
	HistoryPage,
	LibraryStatus,
	PingResponse,
	Playlist,
	PlaylistPage,
	Track,
	TrackPage
} from '$lib/api/schemas';

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

export function trackFixture(overrides: Partial<Track> = {}): Track {
	return {
		id: 1,
		kind: 'audio',
		path: 'Artist/Album/track01.mp3',
		filename: 'track01.mp3',
		artist: 'Artist',
		album: 'Album',
		title: 'Track One',
		release_date: null,
		genre: null,
		track_number: 1,
		disc_number: 1,
		overridden_fields: [],
		...overrides
	};
}

export function trackPageFixture(
	items: Track[] = [trackFixture()],
	overrides: Partial<TrackPage> = {}
): TrackPage {
	return {
		items,
		total: items.length,
		limit: 50,
		offset: 0,
		...overrides
	};
}

export function playlistFixture(overrides: Partial<Playlist> = {}): Playlist {
	return {
		id: 1,
		name: 'Mix',
		track_count: 12,
		created_unix: 1_710_000_000,
		updated_unix: 1_710_000_100,
		...overrides
	};
}

export function playlistPageFixture(
	items: Playlist[] = [playlistFixture()],
	overrides: Partial<PlaylistPage> = {}
): PlaylistPage {
	return {
		items,
		total: items.length,
		limit: 50,
		offset: 0,
		...overrides
	};
}

export function historyItemFixture(overrides: Partial<HistoryItem> = {}): HistoryItem {
	return {
		track: trackFixture(),
		played_unix: 1_710_000_000,
		...overrides
	};
}

export function historyPageFixture(
	items: HistoryItem[] = [historyItemFixture()],
	overrides: Partial<HistoryPage> = {}
): HistoryPage {
	return {
		items,
		total: items.length,
		limit: 50,
		offset: 0,
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
					? url === route.url || url.split('?')[0] === route.url
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
