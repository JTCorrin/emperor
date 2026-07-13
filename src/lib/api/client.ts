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
	type LibraryStatus,
	type PingResponse
} from './schemas';
import { apiUrl, normalizeBaseUrl } from './url';

export type FetchLike = typeof fetch;

export type MediaServerClientOptions = {
	baseUrl: string;
	fetch?: FetchLike;
};

export type MediaServerClient = {
	baseUrl: string;
	ping: (signal?: AbortSignal) => Promise<PingResponse>;
	getLibraryStatus: (signal?: AbortSignal) => Promise<LibraryStatus>;
};

export class MediaServerRequestError extends Error {
	readonly error: MediaServerError;

	constructor(error: MediaServerError) {
		super(error.message);
		this.name = 'MediaServerRequestError';
		this.error = error;
	}
}

export function createMediaServerClient(options: MediaServerClientOptions): MediaServerClient {
	const baseUrl = normalizeBaseUrl(options.baseUrl);
	const fetchImpl = options.fetch ?? fetch;

	async function requestJson<T>(
		path: string,
		schema: { parse: (data: unknown) => T },
		signal?: AbortSignal
	): Promise<T> {
		let response: Response;
		try {
			response = await fetchImpl(apiUrl(baseUrl, path), {
				method: 'GET',
				headers: { Accept: 'application/json' },
				signal
			});
		} catch (cause) {
			if (signal?.aborted || (cause instanceof DOMException && cause.name === 'AbortError')) {
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

		try {
			return schema.parse(body);
		} catch (cause) {
			throw new MediaServerRequestError(schemaError(cause));
		}
	}

	return {
		baseUrl,
		ping: (signal) => requestJson('/api/ping', pingResponseSchema, signal),
		getLibraryStatus: (signal) => requestJson('/api/library/status', libraryStatusSchema, signal)
	};
}
