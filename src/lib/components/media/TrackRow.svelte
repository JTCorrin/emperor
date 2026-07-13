<script lang="ts">
	interface Props {
		title: string;
		subtitle?: string;
		trackNumber?: number | null;
		onclick?: () => void;
	}

	let { title, subtitle = '', trackNumber = null, onclick }: Props = $props();
</script>

<button
	type="button"
	class="border-border bg-surface-raised hover:border-accent focus-visible:border-accent flex min-h-touch w-full items-center gap-4 rounded-card border px-4 py-3 text-left"
	{onclick}
>
	{#if trackNumber != null}
		<span class="text-text-muted w-8 shrink-0 text-center text-base tabular-nums"
			>{trackNumber}</span
		>
	{/if}
	<span class="min-w-0 flex-1">
		<span class="block truncate text-lg font-semibold">{title}</span>
		{#if subtitle}
			<span class="text-text-muted block truncate text-base">{subtitle}</span>
		{/if}
	</span>
</button>
