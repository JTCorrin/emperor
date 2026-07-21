import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackFixture } from '$lib/test/fixtures';
import {
	bindMediaSessionActions,
	clearMediaSession,
	syncMediaSession
} from './mediaSession';

describe('mediaSession', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		clearMediaSession();
	});

	it('binds action handlers once and syncs metadata for the current track', () => {
		const handlers = new Map<string, MediaSessionActionHandler | null>();
		const setActionHandler = vi.fn((action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
			handlers.set(action, handler);
		});
		const setPositionState = vi.fn();
		const mediaSession = {
			metadata: null as MediaMetadata | null,
			playbackState: 'none' as MediaSessionPlaybackState,
			setActionHandler,
			setPositionState
		};
		vi.stubGlobal('navigator', { mediaSession });
		vi.stubGlobal(
			'MediaMetadata',
			class {
				title: string;
				artist: string;
				album: string;
				artwork: MediaImage[];
				constructor(init: MediaMetadataInit) {
					this.title = init.title ?? '';
					this.artist = init.artist ?? '';
					this.album = init.album ?? '';
					this.artwork = init.artwork ? [...init.artwork] : [];
				}
			}
		);

		const actions = {
			play: vi.fn(),
			pause: vi.fn(),
			next: vi.fn(),
			previous: vi.fn(),
			seek: vi.fn(),
			seekBy: vi.fn()
		};

		bindMediaSessionActions(actions);
		bindMediaSessionActions(actions);
		expect(setActionHandler).toHaveBeenCalledTimes(7);

		handlers.get('play')?.(
			{ action: 'play' } as MediaSessionActionDetails
		);
		handlers.get('nexttrack')?.(
			{ action: 'nexttrack' } as MediaSessionActionDetails
		);
		expect(actions.play).toHaveBeenCalledOnce();
		expect(actions.next).toHaveBeenCalledOnce();

		const track = trackFixture({
			title: 'Song',
			artist: 'Artist',
			album: 'Album',
			cover_id: 9
		});
		syncMediaSession({
			track,
			baseUrl: 'http://127.0.0.1:8080',
			playbackStatus: 'playing',
			position: 12,
			duration: 120
		});

		expect(mediaSession.metadata?.title).toBe('Song');
		expect(mediaSession.metadata?.artist).toBe('Artist');
		expect(mediaSession.metadata?.artwork[0]?.src).toBe('http://127.0.0.1:8080/cover/9');
		expect(mediaSession.playbackState).toBe('playing');
		expect(setPositionState).toHaveBeenCalledWith({
			duration: 120,
			position: 12,
			playbackRate: 1
		});

		syncMediaSession({
			track: null,
			baseUrl: null,
			playbackStatus: 'idle',
			position: 0,
			duration: 0
		});
		expect(mediaSession.metadata).toBeNull();
		expect(mediaSession.playbackState).toBe('none');
	});
});
