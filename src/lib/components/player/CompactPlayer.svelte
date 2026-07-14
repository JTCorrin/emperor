<script lang="ts">
	import CoverArt from '$lib/components/media/CoverArt.svelte';
	import { createMediaServerClient } from '$lib/api';
	import type { FavouritesController } from '$lib/features/favourites/favourites.svelte';
	import {
		gotoCatalogLink,
		resolveAlbumFromSearch,
		resolveArtistFromSearch
	} from '$lib/features/browse/resolveCatalogLinks';
	import type { PlayerController } from '$lib/state/player.svelte';

	interface Props {
		player: PlayerController;
		baseUrl?: string | null;
		favourites?: FavouritesController | null;
		hasUserDb?: boolean | null;
	}

	let { player, baseUrl = null, favourites = null, hasUserDb = null }: Props = $props();

	const track = $derived(player.currentTrack);
	const progressMax = $derived(player.duration > 0 ? player.duration : 1);
	const canPrevious = $derived(player.canGoPrevious);
	const canNext = $derived(player.canGoNext);
	const showFavourite = $derived(hasUserDb === true && favourites != null && track != null);
	const isFavourite = $derived(track && favourites ? favourites.isFavourite(track.id) : false);
	const coverId = $derived(track?.cover_id ?? null);

	let linkPending = $state(false);

	function repeatLabel(mode: typeof player.repeat): string {
		if (mode === 'all') return 'Repeat all';
		if (mode === 'one') return 'Repeat one';
		return 'Repeat off';
	}

	function formatTime(seconds: number): string {
		if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
		const total = Math.floor(seconds);
		const m = Math.floor(total / 60);
		const s = total % 60;
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	async function openArtist() {
		if (!track || !baseUrl || linkPending) return;
		linkPending = true;
		try {
			const client = createMediaServerClient({ baseUrl });
			const target = await resolveArtistFromSearch(client, track.artist);
			await gotoCatalogLink(target);
		} finally {
			linkPending = false;
		}
	}

	async function openAlbum() {
		if (!track || !baseUrl || linkPending) return;
		linkPending = true;
		try {
			const target =
				track.album_id != null
					? { kind: 'album' as const, id: track.album_id }
					: await resolveAlbumFromSearch(
							createMediaServerClient({ baseUrl }),
							track.album,
							track.artist
						);
			await gotoCatalogLink(target);
		} finally {
			linkPending = false;
		}
	}
</script>

{#if track}
	<section
		class="border-border bg-surface-raised/95 border-t backdrop-blur"
		aria-label="Now playing"
	>
		<div class="mx-auto flex max-w-6xl flex-col gap-2 px-3 py-2 sm:px-6">
			<div class="flex items-center gap-3 sm:gap-4">
				<button
					type="button"
					class="hover:border-accent flex min-w-0 flex-1 items-center gap-3 rounded-card border border-transparent p-1 text-left"
					aria-label={`Expand player: ${track.title}`}
					onclick={() => player.expand()}
				>
					<CoverArt title={track.title} artist={track.artist} {coverId} {baseUrl} size="sm" />
					<span class="block min-w-0 truncate text-base font-semibold">{track.title}</span>
				</button>

				<div class="flex items-center gap-2">
					{#if showFavourite && favourites}
						<button
							type="button"
							class="border-border bg-surface-muted min-h-touch-lg min-w-touch-lg rounded-card border text-sm font-semibold disabled:opacity-40"
							aria-pressed={isFavourite}
							aria-label={isFavourite
								? `Remove ${track.title} from favourites`
								: `Add ${track.title} to favourites`}
							disabled={favourites.isPending(track.id)}
							onclick={() => favourites.toggle(track)}
						>
							{isFavourite ? 'Unfav' : 'Fav'}
						</button>
					{/if}
					<button
						type="button"
						class="border-border bg-surface-muted min-h-touch-lg min-w-touch-lg rounded-card border text-base font-medium disabled:opacity-40"
						aria-label="Previous track"
						disabled={!canPrevious}
						onclick={() => player.previous()}
					>
						Prev
					</button>
					<button
						type="button"
						class="bg-accent text-text hover:bg-accent-strong min-h-touch-lg min-w-touch-lg rounded-card text-base font-semibold"
						aria-label={player.playbackStatus === 'playing' ? 'Pause' : 'Play'}
						onclick={() => player.toggle()}
					>
						{player.playbackStatus === 'playing' ? 'Pause' : 'Play'}
					</button>
					<button
						type="button"
						class="border-border bg-surface-muted min-h-touch-lg min-w-touch-lg rounded-card border text-base font-medium disabled:opacity-40"
						aria-label="Next track"
						disabled={!canNext}
						onclick={() => player.next()}
					>
						Next
					</button>
					<button
						type="button"
						class="min-h-touch-lg min-w-touch-lg rounded-card text-base font-medium {player.shuffle
							? 'bg-accent text-text hover:bg-accent-strong'
							: 'border-border bg-surface-muted border'}"
						aria-pressed={player.shuffle}
						aria-label={player.shuffle ? 'Shuffle on' : 'Shuffle off'}
						onclick={() => player.toggleShuffle()}
					>
						Shuffle
					</button>
					<button
						type="button"
						class="min-h-touch-lg min-w-touch-lg rounded-card text-base font-medium {player.repeat !==
						'off'
							? 'bg-accent text-text hover:bg-accent-strong'
							: 'border-border bg-surface-muted border'}"
						aria-pressed={player.repeat !== 'off'}
						aria-label={repeatLabel(player.repeat)}
						onclick={() => player.cycleRepeat()}
					>
						{player.repeat === 'all' ? 'All' : player.repeat === 'one' ? 'One' : 'Off'}
					</button>
				</div>
			</div>

			<div class="text-text-muted flex min-w-0 flex-wrap items-center gap-2 px-1 text-sm">
				<button
					type="button"
					class="hover:text-accent min-h-touch truncate font-medium disabled:opacity-50"
					aria-label={`Open artist ${track.artist}`}
					disabled={linkPending || !baseUrl}
					onclick={() => void openArtist()}
				>
					{track.artist}
				</button>
				<span aria-hidden="true">·</span>
				<button
					type="button"
					class="hover:text-accent min-h-touch truncate font-medium disabled:opacity-50"
					aria-label={`Open album ${track.album}`}
					disabled={linkPending || !baseUrl}
					onclick={() => void openAlbum()}
				>
					{track.album}
				</button>
			</div>

			<div class="flex items-center gap-3 pb-1">
				<span class="text-text-muted w-10 text-xs tabular-nums">{formatTime(player.position)}</span>
				<input
					type="range"
					class="accent-accent h-3 w-full"
					min="0"
					max={progressMax}
					step="0.1"
					value={player.position}
					aria-label="Seek"
					oninput={(event) => player.seek(Number(event.currentTarget.value))}
				/>
				<span class="text-text-muted w-10 text-right text-xs tabular-nums"
					>{formatTime(player.duration)}</span
				>
			</div>
		</div>
	</section>
{/if}
