<script lang="ts">
	import type { Snippet } from 'svelte';
	import CoverArt from '$lib/components/media/CoverArt.svelte';

	interface Props {
		title: string;
		subtitle?: string;
		coverId?: number | null;
		baseUrl?: string | null;
		onclick?: () => void;
		children?: Snippet;
	}

	let { title, subtitle = '', coverId = null, baseUrl = null, onclick, children }: Props = $props();
</script>

<button
	type="button"
	class="border-border bg-surface-raised hover:border-accent focus-visible:border-accent flex w-36 shrink-0 snap-start flex-col gap-2 rounded-card border p-2 text-left sm:w-40"
	{onclick}
>
	<CoverArt {title} artist={subtitle} {coverId} {baseUrl} size="card" />
	<span class="min-w-0 px-1">
		<span class="block truncate text-base font-semibold">{title}</span>
		{#if subtitle}
			<span class="text-text-muted block truncate text-sm">{subtitle}</span>
		{/if}
	</span>
	{#if children}{@render children()}{/if}
</button>
