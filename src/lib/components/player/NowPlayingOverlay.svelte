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

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && player.expanded) {
			player.collapse();
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if player.expanded && track}
	<div
		class="bg-surface/95 fixed inset-0 z-40 flex items-center justify-center p-4 backdrop-blur-sm"
		role="presentation"
	>
		<div
			class="border-border bg-surface-raised rounded-card relative flex w-full max-w-xl flex-col gap-6 border p-6 shadow-2xl"
			role="dialog"
			aria-modal="true"
			aria-label="Now playing"
			tabindex="-1"
		>
			<button
				type="button"
				class="border-border bg-surface-muted absolute top-4 right-4 min-h-touch min-w-touch rounded-card border text-base font-medium"
				onclick={() => player.collapse()}
			>
				Close
			</button>

			<div class="mt-8 flex flex-col items-center gap-4 text-center">
				<CoverArt title={track.title} artist={track.artist} {baseUrl} size="lg" />
				<div>
					<h2 class="text-2xl font-semibold">{track.title}</h2>
					<p class="text-text-muted text-lg">{track.artist}</p>
					<p class="text-text-muted text-sm">{track.album}</p>
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
			</div>
		</div>
	</div>
{/if}
