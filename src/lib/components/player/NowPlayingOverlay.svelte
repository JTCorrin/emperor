<script lang="ts">
	import CoverArt from '$lib/components/media/CoverArt.svelte';
	import { createMediaServerClient } from '$lib/api';
	import {
		gotoCatalogLink,
		resolveAlbumCoverId,
		resolveAlbumFromSearch,
		resolveArtistFromSearch
	} from '$lib/features/browse/resolveCatalogLinks';
	import type { PlayerController } from '$lib/state/player.svelte';

	interface Props {
		player: PlayerController;
		baseUrl?: string | null;
		hasUserDb?: boolean | null;
		onAddToPlaylist?: () => void;
	}

	let { player, baseUrl = null, hasUserDb = null, onAddToPlaylist }: Props = $props();

	const track = $derived(player.currentTrack);
	const progressMax = $derived(player.duration > 0 ? player.duration : 1);
	const canPrevious = $derived(player.canGoPrevious);
	const canNext = $derived(player.canGoNext);
	const showAdd = $derived(hasUserDb === true && onAddToPlaylist != null);

	let linkPending = $state(false);
	let coverId = $state<number | null>(null);
	let menuOpen = $state(false);

	function repeatLabel(mode: typeof player.repeat): string {
		if (mode === 'all') return 'Repeat all';
		if (mode === 'one') return 'Repeat one';
		return 'Repeat off';
	}

	function onWindowKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && player.expanded) {
			event.preventDefault();
			if (menuOpen) {
				menuOpen = false;
				return;
			}
			player.collapse();
		}
	}

	function trapFocus(event: KeyboardEvent) {
		if (event.key !== 'Tab') return;

		const dialog = event.currentTarget as HTMLDivElement;
		const focusable = Array.from(
			dialog.querySelectorAll<HTMLElement>(
				'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
			)
		);
		if (focusable.length === 0) {
			event.preventDefault();
			dialog.focus();
			return;
		}

		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		const active = document.activeElement;
		if (event.shiftKey && (active === first || !dialog.contains(active))) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
			event.preventDefault();
			first.focus();
		}
	}

	function focusCloseOnOpen(button: HTMLButtonElement) {
		const previousFocus =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		queueMicrotask(() => button.focus());
		return () => {
			if (previousFocus?.isConnected) previousFocus.focus();
		};
	}

	async function openArtist() {
		if (!track || !baseUrl || linkPending) return;
		linkPending = true;
		try {
			const client = createMediaServerClient({ baseUrl });
			const target = await resolveArtistFromSearch(client, track.artist);
			player.collapse();
			await gotoCatalogLink(target);
		} finally {
			linkPending = false;
		}
	}

	async function openAlbum() {
		if (!track || !baseUrl || linkPending) return;
		linkPending = true;
		try {
			const client = createMediaServerClient({ baseUrl });
			const target = await resolveAlbumFromSearch(client, track.album, track.artist);
			player.collapse();
			await gotoCatalogLink(target);
		} finally {
			linkPending = false;
		}
	}

	function addToPlaylist() {
		menuOpen = false;
		onAddToPlaylist?.();
	}

	$effect(() => {
		const current = track;
		const url = baseUrl;
		coverId = null;
		menuOpen = false;
		if (!current || !url) return;

		const abort = new AbortController();
		void (async () => {
			try {
				const client = createMediaServerClient({ baseUrl: url });
				const id = await resolveAlbumCoverId(client, current.album, current.artist, abort.signal);
				if (!abort.signal.aborted) coverId = id;
			} catch {
				if (!abort.signal.aborted) coverId = null;
			}
		})();

		return () => abort.abort();
	});
</script>

<svelte:window onkeydown={onWindowKeydown} />

{#if player.expanded && track}
	<div
		class="bg-surface/95 fixed inset-0 z-40 flex items-center justify-center p-4 backdrop-blur-sm"
		role="presentation"
	>
		<div
			class="border-border bg-surface-raised rounded-card relative flex w-full max-w-xl flex-col gap-6 border p-6 shadow-2xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby="now-playing-title"
			tabindex="-1"
			onkeydown={trapFocus}
		>
			<div class="absolute top-4 right-4 flex gap-2">
				{#if showAdd}
					<div class="relative">
						<button
							type="button"
							class="border-border bg-surface-muted min-h-touch min-w-touch rounded-card border text-base font-medium"
							aria-label="More actions"
							aria-expanded={menuOpen}
							aria-haspopup="menu"
							onclick={() => {
								menuOpen = !menuOpen;
							}}
						>
							⋮
						</button>
						{#if menuOpen}
							<div
								class="border-border bg-surface-raised absolute top-full right-0 z-10 mt-2 min-w-48 rounded-card border p-2 shadow-xl"
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
				<button
					type="button"
					class="border-border bg-surface-muted min-h-touch min-w-touch rounded-card border text-base font-medium"
					onclick={() => player.collapse()}
					{@attach focusCloseOnOpen}
				>
					Close
				</button>
			</div>

			<div class="mt-8 flex flex-col items-center gap-4 text-center">
				<CoverArt title={track.title} artist={track.artist} {coverId} {baseUrl} size="lg" />
				<div class="flex flex-col items-center gap-2">
					<h2 id="now-playing-title" class="text-2xl font-semibold">{track.title}</h2>
					<button
						type="button"
						class="text-text-muted hover:text-accent min-h-touch text-lg font-medium disabled:opacity-50"
						aria-label={`Open artist ${track.artist}`}
						disabled={linkPending || !baseUrl}
						onclick={() => void openArtist()}
					>
						{track.artist}
					</button>
					<button
						type="button"
						class="text-text-muted hover:text-accent min-h-touch text-base font-medium disabled:opacity-50"
						aria-label={`Open album ${track.album}`}
						disabled={linkPending || !baseUrl}
						onclick={() => void openAlbum()}
					>
						{track.album}
					</button>
				</div>
			</div>

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

			<div class="flex items-center justify-center gap-3">
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
					class="bg-accent text-text hover:bg-accent-strong min-h-touch-lg min-w-28 rounded-card px-6 text-lg font-semibold"
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
	</div>
{/if}
