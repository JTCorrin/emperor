import {
	createMediaServerClient,
	MediaServerRequestError,
	type FetchLike,
	type MediaServerClient,
	type Playlist,
	type Track
} from '$lib/api';

export type ShelfStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'unavailable';

export type TrackShelfState = {
	status: ShelfStatus;
	items: Track[];
	errorMessage: string | null;
};

export type PlaylistShelfState = {
	status: ShelfStatus;
	items: Playlist[];
	errorMessage: string | null;
};

export type HomeShelvesState = {
	discover: TrackShelfState;
	recent: TrackShelfState;
	recentlyPlayed: TrackShelfState;
	playlists: PlaylistShelfState;
	favourites: TrackShelfState;
};

const SHELF_LIMIT = 20;

function emptyTrackShelf(status: ShelfStatus = 'idle'): TrackShelfState {
	return { status, items: [], errorMessage: null };
}

function emptyPlaylistShelf(status: ShelfStatus = 'idle'): PlaylistShelfState {
	return { status, items: [], errorMessage: null };
}

export function createInitialHomeShelves(): HomeShelvesState {
	return {
		discover: emptyTrackShelf(),
		recent: emptyTrackShelf(),
		recentlyPlayed: emptyTrackShelf(),
		playlists: emptyPlaylistShelf(),
		favourites: emptyTrackShelf()
	};
}

async function loadTrackShelf(loader: () => Promise<{ items: Track[] }>): Promise<TrackShelfState> {
	try {
		const page = await loader();
		if (page.items.length === 0) {
			return { status: 'empty', items: [], errorMessage: null };
		}
		return { status: 'ready', items: page.items, errorMessage: null };
	} catch (cause) {
		if (cause instanceof MediaServerRequestError && cause.error.kind === 'no_user_db') {
			return {
				status: 'unavailable',
				items: [],
				errorMessage: cause.error.message
			};
		}
		if (cause instanceof MediaServerRequestError && cause.error.kind === 'aborted') {
			return emptyTrackShelf('loading');
		}
		return {
			status: 'error',
			items: [],
			errorMessage: cause instanceof Error ? cause.message : 'Could not load this shelf.'
		};
	}
}

async function loadPlaylistShelf(
	loader: () => Promise<{ items: Playlist[] }>
): Promise<PlaylistShelfState> {
	try {
		const page = await loader();
		if (page.items.length === 0) {
			return { status: 'empty', items: [], errorMessage: null };
		}
		return { status: 'ready', items: page.items, errorMessage: null };
	} catch (cause) {
		if (cause instanceof MediaServerRequestError && cause.error.kind === 'no_user_db') {
			return {
				status: 'unavailable',
				items: [],
				errorMessage: cause.error.message
			};
		}
		if (cause instanceof MediaServerRequestError && cause.error.kind === 'aborted') {
			return emptyPlaylistShelf('loading');
		}
		return {
			status: 'error',
			items: [],
			errorMessage: cause instanceof Error ? cause.message : 'Could not load this shelf.'
		};
	}
}

export type HomeShelvesControllerOptions = {
	getBaseUrl: () => string | null;
	fetch?: FetchLike;
	createClient?: typeof createMediaServerClient;
};

export class HomeShelvesController {
	shelves = $state<HomeShelvesState>(createInitialHomeShelves());
	refreshing = $state(false);

	#getBaseUrl: () => string | null;
	#fetch: FetchLike;
	#createClient: typeof createMediaServerClient;
	#abort: AbortController | null = null;
	#token = 0;

	constructor(options: HomeShelvesControllerOptions) {
		this.#getBaseUrl = options.getBaseUrl;
		this.#fetch = options.fetch ?? fetch;
		this.#createClient = options.createClient ?? createMediaServerClient;
	}

	async load(): Promise<void> {
		const baseUrl = this.#getBaseUrl();
		if (!baseUrl) {
			this.shelves = createInitialHomeShelves();
			return;
		}

		this.#abort?.abort();
		const abort = new AbortController();
		this.#abort = abort;
		const token = ++this.#token;
		this.refreshing = true;

		const markLoading = (): HomeShelvesState => ({
			discover:
				this.shelves.discover.status === 'ready'
					? this.shelves.discover
					: emptyTrackShelf('loading'),
			recent:
				this.shelves.recent.status === 'ready' ? this.shelves.recent : emptyTrackShelf('loading'),
			recentlyPlayed:
				this.shelves.recentlyPlayed.status === 'ready'
					? this.shelves.recentlyPlayed
					: emptyTrackShelf('loading'),
			playlists:
				this.shelves.playlists.status === 'ready'
					? this.shelves.playlists
					: emptyPlaylistShelf('loading'),
			favourites:
				this.shelves.favourites.status === 'ready'
					? this.shelves.favourites
					: emptyTrackShelf('loading')
		});
		this.shelves = markLoading();

		const client: MediaServerClient = this.#createClient({
			baseUrl,
			fetch: this.#fetch
		});
		const signal = abort.signal;
		const query = { limit: SHELF_LIMIT, signal };

		const [discover, recent, recentlyPlayed, playlists, favourites] = await Promise.all([
			loadTrackShelf(() => client.getDiscoverRandom(query)),
			loadTrackShelf(() => client.getDiscoverRecent(query)),
			loadTrackShelf(() => client.getRecentlyPlayed(query)),
			loadPlaylistShelf(() => client.getPlaylists(query)),
			loadTrackShelf(() => client.getFavourites(query))
		]);

		if (token !== this.#token) {
			return;
		}

		this.refreshing = false;
		if (abort.signal.aborted) {
			return;
		}

		this.shelves = { discover, recent, recentlyPlayed, playlists, favourites };
	}

	async refresh(): Promise<void> {
		await this.load();
	}

	dispose(): void {
		this.#abort?.abort();
		this.#abort = null;
	}
}
