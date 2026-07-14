import { describe, expect, it } from 'vitest';
import { trackFixture } from '$lib/test/fixtures';
import {
	buildShuffleOrder,
	canResolveNext,
	canResolvePrevious,
	nextQueueIndex,
	previousQueueIndex,
	replaceQueue,
	resolveNextIndex,
	resolvePreviousIndex,
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

	it('builds a shuffle order with the current index first', () => {
		const order = buildShuffleOrder(4, 2, () => 0);
		expect(order[0]).toBe(2);
		expect(order).toHaveLength(4);
		expect(new Set(order)).toEqual(new Set([0, 1, 2, 3]));
	});

	it('resolves next/previous with repeat off at ends', () => {
		const base = {
			length: 3,
			repeat: 'off' as const,
			shuffle: false,
			shuffleOrder: [] as number[]
		};
		expect(resolveNextIndex({ ...base, index: 1 })).toBe(2);
		expect(resolveNextIndex({ ...base, index: 2 })).toBeNull();
		expect(resolvePreviousIndex({ ...base, index: 0 })).toBeNull();
		expect(canResolveNext({ ...base, index: 2 })).toBe(false);
		expect(canResolvePrevious({ ...base, index: 0 })).toBe(false);
	});

	it('wraps next/previous when repeat is all', () => {
		const base = {
			length: 3,
			repeat: 'all' as const,
			shuffle: false,
			shuffleOrder: [] as number[]
		};
		expect(resolveNextIndex({ ...base, index: 2 })).toBe(0);
		expect(resolvePreviousIndex({ ...base, index: 0 })).toBe(2);
		expect(canResolveNext({ ...base, index: 2 })).toBe(true);
		expect(canResolvePrevious({ ...base, index: 0 })).toBe(true);
	});

	it('keeps next on the same index when repeat is one', () => {
		const base = {
			index: 1,
			length: 3,
			repeat: 'one' as const,
			shuffle: false,
			shuffleOrder: [] as number[]
		};
		expect(resolveNextIndex(base)).toBe(1);
		expect(resolvePreviousIndex(base)).toBe(0);
		expect(canResolveNext(base)).toBe(true);
	});

	it('walks shuffle order for next and previous', () => {
		const shuffleOrder = [2, 0, 3, 1];
		const base = {
			length: 4,
			repeat: 'off' as const,
			shuffle: true,
			shuffleOrder
		};
		expect(resolveNextIndex({ ...base, index: 2 })).toBe(0);
		expect(resolveNextIndex({ ...base, index: 1 })).toBeNull();
		expect(resolvePreviousIndex({ ...base, index: 0 })).toBe(2);
		expect(resolvePreviousIndex({ ...base, index: 2 })).toBeNull();

		expect(resolveNextIndex({ ...base, index: 1, repeat: 'all' })).toBe(2);
		expect(resolvePreviousIndex({ ...base, index: 2, repeat: 'all' })).toBe(1);
	});
});
