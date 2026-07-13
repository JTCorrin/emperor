import { describe, expect, it } from 'vitest';
import { trackFixture } from '$lib/test/fixtures';
import {
	nextQueueIndex,
	previousQueueIndex,
	replaceQueue,
	shouldRecordHistory
} from '$lib/state/queue';

describe('queue helpers', () => {
	it('replaces the queue and clamps the start index', () => {
		const tracks = [trackFixture({ id: 1 }), trackFixture({ id: 2 }), trackFixture({ id: 3 })];
		expect(replaceQueue(tracks, 1)).toMatchObject({
			index: 1,
			current: { id: 2 }
		});
		expect(replaceQueue(tracks, 99).index).toBe(2);
		expect(replaceQueue([], 0)).toEqual({ queue: [], index: -1, current: null });
	});

	it('advances and retreats within bounds', () => {
		expect(nextQueueIndex(0, 3)).toBe(1);
		expect(nextQueueIndex(2, 3)).toBeNull();
		expect(previousQueueIndex(2, 3)).toBe(1);
		expect(previousQueueIndex(0, 3)).toBeNull();
	});

	it('records history once after meaningful playback', () => {
		expect(
			shouldRecordHistory({
				trackId: 1,
				alreadyRecordedTrackId: null,
				positionSeconds: 0.2
			})
		).toBe(false);
		expect(
			shouldRecordHistory({
				trackId: 1,
				alreadyRecordedTrackId: null,
				positionSeconds: 1
			})
		).toBe(true);
		expect(
			shouldRecordHistory({
				trackId: 1,
				alreadyRecordedTrackId: 1,
				positionSeconds: 5
			})
		).toBe(false);
	});
});
