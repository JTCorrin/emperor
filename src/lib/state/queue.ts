import type { Track } from '$lib/api/schemas';

export const HISTORY_START_THRESHOLD_SECONDS = 1;

export type RepeatMode = 'off' | 'one' | 'all';

/** Returns true when this play session should record history for the track. */
export function shouldRecordHistory(options: {
	trackId: number | null;
	alreadyRecordedTrackId: number | null;
	positionSeconds: number;
	thresholdSeconds?: number;
}): boolean {
	const {
		trackId,
		alreadyRecordedTrackId,
		positionSeconds,
		thresholdSeconds = HISTORY_START_THRESHOLD_SECONDS
	} = options;

	if (trackId === null) return false;
	if (alreadyRecordedTrackId === trackId) return false;
	return positionSeconds >= thresholdSeconds;
}

export function clampQueueIndex(index: number, length: number): number {
	if (length <= 0) return -1;
	if (index < 0) return 0;
	if (index >= length) return length - 1;
	return index;
}

export function nextQueueIndex(index: number, length: number): number | null {
	if (length <= 0 || index < 0) return null;
	if (index + 1 >= length) return null;
	return index + 1;
}

export function previousQueueIndex(index: number, length: number): number | null {
	if (length <= 0 || index < 0) return null;
	if (index - 1 < 0) return null;
	return index - 1;
}

/**
 * Builds a permutation of queue indices with `currentIndex` first.
 * Remaining indices are Fisher–Yates shuffled via `random` (default Math.random).
 */
export function buildShuffleOrder(
	length: number,
	currentIndex: number,
	random: () => number = Math.random
): number[] {
	if (length <= 0) return [];
	const clamped = clampQueueIndex(currentIndex, length);
	const rest: number[] = [];
	for (let i = 0; i < length; i++) {
		if (i !== clamped) rest.push(i);
	}
	for (let i = rest.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		const tmp = rest[i]!;
		rest[i] = rest[j]!;
		rest[j] = tmp;
	}
	return [clamped, ...rest];
}

export type ResolveQueueIndexOptions = {
	index: number;
	length: number;
	repeat: RepeatMode;
	shuffle: boolean;
	shuffleOrder: readonly number[];
};

function orderPosition(index: number, shuffleOrder: readonly number[]): number {
	return shuffleOrder.indexOf(index);
}

function indexAtOrderPosition(
	position: number,
	shuffle: boolean,
	shuffleOrder: readonly number[],
	length: number
): number | null {
	if (shuffle) {
		if (position < 0 || position >= shuffleOrder.length) return null;
		const next = shuffleOrder[position];
		return next === undefined ? null : next;
	}
	if (position < 0 || position >= length) return null;
	return position;
}

/** Next queue index under shuffle/repeat rules. `repeat: 'one'` keeps the current index. */
export function resolveNextIndex(options: ResolveQueueIndexOptions): number | null {
	const { index, length, repeat, shuffle, shuffleOrder } = options;
	if (length <= 0 || index < 0) return null;
	if (repeat === 'one') return index;

	const position = shuffle ? orderPosition(index, shuffleOrder) : index;
	if (shuffle && position < 0) return null;

	const candidate = position + 1;
	if (candidate < length) {
		return indexAtOrderPosition(candidate, shuffle, shuffleOrder, length);
	}
	if (repeat === 'all') {
		return indexAtOrderPosition(0, shuffle, shuffleOrder, length);
	}
	return null;
}

/** Previous queue index under shuffle/repeat rules (repeat-one does not affect previous). */
export function resolvePreviousIndex(options: ResolveQueueIndexOptions): number | null {
	const { index, length, repeat, shuffle, shuffleOrder } = options;
	if (length <= 0 || index < 0) return null;

	const position = shuffle ? orderPosition(index, shuffleOrder) : index;
	if (shuffle && position < 0) return null;

	const candidate = position - 1;
	if (candidate >= 0) {
		return indexAtOrderPosition(candidate, shuffle, shuffleOrder, length);
	}
	if (repeat === 'all') {
		return indexAtOrderPosition(length - 1, shuffle, shuffleOrder, length);
	}
	return null;
}

/** Whether next is available (including wrap / repeat-one stay). */
export function canResolveNext(options: ResolveQueueIndexOptions): boolean {
	return resolveNextIndex(options) !== null;
}

/** Whether previous is available (including wrap / repeat-one stay). */
export function canResolvePrevious(options: ResolveQueueIndexOptions): boolean {
	return resolvePreviousIndex(options) !== null;
}

export function replaceQueue(
	tracks: Track[],
	startIndex: number
): { queue: Track[]; index: number; current: Track | null } {
	if (tracks.length === 0) {
		return { queue: [], index: -1, current: null };
	}
	const index = clampQueueIndex(startIndex, tracks.length);
	return {
		queue: [...tracks],
		index,
		current: tracks[index] ?? null
	};
}
