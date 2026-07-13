import type { Track } from '$lib/api/schemas';

export const HISTORY_START_THRESHOLD_SECONDS = 1;

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
