import type { Track } from '$lib/api';

/** Layout-scoped opener for the shared Add to playlist dialog. */
export class AddToPlaylistController {
	track = $state.raw<Track | null>(null);

	open(track: Track): void {
		this.track = track;
	}

	close(): void {
		this.track = null;
	}
}
