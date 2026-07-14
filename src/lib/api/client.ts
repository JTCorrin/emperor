import {
	abortedError,
	httpError,
	networkError,
	schemaError,
	type MediaServerError
} from './errors';
import {
	albumPageSchema,
	albumSchema,
	albumPatchResponseSchema,
	albumCoverUploadResponseSchema,
	artistPageSchema,
	artistSchema,
	errorBodySchema,
	historyPageSchema,
	libraryStatusSchema,
	pingResponseSchema,
	playlistPageSchema,
	playlistSchema,
	searchResponseSchema,
	trackPageSchema,
	trackSchema,
	type Album,
	type AlbumCoverUploadResponse,
	type AlbumMetadataPatch,
	type AlbumPage,
	type AlbumPatchResponse,
	type Artist,
	type ArtistPage,
	type HistoryPage,
	type LibraryStatus,
	type PingResponse,
	type Playlist,
	type PlaylistPage,
	type SearchResponse,
	type Track,
	type TrackMetadataPatch,
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

export type SearchQuery = PaginationQuery & {
	q: string;
};

export type LibraryScanOptions = {
	force?: boolean;
	signal?: AbortSignal;
};

export type MediaServerClient = {
	baseUrl: string;
	ping: (signal?: AbortSignal) => Promise<PingResponse>;
	getLibraryStatus: (signal?: AbortSignal) => Promise<LibraryStatus>;
	startLibraryScan: (options?: LibraryScanOptions) => Promise<void>;
	getTracks: (query?: PaginationQuery) => Promise<TrackPage>;
	getTrack: (id: number, signal?: AbortSignal) => Promise<Track>;
	updateTrack: (id: number, patch: TrackMetadataPatch, signal?: AbortSignal) => Promise<Track>;
	getArtists: (query?: PaginationQuery) => Promise<ArtistPage>;
	getArtist: (id: number, signal?: AbortSignal) => Promise<Artist>;
	getArtistAlbums: (id: number, query?: PaginationQuery) => Promise<AlbumPage>;
	getAlbums: (query?: PaginationQuery) => Promise<AlbumPage>;
	getAlbum: (id: number, signal?: AbortSignal) => Promise<Album>;
	updateAlbum: (
		id: number,
		patch: AlbumMetadataPatch,
		signal?: AbortSignal
	) => Promise<AlbumPatchResponse>;
	uploadAlbumCover: (
		id: number,
		blob: Blob,
		contentType: string,
		signal?: AbortSignal
	) => Promise<AlbumCoverUploadResponse>;
	getAlbumTracks: (id: number, query?: PaginationQuery) => Promise<TrackPage>;
	search: (query: SearchQuery) => Promise<SearchResponse>;
	getDiscoverRandom: (query?: PaginationQuery) => Promise<TrackPage>;
	getDiscoverRecent: (query?: PaginationQuery) => Promise<TrackPage>;
	getRecentlyPlayed: (query?: PaginationQuery) => Promise<TrackPage>;
	getPlaylists: (query?: PaginationQuery) => Promise<PlaylistPage>;
	getPlaylist: (id: number, signal?: AbortSignal) => Promise<Playlist>;
	createPlaylist: (name: string, signal?: AbortSignal) => Promise<Playlist>;
	updatePlaylist: (id: number, name: string, signal?: AbortSignal) => Promise<Playlist>;
	deletePlaylist: (id: number, signal?: AbortSignal) => Promise<void>;
	getPlaylistTracks: (id: number, query?: PaginationQuery) => Promise<TrackPage>;
	setPlaylistTracks: (id: number, trackIds: number[], signal?: AbortSignal) => Promise<void>;
	getFavourites: (query?: PaginationQuery) => Promise<TrackPage>;
	addFavourite: (trackId: number, signal?: AbortSignal) => Promise<void>;
	removeFavourite: (trackId: number, signal?: AbortSignal) => Promise<void>;
	getHistory: (query?: PaginationQuery) => Promise<HistoryPage>;
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

	async function requestBody(path: string, init: RequestInit = {}): Promise<unknown> {
		const headers = {
			Accept: 'application/json',
			...(init.headers ?? {})
		};

		let response: Response;
		try {
			response = await fetchImpl(apiUrl(baseUrl, path), {
				...init,
				headers
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

		return body;
	}

	async function requestJson<T>(
		path: string,
		schema: { parse: (data: unknown) => T },
		init: RequestInit = {}
	): Promise<T> {
		try {
			const body = await requestBody(path, init);
			return schema.parse(body);
		} catch (cause) {
			if (cause instanceof MediaServerRequestError) throw cause;
			throw new MediaServerRequestError(schemaError(cause));
		}
	}

	async function requestEmpty(path: string, init: RequestInit = {}): Promise<void> {
		await requestBody(path, init);
	}

	function jsonMutation(method: string, body?: unknown): RequestInit {
		return {
			method,
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json'
			},
			body: body === undefined ? undefined : JSON.stringify(body)
		};
	}

	function getTrackPage(path: string, query: PaginationQuery = {}): Promise<TrackPage> {
		return requestJson(
			withQuery(path, {
				limit: query.limit,
				offset: query.offset
			}),
			trackPageSchema,
			{ signal: query.signal }
		);
	}

	function getAlbumPage(path: string, query: PaginationQuery = {}): Promise<AlbumPage> {
		return requestJson(
			withQuery(path, {
				limit: query.limit,
				offset: query.offset
			}),
			albumPageSchema,
			{ signal: query.signal }
		);
	}

	function getArtistPage(path: string, query: PaginationQuery = {}): Promise<ArtistPage> {
		return requestJson(
			withQuery(path, {
				limit: query.limit,
				offset: query.offset
			}),
			artistPageSchema,
			{ signal: query.signal }
		);
	}

	return {
		baseUrl,
		ping: (signal) => requestJson('/api/ping', pingResponseSchema, { signal }),
		getLibraryStatus: (signal) =>
			requestJson('/api/library/status', libraryStatusSchema, {
				signal
			}),
		startLibraryScan: async (options = {}) => {
			await requestEmpty(
				withQuery('/api/library/scan', {
					force: options.force ? 1 : undefined
				}),
				{
					...jsonMutation('POST'),
					signal: options.signal
				}
			);
		},
		getTracks: (query = {}) => getTrackPage('/api/tracks', query),
		getTrack: (id, signal) => requestJson(`/api/tracks/${id}`, trackSchema, { signal }),
		updateTrack: (id, patch, signal) =>
			requestJson(`/api/tracks/${id}`, trackSchema, {
				...jsonMutation('PATCH', patch),
				signal
			}),
		getArtists: (query = {}) => getArtistPage('/api/artists', query),
		getArtist: (id, signal) => requestJson(`/api/artists/${id}`, artistSchema, { signal }),
		getArtistAlbums: (id, query = {}) => getAlbumPage(`/api/artists/${id}/albums`, query),
		getAlbums: (query = {}) => getAlbumPage('/api/albums', query),
		getAlbum: (id, signal) => requestJson(`/api/albums/${id}`, albumSchema, { signal }),
		updateAlbum: (id, patch, signal) =>
			requestJson(`/api/albums/${id}`, albumPatchResponseSchema, {
				...jsonMutation('PATCH', patch),
				signal
			}),
		uploadAlbumCover: (id, blob, contentType, signal) =>
			requestJson(`/api/albums/${id}/cover`, albumCoverUploadResponseSchema, {
				method: 'PUT',
				headers: {
					Accept: 'application/json',
					'Content-Type': contentType
				},
				body: blob,
				signal
			}),
		getAlbumTracks: (id, query = {}) => getTrackPage(`/api/albums/${id}/tracks`, query),
		search: (query) =>
			requestJson(
				withQuery('/api/search', {
					q: query.q,
					limit: query.limit,
					offset: query.offset
				}),
				searchResponseSchema,
				{ signal: query.signal }
			),
		getDiscoverRandom: (query = {}) => getTrackPage('/api/discover/random', query),
		getDiscoverRecent: (query = {}) => getTrackPage('/api/discover/recent', query),
		getRecentlyPlayed: (query = {}) => getTrackPage('/api/discover/recently-played', query),
		getPlaylists: (query = {}) =>
			requestJson(
				withQuery('/api/playlists', {
					limit: query.limit,
					offset: query.offset
				}),
				playlistPageSchema,
				{ signal: query.signal }
			),
		getPlaylist: (id, signal) => requestJson(`/api/playlists/${id}`, playlistSchema, { signal }),
		createPlaylist: (name, signal) =>
			requestJson(`/api/playlists`, playlistSchema, {
				...jsonMutation('POST', { name }),
				signal
			}),
		updatePlaylist: (id, name, signal) =>
			requestJson(`/api/playlists/${id}`, playlistSchema, {
				...jsonMutation('PATCH', { name }),
				signal
			}),
		deletePlaylist: async (id, signal) => {
			await requestEmpty(`/api/playlists/${id}`, {
				...jsonMutation('DELETE'),
				signal
			});
		},
		getPlaylistTracks: (id, query = {}) => getTrackPage(`/api/playlists/${id}/tracks`, query),
		setPlaylistTracks: async (id, trackIds, signal) => {
			await requestEmpty(`/api/playlists/${id}/tracks`, {
				...jsonMutation('PUT', { track_ids: trackIds }),
				signal
			});
		},
		getFavourites: (query = {}) => getTrackPage('/api/favourites', query),
		addFavourite: async (trackId, signal) => {
			await requestEmpty(`/api/favourites/${trackId}`, {
				...jsonMutation('PUT'),
				signal
			});
		},
		removeFavourite: async (trackId, signal) => {
			await requestEmpty(`/api/favourites/${trackId}`, {
				...jsonMutation('DELETE'),
				signal
			});
		},
		getHistory: (query = {}) =>
			requestJson(
				withQuery('/api/history', {
					limit: query.limit,
					offset: query.offset
				}),
				historyPageSchema,
				{ signal: query.signal }
			),
		recordHistory: async (trackId, signal) => {
			await requestEmpty('/api/history', {
				...jsonMutation('POST', { track_id: trackId }),
				signal
			});
		}
	};
}
