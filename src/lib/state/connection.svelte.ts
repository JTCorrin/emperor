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
	/** Poll interval while libraryStatus.scanning is true. Default 2000ms. */
	scanPollIntervalMs?: number;
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
	/** true/false after probe; null when unknown or not connected */
	hasUserDb = $state<boolean | null>(null);
	scanPending = $state(false);
	scanError = $state<string | null>(null);

	#storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
	#fetch: FetchLike;
	#createClient: typeof createMediaServerClient;
	#probeController: AbortController | null = null;
	#statusController: AbortController | null = null;
	#scanPollTimer: ReturnType<typeof setInterval> | null = null;
	#scanPollIntervalMs: number;

	constructor(options: ConnectionControllerOptions = {}) {
		this.#storage =
			options.storage === undefined
				? typeof localStorage === 'undefined'
					? null
					: localStorage
				: options.storage;
		this.#fetch = options.fetch ?? fetch;
		this.#createClient = options.createClient ?? createMediaServerClient;
		this.#scanPollIntervalMs = options.scanPollIntervalMs ?? 2000;
	}

	get isConnected(): boolean {
		return this.status === 'connected' && this.baseUrl !== null;
	}

	#client() {
		if (!this.baseUrl) {
			throw new Error('Not connected');
		}
		return this.#createClient({
			baseUrl: this.baseUrl,
			fetch: this.#fetch
		});
	}

	#stopScanPoll() {
		if (this.#scanPollTimer !== null) {
			clearInterval(this.#scanPollTimer);
			this.#scanPollTimer = null;
		}
		this.#statusController?.abort();
		this.#statusController = null;
	}

	#syncScanPoll() {
		const scanning = this.status === 'connected' && this.libraryStatus?.scanning === true;
		if (!scanning) {
			this.#stopScanPoll();
			return;
		}
		if (this.#scanPollTimer !== null) return;

		this.#scanPollTimer = setInterval(() => {
			void this.refreshLibraryStatus();
		}, this.#scanPollIntervalMs);
	}

	restore(): string | null {
		const saved = this.#storage?.getItem(CONNECTION_STORAGE_KEY);
		if (!saved) {
			this.baseUrl = null;
			this.status = 'idle';
			this.hasUserDb = null;
			return null;
		}

		try {
			this.baseUrl = normalizeBaseUrl(saved);
			this.status = 'disconnected';
			this.hasUserDb = null;
			return this.baseUrl;
		} catch {
			this.#storage?.removeItem(CONNECTION_STORAGE_KEY);
			this.baseUrl = null;
			this.status = 'idle';
			this.hasUserDb = null;
			return null;
		}
	}

	async #probeUserDb(
		client: ReturnType<typeof createMediaServerClient>,
		signal: AbortSignal
	): Promise<boolean | null> {
		try {
			await client.getPlaylists({ limit: 1, signal });
			return true;
		} catch (cause) {
			if (cause instanceof MediaServerRequestError && cause.error.kind === 'no_user_db') {
				return false;
			}
			if (cause instanceof MediaServerRequestError && cause.error.kind === 'aborted') {
				return null;
			}
			return null;
		}
	}

	async connect(rawBaseUrl: string): Promise<boolean> {
		this.#probeController?.abort();
		this.#stopScanPoll();
		const probe = new AbortController();
		this.#probeController = probe;

		this.status = 'connecting';
		this.error = null;
		this.libraryStatus = null;
		this.hasUserDb = null;
		this.scanError = null;
		this.scanPending = false;

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

			const hasUserDb = await this.#probeUserDb(client, probe.signal);

			if (probe.signal.aborted) {
				return false;
			}

			this.baseUrl = client.baseUrl;
			this.libraryStatus = libraryStatus;
			this.hasUserDb = hasUserDb;
			this.status = 'connected';
			this.error = null;
			this.#storage?.setItem(CONNECTION_STORAGE_KEY, client.baseUrl);
			this.#syncScanPoll();
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
			this.hasUserDb = null;
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

	async refreshLibraryStatus(): Promise<boolean> {
		if (this.status !== 'connected' || !this.baseUrl) {
			return false;
		}

		this.#statusController?.abort();
		const abort = new AbortController();
		this.#statusController = abort;

		try {
			const status = await this.#client().getLibraryStatus(abort.signal);
			if (abort.signal.aborted) {
				return false;
			}
			this.libraryStatus = status;
			this.#syncScanPoll();
			return true;
		} catch (cause) {
			if (abort.signal.aborted) {
				return false;
			}
			if (cause instanceof MediaServerRequestError && cause.error.kind === 'aborted') {
				return false;
			}
			return false;
		} finally {
			if (this.#statusController === abort) {
				this.#statusController = null;
			}
		}
	}

	async startScan(force = false): Promise<boolean> {
		if (this.status !== 'connected' || !this.baseUrl) {
			this.scanError = 'Connect to a media server before scanning.';
			return false;
		}

		this.scanPending = true;
		this.scanError = null;

		try {
			await this.#client().startLibraryScan({ force });
			await this.refreshLibraryStatus();
			return true;
		} catch (cause) {
			if (cause instanceof MediaServerRequestError && cause.error.status === 409) {
				this.scanError = 'A library scan is already in progress.';
				await this.refreshLibraryStatus();
				return false;
			}
			this.scanError = cause instanceof Error ? cause.message : 'Could not start a library scan.';
			return false;
		} finally {
			this.scanPending = false;
		}
	}

	disconnect(): void {
		this.#probeController?.abort();
		this.#probeController = null;
		this.#stopScanPoll();
		this.#storage?.removeItem(CONNECTION_STORAGE_KEY);
		this.baseUrl = null;
		this.libraryStatus = null;
		this.error = null;
		this.hasUserDb = null;
		this.scanPending = false;
		this.scanError = null;
		this.status = 'idle';
	}
}
