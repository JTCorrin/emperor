import {
	createMediaServerClient,
	MediaServerRequestError,
	type FetchLike,
	type LibraryStatus,
	type MediaServerError
} from '$lib/api';
import { BaseUrlError, normalizeBaseUrl } from '$lib/api/url';

export const CONNECTION_STORAGE_KEY = 'emperor:media-server-base-url';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export type ConnectionControllerOptions = {
	storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
	fetch?: FetchLike;
	createClient?: typeof createMediaServerClient;
};

function toMediaServerError(cause: unknown): MediaServerError {
	if (cause instanceof MediaServerRequestError) {
		return cause.error;
	}

	if (cause instanceof BaseUrlError) {
		return {
			kind: 'schema',
			message: cause.message,
			cause
		};
	}

	return {
		kind: 'network',
		message: cause instanceof Error ? cause.message : 'Could not reach the media server',
		cause
	};
}

export class ConnectionController {
	baseUrl = $state<string | null>(null);
	status = $state<ConnectionStatus>('idle');
	libraryStatus = $state<LibraryStatus | null>(null);
	error = $state<MediaServerError | null>(null);

	#storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
	#fetch: FetchLike;
	#createClient: typeof createMediaServerClient;
	#probeController: AbortController | null = null;

	constructor(options: ConnectionControllerOptions = {}) {
		this.#storage =
			options.storage === undefined
				? typeof localStorage === 'undefined'
					? null
					: localStorage
				: options.storage;
		this.#fetch = options.fetch ?? fetch;
		this.#createClient = options.createClient ?? createMediaServerClient;
	}

	get isConnected(): boolean {
		return this.status === 'connected' && this.baseUrl !== null;
	}

	restore(): string | null {
		const saved = this.#storage?.getItem(CONNECTION_STORAGE_KEY);
		if (!saved) {
			this.baseUrl = null;
			this.status = 'idle';
			return null;
		}

		try {
			this.baseUrl = normalizeBaseUrl(saved);
			this.status = 'disconnected';
			return this.baseUrl;
		} catch {
			this.#storage?.removeItem(CONNECTION_STORAGE_KEY);
			this.baseUrl = null;
			this.status = 'idle';
			return null;
		}
	}

	async connect(rawBaseUrl: string): Promise<boolean> {
		this.#probeController?.abort();
		const probe = new AbortController();
		this.#probeController = probe;

		this.status = 'connecting';
		this.error = null;
		this.libraryStatus = null;

		try {
			const normalized = normalizeBaseUrl(rawBaseUrl);
			const client = this.#createClient({
				baseUrl: normalized,
				fetch: this.#fetch
			});

			await client.ping(probe.signal);
			const libraryStatus = await client.getLibraryStatus(probe.signal);

			if (probe.signal.aborted) {
				return false;
			}

			this.baseUrl = client.baseUrl;
			this.libraryStatus = libraryStatus;
			this.status = 'connected';
			this.error = null;
			this.#storage?.setItem(CONNECTION_STORAGE_KEY, client.baseUrl);
			return true;
		} catch (cause) {
			if (probe.signal.aborted) {
				if (this.baseUrl) {
					this.status = 'disconnected';
				} else {
					this.status = 'idle';
				}
				return false;
			}

			this.status = 'error';
			this.error = toMediaServerError(cause);
			this.libraryStatus = null;
			return false;
		} finally {
			if (this.#probeController === probe) {
				this.#probeController = null;
			}
		}
	}

	async recheck(): Promise<boolean> {
		if (!this.baseUrl) {
			const restored = this.restore();
			if (!restored) {
				return false;
			}
		}

		return this.connect(this.baseUrl!);
	}

	disconnect(): void {
		this.#probeController?.abort();
		this.#probeController = null;
		this.#storage?.removeItem(CONNECTION_STORAGE_KEY);
		this.baseUrl = null;
		this.libraryStatus = null;
		this.error = null;
		this.status = 'idle';
	}
}
