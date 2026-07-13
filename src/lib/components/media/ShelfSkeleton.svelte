<script lang="ts">
	interface Props {
		count?: number;
	}

	let { count = 6 }: Props = $props();
</script>

<div class="flex gap-3 overflow-hidden" aria-hidden="true">
	{#each Array.from({ length: count }, (_, i) => i) as i (i)}
		<div class="bg-surface-muted h-44 w-36 shrink-0 animate-pulse rounded-card sm:w-40"></div>
	{/each}
</div>
