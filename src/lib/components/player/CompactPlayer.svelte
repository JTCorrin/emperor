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
		onAddToPlaylist?: () => void;
	}

	let {
		player,
		baseUrl = null,
		favourites = null,
		hasUserDb = null,
		onAddToPlaylist
	}: Props = $props();

	const track = $derived(player.currentTrack);
	const progressMax = $derived(player.duration > 0 ? player.duration : 1);
	const canPrevious = $derived(player.canGoPrevious);
	const canNext = $derived(player.canGoNext);
	const showFavourite = $derived(hasUserDb === true && favourites != null && track != null);
	const showAdd = $derived(hasUserDb === true && onAddToPlaylist != null);
	const isFavourite = $derived(track && favourites ? favourites.isFavourite(track.id) : false);
	const coverId = $derived(track?.cover_id ?? null);

	let linkPending = $state(false);
	let menuOpen = $state(false);

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

	function onWindowKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && menuOpen) {
			event.preventDefault();
			menuOpen = false;
		}
	}

	function addToPlaylist() {
		menuOpen = false;
		onAddToPlaylist?.();
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

<svelte:window onkeydown={onWindowKeydown} />

{#if track}
	<section
		class="border-border bg-surface-raised/95 border-t backdrop-blur"
		aria-label="Now playing"
	>
		<div class="mx-auto flex max-w-6xl flex-col gap-2 px-3 py-2 sm:px-6">
			<div class="flex items-center gap-3 sm:gap-4">
				<div class="flex min-w-0 flex-1 items-center gap-3 p-1">
					<CoverArt title={track.title} artist={track.artist} {coverId} {baseUrl} size="sm" />
					<span class="block min-w-0 truncate text-base font-semibold">{track.title}</span>
				</div>

				<div class="flex items-center gap-2">
					{#if showFavourite && favourites}
						<button
							type="button"
							class="border-border bg-surface-muted flex min-h-touch-lg min-w-touch-lg items-center justify-center rounded-card border disabled:opacity-40"
							aria-pressed={isFavourite}
							aria-label={isFavourite
								? `Remove ${track.title} from favourites`
								: `Add ${track.title} to favourites`}
							disabled={favourites.isPending(track.id)}
							onclick={() => favourites.toggle(track)}
						>
							{#if isFavourite}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="currentColor"
									class="h-5 w-5"
									aria-hidden="true"
								>
									<path
										d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
									/>
								</svg>
							{:else}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									class="h-5 w-5"
									aria-hidden="true"
								>
									<path
										d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
									/>
								</svg>
							{/if}
						</button>
					{/if}
					<button
						type="button"
						class="border-border bg-surface-muted flex min-h-touch-lg min-w-touch-lg items-center justify-center rounded-card border disabled:opacity-40"
						aria-label="Previous track"
						disabled={!canPrevious}
						onclick={() => player.previous()}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="currentColor"
							class="h-5 w-5"
							aria-hidden="true"
						>
							<path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z" />
						</svg>
					</button>
					<button
						type="button"
						class="bg-accent text-text hover:bg-accent-strong flex min-h-touch-lg min-w-touch-lg items-center justify-center rounded-card"
						aria-label={player.playbackStatus === 'playing' ? 'Pause' : 'Play'}
						onclick={() => player.toggle()}
					>
						{#if player.playbackStatus === 'playing'}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="currentColor"
								class="h-5 w-5"
								aria-hidden="true"
							>
								<path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
							</svg>
						{:else}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="currentColor"
								class="h-5 w-5"
								aria-hidden="true"
							>
								<path d="M8 5v14l11-7L8 5z" />
							</svg>
						{/if}
					</button>
					<button
						type="button"
						class="border-border bg-surface-muted flex min-h-touch-lg min-w-touch-lg items-center justify-center rounded-card border disabled:opacity-40"
						aria-label="Next track"
						disabled={!canNext}
						onclick={() => player.next()}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="currentColor"
							class="h-5 w-5"
							aria-hidden="true"
						>
							<path d="M16 6h2v12h-2V6zM6 18l8.5-6L6 6v12z" />
						</svg>
					</button>
					<button
						type="button"
						class="flex min-h-touch-lg min-w-touch-lg items-center justify-center rounded-card {player.shuffle
							? 'bg-accent text-text hover:bg-accent-strong'
							: 'border-border bg-surface-muted border'}"
						aria-pressed={player.shuffle}
						aria-label={player.shuffle ? 'Shuffle on' : 'Shuffle off'}
						onclick={() => player.toggleShuffle()}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="h-5 w-5"
							aria-hidden="true"
						>
							<polyline points="16 3 21 3 21 8" />
							<line x1="4" y1="20" x2="21" y2="3" />
							<polyline points="21 16 21 21 16 21" />
							<line x1="15" y1="15" x2="21" y2="21" />
							<line x1="4" y1="4" x2="9" y2="9" />
						</svg>
					</button>
					<button
						type="button"
						class="flex min-h-touch-lg min-w-touch-lg items-center justify-center rounded-card {player.repeat !==
						'off'
							? 'bg-accent text-text hover:bg-accent-strong'
							: 'border-border bg-surface-muted border'}"
						aria-pressed={player.repeat !== 'off'}
						aria-label={repeatLabel(player.repeat)}
						onclick={() => player.cycleRepeat()}
					>
						{#if player.repeat === 'one'}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="h-5 w-5"
								aria-hidden="true"
							>
								<path d="M17 2l4 4-4 4" />
								<path d="M3 11v-1a4 4 0 0 1 4-4h14" />
								<path d="M7 22l-4-4 4-4" />
								<path d="M21 13v1a4 4 0 0 1-4 4H3" />
								<text
									x="12"
									y="15"
									text-anchor="middle"
									font-size="8"
									fill="currentColor"
									stroke="none"
									font-weight="700">1</text
								>
							</svg>
						{:else}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="h-5 w-5"
								aria-hidden="true"
							>
								<path d="M17 2l4 4-4 4" />
								<path d="M3 11v-1a4 4 0 0 1 4-4h14" />
								<path d="M7 22l-4-4 4-4" />
								<path d="M21 13v1a4 4 0 0 1-4 4H3" />
							</svg>
						{/if}
					</button>
					{#if showAdd}
						<div class="relative">
							<button
								type="button"
								class="border-border bg-surface-muted flex min-h-touch-lg min-w-touch-lg items-center justify-center rounded-card border text-lg font-medium"
								aria-label="More actions"
								aria-expanded={menuOpen}
								aria-haspopup="menu"
								onclick={() => {
									menuOpen = !menuOpen;
								}}
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="currentColor"
									class="h-5 w-5"
									aria-hidden="true"
								>
									<circle cx="12" cy="5" r="1.75" />
									<circle cx="12" cy="12" r="1.75" />
									<circle cx="12" cy="19" r="1.75" />
								</svg>
							</button>
							{#if menuOpen}
								<div
									class="border-border bg-surface-raised absolute right-0 bottom-full z-10 mb-2 min-w-48 rounded-card border p-2 shadow-xl"
									role="menu"
								>
									<button
										type="button"
										class="hover:bg-surface-muted min-h-touch w-full rounded-card px-3 text-left text-base font-semibold"
										role="menuitem"
										onclick={addToPlaylist}
									>
										Add to playlist
									</button>
								</div>
							{/if}
						</div>
					{/if}
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
