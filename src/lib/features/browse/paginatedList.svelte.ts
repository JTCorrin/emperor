import {
	createMediaServerClient,
	MediaServerRequestError,
	type FetchLike,
	type MediaServerClient,
	type PageEnvelope
} from '$lib/api';

export type ListStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export type PaginatedListState<T> = {
	status: ListStatus;
	items: T[];
	total: number;
	errorMessage: string | null;
};

const DEFAULT_PAGE_SIZE = 50;

export type PaginatedListControllerOptions<T> = {
	getBaseUrl: () => string | null;
	fetchPage: (
		client: MediaServerClient,
		query: { limit: number; offset: number; signal: AbortSignal }
	) => Promise<PageEnvelope<T>>;
	pageSize?: number;
	fetch?: FetchLike;
	createClient?: typeof createMediaServerClient;
};

export class PaginatedListController<T> {
	status = $state<ListStatus>('idle');
	items = $state.raw<T[]>([]);
	total = $state(0);
	errorMessage = $state<string | null>(null);
	loadingMore = $state(false);

	#getBaseUrl: () => string | null;
	#fetchPage: PaginatedListControllerOptions<T>['fetchPage'];
	#pageSize: number;
	#fetch: FetchLike;
	#createClient: typeof createMediaServerClient;
	#abort: AbortController | null = null;
	#token = 0;

	constructor(options: PaginatedListControllerOptions<T>) {
		this.#getBaseUrl = options.getBaseUrl;
		this.#fetchPage = options.fetchPage;
		this.#pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
		this.#fetch = options.fetch ?? fetch;
		this.#createClient = options.createClient ?? createMediaServerClient;
	}

	get hasMore(): boolean {
		return this.items.length < this.total;
	}

	async load(): Promise<void> {
		const baseUrl = this.#getBaseUrl();
		if (!baseUrl) {
			this.status = 'idle';
			this.items = [];
			this.total = 0;
			this.errorMessage = null;
			return;
		}

		this.#abort?.abort();
		const abort = new AbortController();
		this.#abort = abort;
		const token = ++this.#token;

		this.status = 'loading';
		this.items = [];
		this.total = 0;
		this.errorMessage = null;
		this.loadingMore = false;

		try {
			const client = this.#createClient({ baseUrl, fetch: this.#fetch });
			const page = await this.#fetchPage(client, {
				limit: this.#pageSize,
				offset: 0,
				signal: abort.signal
			});

			if (token !== this.#token) return;

			this.items = page.items;
			this.total = page.total;
			this.status = page.items.length === 0 ? 'empty' : 'ready';
			this.errorMessage = null;
		} catch (cause) {
			if (token !== this.#token) return;
			if (cause instanceof MediaServerRequestError && cause.error.kind === 'aborted') {
				return;
			}
			this.status = 'error';
			this.items = [];
			this.total = 0;
			this.errorMessage = cause instanceof Error ? cause.message : 'Could not load this list.';
		}
	}

	async loadMore(): Promise<void> {
		const baseUrl = this.#getBaseUrl();
		if (!baseUrl || !this.hasMore || this.loadingMore || this.status !== 'ready') {
			return;
		}

		this.#abort?.abort();
		const abort = new AbortController();
		this.#abort = abort;
		const token = ++this.#token;
		this.loadingMore = true;

		try {
			const client = this.#createClient({ baseUrl, fetch: this.#fetch });
			const page = await this.#fetchPage(client, {
				limit: this.#pageSize,
				offset: this.items.length,
				signal: abort.signal
			});

			if (token !== this.#token) return;

			this.items = [...this.items, ...page.items];
			this.total = page.total;
			this.loadingMore = false;
		} catch (cause) {
			if (token !== this.#token) return;
			if (cause instanceof MediaServerRequestError && cause.error.kind === 'aborted') {
				return;
			}
			this.loadingMore = false;
			this.errorMessage = cause instanceof Error ? cause.message : 'Could not load more.';
		}
	}

	dispose(): void {
		this.#abort?.abort();
		this.#abort = null;
	}
}
