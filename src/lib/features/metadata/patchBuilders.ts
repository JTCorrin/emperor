import type {
	Album,
	AlbumMetadataForm,
	AlbumMetadataPatch,
	Track,
	TrackMetadataForm,
	TrackMetadataPatch
} from '$lib/api/schemas';

export function trackToFormValues(track: Track): TrackMetadataForm {
	return {
		title: track.title,
		artist: track.artist,
		album: track.album,
		release_date: track.release_date ?? '',
		genre: track.genre ?? '',
		track_number: track.track_number == null ? '' : String(track.track_number),
		disc_number: track.disc_number == null ? '' : String(track.disc_number)
	};
}

export function albumToFormValues(album: Album): AlbumMetadataForm {
	return {
		name: album.name,
		artist: album.artist,
		release_date: album.release_date ?? '',
		genre: album.genre ?? ''
	};
}

/**
 * Build a partial track PATCH from form values vs the original track.
 * - Unchanged fields are omitted.
 * - Cleared nullable fields (empty string where original had a value, or explicit clear) send null.
 */
export function buildTrackPatch(
	original: Track,
	form: TrackMetadataForm,
	cleared: Partial<Record<keyof TrackMetadataPatch, boolean>> = {}
): TrackMetadataPatch {
	const patch: TrackMetadataPatch = {};
	const baseline = trackToFormValues(original);

	const stringFields = ['title', 'artist', 'album', 'release_date', 'genre'] as const;
	for (const key of stringFields) {
		if (cleared[key]) {
			patch[key] = null;
			continue;
		}
		const next = form[key].trim();
		const prev = baseline[key].trim();
		if (next === prev) continue;
		if (next === '') {
			if (key === 'title' || key === 'artist' || key === 'album') {
				continue;
			}
			patch[key] = null;
		} else {
			patch[key] = next;
		}
	}

	for (const key of ['track_number', 'disc_number'] as const) {
		if (cleared[key]) {
			patch[key] = null;
			continue;
		}
		const next = form[key].trim();
		const prev = baseline[key].trim();
		if (next === prev) continue;
		if (next === '') {
			patch[key] = null;
		} else {
			patch[key] = Number(next);
		}
	}

	return patch;
}

export function buildAlbumPatch(
	original: Album,
	form: AlbumMetadataForm,
	cleared: Partial<Record<keyof AlbumMetadataPatch, boolean>> = {}
): AlbumMetadataPatch {
	const patch: AlbumMetadataPatch = {};
	const baseline = albumToFormValues(original);

	for (const key of ['name', 'artist', 'release_date', 'genre'] as const) {
		if (cleared[key]) {
			patch[key] = null;
			continue;
		}
		const next = form[key].trim();
		const prev = baseline[key].trim();
		if (next === prev) continue;
		if (next === '') {
			if (key === 'name' || key === 'artist') continue;
			patch[key] = null;
		} else {
			patch[key] = next;
		}
	}

	return patch;
}
