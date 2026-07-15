import {
	createMediaServerClient,
	MediaServerRequestError,
	type Album,
	type Artist,
	type FetchLike,
	type Track
} from '$lib/api';
import { isFuzzySearchEligible } from './searchPolicy';

export type SearchSectionStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export type SearchSection<T> = {
	status: SearchSectionStatus;
	items: T[];
	total: number;
	errorMessage: string | null;
};

export type SearchResultsState = {
	query: string;
	tracks: SearchSection<Track>;
	artists: SearchSection<Artist>;
	albums: SearchSection<Album>;
};

const SEARCH_LIMIT = 20;

function emptySection<T>(status: SearchSectionStatus = 'idle'): SearchSection<T> {
	return { status, items: [], total: 0, errorMessage: null };
}

export function createEmptySearchResults(query = ''): SearchResultsState {
	return {
		query,
		tracks: emptySection(),
		artists: emptySection(),
		albums: emptySection()
	};
}

export type SearchResultsControllerOptions = {
	getBaseUrl: () => string | null;
	fetch?: FetchLike;
	createClient?: typeof createMediaServerClient;
};

export class SearchResultsController {
	state = $state<SearchResultsState>(createEmptySearchResults());

	#getBaseUrl: () => string | null;
	#fetch: FetchLike;
	#createClient: typeof createMediaServerClient;
	#abort: AbortController | null = null;
	#token = 0;

	constructor(options: SearchResultsControllerOptions) {
		this.#getBaseUrl = options.getBaseUrl;
		this.#fetch = options.fetch ?? fetch;
		this.#createClient = options.createClient ?? createMediaServerClient;
	}

	async search(rawQuery: string): Promise<void> {
		const query = rawQuery.trim();
		const baseUrl = this.#getBaseUrl();

		this.#abort?.abort();
		const abort = new AbortController();
		this.#abort = abort;
		const token = ++this.#token;

		if (!query) {
			this.state = createEmptySearchResults('');
			return;
		}

		if (!isFuzzySearchEligible(query)) {
			this.state = {
				query,
				tracks: emptySection('idle'),
				artists: emptySection('idle'),
				albums: emptySection('idle')
			};
			return;
		}

		if (!baseUrl) {
			this.state = {
				query,
				tracks: emptySection('error'),
				artists: emptySection('error'),
				albums: emptySection('error')
			};
			this.state.tracks.errorMessage = 'Not connected to a media server.';
			return;
		}

		this.state = {
			query,
			tracks: emptySection('loading'),
			artists: emptySection('loading'),
			albums: emptySection('loading')
		};

		try {
			const client = this.#createClient({ baseUrl, fetch: this.#fetch });
			const result = await client.search({
				q: query,
				limit: SEARCH_LIMIT,
				fuzzy: true,
				signal: abort.signal
			});

			if (token !== this.#token) return;

			this.state = {
				query: result.q,
				tracks: {
					status: result.tracks.items.length === 0 ? 'empty' : 'ready',
					items: result.tracks.items,
					total: result.tracks.total,
					errorMessage: null
				},
				artists: {
					status: result.artists.items.length === 0 ? 'empty' : 'ready',
					items: result.artists.items,
					total: result.artists.total,
					errorMessage: null
				},
				albums: {
					status: result.albums.items.length === 0 ? 'empty' : 'ready',
					items: result.albums.items,
					total: result.albums.total,
					errorMessage: null
				}
			};
		} catch (cause) {
			if (token !== this.#token) return;
			if (cause instanceof MediaServerRequestError && cause.error.kind === 'aborted') {
				return;
			}
			const message = cause instanceof Error ? cause.message : 'Search failed.';
			this.state = {
				query,
				tracks: { status: 'error', items: [], total: 0, errorMessage: message },
				artists: { status: 'error', items: [], total: 0, errorMessage: message },
				albums: { status: 'error', items: [], total: 0, errorMessage: message }
			};
		}
	}

	dispose(): void {
		this.#abort?.abort();
		this.#abort = null;
	}
}
