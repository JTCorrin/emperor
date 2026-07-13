import type { Track } from '$lib/api';

function compareNullableNumbers(left: number | null, right: number | null): number {
	if (left === null && right === null) return 0;
	if (left === null) return 1;
	if (right === null) return -1;
	return left - right;
}

export function sortAlbumTracks(tracks: Track[]): Track[] {
	return [...tracks].sort(
		(left, right) =>
			compareNullableNumbers(left.disc_number, right.disc_number) ||
			compareNullableNumbers(left.track_number, right.track_number) ||
			left.title.localeCompare(right.title) ||
			left.id - right.id
	);
}
