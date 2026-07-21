import { coverUrl, type Track } from '$lib/api';
import type { PlaybackStatus } from './player.svelte';

export type MediaSessionActions = {
	play: () => void;
	pause: () => void;
	next: () => void;
	previous: () => void;
	seek: (seconds: number) => void;
	/** Relative seek used by lock-screen skip-back / skip-forward. */
	seekBy: (deltaSeconds: number) => void;
};

let actionsBound = false;

/** Wire lock-screen / OS media controls once. Safe to call repeatedly. */
export function bindMediaSessionActions(actions: MediaSessionActions): void {
	if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || actionsBound) {
		return;
	}
	actionsBound = true;
	const session = navigator.mediaSession;

	const set = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
		try {
			session.setActionHandler(action, handler);
		} catch {
			// Older / embedded browsers reject unsupported actions.
		}
	};

	set('play', () => actions.play());
	set('pause', () => actions.pause());
	set('previoustrack', () => actions.previous());
	set('nexttrack', () => actions.next());
	set('seekto', (details) => {
		if (typeof details.seekTime === 'number') {
			actions.seek(details.seekTime);
		}
	});
	set('seekbackward', (details) => {
		actions.seekBy(-(details.seekOffset ?? 10));
	});
	set('seekforward', (details) => {
		actions.seekBy(details.seekOffset ?? 10);
	});
}

export function syncMediaSession(options: {
	track: Track | null;
	baseUrl: string | null;
	playbackStatus: PlaybackStatus;
	position: number;
	duration: number;
}): void {
	if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
		return;
	}

	const session = navigator.mediaSession;
	const { track, baseUrl, playbackStatus, position, duration } = options;

	if (!track) {
		session.metadata = null;
		session.playbackState = 'none';
		return;
	}

	const artwork =
		track.cover_id != null && baseUrl
			? [
					{
						src: coverUrl(baseUrl, track.cover_id),
						sizes: '512x512',
						type: 'image/jpeg'
					}
				]
			: [];

	session.metadata = new MediaMetadata({
		title: track.title || track.filename || 'Unknown title',
		artist: track.artist || 'Unknown artist',
		album: track.album || '',
		artwork
	});

	if (playbackStatus === 'playing' || playbackStatus === 'loading') {
		session.playbackState = 'playing';
	} else if (playbackStatus === 'paused') {
		session.playbackState = 'paused';
	} else {
		session.playbackState = 'none';
	}

	if (
		Number.isFinite(duration) &&
		duration > 0 &&
		Number.isFinite(position) &&
		typeof session.setPositionState === 'function'
	) {
		try {
			session.setPositionState({
				duration,
				position: Math.min(Math.max(0, position), duration),
				playbackRate: 1
			});
		} catch {
			// Some engines throw if position > duration during track changes.
		}
	}
}

export function clearMediaSession(): void {
	actionsBound = false;
	if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
		return;
	}
	navigator.mediaSession.metadata = null;
	navigator.mediaSession.playbackState = 'none';
}
