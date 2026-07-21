import {
	createMediaServerClient,
	MediaServerRequestError,
	streamUrl,
	type FetchLike,
	type MediaServerClient,
	type Track
} from '$lib/api';
import {
	buildShuffleOrder,
	canResolveNext,
	canResolvePrevious,
	replaceQueue,
	resolveNextIndex,
	resolvePreviousIndex,
	shouldRecordHistory,
	type RepeatMode
} from './queue';

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';

export type { RepeatMode };

export type PlayerControllerOptions = {
	getBaseUrl: () => string | null;
	fetch?: FetchLike;
	createClient?: typeof createMediaServerClient;
	historyThresholdSeconds?: number;
};

type AudioLike = Pick<
	HTMLAudioElement,
	| 'src'
	| 'currentTime'
	| 'duration'
	| 'paused'
	| 'ended'
	| 'error'
	| 'play'
	| 'pause'
	| 'addEventListener'
	| 'removeEventListener'
>;

const REPEAT_CYCLE: RepeatMode[] = ['off', 'all', 'one'];

function isAbortError(cause: unknown): boolean {
	return cause instanceof DOMException && cause.name === 'AbortError';
}

function isAutoplayBlocked(cause: unknown): boolean {
	return cause instanceof DOMException && cause.name === 'NotAllowedError';
}

export class PlayerController {
	queue = $state.raw<Track[]>([]);
	index = $state(-1);
	playbackStatus = $state<PlaybackStatus>('idle');
	position = $state(0);
	duration = $state(0);
	errorMessage = $state<string | null>(null);
	shuffle = $state(false);
	repeat = $state<RepeatMode>('off');
	shuffleOrder = $state.raw<number[]>([]);

	#audio: AudioLike | null = null;
	#getBaseUrl: () => string | null;
	#fetch: FetchLike;
	#createClient: typeof createMediaServerClient;
	#historyThresholdSeconds: number;
	#historyRecordedForTrackId: number | null = null;
	#historyPendingForTrackId: number | null = null;
	#loadToken = 0;
	#listenersAttached = false;
	/** True when autoplay was requested but play() was blocked (common when backgrounded). */
	#autoplayPending = false;

	constructor(options: PlayerControllerOptions) {
		this.#getBaseUrl = options.getBaseUrl;
		this.#fetch = options.fetch ?? fetch;
		this.#createClient = options.createClient ?? createMediaServerClient;
		this.#historyThresholdSeconds = options.historyThresholdSeconds ?? 1;
	}

	get currentTrack(): Track | null {
		if (this.index < 0 || this.index >= this.queue.length) return null;
		return this.queue[this.index] ?? null;
	}

	get hasQueue(): boolean {
		return this.queue.length > 0;
	}

	get canGoNext(): boolean {
		return canResolveNext(this.#resolveOptions());
	}

	get canGoPrevious(): boolean {
		return canResolvePrevious(this.#resolveOptions());
	}

	attachAudio(audio: AudioLike): void {
		if (this.#audio === audio) return;
		this.#detachListeners();
		this.#audio = audio;
		this.#attachListeners();
		if (this.currentTrack) {
			void this.#loadCurrent(true);
		}
	}

	playTracks(tracks: Track[], startIndex = 0): void {
		const next = replaceQueue(tracks, startIndex);
		this.queue = next.queue;
		this.index = next.index;
		this.errorMessage = null;
		this.#historyRecordedForTrackId = null;
		this.#syncShuffleOrder();
		if (!next.current) {
			this.playbackStatus = 'idle';
			this.position = 0;
			this.duration = 0;
			return;
		}
		void this.#loadCurrent(true);
	}

	updateTrackInQueue(updated: Track): void {
		this.queue = this.queue.map((track) => (track.id === updated.id ? updated : track));
	}

	toggleShuffle(): void {
		this.shuffle = !this.shuffle;
		this.#syncShuffleOrder();
	}

	cycleRepeat(): void {
		const i = REPEAT_CYCLE.indexOf(this.repeat);
		this.repeat = REPEAT_CYCLE[(i + 1) % REPEAT_CYCLE.length] ?? 'off';
	}

	async play(): Promise<void> {
		if (!this.#audio || !this.currentTrack) return;
		try {
			this.playbackStatus = 'loading';
			await this.#audio.play();
			this.#autoplayPending = false;
			this.playbackStatus = 'playing';
			this.errorMessage = null;
		} catch (cause) {
			if (isAbortError(cause)) return;
			if (isAutoplayBlocked(cause)) {
				this.#autoplayPending = true;
				this.playbackStatus = 'paused';
				this.errorMessage = null;
				return;
			}
			this.#autoplayPending = false;
			this.playbackStatus = 'error';
			this.errorMessage = cause instanceof Error ? cause.message : 'Playback failed';
		}
	}

	pause(): void {
		this.#autoplayPending = false;
		this.#audio?.pause();
		if (this.playbackStatus === 'playing' || this.playbackStatus === 'loading') {
			this.playbackStatus = 'paused';
		}
	}

	/** Retry autoplay after the page becomes visible again (car lock / background). */
	resumeIfNeeded(): void {
		if (!this.#autoplayPending || !this.currentTrack || !this.#audio) return;
		void this.play();
	}

	toggle(): void {
		if (this.playbackStatus === 'playing') {
			this.pause();
			return;
		}
		void this.play();
	}

	next(): void {
		const next = resolveNextIndex(this.#resolveOptions());
		if (next === null) return;
		if (next === this.index) {
			this.#restartCurrent();
			return;
		}
		this.index = next;
		this.#historyRecordedForTrackId = null;
		void this.#loadCurrent(true);
	}

	previous(): void {
		const previous = resolvePreviousIndex(this.#resolveOptions());
		if (previous === null) return;
		this.index = previous;
		this.#historyRecordedForTrackId = null;
		void this.#loadCurrent(true);
	}

	seek(seconds: number): void {
		if (!this.#audio || !Number.isFinite(seconds)) return;
		const max = Number.isFinite(this.#audio.duration) ? this.#audio.duration : seconds;
		this.#audio.currentTime = Math.max(0, Math.min(seconds, max));
		this.position = this.#audio.currentTime;
	}

	dispose(): void {
		this.#detachListeners();
		this.#audio = null;
		this.#loadToken += 1;
	}

	#resolveOptions() {
		return {
			index: this.index,
			length: this.queue.length,
			repeat: this.repeat,
			shuffle: this.shuffle,
			shuffleOrder: this.shuffleOrder
		};
	}

	#syncShuffleOrder(): void {
		if (!this.shuffle || this.queue.length === 0 || this.index < 0) {
			this.shuffleOrder = [];
			return;
		}
		this.shuffleOrder = buildShuffleOrder(this.queue.length, this.index);
	}

	#restartCurrent(): void {
		this.#historyRecordedForTrackId = null;
		if (this.#audio) {
			this.#audio.currentTime = 0;
			this.position = 0;
		}
		void this.play();
	}

	async #loadCurrent(autoplay: boolean): Promise<void> {
		const track = this.currentTrack;
		const audio = this.#audio;
		const baseUrl = this.#getBaseUrl();
		if (!track || !audio || !baseUrl) {
			this.#autoplayPending = false;
			this.playbackStatus = track ? 'error' : 'idle';
			if (track && !baseUrl) {
				this.errorMessage = 'Media server is not connected';
			}
			return;
		}

		const token = ++this.#loadToken;
		this.playbackStatus = 'loading';
		this.position = 0;
		this.duration = 0;
		this.errorMessage = null;
		this.#autoplayPending = autoplay;
		audio.src = streamUrl(baseUrl, track.id);

		if (!autoplay) {
			this.playbackStatus = 'paused';
			return;
		}

		try {
			// Call play() in the same turn as the ended/next handler when possible so
			// mobile / car browsers treat it as a continuation of the media session.
			await audio.play();
			if (token !== this.#loadToken) return;
			this.#autoplayPending = false;
			this.playbackStatus = 'playing';
		} catch (cause) {
			if (token !== this.#loadToken) return;
			if (isAbortError(cause)) return;
			if (isAutoplayBlocked(cause)) {
				this.#autoplayPending = true;
				this.playbackStatus = 'paused';
				this.errorMessage = null;
				return;
			}
			this.#autoplayPending = false;
			this.playbackStatus = 'error';
			this.errorMessage = cause instanceof Error ? cause.message : 'Playback failed';
		}
	}

	#attachListeners(): void {
		const audio = this.#audio;
		if (!audio || this.#listenersAttached) return;
		audio.addEventListener('timeupdate', this.#onTimeUpdate);
		audio.addEventListener('loadedmetadata', this.#onLoadedMetadata);
		audio.addEventListener('ended', this.#onEnded);
		audio.addEventListener('error', this.#onError);
		audio.addEventListener('pause', this.#onPause);
		audio.addEventListener('play', this.#onPlay);
		this.#listenersAttached = true;
	}

	#detachListeners(): void {
		const audio = this.#audio;
		if (!audio || !this.#listenersAttached) return;
		audio.removeEventListener('timeupdate', this.#onTimeUpdate);
		audio.removeEventListener('loadedmetadata', this.#onLoadedMetadata);
		audio.removeEventListener('ended', this.#onEnded);
		audio.removeEventListener('error', this.#onError);
		audio.removeEventListener('pause', this.#onPause);
		audio.removeEventListener('play', this.#onPlay);
		this.#listenersAttached = false;
	}

	#onTimeUpdate = (): void => {
		const audio = this.#audio;
		if (!audio) return;
		this.position = audio.currentTime;
		if (Number.isFinite(audio.duration)) {
			this.duration = audio.duration;
		}
		void this.#maybeRecordHistory();
	};

	#onLoadedMetadata = (): void => {
		const audio = this.#audio;
		if (!audio) return;
		this.duration = Number.isFinite(audio.duration) ? audio.duration : 0;
	};

	#onEnded = (): void => {
		const next = resolveNextIndex(this.#resolveOptions());
		if (next === null) {
			this.playbackStatus = 'ended';
			return;
		}
		if (next === this.index) {
			this.#restartCurrent();
			return;
		}
		this.index = next;
		this.#historyRecordedForTrackId = null;
		void this.#loadCurrent(true);
	};

	#onError = (): void => {
		this.playbackStatus = 'error';
		this.errorMessage = 'Unable to play this track';
	};

	#onPause = (): void => {
		if (this.playbackStatus === 'ended' || this.playbackStatus === 'error') return;
		if (this.#audio && !this.#audio.ended) {
			this.playbackStatus = 'paused';
		}
	};

	#onPlay = (): void => {
		this.#autoplayPending = false;
		this.playbackStatus = 'playing';
		this.errorMessage = null;
	};

	async #maybeRecordHistory(): Promise<void> {
		const track = this.currentTrack;
		if (
			!shouldRecordHistory({
				trackId: track?.id ?? null,
				alreadyRecordedTrackId: this.#historyRecordedForTrackId,
				positionSeconds: this.position,
				thresholdSeconds: this.#historyThresholdSeconds
			})
		) {
			return;
		}

		const baseUrl = this.#getBaseUrl();
		if (!track || !baseUrl || this.#historyPendingForTrackId === track.id) return;

		this.#historyPendingForTrackId = track.id;
		try {
			const client: MediaServerClient = this.#createClient({
				baseUrl,
				fetch: this.#fetch
			});
			await client.recordHistory(track.id);
			this.#historyRecordedForTrackId = track.id;
		} catch (cause) {
			// Soft-fail: playback continues even without user-db / network.
			if (cause instanceof MediaServerRequestError && cause.error.kind === 'no_user_db') {
				this.#historyRecordedForTrackId = track.id;
				return;
			}
		} finally {
			if (this.#historyPendingForTrackId === track.id) {
				this.#historyPendingForTrackId = null;
			}
		}
	}
}
