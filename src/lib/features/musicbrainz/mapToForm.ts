import type { AlbumMetadataForm, TrackMetadataForm } from '$lib/api/schemas';
import type { MbRecording, MbRelease } from './schemas';

function artistCreditName(
	credit: { name?: string; artist?: { name?: string } }[] | undefined
): string {
	if (!credit?.length) return '';
	const first = credit[0];
	return (first?.name ?? first?.artist?.name ?? '').trim();
}

function topTag(tags: { name?: string; count?: number }[] | undefined): string {
	if (!tags?.length) return '';
	const sorted = [...tags].sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
	return (sorted[0]?.name ?? '').trim();
}

/** Normalize MB date strings to YYYY / YYYY-MM / YYYY-MM-DD when possible. */
export function normalizeMbDate(date: string | undefined): string {
	if (!date) return '';
	const trimmed = date.trim();
	if (/^\d{4}(-\d{2}(-\d{2})?)?$/.test(trimmed)) return trimmed;
	const year = trimmed.match(/^(\d{4})/);
	return year?.[1] ?? '';
}

export type TrackLookupResult = {
	form: Partial<TrackMetadataForm>;
	recordingMbid: string;
	releaseMbid: string | null;
};

export type AlbumLookupResult = {
	form: Partial<AlbumMetadataForm>;
	releaseMbid: string;
};

export function mapRecordingToTrackForm(recording: MbRecording): TrackLookupResult {
	const release = recording.releases?.[0];
	const media = release?.media?.[0];
	const track = media?.track?.[0];
	const trackNumber =
		track?.position != null
			? String(track.position)
			: track?.number && /^\d+$/.test(track.number)
				? track.number
				: '';

	return {
		recordingMbid: recording.id,
		releaseMbid: release?.id ?? null,
		form: {
			title: (recording.title ?? '').trim(),
			artist: artistCreditName(recording['artist-credit']),
			album: (release?.title ?? '').trim(),
			release_date: normalizeMbDate(release?.date),
			genre: topTag(recording.tags),
			track_number: trackNumber,
			disc_number: media?.position != null ? String(media.position) : ''
		}
	};
}

export function mapReleaseToAlbumForm(release: MbRelease): AlbumLookupResult {
	const groupTags = release['release-group']?.tags;
	const genre = topTag(release.tags) || topTag(groupTags);

	return {
		releaseMbid: release.id,
		form: {
			name: (release.title ?? '').trim(),
			artist: artistCreditName(release['artist-credit']),
			release_date: normalizeMbDate(release.date),
			genre
		}
	};
}

/** Lucene-ish query helper: escape quotes and join fields. */
export function buildRecordingQuery(input: {
	title: string;
	artist: string;
	album?: string;
}): string {
	const parts: string[] = [];
	const title = input.title.trim();
	const artist = input.artist.trim();
	const album = input.album?.trim();
	if (title) parts.push(`recording:"${title.replaceAll('"', '')}"`);
	if (artist) parts.push(`artist:"${artist.replaceAll('"', '')}"`);
	if (album) parts.push(`release:"${album.replaceAll('"', '')}"`);
	return parts.join(' AND ') || title || artist;
}

export function buildReleaseQuery(input: { name: string; artist: string }): string {
	const parts: string[] = [];
	const name = input.name.trim();
	const artist = input.artist.trim();
	if (name) parts.push(`release:"${name.replaceAll('"', '')}"`);
	if (artist) parts.push(`artist:"${artist.replaceAll('"', '')}"`);
	return parts.join(' AND ') || name || artist;
}
