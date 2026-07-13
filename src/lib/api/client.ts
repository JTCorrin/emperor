import {
	abortedError,
	httpError,
	networkError,
	schemaError,
	type MediaServerError
} from './errors';
import {
	errorBodySchema,
	libraryStatusSchema,
	pingResponseSchema,
	trackPageSchema,
	type LibraryStatus,
	type PingResponse,
	type TrackPage
} from './schemas';
import { apiUrl, normalizeBaseUrl } from './url';

export type FetchLike = typeof fetch;

export type MediaServerClientOptions = {
	baseUrl: string;
	fetch?: FetchLike;
};

export type PaginationQuery = {
	limit?: number;
	offset?: number;
	signal?: AbortSignal;
};

export type MediaServerClient = {
	baseUrl: string;
	ping: (signal?: AbortSignal) => Promise<PingResponse>;
	getLibraryStatus: (signal?: AbortSignal) => Promise<LibraryStatus>;
	getDiscoverRandom: (query?: PaginationQuery) => Promise<TrackPage>;
	recordHistory: (trackId: number, signal?: AbortSignal) => Promise<void>;
};

export class MediaServerRequestError extends Error {
	readonly error: MediaServerError;

	constructor(error: MediaServerError) {
		super(error.message);
		this.name = 'MediaServerRequestError';
		this.error = error;
	}
}

function withQuery(path: string, query: Record<string, string | number | undefined>): string {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value === undefined) continue;
		params.set(key, String(value));
	}
	const qs = params.toString();
	return qs ? `${path}?${qs}` : path;
}

export function createMediaServerClient(options: MediaServerClientOptions): MediaServerClient {
	const baseUrl = normalizeBaseUrl(options.baseUrl);
	const fetchImpl = options.fetch ?? fetch;

	async function requestJson<T>(
		path: string,
		schema: { parse: (data: unknown) => T } | null,
		init: RequestInit = {}
	): Promise<T | void> {
		let response: Response;
		try {
			response = await fetchImpl(apiUrl(baseUrl, path), {
				method: 'GET',
				headers: { Accept: 'application/json', ...(init.headers ?? {}) },
				...init
			});
		} catch (cause) {
			if (init.signal?.aborted || (cause instanceof DOMException && cause.name === 'AbortError')) {
				throw new MediaServerRequestError(abortedError(cause));
			}
			throw new MediaServerRequestError(networkError(cause));
		}

		let body: unknown = undefined;
		const text = await response.text();
		if (text) {
			try {
				body = JSON.parse(text) as unknown;
			} catch (cause) {
				if (!response.ok) {
					throw new MediaServerRequestError(httpError(response.status));
				}
				throw new MediaServerRequestError(schemaError(cause));
			}
		}

		if (!response.ok) {
			const parsedError = errorBodySchema.safeParse(body);
			throw new MediaServerRequestError(
				httpError(response.status, parsedError.success ? parsedError.data.error : undefined)
			);
		}

		if (!schema) {
			return;
		}

		try {
			return schema.parse(body);
		} catch (cause) {
			throw new MediaServerRequestError(schemaError(cause));
		}
	}

	return {
		baseUrl,
		ping: (signal) =>
			requestJson('/api/ping', pingResponseSchema, { signal }) as Promise<PingResponse>,
		getLibraryStatus: (signal) =>
			requestJson('/api/library/status', libraryStatusSchema, {
				signal
			}) as Promise<LibraryStatus>,
		getDiscoverRandom: (query = {}) =>
			requestJson(
				withQuery('/api/discover/random', {
					limit: query.limit,
					offset: query.offset
				}),
				trackPageSchema,
				{ signal: query.signal }
			) as Promise<TrackPage>,
		recordHistory: async (trackId, signal) => {
			await requestJson('/api/history', null, {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ track_id: trackId }),
				signal
			});
		}
	};
}
