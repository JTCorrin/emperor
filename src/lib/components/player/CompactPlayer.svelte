<script lang="ts">
	import CoverArt from '$lib/components/media/CoverArt.svelte';
	import type { PlayerController } from '$lib/state/player.svelte';

	interface Props {
		player: PlayerController;
		baseUrl?: string | null;
	}

	let { player, baseUrl = null }: Props = $props();

	const track = $derived(player.currentTrack);
	const progressMax = $derived(player.duration > 0 ? player.duration : 1);
	const canPrevious = $derived(player.index > 0);
	const canNext = $derived(player.index >= 0 && player.index < player.queue.length - 1);

	function formatTime(seconds: number): string {
		if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
		const total = Math.floor(seconds);
		const m = Math.floor(total / 60);
		const s = total % 60;
		return `${m}:${s.toString().padStart(2, '0')}`;
	}
</script>

{#if track}
	<section
		class="border-border bg-surface-raised/95 border-t backdrop-blur"
		aria-label="Now playing"
	>
		<div class="mx-auto flex max-w-6xl items-center gap-3 px-3 py-2 sm:gap-4 sm:px-6">
			<button
				type="button"
				class="hover:border-accent flex min-w-0 flex-1 items-center gap-3 rounded-card border border-transparent p-1 text-left"
				onclick={() => player.expand()}
			>
				<CoverArt title={track.title} artist={track.artist} {baseUrl} size="sm" />
				<span class="min-w-0">
					<span class="block truncate text-base font-semibold">{track.title}</span>
					<span class="text-text-muted block truncate text-sm">{track.artist}</span>
				</span>
			</button>

			<div class="flex items-center gap-2">
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
			</div>
		</div>

		<div class="mx-auto flex max-w-6xl items-center gap-3 px-3 pb-3 sm:px-6">
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
	</section>
{/if}
