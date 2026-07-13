import {
	createMediaServerClient,
	MediaServerRequestError,
	type FetchLike,
	type Track
} from '$lib/api';

export type FavouritesControllerOptions = {
	getBaseUrl: () => string | null;
	getHasUserDb: () => boolean | null;
	fetch?: FetchLike;
	createClient?: typeof createMediaServerClient;
};

export class FavouritesController {
	ids = $state.raw<number[]>([]);
	status = $state<'idle' | 'loading' | 'ready' | 'unavailable' | 'error'>('idle');
	errorMessage = $state<string | null>(null);
	pendingIds = $state.raw<number[]>([]);

	#getBaseUrl: () => string | null;
	#getHasUserDb: () => boolean | null;
	#fetch: FetchLike;
	#createClient: typeof createMediaServerClient;
	#abort: AbortController | null = null;
	#token = 0;

	constructor(options: FavouritesControllerOptions) {
		this.#getBaseUrl = options.getBaseUrl;
		this.#getHasUserDb = options.getHasUserDb;
		this.#fetch = options.fetch ?? fetch;
		this.#createClient = options.createClient ?? createMediaServerClient;
	}

	isFavourite(trackId: number): boolean {
		return this.ids.includes(trackId);
	}

	isPending(trackId: number): boolean {
		return this.pendingIds.includes(trackId);
	}

	async load(): Promise<void> {
		const baseUrl = this.#getBaseUrl();
		const hasUserDb = this.#getHasUserDb();

		this.#abort?.abort();
		const abort = new AbortController();
		this.#abort = abort;
		const token = ++this.#token;

		if (hasUserDb === false) {
			this.status = 'unavailable';
			this.ids = [];
			this.errorMessage = null;
			return;
		}

		if (!baseUrl) {
			this.status = 'idle';
			this.ids = [];
			return;
		}

		this.status = 'loading';
		this.errorMessage = null;

		try {
			const client = this.#createClient({ baseUrl, fetch: this.#fetch });
			const page = await client.getFavourites({ limit: 200, signal: abort.signal });
			if (token !== this.#token) return;
			this.ids = page.items.map((t) => t.id);
			this.status = 'ready';
		} catch (cause) {
			if (token !== this.#token) return;
			if (cause instanceof MediaServerRequestError && cause.error.kind === 'aborted') return;
			if (cause instanceof MediaServerRequestError && cause.error.kind === 'no_user_db') {
				this.status = 'unavailable';
				this.ids = [];
				this.errorMessage = null;
				return;
			}
			this.status = 'error';
			this.errorMessage = cause instanceof Error ? cause.message : 'Could not load favourites.';
		}
	}

	async toggle(track: Track): Promise<boolean> {
		const baseUrl = this.#getBaseUrl();
		if (!baseUrl || this.#getHasUserDb() === false || this.pendingIds.includes(track.id)) {
			return false;
		}

		const wasFavourite = this.ids.includes(track.id);
		this.ids = wasFavourite ? this.ids.filter((id) => id !== track.id) : [...this.ids, track.id];
		this.pendingIds = [...this.pendingIds, track.id];
		this.errorMessage = null;

		try {
			const client = this.#createClient({ baseUrl, fetch: this.#fetch });
			if (wasFavourite) {
				await client.removeFavourite(track.id);
			} else {
				await client.addFavourite(track.id);
			}
			this.pendingIds = this.pendingIds.filter((id) => id !== track.id);
			return true;
		} catch (cause) {
			this.ids = wasFavourite ? [...this.ids, track.id] : this.ids.filter((id) => id !== track.id);
			this.pendingIds = this.pendingIds.filter((id) => id !== track.id);
			this.errorMessage = cause instanceof Error ? cause.message : 'Could not update favourite.';
			return false;
		}
	}

	dispose(): void {
		this.#abort?.abort();
		this.#abort = null;
	}
}
