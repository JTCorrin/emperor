import { describe, expect, it, vi } from 'vitest';
import { createMediaServerClient } from '$lib/api/client';
import { PlayerController } from '$lib/state/player.svelte';
import { createFetchStub, errorResponse, trackFixture } from '$lib/test/fixtures';

function createMockAudio() {
	const listeners = new Map<string, Set<EventListener>>();
	const audio = {
		src: '',
		currentTime: 0,
		duration: 120,
		paused: true,
		ended: false,
		error: null,
		play: vi.fn(async () => {
			audio.paused = false;
			audio.dispatch('play');
		}),
		pause: vi.fn(() => {
			audio.paused = true;
			audio.dispatch('pause');
		}),
		addEventListener: (type: string, listener: EventListener) => {
			const set = listeners.get(type) ?? new Set();
			set.add(listener);
			listeners.set(type, set);
		},
		removeEventListener: (type: string, listener: EventListener) => {
			listeners.get(type)?.delete(listener);
		},
		dispatch(type: string) {
			for (const listener of listeners.get(type) ?? []) {
				listener(new Event(type));
			}
		},
		listenerCount(type: string) {
			return listeners.get(type)?.size ?? 0;
		}
	};
	return audio;
}

describe('PlayerController', () => {
	it('replaces the queue and loads the selected track', async () => {
		const audio = createMockAudio();
		const player = new PlayerController({
			getBaseUrl: () => 'http://127.0.0.1:8080'
		});
		player.attachAudio(audio);

		const tracks = [trackFixture({ id: 1, title: 'A' }), trackFixture({ id: 2, title: 'B' })];
		player.playTracks(tracks, 1);

		expect(player.currentTrack?.id).toBe(2);
		expect(audio.src).toBe('http://127.0.0.1:8080/stream/2');
		await vi.waitFor(() => expect(player.playbackStatus).toBe('playing'));
	});

	it('moves next and previous within the queue', async () => {
		const audio = createMockAudio();
		const player = new PlayerController({
			getBaseUrl: () => 'http://127.0.0.1:8080'
		});
		player.attachAudio(audio);
		player.playTracks(
			[trackFixture({ id: 1 }), trackFixture({ id: 2 }), trackFixture({ id: 3 })],
			0
		);
		await vi.waitFor(() => expect(player.playbackStatus).toBe('playing'));

		player.next();
		expect(player.currentTrack?.id).toBe(2);
		player.previous();
		expect(player.currentTrack?.id).toBe(1);
	});

	it('advances on ended and stops at the end', async () => {
		const audio = createMockAudio();
		const player = new PlayerController({
			getBaseUrl: () => 'http://127.0.0.1:8080'
		});
		player.attachAudio(audio);
		player.playTracks([trackFixture({ id: 1 }), trackFixture({ id: 2 })], 0);
		await vi.waitFor(() => expect(player.playbackStatus).toBe('playing'));

		audio.dispatch('ended');
		expect(player.currentTrack?.id).toBe(2);

		audio.dispatch('ended');
		expect(player.playbackStatus).toBe('ended');
	});

	it('cycles repeat and wraps the queue when repeat is all', async () => {
		const audio = createMockAudio();
		const player = new PlayerController({
			getBaseUrl: () => 'http://127.0.0.1:8080'
		});
		player.attachAudio(audio);
		player.playTracks(
			[trackFixture({ id: 1 }), trackFixture({ id: 2 }), trackFixture({ id: 3 })],
			2
		);
		await vi.waitFor(() => expect(player.playbackStatus).toBe('playing'));

		expect(player.repeat).toBe('off');
		expect(player.canGoNext).toBe(false);
		player.cycleRepeat();
		expect(player.repeat).toBe('all');
		expect(player.canGoNext).toBe(true);
		expect(player.canGoPrevious).toBe(true);

		player.next();
		expect(player.currentTrack?.id).toBe(1);

		audio.dispatch('ended');
		expect(player.currentTrack?.id).toBe(2);

		player.cycleRepeat();
		expect(player.repeat).toBe('one');
		player.cycleRepeat();
		expect(player.repeat).toBe('off');
	});

	it('restarts the current track when repeat is one', async () => {
		const audio = createMockAudio();
		const player = new PlayerController({
			getBaseUrl: () => 'http://127.0.0.1:8080'
		});
		player.attachAudio(audio);
		player.playTracks([trackFixture({ id: 1 }), trackFixture({ id: 2 })], 0);
		await vi.waitFor(() => expect(player.playbackStatus).toBe('playing'));

		player.cycleRepeat();
		player.cycleRepeat();
		expect(player.repeat).toBe('one');
		expect(player.canGoNext).toBe(true);

		audio.currentTime = 40;
		player.position = 40;
		player.next();
		expect(player.currentTrack?.id).toBe(1);
		expect(audio.currentTime).toBe(0);

		audio.currentTime = 50;
		audio.dispatch('ended');
		expect(player.currentTrack?.id).toBe(1);
		expect(audio.currentTime).toBe(0);
		await vi.waitFor(() => expect(player.playbackStatus).toBe('playing'));
	});

	it('builds a shuffle order with the current track first', async () => {
		const audio = createMockAudio();
		const player = new PlayerController({
			getBaseUrl: () => 'http://127.0.0.1:8080'
		});
		player.attachAudio(audio);
		player.playTracks(
			[
				trackFixture({ id: 1 }),
				trackFixture({ id: 2 }),
				trackFixture({ id: 3 }),
				trackFixture({ id: 4 })
			],
			2
		);
		await vi.waitFor(() => expect(player.playbackStatus).toBe('playing'));

		expect(player.shuffle).toBe(false);
		expect(player.shuffleOrder).toEqual([]);
		player.toggleShuffle();
		expect(player.shuffle).toBe(true);
		expect(player.shuffleOrder[0]).toBe(2);
		expect(player.shuffleOrder).toHaveLength(4);
		expect(new Set(player.shuffleOrder)).toEqual(new Set([0, 1, 2, 3]));

		const firstNext = player.shuffleOrder[1]!;
		player.next();
		expect(player.index).toBe(firstNext);

		player.toggleShuffle();
		expect(player.shuffle).toBe(false);
		expect(player.shuffleOrder).toEqual([]);
	});

	it('records history once after the threshold and soft-fails no_user_db', async () => {
		const baseUrl = 'http://127.0.0.1:8080';
		let historyCalls = 0;
		const fetchStub = createFetchStub([
			{
				url: `${baseUrl}/api/history`,
				response: () => {
					historyCalls += 1;
					return errorResponse(400, 'no_user_db');
				}
			}
		]);
		const audio = createMockAudio();
		const player = new PlayerController({
			getBaseUrl: () => baseUrl,
			fetch: fetchStub,
			createClient: createMediaServerClient,
			historyThresholdSeconds: 1
		});
		player.attachAudio(audio);
		player.playTracks([trackFixture({ id: 5 })], 0);
		await vi.waitFor(() => expect(player.playbackStatus).toBe('playing'));

		audio.currentTime = 1.5;
		audio.dispatch('timeupdate');
		await vi.waitFor(() => expect(historyCalls).toBe(1));

		audio.currentTime = 2;
		audio.dispatch('timeupdate');
		audio.dispatch('timeupdate');
		expect(historyCalls).toBe(1);
		expect(player.playbackStatus).toBe('playing');
	});

	it('retries history after a transient failure and records it once after success', async () => {
		const baseUrl = 'http://127.0.0.1:8080';
		let historyCalls = 0;
		const fetchStub = vi.fn(async () => {
			historyCalls += 1;
			if (historyCalls === 1) {
				throw new TypeError('network unavailable');
			}
			return new Response('', { status: 204 });
		});
		const audio = createMockAudio();
		const player = new PlayerController({
			getBaseUrl: () => baseUrl,
			fetch: fetchStub,
			createClient: createMediaServerClient,
			historyThresholdSeconds: 1
		});
		player.attachAudio(audio);
		player.playTracks([trackFixture({ id: 6 })], 0);
		await vi.waitFor(() => expect(player.playbackStatus).toBe('playing'));

		audio.currentTime = 1.5;
		audio.dispatch('timeupdate');
		await vi.waitFor(() => expect(historyCalls).toBe(1));
		await new Promise((resolve) => setTimeout(resolve, 0));

		audio.dispatch('timeupdate');
		await vi.waitFor(() => expect(historyCalls).toBe(2));
		audio.dispatch('timeupdate');
		expect(historyCalls).toBe(2);
	});

	it('toggles play and pause', async () => {
		const audio = createMockAudio();
		const player = new PlayerController({
			getBaseUrl: () => 'http://127.0.0.1:8080'
		});
		player.attachAudio(audio);
		player.playTracks([trackFixture()], 0);
		await vi.waitFor(() => expect(player.playbackStatus).toBe('playing'));

		player.pause();
		expect(player.playbackStatus).toBe('paused');
		await player.play();
		expect(player.playbackStatus).toBe('playing');
	});

	it('seeks within duration and reports media errors', async () => {
		const audio = createMockAudio();
		const player = new PlayerController({
			getBaseUrl: () => 'http://127.0.0.1:8080'
		});
		player.attachAudio(audio);
		player.playTracks([trackFixture()], 0);
		await vi.waitFor(() => expect(player.playbackStatus).toBe('playing'));

		player.seek(999);
		expect(audio.currentTime).toBe(120);
		audio.dispatch('error');
		expect(player.playbackStatus).toBe('error');
		expect(player.errorMessage).toBe('Unable to play this track');
	});

	it('updates queued metadata and removes listeners on dispose', () => {
		const audio = createMockAudio();
		const player = new PlayerController({
			getBaseUrl: () => 'http://127.0.0.1:8080'
		});
		player.attachAudio(audio);
		player.playTracks([trackFixture({ id: 1, title: 'Old' })], 0);
		player.updateTrackInQueue(trackFixture({ id: 1, title: 'New' }));
		expect(player.currentTrack?.title).toBe('New');
		expect(audio.listenerCount('timeupdate')).toBe(1);

		player.dispose();

		expect(audio.listenerCount('timeupdate')).toBe(0);
	});
});
